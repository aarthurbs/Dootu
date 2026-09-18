// Provas da tela Resultados dos cortes (video-results.js) — lógica pura e DOM headless.
//
// Esta tela existe para APRENDER com o que foi publicado, e a maneira mais fácil de ela
// mentir é aritmética: tratar ausência como zero, somar duas medições da mesma publicação,
// comparar taxas feitas de componentes diferentes, ou chamar de causa o que é só
// coincidência. Cada uma dessas armadilhas tem prova aqui, chamando a função com o dado
// construído — `node --check` prova sintaxe, não fiação (BP-014).
// Uso: node test-video-results.js
const assert = require('assert');

let provas = 0;
function ok(nome, fn) {
  try { fn(); provas++; } catch (erro) {
    console.error('FALHOU: ' + nome);
    throw erro;
  }
}

/* ------------------------------------------------------------------ bancada headless
   O módulo se registra em `window` e em `module.exports`. Para os casos de DOM, uma
   bancada mínima: localStorage em memória e um `document.querySelector` que enxerga os
   campos que o formulário declara. */
const STORE = Object.create(null);
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(STORE, k) ? STORE[k] : null; },
  setItem(k, v) { STORE[k] = String(v); },
  removeItem(k) { delete STORE[k]; }
};
global.window = global.window || {};
global.confirm = () => true;

const R = require('./video-results.js');
const H = R.__;

function limpa() {
  Object.keys(STORE).forEach(k => delete STORE[k]);
  H.reset();
}

// Campos que o formulário lê por `document.querySelector`. A bancada devolve um elemento
// com `.value` para cada seletor conhecido — é assim que `res-save` é exercitado de fato.
function campos(mapa) {
  global.document = {
    querySelector(sel) {
      const m = /^\[data-res-(field|med|nota-texto)="([^"]+)"\]$/.exec(sel);
      if (!m) return null;
      const chave = (m[1] === 'field' ? '' : m[1] + ':') + m[2];
      return Object.prototype.hasOwnProperty.call(mapa, chave)
        ? { value: String(mapa[chave]) } : { value: '' };
    }
  };
}
function botao(dados) { return { dataset: dados || {} }; }

const PUB = {
  id: 'p1', plataforma: 'tiktok', perfil: '@dootu', postedAt: '2026-09-01T10:00',
  formato: 'dica', duracaoSec: 45, medicoes: []
};
function med(at, valores) { return Object.assign({ id: 'm-' + at, at: at }, valores || {}); }

/* ============================================================ regra 1: ausência ≠ zero */
ok('numOuNulo separa ausência de zero — "" e null viram null, "0" vira 0', () => {
  assert.strictEqual(H.numOuNulo(''), null);
  assert.strictEqual(H.numOuNulo(null), null);
  assert.strictEqual(H.numOuNulo(undefined), null);
  assert.strictEqual(H.numOuNulo('   '), null);
  assert.strictEqual(H.numOuNulo('0'), 0, 'zero digitado É zero — só o campo VAZIO é ausência');
  assert.strictEqual(H.numOuNulo(0), 0);
  assert.strictEqual(H.numOuNulo('1.200'), 1200, 'ponto de milhar brasileiro');
  assert.strictEqual(H.numOuNulo('12,5'), 12.5, 'vírgula decimal brasileira');
  assert.strictEqual(H.numOuNulo('abc'), null, 'texto não vira 0 calado');
  assert.strictEqual(H.numOuNulo(-5), null, 'métrica negativa não existe');
  assert.strictEqual(H.numOuNulo(Infinity), null);
});

ok('medEntry guarda null em cada métrica não informada, nunca 0', () => {
  const m = H.medEntry({ at: '2026-09-02T10:00', views: '1000' });
  assert.strictEqual(m.views, 1000);
  assert.strictEqual(m.curtidas, null, 'curtida não informada é null');
  assert.strictEqual(m.conclusao, null);
  H.METRICAS.forEach(met => {
    assert.ok(Object.prototype.hasOwnProperty.call(m, met[0]),
      'a métrica ' + met[0] + ' existe no registro');
  });
});

ok('medEntry recusa medição sem carimbo de tempo — não dá para saber a que altura mediu', () => {
  assert.strictEqual(H.medEntry({ views: 100 }), null);
  assert.strictEqual(H.medEntry({ at: 'ontem', views: 100 }), null);
  assert.strictEqual(H.medEntry(null), null);
  assert.ok(H.medEntry({ at: '2026-09-02T10:00', views: 1 }));
});

ok('fmtNum escreve "não informado" para null, e nunca 0', () => {
  assert.ok(/não informado/.test(H.fmtNum(null, 'contagem')));
  assert.ok(/não informado/.test(H.fmtNum(undefined, 'percentual')));
  assert.ok(!/não informado/.test(H.fmtNum(0, 'contagem')), 'zero medido é mostrado como 0');
  assert.ok(/0/.test(H.fmtNum(0, 'contagem')));
});

