// fba-shipments.js
// Controle de Envios FBA — FASES 1–3.
//  F1: camada de dados (modelo 3 níveis + store + derivados + invariante §5.3).
//  F2: máquina de estados (transições com gate §3, checklist §4, evento em toda transição).
//  F3: reconciliação por SKU (tabela Δ/status_recon/distribuição) + edição ergonômica de caixa.
// Reconciliação §3↔§4: o GATE para SAIR de uma etapa = o checklist daquela etapa completo
//   (fonte única em STAGE_CHECKS); data_conferencia_inicio + qtd_recebida dobram no gate de EM_CONFERENCIA.
// Granularidade: Envio → Caixa → SKU. Persistência: localStorage 'pp_fba_shipments_v1'.
// SEM UI (isso é a Fase 6). Expõe window.FBA. Ver PROCESSO-FBA-ENVIOS.md.
(function () {
  'use strict';

  var LS_KEY = 'pp_fba_shipments_v1';

  // Pipeline de status (ordem). Transições/gates entram na Fase 2 — aqui é só o enum.
  var STATUS = ['RASCUNHO', 'SEPARACAO', 'CRIADO_AMAZON', 'EMBALADO', 'EM_TRANSITO', 'ENTREGUE_FC', 'EM_CONFERENCIA', 'RECEBIDO'];
  var STATUS_LATERAIS = ['RECEBIDO_COM_DIVERGENCIA', 'CANCELADO'];
  var STATUS_LABELS = {
    RASCUNHO: 'Rascunho', SEPARACAO: 'Separação', CRIADO_AMAZON: 'Criado na Amazon', EMBALADO: 'Embalado',
    EM_TRANSITO: 'Em trânsito', ENTREGUE_FC: 'Entregue no FC', EM_CONFERENCIA: 'Em conferência',
    RECEBIDO: 'Recebido', RECEBIDO_COM_DIVERGENCIA: 'Recebido c/ divergência', CANCELADO: 'Cancelado'
  };

  var seq = 0;
  function uid() { return 'env_' + Date.now().toString(36) + '_' + (seq++).toString(36); }
  function isoNow() { return new Date().toISOString(); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }   // BP-004: nunca NaN/Infinity
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ── store ──
  function readRaw() {
    try { var a = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeRaw(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  // Migração leve: preenche campos ausentes p/ não quebrar derivados em dados antigos/parciais.
  function normalize(s) {
    s = s || {};
    s.id = s.id || uid();
    s.nome = s.nome || 'Envio sem nome';
    s.status = (STATUS.indexOf(s.status) >= 0 || STATUS_LATERAIS.indexOf(s.status) >= 0) ? s.status : 'RASCUNHO';
    s.shipmentId_amazon = s.shipmentId_amazon || '';
    s.fc_destino = s.fc_destino || '';
    s.tipo_envio = s.tipo_envio || 'SPD';
    s.data_rascunho = s.data_rascunho || isoNow();
    ['data_criado_amazon', 'data_despacho', 'data_prevista_entrega', 'data_entrega_fc', 'data_conferencia_inicio', 'data_conferencia_fim']
      .forEach(function (k) { if (s[k] === undefined) s[k] = null; });
    s.motivo_cancelamento = s.motivo_cancelamento || '';
    s.observacoes = s.observacoes || '';
    s.itens = Array.isArray(s.itens) ? s.itens : [];
    s.caixas = Array.isArray(s.caixas) ? s.caixas : [];
    s.historico = Array.isArray(s.historico) ? s.historico : [];
    return s;
  }
  function loadAll() { return readRaw().map(normalize); }
  function saveAll(list) { return writeRaw(list); }
  function findIdx(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; return -1; }

  // ── derivados / INVARIANTE §5.3 ──
  // qtd_enviada de um SKU = Σ daquele SKU em TODAS as caixas (NUNCA digitado).
  function enviadaPorSku(s) {
    var m = {};
    (s.caixas || []).forEach(function (b) {
      (b.conteudo || []).forEach(function (c) {
        if (!c || !c.sku) return;
        m[c.sku] = (m[c.sku] || 0) + num(c.qtd);
      });
    });
    return m;
  }
  // Distribuição de um SKU pelas caixas: [{caixa, qtd}] (Fase 3 — para a tabela de reconciliação).
  function distribuicao(s, sku) {
    var out = [];
    (s.caixas || []).forEach(function (b) {
      var tot = 0;
      (b.conteudo || []).forEach(function (c) { if (c && c.sku === sku) tot += num(c.qtd); });
      if (tot > 0) out.push({ caixa: b.numero, qtd: tot });
    });
    return out;
  }
  // Alvo da reconciliação do EMBALADO: aprovado_amazon → separado → planejado.
  function alvoSku(it) {
    if (it.qtd_aprovada_amazon != null) return num(it.qtd_aprovada_amazon);
    if (it.qtd_separada != null) return num(it.qtd_separada);
    return num(it.qtd_planejada);
  }
  // Retorna uma CÓPIA do envio com todos os campos derivados calculados (entrada nunca é mutada).
  function withDerived(s) {
    var d = clone(normalize(s));
    var env = enviadaPorSku(d);
    var unPlan = 0, unEnv = 0, unRec = 0, temRecebido = false;
    (d.itens || []).forEach(function (it) {
      var qEnv = env[it.sku] || 0;
      it.qtd_enviada = qEnv;                                   // derivado (invariante)
      var rec = (it.qtd_recebida == null || it.qtd_recebida === '') ? null : num(it.qtd_recebida);
      it.divergencia = (rec == null) ? null : (rec - qEnv);
      it.status_recon = (rec == null) ? 'em_conferencia' : (rec === qEnv ? 'ok' : (rec < qEnv ? 'faltando' : 'sobra'));
      it._alvo = alvoSku(it);
      it._fecha_embalado = (qEnv === it._alvo);                // o gate EMBALADO (Fase 2/3) usará isto
      unPlan += num(it.qtd_planejada);
      unEnv += qEnv;
      if (rec != null) { unRec += rec; temRecebido = true; }
    });
    d.total_skus = (d.itens || []).length;
    d.un_planejadas = unPlan;
    d.un_enviadas = unEnv;
    d.un_recebidas = unRec;
    d.divergencia_total = temRecebido ? (unRec - unEnv) : null;
    // SKUs presentes em caixas mas ausentes na lista de itens (inconsistência a sinalizar)
    d.skus_orfaos = Object.keys(env).filter(function (sku) {
      return !(d.itens || []).some(function (it) { return it.sku === sku; });
    });
    return d;
  }

  function mutate(id, fn) {
    var list = loadAll(); var i = findIdx(list, id);
    if (i < 0) return null;
    fn(list[i]); saveAll(list);
    return withDerived(list[i]);
  }

  // ════════ FASE 2: máquina de estados (transições + gates + checklist + eventos) ════════
  var PIPELINE = STATUS;   // linha reta; RECEBIDO_COM_DIVERGENCIA e CANCELADO são laterais
  var TIPO_MAP = {
    SEPARACAO: 'SEPAROU', CRIADO_AMAZON: 'CRIOU_NA_AMAZON', EMBALADO: 'EMBALOU', EM_TRANSITO: 'DESPACHOU',
    ENTREGUE_FC: 'MARCOU_ENTREGUE', EM_CONFERENCIA: 'INICIOU_CONFERENCIA', RECEBIDO: 'FECHOU',
    RECEBIDO_COM_DIVERGENCIA: 'REGISTROU_DIVERGENCIA'
  };
  function labelOf(st) { return STATUS_LABELS[st] || st; }
  function addEvent(s, tipo, de, para, descricao, dados) {
    s.historico.push({ ts: isoNow(), tipo: tipo, de_status: de || null, para_status: para || null, descricao: descricao || '', dados: dados || {} });
  }

  // Checklist da etapa (§4) — FONTE ÚNICA; o gate (§3) = todos os itens REQUIRED ok.
  var STAGE_CHECKS = {
    RASCUNHO: function (d) {
      return [
        { label: '≥1 SKU com quantidade planejada > 0', required: true, ok: d.itens.some(function (it) { return num(it.qtd_planejada) > 0; }) },
        { label: '(opcional) observação do objetivo do envio', required: false, ok: !!d.observacoes }
      ];
    },
    SEPARACAO: function (d) {
      var a = [{ label: 'Tem ao menos 1 SKU', required: true, ok: d.itens.length > 0 }];
      d.itens.forEach(function (it) { a.push({ label: 'SKU ' + it.sku + ': qtd separada preenchida', required: true, ok: it.qtd_separada != null }); });
      return a;
    },
    CRIADO_AMAZON: function (d) {
      return [
        { label: 'shipmentId da Amazon preenchido', required: true, ok: !!d.shipmentId_amazon },
        { label: 'FC de destino preenchido', required: true, ok: !!d.fc_destino },
        { label: '(recomendado) qtd aprovada conferida por SKU', required: false, ok: d.itens.length > 0 && d.itens.every(function (it) { return it.qtd_aprovada_amazon != null; }) }
      ];
    },
    EMBALADO: function (d) {
      var a = [{ label: '≥1 caixa criada', required: true, ok: d.caixas.length > 0 }];
      d.itens.forEach(function (it) { a.push({ label: 'SKU ' + it.sku + ': enviado ' + it.qtd_enviada + ' = aprovado ' + it._alvo, required: true, ok: it._fecha_embalado }); });
      d.caixas.forEach(function (b) {
        a.push({ label: 'Caixa ' + b.numero + ': etiqueta FBA impressa', required: true, ok: !!b.etiqueta_fba_ok });
        a.push({ label: 'Caixa ' + b.numero + ': etiqueta de caixa impressa', required: true, ok: !!b.etiqueta_caixa_ok });
      });
      return a;
    },
    EM_TRANSITO: function (d) {
      var a = [
        { label: 'Data de despacho registrada', required: true, ok: !!d.data_despacho },
        { label: '(recomendado) data prevista de entrega', required: false, ok: !!d.data_prevista_entrega },
        { label: '≥1 caixa', required: true, ok: d.caixas.length > 0 }
      ];
      d.caixas.forEach(function (b) {
        a.push({ label: 'Caixa ' + b.numero + ': transportadora definida', required: true, ok: !!b.transportadora });
        a.push({ label: 'Caixa ' + b.numero + ': código de rastreio', required: true, ok: !!b.rastreio });
      });
      return a;
    },
    ENTREGUE_FC: function (d) {
      return [{ label: 'Data de entrega no FC registrada', required: true, ok: !!d.data_entrega_fc }];
    },
    EM_CONFERENCIA: function (d) {
      var a = [
        { label: 'Data de início da conferência registrada', required: true, ok: !!d.data_conferencia_inicio },
        { label: 'Tem ao menos 1 SKU', required: true, ok: d.itens.length > 0 }
      ];
      d.itens.forEach(function (it) { a.push({ label: 'SKU ' + it.sku + ': qtd recebida preenchida', required: true, ok: it.qtd_recebida != null }); });
      return a;
    },
    RECEBIDO: function (d) { return [{ label: 'Envio concluído e reconciliado', required: false, ok: true }]; },
    RECEBIDO_COM_DIVERGENCIA: function (d) {
      return [
        { label: 'Divergência registrada (Δ ' + d.divergencia_total + ')', required: false, ok: true },
        { label: 'Caso resolvido na Amazon — avançar fecha como RECEBIDO', required: false, ok: false }
      ];
    },
    CANCELADO: function (d) { return [{ label: 'Cancelado — ' + (d.motivo_cancelamento || '—'), required: false, ok: true }]; }
  };
  function stageChecks(d) { var f = STAGE_CHECKS[d.status]; return f ? f(d) : []; }
  function gateFor(d) {
    var pend = stageChecks(d).filter(function (c) { return c.required && !c.ok; }).map(function (c) { return c.label; });
    return { ok: pend.length === 0, pendencias: pend };
  }
  function nextStatus(d) {
    var i = PIPELINE.indexOf(d.status);
    if (i >= 0 && i < PIPELINE.length - 1) {
      if (d.status === 'EM_CONFERENCIA') return (d.divergencia_total != null && d.divergencia_total !== 0) ? 'RECEBIDO_COM_DIVERGENCIA' : 'RECEBIDO';
      return PIPELINE[i + 1];
    }
    if (d.status === 'RECEBIDO_COM_DIVERGENCIA') return 'RECEBIDO';   // resolver caso
    return null;   // RECEBIDO / CANCELADO são terminais
  }
  function prevStatus(d) {
    if (d.status === 'RECEBIDO' || d.status === 'RECEBIDO_COM_DIVERGENCIA') return 'EM_CONFERENCIA';
    var i = PIPELINE.indexOf(d.status);
    return i > 0 ? PIPELINE[i - 1] : null;
  }

  // ── API pública (Fase 1: dados + derivados; transições/gates = Fase 2) ──
  var api = {
    LS_KEY: LS_KEY, STATUS: STATUS.slice(), STATUS_LATERAIS: STATUS_LATERAIS.slice(), STATUS_LABELS: STATUS_LABELS,

    list: function () { return loadAll().map(withDerived); },
    get: function (id) { var list = loadAll(); var i = findIdx(list, id); return i < 0 ? null : withDerived(list[i]); },

    create: function (opts) {
      opts = opts || {};
      var s = normalize({ nome: opts.nome, observacoes: opts.observacoes, tipo_envio: opts.tipo_envio });
      addEvent(s, 'CRIOU_RASCUNHO', null, 'RASCUNHO', 'Envio criado: ' + s.nome);
      var list = loadAll(); list.push(s); saveAll(list);
      return withDerived(s);
    },
    remove: function (id) {
      var list = loadAll(); var i = findIdx(list, id); if (i < 0) return false;
      list.splice(i, 1); saveAll(list); return true;
    },

    // Campos do envio (datas/ids/obs). NÃO mexe em status (Fase 2) nem em derivados.
    patch: function (id, fields) {
      fields = fields || {};
      var allow = ['nome', 'shipmentId_amazon', 'fc_destino', 'tipo_envio', 'data_criado_amazon', 'data_despacho',
        'data_prevista_entrega', 'data_entrega_fc', 'data_conferencia_inicio', 'data_conferencia_fim', 'observacoes', 'motivo_cancelamento'];
      return mutate(id, function (s) { allow.forEach(function (k) { if (fields[k] !== undefined) s[k] = fields[k]; }); });
    },

    // ── Máquina de estados (Fase 2) ──
    // Checklist da etapa atual (itens com {label, ok, required}) — para a UI (Fase 6).
    checklist: function (id) { var d = api.get(id); return d ? stageChecks(d) : []; },
    // Gate da etapa atual: { ok, pendencias[] } (só os itens required pendentes).
    gate: function (id) { var d = api.get(id); return d ? gateFor(d) : { ok: false, pendencias: ['envio não encontrado'] }; },
    // Prévia: pode avançar? para qual status? sem mutar.
    canAdvance: function (id) {
      var d = api.get(id); if (!d) return { ok: false, error: 'não encontrado' };
      var to = nextStatus(d); if (!to) return { ok: false, terminal: true, status: d.status };
      var g = PIPELINE.indexOf(d.status) >= 0 ? gateFor(d) : { ok: true, pendencias: [] };
      return { ok: g.ok, to: to, pendencias: g.pendencias };
    },
    // Avança 1 passo SE o gate estiver satisfeito. EM_CONFERENCIA → RECEBIDO ou
    // RECEBIDO_COM_DIVERGENCIA (divergência NÃO bloqueia; apenas roteia). Gera evento.
    advance: function (id) {
      var d = api.get(id); if (!d) return { ok: false, error: 'não encontrado' };
      var to = nextStatus(d); if (!to) return { ok: false, error: 'status ' + d.status + ' é terminal' };
      if (PIPELINE.indexOf(d.status) >= 0) {
        var g = gateFor(d);
        if (!g.ok) return { ok: false, blocked: true, status: d.status, to: to, pendencias: g.pendencias };
      }
      var tipo = TIPO_MAP[to] || 'AVANCOU';
      var descr = 'Avançou: ' + labelOf(d.status) + ' → ' + labelOf(to) + (to === 'RECEBIDO_COM_DIVERGENCIA' ? ' (Δ ' + d.divergencia_total + ')' : '');
      var env = mutate(id, function (s) { addEvent(s, tipo, s.status, to, descr); s.status = to; });
      return { ok: true, status: to, envio: env };
    },
    // Volta 1 passo (correção). Exige motivo. Gera evento VOLTOU_STATUS.
    back: function (id, motivo) {
      motivo = (motivo || '').trim();
      if (!motivo) return { ok: false, error: 'motivo obrigatório para voltar status' };
      var d = api.get(id); if (!d) return { ok: false, error: 'não encontrado' };
      var to = prevStatus(d); if (!to) return { ok: false, error: 'status ' + d.status + ' não tem etapa anterior' };
      var env = mutate(id, function (s) {
        addEvent(s, 'VOLTOU_STATUS', s.status, to, 'Voltou: ' + labelOf(s.status) + ' → ' + labelOf(to) + '. Motivo: ' + motivo, { motivo: motivo });
        s.status = to;
      });
      return { ok: true, status: to, envio: env };
    },
    // Cancela a partir de qualquer status (exige motivo). Gera evento CANCELOU.
    cancel: function (id, motivo) {
      motivo = (motivo || '').trim();
      if (!motivo) return { ok: false, error: 'motivo_cancelamento obrigatório' };
      var d = api.get(id); if (!d) return { ok: false, error: 'não encontrado' };
      if (d.status === 'CANCELADO') return { ok: false, error: 'já cancelado' };
      var env = mutate(id, function (s) {
        var de = s.status;
        addEvent(s, 'CANCELOU', de, 'CANCELADO', 'Cancelado. Motivo: ' + motivo, { motivo: motivo });
        s.status = 'CANCELADO'; s.motivo_cancelamento = motivo;
      });
      return { ok: true, status: 'CANCELADO', envio: env };
    },

    // ── SKUs ──
    addSku: function (id, sku) {
      return mutate(id, function (s) {
        if (!sku || !sku.sku) return;
        if (s.itens.some(function (x) { return x.sku === sku.sku; })) return;   // não duplica SKU
        s.itens.push({
          sku: String(sku.sku), descricao: sku.descricao || '', fnsku: sku.fnsku || '',
          qtd_planejada: sku.qtd_planejada != null ? num(sku.qtd_planejada) : 0,
          qtd_separada: sku.qtd_separada != null ? num(sku.qtd_separada) : null,
          qtd_aprovada_amazon: sku.qtd_aprovada_amazon != null ? num(sku.qtd_aprovada_amazon) : null,
          qtd_recebida: sku.qtd_recebida != null ? num(sku.qtd_recebida) : null,
          validade_lote: sku.validade_lote || ''
        });
      });
    },
    updateSku: function (id, sku, patch) {
      patch = patch || {};
      return mutate(id, function (s) {
        var it = s.itens.filter(function (x) { return x.sku === sku; })[0]; if (!it) return;
        ['descricao', 'fnsku', 'validade_lote'].forEach(function (k) { if (patch[k] !== undefined) it[k] = patch[k]; });
        ['qtd_planejada', 'qtd_separada', 'qtd_aprovada_amazon', 'qtd_recebida'].forEach(function (k) {
          if (patch[k] !== undefined) it[k] = (patch[k] === null || patch[k] === '') ? null : num(patch[k]);
        });
        // qtd_enviada NUNCA é aceita por aqui — é derivada das caixas (invariante §5.3).
      });
    },
    removeSku: function (id, sku) {
      return mutate(id, function (s) { s.itens = s.itens.filter(function (x) { return x.sku !== sku; }); });
    },

    // ── Caixas ──
    addBox: function (id, box) {
      box = box || {};
      return mutate(id, function (s) {
        var n = s.caixas.reduce(function (mx, b) { return Math.max(mx, b.numero || 0); }, 0) + 1;
        s.caixas.push({
          numero: n, dim_cm: box.dim_cm || { c: null, l: null, a: null },
          peso_kg: box.peso_kg != null ? num(box.peso_kg) : null,
          transportadora: box.transportadora || '', rastreio: box.rastreio || '',
          etiqueta_fba_ok: !!box.etiqueta_fba_ok, etiqueta_caixa_ok: !!box.etiqueta_caixa_ok,
          status_caixa: box.status_caixa || 'montada',
          conteudo: Array.isArray(box.conteudo) ? box.conteudo : []
        });
      });
    },
    updateBox: function (id, numero, patch) {
      patch = patch || {};
      return mutate(id, function (s) {
        var b = s.caixas.filter(function (x) { return x.numero === numero; })[0]; if (!b) return;
        ['dim_cm', 'transportadora', 'rastreio', 'status_caixa'].forEach(function (k) { if (patch[k] !== undefined) b[k] = patch[k]; });
        if (patch.peso_kg !== undefined) b.peso_kg = patch.peso_kg == null ? null : num(patch.peso_kg);
        ['etiqueta_fba_ok', 'etiqueta_caixa_ok'].forEach(function (k) { if (patch[k] !== undefined) b[k] = !!patch[k]; });
      });
    },
    removeBox: function (id, numero) {
      return mutate(id, function (s) { s.caixas = s.caixas.filter(function (x) { return x.numero !== numero; }); });
    },
    // Conteúdo da caixa = [{sku, qtd}] — é o que alimenta a invariante qtd_enviada.
    setBoxContent: function (id, numero, conteudo) {
      return mutate(id, function (s) {
        var b = s.caixas.filter(function (x) { return x.numero === numero; })[0]; if (!b) return;
        b.conteudo = (Array.isArray(conteudo) ? conteudo : [])
          .filter(function (c) { return c && c.sku; })
          .map(function (c) { return { sku: String(c.sku), qtd: num(c.qtd) }; });
      });
    },
    // Define a qtd de UM SKU numa caixa (ergonômico p/ a UI). qtd ≤ 0 remove o SKU da caixa.
    setSkuInBox: function (id, numero, sku, qtd) {
      qtd = num(qtd);
      return mutate(id, function (s) {
        var b = s.caixas.filter(function (x) { return x.numero === numero; })[0]; if (!b || !sku) return;
        b.conteudo = (b.conteudo || []).filter(function (c) { return c.sku !== sku; });
        if (qtd > 0) b.conteudo.push({ sku: String(sku), qtd: qtd });
      });
    },

    // ── Reconciliação / leitura para a UI (Fase 3) ──
    // Tabela de reconciliação por SKU + totais + resumo + fechamento do EMBALADO.
    reconcile: function (id) {
      var d = api.get(id); if (!d) return null;
      var itens = d.itens.map(function (it) {
        return {
          sku: it.sku, descricao: it.descricao || '',
          planejada: num(it.qtd_planejada),
          separada: it.qtd_separada == null ? null : num(it.qtd_separada),
          aprovada: it.qtd_aprovada_amazon == null ? null : num(it.qtd_aprovada_amazon),
          alvo: it._alvo,                         // base do fechamento (aprovado→separado→planejado)
          enviada: it.qtd_enviada,                // Σ caixas (invariante)
          recebida: it.qtd_recebida == null ? null : num(it.qtd_recebida),
          divergencia: it.divergencia,            // recebida − enviada
          status_recon: it.status_recon,          // ok / faltando / sobra / em_conferencia
          fecha_embalado: it._fecha_embalado,
          distribuicao: distribuicao(d, it.sku)   // [{caixa, qtd}]
        };
      });
      var resumo = { ok: 0, faltando: 0, sobra: 0, em_conferencia: 0 };
      itens.forEach(function (r) { if (resumo[r.status_recon] != null) resumo[r.status_recon]++; });
      var pendentes = itens.filter(function (r) { return !r.fecha_embalado; })
        .map(function (r) { return { sku: r.sku, enviada: r.enviada, alvo: r.alvo, delta: r.enviada - r.alvo }; });
      return {
        itens: itens,
        totais: { planejada: d.un_planejadas, enviada: d.un_enviadas, recebida: d.un_recebidas, divergencia: d.divergencia_total },
        resumo: resumo,
        skus_orfaos: d.skus_orfaos,
        embalado: { fecha: pendentes.length === 0 && d.caixas.length > 0, pendentes: pendentes }
      };
    },
    // Caixas enriquecidas (descrição do SKU + total de unidades por caixa).
    boxes: function (id) {
      var d = api.get(id); if (!d) return [];
      var desc = {}; d.itens.forEach(function (it) { desc[it.sku] = it.descricao || ''; });
      return d.caixas.map(function (b) {
        var un = 0;
        var cont = (b.conteudo || []).map(function (c) { un += num(c.qtd); return { sku: c.sku, descricao: desc[c.sku] || '', qtd: num(c.qtd) }; });
        return {
          numero: b.numero, dim_cm: b.dim_cm, peso_kg: b.peso_kg,
          transportadora: b.transportadora, rastreio: b.rastreio,
          etiqueta_fba_ok: b.etiqueta_fba_ok, etiqueta_caixa_ok: b.etiqueta_caixa_ok,
          status_caixa: b.status_caixa, conteudo: cont, un_total: un
        };
      });
    },

    // Leituras derivadas (sem persistir)
    derived: function (s) { return withDerived(s); },
    enviadaPorSku: function (s) { return enviadaPorSku(normalize(clone(s))); }
  };

  if (typeof window !== 'undefined') window.FBA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;  // permite teste em node
})();
