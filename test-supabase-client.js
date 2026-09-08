'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('supabase-client.js', 'utf8');
const sessions = new Map();
const calls = [];
sessions.set('sb_session_v2', JSON.stringify({
  access_token: 'access-expirado',
  refresh_token: 'refresh-local',
  expires_at: 1,
  user: { id: 'user-1', email: 'teste@example.com' }
}));

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; },
    async text() { return data == null ? '' : JSON.stringify(data); }
  };
}

const context = {
  console: { warn() {}, log() {} },
  Date,
  JSON,
  Object,
  Math,
  setTimeout,
  clearTimeout,
  localStorage: {
    getItem(key) { return sessions.has(key) ? sessions.get(key) : null; },
    setItem(key, value) { sessions.set(key, String(value)); },
    removeItem(key) { sessions.delete(key); }
  },
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
  async fetch(url, options) {
    calls.push({ url, options });
    if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
      assert.deepStrictEqual(JSON.parse(options.body), { refresh_token: 'refresh-local' });
      return response(200, {
        access_token: 'access-renovado',
        refresh_token: 'refresh-renovado',
        expires_in: 3600,
        user: { id: 'user-1', email: 'teste@example.com' }
      });
    }
    assert.ok(url.endsWith('/rest/v1/video_ops_states?select=revision'));
    assert.strictEqual(options.headers.apikey, 'sb_publishable_teste');
    assert.strictEqual(options.headers.Authorization, 'Bearer access-renovado');
    return response(200, [{ revision: 7 }]);
  }
};
context.window = { SB_CONFIG: { url: 'https://projeto.supabase.co', publishableKey: 'sb_publishable_teste' } };

vm.runInNewContext(code, context, { filename: 'supabase-client.js' });

(async function () {
  const rows = await context.window.SB.rest('/video_ops_states?select=revision');
  assert.strictEqual(rows[0].revision, 7);
  assert.strictEqual(calls.length, 2);
  const saved = JSON.parse(sessions.get('sb_session_v2'));
  assert.strictEqual(saved.access_token, 'access-renovado');
  assert.strictEqual(saved.refresh_token, 'refresh-renovado');
  assert.ok(saved.expires_at > Math.floor(Date.now() / 1000));
  console.log('ok — test-supabase-client: refresh antecede REST e usa JWT do usuário');
})().catch(error => { console.error(error); process.exitCode = 1; });
