// Teste focado da camada de recomendacao "Mais reproduzidos". Rode: node test-video-ops-rec.js
//
// Recomendacao e MEDICAO (audiencia do YouTube); corte e DECISAO (do usuario). Este arquivo
// prova que as duas coisas nao se misturam e que nada aqui inventa ranking novo.
const assert = require('assert');
const V = require('./video-ops.js');

function payload(peaks, extra) {
  return Object.assign({
    videoId: 'abc123', sourceUrl: 'https://www.youtube.com/watch?v=abc123', duration: 1800,
    mostReplayed: { available: true, source: 'youtube_heatmap', reason: '', peaks: peaks }
  }, extra || {});
}
const TRES = [
  { start: 120, end: 165, peakTime: 140, peakValue: 1.0, averageValue: 0.94, rank: 1 },
  { start: 310, end: 355, peakTime: 330, peakValue: 0.74, averageValue: 0.7, rank: 2 },
  { start: 900, end: 930, peakTime: 910, peakValue: 0.52, averageValue: 0.5, rank: 3 }
];

// 1. video COM "Mais reproduzidos"
const comDados = V.mrRecsFrom(payload(TRES), 1800);
assert.strictEqual(comDados.available, true, 'video com picos fica disponivel');
assert.strictEqual(comDados.peaks.length, 3, 'os tres picos chegaram');

// 2. video SEM "Mais reproduzidos" (o caso normal de video pouco visto)
const semDados = V.mrRecsFrom({
  duration: 1800,
  mostReplayed: { available: false, source: 'youtube_heatmap', peaks: [], reason: 'MOST_REPLAYED_NOT_AVAILABLE' }
}, 1800);
assert.strictEqual(semDados.available, false, 'sem grafico nao ha recomendacao');
assert.deepStrictEqual(semDados.peaks, [], 'e a lista sai vazia, nao inventada');
assert.strictEqual(semDados.reason, 'MOST_REPLAYED_NOT_AVAILABLE', 'o motivo continua legivel');

// 3. varios picos: o ranking EXISTENTE e preservado, ninguem cria um segundo
assert.deepStrictEqual(comDados.peaks.map((p) => p.rank), [1, 2, 3], 'ordem 1,2,3 preservada');
assert.strictEqual(comDados.peaks[0].score, 1.0, '#1 e o mais reproduzido');
assert.ok(comDados.peaks[0].score > comDados.peaks[1].score, 'e a nota cai do #1 para o #2');

// 4. rotulo simples em vez de numero cru na tela
assert.strictEqual(V.mrIntensityLabel(1.0), 'Interesse muito alto', 'pico forte -> muito alto');
assert.strictEqual(V.mrIntensityLabel(0.74), 'Interesse alto', 'pico medio -> alto');
assert.strictEqual(V.mrIntensityLabel(0.2), 'Interesse moderado', 'pico fraco -> moderado');
assert.strictEqual(V.mrIntensityLabel(undefined), 'Interesse moderado', 'sem nota nao quebra');

// 5. pico fora do video carregado denuncia sidecar de OUTRO arquivo -> descartado
const fora = V.mrRecsFrom(payload([
  { start: 10, end: 40, peakValue: 0.9, rank: 1 },
  { start: 5000, end: 5100, peakValue: 1.0, rank: 2 }
]), 1800);
assert.strictEqual(fora.peaks.length, 1, 'pico depois do fim do video nao vira faixa');
assert.strictEqual(fora.peaks[0].start, 10, 'o que sobra e o que cabe no video');

// 6. sidecar malformado / ausente NAO pode explodir a tela
[null, undefined, {}, { mostReplayed: null }, { mostReplayed: 'nao-e-objeto' },
 { mostReplayed: { available: true, peaks: 'nao-e-lista' } },
 { mostReplayed: { available: true, peaks: [{ start: 90, end: 10, peakValue: 1, rank: 1 }] } },
 { mostReplayed: { available: true, peaks: [{ start: 'x', end: 'y', peakValue: 'z', rank: 1 }] } }
].forEach((ruim, i) => {
  const saida = V.mrRecsFrom(ruim, 1800);
  assert.strictEqual(saida.available, false, 'entrada ruim #' + i + ' nao vira recomendacao');
  assert.deepStrictEqual(saida.peaks, [], 'entrada ruim #' + i + ' nao produz faixa');
});
// duracao desconhecida ainda permite recomendar (a faixa e que depende dela)
assert.strictEqual(V.mrRecsFrom(payload(TRES), 0).peaks.length, 3, 'sem duracao ainda ha lista');

