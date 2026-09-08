# Registro de progresso — Automação de Conteúdo em Vídeo

## Estado geral

- **Última atualização:** 12/08/2026
- **Fase concluída mais recente:** ciclo 2 do `video-growth-loop` — auditoria a partir do
  grafo de execução; guarda de espaço em disco na rota que o operador usa todo dia
- **Fase ativa:** piloto operacional — direitos, fontes autorizadas e medição manual
- **Publicação real por API:** adiada
- **Aprovação humana:** obrigatória
- **Skill `ponytail-audit`:** disponível e executada de verdade em 12/08/2026

---

## Fase 0 — Leitura e reconstrução do estado

**Status:** concluída em 31/07/2026.

### Trabalho realizado

- `chat-auditoria-video-ops.md` foi analisado integralmente por estrutura, turnos,
  decisões, entregas, testes e ponto final da interrupção.
- O repositório e o diff não commitado foram comparados com o relato.
- O estado real foi confirmado:
  - F1.1 está no commit `4c6c90d`;
  - `video-ops.js` contém 86 adições e uma remoção da F1.2 interrompida;
  - sintaxe de `video-ops.js` válida;
  - `test-video-ops-dom.js` passa;
  - `test-video-ops.js` falha na compatibilidade do snapshot de aprovação.
- O diff parcial foi copiado sem alterações para
  `docs/video-ops/checkpoints/F1.2-parcial-2026-07-31.patch`.

### Decisões tomadas

- Não reiniciar o projeto e não descartar o diff do Claude.
- Corrigir a migração de snapshot antes de ampliar a interface.
- APIs reais permanecem fora da F1.2.
- Remover de código final qualquer estado de “conectado” que não corresponda a OAuth
  real e seguro.

### Problemas encontrados

- A skill `ponytail-audit` não existe entre as skills disponíveis e não foi encontrada
  nas pastas locais de instruções. Não foi possível executá-la honestamente.
- A tentativa de ler CPU/RAM por CIM foi bloqueada pelo ambiente; o plano não assume GPU
  ou memória e exige benchmark local.
- O arquivo anexado é grande (~295 KB); por regra do projeto, a análise integral foi
  feita por varredura programática e extração dirigida, sem despejá-lo no contexto.

### Fontes consultadas

- `chat-auditoria-video-ops.md`;
- histórico e diff do Git;
- `video-ops.js`, `video-ops.css`, `test-video-ops.js`,
  `test-video-ops-dom.js`.

### Itens pendentes

- completar F1.2;
- validar com 500 registros e navegador real;
- executar F1.3 e trabalhador local em fases posteriores.

### Próxima ação recomendada

Completar a compatibilidade de `placement`, painel/filtros e carregamento progressivo.

### Arquivos criados/alterados

- criado `docs/video-ops/checkpoints/F1.2-parcial-2026-07-31.patch`;
- nenhum arquivo de produção alterado nesta fase.

### Comandos para continuar

```powershell
git status --short
git diff -- video-ops.js
node --check video-ops.js
node test-video-ops.js
node test-video-ops-dom.js
```

---

## Fase R1 — Pesquisa de mercado, plataformas e conformidade

**Status:** concluída em 31/07/2026.

### Trabalho realizado

- Separação dos modelos TikTok e Instagram Reels.
- Pesquisa de retenção, hooks, duração, ritmo, legenda, safe zone, frequência,
  tendências, reaproveitamento e métricas.
- Classificação das conclusões em confirmadas, observacionais e experimentais.
- Pesquisa de direitos autorais, termos contra scraping, uso de imagem/voz e LGPD.
- Confirmação de que publicação oficial agora aumentaria risco e complexidade.

### Fontes consultadas

- documentação/ajuda oficial do TikTok, TikTok for Developers e Creative Center;
- documentação oficial da Meta/Instagram no Postman e Central de Ajuda;
- Lei 9.610/1998 e LGPD no Planalto;
- estudos observacionais da Buffer, Metricool e Socialinsider.

Links e limitações de cada evidência estão em `PLANO_AUTOMACAO_VIDEO.md`.

### Decisões tomadas

- uma linha editorial piloto antes de ativar as dez contas;
- 3–5 posts por plataforma/semana no piloto; três cortes/dia total só após critérios;
- Creative Center e pesquisa manual para tendência; sem scraper;
- original/permissionamento e método de download são portões separados;
- métricas em 1 h, 24 h, 7 d e 30 d; comparar dentro da conta/coorte.

### Problemas encontrados

- Evidências públicas sobre duração/cadência orgânica são majoritariamente
  observacionais ou derivadas de publicidade; não foram apresentadas como algoritmo.
- Safe zones variam com interface, descrição e recursos; é obrigatório usar preview.

### Itens pendentes

- validar as hipóteses com posts reais autorizados;
- registrar baseline por conta.

### Próxima ação recomendada

Executar o piloto da semana 4 depois de F1.2 e do portão de direitos.

### Arquivos criados/alterados

- criado `docs/video-ops/PLANO_AUTOMACAO_VIDEO.md`.

### Comandos necessários

Nenhum. A pesquisa não exige instalação.

---

## Fase R2 — Pesquisa e auditoria de ferramentas/repositórios

**Status:** concluída em 31/07/2026.

### Trabalho realizado

- Comparação de FFmpeg, Subtitle Edit, faster-whisper, whisper.cpp, Whisper original,
  LosslessCut, PySceneDetect, auto-editor, WhisperX, yt-dlp e n8n.
- Revisão documental de linguagem, licença, Windows, GUI/CLI, atividade, dependências,
  permissões, privacidade, segurança, termos e adequação.
- Definição de ferramenta principal e backup para legendas.

### Fontes consultadas

