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
];

/* `publicDir` vai no BUNDLE e nao no `renderStill`: quem serve `/public/*` e o bundle, e o
   parametro do renderStill nao alcanca o servidor de arquivos dele. */
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.jsx'), publicDir: publico });
for (const [nome, extra] of CASOS) {
  const inputProps = { ...base, ...extra };
  const composition = await selectComposition({ serveUrl, id: 'Clip', inputProps });
  await renderStill({
    composition, serveUrl, inputProps, imageFormat: 'png',
    frame: 90,
    output: path.join(saida, nome + '.png'),
  });
  console.log('ok ' + nome);
}
console.log('\nPNGs em: ' + saida);
