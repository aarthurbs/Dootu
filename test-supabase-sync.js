'use strict';

const assert = require('assert');
const cryptoNode = require('crypto');
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('supabase-sync.js', 'utf8');
const videoOpsCode = fs.readFileSync('video-ops.js', 'utf8');
const KEY = 'pp_video_ops_v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => { out[key] = canonical(value[key]); return out; }, {});
  }
  return value;
}
function hashState(state) { return cryptoNode.createHash('sha256').update(JSON.stringify(canonical(state))).digest('hex'); }

async function scenario({ local, remote, confirmResult = true }) {
  const store = new Map();
  if (local !== null) store.set(KEY, JSON.stringify(local));
  const calls = [];
  const messages = [];
  const button = { disabled: false, textContent: 'Sincronizar' };
  let reloaded = false;

  const context = {
    TextEncoder,
    crypto: cryptoNode.webcrypto,
    console: { warn() {}, error() {} },
    confirm: () => confirmResult,
    location: { reload() { reloaded = true; } },
    setTimeout(fn) { fn(); return 1; },
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById(id) { return id === 'sb-sync' ? button : null; }
    },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); }
    }
  };
  context.window = {
    addEventListener() {},
    SB: {
      isAuthed: () => true,
      showLogin() { throw new Error('login inesperado'); },
      notify(message) { messages.push(message); },
      async rest(path, options = {}) {
        calls.push({ path, options });
        if (!options.method) return remote ? [remote] : [];
        return [{ revision: local.revision }];
      }
    }
  };

  vm.runInNewContext(code, context, { filename: 'supabase-sync.js' });
  await context.window.SB.syncNow();
  return { calls, messages, button, reloaded, saved: store.has(KEY) ? JSON.parse(store.get(KEY)) : null };
}

(async function () {
  assert.match(videoOpsCode, /video-ops:saved/, 'persist do Estúdio emite o evento de backup automático');
  const base = { schemaVersion: 4, revision: 3, accounts: [], sources: [], clips: [], variants: [] };
  const first = await scenario({ local: base, remote: null });
  assert.strictEqual(first.calls[1].options.method, 'POST');
  assert.match(first.calls[1].path, /on_conflict=user_id/);
  assert.strictEqual(JSON.parse(first.calls[1].options.body).state_hash, hashState(base));
  assert.match(first.messages.at(-1), /Primeiro backup/);

  const equal = await scenario({
    local: base,
    remote: {
      schema_version: 4,
      revision: 3,
      state_hash: hashState(base),
      state: { variants: [], clips: [], sources: [], accounts: [], revision: 3, schemaVersion: 4 }
    }
  });
  assert.strictEqual(equal.calls.length, 1);
  assert.match(equal.messages.at(-1), /já está sincronizado/);

  const newerLocal = { ...base, revision: 4 };
  const pushed = await scenario({
    local: newerLocal,
    remote: { schema_version: 4, revision: 3, state_hash: hashState(base), state: base }
  });
  assert.strictEqual(pushed.calls[1].options.method, 'PATCH');
  assert.match(pushed.calls[1].path, /revision=eq\.3/);
  assert.match(pushed.calls[1].path, /state_hash=eq\./);
  assert.match(pushed.messages.at(-1), /enviados para a nuvem/);

  const cloudState = { ...base, revision: 8, accounts: [{ id: 'conta-nuvem' }] };
  const pulled = await scenario({
    local: base,
    remote: { schema_version: 4, revision: 8, state_hash: hashState(cloudState), state: cloudState }
  });
  assert.strictEqual(pulled.saved.revision, 8);
  assert.strictEqual(pulled.saved.accounts[0].id, 'conta-nuvem');
  assert.strictEqual(pulled.reloaded, true);

  const freshPc = await scenario({
    local: null,
    remote: { schema_version: 4, revision: 8, state_hash: hashState(cloudState), state: cloudState }
  });
  assert.strictEqual(freshPc.saved.accounts[0].id, 'conta-nuvem');
  assert.strictEqual(freshPc.reloaded, true);

  const conflict = await scenario({
    local: base,
    remote: { schema_version: 4, revision: 3, state_hash: 'a'.repeat(64), state: { ...base, accounts: [{ id: 'outra' }] } }
  });
  assert.strictEqual(conflict.calls.length, 1);
  assert.match(conflict.messages.at(-1), /Conflito detectado/);

  const blocked = await scenario({ local: { ...base, access_token: 'não-enviar' }, remote: null });
  assert.strictEqual(blocked.calls.length, 0);
  assert.match(blocked.messages.at(-1), /campo proibido/);
  assert.strictEqual(blocked.button.disabled, false);

  const blockedRemote = await scenario({
    local: base,
    remote: { schema_version: 4, revision: 9, state_hash: 'b'.repeat(64), state: { ...base, revision: 9, refresh_token: 'não-trazer' } }
  });
  assert.strictEqual(blockedRemote.saved.revision, 3);
  assert.strictEqual(blockedRemote.reloaded, false);
  assert.match(blockedRemote.messages.at(-1), /campo proibido/);

  console.log('ok — test-supabase-sync: primeiro backup, PC novo, push, pull, conflito e bloqueio de segredo passaram');
})().catch(error => { console.error(error); process.exitCode = 1; });