/* ================================================= regra 2: nunca somar duas medições */
ok('medicaoDaJanela devolve UMA medição — a mais recente na janela "ultima"', () => {
  const p = Object.assign({}, PUB, {
    medicoes: [med('2026-09-02T10:00', { views: 1000 }), med('2026-09-08T10:00', { views: 5000 })]
  });
  const m = H.medicaoDaJanela(p, 'ultima');
  assert.strictEqual(m.views, 5000, 'a última, não a soma (6000 seria contar duas vezes)');
});

ok('a janela de 24 h escolhe a medição mais perto de 24 h e ignora as de fora', () => {
  const p = Object.assign({}, PUB, {
    medicoes: [
      med('2026-09-01T12:00', { views: 100 }),   // +2 h — cedo demais
      med('2026-09-02T08:00', { views: 900 }),   // +22 h — dentro, perto
      med('2026-09-08T10:00', { views: 9000 })   // +7 d — fora
    ]
  });
  assert.strictEqual(H.medicaoDaJanela(p, '24h').views, 900);
  assert.strictEqual(H.medicaoDaJanela(p, '7d').views, 9000);
});

ok('publicação sem medição na janela devolve null — não cai numa medição de outra idade', () => {
  const p = Object.assign({}, PUB, { medicoes: [med('2026-09-01T11:00', { views: 50 })] });
  assert.strictEqual(H.medicaoDaJanela(p, '24h'), null, '+1 h não é "perto de 24 h"');
  assert.strictEqual(H.medicaoDaJanela(p, '7d'), null);
  assert.ok(H.medicaoDaJanela(p, 'ultima'), 'mas a janela "ultima" sempre tem uma');
  assert.strictEqual(H.medicaoDaJanela({ medicoes: [] }, 'ultima'), null);
});

ok('idadeHoras só existe com as duas pontas conhecidas', () => {
  assert.strictEqual(H.idadeHoras(PUB, med('2026-09-02T10:00')), 24);
  assert.strictEqual(H.idadeHoras({ postedAt: '' }, med('2026-09-02T10:00')), null);
  assert.strictEqual(H.idadeHoras(PUB, null), null);
});

ok('cada par carrega UMA medição, e a lista nunca acumula duas da mesma publicação', () => {
  const p = Object.assign({}, PUB, {
    medicoes: [med('2026-09-02T10:00', { views: 1000 }), med('2026-09-08T10:00', { views: 5000 })]
  });
  const lista = H.pares([p], { janela: 'ultima', metrica: 'views', denom: 'views' });
  assert.strictEqual(lista.length, 1, 'uma publicação, uma linha — nunca uma linha por medição');
  assert.strictEqual(lista[0].valor, 5000);
  const j24 = H.pares([p], { janela: '24h', metrica: 'views', denom: 'views' });
  assert.strictEqual(j24[0].valor, 1000, 'a janela troca QUAL medição entra, nunca soma');
});

/* ============================================ taxa de engajamento: fórmula à vista */
ok('engajamento devolve taxa, fórmula e denominador — dedução invisível é bug (BP-003)', () => {
  const e = H.engajamento(
    med('x', { views: 1000, curtidas: 80, comentarios: 10, compartilhamentos: 5, salvos: 5 }), 'views');
  assert.strictEqual(e.ok, true);
  assert.strictEqual(e.taxa, 0.1, '(80+10+5+5)/1000');
  assert.strictEqual(e.denom, 1000);
  assert.ok(/Curtidas/.test(e.formula) && /Visualizações/.test(e.formula),
    'a fórmula nomeia componentes e denominador');
  assert.ok(e.formula.indexOf('÷') > 0);
});

ok('taxa incompleta NÃO é calculada — e o motivo é escrito (BP-008)', () => {
  const semDenom = H.engajamento(med('x', { curtidas: 10 }), 'views');
  assert.strictEqual(semDenom.ok, false);
  assert.strictEqual(semDenom.taxa, null, 'nunca devolve 0 no lugar de "não dá para calcular"');
  assert.ok(/não foi informado/.test(semDenom.motivo));

  const semComponente = H.engajamento(med('x', { views: 1000 }), 'views');
  assert.strictEqual(semComponente.ok, false);
  assert.ok(/nenhum componente/.test(semComponente.motivo));
  assert.deepStrictEqual(semComponente.faltando, H.ENG_COMPONENTES);
});

