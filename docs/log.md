# log — histórico cronológico

Mais recente no topo. Uma linha por mudança que outra pessoa (ou outro agente)
precisaria saber. Formato: `AAAA-MM-DD — camada — o que mudou e por quê`.

Não registrar: trivialidade, log de execução, histórico de conversa, lista de
arquivos alterados. Se ninguém vai reler, não entra.

---

- **2026-09-08 — migração** — 23 arquivos movidos para dentro das camadas com
  `git mv` (conteúdo não editado no movimento). Referências em **forma de
  caminho** corrigidas em `CLAUDE.md`, nos 5 `.claude/rules/*`, em
  `web/legal.html`, `CONTINUAR_PROJETO.md`, `PASSO-A-PASSO.md` e nas
  auto-referências de `plans/`. Menção a nome nu de arquivo em prosa **não** foi
  tocada — o nome não mudou, só a pasta.
- **2026-09-08 — migração** — **Ficaram fora das camadas por acoplamento de
  código**, não por esquecimento: `docs/night-reports/` (o `night-agent.ps1`
  escreve lá, linha 30) e `docs/video-ops/` (`video-worker/{worker,ytclip,make_fixtures}.py`
  citam o contrato, e `.claude/{agents,commands}/video-growth-loop.md` mandam
  gravar no `PROGRESSO.md`). Vale a mesma regra que mantém `.claude/rules/` fora
  da KB: **doc que um programa lê fica junto do programa.** Mover exigiria editar
  `.ps1`, `.py` e config de agente.
- **2026-09-08 — migração** — Caminhos internos de `01-Wiki/archive/HISTORICO-*`
  **não** foram reescritos: são registro datado do que aconteceu, não ponteiro
  vivo. Custo aceito e conhecido: alguns citam o local antigo. Nenhum é link
  markdown, então o LINT de links não acusa.
- **2026-09-08 — base** — Base de conhecimento estruturada em quatro camadas
  (`00-Sources` / `01-Wiki` / `02-Execution` / `03-Decisions`), com o contrato de
  escrita de cada uma no `README.md` da própria pasta. Motivo: o projeto já tinha
  as quatro camadas de fato — espalhadas por `docs/`, `plans/` e a raiz — mas sem
  nome, sem regra de qual vence e sem índice (o `INDEX.md` anterior cobria 4 de
  83 arquivos e ainda se chamava "Extensão Clips").
- **2026-09-08 — base** — `AGENTS.md` da raiz passou a ser o protocolo da KB. O
  conteúdo anterior era cópia desatualizada do `CLAUDE.md` (19 KB, declarava-se
  "retrato ANTIGO" na primeira linha e descrevia como ativos módulos já
  removidos) — e era justamente o primeiro arquivo que o Codex lê. Verificado
  antes de substituir: o conjunto BP-* do `CLAUDE.md` (001–014) contém o do
  `AGENTS.md` (001–011, 013); nada de único foi perdido. Versão antiga no git.
- **2026-09-08 — base** — Fluxos INGEST / QUERY / LINT definidos em
  [`01-Wiki/fluxos-kb.md`](01-Wiki/fluxos-kb.md).
