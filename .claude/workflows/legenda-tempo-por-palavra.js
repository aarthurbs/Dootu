/* Workflow nomeado: `Workflow({ name: "legenda-tempo-por-palavra" })`
 *
 * Escrito em 2026-08-28 com o contexto inteiro na mao, para ser DISPARADO numa sessao NOVA e
 * limpa. Tudo o que ele precisa saber esta nos prompts: nao depende de conversa anterior.
 *
 * Segue as sete regras de `.claude/skills/workflow-sobrevivente/SKILL.md`:
 *  - cada fase termina commitada e no GitHub (o proprio agente escritor commita o que tocou);
 *  - morte por LIMITE DE GASTO para o workflow em vez de jogar mais agentes na parede;
 *  - um escritor por arquivo; verificador e somente-leitura, com o motivo escrito;
 *  - nada de isolation:'worktree' (o commit tem de cair na arvore de verdade);
 *  - fase barata primeiro, fase cara no fim;
 *  - o retorno diz o que NAO rodou, com o caminho de retomada;
 *  - poucos agentes de proposito: 4 no caminho padrao. A conta que dispara isto tem limite
 *    apertado, e menos agentes e a unica defesa real contra o corte no meio.
 *
 * TRADE-OFF assumido: o agente escritor commita o proprio trabalho, em vez de haver um agente
 * de git por fase. Sao 3 agentes a menos (3 chances a menos de bater no limite) ao preco de:
 * se o escritor morrer NO MEIO da fase, aquela fase nao commita. As fases sao pequenas, entao
 * a perda maxima e uma fase, nunca o workflow.
 */

export const meta = {
  name: 'legenda-tempo-por-palavra',
  description: 'Legenda do 9:16 deixa de truncar janela rolante e passa a usar o tempo por PALAVRA do json3',
  whenToUse: 'Quando o credito voltar e o assunto for a legenda nao acompanhar o que e falado no video',
  phases: [
    { title: 'Amostra', detail: 'json3 real -> fixture SINTETICO (sem conteudo de terceiro)' },
    { title: 'Palavras', detail: 'parse por palavra + agrupamento honesto em linhas' },
    { title: 'Provas', detail: 'suites + revisao adversarial, somente leitura' },
    { title: 'Registro', detail: 'CLAUDE.md + commit final' },
  ],
}

const COMUM = `
REPO: C:/Users/Teste/Downloads/seller-arthur-2
Windows: Python e \`py -3.12\`, JS e \`node\`. As provas do projeto rodam num comando: \`.\\provas.ps1\`
(8 suites; ele soma as contagens e CONFERE a linha "Checks:" do CLAUDE.md, falhando se divergir).

O PROBLEMA, medido em 2026-08-27/28 na legenda real de um podcast de 53 min (video wc3V6vb9Yoc,
1703 falas). Nao remeca: os numeros sao estes.
  - 100% das falas se sobrepoem a seguinte (legenda automatica ROLANTE do YouTube);
  - ZERO empatam o inicio;
  - mediana da FONTE: 3,68 s / 37 caracteres = 9,5 char/s (confortavel);
  - as falas comecam a cada ~1,86 s (1703 falas em 3170 s).
O \`captions.normalize_cues\` fecha cada fala exatamente onde a proxima comeca, entao o texto de
37 caracteres, que foi FALADO em 3,68 s, aparece em ~1,86 s -> ~20 char/s. Leitura confortavel
e ~15 char/s. O espectador nao termina de ler a frase: e o defeito relatado como "a legenda nao
completa os assuntos".
NAO ha silencio para emprestar tempo: com 100% de sobreposicao os intervalos entre falas sao
zero POR CONSTRUCAO. Isso ja foi tentado e descartado como placebo -- esta no CLAUDE.md.

A RAIZ: \`ytclip.parse_json3\` (video-worker/ytclip.py, por volta da linha 151) faz
    segs = event.get("segs") or []
    text = "".join(str(s.get("utf8") or "") for s in segs)
ou seja concatena os \`segs\` num texto so e DESCARTA o \`tOffsetMs\` de cada palavra, que o json3
da legenda automatica traz. Com esse tempo da para montar falas honestas -- sem sobreposicao,
sem repeticao e com duracao de verdade -- em vez de truncar janela rolante.

REGRAS DO PROJETO que valem aqui:
- Mudanca CIRURGICA. Nao refatore vizinho que funciona.
- Zero dependencia nova. Python e stdlib; o site e Vanilla JS sem npm.
- Comentario em portugues, no tom dos arquivos: explicam POR QUE, com o numero medido.
- Nao apague comentario que registra armadilha medida; se ficou falso, REESCREVA dizendo o que
  mudou.
- Teste tem de exercitar a FUNCAO com valor construido. \`"x" in arquivo\` nao prova fiacao nem
  polaridade -- este projeto ja perdeu uma feature inteira com a suite verde por isso.
`

