# Plan 004: Add a strict Content-Security-Policy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. The
> **manual browser test is mandatory** for this plan — a wrong CSP silently breaks
> the app. If anything in "STOP conditions" occurs, stop and report. When done,
> update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: Open `index.html` lines 1-11 and confirm the
> `<head>` still contains the `<meta charset>`, `<meta name="viewport">`, and the
> Google Fonts `<link>` shown in "Current state". Confirm there is **no** existing
> `Content-Security-Policy` meta. This repo has uncommitted working-tree changes,
> so compare against the LIVE file, not git. On mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (a too-tight policy breaks the inline script or fonts; caught by the mandatory manual test)
- **Depends on**: none (Plan 001 recommended first so syntax regressions are caught, but not required)
- **Category**: security
- **Planned at**: commit `2fd798d`, 2026-07-01

## Why this matters

This app's entire risk model is "untrusted text (ESPN API responses, imported
Amazon TXT, user input) reaches `innerHTML`." The code escapes consistently
today (verified — `esc()` is used at every sink; and `period-intro.js` color
values pass a strict hex whitelist), so there is no open XSS. But there is **no
Content-Security-Policy at all**, which means the day any single escape is missed,
an injection runs with full origin privileges and can read/exfiltrate everything
in `localStorage` (prompts, SKUs, the inventory snapshot). A CSP is the
defense-in-depth that contains that failure. The external surface is tiny and
known — two hosts (Google Fonts, the ESPN scoreboard API) — which makes a tight
policy easy to write.

### What this CSP does and does NOT do (be honest in your report)

The app relies on a large inline `<script>`, two more inline script blocks, ~26
inline event handlers (`onclick`/`oninput`/`onchange`), and ~21 inline `style=`
attributes. Refactoring all of those to nonces/hashes is a large, risky change
that is **out of scope**. So this policy keeps `'unsafe-inline'` for scripts and
styles. Consequences:

- **Does NOT** block an injected inline event handler from executing (that needs
  the inline-script refactor). So this is not full XSS prevention.
- **DOES** block the exfiltration channel: `connect-src` restricts `fetch`/XHR to
  `self` + the ESPN API, so an injected script cannot POST `localStorage` to an
  attacker host. This is the single most valuable directive here.
- **DOES** block loading external `<script src=evil>`, plugins/`<object>`, and
  `<base>` hijacking, and constrains image/style/font origins.

Frame it as meaningful containment, not a silver bullet.

Note: `frame-ancestors` and `sandbox` are **ignored** in a `<meta>` CSP (they only
work as real HTTP headers). This plan uses a `<meta>` CSP because the app is served
as static files with no server to set headers. When the app eventually gets a host
with header control, migrate this policy to an HTTP header and add `frame-ancestors
'none'`.

## Current state

`index.html` `<head>`, lines 4-10, exact current text:
```html
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prompt Platform</title>
  <link rel="icon" type="image/png" href="assets/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Saira+Condensed:wght@500;600;700;800;900&display=swap" rel="stylesheet">
```
- The only external hosts loaded: `fonts.googleapis.com` (CSS), `fonts.gstatic.com`
  (font files).
- The only network fetch in JS: `https://site.api.espn.com/...` in `score-bar.js`.
- ESPN team logos load as `<img>` from ESPN CDNs (hosts vary, e.g. `a.espncdn.com`)
  as a fallback — so `img-src` must allow remote https images.
- No CSP meta currently exists (confirm with the drift check).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Confirm CSP present | `node -e "process.exit(require('fs').readFileSync('index.html','utf8').includes('Content-Security-Policy')?0:1)"` | exit 0 |
| Full verification (if Plan 001 done) | `node tools/verify.mjs` | `OK: all checks passed.`, exit 0 |

## Scope

**In scope**:
- `index.html` — add one `<meta http-equiv="Content-Security-Policy">` line in the
  `<head>`.
- `tools/verify.mjs` — (only if it exists from Plan 001) add one structure anchor so
  the CSP can't be silently dropped later.

**Out of scope** (do NOT touch):
- Any inline `<script>`, inline event handler, or inline `style=` — do NOT refactor
  them to nonces/hashes. Keeping `'unsafe-inline'` is a deliberate decision.
- Self-hosting fonts, adding SRI, or removing the Google Fonts `<link>` — separate,
  optional follow-ups (finding F12/SEC-03), not part of this plan.
- The `score-bar.js` fetch URLs and any ESPN logic.

## Git workflow

- Branch: `advisor/004-add-csp`
- Commit message style (terse): `add Content-Security-Policy meta (self + fonts + ESPN allowlist)`
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Add the CSP meta tag

Insert this line immediately **after** the `<meta name="viewport" ...>` line
(currently line 5), before `<title>`:

```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://site.api.espn.com; object-src 'none'; base-uri 'self'">
```

Rationale per directive:
- `default-src 'self'` — deny by default.
- `script-src 'self' 'unsafe-inline'` — required by the inline scripts/handlers (see
  the honesty note above); blocks external script hosts.
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — inline `style=`
  attributes + the Google Fonts stylesheet.
