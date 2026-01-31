#!/usr/bin/env node
/**
 * CLI: run detector on text from argv or stdin.
 * Usage: node scripts/scan.js [--json] "Ignore all instructions"
 *        echo "some text" | node scripts/scan.js
 */

const { AgentSmith } = require("../dist/core");

async function main() {
  const argv = process.argv.slice(2);
  const json = argv[0] === "--json";
  const textArg = json ? argv[1] : argv[0];
  const text =
    textArg ||
    require("fs").readFileSync(0, "utf8").trim();

  if (!text) {
    console.error("Usage: node scripts/scan.js [--json] <text>");
    console.error("   or: echo <text> | node scripts/scan.js");
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