- repositórios, releases, changelogs, manifests, issues e security advisories oficiais;
- documentação oficial de cada projeto, listada em `PESQUISA_FERRAMENTAS.md`.

### Decisões tomadas

- FFmpeg existente é o motor base.
- faster-whisper CPU INT8 é candidato principal, sem instalar antes do benchmark.
- Subtitle Edit 5 portátil + whisper.cpp é o backup operacional.
- LosslessCut é opcional; PySceneDetect/auto-editor só entram após teste de ganho.
- yt-dlp não é fluxo padrão e não recebe cookies/execução de comandos.
- n8n e WhisperX são complexidade desnecessária no trimestre inicial.

### Problemas encontrados

- Projetos ativos ainda apresentam regressões e advisories; atividade não equivale a
  segurança.
- Ferramentas com modelos/binários externos multiplicam a cadeia de fornecimento.

### Itens pendentes

- benchmark PT-BR de 10 minutos na semana 5;
- hash/scan de qualquer artefato que vier a ser adotado.

### Próxima ação recomendada

Não instalar nada agora; medir primeiro a edição/legenda manual do piloto.

### Arquivos criados/alterados

- criado `docs/video-ops/PESQUISA_FERRAMENTAS.md`.

### Comandos necessários

Os comandos futuros e condicionais estão no fim de `PESQUISA_FERRAMENTAS.md`.

---

## Fase P1 — Consolidação operacional e plano de 12 semanas

**Status:** concluída em 31/07/2026.

### Trabalho realizado

- fluxo de 15 passos convertido em estados e portões auditáveis;
- árvore do Drive estendida sem duplicar arquivos por status;
- divisão manual/automática definida;
- plano semanal de três meses e critérios de manter/trocar/descartar;
- riscos técnicos, jurídicos e operacionais mapeados;
- próximas ações priorizadas.

### Decisões tomadas

- publicação automática continua fora do trimestre, salvo nova decisão após o go/no-go;
- `null` representa métrica indisponível; nunca transformar ausência em zero;
- nenhum arquivo original é sobrescrito ou apagado automaticamente.

### Problemas encontrados

- A confirmação de sincronização do Google Drive não é confiável apenas pelo sistema de
  arquivos; segue manual até existir integração oficial segura.

### Itens pendentes

- implementar F1.2;
- pilotar a estrutura com mídia autorizada;
- medir capacidade humana e custo real por vídeo.

### Próxima ação recomendada

Continuar F1.2 exatamente no snapshot de aprovação interrompido.

### Arquivos criados/alterados

- atualizado `docs/video-ops/PLANO_AUTOMACAO_VIDEO.md`;
- criado este registro.

### Comandos necessários

Nenhum adicional.

---

## Fase F1.2 — Painel consolidado, formatos e volume

**Status:** concluída em 31/07/2026.

### Trabalho realizado

- A skill obrigatória `emil-design-eng` foi aplicada antes de alterar UI/CSS.
- O snapshot da F1.1 sem `placement` agora é migrado e assinado novamente apenas se
  estiver íntegro; alteração real continua derrubando aprovação.
- Formatos entregues: Vídeo TikTok, Reels, Stories e Vídeo no feed. Fotos/carrosséis
  foram adiados porque o trabalhador inicial produz vídeo curto.
- Formato aparece no formulário, cartões, pacote manual, checklist e CSV.
- Mudança de formato faz parte do snapshot sensível e exige nova aprovação.
- Nova aba **Visão geral** mostra contas ativas, pendências, plano do dia, publicados em
  sete dias e cartões das contas; a fila consolidada filtra plataforma, linha, status e
  busca por conta/criador/formato.
- A lista renderiza 50 itens e adiciona lotes de 50 sob demanda.
- Estados fictícios de conexão e limites voláteis de API foram removidos.
- O modo “Integração oficial” sem conexão foi removido; a interface diz
  “Manual com aprovação humana”.
- O diff original do Claude permanece no checkpoint anterior.

### Fontes consultadas

- documentação de formatos/postagem TikTok e Instagram já listada no plano;
- skill `emil-design-eng`;
- código/testes do projeto.

### Decisões tomadas

- visão geral sem nova dependência ou animação decorativa;
- filtros globais apenas na visão consolidada; fila da conta continua focada;
- limites de API não são copiados para o frontend, pois mudam e serão consultados em
  runtime apenas numa integração futura.

### Problemas encontrados e corrigidos

- adicionar `placement` ao snapshot invalidava uma aprovação legítima da F1.1;
- destino antigo fora de TikTok/Instagram era obrigado a ter um formato inexistente;
- formulário expunha “Integração oficial” apesar de OAuth ter sido adiado.

### Verificação

- `node --check video-ops.js`: passou;
- `node test-video-ops.js`: passou;
- `node test-video-ops-dom.js`: passou;
- `git diff --check`: passou, apenas avisos de normalização LF/CRLF do Git;
- teste de 500 itens: lote inicial 50 e segundo lote sem pular registros;
- navegador real: desktop e 390×844, sem overflow horizontal e sem erro/warning no
  console; viewport foi restaurado ao fim.

### Auditoria de interface

| Before | After | Why |
|---|---|---|
| Fila inteira por conta | visão geral + fila cruzada | enxergar dez contas sem trocar uma a uma |
| Todos os registros renderizados | lotes de 50 | manter resposta rápida com 500+ itens |
| “Integração oficial” sem OAuth | “Manual com aprovação humana” | estado visível corresponde à realidade |
| regras voláteis no JS | formato editorial estável | evitar dados falsos ou rapidamente desatualizados |

### Arquivos criados ou alterados

- alterado `video-ops.js`;
- alterado `video-ops.css`;
- alterado `test-video-ops.js`;
- alterado `test-video-ops-dom.js`;
- documentos criados em `docs/video-ops/`.

### Arquivo de segurança

