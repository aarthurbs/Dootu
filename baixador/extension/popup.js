const BASE = 'http://127.0.0.1:8770';

const urlEl = document.getElementById('url');
const btn = document.getElementById('go');
const buscarEl = document.getElementById('buscar');
const statusEl = document.getElementById('status');
const pctEl = document.getElementById('pct');
const barEl = document.getElementById('bar');
const arquivoEl = document.getElementById('arquivo');
const erroEl = document.getElementById('erro');
const abaTituloEl = document.getElementById('aba-titulo');
const abaUrlEl = document.getElementById('aba-url');
const abaUsarEl = document.getElementById('aba-usar');
const direitosEl = document.getElementById('direitos');
const previewEl = document.getElementById('preview');
const pvCapaEl = document.getElementById('pv-capa');
const pvTituloEl = document.getElementById('pv-titulo');
const pvCriadorEl = document.getElementById('pv-criador');
const pvDurEl = document.getElementById('pv-dur');
const pvFmtEl = document.getElementById('pv-fmt');
const pvMarcaEl = document.getElementById('pv-marca');

let timer = null;
let servicoOk = false;
// URL coberta pela declaracao de direitos. Trocar de video derruba a autorizacao: uma
// declaracao feita para OUTRO video nao vale para este.
let urlAutorizada = '';
// URL canonica que o cartao de pre-visualizacao esta mostrando AGORA. Enquanto ela nao
// bater com o campo, o download do TikTok fica travado: baixar sem ter buscado seria
// escolher formato no escuro -- e o formato e justamente o que decide a marca d'agua.
let inspecionada = '';
let formatosAtuais = [];
let soComMarcaAtual = false;
let buscando = false;
let baixando = false;

// --- video da aba atual -------------------------------------------------------------

// Mesma regra do video_id() em video-worker/ytclip.py: host fechado + id de 11 caracteres.
// Repetida aqui (e nao importada) porque a extensao nao carrega nada do repositorio; o
// portao que conta continua sendo o do helper, este so decide o que a tela oferece.
const YT_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
                  'music.youtube.com'];
const YT_ID_RX = /^[A-Za-z0-9_-]{11}$/;

function ytWatchId(bruta) {
  let p;
  try { p = new URL(String(bruta || '')); } catch { return ''; }
  if (p.protocol !== 'http:' && p.protocol !== 'https:') return '';
  if (!YT_HOSTS.includes(p.hostname.toLowerCase())) return '';
  let achado = '';
  if (p.hostname.toLowerCase() === 'youtu.be') {
    achado = p.pathname.slice(1).split('/')[0];
  } else if (/^\/(shorts|live|embed|v)\//.test(p.pathname)) {
    achado = p.pathname.split('/')[2] || '';
  } else {
    achado = p.searchParams.get('v') || '';
  }
  return YT_ID_RX.test(achado) ? achado : '';
}

// Espelho enxuto do tiktok.analisa() do helper. A extensao so precisa saber O QUE oferecer
// na tela; quem valida de verdade -- e quem resolve o link curto, que exige rede -- e o
// helper. Link curto sai daqui como 'curto' de proposito: sem host permission para
// tiktok.com, o popup nao pode (nem deve) seguir redirecionamento.
const TT_HOSTS = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com',
                  'vt.tiktok.com', 'tiktokv.com', 'www.tiktokv.com'];
const TT_CURTOS = ['vm.tiktok.com', 'vt.tiktok.com'];
const TT_VIDEO_RX = /^\/(?:@[\w.-]{1,40}\/)?(?:video|v)\/(\d{6,25})/;
const TT_SHARE_RX = /^\/(?:share\/video|embed)\/(\d{6,25})/;
const TT_FOTO_RX = /^\/(?:@[\w.-]{1,40}\/)?photo\/(\d{6,25})/;
const TT_CODIGO_RX = /^\/([A-Za-z0-9]{4,32})\/?$/;

