// period-intro.js
// Overlay cinematográfico "COMEÇOU" (estilo broadcast / round-start) para o início
// de cada período do jogo dos Wizards. Módulo ISOLADO de apresentação: não conhece a
// fonte dos dados — recebe o estado pronto via window.triggerPeriodIntro(periodState).
// A detecção de mudança de período e a guarda fire-once moram em wizards-score.js.
(function () {
  'use strict';

  // ── TUNING (mexa aqui para ajustar tempo/cor) ───────────────────────────
  var DUR_IN = 460;             // entrada (ms) — impacto do "COMEÇOU"
  var DUR_HOLD = 1120;          // tempo visível antes de sair (ms)
  var DUR_OUT = 320;            // saída (ms) — rápida
  // Total ≈ DUR_IN + DUR_HOLD + DUR_OUT = ~1.9s (dentro de 1,5–2,5s)
  var FALLBACK_COLOR = '#3c4658';  // cor elegante p/ time sem cor primária registrada
  var PERIOD_LABELS = { 1: '1º QUARTO', 2: '2º QUARTO', 3: '3º QUARTO', 4: '4º QUARTO' };

  function periodLabel(p) { return PERIOD_LABELS[p] || 'PRORROGAÇÃO'; }  // ≥5 = prorrogação

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // <img> do logo/bandeira do time (opcional). onerror: tenta a URL de fallback
  // (ex.: bandeira/logo da ESPN) e, se também falhar, some — nunca quebra o layout.
  function teamImg(url, fallback) {
    if (!url) return '';
    var fb = fallback ? ' data-fb="' + esc(fallback) + '"' : '';
    return '<img class="pi-logo" alt="" src="' + esc(url) + '"' + fb +
      ' onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=\'\';}else{this.style.display=\'none\';}">';
  }

  // Normaliza cor da ESPN (hex sem '#'); cai no fallback se ausente/inválida.
  function normColor(hex) {
    if (!hex) return FALLBACK_COLOR;
    hex = String(hex).replace(/^#/, '').trim();
    return (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{3}$/.test(hex)) ? '#' + hex : FALLBACK_COLOR;
  }

  // Texto legível (branco ou quase-preto) conforme a luminância da cor do time.
  function readableText(hexColor) {
    var h = hexColor.replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    var L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return L > 0.62 ? '#0d1117' : '#ffffff';
  }

  // Injeta o CSS uma única vez (usa as vars --team-* do :root quando existirem).
  function ensureStyle() {
    if (document.getElementById('wiz-period-intro-styles')) return;
    var css = ''
      + '#wiz-period-intro.pi{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;cursor:pointer;background:rgba(3,7,15,0);-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);opacity:0;transition:opacity var(--pi-in,460ms) cubic-bezier(.16,1,.3,1),background-color var(--pi-in,460ms) ease,backdrop-filter var(--pi-in,460ms) ease,-webkit-backdrop-filter var(--pi-in,460ms) ease;}'
      + '#wiz-period-intro.pi.show{opacity:1;background:rgba(3,7,15,.78);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);}'
      + '#wiz-period-intro.pi.hide{opacity:0;background:rgba(3,7,15,0);-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);transition:opacity var(--pi-out,320ms) cubic-bezier(.16,1,.3,1),background-color var(--pi-out,320ms) ease,backdrop-filter var(--pi-out,320ms) ease,-webkit-backdrop-filter var(--pi-out,320ms) ease;}'
      + '#wiz-period-intro .pi-stage{position:relative;width:min(680px,92vw);}'
      + '#wiz-period-intro .pi-teams{display:flex;justify-content:center;gap:10px;margin-bottom:clamp(14px,3.5vw,26px);}'
      + '#wiz-period-intro .pi-team{flex:1 1 0;min-width:0;padding:10px 16px;border-radius:12px;display:flex;align-items:center;gap:clamp(8px,2vw,14px);}'
      + '#wiz-period-intro .pi-home{text-align:right;justify-content:flex-end;background:linear-gradient(90deg,transparent,var(--c));transform:translateX(-26px);opacity:0;transition:transform var(--pi-in,460ms) cubic-bezier(.16,1,.3,1),opacity var(--pi-in,460ms) ease;}'
      + '#wiz-period-intro .pi-away{text-align:left;justify-content:flex-start;background:linear-gradient(270deg,transparent,var(--c));transform:translateX(26px);opacity:0;transition:transform var(--pi-in,460ms) cubic-bezier(.16,1,.3,1),opacity var(--pi-in,460ms) ease;}'
      + '#wiz-period-intro .pi-logo{width:clamp(28px,7vw,48px);height:clamp(28px,7vw,48px);object-fit:contain;border-radius:7px;background:rgba(255,255,255,.92);flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.25);}'
      + '#wiz-period-intro.pi.show .pi-home,#wiz-period-intro.pi.show .pi-away{transform:translateX(0);opacity:1;}'
      + '#wiz-period-intro .pi-tn{font-weight:800;font-size:clamp(15px,4.2vw,26px);letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;min-width:0;}'
      + '#wiz-period-intro .pi-headline{font-weight:900;font-size:clamp(46px,15vw,118px);line-height:.92;letter-spacing:.02em;color:#fff;text-shadow:0 6px 30px rgba(0,0,0,.6);transform:scale(1.45);opacity:0;transition:transform var(--pi-in,460ms) cubic-bezier(.16,1,.3,1),opacity calc(var(--pi-in,460ms) * .6) ease-out;}'
      + '#wiz-period-intro.pi.show .pi-headline{transform:scale(1);opacity:1;}'
      + '#wiz-period-intro .pi-period{margin-top:10px;font-weight:800;font-size:clamp(16px,5vw,30px);letter-spacing:.28em;text-transform:uppercase;color:var(--team-red,#E31837);transform:translateY(10px);opacity:0;transition:transform var(--pi-in,460ms) cubic-bezier(.16,1,.3,1) 80ms,opacity var(--pi-in,460ms) ease 80ms;}'
      + '#wiz-period-intro.pi.show .pi-period{transform:translateY(0);opacity:1;}'
      + '#wiz-period-intro .pi-score{margin-top:clamp(12px,3vw,20px);font-size:clamp(13px,3.4vw,18px);letter-spacing:.04em;color:var(--team-silver,#C4CED4);transform:translateY(10px);opacity:0;transition:transform var(--pi-in,460ms) cubic-bezier(.16,1,.3,1) 140ms,opacity var(--pi-in,460ms) ease 140ms;}'
      + '#wiz-period-intro.pi.show .pi-score{transform:translateY(0);opacity:1;}'
      + '#wiz-period-intro .pi-score b{color:#fff;font-weight:800;}'
      + '#wiz-period-intro .pi-score .pi-x{opacity:.5;margin:0 7px;}'
      + '#wiz-period-intro .pi-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;}'
      + '#wiz-period-intro.pi.show .pi-flash{animation:pi-flash var(--pi-in,460ms) ease-out forwards;}'
      + '@keyframes pi-flash{0%{opacity:0;}12%{opacity:.55;}100%{opacity:0;}}'
      + '@media (prefers-reduced-motion: reduce){#wiz-period-intro .pi-team,#wiz-period-intro .pi-headline,#wiz-period-intro .pi-period,#wiz-period-intro .pi-score{transform:none !important;transition:opacity 180ms ease !important;}#wiz-period-intro.pi.show .pi-flash{animation:none !important;}}';
    var style = document.createElement('style');
    style.id = 'wiz-period-intro-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // API pública: estado = { period, home:{name,color,score}, away:{name,color,score} }
  function triggerPeriodIntro(state) {
    if (!document.body) return;
    ensureStyle();
    state = state || {};
    var period = state.period || 1;
    var home = state.home || {}, away = state.away || {};
    var hColor = normColor(home.color), aColor = normColor(away.color);
    var hName = esc(home.name || 'CASA').toUpperCase();
    var aName = esc(away.name || 'ADVERSÁRIO').toUpperCase();
    var hScore = esc(home.score == null ? '0' : home.score);
    var aScore = esc(away.score == null ? '0' : away.score);
    var headline = esc(state.headline || 'COMEÇOU').toUpperCase();   // ex.: "AO VIVO" p/ futebol
    var periodTxt = state.periodLabel != null ? esc(state.periodLabel) : periodLabel(period);
    var hImg = teamImg(home.img, home.imgFallback);   // logo NBA ou bandeira da seleção
    var aImg = teamImg(away.img, away.imgFallback);

    var old = document.getElementById('wiz-period-intro');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var ov = document.createElement('div');
    ov.id = 'wiz-period-intro';
    ov.className = 'pi';
    ov.setAttribute('role', 'alertdialog');
    ov.setAttribute('aria-label', state.ariaLabel || ('Início do período: ' + periodLabel(period)));
    ov.style.setProperty('--pi-in', DUR_IN + 'ms');
    ov.style.setProperty('--pi-out', DUR_OUT + 'ms');
    ov.innerHTML =
      '<div class="pi-flash" aria-hidden="true"></div>' +
      '<div class="pi-stage">' +
        '<div class="pi-teams">' +
          '<div class="pi-team pi-home" style="--c:' + hColor + ';color:' + readableText(hColor) + '"><span class="pi-tn">' + hName + '</span>' + hImg + '</div>' +
          '<div class="pi-team pi-away" style="--c:' + aColor + ';color:' + readableText(aColor) + '">' + aImg + '<span class="pi-tn">' + aName + '</span></div>' +
        '</div>' +
        '<div class="pi-headline">' + headline + '</div>' +
        '<div class="pi-period">' + periodTxt + '</div>' +
        '<div class="pi-score">' + hName + ' <b>' + hScore + '</b> <span class="pi-x">x</span> <b>' + aScore + '</b> ' + aName + '</div>' +
      '</div>';
    document.body.appendChild(ov);

    var done = false, hideTimer = null, ended = false;
    function rm() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    function close() {
      if (done) return; done = true;
      if (hideTimer) clearTimeout(hideTimer);
      ov.classList.add('hide');                 // mantém .show; .hide só apaga o conjunto (rápido)
      ov.addEventListener('transitionend', function h(e) {
        if (e.target === ov && !ended) { ended = true; ov.removeEventListener('transitionend', h); rm(); }
      });
      setTimeout(rm, DUR_OUT + 250);            // fallback se transitionend não disparar
    }
    ov.addEventListener('click', close);
    // entra na próxima frame (transição limpa, sem "saltar")
    requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('show'); }); });
    hideTimer = setTimeout(close, DUR_IN + DUR_HOLD);   // auto-dismiss: nunca fica preso na tela
  }

  window.triggerPeriodIntro = triggerPeriodIntro;

  // Pré-visualização manual (sem jogo real): wizPeriodIntroTest(2) no console.
  // 1..4 = quartos, 5 = prorrogação. Cores: Wizards (navy) x Celtics (verde).
  // Mostra também os logos de assets/nba/ (some sozinho se o arquivo não existir).
  window.wizPeriodIntroTest = function (p) {
    triggerPeriodIntro({
      period: p || 1,
      home: { name: 'Wizards', color: '002B5C', score: p && p >= 2 ? '32' : '0', img: 'assets/nba/was.png' },
      away: { name: 'Celtics', color: '008348', score: p && p >= 2 ? '28' : '0', img: 'assets/nba/bos.png' }
    });
  };

  // Prévia estilo Copa (futebol): wizPeriodIntroTestCopa() no console.
  // Usa bandeiras de assets/flags/ e rótulos de futebol.
  window.wizPeriodIntroTestCopa = function (p) {
    triggerPeriodIntro({
      period: p || 1,
      headline: 'AO VIVO',
      periodLabel: (p && p >= 2) ? '2º TEMPO' : '1º TEMPO',
      home: { name: 'Brasil', color: 'F7D011', score: '1', img: 'assets/flags/bra.png' },
      away: { name: 'Argentina', color: '6CACE4', score: '0', img: 'assets/flags/arg.png' }
    });
  };
})();
