/**
 * Capability Validator (v2 Core)
 * 
 * Validates actions against defined capabilities.
 * Unknown/disabled actions → BLOCKED.
 * This makes prompt injection *irrelevant*: even if injection succeeds,
 * the action is constrained by capabilities.
 */

import { minimatch } from "minimatch";
import type {
  SmithConfig,
  CapabilityDef,
  CapabilityConstraints,
  ValidationResult,
} from "../smith.config";

// ============================================================================
// RATE LIMITER (in-memory, per capability)
// ============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(capability: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(capability);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(capability, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) {
    return false; // Rate limited
  }

  entry.count++;
  return true;
}

// ============================================================================
// DOMAIN VALIDATOR
// ============================================================================

function isDomainAllowed(
  domain: string,
  allowed?: string[],
  blocked?: string[]
): { allowed: boolean; reason?: string } {
  // Blocked takes precedence
  if (blocked) {
    for (const pattern of blocked) {
      if (minimatch(domain, pattern, { nocase: true })) {
        return { allowed: false, reason: `Domain blocked by pattern: ${pattern}` };
      }
    }
  }

  // If allowlist exists, domain must match
  if (allowed && allowed.length > 0) {
    for (const pattern of allowed) {
      if (minimatch(domain, pattern, { nocase: true })) {
        return { allowed: true };
      }
    }
    return { allowed: false, reason: "Domain not in allowlist" };
  }

  return { allowed: true };
}

// ============================================================================
// PATH VALIDATOR
// ============================================================================

function isPathAllowed(
  filePath: string,
  allowed?: string[],
  blocked?: string[]
): { allowed: boolean; reason?: string } {
  // Normalize path
  const normalized = filePath.replace(/\\/g, "/");

  // Blocked takes precedence
  if (blocked) {
    for (const pattern of blocked) {
      if (minimatch(normalized, pattern, { dot: true })) {
        return { allowed: false, reason: `Path blocked by pattern: ${pattern}` };
      }
    }
  }

  // If allowlist exists, path must match
  if (allowed && allowed.length > 0) {
    for (const pattern of allowed) {
      if (minimatch(normalized, pattern, { dot: true })) {
        return { allowed: true };
      }
    }
    return { allowed: false, reason: "Path not in allowlist" };
  }

  return { allowed: true };
}

// ============================================================================
// ACTION CONTEXT
// ============================================================================

export interface ActionContext {
  /** Name of the action/tool being invoked */
  action: string;
  /** Target domain (for network actions) */
  domain?: string;
  /** Target file path (for file actions) */
  path?: string;
  /** Payload size in bytes */
  payloadSize?: number;
  /** Raw arguments (for logging, will be hashed) */
  args?: unknown;
}

// ============================================================================
// CAPABILITY VALIDATOR CLASS
// ============================================================================

export class CapabilityValidator {
  private config: SmithConfig;
  private customValidators: Map<string, (ctx: ActionContext) => ValidationResult>;

  constructor(config: SmithConfig) {
    this.config = config;
    this.customValidators = new Map();
  }

