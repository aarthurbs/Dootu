# Fluxos → "n8n meio-termo" (client-side) — backlog do loop

Decisão do usuário (2026-07-27): recriar a **experiência** do n8n 100% no navegador, com
**execução real só dos nós de Código** num sandbox (Web Worker, sem rede, sem backend, sem npm).
Trabalho **direto no `main`, sem commit** — o usuário revê o diff acumulado. Para quando o backlog
acabar. Respeita todas as regras do CLAUDE.md (estático, sem IA runtime, sem servidor).

## Fase 1 — Motor de execução (FEITO nesta rodada)
- [x] Web Worker sandbox: roda o JS do nó `Código` com `input`/`$json`, timeout 3s (mata loop infinito),
      `fetch`/`XHR`/`WebSocket`/`importScripts` bloqueados. Erro capturado e exibido.
- [x] `execOrder(board)` topológico (nós em ciclo ficam de fora) — puro/testável (`test-fluxos-exec.js`).
- [x] `runFlow()`: caminha o grafo em ordem, passa a saída de um nó como entrada do próximo;
      `Código` executa no worker, os outros são pass-through (documenta, não executa).
- [x] Botão "▶ Executar" na toolbar + resultado por nó (✓ saída / ✗ erro / → pass-through) + estado visual.
- [x] Início pode semear dados: se o corpo for JSON válido, vira a entrada inicial; senão `{}`.

## Fase 2 — Polimento estilo n8n (loop continua aqui)
- [x] Importar / Exportar o quadro como JSON (download + colar/upload).
- [x] Duplicar nó (Ctrl+D ou botão) e deletar por tecla Delete quando o nó está focado.
- [x] Decisão com 2 saídas (true/false): o código retorna boolean e a execução segue o ramo certo.
- [x] Painel lateral de config do nó (edição maior, sem apertar o card).
- [x] Minimapa no canto + "enquadrar tudo" (fit view) e "resetar" a posição.
- [x] Múltipla seleção (box-select) + arrastar em grupo.
- [x] Undo/redo (histórico curto em memória).
- [x] Notas/sticky e frames de agrupamento.

## Regras de execução do loop
- Cada item: menor diff que funciona, verificado (`node --check` + `test-fluxos*.js` + smoke DOM) antes de seguir.
- Nada de dependência nova, nada de backend, nada que rode em `file://` sem avisar (worker exige http://localhost).
- Documentar no CLAUDE.md e na memória quando a decisão/feature mudar.
