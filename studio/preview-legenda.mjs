/* Stills 1080x1920 da LEGENDA, para CONFERIR OLHANDO.
 *
 * Tipografia nao e provavel por asercao: o peso sintetizado pelo Chrome (quando a familia
 * nao tem aquele peso carregado) sai como um engrossamento borrado que passa em qualquer
 * check. So aparece no frame. Este script existe para isso -- e para ver se o avanco medido
 * da Montserrat em caixa alta fecha a pagina onde o `tetoDaPagina` promete.
 *
 * Fonte SINTETICA (`testsrc2`), pasta temporaria, nada entra no repositorio.
 * Uso:  cd studio && node <este-arquivo> <pasta-de-saida>
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const saida = process.argv[2] || mkdtempSync(path.join(tmpdir(), 'leg-'));
mkdirSync(saida, { recursive: true });
const publico = mkdtempSync(path.join(tmpdir(), 'public-'));
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-t', '7',
  '-pix_fmt', 'yuv420p', path.join(publico, 'fonte.mp4')]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720', '-frames:v', '1',
  path.join(publico, 'thumb.jpg')]);

/* Fala com acento, cedilha e til: e onde o subset `latin` falharia, e onde a entrelinha
   de 1.10 do impacto poderia comer o til em caixa alta. */
const CUES = [{ start: 0.0, end: 6.0,
  text: 'A maioria nao vai conseguir manter a disciplina alem do terceiro mes' }];
const base = {
  clipFile: 'fonte.mp4', backgroundFile: 'thumb.jpg', durationSec: 6, cues: CUES,
  preset: 'legenda', category: 'money', highlightText: '', autoHighlight: true,
  title: 'Disciplina no primeiro ano', titleCardStyle: 'nenhum',
  /* Numeros do servidor para uma fonte 16:9 deitada no 9:16 -- os MESMOS que o
     `render_props` monta (`video_box('blur') = 608`, `margem_inferior(1920, 608) = 705`). */
  legendaBase: 705, videoAltura: 608, bandaAltura: 656, reframe: 'blur',
};
const VAZIO = { v: 1, legenda: {}, enquadramento: {} };
const CUES_LONGA = [{ start: 0.0, end: 6.0,
  text: 'Os empreendedores, que constroem patrimonio de verdade, pensam em decadas' }];
/* Props de posicao pelo DONO (o mesmo `legenda_geometria` do render_props), com estas falas. */
function doDono(estilo, legenda) {
  const py = 'import sys, json; sys.path.insert(0, "../video-worker"); import serve;'
    + 'a = json.loads(sys.stdin.read());'
    + 'g = serve.legenda_geometria("blur", serve.edit_of(a["edit"])["legenda"],'
    + ' {"width": 1280, "height": 720}, a["cues"], a["estilo"]);'
    + 'print(json.dumps(g))';
  const edit = { v: 1, legenda: { style: estilo, ...legenda }, enquadramento: {} };
  const g = JSON.parse(execFileSync('python', ['-c', py],
    { input: JSON.stringify({ edit, cues: CUES_LONGA, estilo }) }).toString());
  /* Quadro 15 (0,5 s): a PAGINA com a palavra mais longa esta na tela -- o pior caso. */
  const props = { legendaStyle: estilo, edit, cues: CUES_LONGA, legendaBase: g.legendaBase, quadroStill: 15 };
  if (legenda.posicaoXPct !== undefined) {
    props.legendaEsquerda = g.legendaEsquerda;
    props.legendaColuna = g.legendaLargura;
  }
  console.log(estilo, JSON.stringify(legenda), '->', JSON.stringify({ base: g.legendaBase,
    esquerda: g.legendaEsquerda, coluna: g.legendaLargura, palavra: g.palavraPiso, avisos: g.avisos }));
  return props;
}