- `docs/video-ops/checkpoints/F1.2-parcial-2026-07-31.patch`

### Próxima ação recomendada

Executar o piloto operacional com uma linha TikTok/Instagram e seis fontes autorizadas;
medir tempo por corte e qualidade manual antes de instalar faster-whisper.

### Comandos para continuar

```powershell
node --check video-ops.js
node test-video-ops.js
node test-video-ops-dom.js
git diff --check
git status --short
```

---

## Fase F1.2b — Auditoria com a skill real, estabilização e preparação do piloto

**Status:** concluída em 01/08/2026.

### Correção de registro importante

A skill **`ponytail-audit` estava disponível nesta sessão** e foi executada de verdade.
Os registros anteriores (que afirmavam indisponibilidade) estavam corretos para aquelas
sessões; esta é a primeira execução real. O projeto **não** foi reiniciado e nenhuma
decisão anterior foi descartada.

### Resultado da auditoria de excesso de engenharia

O código já estava enxuto — a auditoria manual anterior tinha removido o grosso (regras
voláteis de API, estados falsos de conexão, fotos/carrosséis, `PUBLISH_MODE_LABEL`
reduzido a `manual`). Achados e destino:

| Achado | Destino |
|---|---|
| `sensitiveSnapshot` fazia `JSON.parse` do que o irmão acabara de serializar, dentro de laço | **aplicado**: `snapshotValues()` devolve o array; some o round-trip |
| `driveMasterPath` sem chamador no app | **mantido**: o contrato do trabalhador desta rodada o usa |
| `publishMode` com um único valor possível | **mantido**: remover campo persistido custa uma migração — mais caro que as 11 linhas |
| `visibleSlice` embrulha `Array.prototype.slice` | mantido como costura testada da paginação |
| ternário de estado do Drive repetido 4× | adiado: mexer em UI exigiria `emil-design-eng` para ganho cosmético |

### Achados de correção (fora do escopo da skill)

1. **`logs` crescia sem limite.** `addLog()` roda em quase toda ação e nada podava. Em
   operação longa isso enche a cota do `localStorage`, `persist()` passa a falhar e o
   painel inteiro trava por causa de log. **Corrigido:** `LOG_LIMIT = 500`, `trimLogs()`
   aplicado no `addLog` e no `sanitizeState` (mantém as entradas mais recentes).
2. **Métrica ausente virava zero**, violando regra explícita do próprio projeto
   (`PLANO §15`, `CONTINUAR_PROJETO`). **Corrigido:** `numOrNull`/`metricsOf` preservam
   `null`; a interface mostra `—`; o CSV traz célula vazia; `buildReport` soma só o que
   foi medido e devolve `unmeasured` com a contagem, exibida no relatório. Um zero
   digitado continua sendo medição real.

### Confirmado como correto (não eram achados)

- o portão de migração do `placement` é bem guardado: snapshot adulterado não sobrevive;
- `VISIBLE_COUNT` reseta em todos os caminhos (aba, filtro, conta, plataforma, linha, busca);
- `load-more` usa `refreshList()` e o filtro usa `renderKeepingScroll()` — rolagem preservada.

### Trabalho realizado além da correção

- **Mídia sintética + prova executável do contrato**: `video-worker/make_fixtures.py`
  gera vídeo com `testsrc2`+`sine` (nenhum conteúdo protegido) e valida 16 pontos —
  MP4/H.264/AAC, duração, resolução, SHA-256 incremental, duplicata por conteúdo,
  `.part`+rename atômico, `job.json`/`result.json` e idempotência.
- **`docs/video-ops/CONTRATO_TRABALHADOR.md`**: contrato navegador ↔ trabalhador.
- **`docs/video-ops/PILOTO.md`**: checklist operacional, modelos de cadastro (criador,
  titular, evidência, plataformas, monetização, território, validade, edição, música,
  voz/imagem, revogação), plano do benchmark de legendas e as 9 pendências que dependem
  do usuário.

### Problemas encontrados

- **`imageio_ffmpeg` não traz `ffprobe`.** Em vez de instalar binário novo, o harness lê
  duração/codec/resolução do cabeçalho do próprio `ffmpeg` — provado suficiente com mídia
  sintética. Só instalar `ffprobe` se um caso real quebrar essa leitura.
- **Escrevendo em `.part`, o FFmpeg não deduz o container** e aborta com *"Unable to
  choose an output format"*. Toda escrita atômica de mídia precisa de `-f mp4` explícito.
  Registrado no contrato — teria custado tempo de depuração na Fase 2.
- Não há automação de navegador nesta sessão; a verificação foi por `test-video-ops-dom.js`.
  O QA visual registrado na F1.2 continua valendo.

### Fontes consultadas

- `CONTINUAR_PROJETO.md`, `PROGRESSO.md`, `PLANO_AUTOMACAO_VIDEO.md`,
  `PESQUISA_FERRAMENTAS.md`, `AGENTS.md`;
- `chat-auditoria-video-ops.md` por extração dirigida;
- skill `ponytail:ponytail-audit`;
- código e testes do projeto.

### Verificação

- `node --check` nos três arquivos: passou;
- `node test-video-ops.js` e `node test-video-ops-dom.js`: passaram — **178 asserções**;
- `py video-worker\make_fixtures.py`: 16 verificações passaram;
- `git diff --check`: só avisos de normalização LF/CRLF.

### Arquivos criados ou alterados

- alterado `video-ops.js` (poda de log, métrica `null`, `snapshotValues`);
- alterado `test-video-ops.js` (asserções novas de métrica e de histórico);
- criado `video-worker/make_fixtures.py`;
- criado `docs/video-ops/CONTRATO_TRABALHADOR.md`;
- criado `docs/video-ops/PILOTO.md`;
- criado `docs/video-ops/checkpoints/F1.2-estabilizada-2026-08-01.patch`.

