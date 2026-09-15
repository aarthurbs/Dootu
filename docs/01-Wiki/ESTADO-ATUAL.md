# Estado atual

Última atualização: 2026-09-14
Branch: `estudio/hub-recomendacoes` · commit base: `2202ec1`

## Tarefa ativa

- Objetivo: entregar a tela **Resultados dos cortes** no Estúdio — registro manual de
  publicação e de medições, com comparação de formatos e análise de padrões.
- Plano utilizado: pedido direto do usuário nesta sessão.
- Status: concluída e validada (1782 verificações em 10 suítes, zero falhas).
- Escopo: interface local do Estúdio. Integração com API de plataforma **não** entra: o
  preenchimento é manual, conforme o pedido.

## Trabalho concluído

- **2026-09-14 — tela Resultados dos cortes.** Quarta tela do Estúdio (`video-results.js`,
  chave própria `pp_video_results_v1`). Registra publicação vinculada a um corte da Central
  ou avulsa, guarda várias medições por publicação com o carimbo de tempo de cada uma, e
  compara formatos por mediana. Três regras aritméticas governam tudo e têm check próprio:
  ausência não é zero (métrica não informada é `null` e sai como "não informado"); medições
  diferentes nunca são somadas (`medicaoDaJanela` escolhe UMA por publicação — última,
  ~24 h ou ~7 d — e no detalhe a coluna de evolução é subtração, não soma); e padrão é
  associação rotulada, não causa (com n, quantos cortes sustentam, exemplos, as duas
  medianas e hipótese de uma variável por vez; abaixo de 4 publicações medidas ou de 15% de
  diferença, a tela diz "dados insuficientes"). A taxa de engajamento só sai com fórmula e
  denominador à vista, usando apenas os componentes medidos — e taxas de componentes
  diferentes não são comparadas entre si. `pp_video_clips_v1` e `pp_video_projects_v1` são
  lidos e nunca escritos; há check que compara o texto bruto das duas chaves antes e depois
  de gravar. Regras em `.claude/rules/estudio-resultados.md`.

- **2026-09-14 — mudança de objetivo do projeto e fechamento das duas provas do
  lançamento.** O Estúdio deixou de ser produto para vender; passou a ser instrumento
  de uso pessoal do dono, para aprender a editar e registrar o que funciona ao publicar.
  Prova A perdeu o objeto, Prova B ficou na postura (i). Nenhuma linha de código mudou —
  a (i) descreve o comportamento atual. Detalhes e limites em
  `../03-Decisions/LANCAMENTO-decisoes.md` e na seção *Versão online* desta nota.
- **2026-09-14 — navegação simplificada.** Central é a tela inicial. As etapas
  Vídeo, Cortes e Revisão não aparecem nem podem ser reabertas pela navegação.
  A Central vazia aponta para o YouTube; o resultado sem sugestões não oferece
  o fluxo removido. Projetos, clips salvos e edição dos trechos do YouTube permanecem.
  Helpers do antigo fluxo local continuam internos, sem telas acessíveis.
- **`PLANO-3-dupla-compressao.md` — Fase 1 encerrada em 2026-09-08; a Fase 2 não acontece.**
  O portão do §2.1 manda parar em ≥ 45 dB, e a medição registrada no §8 é **47,46 dB PSNR y /
  0,9932 SSIM Y** de A contra C, com o ENCODE 1 do yt-dlp em `libx264 crf=23 preset=medium`.
  Vale a **opção A — não mexer**; a opção C caiu na mesma medição (+2,4 dB por +78% de
  arquivo). Nenhuma linha de código de produção mudou, que é o desfecho de sucesso previsto
  no plano. Fontes: `PLANO-3-dupla-compressao.md` §8 e §8.1, `CLAUDE.md` (Estúdio de Vídeos —
  regra de topo), `PENDENCIAS.md` (Concluídas), `CONTRATO-qualidade-clip.md` §0.2.
- **`PLANO-2-fundo-visivel.md` — CP1-CP5 entregues em 2026-09-04.** Fonte: `PENDENCIAS.md`
  (Concluídas).

## Conferido em 2026-09-08 sem novo download

Reconferência documental por `ffprobe` no arquivo A da Fase 1, que continua em disco
(`~/Videos/Cortes Estudio/bNkQaTQ4SE0-415-461.mp4`). Bate com o §8 do plano:

- SEI do x264: `rc=crf`, `crf=23.0`, `keyint=250`, `ref=3 me=hex subme=7 bframes=3
  rc_lookahead=40 trellis=1 8x8dct=1` (assinatura do preset `medium`); tag
  `encoder=Lavc61.19.100 libx264`.
