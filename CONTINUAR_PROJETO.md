# Continuar projeto — Automação de Conteúdo em Vídeo

## Checkpoint

- **Data:** 12/08/2026
- **Última fase concluída:** **ciclo 2 do `video-growth-loop`** — auditoria a partir do grafo
  de execução; a rota de corte que o operador usa todo dia passou a conferir espaço em disco
  **antes** de receber o original, e toda recusa passou a entregar o próprio motivo ao
  navegador (antes: ciclo 1 e F1.2b)
- **Próxima fase:** piloto operacional com uma linha editorial e seis fontes autorizadas
- **Publicação:** manual/nativa com aprovação humana
- **Backend e APIs:** adiados; nenhum segredo no frontend/Drive/Git

### Decisão do ciclo 2, já tomada: o grafo foi apagado

`video-worker/graph.py` (580 linhas) + `test_graph.py` (780) tinham **zero chamadores**:
nenhum `.md`, `.ps1`, `.js` ou `.html` do repositório os mencionava. Quem corta no dia a dia
é o `serve.py`; quem faz variante com hash é o `worker.py` em lote. O grafo duplicava seis
blocos do `worker.py` — incluindo as 16 chaves de contrato de `variant_extra`, onde
`renderVersion` decide se a variante precisa de nova aprovação: manter dois lados à mão era
risco de aprovação silenciosamente errada.

**Decisão do usuário em 12/08/2026: opção (a) — apagar (−1.360 linhas).** Executado. Ficaram
descartadas (b) ligar o grafo no lugar do lote e (c) manter os dois sincronizando à mão.

Os arquivos eram **untracked**, então não há rollback por Git. Cópia integral antes de
apagar: `docs/video-ops/checkpoints/2026-08-12-graph.py.bak` e `2026-08-12-test_graph.py.bak`
— restaurar = copiar os dois de volta para `video-worker/` com o nome original. Detalhes e
números em `docs/video-ops/PROGRESSO.md` (12/08/2026).

**Rotina diária obrigatória: `CHECKLIST-DIARIO.md`** (raiz do projeto) — por onde abrir o
site, a bateria de verificação antes de commitar, o commit e o backup do fim do dia.

Este arquivo é o ponto de retomada. Ler antes de mexer em qualquer coisa:

1. `docs/video-ops/PROGRESSO.md` — o que foi feito em cada fase;
2. `docs/video-ops/PILOTO.md` — checklist, modelos de cadastro, benchmark e **o que
   depende de decisão do usuário**;
3. `docs/video-ops/CONTRATO_TRABALHADOR.md` — contrato navegador ↔ trabalhador local;
4. `docs/video-ops/PLANO_AUTOMACAO_VIDEO.md` — estratégia, TikTok/Reels, plano de 12 semanas;
5. `docs/video-ops/PESQUISA_FERRAMENTAS.md` — ferramentas, segurança e decisão de legendas;
6. `docs/video-ops/AGENTE_VIDEO_GROWTH_LOOP.md` — como acionar o agente, rubrica de
   qualidade e radar de tendências;
7. `docs/video-ops/REGISTROS.md` — experimentos e biblioteca de aprendizados.

## Aperfeiçoamento contínuo

Existe um agente nativo para conduzir os ciclos de melhoria:

```text
Execute um novo ciclo do video-growth-loop.
```

ou `/video-growth-loop [foco opcional]`. Definição em
`.claude/agents/video-growth-loop.md`; comando em `.claude/commands/video-growth-loop.md`.
Como são arquivos novos, podem exigir reiniciar a sessão (ou `/reload-plugins`) para
aparecerem na lista de agentes.

Limites por ciclo: uma melhoria principal, no máximo uma correção pequena relacionada.
"Nenhuma mudança necessária" é resultado válido. Sem dados reais, o agente marca
"sem baseline" em vez de inventar métrica ou tendência.

`chat-auditoria-video-ops.md` é o histórico original fornecido pelo usuário. Não apagar,
não modificar; é grande, usar busca dirigida.

## Estado real do código

Base preservada no Git:

