# Plan 001: Establish a dependency-free verification baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report — do
> not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: This repo has ONE commit plus uncommitted
> working-tree changes, so `git diff` is not a reliable drift signal. Instead,
> open `index.html` and confirm the functions `parseMoney`, `brl`, and `pct`
> still exist (search for `function parseMoney`). If they are gone or renamed,
> STOP and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / tests
- **Planned at**: commit `2fd798d`, 2026-07-01

## Why this matters

This is a 3,834-line single-page app edited by hand (and, going forward, by
weaker AI executors) with **zero** automated way to know an edit didn't break it:
no tests, no linter, no typecheck, no build step. A single stray brace in the
1,266-line inline `<script>` is only discovered by opening the page in a browser.
Plans 002 and 003 fix real bugs in that inline script and need a way to *prove*
the fix works and nothing else regressed. This plan creates that one-command
safety net — using only Node.js built-ins, adding **no npm dependencies** (which
the project forbids). After this lands, `node tools/verify.mjs` is the gate every
future change runs through.

## Current state

- No `package.json`, no `tools/` directory, no test files exist yet.
- Node.js **v24.14.0** is installed on the dev machine (verified during recon).
- The functions to be unit-tested live **inside** the inline `<script>` in
  `index.html` (not a module, not exported). They are pure and self-contained:
  - `index.html:3388-3392` — `parseMoney(str)` *(line refs refreshed 2026-07-02)*
  - `index.html:3394` — `brl(n)`
  - `index.html:3395` — `pct(n)`
  Exact current text:
  ```js
  function parseMoney(str) {
    if (typeof str === 'number') return str;
    str = String(str||'0').replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.');
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  }
  function brl(n) { return (isNaN(n)?0:n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function pct(n) { return (isNaN(n)?0:n*100).toFixed(2).replace('.',',') + '%'; }
  ```
- Loaded standalone JS files (verified in `index.html` `<script src>` tags):
  `amazon-inventory.js`, `period-intro.js`, `nba-teams.js`, `score-bar.js`.
- There is exactly one bare inline `<script>` (line 1493 as of 2026-07-02) plus two more inline
  script blocks with `id` attributes (`calc5-script` at ~3362, `prc-options-toggle-script` at ~3837).
  The commented-out `supabase-*` scripts have `src=` and live inside an HTML
  comment, so the extractor below (which requires no `src=`) correctly skips them.

**Important:** the assertions in this plan deliberately test only behaviors that
are **correct today and will stay correct** after Plans 002/003 (e.g.
`parseMoney("54,80") === 54.8`). Do NOT add assertions here for the buggy
dot-decimal behavior — Plan 002 adds those as its regression test.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Node version | `node --version` | prints `v24.x` (any v18+ is fine) |
| Run full verification | `node tools/verify.mjs` | prints `OK: all checks passed.`, exit 0 |
| Run only pure tests | `node tools/test-pure.mjs` | all `✓`, exit 0 |

Run these from the repo root (`C:\Users\Teste\Downloads\Seller-Arthur`).

## Scope

**In scope** (create these files only):
- `tools/verify.mjs` (create)
- `tools/test-pure.mjs` (create)
- `.editorconfig` (create)

**Out of scope** (do NOT touch):
- `index.html` and every other existing source file — this plan is READ-ONLY on
  all app code. It only *reads* `index.html` at runtime to check it. If you feel
  you need to edit `index.html`, STOP — that is Plan 002/003's job.
- Do NOT create a `package.json` or install anything. `.mjs` files run under Node
  with no config.

## Git workflow

- Branch: `advisor/001-verification-baseline`
- One commit is fine; message style (match the repo's terse style):
  `add dependency-free verification harness (syntax + pure-fn tests)`
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Create `tools/test-pure.mjs`

Create the file `tools/test-pure.mjs` with EXACTLY this content:

```js
// Dependency-free unit tests for pure functions embedded in index.html.
// The functions are not exported, so we extract each one by brace-matching
// and evaluate it in an isolated VM context. Node built-ins only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Extract a top-level `function NAME(...) { ... }` from source by brace matching.
export function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('function not found in index.html: ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

export function runPureTests() {
  const html = readFileSync('index.html', 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  for (const name of ['parseMoney', 'brl', 'pct']) {
    vm.runInContext(extractFn(html, name), ctx);
  }

  let failures = 0;
  const eq = (label, got, want) => {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g === w) console.log('  ✓ ' + label);
    else { console.error(`  ✗ ${label}: got ${g}, want ${w}`); failures++; }
  };
  const truthy = (label, cond) => {
    if (cond) console.log('  ✓ ' + label);
    else { console.error('  ✗ ' + label); failures++; }
  };

  // --- parseMoney: behaviors that hold today and must keep holding ---
  eq('parseMoney("54,80") === 54.8', ctx.parseMoney('54,80'), 54.8);
  eq('parseMoney("1.234,56") === 1234.56', ctx.parseMoney('1.234,56'), 1234.56);
  eq('parseMoney("") === 0', ctx.parseMoney(''), 0);
  eq('parseMoney(42) === 42', ctx.parseMoney(42), 42);
  // (Plan 002 appends dot-decimal regression cases below this line.)

  // --- brl / pct sanity ---
  truthy('brl(0) is a string containing "0"',
    typeof ctx.brl(0) === 'string' && ctx.brl(0).includes('0'));
  eq('pct(0) === "0,00%"', ctx.pct(0), '0,00%');
  // (Plan 003 appends Infinity/NaN regression cases below this line.)

  return failures;
}

// Allow running standalone: `node tools/test-pure.mjs`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(runPureTests() ? 1 : 0);
}
```

**Verify**: `node tools/test-pure.mjs` → every line starts with `✓` and the
process exits 0. (Check exit code: on Windows PowerShell run
`node tools/test-pure.mjs; echo $LASTEXITCODE` → last line `0`.)

### Step 2: Create `tools/verify.mjs`

Create the file `tools/verify.mjs` with EXACTLY this content:

```js
// One-command verification for this static site. Node built-ins only.
// Runs: (1) syntax check of all app JS incl. inline <script> blocks,
//       (2) structure check that key DOM/anchor markers still exist,
//       (3) pure-function unit tests (tools/test-pure.mjs).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPureTests } from './test-pure.mjs';

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.error('  ✗ ' + m); failures++; };

// 1) SYNTAX
console.log('[1/3] Syntax check');
for (const f of ['amazon-inventory.js', 'period-intro.js', 'nba-teams.js', 'score-bar.js']) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); ok(f); }
  catch (e) { bad(f + ' — ' + (e.stderr ? e.stderr.toString().trim() : e.message)); }
}
const html = readFileSync('index.html', 'utf8');
// Inline <script> blocks WITHOUT a src attribute (skips commented supabase tags).
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const tmp = mkdtempSync(join(tmpdir(), 'sa-verify-'));
inline.forEach((code, i) => {
  const p = join(tmp, `inline-${i}.js`);
  writeFileSync(p, code);
  try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); ok(`index.html inline script #${i + 1}`); }
  catch (e) { bad(`index.html inline script #${i + 1} — ` + (e.stderr ? e.stderr.toString().trim() : e.message)); }
});

