// Provas da lógica pura do Estúdio de Vídeos (video-ops.js) — sem DOM e sem rede.
//
// O Estúdio tem cinco telas: 1 Vídeo, 2 Cortes, 3 Clips, Central e YouTube. O pipeline de
// publicação (contas, material, direitos, posts, relatórios) saiu em 2026-08-21, e com ele
// saíram as provas de aprovação/variante/CSV/Drive. O que sobrou é o que ainda existe:
// tempo, marcação, nome de arquivo, comando do FFmpeg, o registro da Central e o portão de
// direitos da ponte YouTube.
// Uso: node test-video-ops.js
const assert = require('assert');
const ops = require('./video-ops.js');

let provas = 0;
function ok(nome, fn) {
  try { fn(); provas++; } catch (erro) {
    console.error('FALHOU: ' + nome);
    throw erro;
  }
}
const BS = String.fromCharCode(92);   // '\' sem escapar em cada literal de caminho

/* ---------------------------------------------------------------- tempo (min:seg) */
ok('fmtClock escreve minuto:segundo e hora quando passa de 1h', () => {
  assert.strictEqual(ops.fmtClock(0), '0:00');
  assert.strictEqual(ops.fmtClock(930), '15:30');
  assert.strictEqual(ops.fmtClock(4530), '1:15:30');
  // Não medido não vira 0:00 — vira travessão de relógio.
  assert.strictEqual(ops.fmtClock(-1), '--:--');
  assert.strictEqual(ops.fmtClock('abc'), '--:--');
});

ok('parseClock aceita mm:ss, h:mm:ss e segundo puro', () => {
  assert.strictEqual(ops.parseClock('15:30'), 930);
  assert.strictEqual(ops.parseClock('1:15:30'), 4530);
  assert.strictEqual(ops.parseClock('930'), 930);
  assert.strictEqual(ops.parseClock('15:'), 900);      // meio da digitação já vale
});

ok('parseClock recusa texto e devolve vazio, nunca 0 calado', () => {
  assert.strictEqual(ops.parseClock('abc'), '');
  assert.strictEqual(ops.parseClock('1:2:3:4'), '');
  assert.strictEqual(ops.parseClock('12:ab'), '');
  assert.strictEqual(ops.parseClock(''), '');
});

ok('clockField mantém campo vazio como vazio', () => {
  assert.strictEqual(ops.clockField(''), '');
  assert.strictEqual(ops.clockField(null), '');
  assert.strictEqual(ops.clockField(930), '15:30');
});

/* --------------------------------------------------------- marcação de um trecho */
ok('markIssues explica cada recusa e guarda NaN/Infinity (BP-004)', () => {
  assert.deepStrictEqual(ops.markIssues(10, 40, 600), []);
  assert.ok(ops.markIssues(40, 10, 600).some(m => /fim precisa ser maior/.test(m)));
  assert.ok(ops.markIssues(10, 700, 600).some(m => /passa da duração/.test(m)));
  assert.ok(ops.markIssues(10, Infinity, 600).length);
  assert.ok(ops.markIssues('x', 40, 600).length);
  // Duração desconhecida não bloqueia, mas também não confere o fim.
  assert.deepStrictEqual(ops.markIssues(10, 40, 0), []);
});

ok('markStatus nunca termina mudo — cada estado tem a sua frase', () => {
  assert.strictEqual(ops.markStatus({ hasFile: false }).tone, 'idle');
  assert.strictEqual(ops.markStatus({ hasFile: true, fileError: true }).tone, 'error');
  assert.strictEqual(ops.markStatus({ hasFile: true, durationSec: 0 }).tone, 'warn');
  assert.strictEqual(ops.markStatus({ hasFile: true, durationSec: 600 }).tone, 'idle');
  const bom = ops.markStatus({ hasFile: true, durationSec: 600, inSec: 10, outSec: 40 });
  assert.strictEqual(bom.tone, 'ok');
  assert.ok(/30s/.test(bom.text));
  [{ hasFile: false }, { hasFile: true, fileError: true }, { hasFile: true, durationSec: 0 },
    { hasFile: true, durationSec: 600 }, { hasFile: true, durationSec: 600, inSec: 40, outSec: 10 }]
    .forEach(caso => assert.ok(ops.markStatus(caso).text.length > 20));
});

ok('intakeStatus e intakeMarkStatus falam do vídeo da sessão', () => {
  assert.strictEqual(ops.intakeStatus({ state: 'empty' }).tone, 'idle');
  assert.strictEqual(ops.intakeStatus({ state: 'loading' }).tone, 'warn');
  assert.strictEqual(ops.intakeStatus({ state: 'error', message: 'x' }).text, 'x');
  assert.ok(/Vídeo trocado/.test(ops.intakeStatus({ state: 'ready', replaced: true }).text));
  // Só uma das pontas marcada é erro com o motivo certo.
  assert.ok(/fim do corte/.test(ops.intakeMarkStatus({ url: 'b', inSec: 10, outSec: '' }).text));
  assert.ok(/início do corte/.test(ops.intakeMarkStatus({ url: 'b', inSec: '', outSec: 40 }).text));
});

ok('intakeCutDuplicate recusa intervalo igual e aceita sobreposição parcial', () => {
  const cortes = [{ id: 'a', inSec: 10, outSec: 40 }];
  assert.ok(ops.intakeCutDuplicate(cortes, 10, 40));
  assert.strictEqual(ops.intakeCutDuplicate(cortes, 20, 50), null);
  // Editando o próprio corte, ele não conflita consigo mesmo.
  assert.strictEqual(ops.intakeCutDuplicate(cortes, 10, 40, 'a'), null);
});

ok('trackRatio prende o arrasto entre 0 e 1', () => {
  const caixa = { left: 100, width: 200 };
  assert.strictEqual(ops.trackRatio(caixa, 100), 0);
  assert.strictEqual(ops.trackRatio(caixa, 200), 0.5);
  assert.strictEqual(ops.trackRatio(caixa, 500), 1);
  assert.strictEqual(ops.trackRatio(caixa, 0), 0);
  assert.strictEqual(ops.trackRatio(null, 10), 0);     // sem caixa não há razão (BP-004)
});

/* ------------------------------------------------------ nome de arquivo e FFmpeg */
ok('safeName sobrevive ao Windows sem comer o espaço do título', () => {
  assert.strictEqual(ops.safeName('meu corte: parte 1/2'), 'meu corte- parte 1-2');
  assert.strictEqual(ops.safeName('Ação e Não'), 'Acao e Nao');
  assert.strictEqual(ops.safeName('  '), 'sem-nome');
  assert.strictEqual(ops.safeName('CON'), '_CON');       // nome reservado no Windows
  assert.strictEqual(ops.safeName('fim.'), 'fim');       // ponto final o Explorer descarta
});

ok('cutFileName diz o formato e o intervalo, então clip homônimo não sobrescreve', () => {
  assert.strictEqual(ops.cutFileName('Erro que custou', 10, 40, 'blur'),
    'Erro que custou-10s-40s-9x16-blur.mp4');
  assert.strictEqual(ops.cutFileName('Erro que custou', 90, 120, 'blur'),
    'Erro que custou-90s-120s-9x16-blur.mp4');
  assert.strictEqual(ops.cutFileName('x.mp4', 1, 2, 'horizontal'), 'x-1s-2s-16x9.mp4');
  // Perfil desconhecido cai em horizontal em vez de gerar nome inválido.
  assert.ok(/16x9/.test(ops.cutFileName('x', 1, 2, 'inventado')));
});

ok('ffmpegCutCommand é a rede de segurança e recusa intervalo impossível', () => {
  const cmd = ops.ffmpegCutCommand('podcast.mp4', 10, 40, 'saida.mp4', 'blur');
  assert.ok(cmd.indexOf('-ss 10 -to 40') > 0);
  // O comando manual expressa a cadeia SEM miniatura, e desde 2026-08-27 ela e
  // letterbox chapado: o `gblur` que ficava aqui sairia diferente do helper.
  assert.ok(cmd.indexOf('pad=1080:1920:') > 0);
  assert.ok(cmd.indexOf('gblur') < 0);
  assert.ok(cmd.indexOf('libx264') > 0);
  assert.strictEqual(ops.ffmpegCutCommand('podcast.mp4', 40, 10, 'x.mp4', 'blur'), '');
  assert.strictEqual(ops.ffmpegCutCommand('', 10, 40, 'x.mp4', 'blur'), '');
  // Apóstrofo no nome do arquivo não escapa do literal PowerShell.
  assert.ok(ops.ffmpegCutCommand("d'agua.mp4", 1, 2, 'x.mp4', 'crop').indexOf("d''agua") > 0);
});