  /**
   * Register a custom validator function for advanced constraints.
   */
  registerCustomValidator(
    name: string,
    validator: (ctx: ActionContext) => ValidationResult
  ): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Validate an action against capabilities.
   * Returns { allowed: true/false, reason, requiresConfirmation }
   */
  validate(ctx: ActionContext): ValidationResult {
    const { action, domain, path: filePath, payloadSize } = ctx;

    // 1. Check if capability exists
    const capability = this.config.capabilities[action];
    if (!capability) {
      return {
        allowed: false,
        reason: `Unknown capability: ${action}`,
        capability: action,
      };
    }

    // 2. Check if capability is enabled
    if (!capability.enabled) {
      return {
        allowed: false,
        reason: `Capability disabled: ${action}`,
        capability: action,
      };
    }

    const constraints = capability.constraints ?? {};

    // 3. Check global rate limit
    if (this.config.constraints?.maxRatePerMinute) {
      if (!checkRateLimit("__global__", this.config.constraints.maxRatePerMinute)) {
        return {
          allowed: false,
          reason: "Global rate limit exceeded",
          capability: action,
        };
      }
    }

    // 4. Check per-capability rate limit
    if (constraints.rateLimit) {
      if (!checkRateLimit(action, constraints.rateLimit)) {
        return {
          allowed: false,
          reason: `Rate limit exceeded for ${action}`,
          capability: action,
        };
      }
    }

    // 5. Check domain constraints (for network actions)
    if (domain) {
      // Merge global and capability-specific blocked domains
      const blockedDomains = [
        ...(this.config.constraints?.blockedDomains ?? []),
        ...(constraints.blockedDomains ?? []),
      ];
      const allowedDomains = constraints.allowedDomains ?? this.config.constraints?.allowedDomains;

      const domainCheck = isDomainAllowed(domain, allowedDomains, blockedDomains);
      if (!domainCheck.allowed) {
        return {
          allowed: false,
          reason: domainCheck.reason,
          capability: action,
        };
      }
    }

    // 6. Check path constraints (for file actions)
    if (filePath) {
      const pathCheck = isPathAllowed(
        filePath,
        constraints.allowedPaths,
        constraints.blockedPaths
      );
      if (!pathCheck.allowed) {
        return {
          allowed: false,
          reason: pathCheck.reason,
          capability: action,
        };
      }
    }

    // 7. Check payload size
    if (payloadSize !== undefined && constraints.maxPayloadSize !== undefined) {
      if (payloadSize > constraints.maxPayloadSize) {
        return {
          allowed: false,
          reason: `Payload too large: ${payloadSize} > ${constraints.maxPayloadSize}`,
          capability: action,
        };
      }
    }

    // 8. Run custom validator if defined
    if (constraints.customValidator) {
      const customFn = this.customValidators.get(constraints.customValidator);
      if (customFn) {
        const customResult = customFn(ctx);
        if (!customResult.allowed) {
          return customResult;
        }
      }
    }

    // 9. Check if confirmation is required
    const requiresConfirmation =
      constraints.requireConfirmation ||
      this.config.constraints?.alwaysRequireConfirmation?.includes(action);

    return {
      allowed: true,
      capability: action,
      constraints,
      requiresConfirmation,
    };
  }

  /**
   * Get capability definition for an action.
   */
  getCapability(action: string): CapabilityDef | undefined {
    return this.config.capabilities[action];
  }

  /**
   * List all enabled capabilities.
   */
  listEnabledCapabilities(): string[] {
    return Object.entries(this.config.capabilities)
      .filter(([, def]) => def.enabled)
      .map(([name]) => name);
  }

  /**
   * Dynamic capability scaling based on model strength.
   * Stronger models get more permissive constraints.
   * Weaker models get stricter constraints.
   */
  scaleForModel(modelStrength: "weak" | "medium" | "strong"): void {
    const multipliers = {
      weak: { rateLimit: 0.5, payloadSize: 0.5 },
      medium: { rateLimit: 1.0, payloadSize: 1.0 },
      strong: { rateLimit: 2.0, payloadSize: 2.0 },
    };

    const mult = multipliers[modelStrength];

    for (const [, capability] of Object.entries(this.config.capabilities)) {
      if (capability.constraints) {
        if (capability.constraints.rateLimit) {
          capability.constraints.rateLimit = Math.floor(
            capability.constraints.rateLimit * mult.rateLimit
          );
        }
        if (capability.constraints.maxPayloadSize) {
          capability.constraints.maxPayloadSize = Math.floor(
            capability.constraints.maxPayloadSize * mult.payloadSize
          );
        }
      }
    }
  }
}

// ============================================================================
// SELF-EVOLVING INTERFACE (Scaffold for v2.0)
// ============================================================================

export interface EvolvingConstraint {
  action: string;
  suggestedConstraint: Partial<CapabilityConstraints>;
  reason: string;
  confidence: number;
}

/**
 * Interface for self-evolving constraint generation.
 * Will be implemented with LLM in future version.
 */
export interface ConstraintEvolver {
  /**
   * Analyze logs and suggest new constraints.
   */
  analyzeAndSuggest(logs: unknown[]): Promise<EvolvingConstraint[]>;

  /**
   * Apply suggested constraints (with human approval).
   */
  applyConstraints(constraints: EvolvingConstraint[]): void;
}

/**
 * Stub implementation for self-evolving constraints.
 * To be replaced with LLM-based implementation.
 */
export class StubConstraintEvolver implements ConstraintEvolver {
  async analyzeAndSuggest(_logs: unknown[]): Promise<EvolvingConstraint[]> {
    // Stub: return empty suggestions
    // In v2.0, this will call a local LLM (e.g., Llama) to analyze patterns
    return [];
  }

  applyConstraints(_constraints: EvolvingConstraint[]): void {
    // Stub: no-op
    // In v2.0, this will update config and notify user
  }
}