const SO_LEITURA = `
VOCE E SOMENTE-LEITURA. Nunca edite, nunca reverta, nunca "sabote para medir se o teste pega".
Um agente revisor deste projeto ja inverteu uma guarda no disco para medir um teste enquanto
outro agente lia o mesmo arquivo, e o achado saiu reportado como defeito CONFIRMADO com prova
de execucao. Se quiser argumentar que um check nao pega uma regressao, DESCREVA a sabotagem no
relatorio; nao a execute.
`

const FEITO = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    arquivos: { type: 'array', items: { type: 'string' } },
    resumo: { type: 'string' },
    commit: { type: 'string' },
    pendencias: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'resumo'],
}

const VEREDITO = {
  type: 'object',
  properties: {
    passou: { type: 'boolean' },
    falhas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { onde: { type: 'string' }, o_que: { type: 'string' }, prova: { type: 'string' } },
        required: ['onde', 'o_que', 'prova'],
      },
    },
    resumo: { type: 'string' },
  },
  required: ['passou', 'falhas', 'resumo'],
}

/* Limite de gasto nao e falha de um agente: e o fim do orcamento. Continuar so joga mais
   agentes na parede -- foi exatamente o que aconteceu em 2026-08-27, quando 4 agentes morreram
   atras do primeiro pela MESMA razao. */
function morreuPorLimite(err) {
  return /spend limit|usage limit|rate limit|quota|credit/i.test(String((err && err.message) || err || ''))
}

const faltando = []
const feito = []

async function fase(titulo, rotulo, prompt, schema) {
  try {
    const r = await agent(prompt, { label: rotulo, phase: titulo, schema: schema || FEITO })
    if (r) feito.push(titulo + ': ' + (r.resumo || 'sem resumo'))
    else faltando.push(titulo + ' (agente nao retornou)')
    return r
  } catch (err) {
    faltando.push(titulo + ': ' + String((err && err.message) || err))
    if (morreuPorLimite(err)) {
      log('LIMITE DE GASTO atingido em "' + titulo + '". Parando de proposito: mais agentes so morreriam igual.')
      throw Object.assign(new Error('limite'), { limite: true })
    }
    return null
  }
}

