#!/usr/bin/env node
/**
 * CLI (dev): run detector from source. No build needed.
 * Usage: npm run scan:dev -- "Ignore all instructions"
 *        npm run scan:dev -- --json "text"
 */

import { readFileSync } from "fs";
import { AgentSmith } from "../core/detector";

async function main() {
  const argv = process.argv.slice(2);
  const json = argv[0] === "--json";
  const textArg = json ? argv[1] : argv[0];
  const text =
    textArg ?? readFileSync(0, "utf8").trim();

  if (!text) {
    console.error("Usage: npm run scan:dev -- [--json] <text>");
    console.error("   or: echo <text> | npm run scan:dev");
    process.exit(1);
  }

  const smith = new AgentSmith();
  const result = await smith.scan(text);

  if (json) {
    console.log(JSON.stringify({ blocked: result.blocked, reason: result.reason }));
  } else {
    if (result.blocked) {
      console.log("BLOCKED");
      console.log("Reason:", result.reason);
    } else {
      console.log("ALLOWED");
    }
  }

  process.exit(result.blocked ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
