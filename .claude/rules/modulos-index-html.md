# Módulos ATIVOS do `index.html` (regras ATIVAS)

Todos estes módulos estão **VIVOS e load-bearing**: não tratar como código morto (BP-007).

Em 2026-09-08 saíram daqui, por decisão do usuário, os módulos **Prompts salvos**, **Planilha de
Faturador**, **Radar** (3 feeds) e **Fluxos** — junto com a área de trabalho de prompts que era a
home do site, a sidebar de Projects/Categories/Tags, o `#search` do header, o botão `+ New Prompt`,
os modais de prompt/confirmação e todo o CSS exclusivo deles. A lista de tokens que saíram está no
`CLAUDE.md`, em "Módulos REMOVIDOS". **Não recriar nem referenciar.**

- **Central (home) + categorias no header — IMPLEMENTADO (decisão do usuário, 2026-07-24):**
  (1) **Barra segmentada no header** `.world-seg` (`data-world="central|prog"`) — filtra os
  `.nav-item[data-group]` da sidebar E os `.hub-block` da Central por mundo. O mundo
  `amazon` saiu em 2026-09-08 junto com o Faturador, que era sua única ferramenta.
  (2) **Tela Central** = home do site: `data-view="central"` / `#view-central`, com os
  `.hub-card[data-view]` que abrem cada ferramenta. Grupo *prog* = **empreendedor** +
  **video-ops**. JS no script inline curto do `index.html`: `VIEW_GROUP` (mundo de cada view),
  `VIEWS` (as três telas que existem), `setWorld()` e `activateView()`; o INIT abre em
  `activateView('central')` + `setWorld('central')`. `activateView` ignora view desconhecida.
  CSS `.hub-*`/`.world-seg*` inline. Sem lib, sem IA.

- **Painel do Empreendedor — controle de processos do negócio, ATIVO (decisão do usuário, 2026-07-31):**
  aba `data-view="empreendedor"` / seção `#view-empreendedor`, mount `#emp-root`, renderer
  `empreendedor.js` (Vanilla JS estático, `localStorage` `pp_empreendedor_v1` — sem IA, sem backend).
  Semeado com **6 trilhos** (processos): Identidade da marca, Radar de mercado, Laboratório de
  conteúdo, Rede de perfis (satélites), Funil de clientes e Lucro real. Cada trilho tem **etapas
  (checklist)**; o `status` (a fazer / fazendo / feito) e o `progresso %` são **derivados** das
  etapas (guarda-zero, BP-004). Cabeçalho **"Meta 90 dias"** (dias decorridos/restantes + contador
  Clientes 0/10) e um `log` (histórico) curto por trilho. Adicionar/editar/remover trilho e etapa
  via `prompt()` + botões explícitos ✎/✕ (nunca dblclick — BP-001). CSS `.emp-*` inline no
  `index.html`. Checks: `node --check empreendedor.js` + `node test-empreendedor.js`.
  - O trilho "Radar de mercado" é **conteúdo semeado** do painel (um processo do negócio), não tem
    relação com o módulo Radar removido — não apagar.

- **Estúdio de Vídeos** — aba `data-view="video-ops"` / `#view-video-ops`, mount `#video-ops-root`.
  Regras próprias em `.claude/rules/estudio-ui.md` (e as demais `estudio-*`).

- **`#toast`** — o `<div id="toast">` e seu CSS **ficam**: `supabase-client.js` escreve nele
  (`document.getElementById('toast')`). A função `showToast()` do script inline saiu com os Prompts.

- **Aparência — PREFERÊNCIA visual, três presets (2026-09-09):** `appearance.js` (síncrono no
  `<head>`, antes do primeiro paint) põe `<html data-appearance>`; chave própria
  `pp_appearance_v1`; presets `preto-gelo` (padrão aprovado) · `grafite` · `claro`. Blocos de
  token no **fim** do `design-system.css`; o controle é o `<select id="appearance-select">` do
  header (`.appearance`), na 4ª coluna do header em grade. Checks: `node test-appearance.js`.
  - **`data-appearance` ≠ `data-theme`.** `data-theme` é do `score-bar.js` e só troca as
    IMAGENS/cores do placar (identidade do time = conteúdo). A interface é Black + Ice sempre —
    por isso o bloco `html[data-theme="brasil"]` **não** redeclara token de interface.
  - **Trocar de aparência não remonta nada**: só reescreve o atributo do `<html>`. Medido com
    vídeo tocando — mesmo nó `<video>`, `currentTime` seguiu correndo, campo em edição, foco,
    cursor e `#main.scrollTop` intactos. Qualquer implementação que re-renderize quebra isso.
  - Valor inválido/ausente e storage que **lança** caem no padrão, calados (é código de `<head>`:
    se lançar, a página morre antes de montar — mesma família do BP-014).
