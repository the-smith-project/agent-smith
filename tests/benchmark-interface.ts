/**
 * Generic Benchmark Interface
 * 
 * Not locked to any specific tool (Garak, PromptInject, etc.).
 * Allows testing Agent Smith against any injection dataset.
 */

import { AgentSmithV2, createSmith } from "../core/smith-v2";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// BENCHMARK TYPES
// ============================================================================

export interface BenchmarkCase {
  /** Unique identifier */
  id: string;
  /** The input to test */
  input: string;
  /** Is this expected to be an attack? */
  isAttack: boolean;
  /** Category of attack (if attack) */
  category?: string;
  /** Source dataset */
  source?: string;
}

export interface BenchmarkResult {
  case: BenchmarkCase;
  /** Did Smith correctly identify it? */
  correct: boolean;
  /** Smith's decision */
  blocked: boolean;
  /** Detailed result */
  reason?: string;
  /** Time taken */
  latencyMs: number;
}

export interface BenchmarkSummary {
  totalCases: number;
  correctDetections: number;
  falsePositives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
}

// ============================================================================
// BENCHMARK RUNNER
// ============================================================================

export class BenchmarkRunner {
  private smith: AgentSmithV2;

  constructor(smith?: AgentSmithV2) {
    this.smith = smith ?? createSmith();
  }

  /**
   * Run benchmark on a single case.
   */
  runCase(benchCase: BenchmarkCase): BenchmarkResult {
    const start = performance.now();
    const result = this.smith.scanMessage(benchCase.input);
    const latency = performance.now() - start;

    // Correct if: attack blocked, or benign allowed
    const correct =
      (benchCase.isAttack && !result.allowed) ||
      (!benchCase.isAttack && result.allowed);

    return {
      case: benchCase,
      correct,
      blocked: !result.allowed,
      reason: result.reason,
      latencyMs: latency,
    };
  }

  /**
   * Run benchmark on multiple cases.
   */
  runBatch(cases: BenchmarkCase[]): BenchmarkResult[] {
    return cases.map((c) => this.runCase(c));
  }

  /**
   * Calculate summary statistics.
   */
  summarize(results: BenchmarkResult[]): BenchmarkSummary {
    const total = results.length;
    const correct = results.filter((r) => r.correct).length;

    // True/False Positives/Negatives
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const r of results) {
      if (r.case.isAttack && r.blocked) tp++;
      else if (!r.case.isAttack && r.blocked) fp++;
      else if (!r.case.isAttack && !r.blocked) tn++;
      else if (r.case.isAttack && !r.blocked) fn++;
    }

    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = 2 * (precision * recall) / (precision + recall) || 0;

    // Latency stats
    const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / total;
    const p99Index = Math.floor(total * 0.99);
    const p99Latency = latencies[p99Index] ?? latencies[latencies.length - 1];

    return {
      totalCases: total,
      correctDetections: correct,
      falsePositives: fp,
      falseNegatives: fn,
      accuracy: correct / total,
      precision,
      recall,
      f1Score: f1,
      avgLatencyMs: avgLatency,
      p99LatencyMs: p99Latency,
    };
  }
}

// ============================================================================
// DATASET LOADERS
// ============================================================================

/**
 * Load benchmark cases from a JSON file.
 * Expected format: { cases: BenchmarkCase[] }
 */
export function loadFromJSON(filePath: string): BenchmarkCase[] {
  const content = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(content);
  return data.cases ?? data;
}

/**
 * Load benchmark cases from directory of .txt files.
 * Files starting with "attack" are attacks, others are benign.
 */
export function loadFromDirectory(
  dirPath: string,
  attackPrefix = "attack",
  benignPrefix = "benign"
): BenchmarkCase[] {
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".txt"));
  return files.map((f) => {
    const content = fs.readFileSync(path.join(dirPath, f), "utf8").trim();
    const isAttack = f.toLowerCase().startsWith(attackPrefix);
    const isBenign = f.toLowerCase().startsWith(benignPrefix);
    return {
      id: f,
      input: content,
      isAttack: isAttack || (!isBenign && !f.includes("legit") && !f.includes("benign")),
      source: dirPath,
    };
  });
}

/**
 * Load our existing test corpus.
 */
export function loadTestCorpus(): BenchmarkCase[] {
  const attacksDir = path.join(__dirname, "attacks");
  const legitimateDir = path.join(__dirname, "legitimate");

  const attacks: BenchmarkCase[] = fs
    .readdirSync(attacksDir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => ({
      id: `attack-${f}`,
      input: fs.readFileSync(path.join(attacksDir, f), "utf8").trim(),
      isAttack: true,
      source: "test-corpus",
    }));

  const benign: BenchmarkCase[] = fs
    .readdirSync(legitimateDir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => ({
      id: `benign-${f}`,
      input: fs.readFileSync(path.join(legitimateDir, f), "utf8").trim(),
      isAttack: false,
      source: "test-corpus",
    }));

  return [...attacks, ...benign];
}

// ============================================================================
// BENCHMARK TEST
// ============================================================================

describe("Benchmark Interface", () => {
  let runner: BenchmarkRunner;

  beforeAll(() => {
    runner = new BenchmarkRunner();
  });

  it("runs against test corpus", () => {
    const cases = loadTestCorpus();
    const results = runner.runBatch(cases);
    const summary = runner.summarize(results);

    console.log("\n=== BENCHMARK SUMMARY ===");
    console.log(`Total cases: ${summary.totalCases}`);
    console.log(`Accuracy: ${(summary.accuracy * 100).toFixed(1)}%`);
    console.log(`Precision: ${(summary.precision * 100).toFixed(1)}%`);
    console.log(`Recall: ${(summary.recall * 100).toFixed(1)}%`);
    console.log(`F1 Score: ${(summary.f1Score * 100).toFixed(1)}%`);
    console.log(`False Positives: ${summary.falsePositives}`);
    console.log(`False Negatives: ${summary.falseNegatives}`);
    console.log(`Avg Latency: ${summary.avgLatencyMs.toFixed(2)}ms`);
    console.log(`P99 Latency: ${summary.p99LatencyMs.toFixed(2)}ms`);
    console.log("=========================\n");

    // Assertions
    expect(summary.accuracy).toBeGreaterThan(0.9); // >90% accuracy
    expect(summary.falsePositives).toBeLessThan(cases.length * 0.05); // <5% FP
    expect(summary.p99LatencyMs).toBeLessThan(100); // <100ms P99
  });

  it("handles empty dataset gracefully", () => {
    const results = runner.runBatch([]);
    const summary = runner.summarize(results);
    expect(summary.totalCases).toBe(0);
  });
});
