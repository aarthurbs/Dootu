# Plan 008: Apply one unified thousands-dot rule to both money parsers (`parseMoney` + `fatParseCusto`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: This plan assumes **Plan 002 is DONE** (check its
> status row in `plans/README.md`). Open `index.html` and confirm `parseMoney`
> matches the "expected post-002 shape" excerpt below and `fatParseCusto` matches
> its excerpt. On mismatch of either, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (money-input ambiguity — the rule below is a documented decision; see "The decided rule")
- **Depends on**: `plans/001-verification-baseline.md` AND `plans/002-fix-parsemoney-decimal-dot.md` (must be DONE first)
- **Category**: bug
- **Planned at**: commit `2fd798d`, 2026-07-02

## Why this matters

This client-side vanilla-JS app (`index.html`, no build/npm) has two money-input
parsers: `parseMoney` (Precificação/pricing tool) and `fatParseCusto` (Faturador,
writes cost into column P of a fiscal spreadsheet). After Plan 002, both treat a
dot **without a comma** as a decimal point. That leaves one real Brazilian-input
failure: `"1.234"` (meaning R$ 1.234,00 — thousands dot, no cents) parses as
`1.234` — a **1000× understatement** on money paths, silently. The maintainer
decided on 2026-07-02 to adopt a smarter shared rule (superseding the "accepted
trade-off" note in Plan 002, which anticipated exactly this follow-up). Both
parsers must change **together** so pricing and fiscal cost agree on every input.

### The decided rule (do not re-litigate; STOP if it seems wrong in practice)

After stripping currency symbols/whitespace, when the string has **no comma**:

- If it matches `/^[1-9]\d{0,2}(\.\d{3})+$/` — i.e. dot-separated groups of
  exactly 3 digits with a non-zero-leading first group (`1.234`, `12.345.678`,
  `2.500`) — the dots are **thousands separators**: strip them.
- Otherwise the dot is a **decimal point** (`82.9`, `54.80`, `2.5`, `0.500`).

Notes that make this safe:
- `0.500` does NOT match (first group `0`) → stays `0.5`. A leading `0.` always
  signals decimal.
- `2.500` matches → `2500`. In a money context someone meaning R$ 2,50 types a
  comma or `2.50` (2 digits); `2.500` reads as two thousand five hundred.
- With a comma present, behavior is unchanged: `1.234,56` → `1234.56`.

## Current state

Line refs as of 2026-07-02 — locate by searching names.

- `index.html:~2325-2330` — `fatParseCusto` (refs refreshed 2026-07-03), exact current text (pre-plan-008):
  ```js
  // "82,90" / "82.9" / "1.234,56" → 1234.56 ; returns null if not a number
  function fatParseCusto(raw) {
    let s = raw.replace(/\s/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isNaN(n) ? null : n;
  }
  ```
- `index.html:~3490-3494` — `parseMoney`, **expected post-002 shape** (this is
  what Plan 002 produces; if the live code still unconditionally strips all dots,
  Plan 002 was not executed — STOP):
  ```js
  function parseMoney(str) {
    if (typeof str === 'number') return str;
    let s = String(str||'0').replace(/[R$\s]/g,'');
    if (s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  ```
- Callers (context only, do NOT modify): `parseMoney` feeds the pricing fields
  (`index.html:3624,3640,3652,3668,3680-3682`); `fatParseCusto` feeds
  `fatValidateGroups` and `fatGroupsToRecords` (column P of the spreadsheet).
- Repo conventions: keep each function's own error convention — `parseMoney`
  returns `0` on garbage, `fatParseCusto` returns `null`. Do NOT unify those.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Full verification | `node tools/verify.mjs` | `OK: all checks passed.`, exit 0 |
| Pure tests only | `node tools/test-pure.mjs` | all `✓`, exit 0 |

Run from repo root. If `tools/verify.mjs` is missing, STOP — Plan 001 first.

## Scope

**In scope**:
- `index.html` — the bodies of `fatParseCusto` and `parseMoney` only (one added
  `else if` line each, plus `fatParseCusto`'s leading comment).
- `tools/test-pure.mjs` — append assertions.

**Out of scope** (do NOT touch):
- All callers; `fatValidateGroups` (its `=== 0` invalid-cost check still holds);
  `brl`/`pct`; the Faturador write engine.
- Any UI hint about the rule — optional follow-up, not this plan.

## Git workflow

- Branch: `advisor/008-unified-decimal-dot-rule`
- Commit message (terse): `fix: ponto em grupos de 3 digitos e milhar nos dois parsers de dinheiro`
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Add the regression tests FIRST (they must fail now)

In `tools/test-pure.mjs`, after the existing assertion blocks, add:

```js
  // Plan 008: unified thousands-dot rule (both parsers).
  eq('parseMoney("1.234") === 1234 (thousands)', ctx.parseMoney('1.234'), 1234);
  eq('parseMoney("12.345.678") === 12345678', ctx.parseMoney('12.345.678'), 12345678);
  eq('parseMoney("0.500") === 0.5 (leading 0. is decimal)', ctx.parseMoney('0.500'), 0.5);
  eq('parseMoney("2.5") === 2.5 (unchanged)', ctx.parseMoney('2.5'), 2.5);
  eq('parseMoney("54.80") === 54.8 (unchanged)', ctx.parseMoney('54.80'), 54.8);
  eq('parseMoney("1.234,56") === 1234.56 (unchanged)', ctx.parseMoney('1.234,56'), 1234.56);
  {
    const c = {};
    vm.createContext(c);
    vm.runInContext(extractFn(html, 'fatParseCusto'), c);
    eq('fatParseCusto("1.234") === 1234 (thousands)', c.fatParseCusto('1.234'), 1234);
    eq('fatParseCusto("2.500") === 2500 (thousands)', c.fatParseCusto('2.500'), 2500);
    eq('fatParseCusto("0.500") === 0.5 (decimal)', c.fatParseCusto('0.500'), 0.5);
    eq('fatParseCusto("82.9") === 82.9 (unchanged)', c.fatParseCusto('82.9'), 82.9);
    eq('fatParseCusto("82,90") === 82.9 (unchanged)', c.fatParseCusto('82,90'), 82.9);
    eq('fatParseCusto("1.234,56") === 1234.56 (unchanged)', c.fatParseCusto('1.234,56'), 1234.56);
    eq('fatParseCusto("abc") === null (unchanged)', c.fatParseCusto('abc'), null);
  }
```

**Verify (expect FAILURE now)**: `node tools/test-pure.mjs` → exactly the four
"thousands" assertions FAIL (`1.234`-style inputs currently parse as decimals);
every "unchanged" assertion PASSES. Any other pattern of failures → STOP.

### Step 2: Change `fatParseCusto`

Replace the function (and its leading comment) with:

```js
  // "82,90" / "82.9" / "1.234,56" / "1.234" → número; null se não for número.
  // Sem vírgula: pontos em grupos de 3 dígitos (1.234 / 12.345.678) são milhar;
  // qualquer outro ponto é decimal (82.9, 0.500). Regra única com parseMoney.
  function fatParseCusto(raw) {
    let s = raw.replace(/\s/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return isNaN(n) ? null : n;
  }
  ```

**Verify**: `node tools/test-pure.mjs` → the `fatParseCusto` block is all `✓`
(the `parseMoney` thousands cases still fail).

### Step 3: Change `parseMoney`

Insert the same `else if` into the post-002 body:

```js
function parseMoney(str) {
  if (typeof str === 'number') return str;
  let s = String(str||'0').replace(/[R$\s]/g,'');
  if (s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
  else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g,'');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
```

**Verify**: `node tools/test-pure.mjs` → all `✓`, including all Plan-008 cases
and the pre-existing Plan-001/002 cases (none may regress).

### Step 4: Full gate

**Verify**: `node tools/verify.mjs` → `OK: all checks passed.`, exit 0.

## Test plan

- Step 1's 13 assertions cover: the two fixed inputs per parser, the leading-zero
  decimal guard, and non-regression on every previously-tested format (comma,
  BR thousands+comma, short dot-decimals, garbage → null).
- Pattern: the `eq` helper and `extractFn`+`vm` block style already in the file.
- Verification: `node tools/verify.mjs` → all pass.

## Done criteria

ALL must hold:

- [ ] `node tools/verify.mjs` → `OK: all checks passed.`, exit 0.
- [ ] The 13 Plan-008 assertions exist in `tools/test-pure.mjs` and pass.
- [ ] Both functions contain the group regex. Check:
      `node -e "const h=require('fs').readFileSync('index.html','utf8');const n=(h.match(/\[1-9\]\\\\d\{0,2\}\(\\\\.\\\\d\{3\}\)\+/g)||[]).length;console.log('matches:',n);process.exit(n===2?0:1)"` → `matches: 2`, exit 0.
- [ ] `git status` shows only `index.html` and `tools/test-pure.mjs` modified.
- [ ] `plans/README.md` status row for 008 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `parseMoney` does not match the post-002 shape (Plan 002 not done or drifted).
- `fatParseCusto` does not match its excerpt (drifted — e.g. someone already
  applied a different rule).
- Step 1's failure pattern differs from the expected "exactly the four thousands
  cases fail".
- The maintainer's inputs in practice contradict the decided rule (e.g. they
  report typing `2.500` meaning R$ 2,50) — surface it, don't invent a new rule.

## Maintenance notes

- The rule is documented in `fatParseCusto`'s comment — if it ever changes again,
  change BOTH parsers and their tests together (this plan exists because they
  drifted once).
- Optional follow-up (maintainer's call, per the repo's BP-003 "visible deduction"
  rule): echo the parsed value next to money inputs ("entendi R$ 1.234,00") so an
  ambiguous input is visible before it hits a fiscal file.
- The maintainer may log this in the README bug registry (next free BUG-NNN).
- Reviewer: scrutinize the regex — `[1-9]\d{0,2}(\.\d{3})+` must anchor both ends
  and require ALL groups to be exactly 3 digits.
