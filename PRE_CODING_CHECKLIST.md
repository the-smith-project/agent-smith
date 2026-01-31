# Pre-Coding Checklist

**Before you start coding in Cursor**

---

## 1. Environment Setup ✓

```bash
# Node.js version
node --version  # Should be v18+ (OpenClaw requirement)
npm --version   # Should be 9+

# Git setup
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Cursor
# - Open Cursor
# - Verify .cursorrules is loaded (check Rules tab)
```

---

## 2. Project Init ✓

```bash
# Create project
mkdir agent-smith
cd agent-smith
git init

# Copy .cursorrules
cp /path/to/.cursorrules ./

# Package.json
npm init -y

# Lerna (monorepo for core + plugin)
npm install -D lerna
npx lerna init

# TypeScript
npm install -D typescript @types/node
npx tsc --init
```

---

## 3. Dependencies (Pre-install) ✓

```bash
# Core dependencies
npm install xxhash-wasm     # Fast hashing
npm install better-sqlite3  # Pattern storage
npm install zod             # Runtime validation

# Dev dependencies
npm install -D jest @types/jest
npm install -D ts-jest
npm install -D eslint @typescript-eslint/parser
npm install -D prettier
```

---

## 4. Attack Dataset (Download) ✓

**Sources:**
1. RFC #3387: https://github.com/openclaw/openclaw/discussions/3387
2. Gandalf: https://gandalf.lakera.ai/baseline-attacks
3. OWASP LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/

**Create:**
```bash
mkdir -p datasets/{attacks,legitimate}

# Copy attacks from RFC #3387
# Add Gandalf examples
# Add OWASP examples

# Minimum 20 attacks
ls datasets/attacks/*.txt | wc -l  # Should be 20+

# Minimum 50 legitimate
ls datasets/legitimate/*.txt | wc -l  # Should be 50+
```

---

## 5. OpenClaw Test Instance ✓

```bash
# Install OpenClaw (for testing integration)
npm install -g @openclaw/cli

# Setup test instance
openclaw onboard --test

# Verify it works
openclaw status
# Should show: Gateway running on localhost:18789
```

---

## 6. Cursor AI Configuration ✓

**In Cursor settings:**
- ✅ .cursorrules loaded
- ✅ Enable Copilot++
- ✅ Set max context: Large
- ✅ Enable terminal integration

**Test Cursor:**
```typescript
// Type this in new file:
// "Create a function that detects prompt injection"
// Cursor should:
// - NOT suggest LLM call (anti-pattern)
// - Suggest regex/pattern matching
// - Include privacy (hash inputs)
```

---

## 7. Code Standards Agreed ✓

**File naming:**
- `kebab-case.ts` for files
- `PascalCase` for classes
- `camelCase` for functions/variables

**Imports:**
```typescript
// Absolute imports (via tsconfig paths)
import { Detector } from '@agent-smith/core';

// Not relative
// import { Detector } from '../../../core/detector';
```

**Comments:**
```typescript
// WHY comments (not WHAT)
// GOOD: "Cache for 1h because attacks rarely repeat immediately"
// BAD: "This is a cache"
```

---

## 8. Git Strategy ✓

**Branches:**
```
main (protected)
  ├─ develop (current work)
  │   ├─ feature/detector
  │   ├─ feature/plugin
  │   └─ feature/tests
```

**Commits:**
```
feat: Add multi-layer detector
fix: False positive on "You are now my assistant"
perf: Cache hit from 10ms to 0.1ms
test: Add 10 more attack cases
```

**Daily commits:**
- End of day: Commit working code
- "WIP: [description]" if incomplete
- Push to GitHub backup

---

## 9. Testing Setup ✓

```bash
# Jest config
npx ts-jest config:init

# package.json scripts
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:attacks": "jest datasets/attacks",
    "test:coverage": "jest --coverage",
    "benchmark": "node scripts/benchmark.js"
  }
}

# Run sample test
npm test
# Should pass (or skip if no tests yet)
```

---

## 10. First Cursor Session Plan ✓

