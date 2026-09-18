# Pendências

Lista única do projeto. Cada item diz: **o que fazer · estado · pronto quando · do que depende ·
onde estão os detalhes.** O estado geral do projeto é `../01-Wiki/ESTADO-ATUAL.md`.

## Em execução

- [ ] Nenhuma.

## Próximas

- [ ] **CP2 do `PLANO-descricao-hashtags.md` — declarar os conjuntos de hashtag e confirmar
  os padrões de descrição.** Estado: a fazer · Pronto quando: as duas tabelas do `INDEX.md`
  do vault `Cortes` não tiverem mais `(a definir)` · Depende de: **decisão do usuário**, nada
  técnico · Detalhes: o plano, §4 CP2.

- [ ] **CP3 do `PLANO-descricao-hashtags.md` — o script de leitura dos clips.**
  Estado: a fazer · Pronto quando: rodando contra fixture no repositório, agrupar por
  `descricao_padrao` e `hashtags_set`, respeitar os quatro cortes de amostra do §3 e recusar
  comparar grupos com `variavel_testada` diferente · Depende de: nada (a fixture substitui o
  vault no teste) · Detalhes: o plano, §4 CP3. Python stdlib, caminho do vault por argumento —
  nunca cravado, pelo motivo que quebrou o `test-ponte.js`.

- [ ] **CP4 do `PLANO-descricao-hashtags.md` — o gerador de descrição/hashtag no Estúdio.**
  Estado: a fazer, **último de propósito** · Pronto quando: um clip real gerar descrição e
  hashtags no clipboard e `.\provas.ps1` seguir verde · Depende de: CP2 e CP3 ·
  Detalhes: o plano, §4 CP4. É o único CP que toca `video-ops.js`.

- [ ] **Reescrever o plano `004` (Content-Security-Policy) antes de executá-lo.**
  Estado: a fazer · Pronto quando: existir um plano de CSP escrito contra o `index.html` de
  hoje · Depende de: nada · Detalhes: `plans/004-add-content-security-policy.md` e a tabela de
  status em `plans/README.md`. Conferido em 2026-09-14: **não há CSP no `index.html`**, e o
  plano original de 2026-07 aponta para módulos que já saíram.

## Bloqueadas

- **CP6 do `PLANO-2-fundo-visivel.md`** — conferir a escala da fonte baixada
  (`source_scale`/`sourceWarning`) com uma fonte REAL.
  Estado: bloqueado · Pronto quando: uma fonte real passar pelo portão e a escala bater ·
  Depende de: rede **e** do portão de direitos (declaração por URL) · Detalhes: o plano.
  Os CP1-CP5 já entregaram o valor do plano.

- ~~**Prova A do lançamento**~~ e ~~**Prova B do lançamento**~~ — **as duas foram
  respondidas em 2026-09-14.** Ver a seção *Concluídas*.

## Decisão aberta

- **Trocar a fonte da legenda por transcrição LOCAL (Whisper)?**
  Estado: aberto, **não decidido e não medido** · Pronto quando: houver uma decisão escrita em
  `../03-Decisions/` · Depende de: decisão do usuário sobre três coisas que ninguém mediu —
  dependência nova num projeto que é stdlib no Python e Vanilla JS sem npm, modelo baixado na
  máquina, e se a transcrição local ganha mesmo da legenda do YouTube em PT-BR ·
  Detalhes: `PLANO-legenda-tempo-por-palavra.md` e
  `../01-Wiki/archive/HISTORICO-estudio-video.md` (l. 146).
  O que o tempo por palavra **já** resolve: onde a linha quebra. O que ele **não** resolve:
  palavra errada, `[ __ ]` e pontuação duvidosa — isso vem do reconhecedor do YouTube.

## Trabalho futuro — não iniciado

Planejamento, não implementação. Nada aqui está no ar.

