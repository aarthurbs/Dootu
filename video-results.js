/* Resultados dos cortes — o que aconteceu DEPOIS de publicar.

   Módulo próprio, montado como uma tela do Estúdio (`video-ops.js` delega as ações que
   começam em `res-`). Separado de propósito: o domínio aqui é publicação e medição, não
   produção de clip, e a suíte deste arquivo não pode ficar refém das provas do outro.

   Chave NOVA (`pp_video_results_v1`). `pp_video_clips_v1` é LIDO — o vínculo com o corte
   vem da Central — e nunca escrito: um módulo de análise que corrompe o registro de
   produção seria o pior desfecho possível.

   Três regras governam todas as contas aqui, e existem porque o contrário é o jeito normal
   de mentir com número:

   1. AUSÊNCIA NÃO É ZERO. Métrica não informada é `null` e aparece como "não informado".
      Somar `null` como 0 rebaixaria a mediana de quem não preencheu um campo.
   2. NUNCA SOMAR MEDIÇÕES DIFERENTES. As contagens das plataformas são ACUMULADAS: somar a
      medição de 24 h com a de 7 dias conta as mesmas visualizações duas vezes. Toda conta
      escolhe UMA medição por publicação (`medicaoDaJanela`).
   3. ASSOCIAÇÃO NÃO É CAUSA. Um padrão diz quantos cortes o sustentam, com quais exemplos e
      contra o quê foi comparado — e sai rotulado. Dado que não sustenta vira
      "dados insuficientes", não vira conclusão fraca escrita com confiança. */
