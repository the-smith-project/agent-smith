// v1 exports (pattern-based detector)
export { AgentSmith, type ScanResult, fingerprint } from "./detector";
export { AttackCache } from "./cache";
export { extractNgrams, matchRegex, REGEX_PATTERNS } from "./patterns";
export { hashForLog, redactPII } from "./privacy";
export { SENTINEL_MESSAGES, blockDangerousShell } from "./sentinel-policy";

// v2 exports (capability-based + vault)
export {
  AgentSmithV2,
  createSmith,
  type SmithV2Result,
} from "./smith-v2";
export {
  CapabilityValidator,
  type ActionContext,
  type EvolvingConstraint,
  type ConstraintEvolver,
  StubConstraintEvolver,
} from "./capability-validator";
export { SecretVault, httpExecutor } from "./vault";
export {
  VaultClient,
  describeAvailableSecrets,
  openaiExecutor,
  anthropicExecutor,
} from "./vault-client";