- ~~**Acessar o Estúdio pela internet, com acesso restrito ao proprietário.**~~
  **CANCELADO em 2026-09-14 (decisão do usuário).** O Estúdio deixou de ser produto
  para vender e virou instrumento de uso pessoal: um usuário, uma máquina, motor local.
  As Provas A e B foram fechadas nesse sentido em `../03-Decisions/LANCAMENTO-decisoes.md`,
  e a receita de nuvem daquele arquivo virou registro histórico. Retomar exige objetivo
  novo e plano novo. Estado anterior, para registro: a fazer, não iniciado · dependia das
  Provas A e B · detalhes em `../../PASSO-A-PASSO.md` (fase "Vercel servindo a página +
  motor local").
  **Resolvido em 2026-09-14 (decisão do usuário): a pasta `cloud/` foi APOSENTADA.** Saiu da
  árvore no commit `9d726ef "melhora edit"` (`Dockerfile`, `probe_server.py`,
  `test_probe_server.py`, 663 linhas) e **não será restaurada**; o código fica preservado no git
  (`git show 9d726ef^:cloud/probe_server.py`). A regra `.claude/rules/lancamento-cloud.md` já não
  carrega por `cloud/**` e virou registro nessa parte — só `web/` segue ativo. Retomar a análise
  na nuvem exige plano novo.

- **Integração com TikTok — não implementada.** Estado: a fazer, não iniciado · Pronto quando:
  houver decisão e implementação · Depende de: **reconferir os requisitos oficiais da API
  antes de qualquer implementação** — nada foi aprovado nem verificado · Detalhes:
  `../video-ops/PILOTO.md` (publicação manual, com aprovação humana) e
  `../video-ops/PLANO_AUTOMACAO_VIDEO.md`.

## Concluídas

- **2026-09-14 — as duas provas do lançamento, fechadas por mudança de objetivo.**
  O Estúdio deixou de ser produto para vender e passou a ser instrumento de uso pessoal
  do dono. **Prova A:** a pergunta deixou de existir — o motor não vai para a nuvem, o
  yt-dlp roda na máquina do dono em IP residencial (a condição já medida em 2026-08-26),
  então não há IP de datacenter a testar e o Passo 3 do `../../PASSO-A-PASSO.md` não
  será executado. **Prova B: postura (i) — só análise online**, a única das três que não
  muda uma linha de código, porque descreve o que o sistema já faz; (ii) e (iii) foram
  apagadas do arquivo de decisões conforme a instrução dele. **Atenção ao limite:** a
  (i) decide a postura da ferramenta, não a autorização para publicar — o portão de
  declaração por URL do `CLAUDE.md` e as fontes autorizadas do `../video-ops/PILOTO.md`
  §6 continuam valendo iguais. Detalhes: `../03-Decisions/LANCAMENTO-decisoes.md`.

- **2026-09-04 — `PLANO-1-tags-cor-remotion.md`.** As QUATRO tags de cor no caminho Remotion.
  `worker.COR_BSF` + `-bsf:v h264_metadata` no passe que já existia, sob guarda
  `videoCodec == "h264"` — sem ela o passe morre em stream não-H.264 e o clipe sai **sem
  normalizar o áudio**, que é audível e importa mais que duas tags informativas. O passe de
  áudio virou passe de acabamento (`normalize_audio` → `finish_video`) e os DOIS ramos passaram
  a produzir arquivo. Checks `16n`–`16x` em `test_worker.py`, todos rodando `ffprobe` em arquivo
  real. **Registrado como pendente até 2026-09-14 por engano** — a conferência contra o código
  não tinha sido feita.

- **2026-09-03 — `PLANO-qualidade-clip-tiktok.md`.** "Os clips não estão com qualidade boa o
  suficiente para postar": eram **seis** defeitos, três só visíveis olhando o quadro e o
  `ffprobe`. Números e medições viraram `../03-Decisions/CONTRATO-qualidade-clip.md`.

- **2026-09-01 — `PLANO-destaque-titulo.md`.** `preset.pickTitleHighlight` destaca UM trecho do
  título por **peso** (Montserrat 800 → 900 com filete), nunca por cor.

- **2026-08-28/31 — `PLANO-legenda-tempo-por-palavra.md` (a parte que foi decidida).** Tempo por
  palavra por `ytclip.parse_json3_words` → `captions.cues_from_words`; karaokê no `Clip.jsx`.
  `parse_json3` ficou byte a byte igual de propósito. A troca por Whisper continua em
  "Decisão aberta".

- **2026-09-08 — `PLANO-3-dupla-compressao.md` (Fase 1; a Fase 2 não acontece).** O ENCODE 1 do
  yt-dlp foi medido: `crf=23 preset=medium`, **47,46 dB PSNR / 0,9932 SSIM** contra o stream copy
  do mesmo trecho — o portão do §2.1 manda PARAR em ≥45 dB. A opção C (CRF menor) caiu pela mesma
  medição: +2,4 dB por +78% de arquivo. **Nenhuma linha de produção mudou**, que é o desfecho de
  sucesso previsto no plano. Números e armadilhas no §8 do plano.

- **2026-09-04 — `PLANO-2-fundo-visivel.md` (CP1-CP5).** `X-Clip-Background` nas duas
  rotas do 9:16, condicional (o `horizontal` não emite). `BACKGROUND_NONE` (não havia
  miniatura) e `BACKGROUND_UNREADABLE` (havia e não abre) saem DISTINTOS, cada um com
  frase própria na tela — antes os dois davam o mesmo letterbox e o motivo ia só ao
  console (BP-008). 4 sabotagens reprovadas em cópia temporária. 1397 verificações.