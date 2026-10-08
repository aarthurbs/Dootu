/* Gera os stills 1080x1920 da CAPA DO TIKTOK, para CONFERIR OLHANDO (modelado no
 * preview-titulo.mjs). A escolha do corpo usa avanço MEDIDO, e só o frame diz se a manchete
 * cabe na coluna e no miolo seguro. Quadro SINTÉTICO (`testsrc2`), pasta temporária — nada
 * entra no repositório. As guias (recorte 3:4, miolo seguro, contador) ligam só aqui.
 *
 * Uso:  cd studio && node preview-capa.mjs [pasta-de-saida] [prefixo-dos-casos]
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const saida = process.argv[2] || mkdtempSync(path.join(tmpdir(), 'capa-'));
mkdirSync(saida, { recursive: true });
const publico = mkdtempSync(path.join(tmpdir(), 'public-'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
  'testsrc2=size=1280x720', '-frames:v', '1', path.join(publico, 'quadro.png')]);

const CURTO = 'Perdi 40 mil no primeiro ano';
const LONGO = 'Como sair de uma cidade pequena e chegar a cem mil pedidos por mes sem investidor';
const base = { quadroFile: 'quadro.png', reframe: 'blur', videoAltura: 608, bandaAltura: 656,
  titulo: CURTO, destaque: '', estilo: 'negocio', posicao: 'meio', guias: true };
const CASOS = [
  ['1-curto-meio', {}],
  ['2-curto-alto', { posicao: 'alto' }],
  ['3-curto-baixo', { posicao: 'baixo' }],
  ['4-longo', { titulo: LONGO }],
  ['5-destaque-manual', { destaque: '40 mil' }],
  ['6-faixa', { estilo: 'faixa', destaque: '40 mil' }],
  ['7-limpo', { estilo: 'limpo', destaque: '40 mil' }],
  ['8-enquadra-1x1', { reframe: 'crop11', videoAltura: 1080, bandaAltura: 420 }],
  /* O PNG real: sem guias. */
  ['9-sem-guias', { guias: false, destaque: '40 mil' }],
];

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.jsx'), publicDir: publico });
const so = process.argv[3] || '';
for (const [nome, extra] of CASOS.filter(([n]) => n.startsWith(so))) {
  const inputProps = { ...base, ...extra };
  const composition = await selectComposition({ serveUrl, id: 'CapaTikTok', inputProps });
  await renderStill({ composition, serveUrl, inputProps, imageFormat: 'png', frame: 0,
    output: path.join(saida, nome + '.png') });
  console.log('ok ' + nome);
}
console.log('\nPNGs em: ' + saida);
