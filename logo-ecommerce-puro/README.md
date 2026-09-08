# Ecommerce Puro — identidade

Versão vetorial limpa da marca do canal. O original de referência é um PNG 1254×1254 com
textura grunge; estes arquivos preservam a identidade (monograma `CT` vazado + placa
`ECOMMERCE` / `PURO` entre filetes) e resolvem o que impedia usá-la como asset.

## Os arquivos

| Peça | Para quê | Tamanho de origem |
|---|---|---|
| `lockup-*` | a marca completa. Capa, apresentação, fim de vídeo. | 1200×820 |
| `badge-*` | **só a placa** — a parte legível. É a que entra no card 1080×1920. | 760×~250 |
| `monograma-*` | avatar, marca d'água, favicon. | 512×512 |

Cada uma em `fundo-claro` (tinta preta, use sobre branco) e `fundo-escuro` (tinta branca,
use sobre preto/carvão/foto escura), em `.svg` e `.png`.

**Os SVGs estão em curvas** — nenhum depende de fonte instalada, em máquina nenhuma nem em
container nenhum. Confira com `grep font-family *.svg`: não há.

## Tokens

Medido no PNG de referência: **0 pixels cromáticos**. A marca é monocromática. Não existe
cor de destaque para extrair dela, e inventar uma seria inventar a marca.

```
tinta   #000000
papel   #FFFFFF
tipo    Montserrat ExtraBold (800) — wordmark e monograma
```

O texto do card continua em **Inter** (fonte do projeto, empacotada em
`video-worker/fonts/`). Montserrat só na marca.

## Uso

- **Respiro:** no mínimo a altura do `E` do `ECOMMERCE` em volta do lockup.
- **Tamanho mínimo do badge:** 56px de altura. Abaixo disso o `PURO` e os filetes fecham.
  Verificado renderizando a 62px, que é o tamanho no card 1080×1920.
- **Monograma abaixo de ~64px:** o contorno vazado começa a sumir. Se precisar de ícone
  minúsculo, peça uma variante sólida — não engrosse o traço na mão.
- **Não** recolorir, inclinar, aplicar sombra, gradiente ou contorno. **Não** usar o
  `fundo-claro` sobre foto escura (e vice-versa): existem as duas versões justamente
  porque a de referência só funcionava em fundo de tom médio.

## O que mudou em relação ao PNG de referência

| Antes | Agora | Por quê |
|---|---|---|
| textura grunge | geometria limpa | o grunge vira sujeira abaixo de ~200px |
| só raster, 1254px | vetor + PNG | o badge precisa renderizar nítido a 62px |
| uma versão só | claro + escuro | a de referência some em fundo branco e em fundo preto |
| placa colada no monograma | peças separáveis | o card precisa da placa **sem** o `CT` |
| `CT` cortado nas bordas | encaixe pela caixa de tinta | a Montserrat tem *overshoot* nas redondas: centrar pelo cap-height nominal corta a curva do `C`. Aconteceu na primeira versão e só apareceu **olhando o frame**. |

## Regerar

```bash
curl -sL -o "logo-ecommerce-puro/Montserrat[wght].ttf" \
  "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"
py -3.12 -m pip install fonttools
py -3.12 logo-ecommerce-puro/gerar.py
```

A fonte não vai no repo de propósito: os SVGs já são finais e self-contained, ela só serve
para regerar. Os números todos vivem no bloco `TOKENS` do `gerar.py`, e **uma lista de cena
por peça alimenta os dois renderizadores** (SVG e PNG) — dois renderizadores lendo a mesma
cena não podem divergir, mesma razão pela qual `captions.margem_inferior` é dona única da
âncora da legenda.