function tiktokRef(bruta) {
  const nada = { tipo: '', url: '' };
  let p;
  try { p = new URL(String(bruta || '')); } catch { return nada; }
  if (p.protocol !== 'http:' && p.protocol !== 'https:') return nada;
  const host = p.hostname.toLowerCase();
  if (!TT_HOSTS.includes(host)) return nada;
  const caminho = p.pathname || '/';

  if (TT_FOTO_RX.test(caminho)) return { tipo: 'foto', url: '' };

  let m = TT_VIDEO_RX.exec(caminho);
  if (m) {
    const perfil = /^\/@([\w.-]{1,40})\//.exec(caminho);
    // Endereco REMONTADO do id validado, nunca a string da barra (mesma regra do YouTube).
    return { tipo: 'video',
             url: perfil ? 'https://www.tiktok.com/@' + perfil[1] + '/video/' + m[1]
                         : 'https://www.tiktok.com/share/video/' + m[1] };
  }
  m = TT_SHARE_RX.exec(caminho);
  if (m) return { tipo: 'video', url: 'https://www.tiktok.com/share/video/' + m[1] };

  if (TT_CURTOS.includes(host)) {
    m = TT_CODIGO_RX.exec(caminho);
    if (m) return { tipo: 'curto', url: 'https://' + host + '/' + m[1] };
  } else if (caminho.startsWith('/t/')) {
    m = TT_CODIGO_RX.exec(caminho.slice(2));
    if (m) return { tipo: 'curto', url: 'https://www.tiktok.com/t/' + m[1] };
  }
  return nada;
}

// URL que ainda precisa passar pelo /inspect antes de virar download.
function precisaBuscar(url) {
  const t = tiktokRef(url).tipo;
  return t === 'video' || t === 'curto';
}

function abaRecado(texto) {
  abaTituloEl.textContent = '';
  abaUrlEl.textContent = texto;
  abaUsarEl.hidden = true;
}

// A URL entregue ao helper e RECONSTRUIDA a partir do id validado, nunca a string da aba.
function abaAplica(id, titulo) {
  urlEl.value = 'https://www.youtube.com/watch?v=' + id;
  abaTituloEl.textContent = titulo || '';
  abaUrlEl.textContent = 'youtube.com/watch?v=' + id;
  abaUsarEl.hidden = false;
  limpaPreview();
  atualizaBotao();
}

function abaAplicaTikTok(url, titulo) {
  urlEl.value = url;
  abaTituloEl.textContent = titulo || '';
  abaUrlEl.textContent = url.replace(/^https:\/\//, '');
  abaUsarEl.hidden = false;
  limpaPreview();
  atualizaBotao();
}

(async function detectaAba() {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
    abaRecado('Não consegui ler a aba atual. Cole a URL abaixo.');
    return;
  }
  let guias;
  try {
    guias = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    // activeTab so vale a partir do clique na acao; sem ela a aba nao e legivel.
    abaRecado('Não consegui ler a aba atual. Cole a URL abaixo.');
    return;
  }
  const guia = (guias || [])[0] || {};
  const id = ytWatchId(guia.url);
  if (id) {
    // Prefill, nunca download: o operador ainda precisa declarar e clicar (BP-008).
    abaAplica(id, guia.title || '');
    return;
  }
  const tk = tiktokRef(guia.url);
  if (tk.tipo === 'video' || tk.tipo === 'curto') {
    abaAplicaTikTok(tk.url, guia.title || '');
    return;
  }
  if (tk.tipo === 'foto') {
    abaRecado('A aba atual é uma publicação de fotos do TikTok — só vídeo é suportado. '
      + 'Você ainda pode colar uma URL abaixo.');
    return;
  }
  // Estado explicito: "nao e video" nunca pode ser indistinguivel de "nao olhei".
  abaRecado('A aba atual não é um vídeo do YouTube nem do TikTok. Você ainda pode colar '
    + 'uma URL abaixo.');
})();

abaUsarEl.addEventListener('click', () => {
  const id = ytWatchId(urlEl.value) || ytWatchId(abaUrlEl.textContent);
  if (id) { abaAplica(id, abaTituloEl.textContent); return; }
  const tk = tiktokRef(urlEl.value);
  if (tk.tipo === 'video' || tk.tipo === 'curto') {
    abaAplicaTikTok(tk.url, abaTituloEl.textContent);
  }
});

// --- portao de direitos --------------------------------------------------------------

function atualizaBotao() {
  const url = urlEl.value.trim();
  // A declaracao vale para UMA URL. Qualquer divergencia derruba a caixa em vez de herdar o
  // "sim": tanto trocar de video quanto marcar a caixa antes de ter URL e colar uma depois.
  if (direitosEl.checked && urlAutorizada !== url) {
    direitosEl.checked = false;
    urlAutorizada = '';
  }
  const tt = precisaBuscar(url);
  buscarEl.disabled = !servicoOk || !tt || buscando || baixando;
  btn.disabled = !servicoOk || !url || !direitosEl.checked || baixando
    || (tt && (inspecionada !== url || !pvFmtEl.value));
}

