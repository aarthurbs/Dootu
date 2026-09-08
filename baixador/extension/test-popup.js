// Provas do popup da extensao: deteccao da aba atual, validacao de URL e portao de direitos.
// Sem navegador e sem rede — o popup.js e carregado num contexto do `vm` com document,
// chrome e fetch de mentira. `node --check` nao pega erro de runtime no topo do arquivo
// (BP-012); este pega, porque executa o arquivo inteiro.
// Uso: node baixador/extension/test-popup.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FONTE = fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8');

const IDS = ['url', 'go', 'status', 'pct', 'bar', 'arquivo', 'erro',
  'aba-titulo', 'aba-url', 'aba-usar', 'direitos',
  'buscar', 'preview', 'pv-capa', 'pv-titulo', 'pv-criador', 'pv-dur', 'pv-fmt', 'pv-marca'];

function fakeEl(opcoes) {
  const cfg = opcoes || {};
  const el = {
    textContent: '', className: '', src: '', checked: false, disabled: false, hidden: false,
    children: [],
    _listeners: {},
    addEventListener(tipo, fn) { el._listeners[tipo] = fn; },
    dispatch(tipo) { return el._listeners[tipo] ? el._listeners[tipo]() : undefined; },
    appendChild(filho) { el.children.push(filho); return filho; },
    replaceChildren() { el.children.length = 0; }
  };
  let v = '';
  Object.defineProperty(el, 'value', {
    get() { return v; },
    // <select> de verdade: atribuir um valor que nao existe entre as opcoes resulta em "".
    // Sem isso a bancada aceitaria uma pre-selecao que o navegador recusaria.
    set(novo) {
      v = (cfg.select && !el.children.some((o) => o.value === String(novo)))
        ? '' : String(novo);
    }
  });
  return el;
}

// Um /inspect de mentira com os campos que o helper realmente manda.
function inspecao(extra) {
  return Object.assign({
    url: 'https://www.tiktok.com/@perfil/video/7000000000000000000',
    videoId: '7000000000000000000',
    titulo: 'Corte de podcast',
    criador: 'perfil',
    duracao: 58,
    thumbnail: 'https://p16.tiktokcdn.com/capa.jpeg',
    escolhido: 'h264_720p',
    soComMarca: false,
    formatos: [
      { id: 'h264_720p', rotulo: '720x1280 · h264 · sem confirmação', marca: 'desconhecida',
        evidencia: 'o extrator não declara marca d’água para este formato' },
      { id: 'download', rotulo: 'resolução desconhecida · com marca', marca: 'com-marca',
        evidencia: 'o yt-dlp rotula este formato como "watermarked"' }
    ]
  }, extra || {});
}

/* Uma bancada por cenario: o popup.js e reexecutado do zero, entao nada vaza de um caso
   para o outro (mesma regra da bancada do test-video-ops-dom.js). */
function bancada(opcoes) {
  const cfg = opcoes || {};
  const els = {};
  IDS.forEach((id) => { els[id] = fakeEl({ select: id === 'pv-fmt' }); });
  const chamadas = [];

  // Resposta com `ok`/`status`, porque o popup decide o ramo de erro por `res.ok` — bancada
  // que so devolve `json` esconderia justamente o caminho de falha.
  const resposta = (corpo, codigo) => Promise.resolve({
    ok: (codigo || 200) < 400,
    status: codigo || 200,
    json: () => Promise.resolve(corpo)
  });

  const ctx = {
    console,
    setInterval() { return 1; },
    clearInterval() {},
    URL,
    document: {
      getElementById: (id) => els[id] || null,
      createElement: () => fakeEl()
    },
    chrome: cfg.semChrome ? undefined : {
      tabs: {
        query: () => (cfg.abaErro
          ? Promise.reject(new Error('sem permissao'))
          : Promise.resolve(cfg.abas || []))
      }
    },
    fetch: (endereco, opts) => {
      const rota = String(endereco).replace('http://127.0.0.1:8770', '');
      chamadas.push({ rota, corpo: opts && opts.body ? JSON.parse(opts.body) : null });
      if (cfg.helperMorto) return Promise.reject(new Error('ECONNREFUSED'));
      if (rota === '/health') return resposta(cfg.saude || { status: 'ok' });
      if (rota === '/current') return resposta(cfg.atual || {});
      if (rota === '/inspect') {
        return cfg.inspectErro
          ? resposta(cfg.inspectErro, 502)
          : resposta(cfg.inspect || inspecao());
      }
      if (rota === '/download') return resposta(cfg.download || { id: 'trabalho1' });
      if (rota.startsWith('/status/')) return resposta(cfg.status || { status: 'queued' });
      return resposta({});
    }
  };
  vm.createContext(ctx);
  vm.runInContext(FONTE, ctx);
  return { els, ctx, chamadas };
}