// 2) STRUCTURE — key anchors that must survive any edit
console.log('[2/3] Structure check');
for (const a of [
  'id="match-score"',
  'id="view-amazon-inventory"',
  'id="prc-pane-calc5"',
  'src="amazon-inventory.js"',
  'src="score-bar.js"',
  'function parseMoney',
]) { html.includes(a) ? ok(a) : bad('missing anchor: ' + a); }

// 3) PURE TESTS
console.log('[3/3] Pure-function tests');
failures += runPureTests();

console.log('');
if (failures) { console.error(`FAILED: ${failures} problem(s).`); process.exit(1); }
console.log('OK: all checks passed.');
```

**Verify**: `node tools/verify.mjs` → prints three sections all with `✓`, ends
with `OK: all checks passed.`, exits 0.

### Step 3: Create `.editorconfig`

Create `.editorconfig` in the repo root with this content:

```ini
# Editor defaults for this project. Guides editors; does NOT reformat existing files.
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

Do **not** run any formatter or reformat existing files — `.editorconfig` only
affects future edits in editors that honor it.

**Verify**: the file exists — `node -e "process.exit(require('fs').existsSync('.editorconfig')?0:1)"` → exit 0.

### Step 4: Confirm the whole gate is green

**Verify**: `node tools/verify.mjs` → `OK: all checks passed.` and exit 0.

## Test plan

- New harness files are themselves the tests. After Step 2, `node tools/verify.mjs`
  must pass with all `✓`.
- Sanity-check that the harness can actually *fail* (so it's not a no-op): the
  quickest safe way is a throwaway check — do NOT commit it. In a scratch shell,
  run `node -e "const {extractFn}=await import('./tools/test-pure.mjs'); console.log(extractFn(require('fs').readFileSync('index.html','utf8'),'parseMoney').slice(0,20))"`
  and confirm it prints the start of the `parseMoney` function (`function parseMoney(`).
  If it does, extraction works. (This is a manual confidence check, not a committed test.)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node tools/verify.mjs` prints `OK: all checks passed.` and exits 0.
- [ ] `node tools/test-pure.mjs` exits 0 with all `✓`.
- [ ] Files exist: `tools/verify.mjs`, `tools/test-pure.mjs`, `.editorconfig`.
- [ ] `git status` shows only these three new files added — no existing file modified.
- [ ] `plans/README.md` status row for 001 updated to DONE.

## STOP conditions

Stop and report back (do not improvise) if:

- `node --version` reports Node older than v18 (top-level features used here need
  v18+; the extractor and `matchAll` are fine on v14+ but confirm before proceeding).
- The syntax check reports an error on an `index.html inline script #N` that
  mentions **top-level `await`** — that means an inline block uses top-level await
  and Node's default (CommonJS) `--check` rejects it. Fix by writing that block's
  temp file with a `.mjs` extension instead of `.js` in `verify.mjs`, re-run, and
  note it. If a *different* real syntax error is reported in `index.html`, STOP —
  the file may already be broken; report it, do not "fix" the app.
- `extractFn` throws "function not found" for `parseMoney`/`brl`/`pct` — the inline
  code drifted since this plan; report the actual current shape.
- Any pure-function assertion fails on the **unmodified** `index.html` — that would
  mean the current code already disagrees with a behavior assumed here (e.g. a
  different ICU/locale); report the actual output, do not change `index.html`.

## Maintenance notes

- Plans 002 and 003 will append assertions to `tools/test-pure.mjs` right below the
  marked comment lines. Keep those marker comments intact.
- If someone later extracts the inline `<script>` into a real `.js` module,
  `extractFn(html, …)` in `test-pure.mjs` must be repointed at that module file,
  and the structure-check anchors in `verify.mjs` updated.
- The structure check is intentionally shallow (string presence, not a real DOM).
  It catches gross breakage (a whole view or script tag deleted), not logic bugs.
  A fuller headless-DOM smoke test would require an npm dependency (jsdom), which
  the project forbids — do not add one without the maintainer's explicit sign-off.
- Reviewer should confirm no app file was modified and that the harness genuinely
  exercises `index.html` (not a stale copy).
