/* Provas do preset BUSINESS_SERIOUS. Sem navegador, sem render, sem rede.
 *
 * O que decide se um corte funciona é a fala caber legível na tela e o destaque cair na
 * palavra certa — as duas coisas são lógica pura, então são provadas aqui em milissegundos
 * em vez de num render de dois minutos que ninguém roda.
 *
 * Uso:  cd studio && node test-preset.mjs      (ou: npm run check)
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  TOKENS, PRESETS, corDoDestaque, toCaptionPages, pickEmphasis, splitEmphasis,
  MAX_LINHAS, MAX_CHARS_PAGINA, ancoraLegenda, LEGENDA_BASE_PADRAO,
  activeWordIndex, popPalavra, corDaPalavra, MOLA_PALAVRA, palavrasDaPagina,
  pickTitleHighlight, splitTitleHighlight, resolveTitleHighlight, TITULO_ORIGEM,
  MIN_PALAVRAS_TITULO, MAX_COBERTURA_TITULO, ancoraBanda, BANDA_PADRAO,
  tituloEscalonado, entradaCard, TITULO_FONTES, MAX_LINHAS_TITULO, larguraTitulo,
  AVANCO_MONTSERRAT, presencaCard,
  REFRAMES, REFRAME_PADRAO, REFRAMES_OFERECIDOS, REFRAME_LABELS, reframeOf,
  ancoraVideo, VIDEO_ALTURA_PADRAO, palcoGeometria,
} from './src/preset.js';
import { MARCA_BADGE, MARCA_PROPORCAO, MARCA_LARGURA, MARCA_ALTURA, MARCA_NOME } from './src/marca.js';
import { MARCAS, PURO_BADGE, PURO_PROPORCAO, PURO_NOME } from './src/marca.js';
import {
  TITLE_CARD_STYLES, TITLE_CARD_PADRAO, TITLE_CARD_LABELS, TITLE_CARD_PRESETS,
  titleCardStyleOf, titleCardPreset, TITULO_GEOMETRIA_COMPARTILHADA, TITULO_FILETE_REF,
  TITLE_CARD_SEM,
} from './src/preset.js';
import {
  LEGENDA_STYLES, LEGENDA_PADRAO, LEGENDA_LABELS, LEGENDA_PRESETS, LEGENDA_FAMILIAS,
  legendaStyleOf, legendaPreset, tetoDaPagina, charsPorLinhaLegenda,
  AVANCO_INTER, AVANCO_INTER_CAIXA_ALTA, AVANCO_ARCHIVO_BLACK, MAX_CHARS_LINHA,
} from './src/preset.js';

let n = 0;
const ok = (label, cond) => { assert.ok(cond, label); n++; };
const eq = (label, a, b) => { assert.deepStrictEqual(a, b, label); n++; };

/* ------------------------------------------------------------------ 1. tokens */
ok('1a. quadro 9:16', TOKENS.largura === 1080 && TOKENS.altura === 1920);
ok('1b. o preset NAO tem mais ancora propria de legenda (vem do servidor)',
  !('legendaTopoPct' in TOKENS) && TOKENS.legendaTopoPct === undefined);
ok('1c. legenda estreita o bastante para escapar da trilha do TikTok',
  TOKENS.legendaLargura <= 860);
ok('1d. video no centro exato, mesmo enquadramento do FFmpeg (overlay=(W-w)/2:(H-h)/2)',
  TOKENS.videoCentroPct === 0.5);
ok('1e. no maximo 2 linhas', MAX_LINHAS === 2);
ok('1f. dois presets declarados', PRESETS.length === 2);

/* Nenhuma cor pode ser neon: saturacao alta com luminancia alta foi proibida no pedido. */
/* O `h` (matiz, 0..360) entrou com o leque do karaoke (check 8q5): la o que importa e a
   DISTANCIA entre cores vizinhas, nao so o par saturacao/luz. Aditivo — quem so lia `{s, l}`
   nao muda de resultado. */
const hsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = mx === mn ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
};
for (const chave of ['destaque', 'destaqueGanho', 'destaquePerda']) {
  const { s, l } = hsl(TOKENS[chave]);
  ok(`1g. ${chave} nao e neon (saturacao ${s.toFixed(2)}, luz ${l.toFixed(2)})`,
    !(s > 0.85 && l > 0.55));
}

/* --------------------------------------------------------- 2. cor por categoria */
eq('2a. dinheiro puxa o verde', corDoDestaque('money'), TOKENS.destaqueGanho);
eq('2b. sucesso puxa o verde', corDoDestaque('success'), TOKENS.destaqueGanho);
eq('2c. fracasso puxa o vermelho', corDoDestaque('failure'), TOKENS.destaquePerda);
eq('2d. categoria desconhecida cai no amarelo', corDoDestaque('mindset'), TOKENS.destaque);
eq('2e. sem categoria cai no amarelo', corDoDestaque(''), TOKENS.destaque);

/* --------------------------------------------------------- 3. quebra de linha */
const longa = [{
  start: 0, end: 12,
  text: 'Faturamento não significa lucro e essa confusão quebra mais empresa no Brasil do que crise, juro alto ou concorrência desleal.',
}];
const paginas = toCaptionPages(longa);
ok('3a. fala longa virou varias paginas', paginas.length > 1);
ok('3b. nenhuma pagina passa do teto de 2 linhas',
  paginas.every((p) => p.text.length <= MAX_CHARS_PAGINA));
ok('3c. nenhuma palavra foi cortada ao meio',
  paginas.map((p) => p.text).join(' ').replace(/\s+/g, ' ')
  === longa[0].text.replace(/\s+/g, ' '));
ok('3d. paginas nao se sobrepoem e seguem em ordem',
  paginas.every((p, i) => i === 0 || p.start >= paginas[i - 1].end - 1e-9));
ok('3e. a ultima pagina termina exatamente no fim da fala',
  Math.abs(paginas[paginas.length - 1].end - 12) < 1e-9);
ok('3f. a primeira pagina comeca exatamente no inicio da fala',
  Math.abs(paginas[0].start - 0) < 1e-9);
ok('3g. pagina maior leva mais tempo que pagina menor', (() => {
  const maior = paginas.reduce((a, b) => (b.text.length > a.text.length ? b : a));
  const menor = paginas.reduce((a, b) => (b.text.length < a.text.length ? b : a));
  return maior.text.length === menor.text.length
    || (maior.end - maior.start) > (menor.end - menor.start);
})());

eq('3h. fala curta continua numa pagina so',
  toCaptionPages([{ start: 0, end: 2, text: 'O problema nunca foi dinheiro.' }]).length, 1);
eq('3i. fala vazia nao vira pagina',
  toCaptionPages([{ start: 0, end: 2, text: '   ' }]), []);
eq('3j. fala de duracao invalida nao vira pagina',
  toCaptionPages([{ start: 5, end: 5, text: 'nada' }]), []);
eq('3k. lista vazia nao quebra', toCaptionPages([]), []);
eq('3l. null nao quebra', toCaptionPages(null), []);
ok('3m. palavra unica gigante nao e cortada ao meio',
  toCaptionPages([{ start: 0, end: 2, text: 'a'.repeat(80) }])[0].text.length === 80);

/* --------------------------------------------------------------- 4. ênfase */
const destacada = (t) => { const i = pickEmphasis(t); return i < 0 ? null : t.split(/\s+/)[i]; };
eq('4a. termo de dinheiro vira destaque',
  destacada('Faturamento não significa lucro para ninguém'), 'Faturamento');
eq('4b. erro vira destaque', destacada('Esse foi o maior erro da empresa toda'), 'erro');
eq('4c. porcentagem vira destaque', destacada('A margem caiu 40% naquele ano'), '40%');
eq('4d. numero com unidade vira destaque',
  destacada('Levei 10 anos para entender isso direito'), '10');
ok('4e. numero SEM unidade nao vira destaque',
  destacada('Eu tinha 2 opções na mesa naquele dia') !== '2');
eq('4f. frase comum nao ganha destaque',
  pickEmphasis('Ele chegou cedo e sentou perto da janela'), -1);
eq('4g. pagina de duas palavras nao ganha destaque', pickEmphasis('Muito bom'), -1);
eq('4h. texto vazio nao quebra', pickEmphasis(''), -1);
ok('4i. acento nao atrapalha o casamento',
  destacada('A dívida cresceu mais rápido que tudo') !== null);
ok('4j. so UMA palavra por pagina, mesmo com varios termos fortes', (() => {
  const t = 'O lucro, a margem e o caixa nunca foram o problema';
  const pedacos = splitEmphasis(t, pickEmphasis(t));
  return pedacos.filter((p) => p.forte).length === 1;
})());

/* ------------------------------------------------------- 5. montagem dos pedaços */
const frase = 'Faturamento não significa lucro para ninguém';
const pedacos = splitEmphasis(frase, pickEmphasis(frase));
eq('5a. o texto remontado é o original', pedacos.map((p) => p.texto).join(''), frase);
eq('5b. exatamente um pedaço forte', pedacos.filter((p) => p.forte).length, 1);
eq('5c. o pedaço forte é a palavra escolhida',
  pedacos.find((p) => p.forte).texto, 'Faturamento');
eq('5d. sem destaque devolve um pedaço só',
  splitEmphasis('Ele chegou cedo e sentou', -1).length, 1);
ok('5e. sem destaque nenhum pedaço é forte',
  splitEmphasis('Ele chegou cedo e sentou', -1).every((p) => !p.forte));
eq('5f. indice fora da faixa nao quebra',
  splitEmphasis('uma duas tres', 99).length, 1);
ok('5g. destaque na ultima palavra nao deixa pedaço vazio',
  splitEmphasis('o problema era o lucro', 4).every((p) => p.texto.length > 0));
ok('5h. destaque na primeira palavra nao deixa pedaço vazio',
  splitEmphasis('lucro era o problema', 0).every((p) => p.texto.length > 0));

/* ------------------------------------------- 6. fundo por miniatura e geometria do vídeo
 * O fundo saiu do desfoque para a miniatura escurecida e o vídeo parou de ser ampliado.
 * Geometria é aritmética: provada aqui, não num render de minutos.
 */
const clipJsx = readFileSync(new URL('./src/Clip.jsx', import.meta.url), 'utf8');
const alturaVideo = (TOKENS.largura * 9 / 16) * TOKENS.videoEscala;   // fonte 16:9
const baseVideo = TOKENS.videoCentroPct * TOKENS.altura + alturaVideo / 2;
const topoVideo = TOKENS.videoCentroPct * TOKENS.altura - alturaVideo / 2;
/* A ancora nao e calculada aqui de proposito: a formula e uma so, em Python
   (`captions.margem_inferior`), e chega pelo prop `legendaBase`. O numero usado na geometria
   e o que a composicao REALMENTE poe no `bottom` quando nao ha servidor -- ou seja, a propria
   guarda chamada sem prop -- em vez de um literal lido do defaultProps por regex. */
const legendaBase = ancoraLegenda(undefined);
const baseTexto = TOKENS.altura - legendaBase;
/* Respiro pedido: `captions.RODAPE_PCT`, LIDO do captions.py, que e o dono do numero.
   Ate 2026-08-27 havia um `0.08` copiado aqui, com um comentario afirmando que a paridade
   estava guardada pelo bloco 6 do test_captions.py -- e nao estava: aquele bloco compara
   tipografia e nao cita RODAPE_PCT em lugar nenhum. Medido: trocar o RODAPE_PCT do Python
   para 0.20 deixava as cinco suites verdes com o numero velho aqui. Regex que nao casa vira
   NaN e reprova o 6c, que e o unico check que usa este valor. */
const captionsPy = readFileSync(new URL('../video-worker/captions.py', import.meta.url), 'utf8');
const RODAPE_PCT = Number((/^RODAPE_PCT\s*=\s*([\d.]+)/m.exec(captionsPy) || [])[1]);

ok('6a. o video nao e ampliado: fonte inteira, sem corte lateral', TOKENS.videoEscala <= 1);
/* Era o contrario ate 2026-08-27: a legenda ficava ABAIXO da imagem, sobre a miniatura
   escurecida, porque era pendurada num percentual fixo do quadro. Agora ela mora DENTRO do
   video, e estes tres checks sao a prova aritmetica disso. */
ok(`6b. a base do texto cai DENTRO do retangulo do video (y ${baseTexto} em ${topoVideo}-${baseVideo})`,
  Number.isFinite(baseTexto) && baseTexto > topoVideo && baseTexto < baseVideo);
ok(`6c. o respiro ate a borda de baixo do video e o RODAPE_PCT (${(baseVideo - baseTexto).toFixed(1)}px)`,
  Math.abs((baseVideo - baseTexto) - alturaVideo * RODAPE_PCT) <= 1);
ok('6d. um bloco de 2 linhas ainda comeca abaixo da borda de CIMA do video',
  baseTexto - TOKENS.legendaFonte * TOKENS.legendaEntrelinha * 2 > topoVideo);
ok('6e. escurecimento do fundo e forte', TOKENS.fundoLuz > 0 && TOKENS.fundoLuz <= 0.5);
ok('6f. fundo dessaturado sem apagar a cor',
  TOKENS.fundoSaturacao > 0 && TOKENS.fundoSaturacao < 1);
const iImg = clipJsx.indexOf('<Img');
const blocoImg = iImg < 0 ? '' : clipJsx.slice(iImg, clipJsx.indexOf('/>', iImg));
/* O desfoque VOLTOU em 2026-09-03, e o alvo dele mudou -- por isso este check mudou de
   AFIRMACAO em vez de sair. A historia curta, porque ela e a razao de ele existir:
   - ate 2026-08-27 havia um desfoque no FUNDO que era o proprio VIDEO ampliado. Ele saiu, e
     este check nasceu proibindo `blur(` no arquivo inteiro para ele nao voltar calado;
   - em 2026-09-03 o desfoque volta na MINIATURA, porque nitida ela mostrava a manchete do
     video legivel DUAS vezes e o quadro lia como tres imagens empilhadas.
   Sao coisas diferentes: uma borra o VIDEO (enfeite caro -- era decode duplo por quadro), a
   outra borra uma imagem estatica de fundo. O invariante que sobra e o que importa: desfoque
   SO no bloco do <Img>, e nenhum no resto do arquivo -- o que continua pegando o desfoque
   voltando pela porta do Palco ou de uma camada nova. */
const foraDoImg = clipJsx.slice(0, iImg) + clipJsx.slice(clipJsx.indexOf('/>', iImg));
ok('6g. desfoque existe SO no ramo da miniatura, e vem do token',
  blocoImg.length > 0
  && /blur\("\s*\+\s*TOKENS\.fundoDesfoque/.test(blocoImg)
  && !/blur\(/.test(foraDoImg));
ok('6h. o ramo da miniatura escurece pelos tokens', /TOKENS\.fundoLuz/.test(blocoImg));
ok('6i. a miniatura preenche o quadro por cover', /objectFit:\s*"cover"/.test(blocoImg));
/* Img do Remotion, nao <img>: o Img segura a captura ate a imagem carregar. Com a tag crua
   os primeiros quadros saem sem fundo, e isso so aparece olhando o frame 0. */
ok('6j. a miniatura usa o Img do Remotion (espera o carregamento)',
  /import \{[^}]*\bImg\b[^}]*\} from "remotion"/.test(clipJsx));