ok('denominador zero não vira Infinity (BP-004)', () => {
  const e = H.engajamento(med('x', { views: 0, curtidas: 10 }), 'views');
  assert.strictEqual(e.ok, false);
  assert.strictEqual(e.taxa, null);
  assert.ok(/zerado/.test(e.motivo));
  assert.strictEqual(H.divide(5, 0), null);
  assert.strictEqual(H.divide(5, null), null);
});

ok('a assinatura diz de QUE componentes a taxa é feita, e o denominador entra nela', () => {
  const tres = H.engajamento(med('x', { views: 100, curtidas: 5, comentarios: 3, compartilhamentos: 2 }), 'views');
  const quatro = H.engajamento(med('x', { views: 100, curtidas: 5, comentarios: 3, compartilhamentos: 2, salvos: 1 }), 'views');
  assert.notStrictEqual(tres.assinatura, quatro.assinatura, 'componentes diferentes, assinaturas diferentes');
  const porAlcance = H.engajamento(med('x', { alcance: 100, curtidas: 5, comentarios: 3, compartilhamentos: 2 }), 'alcance');
  assert.notStrictEqual(tres.assinatura, porAlcance.assinatura, 'trocar o denominador muda a assinatura');
  assert.strictEqual(porAlcance.taxa, 0.1);
});

ok('porAssinatura rankeia só o maior grupo comparável e conta quem ficou de fora', () => {
  function par(id, m) {
    return { post: { id: id }, med: m, eng: H.engajamento(m, 'views'), valor: 1 };
  }
  const grupo = H.porAssinatura([
    par('a', med('x', { views: 100, curtidas: 10, comentarios: 1, compartilhamentos: 1, salvos: 1 })),
    par('b', med('x', { views: 200, curtidas: 20, comentarios: 2, compartilhamentos: 2, salvos: 2 })),
    par('c', med('x', { views: 300, curtidas: 30, comentarios: 3, compartilhamentos: 3 })), // sem salvos
    par('d', med('x', { views: 400 }))                                                      // sem taxa
  ]);
  assert.strictEqual(grupo.itens.length, 2, 'só as duas de assinatura completa entram juntas');
  assert.strictEqual(grupo.fora, 1, 'a de componentes diferentes é contada, não ignorada calada');
  assert.strictEqual(H.porAssinatura([par('z', med('x', { views: 10 }))]).itens.length, 0);
});

/* ================================================================== mediana e faixas */
ok('mediana ignora null e resiste ao valor que estourou', () => {
  assert.strictEqual(H.mediana([1, 2, 3]), 2);
  assert.strictEqual(H.mediana([1, 2, 3, 4]), 2.5);
  assert.strictEqual(H.mediana([1, 2, 1000000]), 2, 'um viral não puxa a mediana');
  assert.strictEqual(H.mediana([null, 5, undefined, NaN]), 5);
  assert.strictEqual(H.mediana([]), null);
  assert.strictEqual(H.mediana([null]), null);
});

ok('faixaDuracao distingue ausência de faixa — sem duração não entra em grupo nenhum', () => {
  assert.strictEqual(H.faixaDuracao(null), '');
  assert.strictEqual(H.faixaDuracao(30), 'ate30');
  assert.strictEqual(H.faixaDuracao(31), '30a60');
  assert.strictEqual(H.faixaDuracao(91), '90mais');
  assert.strictEqual(H.faixaDuracao(0), 'ate30', 'zero segundos é uma duração, não ausência');
});

ok('hashtag e gancho vazios são AUSÊNCIA, não "zero hashtags" nem "gancho curto"', () => {
  assert.strictEqual(H.faixaHashtags(''), '', 'campo vazio = não informado');
  assert.strictEqual(H.faixaHashtags('sem tags aqui'), 'zero', 'texto sem # É zero hashtags');
  assert.strictEqual(H.faixaHashtags('#a #b'), 'poucas');
  assert.strictEqual(H.faixaHashtags('#a #b #c #d'), 'muitas');
  assert.strictEqual(H.faixaGancho(''), '');
  assert.strictEqual(H.faixaGancho('o erro que custou caro'), 'curto');
  assert.strictEqual(H.faixaGancho('um dois tres quatro cinco seis sete oito nove dez onze doze treze'), 'longo');
});

