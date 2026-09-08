// Provas da página pública da análise (web/app.js) — sem DOM e sem rede.
//
// O que interessa aqui: o cartão sai igual ao do Estúdio, TODO estado fala (BP-008),
// e nada é inventado — nem estado de legenda, nem portão de direitos, nem nota zero.
// Uso: node web/test-app.js
const assert = require('assert');
const app = require('./app.js');

let provas = 0;
function ok(nome, fn) {
  try { fn(); provas++; } catch (erro) { console.error('FALHOU: ' + nome); throw erro; }
}

const CAND = {
  inSec: 2970.48, outSec: 3036.28, score: 84, signals: ['heatmap'],
  topic: 'Deixa eu te perguntar uma coisa', hook: 'a pergunta que abre o trecho',
  reason: 'pico de “Mais reproduzidos” (100% do maior do vídeo)', contextWarning: '',
};
const READY = {
  status: 'ready', preview: '', note: '',
  video: { videoId: 'aaaaaaaaaaa', title: 'Podcast', uploader: 'Canal', durationSec: 7639 },
  candidates: [CAND],
};

/* ------------------------------------------------------------------ formato */
ok('fmtClock escreve minuto:segundo e hora quando passa de 1h', () => {
  assert.strictEqual(app.fmtClock(75), '1:15');
  assert.strictEqual(app.fmtClock(3661), '1:01:01');
  assert.strictEqual(app.fmtClock(-1), '--:--');
  assert.strictEqual(app.fmtClock('nada'), '--:--');
});
ok('signalLabel usa os MESMOS rótulos do Estúdio', () => {
  assert.strictEqual(app.signalLabel('heatmap'), 'Mais reproduzidos');
  assert.strictEqual(app.signalLabel('chapter'), 'Capítulo');
  assert.strictEqual(app.signalLabel('transcript'), 'Fala');
  assert.strictEqual(app.signalLabel('coisa-nova'), 'coisa-nova');
});
ok('clipKey vem do intervalo, então sobrevive a um render novo', () => {
  assert.strictEqual(app.clipKey(CAND), app.clipKey(Object.assign({}, CAND)));
  assert.notStrictEqual(app.clipKey(CAND), app.clipKey({ inSec: 1, outSec: 2 }));
});

/* --------------------------------------------------------------- o cartão */
ok('cartão usa as classes do video-ops.css', () => {
  const html = app.cardHTML(CAND, 'aaaaaaaaaaa', '');
  ['vop-cand', 'vop-cand-head', 'vop-cand-reason', 'vop-cand-hook',
    'vop-pill-row', 'vop-chip vop-cand-score', 'vop-chip vop-chip-quiet',
  ].forEach((cls) => assert.ok(html.includes(cls), 'faltou ' + cls));
});
ok('intervalo aparece em min:seg com a duração ao lado', () => {
  assert.ok(app.cardHTML(CAND, 'x', '').includes('49:30 → 50:36 · 66s'));
});
ok('nota ausente NÃO vira "nota 0" (zero seria medição falsa)', () => {
  const html = app.cardHTML(Object.assign({}, CAND, { score: 0 }), 'x', '');
  assert.ok(!html.includes('nota'), 'emitiu chip de nota sem nota');
  assert.ok(app.cardHTML(CAND, 'x', '').includes('nota 84'));
});
ok('aviso de contexto sai no .vop-warning quando o detector manda', () => {
  const sem = app.cardHTML(CAND, 'x', '');
  const com = app.cardHTML(Object.assign({}, CAND, { contextWarning: 'abre em conector solto' }), 'x', '');
  assert.ok(!sem.includes('vop-warning'));
  assert.ok(com.includes('<div class="vop-warning">abre em conector solto</div>'));
});
ok('prévia só existe no trecho aberto, e o botão troca de rótulo', () => {
  const fechado = app.cardHTML(CAND, 'aaaaaaaaaaa', '');
  const aberto = app.cardHTML(CAND, 'aaaaaaaaaaa', app.clipKey(CAND));
  assert.ok(!fechado.includes('<iframe'));
  assert.ok(fechado.includes('>Prever<') && fechado.includes('aria-pressed="false"'));
  assert.ok(aberto.includes('vop-cand-frame') && aberto.includes('youtube.com/embed/aaaaaaaaaaa'));
  assert.ok(aberto.includes('start=2970') && aberto.includes('end=3036'));
  assert.ok(aberto.includes('>Fechar prévia<') && aberto.includes('aria-pressed="true"'));
});
ok('sem videoId não há prévia nem botão morto', () => {
  const html = app.cardHTML(CAND, '', app.clipKey(CAND));
  assert.ok(!html.includes('<iframe') && !html.includes('data-act="preview"'));
});
ok('texto do vídeo é escapado (HTML de terceiro não injeta)', () => {
  const html = app.cardHTML(Object.assign({}, CAND, {
    topic: '<img src=x onerror=alert(1)>', hook: '"aspas" & <b>',
  }), 'x', '');
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x') && html.includes('&quot;aspas&quot; &amp;'));
});

