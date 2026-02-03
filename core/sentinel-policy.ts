/**
 * Sentinel policy (shell safety)
 *
 * Purpose:
 * Block high-risk shell commands and obvious credential exfiltration.
 *
 * Rationale:
 * Uncensored/local models are vulnerable to prompt injection. We enforce
 * hard allow/deny rules here rather than trusting model intent.
 *
 * Default blocks:
 * - Destructive ops: rm -rf, mkfs, dd, shutdown/reboot, kill -9, chmod 777
 * - Credential reads: ~/.ssh, ~/.aws, .env files, key files, tokens
 * - Priv-escalation: sudo, su
 * - Process control: pkill, killall, launchctl, systemctl
 *
 * UX:
 * Return a short, plain block message and suggest a safe alternative.
 */

import type { ValidationResult } from "../smith.config";
import type { ActionContext } from "./capability-validator";

export const SENTINEL_MESSAGES = {
  genericBlocked:
    "This action is blocked by Sentinel policy. Provide a safer alternative or a specific allowed path/domain.",
  shellBlocked:
    "I can't run that command because it's high-risk. Tell me the safe outcome you want and I'll suggest a safer command.",
  fileReadBlocked:
    "That path isn't allowed. Please provide an approved path.",
  fileWriteBlocked:
    "Writing there isn't allowed. Please provide an approved path.",
  domainBlocked:
    "That domain isn't allowed. Please confirm an approved domain.",
  confirmRequired:
    "This action is high-risk. Please confirm explicitly to proceed.",
};

const DANGEROUS_SHELL_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\brm\s+-r\s+\/\b/i,
  /\bmkfs\b/i,
  /\bdd\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bkill\s+-9\b/i,
  /\bchmod\s+777\b/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\blaunchctl\b/i,
  /\bsystemctl\b/i,
];

const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /(^|\\s)~\\/?\\.ssh\\b/i,
  /(^|\\s)~\\/?\\.aws\\b/i,
  /\\.env(\\.|\\s|$)/i,
  /\\.(pem|key)\\b/i,
  /id_rsa\\b/i,
  /known_hosts\\b/i,
  /api[_-]?key\\b/i,
  /token\\b/i,
];

function extractCommand(args: unknown): string {
  if (typeof args === "string") return args;
  if (Array.isArray(args)) return args.join(" ");
  if (args && typeof args === "object") {
    const obj = args as Record<string, unknown>;
    const direct = obj.command ?? obj.cmd;
    if (typeof direct === "string") return direct;
    const argv = obj.argv ?? obj.args;
    if (Array.isArray(argv)) return argv.filter((x) => typeof x === "string").join(" ");
  }
  return "";
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

export function blockDangerousShell(ctx: ActionContext): ValidationResult {
  if (ctx.action !== "shell_exec") return { allowed: true, capability: ctx.action };

  const command = extractCommand(ctx.args);
  if (!command) return { allowed: true, capability: ctx.action };

  if (matchesAny(command, DANGEROUS_SHELL_PATTERNS)) {
    return { allowed: false, reason: SENTINEL_MESSAGES.shellBlocked, capability: ctx.action };
  }

  if (matchesAny(command, SENSITIVE_PATH_PATTERNS)) {
    return { allowed: false, reason: SENTINEL_MESSAGES.shellBlocked, capability: ctx.action };
  }

  return { allowed: true, capability: ctx.action };
}
