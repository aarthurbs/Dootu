/* Gera os stills 1080x1920 do card da marca, para CONFERIR OLHANDO.
 *
 * Existe porque a métrica de fonte não é provável por asserção: o `AVANCO_MONTSERRAT` do
 * preset.js é uma estimativa da largura de avanço da Montserrat, e o único jeito de saber se
 * ela está calibrada é ver o texto na caixa. Toda vez que esse número for mexido, rode isto
 * de novo e olhe. (Foi assim que este projeto achou o "Faturamentonão" da ênfase e a legenda
 * escrita 4px fora da imagem.)
 *
 * Fonte SINTÉTICA de propósito (`testsrc2`, bordas nítidas): dá para ver onde acaba o vídeo e
 * onde começa a moldura. Não baixa nada, não usa cache do YouTube, não toca no repositório —
 * o vídeo e os PNGs saem numa pasta temporária.
 *
 * Uso:  cd studio && node preview-titulo.mjs [pasta-de-saida]
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const saida = process.argv[2] || mkdtempSync(path.join(tmpdir(), 'card-'));
mkdirSync(saida, { recursive: true });
const publico = mkdtempSync(path.join(tmpdir(), 'public-'));

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
/* 16:9 deitado num 9:16 — o caso normal de um podcast. */
ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-t', '7',
  '-pix_fmt', 'yuv420p', path.join(publico, 'fonte.mp4')]);
/* Quadro CLARO: é onde um card mal contrastado falha. O antigo título era texto branco com
   sombra, e sobre branco a sombra não salvava.
   VERTICAL (1080x1920) de propósito: o `Palco` deita a fonte na largura do quadro, então
   uma fonte 16:9 nunca chega à altura do card — ele cairia sobre a tarja escura e o teste
   de contraste não testaria nada. Só fonte já vertical enche o quadro e põe branco atrás
   do card. */
ff(['-f', 'lavfi', '-i', 'color=c=white:size=1080x1920:rate=30', '-t', '7',
  '-pix_fmt', 'yuv420p', path.join(publico, 'claro.mp4')]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720', '-frames:v', '1',
  path.join(publico, 'thumb.jpg')]);

/* Legenda no ar durante TODA a janela do card: é assim que se vê se os dois brigam pelo
   mesmo espaço, que é o risco de o card ter ido para o meio do quadro. */
const CUES = [
  { start: 0.2, end: 3.0, text: 'isso mudou tudo pra mim' },
  { start: 3.0, end: 6.0, text: 'e eu levei três anos pra entender' },
];
/* Uma placa de MENTIRA, montada aqui e agora: o repositório não hospeda mais marca nenhuma,
   e o card de verdade vem da biblioteca que o operador constrói no site. Ela existe só para
   os stills provarem o que asserção não prova — que a proporção MEDIDA (240/64 = 3,75) sai
   no quadro sem achatar a placa, e que a altura é a fixa do `TOKENS.logoAltura`. */
const LOGO_FALSO = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64">'
  + '<rect width="240" height="64" rx="10" fill="#FFFFFF"/>'
  + '<text x="120" y="44" font-family="sans-serif" font-size="30" font-weight="700"'
  + ' text-anchor="middle" fill="#0A0A0C">DOOTU</text></svg>').toString('base64');
const CARD_COMPLETO = {
  id: 'preview-1', nome: 'Casa', identificador: 'DOOTU | CORTES',
  logo: LOGO_FALSO, logoProporcao: 240 / 64,
};
const CARD_SO_LOGO = { id: 'preview-2', nome: 'Só placa', identificador: '',
  logo: LOGO_FALSO, logoProporcao: 240 / 64 };
const CARD_SO_TEXTO = { id: 'preview-3', nome: 'Só texto', identificador: 'DOOTU | CORTES' };
const TITULO_TETO = 'Eu quebrei duas vezes antes de entender que disciplina vale mais que '
  + 'motivação no primeiro ano de empresa, e isso mudou tudo.';
const base = {
  clipFile: 'fonte.mp4', backgroundFile: 'thumb.jpg', durationSec: 6,
  cues: CUES, preset: 'legenda', category: 'money',
  highlightText: '', autoHighlight: true,
  /* O card PADRÃO destes stills. Declarado no `base` pela mesma razão do `title`: sem ele
     todo caso sairia sem card, e o que se quer conferir é justamente o card. */
  card: CARD_COMPLETO,
};

const TITULO_CICLO = 'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.';