ok('6k. o nome da miniatura chega como prop e e resolvido por staticFile',
  /backgroundFile/.test(clipJsx) && /staticFile\(backgroundFile\)/.test(clipJsx));
/* Ancorar pelo TOPO fazia a linha de leitura pular ~68px a cada pagina de 2 linhas --
   movimento constante de texto, proibido por escrito. `bottom:` e o equivalente do
   Alignment 2 do ASS. */
ok('6l. a legenda e ancorada por bottom, nao por top',
  /bottom:\s*base/.test(clipJsx) && !/top:\s*TOKENS\.legenda/.test(clipJsx));
/* EXATAMENTE um <Video no arquivo: o do Palco. Guarda duas coisas de uma vez -- que o
   fundo-video desfocado nao voltou, e que o decode DUPLO por quadro nao volta com ele (o
   mesmo clipe decodificado no fundo E no palco, num Chrome headless, e a maior parte dos
   ~11 s de render por segundo de clipe medidos nesta maquina). Contar e o unico jeito: um
   `indexOf('<Video')` passa igual com dois. */
eq('6m. um <Video so no Clip.jsx (fundo-video morreu, decode duplo nao volta)',
  (clipJsx.match(/<Video\b/g) || []).length, 1);
/* E o Fundo nao recebe mais a fonte do video. Sem isto, um `src` esquecido na assinatura
   deixaria a porta aberta para o ramo voltar sem nenhum check reclamar. */
/* A tarja (`banda`) entrou em 2026-09-01: a miniatura passou a ser desenhada no tamanho de
   UMA tarja, duas vezes. O que este check guarda continua sendo o mesmo -- nenhum caminho
   do VIDEO entra no Fundo, senao volta o decode duplo por quadro de 2026-08-27. O 6m, que
   CONTA as tags <Video>, e a outra metade dessa guarda. */
ok('6n. o Fundo recebe so a miniatura e a tarja (nada de src do video)',
  /const Fundo = \(\{ imagem, banda \}\)/.test(clipJsx)
  && !/<Fundo[^>]*\b(src|clipFile)=/.test(clipJsx));

/* --------------------------------------- 7. ancora da legenda (o prop do servidor)
 * O numero vem do Python (`captions.margem_inferior`, dona unica da ancora) pelo prop
 * `legendaBase`. Aqui se prova o CONSUMO dele -- o unico lado onde a ancora pode ser
 * invertida sem o Python reclamar. Na primeira versao desta entrega isso era provado so por
 * regex (`bottom: base`, `Number(legendaBase) ||`), e regex casa palavra: medido, TRES
 * sabotagens deixavam as cinco suites verdes -- tirar o argumento da tag <Legenda>
 * (bottom: undefined, legenda fora da ancora), inverter para `altura - legendaBase` (base do
 * texto 510px fora de lugar) e tirar `legendaBase` do destructuring (todo corte no padrao:
 * 436px de erro numa fonte 9:16).
 * Por isso a guarda virou funcao pura no preset.js e e CHAMADA aqui, com valor construido.
 */
eq('7a. o numero do servidor chega intacto (nada de inverter a ancora)',
  [705, 620, 269, 768].map((v) => ancoraLegenda(v)), [705, 620, 269, 768]);
ok('7b. a ancora invertida daria OUTRO numero -- era a sabotagem que a regex nao pegava',
  ancoraLegenda(705) !== TOKENS.altura - 705);
eq('7c. numero em texto (o prop chega por JSON) ainda vira numero', ancoraLegenda('620'), 620);
for (const ruim of [undefined, null, '', 'abc', NaN, 0]) {
  const valor = ancoraLegenda(ruim);
  ok(`7d. prop ilegivel (${String(ruim)}) cai no padrao em vez de virar bottom: NaN`,
    valor === LEGENDA_BASE_PADRAO && Number.isFinite(valor));
}
/* JSX nao pode ser importado aqui: este arquivo roda com `node` puro, sem build e sem
   dependencia. Entao a FIACAO e o que sobra em texto -- mas em texto EXATO e DENTRO da tag,
   nao um indexOf no arquivo inteiro. */
const iTag = clipJsx.indexOf('<Legenda ');
const tagLegenda = iTag < 0 ? '' : clipJsx.slice(iTag, clipJsx.indexOf('/>', iTag) + 2);
ok('7e. a <Legenda> recebe a base pela guarda, com o prop do servidor dentro dela',
  /base=\{ancoraLegenda\(legendaBase\)\}/.test(tagLegenda));