/* ============================================================== persistência (BP-014) */
ok('sanitize aceita os DOIS ramos: com medicoes/notas e sem elas', () => {
  const cheio = H.sanitize({
    posts: [{
      id: 'p1', plataforma: 'tiktok', perfil: '@d', postedAt: '2026-09-01T10:00',
      medicoes: [{ at: '2026-09-02T10:00', views: 10 }]
    }],
    notas: [{ tipo: 'testar', texto: 'variar o gancho' }]
  });
  assert.strictEqual(cheio.posts.length, 1);
  assert.strictEqual(cheio.posts[0].medicoes.length, 1);
  assert.strictEqual(cheio.notas.length, 1);

  const vazio = H.sanitize({
    posts: [{ id: 'p2', plataforma: 'instagram', perfil: '@d', postedAt: '2026-09-01T10:00' }]
  });
  assert.strictEqual(vazio.posts[0].medicoes.length, 0, 'publicação sem medição continua válida');
  assert.deepStrictEqual(vazio.notas, []);

  assert.strictEqual(H.sanitize(null), null, 'lixo é recusado em vez de virar estado vazio calado');
  assert.strictEqual(H.sanitize('texto'), null);
  assert.deepStrictEqual(H.sanitize({}).posts, [], 'objeto sem posts é legítimo: base nova');
});

ok('sanitize descarta medição inválida sem derrubar a publicação inteira', () => {
  const limpo = H.sanitize({
    posts: [{
      id: 'p1', plataforma: 'tiktok', perfil: '@d', postedAt: '2026-09-01T10:00',
      medicoes: [{ at: 'quebrado', views: 1 }, { at: '2026-09-02T10:00', views: 2 }, null, 'texto']
    }]
  });
  assert.strictEqual(limpo.posts.length, 1, 'a publicação sobrevive');
  assert.strictEqual(limpo.posts[0].medicoes.length, 1, 'só a medição boa fica');
});

ok('postEntry passa todo valor de conjunto fechado pelo validador — o DOM é entrada', () => {
  const p = H.postEntry({ plataforma: '<script>', formato: 'inexistente', ritmo: 'medio', url: 'javascript:alert(1)' });
  assert.strictEqual(p.plataforma, 'outra', 'plataforma torta cai no padrão, não no valor cru');
  assert.strictEqual(p.formato, '', 'formato desconhecido vira não informado');
  assert.strictEqual(p.ritmo, 'medio');
  assert.strictEqual(p.url, '', 'esquema que não é http(s) não é guardado');
  assert.strictEqual(H.postEntry({ url: 'https://x.com/1' }).url, 'https://x.com/1');
});

ok('quandoValido recusa data torta em vez de inventar uma', () => {
  assert.strictEqual(H.quandoValido('2026-09-01T10:00'), '2026-09-01T10:00');
  assert.strictEqual(H.quandoValido('2026-09-01T10:00:30'), '2026-09-01T10:00', 'segundos são cortados');
  assert.strictEqual(H.quandoValido('01/09/2026'), '');
  assert.strictEqual(H.quandoValido(''), '');
  assert.strictEqual(H.quandoValido('2026-13-45T99:99'), '', 'data impossível não passa');
});

/* ================================================================ filtros e recorte */
ok('filtra recorta por plataforma, perfil, formato, duração e distribuição', () => {
  const base = { postedAt: '2026-09-01T10:00', medicoes: [] };
  const a = Object.assign({}, base, { id: 'a', plataforma: 'tiktok', perfil: '@um', formato: 'dica', duracaoSec: 20, distribuicao: 'organico' });
  const b = Object.assign({}, base, { id: 'b', plataforma: 'instagram', perfil: '@dois', formato: 'erro', duracaoSec: 80, distribuicao: 'impulsionado' });
  const vazio = { plataforma: '', perfil: '', formato: '', duracao: '', distribuicao: '', dias: '0' };
  assert.strictEqual(H.filtra([a, b], vazio).length, 2);
  assert.strictEqual(H.filtra([a, b], Object.assign({}, vazio, { plataforma: 'tiktok' }))[0].id, 'a');
  assert.strictEqual(H.filtra([a, b], Object.assign({}, vazio, { perfil: '@dois' }))[0].id, 'b');
  assert.strictEqual(H.filtra([a, b], Object.assign({}, vazio, { duracao: 'ate30' }))[0].id, 'a');
  assert.strictEqual(H.filtra([a, b], Object.assign({}, vazio, { distribuicao: 'impulsionado' }))[0].id, 'b');
  assert.strictEqual(H.filtra([a, b], Object.assign({}, vazio, { formato: 'lista' })).length, 0);
});

ok('avisos DIZEM o que o conjunto mistura — plataforma, perfil e orgânico/pago', () => {
  const base = { postedAt: '2026-09-01T10:00', medicoes: [] };
  const mistura = [
    Object.assign({}, base, { id: 'a', plataforma: 'tiktok', perfil: '@um', distribuicao: 'organico' }),
    Object.assign({}, base, { id: 'b', plataforma: 'instagram', perfil: '@dois', distribuicao: 'impulsionado' })
  ];
  const av = H.avisos(mistura);
  assert.strictEqual(av.length, 3, 'os três avisos aparecem');
  assert.ok(av.some(t => /plataformas/.test(t)));
  assert.ok(av.some(t => /perfis/.test(t)));
  assert.ok(av.some(t => /impulsionadas/.test(t)));

  const limpo = [
    Object.assign({}, base, { id: 'a', plataforma: 'tiktok', perfil: '@um', distribuicao: 'organico' }),
    Object.assign({}, base, { id: 'b', plataforma: 'tiktok', perfil: '@um', distribuicao: 'organico' })
  ];
  assert.deepStrictEqual(H.avisos(limpo), [], 'recorte homogêneo não inventa alerta');
});