### Próxima ação recomendada

Fornecer os itens 1–5 de `PILOTO.md §6`. Sem eles, a próxima tarefa técnica segura é o
corpus PT-BR (item 6) e depois o trabalhador local conforme o contrato — **nada será
instalado antes do benchmark**.

### Comandos para continuar

```powershell
node --check video-ops.js
node test-video-ops.js
node test-video-ops-dom.js
py -3.12 video-worker\make_fixtures.py
git status --short
git diff --check
```

---

## Agente `video-growth-loop` — criação e ciclo 1

**Status:** concluída em 02/08/2026.

### Trabalho realizado

Criado o agente nativo de aperfeiçoamento contínuo, no formato desta versão do Claude Code
(verificado inspecionando definições reais em `plugins/marketplaces/**/agents/*.md`, em vez
de presumir):

- `.claude/agents/video-growth-loop.md` — frontmatter `name`/`description`/`tools` + prompt
  com as 4 trilhas, a separação TikTok/Reels, o ciclo de 12 etapas, as proibições absolutas
  e a regra de **degradação honesta** quando não há dados;
- `.claude/commands/video-growth-loop.md` — `/video-growth-loop [foco]`;
- `docs/video-ops/AGENTE_VIDEO_GROWTH_LOOP.md` — referência humana + rubrica de qualidade
  (13 critérios + 10 reprovações automáticas) + radar de tendências seguro;
- `docs/video-ops/REGISTROS.md` — experimentos e biblioteca de aprendizados, com os modelos
  preenchíveis.

### Auditoria de simplificação da estrutura

O pedido listava 9 artefatos; foram entregues 4. `EXPERIMENTOS.md` e
`BIBLIOTECA_DE_APRENDIZADOS.md` viraram `REGISTROS.md` (dois registros append-only, hoje
vazios, alimentados pelos mesmos posts — separá-los criaria dois arquivos que ninguém
abre). Rubrica e radar entraram no documento do agente, que é referência estável. Os
"modelos de dados" viraram blocos preenchíveis em vez de schema JSON, porque schema para
zero registros é código especulativo.

### Ciclo 1 — problema, evidência e correção

**Problema:** `driveTree()` mandava o operador criar uma árvore sem `Fontes originais/`,
`_jobs/pending|running|done|failed/` e `_results/`.

