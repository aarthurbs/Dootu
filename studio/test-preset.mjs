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
import {
  TITLE_CARD_STYLES, TITLE_CARD_PADRAO, TITLE_CARD_LABELS, TITLE_CARD_SEM,
  titleCardStyleOf, TITULO_GEOMETRIA_COMPARTILHADA, TITULO_FILETE_REF,
  cardOf, corDoCard, pesoDoCard, CARD_PESOS, CARD_PADROES, CARD_EXEMPLO,
  CARD_LOGO_MAX, CARD_NOME_MAX, CARD_IDENTIFICADOR_MAX,
} from './src/preset.js';
import {
  LEGENDA_STYLES, LEGENDA_PADRAO, LEGENDA_LABELS, LEGENDA_PRESETS, LEGENDA_FAMILIAS,
  legendaStyleOf, legendaPreset, tetoDaPagina, charsPorLinhaLegenda,
  AVANCO_INTER, AVANCO_INTER_CAIXA_ALTA, AVANCO_MONTSERRAT_CAIXA_ALTA,
  AVANCO_MONTSERRAT_LEGENDA, MAX_CHARS_LINHA,
  LEGENDA_FONTES, LEGENDA_CORES, LEGENDA_ALINHAMENTOS, editOf, resolveLegenda,
  corLegendaOf, contornoPx, caixaLegenda, LEGENDA_SEM,
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
ok('8q3. nenhuma cor do leque e a tinta SEMANTICA (ganho/perda) — isso ainda e semaforo',
  TOKENS.palavraCores.every((c) =>
    c !== TOKENS.destaqueGanho && c !== TOKENS.destaquePerda));
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
   dele — os nomes e os desfechos antigos aparecem la de proposito, explicando por que
   sairam. Procurar por eles no arquivo inteiro reprovaria a documentacao, que e a armadilha
   ja medida neste projeto (o check das flags proibidas do yt-dlp falhou por casar com o
   comentario que as proibia). */
const jsxSemComentario = clipJsx.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('9v. e o span do gate chega ao card (sem isto o destaque nunca aparece)',
  /destaque=\{destaque\.span\}/.test(tagCard));
/* O título usa Inter Black, que a legenda já carregava. Sem o 900
   no `loadFont` o navegador SINTETIZA o peso a partir do 700 e sai um engrossamento borrado
   que so aparece olhando o frame — mesma armadilha de antes, outra familia. */
/* O conjunto de pesos que o EDITOR de cards oferece (`CARD_PESOS`) e o `loadFont` tem de ser
   a MESMA lista. Peso que o operador pode escolher e o render nao carregou o Chrome
   SINTETIZA: sai um engrossamento borrado, sem erro, sem check reprovando, visivel so
   olhando o frame — a armadilha que o 900 e o 800 ja tiveram neste projeto. */
const pesosInter = (clipJsx.match(/carregarInter\([\s\S]*?weights: \[([^\]]*)\]/) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean);
ok('9w. todo peso que o editor de cards oferece esta no loadFont',
  CARD_PESOS.length > 0 && CARD_PESOS.every((p) => pesosInter.includes(String(p))));
/* O CARD continua sem familia propria: o 800 dele e peso novo, nao fonte nova. A familia
   Montserrat vem do estilo `impacto` da LEGENDA, e cada familia carregada
   e um arquivo a mais que o render espera antes do primeiro quadro.
   O check deixou de contar um numero fixo e passou a cobrar a RELACAO: o Clip.jsx carrega
   exatamente as familias que algum estilo pede. Assim ele reprova nos dois erros que
   importam — fonte carregada que estilo nenhum usa (peso morto no render) e estilo pedindo
   familia que ninguem carregou (legenda na fonte padrao do Chrome, sem erro). */
ok('9w2. so entram as FAMILIAS que algum estilo de legenda pede (o card nao traz nenhuma)',
  !/ArchivoBlack|archivo_black/.test(clipJsx)
  && JSON.stringify([...clipJsx.matchAll(/from "@remotion\/google-fonts\/([^"]+)"/g)]
    .map((m) => m[1].toLowerCase()).sort())
    === JSON.stringify([...new Set(LEGENDA_STYLES.map((e) => LEGENDA_PRESETS[e].familia))].sort()));
/* A APARENCIA do destaque e do CARD, e o card e DADO do operador — por isso ela nao mora no
   TOKENS: um valor global nao consegue ser a identidade de uma biblioteca inteira, e token
   global que nada le e a armadilha classica (alguem o ajusta e o valor que manda esta noutro
   lugar). A aparencia e provada por EXECUCAO no bloco 13, e a fiacao no 13y2.
   Junto com eles saiu a paleta MEDIDA de uma identidade de terceiro (`marcaLaranja` /
   `marcaPreto`): o projeto nao hospeda mais marca nenhuma. */
ok('9x. nenhuma aparencia de destaque de titulo, e nenhuma tinta de marca, sobrou em TOKENS',
  !('tituloPesoDestaque' in TOKENS)
  && !('tituloDestaqueCor' in TOKENS)
  && !('tituloPeso' in TOKENS)
  && !('marcaLaranja' in TOKENS)
  && !('marcaPreto' in TOKENS));
/* Mesma intencao do 9y de antes: o peso que SAI do validador tem de estar carregado. O 9w
   prova a lista oferecida; aqui se prova o desfecho — inclusive o do card padrao, que e o
   que veste todo corte de quem ainda nao mexeu em peso nenhum. */
ok('9y. o peso que o validador do card entrega esta sempre carregado (nada sintetizado)',
  [CARD_PADROES.tituloPeso, CARD_PADROES.destaquePeso]
    .every((w) => pesosInter.includes(String(w)))
  && CARD_PESOS.every((w) => pesosInter.includes(String(pesoDoCard(w, 0)))));

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
/* O acento e do CARD, e o card e do operador — nao ha mais tinta de marca fixa no projeto.
   O que o preset ainda e dono e do PADRAO: sem escolha nenhuma, o destaque sai numa COR de
   verdade e nao no branco do proprio titulo, senao o trecho escolhido sairia igual ao resto
   e o algoritmo de destaque viraria calculo jogado fora. */
ok('11a2. o acento PADRAO do card e cor de verdade, e nao o branco do titulo',
  CARD_PADROES.destaqueCor === TOKENS.destaque
  && CARD_PADROES.destaqueCor !== TOKENS.texto
  && !neutro(CARD_PADROES.destaqueCor));
/* Nao neon. A regra e a mesma do check 1g das cores da legenda: saturacao alta COM
   luminancia alta e o que o pedido proibe. */
ok('11a3. e nao e neon (saturado, mas escuro o bastante para ler como serio)',
  !(hsl(CARD_PADROES.destaqueCor).s > 0.85 && hsl(CARD_PADROES.destaqueCor).l > 0.55));
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

/* --- a placa do card. Ela nao mora mais no repositorio: vem da biblioteca do operador,
   embutida como dataURL dentro do proprio card. O motivo de ser dataURL nao mudou — o
   `--public-dir` do render aponta para o cache do YouTube, e `staticFile()` nao alcanca
   nada que esteja aqui. */
ok('11z8. a placa viaja no codigo do card, nao por staticFile nem por endereco remoto',
  cardOf({ logo: 'data:image/png;base64,AAAA' }).logo === 'data:image/png;base64,AAAA'
  && cardOf({ logo: 'https://exemplo/x.png', identificador: 'D' }).logo === '');
/* Emblema CIRCULAR: fixar os dois lados o transformaria em elipse, que e o erro mais visivel
   que existe num logo. A largura tem de sair da proporcao MEDIDA no arquivo, e proporcao
   ilegivel cai em 1 em vez de virar largura zero. */
ok('11z9. a proporcao vem do arquivo, e a ilegivel cai em 1 (nunca em largura zero)',
  cardOf({ logo: 'data:image/svg+xml;base64,AAAA', logoProporcao: 4.5 }).logoProporcao === 4.5
  && cardOf({ logo: 'data:image/png;base64,AAAA', logoProporcao: 0 }).logoProporcao === 1);
/* O identificador e do operador, entao o projeto nao pode cravar um texto — o que ele pode
   e garantir que o campo EXISTE e que um card sem nenhum dos dois nao e salvo. */
ok('11z9b. um card sempre tem placa ou identificador (nunca uma caixa sem identidade)',
  cardOf({ identificador: 'DOOTU | CORTES' }).identificador === 'DOOTU | CORTES'
  && cardOf({ nome: 'so nome' }) === null);

/* --- fiacao no Clip.jsx. Fraca de proposito (regex casa palavra), como a dos blocos 8 e 10:
   as provas de verdade sao os checks acima, que CHAMAM as funcoes. */
ok('11z10. o card recebe o corpo MEDIDO, nao um numero escrito na composicao',
  /texto=\{medida\.texto\}/.test(tagCard) && /fonte=\{medida\.fonte\}/.test(tagCard));
ok('11z11. o portao do card e o texto MEDIDO (titulo aparado a nada nao monta card vazio)',
  /comLegenda && medida\.texto/.test(clipJsx));
ok('11z12. o card antigo (span branco solto) nao existe mais',
  !/<Titulo /.test(clipJsx) && /const CardTitulo =/.test(clipJsx));
/* Os nomes mudaram quando a identidade virou DADO (`marca.badge`, de um registro embutido,
   -> `card.logo`, do card do operador), mas a INTENCAO de cada um destes e a mesma de antes. */
ok('11z13. a placa entra pelo Img do Remotion (com <img> cru o frame 0 sai sem a placa)',
  /<Img\s+src=\{card\.logo\}/.test(clipJsx) && !/<img\s/.test(clipJsx));
ok('11z14. a largura da placa sai da proporcao, nunca fixada a mao',
  /width: TOKENS\.logoAltura \* card\.logoProporcao/.test(clipJsx));
ok('11z15. o filete da esquerda e a cor do CARD, e sai do validador (nao de um hex no JSX)',
  /width: TOKENS\.tituloFilete, backgroundColor: card\.fileteCor/.test(clipJsx)
  /* Nenhum hex de cor escrito a mao na composicao: e o que impede um card de ser desenhado
     com a cor de outro por copiar-colar. */
  && !/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(jsxSemComentario));
ok('11z15b. a placa e o identificador ficam na MESMA linha, no alto a esquerda',
  /\{card\.logo[\s\S]*?\{card\.identificador\}/.test(clipJsx)
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

/* -------------------------------------- 13. o card do titulo e DADO do operador
   Aqui moravam DUAS identidades de terceiro fechadas no codigo. Elas sairam inteiras, e no
   lugar entrou uma BIBLIOTECA que o operador constroi no site. O risco mudou de lugar: nao
   e mais "uma marca alcancar o asset da outra" — e um objeto VINDO DE FORA (localStorage,
   corpo do POST, props no disco) chegar torto ate a composicao e produzir um card sem
   placa, sem filete e sem borda, ou derrubar o render por um campo de `null`.
   Por isso quase tudo aqui CHAMA o validador com valor construido, nos DOIS ramos: card de
   verdade e lixo (BP-014). */

/* --- o contrato do ENUM. Ele diz SE o corte tem card; QUAL card e dado, nao enum. */
eq('13a. o conjunto e "tem card" mais "sem card", nesta ordem', TITLE_CARD_STYLES,
  ['personalizado', 'nenhum']);
/* A lista traz LITERAIS porque e lida como texto pelas outras duas copias do conjunto
   (serve.py e video-ops.js); a constante existe para o codigo nao repetir a string. Este
   check amarra as duas pontas — divergirem faria o "sem card" virar valor desconhecido num
   dos lados. */
ok('13a2. o valor do "sem card" e o MESMO na constante e na lista',
  TITLE_CARD_SEM === 'nenhum' && TITLE_CARD_STYLES.indexOf(TITLE_CARD_SEM) >= 0);
/* O padrao NUNCA e "sem card": valor torto tem de cair em "este corte tem card", e nao
   apagar o card calado de quem nunca escolheu nada. */
ok('13a3. o padrao NUNCA e "sem card"',
  TITLE_CARD_PADRAO !== TITLE_CARD_SEM
  && TITLE_CARD_STYLES.indexOf(TITLE_CARD_PADRAO) >= 0);
/* O portao do card no Clip.jsx tem de consultar o card RESOLVIDO. Sem isto, "Sem card" e
   card apagado chegariam ao componente como `card={null}` e o `card.logo` derrubaria o
   render inteiro — nao seria um card faltando, seria tela preta. */
ok('13a4. o portao do card considera o card resolvido, e a tag usa a MESMA const',
  /const cardResolvido = titleCardStyleOf\(titleCardStyle\) === TITLE_CARD_SEM/.test(clipJsx)
  && /comLegenda && medida\.texto && cardResolvido/.test(clipJsx)
  && /card=\{cardResolvido\}/.test(tagCard));
/* As duas camadas sao ENTRADA, e as duas tem de filtrar: o enum diz se ha card, o `cardOf`
   diz se o objeto que veio junto e um card. Uma so nao basta — enum valido com objeto torto
   e exatamente o caso do card apagado da biblioteca. */
ok('13a5. o "sem card" curto-circuita o objeto, e o objeto torto nao sobrevive ao enum',
  /\? null : cardOf\(card\)/.test(clipJsx));

/* --- o validador do ENUM, CHAMADO com valor construido. Sabotagem que isto reprova: trocar
   o `indexOf(...) >= 0` por um teste de verdade (`valor ? valor : padrao`), que deixaria
   qualquer string passar. */
eq('13c. ausente, null e vazio caem no padrao',
  [undefined, null, ''].map(titleCardStyleOf),
  ['personalizado', 'personalizado', 'personalizado']);
eq('13d. valor VALIDO passa intacto (senao o seletor nao seleciona nada)',
  TITLE_CARD_STYLES.map(titleCardStyleOf), TITLE_CARD_STYLES);
/* O ROTULO da tela nao e a chave: se o texto do botao fosse aceito como valor, reescreve-lo
   amanha mudaria a logica. Sem tamanho fixo de proposito — a lista pode crescer sem este
   check virar mentira. */
ok('13e. NENHUM rotulo visivel e aceito como valor',
  Object.values(TITLE_CARD_LABELS).every((r) => titleCardStyleOf(r) === TITLE_CARD_PADRAO));
eq('13f. tipo errado e valor desconhecido tambem caem no padrao (nao explodem)',
  [7, {}, [], true, 'PERSONALIZADO', 'personal-izado', 'outro'].map(titleCardStyleOf),
  new Array(7).fill('personalizado'));
/* O caso do corte SALVO ANTES desta entrega: ele carrega o valor de uma das identidades que
   sairam. Ele esta fora do conjunto, cai no padrao, e o card que veste passa a ser o da
   biblioteca — nunca um valor de terceiro ressuscitado. */
ok('13g. valor de entrega anterior cai no padrao (nao sobrou caminho de volta para ele)',
  ['identidade_antiga', 'outra_identidade', 'marca_de_terceiro']
    .every((v) => titleCardStyleOf(v) === TITLE_CARD_PADRAO));
ok('13h. cada valor tem rotulo, e nenhum rotulo sobra',
  TITLE_CARD_STYLES.every((s) => /\S/.test(TITLE_CARD_LABELS[s]))
  && Object.keys(TITLE_CARD_LABELS).length === TITLE_CARD_STYLES.length);

/* --- o validador do CARD, chamado com valor construido. Este e o elo novo: antes a
   identidade era escolhida de um registro fechado aqui dentro, agora ela ATRAVESSA o
   navegador, o POST e um JSON no disco antes de virar quadro. */
const LOGO_PNG = 'data:image/png;base64,' + 'A'.repeat(64);
const LOGO_SVG = 'data:image/svg+xml;base64,' + 'B'.repeat(64);
const CARD_CHEIO = {
  id: 'card-1758500000000-ab12', nome: 'Casa', identificador: 'DOOTU | CORTES',
  logo: LOGO_PNG, logoProporcao: 2.5,
  fileteCor: '#FF0000', bordaCor: 'rgba(255, 0, 0, .3)',
  identificadorCor: '#ccc', destaqueCor: 'rgb(0, 128, 255)',
  tituloPeso: 800, destaquePeso: 900, destaqueSublinhado: true,
};
const resolvido = cardOf(CARD_CHEIO);
eq('13i. card completo sobrevive INTEIRO ao validador (nenhum campo perdido no caminho)',
  resolvido,
  {
    id: 'card-1758500000000-ab12', nome: 'Casa', identificador: 'DOOTU | CORTES',
    logo: LOGO_PNG, logoProporcao: 2.5,
    fileteCor: '#FF0000', bordaCor: 'rgba(255, 0, 0, .3)',
    identificadorCor: '#ccc', destaqueCor: 'rgb(0, 128, 255)',
    tituloPeso: 800, destaquePeso: 900, destaqueSublinhado: true,
  });
/* O outro ramo, e o que o BP-014 diz que quebra calado. `null` NUNCA levanta: e o desfecho
   que a composicao le como "este corte nao tem card". */
ok('13j. lixo de qualquer forma vira null, e nada levanta',
  [null, undefined, 0, 7, '', 'card', [], [{}], true, NaN]
    .every((v) => cardOf(v) === null));
/* Card sem logo E sem identificador nao tem identidade para vestir o titulo: a placa viraria
   um retangulo com uma manchete dentro. A tela recusa salva-lo e o validador concorda —
   um dono so para a pergunta "o que e um card". */
ok('13k. card sem logo E sem identificador e invalido (nao ha identidade para vestir)',
  cardOf({}) === null
  && cardOf({ nome: 'so o nome' }) === null
  && cardOf({ logo: '', identificador: '   ' }) === null);
/* E os dois meios-cards sao VALIDOS: so placa (o wordmark ja esta nela) e so texto (quem
   ainda nao tem logo em arquivo). */
ok('13k2. so logo vale, e so identificador tambem vale',
  cardOf({ logo: LOGO_SVG }) !== null
  && cardOf({ logo: LOGO_SVG }).identificador === ''
  && cardOf({ identificador: 'DOOTU' }) !== null
  && cardOf({ identificador: 'DOOTU' }).logo === '');
/* ESQUEMA do logo: so `data:image/...;base64,`. `staticFile()` nao alcanca o repositorio (o
   `--public-dir` e o cache do YouTube), e um endereco remoto ou falharia em carregar ou
   transformaria o render numa busca de rede no meio da captura do quadro. */
ok('13l. endereco que nao e dataURL de imagem e descartado (http, file, javascript, texto)',
  ['http://x/a.png', 'https://x/a.png', 'file:///a.png', 'javascript:alert(1)',
    'data:text/html;base64,AAAA', 'data:image/png,AAAA', '/logo.png', 'logo.png']
    .every((u) => cardOf({ logo: u, identificador: 'DOOTU' }).logo === ''));
ok('13l2. e os quatro tipos aceitos passam',
  ['png', 'svg+xml', 'jpeg', 'webp']
    .every((t) => cardOf({ logo: 'data:image/' + t + ';base64,AAAA' }).logo !== ''));
ok('13l3. tipo de imagem fora da lista nao passa (gif, bmp, avif)',
  ['gif', 'bmp', 'avif']
    .every((t) => cardOf({ logo: 'data:image/' + t + ';base64,AAAA', identificador: 'D' })
      .logo === ''));
/* TETO de tamanho, e ele e do validador e nao so da tela: o corpo do POST e entrada, e um
   dataURL gigante atravessando ate o props-<token>.json e um render que engasga carregando
   a imagem. Contado em CARACTERES do dataURL, o mesmo numero contado do mesmo jeito nas tres
   camadas. */
ok('13l4. logo acima do teto e descartado, e um caractere abaixo passa',
  cardOf({ logo: 'data:image/png;base64,' + 'A'.repeat(CARD_LOGO_MAX),
    identificador: 'D' }).logo === ''
  && cardOf({ logo: 'data:image/png;base64,'
    + 'A'.repeat(CARD_LOGO_MAX - 'data:image/png;base64,'.length) }).logo !== '');
/* PROPORCAO: e MEDIDA no arquivo, nunca chutada. Fora da faixa ela produziria largura zero
   (placa invisivel) ou uma faixa de milhares de pixels — as duas caladas. */
eq('13n. proporcao ausente, zero, negativa, NaN e absurda caem em 1 (nunca em largura zero)',
  [undefined, 0, -3, NaN, Infinity, 1e6, 'larga']
    .map((v) => cardOf({ logo: LOGO_PNG, logoProporcao: v }).logoProporcao),
  [1, 1, 1, 1, 1, 1, 1]);
ok('13n2. e proporcao medida de verdade passa intacta (placa deitada e emblema circular)',
  cardOf({ logo: LOGO_PNG, logoProporcao: 4.4957 }).logoProporcao === 4.4957
  && cardOf({ logo: LOGO_PNG, logoProporcao: 1 }).logoProporcao === 1);
/* PESO: conjunto fechado, e o motivo e tipografico. Peso que o `loadFont` nao carregou o
   Chrome SINTETIZA — engrossamento borrado, sem erro e sem check reprovando (9w amarra a
   lista ao `loadFont`). */
eq('13o. peso fora do conjunto carregado cai no padrao (peso sintetizado sai borrado)',
  [100, 450, 1000, 0, null, 'bold', {}]
    .map((v) => cardOf({ identificador: 'D', tituloPeso: v }).tituloPeso),
  new Array(7).fill(CARD_PADROES.tituloPeso));
/* O `value` de um `<option>` e SEMPRE string: sem a conversao, TODA escolha de peso do
   editor cairia no padrao calada, e o operador veria o controle mexer sem nada mudar. */
ok('13o2. o peso vem como STRING do <select> e mesmo assim vale',
  cardOf({ identificador: 'D', tituloPeso: '700' }).tituloPeso === 700
  && cardOf({ identificador: 'D', destaquePeso: '600' }).destaquePeso === 600
  && pesoDoCard('900', 0) === 900);
/* COR: o valor vai direto para um `style` inline do JSX. String arbitraria ali e texto
   entrando num atributo de estilo, e o desfecho calado (propriedade descartada pelo React)
   seria um card sem filete e sem borda. */
ok('13p. cor invalida cai no padrao, nunca chega ao style inline',
  ['vermelho', 'red; background:url(x)', '#12', 'rgb(1,2)', '', 7, null, {},
    'var(--x)', 'url(javascript:1)']
    .every((c) => cardOf({ identificador: 'D', fileteCor: c }).fileteCor
      === CARD_PADROES.fileteCor));
ok('13p2. e as quatro formas que o editor produz passam (hex 3, hex 6, rgb, rgba)',
  ['#fff', '#A1B2C3', 'rgb(10, 20, 30)', 'rgba(10, 20, 30, .5)']
    .every((c) => corDoCard(c, 'X') === c));
/* Sublinhado e BOOLEANO, e so o `true` de verdade liga: `'false'` (string de radio) e
   `1` ligariam o sublinhado por descuido em toda a biblioteca. */
eq('13q. sublinhado so e verdadeiro quando e o booleano true',
  [true, false, 'true', 'false', 1, 0, undefined]
    .map((v) => cardOf({ identificador: 'D', destaqueSublinhado: v }).destaqueSublinhado),
  [true, false, false, false, false, false, false]);
/* Teto de texto. O `nome` so existe na LISTA da biblioteca; o `identificador` e desenhado
   no quadro, e sem teto uma linha longa empurraria a placa para fora do card. */
ok('13q2. nome e identificador sao aparados nos tetos, e o entorno em branco some',
  cardOf({ identificador: 'x'.repeat(200) }).identificador.length === CARD_IDENTIFICADOR_MAX
  && cardOf({ identificador: 'D', nome: 'y'.repeat(200) }).nome.length === CARD_NOME_MAX
  && cardOf({ identificador: '  DOOTU  ' }).identificador === 'DOOTU');
/* O card PADRAO (nenhum campo de aparencia declarado) tem de ter ALGUM sinal de destaque.
   Sabotagem que isto reprova: padrao com cor igual a do texto e peso igual ao do titulo — o
   trecho escolhido sairia igual ao resto e o algoritmo de destaque viraria calculo jogado
   fora, com a suite verde. */
ok('13q3. o card padrao NUNCA fica sem sinal de destaque',
  (() => {
    const c = cardOf({ identificador: 'DOOTU' });
    return c.destaqueCor !== TOKENS.texto || c.destaquePeso > c.tituloPeso
      || c.destaqueSublinhado;
  })());
/* O exemplo do Remotion Studio e um card VALIDO (senao o Studio abre sem card, que foi
   exatamente o ponto cego que o `title` do defaultProps existe para resolver) e nao traz
   asset de marca nenhum — a entrega inteira e sobre o repositorio parar de hospedar marca. */
ok('13q4. o card de exemplo do Studio e valido e nao carrega asset embutido',
  cardOf(CARD_EXEMPLO) !== null && CARD_EXEMPLO.logo === ''
  && /\S/.test(CARD_EXEMPLO.identificador));

/* --- o ALGORITMO de destaque e um so, e NAO e funcao do card. O pedido proibe duplica-lo,
   e dois cards destacando trechos diferentes da MESMA manchete seria o sintoma. */
const TITULOS_13 = [
  'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.',
  'Faturei R$ 1,2 milhao em 2019? Nao — foi em 2021.',
  'Comece hoje.',
  'Eu quebrei duas vezes antes de entender que disciplina vale mais que motivacao no '
    + 'primeiro ano de empresa.',
  'Cortei 40% do custo mensal',
];
ok('13r. o destaque nao e funcao do card (as funcoes compartilhadas nao recebem card nenhum)',
  TITULOS_13.every((t) => {
    const a = resolveTitleHighlight(t, { highlightText: '', autoHighlight: true });
    const b = resolveTitleHighlight(t, { highlightText: '', autoHighlight: true });
    return JSON.stringify(a) === JSON.stringify(b);
  })
  && resolveTitleHighlight.length <= 2 && splitTitleHighlight.length <= 2);
ok('13r2. highlightText manual vence e autoHighlight:false continua desligando',
  resolveTitleHighlight(TITULOS_13[0], { highlightText: 'pequena cidade', autoHighlight: true })
    .origem === 'manual'
  && resolveTitleHighlight(TITULOS_13[0], { highlightText: '', autoHighlight: false })
    .span === null);

/* --- RESPONSIVIDADE: a escada de corpo e compartilhada, entao o contrato e o mesmo para
   QUALQUER card — nunca passa de 3 linhas e nunca sai do corpo declarado. */
ok('13s. curto, longo e acentuado cabem em 3 linhas com qualquer peso de card',
  CARD_PESOS.every((peso) => {
    const card = cardOf({ identificador: 'DOOTU', tituloPeso: peso });
    return TITULOS_13.every((t) => {
      const span = resolveTitleHighlight(t, { highlightText: '', autoHighlight: true }).span;
      const m = tituloEscalonado(t, span);
      return m.linhas <= MAX_LINHAS_TITULO && TITULO_FONTES.includes(m.fonte)
        && card.tituloPeso === peso && m.texto.length > 0;
    });
  }));
ok('13s2. acento e virgula decimal chegam intactos ao card',
  tituloEscalonado(TITULOS_13[1], null).texto.includes('R$ 1,2 milhao')
  && tituloEscalonado(TITULOS_13[1], null).texto.includes('Nao'));

/* --- a GEOMETRIA e compartilhada, e isto e o que torna isso seguro. Com a identidade virando
   DADO DO OPERADOR, este contrato ficou MAIS importante, nao menos: o `larguraTitulo()` le
   `TOKENS`, ou seja UM valor para a biblioteca inteira, e e por isso que o titulo pode ser
   medido sem saber qual card vai vestir. Se um card ganhar padding, largura ou filete
   proprio, a estimativa de linhas passa a mentir PARA MAIS para ele — o estouro horizontal
   classico, que so aparece no frame. */
ok('13t. o card resolvido nao traz geometria propria (senao o larguraTitulo mente)',
  TITULO_GEOMETRIA_COMPARTILHADA.every((chave) => !(chave in resolvido))
  && TITULO_GEOMETRIA_COMPARTILHADA.every((chave) =>
    !(chave in cardOf({ identificador: 'D' })))
  /* E nem um card ADULTERADO consegue injetar geometria: o validador monta o objeto de
     saida campo a campo, entao chave desconhecida nao atravessa. */
  && TITULO_GEOMETRIA_COMPARTILHADA.every((chave) =>
    !(chave in cardOf({ identificador: 'D', [chave]: 9999 }))));
ok('13t2. e a geometria compartilhada existe TODA em TOKENS (lista sem chave morta)',
  TITULO_GEOMETRIA_COMPARTILHADA.every((chave) => chave in TOKENS));
ok('13t3. a largura de texto sai SO de TOKENS (uma caixa para a biblioteca inteira)',
  larguraTitulo() > 0
  && larguraTitulo() === TOKENS.cardLargura - 2 * TOKENS.cardBordaPeso
    - 2 * TOKENS.cardPadding - TOKENS.tituloFilete
  && larguraTitulo.length === 0);
/* O sublinhado do destaque em `em`, e derivado do filete: px fixo nao desce com o corpo, e
   a 32px ele encostava nos acentos da linha de baixo (medido, 0,7px de folga). */
ok('13u. o sublinhado sai do filete e do degrau de referencia (em, nunca px)',
  TITULO_FILETE_REF === TITULO_FONTES[0]
  && TOKENS.tituloFilete / TITULO_FILETE_REF < 0.1);
ok('13u2. a espessura do sublinhado e DERIVADA no JSX, nunca um px escrito a mao',
  /textDecorationThickness:\s*\n?\s*\(TOKENS\.tituloFilete \/ TITULO_FILETE_REF\)/.test(clipJsx)
  && !/textDecorationThickness:\s*"?\d+px/.test(clipJsx));
ok('13u3. e o deslocamento do sublinhado tambem e relativo ao corpo',
  /textUnderlineOffset: "[0-9.]+em"/.test(clipJsx));

/* --- FIACAO no Clip.jsx. Aqui as assercoes sao de texto, e por isso os checks acima CHAMAM
   as funcoes: a licao de 2026-08-26 ("`in arquivo` so prova que alguem escreveu a palavra")
   reincidiu em 2026-08-27 e criou o `ancoraLegenda`. O que estas linhas provam e so que o
   valor CHEGA — o comportamento e provado por execucao. */
/* O check le os props DENTRO do destructuring do Clip, e nao a linha inteira copiada: com a
   linha literal, qualquer prop novo vizinho reprovava um check que nada tem a ver com ele. */
ok('13v. o Clip.jsx recebe titleCardStyle E card como props (sem os dois nada chega)',
  /export const Clip = \(\{[\s\S]{0,400}?\btitleCardStyle\b/.test(clipJsx)
  && /export const Clip = \(\{[\s\S]{0,400}?[,{]\s*card,/.test(clipJsx));
/* Sabotagem que isto reprova: um card escrito a mao na tag — o seletor mudaria de posicao na
   tela e o video sairia sempre com o MESMO card, calado, que e exatamente o defeito que esta
   entrega conserta. */
ok('13w2. nenhum card escrito a mao na tag (nem literal, nem objeto inline)',
  !/card=\{\s*\{/.test(clipJsx)
  && !/card=\{CARD_EXEMPLO\}/.test(clipJsx));
/* O defaultProps existe para o Remotion Studio abrir MOSTRANDO um card — e tem de abrir no
   PADRAO do preset, nao num literal que amanha diverge do resto do projeto. */
ok('13x. o defaultProps traz o padrao do preset e o card de exemplo (nao literais)',
  /titleCardStyle: TITLE_CARD_PADRAO,/.test(clipJsx)
  && /card: CARD_EXEMPLO,/.test(clipJsx));
/* O `Img` do Remotion (nao `<img>`) segura a captura ate a imagem carregar; sem isso os
   primeiros quadros saem SEM a placa e isso so aparece olhando o frame 0. E ele so e montado
   quando HA logo: um `src` vazio viraria pedido de rede e imagem quebrada no quadro. */
ok('13y. a placa sai do CARD, pelo Img, e so quando ha logo',
  /\{card\.logo\s*\n?\s*\?/.test(clipJsx)
  && /<Img\s+src=\{card\.logo\}/.test(clipJsx)
  && /width: TOKENS\.logoAltura \* card\.logoProporcao/.test(clipJsx)
  && !/<img\s/.test(jsxSemComentario));
ok('13y2. e todo valor de identidade sai do card resolvido, nunca de TOKENS/hex',
  /backgroundColor: card\.fileteCor/.test(clipJsx)
  && /card\.bordaCor/.test(clipJsx)
  && /fontWeight: card\.tituloPeso/.test(clipJsx)
  && /color: card\.destaqueCor/.test(clipJsx)
  && /fontWeight: card\.destaquePeso/.test(clipJsx)
  && /card\.destaqueSublinhado/.test(clipJsx));
/* O card antigo lia a placa de um registro de marcas embutido no repositorio. Nenhum nome
   daquele registro pode sobrar em CODIGO (em comentario pode — e onde a historia esta
   escrita, e por isso o `jsxSemComentario`). */
ok('13z. nenhum vestigio do registro de marcas sobrou no CODIGO do Clip.jsx',
  !/\bMARCAS\b/.test(jsxSemComentario)
  && !/\bMARCA_BADGE\b/.test(jsxSemComentario)
  && !/\bMARCA_NOME\b/.test(jsxSemComentario)
  && !/\bMARCA_PROPORCAO\b/.test(jsxSemComentario)
  && !/TOKENS\.marcaLaranja/.test(jsxSemComentario)
  && !/TOKENS\.tituloDestaqueCor/.test(jsxSemComentario)
  && !/marca\.js/.test(jsxSemComentario));
/* E nenhum asset voltou embutido: a composicao nao pode hospedar dataURL de imagem nenhum —
   a placa vem do card do operador, que atravessa o POST. */
ok('13z1. nenhum asset de imagem embutido sobrou na composicao',
  !/data:image\//.test(jsxSemComentario));
/* O identificador some quando a placa ja traz o wordmark — e o teste e sobre o CAMPO ter
   conteudo, nao um `if` de identidade: trocar de card nao pode acender texto que a placa
   dele contem. */
ok('13z2. o identificador de texto e condicionado ao CAMPO, nao a um if de identidade',
  /\{card\.identificador\s*\n?\s*\?/.test(clipJsx)
  && !/card\.id === ["']/.test(jsxSemComentario)
  && !/card\.nome === ["']/.test(jsxSemComentario));


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
  && /<Palco src=\{src\} reframe=\{reframe\} altura=\{videoAltura\}( zooms=\{zooms\})? \/>/.test(clipJsx));
ok('14q. e os dois props existem no destructuring do Clip (senao chegam undefined)',
  /export const Clip = \(\{[\s\S]{0,400}?\breframe\b/.test(clipJsx)
  && /export const Clip = \(\{[\s\S]{0,400}?\bvideoAltura\b/.test(clipJsx));

/* ------------------------------------------------- 15. estilos de LEGENDA */
/* A legenda tinha UMA aparencia cravada nos TOKENS e lida pelo Clip.jsx. Agora ela e um
   registro, como o card do titulo — e estes checks sao os que cobram que o estilo de HOJE
   continue identico e que o estilo novo caiba na coluna. */
eq('15a. seis estilos declarados, nesta ordem (os dois de sempre primeiro)', LEGENDA_STYLES,
  ['classico', 'impacto', 'faixa', 'podcast', 'papel', 'discreta']);
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
ok('15d. impacto e caixa alta, Montserrat ExtraBold com peso 800',
  IMPACTO.caixaAlta === true && IMPACTO.familia === 'montserrat' && IMPACTO.peso === 800);
/* Corpo e destaque usam o peso que o renderer efetivamente carrega. */
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
ok('15e3. Montserrat800 usa o avanco uppercase medido, sem herdar o titulo',
  AVANCO_MONTSERRAT_CAIXA_ALTA === 0.731
  && AVANCO_MONTSERRAT_CAIXA_ALTA > AVANCO_INTER_CAIXA_ALTA
  && AVANCO_MONTSERRAT_CAIXA_ALTA !== AVANCO_MONTSERRAT);
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
ok('15i2. Montserrat carrega exatamente o 800 que corpo e destaque pedem',
  /carregarMontserrat\("normal", \{\s*weights: \["800"\]/.test(clipJsx));
ok('15i3. o Clip resolve a aparencia UMA vez e corta as paginas com o teto DELA',
  /const aparencia = resolveLegenda\(legendaStyle, edit, legendaColuna\);/.test(clipJsx)
  && /toCaptionPages\(cues, tetoDaPagina\(aparencia\)\)/.test(clipJsx));
ok('15i4. e a Legenda recebe a aparencia (sem isso ela lê `undefined` e o render cai)',
  /aparencia=\{aparencia\}/.test(clipJsx)
  && /const Legenda = \(\{ pagina, cor, base, esquerda, de, aparencia \}\)/.test(clipJsx));
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

/* BP-014: o estado persistido é exercitado presente, ausente e malformado. */
const automatico = { v: 1, legenda: {}, enquadramento: {} };
eq('16a. edit ausente ou de versao desconhecida continua automatico',
  [undefined, {}, { edit: null }, { edit: { v: 2 } }, { edit: [] }].map(editOf),
  Array(5).fill(automatico));
const editCompleto = { v: 1, legenda: {
  style: 'impacto', familia: 'inter', tamanho: 84, caixaAlta: false,
  cor: 'destaqueGanho', destaqueCor: 'destaquePerda', largura: 600,
  alinhamento: 'left', posicaoPct: 72,
}, enquadramento: { reframe: 'crop45' } };
eq('16b. todos os overrides validos sobrevivem sem mutar a origem',
  editOf({ edit: structuredClone(editCompleto) }), editCompleto);
eq('16c. arrays, tipos errados, cor torta e valores fora dos conjuntos caem no automatico',
  editOf({ edit: { v: 1, legenda: { tamanho: '80', caixaAlta: 1, cor: '#ff00f', destaqueCor: 'red',
    contorno: 7, fundo: 'Nenhum',
    familia: 'Montserrat', alinhamento: 'justify', largura: NaN }, enquadramento: [] } }), automatico);
eq('16d. limites numericos sao clampados, inclusive zero de posicao',
  editOf({ edit: { v: 1, legenda: { tamanho: 1000, largura: 1, posicaoPct: -5 } } }).legenda,
  { tamanho: 96, largura: 360, posicaoPct: 0 });
ok('16e. sem overrides o classico devolve o MESMO objeto e o mesmo teto anterior',
  resolveLegenda(undefined) === CLASSICO
  && resolveLegenda('classico', { v: 2 }) === CLASSICO
  && tetoDaPagina(resolveLegenda(undefined)) === MAX_CHARS_PAGINA);
const manualResolvido = resolveLegenda('classico', editCompleto);
eq('16f. resolver aplica estilo, tipografia, cores e geometria manualResolvido',
  [manualResolvido.familia, manualResolvido.fonte, manualResolvido.caixaAlta, manualResolvido.cor, manualResolvido.palavraCor,
    manualResolvido.destaqueCor, manualResolvido.largura, manualResolvido.alinhamento],
  ['inter', 84, false, TOKENS.destaqueGanho, TOKENS.destaquePerda,
    TOKENS.destaquePerda, 600, 'left']);
ok('16g. intencao vertical nao vira formula ou ancora JavaScript',
  !('legendaBase' in manualResolvido) && !('posicaoPct' in manualResolvido) && !('base' in manualResolvido));
const montserratBaixa = resolveLegenda('classico', { v: 1, legenda: { familia: 'montserrat' } });
eq('16h. trocar so a familia nao sintetiza os pesos700/900 do classico na Montserrat',
  [montserratBaixa.peso, montserratBaixa.pesoDestaque, montserratBaixa.avanco],
  [800, 800, AVANCO_MONTSERRAT_LEGENDA]);
const montserratAlta = resolveLegenda('impacto', { v: 1, legenda: { caixaAlta: true } });
ok('16i. caixa baixa e alta usam suas metricas medidas e alteram a capacidade da pagina',
  AVANCO_MONTSERRAT_LEGENDA === 0.610
  && montserratAlta.avanco === AVANCO_MONTSERRAT_CAIXA_ALTA
  && tetoDaPagina(resolveLegenda('impacto', { v: 1, legenda: { caixaAlta: false } }))
    > tetoDaPagina(montserratAlta));
const estreita = resolveLegenda('classico', { v: 1, legenda: { largura: 360 } });
ok('16j. diminuir a coluna muda a paginacao real pelo mesmo dono',
  tetoDaPagina(estreita) < tetoDaPagina(CLASSICO)
  && toCaptionPages(longa, tetoDaPagina(estreita)).length > toCaptionPages(longa).length);
eq('16k. limites de pagina usam a largura manualResolvido e guardam largura invalida',
  [charsPorLinhaLegenda(58, 0.55, 360), charsPorLinhaLegenda(58, 0.55, NaN)], [11, 25]);
ok('16l. cada familia manualResolvido tem arquivo carregado e so cores/alinhamentos fechados entram',
  LEGENDA_FONTES.every((f) => LEGENDA_FAMILIAS.includes(f))
  && LEGENDA_CORES.every((c) => /^#[0-9A-Fa-f]{6}$/.test(TOKENS[c]))
  && LEGENDA_ALINHAMENTOS.join(',') === 'left,center,right');
/* O `reframe` NAO e re-resolvido aqui: o prop ja chega resolvido pelo `reframeOf` do site e
   revalidado pelo `reframe_profile` do servidor. Uma terceira resolucao dentro da composicao
   seria o quarto dono do mesmo conjunto, e o 14p cobra a linha literal do Palco. */
ok('16m. composicao consome edit e a largura/alinhamento resolvidos, sem re-resolver reframe',
  /videoAltura, edit,/.test(clipJsx)
  && /width: aparencia\.largura \|\| TOKENS\.legendaLargura/.test(clipJsx)
  && /textAlign: aparencia\.alinhamento \|\| "center"/.test(clipJsx)
  && !/editOf/.test(clipJsx));

/* ------------------------------------------------- 17. estilos prontos, contorno e caixa
   (2026-09-23). O que se cobra: o operador escolhe a cor que quiser, e ela chega NA
   PALAVRA SENDO DITA (era o defeito: o karaokê lia o leque e ignorava a escolha); contorno e
   caixa existem, desligam com `nenhum`, e todo estilo pronto se LÊ sobre o que ele pinta. */
eq('17a. hex e token antigo valem, hex sai em maiusculas, nenhum so onde e permitido',
  [corLegendaOf('#ffd23f'), corLegendaOf('destaque'), corLegendaOf('nenhum'),
    corLegendaOf('nenhum', true), corLegendaOf('#FFF'), corLegendaOf(12)],
  ['#FFD23F', 'destaque', undefined, 'nenhum', undefined, undefined]);
eq('17a2. contorno e caixa sobrevivem ao validador, com o `nenhum` inclusive',
  editOf({ edit: { v: 1, legenda: { cor: '#abcdef', contorno: 'nenhum', fundo: '#0e0e10' } } }).legenda,
  { cor: '#ABCDEF', contorno: 'nenhum', fundo: '#0E0E10' });
const comDestaque = resolveLegenda('classico', { v: 1, legenda: { destaqueCor: '#4CC9F0' } });
eq('17b. a cor de destaque escolhida vale para a PALAVRA SENDO DITA (o leque cede)',
  [comDestaque.palavraCores, corDaPalavra(comDestaque, 3)], [['#4CC9F0'], '#4CC9F0']);
eq('17b2. e o nome de token antigo (corte salvo) resolve para o hex dele',
  resolveLegenda('classico', { v: 1, legenda: { destaqueCor: 'destaque' } }).palavraCores,
  [TOKENS.destaque]);
eq('17b3. sem destaque escolhido, o classico continua no leque de sempre',
  resolveLegenda('classico', { v: 1, legenda: { tamanho: 60 } }).palavraCores, TOKENS.palavraCores);
const FAIXA = legendaPreset('faixa');
const semCaixa = resolveLegenda('faixa', { v: 1, legenda: { fundo: 'nenhum' } });
ok('17c. `nenhum` desliga a caixa do estilo e devolve a sombra de leitura',
  FAIXA.fundo && FAIXA.sombra === 'none' && semCaixa.fundo === null
  && semCaixa.sombra === TOKENS.sombraTexto && caixaLegenda(semCaixa) === null);
const comCaixa = resolveLegenda('classico', { v: 1, legenda: { fundo: '#FFFFFF' } });
ok('17c2. caixa posta a mao apaga a sombra (sombra sobre caixa e borrao)',
  comCaixa.fundo === '#FFFFFF' && comCaixa.sombra === 'none');
eq('17c3. a caixa leva a opacidade do token e repete o respiro em cada linha',
  [caixaLegenda(FAIXA).backgroundColor, caixaLegenda(FAIXA).boxDecorationBreak, caixaLegenda(CLASSICO)],
  ['#0E0E10E0', 'clone', null]);
eq('17d. o traco do contorno e o dobro do visivel e acompanha o corpo',
  [contornoPx({ fonte: 66 }), contornoPx({ fonte: 96 }), contornoPx({ fonte: 'x' })], [8, 12, 2]);
ok('17d2. so o `podcast` nasce com contorno, e os de sempre nascem sem contorno e sem caixa',
  LEGENDA_STYLES.filter((e) => LEGENDA_PRESETS[e].contorno).join() === 'podcast'
  && !CLASSICO.contorno && !CLASSICO.fundo && !IMPACTO.contorno && !IMPACTO.fundo);
/* Contraste WCAG entre o texto e a caixa que fica atrás dele. */
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
for (const estilo of LEGENDA_STYLES.filter((e) => LEGENDA_PRESETS[e].fundo)) {
  const p = LEGENDA_PRESETS[estilo];
  ok(`17e. [${estilo}] texto e destaque se leem sobre a caixa (>= 4.5:1)`,
    contraste(p.cor, p.fundo) >= 4.5 && contraste(p.destaqueCor, p.fundo) >= 4.5);
}
ok('17e2. todo estilo novo tem UMA cor de destaque, e ela e a da palavra sendo dita',
  ['faixa', 'podcast', 'papel', 'discreta'].every((e) => {
    const p = LEGENDA_PRESETS[e];
    return p.palavraCores.length === 1 && p.palavraCores[0] === p.destaqueCor
      && LEGENDA_FAMILIAS.includes(p.familia) && (p.familia !== 'montserrat' || p.peso === 800);
  }));
ok('17f. o Clip.jsx veste contorno e caixa pelas funcoes do preset (nao por fiacao a mao)',
  /WebkitTextStroke: contornoPx\(aparencia\)/.test(clipJsx)
  && /paintOrder: "stroke fill"/.test(clipJsx)
  && /<CaixaLegenda estilo=\{caixaLegenda\(aparencia\)\}>/.test(clipJsx));
eq('17g. o `nenhum` do preset e o mesmo valor que o validador aceita', LEGENDA_SEM, 'nenhum');

/* 18. PROFUNDIDADE e posicao LATERAL (2026-09-25). Funcoes puras, chamadas com valores
   construidos: Nenhuma nao acrescenta NADA, Suave/Funda nao recebem tempo e giram pela
   BASE, e a borda esquerda ausente e a formula centralizada de sempre. */
{
  const P = await import('./src/preset.js');
  const classico = P.resolveLegenda('classico', undefined);
  eq('18a. sem Profundidade o estilo do bloco nao ganha nada (mesma arvore, mesmas propriedades)',
    [P.profundidadeLegenda(classico), P.profundidadeLegenda(undefined),
      P.profundidadeLegenda({ ...classico, profundidade: 'nenhuma' }),
      P.profundidadeLegenda({ ...classico, profundidade: '3d' })], [{}, {}, {}, {}]);
  ok('18a2. e o `resolveLegenda` sem ajuste continua devolvendo o preset puro (sem chave nova)',
    !('profundidade' in classico) && !('profundidade' in P.resolveLegenda('impacto', { v: 1, legenda: {} })));
  ok('18b. a funcao nao tem entrada de tempo: um argumento so (a aparencia)',
    P.profundidadeLegenda.length === 1);
  for (const nome of ['suave', 'funda']) {
    const t = P.LEGENDA_PROFUNDIDADES[nome];
    const ap = P.resolveLegenda('classico', { v: 1, legenda: { profundidade: nome } });
    const bloco = P.profundidadeLegenda(ap);
    const camadas = bloco.textShadow.split(/,\s*(?![^()]*\))/);
    ok(`18c. [${nome}] inclina pela BASE: perspective/rotateX com origem 50% 100%`,
      bloco.transform === `perspective(${t.perspectiva}px) rotateX(${t.inclinacao}deg)`
      && bloco.transformOrigin === '50% 100%');
    ok(`18d. [${nome}] volume = ${t.camadas} sombras DURAS (sem desfoque) e a de leitura por ultimo`,
      camadas.length === t.camadas + TOKENS.sombraTexto.split(/,\s*(?![^()]*\))/).length
      && camadas.slice(0, t.camadas).every((c, i) => c.startsWith('0 ' + Math.round((i + 1) * t.passo * 100) / 100 + 'px 0 color-mix('))
      && bloco.textShadow.endsWith(TOKENS.sombraTexto));
    // Projecao: um ponto a h px acima da base vai a h*cos(t)*d/(d + h*sin(t)) -- nunca acima
    // de h. Com a base no lugar (origem na base), o texto projetado nunca sobe alem do
    // bloco reto: se o reto cabe no quadro, o inclinado tambem.
    const th = t.inclinacao * Math.PI / 180;
    const alturas = [60, 150, 250];
    ok(`18e. [${nome}] a projecao fica DENTRO do bloco reto (a base nao sai da ancora)`,
      alturas.every(h => { const y = h * Math.cos(th) * t.perspectiva / (t.perspectiva + h * Math.sin(th)); return y > 0 && y <= h; }));
    const comCaixa = P.profundidadeLegenda(P.resolveLegenda('faixa', { v: 1, legenda: { profundidade: nome } }));
    ok(`18f. [${nome}] com caixa de fundo: so a inclinacao, sem volume`,
      comCaixa.transform === bloco.transform && !('textShadow' in comCaixa));
  }
  const semLeitura = P.profundidadeLegenda(P.resolveLegenda('podcast', { v: 1, legenda: { profundidade: 'suave' } }));
  const podcast = P.resolveLegenda('podcast', { v: 1, legenda: { profundidade: 'suave' } });
  ok('18g. em outro estilo (Contorno) a sombra de leitura DELE vem depois das camadas, na cor do texto',
    semLeitura.textShadow === Array.from({ length: P.LEGENDA_PROFUNDIDADES.suave.camadas }, (_, i) =>
      '0 ' + Math.round((i + 1) * P.LEGENDA_PROFUNDIDADES.suave.passo * 100) / 100 + 'px 0 '
      + 'color-mix(in srgb, #FFFFFF 35%, #000)').join(', ') + ', ' + podcast.sombra);
  eq('18h. borda esquerda: ausente/ilegivel = centralizada de sempre; zero e valor',
    [P.esquerdaLegenda(undefined, 820), P.esquerdaLegenda(null, 600), P.esquerdaLegenda('x', 820),
      P.esquerdaLegenda(0, 820), P.esquerdaLegenda(76, 820), P.esquerdaLegenda(undefined, undefined)],
    [130, 240, 130, 0, 76, 130]);
  eq('18i. o validador guarda Profundidade e posicao lateral (grampo e arredonda) e recusa o resto',
    [P.editOf({ edit: { v: 1, legenda: { profundidade: 'funda', posicaoXPct: 44.6 } } }).legenda,
      P.editOf({ edit: { v: 1, legenda: { profundidade: 'x', posicaoXPct: 250 } } }).legenda],
    [{ profundidade: 'funda', posicaoXPct: 45 }, { posicaoXPct: 100 }]);
  ok('18j. o Clip.jsx so ESPALHA o estilo da Profundidade e pega a borda pela guarda',
    /\.\.\.profundidadeLegenda\(aparencia\)/.test(clipJsx)
    && /esquerda=\{esquerdaLegenda\(legendaEsquerda, aparencia\.largura\)\}/.test(clipJsx)
    && /left: esquerda,/.test(clipJsx));
  /* A coluna EFETIVA do servidor (2026-09-28): guarda pura, e o resolveLegenda a aplica UMA
     vez — a mesma largura desenha e pagina. Sem a prop, a aparência é a de sempre. */
  eq('18k. guarda da coluna: ausente/ilegivel/fora do quadro = a de sempre; numero valido vence',
    [P.colunaLegenda(undefined, 820), P.colunaLegenda(null, 600), P.colunaLegenda('x', 820),
      P.colunaLegenda(0, 820), P.colunaLegenda(5000, 820), P.colunaLegenda(352, 820),
      P.colunaLegenda('400', undefined)],
    [820, 600, 820, 820, 820, 352, 400]);
  const semCol = P.resolveLegenda('impacto', { v: 1, legenda: { posicaoXPct: 8 } });
  const comCol = P.resolveLegenda('impacto', { v: 1, legenda: { posicaoXPct: 8 } }, 352);
  ok('18l. com a coluna efetiva, a aparencia desenha E pagina com ela (teto menor)',
    comCol.largura === 352 && P.tetoDaPagina(comCol) < P.tetoDaPagina(semCol)
    && P.tetoDaPagina(comCol) === P.charsPorLinhaLegenda(72, comCol.avanco, 352) * 2
    && JSON.stringify(P.resolveLegenda('impacto', {})) === JSON.stringify(P.resolveLegenda('impacto', {}, undefined)));
}

/* 19. ÂNGULO da Profundidade (2026-09-29): oito direções nomeadas. A tabela ESPERADA abaixo é
   escrita aqui, à mão, a partir do contrato (lado que se afasta → pivô = lado mais perto da
   câmera, sinais dos giros, lado do volume) — não é lida do preset. E a prova de que nada sai do
   bloco reto é uma projeção 3D PRÓPRIA dos quatro cantos, independente da conta do preset. */
{
  const P = await import('./src/preset.js');
  //                  pivô            rotateY rotateX volume(x, y)
  const ESPERADO = {
    tras: ['50% 100%', 0, 1, 0, 1], frente: ['50% 0%', 0, -1, 0, -1],
    direita: ['0% 100%', 1, 0, -1, 0], esquerda: ['100% 100%', -1, 0, 1, 0],
    'tras-direita': ['0% 100%', 1, 1, -1, 1], 'tras-esquerda': ['100% 100%', -1, 1, 1, 1],
    'frente-direita': ['0% 0%', 1, -1, -1, -1], 'frente-esquerda': ['100% 0%', -1, -1, 1, -1],
  };
  const DIRECOES = Object.keys(ESPERADO);
  const sinal = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const giros = (t) => ({
    y: sinal(parseFloat((t.match(/rotateY\(([^)]+)\)/) || [0, 0])[1])),
    x: sinal(parseFloat((t.match(/rotateX\(([^)]+)\)/) || [0, 0])[1])),
  });
  eq('19a. o conjunto de direcoes e exatamente o do contrato (oito, com tras)',
    Object.keys(P.LEGENDA_PROFUNDIDADE_DIRECOES).sort(), [...DIRECOES].sort());
  ok('19b. direcao ausente, torta ou `tras` = o bloco de 2026-09-25, nos seis estilos e nas duas intensidades',
    LEGENDA_STYLES.every((estilo) => ['suave', 'funda'].every((nome) => {
      const base = P.profundidadeLegenda(P.resolveLegenda(estilo, { v: 1, legenda: { profundidade: nome } }));
      return ['tras', 'x', undefined].every((d) => JSON.stringify(P.profundidadeLegenda(
        P.resolveLegenda(estilo, { v: 1, legenda: { profundidade: nome, profundidadeDirecao: d } }))) === JSON.stringify(base));
    })));
  ok('19c. cada direcao gira pelo pivo do contrato e com os sinais do contrato',
    DIRECOES.every((d) => ['suave', 'funda'].every((nome) => {
      const b = P.profundidadeLegenda({ profundidade: nome, profundidadeDirecao: d, fonte: 72, entrelinha: 1.2 });
      const g = giros(b.transform);
      return b.transformOrigin === ESPERADO[d][0] && g.y === ESPERADO[d][1] && g.x === ESPERADO[d][2];
    })));
  ok('19d. so perspective/rotateX/rotateY (+ translateX PRIMEIRO nas diagonais); eixo unico sem giro zero',
    DIRECOES.every((d) => ['suave', 'funda'].every((nome) => {
      const t = P.profundidadeLegenda({ profundidade: nome, profundidadeDirecao: d, fonte: 72, entrelinha: 1.2 }).transform;
      const fns = [...t.matchAll(/(\w+)\(/g)].map((m) => m[1]);
      const diagonal = ESPERADO[d][1] !== 0 && ESPERADO[d][2] !== 0;
      return fns.every((f) => ['perspective', 'rotateX', 'rotateY', 'translateX'].includes(f))
        && (diagonal ? fns[0] === 'translateX' && fns.length === 4 : fns.length === 2 && !fns.includes('translateX'));
    })));
  ok('19e. com caixa de fundo, em toda direcao: so o transform, sem volume',
    DIRECOES.every((d) => {
      const ap = P.resolveLegenda('faixa', { v: 1, legenda: { profundidade: 'funda', profundidadeDirecao: d } });
      const b = P.profundidadeLegenda(ap);
      return !('textShadow' in b) && b.transform === P.profundidadeLegenda({ ...ap, fundo: null }).transform;
    }));
  ok('19f. o volume sai para o lado MAIS PERTO da camera (sinais do contrato)',
    DIRECOES.every((d) => {
      const s = P.profundidadeLegenda({ profundidade: 'funda', profundidadeDirecao: d, fonte: 72, entrelinha: 1.2 })
        .textShadow.split(/,\s*(?![^()]*\))/)[0].split(' ');
      return sinal(parseFloat(s[0])) === ESPERADO[d][3] && sinal(parseFloat(s[1])) === ESPERADO[d][4]
        && [s[0], s[1]].every((t) => t !== '-0' && t !== '-0px');
    }));

  /* Projeção 3D própria: matriz 4x4 da lista do transform (esquerda → direita), relativa ao
     pivô, com a divisão por w no fim. Convenção CSS: y para baixo, z para quem olha. */
  const RAD = Math.PI / 180;
  const mul = (a, b) => a.map((l) => [0, 1, 2, 3].map((j) => l.reduce((s, v, k) => s + v * b[k][j], 0)));
  const ident = () => [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const matriz = (nome, v) => {
    const m = ident(), c = Math.cos(v * RAD), s = Math.sin(v * RAD);
    if (nome === 'perspective') m[3][2] = -1 / v;
    else if (nome === 'translateX') m[0][3] = v;
    else if (nome === 'rotateX') { m[1][1] = c; m[1][2] = -s; m[2][1] = s; m[2][2] = c; }
    else if (nome === 'rotateY') { m[0][0] = c; m[0][2] = s; m[2][0] = -s; m[2][2] = c; }
    else throw new Error('funcao inesperada no transform: ' + nome);
    return m;
  };
  const cantos = (bloco, w, h) => {
    const m = [...bloco.transform.matchAll(/(\w+)\(([^)]+)\)/g)]
      .reduce((acc, [, nome, arg]) => mul(acc, matriz(nome, parseFloat(arg))), ident());
    const [ox, oy] = bloco.transformOrigin.split(' ').map((t, i) => parseFloat(t) / 100 * (i ? h : w));
    return [[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => {
      const q = m.map((l) => l[0] * (x - ox) + l[1] * (y - oy) + l[3]);
      return { x: q[0] / q[3] + ox, y: q[1] / q[3] + oy, escala: 1 / q[3] };
    });
  };
  let pior = Infinity, falha = null, baseFora = null, legivel = Infinity;
  for (const d of DIRECOES) for (const nome of ['suave', 'funda'])
    for (const coluna of [240, 360, 820, 1000]) for (const linhas of [1, MAX_LINHAS])
      for (const fonte of [32, 96]) for (const entrelinha of [1.1, 1.3]) {
        const b = P.profundidadeLegenda({ profundidade: nome, profundidadeDirecao: d, fonte, entrelinha });
        const h = linhas * fonte * entrelinha;
        const c = cantos(b, coluna, h);
        const margem = Math.min(...c.flatMap((p) => [p.x, coluna - p.x, p.y, h - p.y]));
        if (margem < pior) pior = margem;
        if (margem < -0.5 && !falha) falha = [d, nome, coluna, linhas, fonte, entrelinha, margem];
        if (ESPERADO[d][0].endsWith(' 100%') && Math.max(Math.abs(c[2].y - h), Math.abs(c[3].y - h)) > 0.5)
          baseFora = baseFora || [d, nome, coluna, linhas, fonte, entrelinha];
        if (coluna === 1000 && linhas === MAX_LINHAS && fonte === 96 && entrelinha === 1.3)
          legivel = Math.min(legivel, ...c.map((p) => p.escala));
      }
  console.log(`  19g: pior margem dos cantos = ${pior.toFixed(3)} px · menor escala de perspectiva = ${legivel.toFixed(3)}`);
  ok('19g. 8 direcoes x 2 intensidades x coluna x pagina x corpo x entrelinha: todo canto DENTRO do bloco reto (+-0,5 px)'
    + (falha ? ' -- saiu: ' + JSON.stringify(falha) : ''), falha === null);
  ok('19h. pivo na base (tras, laterais, tras-*): os cantos de baixo ficam na ancora'
    + (baseFora ? ' -- saiu: ' + JSON.stringify(baseFora) : ''), baseFora === null);
  ok('19i. legivel: na coluna de 1000 e na pagina mais alta, o canto mais longe fica em >= 70% do tamanho',
    legivel >= 0.70);
  eq('19j. o validador guarda direcao valida, descarta a torta e nunca cria a chave',
    [P.editOf({ edit: { v: 1, legenda: { profundidade: 'funda', profundidadeDirecao: 'tras-direita' } } }).legenda,
      P.editOf({ edit: { v: 1, legenda: { profundidade: 'funda', profundidadeDirecao: 'cima' } } }).legenda,
      P.editOf({ edit: { v: 1, legenda: { profundidade: 'funda' } } }).legenda],
    [{ profundidade: 'funda', profundidadeDirecao: 'tras-direita' }, { profundidade: 'funda' }, { profundidade: 'funda' }]);
  ok('19k. o resolveLegenda so CARREGA a chave (ausente = nenhuma chave nova)',
    P.resolveLegenda('impacto', { v: 1, legenda: { profundidade: 'suave', profundidadeDirecao: 'direita' } })
      .profundidadeDirecao === 'direita'
    && !('profundidadeDirecao' in P.resolveLegenda('impacto', { v: 1, legenda: { profundidade: 'suave' } })));
}

/* 20. CAPA DO TIKTOK (2026-09-30): o dono dos números (validador, escada de corpo, bloco) e a
   composição, chamados com valor construído. */
{
  const P = await import('./src/preset.js');
  eq('20a. validador: ausente/torto/outra versao = null; padroes; quadro arredondado; torto some',
    [P.capaTikTokOf(undefined), P.capaTikTokOf({ v: 2 }), P.capaTikTokOf({ v: 1 }),
      P.capaTikTokOf({ v: 1, quadroMs: 1234.6, estilo: 'x', posicao: 'baixo', titulo: ' A ', destaque: '' }),
      P.capaTikTokOf({ v: 1, quadroMs: '9' })],
    [null, null, { v: 1, estilo: 'negocio', posicao: 'meio' },
      { v: 1, estilo: 'negocio', posicao: 'baixo', quadroMs: 1235, titulo: 'A' },
      { v: 1, estilo: 'negocio', posicao: 'meio' }]);
  ok('20b. escada: o maior corpo que cabe em 3 linhas; titulo curto no topo da escada',
    P.capaTitulo('Curto', 'negocio').fonte === P.CAPA_FONTES[0]
    && P.capaTitulo('Perdi 40 mil no primeiro ano', 'negocio').linhas <= P.CAPA_MAX_LINHAS
    && P.capaTitulo('Perdi 40 mil no primeiro ano', 'negocio').cabe === true);
  const longo = P.capaTitulo('Como sair de uma cidade pequena e chegar a cem mil pedidos por mes sem investidor', 'negocio');
  ok('20c. manchete que nem o menor corpo cabe: o menor, com `cabe: false` (a tela avisa)',
    longo.fonte === P.CAPA_FONTES[P.CAPA_FONTES.length - 1] && longo.cabe === false && longo.linhas > P.CAPA_MAX_LINHAS);
  ok('20d. a estimativa usa o avanco MEDIDO do estilo (Inter 700 e mais estreita que a Montserrat 800)',
    P.CAPA_ESTILO_DEF.limpo.avanco === P.AVANCO_INTER_CAIXA_ALTA
    && P.CAPA_ESTILO_DEF.negocio.avanco === P.AVANCO_MONTSERRAT_CAIXA_ALTA
    && P.capaLinhas('Perdi 40 mil no primeiro ano', 104, P.AVANCO_INTER_CAIXA_ALTA)
      <= P.capaLinhas('Perdi 40 mil no primeiro ano', 104, P.AVANCO_MONTSERRAT_CAIXA_ALTA));
  ok('20e. o texto fica no miolo seguro (y 440-1480) nas tres posicoes, com e sem a folga do degrade',
    P.capaBloco('alto').top === 440 && P.capaBloco('alto', 90).top === 350
    && P.TOKENS.altura - P.capaBloco('baixo').bottom === 1480
    && P.TOKENS.altura - P.capaBloco('baixo', 90).bottom === 1570
    && P.capaBloco('meio').top === 960 && P.capaBloco('qualquer').top === 960
    && P.CAPA_ZONAS.seguro.y === 420 && P.CAPA_ZONAS.seguro.y + P.CAPA_ZONAS.seguro.altura === 1500);
  ok('20f. a capa so usa faces JA carregadas pelo Clip.jsx, no peso carregado (nada sintetizado)',
    Object.values(P.CAPA_ESTILO_DEF).every((d) => (d.familia === 'montserrat' && d.peso === 800)
      || (d.familia === 'inter' && /weights: \["600", "700", "800", "900"\]/.test(clipJsx) && d.peso === 700)));
  const capaJsx = clipJsx.slice(clipJsx.indexOf('export const CapaTikTok'));
  ok('20g. a composicao da capa usa `Img` do Remotion e nenhum <Video>/<img> cru',
    capaJsx.length > 100 && /<Img src=\{imagem\}/.test(capaJsx) && !/<Video|<img /.test(capaJsx));
  const rootJsx = readFileSync(new URL('./src/Root.jsx', import.meta.url), 'utf8');
  ok('20h. a composicao CapaTikTok esta registrada, 1080x1920, um quadro so; a Clip continua la',
    /id="CapaTikTok"[\s\S]*component=\{CapaTikTok\}[\s\S]*durationInFrames=\{1\}/.test(rootJsx)
    && /id="Clip"/.test(rootJsx));
}

/* 21. MUSICA DE FUNDO (2026-09-30): validador e volume por quadro, chamados com valor
   construido; e a composicao com UMA faixa so. */
{
  const P = await import('./src/preset.js');
  const ID = '0123456789abcdef';
  eq('21a. musicaOf: id torto = sem musica; inicio torto = 0; nivel torto = baixo; so baixo/medio',
    [P.musicaOf(undefined), P.musicaOf({ id: 'abc' }), P.musicaOf({ id: ID }),
      P.musicaOf({ id: ID, inicioMs: 1500.6, nivel: 'medio' }), P.musicaOf({ id: ID, inicioMs: -1, nivel: 'alto' }),
      P.MUSICA_NIVEIS],
    [null, null, { id: ID, inicioMs: 0, nivel: 'baixo' }, { id: ID, inicioMs: 1501, nivel: 'medio' },
      { id: ID, inicioMs: 0, nivel: 'baixo' }, ['baixo', 'medio']]);
  ok('21a2. editOf so cria a chave `musica` com faixa valida (sem musica = edit de sempre)',
    !('musica' in P.editOf({ edit: { v: 1, legenda: {} } }))
    && !('musica' in P.editOf({ edit: { v: 1, musica: { id: 'x' } } }))
    && P.editOf({ edit: { v: 1, musica: { id: ID } } }).musica.id === ID);
  const m = { ganho: 0.1, inicioSec: 0, faixaSec: 60 };
  const fps = 30, total = 30 * fps;
  ok('21b. volume: fade-in de 1 s a partir do zero, depois o ganho do servidor',
    P.volumeMusica(0, m, fps, total) === 0
    && Math.abs(P.volumeMusica(15, m, fps, total) - 0.05) < 1e-9
    && P.volumeMusica(30, m, fps, total) === 0.1 && P.volumeMusica(400, m, fps, total) === 0.1);
  ok('21c. fade-out de 1,5 s TERMINANDO no fim da saida (ultimo quadro quase mudo; depois, zero)',
    P.volumeMusica(total - 45, m, fps, total) === 0.1
    && P.volumeMusica(total - 1, m, fps, total) < 0.003 && P.volumeMusica(total, m, fps, total) === 0);
  const curta = { ganho: 0.2, inicioSec: 5, faixaSec: 15 };
  ok('21d. faixa mais curta que o corte: termina com o PROPRIO fade no fim dela, sem repetir',
    P.volumeMusica(8 * fps, curta, fps, total) === 0.2
    && P.volumeMusica(10 * fps - 1, curta, fps, total) < 0.01
    && P.volumeMusica(10 * fps, curta, fps, total) === 0 && P.volumeMusica(20 * fps, curta, fps, total) === 0);
  ok('21e. o volume nunca passa do ganho, e ganho torto/negativo/acima de 1 e grampeado',
    Array.from({ length: total }, (_, f) => P.volumeMusica(f, m, fps, total)).every((v) => v >= 0 && v <= 0.1)
    && P.volumeMusica(100, { ganho: 5 }, fps, total) === 1 && P.volumeMusica(100, { ganho: -1 }, fps, total) === 0
    && P.volumeMusica(100, null, fps, total) === 0 && P.volumeMusica(100, { ganho: NaN }, fps, total) === 0);
  ok('21f. uma assinatura sem tempo proprio: so o quadro da SAIDA (relogio do corte, nada "porque o tempo passou")',
    P.volumeMusica.length === 4);
  ok('21g. UMA faixa de musica, do @remotion/media, so no Clip.jsx, com o volume do preset',
    (clipJsx.match(/<Audio\b/g) || []).length === 1
    && /import \{ Audio, Video \} from "@remotion\/media"/.test(clipJsx)
    && /volume=\{\(f\) => volumeMusica\(f, musica, fps, durationInFrames\)\}/.test(clipJsx)
    && /musica && musica\.file \?/.test(clipJsx));
}

/* 22. REMOVER TRECHOS (2026-09-30): aqui so a FORMA (o dono do mapa e o captions.py). */
{
  const P = await import('./src/preset.js');
  eq('22a. remocoesOf: inteiros, de < ate, em ordem, no maximo REMOCOES_MAX; torto some',
    [P.remocoesOf(undefined), P.remocoesOf([{ deMs: 5000.4, ateMs: 6000.6 }, { deMs: 1000, ateMs: 2000 },
      { deMs: 3, ateMs: 1 }, 'x', { deMs: -1, ateMs: 4 }]),
      P.remocoesOf(Array.from({ length: 50 }, (_, i) => ({ deMs: i, ateMs: i + 1 }))).length],
    [[], [{ deMs: 1000, ateMs: 2000 }, { deMs: 5000, ateMs: 6001 }], P.REMOCOES_MAX]);
  ok('22b. editOf so cria a chave `remocoes` com remocao valida (sem ela = edit de sempre)',
    !('remocoes' in P.editOf({ edit: { v: 1, remocoes: [] } }))
    && P.editOf({ edit: { v: 1, remocoes: [{ deMs: 1, ateMs: 2 }] } }).remocoes.length === 1
    && P.REMOCOES_MAX === 30);
  ok('22c. nenhuma formula de remapear tempo no preset nem na composicao (o dono e o Python)',
    !/remapear|mapaSaida|mapa_saida\(/.test(clipJsx));
}

/* 23. TEXTO FIXO NA TELA (2026-09-30): validador, opacidade e estilo puros; a composicao so
   desenha o que o servidor manda, uma Sequence por texto. */
{
  const P = await import('./src/preset.js');
  const T = { id: 't1', texto: '  Faturamento   de 2024 ', deMs: 416000, ateMs: 418000, posicao: 'meio', estilo: 'nota' };
  eq('23a. textosOf: limpa, padroes, sem sobreposicao, teto; torto some',
    [P.textosOf([T])[0], P.textosOf([{ ...T, posicao: 'x', estilo: 'y' }])[0].posicao,
      P.textosOf([T, { ...T, id: 't2', deMs: 417000, ateMs: 419000 }]).length,
      P.textosOf([{ ...T, texto: ' ' }, { ...T, ateMs: 416500 }, { ...T, id: 'T X' }, 'x']).length,
      P.textosOf(Array.from({ length: 6 }, (_, i) => ({ ...T, id: 't' + i, deMs: 416000 + i * 2000, ateMs: 417500 + i * 2000 }))).length],
    [{ id: 't1', texto: 'Faturamento de 2024', deMs: 416000, ateMs: 418000, posicao: 'meio', estilo: 'nota' },
      'alto', 1, 0, P.TEXTOS_MAX]);
  const fps = 30, quadros = 60;
  ok('23b. opacidade: entra e sai em ate 150 ms, 1 no meio, 0 fora; so depende do quadro da Sequence',
    P.opacidadeTexto(0, quadros, fps) < 1 && P.opacidadeTexto(4, quadros, fps) === 1
    && P.opacidadeTexto(30, quadros, fps) === 1 && P.opacidadeTexto(quadros - 1, quadros, fps) < 1
    && P.opacidadeTexto(quadros, quadros, fps) === 0 && P.opacidadeTexto(-1, quadros, fps) === 0
    && Math.round(P.TEXTO_FADE_MS / 1000 * fps) <= 5 && P.TEXTO_FADE_MS <= 150);
  const est = P.textoFixoEstilo({ posicao: 'alto', estilo: 'rotulo' });
  ok('23c. estilo estatico: sem transform nem animacao; a coluna fica a esquerda da trilha do TikTok',
    !('transform' in est.bloco) && !('transform' in est.texto)
    && est.bloco.left + est.bloco.width <= 930 && est.bloco.left >= 40
    && est.bloco.top === P.TEXTO_GEOMETRIA.topo.alto
    && 'backgroundColor' in est.texto && !('textShadow' in est.texto)
    && 'textShadow' in P.textoFixoEstilo({ posicao: 'meio', estilo: 'nota' }).texto);
  ok('23d. a composicao desenha UMA Sequence por texto vindo do servidor, com o estilo e a opacidade do preset',
    /<Sequence key=\{"texto-" \+ t\.id\} from=\{de\} durationInFrames=\{quadros\}/.test(clipJsx)
    && /opacity: opacidadeTexto\(quadro, quadros, fps\)/.test(clipJsx)
    && /const estilo = textoFixoEstilo\(texto\)/.test(clipJsx));
}

/* 24. ZOOM PONTUAL LEVE (2026-09-30): escala pura por quadro; so a camada do video. */
{
  const P = await import('./src/preset.js');
  const Z = { id: 'z1', deMs: 416000, ateMs: 419000, nivel: 'medio' };
  eq('24a. zoomsOf: padroes, sem sobreposicao, teto 5, janela >= 1 s; torto some',
    [P.zoomsOf([Z])[0], P.zoomsOf([{ ...Z, nivel: 'forte' }])[0].nivel,
      P.zoomsOf([Z, { ...Z, id: 'z2', deMs: 418000, ateMs: 420000 }]).length,
      P.zoomsOf([{ ...Z, ateMs: 416500 }, { ...Z, id: 'Z!' }, 'x']).length,
      P.zoomsOf(Array.from({ length: 8 }, (_, i) => ({ ...Z, id: 'z' + i, deMs: i * 3000, ateMs: i * 3000 + 1500 }))).length],
    [{ id: 'z1', deMs: 416000, ateMs: 419000, nivel: 'medio' }, 'leve', 1, 0, P.ZOOMS_MAX]);
  const fps = 30;
  const zs = [{ deSec: 2, ateSec: 5, nivel: 'medio' }, { deSec: 8, ateSec: 8.6, nivel: 'leve' }];
  const escalas = Array.from({ length: 12 * fps }, (_, f) => P.escalaZoom(f, zs, fps));
  ok('24b. fora de toda janela a escala e EXATAMENTE 1 (nada dispara so porque o tempo passou)',
    P.escalaZoom(0, zs, fps) === 1 && P.escalaZoom(5 * fps, zs, fps) === 1 && P.escalaZoom(7 * fps, zs, fps) === 1
    && P.escalaZoom(10, [], fps) === 1 && P.escalaZoom(10, undefined, fps) === 1);
  ok('24c. no meio da janela chega ao nivel (medio 1,12); nunca passa do teto 1,15 nem do nivel (sem sobressalto)',
    Math.abs(P.escalaZoom(3.5 * fps, zs, fps) - 1.12) < 1e-12
    && escalas.every((s) => s >= 1 && s <= 1.12 + 1e-12 && s <= P.ZOOM_TETO)
    && P.ZOOM_ESCALAS.medio <= P.ZOOM_TETO && P.ZOOM_ESCALAS.leve < P.ZOOM_ESCALAS.medio);
  const subida = escalas.slice(2 * fps, 2 * fps + 13);
  ok('24d. a entrada e MONOTONA e leva 400 ms (12 quadros) — curva suave, sem degrau nem tremor',
    subida.every((s, i) => i === 0 || s >= subida[i - 1]) && subida[0] === 1
    && Math.abs(subida[12] - 1.12) < 1e-12 && subida[6] > 1 && subida[6] < 1.12);
  ok('24e. janela curta (0,6 s): a rampa e no maximo metade dela, e o pico nao passa do nivel',
    Math.max(...escalas.slice(8 * fps, Math.round(8.6 * fps))) <= 1.06 + 1e-12
    && Math.abs(P.escalaZoom(Math.round(8.3 * fps), zs, fps) - 1.06) < 1e-9);
  ok('24f. SO a camada do video escala: o scale mora dentro do Palco, envolvendo a <Video>, num contêiner que corta',
    /const Palco = \(\{ src, reframe, altura, zooms \}\)/.test(clipJsx)
    && /<div style=\{\{ overflow: "hidden", lineHeight: 0 \}\}>\s*<div style=\{\{ transform: "scale\(" \+ escalaZoom\(quadro, zooms, fps\) \+ "\)", transformOrigin: "50% 50%" \}\}>\s*\{video\}/.test(clipJsx)
    && (clipJsx.match(/escalaZoom\(/g) || []).length === 1);
}
console.log(`\nok - ${n} verificacoes passaram (tipografia, quebra de linha, enfase, fundo, destaque de titulo e a biblioteca de cards do BUSINESS_SERIOUS).`);
