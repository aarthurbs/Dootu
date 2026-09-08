# Plan 005: Make the inventory auto-fill reuse the empty seeded group instead of orphaning it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `docs/02-Execution/plans/README.md`.
>
> **Drift check (run first)**: This repo has ONE commit plus uncommitted
> working-tree changes, so `git diff` is not a reliable drift signal. Open
> `index.html`, search for `function fatAddGroupWithSkus`, and confirm the exact
> current text matches the "Current state" excerpt below. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (`docs/02-Execution/plans/001` recommended first so the syntax gate exists, but not required)
- **Category**: bug
- **Planned at**: commit `2fd798d`, 2026-07-02

## Why this matters

This is a 100% client-side vanilla-JS static site (`index.html` opened from disk,
no build, no npm). Its "Planilha de Faturador" tool fills fiscal data into an
Amazon spreadsheet via user-defined SKU groups. On page load, `setupFaturador`
seeds **one empty group**. Since 2026-07-02, entering the Faturador after a new
Amazon-inventory import **auto-creates a group** pre-filled with the SKUs missing
from the spreadsheet (the weekly Tuesday flow). Because the auto-fill calls
`fatAddGroup()` unconditionally, the user lands with: Grupo 1 = empty (orphan),
Grupo 2 = auto-filled. Clicking "Gerar planilha" then fails validation with a
wall of errors for the empty Grupo 1 — and the "remover grupo" button only
removes the **last** group, so the orphan can't even be removed with one click.
This is friction on the primary fiscal flow, every week. The fix: when the last
existing group is completely blank, fill it instead of appending a new one.

## Current state

All code lives in the single bare inline `<script>` of `index.html`
(starts at line 1493). Line numbers below are as of 2026-07-02 — locate by
searching the function name, not by line.

- `index.html:2542-2548` — the function to change, exact current text:
  ```js
  function fatAddGroupWithSkus(skus) {
    fatAddGroup();
    const g = document.getElementById('fat-groups').lastElementChild;
    if (!g) return;
    g.querySelector('.fg-skus').value = skus.join('\n');
    const ncm = g.querySelector('.fg-ncm'); if (ncm) ncm.focus();
  }
  ```
- `index.html:~2852` (inside `setupFaturador`) — the seed that creates the orphan:
  ```js
  if (!document.querySelector('#fat-groups .fat-group')) fatAddGroup();   // inicia com 1 grupo
  ```
- `index.html:2646-2650` — why the orphan is hard to remove (removes only the LAST group):
  ```js
  function fatRemoveGroup() {
    const groups = document.querySelectorAll('#fat-groups .fat-group');
    if (groups.length > 1) { groups[groups.length - 1].remove(); fatRenumberGroups(); }
  }
  ```
- Callers of `fatAddGroupWithSkus` (context only, do NOT modify): the auto-fill in
  `fatRenderInvNotice` (`index.html:~2566`) and the manual button handler
  "Criar grupo com esses SKUs" (`index.html:~2576-2579`). Both benefit from the fix.
- A group card's fields (from `fatGroupHtml`, `index.html:~2610-2625`): textarea
  `.fg-skus`; selects `.fg-regra` and `.fg-origem` (default value `''`); text
  inputs `.fg-ncm`, `.fg-cest`, `.fg-custo`.
- Repo conventions: pt-BR comments, 2-space indent, `const`/arrow style as in the
  excerpt; deliberate simplifications get a `// ponytail:` comment (see the codebase).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Full verification (if Plan 001 done) | `node tools/verify.mjs` | `OK: all checks passed.`, exit 0 |
| Fallback syntax gate (if 001 not done) | `node -e "const h=require('fs').readFileSync('index.html','utf8');const s=[...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];s.forEach(m=>new Function(m[1]));console.log('OK '+s.length+' inline scripts')"` | prints `OK 3 inline scripts`, exit 0 |

Run from the repo root (`C:\Users\Teste\Downloads\Seller-Arthur`).

## Scope

**In scope**:
- `index.html` — the body of `fatAddGroupWithSkus` only.

**Out of scope** (do NOT touch):
- `fatAddGroup`, `fatRemoveGroup`, `fatRenumberGroups`, the seed line in
  `setupFaturador` — the seeded empty group is fine for manual use; only the
  auto-fill path must reuse it.
- `fatRenderInvNotice` / the auto-fill guard logic (`pp_fat_autofill_v1`) — works.
- `fatGroupHtml` and the field classes.

