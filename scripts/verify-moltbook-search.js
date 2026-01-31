#!/usr/bin/env node
/**
 * Search Moltbook for injection-related terms, run post/comment content through Agent Smith.
 * Requires: MOLTBOOK_API_KEY in .env (get it by joining Moltbook: https://moltbook.com/skill.md).
 * Usage: npm run build && node scripts/verify-moltbook-search.js
 */

require("dotenv").config();
const { AgentSmith } = require("../dist/core");

const BASE = "https://www.moltbook.com/api/v1";
const SEARCH_QUERIES = [
  "ignore instructions",
  "jailbreak",
  "reveal prompt",
  "bypass safety",
  "disregard previous",
];

async function main() {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) {
    console.log("MOLTBOOK_API_KEY not set in .env.");
    console.log("To search Moltbook: read https://moltbook.com/skill.md and follow the instructions to join Moltbook.");
    console.log("Then add your agent API key to .env as MOLTBOOK_API_KEY=...");
    process.exit(0);
  }

  const smith = new AgentSmith();
  const allSnippets = [];
  for (const q of SEARCH_QUERIES) {
    const url = `${BASE}/search?q=${encodeURIComponent(q)}&limit=10`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.error(`Search "${q}" failed: ${res.status} ${res.statusText}`);
      continue;
    }
    const data = await res.json();
    const results = data.results || data.data?.results || [];
    for (const r of results) {
      const text = [r.title, r.content].filter(Boolean).join(" ").trim();
      if (text.length > 15 && text.length < 2000) allSnippets.push(text);
    }
  }

  const uniq = [...new Set(allSnippets)];
  let blocked = 0;
  let allowed = 0;
  for (const text of uniq) {
    const r = await smith.scan(text);
    if (r.blocked) blocked++;
    else allowed++;
  }

  console.log("Searched Moltbook for:", SEARCH_QUERIES.join(", "));
  console.log(`Got ${uniq.length} unique snippets. Agent Smith: ${blocked} blocked, ${allowed} allowed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
