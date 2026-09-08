// Smoke DOM headless: stub mínimo de document/localStorage e checa que mount()->render()
// ->nodeEl()->applyZoom() rodam sem estourar. node --check não pega erro de runtime; este pega.
// Uso: node test-fluxos-dom.js
function fakeEl() {
  return {
    style: { setProperty: function () {} },
    dataset: {}, className: '', value: '', textContent: '', innerHTML: '',
    type: '', title: '', placeholder: '', spellcheck: true, disabled: false,
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    appendChild: function (c) { return c; },
    insertBefore: function (c) { return c; },
    querySelector: function () { return fakeEl(); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}, removeEventListener: function () {},
    setAttribute: function () {}, remove: function () {},
    closest: function () { return null; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 800, height: 600 }; },
    contains: function () { return false; }
  };
}
var store = {};
global.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; } };
var root = fakeEl();
global.document = {
  readyState: 'complete',
  getElementById: function (id) { return id === 'fluxos-root' ? root : null; },
  createElement: function () { return fakeEl(); },
  createElementNS: function () { return fakeEl(); },
  addEventListener: function () {},
  elementFromPoint: function () { return null; }
};
global.window = {};

require('./fluxos.js'); // mount roda no require (readyState=complete)
if (typeof global.window.fluxosRefresh === 'function') global.window.fluxosRefresh();
console.log('OK — test-fluxos-dom: mount/render/nodeEl/applyZoom/refresh rodaram sem estourar');