ok('cortes conta CORTES, não publicações — o mesmo corte em duas plataformas é um só', () => {
  const posts = [
    { id: 'p1', clipId: 'c1' }, { id: 'p2', clipId: 'c1' }, { id: 'p3', clipId: 'c2' }, { id: 'p4', clipId: '' }
  ];
  assert.strictEqual(H.cortes(posts), 3, 'c1 + c2 + a avulsa');
  assert.strictEqual(H.cortes([{ id: 'x', clipId: '' }, { id: 'y', clipId: '' }]), 2, 'avulsas não se fundem');
});

/* ====================================================== padrões: associação, não causa */
function fabrica(n, ajuste) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(Object.assign({
      id: 'p' + i, clipId: 'c' + i, plataforma: 'tiktok', perfil: '@d',
      postedAt: '2026-09-01T10:00', formato: 'dica', duracaoSec: 45, medicoes: []
    }, ajuste ? ajuste(i) : {}));
  }
  return out;
}
function comMedida(posts, valores) {
  return posts.map((p, i) => Object.assign({}, p, {
    medicoes: [{
      id: 'm' + i, at: '2026-09-02T10:00', views: valores[i],
      alcance: null, curtidas: null, comentarios: null, compartilhamentos: null,
      salvos: null, seguidores: null, tempoMedioSec: null, retencao3s: null, conclusao: null
    }]
  }));
}
const F = { janela: 'ultima', metrica: 'views', denom: 'views' };

ok('menos de 4 publicações medidas = dados insuficientes, não um padrão fraco', () => {
  const p = H.padroes(H.pares(comMedida(fabrica(3), [100, 200, 300]), F));
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.n, 3);
  assert.deepStrictEqual(p.achados, []);
});

ok('publicação sem medição não conta como zero na contagem de evidência', () => {
  const posts = comMedida(fabrica(4), [100, 200, 300, 400])
    .concat(fabrica(2).map((p, i) => Object.assign({}, p, { id: 'sem' + i })));
  const lista = H.pares(posts, F);
  assert.strictEqual(lista.length, 6, 'todas aparecem na lista');
  assert.strictEqual(H.padroes(lista).n, 4, 'mas só as 4 medidas sustentam a análise');
});

ok('um padrão real é achado, com n, cortes, exemplos, comparação e hipótese', () => {
  // 3 "erro comum" bem acima de 3 "dica": diferença grande e sustentada.
  const posts = comMedida(
    fabrica(6, i => ({ formato: i < 3 ? 'erro' : 'dica' })),
    [9000, 10000, 11000, 1000, 1100, 1200]
  );
  const p = H.padroes(H.pares(posts, F));
  assert.strictEqual(p.ok, true);
  const achado = p.achados.find(a => a.dimensao === 'formato' && a.valor === 'erro');
  assert.ok(achado, 'o formato "erro comum" aparece como padrão');
  assert.strictEqual(achado.n, 3, 'quantas publicações sustentam');
  assert.strictEqual(achado.cortes, 3, 'quantos cortes sustentam');
  assert.strictEqual(achado.nFora, 3, 'contra quantas foi comparado');
  assert.strictEqual(achado.medianaDentro, 10000);
  assert.strictEqual(achado.medianaFora, 1100);
  assert.ok(achado.delta > 0);
  assert.strictEqual(achado.exemplos.length, 3, 'com exemplos clicáveis');
  assert.ok(achado.exemplos[0].valor >= achado.exemplos[1].valor, 'exemplos do melhor para o pior');
  assert.ok(/mude só/.test(achado.hipotese), 'a hipótese muda UMA característica por vez');
  assert.ok(/mantenha o resto igual/.test(achado.hipotese));
  assert.strictEqual(achado.pequena, false, 'n=3 já não é amostra pequena');
});

ok('grupo de 2 é marcado como amostra pequena, e grupo de 1 nem vira padrão', () => {
  const posts = comMedida(
    fabrica(6, i => ({ formato: i < 2 ? 'erro' : (i === 2 ? 'lista' : 'dica') })),
    [9000, 10000, 7000, 1000, 1100, 1200]
  );
  const p = H.padroes(H.pares(posts, F));
  const dois = p.achados.find(a => a.valor === 'erro');
  assert.ok(dois && dois.pequena === true, 'n=2 sai marcado');
  assert.ok(!p.achados.some(a => a.valor === 'lista'), 'n=1 não sustenta observação nenhuma');
});

