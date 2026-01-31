/**
 * Privacy: hash inputs before logging. Never log raw PII or user content.
 */

import { fingerprint } from "./cache";

export async function hashForLog(input: string): Promise<string> {
  return fingerprint(input);
}

export function redactPII(text: string): string {
  // Placeholder: strip obvious tokens. Expand in v1.0.
  return text.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, "[REDACTED]");
}
