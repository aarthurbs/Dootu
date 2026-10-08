// Smoke DOM headless do Estúdio de Vídeos: stub mínimo de document/localStorage e checa
// que init()->render() roda nas CINCO telas sem estourar, que as telas removidas em
// 2026-08-21 (Material, Posts, Direitos, Contas, Relatórios) não voltaram, que a Central
// lista os clips baixados agrupados por vídeo e que o portão de direitos do YouTube
// bloqueia o download até a declaração existir.
// `node --check` não pega erro de runtime dentro dos construtores de HTML (BP-012); este pega.
// Uso: node test-video-ops-dom.js
const assert = require('assert');
const path = require('path');

const BS = String.fromCharCode(92);
/* O codigo-fonte, para os checks que provam que um CONTRATO continua no arquivo mesmo
   quando a tela deixou de desenha-lo. */
const FONTE_OPS = require('fs').readFileSync(path.join(__dirname, 'video-ops.js'), 'utf8');
const MODULO = './video-ops.js';
const RESULTADOS = './video-results.js';

function fakeEl(sel) {
  const el = {
    style: { setProperty() {} },
    dataset: {}, className: '', value: '', textContent: '', innerHTML: '',
    files: [], checked: false, hidden: false, disabled: false,
    _listeners: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(tipo, fn) { el._listeners[tipo] = fn; },
    removeEventListener() {},
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, remove() {},
    closest() { return null; },
    matches(alvo) { return (sel || []).indexOf(alvo) >= 0; },
    focus() {},
    // O `downloadBlob` monta uma <a> e a clica. Sem isto, todo download morre no stub.
    click() { el._clicado = (el._clicado || 0) + 1; }
  };
  return el;
}

/* O `<video>` da fonte importada. O `srcSeek`/`srcNow` do modulo falam com ELE, e e por aqui
   que o teste prova que "Previa" arrasta o player e que "Marcar trecho daqui" le o instante
   certo -- asserir o HTML provaria so que a tag foi escrita, nunca que alguem a comanda. */
function fakeVideo() {
  const v = fakeEl(['[data-src-video]']);
  v.currentTime = 0;
  v._tocou = 0;
  v.play = function () { v._tocou += 1; return Promise.resolve(); };
  v.pause = function () {};
  return v;
}

// Bancada nova por cenário: o módulo é recarregado do zero, então cada cenário começa com
// raiz, ouvintes e localStorage próprios — sem estado vazando de um caso para o outro.
function bancada(dadosSalvos) {
  const store = Object.create(null);
  if (dadosSalvos) {
    store['pp_video_clips_v1'] = typeof dadosSalvos === 'string'
      ? dadosSalvos : JSON.stringify(dadosSalvos);
  }

  const root = fakeEl();
  const badge = fakeEl();
  const video = fakeVideo();
  /* Todo elemento criado pelo modulo -- e por aqui que o teste acha o `.vop-toast`. */
  const criados = [];
  global.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };
  global.document = {
    readyState: 'complete',
    getElementById(id) {
      if (id === 'video-ops-root') return root;
      if (id === 'count-video-ops') return badge;
      return null;
    },
    /* O player da fonte. O modulo o procura por `[data-src-video]` e e assim que o teste
       pode conferir para onde ele foi arrastado. A faixa de importacao NAO e servida aqui:
       devolvendo null para ela, o `srcRefresh` cai no re-render, que e o caminho que esta
       bancada sabe observar (ela le `root.innerHTML`). */
    querySelector(sel) { return root.querySelector(sel); },
    createElement() { const e = fakeEl(); criados.push(e); return e; },
    addEventListener() {},
    body: { appendChild(c) { return c; } }
  };
  global.window = { addEventListener() {}, scrollX: 0, scrollY: 0, scrollTo() {} };
  global.navigator = { clipboard: { writeText() { return Promise.resolve(); } } };
  /* O `downloadBlob` usa as duas. ACRESCENTADAS ao `URL` do Node, nunca substituindo-o: o
     `safeUrl` do modulo faz `new URL(...)`, e trocar a classe por um objeto com dois metodos
     derruba TODA validacao de endereco do site -- pego no teste (o card da Central parou de
     linkar o original), e o defeito ficaria parecendo do codigo, nao da bancada. */
  global.URL.createObjectURL = function () { return 'blob:fake'; };
  global.URL.revokeObjectURL = function () {};
  global.confirm = () => true;

  /* Mesma ordem do `index.html`: o `video-results.js` se registra em `window.videoResults`
     ANTES do Estúdio montar. Carregar aqui é o que torna a aba Resultados alcançável nesta
     bancada — e o cenário que o APAGA logo abaixo prova o outro ramo. */
  /* O `srcAdopt` procura o player DENTRO da raiz que acabou de ser reescrita e troca o nó
     recém-nascido pelo VIVO. Servindo o mesmo `video` pelos dois caminhos (raiz e
     documento) e contando as trocas, o teste consegue provar o que importa depois de o
     player ter mudado de lugar no DOM: que ele continua sendo ACHADO e readotado, em vez de
     recriado — recriar custa a posição, o volume e o buffer de um arquivo de 2 GB. */
  root.querySelector = function (sel) {
    const tag = /<video[^>]*data-src-video[^>]*>/.exec(root.innerHTML);
    if (sel !== '[data-src-video]' || !tag) return null;
    const src = (/ src="([^"]*)"/.exec(tag[0]) || [])[1];
    if (video._src !== src) video.currentTime = 0;
    video._src = src;
    video._offset = (/data-src-offset="([^"]*)"/.exec(tag[0]) || [])[1] || '0';
    video.getAttribute = k => k === 'src' ? video._src : k === 'data-src-offset' ? video._offset : null;
    return video;
  };
  video.parentNode = { replaceChild() { video._readotado = (video._readotado || 0) + 1; } };

  delete require.cache[require.resolve(RESULTADOS)];
  require(RESULTADOS);
  delete require.cache[require.resolve(MODULO)];
  const api = require(MODULO);
  return {
    root: root, badge: badge, store: store, video: video, ops: api,
    html() { return root.innerHTML; },
    /* O texto do toast desde o ultimo `toastLimpa()` ('' = nenhum toast apareceu). */
    toastTexto() { const t = criados.find(e => e.className === 'vop-toast'); return t ? t.textContent : ''; },
    toastLimpa() { const t = criados.find(e => e.className === 'vop-toast'); if (t) t.textContent = ''; },
    // Um clique de verdade: passa pela MESMA delegação da raiz que o site usa.
    clique(dataset) {
      const botao = fakeEl();
      botao.dataset = dataset;
      root._listeners.click({ target: { closest: s => (s === '[data-act]' ? botao : null) } });
      return botao;
    },
    aba(nome) { return this.clique({ act: 'tab', tab: nome }); },
    muda(seletor, props) {
      const alvo = fakeEl([seletor]);
      Object.assign(alvo, props || {});
      root._listeners.change({ target: alvo });
      return alvo;
    },
    digita(seletor, valor) {
      const alvo = fakeEl([seletor]);
      alvo.value = valor;
      root._listeners.input({ target: alvo });
      return alvo;
    }
  };
}
const tick = () => new Promise(r => setImmediate(r));
function legSalvoPorId(b, id) {
  return [].concat(...JSON.parse(b.store['pp_video_projects_v1']).projects
    .map(p => p.candidates || [])).find(c => c.id === id);
}
/* Um `pointerdown` de verdade na legenda da previa, pela delegacao da raiz. */
function root_pointer(b, alca, y, x) {
  b.root._listeners.pointerdown({
    target: { closest: s => (s === '[data-leg-prev-text]' ? alca : null) },
    clientY: y, clientX: x, pointerId: 1, preventDefault() {}
  });
}

/* A coluna da ESQUERDA do editor, recortada da marcacao. O que interessa nos checks da
   bancada de duas colunas nao e "existe na tela", e "esta do lado certo" -- e uma busca no
   HTML inteiro responderia sim para as duas colunas. */
function colunaEsquerda(html) {
  const i = html.indexOf('class="yt-detail-main"');
  const f = html.indexOf('class="yt-detail-side"');
  return (i >= 0 && f > i) ? html.slice(i, f) : '';
}

let provas = 0;
function ok(nome, valor) {
  assert.ok(valor, 'FALHOU: ' + nome);
  provas++;
}