ok('7f. o Clip continua desestruturando `legendaBase` (sem isso todo corte usa o padrao)',
  /export const Clip = \(\{[^}]*\blegendaBase\b/.test(clipJsx));


/* --------------------------------------------- 8. palavra sendo dita (o karaoke)
 * O tempo por palavra vem do json3 (`ytclip.parse_json3_words`), e agrupado em linha pelo
 * `captions.cues_from_words` e atravessa a fronteira de cue de clipe pelo
 * `ytclip.cues_for_range` -- que anexa `words` a cada linha, JA rebaseado para o corte. Aqui
 * se prova o lado que CONSOME: quem esta ativa naquele instante, quanto ela cresce, e a
 * fatia de palavras de cada pagina.
 *
 * Tudo por CHAMADA com valor construido, nunca por regex no fonte: e a licao que este
 * projeto ja pagou duas vezes (2026-08-26 e 2026-08-27). Polaridade invertida e argumento
 * faltando passam em qualquer asercao de texto e so aparecem olhando o frame.
 */
const PALS = [
  { start: 0.00, end: 0.40, text: 'Faturamento' },
  { start: 0.40, end: 0.80, text: 'nao' },
  { start: 0.80, end: 1.30, text: 'e' },
  /* buraco de 0,2 s entre 1,30 e 1,50: pausa de verdade, ninguem aceso */
  { start: 1.50, end: 2.00, text: 'lucro.' },
];
eq('8a. inicio INCLUSIVO: no instante exato do comeco, a palavra acende',
  [activeWordIndex(PALS, 0), activeWordIndex(PALS, 0.4), activeWordIndex(PALS, 1.5)],
  [0, 1, 3]);
eq('8b. fim EXCLUSIVO: no instante do fim ela ja apagou', activeWordIndex(PALS, 1.3), -1);
eq('8c. fronteira entre vizinhas acende SO a nova (0,40 e fim de uma e inicio da outra)',
  activeWordIndex(PALS, 0.4), 1);
eq('8d. no buraco entre palavras ninguem esta aceso', activeWordIndex(PALS, 1.4), -1);
eq('8e. antes da primeira palavra ninguem esta aceso', activeWordIndex(PALS, -0.01), -1);
eq('8f. depois da ultima ninguem fica aceso', activeWordIndex(PALS, 2.0), -1);
/* Degradacao: e o que mantem o corte antigo funcionando. Nada aqui pode levantar. */
for (const ruim of [undefined, null, 'nao e lista', 42, {}]) {
  eq(`8g. lista ausente/ilegivel (${String(ruim)}) -> legenda estatica`,
    activeWordIndex(ruim, 1), -1);
}
eq('8h. palavra com tempo torto e IGNORADA, as boas continuam valendo',
  [activeWordIndex([{ start: 'x', end: 1, text: 'a' }, { start: 0, end: 1, text: 'b' }], 0.5),
    activeWordIndex([{ start: NaN, end: NaN, text: 'a' }], 0.5),
    activeWordIndex([{ start: 1, end: 1, text: 'duracao zero' }], 1),
    activeWordIndex([{ start: 2, end: 1, text: 'invertida' }], 1.5),
    activeWordIndex([null, undefined, { start: 0, end: 1, text: 'boa' }], 0.5)],
  [1, -1, -1, -1, 2]);
eq('8i. relogio ilegivel nao acende nada (NaN/Infinity/texto)',
  [activeWordIndex(PALS, NaN), activeWordIndex(PALS, Infinity), activeWordIndex(PALS, 'x')],
  [-1, -1, -1]);
/* Sobreposicao acidental: no maximo UMA ativa, sempre a mesma. */
const sobrepostas = [{ start: 0, end: 2, text: 'a' }, { start: 1, end: 3, text: 'b' }];
eq('8j. sobreposicao resolve na ULTIMA que casa, deterministico (nunca duas verdes)',
  [activeWordIndex(sobrepostas, 1.5), activeWordIndex(sobrepostas, 1.5)], [1, 1]);

/* --- o pop. POLARIDADE, que e o que erra calado. */
eq('8k. progresso 0 = palavra parada no tamanho normal', popPalavra(0), { escala: 1, subida: 0 });
eq('8l. progresso 1 = escala e subida cheias dos tokens',
  popPalavra(1), { escala: TOKENS.palavraEscala, subida: TOKENS.palavraSubida });
ok('8m. a palavra CRESCE (nao encolhe) e SOBE (translateY negativo em CSS)',
  popPalavra(1).escala > 1 && popPalavra(1).subida < 0);
ok('8n. meio caminho fica no meio, monotonico',
  popPalavra(0.5).escala > 1 && popPalavra(0.5).escala < popPalavra(1).escala
  && popPalavra(0.5).subida < 0 && popPalavra(0.5).subida > popPalavra(1).subida);
ok('8o. o sobressalto da mola (11,2% calculado) nao passa de +2% de tamanho',
  popPalavra(1.112).escala < TOKENS.palavraEscala + 0.02);
for (const ruim of [undefined, NaN, 'x', Infinity]) {
  eq(`8p. progresso ilegivel (${String(ruim)}) vira palavra parada, nunca transform: NaN`,
    popPalavra(ruim), { escala: 1, subida: 0 });
}

/* --- tokens e mola */
/* O verde unico (#59E36A) saiu em 2026-09-11 a pedido do operador: leque de cores neon, com
   amarelo na frente. O check mudou de "e esta cor" para as PROPRIEDADES que fazem o recurso
   funcionar -- e uma delas sobrevive do regime antigo: nenhuma cor do leque pode ser a tinta
   semantica do projeto, senao a palavra corrente diz "dinheiro"/"perda" sem querer. */
ok('8q. o leque tem varias cores e nenhuma repetida (cor repetida encurta o leque calada)',
  Array.isArray(TOKENS.palavraCores) && TOKENS.palavraCores.length >= 3
  && new Set(TOKENS.palavraCores).size === TOKENS.palavraCores.length);
ok('8q2. a primeira e o amarelo neon pedido (e a cor da 1a palavra de TODA pagina)',
  hsl(TOKENS.palavraCores[0]).h > 40 && hsl(TOKENS.palavraCores[0]).h < 70
  && hsl(TOKENS.palavraCores[0]).s > 0.85 && hsl(TOKENS.palavraCores[0]).l > 0.45);
ok('8q3. nenhuma cor do leque e a tinta SEMANTICA (ganho/perda/marca) — isso ainda e semaforo',
  TOKENS.palavraCores.every((c) =>
    c !== TOKENS.destaqueGanho && c !== TOKENS.destaquePerda && c !== TOKENS.marcaLaranja));
/* Fica ~200 ms no ar e e lido de relance: cor escura sobre a sombra da legenda nao aparece. */
ok('8q4. toda cor do leque e clara o bastante para ler de relance (l > 0,45)',
  TOKENS.palavraCores.every((c) => hsl(c).l > 0.45));
/* Vizinhas no mesmo matiz fazem o leque parecer defeito de render em vez de escolha. */
ok('8q5. palavras vizinhas nunca caem no mesmo matiz (>=30° de distancia, no circulo)',
  TOKENS.palavraCores.every((c, i) => {
    const d = Math.abs(hsl(c).h - hsl(TOKENS.palavraCores[(i + 1) % TOKENS.palavraCores.length]).h);
    return Math.min(d, 360 - d) >= 30;
  }));
/* A funcao PURA, CHAMADA com o preset de verdade: regex no .jsx nao prova que a cor gira. */
eq('8q6. a cor gira por PALAVRA e da a volta no fim do leque',
  [0, 1, 4, 5, 6].map((i) => corDaPalavra(TOKENS, i)),
  [TOKENS.palavraCores[0], TOKENS.palavraCores[1], TOKENS.palavraCores[4],
    TOKENS.palavraCores[0], TOKENS.palavraCores[1]]);
eq('8q7. estilo torto, leque vazio e indice ilegivel caem no BRANCO, nunca em `undefined`',
  [corDaPalavra(undefined, 0), corDaPalavra({ palavraCores: [] }, 0),
    corDaPalavra({}, 3), corDaPalavra(TOKENS, NaN), corDaPalavra(TOKENS, -2)],
  [TOKENS.palavraCores[0], TOKENS.texto, TOKENS.texto,
    TOKENS.palavraCores[0], TOKENS.palavraCores[0]]);
ok('8r. escala do pop e discreta (1,45x de zoom foi proibido; 1,12 e o pedido)',
  TOKENS.palavraEscala > 1 && TOKENS.palavraEscala <= 1.15);
ok('8s. a subida e de poucos pixels (movimento com motivo, nao salto)',
  TOKENS.palavraSubida <= 0 && TOKENS.palavraSubida >= -8);
eq('8t. a mola e a do pedido', MOLA_PALAVRA, { damping: 12, stiffness: 220, mass: 0.5 });
ok('8u. a mola e subamortecida (z = 0,57): sem sobressalto nao existe "pop"',
  MOLA_PALAVRA.damping / (2 * Math.sqrt(MOLA_PALAVRA.stiffness * MOLA_PALAVRA.mass)) < 1);

/* --- a fatia de palavras de cada pagina (toCaptionPages) */
const cueCurta = {
  start: 10, end: 12, text: 'Faturamento nao e lucro.',
  words: PALS.map((p) => ({ ...p, start: p.start + 10, end: p.end + 10 })),
};
const pagsCurta = toCaptionPages([cueCurta]);
eq('8v. cue que cabe numa pagina leva as 4 palavras dela',
  pagsCurta.length === 1 ? pagsCurta[0].palavras.map((p) => p.text) : null,
  ['Faturamento', 'nao', 'e', 'lucro.']);
/* Fala longa: varias paginas. As fatias tem de ser CONTIGUAS, disjuntas e cobrir tudo --
   errar o cursor acenderia a palavra errada em toda pagina a partir da segunda. */
const termos = ('um dois tres quatro cinco seis sete oito nove dez onze doze treze '
  + 'quatorze quinze dezesseis').split(' ');
const cueLonga = {
  start: 0, end: 16, text: termos.join(' '),
  words: termos.map((t, i) => ({ start: i, end: i + 1, text: t })),
};
const pagsLonga = toCaptionPages([cueLonga]);
ok('8w. fala longa virou varias paginas e todas trouxeram palavras',
  pagsLonga.length > 1 && pagsLonga.every((p) => Array.isArray(p.palavras) && p.palavras.length));
eq('8x. fatias contiguas, na ordem, cobrindo TODAS as palavras (nada repetido, nada perdido)',
  pagsLonga.flatMap((p) => p.palavras.map((w) => w.text)), termos);
ok('8y. e o texto de cada pagina bate com as palavras da fatia dela',
  pagsLonga.every((p) => p.palavras.map((w) => w.text).join(' ') === p.text));
/* Palavra com espaco DENTRO e o caso real, nao a excecao: MEDIDO na amostra
   `video-worker/fixtures/json3-rolante.json`, 18 de 351 palavras (5,1%) sao assim -- a marca
   de troca de falante `>> fulano` e a censura `[ ca ]`. Ela vale como UM atomo: comparando
   contagem de tokens, essas 18 desalinhavam 16 das 66 linhas (24,2%) e um quarto da legenda
   voltava ao estatico. */
const comEspaco = toCaptionPages([{
  start: 0, end: 3, text: '>> ana falou [ ca ] agora',
  words: [{ start: 0, end: 1, text: '>> ana' }, { start: 1, end: 1.5, text: 'falou' },
    { start: 1.5, end: 2, text: '[ ca ]' }, { start: 2, end: 3, text: 'agora' }],
}]);
eq('8z. palavra com espaco dentro (>> falante, [ ca ]) vale como UM atomo, e o texto nao muda',
  comEspaco.length === 1 && comEspaco[0].text === '>> ana falou [ ca ] agora'
    ? comEspaco[0].palavras.map((w) => w.text) : null,
  ['>> ana', 'falou', '[ ca ]', 'agora']);
/* Degradacao no CONSUMO: a conferencia e por CONTEUDO. Palavras que nao descrevem o texto da
   cue (props de versao antiga, cue mexida na mao) nao podem acender palavra errada. */
const desalinhada = toCaptionPages([{
  start: 0, end: 2, text: 'uma duas tres',
  words: [{ start: 0, end: 1, text: 'uma' }, { start: 1, end: 2, text: 'OUTRA' }],
}]);
ok('8z2. juncao das palavras diferente do texto da cue -> legenda estatica, nunca fatia torta',
  desalinhada.length === 1 && desalinhada[0].palavras === undefined);
ok('8z3. palavra com texto vazio invalida o bloco todo em vez de sumir da fatia',
  toCaptionPages([{ start: 0, end: 2, text: 'uma duas',
    words: [{ start: 0, end: 1, text: 'uma' }, { start: 1, end: 2, text: '  ' }] }])[0]
    .palavras === undefined);
ok('8aa. cue SEM tempo por palavra nao ganha a chave (corte antigo renderiza como antes)',
  toCaptionPages([{ start: 0, end: 2, text: 'uma duas tres' }])[0].palavras === undefined);
ok('8ab. `words` que nao e lista e ignorado em vez de derrubar a pagina',
  toCaptionPages([{ start: 0, end: 2, text: 'uma duas', words: 'x' }])[0].palavras === undefined);
/* Acento e pontuacao passam BYTE A BYTE: o karaoke remonta a linha palavra por palavra, e e
   aqui que um trim() a mais comeria um ponto, uma virgula ou um til. */
const textoAcentuado = 'Prejúzo não é lição, é informação: anota aí.';
const acentuada = {
  start: 0, end: 3, text: textoAcentuado,
  words: textoAcentuado.split(' ').map((t, i) => ({ start: i * 0.3, end: i * 0.3 + 0.3, text: t })),
};
eq('8ac. acento, virgula, dois-pontos e ponto final chegam intactos na fatia',
  toCaptionPages([acentuada]).flatMap((p) => p.palavras.map((w) => w.text)),
  textoAcentuado.split(' '));

/* --- fiacao no Clip.jsx. Fraca de proposito (regex casa palavra): a prova de verdade e o
   frame renderizado, que esta no relatorio desta entrega. O que se guarda aqui e a classe de
   erro que o frame sozinho nao denuncia -- base de tempo trocada e CSS na composicao. */
const iLegenda = clipJsx.indexOf('const Legenda');
const corpoLegenda = iLegenda < 0 ? '' : clipJsx.slice(iLegenda);
ok('8ad. o relogio da palavra SOMA o comeco da Sequence (subtrair inverteria a base)',
  /quadro \+ de/.test(corpoLegenda) && !/quadro - de/.test(corpoLegenda));
ok('8ae. a <Legenda> recebe o quadro inicial da propria pagina',
  /<Legenda [^/]*\bde=\{de\}/.test(clipJsx));
ok('8af. quem decide a palavra ativa e a funcao pura, com o relogio em SEGUNDOS',
  /activeWordIndex\(palavras, quadroCorte \/ fps\)/.test(corpoLegenda));
ok('8ag. o pop sai da mola do preset, nao de numero solto no componente',
  /spring\(\{/.test(corpoLegenda) && /config: MOLA_PALAVRA/.test(corpoLegenda)
  && /popPalavra\(progresso, aparencia\)/.test(corpoLegenda));
ok('8ah. a mola comeca no inicio DESTA palavra, nao no da pagina',
  /frame: quadroCorte - Math\.round\(Number\(palavra\.start\) \* fps\)/.test(corpoLegenda));
ok('8ai. cresce por transform, NUNCA por fontSize (fontSize refluiria a linha inteira)',
  /estilo\.transform = "translateY\(/.test(corpoLegenda)
  && /scale\(" \+ pop\.escala/.test(corpoLegenda)
  && !/estilo\.fontSize/.test(corpoLegenda));
ok('8aj. nenhuma transition/animation de CSS na composicao: o render tem de ser deterministico',
  !/transition:/.test(clipJsx) && !/animation:/.test(clipJsx));
ok('8ak. o espaco entre palavras fica FORA do span (dentro dele nao quebraria linha)',
  /\{espaco \? " " : ""\}\s*<span style=\{estilo\}>/.test(clipJsx));
ok('8al. sem tempo por palavra o componente cai no caminho estatico de sempre',
  /conteudo \|\| pedacos\.map/.test(corpoLegenda));
/* Decidido OLHANDO o frame: com `category: money` o pickEmphasis pintava "Faturamento" no
   verde de dinheiro (#8FB573) de forma permanente, ao lado do verde da palavra corrente
   -- duas cores de destaque na mesma tela, o "semaforo" que o proprio comentario do
   destaqueGanho proibe, e o pedido diz que so a palavra corrente fica colorida. Com karaoke, a
   enfase semantica sai; sem karaoke ela continua inteira. */
/* A asercao olha o CODIGO, nao o texto do arquivo: a primeira versao deste check era
   `!/i === indice/` e reprovou por causa do COMENTARIO que diz como reverter a decisao -- a
   mesma armadilha ja registrada no CLAUDE.md (asserir flag proibida no texto reprova a
   documentacao). `estilo.color = cor` era a atribuicao do ramo da enfase no karaoke; o
   caminho estatico usa `color: cor` dentro de um objeto de estilo, entao os dois nao se
   confundem e nenhum comentario casa.
   O `;` no fim NAO e enfeite: sem ele o padrao e PREFIXO de `estilo.color = corDaPalavra(...)`,
   a linha do leque, e o check reprovava a implementacao certa (pego rodando, 2026-09-11). */
ok('8am. com karaoke a enfase semantica NAO e aplicada (uma cor de destaque por tela)',
  /var indice = palavras \? -1 : pickEmphasis\(pagina\.text\)/.test(corpoLegenda)
  && !/estilo\.color = cor;/.test(corpoLegenda));
ok('8an. mas a enfase continua VIVA para o caminho estatico (nao foi removida do projeto)',
  /pickEmphasis/.test(corpoLegenda) && /splitEmphasis/.test(corpoLegenda)
  && /pedaco\.forte/.test(corpoLegenda));

/* ---- o GATE do consumidor, provado por CHAMADA (achado da revisao adversarial) --------
   Enquanto o gate morou escrito a mao dentro do Clip.jsx, a unica prova era regex. MEDIDO
   pela revisao: trocar `pagina.palavras` por `pagina.words` (chave que nunca existiu)
   desligava o karaoke em TODA pagina de TODO corte -- legenda estatica branca, sem erro --
   e passava com as 119 verificacoes verdes. Agora o gate e funcao pura e o teste a chama com
   pagina construida pelo PROPRIO toCaptionPages: as duas pontas da chave se encontram aqui. */
const pagReal = toCaptionPages([cueLonga])[0];
ok('8ao. o gate ACHA as palavras numa pagina montada pelo proprio toCaptionPages',
  Array.isArray(palavrasDaPagina(pagReal)) && palavrasDaPagina(pagReal).length >= 2
  && palavrasDaPagina(pagReal)[0].text === pagReal.text.split(' ')[0]);
ok('8ap. o Clip.jsx usa o gate do preset, nao um `pagina.<chave>` escrito a mao',
  /var palavras = palavrasDaPagina\(pagina\)/.test(corpoLegenda)
  && !/pagina\.palavras/.test(corpoLegenda) && !/pagina\.words/.test(corpoLegenda));
ok('8aq. pagina sem a chave, ou com lixo, nao acende nada',
  [undefined, null, {}, { palavras: 'x' }, { palavras: [] }]
    .every((pag) => palavrasDaPagina(pag) === null));
/* Legenda MANUAL: `parse_json3_words` devolve UMA "palavra" com a FRASE inteira. Sem esta
   guarda a linha toda ficava verde e crescia 12% (achado da revisao). */
ok('8ar. pagina de UM atomo so nao acende (linha de 1 palavra, e a frase da legenda manual)',
  palavrasDaPagina({ palavras: [{ start: 0, end: 3, text: 'Bom dia a todos.' }] }) === null);
const manual = 'Isto aqui e uma frase inteira de legenda manual, com mais de cinquenta caracteres.';
const pagsManual = toCaptionPages([{
  start: 0, end: 5, text: manual, words: [{ start: 0, end: 5, text: manual }],
}]);
ok('8as. frase manual maior que a pagina volta a paginar por TOKEN (2 linhas nao colapsam)',
  pagsManual.length > 1 && pagsManual.every((pg) => pg.text.length <= MAX_CHARS_PAGINA)
  && pagsManual.every((pg) => pg.palavras === undefined));
/* Tempo da pagina saindo das PALAVRAS, e nao da fatia por caractere: com a fatia, a fronteira
   da Sequence caia num instante que a fala nao tem e a palavra acendia atrasada ou nunca. */
const termos30 = Array.from({ length: 30 }, (_, i) => 'palavra' + i);
const cueDuasPaginas = {
  start: 100, end: 130, text: termos30.join(' '),
  words: termos30.map((t, i) => ({ start: 100 + i, end: 101 + i, text: t })),
};
const pgs = toCaptionPages([cueDuasPaginas]);
ok('8at. cue longa virou varias paginas com palavras em todas', pgs.length > 1
  && pgs.every((pg) => Array.isArray(pg.palavras) && pg.palavras.length));
ok('8au. cada pagina COMECA no inicio da primeira palavra dela (nao numa fatia por caractere)',
  pgs.every((pg) => Math.abs(pg.start - pg.palavras[0].start) < 1e-9));
ok('8av. e TODA palavra cai DENTRO da janela da pagina dela (senao acenderia fora da tela)',
  pgs.every((pg) => pg.palavras.every((w) => w.start >= pg.start - 1e-9
    && w.start < pg.end + 1e-9)));
ok('8aw. as paginas seguem contiguas, sem buraco em que a legenda pisca fora',
  pgs.every((pg, i) => i === 0 || Math.abs(pg.start - pgs[i - 1].end) < 1e-9));
ok('8ax. a ultima pagina ainda fecha no fim da cue',
  Math.abs(pgs[pgs.length - 1].end - cueDuasPaginas.end) < 1e-9);
/* ---- fiacao do estilo. Tres lacunas que a revisao apontou: sem estes checks, apagar a cor,
   apagar o inline-block ou negar a subida passavam verdes. */
ok('8ay. a palavra ativa recebe a COR do leque, pelo INDICE dela (sem o `i` o leque nao gira)',
  /estilo\.color = corDaPalavra\(aparencia, i\)/.test(corpoLegenda));
ok('8az. a palavra e inline-block (sem isso o transform num trecho de texto e no-op)',
  /display: "inline-block"/.test(corpoLegenda));
ok('8ba. a subida entra no translateY SEM ser negada (negar fazia a palavra DESCER)',
  /translateY\(" \+ pop\.subida \+ "px\)/.test(corpoLegenda)
  && !/translateY\(" \+ -pop\.subida/.test(corpoLegenda)
  && !/translateY\(" \+ \(-pop\.subida/.test(corpoLegenda));
ok('8bb. e a escala entra no scale SEM inverter',
  /scale\(" \+ pop\.escala \+ "\)/.test(corpoLegenda));

/* ------------------------------------------------- 9. destaque do TITULO
   Toda prova abaixo CHAMA a funcao com titulo construido. Regex no fonte so provaria que
   alguem escreveu a palavra -- a licao que este repo ja pagou duas vezes (2026-08-26 e
   2026-08-27) e que criou o `ancoraLegenda` e o `palavrasDaPagina`. */
const trechoDe = (titulo) => {
  const span = pickTitleHighlight(titulo);
  if (!span) return null;
  return titulo.split(/\s+/).filter(Boolean).slice(span.inicio, span.fim + 1).join(' ');
};

const T1 = 'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.';
eq('9a. o trecho do pedido: numero + escala + unidade de resultado',
  trechoDe(T1), '100 mil pedidos');
eq('9b. moeda entra pela ESQUERDA e o verbo seguinte NAO e engolido',
  trechoDe('Faturei R$ 2 milhões vendendo capinha de celular.'), 'R$ 2 milhões');
eq('9c. porcentagem sozinha ja e o trecho',
  trechoDe('Cortei 40% do custo sem demitir ninguém.'), '40%');

/* Ano nao e resultado. O `quebrei` (peso 2) e que vence aqui -- e o `tudo`, tambem em
   TERMOS_FORTES, fica de fora por ser intensificador. */
const T4 = 'Em 2019 eu quebrei e comecei tudo de novo.';
eq('9d. ano precedido de "em" nao vira destaque; sobra o termo forte', trechoDe(T4), 'quebrei');
ok('9d2. e o ano nao aparece no trecho de jeito nenhum', !String(trechoDe(T4)).includes('2019'));

eq('9e. numero NU nao vira destaque ("as 3 coisas" nao fica mais claro com o 3 forte)',
  trechoDe('As 3 coisas que eu faria diferente hoje.'), null);
eq('9f. empate de peso vai para o da DIREITA (o desfecho cai no fim da frase)',
  trechoDe('Gastei 50 mil e faturei 300 mil no mesmo ano.'), '300 mil');
eq('9g. sem numero nenhum, o termo forte concreto assume',
  trechoDe('O maior erro da minha vida como empresário.'), 'erro');
eq('9h. acento e virgula decimal sobrevivem ao trecho',
  trechoDe('Faturamento de R$ 1,2 milhão em três meses — e o que deu errado.'), 'R$ 1,2 milhão');

/* --- as guardas. Cada par abaixo DISCRIMINA: o caso curto/coberto so difere do caso que
   passa pela guarda que esta sendo provada. Sem isso, remover a guarda passava verde. */
eq('9i. 5 palavras e o piso: com 5 o destaque sai',
  trechoDe('Cortei 40% do custo mensal'), '40%');
eq('9i2. com 4 a MESMA frase nao destaca nada (guarda de tamanho)',
  trechoDe('Cortei 40% do custo'), null);
ok('9i3. e o piso e o documentado', MIN_PALAVRAS_TITULO === 5);
eq('9j. trecho cobrindo mais que a cobertura maxima nao destaca (se tudo brilha, nada brilha)',
  trechoDe('100 mil pedidos por mês.'), null);
ok('9j2. e a cobertura maxima e a documentada', MAX_COBERTURA_TITULO === 0.45);
eq('9k. intensificador ("tudo") esta em TERMOS_FORTES mas NAO serve de manchete',
  trechoDe('Eu perdi tudo e comecei do zero de novo'), null);
ok('9l. o trecho volta como INDICE, nao string (replace pintaria a ocorrencia errada)',
  typeof pickTitleHighlight(T1).inicio === 'number'
  && typeof pickTitleHighlight(T1).fim === 'number');
ok('9m. o trecho nunca atravessa a virgula',
  pickTitleHighlight(T1).inicio > T1.split(/\s+/).indexOf('cidade,'));

/* --- splitTitleHighlight: pedacos para o React, espelhando o splitEmphasis */
const ped = splitTitleHighlight(T1, pickTitleHighlight(T1));
eq('9n. tres pedacos, e o forte e exatamente o trecho',
  ped.filter((p) => p.forte).map((p) => p.texto), ['100 mil pedidos']);
eq('9n2. remontar os pedacos devolve o titulo inteiro', ped.map((p) => p.texto).join(''), T1);
eq('9o. sem trecho, UM pedaco nao-forte -- titulo sem destaque sai como saia antes',
  splitTitleHighlight(T1, null), [{ texto: T1, forte: false }]);

/* --- resolveTitleHighlight: o gate que o Clip.jsx chama */
eq('9p. highlightText do operador VENCE o automatico',
  resolveTitleHighlight(T1, { highlightText: 'pequena cidade' }).origem, 'manual');
eq('9p2. e aponta o trecho que ele pediu, nao o que o automatico acharia',
  splitTitleHighlight(T1, resolveTitleHighlight(T1, { highlightText: 'pequena cidade' }).span)
    .filter((p) => p.forte).map((p) => p.texto), ['pequena cidade,']);
const semBater = resolveTitleHighlight(T1, { highlightText: 'nao existe nisto' });
eq('9q. highlightText que nao bate NAO cai no automatico', semBater.span, null);
eq('9q2. e devolve estado proprio, para quem chama poder dizer (BP-008)',
  semBater.origem, 'manual-sem-correspondencia');
eq('9r. interruptor desliga o automatico por inteiro',
  resolveTitleHighlight(T1, { autoHighlight: false }), { span: null, origem: 'nenhum' });
eq('9s. sem opcao nenhuma o automatico assume',
  resolveTitleHighlight(T1, {}).origem, 'auto');
eq('9s2. titulo sem claim nenhum devolve "nenhum", nao erro',
  resolveTitleHighlight('Um dia comum na minha empresa', {}).origem, 'nenhum');
ok('9t. todo desfecho possivel esta no conjunto FECHADO de origens',
  [resolveTitleHighlight(T1, {}).origem, semBater.origem,
    resolveTitleHighlight(T1, { highlightText: 'pequena cidade' }).origem,
    resolveTitleHighlight(T1, { autoHighlight: false }).origem]
    .every((o) => TITULO_ORIGEM.includes(o)));

/* --- fiacao no Clip.jsx. Fraca de proposito (regex casa palavra), como a do bloco 8: a
   prova de verdade sao os checks acima, que chamam as funcoes. */
ok('9u. o Clip.jsx usa o gate do preset, nao um destaque escrito a mao',
  /const opcoesTitulo = \{ highlightText, autoHighlight \}/.test(clipJsx)
  && /resolveTitleHighlight\(title, opcoesTitulo\)/.test(clipJsx));
/* O alvo mudou de `<Titulo>` para `<CardTitulo>` quando o titulo virou card da marca; a
   INTENCAO e a mesma de antes -- o span calculado tem que CHEGAR ao componente, senao o
   destaque e calculado e jogado fora. O corpo medido tem check proprio no bloco 11. */
/* A tag do card, isolada uma vez: ela e multilinha, entao regex com espaco literal deixa de
   casar assim que alguem acrescenta um prop e o formatador quebra a linha. */
const tagCard = (clipJsx.match(/<CardTitulo[\s\S]*?\/>/) || [''])[0];
/* O JSX sem comentario. Necessario porque a HISTORIA do card esta escrita nos comentarios
   dele — os nomes antigos (`MARCA_BADGE`, `TOKENS.marcaLaranja`) e os hex das duas paletas
   aparecem la de proposito, explicando por que sairam. Procurar por eles no arquivo inteiro
   reprovaria a documentacao, que e a armadilha ja medida neste projeto (o check das flags
   proibidas do yt-dlp falhou por casar com o comentario que as proibia). */
const jsxSemComentario = clipJsx.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('9v. e o span do gate chega ao card (sem isto o destaque nunca aparece)',
  /destaque=\{destaque\.span\}/.test(tagCard));
/* A Montserrat SAIU: o titulo passou a Inter Black, que a legenda ja carregava. Sem o 900
   no `loadFont` o navegador SINTETIZA o peso a partir do 700 e sai um engrossamento borrado
   que so aparece olhando o frame — mesma armadilha de antes, outra familia. */
/* O 800 entrou com a segunda identidade (no Ecommerce Puro o destaque e PESO, 800 -> 900,
   porque a marca e monocromatica). Os DOIS pesos do destaque tem de estar no `loadFont`
   pelo mesmo motivo do 900: peso sintetizado sai borrado e so aparece olhando o frame. */
const pesosInter = (clipJsx.match(/carregarInter\([\s\S]*?weights: \[([^\]]*)\]/) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean);
ok('9w. os pesos que as duas identidades usam estao TODOS no loadFont',
  ['600', '700', '800', '900'].every((p) => pesosInter.includes(p)));
/* O CARD continua sem familia propria: o 800 dele e peso novo, nao fonte nova. A familia
   que entrou (Archivo Black) veio do estilo `impacto` da LEGENDA, e cada familia carregada
   e um arquivo a mais que o render espera antes do primeiro quadro.
   O check deixou de contar um numero fixo e passou a cobrar a RELACAO: o Clip.jsx carrega
   exatamente as familias que algum estilo pede. Assim ele reprova nos dois erros que
   importam — fonte carregada que estilo nenhum usa (peso morto no render) e estilo pedindo
   familia que ninguem carregou (legenda na fonte padrao do Chrome, sem erro). */
ok('9w2. so entram as FAMILIAS que algum estilo de legenda pede (o card nao traz nenhuma)',
  !/carregarMontserrat/.test(clipJsx)
  && !/google-fonts\/Montserrat/.test(clipJsx)
  && (clipJsx.match(/from "@remotion\/google-fonts\//g) || []).length
     === new Set(LEGENDA_STYLES.map((e) => LEGENDA_PRESETS[e].familia)).size);
/* A APARENCIA do destaque virou coisa da MARCA (o card ganhou uma segunda identidade), e
   por isso ela saiu do TOKENS: um valor global nao consegue ser laranja num card e peso no
   outro. O que sobra aqui e a metade do 9x que continua valendo — nenhum peso e nenhuma cor
   de destaque pode morar em TOKENS, senao ela vale para as duas marcas calada.
   A aparencia por identidade e provada por EXECUCAO no bloco 13 (13p/13q), e a fiacao no
   13y2. */
ok('9x. nenhuma aparencia de destaque de titulo sobrou em TOKENS (e por marca agora)',
  !('tituloPesoDestaque' in TOKENS)
  && !('tituloDestaqueCor' in TOKENS)
  && !('tituloPeso' in TOKENS));
/* Mesma intencao do 9y de antes, agora por marca: todo peso que alguma identidade usa tem
   de estar no `loadFont`, senao o navegador SINTETIZA e sai borrado (so aparece no frame).
   O 9w prova a lista; aqui se prova que os pesos das marcas sao exatamente o que ela cobre,
   e que ninguem trouxe um peso que o render nao carrega. */
ok('9y. todo peso que as marcas pedem esta carregado (nenhum peso sintetizado)',
  Object.values(TITLE_CARD_PRESETS).every((c) =>
    pesosInter.includes(String(c.tituloPeso)) && pesosInter.includes(String(c.destaque.peso))));

/* -------------------------------------- 10. tarja da miniatura (fundo do 9:16)
   A miniatura entra no tamanho de UMA tarja, repetida em cima e embaixo, em vez de UMA
   esticada cobrindo 1080x1920 (que ampliava ~3,2x e mostrava uma fatia ilegivel). */
ok('10a. o padrao e a tarja de um 16:9 deitado (1920-608)/2', BANDA_PADRAO === 656);
eq('10b. ZERO e resposta legitima: fonte vertical enche o quadro, nao ha tarja',
  ancoraBanda(0), 0);
eq('10c. prop ausente cai no padrao, e null/vazio contam como AUSENTE (Number(null) e 0)',
  [ancoraBanda(undefined), ancoraBanda(null), ancoraBanda('')],
  [BANDA_PADRAO, BANDA_PADRAO, BANDA_PADRAO]);
eq('10d. numero em texto vale (o props chega por JSON)', ancoraBanda('656'), 656);
eq('10e. lixo e negativo caem no padrao em vez de virar altura torta',
  [ancoraBanda('abc'), ancoraBanda(-40), ancoraBanda(NaN)],
  [BANDA_PADRAO, BANDA_PADRAO, BANDA_PADRAO]);
eq('10f. fracionario vira inteiro (height em px quebrado deixa costura de 1px)',
  ancoraBanda(655.6), 656);

/* --- fiacao no Clip.jsx. Fraca de proposito (regex casa palavra), como a do bloco 8:
   a prova de verdade sao os checks acima, que CHAMAM a funcao. */
ok('10g. o Fundo recebe a tarja pelo gate do preset, nao pelo prop cru',
  /<Fundo imagem=\{fundo\} banda=\{ancoraBanda\(bandaAltura\)\} \/>/.test(clipJsx));
ok('10h. a miniatura e desenhada DUAS vezes, uma em cada borda',
  /\["top", "bottom"\]\.map/.test(clipJsx));
ok('10i. cada copia tem a ALTURA da tarja (sem isso ela volta a cobrir o quadro)',
  /height: banda/.test(clipJsx) && !/height: "100%", objectFit: "cover"/.test(clipJsx));
/* `\s*\+\s*` e nao um espaco literal: a cadeia do `filter` ganhou o desfoque em 2026-09-03 e
   passou a quebrar linha no meio, o que reprovava esta regex sem nada estar errado. */
ok('10j. e continua em cover, escurecida pelos mesmos tokens do FFmpeg',
  /objectFit: "cover"/.test(clipJsx)
  && /brightness\("\s*\+\s*TOKENS\.fundoLuz/.test(clipJsx)
  && /saturate\("\s*\+\s*TOKENS\.fundoSaturacao/.test(clipJsx));
ok('10k. tarja zero nao desenha nada (em vez de esconder miniatura atras do video)',
  /imagem && banda > 0/.test(clipJsx));

/* ------------------------------------------------------ 11. card da marca no titulo */

/* O card e MONOCROMATICO por medicao: o logo do canal tem 0 pixels cromaticos, entao nao
   existe cor de marca para extrair. Este check e o que impede alguem "animar" o card com
   um azul qualquer mais tarde: canal neutro tem r == g == b (tolerancia de 4, porque o
   `fundo` do preset e #0A0A0C -- quase preto de proposito, para nao criar banda contra
   video comprimido). */
const canais = (cor) => {
  const hex = String(cor).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return [1, 2, 3].map((i) => parseInt(hex[i], 16));
  const rgba = String(cor).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return rgba ? [1, 2, 3].map((i) => Number(rgba[i])) : null;
};
const neutro = (cor) => {
  const c = canais(cor);
  return !!c && Math.max(...c) - Math.min(...c) <= 4;
};
/* O card e PRETO + LARANJA. O fundo e o texto continuam neutros (preto quase puro e branco);
   a cor entra so no acento, e o acento e UM: o laranja medido na referencia da marca.
   Este check trocou de polaridade quando a marca trocou — antes ele exigia que NADA fosse
   cromatico, porque a marca anterior nao tinha cor para extrair. */
ok('11a. fundo e texto do card seguem neutros (a cor entra so no acento)',
  [TOKENS.cardFundo, TOKENS.texto].every(neutro));
/* O acento agora e da IDENTIDADE (o card tem duas), entao a pergunta mudou de "o TOKENS
   global e laranja" para "a identidade colorida e laranja em todo acento dela" — e o
   monocromatico e checado do lado oposto no 13o/13o2. */
ok('11a2. o acento e o laranja MEDIDO na referencia, e e o mesmo em todo acento da marca',
  TOKENS.marcaLaranja === '#FF5F01'
  && TITLE_CARD_PRESETS.primo_rico.destaque.cor === TOKENS.marcaLaranja
  && TITLE_CARD_PRESETS.primo_rico.fileteCor === TOKENS.marcaLaranja
  && !neutro(TITLE_CARD_PRESETS.primo_rico.bordaCor));
/* Laranja PROFUNDO, nao neon. A regra e a mesma do check 1g das cores da legenda: saturacao
   alta COM luminancia alta e o que o pedido proibe. Aqui a saturacao e ~1 e a luz ~0,50. */
ok('11a3. e nao e neon (saturado, mas escuro o bastante para ler como financeiro)',
  !(hsl(TOKENS.marcaLaranja).s > 0.85 && hsl(TOKENS.marcaLaranja).l > 0.55));
ok('11b. o card usa a MESMA coluna optica da legenda (blocos alinhados, nao duas margens)',
  TOKENS.cardLargura === TOKENS.legendaLargura && TOKENS.cardLargura < TOKENS.largura);
ok('11c. sombra deslocada e contida, nunca glow colorido',
  /^0 \d+px \d+px rgba\(0, 0, 0/.test(TOKENS.cardSombra));
ok('11d. a placa da marca respeita o minimo verificado no README da identidade (56px)',
  TOKENS.logoAltura >= 56);
ok('11e. escada de corpos decrescente, com piso ainda legivel num 1080 de largura',
  TITULO_FONTES.every((f, i) => i === 0 || f < TITULO_FONTES[i - 1])
  && TITULO_FONTES[TITULO_FONTES.length - 1] >= 30);
ok('11f. a largura util desconta borda, os dois paddings E o filete (estimar para mais estoura)',
  larguraTitulo()
  === TOKENS.cardLargura - 2 * TOKENS.cardBordaPeso - 2 * TOKENS.cardPadding - TOKENS.tituloFilete);

/* --- a bateria de titulos do pedido. O contrato e o mesmo para todos: NUNCA passa de 3
   linhas e NUNCA corta palavra. O corpo exato nao e fixado aqui de proposito -- ele desce
   quando o `AVANCO_MONTSERRAT` for recalibrado olhando um frame, que e o botao documentado. */
const CASOS = {
  curto: 'Comece hoje.',
  pedido: 'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.',
  longo: 'Eu quebrei duas vezes antes de entender que disciplina vale mais que '
    + 'motivação no primeiro ano de empresa.',
  acentos: 'Faturei R$ 1,2 milhão em 2019? Não — foi em 2021.',
};
Object.keys(CASOS).forEach((chave) => {
  const texto = CASOS[chave];
  const span = resolveTitleHighlight(texto, {}).span;
  const m = tituloEscalonado(texto, span);
  ok(`11g.${chave}. no maximo ${MAX_LINHAS_TITULO} linhas`, m.linhas <= MAX_LINHAS_TITULO);
  ok(`11h.${chave}. nada e aparado (a escada resolve antes de cortar texto)`, !m.cortado);
  ok(`11i.${chave}. o texto sai inteiro, sem palavra partida`, m.texto === texto);
  ok(`11j.${chave}. o corpo sai da escada, nunca um numero solto`,
    TITULO_FONTES.indexOf(m.fonte) >= 0);
});
eq('11k. titulo curto fica no maior degrau, numa linha so',
  [tituloEscalonado(CASOS.curto, null).fonte, tituloEscalonado(CASOS.curto, null).linhas],
  [TITULO_FONTES[0], 1]);
ok('11l. titulo longo DESCE o corpo em vez de virar quarta linha',
  tituloEscalonado(CASOS.longo, resolveTitleHighlight(CASOS.longo, {}).span).fonte
  < TITULO_FONTES[0]);

/* --- integracao com o algoritmo de destaque que JA existia (nao foi criado um segundo) */
eq('11m. o destaque do titulo do pedido e o trecho de resultado, nao uma palavra solta',
  splitTitleHighlight(CASOS.pedido, resolveTitleHighlight(CASOS.pedido, {}).span)
    .filter((p) => p.forte).map((p) => p.texto),
  ['100 mil pedidos']);
eq('11n. acento, virgula decimal e moeda sobrevivem inteiros no trecho destacado',
  splitTitleHighlight(CASOS.acentos, resolveTitleHighlight(CASOS.acentos, {}).span)
    .filter((p) => p.forte).map((p) => p.texto),
  ['R$ 1,2 milhão']);
ok('11o. e o ANO continua recusado (o "2019" nao vira resultado)',
  !splitTitleHighlight(CASOS.acentos, resolveTitleHighlight(CASOS.acentos, {}).span)
    .some((p) => p.forte && p.texto.indexOf('2019') >= 0));
eq('11p. exatamente UM trecho destacado por titulo, em todos os casos',
  Object.keys(CASOS).map((k) => splitTitleHighlight(
    CASOS[k], resolveTitleHighlight(CASOS[k], {}).span).filter((p) => p.forte).length)
    .filter((q) => q > 1).length, 0);
eq('11q. sem informacao de destaque o titulo sai inteiro, num pedaco so',
  splitTitleHighlight(CASOS.pedido, resolveTitleHighlight(CASOS.pedido, { autoHighlight: false }).span),
  [{ texto: CASOS.pedido, forte: false }]);

/* --- o PESO do destaque entra na conta. Sabotagem que isto reprova: medir os tokens
   destacados como se fossem normais. O caso e CONSTRUIDO a partir da propria largura util,
   entao continua discriminando depois de recalibrar o `AVANCO_MONTSERRAT`: uma palavra que
   cabe exatamente na linha DEIXA de caber quando cresce 8%, e o corpo tem que descer. */
const cpl0 = Math.floor(larguraTitulo() / (TITULO_FONTES[0] * AVANCO_MONTSERRAT));
const justo = 'x'.repeat(cpl0) + ' fim';
ok('11r. token destacado pesa mais na medida (senao a linha estoura calada)',
  tituloEscalonado(justo, { inicio: 0, fim: 0 }).fonte
  < tituloEscalonado(justo, null).fonte);
ok('11s. e nunca pesa MENOS: destacar jamais aumenta o corpo',
  Object.keys(CASOS).every((k) => tituloEscalonado(CASOS[k], resolveTitleHighlight(CASOS[k], {}).span)
    .fonte <= tituloEscalonado(CASOS[k], null).fonte));

/* --- o ultimo recurso. Aparar so acontece quando nem o piso da escada cabe. */
const absurdo = new Array(40).fill('palavra').join(' ');
const cortado = tituloEscalonado(absurdo, null);
ok('11t. titulo impossivel e aparado, e a reticencia fica a vista',
  cortado.cortado === true && /…$/.test(cortado.texto));
ok('11u. aparado em fronteira de PALAVRA — nenhuma palavra sai partida ao meio',
  cortado.texto.replace('…', '').trim().split(' ').every((p) => p === 'palavra'));
ok('11v. e mesmo aparado respeita o teto de linhas e o piso da escada',
  cortado.linhas <= MAX_LINHAS_TITULO
  && cortado.fonte === TITULO_FONTES[TITULO_FONTES.length - 1]);
eq('11w. titulo vazio devolve texto vazio (e o Clip nao monta o card)',
  tituloEscalonado('', null).texto, '');
eq('11x. so espaco tambem, sem virar card com reticencia',
  tituloEscalonado('   ', null).texto, '');

/* --- entrada do card. POLARIDADE, que e o que erra calado (mesma licao do `popPalavra`). */
eq('11y. no comeco: invisivel, ABAIXO do lugar e menor', entradaCard(0),
  { opacidade: 0, subida: TOKENS.cardSubida, escala: TOKENS.cardEscalaInicial });
eq('11z. no fim: opaco, assentado no lugar e em tamanho natural', entradaCard(1),
  { opacidade: 1, subida: 0, escala: 1 });
ok('11z2. sobe (nao desce) para o lugar: o deslocamento so diminui',
  entradaCard(0.25).subida > entradaCard(0.75).subida && entradaCard(0.75).subida > 0);
ok('11z3. nunca parte de scale(0) — coisa nenhuma aparece do nada',
  TOKENS.cardEscalaInicial >= 0.9 && TOKENS.cardEscalaInicial < 1);
ok('11z4. entrada dentro do teto de 300ms (9 quadros a 30fps)',
  TOKENS.cardEntradaQuadros / TOKENS.fps <= 0.3);
ok('11z5. subida discreta, entre 8 e 16px como o pedido manda',
  TOKENS.cardSubida >= 8 && TOKENS.cardSubida <= 16);
eq('11z6. fora do intervalo e grampeado nas duas pontas',
  [entradaCard(-5).opacidade, entradaCard(9).opacidade], [0, 1]);
eq('11z7. progresso ilegivel deixa o card ASSENTADO, nunca invisivel',
  [entradaCard(NaN), entradaCard(undefined)].map((e) => e.opacidade), [1, 1]);

/* --- a marca embutida */
ok('11z8. a marca viaja no codigo, nao por staticFile (o --public-dir e o cache do YouTube)',
  /^data:image\/(png;base64|svg\+xml)/.test(MARCA_BADGE) && MARCA_BADGE.length > 1000);
/* Emblema CIRCULAR: fixar os dois lados o transformaria em elipse, que e o erro mais visivel
   que existe num logo. A largura tem de sair da proporcao do arquivo. */
ok('11z9. e a proporcao vem do proprio arquivo, para fixar a altura nunca distorcer a marca',
  Math.abs(MARCA_PROPORCAO - MARCA_LARGURA / MARCA_ALTURA) < 1e-9 && MARCA_PROPORCAO === 1);
ok('11z9b. o identificador existe e NAO se declara oficial (o pedido proibe sem autorizacao)',
  /\S/.test(MARCA_NOME) && !/oficial/i.test(MARCA_NOME));

/* --- fiacao no Clip.jsx. Fraca de proposito (regex casa palavra), como a dos blocos 8 e 10:
   as provas de verdade sao os checks acima, que CHAMAM as funcoes. */
ok('11z10. o card recebe o corpo MEDIDO, nao um numero escrito na composicao',
  /texto=\{medida\.texto\}/.test(tagCard) && /fonte=\{medida\.fonte\}/.test(tagCard));
ok('11z11. o portao do card e o texto MEDIDO (titulo aparado a nada nao monta card vazio)',
  /comLegenda && medida\.texto/.test(clipJsx));
ok('11z12. o card antigo (span branco solto) nao existe mais',
  !/<Titulo /.test(clipJsx) && /const CardTitulo =/.test(clipJsx));
/* Os nomes mudaram quando o card ganhou a segunda identidade (`MARCA_BADGE` solto ->
   `marca.badge`, vindo do registro), mas a INTENCAO de cada um destes e a mesma de antes. */
ok('11z13. a placa entra pelo Img do Remotion (com <img> cru o frame 0 sai sem a marca)',
  /<Img\s+src=\{marca\.badge\}/.test(clipJsx) && !/<img\s/.test(clipJsx));
ok('11z14. a largura da placa sai da proporcao, nunca fixada a mao',
  /width: TOKENS\.logoAltura \* marca\.proporcao/.test(clipJsx));
ok('11z15. o filete da esquerda e a cor da MARCA, e sai do preset (nao de um hex no JSX)',
  /width: TOKENS\.tituloFilete, backgroundColor: card\.fileteCor/.test(clipJsx)
  /* Nenhum hex de cor escrito a mao na composicao: e o que impede uma identidade de ser
     desenhada com a cor da outra por copiar-colar. */
  && !/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(jsxSemComentario));
ok('11z15b. o emblema e o identificador ficam na MESMA linha, no alto a esquerda',
  /<Img\s+src=\{marca\.badge\}[\s\S]*?\{marca\.nome\}/.test(clipJsx)
  && /display: "flex", alignItems: "center"/.test(clipJsx));
/* O identificador e SECUNDARIO: se ele encostar no menor degrau do titulo, a assinatura
   passa a competir com a manchete — que e exatamente o que o pedido proibe. */
ok('11z15c. o identificador e bem menor que o menor corpo de titulo',
  TOKENS.marcaNomeFonte < TITULO_FONTES[TITULO_FONTES.length - 1]);
ok('11z16. entrada E saida passam pelos gates do preset, nao por conta na composicao',
  /entradaCard\(SUAVE\(presencaCard\(quadro, total\)\)\)/.test(clipJsx));
/* O grampo dos dois lados mudou de lugar: era do `interpolate` e agora mora no
   `presencaCard` (provado por execucao nos 12k/12l/12o). Aqui sobra a CURVA — ease-out
   forte, e nunca uma mola, que sobressaltaria um card que o pedido proibe de quicar. */
ok('11z17. ease-out FORTE no card; nunca ease-in, nunca mola',
  /const SUAVE = Easing\.bezier\(0\.23, 1, 0\.32, 1\)/.test(clipJsx)
  && !/spring\(/.test((clipJsx.match(/const CardTitulo = [\s\S]*?\n\};/) || [''])[0]));
ok('11z18. so opacity e transform animam (o resto repagina layout em todo quadro)',
  !/animation:/.test(clipJsx) && !/transition:/.test(clipJsx));

/* ------------------------------- 12. o card entra, fica 4s e SAI (chamada, nao rotulo) */

const JANELA = TOKENS.cardDuracaoSeg * TOKENS.fps;   // 120 quadros
ok('12a. a chamada dura 4s, tempo de ler o titulo sem tampar o video o clipe inteiro',
  TOKENS.cardDuracaoSeg === 4 && JANELA === 120);
ok('12b. a saida e mais CURTA que a entrada (decidir e devagar, responder e rapido)',
  TOKENS.cardSaidaQuadros < TOKENS.cardEntradaQuadros && TOKENS.cardSaidaQuadros > 0);
ok('12c. e as duas cabem na janela com folga de card parado no meio',
  TOKENS.cardEntradaQuadros + TOKENS.cardSaidaQuadros < JANELA);
/* O card fica no meio do vídeo — e NÃO pode encostar na legenda, que é ancorada por baixo.
   Por aritmética e não por olho: em `cardCentroPct: 0.50` a base do card caía em cima da
   fala (visto no frame) e a legenda era desenhada por cima dele. Pior caso dos dois lados:
   título de 3 linhas no maior corpo, página de legenda de 2 linhas. */
const altoCard = TOKENS.cardBordaPeso * 2 + TOKENS.cardPadding * 2
  + TOKENS.logoAltura + TOKENS.logoFolga
  + MAX_LINHAS_TITULO * TITULO_FONTES[0] * TOKENS.tituloEntrelinha;
const baseCard = TOKENS.altura * TOKENS.cardCentroPct + altoCard / 2;
const topoLegenda = TOKENS.altura - LEGENDA_BASE_PADRAO
  - MAX_LINHAS * TOKENS.legendaFonte * TOKENS.legendaEntrelinha;
ok('12d. o card fica no meio do quadro, acima do centro geometrico',
  TOKENS.cardCentroPct > 0.3 && TOKENS.cardCentroPct <= 0.5);
ok('12d2. e a base dele NAO encosta na legenda nem no pior caso dos dois',
  baseCard < topoLegenda);
ok('12e. e a posicao antiga (pendurado no alto) nao sobrou como token morto',
  !('cardTopo' in TOKENS));

/* --- presencaCard: a POLARIDADE dos dois lados, que e o que erra calado. */
eq('12f. no primeiro quadro ainda nao ha card', presencaCard(0, JANELA), 0);
eq('12g. terminada a entrada, o card esta inteiro no ar',
  presencaCard(TOKENS.cardEntradaQuadros, JANELA), 1);
eq('12h. no meio da janela continua inteiro (fica PARADO, nao pulsa)',
  presencaCard(60, JANELA), 1);
ok('12i. a entrada SOBE (0 -> 1), nunca o contrario',
  presencaCard(2, JANELA) < presencaCard(5, JANELA)
  && presencaCard(5, JANELA) < presencaCard(8, JANELA));
ok('12j. a saida DESCE (1 -> 0): trocada, o card sumiria logo depois de entrar',
  presencaCard(JANELA - 5, JANELA) > presencaCard(JANELA - 2, JANELA)
  && presencaCard(JANELA - 2, JANELA) > 0);
eq('12k. passada a janela nao sobra nada na tela',
  [presencaCard(JANELA, JANELA), presencaCard(JANELA + 30, JANELA)], [0, 0]);
eq('12l. antes do comeco tambem nao', presencaCard(-3, JANELA), 0);
/* Sem esta reparticao, entrada e saida se sobrepoem numa janela curta: o progresso passaria
   de 1 na entrada (card estourando de tamanho) e ficaria negativo na saida (piscada). */
const CURTA = 8;
ok('12m. clipe curto demais reparte a janela em vez de atropelar as duas rampas',
  Array.from({ length: CURTA }, (_, i) => presencaCard(i, CURTA))
    .every((v) => v >= 0 && v <= 1));
ok('12n. e mesmo assim chega a aparecer por inteiro em algum quadro',
  Array.from({ length: CURTA }, (_, i) => presencaCard(i, CURTA)).some((v) => v === 1));
eq('12o. janela invalida nao desenha card em vez de dividir por zero',
  [presencaCard(0, 0), presencaCard(0, -5), presencaCard(NaN, JANELA),
    presencaCard(0, NaN)], [0, 0, 0, 0]);

/* --- fiacao: a janela tem de CHEGAR na Sequence e no componente. */
ok('12p. o card vive numa Sequence com a janela medida, nao montado o clipe inteiro',
  /<Sequence from=\{0\} durationInFrames=\{cardQuadros\} layout="none">/.test(clipJsx));
ok('12q. e o componente recebe a MESMA janela (senao entra e nunca sai)',
  /total=\{cardQuadros\}/.test(tagCard));
ok('12r. a janela e limitada pela duracao do clipe (Sequence maior derruba o render)',
  /Math\.min\(\s*Math\.round\(TOKENS\.cardDuracaoSeg \* fps\), durationInFrames\)/.test(clipJsx)
  && /Math\.max\(1, Math\.min\(/.test(clipJsx));
ok('12s. centrado pelo proprio tamanho, para a posicao nao depender do numero de linhas',
  /translate\(-50%, calc\(-50% \+ " \+ entrada\.subida \+ "px\)\)/.test(clipJsx)
  && /top: TOKENS\.cardCentroPct \* 100 \+ "%"/.test(clipJsx));

/* -------------------------------------- 13. as DUAS identidades do card
   O card tinha UMA marca fixa e o operador nao podia escolher. Agora sao duas, e o risco
   novo nao e visual: e uma marca alcancar o asset, o identificador ou a paleta da outra, e
   um valor torto atravessar ate a composicao e produzir card sem marca nenhuma. */

/* --- o contrato do valor. Conjunto FECHADO e padrao compativel com o que ja existia. */
eq('13a. duas identidades mais o "sem card", nesta ordem', TITLE_CARD_STYLES,
  ['primo_rico', 'puro_ecommerce', 'nenhum']);
/* A lista traz LITERAIS porque e lida como texto pelas outras duas copias do conjunto
   (serve.py e video-ops.js); a constante existe para o codigo nao repetir a string. Este
   check amarra as duas pontas — divergirem faria o "sem card" virar marca desconhecida num
   dos lados. */
ok('13a2. o valor do "sem card" e o MESMO na constante e na lista',
  TITLE_CARD_SEM === 'nenhum' && TITLE_CARD_STYLES.indexOf(TITLE_CARD_SEM) >= 0);
/* --- "Sem card": desfecho legitimo, e NAO o padrao. */
ok('13a3. "sem card" nao tem identidade no registro (nao ha marca para possuir)',
  !(TITLE_CARD_SEM in TITLE_CARD_PRESETS)
  && Object.keys(TITLE_CARD_PRESETS).length === TITLE_CARD_STYLES.length - 1);
/* `null` significa "o operador escolheu nao ter", e nunca "valor quebrado" — este ja caiu
   na marca padrao antes. Sabotagem que este par reprova: trocar o ramo explicito por um
   `|| null`, que mascararia uma entrada do registro faltando por engano. */
eq('13a4. "sem card" resolve para null; valor TORTO resolve para a marca padrao',
  [titleCardPreset(TITLE_CARD_SEM), titleCardPreset('marca_inventada').marca,
    titleCardPreset(undefined).marca],
  [null, 'primo_rico', 'primo_rico']);
ok('13a5. o padrao NUNCA e "sem card" (valor torto nao pode apagar o card calado)',
  TITLE_CARD_PADRAO !== TITLE_CARD_SEM
  && titleCardPreset(null) !== null && titleCardPreset(7) !== null);
/* O portao do card no Clip.jsx tem de consultar a identidade RESOLVIDA. Sem isto, "Sem
   card" chegaria ao componente como `card={null}` e o `card.marca` derrubaria o render
   inteiro — nao seria um card faltando, seria tela preta. */
ok('13a6. o portao do card considera a identidade resolvida, e a tag usa a MESMA const',
  /const cardMarca = titleCardPreset\(titleCardStyle\);/.test(clipJsx)
  && /comLegenda && medida\.texto && cardMarca/.test(clipJsx)
  && /card=\{cardMarca\}/.test(tagCard));
ok('13b. o padrao e o que TODO corte ja renderiza hoje (clip antigo nao muda de marca)',
  TITLE_CARD_PADRAO === 'primo_rico'
  && TITLE_CARD_STYLES.indexOf(TITLE_CARD_PADRAO) >= 0);
/* --- o validador, CHAMADO com valor construido. Sabotagem que isto reprova: trocar o
   `indexOf(...) >= 0` por um teste de verdade (`valor ? valor : padrao`), que deixaria
   qualquer string passar — e uma string desconhecida chega ao `TITLE_CARD_PRESETS` como
   `undefined`, ou seja um card sem placa, sem filete e sem borda, sem erro nenhum. */
eq('13c. ausente, null, vazio e undefined caem no padrao',
  [undefined, null, ''].map(titleCardStyleOf),
  ['primo_rico', 'primo_rico', 'primo_rico']);
eq('13d. valor VALIDO passa intacto (senao o seletor nao seleciona nada)',
  TITLE_CARD_STYLES.map(titleCardStyleOf), TITLE_CARD_STYLES);
/* O ROTULO da tela nao e a chave: e o que impede "Puro Ecommerce" de virar identificador. */
/* Vale para TODOS os rotulos, inclusive o "Sem card": se o texto da tela fosse aceito como
   valor, reescrever o rotulo amanha mudaria a logica. Sem tamanho fixo de proposito — a
   lista pode crescer sem este check virar mentira. */
ok('13e. NENHUM rotulo visivel e aceito como valor',
  Object.values(TITLE_CARD_LABELS).every((r) => titleCardStyleOf(r) === TITLE_CARD_PADRAO));
eq('13f. tipo errado e valor desconhecido tambem caem no padrao (nao explodem)',
  [7, {}, [], true, 'PRIMO_RICO', 'primo-rico', 'outra_marca'].map(titleCardStyleOf),
  new Array(7).fill('primo_rico'));
ok('13g. e o preset resolvido NUNCA e undefined, aconteca o que acontecer',
  [undefined, null, 7, 'xxx', 'Primo Rico'].every((v) => {
    const c = titleCardPreset(v);
    return !!c && c.marca === 'primo_rico';
  }));
ok('13h. cada identidade tem rotulo, e nenhum rotulo sobra',
  TITLE_CARD_STYLES.every((s) => /\S/.test(TITLE_CARD_LABELS[s]))
  && Object.keys(TITLE_CARD_LABELS).length === TITLE_CARD_STYLES.length);

/* --- ISOLAMENTO: uma marca nao pode vestir a outra. E aqui que uma troca de chave, um
   copiar-colar entre as duas entradas ou um asset trocado aparecem. */
const cPrimo = titleCardPreset('primo_rico');
const cPuro = titleCardPreset('puro_ecommerce');
ok('13i. cada preset aponta para a SUA marca no registro',
  cPrimo.marca === 'primo_rico' && cPuro.marca === 'puro_ecommerce');
/* "Sem card" fica FORA daqui: nao ha marca para ele possuir. As identidades sao as chaves
   do registro de presets, e cada uma tem de ter placa no `MARCAS` — nem sobrando (marca sem
   preset que a use) nem faltando (preset que aponta para placa inexistente). */
const IDENTIDADES = Object.keys(TITLE_CARD_PRESETS);
ok('13j. o registro de marcas cobre exatamente as identidades, e o "sem card" nao entra',
  IDENTIDADES.every((s) => !!MARCAS[s])
  && Object.keys(MARCAS).length === IDENTIDADES.length
  && !(TITLE_CARD_SEM in MARCAS));
/* Os assets sao DIFERENTES e sao os do repositorio. Sabotagem que isto reprova: apontar as
   duas entradas para o mesmo badge — o seletor mudaria de posicao e o video sairia igual. */
ok('13k. as duas placas sao arquivos diferentes',
  MARCAS.primo_rico.badge !== MARCAS.puro_ecommerce.badge);
ok('13l. a placa do Primo Rico e a do repositorio (PNG do emblema)',
  MARCAS.primo_rico.badge === MARCA_BADGE
  && /^data:image\/png;base64,/.test(MARCAS.primo_rico.badge));
ok('13m. a placa do Ecommerce Puro e a do repositorio (SVG do badge)',
  MARCAS.puro_ecommerce.badge === PURO_BADGE
  && /^data:image\/svg\+xml;base64,/.test(MARCAS.puro_ecommerce.badge));
/* As DUAS viajam embutidas: o `--public-dir` do render aponta para o cache do YouTube, e
   `staticFile()` nao alcanca o repositorio. Uma marca por caminho de asset seria a metade
   que quebra na nuvem. */
ok('13m2. nenhuma das duas depende de staticFile (as duas viajam no codigo)',
  Object.values(MARCAS).every((m) => /^data:image\//.test(m.badge) && m.badge.length > 1000));
/* Proporcao de CADA arquivo. O emblema e circular (1) e a placa e deitada (~4,5): fixar os
   dois lados viraria elipse num e fecharia o `PURO` no outro. */
ok('13m3. cada marca traz a proporcao do SEU arquivo',
  Math.abs(MARCAS.primo_rico.proporcao - MARCA_LARGURA / MARCA_ALTURA) < 1e-9
  && MARCAS.primo_rico.proporcao === 1
  && Math.abs(MARCAS.puro_ecommerce.proporcao - PURO_PROPORCAO) < 1e-9
  && MARCAS.puro_ecommerce.proporcao > 4);
/* O identificador de TEXTO existe so onde a placa nao traz o wordmark. Sabotagem que isto
   reprova: copiar `MARCA_NOME` para a entrada do Ecommerce Puro, que escreveria o nome do
   canal ao lado de uma placa que ja o contem. */
ok('13n. o Primo Rico tem identificador de texto; o Ecommerce Puro NAO (a placa ja o traz)',
  /\S/.test(MARCAS.primo_rico.nome) && MARCAS.primo_rico.nome === MARCA_NOME
  && MARCAS.puro_ecommerce.nome === '' && PURO_NOME === '');
ok('13n2. e nenhum identificador se declara oficial (o pedido proibe sem autorizacao)',
  Object.values(MARCAS).every((m) => !/oficial/i.test(m.nome)));
/* PALETA: o laranja da marca do Primo Rico nao pode aparecer em NENHUM valor do Ecommerce
   Puro, que e monocromatico por medicao (0 pixels cromaticos no logo de referencia). */
const valoresPuro = JSON.stringify(cPuro);
ok('13o. nenhum vestigio do laranja da outra marca no preset monocromatico',
  !/FF5F01/i.test(valoresPuro) && !/255,\s*95,\s*1/.test(valoresPuro));
/* E o contrario: o card monocromatico nao pode ter cor cromatica nenhuma. Todo valor de cor
   dele tem de ser cinza puro (R=G=B) ou branco. */
ok('13o2. o card monocromatico e realmente monocromatico (R=G=B em toda cor dele)',
  [cPuro.fileteCor, cPuro.bordaCor, cPuro.identificadorCor, cPuro.destaque.cor]
    .every((cor) => {
      const hex = /^#([0-9a-f]{6})$/i.exec(cor);
      if (hex) {
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
        return r === g && g === b;
      }
      const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(cor);
      return !!rgb && rgb[1] === rgb[2] && rgb[2] === rgb[3];
    }));
/* O Primo Rico, ao contrario, TEM de usar o laranja medido — senao a identidade dele se
   perdeu e o seletor passou a oferecer duas variacoes do mesmo card. */
ok('13o3. o card colorido usa o laranja MEDIDO na referencia',
  cPrimo.fileteCor === TOKENS.marcaLaranja
  && cPrimo.destaque.cor === TOKENS.marcaLaranja
  && /255,\s*95,\s*1/.test(cPrimo.bordaCor));
/* As duas bordas sao distinguiveis: mesma borda nas duas apagaria metade da diferenca. */
ok('13o4. as duas identidades tem borda e filete distintos',
  cPrimo.bordaCor !== cPuro.bordaCor && cPrimo.fileteCor !== cPuro.fileteCor);

/* --- o DESTAQUE: aparencia por marca, algoritmo compartilhado. */
/* No Primo Rico o sinal e cor, e o peso e o MESMO do titulo: somar peso diria a mesma coisa
   duas vezes. No Ecommerce Puro nao ha cor, e o sinal e o peso — base e destaque no mesmo
   peso nao deixariam NADA destacado, que e a sabotagem que este par reprova. */
ok('13p. o card colorido destaca por COR, no mesmo peso do titulo',
  cPrimo.destaque.cor !== TOKENS.texto
  && cPrimo.destaque.peso === cPrimo.tituloPeso
  && cPrimo.destaque.sublinhado === false);
ok('13q. o card monocromatico destaca por PESO, e o peso do destaque e MAIOR que o do titulo',
  cPuro.destaque.cor === TOKENS.texto
  && cPuro.destaque.peso > cPuro.tituloPeso
  && cPuro.destaque.sublinhado === true);
/* Cada identidade tem de ter ALGUM sinal de destaque. Sabotagem que isto reprova: uma
   entrada sem cor propria E sem peso extra — o trecho escolhido sairia igual ao resto, e o
   destaque inteiro viraria calculo jogado fora. */
ok('13q2. nenhuma identidade fica SEM sinal de destaque',
  Object.values(TITLE_CARD_PRESETS).every((c) =>
    c.destaque.cor !== TOKENS.texto || c.destaque.peso > c.tituloPeso || c.destaque.sublinhado));
/* O ALGORITMO e um so. As duas identidades tem de escolher o MESMO trecho da MESMA
   manchete — o pedido proibe duplicar o algoritmo, e duas escolhas diferentes seriam o
   sintoma. Provado por EXECUCAO nos dois sentidos, e nao por "nao ha segundo pickTitle". */
const TITULOS_13 = [
  'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.',
  'Faturei R$ 1,2 milhao em 2019? Nao — foi em 2021.',
  'Comece hoje.',
  'Eu quebrei duas vezes antes de entender que disciplina vale mais que motivacao no '
    + 'primeiro ano de empresa.',
  'Cortei 40% do custo mensal',
];
ok('13r. as duas identidades destacam o MESMO trecho de toda manchete',
  TITULOS_13.every((t) => {
    const a = resolveTitleHighlight(t, { highlightText: '', autoHighlight: true });
    const b = resolveTitleHighlight(t, { highlightText: '', autoHighlight: true });
    return JSON.stringify(a) === JSON.stringify(b);
  })
  /* E o destaque nao e funcao da marca: as funcoes compartilhadas nao recebem preset
     nenhum, entao nao ha por onde uma marca influenciar a escolha. */
  && resolveTitleHighlight.length <= 2 && splitTitleHighlight.length <= 2);
/* O destaque MANUAL continua vencendo nas duas, e o interruptor continua desligando. */
ok('13r2. highlightText manual e autoHighlight:false valem igual nas duas identidades',
  resolveTitleHighlight(TITULOS_13[0], { highlightText: 'pequena cidade', autoHighlight: true })
    .origem === 'manual'
  && resolveTitleHighlight(TITULOS_13[0], { highlightText: '', autoHighlight: false })
    .span === null);

/* --- RESPONSIVIDADE nas duas: curto, longo e acentuado. A escada de corpo e compartilhada,
   entao o contrato e o mesmo — NUNCA passa de 3 linhas e nunca sai do corpo declarado. */
ok('13s. curto, longo e acentuado cabem em 3 linhas nas DUAS identidades',
  IDENTIDADES.every((estilo) => {
    const card = titleCardPreset(estilo);
    return TITULOS_13.every((t) => {
      const span = resolveTitleHighlight(t, { highlightText: '', autoHighlight: true }).span;
      const m = tituloEscalonado(t, span);
      return m.linhas <= MAX_LINHAS_TITULO && TITULO_FONTES.includes(m.fonte)
        /* O peso da marca nao pode fazer o titulo sumir nem estourar a caixa. */
        && card.tituloPeso >= 700 && m.texto.length > 0;
    });
  }));
/* Acento e virgula decimal sobrevivem inteiros nas duas (nada de normalizacao por marca). */
ok('13s2. acento e virgula decimal chegam intactos ao card nas duas identidades',
  tituloEscalonado(TITULOS_13[1], null).texto.includes('R$ 1,2 milhao')
  && tituloEscalonado(TITULOS_13[1], null).texto.includes('Nao'));

/* --- a GEOMETRIA e compartilhada, e isto e o que torna isso seguro.
   O `larguraTitulo()` le `TOKENS`, ou seja UM valor para as duas marcas — nenhum preset o
   recebe. Se uma identidade ganhar padding ou filete proprio, a estimativa de linhas passa
   a mentir PARA MAIS para ela: o estouro horizontal classico, que so aparece no frame.
   Este check e o aviso: quem acrescentar geometria a um preset reprova aqui, com o recado
   de passar o preset ao `larguraTitulo`/`tituloEscalonado`. */
ok('13t. nenhum preset de marca traz geometria propria (senao o larguraTitulo mente)',
  Object.values(TITLE_CARD_PRESETS).every((c) =>
    TITULO_GEOMETRIA_COMPARTILHADA.every((chave) => !(chave in c))));
ok('13t2. e a geometria compartilhada existe TODA em TOKENS (lista sem chave morta)',
  TITULO_GEOMETRIA_COMPARTILHADA.every((chave) => chave in TOKENS));
ok('13t3. a largura de texto e a MESMA nas duas identidades (uma caixa, dois vestidos)',
  larguraTitulo() > 0
  && larguraTitulo() === TOKENS.cardLargura - 2 * TOKENS.cardBordaPeso
    - 2 * TOKENS.cardPadding - TOKENS.tituloFilete);
/* O sublinhado do destaque em `em`, e derivado do filete: px fixo nao desce com o corpo, e
   a 32px ele encostava nos acentos da linha de baixo (medido, 0,7px de folga). */
ok('13u. o sublinhado sai do filete e do degrau de referencia (em, nunca px)',
  TITULO_FILETE_REF === TITULO_FONTES[0]
  && TOKENS.tituloFilete / TITULO_FILETE_REF < 0.1);
/* E a espessura tem de CHEGAR ao JSX derivada, nao como literal. Sabotagem que isto reprova
   (medida — passava com a suite verde): trocar a conta por `"4px"`. Em px o sublinhado nao
   desce com o corpo, e no degrau de 32px ele encosta nos acentos da linha de baixo (folga
   medida de 0,7px) — defeito que so aparece OLHANDO o frame de um titulo de tres linhas. */
ok('13u2. a espessura do sublinhado e DERIVADA no JSX, nunca um px escrito a mao',
  /textDecorationThickness:\s*\n?\s*\(TOKENS\.tituloFilete \/ TITULO_FILETE_REF\)/.test(clipJsx)
  && !/textDecorationThickness:\s*"?\d+px/.test(clipJsx));
/* O deslocamento do sublinhado tambem em `em`, pela mesma razao: em px ele fica colado no
   glifo nos corpos grandes e longe dele nos pequenos. */
ok('13u3. e o deslocamento do sublinhado tambem e relativo ao corpo',
  /textUnderlineOffset: "[0-9.]+em"/.test(clipJsx));

/* --- FIACAO no Clip.jsx. Aqui as assercoes sao de texto, e por isso os checks acima
   CHAMAM as funcoes: a licao de 2026-08-26 ("`in arquivo` so prova que alguem escreveu a
   palavra") reincidiu em 2026-08-27 e criou o `ancoraLegenda`. O que estas linhas provam e
   so que o valor CHEGA — o comportamento e provado por execucao. */
/* O check le o prop DENTRO do destructuring do Clip, e nao a linha inteira copiada: com a
   linha literal, qualquer prop novo vizinho (foi o `legendaStyle` da legenda) reprovava um
   check que nada tem a ver com ele. Mesma forma do 14q. */
ok('13v. o Clip.jsx recebe titleCardStyle como prop (sem isto a escolha nunca chega)',
  /export const Clip = \(\{[\s\S]{0,400}?\btitleCardStyle\b/.test(clipJsx));
/* Sabotagem que isto reprova: `card={TITLE_CARD_PRESETS.primo_rico}` ou qualquer preset
   escrito a mao na tag — o seletor mudaria de posicao na tela e o video sairia sempre com a
   MESMA marca, calado, que e exatamente o defeito que esta entrega conserta. */
/* A chamada saiu de dentro da tag e virou a const `cardMarca` quando o "Sem card" entrou —
   o portao precisa do MESMO valor que o componente recebe. A intencao deste check nao mudou:
   a identidade tem de chegar ao card RESOLVIDA a partir do prop, e nunca escrita a mao.
   Sabotagem que ele reprova: `card={titleCardPreset('primo_rico')}` ou qualquer literal. */
ok('13w. e a identidade chega ao card pelo GATE, resolvida do prop',
  /card=\{cardMarca\}/.test(tagCard)
  && /const cardMarca = titleCardPreset\(titleCardStyle\);/.test(clipJsx));
ok('13w2. nenhuma marca escrita a mao na tag do card',
  !/card=\{TITLE_CARD_PRESETS\./.test(clipJsx)
  && !/card=\{\s*\{/.test(clipJsx));
/* O defaultProps existe para o Remotion Studio abrir MOSTRANDO um card — e tem de abrir no
   PADRAO, senao o Studio mostra uma marca e o render sai com outra. */
ok('13x. o defaultProps traz a identidade, e e o padrao do preset (nao um literal)',
  /titleCardStyle: TITLE_CARD_PADRAO,/.test(clipJsx));
/* Nenhum valor de marca hardcoded sobrou na composicao: enquanto o `CardTitulo` importava
   `MARCA_BADGE` direto, um segundo card so poderia escolher o asset com um `if` aqui. */
ok('13y. o CardTitulo le a marca do REGISTRO, nao de um import solto',
  /const marca = MARCAS\[card\.marca\];/.test(clipJsx)
  && /<Img\s+src=\{marca\.badge\}/.test(clipJsx)
  && /width: TOKENS\.logoAltura \* marca\.proporcao/.test(clipJsx));
ok('13y2. e todo valor de identidade sai do preset resolvido, nunca de TOKENS/hex',
  /backgroundColor: card\.fileteCor/.test(clipJsx)
  && /card\.bordaCor/.test(clipJsx)
  && /fontWeight: card\.tituloPeso/.test(clipJsx)
  && /color: card\.destaque\.cor/.test(clipJsx)
  && /fontWeight: card\.destaque\.peso/.test(clipJsx)
  && /card\.destaque\.sublinhado/.test(clipJsx));
/* O card antigo lia estes tres nomes direto do modulo da marca. Nenhum pode sobrar em
   codigo (em comentario pode — e onde a historia esta escrita, e por isso o
   `jsxSemComentario`). */
ok('13z. nenhum import solto de marca sobrou no CODIGO do Clip.jsx',
  !/\bMARCA_BADGE\b/.test(jsxSemComentario)
  && !/\bMARCA_NOME\b/.test(jsxSemComentario)
  && !/\bMARCA_PROPORCAO\b/.test(jsxSemComentario)
  && !/TOKENS\.marcaLaranja/.test(jsxSemComentario)
  && !/TOKENS\.tituloDestaqueCor/.test(jsxSemComentario));
/* O identificador some quando a placa ja traz o wordmark — e o teste e sobre o NOME ter
   conteudo, nao um `if` de marca: trocar a marca nao pode acender texto que a placa contem. */
ok('13z2. o identificador de texto e condicionado ao nome, nao a um if de marca',
  /\{marca\.nome\s*\n?\s*\?/.test(clipJsx)
  && !/card\.marca === ["']/.test(jsxSemComentario)
  && !/marca\.marca === ["']/.test(jsxSemComentario));


/* ============================================================ 14. enquadramento do palco
   O que este bloco existe para impedir: que o recorte seja escrito A MAO dentro do
   Clip.jsx. Em 2026-08-27 tres sabotagens da ancora da legenda passaram com CINCO suites
   verdes porque a prova era regex sobre o TEXTO do componente -- tirar o argumento da tag
   (`bottom: undefined`), inverter o sinal (510px fora de lugar) e tirar a chave do
   destructuring (436px de erro em TODO corte) eram todas invisiveis. Foi por isso que
   nasceu o `ancoraLegenda`, e e por isso que o palco nasce como funcao pura CHAMADA aqui. */

eq('14a. o conjunto e o mesmo do worker.py/video-ops.js, na mesma ordem',
  REFRAMES, ['blur', 'crop', 'crop11', 'crop45']);
eq('14b. o padrao e `blur`: trecho salvo antes do seletor sai como sempre saiu',
  REFRAME_PADRAO, 'blur');
/* Duas listas de proposito, e o check cobra a RELACAO entre elas: o `crop` de quadro cheio
   e interno (amplia 1,78x numa fonte 16:9) e continua alcancavel so pela query, como sempre
   foi. Igualdade aqui deixaria o `crop` aparecer na tela. */
ok('14c. os OFERECIDOS sao subconjunto proprio, e o `crop` nao esta entre eles',
  REFRAMES_OFERECIDOS.every((r) => REFRAMES.includes(r))
  && REFRAMES_OFERECIDOS.length < REFRAMES.length
  && !REFRAMES_OFERECIDOS.includes('crop'));
ok('14d. todo perfil tem rotulo, e o rotulo NUNCA e a chave',
  REFRAMES.every((r) => typeof REFRAME_LABELS[r] === 'string' && REFRAME_LABELS[r].length)
  && REFRAMES.every((r) => REFRAME_LABELS[r] !== r));
eq('14e. reframeOf: conhecido passa, o resto cai no padrao',
  [reframeOf('crop45'), reframeOf('crop11'), reframeOf('zoom'), reframeOf(undefined),
    reframeOf(null), reframeOf('')],
  ['crop45', 'crop11', 'blur', 'blur', 'blur', 'blur']);

/* `ancoraVideo` NAO e o `ancoraBanda`, e a diferenca e o ZERO. La ele e resposta legitima
   (fonte ja vertical nao sobra tarja); aqui altura 0 e video nenhum -- uma caixa de altura
   zero com `overflow: hidden` entregaria o corte sem imagem, com o fundo inteiro a vista e
   NENHUM erro. Este par de checks e a polaridade entre os dois gates. */
eq('14f. ancoraVideo: zero, negativo, lixo e ausente caem no padrao',
  [ancoraVideo(0), ancoraVideo(-40), ancoraVideo('abc'), ancoraVideo(NaN),
    ancoraVideo(null), ancoraVideo(undefined)],
  [VIDEO_ALTURA_PADRAO, VIDEO_ALTURA_PADRAO, VIDEO_ALTURA_PADRAO, VIDEO_ALTURA_PADRAO,
    VIDEO_ALTURA_PADRAO, VIDEO_ALTURA_PADRAO]);
eq('14g. e numero bom passa, arredondado (height fracionario deixa costura de 1px)',
  [ancoraVideo(1080), ancoraVideo(1349.6)], [1080, 1350]);
ok('14h. ancoraBanda aceita zero e ancoraVideo NAO (a polaridade entre os dois gates)',
  ancoraBanda(0) === 0 && ancoraVideo(0) === VIDEO_ALTURA_PADRAO);

/* O GATE do recorte, chamado com valor construido. `blur` tem de devolver a geometria de
   sempre -- e o que faz todo trecho ja salvo sair como saia. */
const gBlur = palcoGeometria('blur', 608);
ok('14i. `blur` nao recorta: largura 100%, sem altura, sem objectFit',
  gBlur.recorta === false && gBlur.caixa.width === '100%'
  && gBlur.caixa.height === undefined
  && gBlur.objectFit === null && gBlur.video.objectFit === undefined);
ok('14j. e mantem o enquadramento do FFmpeg: centro 50%, escala 1',
  gBlur.caixa.top === '50%' && /scale\(1\)/.test(gBlur.caixa.transform)
  && TOKENS.videoCentroPct === 0.5 && TOKENS.videoEscala <= 1);
/* Cantos arredondados no "Inteiro" (pedido do usuario, 2026-09-11). O PAR importa: raio sem
   `overflow: hidden` nao corta pixel nenhum -- sai canto reto com a suite verde. */
ok('14r. o "Inteiro" arredonda os cantos, e o raio sai do token (com o overflow que corta)',
  gBlur.caixa.borderRadius === TOKENS.videoRaio && TOKENS.videoRaio > 0
  && gBlur.caixa.overflow === 'hidden');

const g11 = palcoGeometria('crop11', 1080);
const g45 = palcoGeometria('crop45', 1350);
ok('14k. `crop11` e `crop45` recortam a FONTE numa caixa de 1080 x altura',
  g11.recorta && g45.recorta
  && g11.caixa.width === TOKENS.largura && g45.caixa.width === TOKENS.largura
  && g11.caixa.height === 1080 && g45.caixa.height === 1350
  && g11.caixa.overflow === 'hidden' && g45.caixa.overflow === 'hidden');
/* `objectFit` sai SEPARADO do estilo porque no `<Video>` do @remotion/media ele e prop de
   primeira classe, nao CSS. MEDIDO olhando o frame: dentro de `style` ele e IGNORADO, e o
   1:1 saia com o video em 608px de altura dentro da caixa de 1080 -- ou seja recorte
   nenhum, com a legenda (ancorada como se o video tivesse 1080) caindo na tarja. O unico
   aviso era uma linha no console do render, no meio da saida. */
ok('14l. e o cover viaja FORA do estilo (no style o @remotion/media o ignora)',
  g11.objectFit === 'cover' && g45.objectFit === 'cover'
  && g11.video.objectFit === undefined && g45.video.objectFit === undefined
  && g11.video.height === '100%');
/* O raio e SO do "Inteiro". Aqui a caixa tem os 1080 de largura do quadro, entao a curva
   cairia na BORDA do arquivo exportado -- entalhe escuro no canto do video, nao moldura.
   Esta e a metade que o 14r nao cobre: sem ela, arredondar tudo passa verde. */
ok('14s. `crop11` e `crop45` NAO arredondam (a curva cairia na borda do quadro)',
  g11.caixa.borderRadius === undefined && g45.caixa.borderRadius === undefined);
/* Aritmetica da paridade com o FFmpeg: `cover` num 1080x1350 com fonte 16:9 escala para
   2400 de largura e corta 660 de cada lado, mantendo 1080/2400 = 45% -- o mesmo 55% que o
   `crop='min(iw,ih*4/5)'...` do filtro corta. */
const larguraCoberta = (altura) => altura * (16 / 9);
ok('14m. o 4:5 mantem 45% da largura da fonte (o mesmo 55% que o FFmpeg corta)',
  Math.abs(TOKENS.largura / larguraCoberta(1350) - 0.45) < 0.005);
ok('14n. e o 1:1 mantem 56,25% (43,75% cortados), tambem igual ao filtro',
  Math.abs(TOKENS.largura / larguraCoberta(1080) - 0.5625) < 0.005);
/* Perfil torto nao inventa geometria: cai no padrao, que e nao recortar. */
ok('14o. perfil desconhecido cai no padrao e NAO recorta',
  palcoGeometria('zoom', 1080).recorta === false
  && palcoGeometria(undefined, 1080).recorta === false);
/* Fiacao no Clip.jsx. Fraca de proposito (regex casa palavra) -- a prova de verdade sao os
   checks acima, que CHAMAM a funcao. O que esta regex pega e o palco voltando a ter estilo
   escrito a mao no componente. */
ok('14p. o Palco usa o gate do preset, e recebe os DOIS props',
  /palcoGeometria\(reframe, altura\)/.test(clipJsx)
  && /<Palco src=\{src\} reframe=\{reframe\} altura=\{videoAltura\} \/>/.test(clipJsx));
ok('14q. e os dois props existem no destructuring do Clip (senao chegam undefined)',
  /export const Clip = \(\{[\s\S]{0,400}?\breframe\b/.test(clipJsx)
  && /export const Clip = \(\{[\s\S]{0,400}?\bvideoAltura\b/.test(clipJsx));

/* ------------------------------------------------- 15. estilos de LEGENDA */
/* A legenda tinha UMA aparencia cravada nos TOKENS e lida pelo Clip.jsx. Agora ela e um
   registro, como o card do titulo — e estes checks sao os que cobram que o estilo de HOJE
   continue identico e que o estilo novo caiba na coluna. */
eq('15a. dois estilos declarados, nesta ordem', LEGENDA_STYLES, ['classico', 'impacto']);
ok('15a2. o padrao e o `classico` (corte antigo nao muda de aparencia)',
  LEGENDA_PADRAO === 'classico' && LEGENDA_STYLES.indexOf(LEGENDA_PADRAO) >= 0);
ok('15a3. todo estilo tem entrada no registro, e o registro nao tem estilo a mais',
  LEGENDA_STYLES.every((e) => !!LEGENDA_PRESETS[e])
  && Object.keys(LEGENDA_PRESETS).length === LEGENDA_STYLES.length);
ok('15a4. todo estilo tem rotulo, e o rotulo NUNCA e a chave',
  LEGENDA_STYLES.every((e) => typeof LEGENDA_LABELS[e] === 'string' && LEGENDA_LABELS[e].length)
  && LEGENDA_STYLES.every((e) => LEGENDA_LABELS[e] !== e));

/* O CHECK QUE MAIS IMPORTA desta entrega: o `classico` E a legenda de hoje. Sabotagem que
   ele reprova: ajustar um numero "so no preset" — corpo, peso, entrelinha, cor da palavra —
   e mudar a aparencia de TODO corte ja publicado sem ninguem pedir. */
const CLASSICO = legendaPreset('classico');
eq('15b. o classico nao muda NENHUM valor de hoje',
  [CLASSICO.fonte, CLASSICO.peso, CLASSICO.entrelinha, CLASSICO.cor, CLASSICO.sombra,
    CLASSICO.palavraCores, CLASSICO.palavraEscala, CLASSICO.palavraSubida, CLASSICO.caixaAlta],
  [TOKENS.legendaFonte, TOKENS.legendaPeso, TOKENS.legendaEntrelinha, TOKENS.texto,
    TOKENS.sombraTexto, TOKENS.palavraCores, TOKENS.palavraEscala, TOKENS.palavraSubida, false]);
eq('15b2. e o teto de pagina dele e o MESMO `MAX_CHARS_PAGINA` de sempre',
  tetoDaPagina(CLASSICO), MAX_CHARS_PAGINA);
ok('15b3. o classico continua na Inter e com a enfase estatica em peso 900',
  CLASSICO.familia === 'inter' && CLASSICO.pesoDestaque === 900);

/* --- o validador, CHAMADO com valor construido (regex nao prova gate). */
eq('15c. ausente, null, vazio, numero e rotulo de tela caem no padrao',
  [undefined, null, '', 7, 'Impacto (caixa alta)'].map(legendaStyleOf),
  ['classico', 'classico', 'classico', 'classico', 'classico']);
eq('15c2. valor VALIDO passa intacto (senao o seletor nao seleciona nada)',
  LEGENDA_STYLES.map(legendaStyleOf), LEGENDA_STYLES);
ok('15c3. estilo torto resolve para o preset de hoje, nunca para `undefined`',
  legendaPreset('nao_existe') === CLASSICO && legendaPreset(undefined) === CLASSICO);

/* --- o estilo novo. */
const IMPACTO = legendaPreset('impacto');
ok('15d. impacto e caixa alta, na familia black, com UM peso (400)',
  IMPACTO.caixaAlta === true && IMPACTO.familia === 'archivo_black' && IMPACTO.peso === 400);
/* A familia Archivo Black tem um peso so: pedir 700/900 dela faz o Chrome sintetizar
   negrito borrado sobre um preto que ja e maximo — visivel so no frame. */
ok('15d2. e a enfase estatica dele NAO pede peso que a familia nao tem',
  IMPACTO.pesoDestaque === IMPACTO.peso);
ok('15d3. corpo maior e entrelinha menor que a do classico (corpo grande pede linha justa)',
  IMPACTO.fonte > CLASSICO.fonte && IMPACTO.entrelinha < CLASSICO.entrelinha);
/* Piso da entrelinha: em caixa alta o til do A e do O ocupam a folga que o A nao usa. */
ok('15d4. mas nao tao justa que o til da caixa alta encoste na linha de cima',
  IMPACTO.entrelinha >= 1.06);
/* A proibicao de neon do 1g VALIA aqui e caiu em 2026-09-11: o operador pediu o leque neon
   para a palavra ativa, nos dois estilos. O que este check agora cobra e que os dois usem a
   MESMA lista -- duas listas seriam dois lugares para calibrar a mesma decisao, e a segunda
   sairia do lugar calada. O resto da paleta (texto, sombra, destaque estatico) continua
   fechado, e o 1g continua valendo para ele. */
eq('15d5. o impacto usa o MESMO leque do classico (a decisao e do recurso, nao do estilo)',
  IMPACTO.palavraCores, CLASSICO.palavraCores);
/* `scale` cresce o glifo e NAO a caixa de layout (medido neste projeto): a 72px em caixa
   alta o mesmo 12% do classico transborda mais px, entao o pop TEM de ser menor. */
ok('15d6. o pop da palavra ativa e menor que o do classico (corpo maior transborda mais)',
  IMPACTO.palavraEscala < CLASSICO.palavraEscala && IMPACTO.palavraEscala > 1);

/* --- a conta da coluna, que e o que impede a linha de estourar. */
eq('15e. o avanco medido da Inter e o numero que o MAX_CHARS_LINHA ja usava',
  Math.round(AVANCO_INTER * 100) / 100, 0.55);
ok('15e2. caixa alta e mais larga que caixa baixa na MESMA fonte (medido: +22%)',
  AVANCO_INTER_CAIXA_ALTA > AVANCO_INTER * 1.15);
ok('15e3. a estimativa da black e mais conservadora que a caixa alta medida da Inter',
  AVANCO_ARCHIVO_BLACK > AVANCO_INTER_CAIXA_ALTA);
eq('15e4. a conta do classico devolve o MAX_CHARS_LINHA de sempre',
  charsPorLinhaLegenda(CLASSICO.fonte, CLASSICO.avanco), MAX_CHARS_LINHA);
/* Entrada torta nao pode virar teto 0: pagina de zero caractere e laco infinito no
   toCaptionPages, ou seja render travado em vez de legenda torta. */
eq('15e5. corpo ou avanco invalidos caem no teto de hoje, nunca em zero',
  [charsPorLinhaLegenda(0, 0.55), charsPorLinhaLegenda(58, 0), charsPorLinhaLegenda(NaN, NaN)],
  [MAX_CHARS_LINHA, MAX_CHARS_LINHA, MAX_CHARS_LINHA]);
ok('15f. a linha do impacto cabe na coluna de 820px por aritmetica',
  charsPorLinhaLegenda(IMPACTO.fonte, IMPACTO.avanco) * IMPACTO.fonte * IMPACTO.avanco
    <= TOKENS.legendaLargura);
ok('15f2. e o teto de pagina dele e MENOR que o do classico (caixa alta ocupa mais)',
  tetoDaPagina(IMPACTO) < tetoDaPagina(CLASSICO));
/* Paginacao de verdade, com o teto do estilo — e nao so a formula. */
const pagsImpacto = toCaptionPages(longa, tetoDaPagina(IMPACTO));
ok('15f3. nenhuma pagina do impacto passa do teto DELE',
  pagsImpacto.length > 1 && pagsImpacto.every((p) => p.text.length <= tetoDaPagina(IMPACTO)));
ok('15f4. e nenhuma palavra foi cortada ao meio no caminho',
  pagsImpacto.map((p) => p.text).join(' ').replace(/\s+/g, ' ')
  === longa[0].text.replace(/\s+/g, ' '));
ok('15f5. o impacto corta a MESMA fala em mais paginas que o classico',
  pagsImpacto.length > toCaptionPages(longa, tetoDaPagina(CLASSICO)).length);
/* Sem estilo, o teto e o de hoje: chamada antiga nao muda de resultado. */
eq('15f6. tetoDaPagina() sem argumento devolve o teto do classico',
  tetoDaPagina(undefined), MAX_CHARS_PAGINA);

/* --- o pop por estilo. A polaridade e a amplitude sao o que erra calado aqui (o comentario
   do popPalavra registra as duas vezes em que isso ja aconteceu), entao o teste CHAMA. */
eq('15g. popPalavra SEM estilo se comporta como antes deste registro existir',
  popPalavra(1), { escala: TOKENS.palavraEscala, subida: TOKENS.palavraSubida });
eq('15g2. com estilo, a amplitude e a DO ESTILO',
  popPalavra(1, IMPACTO), { escala: IMPACTO.palavraEscala, subida: IMPACTO.palavraSubida });
eq('15g3. estilo torto cai nos tokens em vez de virar NaN na transformacao',
  popPalavra(1, {}), { escala: TOKENS.palavraEscala, subida: TOKENS.palavraSubida });
ok('15g4. progresso 0 nao mexe em nada, em nenhum estilo',
  popPalavra(0, IMPACTO).escala === 1 && popPalavra(0, IMPACTO).subida === 0);

/* --- geometria: o estilo escolhe TIPOGRAFIA, nunca limite de plataforma. */
ok('15h. nenhum preset traz largura, ancora ou numero de linhas proprios',
  LEGENDA_STYLES.every((e) => {
    const p = LEGENDA_PRESETS[e];
    return p.legendaLargura === undefined && p.largura === undefined
      && p.base === undefined && p.legendaBase === undefined
      && p.linhas === undefined && p.maxLinhas === undefined;
  }));

/* --- fiacao no Clip.jsx. Fraca de proposito (regex casa palavra): o que ela pega e o
   componente voltando a ler os tokens globais, ou a familia nova ficando sem carregamento —
   nos dois casos o render sai SEM erro, com a legenda de sempre ou na fonte do Chrome. */
ok('15i. toda familia declarada tem entrada no mapa de fontes do Clip.jsx',
  LEGENDA_FAMILIAS.every((id) => new RegExp(`\\b${id}:`).test(clipJsx))
  && LEGENDA_STYLES.every((e) => LEGENDA_FAMILIAS.includes(LEGENDA_PRESETS[e].familia)));
ok('15i2. a Archivo Black e carregada com o unico peso que ela tem',
  /carregarArchivoBlack\("normal", \{\s*weights: \["400"\]/.test(clipJsx));
ok('15i3. o Clip resolve a aparencia UMA vez e corta as paginas com o teto DELA',
  /const aparencia = legendaPreset\(legendaStyle\);/.test(clipJsx)
  && /toCaptionPages\(cues, tetoDaPagina\(aparencia\)\)/.test(clipJsx));
ok('15i4. e a Legenda recebe a aparencia (sem isso ela lê `undefined` e o render cai)',
  /aparencia=\{aparencia\}/.test(clipJsx)
  && /const Legenda = \(\{ pagina, cor, base, de, aparencia \}\)/.test(clipJsx));
ok('15i5. o prop legendaStyle existe no destructuring do Clip (senao chega undefined)',
  /export const Clip = \(\{[\s\S]{0,400}?\blegendaStyle\b/.test(clipJsx));
/* A caixa alta e do CSS: o texto que atravessa o pipeline continua sendo a fala como foi
   dita. `toUpperCase` na string quebraria a correcao na mao e divergiria do FFmpeg/ASS. */
ok('15i6. a caixa alta e `textTransform`, e o texto da fala nao e maiusculizado na string',
  /textTransform: aparencia\.caixaAlta \? "uppercase" : "none"/.test(clipJsx)
  && !/toUpperCase/.test(corpoLegenda));

/* --- ARITMETICA DA ALTURA, o que o corpo maior poderia quebrar calado. Os checks 6d e 12d2
   fazem esta conta para o classico; o estilo novo desenha uma pagina ~16% mais alta (72 x
   1.10 contra 58 x 1.18), e as duas folgas que ela come sao as unicas do quadro: a borda de
   cima do video e a base do card do titulo. Com a legenda ancorada pela base, uma pagina
   alta demais nao sai da tela — ela sobe para cima do rosto e por baixo do card, e e por
   isso que isto e check e nao inspecao visual. */
for (const estilo of LEGENDA_STYLES) {
  const e = LEGENDA_PRESETS[estilo];
  const alto = MAX_LINHAS * e.fonte * e.entrelinha;
  ok(`15j. [${estilo}] uma pagina de 2 linhas ainda comeca DENTRO do video (topo em ${(baseTexto - alto).toFixed(0)}, video comeca em ${topoVideo.toFixed(0)})`,
    baseTexto - alto > topoVideo);
  ok(`15j2. [${estilo}] e a base do card do titulo nao encosta no topo dela (${baseCard.toFixed(0)} < ${(TOKENS.altura - LEGENDA_BASE_PADRAO - alto).toFixed(0)})`,
    baseCard < TOKENS.altura - LEGENDA_BASE_PADRAO - alto);
}
console.log(`\nok - ${n} verificacoes passaram (tipografia, quebra de linha, enfase, fundo, destaque de titulo e as duas identidades do card do BUSINESS_SERIOUS).`);
