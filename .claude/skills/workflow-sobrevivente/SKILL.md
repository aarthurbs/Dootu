---
name: workflow-sobrevivente
description: Regras para montar workflow de vários agentes neste projeto sem perder trabalho quando um agente morre (limite de gasto, erro de API, sessão encerrada). Use SEMPRE antes de chamar a ferramenta Workflow, e também quando o usuário pedir "ultracode", "roda um workflow", "fan out de agentes" — ou quando um agente já morreu e for preciso decidir entre retomar e terminar à mão.
---

# Workflow que sobrevive à morte dos próprios agentes

## Regra zero: você não pode impedir a morte

Agente morre por motivo que **nenhuma instrução alcança**:

```
[provas:f2] failed: You've hit your individual spend limit ·
run /usage-credits to ask your admin for a higher limit ·
your weekly limit resets 6pm (America/Sao_Paulo)
```

Isto aconteceu de verdade neste projeto em 2026-08-27: dos 14 agentes, **9 terminaram e
5 morreram** no limite de gasto, depois de 1,5 milhão de tokens de subagente. Não existe
`try/catch`, retry nem skill que reverta essa resposta. Quem reverte é o usuário
(`/usage-credits`) ou gastar menos.

**Então o objetivo desta skill não é mantê-los vivos. É fazer a morte deles custar zero.**
Se ao ler isto você estiver pensando em "tornar o workflow resiliente", pare: o que se
projeta aqui é o **estado que sobra** quando ele for interrompido no pior momento.

## A pergunta que decide tudo

> Se este workflow morrer no agente do meio, o que fica no disco e o que se perde?

Se a resposta não for **"fica tudo o que já passou, e o que falta está escrito"**, o
workflow está mal montado. Reprojete antes de chamar a ferramenta.

## As sete regras

### 1. Commit e push ao FIM de cada fase — não no fim do workflow

Fase que termina sem commit é fase que morre com o processo. Um agente de git por fase,
serializado, com `git add` de caminhos EXPLÍCITOS (nunca `git add -A`: arrasta temporário,
PNG de teste, `props-*.json`).

Foi essa regra que salvou a Fase 1 em 2026-08-27 — ela estava commitada e no GitHub quando
o limite cortou o resto.

### 2. Pare na primeira morte por LIMITE, não continue

Erro de limite de gasto não é falha de um agente: é o fim do orçamento. Continuar apenas
joga mais agentes na parede — foi o que aconteceu (`provas:f2` morreu e outros 4 morreram
atrás dele, todos pela mesma razão).

```js
function morreuPorLimite(err) {
  return /spend limit|usage limit|rate limit|quota/i.test(String(err && err.message || err))
}
```

Detectou? `log()` o que falta, devolva o relatório e **encerre**. Uma parada explícita com
lista de pendências vale mais que dez tentativas mortas.

### 3. Um escritor por arquivo, sempre; verificador é SOMENTE-LEITURA

Nunca dois agentes escrevendo no mesmo arquivo, nem em paralelo nem "em fases diferentes
que se sobrepõem". E o prompt do verificador tem de dizer, com o motivo:

> VOCÊ É SOMENTE-LEITURA. Nunca edite, nunca reverta, nunca "sabote para medir se o teste
> pega". Um agente revisor deste projeto já inverteu uma guarda no disco para medir um teste
> enquanto outro agente lia o mesmo arquivo, e o achado saiu reportado como defeito
> CONFIRMADO com prova de execução.

### 4. `isolation: 'worktree'` é incompatível com commit por fase

Worktree isolada é para agentes que mutam arquivos em paralelo e se atropelariam. Se as
fases constroem uma sobre a outra e há commit no meio, **não use** — o commit tem de cair na
árvore de verdade.

### 5. Fase barata antes de fase cara

Ordene por custo crescente. O corte por limite chega no meio, e é melhor que ele encontre as
fases caras **ainda não começadas** do que abandonadas pela metade. Render de vídeo,
transcrição e varredura de repositório vão para o fim.

### 6. O relatório final diz o que NÃO rodou

Colete o que faltou e devolva junto com o comando de retomada:

```js
return { feito, faltando, retomar: { scriptPath: '<o caminho que o Workflow devolveu>', resumeFromRunId: '<runId>' } }
```

O `scriptPath` e o `runId` vêm no resultado da própria chamada — guarde-os no retorno, senão
a retomada depende de alguém garimpar o histórico.

### 7. Fase de ≤2 passos não vira agente

Rodar 7 suítes, ler um diff, commitar: isso é trabalho de laço inline, não de subagente.
Cada agente custa contexto próprio e é mais um ponto onde o limite pode cortar. **A defesa
mais eficaz contra a morte por limite é ter menos agentes.**

## Retomar × terminar à mão

Retomada existe: `Workflow({ scriptPath, resumeFromRunId })` — o prefixo inalterado de
`agent()` volta do **cache, instantâneo e sem custo**, e só o primeiro agente novo/editado e
o que vem depois rodam de verdade.

**Ela NÃO é automática** (nada reinicia quando o limite volta) e o cache é **só da sessão**:
sessão encerrada, retomada perdida — sobra reescrever a continuação a partir do
`journal.jsonl`.

Escolha assim:

| Situação | O que fazer |
|---|---|
| Falta fase cara, muitos passos, você tem orçamento | **Retomar** |
| Falta pouco e é determinado (rodar suíte, ler diff, commitar) | **Terminar à mão** — ressuscitar agentes custa mais que fazer |
| O limite acabou de ser atingido | **Terminar à mão**, e só o essencial |
| Alguém já mexeu no repo depois da morte | **NÃO retomar.** Os agentes em cache trabalham contra o estado antigo: o de commit tentaria commitar o que já está commitado, o de documentação reescreveria trecho que já mudou |

A última linha é a que mais dói e a menos óbvia. Em 2026-08-27 a retomada era tecnicamente
possível e teria feito estrago, porque o trabalho dos 5 mortos já havia sido concluído à mão
e commitado.

## Antes de chamar a ferramenta Workflow

Confira, nesta ordem:

1. Todas as fases têm commit+push no fim? Se alguma não tem, ela pode ser perdida.
2. Algum arquivo é escrito por mais de um agente? Se sim, serialize.
3. Os verificadores estão marcados como somente-leitura, com o motivo escrito?
4. A fase mais cara está no fim?
5. O retorno inclui `faltando` e `retomar`?
6. Quantos agentes? Se der para fazer inline, faça inline.
7. O usuário sabe o tamanho da conta? Workflow grande em conta com limite apertado é o
   formato mais frágil que existe: o custo vem em rajada e o corte cai no meio.