**Evidência:** `PLANO §12` especifica as três; `CONTRATO_TRABALHADOR §1` define `_jobs/` e
`_results/` como caixa de entrada e saída do trabalhador; o checklist do `PILOTO.md` manda
salvar o original em `Fontes originais\<sourceId>\`. Comparação feita executando
`driveTree()` e confrontando com os três documentos.

**Consequência real evitada:** o operador criaria a árvore pelo botão, não teria onde
guardar o original, e o trabalhador da Fase 2 não teria caixa de entrada nem de saída.

**Alternativas descartadas:**

- *particionar as variantes por `<YYYY>/<MM>`* (também previsto no `PLANO §12`): é melhoria,
  não defeito — mexe em `drivePathFor` e nos `driveArtifacts` já planejados. Fica para um
  ciclo próprio, com migração pensada;
- *explicar `_jobs/` na interface*: é texto de UI, dispara `emil-design-eng` e vale como
  melhoria separada. Registrado como candidato do próximo ciclo.

**Implementação:** `driveTree()` passou a emitir `Fontes originais/` antes de
`Cortes mestres/`, e `_jobs/` com as quatro subpastas mais `_results/` ao final.

**Teste de aceitação:** sete literais independentes da implementação em
`test-video-ops.js`, mais a ordem `Fontes originais` antes de `Cortes mestres`. Se a árvore
divergir dos documentos de novo, o teste quebra em vez de o operador descobrir na operação.

### Verificação

`node --check` OK · `test-video-ops.js` **180 asserções** · `test-video-ops-dom.js` OK ·
`git diff --check` só com avisos LF/CRLF · saída de `driveTree()` conferida à mão.

### Medição

**Sem baseline editorial** — não há conta, fonte autorizada nem post publicado, então as
trilhas A e C não tinham o que analisar. Métrica deste ciclo: pastas exigidas pelos
documentos e ausentes na árvore, **de 3 para 0**.

### Arquivos criados ou alterados

Criados: `.claude/agents/video-growth-loop.md`, `.claude/commands/video-growth-loop.md`,
`docs/video-ops/AGENTE_VIDEO_GROWTH_LOOP.md`, `docs/video-ops/REGISTROS.md`,
`docs/video-ops/checkpoints/ciclo1-antes-2026-08-02.patch`.
Alterados: `video-ops.js` (`driveTree`), `test-video-ops.js` (teste de aceitação).

### Próxima ação recomendada

Bloqueado por dados para as trilhas A e C. Candidatos técnicos já identificados, em ordem:
(1) explicar na interface para que servem `_jobs/` e `_results/`; (2) decidir o
particionamento `<YYYY>/<MM>` das variantes. Ambos são melhoria, não defeito — nenhum é
urgente antes do piloto existir.

## 03/08/2026 — trabalhador local, marcação de cortes, render vertical e hash na aprovação

Quatro fases entregues e verificadas. O caminho completo funciona: um MP4 de ~30 min entra,
dois trechos são marcados no navegador, o trabalhador local produz quatro variantes
verticais e o Estúdio aprova cada arquivo **pelo hash dele**.

**Fase 1 — trabalhador (`video-worker/worker.py`).** Recebe `job.json`, opera só dentro de
`--root` (recusa absoluto externo, `..` e link que escapa, checando o caminho **real**),
valida existência/tamanho/faixa de vídeo, mede pelo cabeçalho do FFmpeg (sem `ffprobe`,
conforme §9 do contrato), calcula SHA-256 incremental, detecta duplicata, confere espaço
antes de produzir, grava de forma atômica com `-f mp4` explícito e emite `result.json` no
sucesso **e** na falha. Subprocesso sempre por lista, nunca `shell=True`; nenhum argumento
do FFmpeg vem de string do JSON. Idempotente por (`jobId`, `input.sha256`). Sem rede.

**Fase 2 — marcação (`video-ops.js` + `video-ops.css`).** Painel dentro do diálogo de corte:
`<video>` por `URL.createObjectURL`, marcar início/fim, presets de 15s e 30s, tocar do
início (para no fim marcado) e limpar. Botões explícitos, zero `dblclick` (BP-001), sem
re-render (o foco do campo e a posição do player sobrevivem). A faixa de estado cobre os seis
casos, inclusive quando a automação **não** age (BP-008). O arquivo é prévia da sessão:
`localStorage` guarda só nome, tamanho e duração — nunca bytes.

**Fase 3 — render vertical.** `render_variant` entrega 1080x1920 H.264/AAC, sem marca
d'água, duração dentro de 0,25 s, direto do original (`input_not_source` barra cascata), um
job independente por variante.

**Fase 4 — hash na aprovação.** `sensitiveSnapshot` passou a incluir o SHA-256 do arquivo
revisado, a versão do render e o reenquadramento. `publishingIssues` exige artefato válido:
caminho reservado não é arquivo. O "Pacote de publicação" só se declara pronto sem
bloqueio e lista o que falta. Publicação concluída segue imutável.

**Reordenação necessária no `sanitizeState`:** a validação da aprovação virou uma terceira
passada, depois de `driveArtifacts`. Como a assinatura agora depende do artefato, rodá-la
junto das variantes veria "sem artefato" e derrubaria toda aprovação legítima em cada load.
A migração de assinatura antiga ganhou `sensitiveSnapshotPreArtifact`, no mesmo padrão que
já existia para o `placement`.

**Esclarecimento de contrato (sem mudar a versão):** `input.sha256` é obrigatório em
`render_variant` e opcional em `ingest` — é o ingest que calcula o hash. Ver §3.

Criados: `video-worker/worker.py`, `video-worker/test_worker.py`, `test-video-ops-e2e.js`.
Alterados: `video-ops.js`, `video-ops.css`, `test-video-ops.js`, `test-video-ops-dom.js`,
`docs/video-ops/CONTRATO_TRABALHADOR.md`. `index.html` **não** foi tocado.

Checks: `node --check video-ops.js` · `node test-video-ops.js` · `node test-video-ops-dom.js`
· `py -3.12 video-worker\make_fixtures.py` (16) · `py -3.12 video-worker\test_worker.py` (89)
· `node test-video-ops-e2e.js` (30 min → 4 variantes → import → aprovação → re-render).

### Próxima ação recomendada

Rodar o piloto com material autorizado real. Toda a corrente está provada com mídia
sintética; o que falta é o atrito do mundo — nome de arquivo com acento, original em
variable frame rate, live com trecho mudo. Só depois disso vale discutir transcrição
(passos 6–7 do contrato) ou vigilância automática de `_jobs/`.

---

## 12/08/2026 — ciclo 2 do `video-growth-loop`: auditoria pelo grafo de execução

Foco pedido: partir de `video-worker/graph.py` (580 linhas, com `test_graph.py`), mapear o
caminho real de um corte e achar a maior alavanca para a operação de cortes.

### O mapa real (medido no código, não na documentação)

Existem **três** caminhos, não dois, e o que o operador usa todo dia é o terceiro:

| Caminho | Quem dispara | O que o produto faz com ele |
|---|---|---|
| **`serve.py` → `POST /api/video-cut`** | botão **⬇ Salvar** / **Baixar 9:16** no navegador (`video-ops.js:2092`) | **é este o caminho diário.** `estudio.ps1` sobe ele; `PLANO-DE-OPERACAO.md §Rotina diária` passo 4 é ele |
| **`worker.py` em lote** (`main()` varre `_jobs/pending` → `process_job` → `HANDLERS`) | operador baixa o job.json (`video-ops.js:3543`, `3669`) e roda à mão | usado no fluxo documentado de variante com hash + aprovação |
| **`graph.py`** (`validar_job → conferir_idempotencia → validar_entrada → conferir_espaco → renderizar → conferir_saida → salvar_resultado → aguardar_aprovacao`) | ninguém | **zero chamadores.** Nenhum `.md`, `.ps1`, `.js` ou `.html` do repositório o menciona |

### Achado principal: a rota diária gravava o original sem conferir espaço

O grafo tem um nó `conferir_espaco` **antes** de produzir (`graph.py:305`). A rota que o
operador usa não tinha equivalente para a **maior** escrita que ela faz: o upload do
original ia inteiro para o `%TEMP%` e só depois alguém olhava o disco.

Prova executada (sonda que reporta 0 byte livre e envia 3 MB, sem FFmpeg):

```text
antes:  ordem real = receive(3145728 bytes)      ensure_space nunca foi chamado
        status 400 probe_failed                  tok_probe.src = True (3.145.728 bytes)
depois: ordem real = ensure_space                receive nunca foi chamado
        status 507 no_space                      tok_probe.src = False