ok('isVideoFile aceita pela extensão quando o Windows não manda o tipo', () => {
  assert.strictEqual(ops.isVideoFile({ type: 'video/mp4' }), true);
  assert.strictEqual(ops.isVideoFile({ type: '', name: 'a.MKV' }), true);
  assert.strictEqual(ops.isVideoFile({ type: '', name: 'a.pdf' }), false);
  assert.strictEqual(ops.isVideoFile(null), false);
});

ok('fmtBytes não inventa tamanho', () => {
  assert.strictEqual(ops.fmtBytes(0), 'tamanho desconhecido');
  assert.strictEqual(ops.fmtBytes(2048), '2 KB');
  assert.strictEqual(ops.fmtBytes(5 * 1024 * 1024), '5,0 MB');
});

/* ------------------------------------------------------------- Central de Clips */
ok('libEntry recusa registro que não vira cartão utilizável', () => {
  assert.strictEqual(ops.libEntry({ inSec: 10, outSec: 10, fileName: 'x.mp4' }), null);
  assert.strictEqual(ops.libEntry({ inSec: 40, outSec: 10, fileName: 'x.mp4' }), null);
  assert.strictEqual(ops.libEntry({ inSec: 1, outSec: 9, fileName: '' }), null);
  assert.strictEqual(ops.libEntry(null), null);
});

ok('libEntry preenche o registro do clip baixado', () => {
  const e = ops.libEntry({
    inSec: 10, outSec: 40, fileName: 'corte.mp4', videoName: 'podcast.mp4',
    clipName: 'Erro que custou', origin: 'youtube', videoUrl: 'https://youtu.be/abc', bytes: 2048
  });
  assert.strictEqual(e.videoName, 'podcast.mp4');
  assert.strictEqual(e.clipName, 'Erro que custou');
  assert.strictEqual(e.origin, 'youtube');
  assert.strictEqual(e.bytes, 2048);
  assert.ok(e.id && e.createdAt);
  // savedPath vazio é legítimo: significa "foi só para a pasta de Downloads".
  assert.strictEqual(e.savedPath, '');
});

ok('libEntry normaliza origem desconhecida e URL que não é http', () => {
  assert.strictEqual(ops.libEntry({ inSec: 1, outSec: 2, fileName: 'x.mp4', origin: 'inventado' }).origin, 'local');
  assert.strictEqual(ops.libEntry({ inSec: 1, outSec: 2, fileName: 'x.mp4', videoUrl: 'javascript:alert(1)' }).videoUrl, '');
  assert.strictEqual(ops.libEntry({ inSec: 1, outSec: 2, fileName: 'x.mp4' }).videoName, 'Vídeo sem nome');
});

ok('libSanitize joga o lixo fora e mantém o que presta', () => {
  const limpo = ops.libSanitize({
    start: '2026-08-21',
    clips: [{ inSec: 1, outSec: 2, fileName: 'ok.mp4' }, { inSec: 5, outSec: 1, fileName: 'ruim.mp4' }, 'lixo', null]
  });
  assert.strictEqual(limpo.clips.length, 1);
  assert.strictEqual(limpo.start, '2026-08-21');
  assert.strictEqual(limpo.version, ops.LIB_VERSION);
  // Data inválida vira o dia de hoje em vez de sujar o cabeçalho de 90 dias.
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(ops.libSanitize({ start: 'ontem', clips: [] }).start));
  // Conteúdo irreconhecível devolve null: quem chama guarda o bruto e avisa.
  assert.strictEqual(ops.libSanitize(null), null);
  assert.strictEqual(ops.libSanitize('texto'), null);
});

ok('libGroups agrupa por vídeo, mais recente primeiro', () => {
  const grupos = ops.libGroups([
    { videoName: 'A', clipName: 'a1', createdAt: '2026-08-20T10:00:00Z', inSec: 1, outSec: 2, fileName: '1' },
    { videoName: 'B', clipName: 'b1', createdAt: '2026-08-21T10:00:00Z', inSec: 1, outSec: 2, fileName: '2' },
    { videoName: 'A', clipName: 'a2', createdAt: '2026-08-19T10:00:00Z', inSec: 1, outSec: 2, fileName: '3' }
  ]);
  assert.deepStrictEqual(grupos.map(g => g.name), ['B', 'A']);
  assert.deepStrictEqual(grupos[1].items.map(c => c.clipName), ['a1', 'a2']);
  assert.deepStrictEqual(ops.libGroups(null), []);
});

ok('savedClipUrl serve só o nome do arquivo — travessia morre no basename', () => {
  assert.strictEqual(
    ops.savedClipUrl({ savedPath: 'C:' + BS + 'Users' + BS + 'x' + BS + 'Videos' + BS + 'Cortes Estudio' + BS + 'c.mp4' }),
    '/clips/c.mp4');
  assert.strictEqual(ops.savedClipUrl({ savedPath: '/home/x/Cortes Estudio/c d.mp4' }), '/clips/c%20d.mp4');
  assert.strictEqual(ops.savedClipUrl({ savedPath: '..' + BS + '..' + BS + 'index.html' }), '/clips/index.html');
  assert.strictEqual(ops.savedClipUrl({ savedPath: '' }), '');
  assert.strictEqual(ops.savedClipUrl(null), '');
});

ok('a chave do histórico é NOVA — o cadastro antigo não é lido nem sobrescrito', () => {
  assert.strictEqual(ops.KEY, 'pp_video_clips_v1');
  assert.notStrictEqual(ops.KEY, 'pp_video_ops_v1');
});

/* ------------------------------------------------------------- ponte do YouTube */
ok('ytVideoId aceita as formas reais de link e recusa o resto', () => {
  assert.strictEqual(ops.ytVideoId('https://www.youtube.com/watch?v=abcdefghijk'), 'abcdefghijk');
  assert.strictEqual(ops.ytVideoId('https://youtu.be/abcdefghijk'), 'abcdefghijk');
  assert.strictEqual(ops.ytVideoId('https://www.youtube.com/live/abcdefghijk'), 'abcdefghijk');
  assert.strictEqual(ops.ytVideoId('https://www.youtube.com/watch?list=1&v=abcdefghijk'), 'abcdefghijk');
  assert.strictEqual(ops.ytVideoId('https://vimeo.com/123'), '');
  assert.strictEqual(ops.ytVideoId('javascript:alert(1)'), '');
  assert.strictEqual(ops.ytVideoId(''), '');
});

ok('o portão de direitos bloqueia o download sem declaração e diz o motivo', () => {
  const url = 'https://www.youtube.com/watch?v=abcdefghijk';
  const semDeclarar = ops.ytFetchGate({ url: url, authorized: false });
  assert.strictEqual(semDeclarar.allowed, false);
  assert.ok(/autorização/.test(semDeclarar.reason));
  const semLink = ops.ytFetchGate({ url: 'https://vimeo.com/1', authorized: true });
  assert.strictEqual(semLink.allowed, false);
  assert.ok(semLink.reason.length > 5);                       // recusa muda é bug (BP-008)
  assert.strictEqual(ops.ytFetchGate({ url: url, authorized: true }).allowed, true);
  assert.strictEqual(ops.ytFetchGate(null).allowed, false);
});