- Keyframes em 0 · 10,4167 · 20,8333 · 31,25 · 41,6667 s — 250 quadros a 24 fps.
- 1920x1080, 24 fps, 46 s, 1104 quadros; bitrate 1.709.045 bps (vídeo) / 1.843.841 bps
  (arquivo).

Isso confirma a **identidade do ENCODE 1**, não o número que decidiu o plano.

## Evidência indisponível

- **O PSNR A × C não foi refeito.** Os arquivos B (yt-dlp sem `--force-keyframes-at-cuts`) e C
  (recorte exato sem recodificar) não estão mais em disco; reproduzi-los exigiria novo
  download, que passa pelo portão de direitos do §5 do plano. A decisão continua sendo a
  registrada no §8 — **a ausência dos arquivos não é motivo para reabrir a Fase 2**, e o
  `CLAUDE.md` exige "número novo" para reabrir.

## Arquivos modificados

Na entrega de Resultados dos cortes: **novos** `video-results.js`, `test-video-results.js`
e `.claude/rules/estudio-resultados.md`; **alterados** `index.html` (uma tag `<script>`),
`video-ops.js` (5 linhas de fiação + a tela de fallback), `video-ops.css` (bloco `.res-*`
no fim), `test-video-ops-dom.js` (o guard da barra passou a 4 telas, mais 7 provas de
fiação), `provas.ps1` (a décima suíte), `CLAUDE.md`, `.claude/rules/estudio-ui.md`, esta
nota e `docs/log.md`. Nenhum commit ou publicação realizado.

Na entrega anterior (simplificação para três telas): `video-ops.js`,
`test-video-ops-dom.js`, o comentário inicial de `test-video-ops.js`, `CLAUDE.md`,
`.claude/rules/estudio-ui.md`, esta nota e `docs/log.md`.

## Validações executadas

- **Resultados dos cortes, 2026-09-14:** `.\provas.ps1` → **1782 verificações nas dez
  suítes, zero falhas**, total conferido automaticamente contra o `CLAUDE.md`. Inclui as 46
  provas novas (`test-video-results.js`) e as 141 do DOM. `node --check` nos dois módulos.
  `node test-video-ops-rec.js` (fora do `provas.ps1`) também rodado: aprovado.
- Conferido no navegador em `http://127.0.0.1:8971/index.html` (servidor estático
  temporário): aba Resultados monta, cadastro com validação grava e persiste, duas medições
  da mesma publicação convivem, a evolução mostra **+5.600** (9.800 − 4.200) e a soma 14.000
  **não** aparece em lugar nenhum, a taxa sai como
  `(Curtidas + Comentários + Compartilhamentos) ÷ Visualizações = 752 ÷ 9.800` — sem
  Salvamentos, que não foram medidos —, e cada cartão de padrão traz o rótulo "associação
  observada, não causa comprovada". **Os dados usados na conferência eram descartáveis e
  foram apagados**: ao final, `pp_video_results_v1` voltou a `null` e a tela ao estado
  vazio. Nenhum resultado inventado ficou gravado.
- Único erro de console na página: `supabase-sync.js` 404 — **pré-existente**, alheio a
  esta entrega (a tag está no `index.html` e o arquivo não existe na árvore).

- Sintaxe de `video-ops.js` e testes DOM aprovados na verificação inicial.
- Navegação conferida no navegador em `http://127.0.0.1:8765/index.html`:
  Central inicial, Meus projetos e Novo projeto → YouTube. Visual da Central conferido.
- Suíte completa `.\provas.ps1`: **1728 verificações nas nove suítes, zero falhas**;
  contagem conferida automaticamente contra `CLAUDE.md`. Inclui 133 provas DOM.
- `git diff --check`: aprovado.
- **Reconferido em 2026-09-14, na sessão de organização:** `.\provas.ps1` rodado de novo,
  **1728 verificações nas nove suítes, zero falhas**, total conferido automaticamente contra o
  `CLAUDE.md`. Serviu para fechar o PLANO-1 com evidência — inclui os checks `16n`–`16x` do
  `test_worker.py`, que produzem arquivo e leem o cabeçalho do FFmpeg. Nenhuma linha de código
  mudou nesta sessão.

## Problemas e bloqueios

- **Bloqueado:** CP6 do `PLANO-2-fundo-visivel.md` — conferir a escala de uma fonte REAL
  (`source_scale`/`sourceWarning`). Precisa de rede e passa pelo portão de direitos.
