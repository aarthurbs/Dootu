# Plano pronto: legenda por tempo de PALAVRA

Escrito em 2026-08-28 para ser **disparado numa sessão nova**, quando o crédito voltar. O
trabalho todo está em `.claude/workflows/legenda-tempo-por-palavra.js`, que é auto-contido:
não depende de nenhuma conversa anterior.

## Como disparar

Abra uma sessão nova (`/clear`) e mande **uma** frase:

```
Rode o workflow legenda-tempo-por-palavra.
```

É isto que vai ser executado: `Workflow({ name: "legenda-tempo-por-palavra" })`. Nada mais
precisa ser explicado — os números medidos, as restrições e os critérios estão dentro do
script.

**Não cole o plano nem o contexto da sessão antiga.** Sessão limpa é o que faz isto sair
barato: o script já carrega o que os agentes precisam saber.

## O que ele conserta

A legenda não acompanha o que é falado. A causa foi medida, não suposta, na legenda real de um
podcast de 53 min (1703 falas):

| Medida | Valor |
|---|---|
| Falas que se sobrepõem à seguinte | **100%** |
| Falas que empatam o início | **0** |
| Mediana da fonte | 3,68 s / 37 caracteres = 9,5 char/s |
| Espaçamento entre inícios | ~1,86 s |
| **Resultado depois do truncamento** | **~20 char/s** (leitura confortável ≈ 15) |

O texto é **falado** em 3,68 s e **exibido** em 1,86 s, porque o `normalize_cues` fecha cada
fala onde a próxima começa. O espectador não termina de ler a frase.

**A raiz:** `ytclip.parse_json3` concatena os `segs` de cada evento num texto só e joga fora o
`tOffsetMs` — o tempo de cada palavra, que a legenda automática do YouTube fornece. Com ele dá
para montar falas honestas, sem sobreposição e com duração real, em vez de truncar.

## O que já foi tentado e NÃO funciona

**Piso de duração por página com tempo vindo do silêncio seguinte.** Descartado: com 100% de
sobreposição, o silêncio entre falas é **zero por construção**. Não há de onde emprestar tempo.
Está registrado no `CLAUDE.md` para ninguém tentar de novo.

## A restrição que o workflow respeita

`parse_json3` **não pode mudar de saída**. O `ytclip.candidates()` usa o intervalo entre falas
para achar pausa e decidir onde o corte fecha — mexer nele muda a **recomendação de cortes**,
que não é o que este trabalho pede. Por isso o tempo por palavra entra por uma função **nova ao
lado** (`parse_json3_words`), e não alterando a existente.

## As fases

1. **Amostra** (barata, é o portão) — lê o json3 cru de um vídeo real e grava um fixture
   **sintético** em `video-worker/fixtures/`: tempos reais, texto inventado. Transcrição de
   terceiro não vai para o repositório — as suítes do projeto declaram "nenhum conteúdo de
   terceiro". Sem amostra, o workflow **para**: Fase 2 sem dado real seria chute.
2. **Palavras** — `parse_json3_words` + a função que agrupa palavras em linhas com duração
   honesta. Corte por caracteres, por pausa e por fim de frase. O limiar de pausa fica como
   botão de calibragem.
3. **Provas** — duas lentes em paralelo, **somente leitura**: uma roda as 8 suítes, a outra
   caça texto perdido, texto duplicado, `tOffsetMs` somado errado e mudança na recomendação.
4. **Registro** — atualiza o bullet do `CLAUDE.md` que hoje diz "medido e não consertado", cola
   a linha `Checks:` que o `provas.ps1` imprime, e commita.

Cada fase commita e dá push no fim. **4 agentes** no caminho padrão, de propósito: numa conta
com limite apertado, menos agentes é a única defesa real contra o corte no meio.

## Se o crédito acabar no meio

O workflow **para na primeira morte por limite** em vez de jogar mais agentes na parede, e o
retorno diz o que faltou. O que já foi commitado está no GitHub.

Para continuar depois: rode o mesmo comando numa sessão nova. **Não** tente retomar por
`resumeFromRunId` se alguém mexeu no repositório depois — os agentes em cache trabalhariam
contra o estado antigo. As regras estão em `.claude/skills/workflow-sobrevivente/SKILL.md`.

## Fora deste workflow, de propósito

**Whisper local** (transcrever o áudio na sua máquina em vez de usar a legenda do YouTube).
Resolve o que este plano não resolve: palavra errada, falta de pontuação e `[ __ ]`. Continua
aberto porque é dependência nova (~150 MB a 1,5 GB de modelo), contra a regra do projeto de o
worker viver de stdlib + o FFmpeg que já está lá.

O custo de tempo **não** é o problema: o Remotion já gasta ~11 s de render por 1 s de clipe, e
transcrever 90 s de áudio ficaria em 12–25 s estimados — ruído ao lado disso. Se um dia entrar:
transcrever só o corte, idioma fixo em `pt`, int8, cache por (vídeo, intervalo), e rodar
enquanto a pessoa revisa a legenda na tela.
