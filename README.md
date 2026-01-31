# Agent Smith

Open-source runtime prompt-injection defense for [OpenClaw](https://openclaw.ai).

- **Multi-layer detection:** exact cache (xxHash) → n-gram fuzzy → regex
- **No LLM at runtime** – static patterns only; &lt;100ms
- **Privacy-first** – hash inputs, no PII in logs

## Quick start

```bash
npm install
npm test
```

**Before push:** `npm run check` (runs tests + build)

## API keys (for tests / future use)

Put keys in **`.env`** (never committed; see `.gitignore`). Copy from `.env.example`:

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

Use `ANTHROPIC_API_KEY` in code via `process.env.ANTHROPIC_API_KEY`. The detector itself does not call Claude; use this when you add tests or scripts that call Claude (e.g. OpenClaw, future LLM code-gen).

**Verify (Claude + Moltbook):** `npm run verify` — builds, then verifies Claude API (if key in `.env`), then fetches Moltbook and runs page snippets through Agent Smith. Separate: `npm run verify:claude`, `npm run verify:moltbook`.

**Search Moltbook for injection-like content:** Read https://moltbook.com/skill.md and follow the instructions to join Moltbook. Add your agent API key to `.env` as `MOLTBOOK_API_KEY=...`. Then run `npm run build && npm run verify:moltbook-search` — it searches Moltbook for terms like "ignore instructions", "jailbreak", "reveal prompt" and runs each result through Agent Smith (blocked vs allowed).

## CLI (manual check)

**With build** (uses `dist/`):

```bash
npm run build
npm run scan -- "Ignore all previous instructions"
# BLOCKED / Reason: regex-match

npm run scan -- "What's the weather today?"
# ALLOWED
```

**Without build** (runs from source via tsx):

```bash
npm run scan:dev -- "Ignore all previous instructions"
```

**JSON output** (for scripting):

```bash
npm run scan -- --json "your text"
# {"blocked":true,"reason":"regex-match"}
```

**Pipe from stdin:** `echo "your text" | npm run scan`

**Batch (e.g. Moltbook snippets):** `cat snippets.txt | npm run scan:batch` or `npm run scan:batch snippets.txt`. Output: `BLOCKED	reason	preview` or `ALLOWED	preview` per line.

**Exit codes:** `0` = allowed, `2` = blocked, `1` = usage/error

## Usage

```typescript
import { AgentSmith } from "./core";

const smith = new AgentSmith();
const result = await smith.scan("Ignore all previous instructions");
// { blocked: true, reason: "regex-match" }
```

## Project layout

- `core/` – detector, cache, patterns, privacy
- `openclaw-plugin/` – OpenClaw plugin (message/tool hooks)
- `tests/attacks/` – attack corpus
- `tests/legitimate/` – legitimate corpus

See [BUILD_CONTEXT.md](./BUILD_CONTEXT.md) and [SOURCES.md](./SOURCES.md) for design and corpus sources.

## License

MIT