- `b0f60c8` — baseline anterior;
- `4c6c90d` — F1.1 concluída;
- F1.2 **e** F1.2b estão no working tree e **ainda não foram commitadas**, por decisão do
  projeto de não commitar automaticamente.

Checkpoints em arquivo (rede de segurança sem commit):

- `docs/video-ops/checkpoints/F1.2-parcial-2026-07-31.patch` — diff interrompido original;
- `docs/video-ops/checkpoints/F1.2-estabilizada-2026-08-01.patch` — estado completo da F1.2;
- `docs/video-ops/checkpoints/ciclo1-antes-2026-08-02.patch` / `ciclo1-depois-...` — ciclo 1;
- `docs/video-ops/checkpoints/2026-08-12-antes.patch` — **ciclo 2**, estado dos arquivos
  versionados antes de mexer;
- `docs/video-ops/checkpoints/2026-08-12-serve.py.bak` e `2026-08-12-test_serve.py.bak` —
  cópia dos dois arquivos alterados no ciclo 2. Existem porque `serve.py` e `test_serve.py`
  são **untracked**: `git diff` não os preserva, então rollback por patch não funcionaria.
  Reverter o ciclo 2 = copiar os dois `.bak` de volta sobre `video-worker/`.
- `docs/video-ops/checkpoints/2026-08-12-graph.py.bak` e `2026-08-12-test_graph.py.bak` —
  cópia integral do grafo **apagado** no ciclo 2 (decisão (a)). Mesma razão: eram untracked,
  o Git não guarda o que nunca commitou. Restaurar = copiar de volta para `video-worker/`.

Arquivos de produção/teste alterados: `video-ops.js`, `video-ops.css`,
`test-video-ops.js`, `test-video-ops-dom.js`.

Arquivos novos: `video-worker/make_fixtures.py`, `docs/video-ops/CONTRATO_TRABALHADOR.md`,
`docs/video-ops/PILOTO.md`, além dos documentos criados em 31/07.

## O que a F1.2 entrega

1. Formatos: Vídeo TikTok, Reels, Stories e Vídeo no feed.
2. `placement` participa do snapshot de aprovação, pacote manual, checklist, CSV, cartões
   e formulário; trocar o formato exige nova aprovação.
3. Migração segura das aprovações da F1.1 que ainda não tinham o campo.
4. Aba **Visão geral** com indicadores das contas e fila consolidada.
5. Filtros de plataforma, linha, status e direitos; busca por conta/criador/formato.
6. Carregamento progressivo em lotes de 50; testado com 500 itens.
7. Publicação "Manual com aprovação humana"; nenhum estado falso de OAuth/conexão.

## O que a F1.2b acrescenta

1. **Histórico podado** (`LOG_LIMIT = 500`): antes crescia sem limite e podia encher a
   cota do `localStorage`, travando toda gravação.
2. **Métrica ausente é `null`, nunca zero** — a regra do projeto agora é cumprida pelo
   código: interface mostra `—`, CSV traz célula vazia, o relatório soma só o medido e
   informa quantos posts ficaram sem medição. Zero digitado continua valendo como medição.
3. `snapshotValues()` elimina um `JSON.parse`/`stringify` redundante dentro de laço.
4. Mídia sintética e prova executável do contrato do trabalhador.
5. Documentos do piloto, do contrato e do benchmark.

## Verificação executada em 01/08/2026

```powershell
node --check video-ops.js
node --check test-video-ops.js
node --check test-video-ops-dom.js
node test-video-ops.js          # 178 asserções
node test-video-ops-dom.js
py -3.12 video-worker\make_fixtures.py   # 16 verificações
git diff --check
```

Tudo passou. `git diff --check` mostrou apenas avisos de normalização LF→CRLF.

## Decisões que não devem ser desfeitas