urlEl.addEventListener('input', () => {
  // O cartao e do video que estava no campo. Mudou o campo, o cartao deixa de valer --
  // senao o operador olharia a marca d'agua de um video e baixaria outro.
  if (urlEl.value.trim() !== inspecionada) limpaPreview();
  atualizaBotao();
});
// Marcar a caixa E o ato de declarar: e aqui, e so aqui, que uma URL passa a ficar coberta.
// Com o campo vazio nao ha o que declarar, entao a declaracao nasce sem alcance nenhum.
direitosEl.addEventListener('change', () => {
  urlAutorizada = direitosEl.checked ? urlEl.value.trim() : '';
  atualizaBotao();
});

// O servidor sempre responde JSON, mas se ele morrer no meio da resposta
// nao vale derrubar a UI com SyntaxError.
async function corpo(res) {
  try { return await res.json(); } catch { return {}; }
}

function mostra(texto, pct) {
  statusEl.textContent = texto;
  if (typeof pct === 'number') {
    pctEl.textContent = Math.round(pct) + '%';
    barEl.value = pct;
  }
}

function falha(msg) {
  erroEl.textContent = msg;
  statusEl.textContent = 'Erro';
  baixando = false;
  // Liberar por atualizaBotao (e nao por `disabled = false`) mantem o portao de direitos de
  // pe depois de um erro: sem isso, uma falha reabilitaria o botao com a caixa desmarcada.
  atualizaBotao();
}

function para() {
  clearInterval(timer);
  timer = null;
}

// --- pre-visualizacao do TikTok --------------------------------------------------------

// Espelho das frases do helper (tiktok.FRASE + o estado "nao-se-aplica"). A extensao nao
// carrega nada do repositorio, entao a copia e inevitavel -- o test_helper.py confere que
// os QUATRO estados que o helper sabe emitir existem aqui, para os dois lados nao
// divergirem calados (corolario do BP-014).
const frasesMarca = {
  'sem-marca': 'Sem marca d’água do TikTok (confirmado pelo extrator)',
  'desconhecida': 'Marca d’água não confirmada — o extrator não declara o estado desta variante',
  'com-marca': 'Com marca d’água do TikTok',
  'nao-se-aplica': 'Fonte sem marca d’água adicionada pela plataforma',
};

