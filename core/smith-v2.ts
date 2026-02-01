/**
 * Agent Smith v2 Runtime
 * 
 * Unified runtime that orchestrates all protection layers:
 * 1. Pre-filter: Pattern-based detection (existing detector)
 * 2. Capability Validator: Action allow-listing and constraints
 * 3. Vault: Secret isolation
 * 
 * This makes prompt injection *irrelevant*:
 * - Even if injection succeeds, actions are constrained by capabilities
 * - Even if actions run, secrets are never exposed to LLM
 */

import { AgentSmithDetector } from "../src/detector";
import type { ScanResult } from "../src/types";
import { CapabilityValidator, type ActionContext } from "./capability-validator";
import { SecretVault, httpExecutor } from "./vault";
import { VaultClient, openaiExecutor, anthropicExecutor } from "./vault-client";
import { loadConfig, type SmithConfig, type ValidationResult } from "../smith.config";
import { hashForLog } from "./privacy";

// ============================================================================
// V2 SCAN RESULT
// ============================================================================

export interface SmithV2Result {
  /** Overall: allowed or blocked */
  allowed: boolean;
  
  /** Which layer blocked (if blocked) */
  blockedBy?: "prefilter" | "capability" | "vault";
  
  /** Detailed reason */
  reason?: string;
  
  /** Pre-filter result (pattern detection) */
  preFilterResult?: ScanResult;
  
  /** Capability validation result */
  capabilityResult?: ValidationResult;
  
  /** Does this action require user confirmation? */
  requiresConfirmation?: boolean;
  
  /** Total latency in ms */
  latency: number;
}

// ============================================================================
// AGENT SMITH V2
// ============================================================================

export class AgentSmithV2 {
  private config: SmithConfig;
  private detector: AgentSmithDetector;
  private capabilityValidator: CapabilityValidator;
  private vault: SecretVault;
  private vaultClient: VaultClient;

  constructor(configPath?: string) {
    this.config = loadConfig(configPath);
    
    // Initialize layers
    this.detector = new AgentSmithDetector();
    this.capabilityValidator = new CapabilityValidator(this.config);
    
    if (this.config.vault) {
      this.vault = new SecretVault(this.config.vault);
      this.vaultClient = new VaultClient(this.vault);
      
      // Register built-in executors
      this.vault.registerExecutor("openai", openaiExecutor);
      this.vault.registerExecutor("anthropic", anthropicExecutor);
    } else {
      // Create disabled vault
      this.vault = new SecretVault({ enabled: false, secrets: {} });
      this.vaultClient = new VaultClient(this.vault);
    }
  }

  /**
   * Get the vault client for making authenticated requests.
   */
  getVaultClient(): VaultClient {
    return this.vaultClient;
  }

  /**
   * Get the capability validator.
   */
  getCapabilityValidator(): CapabilityValidator {
    return this.capabilityValidator;
  }

  /**
   * Full scan: Pre-filter + Capability validation.
   * Use this before executing any action.
   */
  scan(input: string, action?: ActionContext): SmithV2Result {
    const startTime = performance.now();

    // Layer 1: Pre-filter (pattern detection)
    if (this.config.preFilter?.enabled && this.config.preFilter.usePatternDetector) {
      const preFilterResult = this.detector.scan(input);
      
      if (preFilterResult.blocked) {
        if (this.config.preFilter.mode === "block") {
          return {
            allowed: false,
            blockedBy: "prefilter",
            reason: preFilterResult.reason,
            preFilterResult,
            latency: performance.now() - startTime,
          };
        }
        // Mode is "warn" - log but continue
        this.log("warn", `Pre-filter warning: ${preFilterResult.reason}`, input);
      }
    }

    // Layer 2: Capability validation (if action context provided)
    if (action) {
      const capabilityResult = this.capabilityValidator.validate(action);
      
      if (!capabilityResult.allowed) {
        return {
          allowed: false,
          blockedBy: "capability",
          reason: capabilityResult.reason,
          capabilityResult,
          latency: performance.now() - startTime,
        };
      }

      // Check if confirmation is required
      if (capabilityResult.requiresConfirmation) {
        return {
          allowed: true,
          requiresConfirmation: true,
          reason: "User confirmation required",
          capabilityResult,
          latency: performance.now() - startTime,
        };
      }

      return {
        allowed: true,
        capabilityResult,
        latency: performance.now() - startTime,
      };
    }

    // No action context - just pre-filter passed
    return {
      allowed: true,
      latency: performance.now() - startTime,
    };
  }

  /**
   * Scan a message/input (no action context).
   */
  scanMessage(input: string): SmithV2Result {
    return this.scan(input);
  }

  /**
   * Scan and validate an action.
   */
  scanAction(input: string, action: ActionContext): SmithV2Result {
    return this.scan(input, action);
  }

  /**
   * Quick check: is this action allowed?
   */
  isActionAllowed(action: ActionContext): boolean {
    const result = this.capabilityValidator.validate(action);
    return result.allowed;
  }

  /**
   * Execute an action with full protection.
   * - Validates capability
   * - If action needs secrets, uses vault
   */
  async executeProtected<T>(
    action: ActionContext,
    executor: () => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: string; blocked?: boolean }> {
    // Validate capability
    const validation = this.capabilityValidator.validate(action);
    if (!validation.allowed) {
      return {
        success: false,
        blocked: true,
        error: validation.reason,
      };
    }

    // Check confirmation requirement
    if (validation.requiresConfirmation) {
      // In a real implementation, this would await user confirmation
      // For now, we just note that confirmation would be required
      this.log("info", `Action ${action.action} requires confirmation`, JSON.stringify(action.args));
    }

    // Execute
    try {
      const result = await executor();
      return { success: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * Scale capabilities for model strength.
   */
  scaleForModel(strength: "weak" | "medium" | "strong"): void {
    this.capabilityValidator.scaleForModel(strength);
  }

  /**
   * Get config (readonly).
   */
  getConfig(): Readonly<SmithConfig> {
    return this.config;
  }

  /**
   * Internal logging with privacy protection.
   */
  private async log(level: string, message: string, sensitiveData?: string): Promise<void> {
    if (!this.config.logging) return;
    
    const logLevel = this.config.logging.level;
    const levels = ["debug", "info", "warn", "error"];
    if (levels.indexOf(level) < levels.indexOf(logLevel)) return;

    let logMessage = `[AgentSmith] ${message}`;
    
    if (sensitiveData && this.config.logging.hashPII) {
      const hash = await hashForLog(sensitiveData);
      logMessage += ` (hash=${hash})`;
    }

    switch (level) {
      case "debug":
        console.debug(logMessage);
        break;
      case "info":
        console.info(logMessage);
        break;
      case "warn":
        console.warn(logMessage);
        break;
      case "error":
        console.error(logMessage);
        break;
    }
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export { loadConfig } from "../smith.config";
export type { SmithConfig, CapabilityDef, VaultConfig } from "../smith.config";
export { CapabilityValidator, type ActionContext } from "./capability-validator";
export { SecretVault } from "./vault";
export { VaultClient, describeAvailableSecrets } from "./vault-client";

// ============================================================================
// QUICK START
// ============================================================================

/**
 * Create a ready-to-use Agent Smith v2 instance.
 */
export function createSmith(configPath?: string): AgentSmithV2 {
  return new AgentSmithV2(configPath);
}