const CASOS = [
  /* O de hoje: Inter Bold 58, caixa baixa. Serve de controle -- se este mudar, a entrega
     quebrou clip antigo. */
  ['1-classico', { legendaStyle: 'classico', edit: VAZIO }],
  /* O estilo trocado: Montserrat ExtraBold 72 em caixa alta. E AQUI que se olha se o peso
     800 veio da fonte ou foi sintetizado pelo Chrome sobre um peso menor. */
  ['2-impacto-montserrat', { legendaStyle: 'impacto', edit: VAZIO }],
  /* Ajuste manual completo: outra familia, outro corpo, caixa baixa, coluna estreita e
     alinhamento a esquerda. A coluna de 600 e a prova de que a pagina foi cortada com o
     teto DESTA largura, e nao com o de 820. */
  ['3-manual-inter-600-esquerda', { legendaStyle: 'impacto', edit: { v: 1, legenda: {
    familia: 'inter', tamanho: 44, caixaAlta: false, largura: 600,
    alinhamento: 'left', cor: 'texto', destaqueCor: 'destaqueGanho' } } }],
  /* Montserrat com a coluna cheia e o corpo no teto (96): e o caso em que um avanco
     subestimado faria a linha estourar os 820px sem erro nenhum. */
  ['4-manual-montserrat-96', { legendaStyle: 'classico', edit: { v: 1, legenda: {
    familia: 'montserrat', tamanho: 96, caixaAlta: true, destaqueCor: 'destaque' } } }],
  /* Posicao vertical manual: 40% do quadro. O `legendaBase` vem do servidor ja resolvido
     (1920 - round(1920*0.40) = 1152), como no render de verdade. */
  ['5-posicao-40pct', { legendaStyle: 'impacto', legendaBase: 1152,
    edit: { v: 1, legenda: { posicaoPct: 40 } } }],
  /* Os estilos prontos de 2026-09-23: caixa escura, contorno, caixa clara e o discreto. */
  ['6-faixa', { legendaStyle: 'faixa', edit: VAZIO }],
  ['7-contorno', { legendaStyle: 'podcast', edit: VAZIO }],
  ['8-papel', { legendaStyle: 'papel', edit: VAZIO }],
  ['9-discreta', { legendaStyle: 'discreta', edit: VAZIO }],
  /* Personalizado por cima de um estilo, com KARAOKE (tempo por palavra): cor livre do
     texto, destaque coral na palavra sendo dita, contorno azul-noite e sem caixa. */
  ['10-personalizado-karaoke', { legendaStyle: 'faixa', cues: [{ start: 0, end: 6,
    text: 'Disciplina vence talento quando o talento descansa',
    words: 'Disciplina vence talento quando o talento descansa'.split(' ').map((w, i) =>
      ({ text: w, start: i * 0.8, end: (i + 1) * 0.8 })) }],
  edit: { v: 1, legenda: { cor: '#F5F1E8', destaqueCor: '#FF6B5B', contorno: '#0E1A3A',
    fundo: 'nenhum', tamanho: 64 } } }],
  /* PROFUNDIDADE (2026-09-25): inclinada pela base + volume, estática. Suave e Funda no
     clássico e no impacto; com contorno (Contorno) o volume fica sob o traço; com caixa
     (Faixa) só inclina. A base tem de continuar em y 1215 em todos. */
  ['11-suave-classico', { legendaStyle: 'classico', edit: { v: 1, legenda: { profundidade: 'suave' } } }],
  ['12-funda-classico', { legendaStyle: 'classico', edit: { v: 1, legenda: { profundidade: 'funda' } } }],
  ['13-suave-impacto', { legendaStyle: 'impacto', edit: { v: 1, legenda: { profundidade: 'suave' } } }],
  ['14-funda-impacto', { legendaStyle: 'impacto', edit: { v: 1, legenda: { profundidade: 'funda' } } }],
  ['15-funda-contorno', { legendaStyle: 'podcast', edit: { v: 1, legenda: { profundidade: 'funda' } } }],
  ['16-funda-caixa', { legendaStyle: 'faixa', edit: { v: 1, legenda: { profundidade: 'funda' } } }],
  /* POSICAO LIVRE (2026-09-28): os quatro extremos com uma palavra LONGA de verdade, a coluna
     estreitada perto da borda, a zona de baixo, a guarda do topo e a Funda encostada. Os
     numeros (base, borda e coluna efetiva) vem do DONO -- `serve.legenda_geometria`, chamado
     aqui pelo Python -- e nao de conta nesta pasta. Nada pode sair do quadro. */
  ...[
    ['19-livre-esquerda', 'impacto', { posicaoXPct: 0 }],
    ['20-livre-direita', 'impacto', { posicaoXPct: 100 }],
    ['21-livre-topo', 'impacto', { posicaoPct: 0 }],
    ['22-livre-fundo-zona', 'impacto', { posicaoPct: 100 }],
    ['23-coluna-estreitada', 'classico', { posicaoXPct: 22 }],
    ['24-funda-na-borda', 'impacto', { posicaoXPct: 100, profundidade: 'funda' }],
  ].map(([nome, estilo, legenda]) => [nome, doDono(estilo, legenda)]),
  /* ÂNGULO da Profundidade (2026-09-29): as oito direções na Funda do impacto; Suave de lado e
     na diagonal no clássico; volume sob o traço (Contorno); só inclina com caixa (Faixa). O
     volume tem de sair para o lado mais PERTO da câmera, e o texto tem de ficar nítido sob o
     rotateY. */
  ...['tras', 'frente', 'esquerda', 'direita', 'tras-esquerda', 'tras-direita', 'frente-esquerda',
    'frente-direita'].map((d, i) => [(25 + i) + '-funda-impacto-' + d,
    { legendaStyle: 'impacto', edit: { v: 1, legenda: { profundidade: 'funda', profundidadeDirecao: d } } }]),
  ['33-suave-classico-direita', { legendaStyle: 'classico',
    edit: { v: 1, legenda: { profundidade: 'suave', profundidadeDirecao: 'direita' } } }],
  ['34-suave-classico-tras-esquerda', { legendaStyle: 'classico',
    edit: { v: 1, legenda: { profundidade: 'suave', profundidadeDirecao: 'tras-esquerda' } } }],
  ['35-funda-contorno-direita', { legendaStyle: 'podcast',
    edit: { v: 1, legenda: { profundidade: 'funda', profundidadeDirecao: 'direita' } } }],
  ['36-funda-caixa-tras-direita', { legendaStyle: 'faixa',
    edit: { v: 1, legenda: { profundidade: 'funda', profundidadeDirecao: 'tras-direita' } } }],
  /* Nos extremos, com os números do DONO: nada pode sair do quadro em ângulo nenhum. */
  ...[
    ['37-funda-tras-esquerda-na-esquerda', 'impacto', { posicaoXPct: 0, profundidade: 'funda', profundidadeDirecao: 'tras-esquerda' }],
    ['38-funda-frente-direita-na-direita', 'impacto', { posicaoXPct: 100, profundidade: 'funda', profundidadeDirecao: 'frente-direita' }],
    ['39-funda-frente-no-topo', 'impacto', { posicaoPct: 0, profundidade: 'funda', profundidadeDirecao: 'frente' }],
  ].map(([nome, estilo, legenda]) => [nome, doDono(estilo, legenda)]),
  /* TEXTO FIXO junto da legenda (2026-09-30): as duas posições e os dois estilos, com a página
     da legenda na tela — nada pode se sobrepor no caso comum. Tempos já no relógio da SAÍDA. */
  ['40-texto-alto-rotulo', { legendaStyle: 'classico', edit: VAZIO,
    textos: [{ id: 't1', texto: 'Faturamento de 2024', posicao: 'alto', estilo: 'rotulo', deSec: 1, ateSec: 5 }] }],
  ['41-texto-meio-nota', { legendaStyle: 'impacto', edit: VAZIO,
    textos: [{ id: 't1', texto: 'O erro que quase quebrou a empresa', posicao: 'meio', estilo: 'nota', deSec: 1, ateSec: 5 }] }],
  /* ZOOM LEVE (janela 1–5 s, médio): no começo (1,0 s = escala 1), no meio (1,12) e no fim da
     rampa de saída. Só o VÍDEO cresce; a legenda e a moldura ficam onde estavam. */
  ['42-zoom-comeco', { legendaStyle: 'classico', edit: VAZIO, quadroStill: 30,
    zooms: [{ id: 'z1', nivel: 'medio', deSec: 1, ateSec: 5 }] }],
  ['43-zoom-meio', { legendaStyle: 'classico', edit: VAZIO, quadroStill: 90,
    zooms: [{ id: 'z1', nivel: 'medio', deSec: 1, ateSec: 5 }] }],
  ['44-zoom-fim', { legendaStyle: 'classico', edit: VAZIO, quadroStill: 146,
    zooms: [{ id: 'z1', nivel: 'medio', deSec: 1, ateSec: 5 }] }],
];

/* `publicDir` vai no BUNDLE e nao no `renderStill`: quem serve `/public/*` e o bundle, e o
   parametro do renderStill nao alcanca o servidor de arquivos dele. */
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.jsx'), publicDir: publico });
/* 2o argumento opcional: so os casos cujo nome comeca com ele (ex.: `19`, `2`). */
const so = process.argv[3] || '';
for (const [nome, extra] of CASOS.filter(([n]) => n.startsWith(so))) {
  const inputProps = { ...base, ...extra };
  const composition = await selectComposition({ serveUrl, id: 'Clip', inputProps });
  await renderStill({
    composition, serveUrl, inputProps, imageFormat: 'png',
    frame: extra.quadroStill ?? 90,
    output: path.join(saida, nome + '.png'),
  });
  console.log('ok ' + nome);
}
console.log('\nPNGs em: ' + saida);