ok('ytCandidateClips descarta trecho sem duração e preserva o aviso de contexto', () => {
  const lista = ops.ytCandidateClips({
    candidates: [
      { inSec: 10, outSec: 40, topic: 'Dinheiro', score: 80, signals: ['heatmap', 'chapter', 7], contextWarning: 'Começa com "mas"' },
      { inSec: 50, outSec: 50, topic: 'Nada' },
      { inSec: 90, outSec: 60, topic: 'Invertido' }
    ]
  });
  assert.strictEqual(lista.length, 1);
  assert.strictEqual(lista[0].topic, 'Dinheiro');
  assert.deepStrictEqual(lista[0].signals, ['heatmap', 'chapter']);
  assert.ok(/mas/.test(lista[0].contextWarning));
  // Nasce sem trecho em disco: o botão de editar no Remotion depende disto.
  assert.strictEqual(lista[0].clipToken, '');
  assert.deepStrictEqual(ops.ytCandidateClips(null), []);
  assert.strictEqual(ops.ytCandidateClips({ candidates: [{ inSec: 1, outSec: 2 }] })[0].topic, 'Trecho sugerido');
});

ok('signalLabel traduz o sinal conhecido e não engole o desconhecido', () => {
  assert.strictEqual(ops.signalLabel('heatmap'), 'Mais reproduzidos');
  assert.strictEqual(ops.signalLabel('transcript'), 'Fala');
  assert.strictEqual(ops.signalLabel('novo_sinal'), 'novo_sinal');
});

/* ------------------------------------------------ "Mais reproduzidos" (Passo 2) */
ok('ytMostReplayedFrom reconta o rank e não confia no formato que veio de fora', () => {
  const bloco = ops.ytMostReplayedFrom({
    available: true,
    peaks: [{ start: 10, end: 20, peakValue: 0.4, rank: 9 }, { start: 30, end: 40, peakValue: 0.9 }, 'lixo'],
    points: [{ start: 0, end: 5, value: 0.5 }, { start: 9, end: 1, value: 0.5 }]
  });
  assert.strictEqual(bloco.available, true);
  assert.deepStrictEqual(bloco.peaks.map(p => p.rank), [1, 2]);
  assert.strictEqual(bloco.peaks[0].peakValue, 0.9);       // ordenado por valor, não pela ordem que veio
  assert.strictEqual(bloco.points.length, 1);              // ponto invertido cai fora
  assert.strictEqual(ops.ytMostReplayedFrom(null).available, false);
  // available só com pico de verdade: bloco vazio não pode dizer "disponível".
  assert.strictEqual(ops.ytMostReplayedFrom({ available: true, peaks: [] }).available, false);
});

ok('mrRecsFrom descarta pico que não cabe no vídeo carregado', () => {
  const payload = { mostReplayed: { available: true, peaks: [{ start: 10, end: 20, peakValue: 0.9 }, { start: 900, end: 950, peakValue: 0.8 }] } };
  const recs = ops.mrRecsFrom(payload, 600);
  assert.strictEqual(recs.available, true);
  assert.strictEqual(recs.peaks.length, 1);
  assert.strictEqual(recs.peaks[0].start, 10);
  // Sem duração conhecida nada é descartado por tamanho.
  assert.strictEqual(ops.mrRecsFrom(payload, 0).peaks.length, 2);
});

ok('mrIntensityLabel é fração, não inteiro (0,74 não pode virar "muito alto")', () => {
  assert.strictEqual(ops.mrIntensityLabel(0.9), 'Interesse muito alto');
  assert.strictEqual(ops.mrIntensityLabel(0.74), 'Interesse alto');
  assert.strictEqual(ops.mrIntensityLabel(0.3), 'Interesse moderado');
  assert.strictEqual(ops.mrIntensityLabel(0), 'Interesse moderado');
});

ok('mrSelectionFrom escreve só o intervalo — nunca cria corte', () => {
  const sel = ops.mrSelectionFrom({ start: 10, end: 40, rank: 1 });
  assert.deepStrictEqual(Object.keys(sel).sort(), ['inSec', 'outSec']);
  assert.deepStrictEqual(sel, { inSec: 10, outSec: 40 });
});

ok('mrBandsHTML desenha dentro da barra e mrListHTML nunca fica muda', () => {
  const html = ops.mrBandsHTML([{ start: 300, end: 360, rank: 1 }], 600);
  assert.ok(/left:50\.000%/.test(html));
  assert.ok(/width:10\.000%/.test(html));
  assert.strictEqual(ops.mrBandsHTML([], 600), '');
  assert.strictEqual(ops.mrBandsHTML([{ start: 1, end: 2 }], 0), '');
  ['loading', 'mismatch', 'none', 'ready'].forEach(estado => {
    assert.ok(ops.mrListHTML(estado, []).length > 30, 'estado ' + estado + ' sem frase');
  });
  const lista = ops.mrListHTML('ready', [{ rank: 1, start: 10, end: 40, intensity: 'Interesse alto' }]);
  assert.ok(/Usar como corte/.test(lista));
  assert.ok(/data-act="rec-play"/.test(lista));
});

/* ---------------------------------------------------------------------- prioridade */
ok('priorityOf normaliza o que não conhece', () => {
  assert.strictEqual(ops.priorityOf({ priority: 'alta' }), 'alta');
  assert.strictEqual(ops.priorityOf({ priority: 'urgentissima' }), 'media');
  assert.strictEqual(ops.priorityOf(null), 'media');
});

/* ------------------------------------------------------- revisão da legenda (Passo 3) */
ok('o relógio da fala mostra o décimo (duas falas caem no mesmo segundo)', () => {
  assert.strictEqual(ops.capClock(74.36), '1:14.4');
  /* 2.4 % 1 dá 0.3999… em ponto flutuante: contar em décimos é o que evita "0:02.3". */
  assert.strictEqual(ops.capClock(2.4), '0:02.4');
  assert.strictEqual(ops.capClock(2.96), '0:03.0');
  assert.strictEqual(ops.capClock(-5), '0:00.0');
});

ok('a legenda que chega do helper é tratada como dado externo', () => {
  const limpo = ops.capCuesFrom({ cues: [
    { start: '1.25', end: 3.5, text: '  fala com espaço  ' },
    { start: 5, end: 5, text: 'duração zero' },
    { start: 7, end: 8, text: 'x'.repeat(5000) }
  ] });
  assert.strictEqual(limpo.length, 2);
  /* Casa decimal PRESERVADA: o num() do módulo arredonda para segundo inteiro e mataria
     o relógio da legenda. */
  assert.strictEqual(limpo[0].start, 1.25);
  assert.strictEqual(limpo[0].text, 'fala com espaço');
  assert.ok(limpo[1].text.length <= 300, 'texto gigante tem de ser cortado');
  assert.deepStrictEqual(ops.capCuesFrom({}), []);
  assert.deepStrictEqual(ops.capCuesFrom({ cues: 'nem é lista' }), []);
});

ok('o painel mostra cada fala com o tempo em leitura e o texto editável', () => {
  const painel = ops.capHTML('c1', {
    state: 'ok',
    cues: [{ start: 0, end: 2.4, text: 'Finalmente saiu o escritório, [ __ ]' },
           { start: 2.4, end: 4, text: 'e a gente começou a faturar' }],
    original: [{ start: 0, end: 2.4, text: 'Finalmente saiu o escritório, [ __ ]' },
               { start: 2.4, end: 4, text: 'e a gente começou a faturar' }]
  });
  assert.ok(/0:00\.0 → 0:02\.4/.test(painel), 'o tempo da fala tem de aparecer');
  assert.ok(/data-cap-field/.test(painel), 'o texto tem de ser editável');
  assert.strictEqual((painel.match(/data-cap-field/g) || []).length, 2, 'um campo por fala');
  /* O tempo é <span>, nunca <input>: quem manda no relógio é o corte. */
  assert.ok(/<span class="vop-cap-time">/.test(painel), 'o tempo é leitura');
  assert.ok(/Restaurar texto do YouTube/.test(painel), 'dá para voltar ao original');
  assert.ok(/o que entra no vídeo/.test(painel), 'diz que este texto é o que será queimado');
  assert.ok(painel.indexOf('[ __ ]') > 0, 'o que o YouTube detectou aparece como está');
});