- ~~`docs/01-Wiki/operacao-cortes/INDEX.md` aponta para `LICOES.md` e `../_templates/clip.md`~~
  **Resolvido em 2026-09-14 por decisão do usuário:** o dono do assunto "operação de cortes"
  passou a ser o vault `Cortes` da Usee. `Licoes.md` e `_modelo-clip.md` do repositório eram
  byte-a-byte iguais aos de lá e foram removidos; *Objetivo* e *Fluxo* foram consolidados no
  `INDEX.md` daquele vault, e `01-Wiki/operacao-cortes/INDEX.md` virou o ponteiro que registra
  a mudança. `docs/_templates/` fica — tem campos que o modelo de lá não tem.
- ~~A pasta `cloud/` sumiu da árvore~~ **Resolvido em 2026-09-14: aposentada, por decisão do
  usuário.** O commit `9d726ef "melhora edit"` removeu `cloud/Dockerfile`,
  `cloud/probe_server.py` e `cloud/test_probe_server.py` (663 linhas) junto de mudanças não
  relacionadas. **Não será restaurada:** o código fica preservado no git
  (`git show 9d726ef^:cloud/probe_server.py`) e `.claude/rules/lancamento-cloud.md` deixou de
  carregar por `cloud/**` — nessa parte virou registro, e só `web/` segue ativo.

## Versão online — CANCELADA em 2026-09-14

**O Estúdio roda só localmente e é assim que vai ficar** (`http://127.0.0.1:8765`, via
`estudio.ps1`). Acessá-lo pela internet deixou de ser trabalho futuro e passou a ser
trabalho cancelado: o projeto mudou de objetivo — não é mais produto para vender, é
instrumento de uso pessoal do dono. Um usuário, uma máquina.

Com isso as duas provas de `../03-Decisions/LANCAMENTO-decisoes.md` foram fechadas no
mesmo dia: a **Prova A** perdeu o objeto (o motor não vai para a nuvem, então não há IP
de datacenter a testar) e a **Prova B** ficou na **postura (i) — só análise online**, que
é o que o código já faz. A receita de nuvem daquele arquivo virou registro histórico.

**O que NÃO mudou com isso:** o portão de direitos continua inviolável — analisar metadados
e legenda é livre, baixar mídia exige declaração explícita conferida duas vezes e válida por
URL. E publicar corte de terceiro continua exigindo autorização da fonte
(`../video-ops/PILOTO.md` §6). A mudança de objetivo apaga trabalho de infraestrutura,
não apaga obrigação jurídica.

A **integração com TikTok também não foi implementada**: não há aprovação de API registrada, e
os requisitos oficiais precisam ser reconferidos antes de qualquer implementação. Com a
publicação manual e aprovação humana do piloto, ela não é necessária para operar.

## Próximo passo exato

1. Abrir o Estúdio na aba **Resultados** e registrar a primeira publicação de verdade
   (plataforma, perfil e data/hora bastam). Voltar depois de ~24 h e de ~7 dias para anotar
   as métricas — a tela só começa a comparar formatos com 4 publicações medidas, e é assim
   de propósito. Esta mudança está concluída. A preparação da versão pública permanece para
   uma etapa posterior; não publicar automaticamente.
2. **Próximo trabalho do projeto: reescrever o plano `004` (Content-Security-Policy).** É o
   único item de `../02-Execution/PENDENCIAS.md` que não depende de decisão sua nem de rede.
   Conferido em 2026-09-14: **não há CSP no `index.html`**; o plano original é de 2026-07 e
   aponta para módulos que já saíram, então precisa ser reescrito antes de executado.

### Correção de 2026-09-14 — os seis planos do Estúdio já estavam entregues

A organização documental do dia registrou `PLANO-1-tags-cor-remotion.md` como "a fazer" **sem
conferir o código**, que é justamente o erro que o LINT existe para pegar. Conferido depois:
os seis planos de `../02-Execution/` estão entregues, cada um com fechamento datado em
`archive/HISTORICO-estudio-video.md` — PLANO-1 (l. 305), qualidade p/ TikTok (l. 249),
destaque no título (l. 172), tempo por palavra (l. 136/147). **A camada de execução não tinha
nenhum trabalho ativo.** Cada plano ganhou um cabeçalho de estado datado no topo; o que
continua aberto está em `PENDENCIAS.md`: o CP6 do PLANO-2 (bloqueado), as Provas A e B do
lançamento (decisão sua), a troca por Whisper (decisão aberta) e o CSP.

## Comandos para retomada

```bash
git status --short
git diff --stat
git diff
```
