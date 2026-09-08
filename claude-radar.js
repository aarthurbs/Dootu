/* Radar Claude & Loops — renderiza window.CLAUDE_RADAR sem acesso de rede no site. */
(function () {
  const news = document.getElementById('claude-news-list');
  const skills = document.getElementById('claude-skills-list');
  const market = document.getElementById('claude-market');
  if (!news || !skills || !market) return;

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const safeUrl = url => /^https:\/\//i.test(url || '') ? esc(url) : '#';
  const data = window.CLAUDE_RADAR;
  if (!data || !Array.isArray(data.news) || !Array.isArray(data.skills) || !data.market) {
    news.innerHTML = '<div class="fat-notice">Radar Claude indisponível. Recarregue a página ou verifique claude-radar-data.js.</div>';
    return;
  }

  const updated = document.getElementById('claude-updated');
  if (updated) {
    const claudeDate = new Date(data.claudeUpdatedAt).toLocaleString('pt-BR');
    const marketDate = new Date(data.marketUpdatedAt).toLocaleString('pt-BR');
    updated.textContent = 'Claude/skills: ' + claudeDate + ' · Mercado: ' + marketDate;
  }

  const source = (title, url) =>
    '<a href="' + safeUrl(url) + '" target="_blank" rel="noopener noreferrer">' + esc(title) + '</a>';
  const card = (tag, title, body, impact, footer, url) =>
    '<article class="ecom-card">' +
      '<span class="ecom-tag">' + esc(tag) + '</span>' +
      '<h3>' + (url ? source(title, url) : esc(title)) + '</h3>' +
      '<p class="ecom-summary">' + esc(body) + '</p>' +
      (impact ? '<p class="ecom-impact">' + esc(impact) + '</p>' : '') +
      (footer ? '<div class="ecom-src">' + esc(footer) + '</div>' : '') +
    '</article>';

  news.innerHTML = data.news.length ? data.news.map(item => card(
    item.tag, item.title, item.summary, item.impact,
    item.source + (item.date ? ' · ' + item.date : ''), item.url
  )).join('') : '<div class="fat-notice">Nenhuma novidade relevante nesta checagem.</div>';

  skills.innerHTML = data.skills.length ? data.skills.map(item => card(
    'Skill / padrão', item.name, item.evidence,
    item.loop.join(' → ') + '. ' + item.application, '', item.url
  )).join('') : '<div class="fat-notice">Nenhuma skill nova nesta checagem.</div>';

  const m = data.market;
  market.innerHTML = card('Estratégia principal', 'Automação B2B estreita', m.thesis,
    'Cliente: ' + m.target + ' Oferta: ' + m.offer, m.disclaimer, '') +
    card('Sinal de mercado', 'Por que agora', m.whyNow, '', '', '') +
    m.plan.map(step => card(step.period, step.action, '', '', '', '')).join('');

  const events = document.getElementById('claude-events');
  if (events && Array.isArray(m.sources)) {
    events.innerHTML = m.sources.map(item => '<span class="ecom-chip">' + source(item.title, item.url) + '</span>').join('');
  }
})();
