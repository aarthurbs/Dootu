/* ── Radar IA ──────────────────────────────────────────────────────
   Renderiza window.AI_NEWS (gerado todo dia à meia-noite pelo agente
   Radar IA — ver radar-ia-prompt.md). Reaproveita as classes .ecom-*.
   Estados: com dados → lista; sem dados / arquivo quebrado → aviso. */
(function () {
  const list = document.getElementById('ia-list');
  if (!list) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? esc(u) : '#';

  const d = window.AI_NEWS;
  if (!d || !Array.isArray(d.items) || !d.items.length) {
    list.innerHTML = '<div class="fat-notice">Sem edição ainda — o agente Radar IA roda todo dia à meia-noite (o computador precisa estar ligado). A edição aparece aqui automaticamente; basta recarregar a página.</div>';
    return;
  }

  const upd = document.getElementById('ia-updated');
  if (upd && d.updatedAt) {
    const dt = new Date(d.updatedAt + 'T12:00:00');
    upd.textContent = 'Edição de ' + dt.toLocaleDateString('pt-BR',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  const ev = document.getElementById('ia-events');
  if (ev && Array.isArray(d.events) && d.events.length) {
    ev.innerHTML = d.events.map(e => {
      const p = String(e.date || '').split('-'); // "YYYY-MM-DD" → dd/mm sem fuso
      const when = p[2] ? p[2] + '/' + p[1] : '';
      return '<span class="ecom-chip"><b>' + esc(when) + '</b> ' + esc(e.name) + '</span>';
    }).join('');
  }

  list.innerHTML = d.items.map(it =>
    '<article class="ecom-card">' +
      '<span class="ecom-tag">' + esc(it.tag) + '</span>' +
      '<h3><a href="' + safeUrl(it.url) + '" target="_blank" rel="noopener noreferrer">' + esc(it.title) + '</a></h3>' +
      '<p class="ecom-summary">' + esc(it.summary) + '</p>' +
      (it.impact ? '<p class="ecom-impact">' + esc(it.impact) + '</p>' : '') +
      '<div class="ecom-src">' + esc(it.source) + (it.date ? ' · ' + esc(it.date) : '') + '</div>' +
    '</article>'
  ).join('');

  const count = document.getElementById('count-ai');
  if (count) count.textContent = d.items.length;
})();
