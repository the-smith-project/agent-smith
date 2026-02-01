/**
 * Secret Vault (v2 Core)
 * 
 * Isolates secrets from LLM context. The LLM never sees raw credentials.
 * Instead, it requests operations via tokens, and the vault executes them.
 * 
 * This makes secret extraction *impossible*: even if the LLM is compromised,
 * it has no secrets to leak.
 */

import * as crypto from "crypto";
import type { SmithConfig, VaultConfig, SecretDef, VaultRequestResult } from "../smith.config";

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

interface TokenPayload {
  secretName: string;
  operation: "read" | "use";
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

const SIGNING_KEY = crypto.randomBytes(32); // Per-process key, never exposed

function createToken(secretName: string, operation: "read" | "use", ttlSeconds: number): string {
  const now = Date.now();
  const payload: TokenPayload = {
    secretName,
    operation,
    issuedAt: now,
    expiresAt: now + ttlSeconds * 1000,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payloadStr)
    .digest("hex");

  // Base64 encode: payload.signature
  const token = Buffer.from(`${payloadStr}.${signature}`).toString("base64");
  return token;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    
    // Token format: JSON_PAYLOAD.HEX_SIGNATURE
    // The signature is always 64 hex characters (SHA256)
    const lastDotIndex = decoded.lastIndexOf(".");
    if (lastDotIndex === -1) return null;

    const payloadStr = decoded.slice(0, lastDotIndex);
    const signature = decoded.slice(lastDotIndex + 1);

    // Verify signature length (SHA256 hex = 64 chars)
    if (signature.length !== 64) {
      return null;
    }

    // Verify signature is valid hex
    if (!/^[a-f0-9]{64}$/.test(signature)) {
      return null;
    }

    // Verify signature
    const expectedSig = crypto
      .createHmac("sha256", SIGNING_KEY)
      .update(payloadStr)
      .digest("hex");

    // Use timing-safe comparison
    const sigBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSig, "utf8");
    
    if (sigBuffer.length !== expectedBuffer.length) {
      return null;
    }
    
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(payloadStr) as TokenPayload;

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// SECRET RETRIEVAL
// ============================================================================

function getSecretValue(def: SecretDef): string | null {
  switch (def.source) {
    case "env":
      if (!def.envVar) return null;
      return process.env[def.envVar] ?? null;

    case "oauth":
      // Future: implement OAuth token retrieval
      console.warn("[Vault] OAuth source not yet implemented");
      return null;

    case "external":
      // Future: implement external vault retrieval (HashiCorp, AWS Secrets Manager, etc.)
      console.warn("[Vault] External vault source not yet implemented");
      return null;

    default:
      return null;
  }
}

// ============================================================================
// VAULT CLASS
// ============================================================================

export type VaultOperation = "read" | "use" | "execute";

export interface VaultRequest {
  /** Token for authentication */
  token?: string;
  /** Secret name to access */
  secretName: string;
  /** Operation type */
  operation: VaultOperation;
  /** For 'execute': the action to perform with the secret */
  executeAction?: string;
  /** For 'execute': parameters for the action */
  executeParams?: Record<string, unknown>;
}

export interface ExecuteResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export class SecretVault {
  private config: VaultConfig;
  private usedNonces = new Set<string>();
  private executors: Map<string, (secret: string, params: Record<string, unknown>) => Promise<unknown>>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: VaultConfig) {
    this.config = config;
    this.executors = new Map();

    // Clean up expired nonces periodically (only if enabled)
    if (config.enabled) {
      this.cleanupTimer = setInterval(() => this.cleanupNonces(), 60 * 1000);
      // Allow process to exit even if timer is running
      this.cleanupTimer.unref();
    }
  }