ok('diferença pequena não vira recomendação — ruído não é padrão', () => {
  const posts = comMedida(
    fabrica(6, i => ({ formato: i < 3 ? 'erro' : 'dica' })),
    [1000, 1050, 1100, 1000, 1020, 1040]
  );
  const p = H.padroes(H.pares(posts, F));
  assert.strictEqual(p.ok, true, 'há dado suficiente');
  assert.ok(!p.achados.some(a => a.dimensao === 'formato'),
    'mas 5% de diferença não é apresentado como achado');
});

ok('característica não informada nunca vira um grupo chamado "vazio"', () => {
  const posts = comMedida(
    fabrica(6, i => ({ formato: i < 3 ? 'erro' : '', ritmo: '' })),
    [9000, 10000, 11000, 1000, 1100, 1200]
  );
  const p = H.padroes(H.pares(posts, F));
  assert.ok(p.achados.every(a => a.valor !== '' && a.valorLabel !== ''),
    'nenhum achado é sobre "não informado"');
  assert.ok(!p.achados.some(a => a.dimensao === 'ritmo'), 'dimensão toda vazia não produz padrão');
});

ok('resultados fracos também são listados — olhar só vencedor é viés de sobrevivente', () => {
  const p = H.padroes(H.pares(comMedida(fabrica(6), [10, 20, 30, 4000, 5000, 6000]), F));
  assert.strictEqual(p.fracos.length, 3);
  assert.strictEqual(p.fracos[0].valor, 10, 'do pior para cima');
  assert.strictEqual(p.fracos[2].valor, 30);
});

ok('padrão negativo também é reportado, com hipótese de TROCAR a característica', () => {
  const posts = comMedida(
    fabrica(6, i => ({ formato: i < 3 ? 'erro' : 'dica' })),
    [100, 110, 120, 9000, 10000, 11000]
  );
  const p = H.padroes(H.pares(posts, F));
  const ruim = p.achados.find(a => a.valor === 'erro');
  assert.ok(ruim && ruim.delta < 0);
  assert.ok(/troque/.test(ruim.hipotese), 'a hipótese do lado fraco manda trocar, não repetir');
});

/* ============================================================ ciclo completo com DOM */
ok('cadastro exige plataforma, perfil e data — e o que foi digitado NÃO some no erro', () => {
  limpa();
  campos({ plataforma: '', perfil: 'Arthur', postedAt: '', tema: 'precificação' });
  R.act('res-new', botao());
  const repintou = R.act('res-save', botao());
  assert.strictEqual(repintou, true);
  assert.strictEqual(H.ui.erros.length, 2, 'plataforma e data faltando');
  assert.ok(H.ui.draft, 'o rascunho é guardado');
  assert.strictEqual(H.ui.draft.tema, 'precificação', 'o que foi digitado sobrevive ao erro');
  assert.strictEqual(R.count(), 0, 'nada foi gravado');
  assert.ok(R.html([]).indexOf('precificação') > 0, 'e volta preenchido na tela');
});

ok('cadastro válido grava, persiste no localStorage e abre o detalhe', () => {
  limpa();
  campos({
    plataforma: 'tiktok', perfil: '@dootu', postedAt: '2026-09-01T10:00',
    titulo: 'O erro que custou caro', formato: 'erro', duracaoSec: '52',
    gancho: 'Eu perdi trinta mil reais', hashtags: '#ecommerce #vendas',
    distribuicao: 'organico', url: 'https://tiktok.com/@dootu/video/1'
  });
  R.act('res-new', botao());
  R.act('res-save', botao());
  assert.strictEqual(R.count(), 1);
  const gravado = JSON.parse(STORE[H.KEY]);
  assert.strictEqual(gravado.posts[0].titulo, 'O erro que custou caro');
  assert.strictEqual(gravado.posts[0].duracaoSec, 52);
  assert.strictEqual(gravado.posts[0].medicoes.length, 0);
  assert.ok(H.ui.detail, 'abre no detalhe da publicação recém-criada');
  assert.strictEqual(H.ui.form, null, 'e o formulário fecha');
});

ok('recarregar a página devolve exatamente o que foi gravado', () => {
  const bruto = STORE[H.KEY];
  H.reset();                                   // simula recarregar: o módulo relê do storage
  assert.strictEqual(R.count(), 1, 'a publicação sobreviveu ao recarregamento');
  assert.ok(R.html([]).indexOf('O erro que custou caro') > 0);
  assert.strictEqual(STORE[H.KEY], bruto, 'e reler não reescreveu o registro');
});

