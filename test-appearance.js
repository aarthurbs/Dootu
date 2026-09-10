// Provas da preferência de aparência (appearance.js) — sem DOM real e sem rede.
//
// Por que isto existe: a leitura da preferência roda no <head>, ANTES de qualquer outro
// script. Se ela lançar, a página inteira morre antes de montar — o mesmo formato de falha
// do BP-014 (dado persistido derruba o boot e a tela fica preta). Então os dois ramos que
// importam são os do usuário ANTIGO: valor gravado inválido e storage que LANÇA ao ser lido.
// Uso: node test-appearance.js
const assert = require('assert');
const ap = require('./appearance.js');

let provas = 0;
function ok(nome, fn) {
  try { fn(); provas++; } catch (erro) {
    console.error('FALHOU: ' + nome);
    throw erro;
  }
}

/* Stubs: `read`/`write`/`apply` leem `root.localStorage` e `root.document` a cada chamada,
   então dá para trocar o mundo por baixo do módulo sem recarregá-lo. */
function comStorage(store) {
  globalThis.localStorage = store;
}
function comDocumento() {
  const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  globalThis.document = { documentElement: el };
  return el;
}
function storageOk(inicial) {
  const mem = Object.assign({}, inicial);
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem(k, v) { mem[k] = String(v); },
    _mem: mem
  };
}
const STORAGE_QUE_LANCA = {
  getItem() { throw new Error('SecurityError: acesso ao storage negado'); },
  setItem() { throw new Error('QuotaExceededError'); }
};

/* ------------------------------------------------------------------ o padrão aprovado */
ok('o padrão é Preto + gelo e os três presets são exatamente os oferecidos na tela', () => {
  assert.strictEqual(ap.FALLBACK, 'preto-gelo');
  assert.deepStrictEqual(ap.PRESETS, ['preto-gelo', 'grafite', 'claro']);
  // A chave é própria: não encosta no dado dos módulos (pp_empreendedor_v1 / pp_video_projects_v1).
  assert.strictEqual(ap.KEY, 'pp_appearance_v1');
  assert.ok(!/empreendedor|video_projects/.test(ap.KEY));
});

/* ------------------------------------------------------- valor ausente / inválido / válido */
ok('pick devolve o preset quando ele existe e cai no padrão em tudo que não é preset', () => {
  ap.PRESETS.forEach(p => assert.strictEqual(ap.pick(p), p));
  // Ramo do usuário NOVO (nunca escolheu) e ramo do usuário ANTIGO (valor de outra versão).
  [null, undefined, '', 'tema-que-nao-existe', 'PRETO-GELO', 'verde', 0, {}, []].forEach(lixo => {
    assert.strictEqual(ap.pick(lixo), 'preto-gelo', 'não caiu no padrão: ' + JSON.stringify(lixo));
  });
});

/* ------------------------------------------------------------------ storage indisponível */
ok('storage que lança na leitura não derruba nada — devolve null e a tela nasce no padrão', () => {
  comStorage(STORAGE_QUE_LANCA);
  const el = comDocumento();
  assert.strictEqual(ap.read(), null);
  assert.strictEqual(ap.apply(ap.read()), 'preto-gelo');
  assert.strictEqual(el.attrs['data-appearance'], 'preto-gelo');
});

ok('storage que lança na gravação não impede a troca: a tela muda, só não lembra', () => {
  comStorage(STORAGE_QUE_LANCA);
  const el = comDocumento();
  assert.strictEqual(ap.write('claro'), false);
  // set() aplica ANTES de gravar — é o que garante que o clique responda mesmo sem storage.
  assert.strictEqual(ap.set('claro'), 'claro');
  assert.strictEqual(el.attrs['data-appearance'], 'claro');
});

ok('storage ausente (localStorage undefined) também cai no padrão sem lançar', () => {
  delete globalThis.localStorage;
  comDocumento();
  assert.strictEqual(ap.read(), null);
  assert.strictEqual(ap.current(), 'preto-gelo');
});

/* --------------------------------------------------------------- ida e volta pelo storage */
ok('escolher grava, e o reload seguinte devolve a mesma aparência', () => {
  const store = storageOk();
  comStorage(store);
  const el = comDocumento();

  assert.strictEqual(ap.set('grafite'), 'grafite');
  assert.strictEqual(store._mem['pp_appearance_v1'], 'grafite');
  assert.strictEqual(el.attrs['data-appearance'], 'grafite');

  // "reload": um documento novo lendo o que ficou gravado.
  const el2 = comDocumento();
  assert.strictEqual(ap.apply(ap.read()), 'grafite');
  assert.strictEqual(el2.attrs['data-appearance'], 'grafite');
});

ok('valor podre já gravado é normalizado — grava o padrão em vez de propagar o lixo', () => {
  comStorage(storageOk({ 'pp_appearance_v1': 'tema-que-nao-existe' }));
  comDocumento();
  assert.strictEqual(ap.current(), 'preto-gelo');
  // set com lixo grava o valor JÁ normalizado: o storage não guarda o que a CSS não entende.
  const store = storageOk({});
  comStorage(store);
  const el = comDocumento();
  assert.strictEqual(ap.set('verde-neon'), 'preto-gelo');
  assert.strictEqual(store._mem['pp_appearance_v1'], 'preto-gelo');
  assert.strictEqual(el.attrs['data-appearance'], 'preto-gelo');
});

/* ------------------------------------------------------- não remonta, não toca no conteúdo */
ok('trocar de aparência só escreve data-appearance — nenhum outro atributo do <html>', () => {
  comStorage(storageOk());
  const el = comDocumento();
  el.attrs['data-theme'] = 'brasil';   // o placar já tinha posto o tema do time
  ap.set('claro');
  assert.strictEqual(el.attrs['data-appearance'], 'claro');
  // A aparência não pisa no tema do placar (identidade do time é CONTEÚDO).
  assert.strictEqual(el.attrs['data-theme'], 'brasil');
  assert.deepStrictEqual(Object.keys(el.attrs).sort(), ['data-appearance', 'data-theme']);
});

console.log(provas + ' provas OK — preferência de aparência');
