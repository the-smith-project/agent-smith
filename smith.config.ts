/**
 * Agent Smith v2 Configuration Schema
 * 
 * Capability-based security + secret isolation.
 * Makes prompt injection *irrelevant* by limiting what actions can do,
 * not by detecting attacks.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SmithConfig {
  version: "2.0";

  /** Pre-filter: pattern-based detection (existing detector as Layer 1) */
  preFilter?: PreFilterConfig;

  /** Capability definitions: what each tool/action is allowed to do */
  capabilities: Record<string, CapabilityDef>;

  /** Vault: secret isolation so LLM never sees raw credentials */
  vault?: VaultConfig;

  /** Global constraints across all actions */
  constraints?: GlobalConstraints;

  /** Logging and telemetry */
  logging?: LoggingConfig;
}

export interface PreFilterConfig {
  enabled: boolean;
  /** Block on pattern match, or just warn and continue */
  mode: "block" | "warn";
  /** Use the pattern-based detector (src/detector.ts) */
  usePatternDetector: boolean;
}

export interface CapabilityDef {
  enabled: boolean;
  description?: string;
  /** Per-capability constraints */
  constraints?: CapabilityConstraints;
}

export interface CapabilityConstraints {
  /** Allowed domains for network requests (glob patterns) */
  allowedDomains?: string[];
  /** Blocked domains (takes precedence over allowed) */
  blockedDomains?: string[];
  /** Allowed file paths (glob patterns) */
  allowedPaths?: string[];
  /** Blocked file paths */
  blockedPaths?: string[];
  /** Max payload size in bytes */
  maxPayloadSize?: number;
  /** Rate limit: max calls per minute */
  rateLimit?: number;
  /** Require user confirmation before execution */
  requireConfirmation?: boolean;
  /** Custom validator function name (for advanced use) */
  customValidator?: string;
}

export interface VaultConfig {
  enabled: boolean;
  /** Secret definitions: name → how to retrieve */
  secrets: Record<string, SecretDef>;
  /** Token TTL in seconds (for signed request tokens) */
  tokenTTL?: number;
  /** Isolation mode: in-process or separate-process */
  isolationMode?: "in-process" | "separate-process";
}

export interface SecretDef {
  /** Source type: env var, OAuth, or external vault */
  source: "env" | "oauth" | "external";
  /** For env source: name of environment variable */
  envVar?: string;
  /** For oauth source: OAuth config (future) */
  oauthConfig?: OAuthConfig;
  /** For external source: vault path (future) */
  externalPath?: string;
  /** Description for documentation */
  description?: string;
}

export interface OAuthConfig {
  provider: "github" | "google" | "azure" | "custom";
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  scopes: string[];
  tokenUrl?: string; // for custom provider
}

export interface GlobalConstraints {
  /** Max requests per minute across all capabilities */
  maxRatePerMinute?: number;
  /** Actions that always require user confirmation */
  alwaysRequireConfirmation?: string[];
  /** Global blocked domains */
  blockedDomains?: string[];
  /** Global allowed domains (if set, only these are allowed) */
  allowedDomains?: string[];
  /** Max concurrent requests */
  maxConcurrent?: number;
}

export interface LoggingConfig {
  /** Log level */
  level: "debug" | "info" | "warn" | "error";
  /** Hash PII before logging (privacy) */
  hashPII: boolean;
  /** Log blocked requests */
  logBlocked: boolean;
  /** Log allowed requests */
  logAllowed: boolean;
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  capability?: string;
  constraints?: CapabilityConstraints;
  requiresConfirmation?: boolean;
}

