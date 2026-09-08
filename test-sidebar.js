const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script id="sidebar-drawer-script">([\s\S]*?)<\/script>/)?.[1];
assert(script, 'script da sidebar não encontrado');
assert(/id="sidebar-toggle"[\s\S]{0,180}aria-expanded="false"/.test(html), 'botão inicial inválido');
assert(html.includes('<aside id="sidebar" aria-hidden="true">'), 'sidebar deve iniciar fechada');
assert(html.includes('.layout.sidebar-open #sidebar'), 'estado visual aberto não encontrado');

const classes = new Set();
const attrs = {};
const layout = {
  classList: {
    contains: name => classes.has(name),
    add: name => classes.add(name),
    remove: name => classes.delete(name),
    toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
  }
};
const sidebar = { setAttribute: (name, value) => { attrs[`sidebar:${name}`] = value; } };
const toggle = {
  title: '',
  addEventListener: (_, handler) => { toggle.click = handler; },
  setAttribute: (name, value) => { attrs[`toggle:${name}`] = value; },
  getAttribute: name => attrs[`toggle:${name}`]
};

vm.runInNewContext(script, {
  document: {
    querySelector: () => layout,
    getElementById: id => id === 'sidebar' ? sidebar : toggle
  },
  requestAnimationFrame: callback => callback()
});

toggle.click({ detail: 1 });
assert(classes.has('sidebar-open'), 'primeiro clique deve abrir a sidebar');
assert.equal(attrs['sidebar:aria-hidden'], 'false');
assert.equal(attrs['toggle:aria-expanded'], 'true');

toggle.click({ detail: 1 });
assert(!classes.has('sidebar-open'), 'segundo clique deve fechar a sidebar');
assert.equal(attrs['sidebar:aria-hidden'], 'true');
assert.equal(attrs['toggle:aria-expanded'], 'false');

toggle.click({ detail: 0 });
assert(classes.has('sidebar-open'), 'acionamento por teclado deve abrir a sidebar');
assert(!classes.has('sidebar-instant'), 'modo instantâneo deve ser removido após a atualização');

console.log('Sidebar: 3 cenários OK');
