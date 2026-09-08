// nba-teams.js
// Catálogo dos 30 times da NBA + função "torcer por 2 times" (1 do Leste, 1 do Oeste).
// 100% client-side, sem backend. Persiste a escolha em localStorage (nba_fav_v1).
// Expõe window.NBA. Logos lidos de assets/nba/<sigla>.png (fallback: monograma colorido).
(function () {
  'use strict';

  // ── DADOS: 30 times (sigla, nome, conferência, divisão, cor primária) ──────
  var TEAMS = [
    // Conferência LESTE (East)
    { abbr: 'ATL', name: 'Atlanta Hawks',          conf: 'Leste', div: 'Southeast', color: '#E03A3E' },
    { abbr: 'BOS', name: 'Boston Celtics',         conf: 'Leste', div: 'Atlantic',  color: '#007A33' },
    { abbr: 'BKN', name: 'Brooklyn Nets',          conf: 'Leste', div: 'Atlantic',  color: '#1A1A1A' },
    { abbr: 'CHA', name: 'Charlotte Hornets',      conf: 'Leste', div: 'Southeast', color: '#1D1160' },
    { abbr: 'CHI', name: 'Chicago Bulls',          conf: 'Leste', div: 'Central',   color: '#CE1141' },
    { abbr: 'CLE', name: 'Cleveland Cavaliers',    conf: 'Leste', div: 'Central',   color: '#860038' },
    { abbr: 'DET', name: 'Detroit Pistons',        conf: 'Leste', div: 'Central',   color: '#C8102E' },
    { abbr: 'IND', name: 'Indiana Pacers',         conf: 'Leste', div: 'Central',   color: '#002D62' },
    { abbr: 'MIA', name: 'Miami Heat',             conf: 'Leste', div: 'Southeast', color: '#98002E' },
    { abbr: 'MIL', name: 'Milwaukee Bucks',        conf: 'Leste', div: 'Central',   color: '#00471B' },
    { abbr: 'NYK', name: 'New York Knicks',        conf: 'Leste', div: 'Atlantic',  color: '#006BB6' },
    { abbr: 'ORL', name: 'Orlando Magic',          conf: 'Leste', div: 'Southeast', color: '#0077C0' },
    { abbr: 'PHI', name: 'Philadelphia 76ers',     conf: 'Leste', div: 'Atlantic',  color: '#006BB6' },
    { abbr: 'TOR', name: 'Toronto Raptors',        conf: 'Leste', div: 'Atlantic',  color: '#CE1141' },
    { abbr: 'WAS', name: 'Washington Wizards',     conf: 'Leste', div: 'Southeast', color: '#002B5C' },
    // Conferência OESTE (West)
    { abbr: 'DAL', name: 'Dallas Mavericks',       conf: 'Oeste', div: 'Southwest', color: '#00538C' },
    { abbr: 'DEN', name: 'Denver Nuggets',         conf: 'Oeste', div: 'Northwest', color: '#0E2240' },
    { abbr: 'GSW', name: 'Golden State Warriors',  conf: 'Oeste', div: 'Pacific',   color: '#1D428A' },
    { abbr: 'HOU', name: 'Houston Rockets',        conf: 'Oeste', div: 'Southwest', color: '#CE1141' },
    { abbr: 'LAC', name: 'LA Clippers',            conf: 'Oeste', div: 'Pacific',   color: '#C8102E' },
    { abbr: 'LAL', name: 'Los Angeles Lakers',     conf: 'Oeste', div: 'Pacific',   color: '#552583' },
    { abbr: 'MEM', name: 'Memphis Grizzlies',      conf: 'Oeste', div: 'Southwest', color: '#5D76A9' },
    { abbr: 'MIN', name: 'Minnesota Timberwolves', conf: 'Oeste', div: 'Northwest', color: '#0C2340' },
    { abbr: 'NOP', name: 'New Orleans Pelicans',   conf: 'Oeste', div: 'Southwest', color: '#0C2340' },
    { abbr: 'OKC', name: 'Oklahoma City Thunder',  conf: 'Oeste', div: 'Northwest', color: '#007AC1' },
    { abbr: 'PHX', name: 'Phoenix Suns',           conf: 'Oeste', div: 'Pacific',   color: '#1D1160' },
    { abbr: 'POR', name: 'Portland Trail Blazers', conf: 'Oeste', div: 'Northwest', color: '#E03A3E' },
    { abbr: 'SAC', name: 'Sacramento Kings',       conf: 'Oeste', div: 'Pacific',   color: '#5A2D81' },
    { abbr: 'SAS', name: 'San Antonio Spurs',      conf: 'Oeste', div: 'Southwest', color: '#6E7378' },
    { abbr: 'UTA', name: 'Utah Jazz',              conf: 'Oeste', div: 'Northwest', color: '#002B5C' }
  ];

  var LS_KEY = 'nba_fav_v1';   // { Leste: 'WAS', Oeste: 'LAL' }
  var byAbbr = {};
  TEAMS.forEach(function (t) { byAbbr[t.abbr] = t; });

  function logoPath(abbr) { return 'assets/nba/' + String(abbr).toLowerCase() + '.png'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── Persistência ───────────────────────────────────────────────────────────
  function getFavorites() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return {
        Leste: byAbbr[raw.Leste] ? raw.Leste : null,
        Oeste: byAbbr[raw.Oeste] ? raw.Oeste : null
      };
    } catch (e) { return { Leste: null, Oeste: null }; }
  }
  var listeners = [];
  function onChange(cb) { if (typeof cb === 'function') listeners.push(cb); }
  function emit() { var f = getFavorites(); listeners.forEach(function (cb) { try { cb(f); } catch (e) {} }); }
  function save(f) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(f)); } catch (e) {}
    emit();
  }
  // Define o time favorito; a conferência é deduzida do próprio time (1 por conf.).
  function setFavorite(abbr) {
    var t = byAbbr[abbr]; if (!t) return false;
    var f = getFavorites(); f[t.conf] = t.abbr; save(f); return true;
  }
  function clearFavorite(conf) { var f = getFavorites(); f[conf] = null; save(f); }
  function isFavorite(abbr) {
    var t = byAbbr[abbr]; if (!t) return false;
    return getFavorites()[t.conf] === abbr;
  }

  // ── Logo / monograma (fallback sem arquivo) ─────────────────────────────────
  // Renderiza <span> com a sigla sobre a cor; a <img> por cima some no onerror.
  function teamBadgeHTML(t, size) {
    size = size || 40;
    return '<span class="nba-badge" style="--bc:' + t.color + ';width:' + size + 'px;height:' + size + 'px">' +
             '<span class="nba-mono">' + esc(t.abbr) + '</span>' +
             '<img class="nba-logo" src="' + logoPath(t.abbr) + '" alt="" loading="lazy" ' +
                  'onerror="this.style.display=\'none\'">' +
           '</span>';
  }

  // ── CSS (injetado uma vez) ──────────────────────────────────────────────────
  function ensureStyle() {
    if (document.getElementById('nba-teams-styles')) return;
    var EASE = 'cubic-bezier(.16,1,.3,1)';
    var css = ''
      // badge (logo + monograma de fallback)
      + '.nba-badge{position:relative;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bc);flex-shrink:0;overflow:hidden;}'
      + '.nba-mono{font-family:var(--font-display,sans-serif);font-weight:800;font-size:11px;letter-spacing:.02em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35);}'
      + '.nba-logo{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;}'
      // botão no header
      + '#nba-fav{display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 10px;border:1px solid var(--border,#2a2f3a);border-radius:var(--radius-xl,18px);background:rgba(255,255,255,.03);cursor:pointer;color:var(--text-dim,#c4ced4);font-size:15px;line-height:1;transition:border-color 160ms ' + EASE + ',background-color 160ms ' + EASE + ',transform 120ms ' + EASE + ';}'
      + '@media (hover:hover) and (pointer:fine){#nba-fav:hover{border-color:var(--accent,#E31837);background:rgba(255,255,255,.06);}}'
      + '#nba-fav:active{transform:scale(.96);}'
      + '#nba-fav .nba-badge{width:24px;height:24px;}#nba-fav .nba-mono{font-size:9px;}'
      + '@media (max-width:760px){#nba-fav{display:none;}}'
      // overlay do seletor (modal — fica centralizado, origin center)
      + '#nba-picker{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,7,15,0);-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);opacity:0;transition:opacity 200ms ' + EASE + ',background-color 200ms ease,backdrop-filter 200ms ease;}'
      + '#nba-picker.show{opacity:1;background:rgba(3,7,15,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}'
      + '#nba-picker .np-card{width:min(720px,94vw);max-height:88vh;overflow:auto;background:var(--bg-elev,#12161f);border:1px solid var(--border,#2a2f3a);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.5);padding:22px;transform:scale(.96);opacity:0;transition:transform 220ms ' + EASE + ',opacity 220ms ' + EASE + ';}'
      + '#nba-picker.show .np-card{transform:scale(1);opacity:1;}'
      + '#nba-picker .np-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px;}'
      + '#nba-picker .np-title{font-family:var(--font-display,sans-serif);font-weight:800;font-size:19px;color:var(--text,#fff);}'
      + '#nba-picker .np-sub{font-size:13px;color:var(--text-muted,#8b93a3);margin:2px 0 16px;}'
      + '#nba-picker .np-close{border:none;background:transparent;color:var(--text-muted,#8b93a3);font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px;transition:color 140ms ' + EASE + ',transform 120ms ' + EASE + ';}'
      + '#nba-picker .np-close:hover{color:var(--text,#fff);}#nba-picker .np-close:active{transform:scale(.9);}'
      + '#nba-picker .np-current{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;}'
      + '#nba-picker .np-chip{display:flex;align-items:center;gap:8px;padding:7px 12px 7px 8px;border:1px solid var(--border,#2a2f3a);border-radius:999px;font-size:13px;color:var(--text-dim,#c4ced4);font-weight:600;}'
      + '#nba-picker .np-chip .np-conf{color:var(--text-muted,#8b93a3);font-weight:600;}'
      + '#nba-picker .np-conf-title{font-family:var(--font-display,sans-serif);font-weight:800;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted,#8b93a3);margin:14px 0 10px;}'
      + '#nba-picker .np-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px;}'
      + '#nba-picker .np-team{display:flex;flex-direction:column;align-items:center;gap:7px;padding:11px 6px;border:1px solid var(--border,#2a2f3a);border-radius:12px;background:rgba(255,255,255,.02);cursor:pointer;color:var(--text-dim,#c4ced4);transition:border-color 160ms ' + EASE + ',background-color 160ms ' + EASE + ',transform 120ms ' + EASE + ';}'
      + '@media (hover:hover) and (pointer:fine){#nba-picker .np-team:hover{background:rgba(255,255,255,.05);border-color:var(--text-muted,#8b93a3);}}'
      + '#nba-picker .np-team:active{transform:scale(.97);}'
      + '#nba-picker .np-team.is-fav{border-color:var(--tc);background:color-mix(in srgb,var(--tc) 16%,transparent);}'
      + '#nba-picker .np-team .np-ab{font-family:var(--font-display,sans-serif);font-weight:800;font-size:12px;letter-spacing:.03em;}'
      + '#nba-picker .np-team.is-fav .np-ab{color:#fff;}'
      + '#nba-picker .np-team .np-nm{font-size:10px;color:var(--text-muted,#8b93a3);text-align:center;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}'
      + '@media (prefers-reduced-motion:reduce){#nba-picker,#nba-picker .np-card{transition:opacity 160ms ease !important;}#nba-picker .np-card{transform:none !important;}#nba-picker .np-team:active,#nba-fav:active{transform:none !important;}}';
    var st = document.createElement('style');
    st.id = 'nba-teams-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── Botão do header (mostra os 2 favoritos) ─────────────────────────────────
  function renderButton() {
    var btn = document.getElementById('nba-fav');
    if (!btn) return;
    var f = getFavorites();
    var parts = [];
    ['Leste', 'Oeste'].forEach(function (conf) {
      if (f[conf]) parts.push(teamBadgeHTML(byAbbr[f[conf]], 24));
    });
    btn.innerHTML = parts.length ? parts.join('') : '<span aria-hidden="true">🏀</span>';
    btn.setAttribute('title', parts.length
      ? 'Você torce: ' + (f.Leste || '—') + ' (Leste) · ' + (f.Oeste || '—') + ' (Oeste)'
      : 'Escolher 2 times pra torcer (NBA)');
  }

  // ── Seletor (modal) ──────────────────────────────────────────────────────────
  var overlay = null, hideTimer = null;
  function confSection(conf) {
    var f = getFavorites();
    var cells = TEAMS.filter(function (t) { return t.conf === conf; }).map(function (t) {
      var fav = f[conf] === t.abbr;
      return '<button type="button" class="np-team' + (fav ? ' is-fav' : '') + '" data-abbr="' + t.abbr + '" style="--tc:' + t.color + '" aria-pressed="' + fav + '">' +
               teamBadgeHTML(t, 40) +
               '<span class="np-ab">' + esc(t.abbr) + '</span>' +
               '<span class="np-nm">' + esc(t.name) + '</span>' +
             '</button>';
    }).join('');
    return '<div class="np-conf-title">Conferência ' + conf + '</div><div class="np-grid">' + cells + '</div>';
  }
  function currentChips() {
    var f = getFavorites();
    return ['Leste', 'Oeste'].map(function (conf) {
      if (!f[conf]) return '<span class="np-chip"><span class="np-conf">' + conf + ':</span> ainda não escolhido</span>';
      var t = byAbbr[f[conf]];
      return '<span class="np-chip">' + teamBadgeHTML(t, 22) + '<b>' + esc(t.abbr) + '</b> <span class="np-conf">· ' + conf + '</span></span>';
    }).join('');
  }
  function paint() {
    if (!overlay) return;
    overlay.querySelector('.np-current').innerHTML = currentChips();
    overlay.querySelector('[data-conf="Leste"]').innerHTML = confSection('Leste');
    overlay.querySelector('[data-conf="Oeste"]').innerHTML = confSection('Oeste');
  }
  function openPicker() {
    ensureStyle();
    if (overlay) closePicker(true);
    overlay = document.createElement('div');
    overlay.id = 'nba-picker';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Escolher 2 times da NBA para torcer');
    overlay.innerHTML =
      '<div class="np-card" role="document">' +
        '<div class="np-head">' +
          '<div><div class="np-title">Pra quem você torce?</div></div>' +
          '<button type="button" class="np-close" aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="np-sub">Escolha <b>1 time do Leste</b> e <b>1 do Oeste</b>. Clique de novo pra trocar.</div>' +
        '<div class="np-current"></div>' +
        '<div data-conf="Leste"></div>' +
        '<div data-conf="Oeste"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    paint();

    overlay.addEventListener('click', function (e) {
      var cell = e.target.closest && e.target.closest('.np-team');
      if (cell) {
        var abbr = cell.getAttribute('data-abbr');
        // clicar no time já favorito = desmarcar; senão, vira o favorito da conf.
        if (isFavorite(abbr)) clearFavorite(byAbbr[abbr].conf); else setFavorite(abbr);
        paint();
        return;
      }
      if (e.target.closest('.np-close') || e.target === overlay) closePicker();
    });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { requestAnimationFrame(function () { overlay.classList.add('show'); }); });
  }
  function onKey(e) { if (e.key === 'Escape') closePicker(); }
  function closePicker(immediate) {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey);
    var ov = overlay; overlay = null;
    if (hideTimer) clearTimeout(hideTimer);
    function rm() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    if (immediate) { rm(); return; }
    ov.classList.remove('show');
    hideTimer = setTimeout(rm, 240);
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  function boot() {
    ensureStyle();
    var btn = document.getElementById('nba-fav');
    if (btn) btn.addEventListener('click', openPicker);
    renderButton();
    onChange(renderButton);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // ── API pública ───────────────────────────────────────────────────────────
  window.NBA = {
    teams: TEAMS,
    byConf: function (conf) { return TEAMS.filter(function (t) { return t.conf === conf; }); },
    get: function (abbr) { return byAbbr[abbr] || null; },
    logoPath: logoPath,
    getFavorites: getFavorites,
    setFavorite: setFavorite,
    clearFavorite: clearFavorite,
    isFavorite: isFavorite,
    onChange: onChange,
    openPicker: openPicker,
    closePicker: closePicker
  };
})();
