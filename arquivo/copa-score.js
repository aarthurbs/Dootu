// copa-score.js
// Barra ao vivo dos jogos da Copa (FIFA World Cup) — dados PÚBLICOS da ESPN.
// Mesma exceção autorizada do placar dos Wizards (wizards-score.js), só muda o
// endpoint para futebol. Sem chave, sem backend. Se a ESPN mudar a estrutura,
// só este arquivo precisa de ajuste.
//
// Round Start: dispara o overlay "AO VIVO" (period-intro.js) na virada de tempo,
// mostrando as BANDEIRAS das seleções (assets/flags/<sigla>.png; fallback ESPN).
(function () {
  'use strict';
  var el = document.getElementById('copa-score');
  if (!el) return;

  // Copa do Mundo FIFA. (Para outra competição, troque "fifa.world" — ex.:
  // "fifa.worldq.conmebol", "uefa.euro" — que o resto do código segue igual.)
  var SB = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
  var LIVE_MS = 30000;    // 30s com jogo ao vivo
  var IDLE_MS = 600000;   // 10min caso contrário
  var timer = null;

  var esc = function (s) { return String(s == null ? '' : s); };

  function set(state, html, live) {
    el.dataset.state = state;
    el.classList.toggle('is-live', !!live);
    el.innerHTML = html;
  }
  function idle() {
    set('idle', '<span class="cp-tm">COPA</span><span class="cp-clk">sem jogo agora</span>', false);
  }

  function teamAbbr(c) {
    var t = (c && c.team) || {};
    return t.abbreviation || t.shortDisplayName || t.name || '';
  }
  function teamName(c) {
    var t = (c && c.team) || {};
    return t.shortDisplayName || t.name || t.displayName || t.abbreviation || '';
  }
  // Bandeira/escudo da ESPN (URL) — usado como fallback se não houver arquivo local.
  function espnLogo(c) {
    var t = (c && c.team) || {};
    if (t.logo) return t.logo;
    if (t.logos && t.logos[0] && t.logos[0].href) return t.logos[0].href;
    return '';
  }
  // Caminho local da bandeira: assets/flags/<sigla minúscula>.png
  function flagLocal(c) {
    var a = teamAbbr(c);
    return a ? 'assets/flags/' + a.toLowerCase() + '.png' : '';
  }

  // ── Round Start: overlay "AO VIVO" no início e a cada virada de tempo. ───────
  var piSeen = Object.create(null);
  function piAlready(key) {
    if (piSeen[key]) return true;
    try { if (sessionStorage.getItem('copaPI_' + key)) { piSeen[key] = 1; return true; } } catch (e) {}
    return false;
  }
  function piMark(key) {
    piSeen[key] = 1;
    try { sessionStorage.setItem('copaPI_' + key, '1'); } catch (e) {}
  }
  function periodLabel(p) {
    if (p === 1) return '1º TEMPO';
    if (p === 2) return '2º TEMPO';
    return 'PRORROGAÇÃO';   // ≥3
  }
  function piSide(c) {
    var t = (c && c.team) || {};
    return {
      name: teamName(c),
      color: t.color || t.alternateColor || '',
      score: c.score,
      img: flagLocal(c),        // bandeira local primeiro
      imgFallback: espnLogo(c)  // bandeira/escudo da ESPN se a local não existir
    };
  }
  function buildPeriodState(ev, home, away) {
    var period = (ev.status && ev.status.period) || 1;
    return { period: period, headline: 'AO VIVO', periodLabel: periodLabel(period),
             home: piSide(home), away: piSide(away) };
  }
  function maybePeriodIntro(ev, home, away) {
    var period = (ev.status && ev.status.period) || 0;
    if (period < 1) return;                      // ignora pré-jogo
    var id = (ev && ev.id) ? String(ev.id) : 'copa';
    var key = id + ':' + period;                 // fire-once por (jogo, tempo), por sessão
    if (piAlready(key)) return;
    piMark(key);
    if (typeof window.triggerPeriodIntro === 'function') {
      window.triggerPeriodIntro(buildPeriodState(ev, home, away));
    }
  }

  // Escolhe UM jogo pra destacar: ao vivo > próximo agendado > último encerrado.
  function pickEvent(evs) {
    function st(e) { return (e.status && e.status.type && e.status.type.state) || 'pre'; }
    return evs.filter(function (e) { return st(e) === 'in'; })[0]
        || evs.filter(function (e) { return st(e) === 'pre'; })[0]
        || evs[evs.length - 1] || null;
  }

  function sides(ev) {
    var cs = (ev.competitions && ev.competitions[0] && ev.competitions[0].competitors) || [];
    var home = cs.filter(function (c) { return c.homeAway === 'home'; })[0] || cs[0] || {};
    var away = cs.filter(function (c) { return c.homeAway === 'away'; })[0] || cs[1] || {};
    return { home: home, away: away };
  }

  function render(ev) {
    var s = sides(ev), home = s.home, away = s.away;
    var ha = teamAbbr(home), aa = teamAbbr(away);
    var stt = ev.status || {};
    var state = (stt.type && stt.type.state) || 'pre';
    var detail = (stt.type && stt.type.shortDetail) || '';

    if (state === 'in') {
      set('live', '<span class="cp-dot" aria-hidden="true"></span>' +
        '<span class="cp-tm">' + esc(ha) + '</span><b class="cp-sc">' + esc(home.score) + '</b>' +
        '<span class="cp-x">–</span>' +
        '<b class="cp-sc">' + esc(away.score) + '</b><span class="cp-tm">' + esc(aa) + '</span>' +
        '<span class="cp-clk">' + esc(detail) + '</span>', true);
      maybePeriodIntro(ev, home, away);
      return true;
    }
    if (state === 'post') {
      set('post', '<span class="cp-fin">Fim</span>' +
        '<span class="cp-tm">' + esc(ha) + '</span><b class="cp-sc">' + esc(home.score) + '</b>' +
        '<span class="cp-x">–</span>' +
        '<b class="cp-sc">' + esc(away.score) + '</b><span class="cp-tm">' + esc(aa) + '</span>', false);
      return false;
    }
    // pre — agendado
    var hh = '';
    try { hh = new Date(ev.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    set('pre', '<span class="cp-tm">' + esc(ha) + '</span><span class="cp-vs">x</span>' +
      '<span class="cp-tm">' + esc(aa) + '</span>' +
      '<span class="cp-clk">' + (hh ? 'hoje ' + hh : esc(detail)) + '</span>', false);
    return false;
  }

  function plan(live) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(poll, live ? LIVE_MS : IDLE_MS);
  }

  function poll() {
    if (document.hidden) { plan(false); return; }   // não busca em aba oculta
    fetch(SB, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        var evs = j.events || [];
        var ev = pickEvent(evs);
        if (!ev) { idle(); plan(false); return; }
        plan(render(ev));
      })
      .catch(function () { idle(); plan(false); });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) poll();   // re-checa ao voltar pra aba
  });

  poll();
})();