ok('medição vazia é recusada com o motivo — e a data/hora é obrigatória', () => {
  const id = JSON.parse(STORE[H.KEY]).posts[0].id;
  campos({ 'med:at': '2026-09-02T10:00' });    // nenhuma métrica
  R.act('res-med-new', botao({ id: id }));
  R.act('res-med-save', botao({ id: id }));
  assert.strictEqual(H.ui.medErros.length, 1);
  assert.ok(/ao menos uma métrica/.test(H.ui.medErros[0]));
  assert.strictEqual(JSON.parse(STORE[H.KEY]).posts[0].medicoes.length, 0);

  campos({ 'med:at': '', 'med:views': '100' });
  R.act('res-med-save', botao({ id: id }));
  assert.ok(/data e a hora/.test(H.ui.medErros[0]));
});

ok('duas medições da mesma publicação ficam lado a lado — o histórico não é sobrescrito', () => {
  const id = JSON.parse(STORE[H.KEY]).posts[0].id;
  campos({ 'med:at': '2026-09-02T10:00', 'med:views': '1000', 'med:curtidas': '80' });
  R.act('res-med-new', botao({ id: id }));
  R.act('res-med-save', botao({ id: id }));
  campos({ 'med:at': '2026-09-08T10:00', 'med:views': '5200', 'med:curtidas': '300' });
  R.act('res-med-new', botao({ id: id }));
  R.act('res-med-save', botao({ id: id }));

  const post = JSON.parse(STORE[H.KEY]).posts[0];
  assert.strictEqual(post.medicoes.length, 2, 'as duas ficam guardadas');
  assert.strictEqual(post.medicoes[0].views, 1000, 'em ordem cronológica');
  assert.strictEqual(post.medicoes[1].views, 5200);

  // A soma 6200 NÃO pode aparecer em lugar nenhum: seria contar as mesmas views duas vezes.
  const lista = H.pares(JSON.parse(STORE[H.KEY]).posts, F);
  assert.strictEqual(lista.length, 1);
  assert.strictEqual(lista[0].valor, 5200, 'a janela "ultima" usa 5200, nunca 1000+5200');
  const j24 = H.pares(JSON.parse(STORE[H.KEY]).posts, { janela: '24h', metrica: 'views', denom: 'views' });
  assert.strictEqual(j24[0].valor, 1000, 'e a de 24 h usa 1000, também sem somar');
});

ok('o detalhe mostra a variação entre medições, não a soma delas', () => {
  const id = JSON.parse(STORE[H.KEY]).posts[0].id;
  H.reset();
  R.act('res-open', botao({ id: id }));
  const html = R.html([]);
  assert.ok(html.indexOf('+4.200') > 0 || html.indexOf('+4200') > 0,
    'a variação 5200-1000 aparece como diferença');
  assert.ok(html.indexOf('6.200') < 0 && html.indexOf('6200') < 0,
    'a soma das duas medições NÃO aparece em lugar nenhum');
  assert.ok(html.indexOf('Curtidas') > 0);
  assert.ok(/não informado/.test(html), 'as métricas não preenchidas aparecem como não informado');
});

ok('o filtro troca a janela e o valor torto do DOM cai no padrão', () => {
  H.reset();
  assert.strictEqual(H.filtros.janela, 'ultima');
  assert.strictEqual(R.field({ dataset: { resFilter: 'janela' }, value: '24h' }), true, 'filtro pede repintura');
  assert.strictEqual(H.filtros.janela, '24h');
  R.field({ dataset: { resFilter: 'janela' }, value: 'inventado' });
  assert.strictEqual(H.filtros.janela, 'ultima');
  R.field({ dataset: { resFilter: 'metrica' }, value: 'engajamento' });
  assert.strictEqual(H.filtros.metrica, 'engajamento');
  assert.strictEqual(R.field({ dataset: { resFilter: 'nada' }, value: 'x' }), false);
  assert.strictEqual(R.field(null), false, 'chamada sem elemento não derruba a tela');
  H.reset();
});

ok('anotar aprendizado guarda e remover apaga, com persistência', () => {
  H.reset();
  campos({ 'nota-texto:repetir': 'Abrir com número concreto', 'nota-texto:testar': '' });
  assert.strictEqual(R.act('res-nota-add', botao({ tipo: 'repetir' })), true);
  assert.strictEqual(JSON.parse(STORE[H.KEY]).notas.length, 1);
  assert.strictEqual(R.act('res-nota-add', botao({ tipo: 'testar' })), false, 'nota vazia não é gravada');

  assert.strictEqual(R.act('res-nota-hipotese', botao({ texto: 'Nos próximos 3 cortes, mude só a duração.' })), true);
  const notas = JSON.parse(STORE[H.KEY]).notas;
  assert.strictEqual(notas.length, 2);
  assert.strictEqual(notas[0].tipo, 'testar', 'a hipótese entra em "o que testar"');

  R.act('res-nota-remove', botao({ id: notas[0].id }));
  assert.strictEqual(JSON.parse(STORE[H.KEY]).notas.length, 1);
  assert.strictEqual(R.act('res-nota-remove', botao({ id: 'nao-existe' })), false);
});