```

Agravantes reais: `DEFAULT_MAX_UPLOAD_BYTES` = **12 GiB**, a fonte típica da operação é live
ou podcast em 4K, e cada fonte aberta no dia gera um `.src` novo no `%TEMP%` que só é
apagado quando o processo encerra (`atexit`). Uma jornada com 6 fontes deixava 6 originais
completos em disco — e um upload recusado também deixava o seu.

### Segundo defeito, descoberto ao verificar o primeiro

Com a guarda no lugar, `test_serve.py` passou numa rodada e **falhou na seguinte**
(`ConnectionAbortedError` ao ler o corpo do 507). Causa: recusar antes de ler o corpo faz o
Windows mandar RST, o navegador perde a resposta e o `fetch` cai no `catch` genérico de
`renderError` — o operador leria *"o renderizador local não está ativo"* com o servidor de
pé e o disco cheio. Mentira de diagnóstico, violação de BP-008.

Corrigido na **única** porta por onde todo erro da rota passa (`_error` → `_drain`), o que
também fecha o mesmo buraco nas recusas que já existiam antes (query inválida, arquivo
acima do teto). Descartar o corpo não escreve nada em disco; o teto é `DRAIN_LIMIT` = 64 MB,
com o limite declarado em comentário.

### Veredito sobre os dois caminhos paralelos (pergunta explícita do ciclo)

**Duplicação que hoje custa mais do que rende — e a decisão é do usuário, não foi tomada
aqui.** O que `graph.py` acrescenta de real é retomada (`--resume`) via `_state/<job_id>.json`.
Só que:

- a retomada **não evita o custo dominante**: `write_atomic` remove o `.part` e `renderizar`
  recomeça do zero. O que ela poupa é o SHA-256 do original (segundos), não o render;
- `_state/` não é lido por nada fora do próprio `graph.py` — o navegador importa
  `_results/<jobId>.json`, que o caminho de lote já grava;
- seis blocos são cópia literal do `worker.py`: `reframe_of` (`graph.py:220`) ↔
  `worker.py:552`; `output_name` (228) ↔ 559; `refuse_variant_input` (234) ↔ 544;
  **`variant_extra` (243) ↔ 570** — 16 chaves de contrato mantidas à mão em dois lugares;
  `no_conferir_idempotencia` (277) ↔ `process_job` (601); `report_failure` (390) ↔
  `run_job_file` (632).

`variant_extra` é o risco concreto: `renderVersion` decide se a variante precisa de nova
aprovação. Se um dia só um dos dois lados ganhar um campo, o navegador vê versão errada.

**Decisão do usuário em 12/08/2026: opção (a) — o grafo foi apagado (−1.360 linhas).**
Descartadas (b) ligar o grafo no lugar do lote e (c) manter os dois sincronizando dois
contratos à mão. `graph.py`, `test_graph.py` e o `graph.cpython-312.pyc` foram removidos;
o comentário do `serve.py` que citava `graph.py:305` foi reescrito para não deixar
referência órfã. Como os arquivos eram **untracked** (nenhum commit os contém, logo sem
rollback por Git), a cópia integral ficou em
`docs/video-ops/checkpoints/2026-08-12-graph.py.bak` e `2026-08-12-test_graph.py.bak` —
restaurar = copiar de volta para `video-worker/`.

Some com isso o risco do `variant_extra`: as 16 chaves de contrato passam a existir em um
lugar só (`worker.py:570`).

### Alterado

- `video-worker/serve.py` — `ensure_space` movido para antes do upload, com `length` como
  reserva (uma chamada cobre o que sobe e o que sai); `_drain()` + `unread`; `DRAIN_LIMIT`.
- `video-worker/test_serve.py` — provas 15/15b/15c (507, `no_space`, nenhum byte em disco),
  sem exigir FFmpeg.
- `.gitignore` — `__pycache__/` e `*.pyc`.
- `docs/video-ops/PLANO-DE-OPERACAO.md` — aviso vencido corrigido (BP-007).

### Checks

`node --check video-ops.js` OK · `node test-video-ops.js` ok · `node test-video-ops-dom.js`
ok · `py -3.12 video-worker\test_serve.py` **49** (era 46) · `test_worker.py` **89** ·
`git diff --check` só avisos LF→CRLF. (`test_graph.py` passava **110** antes da decisão (a);
foi apagado junto com o grafo que provava.)

**Falha pré-existente e não relacionada:** `node test-ponte.js` quebra em `test-ponte.js:96`
(`12a: esperava 10 SKUs, veio 2875`). A prova 12 depende de
`C:/Users/Teste/Downloads/isponível.txt`, arquivo pessoal **fora do repositório**, cujo
conteúdo mudou. É módulo Inventário Amazon, não Estúdio de Vídeos. Não foi tocado — ver
Itens pendentes.

### Sem baseline

Nada de desempenho, alcance ou publicação foi medido: continua sem contas, sem fontes
autorizadas e sem posts. Este ciclo só mexeu no que é verificável hoje (código e teste).

### Métrica deste ciclo

- **Principal:** cortes perdidos por disco cheio — antes o disco enchia calado; agora a
  recusa é 507 `no_space` com o motivo em português. Contagem só começa com uso real.
- **Secundárias:** provas de `test_serve.py` 46 → 49; recusas que entregam o próprio motivo
  ao navegador: antes nenhuma com corpo grande, agora todas até 64 MB; linhas de produção
  somadas: +23 em `serve.py`.

### Itens pendentes

1. ~~**Decisão do usuário sobre `graph.py`**~~ — **resolvido em 12/08/2026: opção (a)**, o
   grafo foi apagado. Nada pendente aqui.
2. **Desestagiar os `.pyc`** — o `.gitignore` impede novos, mas dois já estão no índice.
   O gate de segurança da sessão bloqueou `git rm --cached` duas vezes e a rota não foi
   forçada. Um comando, quando o usuário quiser:
   `git rm --cached -r video-worker/__pycache__`
3. **`.src` acumulado no `%TEMP%`** — a guarda impede encher o disco, mas nada apaga a
   fonte em cache antes do encerramento do `serve.py`. Candidato ao próximo ciclo; precisa
   de política de descarte, não de mais uma guarda.
4. **Tetos divergentes de duração:** `worker.MAX_CUT_SEC` = 600 s e
   `serve.DEFAULT_MAX_SECONDS` = 900 s. Um corte de 700 s é aceito pela rota diária e
   recusado pelo caminho de lote. Só registrado; não é risco.
5. **`test-ponte.js` acoplado a arquivo pessoal** — a prova 12 deveria usar fixture no
   repositório ou ser marcada como opcional. Módulo alheio a este agente.

### Próxima ação recomendada

Responder o item 1. Depois disso, o próximo problema **comprovado** é o item 3 (fontes
acumuladas no temporário). Nada disso desbloqueia o piloto: o que falta ali continua sendo
material autorizado seu, conforme `PILOTO.md §6`.

---

## 18/08/2026 — descoberta de cortes por URL e camada de edição Remotion

Pedido do usuário: dar ao Estúdio um caminho que comece numa URL do YouTube, sugira os
melhores momentos, deixe **uma pessoa** escolher e ajustar, baixe **só** o trecho aprovado
e mande para uma camada de edição em Remotion. Ordem de implementação foi dada por ele e
seguida.

### O que já existia (auditado antes de escrever qualquer linha, BP-007)

O Estúdio já cortava vídeo ponta a ponta — para **arquivo local**. `video-ops.js` (244 KB)
com marcação de in/out, `video-worker/serve.py` na 8765 e `worker.py` com FFmpeg, 9:16,
escrita atômica e guarda de disco. Mais importante: o `clip` guardado no `pp_video_ops_v1`
**já tinha** `inSec/outSec/hook/topic/reason/score` e o estado
`candidate → selected → editing → review → approved`. Ou seja, o schema de "candidato a
corte" que o pedido descrevia já estava no código — não houve migração.

O que faltava era só: (a) entrar por URL, (b) sugerir os momentos, (c) editar de verdade.

### Alterado

- **`video-worker/ytclip.py` (novo, 540 linhas).** Descoberta sem baixar vídeo. `probe()`
  faz UMA chamada ao yt-dlp (`--dump-single-json`) e um GET na legenda json3 cujo endereço
  o próprio dump devolve — dezenas de KB para um podcast de horas. `candidates()` é pura e
  cruza três sinais: o `heatmap` de "Mais reproduzidos" que o YouTube publica na página
  (100 baldes, dado observado, **não** analytics privado), os capítulos declarados, e a
  legenda (pergunta, número, ênfase, pausa longa). Sinais que caem no mesmo ponto fundem
  num candidato só e somam confiança. `cues_for_range()` recorta as falas do trecho e zera
  o relógio no começo do corte. `fetch_section()` baixa só a faixa aprovada.
- **`video-worker/serve.py`.** A guarda de rota única virou despacho por dicionário, então
  as três rotas novas (`/api/yt-probe`, `/api/yt-fetch`, `/api/remotion-render`) herdaram
  sem cópia o tratamento de erro que o corte já tinha. Nada do fluxo antigo mudou.
- **`studio/` (novo).** Projeto Remotion isolado, com `package.json` próprio. O
  `index.html` continua Vanilla JS sem npm. 1080x1920, fundo do próprio vídeo borrado,
  vídeo centralizado, título e legenda. `--public-dir` aponta para a pasta de cache, então
  **nenhum byte de vídeo é escrito dentro do repositório** — a mesma regra que o serve.py
  já seguia.
- **`.claude/skills/remotion-edit/SKILL.md` (novo).** Skill de edição, com a tabela de
  "qual pedido mexe em qual arquivo" e a proibição de redesenhar o projeto.

### Dois defeitos achados e corrigidos, os dois por prova

1. **Heatmap plano virava vídeo inteiro em destaque.** Com todos os baldes iguais o desvio
   dá 0, o corte `média + desvio` cai em cima da própria média e **todo** balde passava —
   o vídeo inteiro seria sugerido. Pego pela prova `3f`. Correção: desvio abaixo de 2% do
   topo descarta o sinal inteiro, em vez de virar sugestão que finge medir audiência.
2. **403 no download de faixa.** `--download-sections` obriga o downloader FFmpeg, que
   refaz o pedido com User-Agent de Chrome; o cliente padrão (`ANDROID_VR`) devolve URL
   casada com outro agente e o YouTube recusa. O sintoma era
   `ffmpeg exited with code 3436169992`, que não diz nada. Medido cliente por cliente: só
   `web_embedded` entrega 1080p (`tv`, `web`, `android`, `mweb`, `tv_simply` caem em 360p;
   `ios` e `web_safari` não negociam formato). Fixado `web_embedded,tv,web` e o FFmpeg do
   projeto via `--ffmpeg-location`, para não misturar duas versões do binário.

### Checks

- `py -3.12 video-worker/test_ytclip.py` → **58 ok** (novo; sem rede, fixture sintética)
- `py -3.12 video-worker/test_serve.py` → **49 ok** (não mexeu; sem regressão)
- `py -3.12 video-worker/test_worker.py` → **89 ok** (não mexeu; sem regressão)
- Rotas exercitadas por HTTP de verdade: 404 em rota inexistente, `job_invalid` em host
  alheio, `cut_invalid` em fim antes do início, `input_missing` (409) em token sumido.
- Render provado ponta a ponta: HTTP 200, 1080x1920, h264+aac, e **o frame foi olhado**.

### Medição

- Análise de um vídeo de 18min: **~6 s, zero byte de vídeo**.
- Trecho de 34 s de um vídeo de 18min: **3,8 MB baixados**. Trecho de 30 s de um vídeo de
  124 MB: **10,6 MB — 3% do arquivo**. É a resposta medida para "não baixar o vídeo todo".
- Render de 10 s: **~150 s**. Teto conhecido: quase tudo é o `npx remotion render`
  refazendo o bundle a cada chamada. Caminho de melhora, se incomodar: `@remotion/bundler`
  com bundle reaproveitado. Não mexer na composição.

### Direitos autorais

`PESQUISA_FERRAMENTAS.md` §10 declara o yt-dlp "exceção aprovada caso a caso para fonte
cujo direito e termos permitam download". Respeitado: **analisar** (metadados e legenda,
zero mídia) é livre; **baixar mídia** passa pelo portão de autorização que já existia. Sem
`--exec`, sem `--netrc-cmd`, sem cookies de navegador, sem aria2c; `--ignore-config` para
que nenhum `yt-dlp.conf` da máquina reintroduza o que a auditoria proibiu; e a URL
entregue ao processo é reconstruída a partir do id validado, nunca a string colada.

### Itens pendentes

1. Render de 10 s leva 150 s (teto acima). Só otimizar com dor medida.
2. Os trechos baixados vivem no temporário do `serve.py` e morrem no encerramento —
   mesma questão do item 3 do ciclo 2, agora com um segundo produtor de arquivo.
3. Presets: só `legenda` e `limpo`. Palavra destacada, zoom, transição, trilha, marca e
   abertura/encerramento ficaram de fora **por decisão explícita** — a base tinha que
   renderizar certo antes de ganhar recurso.

---

## 18/08/2026 (2) — foco editorial de negócios e preset BUSINESS_SERIOUS

Pedido do usuário: o sistema é para cortes de podcast de **negócios em PT-BR**, e o
resultado tem que parecer profissional e sério — não edição genérica de TikTok. Regra dele,
literal: *"strong content → correct clip → clear communication → subtle editing → authority"*,
nunca *"effects → effects → effects"*. Ele deu a ordem de implementação; foram feitos os
itens 1 a 4, e os itens 5 a 8 ficaram **explicitamente** de fora desta etapa.

### Alterado

- **`video-worker/ytclip.py`** (563 → 785 linhas). `classify_segment()` puro com léxico
  PT-BR em 13 categorias → campo `category`. **Não entra em `signals`**: `signals` é
  evidência (heatmap/capítulo/fala) e classificação é palpite tirado das palavras; deixar as
  duas no mesmo campo faria um palpite se passar por medição. `_dangling_opener()` detecta
  corte que abre com conector solto e o `_window` recua para um começo limpo; quando não dá,
  sai `contextWarning`. Duração passou a ser dirigida pela IDEIA: fecha em fim de frase mais
  pausa ou em troca de assunto — 25 s para uma tese, ~70 s para uma história, em vez de
  todo corte gravitar para os 45 s do alvo antigo.
- **`studio/src/preset.js`** (novo) — todos os números da direção visual num lugar só, e a
  lógica pura de quebra de linha e de ênfase. **`studio/src/Clip.jsx`** reescrito sobre ele,
  com Inter e Montserrat via `@remotion/google-fonts`.
- **`video-ops.js` / `serve.py`** — `category` e `contextWarning` passaram a atravessar a
  ponte inteira. Estavam sendo produzidos e descartados no caminho.

### Três defeitos achados olhando o frame, não o teste

1. **`transform: scale(1.05)` na palavra destacada comia o espaço seguinte.** A escala
   cresce o glifo mas não a caixa de layout: em "Faturamento" os 5% transbordam ~17px e o
   render saiu "Faturamentonão". Em palavra curta (`40%`, `erro`) o defeito não aparece, o
   que o tornava fácil de não ver. Corrigido tirando a escala — a spec pede escala como
   opção ("may receive"), e cor mais peso 900 já carregam a ênfase.
2. **Vídeo ocupava 37% do quadro** e sobrava faixa escura demais para parecer premium.
   `videoEscala` 1.18 → 1.45 e centro 0.42 → 0.40.
3. **Fundo desfocado escuro demais**, lendo como tarja preta em vez de preenchimento.

### Dois campos produzidos e jogados fora (achados costurando a ponta)

`ytCandidateClips` gravava `contextWarning: ''` fixo e ignorava `category`. O detector
classificava e avisava, e nada disso chegava na tela nem na cor do destaque. Os dois agora
sobrevivem ao probe, ao recarregamento e à edição do corte — a categoria acompanha o corte
mesmo quando o recorte muda, porque ela é do ASSUNTO, não do intervalo.

### Decisão de design registrada

**A legenda não anima.** A skill `emil-design-eng` é explícita: o que o usuário vê dezenas
de vezes não deve animar, e o próprio briefing proíbe "constant text movement". Movimento
nesta composição só entra com razão semântica — que é exatamente o item 5 da ordem de
prioridade, ainda não implementado.

### Checks

`node studio/test-preset.mjs` **45 ok** (novo) · `py -3.12 video-worker/test_ytclip.py`
**102 ok** (58 antigos + 44 novos, com 5 mutações confirmadas) · `test_serve.py` 49 ·
`test_worker.py` 89 · `test-video-ops.js` · `test-video-ops-dom.js` ·
`test-video-ops-e2e.js` · `test-ytclip-ui.js`. Oito suítes, zero regressão.
Render conferido com legenda real de negócios em português e **o frame foi olhado** — duas
vezes, antes e depois das correções.

### Itens pendentes

1. Ordem de prioridade do usuário, itens 5 a 8: zoom semântico, dessaturação em momento
   pesado, frase de impacto em tela cheia. **Nada disso deve virar regra por tempo** —
   "adicione zoom a cada 3s" foi proibido por escrito.
2. Gancho automático (seção 11 do pedido) ainda não existe: `title` é manual e nasce vazio.
3. Ritmo (seção 12): remover silêncio e repetição preservando pausa intencional. Não
   começado; mexe no corte, não na composição.
4. O léxico de categorias é PT-BR feito à mão. Vai errar em jargão de nicho — corrigir com
   caso real na mão, não com stemmer que ninguém consegue auditar.
