# Plan 003: Harden index.html formatters, storage & Faturador loader

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: Open `index.html` and confirm the exact current
> text of each "Current state" excerpt below (three separate regions). This repo
> has uncommitted working-tree changes, so `git diff` is not a reliable drift
> signal — compare against the LIVE file. On any mismatch in a region, STOP for
> that region and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-verification-baseline.md`. Best done **after**
  `plans/002` since both edit `index.html` and `tools/test-pure.mjs` (no line
  overlap, but sequential avoids confusion).
- **Category**: bug
- **Planned at**: commit `2fd798d`, 2026-07-01

## Why this matters

Three small, independent robustness gaps in `index.html`, each with a real failure
mode and each low-risk to fix:

1. **F3 — `brl()`/`pct()` don't guard `Infinity`.** They guard only `NaN`, so a
   non-finite value renders as `R$ ∞` / `Infinity%`. The project's own rule BP-004
   (in `CLAUDE.md`) states these formatters should "tratar NaN/Infinity retornando
   0" — the documented safety net doesn't actually exist in the code. The primary
   division that produced BUG-004 is guarded elsewhere, but the promised formatter
   guard is the backstop and it's missing.
2. **F4 — `save()`/`saveProjects()` are unguarded.** A `QuotaExceededError` (large
   prompt library, or storage pressure from the ~387KB inventory snapshot sharing
   the origin) throws mid-operation with no feedback, and can fire during startup
   `migrateData()`. Reads are already defensive (`load`/`loadProjects` use
   try/catch); writes are not. The `amazon-inventory.js` `save()` already models the
   right pattern (try/catch, degrade gracefully).
3. **F5 — Faturador `await ensureXlsx()` is outside the try.** In
   `fatWriteGroupedRecords` (the ONLY write engine — `fatWriteRecords` and the
   per-SKU mode were removed from the codebase on 2026-07-01), the lazy
   xlsx-library load is awaited *before* the try that returns a graceful
   `{error}`. If the 642KB lib fails to load (offline, blocked, missing), the
   rejection escapes as an **uncaught promise rejection** and the "Gerar planilha"
   button appears dead with no message. `fatLoadFile` and `fatOnEnterFaturador`
   already do it right (both await `ensureXlsx()` *inside* their try).

## Current state

### F3 — formatters (`index.html:3394-3395`, refs refreshed 2026-07-02), exact current text:
```js
function brl(n) { return (isNaN(n)?0:n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function pct(n) { return (isNaN(n)?0:n*100).toFixed(2).replace('.',',') + '%'; }
```
`isNaN(Infinity)` is `false`, so `Infinity` slips through both guards.

### F4 — storage writes (`index.html:1521` and `1527`), exact current text:
```js
  function save(prompts) { localStorage.setItem(KEY, JSON.stringify(prompts)); }
```
```js
  function saveProjects(projects) { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); }
```
For contrast, the reads just above are already guarded:
```js
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }
```

### F5 — Faturador write engine (single engine as of 2026-07-01; `fatWriteRecords` no longer exists).
`fatWriteGroupedRecords` (`index.html:2720-2725`), exact current text:
```js
  async function fatWriteGroupedRecords(records) {
    if (!FAT.fileBuffer) return { error: '⚠️ Envie uma planilha XLSX antes de processar.' };
    await ensureXlsx();
    let wb;
    try { wb = await XlsxPopulate.fromDataAsync(FAT.fileBuffer); }
    catch (e) { return { error: '❌ Não foi possível ler o arquivo XLSX.' }; }
```
Two exemplars already do it right — `fatLoadFile` (`index.html:2322-2334`) and
`fatOnEnterFaturador` (`index.html:2502-2509`): in both, `await ensureXlsx()` is
INSIDE the try. Do NOT edit either.

The write engine is called by the one function that already handles the `{error}`
return shape: `processFaturadorGroups` (`index.html:2811-2813`, its `fail(msg)`
helper). So returning `{error}` on load failure needs **no** caller changes.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Full verification | `node tools/verify.mjs` | `OK: all checks passed.`, exit 0 |
| Pure tests only | `node tools/test-pure.mjs` | all `✓`, exit 0 |

Run from repo root. If `tools/verify.mjs` is missing, STOP — Plan 001 first.

## Scope

**In scope**:
- `index.html` — three regions only: `brl`/`pct` (~3394-3395), `save`/`saveProjects`
  (~1521, ~1527), and the Faturador write engine `fatWriteGroupedRecords` (~2720-2725).
- `tools/test-pure.mjs` — append regression assertions.

**Out of scope** (do NOT touch):
- `fatLoadFile` (already correct exemplar), `load`/`loadProjects` (already guarded).
- `parseMoney`/`fatParseCusto` — Plan 002.
- The Faturador callers, the `Calc5` math, the xlsx write logic after the try.
- `amazon-inventory.js` `save()` — already guarded; it's just the reference pattern.

## Git workflow

- Branch: `advisor/003-harden-formatters-storage-loader`
- Commit message style (terse): `fix: guard Infinity in formatters, quota in storage, xlsx load in Faturador`
  (or three commits, one per fix — either is fine).
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1 (F3): Guard non-finite in `brl` and `pct`, add regression tests

Replace the two formatter lines (`index.html:3394-3395`) with:

```js
function brl(n) { return (Number.isFinite(n)?n:0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function pct(n) { return (Number.isFinite(n)?n*100:0).toFixed(2).replace('.',',') + '%'; }
```

Then in `tools/test-pure.mjs`, find the line:

```js
  // (Plan 003 appends Infinity/NaN regression cases below this line.)
```

and add immediately below it:

```js
  eq('brl(Infinity) === brl(0)', ctx.brl(Infinity), ctx.brl(0));
  eq('brl(NaN) === brl(0)', ctx.brl(NaN), ctx.brl(0));
  eq('pct(Infinity) === "0,00%"', ctx.pct(Infinity), '0,00%');
  eq('pct(-Infinity) === "0,00%"', ctx.pct(-Infinity), '0,00%');
  truthy('brl(Infinity) has no ∞ glyph', !ctx.brl(Infinity).includes('∞'));
```

**Verify**: `node tools/test-pure.mjs` → all `✓` incl. the five new cases.

### Step 2 (F4): Wrap storage writes in try/catch, add a regression test

Replace the two write functions (`index.html:1521`, `1527`) with:

```js
  function save(prompts) { try { localStorage.setItem(KEY, JSON.stringify(prompts)); } catch (e) { alert('⚠️ Não foi possível salvar (armazenamento cheio). Libere espaço e tente de novo.'); } }
```
```js
  function saveProjects(projects) { try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch (e) { alert('⚠️ Não foi possível salvar (armazenamento cheio). Libere espaço e tente de novo.'); } }
```

Keep them one-liners to match the surrounding style. (An inline toast would be
nicer than `alert`, but `alert` is the minimal, dependency-free, surgical choice;
see Maintenance notes.)

Then in `tools/test-pure.mjs`, directly below the F3 cases you just added, append:

```js
  // F4: save() must swallow a QuotaExceededError instead of throwing.
  // NOTE: alertCount is a closure variable, NOT `this.alerted` — Node's `vm`
  // does not bind `this` to the sandbox for a bare alert() call, so a
  // `this.`-based counter would throw inside the catch and break this test.
  {
    const saveSrc = extractFn(html, 'save');
    if (saveSrc.includes('localStorage') && saveSrc.includes('KEY')) {
      let alertCount = 0;
      const c = { KEY: 'k', localStorage: { setItem() { throw new Error('QuotaExceeded'); } }, alert() { alertCount++; }, JSON };
      vm.createContext(c);
      vm.runInContext(saveSrc, c);
      let threw = false;
      try { c.save([{ id: 1 }]); } catch (e) { threw = true; }
      truthy('save() swallows quota error (no throw)', !threw);
      truthy('save() alerts the user on quota error', alertCount === 1);
    } else {
      console.log('  ⚠ skipped save() quota test: extracted fn is not the prompts save (verify target)');
    }
  }
```

(`extractFn`, `vm`, and `html` are already in scope inside `runPureTests`.)

**Verify**: `node tools/test-pure.mjs` → all `✓`; the save() test runs (not
skipped) and passes. If it prints the "skipped" warning, the first
`function save(` in `index.html` isn't the prompts one — STOP and report which
function it extracted.

### Step 3 (F5): Move `await ensureXlsx()` inside the try in the write engine

In `fatWriteGroupedRecords` (`index.html:2720-2725`), change the region so the
lib load is inside the existing try and its catch returns the graceful `{error}`:

```js
  async function fatWriteGroupedRecords(records) {
    if (!FAT.fileBuffer) return { error: '⚠️ Envie uma planilha XLSX antes de processar.' };
    let wb;
    try {
      await ensureXlsx();
      wb = await XlsxPopulate.fromDataAsync(FAT.fileBuffer);
    }
    catch (e) { return { error: '❌ Não foi possível carregar a biblioteca ou ler o arquivo XLSX.' }; }
```

Do not change anything after the catch, and do not touch `fatLoadFile` or
`fatOnEnterFaturador`.

**Verify (structural)**: after the edit, the pattern `try { await ensureXlsx() }`
should appear exactly 3× (the fixed `fatWriteGroupedRecords` + the pre-existing
`fatLoadFile` and `fatOnEnterFaturador`):
```
node -e "const h=require('fs').readFileSync('index.html','utf8');const n=(h.match(/try\s*\{\s*await ensureXlsx\(\)/g)||[]).length;console.log('matches:',n);process.exit(n===3?0:1)"
```
→ prints `matches: 3`, exit 0.

### Step 4: Full gate + manual browser checks

**Verify (automated)**: `node tools/verify.mjs` → `OK: all checks passed.`, exit 0.

**Manual (do these in a browser — they cover what the harness can't):**
1. Open `index.html`. Open DevTools console (must stay free of uncaught errors).
2. **F3**: go to Precificação (Multi-plataforma); with default inputs it should
   render normal `R$`/`%` values — confirm no `∞`/`Infinity` anywhere.
3. **F5**: DevTools → Network → block the request URL `xlsx-populate.min.js`
   (Chrome: right-click the request → "Block request URL", or add it in the
   Network request-blocking panel), then reload. Go to Faturador, upload a valid
   `.xlsx`, and click "Gerar planilha". **Expected**: the summary box shows the
   "Não foi possível carregar a biblioteca…" error — NOT a silently dead button,
   and NO "Uncaught (in promise)" in the console. Then remove the block.
   (This test blocks a network request only; it does **not** modify any repo file.)

## Test plan

- `tools/test-pure.mjs` gains: 5 finite-guard cases (F3) and a VM-based quota test
  for `save()` (F4). F5 is covered by the structural check in Step 3 plus the manual
  browser test in Step 4 (its async + `XlsxPopulate` global can't be unit-tested
  without a DOM/npm, which the project forbids).
- Model: the `eq`/`truthy` helpers and the `extractFn`+`vm` pattern already in the
  file (added by Plan 001).
- Verification: `node tools/verify.mjs` all pass + the two manual browser checks.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node tools/verify.mjs` → `OK: all checks passed.`, exit 0.
- [ ] `brl`/`pct` use `Number.isFinite` — check:
      `node -e "const h=require('fs').readFileSync('index.html','utf8');process.exit(/function brl\(n\) \{ return \(Number\.isFinite/.test(h)&&/function pct\(n\) \{ return \(Number\.isFinite/.test(h)?0:1)"` → exit 0.
- [ ] `save` and `saveProjects` each contain a `try`/`catch` (F4). The VM quota test
      in `tools/test-pure.mjs` runs (not skipped) and passes.
- [ ] `try { await ensureXlsx() }` appears exactly 3× in `index.html` (Step-3 check
      prints `matches: 3`).
- [ ] `fatLoadFile`, `load`, `loadProjects`, `parseMoney` are unchanged.
- [ ] `git status` shows only `index.html` and `tools/test-pure.mjs` modified.
- [ ] `plans/README.md` status row for 003 updated to DONE.

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the three "Current state" excerpts doesn't match the live file (drift) —
  report the region that differs; you may still do the other regions.
- The `save()` VM test prints the "skipped" warning (the extractor grabbed the wrong
  `save` function) — report which function body it extracted.
- The structural `ensureXlsx` count is not 3 after your edits — you edited the wrong
  place or missed one; do not force it, report the actual count.
- `node tools/verify.mjs` fails for a reason other than a test you just edited.
- Any fix appears to require touching a caller or out-of-scope function — it does
  not.

## Maintenance notes

- The `alert()` in F4 is deliberately minimal (no dependency, no new DOM). If the
  project later adds an inline toast/status component, replace the two `alert`
  calls with it — behavior (swallow + notify) must stay.
- F3 closes the gap between BP-004's stated rule and the code. Consider noting in
  the README bug log that the documented formatter guard is now actually
  implemented (optional doc edit, outside this plan).
- If `ensureXlsx` is ever changed to resolve synchronously or is removed, the F5
  try-wrapping still holds (an extra `await` in a try is harmless).
- Reviewer should confirm: no caller was modified, `fatLoadFile` untouched, and the
  Faturador still writes to column C on a normal successful run (the happy path is
  unchanged — only the failure path was added).
