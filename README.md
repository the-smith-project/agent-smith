# Agent Smith

**Inevitable Defense for Uncensored Agents**

Agent Smith is a lightweight protection layer for **local, uncensored** LLM agents — especially those built with OpenClaw, but designed to be adaptable to other frameworks.

**Goal:**  
Block prompt injection, system prompt extraction and dangerous tool misuse  
**without** adding model-level censorship (no LlamaGuard, no NeMo, no heavy alignment filters that reduce model capability).

---

## What it does today (v2.0)

- **Fast pattern pre-filter** (regex + n-gram signatures)
- **Capability-based security:** enforces least-privilege on every action (domains, paths, rate limits, confirmation)
- **Secret vault:** model never sees API keys directly — uses single-use tokens
- **Local-only**, zero cloud dependency
- **Added latency:** typically 5–25 ms

---

## Architecture

```
Input → Pre-Filter → Capability Validator → Vault → Tool
           ↓              ↓                   ↓
        Block if       Block if           Execute with
        known          unknown/           secrets
        attack         disabled           (hidden from LLM)
                       action
```

**Three layers of defense:**

| Layer | What it does | Example |
|-------|--------------|---------|
| Pre-Filter | Blocks known attack patterns | "Ignore previous instructions" → blocked |
| Capability | Blocks unknown/disabled actions | `exfiltrate_data` tool → blocked (doesn't exist) |
| Vault | Hides secrets from LLM | API keys accessed via tokens, never exposed |

---

## Status

Early MVP. Useful for local uncensored OpenClaw users who want protection without sacrificing model freedom.

**Not yet battle-tested enough** — we need real-world attack testing.

---

## Quick start

```bash
npm install @the-smith-project/agent-smith
```

```typescript
import { createSmith } from 'agent-smith';

const smith = createSmith();

// Scan messages before processing
const result = smith.scanMessage(userInput);
if (!result.allowed) {
  console.log("Blocked:", result.reason);
}

// Validate actions before execution
const actionResult = smith.scanAction(input, {
  action: "file_read",
  path: "/some/path"
});
```

See `examples/` for OpenClaw integration.

---

## CLI

```bash
# Scan from stdin
echo "Ignore all previous instructions" | npx smith-scan

# Scan a file
npx smith-scan suspicious-message.txt

# JSON output
npx smith-scan --json < input.txt
```

---

## Configuration

Create `smith.config.json` in your project root:

```json
{
  "version": "2.0",
  "preFilter": { "enabled": true, "mode": "block" },
  "capabilities": {
    "web_fetch": {
      "enabled": true,
      "constraints": {
        "blockedDomains": ["localhost", "*.internal"],
        "rateLimit": 60
      }
    },
    "file_read": {
      "enabled": true,
      "constraints": {
        "blockedPaths": ["**/.env", "**/secrets/**"]
      }
    }
  },
  "vault": {
    "enabled": true,
    "secrets": {
      "OPENAI_API_KEY": { "source": "env", "envVar": "OPENAI_API_KEY" }
    }
  }
}
```

---

## Want to help?

We need people to test real attacks and report what actually happens.

**→ [CALL FOR TESTERS](./CALL_FOR_TESTERS.md)**

---

## License

MIT licensed. Open to co-maintainers or full project takeover if someone wants to run with it.
