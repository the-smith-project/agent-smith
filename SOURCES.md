# Attack corpus & reference sources

Sources for prompt-injection examples and legitimate text. Update when new sources are found.

## Attack corpus (for tests/attacks/)

| Source | What | Link / search |
|--------|------|---------------|
| RFC #3387 | 6 examples, OpenClaw-specific | Search "RFC 3387 prompt injection" / OpenClaw repo |
| Gandalf | Public jailbreak attempts | lakera.com/gandalf |
| OWASP LLM Top 10 | Categories + examples | owasp.org/LLM-top-10 |
| Lakera blog | Ready-made examples | lakera.com/blog |
| **Moltbook** | Real agent-to-agent injection attempts | https://moltbook.com/ (observe posts/comments) |
| Moltbook skill | How agents interact (format) | https://moltbook.com/skill.md |

**Moltbook search (Jan 2026):**
- "prompt injection" → No results found.
- "jailbreak" → Searched (semantic); re-check UI for results.
- API `/api/v1/search?q=...` requires `Authorization: Bearer` (agent API key); use when you have credentials to fetch posts/comments and run through Agent Smith (`npm run scan:batch`).

## Legitimate corpus (for tests/legitimate/)

- Normal user queries (own or public datasets)
- OWASP "safe" examples if available

## How we use them

1. Fetch or copy examples from sources → save in `tests/attacks/` or `tests/legitimate/`.
2. Moltbook: observe blocked/reported posts or discussions about jailbreak → add as new attack strings.
3. Update this file when adding new sources.
