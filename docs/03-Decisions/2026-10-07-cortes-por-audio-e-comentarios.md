# Decisão — Pausa pelo áudio, comentários e apelo na recomendação de cortes

**Data:** 2026-10-07 · **Quem decidiu:** o usuário (operador do Estúdio)

## Contexto
Pedido: "mando um link de mais de 1 hora e ele me entrega só 2 vídeos recomendados". Medido no
podcast de 73 min (`nQmamKKQH80`, legenda automática pt): **2 cortes**, um deles "Deixe o seu
like e se inscreva no canal". A causa NÃO era falta de sinal: a legenda automática não tem
pontuação e a grade por palavra não tem pausa (o fim de cada palavra é o início da seguinte).
O vídeo virou 198 "frases" de 22 s (o teto) com **2** inícios firmes, e só eles podiam virar corte.

Medições que decidiram o caminho:
- Intervalo entre inícios de palavra como pausa: no máximo 43% de precisão contra o silêncio
  real (`silencedetect`). Descartado.
- Silêncio do áudio da fonte: 1057 silêncios em **10,6 s** de decode só do áudio (73 min).
- Limiar de "início de ideia" com silêncio medido, veto intacto: 1,1 s → 2 cortes · 0,7 → 6 ·
  **0,5 → 14** · 0,4 → 20 com abertura picada.
- Comentários: 300 em +11 s na análise; o mais curtido (228) marcava 51:04 citando uma frase
  dita ~42 s depois.

## Decisão
1. **Pausa pelo áudio** (`serve.silencios_da_fonte`, cache `<id>.silencios.json`). A importação
   mede ao terminar; a análise usa quando a fonte está no disco e responde `audioPausas`. A
   tela analisa de novo UMA vez quando a fonte chega e nenhum corte saiu ainda. Nada é baixado
   pela análise: o áudio é o da fonte já importada depois da declaração de direito.
2. **Comentários** com minutagem viram âncora (curtidas em escala log, 0,3–1, mesmo teto de
   popularidade do heatmap). A frase CITADA perto da minutagem (radical + raridade no vídeo)
   vira início firme e a âncora não troca por vizinha.
3. **Apelo** (peso 8, só ordena): termos do título/descrição/tags que a fala usa (pela
   raridade, não ao pé da letra) + palavras de engajamento conhecidas por todos.
4. **Chamada do canal/propaganda** reprova (duas marcas, ou uma na abertura).

Resultado (antes → agora): 73 min **2 → 13** · 36 min **0 → 10** · 25 min 10 → 12 · dois
vídeos já no teto de 20 continuam 20 · vídeo sem legenda continua 7.

## O que foi rejeitado
- Afrouxar o veto (continua o mesmo; ele segue reprovando a maioria das janelas).
- Baixar áudio na análise (furaria o portão: baixar mídia exige a declaração).
- Reanalisar projetos salvos: sem o campo `audioPausas` nada muda.

## Sabido e não mexido
O nome do convidado no título conta como apelo (a apresentação do convidado sobe na lista).
