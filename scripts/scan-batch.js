#!/usr/bin/env node
/**
 * Run Agent Smith on multiple lines (e.g. Moltbook post/comment snippets).
 * Usage: cat snippets.txt | node scripts/scan-batch.js
 *        node scripts/scan-batch.js path/to/file.txt
 * Output: one line per input: "BLOCKED	reason	<first 50 chars...>" or "ALLOWED	<first 50 chars...>"
 */

const fs = require("fs");
const { AgentSmith } = require("../dist/core");

async function main() {
  const lines =
    process.argv[2] !== undefined
      ? fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/)
      : fs.readFileSync(0, "utf8").split(/\r?\n/);

  const smith = new AgentSmith();
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const r = await smith.scan(t);
    const preview = t.slice(0, 50) + (t.length > 50 ? "…" : "");
    if (r.blocked) {
      console.log(`BLOCKED\t${r.reason || "?"}\t${preview}`);
    } else {
      console.log(`ALLOWED\t${preview}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
