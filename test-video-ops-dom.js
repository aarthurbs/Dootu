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
const MODULO = './video-ops.js';

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
    focus() {}
  };
  return el;
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
    createElement() { return fakeEl(); },
    addEventListener() {},
    body: { appendChild(c) { return c; } }
  };
  global.window = { addEventListener() {}, scrollX: 0, scrollY: 0, scrollTo() {} };
  global.navigator = { clipboard: { writeText() { return Promise.resolve(); } } };
  global.confirm = () => true;

  delete require.cache[require.resolve(MODULO)];
  require(MODULO);
  return {
    root: root, badge: badge, store: store,
    html() { return root.innerHTML; },
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

let provas = 0;
function ok(nome, valor) {
  assert.ok(valor, 'FALHOU: ' + nome);
  provas++;
}

async function main() {
  /* ----------------------------------------------------- a barra tem 5 telas, e só 5 */
  let b = bancada();
  ok('init renderiza sem estourar', b.html().length > 500);
  ok('Passo 1 abre por padrão', /Comece pelo vídeo/.test(b.html()));
  ok('Passo 1 é a tela que carrega o arquivo', /data-intake-input/.test(b.html()));
  ['overview', 'cuts', 'review', 'central', 'youtube'].forEach(t => {
    ok('a barra tem a tela ' + t, b.html().indexOf('data-tab="' + t + '"') > 0);
  });
  ['sources', 'queue', 'creators', 'accounts', 'reports'].forEach(t => {
    ok('a tela removida ' + t + ' não voltou', b.html().indexOf('data-tab="' + t + '"') < 0);
  });
  ['Material', 'Posts', 'Direitos', 'Contas', 'Relatórios'].forEach(rotulo => {
    ok('o rótulo removido "' + rotulo + '" não aparece', b.html().indexOf('>' + rotulo + '<') < 0);
  });
  ok('a Central aparece no cabeçalho com a contagem', /Central · 0 clip/.test(b.html()));
  ok('o badge da navegação conta os clips guardados', String(b.badge.textContent) === '0');

  /* ------------------------------------------- passos 2 e 3 sem vídeo: nada de seletor */
  b.aba('cuts');
  ok('Passo 2 sem vídeo manda voltar ao Passo 1', /Carregue o vídeo no Passo 1/.test(b.html()));
  ok('Passo 2 sem vídeo NÃO oferece seletor de arquivo', !/data-intake-input/.test(b.html()));
  b.aba('review');
  ok('Passo 3 sem vídeo manda voltar ao Passo 1', /Carregue o vídeo no Passo 1/.test(b.html()));
  ok('Passo 3 sem vídeo NÃO oferece seletor de arquivo', !/data-intake-input/.test(b.html()));

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
  ok('o cabeçalho mostra a contagem', /Central · 3 clip/.test(b.html()));

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
  ok('a nota da análise aparece', /sem legenda em pt-BR/.test(html));

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

  // ---- previa: UM player, num dialogo --------------------------------------------------
  b.clique({ act: 'yt-preview', id: clipId });
  html = b.html();
  ok('a previa abre um dialogo', /class="yt-modal"/.test(html) && /role="dialog"/.test(html));
  ok('e AI sim existe um player, um so',
    (html.match(/youtube\.com\/embed/g) || []).length === 1);
  ok('o player abre no comeco do trecho e para no fim',
    /embed\/abcdefghijk\?start=600&end=640/.test(html));
  b.clique({ act: 'yt-preview-close' });
  html = b.html();
  ok('fechar a previa tira o player do DOM', html.indexOf('youtube.com/embed') < 0);

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
  ok('o video editado nao e oferecido sem o trecho em disco',
    /yt-render"[^>]* disabled/.test(html));
  ok('e o motivo esta escrito nele', /baixe o trecho original primeiro/.test(html));

  // Declarar a autorização libera o download — e só ele.
  b.muda('[data-yt-rights]', { checked: true });
  html = b.html();
  ok('com a declaração o botão de baixar libera', !/yt-fetch"[^>]* disabled/.test(html));
  ok('com a declaração o aviso de bloqueio sai', !/bloqueado: você ainda não declarou/.test(html));

  // ---- Revisão da legenda no trecho recomendado (o caminho do Remotion) ----------------
  // A ASR do YouTube erra palavra e censura palavrão; este é o ÚLTIMO ponto antes do render
  // de minutos em que uma pessoa consegue consertar, e até 2026-08-28 não existia aqui.
  ok('sem trecho em disco não há revisão de legenda para oferecer',
    b.html().indexOf('data-act="yt-cap"') < 0);
  global.fetch = function (rota) {
    return Promise.resolve({
      ok: true,
      headers: { get() { return null; } },
      json: () => Promise.resolve({
        clipToken: 'tok_um', bytes: 12345,
        cues: [{ start: 0.0, end: 2.0, text: 'eu perdi [ __ ] mil reais' },
               { start: 2.0, end: 4.0, text: 'e foi o melhor negócio' }]
      })
    });
  };
  b.clique({ act: 'yt-fetch', id: clipId });
  await tick(); await tick(); await tick();
  html = b.html();
  ok('com o trecho em disco a grade diz que o arquivo esta la',
    html.indexOf('Trecho no disco') > 0);
  // Os controles de producao vivem na TELA DE DETALHE. `Editar` e a acao primaria do card,
  // e e ela que abre esta tela com o trecho, as bordas e as escolhas salvas.
  ok('o card tem Editar como acao primaria',
    /class="vop-btn vop-btn-primary"[^>]*data-act="yt-open"/.test(html));
  b.clique({ act: 'yt-open', id: clipId });
  html = b.html();
  ok('Editar abre a tela de detalhe do trecho', /class="yt-detail"/.test(html));
  ok('com o caminho de volta para a grade', html.indexOf('data-act="yt-back"') > 0);
  ok('a tela de detalhe diz DE ONDE vem a borda do corte',
    /class="yt-detail-boundary"/.test(html));
  ok('o sinal medido é mostrado com nome legível', html.indexOf('Mais reproduzidos') > 0);
  ok('a decomposicao da nota fica aqui, e diz que nao e previsao de desempenho',
    html.indexOf('yt-factors') > 0 && /previsão de desempenho/.test(html));
  ok('com o trecho em disco o botão de legenda aparece', html.indexOf('data-act="yt-cap"') > 0);
  ok('e o botão do Remotion também', html.indexOf('data-act="yt-render"') > 0);
  ok('o botao de render nao expoe o nome do renderizador ao operador',
    html.indexOf('Remotion') < 0);
  b.clique({ act: 'yt-cap', id: clipId });
  html = b.html();
  ok('abrir a legenda mostra as falas do trecho', html.indexOf('data-cap-panel') > 0);
  ok('e o texto que o YouTube detectou está editável, censura e tudo',
    /value="eu perdi \[ __ \] mil reais"/.test(html));
  ok('a segunda fala também está lá', html.indexOf('e foi o melhor negócio') > 0);
  ok('o tempo da fala é leitura, não campo', /vop-cap-time/.test(html));
  ok('e existe como voltar ao texto do YouTube', html.indexOf('data-act="cap-restore"') > 0);
  // Corrigir a fala: o painel NÃO re-renderiza (mataria o foco, BP-001), então a prova é a
  // nota do painel mudando e o rótulo do botão passando a dizer "corrigida".
  // Corrigir passa pela MESMA delegacao do site. O painel nao re-renderiza a cada tecla
  // (mataria o foco, BP-001), entao a prova e o que aparece no PROXIMO render.
  b.muda('[data-cap-field]', { value: 'eu perdi quarenta mil reais',
    dataset: { id: clipId, capIndex: '0' } });
  // Fechar o painel: e com ele FECHADO que o rotulo avisa que aquele trecho ja tem
  // legenda corrigida -- aberto ele diz 'Fechar legenda'. Mesma regra do Passo 3,
  // e o motivo e nao obrigar a abrir um por um para lembrar onde se mexeu (BP-008).
  b.clique({ act: 'yt-cap', id: clipId });
  html = b.html();
  ok('com o painel fechado o rótulo avisa que há correção', /corrigida/.test(html));
  b.clique({ act: 'yt-cap', id: clipId });
  html = b.html();
  ok('reabrindo, o texto corrigido é o que está no campo',
    html.indexOf('eu perdi quarenta mil reais') > 0);
  ok('e a censura do YouTube saiu de vez', html.indexOf('[ __ ]') < 0);
  ok('a nota avisa que é este texto que vai ser queimado',
    /vai ser queimado no clip/.test(html));

  // ---- "Card visual": as duas identidades do card do título -----------------------------
  // O card tinha UMA marca fixa e o operador não podia escolher. O que erra CALADO aqui é o
  // seletor não refletir o estado (dois radios, nenhum marcado) ou não gravar a escolha.
  html = b.html();
  ok('o seletor "Card visual" aparece no cartão do trecho',
    /<legend>Card visual<\/legend>/.test(html));
  ok('com as duas identidades escritas por extenso',
    html.indexOf('Primo Rico') > 0 && html.indexOf('Puro Ecommerce') > 0);
  // E a terceira opção: nenhum card. Existe separada de "apagar o título" porque o título
  // também nomeia o arquivo baixado e o cartão da Central — dá para ficar sem card e ainda
  // ter manchete.
  ok('e a terceira opção, sem card nenhum', html.indexOf('Sem card') > 0);
  ok('as três opções são do mesmo grupo (uma escolha, não três interruptores)',
    (html.match(new RegExp('name="cardstyle-' + clipId + '"', 'g')) || []).length === 3);
  ok('e são radios nativos agrupados por trecho (não botões com classe na mão)',
    new RegExp('type="radio"[^>]*name="cardstyle-' + clipId + '"').test(html));
  // Trecho novo não tem a chave: o padrão TEM de estar marcado, senão o seletor mostra duas
  // opções e nenhuma escolhida enquanto o render sai com uma delas.
  ok('a identidade padrão já vem marcada em trecho novo',
    new RegExp('value="primo_rico"[^>]*checked').test(html));
  ok('e a outra não está marcada',
    !new RegExp('value="puro_ecommerce"[^>]*checked').test(html));
  // Escolher a outra passa pela MESMA delegação do site. `clipFieldWrite` NÃO re-renderiza
  // de propósito (o `:checked` nativo já mostra a escolha, e reescrever a lista tiraria o
  // foco de quem chegou pelo teclado), então `b.html()` aqui ainda devolveria o HTML do
  // render anterior — é preciso forçar um render novo para ler o ESTADO.
  // A ida e volta de aba é o gatilho, e prova de bônus o que importa mais: a escolha
  // SOBREVIVE ao re-render. `b.aba('youtube')` estando nela sai cedo sem re-renderizar, daí
  // o desvio pela Central.
  b.muda('[data-clip-field]', {
    value: 'puro_ecommerce',
    dataset: { clipField: 'titleCardStyle', id: clipId },
  });
  b.aba('central');
  b.aba('youtube');
  html = b.html();
  ok('escolher a outra identidade fica marcado no próximo render',
    new RegExp('value="puro_ecommerce"[^>]*checked').test(html));
  ok('e a anterior deixa de estar marcada',
    !new RegExp('value="primo_rico"[^>]*checked').test(html));
  ok('nunca as duas marcadas ao mesmo tempo',
    (html.match(new RegExp('name="cardstyle-' + clipId + '"[^>]*checked', 'g')) || []).length === 1);
  // Um seletor por trecho: `name` sem o id faria os radios de todos os cartões brigarem
  // pelo mesmo grupo, e escolher num trecho desmarcaria o vizinho.
  ok('o grupo de radios é por trecho, não um só para a lista toda',
    new Set((html.match(/name="cardstyle-[^"]+"/g) || [])).size
      === new Set((html.match(/data-clip="[^"]+"/g) || [])).size);
  // O rótulo do grupo é `legend` num `fieldset`: é o que dá o nome do grupo ao leitor de
  // tela sem inventar `aria-*` à mão.
  ok('o seletor é um fieldset de verdade (grupo nomeado, de graça)',
    /<fieldset class="vop-cardstyle">/.test(html));
  ok('e cada radio tem label ligado por for/id (clicar no texto seleciona)',
    /<label for="cardstyle-[^"]+">/.test(html));

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

  /* -------------------------------------------------- a dica muda com a tela atual */
  b = bancada();
  const dicas = {};
  ['overview', 'cuts', 'review', 'central', 'youtube'].forEach(t => {
    b.aba(t);
    const achou = /class="vop-flow-hint">([^<]+)</.exec(b.html());
    dicas[t] = achou ? achou[1] : '';
    ok('a tela ' + t + ' tem dica escrita', dicas[t].length > 20);
  });
  ok('cada tela tem a sua dica', new Set(Object.values(dicas)).size === 5);

  console.log(provas + ' provas OK — DOM do Estúdio de Vídeos (' + path.basename(__filename) + ')');
}

main().catch(erro => { console.error(erro); process.exit(1); });