- não criar servidor Node nem dependência npm no frontend;
- não guardar tokens/cookies/credenciais no navegador, Drive ou Git;
- não publicar automaticamente sem aprovação humana;
- não usar scraping nem login automatizado de TikTok ou Instagram;
- não instalar n8n, WhisperX, CUDA ou serviço pago no trimestre inicial;
- não instalar faster-whisper antes do benchmark PT-BR;
- não instalar `ffprobe` enquanto a leitura do cabeçalho do `ffmpeg` bastar;
- não renderizar listas inteiras; manter lotes de 50;
- qualquer alteração de texto, horário, formato, corte, fonte, autorização ou conta
  derruba a aprovação — publicação concluída é imutável;
- métrica indisponível é `null`, nunca zero;
- original nunca é sobrescrito; escrita atômica `.part` + rename;
- **escrita atômica de mídia exige `-f mp4` explícito** — o FFmpeg não deduz o container
  a partir da extensão `.part`.

## Skills

- **`ponytail-audit`:** disponível e **executada de verdade** em 01/08/2026. Os registros
  anteriores de indisponibilidade estavam corretos para aquelas sessões.
- **`emil-design-eng`:** não está registrada como skill de sessão, mas existe no repositório
  em `.agents/skills/emil-design-eng/SKILL.md` e `.claude/skills/emil-design-eng/SKILL.md`.
  Ler integralmente **antes** de qualquer trabalho de UI/CSS. Na F1.2b não houve mudança
  visual de layout, apenas texto de estado (`—` e a contagem de posts sem medição).

## Próxima ação concreta

O piloto está preparado e **não pode começar sem material seu**. As nove pendências estão
em `docs/video-ops/PILOTO.md §6`. As cinco bloqueantes:

1. qual é a linha editorial piloto;
2. os dois `@handle` (TikTok e Instagram), ou aviso de que serão criados;
3. as seis fontes autorizadas com a prova de cada autorização;
4. confirmação por fonte de plataformas, monetização, território, validade, direito de
   editar, música, voz/imagem e revogação;
5. disponibilidade semanal de revisão.

Sem 1–5, a próxima tarefa técnica segura é o **corpus PT-BR de ~10 minutos gravado por
você** (item 6), que destrava o benchmark de legendas. Nada será instalado antes disso.

## Fases posteriores

- **Trabalhador local:** implementar na ordem de `CONTRATO_TRABALHADOR.md §7`. Nunca publica.
- **F1.3 calendário:** adiado. Reavaliar com pelo menos 20 posts agendados ou conflitos reais.
- **Fase 3 APIs:** só no go/no-go da semana 12. TikTok sem auditoria publica apenas privado;
  Meta exige backend, token e URL pública da mídia. Se aprovado, Supabase Edge
  Functions/Vault/RLS conforme `docs/ARQUITETURA.md`; o navegador nunca recebe segredo.

## Comandos de retomada

```powershell
git status --short
git diff --stat
node --check video-ops.js
node test-video-ops.js
node test-video-ops-dom.js
py -3.12 video-worker\make_fixtures.py
py -3.12 video-worker\test_worker.py      # 89
py -3.12 video-worker\test_serve.py       # 49  (rota POST /api/video-cut)
```

`test_graph.py` saiu desta lista: o grafo foi apagado no ciclo 2 (decisão (a)) e o teste foi
com ele. Cópia em `docs/video-ops/checkpoints/2026-08-12-test_graph.py.bak`.

`node test-ponte.js` **falha desde antes do ciclo 2** e não é do Estúdio de Vídeos: a prova
12 (`test-ponte.js:96`) compara com `C:/Users/Teste/Downloads/isponível.txt`, arquivo pessoal
fora do repositório cujo conteúdo mudou (esperava 10 SKUs, veio 2875). É o módulo Inventário
Amazon. Corrigir = usar fixture no repositório ou marcar a prova como opcional.

Inspeção sem carregar arquivos grandes:

```powershell
rg -n "Fase|Status|Próxima ação|Decisões" docs/video-ops CONTINUAR_PROJETO.md
rg -n "placement|overviewHTML|visibleSlice|trimLogs|metricsOf" video-ops.js
```

Não commitar automaticamente. Antes de um commit, revisar `git diff` e decidir se
`chat-auditoria-video-ops.md` deve ou não ser versionado.