ok('cada desfecho da legenda tem frase, inclusive quando não há nada a mostrar', () => {
  ['loading', 'ok', 'edited', 'CAPTIONS_NOT_AVAILABLE', 'CAPTIONS_EXTRACTION_FAILED',
    'CAPTIONS_OUT_OF_RANGE', 'CAPTIONS_EDITED_EMPTY', 'CAPTIONS_TOO_MANY'].forEach(estado => {
    assert.ok(ops.capMessage(estado).length > 20, 'estado sem frase: ' + estado);
    const vazio = ops.capHTML('c1', { state: estado, cues: [], original: [] });
    assert.ok(vazio.indexOf(ops.capMessage(estado)) > 0, 'painel mudo no estado ' + estado);
  });
  assert.strictEqual(ops.capHTML('c1', null), '');
  /* Os dois motivos de ausência continuam DISTINTOS na tela, como no servidor. */
  assert.notStrictEqual(ops.capMessage('CAPTIONS_NOT_AVAILABLE'),
    ops.capMessage('CAPTIONS_EXTRACTION_FAILED'));
  assert.notStrictEqual(ops.capMessage('ok'), ops.capMessage('edited'));
});

ok('o texto da fala é escapado antes de virar HTML', () => {
  const painel = ops.capHTML('c1', {
    state: 'ok',
    cues: [{ start: 0, end: 2, text: '"><img src=x onerror=alert(1)>' }],
    original: []
  });
  assert.ok(!/<img/.test(painel), 'HTML da legenda não pode virar marcação');
});

/* --------------------------------------------- estimativa do render no Remotion */
ok('a espera do Remotion é dita em números, não em "alguns minutos"', () => {
  // O defeito relatado: um trecho de 90s (7:05→8:35) rende em ~17 min (medido: 2700
  // quadros em 1005s) e a tela prometia "alguns minutos". O operador conclui que quebrou
  // muito antes de o arquivo sair.
  assert.strictEqual(ops.renderEta(90), 'cerca de 18 min');
  assert.strictEqual(ops.renderEta(300), 'cerca de 60 min');
  // Trecho curto não pode virar "cerca de 0 min".
  assert.strictEqual(ops.renderEta(4), 'cerca de um minuto');
  // Duração ausente ou absurda não inventa número (guarda-zero, BP-004).
  ['', null, undefined, 0, -10, NaN].forEach(v =>
    assert.strictEqual(ops.renderEta(v), 'alguns minutos', 'sem duração não estima: ' + v));
});

/* ---------------------------------------- projetos salvos (pp_video_projects_v1) */
ok('projectsSanitize aceita projeto COM candidates sem explodir', () => {
  // BUG: `MAX_CANDIDATES` era usada na linha do corte e nunca declarada no módulo (o nome
  // só existe em video-worker/ytclip.py). O ternário curto-circuita quando `candidates`
  // não é array, então quem nunca tinha analisado um vídeo não via nada — e quem tinha
  // perdia o SITE INTEIRO: projectsSanitize lança, projectsLoad lança, init morre, o
  // #video-ops-root fica vazio e a tela fica preta, sem nada além do erro no console.
  const projeto = {
    id: 'p1', videoId: 'wc3V6vb9Yoc', url: 'https://youtu.be/wc3V6vb9Yoc',
    title: 'Podcast', thumbnail: '', durationSec: 3170,
    createdAt: '2026-08-31T12:00:00.000Z', updatedAt: '2026-08-31T12:00:00.000Z',
    status: 'ready', candidates: [{ id: 'c1', inSec: 10, outSec: 40 }], clipCount: 0,
    error: '', note: ''
  };
  const limpo = ops.projectsSanitize({ version: 1, projects: [projeto] });
  assert.ok(limpo, 'devolveu algo');
  assert.strictEqual(limpo.projects.length, 1);
  assert.strictEqual(limpo.projects[0].candidates.length, 1);
});

ok('projectsSanitize corta a lista de candidatos no teto, e o teto é o do detector', () => {
  // O teto tem de casar com `ytclip.MAX_CANDIDATES` (video-worker/ytclip.py): dois números
  // diferentes fariam a tela descartar sugestão que o servidor mandou, calado.
  assert.strictEqual(ops.MAX_CANDIDATES, 12);
  const muitos = Array.from({ length: 30 }, (_, i) => ({ id: 'c' + i, inSec: i, outSec: i + 5 }));
  const limpo = ops.projectsSanitize({
    version: 1,
    projects: [{ id: 'p1', videoId: 'abc12345678', candidates: muitos, createdAt: '' }]
  });
  assert.strictEqual(limpo.projects[0].candidates.length, ops.MAX_CANDIDATES);
});

ok('projectsSanitize sem candidates devolve lista vazia (era o caminho que não quebrava)', () => {
  const limpo = ops.projectsSanitize({
    version: 1, projects: [{ id: 'p1', videoId: 'abc12345678', createdAt: '' }]
  });
  assert.deepStrictEqual(limpo.projects[0].candidates, []);
});

/* --------------------------------- corpo do render (o card da marca depende dele) */
/* Estas quatro provas existem por causa de um defeito medido: `title` ficou fixo em `''`
   nesta rota desde a primeira versão, e a composição só monta o card quando o título chega
   preenchido. Resultado: o destaque de título inteiro — algoritmo, peso 900, filete, 33
   verificações verdes no preset.js — nunca apareceu em render nenhum, e ninguém soube.
   A suíte do preset não pegava porque o defeito mora do lado do NAVEGADOR. */
ok('o título do card sobe no corpo do render — era exatamente isto que faltava', () => {
  const clip = {
    clipToken: 'tok', category: 'money', id: 'cand-1',
    topic: 'Saiu de uma pequena cidade, para 100 mil pedidos',
    clipCues: [{ start: 0, end: 1, text: 'oi' }],
  };
  const corpo = ops.renderBody(clip, true);
  assert.strictEqual(corpo.title, 'Saiu de uma pequena cidade, para 100 mil pedidos');
  assert.notStrictEqual(corpo.title, '', 'título vazio não monta card nenhum');
  assert.strictEqual(corpo.clipToken, 'tok');
  assert.deepStrictEqual(corpo.cues, [{ start: 0, end: 1, text: 'oi' }]);
});
ok('o preset limpo não leva legenda, mas o título continua indo', () => {
  const clip = { clipToken: 't', id: 'c2', topic: 'Manchete', clipCues: [{ start: 0, end: 1, text: 'x' }] };
  const corpo = ops.renderBody(clip, false);
  assert.deepStrictEqual(corpo.cues, []);
  assert.strictEqual(corpo.preset, 'limpo');
  assert.strictEqual(corpo.title, 'Manchete');
});
ok('trecho sem topic não inventa manchete', () => {
  // Título vazio é resposta legítima: o pipeline não escreve manchete que ninguém pediu.
  assert.strictEqual(ops.renderBody({ clipToken: 't', id: 'c3' }, true).title, '');
});
ok('título absurdo é aparado antes de subir (o servidor apara de novo, em 180)', () => {
  const corpo = ops.renderBody({ clipToken: 't', id: 'c4', topic: 'a'.repeat(400) }, true);
  assert.strictEqual(corpo.title.length, 180);
});

/* ------------------------------------ título do card, editável pelo operador */
ok('digitar o título grava no trecho, sem re-render (o foco não pode saltar)', () => {
  const clip = { id: 'cand-9', clipToken: 't', topic: 'Corte 01' };
  ops.__setCandidates([clip]);
  ops.clipFieldWrite({ value: 'Perdi 40 mil no primeiro ano', dataset: { clipField: 'topic', id: 'cand-9' } });
  assert.strictEqual(clip.topic, 'Perdi 40 mil no primeiro ano');
  // O texto digitado é o MESMO que sobe para o card do vídeo — um campo, um significado.
  assert.strictEqual(ops.renderBody(clip, true).title, 'Perdi 40 mil no primeiro ano');
});
ok('apagar o título é resposta legítima: sobe vazio e a composição não monta card', () => {
  const clip = { id: 'cand-10', clipToken: 't', topic: 'Alguma coisa' };
  ops.__setCandidates([clip]);
  ops.clipFieldWrite({ value: '   ', dataset: { clipField: 'topic', id: 'cand-10' } });
  assert.strictEqual(clip.topic, '');
  assert.strictEqual(ops.renderBody(clip, true).title, '');
});
ok('título de trecho que saiu da lista não grava (nem cria candidato fantasma)', () => {
  ops.__setCandidates([]);
  // Não deve lançar: a URL pode ter sido trocada no meio da digitação.
  ops.clipFieldWrite({ value: 'x', dataset: { clipField: 'topic', id: 'sumiu' } });
});
ok('título gigante é aparado no campo, antes mesmo de subir', () => {
  const clip = { id: 'cand-11', clipToken: 't', topic: '' };
  ops.__setCandidates([clip]);
  ops.clipFieldWrite({ value: 'a'.repeat(400), dataset: { clipField: 'topic', id: 'cand-11' } });
  assert.strictEqual(clip.topic.length, 180);
});

