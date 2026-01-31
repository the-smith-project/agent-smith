/**
 * Types for Agent Smith pattern-based detector.
 * Aligned with src/attacks/patterns.json and taxonomy.
 */

export interface ScanResult {
  blocked: boolean;
  category?: string;
  reason?: string;
  confidence: number;
  latency: number;
}

export type Severity = "critical" | "high" | "medium" | "low";
export type FalsePositiveRisk = "low" | "medium" | "high";

export interface AttackPattern {
  signatures: string[];
  ngrams: string[][];
  regex: string[];
  severity: Severity;
  false_positive_rate: FalsePositiveRisk;
}

export interface PatternDatabase {
  version?: string;
  last_updated?: string;
  categories: Record<string, AttackPattern>;
}
