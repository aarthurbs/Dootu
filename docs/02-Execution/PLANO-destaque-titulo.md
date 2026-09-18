# Plano pronto: quando destacar (e quando NÃO) um trecho do título

> **Estado (conferido em 2026-09-14): ENTREGUE em 2026-09-01.** Não é trabalho ativo.
> `preset.pickTitleHighlight`, `TERMOS_FORTES`, `FRACOS_NO_TITULO` e `UNIDADE_RESULTADO`
> vivem em `studio/src/preset.js`, com checks em `studio/test-preset.mjs`. Fechamento em
> `../01-Wiki/archive/HISTORICO-estudio-video.md` (l. 172): destaque por **peso**
> (Montserrat 800 → 900 com filete), nunca por cor.

Decide, sem IA e sem dependência nova, qual pedaço do título do card 9:16 vira destaque —
`Saiu de uma pequena cidade, para **100 mil pedidos** no Brasil.` — e, principalmente,
quando a resposta certa é **não destacar nada**.

> **EXECUTADO em 2026-09-01.** Vive em `studio/src/preset.js` (`pickTitleHighlight`,
> `resolveTitleHighlight`, `splitTitleHighlight`) e no `Titulo` do `studio/src/Clip.jsx`.
> `studio/test-preset.mjs` foi de 133 para 166 verificações; `.\provas.ps1` verde em 1059.
> O registro definitivo está no `CLAUDE.md`. **Quatro coisas saíram diferentes do que este
> plano previa** — corrigidas abaixo, no lugar em que estavam erradas:
>
> 1. **Caso 4 esperava `null` e o certo é `quebrei`.** Eu não conferi o `TERMOS_FORTES` que
>    já existia: `quebrei` **e** `tudo` estão lá. A regra sob teste (ano rejeitado) estava
>    certa; a expectativa é que estava errada.
> 2. **Entrou o filtro `FRACOS_NO_TITULO`**, porque o `TERMOS_FORTES` traz intensificadores
>    que não são afirmação num título. Não é uma segunda lista: é um filtro nomeado sobre a
>    que já existe.
> 3. **O título é Montserrat 800, não Inter.** O plano dizia "Inter Bold → Inter Black". A
>    base ficou em **800** (título sem destaque renderiza idêntico ao de antes) e o destaque
>    subiu para **900**.
> 4. **A lista `FUNCIONAIS` foi cortada:** a expansão só cresce por *allow-list*, então uma
>    lista de parada nunca seria consultada — seria código morto (BP-007).

Não implementa nada sozinho. É o texto para colar numa sessão nova.

## Como disparar

Cole numa sessão nova:

> Execute `docs/PLANO-destaque-titulo.md`.

## O que ele conserta

Hoje o título do card é uma frase inteira com um peso só. Toda palavra pesa igual, então
nenhuma pesa — e a informação que faz o vídeo valer o clique (o número, o resultado) não
tem hierarquia nenhuma. O pedido original previa um prop opcional `highlightText`
preenchido à mão; na prática ninguém preenche a cada corte, e recurso que depende de
alguém lembrar não existe.

## A tensão que este plano assume por escrito

O prompt original diz, literalmente: *"Do not introduce an AI or NLP dependency just to
choose highlighted words"* e *"without attempting unreliable automatic keyword detection"*.

Este plano **não viola isso**, e quem executar não deve tratar como violação:

- zero dependência nova — léxico fechado + regra de token, tudo função pura;
- é a **mesma classe** do `pickEmphasis` que já está em produção no `studio/src/preset.js`
  desde 2026-08-18, com a mesma justificativa escrita lá ("a lista é curta e concreta —
  dinheiro, erro, resultado — e não 'palavras bonitas'");
- `highlightText` **continua existindo e sempre vence** o automático;
- existe interruptor (`autoHighlight: false`) para desligar o automático inteiro.

O que o prompt proíbe é adivinhação estatística. Lista fechada não adivinha: erra sempre
igual, e erro reprodutível se conserta editando a lista.

## O algoritmo

Função pura `pickTitleHighlight(titulo)` → `{ inicio, fim } | null`, em **índices de
token**, nunca a string.

> **Índice, não string.** `"Gastei 50 mil e faturei 300 mil"` com `replace('mil')` pinta o
> primeiro `mil`. O destaque certo é o segundo. Devolver posição é o que impede isso.

### 1. Tokenizar

Separar por espaço, preservando a pontuação colada ao token (`cidade,` é um token). Um
token é **fronteira** se termina em `, . ; : — ...` — o span nunca atravessa fronteira.

### 2. Pontuar cada candidato

| Peso | Candidato | Exemplo |
|---|---|---|
| **4** | número com **moeda**, **escala** ou `%` | `R$ 2 milhões`, `100 mil`, `40%` |
| **3** | número seguido direto de **unidade de resultado** | `7 funcionários` |
| **2** | palavra da lista `TERMOS_FORTES` **que já existe** em `preset.js` | `prejuízo`, `erro` |
| — | número nu (sem moeda, sem escala, sem `%`, sem unidade) | `as 3 coisas` → rejeita |
| — | 4 dígitos precedido de `em`/`desde`/`entre`/`ano de` | `em 2019` → é data, rejeita |

**Reaproveitar `TERMOS_FORTES` do `preset.js` — não criar uma segunda lista.** Duas listas
divergem, e o mesmo termo passa a valer na legenda e não valer no título, calado.

Listas fechadas novas (todas em `preset.js`, ao lado da que já existe):

- `ESCALA` = mil, milhão, milhões, bilhão, bilhões, mi, bi, k
- `MOEDA` (colada ao número ou como token anterior) = R$, US$, $
- `UNIDADE_RESULTADO` = pedidos, vendas, clientes, reais, dólares, seguidores, inscritos,
  alunos, views, visualizações, funcionários, lojas, produtos, unidades, contratos, anos,
  meses, dias, semanas, países, cidades
- ~~`FUNCIONAIS` (param a expansão)~~ — **cortada na execução.** A expansão só cresce por
  *allow-list* (`ESCALA`, `UNIDADE_RESULTADO`), então uma palavra funcional simplesmente não
  está nelas e a expansão para sozinha. A lista nunca seria consultada: código morto.
- `FRACOS_NO_TITULO` (**entrou na execução**) = nunca, sempre, ninguem, tudo, nada — filtro
  sobre o `TERMOS_FORTES`, não uma segunda lista de termos

Comparação sempre **sem acento e em minúscula** — usar o `semAcento()` que já existe.

### 3. Crescer o span

A partir do token numérico:

1. **Esquerda:** absorve o token anterior se for `MOEDA`.
2. **Direita:** absorve, em sequência, todos os tokens de `ESCALA`.
3. **Direita:** absorve **UM** token a mais, e só se ele estiver em `UNIDADE_RESULTADO`.
4. Para em fronteira de pontuação, em token `FUNCIONAIS`, ou no teto de 4 tokens.

> **Por que lista fechada e não "qualquer substantivo".** Sem lista, `Faturei R$ 2 milhões
> vendendo capinha` engoliria `vendendo`. Detectar que `vendendo` é verbo exige morfologia
> — que é exatamente a dependência proibida. Com lista fechada, uma unidade desconhecida
> faz o span parar cedo: sai `R$ 2 milhões`, que já está certo. **Falha para o lado seguro.**

### 4. Escolher

Maior peso vence. **Empate → o de posição MAIOR (mais à direita)** — em PT-BR o desfecho
cai no fim da frase (`saiu de X, para **100 mil pedidos**`).

## Quando NÃO destacar

Nenhuma destas é opcional. É metade do pedido ("saber quando destacar **ou não**").

| Guarda | Motivo |
|---|---|
| título com menos de **5 palavras** | a frase inteira já é o destaque; espelha o `< 3 palavras` do `pickEmphasis` |
| span cobre mais de **45% dos caracteres** | se quase tudo está destacado, nada está |
| melhor peso **< 2** | não havia claim nenhum na frase |
| span atravessaria vírgula/ponto/travessão | destaque partido em duas orações não se lê como uma coisa só |

Retorno `null` é resultado legítimo, não falha. O card renderiza o título liso.

## O tratamento visual

**A marca é monocromática — medido: 0 pixels cromáticos no logo de referência.** Não existe
cor de destaque para extrair, e inventar uma seria inventar a marca. O destaque é por
**peso**, não por cor:

- título: **Montserrat 800** — o peso que o `Titulo` já tinha, então título sem destaque
  renderiza idêntico ao de antes. *(o plano dizia Inter 700; o componente real é Montserrat)*
- trecho destacado: **Montserrat 900** — e o 900 precisou entrar no `loadFont`: sem o
  arquivo o navegador **sintetiza** o peso a partir do 800 e sai um engrossamento borrado,
  que só aparece olhando o frame.
- **filete** de 4px sob o trecho — a régua que ladeia o `PURO` no logo é um device que já
  existe na identidade, não um enfeite novo. Não é opcional na prática: 800 contra 900
  sozinho é sutil demais a 50px para criar hierarquia. Por `text-decoration`, não retângulo
  posicionado, porque o trecho **pode quebrar entre duas linhas** — medido, e o sublinhado
  acompanha cada fragmento. `nowrap` não foi forçado: um trecho patológico produziria
  overflow horizontal, que o pedido proíbe. `TOKENS.tituloFilete: 0` deixa só o peso.

**O destaque não anima sozinho.** O card inteiro entra com o fade + 8–16px que o pedido
original já define; pintar ou crescer a palavra depois seria movimento sem razão semântica,
proibido pelo BUSINESS_SERIOUS e pela mesma regra que mantém a legenda estática.

> **Armadilha já paga neste repo (2026-08-18):** `transform: scale()` numa palavra destacada
> cresce o glifo e **não a caixa de layout** — palavra longa transborda e come a vizinha
> (`"Faturamentonão"`). Só aparece OLHANDO o frame. Não escalar; peso resolve.

## Onde mora

| Arquivo | O que entra |
|---|---|
| `studio/src/preset.js` | `pickTitleHighlight()` e `splitTitleHighlight()`, exportadas, ao lado de `pickEmphasis`/`splitEmphasis`, no mesmo estilo. Listas novas junto de `TERMOS_FORTES`. |
| componente do card de título | consome o span; `highlightText` vence; `autoHighlight:false` desliga |
| `studio/test-preset.mjs` | os checks abaixo |

`splitTitleHighlight(texto, span)` devolve pedaços `{ texto, forte }` — **igual ao
`splitEmphasis` que já existe**, para o React montar sem `dangerouslySetInnerHTML`.

## Casos de teste (saída exigida)

| # | Título | Esperado |
|---|---|---|
| 1 | `Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.` | `100 mil pedidos` |
| 2 | `Faturei R$ 2 milhões vendendo capinha de celular.` | `R$ 2 milhões` |
| 3 | `Cortei 40% do custo sem demitir ninguém.` | `40%` |
| 4 | `Em 2019 eu quebrei e comecei tudo de novo.` | `quebrei` — o ano é rejeitado, e `tudo` cai no filtro de intensificador. *(o plano dizia `null`; ver a nota no topo)* |
| 5 | `As 3 coisas que eu faria diferente hoje.` | `null` (número nu) |
| 6 | `Gastei 50 mil e faturei 300 mil no mesmo ano.` | `300 mil` (empate → o último) |
| 7 | `O maior erro da minha vida como empresário.` | `erro` (peso 2) |
| 8 | `Perdi tudo.` | `null` (< 5 palavras) |
| 9 | `100 mil pedidos por mês.` | `null` (cobertura > 45%) |
| 10 | `Faturamento de R$ 1,2 milhão em três meses — e o que deu errado.` | `R$ 1,2 milhão` |
| 11 | `highlightText: 'pequena cidade'` no caso 1 | vence o automático |
| 12 | `highlightText` que **não existe** no título | não destaca, **e diz na tela** (BP-008) |

O 12 não é detalhe: ignorar calado um `highlightText` digitado errado é a automação muda
que o BP-008 existe para impedir.

## A armadilha que este projeto já pagou DUAS vezes

Está no `CLAUDE.md` em 2026-08-26 e de novo em 2026-08-27, e voltou a aparecer na entrega
do karaokê:

> **`in arquivo` só prova que alguém escreveu a palavra.**

Prova por `grep`/regex no fonte não prova fiação nem polaridade. Em 2026-08-27 três
sabotagens do lado JS passaram com **cinco suítes verdes** porque a guarda era regex no
texto do `Clip.jsx`. O conserto foi sempre o mesmo: **função pura exportada, e o teste a
CHAMA com valor construído.**

Exigências deste plano:

1. `pickTitleHighlight` e `splitTitleHighlight` **exportadas** e chamadas pelo teste com
   título construído — nunca `assert(fonte.includes('pickTitleHighlight'))`.
2. O consumidor no componente também sai como função pura (o gate), pelo mesmo motivo:
   trocá-lo por uma chave que não existe desligaria o recurso inteiro, calado.
3. Exercitar as sabotagens numa **CÓPIA em temporário**, nunca na árvore de trabalho
   (lição de 2026-08-26: um agente sabotou o arquivo que outro estava lendo, e o segundo
   reportou a sabotagem como defeito "confirmado", com prova de execução).

Sabotagens que precisam REPROVAR num check nomeado: inverter o empate (primeiro em vez do
último); remover a guarda dos 45%; remover a guarda das 5 palavras; aceitar número nu;
`highlightText` deixar de vencer; span devolvido como string em vez de índice.

## Validação

```powershell
.\provas.ps1
```

Roda as oito suítes, soma sozinho e **falha se o total divergir da linha `Checks:` do
`CLAUDE.md`** — então atualizar essa linha faz parte da entrega, com o número que o script
imprimir. Não somar de cabeça.

Depois, o que teste nenhum pega: **renderizar um still e OLHAR** — títulos curto, médio,
longo e com acento, conferindo que o span destacado não quebra em duas linhas de um jeito
que separe o número da unidade.

## Fora deste plano, de propósito

- **Mais de um destaque por título.** Dois destaques viram semáforo e a hierarquia some —
  mesma razão pela qual `pickEmphasis` já limita a uma palavra por página.
- **Cor.** A marca é preto e branco, medido. Cor entraria como decisão de marca, não como
  detalhe de implementação.
- **Destaque na legenda.** Já existe (`pickEmphasis`) e não deve ser tocado: quando o
  karaokê por palavra está no ar, a ênfase semântica é suprimida de propósito.
- **Transcrição local (Whisper).** Assunto separado, ainda em aberto.