try {

  /* ------------------------------------------------------------------ 1. Amostra (barata) */
  phase('Amostra')
  const amostra = await fase('Amostra', 'amostra:json3', `${COMUM}
TAREFA - produzir a amostra que a Fase 2 vai usar como fixture. E a fase mais barata e e o
PORTAO: sem ela a Fase 2 nao tem como ser construida honestamente.

1) Rode \`ytclip.probe()\` num video com legenda automatica em pt e capture o json3 CRU. O
   caminho mais curto: \`sys.path.insert(0, "video-worker")\`, \`import ytclip\`, e leia como
   \`fetch_cues\`/\`pick_caption_track\` chegam na URL da faixa json3 -- voce precisa do JSON ANTES
   do \`parse_json3\`, com os \`segs\` e os \`tOffsetMs\` intactos.
   Video conhecido com legenda automatica pt: id \`wc3V6vb9Yoc\` (reconstrua a URL do id
   validado, nunca cole string). Se ele nao servir, qualquer podcast pt-BR com legenda
   automatica serve.
   ATENCAO: o YouTube LIMITA chamadas repetidas -- em 2026-08-28 a segunda leitura seguida
   voltou vazia. Faca UMA leitura e GRAVE o cru em disco antes de qualquer analise.

2) NAO versione a transcricao. As suites deste projeto declaram "nenhum conteudo de terceiro",
   e um podcast inteiro em texto e obra alheia. Grave em
   \`video-worker/fixtures/json3-rolante.json\` uma amostra SINTETICA: mantenha a ESTRUTURA e os
   TEMPOS reais (\`tStartMs\`, \`dDurationMs\`, \`segs\` com \`tOffsetMs\`) dos primeiros ~60 eventos e
   SUBSTITUA cada palavra por palavra inventada de tamanho parecido. Escreva no proprio arquivo
   (ou num README ao lado) que os tempos sao reais, o texto e sintetico, e por que.

3) Meca e relate, do CRU (nao da amostra): quantos eventos; quantos tem \`segs\` com
   \`tOffsetMs\`; palavras por evento (mediana); se eventos consecutivos REPETEM palavras (a
   rolagem pode estar duplicando texto -- isto ainda nao foi medido e importa); e a distancia
   mediana entre o fim da ultima palavra de um evento e o inicio da primeira do seguinte (esse
   e o silencio REAL, que a janela rolante escondia).

4) Commit e push SO destes arquivos (nunca \`git add -A\`), na branch atual, com o trailer
   \`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>\` na ultima linha.

Se o probe nao trouxer legenda (limite do YouTube, video sem legenda automatica), NAO invente
fixture: devolva \`ok: false\` com o motivo. Fase 2 sem amostra real seria chute.`)

  if (!amostra || amostra.ok === false) {
    log('Sem amostra json3 nao ha como construir a Fase 2 sem chutar. Parando.')
    faltando.push('Palavras, Provas e Registro (dependem da amostra)')
  } else {

    /* -------------------------------------------------------------- 2. Palavras (media) */
    phase('Palavras')
    const impl = await fase('Palavras', 'impl:palavras', `${COMUM}
TAREFA - Fase 2: usar o tempo por PALAVRA para a legenda parar de truncar janela rolante.
A amostra esta em \`video-worker/fixtures/json3-rolante.json\` (tempos reais, texto sintetico).
Relato da Fase 1: ${amostra.resumo}

RESTRICAO INVIOLAVEL - nao mude a saida do \`parse_json3\`:
o \`ytclip.candidates()\` usa o INTERVALO ENTRE FALAS para achar pausa e decidir onde o corte
fecha. Isso esta no CLAUDE.md como razao explicita de \`parse_json3\` nao ter sido tocado antes.
Mexer nele muda a RECOMENDACAO de cortes, que nao e o que este trabalho pede. Portanto:
\`parse_json3\` continua devolvendo o que devolve hoje, e o tempo por palavra entra por uma
funcao NOVA ao lado (ex.: \`parse_json3_words(raw)\`), pura e testada.

Faca:
1) \`ytclip.parse_json3_words(raw)\` -> lista de \`{start, end, text}\` por PALAVRA, com
   \`start = tStartMs/1000 + tOffsetMs/1000\`. Palavra sem \`tOffsetMs\` herda o inicio do evento.
   Evento sem \`segs\` utilizavel e ignorado (nao inventa tempo).
2) Uma funcao PURA que agrupa palavras em linhas de exibicao com duracao HONESTA: a linha
   comeca na primeira palavra e termina na ultima, entao NAO ha sobreposicao por construcao e o
   \`normalize_cues\` nao tem nada para truncar. Corte de linha por (a) teto de caracteres
   (reuse \`captions.MAX_CHARS_LINHA\`/\`MAX_LINHAS\`, nao invente numero), (b) pausa entre
   palavras acima de um limiar, (c) fim de frase quando houver pontuacao. O limiar de pausa e o
   BOTAO DE CALIBRAGEM -- constante nomeada, com o numero medido no comentario.
3) Ligue no caminho de EXIBICAO sem tocar no de recomendacao: quem consome legenda de CLIPE e o
   \`ytclip.cues_for_range\` (fronteira unica: alimenta o ASS do FFmpeg E as Sequence do
   Remotion). Prefira palavra quando existir; caia na cue grossa quando nao existir.
4) COMPATIBILIDADE: sidecar v1/v2/v3 ja gravado guarda cue GROSSA, sem palavra. Tem de
   continuar funcionando -- ninguem rebaixa video para migrar formato. Se for preciso gravar
   palavra no sidecar, suba a versao e leia as antigas do mesmo jeito.
5) Meca o efeito e ESCREVA o numero: char/s mediano das paginas antes e depois, sobre a
   amostra. Antes: ~20 char/s. Se depois nao melhorar, diga isso -- resultado ruim medido vale
   mais que suposicao boa.
6) Testes em \`video-worker/test_ytclip.py\` (e \`test_captions.py\` se a paginacao mudar),
   exercitando as funcoes com a amostra e com valor construido. Inclua palavra sem
   \`tOffsetMs\`, evento vazio, e json3 de legenda MANUAL (que vem em frase, sem palavra).
7) Rode \`.\\provas.ps1\`. Ele vai reprovar na conferencia do CLAUDE.md quando o total mudar --
   isso e esperado, e quem atualiza a linha e a Fase 4. Relate o total novo.
8) Commit e push so dos arquivos que voce tocou, com o trailer padrao.

Se algum check existente reprovar por codificar o comportamento ANTIGO, reescreva-o para
guardar a regra NOVA, com o motivo no comentario -- nunca para calar.`)

    /* -------------------------------------------------------------- 3. Provas (paralelo) */
    phase('Provas')
    let vereditos = []
    try {
      vereditos = await parallel([
        () => agent(`${COMUM}${SO_LEITURA}
Rode \`.\\provas.ps1\` e relate a contagem de cada suite e o total. \`passou\` e true so se as 8
passarem (a conferencia do CLAUDE.md pode reprovar por total desatualizado -- isso NAO conta
como falha, e trabalho da Fase 4; diga que foi esse o motivo).
Depois: algum check foi AFROUXADO em vez de reescrito (virou \`ok(true)\`, perdeu o lado direito
da comparacao, foi comentado)? Compare com \`git diff\` os checks tocados. Afrouxar conta como
FALHA mesmo com a suite verde.`, { label: 'provas', phase: 'Provas', schema: VEREDITO }),
        () => agent(`${COMUM}${SO_LEITURA}
Revisao adversarial do \`git diff\` desta arvore. Cace, por gravidade:
1. A RECOMENDACAO de cortes mudou: prove que \`ytclip.candidates()\` recebe as MESMAS cues de
   antes. Se \`parse_json3\` foi alterado, e defeito bloqueante -- a restricao era inviolavel.
2. Tempo por palavra errado: \`tOffsetMs\` e relativo ao \`tStartMs\` do evento. Somar errado
   desloca a legenda inteira e nenhuma contagem de teste denuncia. Calcule voce mesmo com
   \`py -3.12\` a partir da amostra e compare.
3. Texto PERDIDO: conte palavras na amostra e nas linhas agrupadas. Perder palavra e o defeito
   que este projeto acabou de consertar em outro lugar (22 palavras viravam 14).
4. Texto DUPLICADO: a janela rolante repete palavras entre eventos; se o agrupamento nao
   deduplicar, a legenda diz a mesma coisa duas vezes.
5. Sidecar antigo quebrado: cue grossa, sem palavra, tem de continuar rendendo legenda.
6. Teste que prova TEXTO em vez de fiacao. Diga qual sabotagem passaria por ele (descreva, NAO
   execute).
7. Comentario que ficou mentindo.
\`passou\` false para qualquer item de 1 a 5. \`prova\` = comando que voce RODOU + a saida dele,
nunca raciocinio.`, { label: 'revisao', phase: 'Provas', schema: VEREDITO }),
      ])
    } catch (err) {
      faltando.push('Provas: ' + String((err && err.message) || err))
      if (morreuPorLimite(err)) throw Object.assign(new Error('limite'), { limite: true })
    }

    const reprovou = vereditos.filter(Boolean).filter((v) => !v.passou)
    if (reprovou.length) {
      await fase('Conserto', 'conserto', `${COMUM}
CONSERTO. Duas lentes independentes revisaram a arvore e reprovaram. Relatos:

${reprovou.map((v) => v.resumo + '\n' + (v.falhas || []).map((f) => `- [${f.onde}] ${f.o_que}\n  prova: ${f.prova}`).join('\n')).join('\n\n')}

Antes de editar: RECONFIRA cada achado contra o artefato em disco. Achado adversarial que
afirma ter medido ainda pode estar errado -- este projeto ja teve um relato de defeito
"confirmado, com prova empirica" que era sabotagem de outro agente na mesma arvore. Se um
achado nao se sustentar, diga isso em \`pendencias\` e NAO mude o codigo por causa dele.
Conserte a CAUSA, nao o sintoma, e nao afrouxe teste para ficar verde. Depois rode
\`.\\provas.ps1\`, commit e push.`)
    }

    /* -------------------------------------------------------------- 4. Registro */
    phase('Registro')
    await fase('Registro', 'registro', `${COMUM}
TAREFA - registrar e fechar. O proximo agente le SO o CLAUDE.md; o que nao entrar la e
redescoberto em horas.

Estado: ${impl ? impl.resumo : 'a Fase 2 nao concluiu'}

1) No CLAUDE.md, na secao do Estudio de Videos, existe um bullet de 2026-08-28 dizendo que "a
   legibilidade (A) foi medida e NAO foi consertada" e que "a raiz e o parse_json3 descartar o
   tempo por palavra -- e o proximo passo desta area". Esse bullet e sobre ESTE trabalho:
   ATUALIZE-O em vez de criar um quarto bullet sobre legenda. Diga o que passou a ser feito, o
   char/s medido antes e depois, e o limiar de pausa como botao de calibragem.
2) Registre a restricao respeitada: \`parse_json3\` intocado para nao mudar a recomendacao de
   cortes, com o tempo por palavra entrando por funcao nova ao lado.
3) O Whisper local continua ABERTO e nao rodou aqui. Escreva isso com o numero que ja existe: o
   Remotion custa ~11 s de render por 1 s de clipe, entao transcrever 90 s de audio (estimados
   12-25 s) seria ruido ao lado disso. Nunca deixe parecer decidido.
4) Rode \`.\\provas.ps1\`: ele imprime a linha "Checks:" pronta com o total medido. Cole essa
   linha no lugar da antiga. Ele tem de sair com \`exit 0\`.
5) Commit e push so do CLAUDE.md (e de README que voce tenha corrigido), com o trailer padrao.
6) Rode \`git log --oneline origin/main..HEAD\` e relate os commits que a branch tem a mais.`)
  }

} catch (err) {
  if (!(err && err.limite)) throw err
  log('Workflow encerrado pelo limite de gasto. O que ja foi commitado esta no GitHub.')
}

return {
  feito,
  faltando,
  /* Retomada e SO da mesma sessao, e nao e automatica: nada reinicia quando o credito volta.
     E se alguem mexer no repo depois da morte, NAO retomar -- os agentes em cache trabalham
     contra o estado antigo. Ver .claude/skills/workflow-sobrevivente/SKILL.md. */
  retomar: 'Workflow({ name: "legenda-tempo-por-palavra" }) numa sessao nova, ou '
    + 'Workflow({ scriptPath, resumeFromRunId }) com os valores que a chamada devolveu, '
    + 'se ainda for a MESMA sessao e ninguem tiver mexido no repo.',
}
