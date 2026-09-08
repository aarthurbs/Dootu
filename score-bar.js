// score-bar.js
// Placar ÚNICO no header (#match-score). Substitui wizards-score.js + copa-score.js:
// consulta NBA (Wizards) e Copa (FIFA) na API pública da ESPN e mostra SÓ o jogo ativo.
// Se houver mais de um jogo ao vivo, ALTERNA entre eles — e a cada troca aplica o
// TEMA do time daquele jogo (cores + imagens de fundo/sidebar/logo) com um "véu"
// de transição estilo broadcast. Sem chave, sem backend (mesma exceção ESPN).
(function () {
  'use strict';
  var slot = document.getElementById('match-score');
  if (!slot) return;

  var NBA_SB  = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
  var COPA_SB = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
  var LIVE_MS = 30000;    // re-poll com jogo ao vivo
  var IDLE_MS = 600000;   // re-poll ocioso (10min)
  var ROTATE_MS = 14000;  // alternância entre jogos ao vivo
  var root = document.documentElement;

  // ESPN escreve algumas siglas NBA diferente do nome de arquivo local
  var NBA_ABBR = { GS: 'gsw', NO: 'nop', NY: 'nyk', SA: 'sas', UTAH: 'uta', WSH: 'was' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function espnLogo(t) { return t.logo || (t.logos && t.logos[0] && t.logos[0].href) || ''; }
  function nbaImg(t) {
    var a = (t.abbreviation || '').toUpperCase();
    return { local: 'assets/nba/' + (NBA_ABBR[a] || a.toLowerCase()) + '.png', espn: espnLogo(t) };
  }
  function flagImg(t) {
    var a = (t.abbreviation || '').toLowerCase();
    return { local: a ? 'assets/flags/' + a + '.png' : '', espn: espnLogo(t) };
  }
  function isWiz(c) {
    var t = (c && c.team) || {};
    return t.abbreviation === 'WSH' || t.abbreviation === 'WAS' || t.id === '27' || /wizards/i.test(t.displayName || '');
  }

  // Normaliza um evento ESPN num "match" comum às duas ligas
  function buildMatch(ev, league) {
    var cs = (ev.competitions && ev.competitions[0] && ev.competitions[0].competitors) || [];
    var home = cs.filter(function (c) { return c.homeAway === 'home'; })[0] || cs[0] || {};
    var away = cs.filter(function (c) { return c.homeAway === 'away'; })[0] || cs[1] || {};
    var st = ev.status || {};
    var imgFn = league === 'nba' ? nbaImg : flagImg;
    function side(c) {
      var t = (c && c.team) || {}; var im = imgFn(t);
      return {
        abbr: t.abbreviation || t.shortDisplayName || '',
        name: t.shortDisplayName || t.displayName || t.abbreviation || '',
        color: t.color || t.alternateColor || '',
        score: c.score, img: im.local, imgFallback: im.espn
      };
    }
    return {
      id: ev.id ? String(ev.id) : league, league: league,
      theme: league === 'nba' ? 'wizards' : 'brasil',
      date: ev.date, period: (st.period || 0),
      state: (st.type && st.type.state) || 'pre',
      detail: (st.type && st.type.shortDetail) || '',
      home: side(home), away: side(away)
    };
  }

  // ── render do conteúdo do slot ──
  function crest(s) {
    if (!s.img && !s.imgFallback) return '';
    var fb = s.imgFallback ? ' data-fb="' + esc(s.imgFallback) + '"' : '';
    return '<img class="ms-crest" alt="" src="' + esc(s.img || s.imgFallback) + '"' + fb +
      ' onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=\'\';}else{this.style.display=\'none\';}">';
  }
  function inner(m) {
    if (!m) return '<span class="ms-tm">JOGOS</span><span class="ms-clk">sem jogo ao vivo</span>';
    if (m.state === 'in' || m.state === 'post') {
      var fin = m.state === 'post' ? '<span class="ms-fin">' + (m.league === 'nba' ? 'Final' : 'Fim') + '</span>' : '';
      var dot = m.state === 'in' ? '<span class="ms-dot" aria-hidden="true"></span>' : '';
      return fin + dot + crest(m.home) +
        '<span class="ms-tm">' + esc(m.home.abbr) + '</span><b class="ms-sc">' + esc(m.home.score) + '</b>' +
        '<span class="ms-x">–</span>' +
        '<b class="ms-sc">' + esc(m.away.score) + '</b><span class="ms-tm">' + esc(m.away.abbr) + '</span>' +
        crest(m.away) + (m.state === 'in' ? '<span class="ms-clk">' + esc(m.detail) + '</span>' : '');
    }
    var hh = '';
    try { hh = new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    return crest(m.home) + '<span class="ms-tm">' + esc(m.home.abbr) + '</span><span class="ms-vs">x</span>' +
      '<span class="ms-tm">' + esc(m.away.abbr) + '</span>' + crest(m.away) +
      '<span class="ms-clk">' + (hh ? 'hoje ' + hh : esc(m.detail)) + '</span>';
  }

  // ── tema (cores + imagens via data-theme no <html>) ──
  var curTheme = 'wizards', lastId = null;
  function setTheme(t) {
    if (t === 'wizards') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    curTheme = t;
  }
  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function show(m) {
    // ponytail: tema fixo Wizards — usuário desativou a troca p/ 'brasil' em jogo
    // da Copa (2026-07-03). O placar da Copa continua; p/ reativar o tema adaptativo,
    // volte para: var theme = (m && m.state === 'in') ? m.theme : 'wizards';
    var theme = 'wizards';
    var id = m ? (m.league + ':' + m.id) : 'idle';
    var themeChange = theme !== curTheme;
    var animate = (id !== lastId) || themeChange;
    slot.dataset.state = m ? m.state : 'idle';
    slot.classList.toggle('is-live', !!(m && m.state === 'in'));
    function paint() { slot.innerHTML = '<div class="ms-in">' + inner(m) + '</div>'; }

    if (animate && !reduceMotion() && slot.querySelector('.ms-in')) {
      var veil = themeChange ? document.getElementById('theme-veil') : null;
      slot.classList.add('swapping');           // conteúdo some com blur (Emil: blur mascara a troca)
      if (veil) veil.classList.add('on');        // véu broadcast cobre a troca de imagem de fundo
      setTimeout(function () {
        setTheme(theme); paint();
        requestAnimationFrame(function () { slot.classList.remove('swapping'); });
        if (veil) setTimeout(function () { veil.classList.remove('on'); }, 70);
      }, 190);
    } else {
      setTheme(theme); paint();
    }
    lastId = id;
    if (m && m.state === 'in') maybePeriodIntro(m);
  }

  // ── Round Start (overlay "COMEÇOU"/"AO VIVO") — fire-once por jogo+período ──
  var piSeen = Object.create(null);
  function maybePeriodIntro(m) {
    if (m.period < 1 || typeof window.triggerPeriodIntro !== 'function') return;
    var k = m.league + ':' + m.id + ':' + m.period;
    if (piSeen[k]) return; piSeen[k] = 1;
    try { if (sessionStorage.getItem('msPI_' + k)) return; sessionStorage.setItem('msPI_' + k, '1'); } catch (e) {}
    var headline = m.league === 'nba' ? 'COMEÇOU' : 'AO VIVO';
    var label = m.league === 'nba'
      ? ({ 1: '1º QUARTO', 2: '2º QUARTO', 3: '3º QUARTO', 4: '4º QUARTO' }[m.period] || 'PRORROGAÇÃO')
      : (m.period === 1 ? '1º TEMPO' : (m.period === 2 ? '2º TEMPO' : 'PRORROGAÇÃO'));
    window.triggerPeriodIntro({ period: m.period, headline: headline, periodLabel: label, home: m.home, away: m.away });
  }

  // ── rotação entre jogos ao vivo ──
  var matches = { nba: null, copa: null };
  var liveList = [], rotIdx = 0, rotTimer = null, pollTimer = null;
  function refreshDisplay() {
    liveList = [matches.nba, matches.copa].filter(function (m) { return m && m.state === 'in'; });
    if (rotTimer) { clearInterval(rotTimer); rotTimer = null; }
    if (liveList.length) {
      if (rotIdx >= liveList.length) rotIdx = 0;
      show(liveList[rotIdx]);
      if (liveList.length > 1) {
        rotTimer = setInterval(function () { rotIdx = (rotIdx + 1) % liveList.length; show(liveList[rotIdx]); }, ROTATE_MS);
      }
    } else {
      var up = [matches.nba, matches.copa].filter(function (m) { return m && m.state === 'pre'; });
      up.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      show(up[0] || matches.nba || matches.copa || null);
    }
  }

  // ── GOL! (só Copa) — dispara o overlay broadcast quando o placar aumenta ──
  // NBA fica de fora de propósito: cesta a cada poll viraria animação constante.
  var golBase = Object.create(null);   // baseline por jogo: id -> {h, a}
  function golNum(v) { var n = parseInt(v, 10); return n > 0 ? n : 0; }
  function checkGol(m) {
    if (!m || m.state !== 'in') return;
    var prev = golBase[m.id];
    var h = golNum(m.home.score), a = golNum(m.away.score);
    golBase[m.id] = { h: h, a: a };
    if (!prev) return;                                   // 1ª leitura: só baseline, sem festa
    var side = h > prev.h ? m.home : (a > prev.a ? m.away : null);
    if (!side) return;                                   // sem aumento (ou gol anulado) = nada
    var i = liveList.indexOf(m);                         // traz o jogo do gol p/ o placar
    if (i >= 0 && i !== rotIdx) { rotIdx = i; show(m); }
    if (typeof window.triggerPeriodIntro === 'function') {
      window.triggerPeriodIntro({
        period: m.period, headline: 'GOOOL!',
        periodLabel: side.name, ariaLabel: 'Gol: ' + side.name,
        home: m.home, away: m.away
      });
    }
  }

  // ── fetch ──
  function getJSON(u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function pickNba(evs) {
    var ev = evs.filter(function (e) {
      var cs = (e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
      return cs.some(isWiz);
    })[0];
    return ev ? buildMatch(ev, 'nba') : null;
  }
  function pickCopa(evs) {
    function st(e) { return (e.status && e.status.type && e.status.type.state) || 'pre'; }
    var ev = evs.filter(function (e) { return st(e) === 'in'; })[0]
          || evs.filter(function (e) { return st(e) === 'pre'; })[0] || evs[evs.length - 1];
    return ev ? buildMatch(ev, 'copa') : null;
  }
  function plan(live) { if (pollTimer) clearTimeout(pollTimer); pollTimer = setTimeout(poll, live ? LIVE_MS : IDLE_MS); }
  function poll() {
    if (document.hidden) { plan(false); return; }
    Promise.allSettled([getJSON(NBA_SB), getJSON(COPA_SB)]).then(function (res) {
      if (res[0].status === 'fulfilled') matches.nba = pickNba(res[0].value.events || []);
      if (res[1].status === 'fulfilled') matches.copa = pickCopa(res[1].value.events || []);
      refreshDisplay();
      checkGol(matches.copa);
      var anyLive = (matches.nba && matches.nba.state === 'in') || (matches.copa && matches.copa.state === 'in');
      plan(anyLive);
    }).catch(function () { plan(false); });
  }

  document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  poll();

  // teste manual no console: alterna o tema sem jogo real
  window.msThemeTest = function (t) { setTheme(t === 'brasil' ? 'brasil' : 'wizards'); };

  // teste manual no console: msGolTest() simula a animação de gol (só apresentação)
  window.msGolTest = function () {
    if (typeof window.triggerPeriodIntro !== 'function') return;
    window.triggerPeriodIntro({
      period: 2, headline: 'GOOOL!', periodLabel: 'Brasil', ariaLabel: 'Gol: Brasil',
      home: { name: 'Brasil', color: 'F7D011', score: '2', img: 'assets/flags/bra.png' },
      away: { name: 'Argentina', color: '6CACE4', score: '1', img: 'assets/flags/arg.png' }
    });
  };
})();