/* -------------------------------------------------- todo estado fala (BP-008) */
ok('carregando: barra + quanto tempo esperar', () => {
  const html = app.statusHTML({ status: 'loading', candidates: [] });
  assert.ok(html.includes('class="bar"'));
  assert.ok(/por volta de 10 segundos/.test(html));
});
ok('erro mostra a mensagem do servidor, não um genérico', () => {
  const html = app.statusHTML({ status: 'error', error: 'Cole o endereço do vídeo.', candidates: [] });
  assert.ok(html.includes('vop-warning') && html.includes('Cole o endereço do vídeo.'));
});
ok('lista vazia diz por que, em vez de ficar em branco', () => {
  const vazio = Object.assign({}, READY, { candidates: [] });
  assert.ok(/sem trecho com sinal suficiente/.test(app.statusHTML(vazio)));
  assert.ok(!app.listHTML(vazio).includes('vop-cand-list'));
});
ok('trocar a URL no meio da análise tem frase própria, não painel em branco', () => {
  const html = app.statusHTML({ status: 'stale', candidates: [] });
  assert.ok(/A URL mudou/.test(html) && /Detectar cortes de novo/.test(html));
});
ok('nota do detector aparece com o mesmo prefixo do Estúdio', () => {
  const html = app.listHTML(Object.assign({}, READY, { note: 'Este vídeo não publica “Mais reproduzidos”.' }));
  assert.ok(html.includes('Análise: Este vídeo não publica'));
});
ok('nota aparece mesmo quando não sobrou trecho nenhum', () => {
  const html = app.listHTML(Object.assign({}, READY, { candidates: [], note: 'sem heatmap' }));
  assert.ok(html.includes('Análise: sem heatmap'));
});
ok('estado inicial não escreve nada (a moldura já explica)', () => {
  assert.strictEqual(app.statusHTML({ status: 'idle', candidates: [] }), '');
  assert.strictEqual(app.listHTML({ status: 'idle', candidates: [] }), '');
});
ok('cabeçalho mostra título, canal e duração do vídeo', () => {
  const html = app.listHTML(READY);
  assert.ok(html.includes('<strong>Podcast</strong>') && html.includes('Canal') && html.includes('2:07:19'));
});
ok('a lista NÃO carrega frase de estado (ela vive na região aria-live)', () => {
  const vazio = Object.assign({}, READY, { candidates: [] });
  assert.ok(!app.listHTML(vazio).includes('sem trecho com sinal'));
  assert.ok(!app.listHTML({ status: 'loading', candidates: [] }).includes('bar'));
});

/* ------------------------------------------------------- ordem e nada inventado */
ok('lista sai em ordem de tempo, não de nota', () => {
  const html = app.listHTML(Object.assign({}, READY, {
    candidates: [
      Object.assign({}, CAND, { inSec: 900, outSec: 960, topic: 'segundo' }),
      Object.assign({}, CAND, { inSec: 60, outSec: 120, topic: 'primeiro', score: 99 }),
    ],
  }));
  assert.ok(html.indexOf('primeiro') < html.indexOf('segundo'));
});
ok('nenhum estado de legenda é inventado (são do Passo 2, com MP4 local)', () => {
  const todos = [
    app.listHTML(READY), app.statusHTML({ status: 'loading', candidates: [] }),
    app.statusHTML({ status: 'error', error: 'x', candidates: [] }),
    app.statusHTML({ status: 'stale', candidates: [] }),
    app.statusHTML(Object.assign({}, READY, { candidates: [] })),
  ].join(' ');
  ['CAPTIONS_', 'sem legenda', 'Sem legenda', 'burned', 'Arial'].forEach((t) => {
    assert.ok(!todos.includes(t), 'inventou estado de legenda: ' + t);
  });
});
/* Varrer o TEXTO do arquivo reprova a própria documentação: os comentários deste
   projeto dizem, em português, o que o código NÃO deve fazer ("nenhum
   localStorage", "não copiar o portão") — e a substring passa a existir. Mesma
   armadilha já medida nos checks 16h-16k do test_ytclip. Então a varredura é só
   sobre o CÓDIGO. Todo comentário destes arquivos é de bloco; tirar `//` também
   comeria os `https://` das strings, o que apagaria código de verdade. */
