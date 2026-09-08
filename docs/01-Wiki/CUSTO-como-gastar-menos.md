# Como gastar menos com o Claude neste projeto

Escrito em 2026-08-28, com números medidos numa sessão que custou **US$ 111**. Não é teoria:
cada item abaixo veio de um desperdício observado.

## O que domina a conta

Não é o número de mensagens. É o **contexto total** — tudo o que já foi dito e lido na
sessão é reprocessado a cada nova mensagem. Medido: a sessão chegou a **486 mil tokens**, ou
seja perguntar "e aí, como está?" no fim dela custou cerca de **15× mais** que a mesma
pergunta no começo.

O `CLAUDE.md` (**92,5 KB ≈ 23 mil tokens**) importa porque é o **piso** desse crescimento:
ele entra em toda mensagem de toda sessão.

## As cinco alavancas, em ordem de retorno

| # | Alavanca | Ganho | Custo |
|---|---|---|---|
| 1 | **`/clear` entre tarefas** | sessão nova nasce em ~30k em vez de 486k | nenhum |
| 2 | **`/model` para trabalho mecânico** | rodar teste, renomear, corrigir typo não precisa do modelo mais caro | nenhum |
| 3 | **Enxugar o `CLAUDE.md`** (23k → ~8k) | baixa o piso de TODA sessão futura | uma sessão curta |
| 4 | **Não usar workflow de muitos agentes** | os 14 agentes de 2026-08-27 consumiram **1,5 milhão** de tokens | nenhum |
| 5 | Disciplina de leitura | nada de `grep -r` na raiz (entra em `node_modules`); não reler arquivo já lido | nenhum |

**Uma tarefa por sessão, `/clear` no fim.** É a regra que mais economiza e a mais fácil de
esquecer.

## A alavanca que ninguém usa: verificação é trabalho do SEU computador

`.\provas.ps1` roda **830 verificações** e devolve 10 linhas. Custo em tokens: praticamente
zero. Se em vez disso o Claude lê os arquivos e raciocina sobre eles, a mesma resposta custa
milhares de tokens e é menos confiável.

> **Seu computador é grátis. O contexto do Claude não é.**

Sempre que der para trocar "o Claude analisa" por "um script local responde", troque. Vale
para: rodar provas, contar coisas, procurar padrão, medir tamanho, comparar arquivos,
validar sintaxe. Peça o SCRIPT, não a análise.

## Sinais de que você está gastando à toa

- A sessão passou de umas 20 trocas e o assunto já mudou → `/clear`.
- Você pediu algo pequeno e a resposta veio enorme → peça "responda em 3 linhas".
- O Claude está lendo arquivo grande para responder algo que um `grep` responderia → peça o
  `grep`.
- Ele propôs um workflow/enxame de agentes para uma tarefa que cabe num diff → recuse.
- Ele está "explorando" o repositório sem alvo → dê o caminho do arquivo.

## Pedido pronto: enxugar o CLAUDE.md

Abra uma **sessão nova** (`/clear`) e cole isto. Numa sessão limpa isto custa uma fração do
que custaria numa sessão longa.

```
Leia docs/01-Wiki/CUSTO-como-gastar-menos.md e faça só a tarefa 3 dele: enxugar o CLAUDE.md.

Ele tem 92,5 KB (~23 mil tokens) e entra no contexto em toda mensagem de toda sessão.
Alvo: ~8 mil tokens, sem perder nada load-bearing.

Regras:
- O que FICA: as regras que mudam decisão futura (regra de segurança, BP-001..BP-013,
  o que NÃO recriar, armadilhas medidas com o número, os comandos de verificação).
- O que SAI para docs/HISTORICO-decisoes.md: a narrativa de entregas concluídas, o
  "antes era X e virou Y" de coisa que ninguém mais vai mexer, e todo bullet que só
  conta história.
- BP-007 vale aqui: antes de tirar qualquer coisa, confirme no CÓDIGO que ela não é
  load-bearing. Documentação pode estar desatualizada; código é a verdade.
- Deixe no CLAUDE.md um ponteiro de uma linha para o histórico.
- Não mude código nenhum. Só os dois .md.
- No fim rode .\provas.ps1 (tem de continuar 830, exit 0), commit e push.
```

## O que NÃO cortar para economizar

- **As suítes de teste.** Rodam local, custam zero, e são o que impede eu (ou outro agente)
  quebrar algo calado. Cortar teste para economizar token é trocar centavos por retrabalho.
- **Os comentários que registram armadilha medida.** Cada um deles já impediu alguém de
  repetir uma investigação de horas. São o oposto de desperdício.
- **O `provas.ps1`.** É a ferramenta mais barata do repositório.

## Os hooks desta máquina também custam

O `GateGuard` obriga a declarar fatos antes de cada `Bash` e de cada criação de arquivo. É
útil contra agente que age sem verificar, mas **cada declaração é resposta que você paga** —
neste documento ele cobrou duas. Se o custo apertar, ele sai com
`ECC_GATEGUARD=off` na sessão, ou `pre:bash:gateguard-fact-force` em `ECC_DISABLED_HOOKS`.
Decisão sua: é segurança contra dinheiro, e os dois são reais.