ok('editar preserva o id e o histórico de medições da publicação', () => {
  H.reset();
  const antes = JSON.parse(STORE[H.KEY]).posts[0];
  campos({
    plataforma: 'instagram', perfil: '@dootu', postedAt: antes.postedAt,
    titulo: 'Título corrigido', formato: 'erro'
  });
  R.act('res-edit', botao({ id: antes.id }));
  R.act('res-save', botao());
  const depois = JSON.parse(STORE[H.KEY]).posts[0];
  assert.strictEqual(depois.id, antes.id, 'o id não muda');
  assert.strictEqual(depois.medicoes.length, 2, 'as medições sobrevivem à edição');
  assert.strictEqual(depois.titulo, 'Título corrigido');
  assert.strictEqual(depois.plataforma, 'instagram');
});

ok('remover a publicação leva as medições dela e volta para a lista', () => {
  H.reset();
  const id = JSON.parse(STORE[H.KEY]).posts[0].id;
  R.act('res-remove', botao({ id: id }));
  assert.strictEqual(R.count(), 0);
  assert.strictEqual(H.ui.detail, '', 'e a tela volta para a lista');
  assert.strictEqual(R.act('res-remove', botao({ id: 'fantasma' })), false);
});

/* ============================================================= a tela não pode quebrar */
ok('a tela monta em todos os estados sem estourar', () => {
  limpa();
  const vazia = R.html([]);
  assert.ok(vazia.indexOf('Nenhuma publicação registrada') > 0, 'estado vazio explica o que fazer');
  assert.ok(vazia.indexOf('res-new') > 0, 'e oferece o caminho');

  campos({ plataforma: 'tiktok', perfil: '@d', postedAt: '2026-09-01T10:00', titulo: 'Corte A' });
  R.act('res-new', botao());
  R.act('res-save', botao());
  R.act('res-back', botao());
  const clips = [{ id: 'c1', clipName: 'Corte da Central', videoName: 'Podcast' }];
  const cheia = R.html(clips);
  ['Filtros', 'Resumo do período', 'Destaques', 'Comparação entre formatos', 'Padrões', 'Aprendizado']
    .forEach(secao => assert.ok(cheia.indexOf(secao) > 0, 'a seção "' + secao + '" está na tela'));
  assert.ok(cheia.indexOf('Dados insuficientes') > 0, 'com uma publicação só, a tela diz isso');

  R.act('res-new', botao());
  assert.ok(R.html(clips).indexOf('Corte da Central') > 0,
    'o formulário oferece os clips da Central para vincular');
  limpa();
});

ok('dado ilegível no storage NÃO é sobrescrito — a tela pede recuperação', () => {
  limpa();
  STORE[H.KEY] = '{isto nao e json';
  H.reset();
  assert.ok(R.html([]).indexOf('precisa de recuperação') > 0);
  assert.strictEqual(STORE[H.KEY], '{isto nao e json', 'o texto original continua intacto');
  limpa();
});

ok('a chave é própria e não colide com a Central nem com os projetos', () => {
  assert.strictEqual(H.KEY, 'pp_video_results_v1');
  assert.notStrictEqual(H.KEY, 'pp_video_clips_v1');
  assert.notStrictEqual(H.KEY, 'pp_video_projects_v1');
});

ok('o módulo NUNCA escreve na chave da Central nem na dos projetos', () => {
  limpa();
  STORE['pp_video_clips_v1'] = JSON.stringify({ version: 1, start: '2026-09-01', clips: [{ id: 'c1' }] });
  STORE['pp_video_projects_v1'] = JSON.stringify({ version: 1, projects: [{ id: 'proj1' }] });
  const clipsAntes = STORE['pp_video_clips_v1'];
  const projAntes = STORE['pp_video_projects_v1'];
  campos({ plataforma: 'tiktok', perfil: '@d', postedAt: '2026-09-01T10:00', clipId: 'c1' });
  R.act('res-new', botao());
  R.act('res-save', botao());
  assert.strictEqual(STORE['pp_video_clips_v1'], clipsAntes, 'a Central segue intacta');
  assert.strictEqual(STORE['pp_video_projects_v1'], projAntes, 'os projetos seguem intactos');
  assert.strictEqual(JSON.parse(STORE[H.KEY]).posts[0].clipId, 'c1', 'e o vínculo foi guardado');
  limpa();
});

console.log(provas + ' provas OK — Resultados dos cortes');
