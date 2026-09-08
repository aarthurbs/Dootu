// Sincronização manual e offline-first do snapshot de metadados do Estúdio.
(function () {
  'use strict';
  if (!window.SB) { console.warn('[SB] client ausente; sync desativado'); return; }

  var STORAGE_KEY = 'pp_video_ops_v1';
  var TABLE = '/video_ops_states';
  var SUPPORTED_SCHEMA = 4;
  var syncTimer = 0;
  var running = false;
  var queued = false;

  function notify(message) { window.SB.notify(message); }
  function setBusy(busy) {
    var button = document.getElementById('sb-sync');
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Sincronizando…' : 'Sincronizar';
  }
  function parseSafeState(raw) {
    if (raw.length > 2 * 1024 * 1024) throw new Error('O snapshot local passou de 2 MB. Exporte um backup antes de sincronizar.');
    var state = JSON.parse(raw);
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('O estado local do Estúdio é inválido.');
    if (/"[^"]*(token|password|secret|credential)[^"]*"\s*:/i.test(raw) || /"blob:/i.test(raw)) {
      throw new Error('O snapshot contém um campo proibido e não foi enviado.');
    }
    return state;
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      var sorted = {};
      Object.keys(value).sort().forEach(function (key) { sorted[key] = canonical(value[key]); });
      return sorted;
    }
    return value;
  }
  function localSnapshot() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    var state = parseSafeState(raw);
    return {
      state: state,
      schemaVersion: Math.max(1, Number(state.schemaVersion) || 1),
      revision: Math.max(0, Math.floor(Number(state.revision) || 0)),
      canonical: JSON.stringify(canonical(state))
    };
  }
  async function sha256(text) {
    var bytes = new TextEncoder().encode(text);
    var digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }
  async function remoteSnapshot() {
    var rows = await window.SB.rest(TABLE + '?select=schema_version,revision,state_hash,state,updated_at&limit=1');
    return rows && rows[0] ? rows[0] : null;
  }
  function payload(local, hash) {
    return {
      schema_version: local.schemaVersion,
      revision: local.revision,
      state_hash: hash,
      state: local.state,
      updated_at: new Date().toISOString()
    };
  }
  async function insertFirst(local, hash) {
    var rows = await window.SB.rest(TABLE + '?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(payload(local, hash))
    });
    return Array.isArray(rows) && rows.length === 1;
  }
  async function updateIfUnchanged(local, hash, remote) {
    var query = '?revision=eq.' + encodeURIComponent(remote.revision) + '&state_hash=eq.' + encodeURIComponent(remote.state_hash);
    var rows = await window.SB.rest(TABLE + query, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload(local, hash))
    });
    return Array.isArray(rows) && rows.length === 1;
  }
  function pullRemote(remote, supportedSchema) {
    if (Number(remote.schema_version) > supportedSchema) throw new Error('A nuvem usa uma versão mais nova do Estúdio. Atualize o site antes de restaurar.');
    var state = parseSafeState(JSON.stringify(remote.state));
    state.revision = Math.max(0, Math.floor(Number(remote.revision) || 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify('Dados da nuvem restaurados. Recarregando o Estúdio…');
    setTimeout(function () { location.reload(); }, 500);
  }
  async function syncNow(options) {
    options = options || {};
    if (!window.SB.isAuthed()) { window.SB.showLogin(); return; }
    if (running) { queued = true; return; }
    running = true;
    setBusy(true);
    try {
      var local = localSnapshot();
      var remote = await remoteSnapshot();
      if (!local) {
        if (!remote) { if (!options.quiet) notify('Não há dados do Estúdio neste PC nem na nuvem.'); return; }
        if (confirm('Encontramos seu Estúdio salvo na nuvem. Restaurar neste PC?')) pullRemote(remote, SUPPORTED_SCHEMA);
        else if (!options.quiet) notify('Nada foi alterado. Seus dados continuam seguros na nuvem.');
        return;
      }
      var localHash = await sha256(local.canonical);
      if (!remote) {
        if (!await insertFirst(local, localHash)) throw new Error('Outro dispositivo criou o snapshot agora. Sincronize novamente.');
        if (!options.quiet) notify('Primeiro backup do Estúdio salvo na nuvem.');
        return;
      }
      var remoteRevision = Math.max(0, Math.floor(Number(remote.revision) || 0));
      if (remoteRevision > local.revision) {
        if (confirm('A nuvem tem uma versão mais nova do Estúdio. Substituir os dados locais?')) pullRemote(remote, local.schemaVersion);
        else notify('Nada foi alterado. A versão mais nova continua na nuvem.');
        return;
      }
      if (remoteRevision === local.revision) {
        if (remote.state_hash === localHash) { if (!options.quiet) notify('Estúdio já está sincronizado.'); }
        else notify('Conflito detectado: mesma revisão com conteúdos diferentes. Exporte os dois backups antes de decidir.');
        return;
      }
      if (!await updateIfUnchanged(local, localHash, remote)) throw new Error('A nuvem mudou durante a sincronização. Tente novamente.');
      if (!options.quiet) notify('Metadados do Estúdio enviados para a nuvem.');
    } catch (error) {
      console.error('[SB] syncNow', error);
      notify('Sincronização não concluída: ' + error.message);
    } finally {
      setBusy(false);
      running = false;
      if (queued) { queued = false; scheduleSync(); }
    }
  }

  function scheduleSync() {
    if (!window.SB.isAuthed()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncNow({ quiet: true }); }, 900);
  }

  window.SB.syncNow = syncNow;
  if (window.addEventListener) window.addEventListener('video-ops:saved', scheduleSync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync);
  else scheduleSync();
})();
