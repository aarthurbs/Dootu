// wizards-score.js
// Barra ao vivo dos Washington Wizards — dados PÚBLICOS da ESPN (sem chave, sem backend).
// CORS verificado: Access-Control-Allow-Origin: * (funciona em file:// e via servidor).
// Endpoint não-oficial: se a ESPN mudar a estrutura, só este arquivo precisa de ajuste.
(function () {
  'use strict';
  var el = document.getElementById('wiz-score');
  if (!el) return;

  var SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
  var LIVE_MS = 30000;    // 30s enquanto há jogo ao vivo
  var IDLE_MS = 600000;   // 10min caso contrário
  var timer = null;

  function isWiz(c) {
    var t = (c && c.team) || {};
    return t.abbreviation === 'WSH' || t.abbreviation === 'WAS' ||
           t.id === '27' || /wizards/i.test(t.displayName || '');
  }

  var esc = function (s) { return String(s == null ? '' : s); };

  function set(state, html, live) {
    el.dataset.state = state;
    el.classList.toggle('is-live', !!live);
    el.innerHTML = html;
  }

  function score(aAb, aSc, bAb, bSc) {
    return '<span class="wz-tm">' + esc(aAb) + '</span>' +
           '<b class="wz-sc">' + esc(aSc) + '</b>' +
           '<span class="wz-x">–</span>' +
           '<b class="wz-sc">' + esc(bSc) + '</b>' +
           '<span class="wz-tm">' + esc(bAb) + '</span>';
  }

  function idle() {
    set('idle', '<span class="wz-tm">WIZARDS</span><span class="wz-clk">sem jogo hoje</span>', false);
  }

  // ── Period Start: dispara o overlay "COMEÇOU" no início e a cada mudança de período.
  //    Apresentação isolada em period-intro.js (window.triggerPeriodIntro).
  //    A guarda fire-once (por jogo + período) mora AQUI, dona do estado de jogo.
  var piSeen = Object.create(null);
  function piAlready(key) {
    if (piSeen[key]) return true;
    try { if (sessionStorage.getItem('wizPI_' + key)) { piSeen[key] = 1; return true; } } catch (e) {}
    return false;
  }
  function piMark(key) {
    piSeen[key] = 1;
    try { sessionStorage.setItem('wizPI_' + key, '1'); } catch (e) {}
  }
  function piSide(c) {
    c = c || {}; var t = c.team || {};
    return {
      name: t.shortDisplayName || t.name || t.displayName || t.abbreviation || '',
      color: t.color || t.alternateColor || '',   // hex sem '#'; period-intro.js trata o fallback
      score: c.score
    };
  }
  function buildPeriodState(ev) {
    var cs = (ev.competitions && ev.competitions[0] && ev.competitions[0].competitors) || [];
    var home = cs.filter(function (c) { return c.homeAway === 'home'; })[0] || cs[0] || {};
    var away = cs.filter(function (c) { return c.homeAway === 'away'; })[0] || cs[1] || {};
    var period = (ev.status && ev.status.period) || 1;
    return { period: period, home: piSide(home), away: piSide(away) };
  }
  function maybePeriodIntro(ev) {
    var period = (ev.status && ev.status.period) || 1;
    if (period < 1) return;                          // ignora pré-jogo (period 0)
    var id = (ev && ev.id) ? String(ev.id) : 'wiz';
    var key = id + ':' + period;                     // fire-once por (jogo, período), por sessão
    if (piAlready(key)) return;
    piMark(key);
    if (typeof window.triggerPeriodIntro === 'function') window.triggerPeriodIntro(buildPeriodState(ev));
  }

  function render(ev) {
    var comp = ev.competitions[0];
    var w = comp.competitors.filter(isWiz)[0];
    var o = comp.competitors.filter(function (c) { return !isWiz(c); })[0];
    if (!w || !o) { idle(); return false; }
    var st = ev.status || {};
    var state = (st.type && st.type.state) || 'pre';
    var detail = (st.type && st.type.shortDetail) || '';
    if (state === 'in') {
      set('live', '<span class="wz-dot" aria-hidden="true"></span>' +
        score('WSH', w.score, o.team.abbreviation, o.score) +
        '<span class="wz-clk">' + esc(detail) + '</span>', true);
      maybePeriodIntro(ev);
    } else if (state === 'post') {
      set('post', '<span class="wz-fin">Final</span>' +
        score('WSH', w.score, o.team.abbreviation, o.score), false);
    } else { // pre — jogo agendado
      var hh = '';
      try { hh = new Date(ev.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
      set('pre', '<span class="wz-tm">WSH</span><span class="wz-vs">vs</span>' +
        '<span class="wz-tm">' + esc(o.team.abbreviation) + '</span>' +
        '<span class="wz-clk">' + (hh ? 'hoje ' + hh : esc(detail)) + '</span>', false);
    }
    return state === 'in';
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
        var ev = evs.filter(function (e) {
          var cs = (e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
          return cs.some(isWiz);
        })[0];
        if (!ev) { idle(); plan(false); return; }
        plan(render(ev));
      })
      .catch(function () { set('idle', '<span class="wz-tm">WIZARDS</span>', false); plan(false); });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) poll();   // re-checa ao voltar pra aba
  });

  poll();
})();