// 7. a recomendacao NAO e um corte: o formato e outro, de proposito
const rec = comDados.peaks[0];
assert.deepStrictEqual(Object.keys(rec).sort(), ['end', 'intensity', 'rank', 'score', 'start'],
  'recomendacao nao tem name/priority/id -- nao e corte e nao pode ser confundida com um');


// --- 8. o que aparece na tela, por estado (sem DOM: os construtores sao puros) -------
const faixas = V.mrBandsHTML(comDados.peaks, 1800);
assert.ok(faixas.includes('class="vop-mark-rec"'), 'a faixa recomendada e desenhada na trilha');
assert.strictEqual((faixas.match(/vop-mark-rec/g) || []).length, 3, 'uma faixa por pico');
assert.ok(/left:6\.667%/.test(faixas), '120s de 1800s cai em 6,667% da trilha');
assert.ok(/width:2\.500%/.test(faixas), 'e 45s de duracao ocupam 2,5%');
assert.ok(!faixas.includes('data-act'), 'a faixa nao tem acao: e leitura, nao controle');
assert.strictEqual(V.mrBandsHTML(comDados.peaks, 0), '', 'sem duracao conhecida nao desenha faixa');
assert.strictEqual(V.mrBandsHTML([], 1800), '', 'sem pico nao desenha nada');

const lista = V.mrListHTML('ready', comDados.peaks);
assert.ok(lista.includes('Trechos recomendados'), 'a lista tem titulo legivel');
assert.ok(lista.includes('#1'), 'o mais forte e marcado como #1');
assert.ok(lista.includes('2:00') && lista.includes('2:45'), 'com o intervalo em relogio');
assert.ok(lista.includes('Interesse muito alto') && lista.includes('Interesse alto'),
  'intensidade em palavra, nao em numero cru');
assert.ok(!/peakValue|averageValue|youtube_heatmap|0\.74/.test(lista),
  'nenhum valor interno vaza para a tela');
assert.ok(lista.includes('data-act="rec-play"') && lista.includes('data-act="rec-use"'),
  'as duas acoes existem: ver e usar');
assert.ok(!/data-cut-field|data-intake-cut-add/.test(lista),
  'a lista de recomendacao NAO oferece criar corte por si');

// estados sem dado: aviso curto e neutro, nunca erro que trave o passo
['none', 'idle', 'ready'].forEach((estado) => {
  const vazio = V.mrListHTML(estado, []);
  assert.ok(vazio.includes('data-intake-rec-note'), estado + ': sai um aviso curto');
  assert.ok(!/erro|falhou|problema/i.test(vazio), estado + ': o aviso nao fala de erro');
  assert.ok(!vazio.includes('vop-rec-row'), estado + ': e nenhuma linha de recomendacao');
});
assert.ok(V.mrListHTML('loading', []).includes('Procurando'), 'enquanto busca, diz que busca');
assert.ok(V.mrListHTML('mismatch', []).includes('outro'), 'sidecar de outro video e dito claramente');

// --- 9. "Usar como corte" preenche a selecao e SO ela --------------------------------
const selecao = V.mrSelectionFrom(comDados.peaks[0]);
assert.deepStrictEqual(Object.keys(selecao).sort(), ['inSec', 'outSec'],
  'a recomendacao aplicada produz APENAS inicio e fim -- nada de id, nome ou prioridade');
assert.strictEqual(selecao.inSec, 120, 'inicio vem do pico');
assert.strictEqual(selecao.outSec, 165, 'fim vem do pico');
assert.deepStrictEqual(V.mrSelectionFrom(null), { inSec: 0, outSec: 0 }, 'sem pico nao quebra');

// --- 10. legenda: o que a tela diz sobre ela ----------------------------------------
// Legenda e do VIDEO, nao do pico. Vem como RESUMO (contagem), nunca como transcricao.
const comLegenda = V.mrCaptionsFrom(payload(TRES, {
  captions: { available: true, language: 'pt-BR', kind: 'manual', reason: '', count: 812 }
}));
assert.strictEqual(comLegenda.available, true, 'video com legenda fica disponivel');
assert.strictEqual(comLegenda.count, 812, 'a contagem de falas chega');
assert.deepStrictEqual(Object.keys(comLegenda).sort(),
  ['available', 'count', 'kind', 'language', 'reason'],
  'o resumo NAO carrega as falas — so o que a tela precisa');

