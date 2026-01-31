# Attack pattern data sources

All sources cited; raw data in `raw/`, processed patterns (Step 3+) in `src/attacks/patterns.json` (derived from raw sources + `core/patterns.ts`).

| File | Source | License | Notes |
|------|--------|---------|--------|
| raw/hackaprompt.json | [HackAPrompt](https://huggingface.co/datasets/hackaprompt/hackaprompt-dataset) | MIT | Gated; use HF_TOKEN + `node scripts/data/fetch-hackaprompt.js` to fetch |
| raw/arxiv_attacks.json | [arXiv:2310.12815](https://arxiv.org/abs/2310.12815) (Open-Prompt-Injection) | Open access | Paper + repo; attack strings in PDF/repo |
| raw/github_attacks.json | [awesome-llm-security](https://github.com/corca-ai/awesome-llm-security) | CC0 / curated | Papers, tools, articles; patterns_mentioned extracted |
| raw/lakera_attacks.json | [Lakera blog](https://www.lakera.ai/blog), [Gandalf](https://gandalf.lakera.ai/) | Public | Descriptions + Gandalf/PINT; no raw strings scraped |

Last updated: 2026-01-31.