/* --------------------------- "Card visual": qual identidade o card do título veste
   O card tinha UMA marca fixa. Agora o operador escolhe por trecho, e o valor tem de
   atravessar intacto: tela -> estado do trecho -> corpo do POST -> servidor -> composição.
   O que erra CALADO aqui é o valor não chegar (o vídeo sai com a outra marca e nada na
   tela erra), então cada elo tem check próprio. */
ok('as duas identidades mais o "sem card", e o padrão é a que todo corte já renderiza', () => {
  assert.deepStrictEqual(ops.TITLE_CARD_STYLES, ['primo_rico', 'puro_ecommerce', 'nenhum']);
  assert.strictEqual(ops.TITLE_CARD_PADRAO, 'primo_rico');
  // O padrão NUNCA é "sem card": valor torto tem de cair na marca de sempre, e não apagar
  // o card calado de quem nunca escolheu nada.
  assert.notStrictEqual(ops.TITLE_CARD_PADRAO, 'nenhum');
});
ok('"sem card" é escolha válida, guardada e enviada como as outras', () => {
  const clip = { id: 'cand-26', clipToken: 't', topic: 'Manchete que fica no nome do arquivo' };
  ops.__setCandidates([clip]);
  ops.clipFieldWrite({
    value: 'nenhum', dataset: { clipField: 'titleCardStyle', id: 'cand-26' },
  });
  assert.strictEqual(clip.titleCardStyle, 'nenhum');
  const corpo = ops.renderBody(clip, true);
  assert.strictEqual(corpo.titleCardStyle, 'nenhum');
  // E o TÍTULO continua subindo: é ele que nomeia o arquivo baixado e o cartão da Central.
  // Apagar o card não pode custar a manchete — se custasse, "sem card" seria a mesma coisa
  // que apagar o título, que já era possível antes desta opção existir.
  assert.strictEqual(corpo.title, 'Manchete que fica no nome do arquivo');
});
ok('trecho SEM a chave cai no padrão — clip antigo não muda de marca', () => {
  // É o caso do trecho salvo em `pp_video_projects_v1` antes desta entrega.
  assert.strictEqual(ops.titleCardStyleOf({ id: 'x' }), 'primo_rico');
  assert.strictEqual(ops.titleCardStyleOf({}), 'primo_rico');
  assert.strictEqual(ops.titleCardStyleOf(null), 'primo_rico');
  assert.strictEqual(ops.titleCardStyleOf(undefined), 'primo_rico');
});
ok('valor válido passa intacto (senão o seletor não seleciona nada)', () => {
  assert.strictEqual(ops.titleCardStyleOf({ titleCardStyle: 'puro_ecommerce' }), 'puro_ecommerce');
  assert.strictEqual(ops.titleCardStyleOf({ titleCardStyle: 'primo_rico' }), 'primo_rico');
});
ok('valor torto e o RÓTULO da tela são normalizados, nunca aceitos', () => {
  // O rótulo visível não é a chave da lógica: é isto que impede "Puro Ecommerce" de virar
  // identificador quando alguém reescrever o texto do botão.
  for (const v of ['Puro Ecommerce', 'Primo Rico', 'PURO_ECOMMERCE', 'puro-ecommerce',
    'outra_marca', '', 7, {}, [], true]) {
    assert.strictEqual(ops.titleCardStyleOf({ titleCardStyle: v }), 'primo_rico',
      'valor torto tem de cair no padrão: ' + JSON.stringify(v));
  }
});
ok('clicar no seletor grava a escolha no trecho, sem re-render', () => {
  const clip = { id: 'cand-20', clipToken: 't', topic: 'Manchete' };
  ops.__setCandidates([clip]);
  ops.clipFieldWrite({
    value: 'puro_ecommerce', dataset: { clipField: 'titleCardStyle', id: 'cand-20' },
  });
  assert.strictEqual(clip.titleCardStyle, 'puro_ecommerce');
  // E volta: a escolha não é de mão única.
  ops.clipFieldWrite({
    value: 'primo_rico', dataset: { clipField: 'titleCardStyle', id: 'cand-20' },
  });
  assert.strictEqual(clip.titleCardStyle, 'primo_rico');
});
ok('o seletor passa pelo validador: DOM é entrada, não fonte de verdade', () => {
  const clip = { id: 'cand-21', clipToken: 't', topic: 'M', titleCardStyle: 'puro_ecommerce' };
  ops.__setCandidates([clip]);
  // `value` adulterado (extensão, DevTools, HTML velho em cache) não pode virar estado.
  ops.clipFieldWrite({
    value: 'marca_inventada', dataset: { clipField: 'titleCardStyle', id: 'cand-21' },
  });
  assert.strictEqual(clip.titleCardStyle, 'primo_rico');
});
ok('cada trecho tem a SUA escolha (um seletor não mexe no vizinho)', () => {
  const a = { id: 'cand-22', clipToken: 't', topic: 'A' };
  const b = { id: 'cand-23', clipToken: 't', topic: 'B' };
  ops.__setCandidates([a, b]);
  ops.clipFieldWrite({
    value: 'puro_ecommerce', dataset: { clipField: 'titleCardStyle', id: 'cand-22' },
  });
  assert.strictEqual(a.titleCardStyle, 'puro_ecommerce');
  assert.strictEqual(b.titleCardStyle, undefined, 'o vizinho não foi tocado');
  assert.strictEqual(ops.renderBody(b, true).titleCardStyle, 'primo_rico');
});
ok('escolha de trecho que saiu da lista não grava (nem cria candidato fantasma)', () => {
  ops.__setCandidates([]);
  ops.clipFieldWrite({
    value: 'puro_ecommerce', dataset: { clipField: 'titleCardStyle', id: 'sumiu' },
  });
});
/* O ELO que erra calado: o corpo do POST. Foi exatamente aqui que `title: ''` atravessou a
   entrega inteira do destaque de título — o recurso existia, tinha teste, e nunca chegava
   ao render. Por isso o corpo é montado por função PURA e o teste a CHAMA. */
ok('a escolha sobe no corpo do render, nos dois presets', () => {
  const clip = {
    clipToken: 'tok', id: 'cand-24', topic: 'Manchete', titleCardStyle: 'puro_ecommerce',
    clipCues: [{ start: 0, end: 1, text: 'oi' }],
  };
  assert.strictEqual(ops.renderBody(clip, true).titleCardStyle, 'puro_ecommerce');
  // O preset "limpo" não leva legenda, mas a identidade do card continua indo.
  assert.strictEqual(ops.renderBody(clip, false).titleCardStyle, 'puro_ecommerce');
});
ok('a chave vai SEMPRE no corpo, mesmo em trecho antigo sem ela', () => {
  // Mandar sempre é o que fecha o caminho: chave ausente cairia no defaultProps da
  // composição em vez da escolha (ou do padrão) que a tela mostrou.
  const corpo = ops.renderBody({ clipToken: 't', id: 'cand-25', topic: 'M' }, true);
  assert.ok('titleCardStyle' in corpo, 'a chave tem de existir no corpo');
  assert.strictEqual(corpo.titleCardStyle, 'primo_rico');
});
/* PARIDADE com o preset.js. Esta é uma das TRÊS cópias do conjunto (aqui, no preset.js e no
   serve.py) e não há import possível entre elas: o index.html é Vanilla JS sem npm e o
   preset.js é ESM do projeto Remotion. Divergirem faria a tela oferecer um valor que o
   servidor descarta — e o vídeo sairia com a OUTRA marca, calado. */