function codigo(arquivo) {
  return require('fs').readFileSync(__dirname + '/' + arquivo, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}
ok('nenhum portão de direitos no código (aqui não existe download)', () => {
  const src = codigo('app.js');
  assert.ok(!/Declaro que tenho autoriza/.test(src), 'copiou o portão para uma tela sem download');
  assert.ok(!/yt-fetch|yt-render|fetch_section|api\/video-cut/.test(src), 'referenciou rota de download');
});
ok('a página não guarda nada (promessa do rodapé cumprida em código)', () => {
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(codigo('app.js')));
});
ok('toda chamada de rede vai para a API configurada, e nenhuma para terceiro', () => {
  const src = codigo('app.js');
  const total = (src.match(/fetch\(/g) || []).length;
  const nossas = (src.match(/fetch\(API \+ /g) || []).length;
  assert.strictEqual(total, nossas, 'existe fetch fora do apiBase');
  // são duas: a análise e a checagem do motor. Uma terceira precisa de justificativa.
  assert.strictEqual(total, 2);
  assert.ok(src.includes("'/probe'") && src.includes("'/health'"));
  // nenhum endereço absoluto de terceiro embutido (o embed do YouTube é <iframe>,
  // não fetch, e o Turnstile entra por <script src>)
  assert.ok(!/fetch\(\s*['"]https?:/.test(src));
});
ok('config.js não carrega segredo', () => {
  assert.ok(!/SECRET|service_role|senha|password/i.test(codigo('config.js')));
});

/* ---------- o motor roda na máquina do operador, não no site (BP-008) ---------- */
ok('motor ok ou checando não escreve nada', () => {
  assert.strictEqual(app.motorHTML({ motor: 'ok' }), '');
  assert.strictEqual(app.motorHTML({ motor: 'checando' }), '');
});
ok('motor offline nomeia AS DUAS causas e não escolhe uma', () => {
  const html = app.motorHTML({ motor: 'offline' });
  assert.ok(/não está ligado nesta máquina/.test(html), 'não fala do motor desligado');
  assert.ok(/analise-local\.ps1/.test(html), 'não diz o comando que resolve');
  assert.ok(/navegador bloqueou/.test(html), 'não fala do bloqueio do navegador');
  assert.ok(/Safari/.test(html) && /Chrome/.test(html), 'não diz qual navegador faz o quê');
  assert.ok(/data-act="remotor"/.test(html), 'não oferece verificar de novo');
});
ok('a página deixa claro que o motor não é do site', () => {
  assert.ok(/roda na sua máquina/.test(app.motorHTML({ motor: 'offline' })));
});
ok('o botão só é travado quando o motor está CONFIRMADAMENTE offline', () => {
  const src = codigo('app.js');
  // durante 'checando' o botão segue clicável: travar por checagem em voo é pior
  assert.ok(/S\.motor === 'offline'/.test(src));
  assert.ok(!/S\.motor !== 'ok'/.test(src), 'travou o botão durante a checagem');
});
ok('a checagem do motor tem prazo (porta fechada pode pendurar)', () => {
  const src = codigo('app.js');
  assert.ok(/AbortController/.test(src) && /abort\(\)/.test(src));
  assert.ok(/clearTimeout/.test(src), 'deixa o timer pendurado');
});
ok('a checagem usa /health, não gasta um probe', () => {
  assert.ok(/'\/health'/.test(codigo('app.js')));
});

/* ------------- guardas de corrida e de foco (sem DOM: prova no CÓDIGO, não no texto) */
ok('resposta obsoleta é descartada em TODOS os ramos da promessa', () => {
  const src = codigo('app.js');
  // um contador por requisição, incrementado ao analisar E ao limpar
  assert.ok(/var meu = \+\+gen;/.test(src), 'não marca a requisição');
  assert.ok(/gen\+\+;/.test(src), 'limpar não invalida o que está em voo');
  // o guarda precisa estar no sucesso E no catch, senão o erro do vídeo antigo
  // aparece sobre a tela do vídeo novo
  assert.strictEqual((src.match(/meu !== gen/g) || []).length, 2);
  // e `busy` tem de ser liberado fora do guarda, senão o botão morre calado
  assert.ok(/busy = false;/.test(src.split('meu !== gen').pop()));
});
ok('o toggle da prévia devolve o foco ao botão', () => {
  const src = codigo('app.js');
  assert.ok(/\.focus\(\)/.test(src));
  assert.ok(/CSS\.escape/.test(src), 'monta seletor sem escapar o id');
});
ok('token vazio e Turnstile quebrado têm frases DIFERENTES', () => {
  const src = codigo('app.js');
  assert.ok(/s\.onerror/.test(src), 'não detecta o script que não carregou');
  assert.ok(/bloqueador de anúncios/.test(src));
  assert.ok(/Complete a verificação/.test(src));
  // mandar "marque a verificação" quando não existe caixa nenhuma trava o usuário
  assert.ok(!/Marque a verificação antes de analisar/.test(src));
});

console.log(provas + ' provas OK');
