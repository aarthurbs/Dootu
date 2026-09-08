# Dootu — Índice da base de conhecimento

Mapa de navegação do projeto. **Comece aqui** e abra só o que a tarefa pedir.

- Protocolo de leitura e escrita: [`../AGENTS.md`](../AGENTS.md)
- Governança Usee: [Constituição](Constituicao.md)
- Fluxos INGEST / QUERY / LINT: [`01-Wiki/fluxos-kb.md`](01-Wiki/fluxos-kb.md)
- Histórico cronológico: [`log.md`](log.md)

## Início de uma sessão técnica

Leia nesta ordem:

1. [Constituição](Constituicao.md)
2. [Estado atual](01-Wiki/ESTADO-ATUAL.md)
3. [Pendências](02-Execution/PENDENCIAS.md)
4. Abra apenas o plano indicado no Estado Atual
5. Confira `git status` e `git diff` antes de editar

## [00-Sources](00-Sources/) — material bruto

Não reescrever; só acrescentar.

- [Conversas](00-Sources/CONVERSAS.md) · [Conversa empreendedorismo + IA (2026-07-31)](00-Sources/conversa-empreendedorismo-ia-2026-07-31.md)
- [Auditoria do video-ops (chat)](00-Sources/chat-auditoria-video-ops.md)

## [01-Wiki](01-Wiki/) — conhecimento consolidado

Editar a nota existente; nota nova só sem dona.

- [Estado atual](01-Wiki/ESTADO-ATUAL.md) — onde o projeto está
- [Arquitetura alvo](01-Wiki/ARQUITETURA.md) · [Lições](01-Wiki/Licoes.md) · [Como gastar menos](01-Wiki/CUSTO-como-gastar-menos.md)
- [Fluxos da KB](01-Wiki/fluxos-kb.md) — INGEST / QUERY / LINT
- [`01-Wiki/archive/`](01-Wiki/archive/) — `HISTORICO-*.md`: trabalho concluído,
  decisões datadas e armadilhas **medidas** ("não re-descobrir"). Grepar antes de
  mexer num número ou numa guarda. **Caminhos internos são registro datado e não
  foram reescritos na migração** — alguns apontam para os locais antigos.
- [Operação de cortes](01-Wiki/operacao-cortes/INDEX.md) — índice próprio

## [02-Execution](02-Execution/) — trabalho ativo

Concluído sai da camada.

- [Pendências](02-Execution/PENDENCIAS.md) · [Checklist diário](02-Execution/CHECKLIST-DIARIO.md)
- Planos do Estúdio — abra pelo que o Estado Atual indicar:
  [1 tags de cor](02-Execution/PLANO-1-tags-cor-remotion.md) ·
  [2 fundo visível](02-Execution/PLANO-2-fundo-visivel.md) ·
  [3 dupla compressão](02-Execution/PLANO-3-dupla-compressao.md) ·
  [destaque no título](02-Execution/PLANO-destaque-titulo.md) ·
  [legenda por palavra](02-Execution/PLANO-legenda-tempo-por-palavra.md) ·
  [qualidade p/ TikTok](02-Execution/PLANO-qualidade-clip-tiktok.md)
- [`02-Execution/plans/`](02-Execution/plans/) — planos numerados `001`–`008` + [README](02-Execution/plans/README.md)
- Diários de execução: [Supabase](02-Execution/EXECUCAO-INTEGRACAO-SUPABASE-2026-08-04.md) · [Estúdio](02-Execution/EXECUCAO-PLANO-ESTUDIO-2026-08-04.md)

## [03-Decisions](03-Decisions/) — decisões e o porquê

Append-only.

- [Lançamento](03-Decisions/LANCAMENTO-decisoes.md) · [Contrato de qualidade do clip](03-Decisions/CONTRATO-qualidade-clip.md)
- Decisões vigentes de produto/código: [`../CLAUDE.md`](../CLAUDE.md)
- Decisões datadas já fechadas: [`01-Wiki/archive/`](01-Wiki/archive/)

## Fora das camadas, de propósito

**Doc que um programa lê fica junto do programa** — mesma regra que mantém
`.claude/rules/` fora da KB. Mover quebraria fiação real:

- [`night-reports/`](night-reports/) — `night-agent.ps1` **escreve** aqui (`$reportDir`)
- [`video-ops/`](video-ops/) — contrato do trabalhador: `video-worker/{worker,ytclip,make_fixtures}.py`
  citam [`CONTRATO_TRABALHADOR.md`](video-ops/CONTRATO_TRABALHADOR.md) e
  [`PESQUISA_FERRAMENTAS.md`](video-ops/PESQUISA_FERRAMENTAS.md); e
  `.claude/{agents,commands}/video-growth-loop.md` mandam gravar em
  [`PROGRESSO.md`](video-ops/PROGRESSO.md)
- [Constituição](Constituicao.md) — governança, fica na raiz de `docs/`
- [`_templates/`](_templates/) e [`_modelo-clip.md`](_modelo-clip.md) — modelos do Obsidian
- [`../CLAUDE.md`](../CLAUDE.md) e [`../.claude/rules/`](../.claude/rules/) — regras de
  **código**, carregam por caminho de arquivo. Mover quebra o mecanismo.

## Ainda não classificado

Precisa de decisão do usuário sobre a camada:

- [`../CONTINUAR_PROJETO.md`](../CONTINUAR_PROJETO.md) ·
  [`../PASSO-A-PASSO.md`](../PASSO-A-PASSO.md) · [`../DESIGN.md`](../DESIGN.md)
- [`PROCESSO-FBA-ENVIOS.md`](PROCESSO-FBA-ENVIOS.md) ·
  [`PROMPT-CLAUDE-VIDEO-OPS-V2.md`](PROMPT-CLAUDE-VIDEO-OPS-V2.md) ·
  [`shooting-range/`](shooting-range/)
- `docs/lab-copa-janela-palpite.py` e `docs/lab-cops-login.py` — código, não nota

## Regra de encerramento

Antes de encerrar uma sessão:

1. Atualizar o [Estado atual](01-Wiki/ESTADO-ATUAL.md)
2. Registrar arquivos modificados
3. Registrar testes realmente executados
4. Informar erros ou bloqueios
5. Deixar o próximo passo exato
6. Uma linha no [`log.md`](log.md), se a mudança valer para o futuro

<!-- LINT: toda camada aparece aqui; todo arquivo da KB é alcançável deste índice. -->
