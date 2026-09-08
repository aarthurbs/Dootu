const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('claude-radar-data.js', 'utf8'), context);
const data = context.window.CLAUDE_RADAR;

assert.ok(data.news.length, 'o radar precisa ter notícias');
assert.ok(data.skills.length, 'o radar precisa ter skills/loops');
assert.ok(data.market.plan.length, 'o radar precisa ter um plano de mercado');
const urls = [
  ...data.news.map(item => item.url),
  ...data.skills.map(item => item.url),
  ...data.market.sources.map(item => item.url)
];
assert.ok(urls.every(url => url.startsWith('https://')), 'todas as fontes precisam usar HTTPS');

const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /data-radar="claude"/);
assert.match(html, /id="radar-panel-claude"/);
assert.match(html, /src="claude-radar-data\.js"/);
assert.match(html, /src="claude-radar\.js"/);
console.log(`Radar Claude válido: ${data.news.length} notícias, ${data.skills.length} skills e ${data.market.plan.length} etapas.`);