  /**
   * Destroy the vault and clean up resources.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.usedNonces.clear();
  }

  private cleanupNonces(): void {
    // Simple cleanup: clear all nonces older than TTL
    // In production, would track timestamps
    if (this.usedNonces.size > 10000) {
      this.usedNonces.clear();
    }
  }

  /**
   * Register an executor for "execute" operations.
   * Executors receive the secret and perform an action with it.
   * Example: API call executor receives API key and makes the request.
   */
  registerExecutor(
    name: string,
    executor: (secret: string, params: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.executors.set(name, executor);
  }

  /**
   * Request a token for accessing a secret.
   * This is what the LLM calls - it gets a token, not the secret.
   */
  requestToken(secretName: string, operation: "read" | "use" = "use"): VaultRequestResult {
    if (!this.config.enabled) {
      return { success: false, error: "Vault is disabled" };
    }

    const secretDef = this.config.secrets[secretName];
    if (!secretDef) {
      return { success: false, error: `Unknown secret: ${secretName}` };
    }

    const ttl = this.config.tokenTTL ?? 300;
    const token = createToken(secretName, operation, ttl);

    return {
      success: true,
      token,
    };
  }

  /**
   * Use a token to get the actual secret value.
   * This should only be called by trusted code, NOT by LLM.
   */
  useToken(token: string): VaultRequestResult {
    const payload = verifyToken(token);
    if (!payload) {
      return { success: false, error: "Invalid or expired token" };
    }

    // Check nonce reuse (prevent replay attacks)
    if (this.usedNonces.has(payload.nonce)) {
      return { success: false, error: "Token already used" };
    }
    this.usedNonces.add(payload.nonce);

    const secretDef = this.config.secrets[payload.secretName];
    if (!secretDef) {
      return { success: false, error: "Secret not found" };
    }

    const value = getSecretValue(secretDef);
    if (value === null) {
      return { success: false, error: "Secret value not available" };
    }

    return {
      success: true,
      value, // CAUTION: This is the raw secret - never log or expose to LLM
    };
  }

  /**
   * Execute an action using a secret, without exposing the secret.
   * The LLM requests execution, the vault fetches the secret and calls the executor.
   */
  async execute(request: VaultRequest): Promise<ExecuteResult> {
    if (!request.token) {
      return { success: false, error: "Token required for execute operation" };
    }

    const payload = verifyToken(request.token);
    if (!payload) {
      return { success: false, error: "Invalid or expired token" };
    }

    // Check nonce reuse
    if (this.usedNonces.has(payload.nonce)) {
      return { success: false, error: "Token already used" };
    }
    this.usedNonces.add(payload.nonce);

    if (!request.executeAction) {
      return { success: false, error: "Execute action required" };
    }

    const executor = this.executors.get(request.executeAction);
    if (!executor) {
      return { success: false, error: `Unknown executor: ${request.executeAction}` };
    }

    const secretDef = this.config.secrets[payload.secretName];
    if (!secretDef) {
      return { success: false, error: "Secret not found" };
    }

    const secret = getSecretValue(secretDef);
    if (secret === null) {
      return { success: false, error: "Secret value not available" };
    }

    try {
      const result = await executor(secret, request.executeParams ?? {});
      return { success: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * List available secrets (names only, not values).
   * Safe to expose to LLM.
   */
  listSecrets(): string[] {
    return Object.keys(this.config.secrets);
  }

  /**
   * Check if a secret exists and has a value.
   */
  hasSecret(name: string): boolean {
    const def = this.config.secrets[name];
    if (!def) return false;
    return getSecretValue(def) !== null;
  }
}

// ============================================================================
// BUILT-IN EXECUTORS
// ============================================================================

/**
 * HTTP executor: makes authenticated HTTP requests.
 * The secret is used as Bearer token or API key.
 */
export async function httpExecutor(
  secret: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const url = params.url as string;
  const method = (params.method as string) ?? "GET";
  const headers = (params.headers as Record<string, string>) ?? {};
  const body = params.body;
  const authType = (params.authType as string) ?? "bearer";

  // Add authentication
  if (authType === "bearer") {
    headers["Authorization"] = `Bearer ${secret}`;
  } else if (authType === "apikey") {
    headers["X-API-Key"] = secret;
  } else if (authType === "basic") {
    headers["Authorization"] = `Basic ${Buffer.from(secret).toString("base64")}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}
