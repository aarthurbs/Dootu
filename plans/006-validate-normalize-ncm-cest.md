# Plan 006: Validate and normalize NCM/CEST format before writing to the spreadsheet

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: This repo has ONE commit plus uncommitted
> working-tree changes, so `git diff` is not a reliable drift signal. Open
> `index.html` and confirm the exact current text of `fatReadGroups` and
> `fatValidateGroups` matches the "Current state" excerpts below. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (NCM is 8 digits and CEST is 7 digits **by definition** — the rules are not heuristics)
- **Depends on**: `plans/001-verification-baseline.md` (appends tests to `tools/test-pure.mjs`). Do after plans 002/003 if those are in flight (all append to the same test file).
- **Category**: bug
- **Planned at**: commit `2fd798d`, 2026-07-02

## Why this matters

This client-side vanilla-JS app (`index.html`, no build/npm) writes fiscal data
(NCM in column E, CEST in column L) into an Amazon spreadsheet via
`fatWriteGroupedRecords`. Today `fatValidateGroups` only checks that NCM/CEST are
**non-empty** — `abc`, a 7-digit NCM, or a dotted CEST (`28.038.00`) all pass
"Gerar planilha" and land in the file. Worse: the write engine's number-coercion
(added 2026-07-02 as BUG-006's fix) only converts **pure digit strings** to
numbers, so a dotted or malformed value is written as *text*, which re-triggers
the exact Amazon "Validação de formato" red flag that BUG-006 eliminated. Fiscal
codes have fixed formats — NCM: 8 digits (Sistema Harmonizado); CEST: 7 digits
(Convênio ICMS 92/15) — so this is cheap to validate deterministically. The fix:
normalize (strip dots/spaces) at read time and validate digit counts before
generating.

## Current state

All code lives in the single bare inline `<script>` of `index.html` (starts line
1493). Line refs are as of 2026-07-02 — locate by searching names.

- `index.html:2707-2717` — `fatReadGroups` (refs refreshed 2026-07-03), exact current text:
  ```js
  function fatReadGroups() {
    return [...document.querySelectorAll('#fat-groups .fat-group')].map((g, i) => ({
      index:    i + 1,
      skus:     g.querySelector('.fg-skus').value.split('\n').map(s => s.trim()).filter(Boolean),
      regra:    g.querySelector('.fg-regra').value,
      ncm:      g.querySelector('.fg-ncm').value.trim(),
      origem:   g.querySelector('.fg-origem').value,
      cest:     g.querySelector('.fg-cest').value.trim(),
      custoRaw: g.querySelector('.fg-custo').value.trim(),
    }));
  }
  ```
- `index.html:2720-2742` — `fatValidateGroups`, exact current text:
  ```js
  function fatValidateGroups(groups) {
    const errors = [];
    if (!FAT.fileBuffer) errors.push('Envie uma planilha XLSX.');
    if (!groups.length)  errors.push('Adicione ao menos um grupo.');
    groups.forEach(g => {
      const tag = 'Grupo ' + g.index;
      if (!g.skus.length) errors.push(tag + ': adicione ao menos um SKU.');
      if (!g.regra)       errors.push(tag + ': selecione a Regra tributária.');
      if (!g.ncm)         errors.push(tag + ': preencha o NCM.');
      if (!g.cest)        errors.push(tag + ': preencha o CEST.');
      if (!g.custoRaw)    errors.push(tag + ': preencha o Custo do produto.');
      else if (fatParseCusto(g.custoRaw) === null || fatParseCusto(g.custoRaw) === 0)
        errors.push(tag + ': Custo do produto inválido (ex: 29,90).');
    });
    const groupsOf = new Map();
    groups.forEach(g => g.skus.forEach(s => {
      if (!groupsOf.has(s)) groupsOf.set(s, new Set());
      groupsOf.get(s).add(g.index);
    }));
    const duplicates = [...groupsOf.entries()].filter(([, set]) => set.size > 1)
      .map(([sku, set]) => ({ sku, groups: [...set] }));
    return { errors, duplicates };
  }
  ```
- Context (do NOT modify): the write engine's coercion at `index.html:~2856-2866`
  converts columns E/L to `Number` only when `/^[1-9]\d*$/` matches — values with
  dots stay text (that's why normalization here matters). Leading-zero codes
  (NCM chapters 01–09) intentionally stay text so Excel doesn't drop the zero —
  they are still valid 8-digit codes and must PASS validation.
- The autofill hint (`fatAutofillFromNcm`) already digit-normalizes for *lookup*
  via `fatDigits` (`index.html:~2383`) — display-side, unrelated to this plan.
- Repo conventions: pt-BR error strings matching the existing ones ("Grupo N: …",
  example in parentheses), 2-space indent.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Full verification | `node tools/verify.mjs` | `OK: all checks passed.`, exit 0 |
| Pure tests only | `node tools/test-pure.mjs` | all `✓`, exit 0 |

Run from repo root. If `tools/verify.mjs` does not exist, STOP — Plan 001 first.

## Scope

**In scope**:
- `index.html` — `fatReadGroups` (two property lines) and `fatValidateGroups`
  (two added `else if` lines) only.
- `tools/test-pure.mjs` — append assertions.

**Out of scope** (do NOT touch):
- The write engine (`fatWriteGroupedRecords`, its `put()` coercion, `dressNewRow`) —
  BUG-006's fix; normalization makes its input deterministic, its code is correct.
- `fatAutofillFromNcm` / hints / chips; `fatParseCusto` (plan 008's target);
  `fatGroupsToRecords`; the preview renderer.

## Git workflow

- Branch: `advisor/006-validate-ncm-cest`
- Commit message (terse): `fix: valida formato de NCM (8 dig.) e CEST (7 dig.) e normaliza pontuacao`
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Add failing tests FIRST

In `tools/test-pure.mjs`, after the existing assertion blocks (below the Plan
002/003 markers and their appended cases, if present), add:

```js
  // Plan 006: fatValidateGroups format rules (NCM 8 digits, CEST 7 digits).
  {
    const c = { FAT: { fileBuffer: {} } };
    vm.createContext(c);
    vm.runInContext(extractFn(html, 'fatParseCusto'), c);   // dependency of validate
    vm.runInContext(extractFn(html, 'fatValidateGroups'), c);
    const mk = (over) => Object.assign({ index: 1, skus: ['SKU-1'], regra: 'RN_USEEBRASIL',
      ncm: '64022000', origem: '', cest: '2803800', custoRaw: '29,90' }, over);
    eq('valid group → no errors', c.fatValidateGroups([mk({})]).errors, []);
    truthy('ncm "abc" rejected', c.fatValidateGroups([mk({ ncm: 'abc' })]).errors.some(e => e.includes('NCM')));
    truthy('ncm 7 digits rejected', c.fatValidateGroups([mk({ ncm: '6402200' })]).errors.some(e => e.includes('NCM')));
    truthy('cest 6 digits rejected', c.fatValidateGroups([mk({ cest: '280380' })]).errors.some(e => e.includes('CEST')));
    eq('leading-zero NCM (cap. 01-09) accepted', c.fatValidateGroups([mk({ ncm: '01012100' })]).errors, []);
  }
```

(`eq`, `truthy`, `extractFn`, `vm`, `html` already exist in the file from Plan 001.)

**Verify (expect FAILURE now)**: `node tools/test-pure.mjs` → the "rejected"
assertions FAIL against unmodified code (current validation accepts them). The
"valid group" and "leading-zero" cases already pass. If the rejected cases
unexpectedly pass, STOP — the code drifted.

### Step 2: Normalize NCM/CEST at read time

In `fatReadGroups`, change exactly two lines:

```js
      ncm:      g.querySelector('.fg-ncm').value.replace(/[.\s]/g, ''),
```
```js
      cest:     g.querySelector('.fg-cest').value.replace(/[.\s]/g, ''),
```

(Replaces `.trim()` — stripping all dots and whitespace covers trim. A user
typing `6402.20.00` now flows through preview, validation, and the write engine
as `64022000`, which the engine's digit-coercion then writes as a number.)

**Verify**: syntax gate — `node tools/verify.mjs` still reports inline scripts OK
(pure tests may still fail until Step 3).

### Step 3: Add the two format checks in `fatValidateGroups`

Replace these two lines:

```js
      if (!g.ncm)         errors.push(tag + ': preencha o NCM.');
      if (!g.cest)        errors.push(tag + ': preencha o CEST.');
```

with:

```js
      if (!g.ncm)         errors.push(tag + ': preencha o NCM.');
      else if (!/^\d{8}$/.test(g.ncm))  errors.push(tag + ': NCM inválido — use 8 dígitos (ex: 64022000).');
      if (!g.cest)        errors.push(tag + ': preencha o CEST.');
      else if (!/^\d{7}$/.test(g.cest)) errors.push(tag + ': CEST inválido — use 7 dígitos (ex: 2803800).');
```

**Verify**: `node tools/test-pure.mjs` → all `✓`, including the five Plan-006 cases.

### Step 4: Full gate + manual check

**Verify (automated)**: `node tools/verify.mjs` → `OK: all checks passed.`, exit 0.

**Manual (browser)**: open `index.html` → Planilha de Faturador →
1. Type NCM `6402.20.00` in a group; click "Pré-visualizar": the preview table
   must show `64022000` (normalized).
2. Set CEST to `280380` (6 digits) and click "Gerar planilha": the error box must
   list "CEST inválido — use 7 dígitos…" and NOT generate a download.

## Test plan

- Step 1's five assertions cover: happy path, non-numeric NCM, short NCM, short
  CEST, and the leading-zero NCM that must keep passing (regression guard for the
  BUG-006 leading-zero tradeoff).
- Pattern to follow: the `extractFn` + `vm.createContext` block style used by Plan
  003's `save()` quota test in the same file.
- Verification: `node tools/verify.mjs` → all pass.

## Done criteria

ALL must hold:

- [ ] `node tools/verify.mjs` → `OK: all checks passed.`, exit 0.
- [ ] The five Plan-006 assertions exist in `tools/test-pure.mjs` and pass.
- [ ] `fatValidateGroups` contains both regexes. Check:
      `node -e "const h=require('fs').readFileSync('index.html','utf8');const i=h.indexOf('function fatValidateGroups');const s=h.slice(i,i+1400);process.exit(s.includes('\\\\d{8}')&&s.includes('\\\\d{7}')?0:1)"` → exit 0.
- [ ] Manual check 2 (bad CEST blocks Gerar) done and recorded in your report.
- [ ] `git status` shows only `index.html` and `tools/test-pure.mjs` modified.
- [ ] `plans/README.md` status row for 006 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Either "Current state" excerpt doesn't match the live file (drift).
- The Step-1 "rejected" assertions unexpectedly pass before any code change.
- `extractFn` fails on `fatValidateGroups` or `fatParseCusto` (functions moved/renamed).
- You feel the need to touch the write engine or `fatGroupsToRecords` — you don't;
  normalization at read time is sufficient by design.

## Maintenance notes

- If the maintainer later adds per-SKU NCM overrides (instead of per-group), the
  same normalize+validate must apply at that input point.
- Plan 008 changes `fatParseCusto` — no overlap with this plan, but both append to
  `tools/test-pure.mjs`; append order doesn't matter, markers do (don't disturb the
  Plan 002/003 marker comments).
- Reviewer: confirm error strings match the existing pt-BR style and that a dotted
  NCM now round-trips to a *numeric* cell (BUG-006 behavior) — type `6402.20.00`,
  generate, and check column E in the downloaded file is not red in Excel.