// available=true com zero falas e mentira: a contagem manda.
assert.strictEqual(V.mrCaptionsFrom(payload(TRES, {
  captions: { available: true, language: 'pt', kind: 'manual', count: 0 }
})).available, false, 'legenda "disponivel" com zero falas nao conta como disponivel');

assert.strictEqual(V.mrCaptionsFrom(payload(TRES)), null,
  'resposta sem bloco de legenda (sidecar antigo) nao inventa um');
assert.strictEqual(V.mrCaptionsFrom(null), null, 'e resposta nenhuma tambem nao');

// Cada estado tem uma frase propria — nenhum sai calado (BP-008).
assert.ok(/Legenda disponível \(pt-BR\)/.test(V.mrCaptionsLabel(comLegenda)),
  'legenda manual: diz o idioma');
assert.ok(/automática/.test(V.mrCaptionsLabel({ available: true, language: 'pt',
  kind: 'automatica', count: 5 })), 'legenda automatica e identificada como automatica');
assert.ok(/não pôde ser extraída/.test(V.mrCaptionsLabel({ available: false,
  reason: 'CAPTIONS_EXTRACTION_FAILED' })), 'falha de extracao e dita como falha');
assert.ok(/não deu legenda em português/.test(V.mrCaptionsLabel({ available: false,
  reason: 'CAPTIONS_NOT_AVAILABLE' })), 'ausencia e dita como ausencia');
assert.strictEqual(V.mrCaptionsLabel(null), '', 'sem bloco, sem frase inventada');

// O aviso aparece na lista — inclusive quando NAO ha recomendacao nenhuma, porque o
// operador ainda vai marcar o corte na mao e precisa saber se ele sai legendado.
const listaComLegenda = V.mrListHTML('ready', comDados.peaks, comLegenda);
assert.ok(listaComLegenda.includes('data-intake-cap-note'), 'a lista mostra o aviso de legenda');
assert.ok(listaComLegenda.includes('vop-rec-row'), 'e as recomendacoes continuam la');
const semRec = V.mrListHTML('none', [], comLegenda);
assert.ok(semRec.includes('data-intake-cap-note'),
  'sem "Mais reproduzidos" o aviso de legenda aparece do mesmo jeito');
assert.ok(!V.mrListHTML('ready', comDados.peaks, null).includes('data-intake-cap-note'),
  'sem bloco de legenda a lista nao ganha aviso nenhum');
// A legenda nao pode virar botao de criar corte: continua sendo recomendacao/aviso.
assert.ok(!/data-cut-field|data-intake-cut-add/.test(listaComLegenda),
  'o aviso de legenda nao cria corte nem edita nada');

// --- 11. desfecho do 9:16: os estados do cabecalho X-Clip-Captions -------------------
assert.ok(/entrou no vídeo/.test(V.captionsMessage('burned')), 'legenda queimada e confirmada');
assert.ok(/Arial/.test(V.captionsMessage('burned-sem-inter')),
  'fonte trocada pelo libass e DITA (senao "Inter Bold" seria mentira)');
assert.ok(/nenhuma fala.*dentro deste trecho/.test(
  V.captionsMessage('CAPTIONS_OUT_OF_RANGE')),
  'trecho sem fala explica o porque, em vez de so nao legendar');
assert.ok(/não deu legenda em português/.test(V.captionsMessage('CAPTIONS_NOT_AVAILABLE')),
  'video sem legenda explica o porque');
assert.ok(/extração da legenda falhou/.test(V.captionsMessage('CAPTIONS_EXTRACTION_FAILED')),
  'falha de extracao e distinta de ausencia');
assert.strictEqual(V.captionsMessage(''), '',
  'sem cabeçalho (perfil horizontal) nao ha o que dizer sobre legenda');
assert.strictEqual(V.captionsMessage('coisa-nova'), '', 'estado desconhecido nao inventa frase');

console.log('ok - test-video-ops-rec: recomendacao, ranking preservado, legenda e lixo tratados');
