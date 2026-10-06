# Decisão — Até 20 cortes por link, sem afrouxar o corte bom

**Data:** 2026-10-06 · **Quem decidiu:** o usuário (operador do Estúdio)

## Contexto
O teto era 12 (`ytclip.MAX_CANDIDATES`), sem medição por trás. Dois defeitos medidos em três
vídeos reais (140,7 / 40,6 / 20,1 min, legenda automática pt):
- O `break` do teto rodava na ordem das ÂNCORAS, antes de ordenar pela nota, e as de legenda vão
  em ordem cronológica. O teto guardava as primeiras janelas achadas, não as melhores.
- O teto nunca mordia: os três entregavam **1 · 6 · 11**. Quem limitava era onde o detector
  procurava (fala só virava âncora com 16+ pontos de gancho).
- O vídeo de 2h20 levava **97 s** na análise: o `_window` refazia o `sentences_from` a cada janela.

## Decisão
1. Teto **20** por link (`ytclip.MAX_CANDIDATES`, espelhado no `video-ops.js` e conferido por
   um check que LÊ o `.py`).
2. Toda âncora é avaliada; ordena por nota e **depois** corta no teto: as 20 melhores do vídeo
   inteiro. "Bom candidato" e "Vale conferir" entram, desde que passem pelo mesmo veto.
3. Segundo nível de âncora: fala com **uma marca forte** (12–15 pontos, `GANCHO_ANCORA_SEGUNDA`),
   tentada depois de todas as outras. Só soma janela em região livre e nunca muda borda ou nota
   de janela já achada (check 27i; medido: 0 mudanças nos 3 vídeos).
4. `_window` recebe as frases já calculadas e é memoizado por posição. A saída é byte a byte a
   mesma. O vídeo longo caiu de 97 s para 1,7 s (10 s com o segundo nível).
5. Os MP4 crus continuam sendo gerados um a um, por nota decrescente (`autoCutsQueue`, check).
6. Só link novo: projeto salvo mantém a lista que tem, sem nova análise e sem migração.

Resultado medido a 20: **4 · 20 · 20** cortes, todos 15–60 s, sem par sobreposto e sem veto.

## Por quê
Mais opções para escolher, sem baixar a régua do [contrato do corte bom](CONTRATO-corte-bom.md).
O teto escolhe entre aprovadas, nunca aprova. O vídeo longo continua com 4 porque o veto (fala
picada, abertura no meio da ideia) reprova o resto, e isso está certo.

## O que foi rejeitado
- **Afrouxar o veto** ou os pesos para chegar a 20. Lista curta é resultado aceito.
- **Aparar ideia longa** no minuto, porque produz corte que termina com a fala no ar.
- **Subir o pedido à MuAPI**: continua 12 (`muapi.NUM_HIGHLIGHTS`), porque é crédito pago (check 10a/10b).
- **Reanalisar links antigos**: ficam como estão.

## Status
Implementado e validado (`provas.ps1`: 2479). Sabido e não mexido: o resumo de descarte conta
TENTATIVAS, e com mais âncoras os números ficam grandes (ex.: "2814 não se entendiam sozinhos"
no vídeo de 2h20).
