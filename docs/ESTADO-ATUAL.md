# Estado atual

Última atualização: 2026-09-08
Branch: `agent/legenda-no-video-2026-08-27` · último commit: 2026-09-02 `web`

## Tarefa ativa

- Objetivo: nenhuma tarefa em execução.
- Plano utilizado: —
- Status: não iniciada
- Próximo plano previsto: `PLANO-1-tags-cor-remotion.md` (fonte: `PENDENCIAS.md`, seção "Próximas").

## Trabalho concluído

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

Há trabalho não commitado na árvore: arquivos rastreados em `baixador/`, `studio/`,
`video-worker/`, `video-ops.js`/`.css`, `test-video-ops*.js` e `CLAUDE.md`, mais itens novos
não rastreados em `docs/` e `.claude/rules/`. O conteúdo desse diff não foi auditado nesta
atualização — conferir com `git status --short` e `git diff`.

## Validações executadas

- Nesta atualização, **nenhuma suíte foi executada**: foi uma tarefa só de documentação.
- Última contagem registrada da suíte do Estúdio: **1397 verificações em oito suítes, zero
  falhas** (fontes: `CLAUDE.md` e `PENDENCIAS.md`, entrada de 2026-09-04). Para reexecutar:
  `.\provas.ps1`.

## Problemas e bloqueios

- **Bloqueado:** CP6 do `PLANO-2-fundo-visivel.md` — conferir a escala de uma fonte REAL
  (`source_scale`/`sourceWarning`). Precisa de rede e passa pelo portão de direitos.
- `docs/operacao-cortes/INDEX.md` aponta para `LICOES.md` e `../_templates/clip.md`; em disco
  existem `docs/Licoes.md` e `docs/_modelo-clip.md`. Links quebrados, fora do escopo desta
  correção — não alterado.

## Próximo passo exato

1. Abrir `PLANO-1-tags-cor-remotion.md` e executá-lo — é o único item de "Próximas" em
   `PENDENCIAS.md`.

## Comandos para retomada

```bash
git status --short
git diff --stat
git diff
```
