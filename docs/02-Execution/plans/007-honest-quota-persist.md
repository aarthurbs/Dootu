# Plan 007: Make quota-failure of the persisted Faturador spreadsheet honest (drop stale copy, tell the truth)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `docs/02-Execution/plans/README.md`.
>
> **Drift check (run first)**: This repo has ONE commit plus uncommitted
> working-tree changes, so `git diff` is not a reliable drift signal. Open
> `index.html`, search `function fatPersist`, and confirm the exact current text
> matches the "Current state" excerpt. On mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `docs/02-Execution/plans/001-verification-baseline.md` for the automated test; the
  code change itself has no dependency.
- **Category**: bug
- **Planned at**: commit `2fd798d`, 2026-07-02

## Why this matters

This client-side vanilla-JS app (`index.html`, no build/npm) keeps the Faturador's
Amazon spreadsheet "always active" by storing the whole XLSX as **base64 in
`localStorage`** (key `pp_faturador_xlsx_v1`; base64 inflates the file ~33%, and
the origin also holds a ~387KB inventory snapshot — quota is reachable for
multi-MB sheets). After each "Gerar planilha", the new bytes are re-persisted.
When that write throws `QuotaExceededError`, today's catch shows an alert saying
the sheet "vale só nesta sessão" — but the **previous, older base64 stays in
storage**, so on the next session `fatRestoreBytes` silently restores a **stale
spreadsheet**. The user believes they're working on the version that includes the
fiscal rows they just generated; they aren't, and nothing tells them. The fix:
on quota failure, remove the stored copy entirely (no stale restore possible) and
make the alert say exactly what happened and what to do (they still have the
downloaded file).

## Current state

All code lives in the single bare inline `<script>` of `index.html` (starts line
1493). Line refs as of 2026-07-02 — locate by searching names.

- `index.html:2497-2503` — the function to change (refs refreshed 2026-07-03), exact current text:
  ```js
  function fatPersist() {
    if (!FAT.fileBuffer) return;
    try {
      FAT.savedAt = new Date().toISOString();
      localStorage.setItem(FAT_XLSX_KEY, JSON.stringify({ name: FAT.fileName || 'planilha.xlsx', savedAt: FAT.savedAt, b64: fatAbToB64(FAT.fileBuffer) }));
    } catch (e) { alert('⚠️ Não foi possível manter a planilha ativa (armazenamento cheio). Ela vale só nesta sessão.'); }
  }
  ```
- `index.html:2504-2510` — the restore that makes staleness dangerous (context,
  do NOT modify): `fatRestoreBytes` reads `pp_faturador_xlsx_v1` on startup and
  silently adopts whatever is there.
- Callers of `fatPersist` (context, do NOT modify): `fatLoadFile` (after a
  successful file load) and `fatWriteGroupedRecords` (after a successful "Gerar",
  inside a try that also refreshes `FAT.fileBuffer`). Both are followed by
  `fatRenderActive()` in their flows, so no extra re-render call is needed here.