/* Os seis casos de validação do pedido, o de contraste, e o ciclo de 4s do card. */
const CASOS = [
  ['1-curto', { title: 'Comece hoje.' }],
  ['2-pedido', { title: 'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.' }],
  ['3-longo', {
    title: 'Eu quebrei duas vezes antes de entender que disciplina vale mais que '
      + 'motivação no primeiro ano de empresa.',
  }],
  ['4-acentos', { title: 'Faturei R$ 1,2 milhão em 2019? Não — foi em 2021.' }],
  ['5-destaque-manual', {
    title: 'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.',
    highlightText: 'pequena cidade',
  }],
  ['6-sem-destaque', {
    title: 'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.',
    autoHighlight: false,
  }],
  /* Sobre quadro CLARO de verdade. Precisa de `bandaAltura: 0` — fonte já vertical, que
     enche o quadro: com uma fonte 16:9 o card cai inteiro DENTRO da tarja de cima e nunca
     encosta no vídeo, então testar contraste ali não prova nada. */
  ['7-quadro-claro', {
    title: 'Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.',
    clipFile: 'claro.mp4', backgroundFile: '', bandaAltura: 0,
  }],
  /* O CICLO dos 4s. O card é chamada e miniatura: entra, fica, sai — e o clipe segue sem
     ele. Os quatro quadros abaixo são o que prova isso sem assistir ao vídeo inteiro. */
  ['8-ciclo-entrando', { title: TITULO_CICLO, frame: 4 }],
  ['9-ciclo-parado', { title: TITULO_CICLO, frame: 60 }],
  ['10-ciclo-saindo', { title: TITULO_CICLO, frame: 117 }],
  ['11-ciclo-depois', { title: TITULO_CICLO, frame: 150 }],
  /* As TRÊS FORMAS de um card do operador. Tudo IGUAL de propósito — mesmo título, mesmo
     trecho destacado, mesma miniatura, mesmo quadro, mesmo instante — para a única diferença
     entre os PNGs ser o card. É assim que se vê o que asserção nenhuma pega: se a placa sai
     na proporção medida (deitada, 3,75:1) em vez de achatada, se o card sem placa fica com
     o respiro certo, e se o card sem texto não deixa um vão onde havia identificador. */
  ['12-card-completo', { title: TITULO_CICLO, card: CARD_COMPLETO, frame: 60 }],
  ['13-card-so-placa', { title: TITULO_CICLO, card: CARD_SO_LOGO, frame: 60 }],
  ['13b-card-so-texto', { title: TITULO_CICLO, card: CARD_SO_TEXTO, frame: 60 }],
  /* O TETO de 3 linhas com a placa no quadro: é o pior caso da caixa, e o único jeito de
     saber se o bloco ainda respira é olhar. */
  ['13c-card-titulo-3-linhas', { title: TITULO_TETO, card: CARD_COMPLETO, frame: 60 }],
  /* Card torto: TEM de sair sem card nenhum, e com a legenda intacta. Um card sem placa, sem
     filete e sem borda é o desfecho que o validador existe para impedir, e ele só se confere
     olhando. */
  ['14-card-invalido-nao-monta-card', {
    title: TITULO_CICLO, card: { nome: 'sem logo e sem texto' }, frame: 60,
  }],
  /* A terceira opção: SEM card. Com o MESMO título dos casos 12 e 13 de propósito — o que
     se confere olhando é que não sobra placa, filete, borda nem manchete no quadro, e que a
     legenda continua no lugar. O par com o 16 prova que "sem card" é igual a não ter título
     nenhum no vídeo, MESMO com o título preenchido (que é o ponto: ele continua nomeando o
     arquivo baixado e o cartão da Central). */
  ['15-sem-card', {
    title: TITULO_CICLO, titleCardStyle: 'nenhum', card: CARD_COMPLETO, frame: 60,
  }],
  ['16-sem-titulo', { title: '', frame: 60 }],
  /* As TRÊS proporções de enquadramento, com os quatro props coerentes como o servidor os
     manda (o `serve.video_box` é o dono único da altura, e dela saem o `bandaAltura` e o
     `legendaBase`). A fonte é o `fonte.mp4`, um testsrc2 16:9 — bordas nítidas, então dá
     para VER onde acaba o vídeo e onde começa a tarja.
     O que se confere OLHANDO, e que asserção nenhuma pega:
     - o vídeo ocupa 608 / 1080 / 1350 px de altura, crescendo do 17 para o 19;
     - a tarja está DESFOCADA e escura, e a manchete da miniatura não se lê mais;
     - NÃO há esmaecido nas bordas do quadro nem falha clara na fronteira vídeo/tarja — é a
       armadilha do `filter: blur` amostrar transparência fora do elemento, e a razão de a
       geometria do Img ser inflada pelo raio;
     - a legenda cai DENTRO do vídeo nos três, e sobe junto com ele.
     No 19 a tarja é fina (285px) e no 18 ela é média (420px): se a inflação do desfoque
     estivesse errada, é no 19 que o defeito apareceria primeiro. */
  ['17-enquadra-inteiro', {
    reframe: 'blur', videoAltura: 608, bandaAltura: 656, legendaBase: 705, frame: 60,
  }],
  ['18-enquadra-1x1', {
    reframe: 'crop11', videoAltura: 1080, bandaAltura: 420, legendaBase: 506, frame: 60,
  }],
  ['19-enquadra-4x5', {
    reframe: 'crop45', videoAltura: 1350, bandaAltura: 285, legendaBase: 393, frame: 60,
  }],
];

/* `publicDir` vai no BUNDLE e não no `renderStill`: quem serve `/public/*` é o bundle, e o
   render só aponta para ele. Passado só no renderStill, o vídeo dá 404 e o still sai vazio
   — que foi o que aconteceu na primeira tentativa. */
const serve = await bundle({ entryPoint: path.resolve('src/index.jsx'), publicDir: publico });
for (const [nome, extra] of CASOS) {
  const { frame = 60, ...props } = extra;
  const inputProps = { ...base, ...props };
  const composition = await selectComposition({ serveUrl: serve, id: 'Clip', inputProps });
  await renderStill({
    composition, serveUrl: serve, inputProps, frame,
    output: path.join(saida, nome + '.png'),
  });
  console.log('ok  ' + nome + '.png  (quadro ' + frame + ')');
}
console.log('\nstills em: ' + saida);