function formataDur(seg) {
  const t = Math.round(Number(seg) || 0);
  if (!t) return '';
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

function limpaPreview() {
  previewEl.hidden = true;
  inspecionada = '';
  formatosAtuais = [];
  soComMarcaAtual = false;
  pvFmtEl.replaceChildren();
  pvFmtEl.value = '';
}

function atualizaMarca() {
  const f = formatosAtuais.find((x) => x.id === pvFmtEl.value);
  if (!f) {
    // Nenhum ramo fica mudo: sem escolha o texto diz POR QUE nao ha estado a mostrar.
    pvMarcaEl.className = 'pv-marca';
    pvMarcaEl.textContent = soComMarcaAtual
      ? 'Todas as variantes que o TikTok oferece para este vídeo têm marca d’água. '
        + 'Escolha uma para baixar assim mesmo, ou desista deste vídeo.'
      : 'Escolha uma qualidade para ver o estado da marca d’água.';
    return;
  }
  pvMarcaEl.className = 'pv-marca ' + f.marca;
  pvMarcaEl.textContent = (frasesMarca[f.marca] || f.marca) + ' — ' + (f.evidencia || '');
}

function mostraPreview(dados) {
  const antes = urlEl.value.trim();
  inspecionada = dados.url || '';
  // O campo passa a mostrar a URL que sera REALMENTE baixada (link curto vira endereco
  // completo). Se ela mudou, o portao de direitos cai junto -- a declaracao era para a
  // outra string -- e o status abaixo diz isso, em vez de a caixa desmarcar calada.
  urlEl.value = inspecionada;
  formatosAtuais = dados.formatos || [];
  soComMarcaAtual = !!dados.soComMarca;

  pvTituloEl.textContent = dados.titulo || '(sem título)';
  pvCriadorEl.textContent = dados.criador ? '@' + dados.criador : 'criador desconhecido';
  pvDurEl.textContent = formataDur(dados.duracao) || 'duração desconhecida';
  if (dados.thumbnail) {
    pvCapaEl.src = dados.thumbnail;
    pvCapaEl.hidden = false;
  } else {
    pvCapaEl.hidden = true;
  }

  pvFmtEl.replaceChildren();
  if (soComMarcaAtual) {
    // Sem opcao pre-escolhida: baixar variante marcada e escolha DITA, nunca o padrao.
    const vazio = document.createElement('option');
    vazio.value = '';
    vazio.textContent = '— escolha uma opção —';
    pvFmtEl.appendChild(vazio);
  }
  formatosAtuais.forEach((f) => {
    const op = document.createElement('option');
    op.value = f.id;
    // textContent: o rotulo carrega texto vindo da rede, nao pode virar HTML.
    op.textContent = f.rotulo || f.id;
    pvFmtEl.appendChild(op);
  });
  pvFmtEl.value = soComMarcaAtual ? '' : (dados.escolhido || '');

  previewEl.hidden = false;
  atualizaMarca();
  statusEl.textContent = (antes !== inspecionada)
    ? 'Link resolvido para o endereço completo — marque a declaração para esta URL.'
    : 'Marque a declaração para liberar o download.';
  atualizaBotao();
}

pvFmtEl.addEventListener('change', () => {
  atualizaMarca();
  atualizaBotao();
});

buscarEl.addEventListener('click', async () => {
  const url = urlEl.value.trim();
  erroEl.textContent = '';
  arquivoEl.textContent = '';
  const tk = tiktokRef(url);
  if (tk.tipo === 'foto') {
    erroEl.textContent = 'Este link é de uma publicação de fotos do TikTok, não de um vídeo.';
    return;
  }
  if (tk.tipo !== 'video' && tk.tipo !== 'curto') {
    erroEl.textContent = 'Cole o endereço de um vídeo do TikTok (tiktok.com/@perfil/video/… '
      + 'ou um link curto vm./vt.tiktok.com) para buscar.';
    return;
  }
  if (buscando) return;  // clique repetido nao dispara uma segunda busca

  buscando = true;
  limpaPreview();
  buscarEl.className = 'ghost busca buscando';
  atualizaBotao();
  statusEl.textContent = 'Buscando informações do vídeo...';

  let dados;
  let ok = false;
  try {
    const res = await fetch(BASE + '/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    dados = await corpo(res);
    ok = !!res.ok;
    if (!ok) {
      // Falha de extracao aparece com o motivo do helper, nunca como "tente de novo" seco.
      erroEl.textContent = dados.error || 'Não foi possível buscar este vídeo.';
      statusEl.textContent = 'Erro';
    }
  } catch {
    // Conexao recusada aqui significa "helper desligado", nunca um erro de rede do usuario.
    servicoOk = false;
    statusEl.textContent = 'Indisponível';
    erroEl.textContent = 'Serviço local não está iniciado. Rode  .\\start-downloader.ps1  '
      + 'na pasta do projeto.';
  } finally {
    buscando = false;
    buscarEl.className = 'ghost busca';
    atualizaBotao();
  }
  if (ok) mostraPreview(dados);
});

// --- saude e retomada ------------------------------------------------------------------

(async function saude() {
  try {
    const dados = await corpo(await fetch(BASE + '/health'));
    if (dados.status !== 'ok') {
      // yt-dlp ausente: o servico esta de pe, mas nao tem como baixar nada.
      servicoOk = false;
      statusEl.textContent = 'Indisponível';
      erroEl.textContent = dados.error || 'O serviço local respondeu com erro.';
      return;
    }
    servicoOk = true;
    statusEl.textContent = 'Marque a declaração para liberar o download.';
  } catch {
    // Conexao recusada aqui significa "helper desligado", nunca um erro de rede do usuario.
    servicoOk = false;
    statusEl.textContent = 'Indisponível';
    erroEl.textContent = 'Serviço local não está iniciado. Rode  .\\start-downloader.ps1  '
      + 'na pasta do projeto.';
  } finally {
    atualizaBotao();
    if (servicoOk) retoma();
  }
})();

// Fechar o popup NAO cancela o download: quem toca o yt-dlp e o helper, e e dele que sai a
// verdade quando a janela reabre. Helper reiniciado nao devolve nada -- e certo: o processo
// morreu junto e o arquivo ficou pela metade, entao nao ha "concluido" a restaurar.
async function retoma() {
  let dados;
  try {
    dados = await corpo(await fetch(BASE + '/current'));
  } catch {
    return;
  }
  if (!dados || !dados.id) return;
  aplicaEstado(dados);
  if (dados.status !== 'completed' && dados.status !== 'error') {
    baixando = true;
    timer = setInterval(() => acompanha(dados.id), 500);
    atualizaBotao();
  }
}

btn.addEventListener('click', async () => {
  const url = urlEl.value.trim();
  erroEl.textContent = '';
  arquivoEl.textContent = '';
  if (!url) {
    erroEl.textContent = 'Cole a URL do vídeo antes de baixar.';
    return;
  }
  // Conferido de novo NA HORA de chamar: a caixa pode ter sido desmarcada depois de o
  // botao ficar habilitado, e e a chamada que baixa midia — nao o clique anterior.
  if (!direitosEl.checked || urlAutorizada !== url) {
    atualizaBotao();
    erroEl.textContent = 'Marque a declaração de autorização para esta URL antes de baixar.';
    return;
  }
  const tt = precisaBuscar(url);
  if (tt && (inspecionada !== url || !pvFmtEl.value)) {
    // BP-008: nao basta travar o botao, tem de dizer o que falta.
    erroEl.textContent = 'Clique em “Buscar vídeo” e escolha uma qualidade antes de baixar.';
    return;
  }
  if (baixando) return;  // clique repetido nao abre um segundo download

  baixando = true;
  btn.disabled = true;
  buscarEl.disabled = true;
  mostra('Preparando...', 0);

  const pedido = { url };
  if (tt) pedido.formatId = pvFmtEl.value;

  let dados;
  try {
    const res = await fetch(BASE + '/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido)
    });
    dados = await corpo(res);
    if (!res.ok) {
      falha(dados.error || 'Não foi possível iniciar o download.');
      return;
    }
  } catch {
    falha('Serviço local não está iniciado.');
    return;
  }

  timer = setInterval(() => acompanha(dados.id), 500);
});

// Os dois estados do pedido, ditos em voz alta. Nenhum ramo termina calado: "nao veio" e
// "falhou ao extrair" sao motivos diferentes e aparecem diferentes (BP-008).
const MOTIVO = {
  MOST_REPLAYED_NOT_AVAILABLE: 'este vídeo não publica “Mais reproduzidos”',
  MOST_REPLAYED_EXTRACTION_FAILED: 'falha ao extrair “Mais reproduzidos”',
  CAPTIONS_NOT_AVAILABLE: 'sem legenda em português',
  CAPTIONS_EXTRACTION_FAILED: 'falha ao extrair a legenda',
};

function resumoAnalise(dados) {
  const partes = [];
  const mr = dados.mostReplayed;
  if (mr) {
    partes.push(mr.available
      ? 'Mais reproduzidos: ' + (mr.peaks || []).length + ' trecho(s)'
      : MOTIVO[mr.reason] || 'sem “Mais reproduzidos”');
  }
  const cc = dados.captions;
  if (cc) {
    partes.push(cc.available
      ? 'legenda ' + (cc.language || '?') + (cc.kind === 'automatica' ? ' (automática)' : '')
        + ': ' + (cc.count || 0) + ' fala(s)'
      : MOTIVO[cc.reason] || 'sem legenda');
  }
  return partes.join('; ');
}

// A marca d'agua do arquivo SALVO sai do que o helper leu do download, e nao do que a tela
// mostrava antes do clique: se os dois divergirem, quem manda e o arquivo.
function resumoArquivo(dados) {
  const wm = dados.watermark;
  return [
    dados.filename || '',
    wm && wm.status && wm.status !== 'nao-se-aplica'
      ? (frasesMarca[wm.status] || wm.status) : '',
    resumoAnalise(dados),
  ].filter(Boolean).join(' — ');
}

function aplicaEstado(dados) {
  const pct = Math.min(100, Math.max(0, Number(dados.progress) || 0));
  if (dados.status === 'downloading') {
    baixando = true;
    mostra('Baixando... ' + Math.round(pct) + '%', pct);
  } else if (dados.status === 'processing') {
    baixando = true;
    mostra('Processando vídeo...', pct);
  } else if (dados.status === 'completed') {
    para();
    baixando = false;
    mostra('Concluído', 100);
    // textContent: o nome vem do titulo do video, nao pode virar HTML.
    arquivoEl.textContent = resumoArquivo(dados);
    atualizaBotao();
  } else if (dados.status === 'error') {
    para();
    baixando = false;
    barEl.value = pct;
    pctEl.textContent = Math.round(pct) + '%';
    erroEl.textContent = dados.error || 'O download falhou.';
    statusEl.textContent = 'Erro';
    atualizaBotao();
  } else {
    baixando = true;
    mostra('Preparando...', pct);
  }
}

async function acompanha(id) {
  let dados;
  try {
    const res = await fetch(BASE + '/status/' + encodeURIComponent(id));
    dados = await corpo(res);
    if (!res.ok) {
      para();
      falha(dados.error || 'Download não encontrado.');
      return;
    }
  } catch {
    para();
    falha('Serviço local parou de responder.');
    return;
  }
  aplicaEstado(dados);
}
