/**
 * Exact-match cache using xxHash. Layer 1: known-attack fingerprints.
 * No PII stored – only hashes.
 */

type Hasher = { h32ToString(input: string): string };

let hasher: Hasher | null = null;

async function getHasher(): Promise<Hasher> {
  if (hasher) return hasher;
  const xxhash = (await import("xxhash-wasm")).default;
  hasher = (await xxhash()) as Hasher;
  return hasher;
}

export async function fingerprint(input: string): Promise<string> {
  const h = await getHasher();
  return h.h32ToString(input);
}

export class AttackCache {
  private hashes = new Set<string>();

  async add(input: string): Promise<void> {
    this.hashes.add(await fingerprint(input));
  }

  async has(input: string): Promise<boolean> {
    return this.hashes.has(await fingerprint(input));
  }

  load(hashes: string[]): void {
    hashes.forEach((h) => this.hashes.add(h));
  }
}