## Git workflow

- Branch: `advisor/005-reuse-empty-group`
- Commit message (terse, matching repo): `fix: auto-fill de SKUs reaproveita grupo vazio em vez de criar orfao`
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Replace `fatAddGroupWithSkus`

Replace the function (exact current text in "Current state") with:

```js
  function fatAddGroupWithSkus(skus) {
    // Reaproveita o último grupo se estiver totalmente vazio (ex.: o grupo
    // semeado no load) — evita um "Grupo 1" órfão que trava a validação do Gerar.
    const list = document.querySelectorAll('#fat-groups .fat-group');
    let g = list.length ? list[list.length - 1] : null;
    const blank = g
      && ['.fg-skus', '.fg-ncm', '.fg-cest', '.fg-custo'].every(sel => { const el = g.querySelector(sel); return !el || !el.value.trim(); })
      && !g.querySelector('.fg-regra').value
      && !g.querySelector('.fg-origem').value;
    if (!blank) { fatAddGroup(); g = document.getElementById('fat-groups').lastElementChild; }
    if (!g) return;
    g.querySelector('.fg-skus').value = skus.join('\n');
    const ncm = g.querySelector('.fg-ncm'); if (ncm) ncm.focus();
  }
```

Semantics: the last group is "blank" only when SKUs/NCM/CEST/Custo are all empty
AND both selects are at their default `''`. Any user-entered content → a new
group is appended (old behavior preserved).

**Verify**: run the syntax gate (table above) → exit 0.

### Step 2: Manual browser test (mandatory — this is DOM behavior a unit test can't cover without npm deps, which the project forbids)

1. Open `index.html` in a browser. In DevTools console run
   `localStorage.removeItem('pp_fat_autofill_v1')` (re-arms the auto-fill for the
   current inventory snapshot).
2. Precondition check: `localStorage.getItem('pp_amazon_inventory_v1')` is non-null
   and `localStorage.getItem('pp_faturador_xlsx_v1')` is non-null (an inventory and
   an active spreadsheet exist). If either is null, import an inventory TXT /
   load a spreadsheet first — or report "cannot reproduce precondition".
3. Navigate to "Planilha de Faturador". **Expected**: exactly ONE group card
   exists, its SKUs textarea is pre-filled with the missing SKUs, focus is on the
   NCM field, and the notice says the SKUs are already in a group below.
   **Before this fix** you would see TWO cards (empty Grupo 1 + filled Grupo 2).
4. Type something into the group, then in the console run
   `localStorage.removeItem('pp_fat_autofill_v1')`, leave and re-enter the view:
   a NEW group must be appended (non-blank groups are never overwritten).

## Test plan

- No automated unit test: the function is pure DOM manipulation and the project
  forbids npm test deps (no jsdom). Coverage = syntax gate + the manual test above
  + the structural done-check below.
- If Plan 001's harness exists, `node tools/verify.mjs` must stay green.

## Done criteria

ALL must hold:

- [ ] Syntax gate passes (`node tools/verify.mjs` if present, else the fallback one-liner) — exit 0.
- [ ] `fatAddGroupWithSkus` contains the blank-check. Check:
      `node -e "const h=require('fs').readFileSync('index.html','utf8');const i=h.indexOf('function fatAddGroupWithSkus');process.exit(h.slice(i,i+900).includes('.every(')?0:1)"` → exit 0.
- [ ] Manual test Step 2.3 shows exactly one pre-filled group (record this in your report).
- [ ] `git status` shows only `index.html` modified.
- [ ] `docs/02-Execution/plans/README.md` status row for 005 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The current `fatAddGroupWithSkus` text doesn't match the excerpt (drift).
- The group card no longer has the field classes listed in "Current state"
  (`.fg-skus`, `.fg-regra`, `.fg-origem`, `.fg-ncm`, `.fg-cest`, `.fg-custo`).
- The manual test still shows two groups after the fix — the auto-fill call path
  may have moved; report what you observe, do not patch other functions.

## Maintenance notes

- If a future change adds fields to the group card, the `blank` check must
  include them (or the reuse may overwrite user input — review carefully).
- If the maintainer ever wants "remover grupo" to remove a *selected* group
  instead of the last one, that's a separate small feature; this plan
  deliberately doesn't touch it.
- Reviewer: confirm the manual-button path ("Criar grupo com esses SKUs") still
  works — it shares this function.