ok('a cópia do conjunto bate com o preset.js (as duas listas e os dois padrões)', () => {
  const preset = require('fs').readFileSync(
    require('path').join(__dirname, 'studio', 'src', 'preset.js'), 'utf8');
  const lista = /export const TITLE_CARD_STYLES = \[([^\]]*)\]/.exec(preset);
  const padrao = /export const TITLE_CARD_PADRAO = '([^']+)'/.exec(preset);
  assert.ok(lista && padrao, 'não achei o conjunto no preset.js — se ele foi renomeado, '
    + 'este check tem de ser ajustado: conferência que não acha nada é pior que nenhuma');
  const doPreset = lista[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  assert.deepStrictEqual(ops.TITLE_CARD_STYLES, doPreset);
  assert.strictEqual(ops.TITLE_CARD_PADRAO, padrao[1]);
});
ok('cada identidade tem rótulo de tela, e nenhum rótulo sobra', () => {
  for (const estilo of ops.TITLE_CARD_STYLES) {
    assert.match(ops.TITLE_CARD_LABELS[estilo], /\S/, 'sem rótulo o botão sai vazio');
  }
  assert.strictEqual(Object.keys(ops.TITLE_CARD_LABELS).length, ops.TITLE_CARD_STYLES.length);
});
/* REGRESSÃO de um defeito MEDIDO no navegador: trocar a identidade "bugava a tela e deixava
   só uma faixa". O radio escondido é `position: absolute`; sem ancestral posicionado o bloco
   containing dele vira o BLOCO INICIAL, ele escapa do contexto de scroll do `#main`, e ao
   receber foco (todo clique no label dá foco) o navegador rola o `.layout` — que tem
   `overflow-y: hidden` com conteúdo maior que ele — empurrando a página para fora SEM barra
   de rolagem. Medido no Chrome: `.layout.scrollTop` ia de 0 a 1696 e o cartão clicado saía
   de `top: 464` para `top: -1232`; o campo de título e os botões do mesmo cartão ficavam em
   0, ou seja era exclusivo deste radio.
   Esta guarda é de TEXTO e sabidamente mais fraca que a medição (não há motor de layout
   nestas suítes) — ela existe para as DUAS declarações não se separarem calada: tirar o
   `position: relative` do fieldset, ou o `top`/`left` do radio, traz o defeito de volta. */
