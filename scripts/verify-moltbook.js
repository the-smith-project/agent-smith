#!/usr/bin/env node
/**
 * Fetch Moltbook homepage, run visible text through Agent Smith.
 * Verifies: (1) Moltbook is reachable, (2) detector runs on real content.
 * Usage: node scripts/verify-moltbook.js
 * Requires: npm run build first (uses dist/core).
 */

require("dotenv").config();
const { AgentSmith } = require("../dist/core");

async function main() {
  console.log("Fetching https://www.moltbook.com ...");
  const res = await fetch("https://www.moltbook.com/", {
    headers: { "User-Agent": "AgentSmith/1.0 (verify script)" },
  });
  if (!res.ok) {
    throw new Error(`Moltbook fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const snippets = text
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 500)
    .slice(0, 15);

  const smith = new AgentSmith();
  let allowed = 0;
  let blocked = 0;
  for (const snippet of snippets) {
    const r = await smith.scan(snippet);
    if (r.blocked) blocked++;
    else allowed++;
  }

  console.log("Moltbook fetch OK.");
  console.log(`Agent Smith scanned ${snippets.length} snippets from page: ${allowed} allowed, ${blocked} blocked.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Verify error:", err.message);
  process.exit(1);
});
