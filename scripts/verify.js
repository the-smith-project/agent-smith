#!/usr/bin/env node
/**
 * Full verify: build, then Claude (if key set), then Moltbook fetch + Agent Smith.
 * Usage: npm run verify
 */

const { execSync } = require("child_process");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function run(name, cmd) {
  console.log("\n---", name, "---");
  try {
    execSync(cmd, { stdio: "inherit", cwd: path.join(__dirname, "..") });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

async function main() {
  run("Build", "npm run build");
  if (process.env.ANTHROPIC_API_KEY) {
    run("Claude API", "node scripts/verify-claude.js");
  } else {
    console.log("\n--- Claude API (skipped: no ANTHROPIC_API_KEY in .env) ---");
  }
  run("Moltbook + Agent Smith", "node scripts/verify-moltbook.js");
  if (process.env.MOLTBOOK_API_KEY) {
    run("Moltbook search + Agent Smith", "node scripts/verify-moltbook-search.js");
  } else {
    console.log("\n--- Moltbook search (skipped: no MOLTBOOK_API_KEY) ---");
    console.log("To search Moltbook for injection-like posts: read https://moltbook.com/skill.md, join, add MOLTBOOK_API_KEY to .env");
  }
  console.log("\nVerify OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
