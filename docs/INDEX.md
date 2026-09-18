# Dootu — Índice da base de conhecimento

Página inicial da base da empresa Dootu. **Comece aqui** e abra só o que a tarefa pedir.

## Dootu — marca e negócio

Dootu é a marca geral do empreendimento; o Estúdio de Vídeos é um de seus produtos. A constituição jurídica da empresa não foi verificada.

### Frentes da empresa

| Frente | Situação em 2026-09-18 | Onde continuar |
|---|---|---|
| Empresa e marca | Contexto comum às iniciativas | [Mapa do negócio](01-Wiki/MAPA-DO-NEGOCIO.md) |
| Trading com IA | Foco atual de descoberta; produto e oferta ainda não definidos | [Visão da iniciativa](01-Wiki/TRADING-IA.md) · [Perguntas e próximos passos](02-Execution/DESCOBERTA-DO-NEGOCIO.md#trading-com-ia--foco-atual) |
| Estúdio de Vídeos | Produto existente; menor foco neste momento, sem decisão de encerramento | [Estado técnico datado](01-Wiki/ESTADO-ATUAL.md#última-tarefa-técnica-registrada) · [Pendências técnicas](02-Execution/PENDENCIAS.md) |
| Ferramentas para e-commerce | Oportunidade anterior em espera, sem descarte | [Contexto e evidências](01-Wiki/MAPA-DO-NEGOCIO.md#oportunidade-anterior-planilha-do-faturador-amazon) |

**Próximo passo do negócio:** definir com o parceiro quem será o cliente, quem decide as operações e onde o dinheiro ficará. Ainda não há escolha entre software, gestão ou produto de investimento.

- [Mapa do negócio](01-Wiki/MAPA-DO-NEGOCIO.md) — objetivo, experiência, recursos e frentes da empresa.
- [Próximos passos do negócio](02-Execution/DESCOBERTA-DO-NEGOCIO.md) — perguntas abertas e testes propostos, com status.
- [Decisão: Dootu como marca](03-Decisions/2026-09-17-dootu-marca-do-empreendimento.md) — escopo definido pelo fundador em 2026-09-17.
- [Decisão: foco de descoberta em trading com IA](03-Decisions/2026-09-18-foco-trading-ia.md) — mudança de prioridade, preservando as outras frentes.

## Governança

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
- [Prompt mestre v2 — Estúdio para 10 contas (2026-07-31)](00-Sources/PROMPT-CLAUDE-VIDEO-OPS-V2.md) —
  prompt datado escrito para um modelo; **não é o plano vigente**

## [01-Wiki](01-Wiki/) — conhecimento consolidado

Editar a nota existente; nota nova só sem dona.

- [Estado atual](01-Wiki/ESTADO-ATUAL.md) — onde o projeto está. **Único** documento de estado
  do projeto; `../CONTINUAR_PROJETO.md` é o checkpoint da trilha `video-growth-loop`, não o estado.
- [Arquitetura alvo](01-Wiki/ARQUITETURA.md) · [Como gastar menos](01-Wiki/CUSTO-como-gastar-menos.md)
- [Design system](01-Wiki/DESIGN.md) — contrato visual. Traz aviso de atualidade: os
  **exemplos** citam módulos removidos; as regras seguem valendo.
- [Fluxos da KB](01-Wiki/fluxos-kb.md) — INGEST / QUERY / LINT
- [`01-Wiki/archive/`](01-Wiki/archive/) — `HISTORICO-*.md`: trabalho concluído,
  decisões datadas e armadilhas **medidas** ("não re-descobrir"). Grepar antes de
  mexer num número ou numa guarda. **Caminhos internos são registro datado e não
  foram reescritos na migração** — alguns apontam para os locais antigos.
- [Operação de cortes](01-Wiki/operacao-cortes/INDEX.md) — **ponteiro**. O resultado real dos
  cortes publicados (lições, modelo, uma nota por clip) vive no vault `Cortes` da Usee, que é o
  dono do assunto desde 2026-09-14. O repositório guarda o *como o Estúdio funciona*, não o
  *o que aconteceu quando publiquei*.

## [02-Execution](02-Execution/) — trabalho ativo

Concluído sai da camada.

- [Pendências](02-Execution/PENDENCIAS.md) · [Checklist diário](02-Execution/CHECKLIST-DIARIO.md)
- Planos do Estúdio — **os seis estão ENTREGUES** (cada um traz o estado datado no topo, com
  a linha do `archive/HISTORICO-estudio-video.md` que o fecha). Ficam aqui como registro; o que
  restou aberto está em `PENDENCIAS.md`:
  [1 tags de cor](02-Execution/PLANO-1-tags-cor-remotion.md) ·
  [2 fundo visível](02-Execution/PLANO-2-fundo-visivel.md) ·
  [3 dupla compressão](02-Execution/PLANO-3-dupla-compressao.md) ·
  [destaque no título](02-Execution/PLANO-destaque-titulo.md) ·
  [legenda por palavra](02-Execution/PLANO-legenda-tempo-por-palavra.md) ·
  [qualidade p/ TikTok](02-Execution/PLANO-qualidade-clip-tiktok.md)
- [`02-Execution/plans/`](02-Execution/plans/) — planos `001`–`008` de 2026-07,
  **nenhum é trabalho ativo**: sete miram módulos removidos e só o `004` (CSP) continua
  aplicável. Estado item a item no [README](02-Execution/plans/README.md).
- Diários de execução: [Supabase](02-Execution/EXECUCAO-INTEGRACAO-SUPABASE-2026-08-04.md) · [Estúdio](02-Execution/EXECUCAO-PLANO-ESTUDIO-2026-08-04.md)

## [03-Decisions](03-Decisions/) — decisões e o porquê

Append-only.

- [Lançamento](03-Decisions/LANCAMENTO-decisoes.md) — portão da versão online.
  **Prova A meia respondida, Prova B em aberto.** Nada dali foi implementado.
- [Contrato de qualidade do clip](03-Decisions/CONTRATO-qualidade-clip.md)
- [Contrato do corte bom](03-Decisions/CONTRATO-corte-bom.md) — o critério EDITORIAL da
  recomendação: as cinco condições, a forma do corte e o que não é critério. O de cima é
  sobre o arquivo; este é sobre o conteúdo.
- Decisões vigentes de produto/código: [`../CLAUDE.md`](../CLAUDE.md)
- Decisões datadas já fechadas: [`01-Wiki/archive/`](01-Wiki/archive/)

## Fora das camadas, de propósito

**Doc que um programa lê fica junto do programa** — mesma regra que mantém
`.claude/rules/` fora da KB. Mover quebraria fiação real. Cada linha traz quem lê:

- [`night-reports/`](night-reports/) — `night-agent.ps1` **escreve** aqui (`$reportDir`)
- [`video-ops/`](video-ops/) — contrato do trabalhador: `video-worker/{worker,ytclip,make_fixtures}.py`
  citam [`CONTRATO_TRABALHADOR.md`](video-ops/CONTRATO_TRABALHADOR.md) e
  [`PESQUISA_FERRAMENTAS.md`](video-ops/PESQUISA_FERRAMENTAS.md); e
  `.claude/{agents,commands}/video-growth-loop.md` mandam gravar em
  [`PROGRESSO.md`](video-ops/PROGRESSO.md).
  [`PONTE-CHATGPT.md`](video-ops/PONTE-CHATGPT.md) é registro datado de 24/08/2026 e
  **descreve uma navegação que não existe mais** — traz aviso no topo.
- [`../CONTINUAR_PROJETO.md`](../CONTINUAR_PROJETO.md) — o agente
  `.claude/agents/video-growth-loop.md` lê e grava nele (linhas 81 e 119)
- [`../PASSO-A-PASSO.md`](../PASSO-A-PASSO.md) — `.claude/rules/lancamento-cloud.md` o carrega
  por caminho (`paths:`) e `web/index.html` o cita
- [`../README.md`](../README.md) — porta de entrada do repositório (convenção de repo).
  Descreve as ferramentas e guarda seções de **histórico**, que ficam como estão.
- [`shooting-range/`](shooting-range/) — insumo de plano **não iniciado**; o `CLAUDE.md`
  manda preservar, junto de `vendor/three.min.js`
- [Constituição](Constituicao.md) — governança, fica na raiz de `docs/`
- [`_templates/`](_templates/) — modelo de clip do plugin *Templates* deste vault. Fica por
  ser **exclusivo**: tem hipótese, `views_24h`/`views_7d` e conclusão, que o modelo do vault
  `Cortes` não tem.
- [`../CLAUDE.md`](../CLAUDE.md) e [`../.claude/rules/`](../.claude/rules/) — regras de
  **código**, carregam por caminho de arquivo. Mover quebra o mecanismo.

## Não é base de conhecimento (excluído do LINT, de propósito)

Nenhum destes é documentação do projeto; não entram na cobertura e não viram nota:

- `open-generative-ai/` — clone de **referência** (MIT, repo de terceiro), com `.git` próprio
  e ignorado pelo `.gitignore`. O que saiu dele vive em `video-worker/muapi.py`.
- `node_modules/`, `studio/node_modules/`, `vendor/`, `_temp_imageio/`,
  `video-apresentacao/_tools/` — dependências e binários vendorizados.
- `README.md` de pasta de código ou de asset (`baixador/`, `studio/`, `agent-memory/`,
  `my-video/`, `assets/flags/`, `assets/nba/`) — ficam junto do que descrevem.
- `lab-copa-janela-palpite.py` e `lab-cops-login.py`, aqui em `docs/` — são **código**,
  não nota.
- `arquivo/` — código desligado, guardado de propósito.

## Pendente de classificação

Precisa de decisão do usuário. **Não migrar sem resposta:**

- O vault do Dootu **não aparece** na tabela de vaults do `INDEX.md` do vault `Geral Usee`.
  Sem essa linha, quem começa pela governança não acha esta base. Acrescentar exige escrever
  em outro vault — não feito sem sua palavra.
- `../logo-ecommerce-puro/` — identidade de marca de um canal ("Ecommerce Puro"); pode ser de
  outro projeto, e aí sairia desta base.
- `../Dootu/` — vault Obsidian vazio dentro do repositório (`Bem-vindo.md` padrão), criado no
  commit `9d726ef`. **Decisão de 2026-09-14: manter como está.** Fica registrado aqui porque
  são duas configurações de vault no mesmo repositório — quem abrir o Obsidian pode escolher a
  errada.

### Resolvidos em 2026-09-14 (decisão do usuário)

- **Operação de cortes** — o dono é o vault `Cortes` da Usee. As duplicatas exatas
  (`01-Wiki/Licoes.md`, `_modelo-clip.md`) saíram do repositório; *Objetivo* e *Fluxo* foram
  consolidados lá; [`01-Wiki/operacao-cortes/INDEX.md`](01-Wiki/operacao-cortes/INDEX.md)
  guarda o vínculo.
- **`PROCESSO-FBA-ENVIOS.md`** → [`01-Wiki/archive/PROCESSO-FBA-ENVIOS.md`](01-Wiki/archive/PROCESSO-FBA-ENVIOS.md),
  como histórico: spec de 2026-06-29 nunca implementada, de um domínio que saiu do site.
- **`cloud/`** — aposentada. Ver `02-Execution/PENDENCIAS.md`, "Trabalho futuro".

## Regra de encerramento

Antes de encerrar uma sessão:

1. Atualizar o [Estado atual](01-Wiki/ESTADO-ATUAL.md)
2. Registrar arquivos modificados
3. Registrar testes realmente executados
4. Informar erros ou bloqueios
5. Deixar o próximo passo exato
6. Uma linha no [`log.md`](log.md), se a mudança valer para o futuro

<!-- LINT: toda camada aparece aqui; todo arquivo da KB é alcançável deste índice. -->