- Constant: `FAT_XLSX_KEY = 'pp_faturador_xlsx_v1'` (`index.html:2479`).
- Repo conventions: pt-BR user-facing strings; guarded nested try like
  `try { localStorage.removeItem(...) } catch (e2) {}` is the established pattern
  (see `fatRestoreBytes`'s catch).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Full verification | `node tools/verify.mjs` | `OK: all checks passed.`, exit 0 |
| Pure tests only | `node tools/test-pure.mjs` | all `✓`, exit 0 |
| Fallback syntax gate (if 001 not done) | `node -e "const h=require('fs').readFileSync('index.html','utf8');const s=[...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];s.forEach(m=>new Function(m[1]));console.log('OK '+s.length+' inline scripts')"` | `OK 3 inline scripts`, exit 0 |

Run from repo root.

## Scope

**In scope**:
- `index.html` — the `catch` block of `fatPersist` only.
- `tools/test-pure.mjs` — append one VM-based test (only if Plan 001 is done).

**Out of scope** (do NOT touch):
- `fatRestoreBytes`, `fatAbToB64`/`fatB64ToAb`, `fatDownloadActive`,
  `fatRenderActive`, both callers.
- Migrating storage to IndexedDB — a known, deliberately deferred follow-up
  (see the existing `// ponytail:` comment near `FAT_XLSX_KEY`); do not start it.

## Git workflow

- Branch: `advisor/007-honest-quota-persist`
- Commit message (terse): `fix: cota cheia derruba copia persistida da planilha em vez de deixar versao velha`
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Replace the `catch` of `fatPersist`

Replace the single-line catch (see excerpt) with:

```js
    } catch (e) {
      // Cota cheia: derruba a cópia salva — manter a versão ANTIGA restauraria
      // silenciosamente dados fiscais desatualizados na próxima sessão.
      try { localStorage.removeItem(FAT_XLSX_KEY); } catch (e2) {}
      FAT.savedAt = '';
      alert('⚠️ Armazenamento cheio: a planilha NÃO ficou salva no navegador (nem esta versão, nem a anterior). Ela vale só nesta sessão — baixe o arquivo gerado e carregue-o de novo na próxima vez.');
    }
```

Everything before the catch (the `try` body) stays byte-identical.

**Verify**: syntax gate (table above) → exit 0.

### Step 2 (only if `tools/verify.mjs` exists): add the regression test

In `tools/test-pure.mjs`, after the existing assertion blocks, add:

```js
  // Plan 007: fatPersist quota failure must remove the stored copy and alert.
  {
    const removed = [];
    let alerts = 0;
    const c = {
      FAT: { fileBuffer: { byteLength: 8 }, fileName: 'x.xlsx', savedAt: '' },
      FAT_XLSX_KEY: 'pp_faturador_xlsx_v1',
      fatAbToB64: () => 'QUFB',
      localStorage: { setItem() { throw new Error('QuotaExceeded'); }, removeItem(k) { removed.push(k); } },
      alert() { alerts++; },
      JSON,
    };
    vm.createContext(c);
    vm.runInContext(extractFn(html, 'fatPersist'), c);
    let threw = false;
    try { c.fatPersist(); } catch (e) { threw = true; }
    truthy('fatPersist swallows quota error (no throw)', !threw);
    eq('fatPersist removes the stored copy on quota', removed, ['pp_faturador_xlsx_v1']);
    truthy('fatPersist alerts the user on quota', alerts === 1);
    truthy('fatPersist clears savedAt on quota', c.FAT.savedAt === '');
  }
```

(`eq`, `truthy`, `extractFn`, `vm`, `html` exist in the file from Plan 001. The
VM context gets its own intrinsics — `Date` inside the extracted function works.)

**Verify**: `node tools/test-pure.mjs` → all `✓`, including the four new cases.

### Step 3: Full gate

**Verify**: `node tools/verify.mjs` → `OK: all checks passed.`, exit 0 (skip if
Plan 001 not done; then rely on the fallback syntax gate and note it).

## Test plan

- The Step-2 VM test covers: no-throw, `removeItem` called with the exact key,
  exactly one alert, `savedAt` cleared. Pattern to follow: Plan 003's `save()`
  quota test in the same file (same extractFn+vm shape).
- Manual reproduction of a real quota failure is impractical to script; the VM
  test plus unchanged happy-path behavior (load a sheet → "Planilha ativa" box
  shows with date) is the coverage.

## Done criteria

ALL must hold:

- [ ] Syntax gate passes; `node tools/verify.mjs` green if Plan 001 exists.
- [ ] `fatPersist`'s catch contains `removeItem(FAT_XLSX_KEY)`. Check:
      `node -e "const h=require('fs').readFileSync('index.html','utf8');const i=h.indexOf('function fatPersist');process.exit(h.slice(i,i+800).includes('removeItem(FAT_XLSX_KEY)')?0:1)"` → exit 0.
- [ ] The four Plan-007 assertions exist and pass (if Plan 001 done).
- [ ] `git status` shows only `index.html` (and `tools/test-pure.mjs`) modified.
- [ ] `docs/02-Execution/plans/README.md` status row for 007 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The current `fatPersist` doesn't match the excerpt (drift).
- `extractFn` can't find `fatPersist` (renamed/moved).
- You are tempted to change `fatRestoreBytes` or start an IndexedDB migration —
  both are explicitly out of scope.

## Maintenance notes

- The real fix for the size ceiling is IndexedDB (stores the Blob raw, no ~33%
  base64 inflation) — already noted in the code as a deferred `// ponytail:`
  decision. This plan only makes the failure mode honest; if sheets keep growing,
  do the IndexedDB migration as its own plan.
- If a toast/status component ever replaces `alert()` in this codebase (see Plan
  003's same note for `save`/`saveProjects`), migrate this alert too — the
  behavior (drop copy + notify) must stay.
- Reviewer: confirm the happy path is untouched (persist still writes the same
  JSON shape — `name`, `savedAt`, `b64`).
