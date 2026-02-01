/**
 * Vault Client (v2 Core)
 * 
 * Client interface for agents to interact with the vault.
 * The agent/LLM uses this to request operations that require secrets,
 * without ever seeing the secrets themselves.
 * 
 * Flow:
 * 1. Agent calls client.requestApiCall("OPENAI_API_KEY", { url, method, body })
 * 2. Client gets a token from vault
 * 3. Client asks vault to execute the request with the secret
 * 4. Result is returned to agent (without secret exposure)
 */

import type { VaultRequestResult } from "../smith.config";
import { SecretVault, httpExecutor } from "./vault";

// ============================================================================
// VAULT CLIENT
// ============================================================================

export class VaultClient {
  private vault: SecretVault;

  constructor(vault: SecretVault) {
    this.vault = vault;

    // Register built-in executors
    this.vault.registerExecutor("http", httpExecutor);
  }

  /**
   * List available secrets (names only).
   * Safe for LLM to call.
   */
  listAvailableSecrets(): string[] {
    return this.vault.listSecrets();
  }

  /**
   * Check if a secret is available.
   */
  hasSecret(name: string): boolean {
    return this.vault.hasSecret(name);
  }

  /**
   * Make an authenticated HTTP request using a secret.
   * The LLM specifies which secret to use and the request params.
   * The secret value is never exposed.
   */
  async makeAuthenticatedRequest(
    secretName: string,
    params: {
      url: string;
      method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      headers?: Record<string, string>;
      body?: unknown;
      authType?: "bearer" | "apikey" | "basic";
    }
  ): Promise<AuthenticatedRequestResult> {
    // Get token
    const tokenResult = this.vault.requestToken(secretName, "use");
    if (!tokenResult.success || !tokenResult.token) {
      return {
        success: false,
        error: tokenResult.error ?? "Failed to get token",
      };
    }

    // Execute request
    const result = await this.vault.execute({
      token: tokenResult.token,
      secretName,
      operation: "execute",
      executeAction: "http",
      executeParams: params,
    });

    return {
      success: result.success,
      data: result.result,
      error: result.error,
    };
  }

  /**
   * Execute a custom action with a secret.
   * For advanced use cases where built-in executors don't fit.
   */
  async executeWithSecret(
    secretName: string,
    executorName: string,
    params: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const tokenResult = this.vault.requestToken(secretName, "use");
    if (!tokenResult.success || !tokenResult.token) {
      return {
        success: false,
        error: tokenResult.error ?? "Failed to get token",
      };
    }

    const result = await this.vault.execute({
      token: tokenResult.token,
      secretName,
      operation: "execute",
      executeAction: executorName,
      executeParams: params,
    });

    return {
      success: result.success,
      data: result.result,
      error: result.error,
    };
  }

  /**
   * Register a custom executor.
   * Useful for integrating with specific APIs or services.
   */
  registerExecutor(
    name: string,
    executor: (secret: string, params: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.vault.registerExecutor(name, executor);
  }
}

export interface AuthenticatedRequestResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a prompt-safe description of available secrets.
 * This can be injected into system prompts to tell the LLM what's available.
 */
export function describeAvailableSecrets(client: VaultClient): string {
  const secrets = client.listAvailableSecrets();
  if (secrets.length === 0) {
    return "No secrets are configured in the vault.";
  }

  const lines = [
    "Available secrets (use vault client to access):",
    ...secrets.map((s) => `  - ${s}`),
    "",
    "To make an authenticated API request:",
    "  client.makeAuthenticatedRequest('SECRET_NAME', { url, method, body })",
  ];

  return lines.join("\n");
}

// ============================================================================
// OPENAI EXECUTOR (Example)
// ============================================================================

/**
 * Example executor for OpenAI API calls.
 */
export async function openaiExecutor(
  apiKey: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const model = (params.model as string) ?? "gpt-4";
  const messages = params.messages as Array<{ role: string; content: string }>;
  const maxTokens = (params.maxTokens as number) ?? 1000;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
  });

  return response.json();
}

/**
 * Example executor for Anthropic API calls.
 */
export async function anthropicExecutor(
  apiKey: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const model = (params.model as string) ?? "claude-3-opus-20240229";
  const messages = params.messages as Array<{ role: string; content: string }>;
  const maxTokens = (params.maxTokens as number) ?? 1000;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
  });

  return response.json();
}
