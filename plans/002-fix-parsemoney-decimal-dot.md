# Plan 002: Fix `parseMoney` decimal-dot bug in the pricing tool

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: Open `index.html` and confirm the exact current
> text of `parseMoney` (lines ~3388-3392 as of 2026-07-02) matches the "Current state" excerpt
> below. This repo has uncommitted working-tree changes, so `git diff` is not a
> reliable drift signal — compare against the LIVE file. On any mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: `plans/001-verification-baseline.md` (uses `node tools/verify.mjs` and appends to `tools/test-pure.mjs`)
- **Category**: bug
- **Planned at**: commit `2fd798d`, 2026-07-01

## Why this matters

`parseMoney` is the input parser for the entire Precificação (pricing) tool — the
`custo`, `venda`, `rebate`, and `pdvAlvo` fields all flow through it
(`index.html:3522,3538,3550,3566,3578-3580`). It currently deletes **every** `.`
as if it were a thousands separator before swapping the comma for a decimal point.
So a user who types or pastes a dot-decimal number — extremely common when copying
from spreadsheets, US-formatted sources, or just habit — gets a value 10×–100×
too large, silently:

- `parseMoney("2.5")` → `25`
- `parseMoney("54.80")` → `5480`

The calculator then shows a confidently wrong margin with no error. This is the
highest-severity correctness bug found: the failure is invisible and the trigger
is an ordinary input format. The project already ships a **correct** sibling
parser, `fatParseCusto` (`index.html:2315-2320`), which only strips dots as
thousands separators *when a comma is also present*. This plan aligns `parseMoney`
to that same, already-accepted rule.

## Current state

- `index.html:3388-3392` — the buggy function, exact current text:
  ```js
  function parseMoney(str) {
    if (typeof str === 'number') return str;
    str = String(str||'0').replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.');
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  }
  ```