(function () {
  'use strict';

  var KEY = 'pp_video_results_v1';
  var VERSION = 1;
  var DB = null;
  var BROKEN = '';

  /* Estado de SESSÃO (não persiste): qual painel está aberto, filtros da tela e os
     rascunhos de formulário. O rascunho existe porque a tela se redesenha por innerHTML —
     sem ele, um erro de validação apagaria tudo o que a pessoa digitou. */
  var UI = {
    form: null,        // {mode:'new'|'edit', id}
    draft: null,       // valores digitados, preservados entre re-renders
    erros: [],
    detail: '',        // id da publicação aberta
    medForm: '',       // id da publicação cuja medição está sendo digitada
    medDraft: null,
    medErros: [],
    ordem: 'metrica'   // 'metrica' | 'data'
  };

  var FILTROS = {
    plataforma: '', perfil: '', formato: '', duracao: '', distribuicao: '',
    dias: '0', janela: 'ultima', metrica: 'views', denom: 'views'
  };

  /* --- conjuntos fechados ------------------------------------------------------------
     Todo valor que vem do DOM passa por um validador (`daLista`). O `<select>` do navegador
     não é garantia: o value é entrada, e entrada torta gravada calada vira comparação entre
     grupos que não existem. '' é sempre legítimo e significa "não informado". */
  var PLATAFORMAS = [
    ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['youtube', 'YouTube Shorts'],
    ['kwai', 'Kwai'], ['linkedin', 'LinkedIn'], ['outra', 'Outra']
  ];
  var FORMATOS = [
    ['dica', 'Dica prática'], ['historia', 'História'], ['pergunta', 'Pergunta e resposta'],
    ['opiniao', 'Opinião'], ['erro', 'Erro comum'], ['bastidor', 'Bastidor'],
    ['lista', 'Lista'], ['outro', 'Outro']
  ];
  var ENQUADRAMENTOS = [
    ['rosto', 'Rosto fechado'], ['meio', 'Plano médio'], ['dois', 'Dois planos'],
    ['tela', 'Tela ou gráfico'], ['outro', 'Outro']
  ];
  var LEGENDAS = [
    ['queimada', 'Legenda queimada'], ['nativa', 'Legenda da plataforma'], ['sem', 'Sem legenda']
  ];
  var RITMOS = [['lento', 'Lento'], ['medio', 'Médio'], ['acelerado', 'Acelerado']];
  var DISTRIBUICOES = [['organico', 'Orgânico'], ['impulsionado', 'Impulsionado']];

  var FAIXAS_DURACAO = [
    ['ate30', 'Até 30 s'], ['30a60', '31 a 60 s'], ['60a90', '61 a 90 s'], ['90mais', 'Mais de 90 s']
  ];
  var FAIXAS_HASHTAG = [['zero', 'Sem hashtag'], ['poucas', '1 a 3 hashtags'], ['muitas', '4 ou mais hashtags']];
  var FAIXAS_GANCHO = [['curto', 'Gancho curto (até 6 palavras)'], ['medio', 'Gancho médio (7 a 12)'], ['longo', 'Gancho longo (13+)']];

  /* Janelas de medição. Uma publicação nova e uma de um mês não são comparáveis pela
     contagem crua, então toda comparação escolhe medições de idade parecida.
     [chave, rótulo, idade mínima em horas, idade máxima em horas]. */
  var JANELAS = [
    ['ultima', 'Última medição de cada uma', null, null],
    ['24h', 'Perto de 24 horas', 12, 48],
    ['7d', 'Perto de 7 dias', 120, 240]
  ];

  /* As métricas. `tipo` manda no formato de exibição; `contagem` é acumulada na plataforma
     (por isso nunca somada entre medições). */
  var METRICAS = [
    ['views', 'Visualizações', 'contagem'],
    ['alcance', 'Alcance', 'contagem'],
    ['curtidas', 'Curtidas', 'contagem'],
    ['comentarios', 'Comentários', 'contagem'],
    ['compartilhamentos', 'Compartilhamentos', 'contagem'],
    ['salvos', 'Salvamentos', 'contagem'],
    ['seguidores', 'Seguidores gerados', 'contagem'],
    ['tempoMedioSec', 'Tempo médio assistido', 'segundos'],
    ['retencao3s', 'Retenção inicial', 'percentual'],
    ['conclusao', 'Conclusão', 'percentual']
  ];
  /* A taxa não é um campo medido: é conta. Entra na lista de ordenação como `engajamento`. */
  var EIXOS = METRICAS.concat([['engajamento', 'Taxa de engajamento', 'taxa']]);
  var ENG_COMPONENTES = ['curtidas', 'comentarios', 'compartilhamentos', 'salvos'];
  var DENOMINADORES = [['views', 'Visualizações'], ['alcance', 'Alcance']];

  /* --- utilidades --------------------------------------------------------------------- */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function txt(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); }
  function uid(p) { return p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function daLista(lista, valor) {
    var v = txt(valor, 40);
    for (var i = 0; i < lista.length; i++) if (lista[i][0] === v) return v;
    return '';
  }
  function rotulo(lista, valor) {
    for (var i = 0; i < lista.length; i++) if (lista[i][0] === valor) return lista[i][1];
    return '';
  }
  function metricaLabel(chave) { return rotulo(EIXOS, chave) || chave; }
  function metricaTipo(chave) {
    for (var i = 0; i < EIXOS.length; i++) if (EIXOS[i][0] === chave) return EIXOS[i][2];
    return 'contagem';
  }
  /* O tradutor de número medido. '' e null são AUSÊNCIA, não zero — é a regra 1 lá de cima,
     e é por isso que `Number('')`, que dá 0, não pode ser usado aqui. */
  function numOuNulo(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    if (s === '') return null;
    var n = Number(s);
    if (!isFinite(n) || n < 0) return null;
    return n;
  }
  function urlSegura(v) {
    var s = txt(v, 600);
    return /^https?:\/\//i.test(s) ? s : '';
  }
  function agoraLocal() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  /* datetime-local nativo: guarda-se o texto local exato que a pessoa viu. Ferramenta
     pessoal num fuso só — inventar UTC aqui criaria uma diferença de horas no horário de
     publicação, que é justamente um dos campos que se quer analisar. */
  function quandoValido(v) {
    var s = txt(v, 30);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return '';
    return isFinite(new Date(s).getTime()) ? s.slice(0, 16) : '';
  }
  function fmtQuando(v) {
    if (!v) return '';
    var d = new Date(v);
    if (!isFinite(d.getTime())) return String(v);
    function p(n) { return String(n).padStart(2, '0'); }
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtNum(v, tipo) {
    if (v === null || v === undefined) return '<span class="res-na">não informado</span>';
    if (tipo === 'percentual') return esc(v.toFixed(1).replace('.', ',')) + '%';
    if (tipo === 'taxa') return esc((v * 100).toFixed(2).replace('.', ',')) + '%';
    if (tipo === 'segundos') return esc(String(Math.round(v))) + ' s';
    return esc(Math.round(v).toLocaleString('pt-BR'));
  }
  function fmtIdade(horas) {
    if (horas === null) return '—';
    if (horas < 48) return '+' + Math.round(horas) + ' h';
    return '+' + Math.round(horas / 24) + ' d';
  }
  /* BP-004: divisão por campo editável sempre guarda o denominador zero. */
  function divide(a, b) { return b ? a / b : null; }
  function mediana(valores) {
    var xs = [];
    for (var i = 0; i < valores.length; i++) {
      if (typeof valores[i] === 'number' && isFinite(valores[i])) xs.push(valores[i]);
    }
    if (!xs.length) return null;
    xs.sort(function (a, b) { return a - b; });
    var meio = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[meio] : (xs[meio - 1] + xs[meio]) / 2;
  }

  /* --- forma dos dados ---------------------------------------------------------------- */
  function medEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var quando = quandoValido(raw.at);
    if (!quando) return null;   // medição sem carimbo de tempo não diz a que altura mediu
    var m = { id: txt(raw.id, 60) || uid('med'), at: quando };
    METRICAS.forEach(function (met) { m[met[0]] = numOuNulo(raw[met[0]]); });
    return m;
  }
  function postEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var meds = (Array.isArray(raw.medicoes) ? raw.medicoes : []).map(medEntry).filter(Boolean);
    meds.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    return {
      id: txt(raw.id, 60) || uid('pub'),
      clipId: txt(raw.clipId, 60),
      titulo: txt(raw.titulo, 180),
      url: urlSegura(raw.url),
      plataforma: daLista(PLATAFORMAS, raw.plataforma) || 'outra',
      perfil: txt(raw.perfil, 80),
      postedAt: quandoValido(raw.postedAt),
      tema: txt(raw.tema, 120),
      formato: daLista(FORMATOS, raw.formato),
      duracaoSec: numOuNulo(raw.duracaoSec),
      gancho: txt(raw.gancho, 300),
      descricao: txt(raw.descricao, 1200),
      hashtags: txt(raw.hashtags, 400),
      cta: txt(raw.cta, 200),
      enquadramento: daLista(ENQUADRAMENTOS, raw.enquadramento),
      legendas: daLista(LEGENDAS, raw.legendas),
      ritmo: daLista(RITMOS, raw.ritmo),
      distribuicao: daLista(DISTRIBUICOES, raw.distribuicao),
      medicoes: meds.slice(0, 200),
      createdAt: txt(raw.createdAt, 40) || agoraLocal()
    };
  }
  function notaEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var texto = txt(raw.texto, 600);
    if (!texto) return null;
    return {
      id: txt(raw.id, 60) || uid('nota'),
      tipo: raw.tipo === 'testar' ? 'testar' : 'repetir',
      texto: texto,
      postId: txt(raw.postId, 60),
      createdAt: txt(raw.createdAt, 40) || agoraLocal()
    };
  }
  function seed() { return { version: VERSION, posts: [], notas: [] }; }
  /* BP-014: esta função mexe em dado PERSISTIDO, então é exportada e o teste a chama com o
     dado construído — nos dois ramos, com e sem `medicoes`/`notas`. */
  function sanitize(data) {
    if (!data || typeof data !== 'object') return null;
    return {
      version: VERSION,
      posts: (Array.isArray(data.posts) ? data.posts : []).map(postEntry).filter(Boolean).slice(0, 2000),
      notas: (Array.isArray(data.notas) ? data.notas : []).map(notaEntry).filter(Boolean).slice(0, 500)
    };
  }
  function load() {
    var bruto = null;
    try { bruto = localStorage.getItem(KEY); } catch (e) { bruto = null; }
    if (!bruto) return seed();
    var lido = null;
    try { lido = JSON.parse(bruto); } catch (e) { lido = null; }
    var limpo = sanitize(lido);
    if (!limpo) {
      /* Não sobrescreve o que não entendeu — mesma rede de segurança da Central. */
      BROKEN = bruto;
      return seed();
    }
    return limpo;
  }
  function persist() {
    if (!DB) return false;
    try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; }
    catch (e) { console.warn('[video-results] localStorage:', e); return false; }
  }
  function ensure() { if (!DB) DB = load(); return DB; }
  function postById(id) {
    var ps = ensure().posts;
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }

  /* --- contas -------------------------------------------------------------------------
     Tudo aqui é aritmética à vista: nenhuma nota única de "potencial viral", nenhum peso
     escondido. Quem lê a tela consegue refazer a conta no papel. */

  /* A taxa de engajamento. Os componentes NÃO são fixos: entram só os que foram medidos, e
     a assinatura carrega quais foram. Duas taxas com assinaturas diferentes medem coisas
     diferentes e não podem ser comparadas — a tela agrupa por assinatura por causa disto. */
  function engajamento(med, denomKey) {
    var denomK = denomKey === 'alcance' ? 'alcance' : 'views';
    var presentes = [];
    var faltando = [];
    ENG_COMPONENTES.forEach(function (k) {
      if (med && med[k] !== null && med[k] !== undefined) presentes.push(k); else faltando.push(k);
    });
    var denom = med ? med[denomK] : null;
    var rotDen = rotulo(METRICAS, denomK);
    if (!presentes.length || denom === null || denom === undefined || !(denom > 0)) {
      return {
        ok: false, taxa: null, assinatura: '', formula: '',
        faltando: (!presentes.length ? ENG_COMPONENTES.slice() : faltando),
        motivo: !presentes.length
          ? 'nenhum componente de engajamento foi medido'
          : ((denom === null || denom === undefined)
            ? rotDen + ' não foi informado'
            : rotDen + ' está zerado')
      };
    }
    var soma = 0;
    presentes.forEach(function (k) { soma += med[k]; });
    return {
      ok: true,
      taxa: divide(soma, denom),
      soma: soma, denom: denom, denomKey: denomK,
      componentes: presentes,
      assinatura: presentes.join('+') + '÷' + denomK,
      formula: '(' + presentes.map(function (k) { return rotulo(METRICAS, k); }).join(' + ')
        + ') ÷ ' + rotDen,
      faltando: faltando, motivo: ''
    };
  }

  function idadeHoras(post, med) {
    if (!post || !post.postedAt || !med || !med.at) return null;
    var a = new Date(post.postedAt).getTime();
    var b = new Date(med.at).getTime();
    if (!isFinite(a) || !isFinite(b)) return null;
    return (b - a) / 3600000;
  }
  /* UMA medição por publicação — regra 2. Nunca soma, nunca mistura: escolhe a que está
     dentro da janela e mais perto do alvo dela. Fora da janela devolve null, e quem chamou
     trata a publicação como "sem dado nesta janela" em vez de cair numa medição de idade
     diferente calada. */
  function medicaoDaJanela(post, janela) {
    var meds = (post && Array.isArray(post.medicoes)) ? post.medicoes : [];
    if (!meds.length) return null;
    if (janela !== '24h' && janela !== '7d') {
      return meds.slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); })[0];
    }
    var faixa = janela === '24h' ? [12, 48, 24] : [120, 240, 168];
    var melhor = null;
    var melhorDist = Infinity;
    meds.forEach(function (m) {
      var h = idadeHoras(post, m);
      if (h === null || h < faixa[0] || h > faixa[1]) return;
      var d = Math.abs(h - faixa[2]);
      if (d < melhorDist) { melhorDist = d; melhor = m; }
    });
    return melhor;
  }
  function valorMetrica(post, med, metrica, denom) {
    if (!med) return null;
    if (metrica === 'engajamento') {
      var e = engajamento(med, denom);
      return e.ok ? e.taxa : null;
    }
    var v = med[metrica];
    return (v === null || v === undefined) ? null : v;
  }

  function faixaDuracao(sec) {
    if (sec === null || sec === undefined) return '';
    if (sec <= 30) return 'ate30';
    if (sec <= 60) return '30a60';
    if (sec <= 90) return '60a90';
    return '90mais';
  }
  function faixaHashtags(texto) {
    var s = txt(texto, 400);
    if (!s) return '';           // campo vazio é "não informado", não "sem hashtag"
    var achou = s.match(/#[^\s#]+/g);
    var n = achou ? achou.length : 0;
    if (!n) return 'zero';
    return n <= 3 ? 'poucas' : 'muitas';
  }
  function faixaGancho(texto) {
    var s = txt(texto, 300);
    if (!s) return '';
    var n = s.split(/\s+/).filter(Boolean).length;
    if (n <= 6) return 'curto';
    return n <= 12 ? 'medio' : 'longo';
  }
  function temaChave(texto) { return txt(texto, 120).toLowerCase(); }

  /* As dimensões que a análise de padrões varre. Cada uma: [chave, rótulo, leitor, lista de
     rótulos de valor]. Lista null = valor livre (o próprio texto é o rótulo). */
  var DIMENSOES = [
    ['formato', 'Formato editorial', function (p) { return p.formato; }, FORMATOS],
    ['duracao', 'Duração', function (p) { return faixaDuracao(p.duracaoSec); }, FAIXAS_DURACAO],
    ['gancho', 'Tamanho do gancho', function (p) { return faixaGancho(p.gancho); }, FAIXAS_GANCHO],
    ['enquadramento', 'Enquadramento', function (p) { return p.enquadramento; }, ENQUADRAMENTOS],
    ['legendas', 'Legendas', function (p) { return p.legendas; }, LEGENDAS],
    ['ritmo', 'Ritmo', function (p) { return p.ritmo; }, RITMOS],
    ['hashtags', 'Hashtags', function (p) { return faixaHashtags(p.hashtags); }, FAIXAS_HASHTAG],
    ['tema', 'Tema', function (p) { return temaChave(p.tema); }, null]
  ];

  function filtra(posts, f) {
    var corte = null;
    var dias = Number(f.dias) || 0;
    if (dias > 0) corte = Date.now() - dias * 86400000;
    return posts.filter(function (p) {
      if (f.plataforma && p.plataforma !== f.plataforma) return false;
      if (f.perfil && p.perfil !== f.perfil) return false;
      if (f.formato && p.formato !== f.formato) return false;
      if (f.duracao && faixaDuracao(p.duracaoSec) !== f.duracao) return false;
      if (f.distribuicao && p.distribuicao !== f.distribuicao) return false;
      if (corte !== null) {
        var t = new Date(p.postedAt).getTime();
        if (!isFinite(t) || t < corte) return false;
      }
      return true;
    });
  }
  /* Cada publicação com a SUA medição da janela e o valor da métrica escolhida. É a lista
     que todo o resto consome — inclusive a garantia de que ninguém somou duas medições. */
  function pares(posts, f) {
    return posts.map(function (p) {
      var m = medicaoDaJanela(p, f.janela);
      return {
        post: p, med: m,
        valor: valorMetrica(p, m, f.metrica, f.denom),
        eng: m ? engajamento(m, f.denom) : null,
        idade: idadeHoras(p, m)
      };
    });
  }
  function comValor(lista) { return lista.filter(function (x) { return x.valor !== null; }); }
  function distintos(posts, campo) {
    var vistos = [];
    posts.forEach(function (p) { if (p[campo] && vistos.indexOf(p[campo]) < 0) vistos.push(p[campo]); });
    return vistos;
  }
  /* Quantos CORTES sustentam — não quantas publicações. Duas publicações do mesmo corte em
     plataformas diferentes são um corte só, e contá-las como dois infla a evidência. */
  function cortes(posts) {
    var vistos = [];
    posts.forEach(function (p) {
      var k = p.clipId || ('pub:' + p.id);
      if (vistos.indexOf(k) < 0) vistos.push(k);
    });
    return vistos.length;
  }
  /* O aviso de comparabilidade. Não bloqueia nada: diz o que o conjunto mistura e deixa a
     decisão com quem lê — mas dizer é obrigatório, porque comparar TikTok com Instagram
     calado produz um "formato vencedor" que é só a diferença entre as duas plataformas. */
  function avisos(posts) {
    var out = [];
    var plats = distintos(posts, 'plataforma');
    if (plats.length > 1) {
      out.push('Este conjunto mistura ' + plats.length + ' plataformas ('
        + plats.map(function (k) { return rotulo(PLATAFORMAS, k); }).join(', ')
        + '). A mesma publicação rende números diferentes em cada uma — filtre por plataforma antes de tirar conclusão.');
    }
    var perfis = distintos(posts, 'perfil');
    if (perfis.length > 1) {
      out.push('São ' + perfis.length + ' perfis diferentes. Perfil maior entrega mais por padrão; compare dentro de um perfil.');
    }
    var dist = distintos(posts, 'distribuicao');
    if (dist.indexOf('organico') >= 0 && dist.indexOf('impulsionado') >= 0) {
      out.push('Há publicações orgânicas e impulsionadas juntas. Alcance pago não mede a mesma coisa — separe pelo filtro Distribuição.');
    }
    return out;
  }
  /* Taxas com assinaturas diferentes não se comparam. Esta função separa o maior grupo de
     assinatura igual e diz quantas ficaram de fora, em vez de rankear tudo junto. */
  function porAssinatura(lista) {
    var grupos = Object.create(null);
    lista.forEach(function (x) {
      if (!x.eng || !x.eng.ok) return;
      (grupos[x.eng.assinatura] || (grupos[x.eng.assinatura] = [])).push(x);
    });
    var chaves = Object.keys(grupos);
    if (!chaves.length) return { assinatura: '', itens: [], fora: 0, outras: 0 };
    chaves.sort(function (a, b) { return grupos[b].length - grupos[a].length; });
    var maior = grupos[chaves[0]];
    var fora = 0;
    chaves.slice(1).forEach(function (k) { fora += grupos[k].length; });
    return { assinatura: chaves[0], itens: maior, fora: fora, outras: chaves.length - 1 };
  }

  /* Padrões. Um grupo só vira observação quando tem pelo menos 2 publicações E sobram pelo
     menos 2 fora dele — sem isso a "mediana dos demais" é uma publicação só. A diferença
     mínima de 15% existe para não transformar ruído em recomendação. */
  function padroes(lista) {
    var comDado = comValor(lista);
    if (comDado.length < 4) {
      return { ok: false, n: comDado.length, achados: [], fracos: [] };
    }
    var achados = [];
    DIMENSOES.forEach(function (dim) {
      var grupos = Object.create(null);
      comDado.forEach(function (x) {
        var v = dim[2](x.post);
        if (!v) return;                       // não informado fica fora, nunca vira grupo
        (grupos[v] || (grupos[v] = [])).push(x);
      });
      Object.keys(grupos).forEach(function (v) {
        var dentro = grupos[v];
        var fora = comDado.filter(function (x) { return dentro.indexOf(x) < 0; });
        if (dentro.length < 2 || fora.length < 2) return;
        var mDentro = mediana(dentro.map(function (x) { return x.valor; }));
        var mFora = mediana(fora.map(function (x) { return x.valor; }));
        if (mDentro === null || mFora === null) return;
        var delta = divide(mDentro - mFora, mFora);     // BP-004
        if (delta === null || Math.abs(delta) < 0.15) return;
        var valLabel = dim[3] ? (rotulo(dim[3], v) || v) : v;
        achados.push({
          dimensao: dim[0], dimensaoLabel: dim[1], valor: v, valorLabel: valLabel,
          n: dentro.length, cortes: cortes(dentro.map(function (x) { return x.post; })),
          nFora: fora.length,
          medianaDentro: mDentro, medianaFora: mFora, delta: delta,
          pequena: dentro.length < 3,
          exemplos: dentro.slice().sort(function (a, b) { return b.valor - a.valor; }).slice(0, 3),
          hipotese: delta > 0
            ? 'Nos próximos 3 cortes, mude só ' + dim[1].toLowerCase() + ' para «' + valLabel + '» e mantenha o resto igual.'
            : 'Nos próximos 3 cortes, troque ' + dim[1].toLowerCase() + ' «' + valLabel + '» por outra opção e mantenha o resto igual.'
        });
      });
    });
    achados.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
    var fracos = comDado.slice().sort(function (a, b) { return a.valor - b.valor; }).slice(0, 3);
    return { ok: true, n: comDado.length, achados: achados.slice(0, 6), fracos: fracos };
  }

  /* --- HTML ---------------------------------------------------------------------------- */
  function opcoes(lista, atual, rotuloVazio) {
    var out = rotuloVazio === null ? '' :
      '<option value=""' + (atual ? '' : ' selected') + '>' + esc(rotuloVazio) + '</option>';
    lista.forEach(function (o) {
      out += '<option value="' + esc(o[0]) + '"' + (atual === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    });
    return out;
  }
  function campo(label, nome, valor, tipo, dica) {
    return '<label class="vop-field"><span>' + esc(label) + '</span>'
      + '<input type="' + esc(tipo || 'text') + '" data-res-field="' + esc(nome) + '" value="' + esc(valor == null ? '' : valor) + '">'
      + (dica ? '<small>' + esc(dica) + '</small>' : '') + '</label>';
  }
  function campoSelect(label, nome, lista, valor, rotuloVazio) {
    return '<label class="vop-field"><span>' + esc(label) + '</span>'
      + '<select data-res-field="' + esc(nome) + '">' + opcoes(lista, valor, rotuloVazio) + '</select></label>';
  }
  function campoArea(label, nome, valor, dica) {
    return '<label class="vop-field"><span>' + esc(label) + '</span>'
      + '<textarea data-res-field="' + esc(nome) + '">' + esc(valor == null ? '' : valor) + '</textarea>'
      + (dica ? '<small>' + esc(dica) + '</small>' : '') + '</label>';
  }
  function filtro(label, nome, lista, valor, rotuloVazio) {
    return '<label class="vop-field"><span>' + esc(label) + '</span>'
      + '<select data-res-filter="' + esc(nome) + '">' + opcoes(lista, valor, rotuloVazio) + '</select></label>';
  }
  function tituloDe(post, clips) {
    if (post.titulo) return post.titulo;
    if (post.clipId && clips) {
      for (var i = 0; i < clips.length; i++) if (clips[i].id === post.clipId) return clips[i].clipName;
    }
    return 'Publicação sem título';
  }
  function chipPequena(n) {
    return '<span class="vop-chip res-chip-small" title="Menos de 3 publicações: a mediana aqui é frágil.">amostra pequena · n=' + n + '</span>';
  }

  function filtrosHTML(posts) {
    var perfis = distintos(posts, 'perfil').sort().map(function (p) { return [p, p]; });
    return '<section class="vop-section res-filters-wrap">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Recorte</span>'
      + '<h2>Filtros</h2>'
      + '<p class="vop-form-note">Comparação honesta é comparação dentro do mesmo recorte: mesma plataforma, mesmo perfil, tempo parecido desde a publicação.</p></div></div>'
      + '<div class="res-filters">'
      + filtro('Plataforma', 'plataforma', PLATAFORMAS, FILTROS.plataforma, 'Todas')
      + filtro('Perfil', 'perfil', perfis, FILTROS.perfil, 'Todos')
      + filtro('Período', 'dias', [['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias']], FILTROS.dias === '0' ? '' : FILTROS.dias, 'Desde sempre')
      + filtro('Formato', 'formato', FORMATOS, FILTROS.formato, 'Todos')
      + filtro('Duração', 'duracao', FAIXAS_DURACAO, FILTROS.duracao, 'Todas')
      + filtro('Distribuição', 'distribuicao', DISTRIBUICOES, FILTROS.distribuicao, 'Todas')
      + filtro('Medição usada', 'janela', JANELAS.map(function (j) { return [j[0], j[1]]; }), FILTROS.janela, null)
      + filtro('Métrica', 'metrica', EIXOS.map(function (m) { return [m[0], m[1]]; }), FILTROS.metrica, null)
      + filtro('Denominador da taxa', 'denom', DENOMINADORES, FILTROS.denom, null)
      + '</div></section>';
  }

  function resumoHTML(lista, posts) {
    var comDado = comValor(lista);
    var med = mediana(comDado.map(function (x) { return x.valor; }));
    var tipo = metricaTipo(FILTROS.metrica);
    var semMedicao = lista.length - comDado.length;
    var avs = avisos(posts);
    return '<section class="vop-section">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Resumo do período</span>'
      + '<h2>' + posts.length + ' publicação(ões) · ' + cortes(posts) + ' corte(s)</h2>'
      + '<p class="vop-form-note">Cada publicação entra com UMA medição — a da janela «'
      + esc(rotulo(JANELAS.map(function (j) { return [j[0], j[1]]; }), FILTROS.janela))
      + '». Contagens de medições diferentes nunca são somadas.</p></div></div>'
      + '<div class="res-stats">'
      + '<div class="res-stat"><span>Mediana de ' + esc(metricaLabel(FILTROS.metrica)) + '</span><strong>' + fmtNum(med, tipo) + '</strong></div>'
      + '<div class="res-stat"><span>Com dado nesta janela</span><strong>' + comDado.length + ' de ' + lista.length + '</strong></div>'
      + '<div class="res-stat"><span>Sem medição na janela</span><strong>' + semMedicao + '</strong></div>'
      + '<div class="res-stat"><span>Perfis</span><strong>' + (distintos(posts, 'perfil').length || '—') + '</strong></div>'
      + '</div>'
      + (avs.length
        ? '<ul class="res-warn">' + avs.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
        : '')
      + '</section>';
  }

  /* Três destaques, um por objetivo. Nota única de "potencial viral" não existe aqui de
     propósito: somar audiência com retenção num número só esconde qual dos dois mudou. */
  function destaqueBloco(titulo, explicacao, itens, metrica, clips, extra) {
    var tipo = metricaTipo(metrica);
    return '<div class="res-hl">'
      + '<h3>' + esc(titulo) + '</h3>'
      + '<p class="res-hl-note">' + esc(explicacao) + '</p>'
      + (extra || '')
      + (itens.length
        ? '<ol class="res-hl-list">' + itens.map(function (x) {
          return '<li><button type="button" class="res-link" data-act="res-open" data-id="' + esc(x.post.id) + '">'
            + esc(tituloDe(x.post, clips)) + '</button>'
            + '<span>' + fmtNum(x.valor, tipo) + '</span></li>';
        }).join('') + '</ol>'
        : '<p class="res-empty-line">Dados insuficientes: nenhuma publicação do recorte tem esta métrica medida na janela escolhida.</p>')
      + (itens.length && itens.length < 3
        ? '<p class="res-empty-line">' + esc('Só ' + itens.length + ' publicação(ões) com esta métrica — amostra pequena.') + '</p>'
        : '')
      + '</div>';
  }
  function topPor(lista, metrica, denom) {
    return lista.map(function (x) {
      return { post: x.post, med: x.med, valor: valorMetrica(x.post, x.med, metrica, denom) };
    }).filter(function (x) { return x.valor !== null; })
      .sort(function (a, b) { return b.valor - a.valor; }).slice(0, 3);
  }
  function destaquesHTML(lista, clips) {
    var eng = porAssinatura(lista);
    var engTop = eng.itens.slice().sort(function (a, b) { return b.eng.taxa - a.eng.taxa; }).slice(0, 3)
      .map(function (x) { return { post: x.post, med: x.med, valor: x.eng.taxa }; });
    var engExtra = eng.assinatura
      ? '<p class="res-formula">Fórmula: ' + esc(eng.itens[0].eng.formula) + '</p>'
        + (eng.fora
          ? '<p class="res-empty-line">' + eng.fora + ' publicação(ões) ficaram de fora: medem componentes diferentes, e taxas de componentes diferentes não se comparam.</p>'
          : '')
      : '';
    return '<section class="vop-section">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Destaques</span>'
      + '<h2>Separados por objetivo</h2>'
      + '<p class="vop-form-note">Audiência, engajamento e retenção respondem perguntas diferentes. Uma nota única de "potencial viral" esconderia qual delas mudou — por isso não existe aqui.</p></div></div>'
      + '<div class="res-hl-grid">'
      + destaqueBloco('Audiência', 'Quem foi mais longe em visualizações.', topPor(lista, 'views', FILTROS.denom), 'views', clips, '')
      + destaqueBloco('Engajamento', 'Taxa calculada só com o que foi medido.', engTop, 'engajamento', clips, engExtra)
      + destaqueBloco('Retenção', 'Percentual de conclusão — quem assistiu até o fim.', topPor(lista, 'conclusao', FILTROS.denom), 'conclusao', clips, '')
      + '</div></section>';
  }

  function formatosHTML(lista) {
    var comDado = comValor(lista);
    var tipo = metricaTipo(FILTROS.metrica);
    var grupos = Object.create(null);
    comDado.forEach(function (x) {
      var k = x.post.formato || '__sem';
      (grupos[k] || (grupos[k] = [])).push(x);
    });
    var chaves = Object.keys(grupos);
    if (!chaves.length) {
      return '<section class="vop-section"><div class="vop-section-head"><div>'
        + '<span class="vop-eyebrow">Formatos</span><h2>Comparação entre formatos</h2></div></div>'
        + '<p class="res-empty-line">Dados insuficientes: nenhuma publicação do recorte tem '
        + esc(metricaLabel(FILTROS.metrica)) + ' medido na janela escolhida.</p></section>';
    }
    var linhas = chaves.map(function (k) {
      var g = grupos[k];
      var vals = g.map(function (x) { return x.valor; });
      return {
        chave: k,
        label: k === '__sem' ? 'Formato não informado' : rotulo(FORMATOS, k),
        n: g.length, cortes: cortes(g.map(function (x) { return x.post; })),
        mediana: mediana(vals),
        min: Math.min.apply(null, vals), max: Math.max.apply(null, vals)
      };
    }).sort(function (a, b) { return (b.mediana || 0) - (a.mediana || 0); });
    return '<section class="vop-section">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Formatos</span>'
      + '<h2>Comparação entre formatos</h2>'
      + '<p class="vop-form-note">Mediana, não média: uma publicação que estourou não puxa o grupo inteiro para cima.</p></div></div>'
      + '<div class="res-table-wrap"><table class="res-table">'
      + '<thead><tr><th>Formato</th><th>Publicações</th><th>Cortes</th><th>Mediana de ' + esc(metricaLabel(FILTROS.metrica)) + '</th><th>Faixa</th></tr></thead><tbody>'
      + linhas.map(function (l) {
        return '<tr><td>' + esc(l.label) + (l.n < 3 ? ' ' + chipPequena(l.n) : '') + '</td>'
          + '<td>' + l.n + '</td><td>' + l.cortes + '</td>'
          + '<td class="res-num">' + fmtNum(l.mediana, tipo) + '</td>'
          + '<td class="res-num">' + fmtNum(l.min, tipo) + ' – ' + fmtNum(l.max, tipo) + '</td></tr>';
      }).join('')
      + '</tbody></table></div></section>';
  }

  function listaHTML(lista, clips) {
    var tipo = metricaTipo(FILTROS.metrica);
    var ordenada = lista.slice().sort(function (a, b) {
      if (UI.ordem === 'data') return String(b.post.postedAt).localeCompare(String(a.post.postedAt));
      /* Sem dado vai para o fim — nunca é tratado como zero (regra 1). */
      if (a.valor === null && b.valor === null) return String(b.post.postedAt).localeCompare(String(a.post.postedAt));
      if (a.valor === null) return 1;
      if (b.valor === null) return -1;
      return b.valor - a.valor;
    });
    return '<section class="vop-section">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Publicações</span>'
      + '<h2>' + lista.length + ' no recorte</h2></div>'
      + '<div class="vop-card-actions">'
      + '<button class="vop-btn ' + (UI.ordem === 'metrica' ? 'vop-btn-secondary' : 'vop-btn-quiet') + '" type="button" data-act="res-ordem" data-ordem="metrica">Por ' + esc(metricaLabel(FILTROS.metrica).toLowerCase()) + '</button>'
      + '<button class="vop-btn ' + (UI.ordem === 'data' ? 'vop-btn-secondary' : 'vop-btn-quiet') + '" type="button" data-act="res-ordem" data-ordem="data">Por data</button>'
      + '</div></div>'
      + '<div class="res-table-wrap"><table class="res-table">'
      + '<thead><tr><th>Publicação</th><th>Plataforma</th><th>Formato</th><th>Publicado</th><th>Medição</th><th>' + esc(metricaLabel(FILTROS.metrica)) + '</th><th></th></tr></thead><tbody>'
      + ordenada.map(function (x) {
        return '<tr><td><button type="button" class="res-link" data-act="res-open" data-id="' + esc(x.post.id) + '">'
          + esc(tituloDe(x.post, clips)) + '</button>'
          + (x.post.distribuicao === 'impulsionado' ? ' <span class="vop-chip res-chip-paid">impulsionado</span>' : '')
          + '<br><small>' + esc(x.post.perfil || 'perfil não informado') + '</small></td>'
          + '<td>' + esc(rotulo(PLATAFORMAS, x.post.plataforma)) + '</td>'
          + '<td>' + esc(rotulo(FORMATOS, x.post.formato) || '—') + '</td>'
          + '<td>' + esc(fmtQuando(x.post.postedAt) || '—') + '</td>'
          + '<td>' + (x.med ? esc(fmtIdade(x.idade)) : '<span class="res-na">sem medição</span>') + '</td>'
          + '<td class="res-num">' + fmtNum(x.valor, tipo) + '</td>'
          + '<td><button class="vop-btn vop-btn-quiet" type="button" data-act="res-open" data-id="' + esc(x.post.id) + '">Abrir</button></td></tr>';
      }).join('')
      + '</tbody></table></div></section>';
  }

  function padroesHTML(lista, clips) {
    var p = padroes(lista);
    var tipo = metricaTipo(FILTROS.metrica);
    var cabeca = '<div class="vop-section-head"><div><span class="vop-eyebrow">Padrões</span>'
      + '<h2>O que aparece junto com o melhor desempenho</h2>'
      + '<p class="vop-form-note">Isto é <strong>associação</strong>, nunca causa: o padrão diz que as duas coisas apareceram juntas, não que uma produziu a outra. A comparação está à vista para você julgar sozinho.</p></div></div>';
    if (!p.ok) {
      return '<section class="vop-section">' + cabeca
        + '<p class="res-empty-line">Dados insuficientes: ' + p.n + ' publicação(ões) com '
        + esc(metricaLabel(FILTROS.metrica)) + ' medido. São necessárias pelo menos 4 para comparar um grupo contra os demais.</p></section>';
    }
    var corpo = p.achados.length
      ? p.achados.map(function (a) {
        var sinal = a.delta > 0 ? 'res-pat-up' : 'res-pat-down';
        return '<article class="res-pat ' + sinal + '">'
          + '<header><h4>' + esc(a.dimensaoLabel + ': «' + a.valorLabel + '»') + '</h4>'
          + '<span class="res-pat-delta">' + (a.delta > 0 ? '+' : '') + esc((a.delta * 100).toFixed(0)) + '%</span></header>'
          + '<dl class="res-pat-facts">'
          + '<dt>Sustentado por</dt><dd>' + a.n + ' publicação(ões) em ' + a.cortes + ' corte(s)' + (a.pequena ? ' ' + chipPequena(a.n) : '') + '</dd>'
          + '<dt>Comparação</dt><dd>mediana ' + fmtNum(a.medianaDentro, tipo) + ' contra ' + fmtNum(a.medianaFora, tipo) + ' nas outras ' + a.nFora + '</dd>'
          + '<dt>Exemplos</dt><dd>' + a.exemplos.map(function (x) {
            return '<button type="button" class="res-link" data-act="res-open" data-id="' + esc(x.post.id) + '">' + esc(tituloDe(x.post, clips)) + '</button>';
          }).join(', ') + '</dd>'
          + '<dt>Hipótese para testar</dt><dd>' + esc(a.hipotese) + '</dd>'
          + '</dl>'
          + '<p class="res-pat-label">Associação observada, não causa comprovada.</p>'
          + '<div class="vop-card-actions"><button class="vop-btn vop-btn-secondary" type="button" data-act="res-nota-hipotese" data-texto="' + esc(a.hipotese) + '">Anotar como teste</button></div>'
          + '</article>';
      }).join('')
      : '<p class="res-empty-line">Nenhuma diferença de pelo menos 15% entre um grupo e os demais. Dados insuficientes para apontar um padrão — o que já é uma informação: nada aqui separa os resultados.</p>';
    var fracos = '<div class="res-weak"><h4>Resultados mais fracos do recorte</h4>'
      + '<p class="res-hl-note">Olhar só os vencedores esconde que a característica "vencedora" também aparece nos piores.</p>'
      + '<ul>' + p.fracos.map(function (x) {
        var carac = [rotulo(FORMATOS, x.post.formato), rotulo(FAIXAS_DURACAO, faixaDuracao(x.post.duracaoSec)), rotulo(RITMOS, x.post.ritmo)]
          .filter(Boolean).join(' · ');
        return '<li><button type="button" class="res-link" data-act="res-open" data-id="' + esc(x.post.id) + '">'
          + esc(tituloDe(x.post, clips)) + '</button> <span>' + fmtNum(x.valor, tipo) + '</span>'
          + (carac ? '<small>' + esc(carac) + '</small>' : '') + '</li>';
      }).join('') + '</ul></div>';
    return '<section class="vop-section">' + cabeca + '<div class="res-pat-grid">' + corpo + '</div>' + fracos + '</section>';
  }

  function notasHTML(clips) {
    var db = ensure();
    var repetir = db.notas.filter(function (n) { return n.tipo === 'repetir'; });
    var testar = db.notas.filter(function (n) { return n.tipo === 'testar'; });
    function coluna(titulo, lista, tipo) {
      return '<div class="res-note-col"><h4>' + esc(titulo) + '</h4>'
        + (lista.length
          ? '<ul>' + lista.map(function (n) {
            var p = n.postId ? postById(n.postId) : null;
            return '<li><p>' + esc(n.texto) + '</p>'
              + (p ? '<button type="button" class="res-link" data-act="res-open" data-id="' + esc(p.id) + '">motivada por: ' + esc(tituloDe(p, clips)) + '</button>' : '')
              + '<button class="vop-btn vop-btn-quiet" type="button" data-act="res-nota-remove" data-id="' + esc(n.id) + '">Remover</button></li>';
          }).join('') + '</ul>'
          : '<p class="res-empty-line">Nada anotado ainda.</p>')
        + '<div class="res-note-form">'
        + '<input type="text" data-res-nota-texto="' + esc(tipo) + '" placeholder="' + esc(tipo === 'repetir' ? 'O que deu certo e vale repetir' : 'O que testar no próximo corte') + '">'
        + '<button class="vop-btn vop-btn-secondary" type="button" data-act="res-nota-add" data-tipo="' + esc(tipo) + '">Anotar</button>'
        + '</div></div>';
    }
    return '<section class="vop-section">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Aprendizado</span>'
      + '<h2>Para os próximos cortes</h2>'
      + '<p class="vop-form-note">Um teste que muda três coisas ao mesmo tempo não ensina qual delas funcionou. Cada hipótese aqui muda uma característica por vez.</p></div></div>'
      + '<div class="res-note-grid">' + coluna('O que repetir', repetir, 'repetir') + coluna('O que testar', testar, 'testar') + '</div>'
      + '</section>';
  }

  /* --- formulário de publicação -------------------------------------------------------- */
  function formHTML(clips) {
    var editando = UI.form && UI.form.mode === 'edit' ? postById(UI.form.id) : null;
    var v = UI.draft || editando || { postedAt: agoraLocal() };
    var opcoesClip = (clips || []).map(function (c) {
      return [c.id, c.clipName + ' (' + (c.videoName || 'vídeo') + ')'];
    });
    return '<section class="vop-section res-form">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">' + (editando ? 'Editar' : 'Nova publicação') + '</span>'
      + '<h2>' + (editando ? 'Editar publicação' : 'Registrar uma publicação') + '</h2>'
      + '<p class="vop-form-note">Só plataforma, perfil e data/hora são obrigatórios. O resto é opcional — registrar rápido vale mais que registrar completo, e o que faltar aparece como "não informado" em vez de virar zero.</p></div></div>'
      + (UI.erros.length ? '<ul class="res-error">' + UI.erros.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '')
      + '<div class="res-form-grid">'
      + campoSelect('Corte da Central (opcional)', 'clipId', opcoesClip, v.clipId, 'Publicação avulsa — sem corte vinculado')
      + campo('Título na tela', 'titulo', v.titulo, 'text', 'Vindo de um corte, fica o nome do corte quando vazio.')
      + campoSelect('Plataforma *', 'plataforma', PLATAFORMAS, v.plataforma, 'Escolha')
      + campo('Perfil *', 'perfil', v.perfil, 'text', 'Ex.: @dootu')
      + campo('Data e hora da publicação *', 'postedAt', v.postedAt, 'datetime-local')
      + campo('Link', 'url', v.url, 'url', 'Começando em http:// ou https://')
      + campo('Tema', 'tema', v.tema, 'text', 'Ex.: precificação, tráfego pago')
      + campoSelect('Formato editorial', 'formato', FORMATOS, v.formato, 'Não informado')
      + campo('Duração (segundos)', 'duracaoSec', v.duracaoSec, 'number')
      + campoSelect('Distribuição', 'distribuicao', DISTRIBUICOES, v.distribuicao, 'Não informado')
      + campoSelect('Enquadramento', 'enquadramento', ENQUADRAMENTOS, v.enquadramento, 'Não informado')
      + campoSelect('Legendas', 'legendas', LEGENDAS, v.legendas, 'Não informado')
      + campoSelect('Ritmo', 'ritmo', RITMOS, v.ritmo, 'Não informado')
      + campo('Chamada para ação', 'cta', v.cta, 'text')
      + '</div>'
      + '<div class="res-form-grid res-form-wide">'
      + campoArea('Gancho inicial', 'gancho', v.gancho, 'A frase ou ideia dos primeiros segundos.')
      + campoArea('Descrição', 'descricao', v.descricao)
      + campoArea('Hashtags', 'hashtags', v.hashtags, 'Separadas por espaço: #ecommerce #vendas')
      + '</div>'
      + '<div class="vop-card-actions">'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="res-save">' + (editando ? 'Salvar alterações' : 'Registrar publicação') + '</button>'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="res-cancel">Cancelar</button>'
      + '</div></section>';
  }

  function medFormHTML(post) {
    var v = UI.medDraft || { at: agoraLocal() };
    return '<div class="res-med-form">'
      + '<h4>Nova medição</h4>'
      + '<p class="res-hl-note">Anote o que a plataforma mostra AGORA. Deixe em branco o que ela não mostra — em branco é "não informado", e zero seria mentira.</p>'
      + (UI.medErros.length ? '<ul class="res-error">' + UI.medErros.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '')
      + '<div class="res-form-grid">'
      + '<label class="vop-field"><span>Data e hora da medição</span><input type="datetime-local" data-res-med="at" value="' + esc(v.at) + '"></label>'
      + METRICAS.map(function (m) {
        return '<label class="vop-field"><span>' + esc(m[1]) + '</span>'
          + '<input type="number" min="0" step="any" data-res-med="' + esc(m[0]) + '" value="' + esc(v[m[0]] == null ? '' : v[m[0]]) + '"></label>';
      }).join('')
      + '</div>'
      + '<div class="vop-card-actions">'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="res-med-save" data-id="' + esc(post.id) + '">Salvar medição</button>'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="res-med-cancel">Cancelar</button>'
      + '</div></div>';
  }

  function detalheHTML(post, clips) {
    var meds = post.medicoes.slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var irmaos = ensure().posts.filter(function (p) {
      return post.clipId && p.clipId === post.clipId && p.id !== post.id;
    });
    function linha(rot, valor) {
      return '<dt>' + esc(rot) + '</dt><dd>' + (valor ? esc(valor) : '<span class="res-na">não informado</span>') + '</dd>';
    }
    return '<section class="vop-section res-detail">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Publicação</span>'
      + '<h2>' + esc(tituloDe(post, clips)) + '</h2>'
      + '<p class="vop-form-note">' + esc(rotulo(PLATAFORMAS, post.plataforma) + ' · ' + (post.perfil || 'perfil não informado') + ' · ' + (fmtQuando(post.postedAt) || 'data não informada')) + '</p></div>'
      + '<div class="vop-card-actions">'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="res-back">← Voltar</button>'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-act="res-edit" data-id="' + esc(post.id) + '">Editar</button>'
      + '<button class="vop-btn vop-btn-danger" type="button" data-act="res-remove" data-id="' + esc(post.id) + '">Remover</button>'
      + '</div></div>'
      + '<dl class="res-facts">'
      + linha('Link', post.url)
      + linha('Tema', post.tema)
      + linha('Formato editorial', rotulo(FORMATOS, post.formato))
      + linha('Duração', post.duracaoSec === null ? '' : post.duracaoSec + ' s')
      + linha('Gancho inicial', post.gancho)
      + linha('Descrição', post.descricao)
      + linha('Hashtags', post.hashtags)
      + linha('Chamada para ação', post.cta)
      + linha('Enquadramento', rotulo(ENQUADRAMENTOS, post.enquadramento))
      + linha('Legendas', rotulo(LEGENDAS, post.legendas))
      + linha('Ritmo', rotulo(RITMOS, post.ritmo))
      + linha('Distribuição', rotulo(DISTRIBUICOES, post.distribuicao))
      + '</dl>'
      + '<h3 class="res-sub">Evolução dos resultados</h3>'
      + '<p class="vop-form-note">As contagens da plataforma são acumuladas. A coluna de variação é a diferença para a medição anterior — nunca uma soma, que contaria as mesmas visualizações duas vezes.</p>'
      + (meds.length
        ? '<div class="res-table-wrap"><table class="res-table"><thead><tr><th>Medição</th><th>Idade</th>'
          + METRICAS.map(function (m) { return '<th>' + esc(m[1]) + '</th>'; }).join('')
          + '<th>Taxa de engajamento</th><th></th></tr></thead><tbody>'
          + meds.map(function (m, i) {
            var anterior = meds[i + 1] || null;
            var e = engajamento(m, FILTROS.denom);
            return '<tr><td>' + esc(fmtQuando(m.at)) + '</td>'
              + '<td>' + esc(fmtIdade(idadeHoras(post, m))) + '</td>'
              + METRICAS.map(function (met) {
                var v = m[met[0]];
                var delta = (anterior && v !== null && anterior[met[0]] !== null) ? v - anterior[met[0]] : null;
                return '<td class="res-num">' + fmtNum(v, met[2])
                  + (delta !== null && delta !== 0 ? '<small class="res-delta">' + (delta > 0 ? '+' : '') + esc(Math.round(delta).toLocaleString('pt-BR')) + '</small>' : '')
                  + '</td>';
              }).join('')
              + '<td class="res-num">' + (e.ok
                ? fmtNum(e.taxa, 'taxa') + '<small class="res-formula-inline">' + esc(e.formula) + ' = ' + esc(Math.round(e.soma).toLocaleString('pt-BR')) + ' ÷ ' + esc(Math.round(e.denom).toLocaleString('pt-BR')) + '</small>'
                : '<span class="res-na">não calculável</span><small class="res-formula-inline">' + esc(e.motivo) + '</small>') + '</td>'
              + '<td><button class="vop-btn vop-btn-quiet" type="button" data-act="res-med-remove" data-id="' + esc(post.id) + '" data-med="' + esc(m.id) + '">Remover</button></td></tr>';
          }).join('')
          + '</tbody></table></div>'
        : '<p class="res-empty-line">Nenhuma medição registrada. Sem medição não há resultado — só publicação.</p>')
      + (UI.medForm === post.id
        ? medFormHTML(post)
        : '<div class="vop-card-actions"><button class="vop-btn vop-btn-primary" type="button" data-act="res-med-new" data-id="' + esc(post.id) + '">+ Nova medição</button></div>')
      + (irmaos.length
        ? '<h3 class="res-sub">Outras publicações deste mesmo corte</h3>'
          + '<ul class="res-siblings">' + irmaos.map(function (p) {
            return '<li><button type="button" class="res-link" data-act="res-open" data-id="' + esc(p.id) + '">'
              + esc(rotulo(PLATAFORMAS, p.plataforma) + ' · ' + (p.perfil || 'sem perfil')) + '</button>'
              + '<small>' + esc(fmtQuando(p.postedAt) || 'sem data') + '</small></li>';
          }).join('') + '</ul>'
        : '')
      + '</section>';
  }

  function recuperacaoHTML() {
    return '<section class="vop-empty"><div class="vop-empty-icon" aria-hidden="true">!</div>'
      + '<h2>O registro de resultados precisa de recuperação</h2>'
      + '<p>Os dados salvos neste navegador não foram reconhecidos e permanecem intactos. Nada foi apagado — copie o texto bruto antes de recomeçar.</p>'
      + '<div class="vop-card-actions"><button class="vop-btn vop-btn-secondary" type="button" data-act="res-raw">Copiar dados brutos</button></div></section>';
  }

  /* A tela. `clips` vem do `video-ops.js` (a Central já está carregada lá) — ler o
     localStorage de novo aqui só criaria uma segunda cópia que pode divergir. */
  function html(clips) {
    ensure();
    if (BROKEN) return recuperacaoHTML();
    var posts = DB.posts;
    if (UI.detail) {
      var aberto = postById(UI.detail);
      if (aberto) return detalheHTML(aberto, clips);
      UI.detail = '';
    }
    if (UI.form) return formHTML(clips);
    var barra = '<div class="res-topbar">'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="res-new">+ Registrar publicação</button>'
      + '</div>';
    if (!posts.length) {
      return barra + '<section class="vop-empty"><div class="vop-empty-icon" aria-hidden="true">📈</div>'
        + '<h2>Nenhuma publicação registrada ainda</h2>'
        + '<p>Esta tela aprende com o que você já publicou. Registre a primeira publicação — plataforma, perfil e data bastam — e volte depois de 24 horas para anotar as métricas que a plataforma mostrar.</p>'
        + '<div class="vop-card-actions"><button class="vop-btn vop-btn-primary" type="button" data-act="res-new">Registrar a primeira</button></div></section>';
    }
    var filtrados = filtra(posts, FILTROS);
    var lista = pares(filtrados, FILTROS);
    return barra
      + filtrosHTML(posts)
      + resumoHTML(lista, filtrados)
      + destaquesHTML(lista, clips)
      + formatosHTML(lista)
      + listaHTML(lista, clips)
      + padroesHTML(lista, clips)
      + notasHTML(clips);
  }

  /* --- leitura do formulário ----------------------------------------------------------- */
  function leCampo(nome) {
    var el = document.querySelector('[data-res-field="' + nome + '"]');
    return el ? el.value : '';
  }
  function leForm() {
    var d = {};
    ['clipId', 'titulo', 'plataforma', 'perfil', 'postedAt', 'url', 'tema', 'formato',
      'duracaoSec', 'distribuicao', 'enquadramento', 'legendas', 'ritmo', 'cta',
      'gancho', 'descricao', 'hashtags'].forEach(function (k) { d[k] = leCampo(k); });
    return d;
  }
  function valida(d) {
    var erros = [];
    if (!daLista(PLATAFORMAS, d.plataforma)) erros.push('Escolha a plataforma.');
    if (!txt(d.perfil, 80)) erros.push('Informe o perfil que publicou.');
    if (!quandoValido(d.postedAt)) erros.push('Informe a data e a hora da publicação — sem ela não dá para saber a idade das medições.');
    if (txt(d.url, 600) && !urlSegura(d.url)) erros.push('O link precisa começar em http:// ou https://.');
    return erros;
  }
  function leMed() {
    var d = {};
    var at = document.querySelector('[data-res-med="at"]');
    d.at = at ? at.value : '';
    METRICAS.forEach(function (m) {
      var el = document.querySelector('[data-res-med="' + m[0] + '"]');
      d[m[0]] = el ? el.value : '';
    });
    return d;
  }

  /* --- ações --------------------------------------------------------------------------
     Devolve true quando a tela precisa ser redesenhada. Quem redesenha é o `video-ops.js`,
     dono do `#video-ops-root` — dois módulos escrevendo no mesmo innerHTML seria a receita
     para um apagar o outro. */
  function act(acao, botao) {
    ensure();
    var ds = (botao && botao.dataset) ? botao.dataset : {};
    var id = ds.id || '';
    if (acao === 'res-new') { UI.form = { mode: 'new' }; UI.draft = null; UI.erros = []; UI.detail = ''; return true; }
    if (acao === 'res-edit') { UI.form = { mode: 'edit', id: id }; UI.draft = null; UI.erros = []; UI.detail = ''; return true; }
    if (acao === 'res-cancel') { UI.form = null; UI.draft = null; UI.erros = []; return true; }
    if (acao === 'res-save') {
      var d = leForm();
      var erros = valida(d);
      if (erros.length) { UI.draft = d; UI.erros = erros; return true; }
      var existente = UI.form && UI.form.mode === 'edit' ? postById(UI.form.id) : null;
      var cru = {};
      if (existente) { Object.keys(existente).forEach(function (k) { cru[k] = existente[k]; }); }
      Object.keys(d).forEach(function (k) { cru[k] = d[k]; });
      if (existente) { cru.id = existente.id; cru.medicoes = existente.medicoes; cru.createdAt = existente.createdAt; }
      var pronto = postEntry(cru);
      if (existente) DB.posts[DB.posts.indexOf(existente)] = pronto;
      else DB.posts.push(pronto);
      persist();
      UI.form = null; UI.draft = null; UI.erros = [];
      UI.detail = pronto.id;
      return true;
    }
    if (acao === 'res-open') { UI.detail = id; UI.form = null; UI.medForm = ''; UI.medDraft = null; UI.medErros = []; return true; }
    if (acao === 'res-back') { UI.detail = ''; UI.medForm = ''; UI.medDraft = null; return true; }
    if (acao === 'res-remove') {
      var alvo = postById(id);
      if (!alvo) return false;
      if (typeof confirm === 'function'
        && !confirm('Remover esta publicação e as ' + alvo.medicoes.length + ' medição(ões) dela? Não dá para desfazer.')) return false;
      DB.posts.splice(DB.posts.indexOf(alvo), 1);
      persist();
      UI.detail = '';
      return true;
    }
    if (acao === 'res-ordem') { UI.ordem = ds.ordem === 'data' ? 'data' : 'metrica'; return true; }
    if (acao === 'res-med-new') { UI.medForm = id; UI.medDraft = null; UI.medErros = []; return true; }
    if (acao === 'res-med-cancel') { UI.medForm = ''; UI.medDraft = null; UI.medErros = []; return true; }
    if (acao === 'res-med-save') {
      var dono = postById(id);
      if (!dono) return false;
      var md = leMed();
      var med = medEntry(md);
      var errosMed = [];
      if (!med) errosMed.push('Informe a data e a hora da medição.');
      else if (!METRICAS.some(function (m) { return med[m[0]] !== null; })) {
        errosMed.push('Informe ao menos uma métrica. Medição vazia não diz nada — e zero em tudo diria algo falso.');
      }
      if (errosMed.length) { UI.medDraft = md; UI.medErros = errosMed; return true; }
      dono.medicoes.push(med);
      dono.medicoes.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
      persist();
      UI.medForm = ''; UI.medDraft = null; UI.medErros = [];
      return true;
    }
    if (acao === 'res-med-remove') {
      var p = postById(id);
      if (!p) return false;
      var i = -1;
      p.medicoes.forEach(function (m, idx) { if (m.id === ds.med) i = idx; });
      if (i < 0) return false;
      if (typeof confirm === 'function' && !confirm('Remover esta medição?')) return false;
      p.medicoes.splice(i, 1);
      persist();
      return true;
    }
    if (acao === 'res-nota-add' || acao === 'res-nota-hipotese') {
      var tipo = acao === 'res-nota-hipotese' ? 'testar' : (ds.tipo === 'testar' ? 'testar' : 'repetir');
      var texto = '';
      if (acao === 'res-nota-hipotese') texto = ds.texto || '';
      else {
        var campoNota = document.querySelector('[data-res-nota-texto="' + tipo + '"]');
        texto = campoNota ? campoNota.value : '';
      }
      var nota = notaEntry({ tipo: tipo, texto: texto, postId: UI.detail });
      if (!nota) return false;
      DB.notas.unshift(nota);
      persist();
      return true;
    }
    if (acao === 'res-nota-remove') {
      var antes = DB.notas.length;
      DB.notas = DB.notas.filter(function (n) { return n.id !== id; });
      if (DB.notas.length === antes) return false;
      persist();
      return true;
    }
    if (acao === 'res-raw') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(BROKEN);
      return false;
    }
    return false;
  }

  /* Campos: só o FILTRO redesenha. Os campos do formulário são lidos no salvar — redesenhar
     a cada tecla tiraria o foco e apagaria o que está sendo digitado (a mesma armadilha que
     o `ytUrlWrite` do Estúdio evita). */
  function field(el) {
    if (!el || !el.dataset) return false;
    var nome = el.dataset.resFilter;
    if (!nome) return false;
    if (nome === 'dias') { FILTROS.dias = String(Number(el.value) || 0); return true; }
    if (nome === 'janela') { FILTROS.janela = daLista(JANELAS, el.value) || 'ultima'; return true; }
    if (nome === 'metrica') { FILTROS.metrica = daLista(EIXOS, el.value) || 'views'; return true; }
    if (nome === 'denom') { FILTROS.denom = daLista(DENOMINADORES, el.value) || 'views'; return true; }
    if (nome === 'plataforma') { FILTROS.plataforma = daLista(PLATAFORMAS, el.value); return true; }
    if (nome === 'formato') { FILTROS.formato = daLista(FORMATOS, el.value); return true; }
    if (nome === 'duracao') { FILTROS.duracao = daLista(FAIXAS_DURACAO, el.value); return true; }
    if (nome === 'distribuicao') { FILTROS.distribuicao = daLista(DISTRIBUICOES, el.value); return true; }
    if (nome === 'perfil') { FILTROS.perfil = txt(el.value, 80); return true; }
    return false;
  }

  function count() { return ensure().posts.length; }

  var API = {
    html: html, act: act, field: field, count: count,
    /* Porta de teste: a lógica pura é exercitada com dado construído, nunca só lida. */
    __: {
      sanitize: sanitize, postEntry: postEntry, medEntry: medEntry, notaEntry: notaEntry,
      engajamento: engajamento, medicaoDaJanela: medicaoDaJanela, idadeHoras: idadeHoras,
      valorMetrica: valorMetrica, mediana: mediana, numOuNulo: numOuNulo,
      faixaDuracao: faixaDuracao, faixaHashtags: faixaHashtags, faixaGancho: faixaGancho,
      padroes: padroes, pares: pares, filtra: filtra, avisos: avisos,
      porAssinatura: porAssinatura, cortes: cortes, fmtNum: fmtNum, divide: divide,
      quandoValido: quandoValido, daLista: daLista, valida: valida,
      PLATAFORMAS: PLATAFORMAS, FORMATOS: FORMATOS, METRICAS: METRICAS, EIXOS: EIXOS,
      JANELAS: JANELAS, DIMENSOES: DIMENSOES, ENG_COMPONENTES: ENG_COMPONENTES,
      KEY: KEY,
      reset: function () {
        DB = null; BROKEN = '';
        UI.detail = ''; UI.form = null; UI.draft = null; UI.erros = [];
        UI.medForm = ''; UI.medDraft = null; UI.medErros = []; UI.ordem = 'metrica';
        FILTROS.plataforma = ''; FILTROS.perfil = ''; FILTROS.formato = '';
        FILTROS.duracao = ''; FILTROS.distribuicao = ''; FILTROS.dias = '0';
        FILTROS.janela = 'ultima'; FILTROS.metrica = 'views'; FILTROS.denom = 'views';
      },
      ui: UI, filtros: FILTROS
    }
  };

  if (typeof window !== 'undefined') window.videoResults = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
