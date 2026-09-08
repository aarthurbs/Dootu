// Supabase Auth + PostgREST em fetch puro. Continua opcional: sem sessão, o app é local.
(function () {
  'use strict';

  var CFG = window.SB_CONFIG;
  if (!CFG || !CFG.url || !CFG.publishableKey) { console.warn('[SB] config pública ausente'); return; }

  var SESSION_KEY = 'sb_session_v2';
  var AUTH = CFG.url + '/auth/v1';
  var REST = CFG.url + '/rest/v1';
  var toastTimer = 0;
  var SB;

  function loadSession() {
    try {
      var value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return value && value.access_token && value.refresh_token ? value : null;
    } catch (_) { return null; }
  }
  function saveSession(session) {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
    SB.session = session;
  }
  function normalizedSession(data, fallback) {
    fallback = fallback || {};
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || fallback.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Math.max(60, Number(data.expires_in) || 3600),
      user: data.user || fallback.user
    };
  }
  function notify(message) {
    var el = document.getElementById('toast');
    if (!el) { console.log('[SB]', message); return; }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  async function authFetch(path, body) {
    var response = await fetch(AUTH + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.publishableKey },
      body: JSON.stringify(body)
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error_description || data.msg || data.message || ('HTTP ' + response.status));
    return data;
  }
  async function refreshSession() {
    if (!SB.session || !SB.session.refresh_token) throw new Error('Sessão expirada. Entre novamente.');
    try {
      var data = await authFetch('/token?grant_type=refresh_token', { refresh_token: SB.session.refresh_token });
      saveSession(normalizedSession(data, SB.session));
      return SB.session;
    } catch (error) {
      saveSession(null);
      renderAccount();
      throw error;
    }
  }
  async function ensureSession() {
    if (!SB.session) throw new Error('Não autenticado');
    if (!SB.session.expires_at || SB.session.expires_at <= Math.floor(Date.now() / 1000) + 60) await refreshSession();
    return SB.session;
  }
  async function rest(path, options) {
    options = options || {};
    var session = await ensureSession();
    async function request(token) {
      var headers = Object.assign({
        apikey: CFG.publishableKey,
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }, options.headers || {});
      return fetch(REST + path, Object.assign({}, options, { headers: headers }));
    }
    var response = await request(session.access_token);
    if (response.status === 401) {
      session = await refreshSession();
      response = await request(session.access_token);
    }
    var text = await response.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) throw new Error((data && (data.message || data.hint || data.code)) || ('HTTP ' + response.status));
    return data;
  }

  async function signIn(email, password) {
    var data = await authFetch('/token?grant_type=password', { email: email, password: password });
    saveSession(normalizedSession(data));
    return data.user;
  }
  async function signUp(email, password) {
    var data = await authFetch('/signup', { email: email, password: password });
    if (data.access_token) saveSession(normalizedSession(data));
    return data;
  }
  async function signOut() {
    try {
      if (SB.session) await fetch(AUTH + '/logout', {
        method: 'POST',
        headers: { apikey: CFG.publishableKey, Authorization: 'Bearer ' + SB.session.access_token }
      });
    } catch (_) {}
    saveSession(null);
  }

  function injectStyles() {
    if (document.getElementById('sb-styles')) return;
    var style = document.createElement('style');
    style.id = 'sb-styles';
    style.textContent = `
      #sb-acct{position:fixed;top:13px;right:18px;z-index:900;display:flex;align-items:center;gap:8px;font:600 12.5px/1 system-ui,-apple-system,sans-serif}
      #sb-acct button,#sb-modal button{cursor:pointer;transition:transform 140ms cubic-bezier(.23,1,.32,1),background-color 180ms ease,border-color 180ms ease,color 180ms ease}
      #sb-acct button:active,#sb-modal button:active{transform:scale(.97)}
      #sb-acct button{border-radius:8px;padding:8px 12px;border:1px solid rgba(255,255,255,.12);background:#22222e;color:#e8eaed}
      @media (hover:hover) and (pointer:fine){#sb-acct button:hover{border-color:rgba(255,255,255,.24);background:#292936}}
      #sb-acct .sb-email{color:#9aa0a6;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #sb-acct .sb-dot{width:7px;height:7px;border-radius:50%;background:#81c995}
      #sb-modal{position:fixed;inset:0;z-index:950;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(4px)}
      #sb-modal.show{display:flex}
      #sb-modal .box{background:#1a1a23;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;width:340px;max-width:92vw;color:#e8eaed;font-family:system-ui,-apple-system,sans-serif}
      #sb-modal h3{margin:0 0 4px;font-size:17px}#sb-modal p{margin:0 0 16px;font-size:12.5px;color:#9aa0a6}
      #sb-modal label{display:block;font-size:12px;color:#9aa0a6;margin:10px 0 4px}
      #sb-modal input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:#131318;color:#e8eaed;font-size:14px;transition:border-color 180ms ease}
      #sb-modal input:focus{outline:none;border-color:#8ab4f8}
      #sb-modal .row{display:flex;gap:8px;margin-top:18px}#sb-modal .row.secondary{margin-top:8px}
      #sb-modal .row button{flex:1;border-radius:9px;padding:11px;font-weight:600;font-size:13px;border:1px solid transparent}
      #sb-modal .primary{background:#4285f4;color:#fff}.sb-ghost{background:transparent;border-color:rgba(255,255,255,.14)!important;color:#e8eaed}
      #sb-modal .err{color:#f28b82;font-size:12px;margin-top:10px;min-height:14px}
      @media (prefers-reduced-motion:reduce){#sb-acct button,#sb-modal button{transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease}#sb-acct button:active,#sb-modal button:active{transform:none}}
    `;
    document.head.appendChild(style);
  }
  function buildModal() {
    if (document.getElementById('sb-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'sb-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'sb-title');
    modal.innerHTML = '<div class="box"><h3 id="sb-title">Entrar na nuvem</h3>'
      + '<p>Sua sessão fica salva neste PC. Em outro computador, entre uma vez para restaurar os metadados; os vídeos continuam locais.</p>'
      + '<label for="sb-email">E-mail</label><input id="sb-email" type="email" autocomplete="email">'
      + '<label for="sb-pass">Senha</label><input id="sb-pass" type="password" autocomplete="current-password">'
      + '<div class="err" id="sb-err" aria-live="polite"></div>'
      + '<div class="row"><button class="sb-ghost" id="sb-signup" type="button">Criar conta</button>'
      + '<button class="primary" id="sb-signin" type="button">Entrar</button></div>'
      + '<div class="row secondary"><button class="sb-ghost" id="sb-close" type="button">Fechar</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) { if (event.target === modal) hideModal(); });
    document.getElementById('sb-close').addEventListener('click', hideModal);
    document.getElementById('sb-signin').addEventListener('click', function () { doAuth('in'); });
    document.getElementById('sb-signup').addEventListener('click', function () { doAuth('up'); });
    document.getElementById('sb-pass').addEventListener('keydown', function (event) { if (event.key === 'Enter') doAuth('in'); });
  }
  function showModal() {
    var error = document.getElementById('sb-err');
    error.textContent = '';
    document.getElementById('sb-modal').classList.add('show');
    document.getElementById('sb-email').focus();
  }
  function hideModal() { document.getElementById('sb-modal').classList.remove('show'); }
  async function doAuth(mode) {
    var email = document.getElementById('sb-email').value.trim();
    var password = document.getElementById('sb-pass').value;
    var error = document.getElementById('sb-err');
    error.textContent = '';
    error.style.color = '';
    if (!email || !password) { error.textContent = 'Preencha e-mail e senha.'; return; }
    try {
      if (mode === 'in') {
        await signIn(email, password);
        hideModal(); renderAccount(); notify('Conectado. Use Sincronizar para enviar ou trazer o Estúdio.');
        if (SB.syncNow) SB.syncNow();
      } else {
        var data = await signUp(email, password);
        if (SB.session) { hideModal(); renderAccount(); notify('Conta criada e conectada.'); if (SB.syncNow) SB.syncNow(); }
        else { error.style.color = '#81c995'; error.textContent = 'Conta criada. Confirme pelo e-mail e depois entre.'; }
      }
    } catch (reason) { error.textContent = reason.message; }
  }
  function button(text, id) {
    var el = document.createElement('button'); el.type = 'button'; el.id = id; el.textContent = text; return el;
  }
  function buildAccount() {
    if (document.getElementById('sb-acct')) return;
    var wrapper = document.createElement('div'); wrapper.id = 'sb-acct'; document.body.appendChild(wrapper); renderAccount();
  }
  function renderAccount() {
    var wrapper = document.getElementById('sb-acct');
    if (!wrapper) return;
    wrapper.replaceChildren();
    if (SB.session && SB.session.user) {
      var dot = document.createElement('span'); dot.className = 'sb-dot'; dot.setAttribute('aria-hidden', 'true');
      var email = document.createElement('span'); email.className = 'sb-email'; email.textContent = SB.session.user.email || 'conectado';
      var sync = button('Sincronizar', 'sb-sync');
      sync.addEventListener('click', function () { if (SB.syncNow) SB.syncNow(); else notify('Sincronização ainda não carregou.'); });
      var logout = button('Sair', 'sb-logout');
      logout.addEventListener('click', async function () { await signOut(); renderAccount(); notify('Desconectado. Os dados locais continuam disponíveis.'); });
      wrapper.append(dot, email, sync, logout);
    } else {
      var login = button('Entrar na nuvem', 'sb-login'); login.addEventListener('click', showModal); wrapper.appendChild(login);
    }
  }

  SB = window.SB = {
    config: CFG,
    session: loadSession(),
    rest: rest,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    refreshSession: refreshSession,
    isAuthed: function () { return !!(SB.session && SB.session.access_token); },
    showLogin: showModal,
    notify: notify
  };
  function init() { injectStyles(); buildModal(); buildAccount(); }
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && document.getElementById('sb-modal')) hideModal(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