- `index.html:2315-2320` — the **correct pattern to mirror** (do NOT edit this
  one; it's the exemplar):
  ```js
  function fatParseCusto(raw) {
    let s = raw.replace(/\s/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isNaN(n) ? null : n;
  }
  ```
  The load-bearing idea: **only** treat `.` as a thousands separator when a `,` is
  present (Brazilian format `1.234,56`). With no comma, a `.` is a decimal point.
- Callers (context only — do not modify): `index.html:3522, 3538, 3550, 3566,
  3578, 3579, 3580`, all reading pricing input fields.

### Known, accepted trade-off (state it, don't try to solve it)

After the fix, a bare `"1.234"` (no comma, dot as thousands, no decimals) parses to
`1.234`, not `1234`. This ambiguity is **unavoidable** without a comma and is
exactly how the shipped `fatParseCusto` already behaves (its own comment documents
`"82.9" → 82.9`). Do not add heuristics to guess thousands-vs-decimal; matching
`fatParseCusto` is the intended, consistent behavior. If the maintainer later wants
a different rule, that's a separate decision.

> **Update 2026-07-02**: the maintainer DID decide on a smarter rule —
> `plans/008-unified-decimal-dot-rule.md` upgrades **both** parsers (this one and
> `fatParseCusto`) to treat dot-separated 3-digit groups (`1.234`) as thousands,
> AFTER this plan lands. Execute this plan exactly as written anyway (it is the
> stepping stone and its tests remain valid); do NOT implement plan 008's rule here.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Full verification | `node tools/verify.mjs` | `OK: all checks passed.`, exit 0 |
| Pure tests only | `node tools/test-pure.mjs` | all `✓`, exit 0 |

Run from repo root. If `tools/verify.mjs` does not exist, STOP — Plan 001 must be
done first.

## Scope

**In scope**:
- `index.html` — the `parseMoney` function body only (lines ~3388-3392).
- `tools/test-pure.mjs` — append regression assertions.

**Out of scope** (do NOT touch):
- `fatParseCusto` (`index.html:2315`) — it's already correct and is the exemplar
  (plan 008 changes it later; not here).
- `brl`/`pct` (`index.html:3394-3395`) — that's Plan 003.
- Any pricing caller or the `Calc5` math — the fix is confined to the parser.
- The `typeof str === 'number'` early return and the `R$`/whitespace stripping —
  keep them; only the dot/comma handling changes.

## Git workflow

- Branch: `advisor/002-fix-parsemoney`
- Commit message style (terse, matching repo): `fix: parseMoney treats lone dot as decimal, not thousands`
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Add the regression test FIRST (it should fail against current code)

In `tools/test-pure.mjs`, find the line:

```js
  // (Plan 002 appends dot-decimal regression cases below this line.)
```

Immediately **below** it, add:

```js
  eq('parseMoney("2.5") === 2.5 (dot decimal)', ctx.parseMoney('2.5'), 2.5);
  eq('parseMoney("54.80") === 54.8 (dot decimal)', ctx.parseMoney('54.80'), 54.8);
  eq('parseMoney("2,5") === 2.5 (comma still works)', ctx.parseMoney('2,5'), 2.5);
  eq('parseMoney("1.234,56") === 1234.56 (BR thousands unchanged)', ctx.parseMoney('1.234,56'), 1234.56);
```

**Verify (expect FAILURE now)**: `node tools/test-pure.mjs` → the two "dot
decimal" assertions FAIL (got `25` / `5480`). This confirms the test reproduces
the bug. If they unexpectedly pass, STOP — the code may already be fixed or drifted.

### Step 2: Fix `parseMoney`

Replace the body of `parseMoney` (`index.html:3388-3392`) so the dot is only
stripped when a comma is present. Target result:

```js
function parseMoney(str) {
  if (typeof str === 'number') return str;
  let s = String(str||'0').replace(/[R$\s]/g,'');
  if (s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
```

Only the middle handling changed (mirroring `fatParseCusto`); the number
early-return, currency/space stripping, and `isNaN → 0` fallback are preserved.

**Verify**: `node tools/test-pure.mjs` → all `✓` including the four new cases.

### Step 3: Full gate

**Verify**: `node tools/verify.mjs` → `OK: all checks passed.`, exit 0 (syntax +
structure + all pure tests).

## Test plan

- New assertions (added in Step 1) in `tools/test-pure.mjs` cover:
  - the bug being fixed: `"2.5" → 2.5`, `"54.80" → 54.8`;
  - no regression on the comma format: `"2,5" → 2.5`;
  - no regression on BR thousands: `"1.234,56" → 1234.56`;
  - (existing cases from Plan 001 still cover `"54,80"`, `""`, numeric input).
- No existing test to model after beyond the `eq(...)` helper already in the file.
- Verification: `node tools/verify.mjs` → all pass, including the 4 new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node tools/verify.mjs` → `OK: all checks passed.`, exit 0.
- [ ] The four new `parseMoney` dot/comma assertions are present in
      `tools/test-pure.mjs` and pass.
- [ ] `index.html` `parseMoney` now contains `if (s.includes(','))` and no longer
      unconditionally calls `.replace(/\./g,'')`. Check:
      `node -e "const h=require('fs').readFileSync('index.html','utf8');const m=h.slice(h.indexOf('function parseMoney'),h.indexOf('function parseMoney')+260);process.exit(m.includes(\"includes(',')\")?0:1)"` → exit 0.
- [ ] `fatParseCusto` is unchanged (still present at its location).
- [ ] `git status` shows only `index.html` and `tools/test-pure.mjs` modified.
- [ ] `plans/README.md` status row for 002 updated to DONE.

## STOP conditions

Stop and report back (do not improvise) if:

- The current `parseMoney` text does not match the "Current state" excerpt (drift).
- The Step-1 assertions unexpectedly pass against unmodified code.
- `node tools/verify.mjs` fails after the change for a reason other than a test you
  just edited (e.g. the structure check breaks — you may have edited the wrong region).
- Making the change appears to require editing anything outside `parseMoney` — it
  does not; if it seems to, you're in the wrong spot.

## Maintenance notes

- The `"1.234" → 1.234` ambiguity is intentional and matches `fatParseCusto`. If a
  future ticket wants a smarter thousands/decimal heuristic, it should change both
  `parseMoney` and `fatParseCusto` together to keep them consistent, and add tests
  for the new rule.
- This bug is worth a line in the README "Registro de bugs" section (the project
  logs every bug found/fixed, per its convention) — the maintainer may want to add
  an entry with symptom/cause/fix/prevention (BUG-005 and BUG-006 are already taken
  as of 2026-07-02; use the next free number). That doc edit is optional and
  outside this plan's automated scope; mention it in your report.
- Reviewer should confirm the comma-format and BR-thousands paths are unchanged
  (regression risk is entirely on those two formats).