export interface VaultRequestResult {
  success: boolean;
  /** The actual value (if success) - NEVER log this */
  value?: string;
  error?: string;
  /** Token for signed requests (if using token-based auth) */
  token?: string;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const DEFAULT_CONFIG: SmithConfig = {
  version: "2.0",

  preFilter: {
    enabled: true,
    mode: "block",
    usePatternDetector: true,
  },

  capabilities: {
    // Network capabilities
    web_fetch: {
      enabled: true,
      description: "Fetch web content",
      constraints: {
        blockedDomains: ["*.internal", "localhost", "127.0.0.1", "*.local"],
        maxPayloadSize: 10 * 1024 * 1024, // 10MB
        rateLimit: 60,
      },
    },
    web_search: {
      enabled: true,
      description: "Search the web",
      constraints: {
        rateLimit: 30,
      },
    },

    // File capabilities
    file_read: {
      enabled: true,
      description: "Read files",
      constraints: {
        blockedPaths: ["**/.env", "**/.env.*", "**/secrets/**", "**/*.pem", "**/*.key"],
        maxPayloadSize: 50 * 1024 * 1024, // 50MB
      },
    },
    file_write: {
      enabled: true,
      description: "Write files",
      constraints: {
        blockedPaths: ["**/.env", "**/.env.*", "**/secrets/**", "**/*.pem", "**/*.key", "**/node_modules/**"],
        requireConfirmation: false,
      },
    },

    // Shell capabilities
    shell_exec: {
      enabled: true,
      description: "Execute shell commands",
      constraints: {
        requireConfirmation: false,
        rateLimit: 120,
      },
    },

    // API capabilities (require vault for secrets)
    api_call: {
      enabled: true,
      description: "Make API calls (secrets via vault)",
      constraints: {
        rateLimit: 60,
      },
    },
  },

  vault: {
    enabled: true,
    secrets: {
      OPENAI_API_KEY: {
        source: "env",
        envVar: "OPENAI_API_KEY",
        description: "OpenAI API key",
      },
      ANTHROPIC_API_KEY: {
        source: "env",
        envVar: "ANTHROPIC_API_KEY",
        description: "Anthropic API key",
      },
      GITHUB_TOKEN: {
        source: "env",
        envVar: "GITHUB_TOKEN",
        description: "GitHub personal access token",
      },
    },
    tokenTTL: 300, // 5 minutes
    isolationMode: "in-process",
  },

  constraints: {
    maxRatePerMinute: 300,
    maxConcurrent: 10,
    blockedDomains: ["*.onion", "*.i2p"],
  },

  logging: {
    level: "info",
    hashPII: true,
    logBlocked: true,
    logAllowed: false,
  },
};

// ============================================================================
// CONFIG LOADER
// ============================================================================

import * as fs from "fs";
import * as path from "path";

const CONFIG_FILENAMES = ["smith.config.json", "smith.config.yaml", "smith.config.yml"];

export function loadConfig(configPath?: string): SmithConfig {
  // If explicit path provided, load from there
  if (configPath) {
    return loadConfigFromFile(configPath);
  }

  // Try to find config file in cwd
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.join(process.cwd(), filename);
    if (fs.existsSync(fullPath)) {
      return loadConfigFromFile(fullPath);
    }
  }

  // Return default config
  return DEFAULT_CONFIG;
}

function loadConfigFromFile(filePath: string): SmithConfig {
  const content = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();

  let parsed: unknown;
  if (ext === ".json") {
    parsed = JSON.parse(content);
  } else if (ext === ".yaml" || ext === ".yml") {
    // Lazy load yaml parser
    try {
      const yaml = require("js-yaml");
      parsed = yaml.load(content);
    } catch {
      throw new Error("js-yaml not installed. Run: npm install js-yaml");
    }
  } else {
    throw new Error(`Unsupported config file format: ${ext}`);
  }

  // Merge with defaults
  return mergeConfig(DEFAULT_CONFIG, parsed as Partial<SmithConfig>);
}

function mergeConfig(defaults: SmithConfig, overrides: Partial<SmithConfig>): SmithConfig {
  return {
    ...defaults,
    ...overrides,
    preFilter: { ...defaults.preFilter, ...overrides.preFilter } as PreFilterConfig,
    capabilities: { ...defaults.capabilities, ...overrides.capabilities },
    vault: overrides.vault ? { ...defaults.vault, ...overrides.vault } as VaultConfig : defaults.vault,
    constraints: { ...defaults.constraints, ...overrides.constraints },
    logging: { ...defaults.logging, ...overrides.logging } as LoggingConfig,
  };
}
