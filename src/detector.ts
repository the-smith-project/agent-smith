/**
 * Agent Smith detector — 4-layer scanning using patterns.json.
 * Privacy-first: hash inputs before caching, never log raw text.
 * No LLM at runtime. Graceful degradation: scan never throws.
 */

import * as fs from "fs";
import * as path from "path";
import type { PatternDatabase, ScanResult } from "./types";

const PATTERNS_PATH = path.join(process.cwd(), "src", "attacks", "patterns.json");
const CACHE_MAX_SIZE = 10000;
const NGRAM_MATCH_THRESHOLD = 0.8;
const MIN_CONFIDENCE_SIGNATURE = 0.9;
const MIN_CONFIDENCE_NGRAM = 0.7;
const MIN_CONFIDENCE_REGEX = 0.7;

/** Sync hash for in-memory result cache (not crypto, speed + privacy). */
function quickHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function loadPatterns(): PatternDatabase["categories"] {
  try {
    const raw = fs.readFileSync(PATTERNS_PATH, "utf8");
    const data = JSON.parse(raw) as PatternDatabase;
    return data.categories ?? {};
  } catch {
    return {};
  }
}

export class AgentSmithDetector {
  private patterns: PatternDatabase["categories"];
  private cache = new Map<string, ScanResult>();

  constructor() {
    this.patterns = loadPatterns();
  }

  /** Layer 1: exact result cache (hash only, no raw text). */
  private checkCache(input: string): ScanResult | null {
    const hash = quickHash(input);
    return this.cache.get(hash) ?? null;
  }

  private addToCache(input: string, result: ScanResult): void {
    const hash = quickHash(input);
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(hash, result);
  }

  /** Layer 2: signature matching (exact substring). */
  private scanSignatures(input: string): ScanResult | null {
    const normalized = input.toLowerCase();
    for (const [category, data] of Object.entries(this.patterns)) {
      for (const signature of data.signatures ?? []) {
        if (normalized.includes(signature.toLowerCase())) {
          return {
            blocked: true,
            category,
            reason: `signature_match: ${signature}`,
            confidence: 0.95,
            latency: 0,
          };
        }
      }
    }
    return null;
  }

  /** Layer 3: n-gram sliding window (word-level, 80% match). */
  private scanNgrams(input: string): ScanResult | null {
    const words = input.toLowerCase().replace(/\s+/g, " ").trim().split(/\s+/);
    for (const [category, data] of Object.entries(this.patterns)) {
      const ngrams = data.ngrams ?? [];
      for (const ngram of ngrams) {
        if (ngram.length === 0 || words.length < ngram.length) continue;
        for (let i = 0; i <= words.length - ngram.length; i++) {
          const window = words.slice(i, i + ngram.length);
          let matches = 0;
          for (let j = 0; j < ngram.length; j++) {
            if (window[j] === ngram[j]) matches++;
          }
          const similarity = matches / ngram.length;
          if (similarity >= NGRAM_MATCH_THRESHOLD) {
            return {
              blocked: true,
              category,
              reason: `ngram_match: ${ngram.join(" ")} (${similarity.toFixed(2)})`,
              confidence: 0.85 * similarity,
              latency: 0,
            };
          }
        }
      }
    }
    return null;
  }

  /** Layer 4: regex patterns (invalid regex skipped, no throw). */
  private scanRegex(input: string): ScanResult | null {
    for (const [category, data] of Object.entries(this.patterns)) {
      for (const pattern of data.regex ?? []) {
        try {
          const regex = new RegExp(pattern, "i");
          if (regex.test(input)) {
            return {
              blocked: true,
              category,
              reason: `regex_match: ${pattern}`,
              confidence: 0.75,
              latency: 0,
            };
          }
        } catch {
          // Invalid regex — skip, never throw
        }
      }
    }
    return null;
  }

  /**
   * Run 4-layer scan. Never throws; returns blocked: false on any error.
   * Performance budget: &lt;100ms per scan (P99).
   */
  scan(input: string): ScanResult {
    const startTime = performance.now();
    try {
      const trimmed = (input ?? "").trim();
      if (!trimmed.length) {
        return { blocked: false, confidence: 1, latency: performance.now() - startTime };
      }

      // Layer 1: cache
      const cached = this.checkCache(trimmed);
      if (cached) {
        return { ...cached, latency: performance.now() - startTime };
      }

      // Layer 2: signatures
      const sig = this.scanSignatures(trimmed);
      if (sig && sig.confidence >= MIN_CONFIDENCE_SIGNATURE) {
        sig.latency = performance.now() - startTime;
        this.addToCache(trimmed, sig);
        return sig;
      }

      // Layer 3: n-grams
      const ngram = this.scanNgrams(trimmed);
      if (ngram && ngram.confidence >= MIN_CONFIDENCE_NGRAM) {
        ngram.latency = performance.now() - startTime;
        this.addToCache(trimmed, ngram);
        return ngram;
      }

      // Layer 4: regex
      const regex = this.scanRegex(trimmed);
      if (regex && regex.confidence >= MIN_CONFIDENCE_REGEX) {
        regex.latency = performance.now() - startTime;
        this.addToCache(trimmed, regex);
        return regex;
      }

      const latency = performance.now() - startTime;
      return { blocked: false, confidence: 1, latency };
    } catch {
      return {
        blocked: false,
        confidence: 0,
        latency: performance.now() - startTime,
      };
    }
  }
}