ok('o radio escondido está ancorado no fieldset (senão a tela salta ao trocar a marca)', () => {
  // SEM comentário, e isto não é detalhe: a explicação da armadilha, escrita dentro da
  // própria regra, contém o texto `position: relative` — então com o comentário no meio a
  // prosa SATISFAZ o check e apagar a declaração passava verde. É a armadilha já medida
  // neste projeto ("asserir texto do arquivo reprova a documentação"), de cabeça para baixo.
  const css = require('fs').readFileSync(
    require('path').join(__dirname, 'video-ops.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const regraFieldset = /#view-video-ops \.vop-cardstyle \{([^}]*)\}/.exec(css);
  const regraRadio = /#view-video-ops \.vop-cardstyle input\[type="radio"\] \{([^}]*)\}/.exec(css);
  assert.ok(regraFieldset && regraRadio, 'não achei as regras do seletor no video-ops.css — '
    + 'se as classes mudaram, ajuste esta guarda: conferência que não acha nada é pior que '
    + 'nenhuma, porque passa a impressão de ter conferido');
  const doFieldset = regraFieldset[1];
  const doRadio = regraRadio[1];
  // Só faz sentido cobrar a âncora enquanto o radio for absoluto.
  if (/position:\s*absolute/.test(doRadio)) {
    assert.match(doFieldset, /position:\s*relative/,
      'o radio é absoluto, então o fieldset TEM de ser o bloco containing dele');
    assert.match(doRadio, /\btop:\s*0/, 'sem `top` o radio usa a posição estática do bloco inicial');
    assert.match(doRadio, /\bleft:\s*0/, 'idem para `left`');
  }
  // E continua focável: é o que dá navegação por seta e grupo nomeado de graça. `display:
  // none`/`visibility: hidden` tirariam o radio da ordem de foco e o segmentado perderia o
  // teclado — aí o seletor viraria só dois textos clicáveis.
  assert.ok(!/display:\s*none/.test(doRadio) && !/visibility:\s*hidden/.test(doRadio),
    'esconder o radio de verdade tira o grupo da ordem de foco');
});

/* ------------------------------------------- o que NÃO existe mais neste módulo */
ok('o pipeline de publicação não voltou pela porta dos fundos', () => {
  ['sanitizeState', 'migrateV3', 'resolveVariant', 'approvalIssues', 'toCsv', 'drivePath',
    'publicationPackage', 'buildReport', 'dailyGoal', 'applyResult', 'renderJobFor']
    .forEach(nome => assert.strictEqual(ops[nome], undefined, nome + ' deveria ter saído'));
});

/* ---- enquadramento do 9:16 (Inteiro / 1:1 / 4:5) ---- */

/* Paridade com o `studio/src/preset.js`, lida por REGEX porque este modulo nao tem como
   importar um ES module do studio. E por isso que as tres copias guardam LITERAIS: com uma
   constante interpolada no meio da lista, o leitor extrai o NOME dela e a paridade acusa
   divergencia falsa (foi o que aconteceu com o TITLE_CARD_STYLES). */
ok('o conjunto de enquadramento bate com o preset.js, na mesma ordem', () => {
  const presetSrc = require('fs').readFileSync(
    require('path').join(__dirname, 'studio', 'src', 'preset.js'), 'utf8');
  const lista = (texto, nome, prefixo) => {
    const achado = new RegExp(prefixo + nome + '\\s*=\\s*\\[([^\\]]*)\\]').exec(texto);
    return achado ? achado[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean) : null;
  };
  assert.deepStrictEqual(lista(presetSrc, 'REFRAMES', 'export const '), ops.REFRAMES);
  assert.deepStrictEqual(lista(presetSrc, 'REFRAMES_OFERECIDOS', 'export const '),
    ops.REFRAMES_OFERECIDOS);
  assert.strictEqual(
    /export const REFRAME_PADRAO = '([^']+)'/.exec(presetSrc)[1], ops.REFRAME_PADRAO);
});
/* Duas listas de proposito: o `crop` de quadro cheio amplia 1,78x numa fonte 16:9 e fica
   INTERNO, alcancavel so editando a query -- como sempre foi. */
ok('os enquadramentos oferecidos sao subconjunto, e o crop de quadro cheio fica fora', () => {
  assert.ok(ops.REFRAMES_OFERECIDOS.every((r) => ops.REFRAMES.includes(r)));
  assert.ok(ops.REFRAMES_OFERECIDOS.length < ops.REFRAMES.length);
  assert.ok(!ops.REFRAMES_OFERECIDOS.includes('crop'));
  assert.ok(ops.REFRAMES.every((r) => ops.REFRAME_LABELS[r] && ops.REFRAME_LABELS[r] !== r));
});
ok('reframeOf valida: conhecido passa, o resto cai no padrao', () => {
  assert.strictEqual(ops.reframeOf({ reframe: 'crop45' }), 'crop45');
  assert.strictEqual(ops.reframeOf({ reframe: 'zoom' }), 'blur');
  assert.strictEqual(ops.reframeOf({}), 'blur');
  assert.strictEqual(ops.reframeOf(null), 'blur');
});
/* A porcentagem que o rotulo mostra. Sai da tabela de proporcao, nao de gosto: 43,75% no
   total para o 1:1 (21,875 de cada lado) e 55% para o 4:5 (27,5 de cada lado). */
ok('cropInsetPct devolve a faixa cortada de CADA lado, e zero no Inteiro', () => {
  assert.strictEqual(ops.cropInsetPct('blur'), 0);
  assert.ok(Math.abs(ops.cropInsetPct('crop11') - 21.875) < 0.001);
  assert.ok(Math.abs(ops.cropInsetPct('crop45') - 27.5) < 0.001);
});
/* Espelho do `serve.source_scale`. O 1:1 e NATIVO a partir de um 1080p -- mais que dobra a
   altura do video sem um unico pixel interpolado -- e e isso que o faz o passo do meio. */
ok('sourceScale: de um 1080p o 1:1 e nativo e o 4:5 cobra 1,25x', () => {
  assert.strictEqual(ops.sourceScale('crop11', 1920, 1080), 1);
  assert.ok(Math.abs(ops.sourceScale('crop45', 1920, 1080) - 1.25) < 0.001);
  assert.ok(ops.sourceScale('blur', 1920, 1080) < 1);
});
/* O aviso e informacao, nao bloqueio (BP-008): ele diz que aquele trecho sai mole naquele
   enquadramento, e a escolha continua do operador. */
ok('o aviso de fonte mole dispara acima de 1,30x e cala abaixo', () => {
  assert.ok(ops.sourceWarning('crop45', 1280, 720).length > 0);
  assert.ok(ops.sourceWarning('crop11', 1280, 720).length > 0);
  assert.strictEqual(ops.sourceWarning('blur', 1280, 720), '');
  assert.strictEqual(ops.sourceWarning('crop11', 1920, 1080), '');
  assert.strictEqual(ops.sourceWarning('crop45', 0, 0), '');
});
/* O CORPO do POST, chamado com valor construido. E a licao do `title: ''`: enquanto o corpo
   era montado inline dentro do `fetch`, o card do titulo existia, era testado e NUNCA
   chegava a tela -- a unica prova possivel era regex. O mesmo vale para o enquadramento. */
ok('renderBody leva o enquadramento escolhido, e o padrao quando nao ha escolha', () => {
  const base = { clipToken: 't', topic: 'x', clipCues: [] };
  assert.strictEqual(
    ops.renderBody(Object.assign({}, base, { reframe: 'crop45' }), true).reframe, 'crop45');
  assert.strictEqual(ops.renderBody(base, true).reframe, 'blur');
  assert.strictEqual(
    ops.renderBody(Object.assign({}, base, { reframe: '../x' }), true).reframe, 'blur');
});
/* Os TRES estados do passe de audio tem frase. Um check do test_serve.py LE este arquivo e
   reprova estado do conjunto fechado sem frase aqui -- estado que sai no cabecalho HTTP e
   nao tem o que dizer na tela e o erro mudo que o conjunto existe para impedir. */
ok('cada estado do audio tem uma frase, e desconhecido nao inventa', () => {
  ['normalizado', 'AUDIO_SEM_FAIXA', 'AUDIO_NORM_FAILED'].forEach((estado) => {
    assert.ok(ops.audioMessage(estado).length > 10, estado);
  });
  assert.strictEqual(ops.audioMessage('QUALQUER'), '');
  assert.strictEqual(ops.audioMessage(''), '');
});
/* O fundo do 9:16. Diferente do audio, o caso NORMAL nao tem frase de proposito: o fundo saiu
   como devia e o toast nao precisa de outra linha. Os DOIS casos de letterbox tem, porque dao
   o mesmo pixel e pedem acoes diferentes -- um e normal, o outro e um download a refazer. */
ok('os dois casos de letterbox tem frase distinta, e o normal fica calado', () => {
  const nada = ops.backgroundMessage('miniatura');
  const semThumb = ops.backgroundMessage('BACKGROUND_NONE');
  const quebrada = ops.backgroundMessage('BACKGROUND_UNREADABLE');
  assert.strictEqual(nada, '');
  assert.ok(semThumb.length > 10 && quebrada.length > 10);
  assert.notStrictEqual(semThumb, quebrada);
  /* A frase do ilegivel tem de dizer O QUE FAZER: sem isso ela empata com a do caso normal
     em utilidade, e o operador continua sem saber que basta baixar de novo. */
  assert.ok(/de novo|novamente/.test(quebrada));
  assert.strictEqual(ops.backgroundMessage('QUALQUER'), '');
  assert.strictEqual(ops.backgroundMessage(''), '');
});
/* O CSS do seletor, com a armadilha de 2026-09-02 presa nas DUAS declaracoes. O check
   REMOVE COMENTARIO antes de casar: a prosa que explica a armadilha contem o proprio texto
   `position: relative`, e sem remover o comentario ela satisfaz o check e apagar a
   declaracao passa verde. Guarda declaradamente mais fraca que a medicao (nao ha motor de
   layout aqui) -- ela existe para as duas declaracoes nao se separarem caladas. */
ok('o fieldset do enquadramento e posicionado e o radio ancora nele', () => {
  const css = require('fs').readFileSync(
    require('path').join(__dirname, 'video-ops.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const fieldset = /#view-video-ops \.vop-reframe \{([^}]*)\}/.exec(css);
  const radio = /#view-video-ops \.vop-reframe input\[type="radio"\] \{([^}]*)\}/.exec(css);
  assert.ok(fieldset, 'regra .vop-reframe ausente');
  assert.ok(radio, 'regra do radio ausente');
  assert.match(fieldset[1], /position:\s*relative/);
  assert.match(fieldset[1], /justify-self:\s*start/);
  if (/position:\s*absolute/.test(radio[1])) {
    assert.match(radio[1], /top:\s*0/);
    assert.match(radio[1], /left:\s*0/);
  }
  /* display:none / visibility:hidden tirariam o radio da ordem de foco, e o segmentado
     perderia a navegacao por seta e o grupo nomeado que o browser da de graca. */
  assert.doesNotMatch(radio[1], /display:\s*none/);
  assert.doesNotMatch(radio[1], /visibility:\s*hidden/);
  /* A mascara de recorte NAO pode capturar clique: o player do YouTube esta atras dela. */
  const mask = /#view-video-ops \.vop-cand-mask \{([^}]*)\}/.exec(css);
  assert.ok(mask, 'regra .vop-cand-mask ausente');
  assert.match(mask[1], /pointer-events:\s*none/);
  assert.doesNotMatch(mask[1], /transition/);
});

/* ===== Hub de recomendacoes: bordas, miniatura e ordem ================================ */
function trechoSalvo(extra) {
  return Object.assign({
    id: 'cand_1', topic: 'A licao dos quarenta mil', inSec: 600, outSec: 640,
    durationSec: 40, score: 84, quality: 'forte', boundary: 'palavra', rev: 1,
    clipToken: '', clipFilename: '', clipBytes: 0, clipCues: []
  }, extra || {});
}

/* `ytApplyTrim` mexe em dado PERSISTIDO (o candidato do projeto salvo em
   pp_video_projects_v1), e o ramo que interessa e o do operador que JA tinha baixado o
   trecho: se a midia antiga sobrevivesse a uma borda nova, "Baixar video editado"
   entregaria um arquivo de OUTRO intervalo sob esse rotulo. BP-014 manda exportar e chamar
   com o dado construido, nos DOIS ramos -- com arquivo e sem. */
ok('trim aplica os tempos novos e sobe a revisao, sem trocar a identidade', () => {
  const c = trechoSalvo();
  assert.strictEqual(ops.ytApplyTrim(c, 604, 642, 3600), '');
  assert.strictEqual(c.inSec, 604);
  assert.strictEqual(c.outSec, 642);
  assert.strictEqual(c.durationSec, 38, 'a duracao foi recalculada junto');
  assert.strictEqual(c.rev, 2, 'a revisao do intervalo subiu');
  assert.strictEqual(c.id, 'cand_1', 'a identidade nao muda: projeto salvo continua abrindo');
  assert.strictEqual(c.boundary, 'manual',
    'borda mexida a mao deixa de ser afirmada como medida na palavra');
});
ok('trim DESCARTA a midia do intervalo antigo (o ramo que custa caro)', () => {
  const c = trechoSalvo({
    clipToken: 'tok_um', clipFilename: 'abc-600-640.mp4', clipBytes: 12345,
    clipCues: [{ start: 0, end: 2, text: 'eu perdi quarenta mil' }],
    clipStatus: 'available', clipAvailable: true
  });
  assert.strictEqual(ops.ytApplyTrim(c, 610, 650, 3600), '');
  assert.strictEqual(c.clipToken, '', 'o token do arquivo antigo saiu');
  assert.strictEqual(c.clipFilename, '', 'e o nome do arquivo antigo tambem');
  assert.strictEqual(c.clipBytes, 0);
  assert.strictEqual(c.clipCues.length, 0,
    'e a legenda do clipe, que estava rebaseada no comeco ANTIGO');
  assert.strictEqual(c.clipStatus, 'none');
  assert.strictEqual(c.clipAvailable, false);
  assert.strictEqual(c.rev, 2);
});
ok('trim recusa intervalo impossivel COM a frase do motivo, e nao altera o trecho', () => {
  const c = trechoSalvo();
  assert.ok(ops.ytApplyTrim(c, 700, 600, 3600).length > 0, 'fim antes do comeco');
  assert.strictEqual(c.inSec, 600, 'o trecho recusado ficou intacto');
  assert.ok(ops.ytApplyTrim(c, 600, 601, 3600).length > 0, 'trecho de 1s');
  assert.ok(ops.ytApplyTrim(c, 600, 5000, 3600).length > 0, 'fim depois do fim do video');
  assert.strictEqual(c.outSec, 640, 'nem o fim');
});
ok('trim apara comeco negativo em vez de recusar', () => {
  const c = trechoSalvo();
  assert.strictEqual(ops.ytApplyTrim(c, -30, 640, 3600), '');
  assert.strictEqual(c.inSec, 0);
});
ok('aplicar os MESMOS tempos nao invalida arquivo nenhum', () => {
  const c = trechoSalvo({ clipToken: 'tok_um', clipBytes: 99 });
  assert.strictEqual(ops.ytApplyTrim(c, 600, 640, 3600), '');
  assert.strictEqual(c.clipToken, 'tok_um', 'borda que nao mudou nao descarta midia');
  assert.strictEqual(c.rev, 1, 'nem sobe a revisao');
});

/* O quadro do storyboard cai DENTRO do intervalo, e a conta do recorte fecha. */
ok('sbFrame escolhe folha, linha e coluna do instante dentro do trecho', () => {
  ops.__setStoryboard({
    sheets: ['https://i.ytimg.com/sb/x/M0.jpg', 'https://i.ytimg.com/sb/x/M1.jpg',
             'https://i.ytimg.com/sb/x/M2.jpg'],
    columns: 3, rows: 3, fps: 0.1, width: 320, height: 180
  });
  const q = ops.sbFrame({ inSec: 0, outSec: 100 });
  assert.ok(q, 'com folha valida sai um quadro');
  assert.deepStrictEqual(q.escala, [300, 300], 'a folha ocupa 3x3 o contentor');
  /* t = 0 + 100*0,35 = 35 s -> indice floor(35*0,1) = 3 -> folha 0, linha 1, coluna 0. */
  assert.strictEqual(q.url, 'https://i.ytimg.com/sb/x/M0.jpg');
  /* `Math.abs`: a coluna 0 da -0, e `strictEqual(-0, 0)` reprova (Object.is). No CSS
     nao muda nada -- `(-0).toFixed(4)` sai '0.0000'. */
  assert.ok(Math.abs(q.desloca[0]) < 1e-9, 'coluna 0: sem deslocamento horizontal');
  assert.strictEqual(Math.round(q.desloca[1] * 1000) / 1000, -33.333, 'linha 1');
  ops.__setStoryboard(null);
});
ok('sbFrame nunca sai da lista de folhas e nunca repete o mesmo quadro para trechos distantes', () => {
  ops.__setStoryboard({
    sheets: ['https://i.ytimg.com/sb/x/M0.jpg', 'https://i.ytimg.com/sb/x/M1.jpg',
             'https://i.ytimg.com/sb/x/M2.jpg'],
    columns: 3, rows: 3, fps: 0.1
  });
  assert.strictEqual(ops.sbFrame({ inSec: 9000, outSec: 9100 }).url,
    'https://i.ytimg.com/sb/x/M2.jpg', 'instante alem da ultima folha para na ultima');
  const a = ops.sbFrame({ inSec: 0, outSec: 60 });
  const b = ops.sbFrame({ inSec: 600, outSec: 660 });
  assert.ok(a.url !== b.url || a.desloca[0] !== b.desloca[0] || a.desloca[1] !== b.desloca[1],
    'trechos em pontos diferentes do video nao mostram o MESMO quadro');
  ops.__setStoryboard(null);
  assert.strictEqual(ops.sbFrame({ inSec: 0, outSec: 60 }), null,
    'sem folha nao ha quadro, e o card cai na capa rotulada');
});
ok('o validador da folha recusa grade impossivel e URL que nao e https', () => {
  assert.strictEqual(ops.ytStoryboardFrom(null), null);
  assert.strictEqual(ops.ytStoryboardFrom(
    { storyboard: { sheets: [], columns: 3, rows: 3, fps: 0.1 } }), null, 'sem imagem');
  assert.strictEqual(ops.ytStoryboardFrom(
    { storyboard: { sheets: ['https://a/1.jpg'], columns: 0, rows: 3, fps: 0.1 } }), null,
    'zero coluna devolve null em vez de dividir por zero no sbFrame');
  assert.strictEqual(ops.ytStoryboardFrom(
    { storyboard: { sheets: ['https://a/1.jpg'], columns: 3, rows: 3, fps: 0 } }), null,
    'fps zero devolve null');
  const limpo = ops.ytStoryboardFrom({ storyboard: {
    sheets: ['https://a/1.jpg', 'javascript:alert(1)', 'http://a/2.jpg'],
    columns: 3, rows: 3, fps: 0.1 } });
  assert.strictEqual(limpo.sheets.length, 1, 'so https sobrevive');
  assert.strictEqual(limpo.sheets[0], 'https://a/1.jpg');
});

/* A ordem da grade e estavel e reproduzivel -- e o que permite comparar duas analises. */
ok('a ordem da grade e estavel nas duas opcoes', () => {
  ops.__setCandidates([
    { id: 'c1', inSec: 900, outSec: 940, score: 70 },
    { id: 'c2', inSec: 100, outSec: 140, score: 84 },
    { id: 'c3', inSec: 500, outSec: 540, score: 70 }
  ]);
  ops.__setSort('quality');
  const ids = () => ops.ytSorted().map((c) => c.id).join(',');
  assert.strictEqual(ids(), 'c2,c3,c1', 'melhor primeiro; empate desempata pelo instante');
  assert.strictEqual(ids(), ids(), 'chamar duas vezes da a mesma ordem');
  ops.__setSort('time');
  assert.strictEqual(ids(), 'c2,c3,c1', 'ordem do video ordena pelo instante');
  ops.__setSort('quality');
  ops.__setCandidates([]);
});

/* Estado do arquivo local: cada caso com a SUA frase. Botao morto e mudo e bug (BP-008). */
ok('clipStatusOf explica cada estado do arquivo, inclusive quando nao deixa baixar', () => {
  const liberado = { allowed: true, reason: '' };
  const travado = { allowed: false, reason: 'voce ainda nao declarou ter autorizacao' };
  assert.strictEqual(ops.clipStatusOf({ id: 'x' }, travado).podeBaixar, false);
  assert.ok(ops.clipStatusOf({ id: 'x' }, travado).motivo.length > 0, 'com o motivo escrito');
  assert.strictEqual(ops.clipStatusOf({ id: 'x' }, liberado).podeBaixar, true);
  assert.strictEqual(ops.clipStatusOf({ id: 'x' }, liberado).pronto, false,
    'trecho sem arquivo nao esta pronto para editar');
  assert.strictEqual(
    ops.clipStatusOf({ id: 'x', clipToken: 'tok', clipBytes: 10 }, liberado).pronto, true);
  assert.ok(ops.clipStatusOf({ id: 'x', clipStatus: 'missing' }, liberado).nota.length > 0,
    'arquivo que saiu do disco DIZ isso, em vez de sumir calado');
  const off = ops.clipStatusOf({ id: 'x', clipStatus: 'helper_offline' }, liberado);
  assert.ok(off.nota.indexOf('estudio.ps1') > 0, 'renderizador desligado diz o que rodar');
  assert.strictEqual(off.podeBaixar, false, 'e nao oferece download que nao vai funcionar');
});

console.log(provas + ' provas OK — lógica pura do Estúdio de Vídeos');