// Os IIFE do popup sao assincronos; um tick da microfila basta para eles terminarem.
const assenta = () => new Promise((r) => setImmediate(r));

let N = 0;
function ck(cond, msg) { assert.ok(cond, msg); N += 1; }

(async function () {
  // --- 1. reconstrucao do id: so YouTube, so 11 caracteres --------------------------
  const { ctx } = bancada({});
  const id = ctx.ytWatchId;
  ck(id('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'watch?v= comum');
  ck(id('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'youtu.be curto');
  ck(id('https://m.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'youtube mobile');
  ck(id('https://www.youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'shorts');
  ck(id('https://www.youtube.com/live/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'live');
  ck(id('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s') === 'dQw4w9WgXcQ',
    'parametro a mais nao atrapalha');

  // Recusas: host alheio, esquema perigoso, id de tamanho errado, pagina que nao e video.
  [
    'https://vimeo.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.golpe.net/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    'file:///c:/windows/system32',
    'https://www.youtube.com/watch?v=curto',
    'https://www.youtube.com/watch?v=' + 'a'.repeat(12),
    'https://www.youtube.com/',
    'https://www.youtube.com/results?search_query=x',
    'https://www.youtube.com/@canal',
    'https://www.youtube.com/playlist?list=PL123',
    'nao e url', '', null, undefined
  ].forEach((ruim) => {
    ck(id(ruim) === '', 'recusa ' + String(ruim).slice(0, 40));
  });
  // O id so pode conter o alfabeto do YouTube: nada que vire caminho ou opcao de processo.
  ck(id('https://www.youtube.com/watch?v=../../etc/pw') === '', 'travessia recusada');
  ck(id('https://www.youtube.com/watch?v=-oProibido') === '', 'id com hifen inicial e curto');

  // --- 2. aba atual E um video: prefill, nunca download ------------------------------
  const yt = bancada({
    abas: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Podcast de negocios' }]
  });
  await assenta();
  ck(yt.els.url.value === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'a URL da aba entra no campo sozinha');
  ck(yt.els['aba-titulo'].textContent === 'Podcast de negocios', 'o titulo aparece');
  ck(yt.els['aba-url'].textContent.includes('dQw4w9WgXcQ'), 'e o endereco curto tambem');
  ck(yt.els['aba-usar'].hidden === false, 'o botao "Usar este video" aparece');
  ck(yt.els.go.disabled === true,
    'MAS o botao Baixar continua travado: detectar nao e autorizar');

  // --- 3. aba que NAO e video do YouTube: estado explicito ---------------------------
  const outra = bancada({ abas: [{ url: 'https://news.ycombinator.com/', title: 'HN' }] });
  await assenta();
  ck(/n[aã]o é um vídeo do YouTube/i.test(outra.els['aba-url'].textContent),
    'diz que a aba nao e um video do YouTube');
  ck(/colar uma URL/i.test(outra.els['aba-url'].textContent),
    'e lembra que da para colar a URL na mao');
  ck(outra.els.url.value === '', 'nada foi preenchido');
  ck(outra.els['aba-usar'].hidden === true, 'e nao oferece "usar este video"');

  // Sem permissao / sem API / sem aba: tambem fala, nunca fica mudo (BP-008).
  for (const cenario of [{ abaErro: true }, { semChrome: true }, { abas: [] }]) {
    const b = bancada(cenario);
    await assenta();
    ck(b.els['aba-url'].textContent.length > 0,
      'sem aba legivel o popup ainda diz alguma coisa');
    ck(b.els.go.disabled === true, 'e o botao segue travado');
  }

  // --- 4. portao de direitos ---------------------------------------------------------
  const g = bancada({ abas: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] });
  await assenta();
  ck(g.els.go.disabled === true, 'sem declaracao o download fica travado');
  g.els.direitos.checked = true;
  g.els.direitos.dispatch('change');
  ck(g.els.go.disabled === false, 'declarou -> libera');

  // Trocar o video DERRUBA a autorizacao do video anterior.
  g.els.url.value = 'https://www.youtube.com/watch?v=OUTRO_VIDEO';
  g.els.url.dispatch('input');
  ck(g.els.direitos.checked === false,
    'trocar de video desmarca a declaracao do video anterior');
  ck(g.els.go.disabled === true, 'e volta a travar o download');

  // Declarar de novo vale para a URL NOVA, e so para ela.
  g.els.direitos.checked = true;
  g.els.direitos.dispatch('change');
  ck(g.els.go.disabled === false, 'declarar de novo libera a URL nova');
  g.els.url.value = '';
  g.els.url.dispatch('input');
  ck(g.els.go.disabled === true, 'campo vazio trava de novo');

  // Declarar com o campo VAZIO nao cobre a URL colada depois. E o caminho comum: aba que
  // nao e YouTube deixa o campo vazio, e marcar a caixa ali nao pode autorizar o proximo
  // video que aparecer. A declaracao nasce sem alcance e a primeira URL a derruba.
  const vazio = bancada({ abas: [{ url: 'https://news.ycombinator.com/' }] });
  await assenta();
  vazio.els.direitos.checked = true;
  vazio.els.direitos.dispatch('change');
  ck(vazio.els.go.disabled === true, 'declarar com o campo vazio nao libera nada');
  vazio.els.url.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  vazio.els.url.dispatch('input');
  ck(vazio.els.direitos.checked === false,
    'colar uma URL depois NAO herda a declaracao feita com o campo vazio');
  ck(vazio.els.go.disabled === true, 'e o download continua travado');

  // Servico fora do ar: nem a declaracao libera o botao.
  const morto = bancada({
    saude: { status: 'error', error: 'yt-dlp ausente' },
    abas: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }]
  });
  await assenta();
  morto.els.direitos.checked = true;
  morto.els.direitos.dispatch('change');
  ck(morto.els.go.disabled === true, 'helper indisponivel manda mais que a declaracao');
  ck(morto.els.erro.textContent.includes('yt-dlp'), 'e o motivo aparece na tela');

  // --- 5. o clique confere o portao DE NOVO, na hora de baixar -----------------------
  const c = bancada({ abas: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] });
  await assenta();
  c.els.direitos.checked = true;
  c.els.direitos.dispatch('change');
  // Desmarcar sem disparar o evento simula a caixa mudando entre habilitar e clicar.
  c.els.direitos.checked = false;
  await c.els.go._listeners.click();
  ck(/autoriza/i.test(c.els.erro.textContent),
    'clicar com a declaracao desmarcada e recusado, com motivo');
  ck(c.els.go.disabled === true, 'e o botao volta a travar');

  // --- 6. resumo da analise: os quatro estados sao ditos -----------------------------
  const resumo = ctx.resumoAnalise;
  ck(/2 trecho/.test(resumo({ mostReplayed: { available: true, peaks: [1, 2] } })),
    'com audiencia, diz quantos trechos');
  ck(/não publica/.test(resumo({
    mostReplayed: { available: false, reason: 'MOST_REPLAYED_NOT_AVAILABLE' }
  })), 'sem grafico, diz que o video nao publica');
  ck(/falha ao extrair “Mais/.test(resumo({
    mostReplayed: { available: false, reason: 'MOST_REPLAYED_EXTRACTION_FAILED' }
  })), 'falha de extracao e DITA como falha');
  ck(/legenda pt-BR: 12 fala/.test(resumo({
    captions: { available: true, language: 'pt-BR', kind: 'manual', count: 12 }
  })), 'com legenda, diz idioma e quantidade');
  ck(/automática/.test(resumo({
    captions: { available: true, language: 'pt', kind: 'automatica', count: 3 }
  })), 'legenda automatica e identificada como automatica');
  ck(/sem legenda em português/.test(resumo({
    captions: { available: false, reason: 'CAPTIONS_NOT_AVAILABLE' }
  })), 'sem legenda, diz sem legenda');
  ck(/falha ao extrair a legenda/.test(resumo({
    captions: { available: false, reason: 'CAPTIONS_EXTRACTION_FAILED' }
  })), 'falha na legenda e distinta de ausencia');
  ck(resumo({}) === '', 'sem nenhum dos dois blocos, nao inventa texto');

  // --- 7. referencia do TikTok: so video publico, endereco remontado do id ------------
  const tk = ctx.tiktokRef;
  ck(tk('https://www.tiktok.com/@perfil/video/7000000000000000000').url
    === 'https://www.tiktok.com/@perfil/video/7000000000000000000', 'link completo');
  ck(tk('https://m.tiktok.com/@perfil/video/7000000000000000000').url
    === 'https://www.tiktok.com/@perfil/video/7000000000000000000',
    'host mobile e remontado para o www, que e o que o yt-dlp aceita');
  ck(tk('https://www.tiktok.com/@perfil/video/7000000000000000000?is_from_webapp=1&x=y').url
    === 'https://www.tiktok.com/@perfil/video/7000000000000000000',
    'parametro de rastreio da barra nao chega ao yt-dlp');
  ck(tk('https://www.tiktok.com/share/video/7000000000000000000').tipo === 'video',
    'forma /share/video/');
  ck(tk('https://vm.tiktok.com/ZTR45GpSF/').tipo === 'curto', 'link curto vm.');
  ck(tk('https://vt.tiktok.com/ZSe4FqkKd').tipo === 'curto', 'link curto vt.');
  ck(tk('https://www.tiktok.com/t/ZTR45GpSF/').tipo === 'curto', 'link curto /t/');
  ck(tk('https://www.tiktok.com/@perfil/photo/7000000000000000000').tipo === 'foto',
    'publicacao de fotos e reconhecida como tipo NAO suportado, nao como lixo');
  [
    'https://tiktok.com.golpe.net/@x/video/7000000000000000000',
    'https://www.tiktok.com/@perfil',
    'https://www.tiktok.com/music/algo-123',
    'https://www.tiktok.com/@perfil/video/12',      // id curto demais
    'https://www.tiktok.com/@perfil/video/../../etc',
    'javascript:alert(1)', 'file:///c:/windows', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'nao e url', '', null, undefined
  ].forEach((ruim) => {
    ck(tk(ruim).tipo === '', 'recusa ' + String(ruim).slice(0, 42));
  });

  // --- 8. aba do TikTok: prefill, e o botao Baixar continua travado -------------------
  const abaTk = bancada({
    abas: [{ url: 'https://www.tiktok.com/@perfil/video/7000000000000000000?is_from_webapp=1',
             title: 'Corte de podcast' }]
  });
  await assenta();
  ck(abaTk.els.url.value === 'https://www.tiktok.com/@perfil/video/7000000000000000000',
    'a aba do TikTok entra no campo ja canonizada');
  ck(abaTk.els['aba-usar'].hidden === false, 'e oferece "usar este video"');
  ck(abaTk.els.go.disabled === true, 'MAS baixar segue travado: detectar nao e autorizar');
  ck(abaTk.els.buscar.disabled === false, 'e "Buscar video" fica disponivel');

  const abaFoto = bancada({
    abas: [{ url: 'https://www.tiktok.com/@perfil/photo/7000000000000000000' }]
  });
  await assenta();
  ck(/fotos do TikTok/i.test(abaFoto.els['aba-url'].textContent),
    'aba de fotos diz que e fotos, em vez de "nao e video" generico');
  ck(abaFoto.els.url.value === '', 'e nao preenche nada');

  // --- 9. buscar: preview honesto, e o formato marcado NUNCA vem pre-escolhido --------
  const busca = bancada({ abas: [] });
  await assenta();
  busca.els.url.value = 'https://www.tiktok.com/@perfil/video/7000000000000000000';
  busca.els.url.dispatch('input');
  ck(busca.els.buscar.disabled === false, 'com URL de TikTok, o botao de busca libera');
  await busca.els.buscar.dispatch('click');
  ck(busca.els.preview.hidden === false, 'o cartao aparece depois da busca');
  ck(busca.els['pv-titulo'].textContent === 'Corte de podcast', 'com o titulo');
  ck(busca.els['pv-criador'].textContent === '@perfil', 'com o criador');
  ck(busca.els['pv-dur'].textContent === '0:58', 'com a duracao em min:seg');
  ck(busca.els['pv-capa'].hidden === false, 'e com a miniatura, quando existe');
  ck(busca.els['pv-fmt'].children.length === 2, 'as duas qualidades viram opcoes');
  ck(busca.els['pv-fmt'].value === 'h264_720p',
    'a pre-escolha e a variante NAO marcada, nunca a marcada');
  ck(/não confirmada/i.test(busca.els['pv-marca'].textContent),
    'e a linha da marca d agua diz "nao confirmada" em vez de fingir "sem marca"');
  ck(busca.els['pv-marca'].className.includes('desconhecida'), 'com o estado na classe');
  ck(busca.els.go.disabled === true, 'buscar NAO libera o download: falta declarar');

  // Escolher a variante marcada troca a frase — e ela nao mente sobre o que e.
  busca.els['pv-fmt'].value = 'download';
  busca.els['pv-fmt'].dispatch('change');
  ck(/Com marca d’água/.test(busca.els['pv-marca'].textContent),
    'variante marcada e anunciada como marcada');
  ck(busca.els['pv-marca'].className.includes('com-marca'), 'e o estado muda de classe');

  // Declarou -> libera, e o pedido leva o formatId escolhido.
  busca.els.direitos.checked = true;
  busca.els.direitos.dispatch('change');
  ck(busca.els.go.disabled === false, 'declaracao + formato escolhido libera o download');
  await busca.els.go.dispatch('click');
  const pedido = busca.chamadas.filter((c) => c.rota === '/download').pop();
  ck(pedido && pedido.corpo.formatId === 'download',
    'o download leva o formato ESCOLHIDO, nao o padrao do yt-dlp');
  ck(pedido.corpo.url === 'https://www.tiktok.com/@perfil/video/7000000000000000000',
    'e a URL canonica');

  // --- 10. so ha variante marcada: nada vem escolhido, e o texto diz por que ----------
  const marcado = bancada({
    inspect: inspecao({
      soComMarca: true, escolhido: '',
      formatos: [{ id: 'download', rotulo: 'com marca', marca: 'com-marca',
                   evidencia: 'o yt-dlp rotula este formato como "watermarked"' }]
    })
  });
  await assenta();
  marcado.els.url.value = 'https://www.tiktok.com/@perfil/video/7000000000000000000';
  marcado.els.url.dispatch('input');
  await marcado.els.buscar.dispatch('click');
  ck(marcado.els['pv-fmt'].value === '', 'nenhuma qualidade vem pre-escolhida');
  ck(/todas as variantes/i.test(marcado.els['pv-marca'].textContent),
    'e a tela diz que TODAS tem marca d agua');
  marcado.els.direitos.checked = true;
  marcado.els.direitos.dispatch('change');
  ck(marcado.els.go.disabled === true,
    'nem declarando libera: baixar variante marcada exige escolher a dedo');
  marcado.els['pv-fmt'].value = 'download';
  marcado.els['pv-fmt'].dispatch('change');
  ck(marcado.els.go.disabled === false, 'escolha explicita libera — e so ela');

  // --- 11. falhas da busca: cada uma com o seu motivo --------------------------------
  const falhou = bancada({ inspectErro: { error: 'Vídeo indisponível ou privado.' } });
  await assenta();
  falhou.els.url.value = 'https://www.tiktok.com/@perfil/video/7000000000000000000';
  falhou.els.url.dispatch('input');
  await falhou.els.buscar.dispatch('click');
  ck(falhou.els.erro.textContent === 'Vídeo indisponível ou privado.',
    'o motivo vindo do helper aparece cru na tela');
  ck(falhou.els.preview.hidden === true, 'e o cartao NAO abre com dados velhos');
  ck(falhou.els.go.disabled === true, 'nem o download libera');

  const offline = bancada({ helperMorto: true });
  await assenta();
  ck(/start-downloader/.test(offline.els.erro.textContent),
    'helper desligado ensina o comando que liga o servico');
  ck(offline.els.buscar.disabled === true, 'e o botao de busca fica travado');

  // URL que nao e do TikTok: buscar diz o que aceita, em vez de ficar mudo (BP-008).
  const naoTk = bancada({});
  await assenta();
  naoTk.els.url.value = 'https://vimeo.com/12345';
  naoTk.els.url.dispatch('input');
  ck(naoTk.els.buscar.disabled === true, 'sem link de TikTok o botao de busca fica travado');
  await naoTk.els.buscar.dispatch('click');
  ck(/TikTok/.test(naoTk.els.erro.textContent), 'e clicar mesmo assim explica o que aceita');

  // --- 12. trocar a URL depois de buscar invalida o cartao ----------------------------
  const trocou = bancada({});
  await assenta();
  trocou.els.url.value = 'https://www.tiktok.com/@perfil/video/7000000000000000000';
  trocou.els.url.dispatch('input');
  await trocou.els.buscar.dispatch('click');
  trocou.els.direitos.checked = true;
  trocou.els.direitos.dispatch('change');
  ck(trocou.els.go.disabled === false, 'liberado para o video buscado');
  trocou.els.url.value = 'https://www.tiktok.com/@outro/video/7111111111111111111';
  trocou.els.url.dispatch('input');
  ck(trocou.els.preview.hidden === true,
    'trocar de video some com o cartao — ninguem olha a marca d agua de um e baixa outro');
  ck(trocou.els.go.disabled === true, 'e o download volta a travar');

  // --- 13. popup fecha e reabre: a verdade vem do helper -----------------------------
  const voltou = bancada({
    atual: { id: 'trabalho1', status: 'downloading', progress: 40 }
  });
  await assenta();
  ck(/40%/.test(voltou.els.status.textContent),
    'reabrir o popup reencontra o download em andamento, com o progresso de verdade');
  ck(voltou.els.go.disabled === true, 'e o botao fica travado enquanto ele roda');

  const reiniciado = bancada({ atual: {} });
  await assenta();
  ck(reiniciado.els.arquivo.textContent === '',
    'helper reiniciado nao ressuscita "concluido" nenhum');
  ck(!/Conclu/.test(reiniciado.els.status.textContent),
    'e o arquivo pela metade nunca aparece como pronto');

  const terminado = bancada({
    atual: { id: 't1', status: 'completed', progress: 100, filename: 'perfil-700.mp4',
             watermark: { status: 'desconhecida', evidence: 'o extrator não declara' } }
  });
  await assenta();
  ck(/perfil-700\.mp4/.test(terminado.els.arquivo.textContent),
    'download que terminou com o popup fechado aparece ao reabrir');
  ck(/não confirmada/i.test(terminado.els.arquivo.textContent),
    'com o estado da marca d agua do arquivo QUE FOI SALVO');

  // --- 14. YouTube nao muda de comportamento ----------------------------------------
  const yt2 = bancada({ abas: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] });
  await assenta();
  ck(yt2.els.buscar.disabled === true, 'no YouTube nao existe passo de busca');
  yt2.els.direitos.checked = true;
  yt2.els.direitos.dispatch('change');
  ck(yt2.els.go.disabled === false, 'e declarar continua liberando direto');
  await yt2.els.go.dispatch('click');
  const pedidoYt = yt2.chamadas.filter((c) => c.rota === '/download').pop();
  ck(pedidoYt && pedidoYt.corpo.url === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'o pedido do YouTube sai igual ao de antes');
  ck(pedidoYt && !('formatId' in pedidoYt.corpo),
    'e SEM formatId: o caminho do YouTube nao ganhou seletor de formato');

  // --- 15. a frase do arquivo salvo nao promete o que nao foi confirmado -------------
  const frase = ctx.resumoArquivo;
  ck(/Sem marca d’água do TikTok \(confirmado/.test(
    frase({ filename: 'a.mp4', watermark: { status: 'sem-marca' } })),
    'sem-marca confirmado e dito como confirmado');
  ck(!/[Ss]em marca/.test(
    frase({ filename: 'a.mp4', watermark: { status: 'desconhecida' } })),
    'desconhecida NUNCA vira "sem marca"');
  ck(frase({ filename: 'a.mp4', watermark: { status: 'nao-se-aplica' } }) === 'a.mp4',
    'fora do TikTok a linha nao ganha frase de marca d agua nenhuma');
  ck(ctx.formataDur(58) === '0:58' && ctx.formataDur(0) === '' && ctx.formataDur(605) === '10:05',
    'duracao ausente fica ausente, em vez de virar 0:00');

  console.log(`${N} provas OK — popup da extensao (aba atual, URL, portao de direitos, `
    + 'TikTok: busca, marca d\u2019agua, retomada)');
})().catch((err) => { console.error(err); process.exit(1); });
