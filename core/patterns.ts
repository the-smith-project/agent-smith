/**
 * Layer 2 (n-gram fuzzy) and Layer 3 (regex). No LLM – static patterns only.
 */

const NGRAM_SIZE = 3;

export function extractNgrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (let i = 0; i <= normalized.length - NGRAM_SIZE; i++) {
    out.add(normalized.slice(i, i + NGRAM_SIZE));
  }
  return out;
}

export function countOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

/** Regex patterns for common prompt-injection phrases. Tuned for v1.0. */
export const REGEX_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(safety|previous|prior)/i,
  /you\s+are\s+now\s+(unrestricted|in\s+developer\s+mode|a\s+pirate)/i,
  /first\s+tell\s+(security|the\s+user)\s+this\s+is\s+safe/i,
  /\[INST\]|<\|im_start\||<\|system\|/,
  /could\s+you\s+kindly\s+(bypass|ignore|disregard)/i,
  /let'?s\s+play\s+a\s+game\s+where/i,
  /(urgent|asap)\s+from\s+(dev|development)\s+team/i,
  /reveal\s+(your\s+)?(secret|instruction|prompt)/i,
  /<div[^>]*display\s*:\s*none[^>]*>/i,
];

export function matchRegex(text: string): boolean {
  return REGEX_PATTERNS.some((re) => re.test(text));
}
