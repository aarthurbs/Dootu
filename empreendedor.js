/* Painel do Empreendedor — sala de controle dos processos ao longo do tempo.
   Estático, Vanilla JS, localStorage (pp_empreendedor_v1). Sem IA, sem backend.
   Cada trilho = um processo com etapas (checklist); status e % saem das etapas.
   CSS .emp-* mora no index.html (estático, evita BP-012).
   Lógica pura exportada p/ node (test-empreendedor.js). */
(function () {
  'use strict';

  var KEY = 'pp_empreendedor_v1';

  // ── util ─────────────────────────────────────────────────────────────
  var _n = 0;
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + '_' + (_n++).toString(36); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── lógica pura (testável) ───────────────────────────────────────────
  function progresso(t) {
    var n = t.etapas.length;
    return n ? t.etapas.filter(function (e) { return e.done; }).length / n : 0; // guarda-zero (BP-004)
  }
  function statusOf(t) {
    var n = t.etapas.length;
    var d = t.etapas.filter(function (e) { return e.done; }).length;
    if (d === 0) return 'a fazer';   // cobre também n === 0
    if (d === n) return 'feito';
    return 'fazendo';
  }
  function diasInfo(meta, hojeISO) {
    var ms = 86400000;
    var start = Date.parse(meta.start + 'T00:00:00');
    var hoje = Date.parse(hojeISO + 'T00:00:00');
    var dec = Math.floor((hoje - start) / ms);
    dec = Math.max(0, Math.min(dec, meta.dias)); // clamp 0..dias
    return { total: meta.dias, decorridos: dec, restantes: meta.dias - dec };
  }

  // ── seed (modelo inicial, tirado do plano de 90 dias) ────────────────
  function seed(startISO) {
    function tk(id, nome, desc, etapas) {
      return { id: id, nome: nome, desc: desc, etapas: etapas.map(function (txt) {
        return { id: uid('e'), txt: txt, done: false };
      }), log: [] };
    }
    return {
      meta: { start: startISO || todayISO(), dias: 90, alvoClientes: 10 },
      clientes: 0,
      trilhos: [
        tk('identidade', 'Identidade da marca', 'Promessa, nome, personalidade e identidade visual.', [
          'Definir a promessa da marca (qual transformação ela entrega)',
          'Completar: lembrem da marca como ___',
          'Completar: ao encontrar a marca, sentir ___',
          'Escolher nome provisório, personalidade e identidade visual',
          'Criar Instagram e TikTok com o mesmo posicionamento'
        ]),
        tk('radar', 'Radar de mercado', 'O que o mercado procura, pergunta e reclama.', [
          'Escolher a categoria-alvo para estudar',
          'Mercado Livre: anotar buscas, perguntas e reclamações recorrentes',
          'TikTok Creative Center: anotar tendências e hashtags do nicho',
          'Listar as 3 dores mais fortes que apareceram'
        ]),
        tk('conteudo', 'Laboratório de conteúdo', 'Ideia → roteiro → publicação → aprendizado.', [
          'Definir 10 linhas editoriais para testar',
          'Produzir 3 conteúdos originais na semana',
          'Adaptar cada conteúdo para Instagram e TikTok',
          'Registrar os sinais (comentários, perguntas, compartilhamentos)'
        ]),
        tk('perfis', 'Rede de perfis (satélites)', 'Perfis que levam atenção à marca central.', [
          'Reservar os nomes dos perfis e da marca central',
          'Definir a origem legal dos clipes (próprio, licenciado ou domínio público)',
          'Criar um padrão de edição (abertura, legenda, identidade)',
          'Lançar em ondas: começar com 2 perfis-piloto'
        ]),
        tk('funil', 'Funil de clientes', 'Conheceu → interagiu → perguntou → oferta → comprou.', [
          'Mapear as etapas do funil',
          'Registrar os interessados reais (quem perguntou ou demonstrou intenção)',
          'Fechar os 3 primeiros compradores',
          'Fechar os outros 7 (meta de 10)'
        ]),
        tk('lucro', 'Lucro real', 'Usa a aba Precificação que já existe — não recalcula aqui.', [
          'Escolher a oferta/produto inicial',
          'Calcular o lucro real na aba Precificação',
          'Confirmar que sobra lucro positivo antes de escalar'
        ])
      ]
    };
  }

  // ── persistência ─────────────────────────────────────────────────────
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      return s && Array.isArray(s.trilhos) ? s : seed();
    } catch (e) { return seed(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(STATE)); } catch (e) {} }

  var STATE = null;

  // ── render ───────────────────────────────────────────────────────────
  function find(id) { return STATE.trilhos.filter(function (t) { return t.id === id; })[0]; }

  function metaBlock(label, val, pct) {
    return '<div class="emp-meta-block"><span class="emp-meta-label">' + esc(label) + '</span>'
      + '<span class="emp-meta-val">' + esc(val) + '</span>'
      + '<div class="emp-meta-bar"><i style="width:' + pct + '%"></i></div></div>';
  }

  function cardHTML(t) {
    var stt = statusOf(t);
    var cls = stt === 'feito' ? 'done' : stt === 'fazendo' ? 'doing' : 'todo';
    var pct = Math.round(progresso(t) * 100);
    var etapas = t.etapas.map(function (e) {
      return '<li class="emp-etapa' + (e.done ? ' done' : '') + '">'
        + '<input type="checkbox" data-act="toggle" data-t="' + esc(t.id) + '" data-e="' + esc(e.id) + '"' + (e.done ? ' checked' : '') + '>'
        + '<span class="emp-etapa-txt">' + esc(e.txt) + '</span>'
        + '<span class="emp-row-actions">'
        + '<button class="emp-mini-btn" data-act="edit-etapa" data-t="' + esc(t.id) + '" data-e="' + esc(e.id) + '" title="Editar" aria-label="Editar etapa">✎</button>'
        + '<button class="emp-mini-btn" data-act="del-etapa" data-t="' + esc(t.id) + '" data-e="' + esc(e.id) + '" title="Remover" aria-label="Remover etapa">✕</button>'
        + '</span></li>';
    }).join('');
    var logs = t.log.length
      ? t.log.slice().reverse().map(function (l) {
          return '<div class="emp-log-item"><span class="emp-log-date">' + esc(l.data) + '</span><span>' + esc(l.txt) + '</span></div>';
        }).join('')
      : '<div class="emp-log-empty">Sem registros ainda.</div>';
    return '<div class="emp-card">'
      + '<div class="emp-card-head">'
      + '<h3 class="emp-card-title">' + esc(t.nome) + '</h3>'
      + '<div class="emp-card-head-r"><span class="emp-status ' + cls + '">' + esc(stt) + '</span>'
      + '<span class="emp-row-actions">'
      + '<button class="emp-mini-btn" data-act="edit-trilho" data-t="' + esc(t.id) + '" title="Renomear" aria-label="Renomear trilho">✎</button>'
      + '<button class="emp-mini-btn" data-act="del-trilho" data-t="' + esc(t.id) + '" title="Remover trilho" aria-label="Remover trilho">✕</button>'
      + '</span></div>'
      + '</div>'
      + (t.desc ? '<p class="emp-card-desc">' + esc(t.desc) + '</p>' : '')
      + '<div class="emp-progress"><div class="emp-progress-bar"><i style="width:' + pct + '%"></i></div><span class="emp-progress-pct">' + pct + '%</span></div>'
      + '<ul class="emp-etapas">' + etapas + '</ul>'
      + '<button class="emp-add" data-act="add-etapa" data-t="' + esc(t.id) + '">＋ etapa</button>'
      + '<div class="emp-log"><div class="emp-log-head"><span class="emp-meta-label">Histórico</span>'
      + '<button class="emp-add" data-act="add-log" data-t="' + esc(t.id) + '">＋ registro</button></div>' + logs + '</div>'
      + '</div>';
  }

  function render() {
    var root = document.getElementById('emp-root');
    if (!root) return;
    var di = diasInfo(STATE.meta, todayISO());
    var totE = 0, doneE = 0;
    STATE.trilhos.forEach(function (t) {
      totE += t.etapas.length;
      doneE += t.etapas.filter(function (e) { return e.done; }).length;
    });
    var geral = totE ? Math.round(doneE / totE * 100) : 0;
    var diaPct = di.total ? Math.round(di.decorridos / di.total * 100) : 0;
    var cliPct = STATE.meta.alvoClientes ? Math.min(100, Math.round(STATE.clientes / STATE.meta.alvoClientes * 100)) : 0;

    root.innerHTML = ''
      + '<div class="emp-head">'
      + '<div class="emp-head-l"><h2 class="emp-head-title">Painel do Empreendedor</h2>'
      + '<span class="emp-head-sub">Controle dos processos ao longo do tempo</span></div>'
      + '<div class="emp-meta">'
      + metaBlock('Meta 90 dias', 'Dia ' + Math.min(di.decorridos + 1, di.total) + ' de ' + di.total, diaPct)
      + metaBlock('Progresso geral', geral + '%', geral)
      + '<div class="emp-meta-block"><span class="emp-meta-label">Clientes</span>'
      + '<div class="emp-clients"><button class="emp-step-btn" data-act="cli-" aria-label="Menos um cliente">−</button>'
      + '<span class="emp-meta-val">' + STATE.clientes + '/' + STATE.meta.alvoClientes + '</span>'
      + '<button class="emp-step-btn" data-act="cli+" aria-label="Mais um cliente">+</button></div>'
      + '<div class="emp-meta-bar"><i style="width:' + cliPct + '%"></i></div></div>'
      + '</div></div>'
      + '<div class="emp-toolbar"><button class="emp-add" data-act="add-trilho">＋ Trilho</button>'
      + '<button class="emp-add emp-add-muted" data-act="reset">↺ Resetar</button></div>'
      + '<div class="emp-tracks">' + STATE.trilhos.map(cardHTML).join('') + '</div>';
  }

  // ── interações (listeners fixos no root; render só troca innerHTML) ───
  function onChange(ev) {
    var cb = ev.target.closest && ev.target.closest('input[type=checkbox][data-act=toggle]');
    if (!cb) return;
    var t = find(cb.getAttribute('data-t'));
    if (!t) return;
    var e = t.etapas.filter(function (x) { return x.id === cb.getAttribute('data-e'); })[0];
    if (!e) return;
    e.done = cb.checked;
    save(); render();
  }

  function onClick(ev) {
    var btn = ev.target.closest && ev.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var t = btn.getAttribute('data-t') ? find(btn.getAttribute('data-t')) : null;
    var v;
    if (act === 'toggle') return;                       // tratado no onChange
    else if (act === 'cli+') STATE.clientes++;
    else if (act === 'cli-') STATE.clientes = Math.max(0, STATE.clientes - 1);
    else if (act === 'add-trilho') {
      v = prompt('Nome do novo trilho:'); if (!v || !v.trim()) return;
      STATE.trilhos.push({ id: uid('t'), nome: v.trim(), desc: '', etapas: [], log: [] });
    }
    else if (act === 'reset') {
      if (!confirm('Resetar o painel para o modelo inicial? Isso apaga suas mudanças.')) return;
      STATE = seed();
    }
    else if (!t) return;                                // daqui pra baixo precisa de trilho
    else if (act === 'edit-trilho') { v = prompt('Renomear trilho:', t.nome); if (v == null || !v.trim()) return; t.nome = v.trim(); }
    else if (act === 'del-trilho') { if (!confirm('Remover o trilho "' + t.nome + '" e todas as etapas?')) return; STATE.trilhos = STATE.trilhos.filter(function (x) { return x.id !== t.id; }); }
    else if (act === 'add-etapa') { v = prompt('Nova etapa:'); if (!v || !v.trim()) return; t.etapas.push({ id: uid('e'), txt: v.trim(), done: false }); }
    else if (act === 'edit-etapa') { var e1 = t.etapas.filter(function (x) { return x.id === btn.getAttribute('data-e'); })[0]; if (!e1) return; v = prompt('Editar etapa:', e1.txt); if (v == null || !v.trim()) return; e1.txt = v.trim(); }
    else if (act === 'del-etapa') { t.etapas = t.etapas.filter(function (x) { return x.id !== btn.getAttribute('data-e'); }); }
    else if (act === 'add-log') { v = prompt('O que avançou? (registro de hoje)'); if (!v || !v.trim()) return; t.log.push({ data: todayISO(), txt: v.trim() }); }
    else return;
    save(); render();
  }

  function init() {
    var root = document.getElementById('emp-root');
    if (!root) return;
    STATE = load();
    if (!localStorage.getItem(KEY)) save();             // ancora o relógio de 90 dias na 1ª abertura
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    render();
  }

  // ── export p/ node (testes) ──────────────────────────────────────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { seed: seed, progresso: progresso, statusOf: statusOf, diasInfo: diasInfo, uid: uid };
  }
  // ── init no browser ──────────────────────────────────────────────────
  if (typeof document !== 'undefined') {
    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
  }
})();
