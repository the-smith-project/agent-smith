# Attack Pattern Database — Dataset Statistics

**Last updated:** 2026-01-31  
**Sources:** `data/raw/`, `src/attacks/patterns.json`, `src/attacks/taxonomy.ts`, `tests/attacks/`

---

## 1. Pattern database (patterns.json)

| Metric | Count |
|--------|-------|
| **Categories** | 12 |
| **Total signatures** | 56 |
| **Total n-gram sequences** | 42 |
| **Total regex patterns** | 39 |

### Per-category breakdown

| Category | Signatures | N-grams | Regex | Severity | False-positive risk |
|----------|------------|---------|-------|----------|----------------------|
| instruction_override | 12 | 6 | 5 | critical | low |
| role_manipulation | 8 | 4 | 3 | critical | medium |
| context_injection | 4 | 3 | 4 | high | medium |
| delimiter_attack | 3 | 2 | 2 | high | low |
| encoding_attack | 4 | 3 | 3 | high | high |
| payload_splitting | 3 | 3 | 3 | high | high |
| recursive_injection | 3 | 3 | 3 | high | medium |
| authority_hijacking | 5 | 4 | 3 | high | medium |
| hypothetical_scenario | 4 | 4 | 4 | medium | high |
| translation_attack | 3 | 3 | 2 | medium | high |
| character_roleplay | 4 | 4 | 3 | critical | medium |
| few_shot_poisoning | 3 | 3 | 3 | high | high |

### Severity distribution

| Severity | Categories | Category names |
|----------|------------|----------------|
| **critical** | 3 | instruction_override, role_manipulation, character_roleplay |
| **high** | 7 | context_injection, delimiter_attack, encoding_attack, payload_splitting, recursive_injection, authority_hijacking, few_shot_poisoning |
| **medium** | 2 | hypothetical_scenario, translation_attack |

### False-positive risk distribution

| Risk | Categories |
|------|------------|
| **low** | 2 (instruction_override, delimiter_attack) |
| **medium** | 5 (role_manipulation, context_injection, recursive_injection, authority_hijacking, character_roleplay) |
| **high** | 5 (encoding_attack, payload_splitting, hypothetical_scenario, translation_attack, few_shot_poisoning) |

---

## 2. Raw data sources (data/raw/)

| Source | File | Summary |
|--------|------|---------|
| **awesome-llm-security** | github_attacks.json | 24 papers (5 white-box, 11 black-box, 3 backdoor, 5 defense), 8 tools, 5 articles, 3 benchmarks, 9 patterns mentioned |
| **arXiv:2310.12815** | arxiv_attacks.json | 1 paper (Open-Prompt-Injection), 5 attack categories from paper, 0 local attack examples |
| **Lakera blog** | lakera_attacks.json | 5 relevant articles, 9 patterns mentioned, Gandalf/PINT references; 0 local attack strings |
| **HackAPrompt** | hackaprompt.json | Gated dataset; target 1,000 successful jailbreaks; 0 rows fetched locally (requires HF_TOKEN) |

### Patterns mentioned in raw sources

- **github_attacks.json:** jailbreak, prompt injection, indirect prompt injection, adversarial attack, instruction override, persona modulation, cipher, backdoor, virtual prompt injection  
- **lakera_attacks.json:** prompt injection, indirect prompt injection, jailbreak, Gandalf, agent breaker, malicious prompts, adversarial prompts  

---

## 3. Test corpus (tests/attacks/)

| Metric | Count |
|--------|-------|
| **Attack sample files (.txt)** | 20 |
| **Legitimate sample files** | 20 (in `tests/legitimate/`) |

Attack samples cover: ignore-instructions, disregard-safety, unrestricted, first-tell-safe, format-markers, pirate-role, kindly-bypass, game, urgent-dev, hidden-div, new-instruction, developer-override, asap-dev, inst-marker, developer-mode, reveal-prompt, im-start, kindly-ignore, game-where, urgent-team.

---

## 4. Taxonomy (src/attacks/taxonomy.ts)

- **Attack categories:** 12 (aligned with arXiv:2310.12815, OWASP LLM Top 10, awesome-llm-security).
- **Category labels** map each category to a short canonical phrase (e.g. `instruction_override` → "Ignore previous instructions").

---

## 5. Coverage notes

- **Detector vs patterns.json:** The runtime detector (`core/detector.ts`, `core/patterns.ts`) uses a fixed subset of regex and n-grams. Not all 56 signatures are yet covered; the attack test suite (`tests/attacks/attack-suite.test.ts`) asserts that a majority of categories have at least one signature blocked and includes a skipped test for full signature coverage once the detector is wired to `patterns.json`.
- **Raw attack strings:** Most raw sources provide metadata and pattern names; concrete attack strings are in PDFs, repos (e.g. Open-Prompt-Injection), or gated datasets (HackAPrompt, Gandalf/PINT). See `data/DATA_SOURCES.md` for fetch scripts and citations.