- `font-src https://fonts.gstatic.com` — the font files.
- `img-src 'self' data: https:` — local assets, data-URI images, and remote ESPN
  logos (whose host varies). `https:` is intentionally broad for images (not a
  script vector); tighten to specific ESPN hosts only if you can enumerate them.
- `connect-src 'self' https://site.api.espn.com` — the containment win: only the
  ESPN scoreboard endpoint is reachable by fetch.
- `object-src 'none'`, `base-uri 'self'` — kill plugin embeds and `<base>` hijack.

**Verify**: `node -e "process.exit(require('fs').readFileSync('index.html','utf8').includes('Content-Security-Policy')?0:1)"` → exit 0.

### Step 2 (only if `tools/verify.mjs` exists): make CSP a permanent gate

In `tools/verify.mjs`, find the structure-check anchors array (the `for (const a of [ ... ]` list) and add one entry:

```js
  'Content-Security-Policy',
```

**Verify**: `node tools/verify.mjs` → still `OK: all checks passed.`, exit 0 (the
new anchor is now present, so it passes).

If Plan 001 is not done yet, skip this step and note it.

### Step 3: Mandatory manual browser test

Open `index.html` in a browser with DevTools **Console** open. The console must
show **no** `Content Security Policy` violation errors. Walk every surface:

1. **Fonts**: text renders in Inter/Saira (not a fallback system font). A blocked
   font shows a `style-src`/`font-src` violation.
2. **Prompts**: create, edit, favorite, delete a prompt; switch projects/filters.
3. **Faturador (Planilha)**: switch modes; upload a `.xlsx` and process it (this
   also confirms the lazy `xlsx-populate.min.js` — a same-origin script — still
   loads under `script-src 'self'`).
4. **Precificação (Multi-plataforma)**: enter cost/venda values; confirm cards
   compute and render.
5. **Inventário Amazon**: import a `.txt`; confirm the table renders and search works.
6. **Score bar / theme**: confirm `#match-score` populates (or degrades to "sem jogo
   ao vivo") — this confirms `connect-src` allows the ESPN fetch and `img-src`
   allows ESPN logos. If you see a `connect-src` violation on `site.api.espn.com`,
   the directive is wrong.

If ALL surfaces work and the console is free of CSP violations, the policy is
correct.

## Test plan

- Automated coverage is limited to "CSP present" + "syntax/structure unbroken"
  (`node tools/verify.mjs`). CSP correctness is inherently a runtime-browser
  property, so the **manual test in Step 3 is the real gate** — do not mark this
  plan done without it.
- No unit tests apply (this is an HTML head change).

## Done criteria

ALL must hold:

- [ ] The CSP meta line is present in `index.html` `<head>` (Step-1 check exits 0).
- [ ] `node tools/verify.mjs` → `OK: all checks passed.` (if Plan 001 exists;
      includes the new `Content-Security-Policy` anchor from Step 2).
- [ ] Manual browser test (Step 3): every surface works and the DevTools console
      shows zero CSP violation errors. Record in your report which surfaces you
      exercised.
- [ ] `git status` shows only `index.html` (and `tools/verify.mjs` if Step 2 done)
      modified — no inline script/style refactor.
- [ ] `plans/README.md` status row for 004 updated to DONE.

## STOP conditions

Stop and report back (do not improvise) if:

- The `<head>` doesn't match the "Current state" excerpt, or a CSP meta already
  exists (drift).
- The manual test shows a CSP violation you cannot resolve by adjusting **only**
  the specific offending directive's allowlist (e.g. an unexpected third-party host
  appears). Report the exact violation string from the console — do NOT "fix" it by
  weakening to `default-src *` or removing the CSP.
- Making it work seems to require converting inline scripts/handlers to nonces —
  that's explicitly out of scope; report back so the maintainer can decide.
- Any app feature breaks and stays broken after the CSP is added — report which
  surface and the console error.

## Maintenance notes

- Every future feature that adds a **new external host** (a new API, a CDN, an
  analytics endpoint, remote images from a new domain) must add that host to the
  matching directive here, or it will be silently blocked. This is the intended
  trade-off; document new hosts in the commit.
- `frame-ancestors`/`sandbox` are absent because `<meta>` CSP ignores them. If the
  app is ever served from a real host, move this policy to an HTTP response header
  and add `frame-ancestors 'none'`.
- The strongest hardening follow-up (separate plan) is to eliminate `'unsafe-inline'`
  from `script-src` by extracting the inline scripts and converting the ~26 inline
  handlers to `addEventListener` — only worth it after the verification baseline
  (Plan 001) exists, given the risk.
- Optional adjacent cleanups tracked as findings F12 (pin/verify `xlsx-populate`)
  and SEC-03 (self-host fonts, which would also let you drop
  `https://fonts.*` from the CSP).
- Reviewer should scrutinize that no inline handler/style was altered and that the
  manual-test surfaces were actually exercised (not just "looks fine").
