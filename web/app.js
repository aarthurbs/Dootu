/* Página pública da análise. Vanilla JS, sem dependência, sem build.
 *
 * Monta a MESMA lista de trechos do Estúdio. `ytStepHTML` e `ytCandidateCardHTML`
 * não são exportados pelo video-ops.js, então o esqueleto do cartão é remontado
 * aqui — com as mesmas classes e os mesmos textos. `esc`, `num`, `fmtClock` e
 * `signalLabel` são copiados de lá em vez de carregar 2.258 linhas para usar quatro
 * funções.
 *
 * O que esta página NÃO tem, de propósito:
 *  - portão de direitos: aqui não existe download. Um checkbox que não guarda nada
 *    seria teatro; a declaração vive onde o byte de mídia sai, no Estúdio local.
 *  - estado de legenda / de "Mais reproduzidos": na tela YouTube do Estúdio essas
 *    frases não existem — são do Passo 2, que lê o sidecar de um MP4 local. O único
 *    vestígio de heatmap no cartão é o chip de sinal, e é o que fica.
 */
(function () {
  'use strict';

  var CFG = (typeof window !== 'undefined' && window.CLIPS_CONFIG) || {};
  var API = String(CFG.apiBase || '').replace(/\/+$/, '');
  var SITEKEY = String(CFG.turnstileSiteKey || '');

  var SIGNAL_LABEL = { heatmap: 'Mais reproduzidos', chapter: 'Capítulo', transcript: 'Fala' };

  /* Sessão e nada mais: recarregar a página zera. Nenhum localStorage — a página
     promete no rodapé que não guarda o que você cola, e cumprir isso é código. */
  var S = {
    url: '', video: null, note: '', candidates: [], status: 'idle', error: '', preview: '',
    /* O motor de análise roda na MÁQUINA do operador, não aqui. Esta página é a
       mesma servida localmente e publicada no Vercel; a diferença é só se o
       127.0.0.1 responde. 'checando' | 'ok' | 'offline'. */
    motor: 'checando',
  };

  /* --- copiados do video-ops.js (mesmo formato, mesmos textos) --- */
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
  function fmtClock(seconds) {
    var total = Number(seconds);
    if (!Number.isFinite(total) || total < 0) return '--:--';
    total = Math.floor(total);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(total % 60);
  }
  function signalLabel(id) { return SIGNAL_LABEL[id] || String(id || ''); }
  function chip(cls, text) { return '<span class="vop-chip ' + cls + '">' + esc(text) + '</span>'; }

  /* Identidade do trecho vem do PRÓPRIO intervalo. O servidor não manda id (não há
     sessão para chavear), e gerar um id novo a cada render fecharia a prévia aberta
     a cada clique. */
  function clipKey(clip) { return num(clip.inSec) + '-' + num(clip.outSec); }

  /* --- HTML (puro, testável sem DOM) --- */
  function cardHTML(clip, videoId, openId) {
    var span = num(clip.outSec) - num(clip.inSec);
    var key = clipKey(clip);
    var open = !!openId && openId === key;
    return '<article class="vop-cand" data-clip="' + esc(key) + '">'
      + '<div class="vop-cand-head"><code>' + esc(fmtClock(clip.inSec) + ' → ' + fmtClock(clip.outSec)) + ' · ' + span + 's</code>'
      /* Nota ausente não vira "nota 0" — zero na tela seria uma medição falsa. */
      + (num(clip.score) ? chip('vop-cand-score', 'nota ' + num(clip.score)) : '') + '</div>'
      + '<h4>' + esc(clip.topic) + '</h4>'
      + ((clip.signals || []).length
        ? '<div class="vop-pill-row">' + clip.signals.map(function (s) {
          return chip('vop-chip-quiet', signalLabel(s));
        }).join('') + '</div>' : '')
      + (clip.reason ? '<p class="vop-cand-reason">' + esc(clip.reason) + '</p>' : '')
      + (clip.hook ? '<p class="vop-cand-hook">“' + esc(clip.hook) + '”</p>' : '')
      + (clip.contextWarning ? '<div class="vop-warning">' + esc(clip.contextWarning) + '</div>' : '')
      + (open && videoId
        ? '<iframe class="vop-cand-frame" src="https://www.youtube.com/embed/' + esc(videoId)
          + '?start=' + num(clip.inSec) + '&amp;end=' + num(clip.outSec) + '&amp;rel=0" title="Prévia do trecho"'
          + ' allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"'
          + ' referrerpolicy="strict-origin-when-cross-origin"></iframe>' : '')
      + (videoId
        ? '<div class="vop-card-actions"><button class="vop-btn vop-btn-quiet" type="button"'
          + ' data-act="preview" data-id="' + esc(key) + '" aria-pressed="' + open + '">'
          + (open ? 'Fechar prévia' : 'Prever') + '</button></div>' : '')
      + '</article>';
  }

  /* A tela é DOIS containers, não um. O de estado é `aria-live`; o da lista não —
     senão abrir uma prévia faz o leitor de tela reler os 12 cartões. */
  function statusHTML(state) {
    if (state.status === 'loading') {
      return '<div class="bar"><i></i></div>'
        + '<p class="wait">Analisando o vídeo. Um podcast de duas horas leva por volta de 10 segundos.</p>';
    }
    if (state.status === 'error') {
      return '<div class="vop-warning">' + esc(state.error) + '</div>';
    }
    if (state.status === 'stale') {
      return '<div class="vop-warning">A URL mudou, então a análise anterior foi descartada.'
        + ' Clique em Detectar cortes de novo.</div>';
    }
    if (state.status === 'ready' && !state.candidates.length) {
      return '<p class="vop-form-note">A análise terminou sem trecho com sinal suficiente.'
        + ' Tente outro vídeo — ou marque o trecho na mão, no Estúdio.</p>';
    }
    return '';
  }

  /* Condição persistente, não estado transitório de uma requisição — por isso vive
     num container próprio, acima do botão, e não na região de status. */
  function motorHTML(state) {
    if (state.motor !== 'offline') return '';
    return '<div class="vop-warning">'
      + '<strong>O motor de análise não respondeu.</strong> Ele roda na sua máquina,'
      + ' não neste site — a página publicada é só a interface.'
      + ' <br>Duas causas possíveis, e não dá para distinguir uma da outra pelo navegador:'
      + ' <br>1. o motor não está ligado nesta máquina — rode <code>analise-local.ps1</code>;'
      + ' <br>2. o navegador bloqueou a chamada desta página para o seu computador'
      + ' (Safari bloqueia sempre; Chrome e Edge liberam).'
      + ' <br><button class="vop-btn vop-btn-quiet" type="button" data-act="remotor">'
      + 'Verificar de novo</button></div>';
  }

  function listHTML(state) {
    if (state.status !== 'ready') return '';
    var videoId = (state.video && state.video.videoId) || '';
    var head = state.video && state.video.title
      ? '<p class="vop-form-note"><strong>' + esc(state.video.title) + '</strong>'
        + (state.video.uploader ? ' · ' + esc(state.video.uploader) : '')
        + (num(state.video.durationSec) ? ' · ' + esc(fmtClock(state.video.durationSec)) : '') + '</p>'
      : '';
    /* `note` é o aviso que o próprio detector escreve (ex.: vídeo sem "Mais
       reproduzidos"). Mesmo campo e mesmo prefixo do Estúdio. */
    var note = state.note ? '<div class="vop-warning">Análise: ' + esc(state.note) + '</div>' : '';
    if (!state.candidates.length) return head + note;
    return head + note + '<div class="vop-cand-list">'
      + state.candidates.slice().sort(function (a, b) { return num(a.inSec) - num(b.inSec); })
        .map(function (clip) { return cardHTML(clip, videoId, state.preview); }).join('')
      + '</div>';
  }

  /* --- DOM --- */
  if (typeof document === 'undefined') {
    /* Carregado pelo node (teste): exporta o que é puro e para aqui. */
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = {
        esc: esc, num: num, fmtClock: fmtClock, signalLabel: signalLabel,
        clipKey: clipKey, cardHTML: cardHTML,
        statusHTML: statusHTML, listHTML: listHTML, motorHTML: motorHTML,
      };
    }
    return;
  }

  var $url, $go, $clear, $status, $list, $motor, $gate, busy = false;
  /* Contador de requisição. Sem ele, a resposta do vídeo A chega DEPOIS de você
     trocar a URL e repopula a lista com trechos de outro vídeo — a mentira que a
     regra "trocar a URL derruba a lista" existe para impedir. */
  var gen = 0;
  /* '' = tudo bem · 'broken' = o script do Turnstile não carregou (bloqueador,
     rede). São causas diferentes de "sem token" e não podem ter a mesma frase:
     mandar "marque a verificação" quando não existe caixa nenhuma trava o
     usuário sem saída. */
  var gateState = '';

  function render() {
    $status.innerHTML = statusHTML(S);
    $list.innerHTML = listHTML(S);
    $motor.innerHTML = motorHTML(S);
    /* Desabilita só quando SABEMOS que está offline. Durante 'checando' o botão
       segue clicável: a própria análise falha com a frase certa, e travar o botão
       por uma checagem em voo é pior que deixar tentar. */
    $go.disabled = busy || S.motor === 'offline';
    $go.textContent = busy ? 'Analisando…' : 'Detectar cortes';
    if (busy) { $go.setAttribute('aria-busy', 'true'); } else { $go.removeAttribute('aria-busy'); }
    $clear.hidden = !(S.status === 'ready' || S.status === 'error');
  }

  function token() {
    if (!SITEKEY) return '';
    return (window.turnstile && window.turnstile.getResponse()) || '';
  }

  function analisar() {
    if (busy) return;
    var url = $url.value.trim();
    if (!url) {
      S.status = 'error'; S.error = 'Cole o endereço do vídeo.';
      return render();
    }
    if (SITEKEY && gateState === 'broken') {
      S.status = 'error';
      S.error = 'A verificação anti-robô não carregou. Desative o bloqueador de anúncios'
        + ' nesta página ou recarregue, e tente de novo.';
      return render();
    }
    var t = token();
    if (SITEKEY && !t) {
      S.status = 'error';
      S.error = 'Complete a verificação anti-robô acima e clique de novo.';
      return render();
    }
    busy = true;
    var meu = ++gen;
    S.status = 'loading'; S.error = ''; S.preview = '';
    render();

    fetch(API + '/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, token: t }),
    }).then(function (resp) {
      return resp.json().catch(function () { return {}; }).then(function (body) {
        return { ok: resp.ok, body: body };
      });
    }).then(function (r) {
      /* Resposta obsoleta: a URL mudou enquanto isto voava. Não toca no estado —
         a tela já mostra que a análise anterior foi descartada. */
      if (meu !== gen) return;
      if (!r.ok) {
        S.status = 'error';
        /* Mensagem do servidor quando existe; nunca um "algo deu errado" genérico
           por cima de um motivo que o servidor já escreveu. */
        S.error = r.body.error || 'A análise falhou (HTTP). Tente de novo.';
        return;
      }
      S.status = 'ready';
      S.video = r.body.video || null;
      S.note = r.body.note || '';
      S.candidates = Array.isArray(r.body.candidates) ? r.body.candidates : [];
    }).catch(function () {
      if (meu !== gen) return;
      S.status = 'error';
      S.error = 'Não consegui falar com o servidor da análise. Verifique a conexão e tente de novo.';
    }).then(function () {
      /* `busy` é liberado SEMPRE, inclusive na resposta obsoleta — senão o botão
         fica desabilitado para sempre e a tela não diz por quê. */
      busy = false;
      /* Token do Turnstile é de uso único: sem reset, a SEGUNDA análise leva um
         token já gasto e volta 403 sem o usuário ter feito nada errado. */
      if (SITEKEY && window.turnstile) window.turnstile.reset();
      render();
    });
  }

  /* Um GET de 32 bytes no /health. É o que separa "o site está no ar mas o motor
     não" de um erro de rede sem explicação. AbortController porque um fetch para
     uma porta fechada pode pendurar em algumas redes. */
  function checarMotor() {
    S.motor = 'checando';
    render();
    var corta = null;
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctl) corta = setTimeout(function () { ctl.abort(); }, 3000);
    fetch(API + '/health', { signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (body) { S.motor = (body && body.ok) ? 'ok' : 'offline'; })
      .catch(function () { S.motor = 'offline'; })
      .then(function () {
        if (corta) clearTimeout(corta);
        render();
      });
  }

  function limpar() {
    gen++;                       /* invalida qualquer resposta em voo */
    S.video = null; S.note = ''; S.candidates = [];
    S.status = 'idle'; S.error = ''; S.preview = '';
    render();
  }

  function montarGate() {
    if (!SITEKEY) return;
    var div = document.createElement('div');
    div.className = 'cf-turnstile';
    div.setAttribute('data-sitekey', SITEKEY);
    div.setAttribute('data-theme', 'dark');
    $gate.appendChild(div);
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    s.onerror = function () { gateState = 'broken'; render(); };
    document.head.appendChild(s);
  }

  function init() {
    $url = document.getElementById('url');
    $go = document.getElementById('go');
    $clear = document.getElementById('clear');
    $status = document.getElementById('status');
    $list = document.getElementById('list');
    $motor = document.getElementById('motor');
    $gate = document.getElementById('gate');
    if (!$url || !$go || !$status || !$list || !$motor) return;

    $motor.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-act="remotor"]') : null;
      if (b) checarMotor();
    });

    $go.addEventListener('click', analisar);
    $clear.addEventListener('click', limpar);
    $url.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); analisar(); }
    });
    /* Trocar a URL derruba a lista: sugestão apontando para outro vídeo é mentira.
       Mesma regra do ytUrlWrite do Estúdio. Durante a análise, o painel não fica
       em branco — vira o aviso de descarte, senão o usuário não entende por que a
       faixa de espera sumiu. */
    $url.addEventListener('input', function () {
      if (busy) {
        gen++;
        S.status = 'stale'; S.error = '';
        S.video = null; S.note = ''; S.candidates = []; S.preview = '';
        return render();
      }
      if (S.status !== 'idle') limpar();
    });
    $list.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-act="preview"]') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      S.preview = S.preview === id ? '' : id;
      render();
      /* O render troca o innerHTML e o botão clicado deixa de existir: sem isto o
         foco volta ao <body> e quem navega por teclado perde o lugar na lista. */
      var alvo = $list.querySelector('[data-act="preview"][data-id="'
        + ((window.CSS && CSS.escape) ? CSS.escape(id) : id) + '"]');
      if (alvo) alvo.focus();
    });
    montarGate();
    render();
    checarMotor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