**Goal Day 1:** Basic detector working

**Steps:**
1. Create `packages/core/src/detector.ts`
   - Cursor prompt: "Create Detector class with scan() method. Follow .cursorrules principles."
   
2. Add xxHash cache layer
   - Cursor: "Add cache layer using xxhash-wasm. <100ms budget."

3. Add 5 basic regex patterns
   - Cursor: "Add regex patterns for: ignore instructions, role manipulation, system prompts"

4. Write 10 tests
   - Cursor: "Create tests for detector. Use datasets/attacks/*.txt"

5. Run tests
   ```bash
   npm test
   # Target: 5/10 pass (MVP proof)
   ```

**End of Day 1:**
- ✅ Basic detector works
- ✅ 5/10 attacks blocked
- ✅ No false positives (tested on 10 legitimate)
- ✅ Code committed to git

---

## 11. Known Gotchas (Pre-emptive) ⚠️

### Gotcha #1: xxHash async
```javascript
// WRONG: Sync call blocks
const hash = xxhash.hash(data);

// RIGHT: Await properly
const hash = await xxhash.hash(data);
```

### Gotcha #2: SQLite file locks
```javascript
// WRONG: Multiple connections
const db1 = new Database('patterns.db');
const db2 = new Database('patterns.db'); // LOCK!

// RIGHT: Singleton
const db = Database.getInstance();
```

### Gotcha #3: Regex ReDoS
```javascript
// DANGEROUS: Catastrophic backtracking
const regex = /(a+)+$/;

// SAFE: Limit quantifiers
const regex = /a{1,100}/;
```

### Gotcha #4: OpenClaw Gateway hooks
```javascript
// WRONG: Blocking hook
gateway.on('message', (msg) => {
  detectAttack(msg); // Blocks entire gateway!
});

// RIGHT: Async non-blocking
gateway.on('message', async (msg) => {
  await detectAttack(msg);
});
```

---

## 12. Success Criteria (Day 1) ✓

**Code:**
- [ ] Detector class created
- [ ] Cache layer working
- [ ] 5 regex patterns added
- [ ] Tests passing (5/10 attacks blocked)

**Process:**
- [ ] .cursorrules loaded in Cursor
- [ ] Git commits made
- [ ] No PII in logs (verified)
- [ ] Performance <100ms (measured)

**Sanity checks:**
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] Code follows .cursorrules
- [ ] No console.log (use logger)

---

## 13. Emergency Contacts 🆘

**If stuck:**
1. Re-read .cursorrules (Principles section)
2. Check Anti-Patterns (what NOT to do)
3. Review AGENT_SMITH_BUILD_CONTEXT.md
4. Ask Cursor: "This conflicts with principles, suggest alternative"

**If Cursor goes rogue:**
1. Check .cursorrules still loaded
2. Clear Cursor cache
3. Restart Cursor
4. Re-prompt with explicit principle: "Follow privacy-first, no LLM judge"

**If tests fail:**
1. Check attack dataset format (plain text?)
2. Verify detector logic (console.log intermediate results)
3. Lower threshold temporarily (tune later)
4. Add test to .cursorrules as example

---

## Ready to Start? ✅

**Pre-flight checklist:**
- [x] Node v18+ installed
- [x] .cursorrules in project root
- [x] Dependencies pre-installed
- [x] Attack dataset ready (20+)
- [x] OpenClaw test instance running
- [x] Cursor configured
- [x] Git initialized
- [x] Jest configured
- [x] Day 1 plan clear

**If all checked:**
```bash
cd agent-smith
cursor .  # Open in Cursor

# First prompt in Cursor:
# "Create packages/core/src/detector.ts following .cursorrules"
```

**LET'S BUILD** 🚀

---

**Pro tips:**
- Commit often (every working state)
- Test frequently (npm test after each feature)
- Measure always (console.time for perf checks)
- Ship daily (even if incomplete, WIP commits OK)
- Read .cursorrules when unsure

**Week 1 Goal:** v0.1.0 shipped, 20/20 attacks blocked, <100ms latency
