# Módulos ATIVOS do `index.html` (regras ATIVAS)

Todos estes módulos estão **VIVOS e load-bearing**: não tratar como código morto (BP-007).

Em 2026-09-08 saíram daqui, por decisão do usuário, os módulos **Prompts salvos**, **Planilha de
Faturador**, **Radar** (3 feeds) e **Fluxos** — junto com a área de trabalho de prompts que era a
home do site, a sidebar de Projects/Categories/Tags, o `#search` do header, o botão `+ New Prompt`,
os modais de prompt/confirmação e todo o CSS exclusivo deles. A lista de tokens que saíram está no
`CLAUDE.md`, em "Módulos REMOVIDOS". **Não recriar nem referenciar.**

- **Central (home) e Painel do Empreendedor — REMOVIDOS em 2026-10-13 (decisão do usuário,
  "quero o que só tenha o estúdio").** O `index.html` só tem a tela do Estúdio: a sidebar ficou
  com `Clips`, o script inline ficou com `VIEWS = ['video-ops']` + `activateView()` (sem
  `VIEW_GROUP`/`setWorld`), e o INIT abre em `activateView('video-ops')`. Tokens que saíram: no
  `CLAUDE.md`, "Módulos REMOVIDOS". **Ficaram de propósito:** `.hub-grid`/`.hub-card*` (o
  `#estudio-local` do site publicado é um `.hub-card`) e os blocos `.world-seg*` órfãos no
  `design-system.css`.

- **Estúdio de Vídeos** — aba `data-view="video-ops"` / `#view-video-ops`, mount `#video-ops-root`.
  Regras próprias em `.claude/rules/estudio-ui.md` (e as demais `estudio-*`).

- **`#toast`** — o `<div id="toast">` e seu CSS **ficam**: `supabase-client.js` escreve nele
  (`document.getElementById('toast')`). A função `showToast()` do script inline saiu com os Prompts.

- **Aparência — PREFERÊNCIA visual, três presets (2026-09-09):** `appearance.js` (síncrono no
  `<head>`, antes do primeiro paint) põe `<html data-appearance>`; chave própria
  `pp_appearance_v1`; presets `preto-gelo` (padrão aprovado) · `grafite` · `claro`. Blocos de
  token no **fim** do `design-system.css`; o controle é o `<select id="appearance-select">` do
  header (`.appearance`), na 4ª coluna do header em grade. Checks: `node test-appearance.js`.
  - **`data-theme` saiu com o placar (2026-10-11).** Ninguém mais o escreve; o
    `test-appearance.js` ainda o usa só como atributo ALHEIO, para provar que a aparência não
    apaga o que não é dela.
  - **Trocar de aparência não remonta nada**: só reescreve o atributo do `<html>`. Medido com
    vídeo tocando — mesmo nó `<video>`, `currentTime` seguiu correndo, campo em edição, foco,
    cursor e `#main.scrollTop` intactos. Qualquer implementação que re-renderize quebra isso.
  - Valor inválido/ausente e storage que **lança** caem no padrão, calados (é código de `<head>`:
    se lançar, a página morre antes de montar — mesma família do BP-014).
