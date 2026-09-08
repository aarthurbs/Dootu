# studio — camada de edição (Remotion)

Isolada de propósito. O site (`index.html`) continua **Vanilla JS sem uma linha de npm**,
como manda o `CLAUDE.md`; todo o Node vive aqui dentro e nada daqui é servido ao navegador
do site. A única ponte entre os dois é a rota `POST /api/remotion-render` do
`video-worker/serve.py`, que chama o `npx remotion render` como processo.

## Instalar (uma vez)

    cd studio
    npm install

Baixa o Remotion e um Chrome Headless Shell (~150 MB na primeira vez).

## Usar

Normalmente você não roda nada aqui: o botão do Estúdio de Vídeos faz tudo. Para mexer na
composição com prévia ao vivo:

    npm run studio

Para renderizar à mão:

    npx remotion render src/index.jsx Clip saida.mp4 --props=job.json --public-dir=<pasta-do-trecho>

## Contrato de entrada (`--props`)

O `serve.py` monta este JSON. A camada de edição **não sabe de onde o trecho veio** — é o
que mantém descoberta e edição desacopladas.

```json
{
  "clipFile": "aircAruvnKk-501-535.mp4",
  "durationSec": 34.0,
  "title": "",
  "preset": "legenda",
  "cues": [{ "start": 0.4, "end": 3.1, "text": "..." }]
}
```

- `clipFile` — nome do arquivo dentro do `--public-dir`, **nunca** caminho absoluto.
- `durationSec` — vira `durationInFrames` no `calculateMetadata`. Cada corte tem a sua.
- `cues` — tempos em segundos **relativos ao começo do corte**, não ao vídeo original.
- `preset` — `BUSINESS_SERIOUS` (padrão) ou `LIMPO`. Os nomes antigos `legenda`/`limpo`
  continuam valendo: o pipeline que já funciona não quebra por causa de renomeação.
- `category` — slug do detector (`money`, `failure`, `business`…). Só escolhe a COR do
  destaque; não muda enquadramento nem tempo.

## BUSINESS_SERIOUS — o que a composição faz hoje

1080x1920, 30 fps. A direção é "conteúdo forte → corte certo → comunicação clara → edição
discreta → autoridade", nunca "efeito, efeito, efeito". Na prática:

- **Enquadramento:** fundo = a **miniatura do vídeo** cobrindo o quadro inteiro e
  escurecida (`brightness 0.42` / `saturate 0.55` — os mesmos números do perfil `crop` do
  `worker.py`, com prova de paridade no `test_serve`), e o vídeo **em 1× sobre ela**, sem
  corte lateral, no centro do quadro (50% da altura, o mesmo `overlay=(W-w)/2:(H-h)/2`
  do FFmpeg). Só a miniatura é recortada para preencher; o vídeo nunca.
  Sem miniatura não há imagem de fundo: sobra a cor do preset (`TOKENS.fundo`), letterbox
  chapado. O fundo desfocado saiu dos DOIS renderizadores em 2026-08-27 — com a legenda
  ancorada dentro do vídeo, o fundo virou moldura, e o `worker.py` pinta a mesma cor no
  perfil `blur` (nome herdado; ele já não desfoca nada).
- **Legenda:** Inter Bold 58px, branca, centralizada, no máximo **2 linhas**, **ancorada
  pela base** dentro do retângulo do vídeo (um respiro de 8% da altura dele acima da
  borda de baixo; numa fonte 16:9 a base do texto cai em y 1215) e com 820px de largura,
  que passa por baixo da trilha de botões do TikTok em vez de por cima. Fala longa vira
  várias páginas curtas, com o tempo repartido pelo tamanho do texto.
  A conta é uma só, em Python (`captions.margem_inferior`, a mesma do FFmpeg/ASS), e
  chega pelo prop `legendaBase`. O percentual fixo de 66% da altura (`legendaTopoPct`)
  saiu em 2026-08-27: com o vídeo sem ampliação ele caía ABAIXO da imagem, e a legenda
  era escrita na miniatura escurecida em vez de sobre o vídeo.
- **Ênfase:** no máximo **uma** palavra por página, escolhida por significado (termo de
  dinheiro, erro, ou número com unidade — `40%`, `10 anos`). Cor por categoria: amarelo
  queimado no geral, verde discreto para dinheiro/sucesso, vermelho escuro para fracasso.
  Nunca duas cores ao mesmo tempo.
- **Movimento: nenhum.** A legenda entra estática de propósito — o espectador vê a troca
  dezenas de vezes por corte, e texto que se mexe o tempo todo é exatamente o que o briefing
  proíbe. Efeito aqui só entra com razão semântica.
- **Título:** opcional, Montserrat ExtraBold no topo. Vazio por padrão; o pipeline não
  inventa manchete.

Preset `LIMPO`: mesmo enquadramento, sem legenda e sem título.

Os números todos moram em `TOKENS` (`src/preset.js`) e a lógica de quebra de linha e de
ênfase é pura, provada por `node test-preset.mjs` (56 verificações) sem renderizar nada.

**Botão de calibragem:** `TOKENS.videoEscala` = 1 é a fonte inteira, sem corte. Era 1.45
para tapar a faixa escura das pontas, ao preço de cortar 243px de cada lado (decapitando
convidado na ponta de um plano aberto); a faixa deixou de ser problema quando virou
miniatura escurecida. Subir acima de 1 volta a cortar as laterais. O par dele é
`TOKENS.fundoLuz`: baixe se a miniatura competir com o vídeo — nunca volte o desfoque.

## O que ela ainda NÃO faz

Zoom semântico, dessaturação em momento pesado, frase de impacto em tela cheia, transição,
corte dinâmico, trilha, efeito sonoro, marca e abertura/encerramento. Fora desta etapa por
decisão explícita — os itens 5 a 8 da ordem de prioridade do usuário.

## Teto conhecido

Um corte de 10 s leva ~150 s para renderizar, e quase tudo é o `npx remotion render`
reconstruindo o bundle a cada chamada. Se isso incomodar, o caminho é `@remotion/bundler`
com bundle reaproveitado entre renders — não mexer na composição.
