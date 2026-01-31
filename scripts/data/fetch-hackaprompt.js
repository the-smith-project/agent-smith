#!/usr/bin/env node
/**
 * Fetch HackAPrompt dataset from Hugging Face (gated; requires HF_TOKEN).
 * Saves up to 1000 successful jailbreaks to data/raw/hackaprompt.json.
 * Usage: HF_TOKEN=your_token node scripts/data/fetch-hackaprompt.js
 */

const fs = require("fs");
const path = require("path");

const HF_TOKEN = process.env.HF_TOKEN;
const OUT_PATH = path.join(__dirname, "../../data/raw/hackaprompt.json");
const MAX_ROWS = 1000;
const ROWS_PER_PAGE = 100;

async function main() {
  if (!HF_TOKEN) {
    console.log("HF_TOKEN not set. Dataset is gated; add token to .env or env.");
    console.log("See data/raw/hackaprompt.json for source URL and instructions.");
    process.exit(0);
  }

  const allRows = [];
  let offset = 0;
  while (allRows.length < MAX_ROWS) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=hackaprompt/hackaprompt-dataset&config=default&split=train&offset=${offset}&length=${ROWS_PER_PAGE}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${HF_TOKEN}` },
    });
    if (!res.ok) {
      console.error("Fetch failed:", res.status, await res.text());
      break;
    }
    const data = await res.json();
    const rows = data.rows || [];
    if (rows.length === 0) break;
    for (const r of rows) {
      const row = r.row || r;
      if (row.correct === true && row.user_input) {
        allRows.push({
          user_input: row.user_input,
          level: row.level,
          model: row.model,
          dataset: row.dataset,
        });
        if (allRows.length >= MAX_ROWS) break;
      }
    }
    offset += rows.length;
    console.log(`Fetched ${offset} rows, ${allRows.length} successful jailbreaks so far.`);
    if (rows.length < ROWS_PER_PAGE) break;
  }

  const out = {
    source: "https://huggingface.co/datasets/hackaprompt/hackaprompt-dataset",
    citation: "Schulhoff et al., HackAPrompt (EMNLP 2023), https://arxiv.org/abs/2311.16119",
    license: "MIT",
    last_updated: new Date().toISOString().slice(0, 10),
    status: "fetched",
    rows: allRows,
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`Saved ${allRows.length} rows to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
