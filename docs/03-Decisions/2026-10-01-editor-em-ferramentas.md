# Decisão — Editor do Estúdio em ferramentas, tela fixa, sem texto explicativo

**Data:** 2026-10-01 · **Quem decidiu:** o usuário (operador do Estúdio)

## O que foi decidido
1. Não é sequência nem assistente. Uma **barra FIXA de ferramentas** fica ENTRE o vídeo e o painel
   da direita; clicar numa ferramenta mostra só os controles dela no painel.
2. **Tela fixa:** com o editor aberto a página não rola. Vídeo, barra, título e exportar ficam
   sempre à vista.
3. **Só ferramentas — "nada, nem aviso".** Texto permitido: nomes (ferramenta, seção, campo,
   botão), valores (tempos, duração, %, nomes de faixa e de card) e o rótulo do próprio controle
   dizendo o estado dele ("Renderizando…", "Gerar de novo", "Falhou · tentar de novo" — nunca o
   motivo). Estado visual permitido: desabilitado, marcado, barra de progresso, `data-manual`,
   `data-removida`, contorno de `aria-invalid` e a bolinha da ferramenta. Saem explicações,
   dicas, diagnósticos, avisos, frases de estado, tooltips com motivo e toasts.
4. Os dois exemplos citados pelo usuário somem: a nota da análise ("Este vídeo não publica o
   gráfico…; Descartei trechos…; MuAPI sem credito") e a nota do "Começo e fim".
5. A nota da análise (`.yt-analysis-note`) some do editor E da grade; `YT.note`/`project.note`
   continuam no dado.
6. "Por que este trecho foi sugerido" e a nota do detector vão para a ÚLTIMA ferramenta,
   **Análise**, que só aparece quando há o que mostrar. É o único lugar com conteúdo explicativo.
7. Título e exportar sobem para a barra de cima.

## Por quê
O editor tinha virado uma coluna de quase 2.500 px de texto e controles; o operador rolava a
página para achar cada ajuste e lia, a cada corte, frases que só precisam ser entendidas uma vez.
A forma de ferramentas (como num editor de vídeo) põe cada ajuste a um clique e deixa o vídeo
parado no mesmo lugar.

## O que ficou definido na execução (medido no Chrome, corte real)
- Ferramentas, nesta ordem: Corte · Enquadrar · Legenda · Card · Texto · Zoom · Música · Capa ·
  Análise. Legenda em subabas: Texto · Estilo · Posição · Profundidade · Avançado.
- Medidas finais: painel **420 px**, barra **96 px**, bolinha **6 px**, retorno do toque **140 ms**
  (`scale(.97)`), troca de painel instantânea.
- Tela fixa de 1100×700 a 1920×1080, sem rolagem da página e sem rolagem horizontal; 9:16 exato
  (erro 0) do 208×370 (1280×650) ao 450×800 (1920×1080). Abaixo disso (390×844, 800×600) empilha,
  vídeo primeiro, e a página rola.
- A 1366×768 só a Legenda → Texto (lista) rola dentro do painel. A Capa coube com a prévia ao
  lado dos controles. Em janelas mais baixas (1280×650, 1100×700) a Análise também rola dentro
  do painel (90 e 40 px).
- Export real: o gatilho mostrou "Renderizando…" durante 425 s e voltou a "Baixar"; nenhum toast.

## Caminhos que ficaram sem aviso, por decisão
Mudar a borda descarta o exportado e a correção da legenda · cota cheia do navegador · faixa de
música apagada da biblioteca ou início além do fim · legenda indisponível, fora do trecho ou
longa demais · card apagado ou biblioteca vazia · enquadramento que amplia demais a fonte ·
legenda na faixa de fundo ou nas zonas do TikTok · palavra longa que trava a posição · texto
junto do card de 4 s ou encostando na legenda · o download rápido não leva tudo · falha de
export, quadro real, capa ou importação de música sem o motivo · prévia do trecho levando minutos.