async function main() {
  /* ----------------------------------------------------- somente as três telas ativas */
  let b = bancada();
  ok('init renderiza sem estourar', b.html().length > 500);
  ok('Clips abre por padrão (entrada direta, 2026-09-23)', /data-tab="youtube" aria-pressed="true"/.test(b.html()));
  ok('a tela inicial não oferece o fluxo removido', !/data-intake-input|Passo [123]/.test(b.html()));
  const navegacao = /<nav class="vop-flow"[^>]*>([\s\S]*?)<\/nav>/.exec(b.html())[1];
  // Resultados entrou em 2026-09-14 (decisão do usuário). O guard continua fechado: a
  // lista é EXAUSTIVA, então as rotas apagadas (`overview`, `cuts`, `review`) seguem
  // barradas — só a tela autorizada foi somada.
  ok('a barra contém somente Clips, Meus projetos, Central e Resultados, nessa ordem',
    [...navegacao.matchAll(/data-tab="([^"]+)"/g)].map(m => m[1]).join(',') === 'youtube,projects,central,resultados');
  ['central', 'projects', 'youtube', 'resultados'].forEach(t => {
    ok('a barra tem a tela ' + t, b.html().indexOf('data-tab="' + t + '"') > 0);
  });
  ['overview', 'cuts', 'review', 'sources', 'queue', 'creators', 'accounts', 'reports'].forEach(t => {
    ok('a tela removida ' + t + ' não voltou', b.html().indexOf('data-tab="' + t + '"') < 0);
  });
  ['Material', 'Posts', 'Direitos', 'Contas', 'Relatórios'].forEach(rotulo => {
    ok('o rótulo removido "' + rotulo + '" não aparece', b.html().indexOf('>' + rotulo + '<') < 0);
  });
  // Cabeçalho de uma linha (2026-09-25): a contagem da Central mora na aba dela, que só
  // mostra número quando há clip — zero é ausência, não informação.
  ok('a Central continua a um clique, na barra, sem contador zerado', /data-tab="central"[^>]*>Central<\/button>/.test(b.html()));
  ok('o badge da navegação conta os clips guardados', String(b.badge.textContent) === '0');

  /* ------------------------------------------- rotas antigas não reabrem o fluxo */
  ['overview', 'cuts', 'review', 'desconhecida'].forEach(t => {
    const antes = b.html();
    b.aba(t);
    ok('a rota removida ou inválida ' + t + ' é ignorada', b.html() === antes);
  });

  /* --------------------------------------------------------------- Central vazia */
  b.aba('central');
  ok('Central vazia explica o que fazer', /Nenhum clip baixado ainda/.test(b.html()));
  ok('Central vazia não inventa cartão', !/vop-lib-card/.test(b.html()));

  /* ------------------------------------------------- Central com clips de dois vídeos */
  const salvo = {
    version: 1, start: '2026-08-21',
    clips: [
      { id: 'c1', videoName: 'podcast-negocios.mp4', clipName: 'Erro que custou', inSec: 10, outSec: 40,
        fileName: 'erro.mp4', savedPath: 'C:' + BS + 'Users' + BS + 'x' + BS + 'Videos' + BS + 'Cortes Estudio' + BS + 'erro.mp4',
        bytes: 2048, origin: 'local', createdAt: '2026-08-21T10:00:00Z' },
      { id: 'c2', videoName: 'podcast-negocios.mp4', clipName: 'Disciplina', inSec: 100, outSec: 130,
        fileName: 'disc.mp4', savedPath: '', bytes: 0, origin: 'local', createdAt: '2026-08-20T10:00:00Z' },
      { id: 'c3', videoName: 'Mentoria ao vivo', clipName: 'Preço x valor', inSec: 5, outSec: 35,
        fileName: 'preco.mp4', savedPath: '/home/x/Cortes Estudio/preco.mp4', bytes: 4096,
        origin: 'youtube', videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk', createdAt: '2026-08-19T10:00:00Z' }
    ]
  };
  b = bancada(salvo);
  b.aba('central');
  let html = b.html();
  ok('a Central conta clips e vídeos', /3 clip\(s\) em 2 vídeo\(s\)/.test(html));
  ok('o nome do vídeo é o título do grupo', html.indexOf('podcast-negocios.mp4') > 0);
  ok('o segundo vídeo também vira grupo', html.indexOf('Mentoria ao vivo') > 0);
  ok('cada clip aparece com o nome que o operador deu',
    html.indexOf('Erro que custou') > 0 && html.indexOf('Disciplina') > 0);
  ok('o card oferece baixar de novo pelo arquivo guardado', html.indexOf('href="/clips/erro.mp4"') > 0);
  ok('o download usa o nome do arquivo do clip', html.indexOf('download="erro.mp4"') > 0);
  ok('o clip guardado toca do disco, não do original', html.indexOf('src="/clips/erro.mp4"') > 0);
  ok('clip sem caminho em disco explica por que não toca', /pasta de Downloads do navegador/.test(html));
  ok('clip sem caminho em disco não oferece link morto', html.indexOf('/clips/disc') < 0);
  ok('o clip vindo do YouTube é marcado como tal', html.indexOf('>YouTube<') > 0);
  ok('o grupo do YouTube linka o original', html.indexOf('https://www.youtube.com/watch?v=abcdefghijk') > 0);
  ok('a Central não fala de post, direito nem conta',
    !/Aprovar|Rejeitar|autorização vinculada|Conta ativa/i.test(html));
  ok('o badge conta os 3 clips', String(b.badge.textContent) === '3');
  ok('a aba da Central mostra a contagem', /data-tab="central"[^>]*>Central<span>3<\/span>/.test(b.html()));

  /* -------------------------------------------------- remover só o registro, não o MP4 */
  b.clique({ act: 'lib-remove', id: 'c2' });
  ok('remover tira o clip da lista', b.html().indexOf('Disciplina') < 0);
  ok('remover grava o histórico novo', JSON.parse(b.store['pp_video_clips_v1']).clips.length === 2);
  ok('remover não toca nos outros clips', b.html().indexOf('Erro que custou') > 0);

  /* ------------------------------------------------ histórico ilegível é preservado */
  b = bancada('{isto não é json');
  ok('dado ilegível cai na tela de recuperação', /precisa de recuperação/.test(b.html()));
  ok('dado ilegível NÃO é sobrescrito', b.store['pp_video_clips_v1'] === '{isto não é json');
  ok('a recuperação oferece baixar o bruto', /data-act="download-raw"/.test(b.html()));

  /* ------------------------------------------------------------------ tela YouTube */
  b = bancada();
  b.aba('youtube');
  html = b.html();
  ok('a tela YouTube pede a URL', /data-yt-url/.test(html));
  ok('a tela YouTube tem a declaração de direitos', /data-yt-rights/.test(html));
  ok('a declaração diz o risco em português', /direito autoral/.test(html));
  ok('sem análise não há cartão de trecho', !/vop-cand/.test(html));

  // Análise: NÃO baixa mídia, então não passa pelo portão. O helper local é dublê.
  let rotaChamada = '';
  global.fetch = function (rota) {
    rotaChamada = rota;
    return Promise.resolve({
      ok: true,
      headers: { get() { return null; } },
      json: () => Promise.resolve({
        title: 'Podcast de Negócios #12',
        duration: 3600,
        note: 'sem legenda em pt-BR',
        candidates: [{ inSec: 600, outSec: 640, topic: 'O erro que custou caro', score: 88,
          signals: ['heatmap', 'transcript'], hook: 'Eu perdi tudo', reason: 'pico de audiência',
          quality: 'forte', qualityLabel: 'Recomendado', boundary: 'palavra',
          evidence: 'Começa numa frase inteira e com gancho na primeira fala.',
          factors: [{ id: 'abertura', label: 'Abertura', weight: 20, value: 1,
                      note: 'Começa numa frase inteira.' },
                    { id: 'fecho', label: 'Fecho', weight: 20, value: 0.7,
                      note: 'Fecha a frase.' },
                    { id: 'interesse', label: 'Interesse do público', weight: 12, value: 0.6,
                      note: 'Audiência soma no máximo 12 pontos.' }],
          contextWarning: 'Começa com "mas"' }]
      })
    });
  };
  b.digita('[data-yt-url]', 'https://www.youtube.com/watch?v=abcdefghijk');
  b.clique({ act: 'yt-probe' });
  await tick(); await tick(); await tick();
  html = b.html();
  ok('a análise chamou /api/yt-probe', rotaChamada === '/api/yt-probe');
  /* MUDOU EM 2026-09-09: a tela FICA no hub depois de analisar. Antes ia para "Meus
     projetos", o que punha um clique entre a analise e o resultado que ela acabou de
     produzir -- e o fluxo pedido e "cola a URL -> analisa -> compara os trechos". */
  ok('depois de analisar, as sugestoes aparecem na hora (sem passar por outra aba)',
    html.indexOf('O erro que custou caro') > 0 && /class="yt-grid"/.test(html));
  /* E o projeto continua SALVO: e por ele que se volta ao video depois de recarregar. */
  ok('o projeto foi salvo e conta na aba Meus projetos',
    /data-tab="projects"[^>]*>Meus projetos<span>1<\/span>/.test(html));
  b.aba('projects');
  html = b.html();
  ok('o projeto aparece no dashboard', /abcdefghijk/.test(html) || /O erro que custou caro/.test(html));
  const projectId = (html.match(/data-project-id="([^"]+)"/) || [])[1];
  ok('o card do projeto expõe o id', !!projectId);
  if (projectId) {
    /* Clica no card do projeto via delegação de clique da raiz (data-act="open-project"). */
    b.clique({ act: 'open-project', projectId: projectId });
  }
  await tick(); await tick();
  html = b.html();
  ok('abrir o projeto carrega os candidatos na aba YouTube', html.indexOf('O erro que custou caro') > 0);
  ok('o aviso de contexto do detector não é engolido', /Começa com/.test(html));
  /* A nota da analise sai da tela (decisao do usuario, 2026-10-01) e FICA no dado. */
  ok('a nota da análise nao aparece na tela, e continua guardada no projeto',
    !/sem legenda em pt-BR/.test(html) && /sem legenda em pt-BR/.test(b.store['pp_video_projects_v1'] || ''));

  // ---- a GRADE e compacta: nada de producao dentro dela ---------------------------------
  // Ate 2026-09-09 cada card carregava titulo editavel, card de marca, enquadramento,
  // legenda e dois botoes de render -- uma linha inteira por sugestao, e comparar dois
  // trechos exigia rolar a pagina. O pedido e explicito: "Do not place entire transcripts,
  // score breakdowns, framing selectors, subtitle settings, branded title-card presets, or
  // rendering controls in the grid." Estes checks sao o que impede a volta disso.
  ok('a grade nao tem seletor de enquadramento', html.indexOf('vop-reframe') < 0);
  ok('a grade nao tem seletor de card visual', html.indexOf('vop-cardstyle') < 0);
  ok('a grade nao tem controle de render', html.indexOf('data-act="yt-render"') < 0);
  ok('a grade nao tem a decomposicao da nota', html.indexOf('yt-factors') < 0);
  ok('a grade nao mostra nota numerica no card (nao e probabilidade de sucesso)',
    !/nota\s*\d/.test(html));
  ok('a grade e uma grade de verdade, nao uma lista de linhas', /class="yt-grid"/.test(html));

  // ---- miniatura 16:9, com play e duracao ----------------------------------------------
  // O id do candidato e uid('cand'), gerado na hora -- o teste o LE do card em vez de
  // adivinhar, senao o clique cairia em "trecho nao esta mais na lista" e o resto passaria
  // por engano.
  const clipId = (b.html().match(/data-clip="([^"]+)"/) || [])[1];
  ok('o card do trecho expoe o id que os botoes usam', !!clipId);
  ok('o card tem miniatura que abre a previa',
    /class="yt-thumb"[^>]*data-act="yt-preview"/.test(html));
  ok('com rotulo acessivel dizendo de que trecho e a previa',
    /aria-label="Ver prévia de/.test(html));
  ok('e a duracao do trecho na miniatura', /class="yt-dur"/.test(html));
  ok('nenhum player do YouTube e instanciado antes de pedir previa',
    html.indexOf('youtube.com/embed') < 0);
  // Sem storyboard no payload, a miniatura cai na capa do video -- e DIZ que e a capa, em
  // vez de passar a capa por quadro do trecho.
  ok('sem storyboard a miniatura e a capa, rotulada como tal',
    html.indexOf('Imagem do vídeo') > 0);

  // ---- o player e do SITE, e a previa e um SEEK nele ----------------------------------
  // MUDOU EM 2026-09-15 (decisao do usuario): a previa era um dialogo com `<iframe>` do
  // YouTube, e a tela de detalhe tinha outro embed. Agora existe UM player -- um `<video>`
  // da midia IMPORTADA -- e "Previa" arrasta esse player para o comeco do trecho. Nao e
  // esconder o logo: nao ha embed nenhum em lugar nenhum da tela.
  ok('nenhum embed do YouTube sobrou na tela', b.html().indexOf('youtube.com/embed') < 0);
  ok('e nenhum iframe', b.html().indexOf('<iframe') < 0);
  // Sem video importado a previa nao tem onde acontecer, e o clique nao pode derrubar a tela.
  b.clique({ act: 'yt-preview', id: clipId });
  ok('previa sem video importado nao derruba a tela', b.html().length > 500);

  // ---- baixar: o menu diz QUAL arquivo -------------------------------------------------
  // "Baixar" sozinho nao diz se sai o recorte cru ou o 9:16 editado, e entregar o arquivo
  // errado sob esse rotulo e o defeito que o pedido nomeia.
  b.clique({ act: 'yt-dl-menu', id: clipId });
  html = b.html();
  ok('o menu distingue trecho original de video editado',
    html.indexOf('Baixar trecho original') > 0 && html.indexOf('Baixar vídeo editado') > 0);
  ok('o botão de baixar o trecho existe', html.indexOf('data-act="yt-fetch"') > 0);
  ok('baixar o trecho está BLOQUEADO sem a declaração', /yt-fetch"[^>]* disabled/.test(html));
  ok('o motivo do bloqueio está à vista (BP-008)',
    /bloqueado: você ainda não declarou/.test(html));
  // Sem VIDEO IMPORTADO nao ha o que exportar -- e o motivo mudou junto com a arquitetura:
  // nao e mais "baixe o trecho original primeiro", e "importe o video".
  ok('o video editado nao e oferecido sem a fonte importada',
    /yt-render"[^>]* disabled/.test(html));
  ok('e o motivo escrito nele fala da IMPORTACAO, nao de baixar o trecho antes',
    /importe o vídeo|ainda não foi importado/i.test(html)
    && html.indexOf('baixe o trecho original primeiro') < 0);

  // ---- IMPORTAR o video inteiro: a fonte de todo corte --------------------------------
  // O fluxo pedido em 2026-09-15: cola o link, declara o direito, importa o video INTEIRO,
  // e a partir dai todo corte sai desse arquivo -- nenhum download por trecho.
  // Um dublê por ROTA: cada uma devolve o que o servidor devolveria, e o teste conta quantas
  // vezes cada uma foi chamada. E assim que "exportar dois cortes sem rebaixar o original"
  // deixa de ser promessa e passa a ser numero.
  const chamadas = {};
  global.fetch = function (rota, opcoes) {
    const caminho = String(rota).split('?')[0];
    chamadas[caminho] = (chamadas[caminho] || 0) + 1;
    chamadas['_ultima:' + caminho] = String(rota);
    // A fila automática de cortes (2026-09-23) também chama o /api/video-cut; a prévia do
    // editor é conferida pela última chamada DELA.
    if (/[?&]preview=1/.test(String(rota))) chamadas['_previa'] = String(rota);
    if (opcoes && opcoes.body && typeof opcoes.body === 'string') {
      chamadas['_corpo:' + caminho] = opcoes.body;
    }
    const cabecalhos = { get() { return null; } };
    if (caminho === '/api/yt-import' || caminho === '/api/yt-import-state') {
      // A fonte JA esta no disco: a rota volta pronta, sem rede. E o ramo que faz o segundo
      // corte (e o projeto reaberto amanha) nao rebaixarem nada.
      return Promise.resolve({ ok: true, headers: cabecalhos, json: () => Promise.resolve({
        state: 'ready', videoId: 'abcdefghijk', percent: 100, stage: 'preparando',
        sourceToken: 'abcdefghijk', sourceName: 'abcdefghijk.mp4',
        sourceUrl: '/sources/abcdefghijk.mp4', bytes: 2000000000,
        durationSec: 3600, width: 1920, height: 1080, hasAudio: true, error: ''
      }) });
    }
    if (caminho === '/api/clip-captions') {
      return Promise.resolve({ ok: true, headers: cabecalhos, json: () => Promise.resolve({
        state: 'ok',
        cues: [{ start: 0.0, end: 2.0, text: 'eu perdi [ __ ] mil reais' },
               { start: 2.0, end: 4.0, text: 'e foi o melhor negócio' }]
      }) });
    }
    if (caminho === '/api/legenda-geometria') {
      // Os numeros REAIS do `serve.legenda_geometria` para uma fonte 1920x1080 (medidos
      // chamando o Python; a paridade de verdade e provada no test_serve, secao 35).
      const corpo = JSON.parse(opcoes.body);
      const tabela = { blur: [608, 656, 705, 63], crop11: [1080, 420, 506, 74],
        crop45: [1350, 285, 393, 80], crop: [1920, 0, 269, 86] }[corpo.reframe];
      const leg = corpo.edit.legenda;
      const largura = leg.largura || 820;
      return Promise.resolve({ ok: true, headers: cabecalhos, json: () => Promise.resolve({
        reframe: corpo.reframe, videoAltura: tabela[0], alturaMedida: true, bandaAltura: tabela[1],
        legendaBase: leg.posicaoPct !== undefined ? Math.round(1920 - 1920 * Math.min(97, Math.max(10, leg.posicaoPct)) / 100) : tabela[2],
        legendaBaseAuto: tabela[2], posicaoAutoPct: tabela[3], faixaPosicao: [10, 97],
        // 2026-09-28: coluna elastica. Com X manual perto da borda o servidor devolve a
        // coluna estreitada (aqui: 352 em X <= 20) e diz que estreitou.
        legendaLargura: leg.posicaoXPct !== undefined && (leg.posicaoXPct <= 20 || leg.posicaoXPct >= 80) ? 352 : largura,
        legendaLarguraMax: largura, legendaEsquerda: (1080 - largura) / 2,
        legendaPiso: 263, palavraPiso: 'negócio',
        faixaPosicaoX: largura >= 1000 ? null : [16, 84],
        zonas: { trilhaX: 930, rodapeY: 1651 },
        avisos: { trilha: leg.posicaoXPct >= 80, rodape: leg.posicaoPct > 86,
          estreitou: leg.posicaoXPct !== undefined && (leg.posicaoXPct <= 20 || leg.posicaoXPct >= 80) },
        // As paginas vem das falas do corpo (a paridade com o toCaptionPages e o 14n do
        // test_captions); aqui uma por fala basta para a tela.
        paginas: (corpo.cues || []).filter(c => c.text).map(c => ({ start: c.start, end: c.end, text: c.text })),
        grampeado: { posicaoPct: null, posicaoXPct: null }, fundoUrl: '/sources/abcdefghijk.webp'
      }) });
    }
    // /api/video-cut e /api/remotion-render devolvem MP4, nao JSON.
    return Promise.resolve({
      ok: true, headers: cabecalhos,
      blob: () => Promise.resolve({ size: 4096 }),
      json: () => Promise.resolve({})
    });
  };

  // Declarar a autorização é o portão de baixar mídia: ela libera a IMPORTAÇÃO.
  b.muda('[data-yt-rights]', { checked: true });
  await tick(); await tick();
  html = b.html();
  ok('com a declaração o aviso de bloqueio sai', !/bloqueado: você ainda não declarou/.test(html));
  // Marcar a caixa RELIGA a fonte que já está no disco, sem baixar nada: é o caminho do
  // projeto reaberto (a declaração morre com a sessão, o arquivo não).
  ok('declarar religa a fonte do disco pela rota de estado',
    chamadas['/api/yt-import-state'] === 1);
  ok('o player interno da midia importada esta na tela',
    /<video[^>]*data-src-video/.test(html) && html.indexOf('/sources/abcdefghijk.mp4') > 0);
  ok('com controles de play, pausa e volume', /data-src-video[^>]*controls/.test(html));
  ok('e ainda nenhum embed de terceiro', html.indexOf('youtube.com/embed') < 0);
  ok('a faixa de estado confirma que o video esta pronto',
    /data-state="ready"/.test(html));
  ok('a tela diz que todo corte sai deste arquivo',
    /nada é baixado de novo|sem baixar o original de novo/i.test(html));

  // O botão principal fala de IMPORTAR, não de "Analisar" (o rótulo antigo descrevia o passo
  // que já não é o primeiro).
  ok('a acao principal da tela e importar o video',
    html.indexOf('data-act="yt-import"') > 0 && />Iniciar<\/button>/.test(html));   // rótulo pedido em 2026-09-23
  // E ele PASSA pelo portão: a rota de importação é a que baixa mídia.
  b.clique({ act: 'yt-import' });
  await tick(); await tick();
  ok('o botao principal chama /api/yt-import', chamadas['/api/yt-import'] === 1);
  ok('e a fonte segue pronta (a rota e idempotente: arquivo no disco volta pronto)',
    /<video[^>]*data-src-video/.test(b.html()));

  // ---- previa = SEEK no player interno ------------------------------------------------
  b.video.currentTime = 0;
  b.video._tocou = 0;
  b.clique({ act: 'yt-preview', id: clipId });
  ok('Previa leva o player da fonte para o comeco do trecho', b.video.currentTime === 600);
  ok('e manda tocar', b.video._tocou === 1);

  // ---- marcar trecho A MAO, em qualquer ponto da duracao ------------------------------
  // "I can navigate through the entire duration of the video and manually define a clip."
  b.video.currentTime = 2400;              // 40:00, longe de qualquer sugestao
  b.clique({ act: 'yt-manual' });
  await tick();
  html = b.html();
  ok('marcar daqui cria um trecho no ponto em que o video esta',
    html.indexOf('Trecho de 40:00') > 0);
  ok('e ele abre direto no editor', /class="yt-detail"/.test(html));
  ok('com a borda marcada como MANUAL no dado, sem frase na tela',
    /"boundary":"manual"/.test(b.store['pp_video_projects_v1'] || '') && !/ajustadas por você/.test(html));
  // O trecho manual e persistido junto do projeto: recarregar nao o perde.
  ok('o trecho manual entrou no projeto salvo',
    (b.store['pp_video_projects_v1'] || '').indexOf('Trecho de 40:00') > 0);
  b.clique({ act: 'yt-back' });

  // ---- "daqui" move a borda de um trecho recomendado ----------------------------------
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  b.video.currentTime = 12.4; // tempo relativo ao início 600s
  b.clique({ act: 'yt-mark', id: clipId, edge: 'in' });
  await tick();
  html = b.html();
  ok('"daqui" move o comeco para onde o player esta, em segundo inteiro',
    html.indexOf('value="10:12"') > 0);
  b.video.currentTime = 20.8; // agora relativo ao início 612s
  b.clique({ act: 'yt-mark', id: clipId, edge: 'out' });
  await tick();
  html = b.html();
  ok('e o fim tambem, arredondando para fora (nunca comendo fala)',
    html.indexOf('value="10:33"') > 0);
  b.clique({ act: 'yt-back' });
  html = b.html();

  // Os controles de producao vivem na TELA DE DETALHE. `Editar` e a acao primaria do card,
  // e e ela que abre esta tela com o trecho, as bordas e as escolhas salvas.
  ok('o card tem Editar como acao primaria',
    /class="vop-btn vop-btn-primary"[^>]*data-act="yt-open"/.test(html));
  b.clique({ act: 'yt-open', id: clipId });
  // Reabrir o MESMO corte reaproveita a prévia pronta ("não recodifica"), então aqui ela
  // pode já estar pronta. O que não pode é o editor mostrar o original INTEIRO.
  ok('enquanto prepara o corte o editor nao exibe o original inteiro',
    (/Preparando apenas o trecho/.test(b.html()) || /data-src-video[^>]*src="blob:fake"/.test(b.html()))
    && !/data-src-video[^>]*src="\/sources\//.test(b.html()));
  await tick(); await tick();
  html = b.html();
  ok('a previa usa o arquivo recortado com tempo relativo e intervalo rotulado',
    /src="blob:fake"/.test(html) && /data-src-offset="612"/.test(html)
    && /class="yt-trim-dur">0:21</.test(html));
  ok('o pedido da previa usa o intervalo escolhido e nao exporta arquivo permanente',
    /start=612&end=633&profile=horizontal&preview=1/.test(chamadas['_previa']));
  ok('Editar abre a tela de detalhe do trecho', /class="yt-detail"/.test(html));
  ok('com o caminho de volta para a grade', html.indexOf('data-act="yt-back"') > 0);

  /* ---- fluxo em etapas (decisao do usuario, 2026-10-05) --------------------------------
     Marcar trecho -> Editar video -> Baixar video editado -> Criar capa. Comeco/fim moram SO
     em "Marcar trecho"; a capa so abre depois do clique que comecou o download editado. */
  ok('o corte abre em Marcar trecho, com comeco/fim, remocoes e "Marcar trecho daqui"',
    /data-act="yt-etapa"[^>]*data-etapa="trecho" aria-current="step"/.test(html)
    && html.indexOf('class="yt-trim"') > 0 && html.indexOf('data-act="yt-manual"') > 0
    && html.indexOf('data-yt-tool') < 0 && html.indexOf('data-act="yt-dl-menu"') < 0);
  ok('Criar capa nasce travada', /data-etapa="capa" disabled/.test(html));
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'capa' });
  ok('e clicar nela travada nao muda de etapa', /data-etapa="trecho" aria-current="step"/.test(b.html()));
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'editar' });
  html = b.html();
  ok('Editar video mostra as ferramentas, sem Corte nem Capa na barra e sem borda do corte',
    /data-etapa="editar" aria-current="step"/.test(html) && html.indexOf('data-yt-tool') > 0
    && !/data-yt-tool[^>]*value="(corte|capa)"/.test(html)
    && html.indexOf('class="yt-trim"') < 0 && html.indexOf('data-act="yt-nudge"') < 0
    && html.indexOf('data-capa-painel') < 0);

  /* ---- a BANCADA de duas colunas (2026-09-22, decisao do usuario) ----------------------
     Ate esta entrega o player era uma faixa de largura inteira no ALTO da tela e a coluna
     esquerda do editor guardava texto -- com um paragrafo mandando olhar "o player acima".
     Ajustar a borda de um corte era olhar para um lugar e mexer em outro. Agora o video
     abre NA esquerda, ao lado dos controles que o mudam. */
  ok('o video abre na coluna da ESQUERDA do editor',
    /<video[^>]*data-src-video/.test(colunaEsquerda(html)));
  ok('e os controles de producao ficam na DIREITA, nao junto do video',
    colunaEsquerda(html).indexOf('data-act="yt-render"') < 0
    && colunaEsquerda(html).indexOf('vop-cardstyle') < 0
    && html.indexOf('class="yt-detail-side"') > 0);
  ok('continua havendo UM player na tela (dois decodes do mesmo arquivo de 2 GB, nunca)',
    (html.match(/data-src-video/g) || []).length === 1);
  ok('e o paragrafo que mandava olhar "o player acima" saiu, porque virou mentira',
    html.indexOf('yt-detail-onde') < 0 && html.indexOf('A prévia é o player acima') < 0);
  ok('o titulo do trecho continua editavel e ligado ao campo que grava, agora na barra de cima',
    /class="yt-detail-title"[^>]*data-clip-field="topic"/.test(html.slice(html.indexOf('class="yt-detail-top"'), html.indexOf('class="yt-detail-grid"'))));
  /* O texto do detector desceu para um `<details>` fechado: ele explica por que a sugestao
     existe, e isso se le uma vez -- aberto, empurrava o video para baixo. Continua NA tela
     (os checks de conteudo abaixo leem dele), so nao compete mais com o player. */
  ok('o texto do detector mora na ferramenta Analise, fora da coluna do video',
    /data-tool="analise"[\s\S]*yt-detail-reason/.test(html) && colunaEsquerda(html).indexOf('yt-detail-reason') < 0
    && html.indexOf('<details class="yt-detail-sobre"') < 0);

  /* O player muda de LUGAR no DOM, e isso nao pode custar a reproducao: o `srcAdopt` tem de
     continuar achando o no vivo dentro da raiz e reencaixando-o na posicao nova, na MESMA
     tarefa sincrona do innerHTML. Re-render que recria o player volta ao segundo zero. */
  b.video.currentTime = 5;
  b.video._readotado = 0;
  b.muda('[data-yt-rights]', { checked: true });     // re-render sem mudar estado nenhum
  html = b.html();
  ok('o player e READOTADO na posicao nova, nao recriado', b.video._readotado === 1);
  ok('a posicao de reproducao sobrevive ao re-render dentro do editor',
    b.video.currentTime === 5);
  ok('e ele continua na coluna da esquerda depois do re-render',
    /<video[^>]*data-src-video/.test(colunaEsquerda(html)));
  /* Editor sem frase (decisao do usuario, 2026-10-01): a origem da borda continua no DADO
     do corte, mas a tela nao a escreve mais. */
  ok('a tela de detalhe nao escreve de onde vem a borda',
    !/class="yt-detail-boundary"/.test(html));
  ok('o sinal medido é mostrado com nome legível', html.indexOf('Mais reproduzidos') > 0);
  ok('a decomposicao da nota fica na Analise, sob o titulo de nota interna (so ordena a lista)',
    /data-tool="analise"[\s\S]*class="yt-factors"/.test(html) && html.indexOf('Nota interna (só ordena a lista)') > 0);
  ok('o texto da legenda fica À VISTA, sem botão para abrir',
    html.indexOf('data-cap-panel') > 0 && html.indexOf('data-act="yt-cap"') < 0);
  ok('texto e aparência são subabas da Legenda, com o texto primeiro',
    /data-leg-aba-painel="texto">[\s\S]*>Texto da legenda</.test(html)
    && html.indexOf('data-leg-aba-painel="texto"') < html.indexOf('data-leg-aba-painel="estilo"'));
  ok('e o export editado mora no menu Baixar da barra de cima', html.indexOf('data-act="yt-dl-menu"') > 0);
  ok('o botao de render nao expoe o nome do renderizador ao operador',
    html.indexOf('Remotion') < 0);

  // O painel MANUAL da legenda. O que se cobra aqui e o que o `node --check` nao pega: que
  // o construtor roda de verdade dentro do render, que TODO controle chega a tela e que um
  // automatico nao e desenhado igual a um ajuste (BP-008).
  ok('o painel manual da legenda aparece na tela de detalhe',
    html.indexOf('class="vop-leg"') > 0 && html.indexOf('data-act="leg-reset"') > 0);
  ok('sem ajuste nenhum, nenhuma linha acende e nenhuma frase de estado aparece',
    html.indexOf('data-manual="1"') < 0 && html.indexOf('data-leg-state') < 0
    && html.indexOf('tudo no automático') < 0);
  ['familia', 'tamanho', 'caixaAlta', 'cor', 'destaqueCor', 'contorno', 'fundo', 'largura',
    'alinhamento', 'posicaoPct', 'posicaoXPct', 'profundidade', 'profundidadeDirecao'].forEach(chave => {
    ok('o controle ' + chave + ' esta na tela',
      html.indexOf('data-leg-row="' + chave + '"') > 0);
  });
  ok('cada controle tem o seu proprio botao de voltar ao automatico',
    (html.match(/data-act="leg-auto"/g) || []).length === 13);
  ok('o estilo mora no painel, em cartoes com amostra (um seletor so, nao dois)',
    (html.match(/class="vop-leg-look"/g) || []).length === 6
    && (html.match(/data-clip-field="legendaStyle"/g) || []).length === 6);
  ok('cada parte da legenda tem a sua subaba, e "Escolher cada cor" segue recolhido',
    /data-leg-aba-painel="estilo">[\s\S]*data-leg-combo/.test(html)
    && /data-leg-aba-painel="avancado">[\s\S]*data-leg-field="familia"/.test(html)
    && html.indexOf('<details class="vop-leg-mais">') > 0 && html.indexOf('Ajustes avançados') < 0);
  // Radio NATIVO, como o resto da tela: o `:checked` desenha o estado e nao ha JS de estado
  // visual para dessincronizar do dado.
  ok('os segmentos sao radios nativos, com o valor de hoje ja marcado',
    /data-leg-field="familia"[^>]*value="inter"[^>]*checked/.test(html));
  ok('o corpo mostra o numero que o automatico usaria, e nao um zero',
    /data-leg-field="tamanho"[^>]*value="58"/.test(html)
    || /value="58"[^>]*data-leg-field="tamanho"/.test(html));
  ok('cada cor tem paleta curada E a cor personalizada ao lado',
    (html.match(/data-leg-field="cor"/g) || []).length === 5
    && (html.match(/type="color"/g) || []).length === 4);
  ok('o quadro real e oferecido pelo botao, sem frase de aproximacao',
    html.indexOf('data-act="leg-still"') > 0 && !/aproxima/i.test(html));
  ok('o download rapido continua oferecido, sem paragrafo ao lado, e o contrato ASS_NAO_REPRODUZ fica no arquivo',
    html.indexOf('data-act="yt-dl-menu"') > 0 && html.indexOf('vop-leg-ass') < 0
    && /var ASS_NAO_REPRODUZ = \[/.test(FONTE_OPS));

  /* ---- Editor sem texto (decisao do usuario, 2026-10-01) -------------------------------
     "nada, nem aviso": nomes, valores e o estado do proprio controle. Toda classe que so
     carregava frase sai do editor -- e as frases que os testes do servidor LEEM continuam
     no arquivo (contratos). */
  const SEM_FRASE = ['yt-analysis-note', 'yt-trim-note', 'yt-detail-boundary', 'vop-leg-ass',
    'vop-warning', 'yt-stage-note', 'yt-stage-tag', 'yt-imp-note', 'vop-leg-prev-nota',
    'vop-leg-state', 'vop-leg-nota', 'vop-leg-dica', 'vop-leg-still-msg', 'vop-leg-auto-note',
    'vop-cap-note', 'vop-cap-hint', 'vop-cap-foot', 'vop-cap-save', 'vop-card-state',
    'vop-reframe-aviso', 'vop-capa-resumo', 'vop-capa-dica', 'vop-capa-aviso', 'vop-cards-help',
    'vop-cards-vazio', 'yt-src-fundo-rot', 'vop-capa-rot'];
  const semFrase = h => SEM_FRASE.filter(c => new RegExp('class="[^"]*\\b' + c + '\\b').test(h));
  ok('nenhuma classe de frase renderiza no editor: ' + semFrase(html).join(','),
    semFrase(html).length === 0);
  ok('e nenhum title explica motivo',
    !/title="(Esta fala|Arraste|Voltar ao automático do estilo|Voltar este controle)/.test(html));
  b.clique({ act: 'cards-open' });
  ok('nem a biblioteca de cards aberta traz frase: ' + semFrase(b.html()).join(','),
    semFrase(b.html()).length === 0 && b.html().indexOf('data-card-msg') < 0);
  b.clique({ act: 'cards-close' });
  ['CAPTIONS_MSG', 'IMPORT_MSG', 'MUSICA_MSG', 'MUSICA_IMPORT_MSG', 'CAP_MSG'].forEach(nome => {
    ok('o contrato ' + nome + ' continua no arquivo', new RegExp('var ' + nome + ' = \\{').test(FONTE_OPS));
  });
  ok('e o backgroundMessage tambem', /function backgroundMessage\(/.test(FONTE_OPS));
  b.toastLimpa();
  b.clique({ act: 'yt-mark', id: 'nao-existe', edge: 'in' });
  ok('com o editor aberto, nenhum toast aparece', b.toastTexto() === '');
  /* Falha de export: sem toast e sem frase, o PROPRIO controle diz que falhou, e so ele. */
  const fetchOk = global.fetch;
  global.fetch = function (rota, opcoes) {
    if (/\/api\/(remotion-render|video-cut)/.test(String(rota)) && !/preview=1/.test(String(rota))) {
      return Promise.resolve({ ok: false, status: 500, headers: { get() { return null; } },
        json: () => Promise.resolve({ error: 'quebrou' }), text: () => Promise.resolve('quebrou') });
    }
    return fetchOk(rota, opcoes);
  };
  b.clique({ act: 'yt-render', id: clipId });
  await tick(); await tick(); await tick(); await tick();
  b.clique({ act: 'yt-dl-menu', id: clipId });
  html = b.html();
  ok('export editado que falha vira "Falhou · tentar de novo" no gatilho e no proprio item, e so nele',
    /yt-dl-trigger[^>]*><span data-export-rotulo>Falhou · tentar de novo</.test(html)
    && /data-act="yt-render"[^>]*>Falhou · tentar de novo</.test(html)
    && !/data-act="yt-render-limpo"[^>]*>Falhou/.test(html) && !/data-act="yt-fetch"[^>]*>Falhou/.test(html)
    && b.toastTexto() === '');
  b.clique({ act: 'yt-fetch', id: clipId });
  await tick(); await tick(); await tick(); await tick();
  if (b.html().indexOf('role="menu"') < 0) b.clique({ act: 'yt-dl-menu', id: clipId });
  html = b.html();
  ok('o trecho original que falha tambem diz no proprio botao',
    /data-act="yt-fetch"[^>]*>Falhou · tentar de novo</.test(html));
  if (b.html().indexOf('role="menu"') > 0) b.clique({ act: 'yt-dl-menu', id: clipId });
  global.fetch = fetchOk;
  /* Campos que gravam NO LUGAR (sem re-render): a recusa marca o proprio campo. */
  const marcaAttr = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  /* (antes de mexer na borda: mudar a borda descarta as falas do intervalo) */
  const horaRuim = b.muda('[data-cap-field]', Object.assign({ dataset: { id: clipId, capIndex: '0', capTime: 'end' }, value: '-5' }, marcaAttr, { attrs: {} }));
  ok('horario de frase recusado acende aria-invalid no proprio campo',
    horaRuim.attrs['aria-invalid'] === 'true');
  /* Tempo recusado (começo depois do fim): os campos do corte acendem aria-invalid. */
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'trecho' }); // a borda mora em "Marcar trecho" (2026-10-05)
  const tAntes = b.video.currentTime;
  b.video.currentTime = 99999;
  b.clique({ act: 'yt-mark', id: clipId, edge: 'in' });
  ok('borda recusada acende aria-invalid nos campos de tempo, sem frase',
    /data-trim="in"[^>]*aria-invalid="true"/.test(b.html()) && /data-trim="out"[^>]*aria-invalid="true"/.test(b.html()));
  b.video.currentTime = tAntes;
  b.clique({ act: 'yt-nudge', id: clipId, edge: 'out', delta: '1' });
  b.clique({ act: 'yt-nudge', id: clipId, edge: 'out', delta: '-1' });
  ok('e a proxima borda aceita apaga o aria-invalid', !/data-trim="in"[^>]*aria-invalid/.test(b.html()));
  const inicioRuim = b.muda('[data-mus-field]', Object.assign({ dataset: { musField: 'inicio', id: clipId }, value: 'abc' }, marcaAttr, { attrs: {} }));
  ok('inicio da musica que nao e tempo acende aria-invalid no proprio campo',
    inicioRuim.attrs['aria-invalid'] === 'true');
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'editar' });
  ok('Baixar aparece em Editar video', b.html().indexOf('data-act="yt-dl-menu"') > 0);
  b.clique({ act: 'yt-dl-menu', id: clipId });
  b.clique({ act: 'yt-render', id: clipId });
  html = b.html();
  ok('clicar em "Baixar video editado" libera e abre Criar capa, com o painel da capa e sem a barra',
    /data-etapa="capa" aria-current="step"/.test(html) && !/data-etapa="capa" disabled/.test(html)
    && html.indexOf('data-capa-painel') > 0 && html.indexOf('data-yt-tool') < 0
    && html.indexOf('class="yt-trim"') < 0 && html.indexOf('role="menu"') < 0);
  await tick(); await tick(); await tick(); await tick();
  ok('a capa continua aberta quando o render termina', /data-etapa="capa" aria-current="step"/.test(b.html()));
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'editar' });
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'capa' });
  ok('e depois de liberada a capa se abre de novo pela etapa', /data-etapa="capa" aria-current="step"/.test(b.html()));
  /* Achado no Chrome (2026-10-01): o export comeca SEM re-render, e o gatilho do menu ficava
     dizendo "Baixar" durante minutos de render. O rotulo dele e repintado no lugar. */
  const rotuloVivo = fakeEl(); rotuloVivo.textContent = 'Baixar';
  const qsRotulo = b.root.querySelector;
  b.root.querySelector = sel => sel === '[data-export-rotulo]' ? rotuloVivo : qsRotulo.call(b.root, sel);
  const fetchAntes = global.fetch;
  let soltaRender = null;
  global.fetch = (rota, opcoes) => /remotion-render/.test(String(rota))
    ? new Promise((ok_, falha) => { soltaRender = falha; }) : fetchAntes(rota, opcoes);
  b.clique({ act: 'yt-render', id: clipId });
  await tick();
  ok('comecar o export repinta o gatilho do menu como "Renderizando…" no lugar', rotuloVivo.textContent === 'Renderizando…');
  b.root.querySelector = qsRotulo;
  global.fetch = fetchAntes;
  if (soltaRender) soltaRender(new Error('cancelado pelo teste'));
  for (let k = 0; k < 6; k++) await tick();
  b.clique({ act: 'yt-render', id: clipId }); // e agora o servidor responde
  for (let k = 0; k < 6; k++) await tick();
  ok('tentar de novo e dar certo devolve o rotulo normal',
    /data-act="yt-render"[^>]*>Baixar vídeo editado</.test(b.html()) || /yt-dl-trigger[^>]*><span data-export-rotulo>Baixar</.test(b.html()));

  /* ---- Editor em FERRAMENTAS (decisao do usuario, 2026-10-01) ---------------------------
     Barra fixa entre o video e o painel; clicar numa ferramenta mostra so os controles dela.
     Radio nativo + CSS: trocar de ferramenta nao chama render(). Corte e Capa viraram as
     etapas Marcar trecho / Criar capa (2026-10-05). */
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'editar' });
  html = b.html();
  const ORDEM = ['enquadrar', 'legenda', 'card', 'texto', 'zoom', 'musica', 'analise'];
  const barra = h => (h.match(/data-yt-tool[^>]*value="([a-z]+)"/g) || []).map(t => /value="([a-z]+)"/.exec(t)[1]);
  ok('a barra lista as ferramentas na ordem, com Analise porque este corte tem o que mostrar: ' + barra(html).join(','),
    barra(html).join(',') === ORDEM.join(','));
  ok('um painel por ferramenta, todos no DOM',
    ORDEM.every(t => (html.match(new RegExp('class="yt-tool" data-tool="' + t + '"', 'g')) || []).length === 1));
  ok('na primeira abertura da sessao a ferramenta marcada e a primeira da barra (Enquadrar)',
    /data-yt-tool[^>]*value="enquadrar" checked/.test(html) && (html.match(/data-yt-tool[^>]*checked/g) || []).length === 1);
  const cssOps = require('fs').readFileSync(path.join(__dirname, 'video-ops.css'), 'utf8');
  ok('o CSS tem a regra de visibilidade de CADA ferramenta',
    ORDEM.every(t => new RegExp('value="' + t + '"\\]:checked\\)[^{]*\\[data-tool="' + t + '"\\]').test(cssOps)));
  const topo = h => h.slice(h.indexOf('class="yt-detail-top"'), h.indexOf('class="yt-detail-grid"'));
  ok('o titulo e o menu de exportar moram na barra de cima',
    /class="yt-detail-title"[^>]*data-clip-field="topic"/.test(topo(html)) && topo(html).indexOf('data-act="yt-dl-menu"') > 0
    && html.indexOf('class="yt-detail-acts"') < 0);
  b.clique({ act: 'yt-dl-menu', id: clipId });
  ok('o menu de exportar tem os tres destinos, com nome e sem descricao',
    ['yt-render', 'yt-fetch', 'yt-render-limpo'].every(a => topo(b.html()).indexOf('data-act="' + a + '"') > 0)
    && topo(b.html()).indexOf('<small>') < 0);
  b.clique({ act: 'yt-dl-menu', id: clipId });
  ok('a biblioteca de cards nao mora mais abaixo do editor', b.html().indexOf('data-cards') < 0);
  // Trocar de ferramenta: so o radio muda; o DOM (e com ele o <video> e o <audio>) fica.
  b.ops.MUS.lista = [{ id: 'fedcba9876543210', nome: 'Faixa', durationSec: 120, lufs: -16, ext: '.mp3', url: '/musicas/fedcba9876543210.mp3' }];
  b.ops.MUS.estado = 'pronta';
  b.muda('[data-mus-field]', { dataset: { musField: 'id', id: clipId }, value: 'fedcba9876543210' });
  const antesTroca = b.html();
  b.video.currentTime = 7;
  const readotadoAntes = b.video._readotado || 0;
  b.muda('[data-yt-tool]', { dataset: { id: clipId }, value: 'legenda' });
  ok('trocar de ferramenta nao chama render(): o DOM, o <video>, o <audio> e o instante ficam',
    b.html() === antesTroca && b.video.currentTime === 7 && (b.video._readotado || 0) === readotadoAntes
    && /<audio[^>]*data-mus-audio/.test(antesTroca));
  b.muda('[data-leg-aba]', { dataset: { id: clipId }, value: 'posicao' });
  ok('a subaba da Legenda tambem troca sem render()', b.html() === antesTroca);
  b.muda('[data-yt-rights]', { checked: true }); // re-render sem mudar estado
  html = b.html();
  ok('a ferramenta e a subaba escolhidas sobrevivem ao re-render',
    /data-yt-tool[^>]*value="legenda" checked/.test(html) && /data-leg-aba[^>]*value="posicao" checked/.test(html));
  ok('a Legenda tem as cinco subabas, Texto primeiro',
    (html.match(/data-leg-aba[^>]*value="([a-z]+)"/g) || []).map(t => /value="([a-z]+)"/.exec(t)[1]).join(',')
    === 'texto,estilo,posicao,profundidade,avancado');
  ok('continua havendo UM <video> no editor em ferramentas', (html.match(/data-src-video/g) || []).length === 1);
  // BP-013: o corpo do painel rola; render() devolve a rolagem.
  const corpoVelho = fakeEl(); corpoVelho.scrollTop = 140;
  const corpoNovo = fakeEl(); corpoNovo.scrollTop = 0;
  const qsPainel = b.root.querySelector;
  let servidos = 0;
  b.root.querySelector = sel => sel === '[data-tool-body]' ? (servidos++ ? corpoNovo : corpoVelho) : qsPainel.call(b.root, sel);
  b.clique({ act: 'yt-dl-menu', id: clipId });
  b.root.querySelector = qsPainel;
  ok('o scrollTop do painel sobrevive ao render()', corpoNovo.scrollTop === 140);
  b.clique({ act: 'yt-dl-menu', id: clipId });
  b.muda('[data-yt-tool]', { dataset: { id: clipId }, value: 'card' });
  b.clique({ act: 'cards-open' });
  html = b.html();
  const painelCard = html.slice(html.indexOf('data-tool="card"'), html.indexOf('data-tool="texto"'));
  ok('"Gerenciar cards" abre a biblioteca DENTRO da ferramenta Card, com Voltar',
    painelCard.indexOf('data-cards') > 0 && /data-act="cards-close"[^>]*>Voltar</.test(painelCard));
  b.clique({ act: 'cards-close' });
  html = b.html();
  const painelAnalise = html.slice(html.indexOf('data-tool="analise"'));
  ok('a Analise junta motivo, sinais e a nota, sob o titulo "Nota interna (só ordena a lista)"',
    painelAnalise.indexOf('yt-detail-reason') > 0 && painelAnalise.indexOf('yt-factor-name') > 0
    && painelAnalise.indexOf('Nota interna (só ordena a lista)') > 0 && html.indexOf('<details class="yt-detail-sobre"') < 0);
  b.clique({ act: 'yt-back' });
  const outroId = ((b.html().match(/data-act="yt-open" data-id="([^"]+)"/g) || [])
    .map(t => /data-id="([^"]+)"/.exec(t)[1]).filter(i => i !== clipId))[0];
  b.clique({ act: 'yt-open', id: outroId });
  b.clique({ act: 'yt-etapa', id: outroId, etapa: 'editar' });
  ok('abrir OUTRO corte mantem a ultima ferramenta usada', /data-yt-tool[^>]*value="card" checked/.test(b.html()));
  b.muda('[data-yt-tool]', { dataset: { id: outroId }, value: 'enquadrar' });
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick(); await tick(); // a previa do corte (uma por vez) volta a ficar pronta
  b.muda('[data-mus-field]', { dataset: { musField: 'id', id: clipId }, value: '' });
  b.muda('[data-leg-aba]', { dataset: { id: clipId }, value: 'texto' });
  b.ops.MUS.lista = null; b.ops.MUS.estado = 'nunca';
  b.clique({ act: 'yt-back' });
  ok('a nota da analise e a nota da importacao tambem nao aparecem na grade',
    b.html().indexOf('yt-analysis-note') < 0 && b.html().indexOf('yt-imp-note') < 0
    && b.html().indexOf('sem legenda em pt-BR') < 0);
  b.toastLimpa();
  b.clique({ act: 'yt-preview', id: 'nao-existe' });
  ok('fora do editor o toast continua aparecendo', b.toastTexto() !== '');
  b.clique({ act: 'yt-open', id: clipId });
  html = b.html();

  // Ajustar um controle marca a LINHA dele, e so ela. A escrita NAO re-renderiza (o slider
  // morreria no meio do arrasto), entao o teste reabre a tela para ver o HTML novo -- que e
  // tambem a prova de que o ajuste sobreviveu ao armazenamento.
  b.muda('[data-leg-field]', { dataset: { legField: 'tamanho', id: clipId }, value: '84' });
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  html = b.html();
  ok('ajustar o corpo marca a linha como manual, e so ela',
    html.indexOf('data-leg-row="tamanho" data-manual="1"') > 0
    && (html.match(/data-manual="1"/g) || []).length === 1);
  ok('e o estado do ajuste mora no controle: o ↺ dele e o "Voltar ao padrão" habilitam',
    /data-act="leg-auto" data-id="[^"]*" data-key="tamanho" aria-label/.test(html)
    && !/data-act="leg-reset"[^>]*disabled/.test(html) && html.indexOf('ajuste seu') < 0);
  ok('o controle passa a mostrar o valor escolhido, nao o do estilo',
    /data-leg-field="tamanho"[^>]*aria-label/.test(html) && html.indexOf('value="84"') > 0);
  b.clique({ act: 'leg-auto', id: clipId, key: 'tamanho' });
  html = b.html();
  ok('o botao auto devolve o controle ao automatico',
    html.indexOf('data-manual="1"') < 0 && /data-act="leg-reset"[^>]*disabled/.test(html));
  b.clique({ act: 'leg-posicao', id: clipId });
  html = b.html();
  ok('assumir a posicao vertical troca o aviso por um slider',
    html.indexOf('data-leg-field="posicaoPct"') > 0
    && html.indexOf('data-act="leg-posicao"') < 0);
  b.clique({ act: 'leg-auto', id: clipId, key: 'posicaoPct' });
  html = b.html();
  ok('e voltar ao automatico devolve o aviso no lugar do slider',
    html.indexOf('data-act="leg-posicao"') > 0
    && html.indexOf('data-leg-field="posicaoPct"') < 0);
  // Trocar o ESTILO tem de repintar o painel: ele mostra o numero que o automatico usaria,
  // e quem decide esse numero e o estilo. Sem isto o slider fica no corpo do estilo anterior
  // -- automacao mentindo sobre o que vai sair (BP-008 ao contrario).
  b.muda('[data-clip-field]', { dataset: { clipField: 'legendaStyle', id: clipId },
    value: 'impacto' });
  html = b.html();
  ok('trocar o estilo repinta o painel com os automaticos do estilo novo',
    html.indexOf('value="72"') > 0 && html.indexOf('value="58"') < 0);
  ok('e o radio da familia acompanha, sem virar ajuste manual',
    /data-leg-field="familia"[^>]*value="montserrat"[^>]*checked/.test(html)
    && html.indexOf('data-manual="1"') < 0);

  // O FLUXO INTEIRO pedido: escolher um estilo pronto, personalizar (combinacao + cor livre),
  // mover a legenda ARRASTANDO na previa, salvar, reabrir e exportar.
  b.muda('[data-clip-field]', { dataset: { clipField: 'legendaStyle', id: clipId },
    value: 'podcast' });
  html = b.html();
  ok('fluxo 1: escolher o estilo Contorno marca o cartao e veste a previa',
    /value="podcast" checked/.test(html) && html.indexOf('--leg-contorno:#000000') > 0);
  b.muda('[data-leg-combo]', { dataset: { id: clipId }, value: '1' }); // Branco e coral
  b.muda('[data-leg-field]', { dataset: { legField: 'fundo', id: clipId }, value: '#1e3a8a' });
  b.muda('[data-leg-field]', { dataset: { legField: 'tamanho', id: clipId }, value: '80' });
  await tick(); await tick(); // a geometria do corte (servidor) chega
  html = b.html();
  ok('fluxo 1b: o player abre em "Como sai 9:16", com UM <video> da fonte so',
    /data-src-modo value="saida" checked/.test(html) && html.indexOf('data-modo="saida"') > 0
    && (html.match(/data-src-video/g) || []).length === 1
    && html.indexOf('--geo-video:608') > 0 && html.indexOf('--leg-base:705') > 0);
  // Trocar de modo NAO re-renderiza: so o atributo do palco muda (o <video> e o mesmo no).
  const palcoVivo = fakeEl(); palcoVivo.dataset.modo = 'saida';
  const notaViva = fakeEl();
  const qsAntes = b.root.querySelector;
  b.root.querySelector = sel => sel === '[data-src-stage]' ? palcoVivo
    : sel === '[data-src-modo-nota]' ? notaViva : qsAntes.call(b.root, sel);
  const htmlAntesModo = b.html();
  b.muda('[data-src-modo]', { value: 'original' });
  ok('fluxo 1c: "Original 16:9" troca so o atributo, sem nota escrita ao lado do player',
    palcoVivo.dataset.modo === 'original' && notaViva.innerHTML === ''
    && b.html() === htmlAntesModo && htmlAntesModo.indexOf('data-src-modo-nota') < 0);
  // 2026-09-28: no 16:9 os controles NATIVOS voltam, no MESMO no; no 9:16 saem (a barra do
  // Chrome cobria a legenda) e a barra propria, abaixo do quadro, assume.
  ok('fluxo 1d: "Original 16:9" liga os controles nativos no MESMO <video>',
    b.video.controls === true);
  b.muda('[data-src-modo]', { value: 'saida' });
  ok('fluxo 1e: e "Como sai 9:16" os desliga de novo, no mesmo no',
    b.video.controls === false);
  b.root.querySelector = qsAntes;
  ok('fluxo 1f: no 9:16 a marcacao nao pede controles nativos e traz a barra propria',
    !/<video[^>]*data-src-video[^>]*\scontrols/.test(htmlAntesModo)
    && htmlAntesModo.indexOf('data-src-barra') > 0 && htmlAntesModo.indexOf('data-src-busca') > 0
    && htmlAntesModo.indexOf('data-act="src-play"') > 0);
  ok('fluxo 1g: o quadro desenha o fundo sem rotulo "Fundo aproximado"',
    /class="yt-src-quadro"><div class="yt-src-fundo"/.test(htmlAntesModo)
    && htmlAntesModo.indexOf('Fundo aproximado') < 0);
  // A busca fica DENTRO do corte: pedir alem do fim para no fim, e antes do comeco no comeco.
  const offsetFonte = Number(b.video._offset) || 0;
  b.digita('[data-src-busca]', '99999');
  const noFim = b.video.currentTime + offsetFonte;
  b.digita('[data-src-busca]', '-40');
  const noComeco = b.video.currentTime + offsetFonte;
  const aberto = legSalvoPorId(b, clipId);
  ok('fluxo 1h: a busca da barra fica presa no corte (comeco e fim dele)',
    Math.abs(noFim - aberto.outSec) < 0.01 && Math.abs(noComeco - aberto.inSec) < 0.01);
  // Espaco com o foco no quadro toca/pausa (e nao rola a pagina).
  b.video.paused = true;
  const tocouAntes = b.video._tocou;
  let impediu = false;
  b.root._listeners.keydown({ key: ' ', target: fakeEl(['[data-src-stage], [data-src-barra], [data-src-barra] *']),
    preventDefault() { impediu = true; } });
  ok('fluxo 1i: espaco no quadro toca o video, sem rolar a pagina',
    b.video._tocou === tocouAntes + 1 && impediu);
  // O CSS da previa (2026-09-28): a palavra acesa HERDA o peso (sem `bolder` = 900
  // sintetizado), a legenda aparece tambem no 16:9 (so espera o mapa do quadro), e nenhuma
  // palavra e partida no meio.
  const css = require('fs').readFileSync(require('path').join(__dirname, 'video-ops.css'), 'utf8');
  ok('css: a palavra acesa herda o peso da pagina',
    /\.vop-leg-prev \[data-leg-prev-ativa\] \{ font-weight: inherit; \}/.test(css));
  ok('css: a legenda nao some mais no 16:9 (so antes do mapa do quadro)',
    !/\[data-modo="original"\] \.vop-leg-prev \{ display: none; \}/.test(css)
    && /\[data-modo="original"\]:not\(\[data-mapa\]\) \.vop-leg-prev \{ display: none; \}/.test(css));
  ok('css: palavra nunca partida (sem break-word na previa)',
    !/vop-leg-prev > span \{[^}]*overflow-wrap: break-word/.test(css));
  // Arrastar: a legenda e a alca, e o retangulo medido e o QUADRO 9:16 (225x400). Pegar em
  // 75% da altura e subir 25 pontos: a partida e a ancora automatica REAL do blur (63%, do
  // servidor), entao a base vai a 63 - 25 = 38 -- com o 75 de antes, o mesmo gesto dava 50.
  // No lado, 45 px (20 pontos) para a esquerda: sai do centro e vai a 30 -- a faixa agora e
  // a do piso da palavra ([16, 84]); a trava antiga ([42, 50]) parava em 42.
  const palco = { getBoundingClientRect() { return { top: 0, height: 400, left: 0, width: 225 }; } };
  const previa = fakeEl();
  previa.parentNode = palco;
  const alca = fakeEl();
  alca.closest = s => (s === '[data-leg-prev]' ? previa : null);
  root_pointer(b, alca, 300, 112.5);
  alca._listeners.pointermove({ clientY: 200, clientX: 67.5 });
  ok('fluxo 2a: durante o arrasto o lateral para na faixa do servidor',
    previa.dataset.autoX === '0' && previa.dataset.ima === '0');
  alca._listeners.pointerup({});
  html = b.html();
  ok('fluxo 2: arrastar na previa vira as DUAS posicoes manuais, ja com os sliders no numero',
    /data-leg-field="posicaoPct"[^>]*value="38"|value="38"[^>]*data-leg-field="posicaoPct"/.test(html)
    && html.indexOf('--leg-pos:38%') > 0
    && /data-leg-field="posicaoXPct"[^>]*value="30"|value="30"[^>]*data-leg-field="posicaoXPct"/.test(html)
    && html.indexOf('--leg-x:30%') > 0);
  const ordenado = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  const legSalvo = () => [].concat(...JSON.parse(b.store["pp_video_projects_v1"]).projects
    .map(p => p.candidates || [])).find(c => c.id === clipId);
  const lateralAntes = legSalvo().edit.legenda.posicaoXPct;
  // Um arrasto SO VERTICAL a partir do centro nao cria posicao lateral (ima do centro).
  b.clique({ act: 'leg-auto', id: clipId, key: 'posicaoXPct' });
  await tick(); await tick();
  root_pointer(b, alca, 200, 112.5);
  alca._listeners.pointermove({ clientY: 180, clientX: 114 });
  ok('fluxo 2b: arrasto so vertical gruda no centro, com a guia a vista',
    previa.dataset.autoX === '1' && previa.dataset.ima === '1');
  alca._listeners.pointerup({});
  ok('fluxo 2c: e nada de posicaoXPct e gravado (o centro e o automatico); a altura subiu para 33',
    lateralAntes === 30 && legSalvo().edit.legenda.posicaoXPct === undefined);
  // Trocar o enquadramento repinta o palco e pede a geometria DELE (1:1 -> video de 1080).
  b.muda('[data-clip-field]', { dataset: { clipField: 'reframe', id: clipId }, value: 'crop11' });
  await tick(); await tick();
  // O DOM falso nao tem os nos para a atualizacao NO LUGAR; reabrir le o estado assentado.
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  html = b.html();
  ok('fluxo 2e: trocar para 1:1 repinta o palco com a geometria do servidor, e UM <video> so',
    html.indexOf('data-reframe="crop11"') > 0 && html.indexOf('--geo-video:1080') > 0
    && html.indexOf('--leg-base:506') > 0 && (html.match(/data-src-video/g) || []).length === 1);
  b.muda('[data-clip-field]', { dataset: { clipField: 'reframe', id: clipId }, value: 'blur' });
  await tick(); await tick();
  // Volta o lateral para 42 pelo slider e liga a Profundidade Funda.
  b.muda('[data-leg-field]', { dataset: { legField: 'posicaoXPct', id: clipId }, value: '42' });
  b.muda('[data-leg-field]', { dataset: { legField: 'profundidade', id: clipId }, value: 'funda' });
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  html = b.html();
  ok('fluxo 2d: Funda veste a previa (inclina pela base), com caixa sem volume e sem frase',
    html.indexOf('data-prof="inclina"') > 0
    && html.indexOf('--leg-3dt:perspective(calc(700 * var(--px))) rotateX(32deg);--leg-origem:50% 100%') > 0
    && html.indexOf('inclina o texto sem volume') < 0);
  const projSalvo = JSON.parse(b.store["pp_video_projects_v1"]);
  const clipSalvo = [].concat(...projSalvo.projects.map(p => p.candidates || []))
    .find(c => c.id === clipId);
  // A combinacao grava so o que DIFERE do estilo: o branco do texto ja e o do Contorno, e
  // o "sem contorno" dela e escolha (o estilo traz contorno preto).
  ok('fluxo 3: o ajuste foi SALVO no projeto (sem chave nova de localStorage)',
    clipSalvo && clipSalvo.legendaStyle === 'podcast'
    && ordenado(clipSalvo.edit.legenda) === ordenado({ destaqueCor: '#FF6B5B',
      contorno: 'nenhum', fundo: '#1E3A8A', tamanho: 80, posicaoPct: 33, posicaoXPct: 42,
      profundidade: 'funda' })
    && Object.keys(b.store).every(k => k.indexOf('leg') < 0));
  ok('fluxo 4: reaberto, a tela marca o que foi escolhido (combinacao sai: a caixa mudou)',
    /value="podcast" checked/.test(html) && html.indexOf('value="80"') > 0
    && html.indexOf('--leg-fundo:#1E3A8A') > 0 && html.indexOf('--leg-pos:33%') > 0
    && html.indexOf('--leg-x:42%') > 0 && /value="funda" checked/.test(html)
    && !/data-leg-combo[^>]*checked/.test(html));
  const corpo = b.ops.renderBody(clipSalvo, true);
  ok('fluxo 5: o export leva o estilo e os ajustes (o mesmo objeto que a previa leu)',
    corpo.legendaStyle === 'podcast' && corpo.edit.legenda.fundo === '#1E3A8A'
    && corpo.edit.legenda.posicaoPct === 33 && corpo.edit.legenda.destaqueCor === '#FF6B5B'
    && corpo.edit.legenda.posicaoXPct === 42 && corpo.edit.legenda.profundidade === 'funda');
  // Trocar de estilo mantem as posicoes e a Profundidade (nao sao do estilo).
  b.muda('[data-clip-field]', { dataset: { clipField: 'legendaStyle', id: clipId }, value: 'impacto' });
  ok('fluxo 5b: trocar de estilo mantem posicao lateral e Profundidade',
    legSalvo().edit.legenda.posicaoXPct === 42 && legSalvo().edit.legenda.profundidade === 'funda');
  b.muda('[data-clip-field]', { dataset: { clipField: 'legendaStyle', id: clipId }, value: 'podcast' });
  b.clique({ act: 'leg-reset', id: clipId });
  html = b.html();
  ok('fluxo 6: "Voltar ao padrao" devolve tudo ao automatico (lateral e Profundidade inclusive)',
    /data-act="leg-reset"[^>]*disabled/.test(html) && html.indexOf('data-manual="1"') < 0
    && /value="podcast" checked/.test(html)
    && JSON.stringify(legSalvo().edit.legenda) === '{}');
  // ÂNGULO (2026-09-29): Nenhuma → o pad fica desabilitado e DIZ por quê (BP-008).
  ok('fluxo 7: sem Profundidade, o Angulo aparece desabilitado, sem frase de motivo',
    /value="tras" checked disabled/.test(html)
    && (html.match(/data-leg-field="profundidadeDirecao"[^>]*disabled/g) || []).length === 8
    && html.indexOf('Escolha Suave ou Funda para usar o ângulo.') < 0);
  b.muda('[data-leg-field]', { dataset: { legField: 'profundidade', id: clipId }, value: 'funda' });
  b.muda('[data-leg-field]', { dataset: { legField: 'profundidadeDirecao', id: clipId }, value: 'tras-direita' });
  ok('fluxo 7b: Funda + "Para tras e a direita" fica SALVO no projeto',
    legSalvo().edit.legenda.profundidade === 'funda'
    && legSalvo().edit.legenda.profundidadeDirecao === 'tras-direita');
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  html = b.html();
  ok('fluxo 7c: reaberto, o pad marca a escolha, habilitado, e a previa gira pelo pivo dela',
    /value="tras-direita" checked/.test(html)
    && !/data-leg-field="profundidadeDirecao"[^>]*disabled/.test(html)
    && html.indexOf('Escolha Suave ou Funda para usar o ângulo.') < 0
    && html.indexOf('--leg-origem:0% 100%') > 0 && html.indexOf('rotateY(9deg) rotateX(24deg)') > 0);
  ok('fluxo 7d: o export leva a direcao',
    b.ops.renderBody(legSalvo(), true).edit.legenda.profundidadeDirecao === 'tras-direita');
  b.muda('[data-clip-field]', { dataset: { clipField: 'legendaStyle', id: clipId }, value: 'impacto' });
  ok('fluxo 7e: trocar de estilo mantem o Angulo',
    legSalvo().edit.legenda.profundidadeDirecao === 'tras-direita');
  b.muda('[data-clip-field]', { dataset: { clipField: 'legendaStyle', id: clipId }, value: 'podcast' });
  b.clique({ act: 'leg-reset', id: clipId });
  html = b.html();
  ok('fluxo 7f: "Voltar ao padrao" limpa o Angulo junto',
    JSON.stringify(legSalvo().edit.legenda) === '{}' && /value="tras" checked disabled/.test(html));
  // CAPA DO TIKTOK (2026-09-30): sem quadro → diz; escolher → salvo; estilo e manchete →
  // salvos; reaberto → marcado; o corpo do PNG leva tudo; o export do MP4 NÃO leva a capa.
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'capa' }); // a capa é a etapa final (2026-10-05)
  html = b.html();
  ok('fluxo 8: a secao "Capa do TikTok" aparece; sem quadro, gerar trava e nenhuma frase diz isso',
    html.indexOf('data-capa-painel') > 0 && html.indexOf('Capa do TikTok') > 0
    && html.indexOf(b.ops.CAPA_MSG.capa_sem_quadro) < 0
    && /data-act="capa-gerar"[^>]*disabled/.test(html) && !/data-act="capa-quadro"[^>]*disabled/.test(html)
    && html.indexOf('Prévia aproximada') < 0);
  const offCapa = Number(b.video._offset) || 0;
  b.video.currentTime = legSalvo().inSec + 2 - offCapa;
  b.clique({ act: 'capa-quadro', id: clipId });
  html = b.html();
  ok('fluxo 8b: "Usar este quadro" grava o instante do player no corte (ms da fonte)',
    legSalvo().capaTikTok && legSalvo().capaTikTok.quadroMs === (legSalvo().inSec + 2) * 1000
    && !/data-act="capa-gerar"[^>]*disabled/.test(html) && />Gerar capa<\/button>/.test(html)
    && html.indexOf('Falta gerar o PNG real') < 0);
  b.muda('[data-capa-field]', { dataset: { capaField: 'estilo', id: clipId }, value: 'faixa', type: 'radio' });
  b.digita('[data-capa-field]', 'Minha manchete de teste');
  b.muda('[data-capa-field]', { dataset: { capaField: 'titulo', id: clipId }, value: 'Minha manchete de teste', type: 'text' });
  ok('fluxo 8c: estilo e manchete ficam SALVOS no projeto (sem chave nova de localStorage)',
    legSalvo().capaTikTok.estilo === 'faixa' && legSalvo().capaTikTok.titulo === 'Minha manchete de teste'
    && Object.keys(b.store).every(k => k.indexOf('capa') < 0));
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  html = b.html();
  ok('fluxo 8d: reaberto, a secao marca o estilo e mostra a manchete',
    /data-capa-field="estilo"[^>]*value="faixa" checked/.test(html)
    && html.indexOf('value="Minha manchete de teste"') > 0
    && (html.match(/<video[^>]*data-src-video/g) || []).length === 1);
  const corpoCapa = b.ops.capaCorpo(legSalvo());
  ok('fluxo 8e: o pedido do PNG leva quadro, estilo, manchete e o intervalo da fonte',
    corpoCapa.capaTikTok.quadroMs === (legSalvo().inSec + 2) * 1000 && corpoCapa.capaTikTok.estilo === 'faixa'
    && corpoCapa.capaTikTok.titulo === 'Minha manchete de teste'
    && corpoCapa.start === legSalvo().inSec && corpoCapa.end === legSalvo().outSec && !!corpoCapa.clipToken);
  ok('fluxo 8f: a capa NAO vaza para o export do MP4',
    !('capaTikTok' in b.ops.renderBody(legSalvo(), true, { token: 't', name: 'n' })));
  b.video.currentTime = legSalvo().outSec + 30 - offCapa;
  b.clique({ act: 'capa-quadro', id: clipId });
  html = b.html();
  ok('fluxo 8g: quadro fora do corte = o botao de gerar trava, sem frase',
    html.indexOf('Capa desatualizada') < 0 && /data-act="capa-gerar"[^>]*disabled/.test(html));
  // MUSICA DE FUNDO (2026-09-30): "Sem musica" por padrao → escolher faixa → nivel e inicio
  // salvos → reaberto → export leva a intencao → "Voltar ao padrao" da legenda NAO a apaga →
  // "Sem musica" tira. A biblioteca entra pelo modulo (sem rede nesta bancada).
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'editar' });
  html = b.html();
  ok('fluxo 9: a secao "Musica" aparece, com "Sem musica" marcado, importar e o aviso de direitos',
    html.indexOf('data-mus-painel') > 0 && /data-mus-field="id"[^>]*value="" checked/.test(html)
    && html.indexOf('Importar do PC') > 0 && html.indexOf('prefira faixas livres de direitos') < 0);
  const ID_MUS = '0123456789abcdef';
  b.ops.MUS.lista = [{ id: ID_MUS, nome: 'Trilha calma', durationSec: 180, lufs: -16, ext: '.mp3', url: '/musicas/' + ID_MUS + '.mp3' }];
  b.ops.MUS.estado = 'pronta';
  b.muda('[data-mus-field]', { dataset: { musField: 'id', id: clipId }, value: ID_MUS });
  b.muda('[data-mus-field]', { dataset: { musField: 'nivel', id: clipId }, value: 'medio' });
  b.muda('[data-mus-field]', { dataset: { musField: 'inicio', id: clipId }, value: '0:05' });
  b.muda('[data-mus-field]', { dataset: { musField: 'inicio', id: clipId }, value: 'abc' });
  ok('fluxo 9b: faixa, nivel e inicio ficam SALVOS; inicio que nao e tempo NAO vira zero calado',
    JSON.stringify(legSalvo().edit.musica) === JSON.stringify({ id: ID_MUS, inicioMs: 5000, nivel: 'medio' }));
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  html = b.html();
  ok('fluxo 9c: reaberto, a faixa e o nivel estao marcados e a previa tem UM <audio> (e um <video>)',
    new RegExp('data-mus-field="id"[^>]*value="' + ID_MUS + '" checked').test(html)
    && /data-mus-field="nivel"[^>]*value="medio" checked/.test(html)
    && (html.match(/<audio[^>]*data-mus-audio/g) || []).length === 1
    && (html.match(/<video[^>]*data-src-video/g) || []).length === 1
    && html.indexOf('a mistura final sai no MP4') < 0);
  ok('fluxo 9d: o export leva a intencao (faixa, inicio e nivel), nunca dB',
    JSON.stringify(b.ops.renderBody(legSalvo(), true, { token: 't', name: 'n' }).edit.musica)
    === JSON.stringify({ id: ID_MUS, inicioMs: 5000, nivel: 'medio' }));
  b.clique({ act: 'leg-reset', id: clipId });
  ok('fluxo 9e: "Voltar ao padrao" da LEGENDA nao apaga a musica',
    legSalvo().edit.musica && legSalvo().edit.musica.id === ID_MUS);
  b.muda('[data-mus-field]', { dataset: { musField: 'id', id: clipId }, value: '' });
  ok('fluxo 9f: "Sem musica" tira a chave (o corte volta a exportar como antes)',
    !legSalvo().edit || !('musica' in legSalvo().edit));
  // REMOVER TRECHOS (2026-09-30): marcar pelo player → salvo → lista com Desfazer → o export
  // leva as remoções → borda recusada com motivo → "Desfazer" devolve.
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'trecho' }); // remover trechos mora em "Marcar trecho" (2026-10-05)
  html = b.html();
  ok('fluxo 10: a secao "Remover trechos" aparece, sem nada removido, e "Marcar fim" espera o inicio',
    html.indexOf('data-rem-painel') > 0 && html.indexOf('data-act="rem-desfazer"') < 0
    && html.indexOf('Nenhum trecho removido.') < 0
    && /data-act="rem-fim"[^>]*disabled/.test(html));
  const cr = legSalvo();
  b.video.currentTime = cr.inSec - offCapa;
  b.clique({ act: 'rem-inicio', id: clipId });
  b.video.currentTime = cr.inSec + 2 - offCapa;
  b.clique({ act: 'rem-fim', id: clipId });
  html = b.html();
  ok('fluxo 10b: trecho encostado no COMECO do corte e recusado: "Marcar fim" acende aria-invalid, sem frase',
    /data-act="rem-fim"[^>]*aria-invalid="true"/.test(html)
    && html.indexOf('mova a borda do corte') < 0 && !(legSalvo().edit || {}).remocoes);
  b.video.currentTime = cr.inSec + 1 - offCapa;
  b.clique({ act: 'rem-inicio', id: clipId });
  b.video.currentTime = cr.inSec + 3 - offCapa;
  b.clique({ act: 'rem-fim', id: clipId });
  html = b.html();
  ok('fluxo 10c: inicio e fim pelo player = trecho removido, SALVO, na lista com Desfazer',
    JSON.stringify(legSalvo().edit.remocoes)
    === JSON.stringify([{ deMs: (cr.inSec + 1) * 1000, ateMs: (cr.inSec + 3) * 1000 }])
    && /class="vop-txt-tempo">≈ /.test(html) && html.indexOf('data-act="rem-desfazer"') > 0
    && !/data-act="rem-fim"[^>]*aria-invalid/.test(html)
    && html.indexOf('A prévia pula os trechos removidos') < 0);
  ok('fluxo 10d: o export leva as remocoes (o servidor remapeia); o id nao muda',
    JSON.stringify(b.ops.renderBody(legSalvo(), true, { token: 't', name: 'n' }).edit.remocoes)
    === JSON.stringify(legSalvo().edit.remocoes) && legSalvo().id === clipId);
  b.clique({ act: 'rem-desfazer', id: clipId, i: '0' });
  ok('fluxo 10e: "Desfazer" devolve o trecho (a chave some)',
    !('remocoes' in (legSalvo().edit || {})) && b.html().indexOf('data-act="rem-desfazer"') < 0);
  // TEXTO FIXO (2026-09-30): digitar → marcar início/fim pelo player → salvo → reaberto com a
  // prévia acesa SÓ dentro da janela → posição editada → export leva → remover.
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'editar' });
  ok('fluxo 11: a secao "Texto na tela" aparece vazia, com campo para o texto novo',
    b.html().indexOf('data-txt-painel') > 0 && b.html().indexOf('data-act="txt-remover"') < 0
    && b.html().indexOf('Nenhum texto.') < 0
    && b.html().indexOf('data-txt-novo') > 0);
  b.digita('[data-txt-novo]', 'x');
  b.root._listeners.input({ target: Object.assign(fakeEl(['[data-txt-novo]']), { dataset: { id: clipId }, value: 'Faturamento de 2024' }) });
  b.video.currentTime = cr.inSec + 5 - offCapa;
  b.clique({ act: 'txt-inicio', id: clipId });
  b.video.currentTime = cr.inSec + 8 - offCapa;
  b.clique({ act: 'txt-fim', id: clipId });
  const txtSalvo = (legSalvo().edit || {}).textos || [];
  ok('fluxo 11b: o texto fica SALVO com a janela do player, posicao e estilo padrao',
    txtSalvo.length === 1 && txtSalvo[0].texto === 'Faturamento de 2024'
    && txtSalvo[0].deMs === (cr.inSec + 5) * 1000 && txtSalvo[0].ateMs === (cr.inSec + 8) * 1000
    && txtSalvo[0].posicao === 'alto' && txtSalvo[0].estilo === 'rotulo');
  b.muda('[data-txt-field]', { dataset: { txtField: 'posicao', id: clipId, i: '0' }, value: 'meio', type: 'radio' });
  b.clique({ act: 'yt-back' });
  b.video.currentTime = cr.inSec + 6 - offCapa;
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  html = b.html();
  // Reabrir leva o player ao COMEÇO do corte, antes da janela: a prévia existe, na janela
  // certa e na posição editada, mas APAGADA (`hidden`) — acende só entre de e até.
  ok('fluxo 11c: reaberto, a posicao editada esta marcada e a previa do texto esta no quadro, apagada fora da janela',
    /data-txt-field="posicao"[^>]*value="meio" checked/.test(html)
    && new RegExp('<div class="vop-txt-prev" data-txt-prev data-de="' + (cr.inSec + 5) * 1000 + '" data-ate="'
      + (cr.inSec + 8) * 1000 + '" data-estilo="rotulo" style="--txt-topo:860[^"]*" hidden><span>Faturamento de 2024').test(html));
  ok('fluxo 11d: o export leva o texto (o servidor poe no relogio da saida)',
    b.ops.renderBody(legSalvo(), true, { token: 't', name: 'n' }).edit.textos[0].texto === 'Faturamento de 2024');
  /* Achado na revisao final (2026-10-01): a recusa de texto vazio e chaveada pelo INDICE, e
     remover um item acima deslocava a marca para o vizinho intocado. */
  for (const [de, ate, t] of [[10, 12, 'Segundo'], [14, 16, 'Terceiro']]) {
    b.root._listeners.input({ target: Object.assign(fakeEl(['[data-txt-novo]']), { dataset: { id: clipId }, value: t }) });
    b.video.currentTime = cr.inSec + de - offCapa; b.clique({ act: 'txt-inicio', id: clipId });
    b.video.currentTime = cr.inSec + ate - offCapa; b.clique({ act: 'txt-fim', id: clipId });
  }
  b.muda('[data-txt-field]', { dataset: { txtField: 'texto', id: clipId, i: '1' }, value: '' });
  ok('fluxo 11e0: esvaziar o segundo texto acende aria-invalid nele, com 3 textos na lista',
    (legSalvo().edit.textos || []).length === 3 && /data-i="1" value="Segundo" aria-label="Texto 2" aria-invalid="true"/.test(b.html()));
  b.clique({ act: 'txt-remover', id: clipId, i: '0' });
  ok('fluxo 11e1: remover o primeiro nao passa a marca para o vizinho intocado',
    !/value="Terceiro"[^>]*aria-invalid/.test(b.html()));
  b.clique({ act: 'txt-remover', id: clipId, i: '1' });
  b.clique({ act: 'txt-remover', id: clipId, i: '0' });
  ok('fluxo 11e: "Remover" tira o texto (a chave some)',
    !('textos' in (legSalvo().edit || {})) && b.html().indexOf('data-act="txt-remover"') < 0);
  // ZOOM LEVE (2026-09-30): marcar pelo player → salvo → nivel → prévia no player → export →
  // remover. Ainda UM <video> no DOM.
  ok('fluxo 12: a secao "Zoom leve" aparece vazia', b.html().indexOf('data-zoom-painel') > 0
    && b.html().indexOf('data-act="zoom-remover"') < 0 && b.html().indexOf('Nenhum zoom.') < 0);
  b.video.currentTime = cr.inSec + 10 - offCapa;
  b.clique({ act: 'zoom-inicio', id: clipId });
  b.video.currentTime = cr.inSec + 13 - offCapa;
  b.clique({ act: 'zoom-fim', id: clipId });
  b.muda('[data-zoom-field]', { dataset: { zoomField: 'nivel', id: clipId, i: '0' }, value: 'medio', type: 'radio' });
  const zSalvo = (legSalvo().edit || {}).zooms || [];
  ok('fluxo 12b: o zoom fica SALVO com a janela do player e o nivel escolhido',
    zSalvo.length === 1 && zSalvo[0].deMs === (cr.inSec + 10) * 1000 && zSalvo[0].ateMs === (cr.inSec + 13) * 1000
    && zSalvo[0].nivel === 'medio' && /data-zoom-field="nivel"[^>]*value="medio" checked/.test(b.html()));
  b.video.style = {};
  b.video.currentTime = cr.inSec + 11 - offCapa;
  b.root._listeners.timeupdate({ target: b.video });
  const dentro = b.video.style.scale;
  b.video.currentTime = cr.inSec + 20 - offCapa;
  b.root._listeners.timeupdate({ target: b.video });
  ok('fluxo 12c: a previa aplica o nivel no PROPRIO player dentro da janela e volta ao normal fora',
    dentro === '1.12' && b.video.style.scale === '' && (b.html().match(/<video[^>]*data-src-video/g) || []).length === 1);
  ok('fluxo 12d: o export leva o zoom (o servidor poe no relogio da saida)',
    b.ops.renderBody(legSalvo(), true, { token: 't', name: 'n' }).edit.zooms[0].nivel === 'medio');
  b.clique({ act: 'zoom-remover', id: clipId, i: '0' });
  ok('fluxo 12e: "Remover" tira o zoom (a chave some)',
    !('zooms' in (legSalvo().edit || {})) && b.html().indexOf('data-act="zoom-remover"') < 0);
  b.muda('[data-clip-field]', { dataset: { clipField: 'legendaStyle', id: clipId },
    value: 'classico' });
  html = b.html();
  const salvoDe = () => [].concat(...JSON.parse(b.store['pp_video_projects_v1']).projects
    .map(p => p.candidates || [])).find(c => c.id === clipId);
  ok('a transcrição é TEXTO CORRIDO: cada fala é um trecho editável do parágrafo',
    /<span class="vop-cap-frase" contenteditable="plaintext-only"[^>]*data-cap-index="0"/.test(html)
    && /<div class="vop-cap-read"><p>/.test(html));
  ok('e o que o YouTube detectou aparece como está, censura e tudo',
    />eu perdi \[ __ \] mil reais<\/span>/.test(html));
  ok('a segunda fala também está lá', html.indexOf('e foi o melhor negócio') > 0);
  ok('o horário NÃO aparece no texto: mora no "Horários (avançado)", fechado',
    !/class="vop-cap-time"/.test(html) && /<details class="vop-leg-mais"><summary data-leg-mais="horarios">/.test(html));
  ok('sem correção: nenhuma frase de "salvo", e Desfazer/Restaurar desabilitados',
    html.indexOf('Sem correções') < 0 && /data-act="cap-undo"[^>]*disabled/.test(html)
    && /data-act="cap-restore"[^>]*disabled/.test(html));
  // Palavra + acento + pontuação, numa frase; inclusão de texto na outra.
  b.muda('[data-cap-field]', { value: 'Eu perdi quarenta mil reais.',
    dataset: { id: clipId, capIndex: '0' } });
  b.muda('[data-cap-field]', { value: 'e foi o melhor negócio da minha vida!',
    dataset: { id: clipId, capIndex: '1' } });
  let capSalvo = salvoDe();
  ok('correção de palavra, acento e pontuação é SALVA no projeto, com o tempo intacto',
    capSalvo.capEdit && capSalvo.capEdit[0].text === 'Eu perdi quarenta mil reais.'
    && capSalvo.capEdit[0].start === 0 && capSalvo.capEdit[0].end === 2);
  ok('inclusão de texto também, sem mexer no relógio da fala',
    capSalvo.capEdit[1].text === 'e foi o melhor negócio da minha vida!'
    && capSalvo.capEdit[1].start === 2 && capSalvo.capEdit[1].end === 4);
  ok('o original do YouTube continua guardado à parte', capSalvo.clipCues[0].text === 'eu perdi [ __ ] mil reais');
  ok('sem chave nova de localStorage', Object.keys(b.store).every(k => k.indexOf('cap') < 0));
  // Desfazer volta UMA correção (a última frase), e só ela.
  b.clique({ act: 'cap-undo', id: clipId });
  capSalvo = salvoDe();
  ok('Desfazer tira a última correção e mantém a anterior',
    capSalvo.capEdit[1].text === 'e foi o melhor negócio' && capSalvo.capEdit[0].text === 'Eu perdi quarenta mil reais.');
  // Remoção de texto: apagar a fala inteira é como tirar uma legenda que o YouTube inventou.
  b.muda('[data-cap-field]', { value: '', dataset: { id: clipId, capIndex: '1' } });
  // Reabrir a tela (e recarregar o módulo com o que ficou no disco).
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  html = b.html();
  ok('reaberto, o texto corrigido é o que está na tela', html.indexOf('Eu perdi quarenta mil reais.') > 0);
  ok('e a censura do YouTube saiu do texto (fica só no title, como original)',
    html.indexOf('>eu perdi [ __ ] mil reais<') < 0);
  ok('salvo, a tela nao escreve isso: Restaurar habilita e o cabecalho nao acende erro',
    html.indexOf('Correções salvas neste projeto') < 0 && !/data-act="cap-restore"[^>]*disabled/.test(html)
    && !/data-cap-head aria-invalid/.test(html));
  ok('a frase corrigida é marcada, com o original no title',
    /data-edited="1" aria-label="Frase em 0:00\.0" title="Original: eu perdi \[ __ \] mil reais"/.test(html));
  ok('nenhuma nota de estado: a correcao mora no proprio texto marcado',
    !/vai ser queimado no clip/.test(html) && /data-edited="1"/.test(html));
  // A prévia mostra a PÁGINA da rota (2026-09-28): a resposta com as falas corrigidas chega
  // depois do primeiro render e repinta no lugar; reabrir mostra o que ela trouxe.
  b.clique({ act: 'yt-back' });
  b.clique({ act: 'yt-open', id: clipId });
  await tick(); await tick();
  html = b.html();
  ok('a PRÉVIA sobre o vídeo mostra o texto corrigido',
    /data-leg-prev-ativa[^>]*>Eu<\/b> perdi quarenta mil reais\./.test(html));
  const b2 = b.ops.projectsSanitize(JSON.parse(b.store['pp_video_projects_v1']));
  const clipDisco = [].concat(...b2.projects.map(p => p.candidates)).find(c => c.id === clipId);
  const corpoCap = b.ops.renderBody(clipDisco, true);
  ok('o EXPORT leva o texto corrigido (o mesmo que a prévia mostra)',
    corpoCap.cues[0].text === 'Eu perdi quarenta mil reais.' && corpoCap.cues[0].start === 0);
  ok('e a fala apagada vai vazia — o servidor a descarta, o tempo das outras não muda',
    corpoCap.cues[1].text === '' && corpoCap.cues[1].start === 2);
  b.clique({ act: 'cap-restore', id: clipId });
  capSalvo = salvoDe();
  html = b.html();
  ok('Restaurar volta ao texto do YouTube e apaga a correção do disco',
    !('capEdit' in capSalvo) && html.indexOf('eu perdi [ __ ] mil reais') > 0);
  b.clique({ act: 'cap-undo', id: clipId });
  ok('e Restaurar também se desfaz', (salvoDe().capEdit || [])[0].text === 'Eu perdi quarenta mil reais.');
  // Ouvir: toca a frase escolhida e mais nada.
  b.video._tocou = 0;
  b.clique({ act: 'cap-play', id: clipId });
  ok('Ouvir leva o player ao começo da frase (relativo à prévia recortada) e toca',
    b.video._tocou === 1);

  // ---- EXPORTAR dois cortes sem rebaixar o original -----------------------------------
  // O criterio de aceitacao em pessoa: "I can export two different clips without downloading
  // the original video again." A prova nao e a tela dizer isso -- e a CONTAGEM de chamadas.
  const contaImportes = () => (chamadas['/api/yt-import'] || 0)
    + (chamadas['/api/yt-import-state'] || 0);
  const importesAntes = contaImportes();
  const cortesAntes = chamadas['/api/video-cut'] || 0;
  b.clique({ act: 'yt-fetch', id: clipId });
  await tick(); await tick(); await tick();
  const queryCorte = chamadas['_ultima:/api/video-cut'] || '';
  ok('o trecho original sai pelo /api/video-cut, do arquivo ja importado',
    chamadas['/api/video-cut'] === cortesAntes + 1);
  ok('e NUNCA pelo /api/yt-fetch, que baixava trecho do YouTube',
    !chamadas['/api/yt-fetch']);
  ok('a query manda o token da FONTE e o intervalo dentro dela',
    queryCorte.indexOf('token=abcdefghijk') > 0
    && /[?&]start=\d/.test(queryCorte) && /[?&]end=\d/.test(queryCorte));
  ok('e o nome da fonte, que e a chave do sidecar da legenda dela',
    queryCorte.indexOf('name=abcdefghijk.mp4') > 0);
  ok('o trecho exportado entra na Central', String(b.badge.textContent) !== '0');

  // O SEGUNDO corte: outro trecho, mesmo arquivo.
  b.clique({ act: 'yt-render', id: clipId, });
  await tick(); await tick(); await tick();
  const corpoRender = chamadas['_corpo:/api/remotion-render'] || '';
  ok('o video editado sai pelo Remotion com o token da FONTE', /"clipToken":"abcdefghijk"/.test(corpoRender));
  ok('e dizendo QUAL pedaco dela cortar (sem isso o render sairia com o video inteiro)',
    /"start":\d+/.test(corpoRender) && /"end":\d+/.test(corpoRender));
  ok('a legenda corrigida pelo operador e a que desce para o render',
    corpoRender.indexOf('Eu perdi quarenta mil reais.') > 0);
  ok('e o nome do arquivo exportado NAO viaja como fonte (renderizaria o proprio export)',
    corpoRender.indexOf('clipFilename') < 0);
  ok('NENHUMA importacao nova aconteceu entre os dois exports',
    contaImportes() === importesAntes);
  ok('e o video importado continua pronto na tela',
    /<video[^>]*data-src-video/.test(b.html()));

  // ---- "Card visual": a biblioteca de cards do operador -------------------------------
  // O card tinha duas identidades de terceiro fechadas no codigo. Agora o operador constroi
  // as dele, e o que erra CALADO aqui e a tela nao refletir o estado: um grupo de radios sem
  // nenhum marcado, uma biblioteca vazia sem explicacao, ou -- o pior -- um corte apontando
  // para um card apagado sem que nada diga isso.
  b.clique({ act: 'yt-open', id: clipId });
  b.clique({ act: 'yt-etapa', id: clipId, etapa: 'editar' });
  html = b.html();
  ok('o seletor "Card visual" aparece no cartao do trecho',
    /<legend>Card visual<\/legend>/.test(html));
  // BIBLIOTECA VAZIA: o ramo que nao tem o que oferecer tambem fala, e oferece o caminho em
  // vez de desenhar um grupo de radios com uma opcao so (BP-008).
  ok('biblioteca vazia nao escreve frase: o botao de criar e o caminho',
    html.indexOf('biblioteca está vazia') < 0 && html.indexOf('data-act="cards-open"') > 0);
  ok('e oferece o botao que cria o primeiro card',
    html.indexOf('Criar o primeiro card') > 0);
  ok('"Sem card" existe mesmo com a biblioteca vazia (e a escolha de nao ter card)',
    html.indexOf('Sem card') > 0);

  // Criar o primeiro card pela MESMA delegacao do site.
  b.clique({ act: 'card-new' });
  html = b.html();
  ok('o painel da biblioteca abre depois de criar o primeiro card',
    html.indexOf('Biblioteca de cards') > 0);
  ok('e o editor traz a previa em CSS, sem frase de aproximacao',
    /data-card-prev/.test(html) && html.indexOf('Prévia aproximada') < 0);
  ok('com os controles de identidade e de aparencia, cada um com o valor a vista',
    /data-card-field="identificador"/.test(html)
    && /data-card-field="fileteCor"/.test(html)
    && /data-card-field="tituloPeso"/.test(html)
    && /data-card-field="destaqueSublinhado"/.test(html)
    && /data-card-logo/.test(html));
  // O teto de tamanho e dito ANTES de o operador esbarrar nele.
  ok('a linha do logo mostra so o valor ("sem logo"), sem frase de teto',
    html.indexOf('>sem logo<') > 0 && html.indexOf('512 KB') < 0);
  // Peso vem de um <select> com os pesos CARREGADOS: peso sintetizado sai borrado e so
  // aparece olhando o quadro.
  ok('o peso e um <select> dos pesos carregados, nunca um campo livre',
    /<select class="vop-card-sel" data-card-field="tituloPeso"/.test(html)
    && /<option value="900"/.test(html)
    && !/data-card-field="tituloPeso"[^>]*type="number"/.test(html));

  /* Desde 2026-10-01 a biblioteca abre DENTRO da ferramenta Card, no lugar do seletor; o
     "Voltar" devolve o seletor do corte. */
  ok('com a biblioteca aberta o seletor sai do lugar, e o Voltar o devolve',
    !/vop-cardpick/.test(html) && /data-act="cards-close"[^>]*>Voltar</.test(html));
  b.clique({ act: 'cards-close' });
  html = b.html();
  // O card novo aparece no SELETOR do trecho, com o nome que a biblioteca deu.
  ok('o card criado vira uma opcao do seletor do trecho',
    new RegExp('name="cardpick-' + clipId + '"').test(html)
    && html.indexOf('Card 1') > 0);
  ok('as opcoes sao radios nativos agrupados por trecho (nao botoes com classe na mao)',
    new RegExp('type="radio"[^>]*name="cardpick-' + clipId + '"').test(html));
  // Um seletor por trecho: `name` sem o id faria os radios de todos os cartoes brigarem
  // pelo mesmo grupo, e escolher num trecho desmarcaria o vizinho.
  ok('o grupo de radios e por trecho, nao um so para a lista toda',
    new Set((html.match(/name="cardpick-[^"]+"/g) || [])).size
      === new Set((html.match(/data-clip="[^"]+"/g) || [])).size);
  // O rotulo do grupo e `legend` num `fieldset`: e o que da o nome do grupo ao leitor de
  // tela sem inventar `aria-*` a mao.
  ok('o seletor e um fieldset de verdade (grupo nomeado, de graca)',
    /<fieldset class="vop-cardstyle vop-cardpick">/.test(html));
  ok('e cada radio tem label ligado por for/id (clicar no texto seleciona)',
    /<label for="cardpick-[^"]+">/.test(html));
  // Trecho que ainda nao escolheu: NENHUM card marcado, e a tela diz isso em vez de deixar
  // o operador supor que o primeiro esta selecionado.
  ok('nenhum card vem marcado sozinho, e nenhuma frase aparece',
    !new RegExp('name="cardpick-' + clipId + '"[^>]*checked').test(html)
    && html.indexOf('Nenhum card escolhido') < 0);

  // Escolher passa pela MESMA delegacao do site. `clipFieldWrite` NAO re-renderiza de
  // proposito (o `:checked` nativo ja mostra a escolha, e reescrever a lista tiraria o foco
  // de quem chegou pelo teclado), entao e preciso forcar um render novo para ler o ESTADO.
  // A ida e volta de aba e o gatilho, e prova de bonus o que importa mais: a escolha
  // SOBREVIVE ao re-render.
  const cardId = (html.match(/value="(card-[^"]+)"/) || [, ''])[1];
  ok('o card criado tem id proprio, e e ele que vai no radio', /^card-/.test(cardId));
  b.muda('[data-clip-field]', {
    value: cardId,
    dataset: { clipField: 'cardId', id: clipId },
  });
  b.aba('central');
  b.aba('youtube');
  html = b.html();
  ok('escolher o card fica marcado no proximo render',
    new RegExp('value="' + cardId + '"[^>]*checked').test(html));
  ok('e o card escolhido aparece so como o radio marcado, sem frase',
    new RegExp('value="' + cardId + '"[^>]*checked').test(html) && html.indexOf('Este corte veste') < 0);
  ok('nunca duas opcoes marcadas ao mesmo tempo',
    (html.match(new RegExp('name="cardpick-' + clipId + '"[^>]*checked', 'g')) || []).length === 1);
  // "Sem card" e escolha, nao falta de escolha.
  b.muda('[data-clip-field]', { value: '', dataset: { clipField: 'cardId', id: clipId } });
  b.aba('central');
  b.aba('youtube');
  html = b.html();
  ok('"Sem card" fica marcado e a tela explica o que isso significa',
    new RegExp('id="cardpick-' + clipId + '-nenhum"[^>]*checked').test(html)
    && html.indexOf('Sem card: o vídeo sai só com a legenda') < 0);

  // O RAMO QUE ERRA CALADO: apagar o card que um corte aponta. O corte NAO e reescrito
  // (trocar a identidade de video antigo sem ninguem pedir seria pior), entao ele fica orfao
  // e TEM de anunciar isso -- senao o operador exporta achando que tem card.
  b.muda('[data-clip-field]', { value: cardId, dataset: { clipField: 'cardId', id: clipId } });
  b.clique({ act: 'cards-open' });
  b.clique({ act: 'card-del', id: cardId });
  html = b.html();
  ok('apagar pede confirmacao NO LUGAR (nunca um confirm()), sem frase de consequencia',
    html.indexOf('Apagar mesmo assim') > 0 && html.indexOf('class="vop-card-confirm"') > 0
    && html.indexOf('passam a sair SEM card') < 0);
  b.clique({ act: 'card-del-no' });
  ok('cancelar desfaz a confirmacao sem apagar nada',
    b.html().indexOf('Apagar mesmo assim') < 0 && b.html().indexOf('Card 1') > 0);
  b.clique({ act: 'card-del', id: cardId });
  b.clique({ act: 'card-del-yes', id: cardId });
  html = b.html();
  ok('apagado mesmo: o card sai da biblioteca',
    (html.match(new RegExp('value="' + cardId + '"', 'g')) || []).length === 0);
  ok('e o corte que apontava para ele nao cai em outro card: nenhuma opcao fica marcada',
    !new RegExp('name="cardpick-' + clipId + '"[^>]*checked').test(html)
    && html.indexOf('foi apagado da biblioteca') < 0);
  ok('e o corte guarda o id do card apagado (orfao, nunca reescrito)',
    legSalvoPorId(b, clipId).cardId === cardId && html.indexOf('data-cardpick-state') < 0);
  // E a exclusao tambem fala no painel, dizendo o que ela custou.
  ok('o painel nao escreve o que a exclusao custou, e nao acende erro (apagar deu certo)',
    html.indexOf('saem sem card até você escolher outro') < 0 && !/data-cards aria-invalid/.test(html));
  b.clique({ act: 'cards-close' });
  ok('fechar o painel nao apaga a escolha nem o aviso do corte',
    b.html().indexOf('Biblioteca de cards') < 0
    && legSalvoPorId(b, clipId).cardId === cardId
    && !new RegExp('name="cardpick-' + clipId + '"[^>]*checked').test(b.html()));

  // ---- o seletor de ENQUADRAMENTO, irmao do Card visual ----
  // Ele existe porque antes desta entrega o 9:16 saia sempre no perfil `blur` (a fonte
  // deitada inteira, 608 de 1920 px de altura -- 32% do quadro, com o rosto pequeno no
  // telefone) e nao havia como escolher: o download tinha `'blur'` cravado no codigo.
  ok('o cartao do trecho tem o seletor de enquadramento',
    /<fieldset class="vop-reframe">/.test(html)
    && /<legend>Enquadramento<\/legend>/.test(html));
  ok('com as tres opcoes escritas por extenso (o rotulo nunca e a chave)',
    html.indexOf('Inteiro') > 0 && html.indexOf('1:1') > 0 && html.indexOf('4:5') > 0);
  ok('as tres sao do mesmo grupo, por trecho',
    (html.match(new RegExp('name="reframe-' + clipId + '"', 'g')) || []).length === 3);
  // O `crop` de quadro cheio amplia 1,78x numa fonte 16:9 e fica INTERNO: alcancavel so
  // editando a query, como sempre foi. Se ele vazar para a tela, o operador escolhe um
  // recorte que descarta 68% da largura sem saber.
  ok('e o crop de quadro cheio NAO e oferecido na tela',
    !/value="crop"/.test(html));
  ok('o padrao (Inteiro) ja vem marcado em trecho novo',
    new RegExp('value="blur"[^>]*checked').test(html)
    && !new RegExp('value="crop45"[^>]*checked').test(html));
  // O rotulo diz a PORCENTAGEM cortada: a previa do recorte e um overlay sobre o iframe do
  // YouTube, que so existe com a previa aberta -- sem o numero o operador escolheria as
  // cegas com ela fechada (BP-008).
  ok('cada opcao de recorte diz quanto corta, em texto (43,8% e 55%)',
    html.indexOf('43.8%') > 0 && html.indexOf('55%') > 0
    && html.indexOf('<small>') > 0);
  // Escolher passa pela MESMA delegacao do site, e `clipFieldWrite` NAO re-renderiza (o
  // `:checked` nativo ja mostra a escolha, e reescrever a lista tiraria o foco de quem
  // chegou pelo teclado). Ida e volta de aba para ler o ESTADO -- e prova de bonus que a
  // escolha sobrevive ao re-render.
  b.muda('[data-clip-field]', {
    value: 'crop45',
    dataset: { clipField: 'reframe', id: clipId },
  });
  b.aba('central');
  b.aba('youtube');
  html = b.html();
  ok('escolher 4:5 fica marcado no proximo render',
    new RegExp('value="crop45"[^>]*checked').test(html)
    && !new RegExp('value="blur"[^>]*checked').test(html));
  ok('nunca dois enquadramentos marcados ao mesmo tempo',
    (html.match(new RegExp('name="reframe-' + clipId + '"[^>]*checked', 'g')) || []).length === 1);
  // Valor torto vindo do DOM cai no padrao: o DOM e entrada, e um `reframe` desconhecido
  // atravessando ate o servidor renderizaria um recorte que nao existe.
  b.muda('[data-clip-field]', {
    value: '../etc/passwd',
    dataset: { clipField: 'reframe', id: clipId },
  });
  b.aba('central');
  b.aba('youtube');
  html = b.html();
  ok('valor torto no DOM cai no padrao em vez de vazar',
    new RegExp('value="blur"[^>]*checked').test(html));

  /* ---- a coluna da esquerda SEM a fonte importada --------------------------------------
     A distincao e o pedido em pessoa: "o quadro do COMECO DO CORTE" nao e "a imagem de capa
     do video". A capa e um instante qualquer escolhido por terceiro; o quadro do storyboard
     e o comeco DESTE corte. Trocar um pelo outro e a miniatura fingindo ser o trecho -- e na
     grade ela entra ROTULADA justamente por isso. No editor ela nao entra de jeito nenhum.
     Os tres ramos da queda sao cobertos, inclusive o que nao tem o que mostrar (BP-008). */
  b.clique({ act: 'yt-open', id: clipId });
  b.ops.__setStoryboard({
    sheets: ['https://i.ytimg.com/sb/abcdefghijk/storyboard3_L2/M0.jpg'],
    rows: 5, columns: 5, fps: 0.5
  });
  b.ops.__setSource({ state: 'idle', token: '', url: '', error: '', percent: 0 });
  b.muda('[data-yt-rights]', { checked: true });
  let esquerda = colunaEsquerda(b.html());
  ok('sem a fonte, a esquerda mostra o quadro do COMECO do corte',
    esquerda.indexOf('yt-stage-frame') > 0 && esquerda.indexOf('storyboard3_L2') > 0);
  ok('e nao escreve rotulo nem nota sobre o quadro',
    !/Quadro do começo deste corte/.test(esquerda) && esquerda.indexOf('yt-stage-note') < 0);
  ok('a CAPA do video NUNCA entra na coluna do editor',
    esquerda.indexOf('hqdefault.jpg') < 0 && esquerda.indexOf('Imagem do vídeo') < 0);
  ok('e a esquerda oferece a acao que resolve: importar o video',
    esquerda.indexOf('data-act="yt-import"') > 0);
  // Sem storyboard NEM fonte: dizer que nao ha quadro e melhor que inventar um.
  b.ops.__setStoryboard(null);
  b.muda('[data-yt-rights]', { checked: true });
  esquerda = colunaEsquerda(b.html());
  ok('sem storyboard, a moldura fica vazia (data-vazio), sem frase',
    /class="yt-stage-frame" data-vazio="1"/.test(esquerda) && esquerda.indexOf('Sem quadro deste trecho') < 0);
  ok('e nem ai a capa do video e usada como substituta',
    esquerda.indexOf('hqdefault.jpg') < 0 && esquerda.indexOf('Imagem do vídeo') < 0);
  ok('e continua oferecendo a importacao', esquerda.indexOf('data-act="yt-import"') > 0);
  // Sem a declaracao a importacao nao e oferecida -- e o motivo fica escrito (BP-008).
  b.muda('[data-yt-rights]', { checked: false });
  esquerda = colunaEsquerda(b.html());
  ok('sem a declaracao, importar fica desabilitado e a declaracao aparece acima (sem frase de motivo)',
    /data-act="yt-import" disabled/.test(esquerda) && !/Importar está bloqueado/.test(esquerda)
    && b.html().indexOf('data-yt-rights') > 0);
  b.clique({ act: 'yt-back' });

  /* ---- reabrir o projeto do MESMO video nao fecha o portao (2026-09-22) -----------------
     A declaracao vale "para esta sessao e para esta URL". Ate esta entrega abrir o projeto
     salvo a derrubava assim mesmo, com o arquivo ja no disco: o operador declarava,
     importava, voltava ao projeto do MESMO video e tinha de declarar de novo. */
  b.muda('[data-yt-rights]', { checked: true });
  await tick(); await tick();
  b.aba('projects');
  const projetoMesmo = (b.html().match(/data-project-id="([^"]+)"/) || [])[1];
  b.clique({ act: 'open-project', projectId: projetoMesmo });
  await tick(); await tick();
  html = b.html();
  ok('reabrir o projeto do MESMO video mantem a declaracao marcada',
    html.indexOf('data-yt-rights checked') > 0);
  ok('e a fonte volta religada, sem pedir "Importar video" de novo',
    /<video[^>]*data-src-video/.test(html));

  // Trocar a URL derruba as sugestões e a declaração do vídeo anterior.
  b.digita('[data-yt-url]', 'https://www.youtube.com/watch?v=zyxwvutsrqp');
  b.aba('youtube');
  html = b.html();
  ok('trocar de vídeo limpa as sugestões antigas', html.indexOf('O erro que custou caro') < 0);
  ok('trocar de vídeo exige declarar de novo', html.indexOf('data-yt-rights checked') < 0);

  // Helper fora do ar não pode falhar calado.
  global.fetch = function () { return Promise.reject(new Error('sem servidor')); };
  b.digita('[data-yt-url]', 'https://www.youtube.com/watch?v=abcdefghijk');
  b.clique({ act: 'yt-probe' });
  await tick(); await tick(); await tick();
  ok('helper fora do ar não derruba a tela', b.html().length > 500);

  /* ------------------------------------- Resultados: a delegação para o módulo vizinho
     A tela mora no `video-results.js`. Aqui prova-se a FIAÇÃO, não a lógica dela (que tem
     suíte própria): a aba monta, o clique `res-*` chega ao módulo pela delegação da raiz, e
     a ausência do arquivo não derruba o Estúdio. */
  b = bancada();
  b.aba('resultados');
  ok('a aba Resultados monta a tela do módulo vizinho',
    b.html().indexOf('Nenhuma publicação registrada') > 0);
  ok('e a tela nova não trouxe de volta o pipeline de publicação apagado',
    !/Aprovar|Drive|publicationPackage|data-act="post/.test(b.html()));
  b.clique({ act: 'res-new' });
  ok('o clique res-* é entregue ao módulo pela delegação da raiz',
    b.html().indexOf('Registrar uma publicação') > 0);
  b.clique({ act: 'res-cancel' });
  ok('e voltar também', b.html().indexOf('Nenhuma publicação registrada') > 0);

  // A bancada registra o módulo no `window` novo que ela cria, então apagar tem de ser
  // DEPOIS dela — apagar antes só seria desfeito pelo require seguinte.
  b = bancada();
  delete global.window.videoResults;
  b.aba('resultados');
  ok('sem o video-results.js a aba DIZ o motivo em vez de ficar vazia (BP-008)',
    b.html().indexOf('não carregou') > 0 && b.html().indexOf('video-results.js') > 0);
  b.aba('central');
  ok('e o resto do Estúdio continua funcionando sem ele', b.html().length > 500);

  /* -------------------------------------------------- a dica muda com a tela atual */
  b = bancada();
  const dicas = {};
  ['central', 'projects', 'youtube', 'resultados'].forEach(t => {
    b.aba(t);
    const achou = /class="vop-flow-hint">([^<]+)</.exec(b.html());
    dicas[t] = achou ? achou[1] : '';
    ok('a tela ' + t + ' tem dica escrita', dicas[t].length > 20);
  });
  ok('cada tela tem a sua dica', new Set(Object.values(dicas)).size === 4);

  console.log(provas + ' provas OK — DOM do Estúdio de Vídeos (' + path.basename(__filename) + ')');
}

main().catch(erro => { console.error(erro); process.exit(1); });
