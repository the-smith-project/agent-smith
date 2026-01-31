#!/usr/bin/env node
/**
 * Load .env and call Claude once to verify ANTHROPIC_API_KEY works.
 * Usage: node scripts/verify-claude.js
 */

require("dotenv").config();

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("Missing ANTHROPIC_API_KEY in .env");
    process.exit(1);
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: key });

  const message = await client.messages.create({
    max_tokens: 64,
    model: "claude-haiku-4-5-20251001",
    messages: [{ role: "user", content: "Reply with exactly: OK" }],
  });

  const text = message.content?.[0]?.text?.trim() || "";
  if (text === "OK") {
    console.log("Claude API key works.");
    process.exit(0);
  } else {
    console.log("Unexpected reply:", text);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Claude API error:", err.message);
  process.exit(1);
});
