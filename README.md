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
