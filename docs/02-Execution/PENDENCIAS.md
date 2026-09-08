# Pendências

## Em execução

- [ ] Nenhuma.

## Próximas

- [ ] Executar `PLANO-1-tags-cor-remotion.md`

## Bloqueadas

- **CP6 do `PLANO-2-fundo-visivel.md`** — conferir a escala da fonte baixada
  (`source_scale`/`sourceWarning`) com uma fonte REAL. Precisa de rede e passa pelo
  portão de direitos (declaração por URL); os CP1-CP5 já entregaram o valor do plano.

## Concluídas

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