# PLANO — descrição e hashtags: gerar, registrar, ler

> **Estado em 2026-09-14: CP1 entregue. CP2 depende de você. CP3 e CP4 não iniciados.**
> Criado em 2026-09-14, a pedido do usuário ("sistema de análise de descrição e de hashtags
> que funcionam melhor para nossa conta"). O plano existe porque o pedido, executado na
> ordem pedida, produziria mentira — ver §2.

## 1. Problema

Não existe hoje nenhum registro de qual descrição e quais hashtags foram usadas em cada
clip, nem meio de comparar. E não existe clip publicado: `Clips/` do vault `Cortes` está
vazio, `REGISTROS.md` está vazio, `Licoes.md` está vazio.

O pedido original era um **analisador**. O que este plano entrega é a mesma máquina na
ordem que funciona: **gerar → registrar → ler**. Ela nasce ajudando a postar e vira
analisador sozinha quando os dados chegam. Nada do trabalho é descartado no caminho.

## 2. O que este plano NÃO faz, e por quê

**Não diz o que funciona antes de existir dado.** Com zero posts, um "analisador" só pode
devolver conselho genérico de internet com aparência de análise da sua conta. É a
"superstição operacional" que o `../video-ops/REGISTROS.md` proíbe por escrito, e é pior
que não ter ferramenta nenhuma: conselho genérico com cara de dado próprio não se
questiona depois.

**Não inventa hashtag.** Os conjuntos são declarados por você no `INDEX.md` do vault
`Cortes`. Código que gera hashtag sozinho produz tag que ninguém busca.

**Não promete que hashtag move o resultado.** Na prática o peso da hashtag é pequeno e
muito confundido por tema, horário e, acima de tudo, retenção. Este plano dá o meio de
medir; não afirma o que a medição vai dizer. Se a leitura do CP3 não achar diferença
entre SET-A e SET-B, isso é resultado válido e vai registrado.

**Ordem de importância, para não gastar amostra no lugar errado:** gancho e primeiros
segundos pesam muito mais que descrição, e descrição pesa mais que hashtag. A primeira
variável a testar deveria ser o gancho. A hashtag entra depois, quando já houver volume.

## 3. Portão de honestidade (regra do sistema, não sugestão)

A leitura do CP3 **se recusa a ranquear** abaixo de amostra. Os cortes vêm do
`../video-ops/REGISTROS.md` e não são negociáveis por pressa:

| Clips comparáveis no grupo | O que a leitura mostra |
|---|---|
| 0–5 | só a contagem. Nenhum número comparado. |
| 6–9 | números crus lado a lado, marcados **sinal exploratório**. |
| 10–19 | comparação com **confiança média** declarada. |
| ≥20 | comparação **confirmada**, e só aqui pode virar linha em `Licoes.md`. |

Grupo com `variavel_testada` diferente entre os clips **não é comparável** e a leitura
tem de dizer isso em vez de somar mesmo assim. Métrica ausente é `null`, nunca zero —
regra já valendo no projeto.

## 4. Entrega em quatro checkpoints

### CP1 — o registro passa a caber o assunto  ✅ entregue em 2026-09-14

`_modelo-clip.md` do vault `Cortes` ganhou quatro campos: `descricao_padrao`,
`hashtags_set`, `variavel_testada`, `exp`. E uma seção **Hipótese**, a ser escrita
ANTES de publicar — sem ela o registro é relatório, não experimento.

O `INDEX.md` daquele vault ganhou a tabela de padrões de descrição e a tabela de
conjuntos de hashtag. O clip guarda só o **nome**; o conteúdo mora uma vez no índice.

**Pronto quando:** um clip novo copiado do modelo tem os campos. Feito.

### CP2 — você declara os conjuntos  ⏳ depende do usuário

Preencher `SET-A` e `SET-B` na tabela do `INDEX.md` do vault `Cortes`, e confirmar ou
cortar os quatro padrões de descrição já propostos lá.

**Pronto quando:** as duas tabelas não têm mais `(a definir)`.
**Depende de:** decisão sua. Nada técnico.
**Regra que não pode ser quebrada depois:** conjunto já usado em clip publicado não muda
de conteúdo. Mudar o SET-A no meio apaga a comparação sem avisar ninguém. Precisou mudar,
cria SET-C.

### CP3 — a leitura  ⏳ não iniciado

Script Python **stdlib pura** que lê o frontmatter de `Clips/*.md`, agrupa por
`descricao_padrao` e por `hashtags_set`, aplica o portão do §3 e imprime o resultado.

- Sem dependência nova: o projeto é stdlib no Python e Vanilla JS sem npm.
- **Caminho do vault vem por argumento**, nunca cravado no código. O `test-ponte.js` está
  quebrado desde antes do ciclo 2 exatamente por comparar contra um arquivo pessoal fora
  do repositório; não repetir o erro.
- Fixture de clips no repositório para o teste — o teste não pode depender do vault real.
- Agrupar ignorando clip com campo vazio, e **dizer quantos ignorou**. Automação silenciosa
  é indistinguível de automação quebrada (BP-008).

**Pronto quando:** rodando contra a fixture, o script separa os grupos, respeita os quatro
cortes do §3 e recusa comparar grupos com `variavel_testada` diferente.
**Depende de:** CP2 só para uso real; o teste roda com a fixture desde já.
**Não toca** `video-ops.js` nem nenhuma suíte existente.

### CP4 — o gerador no Estúdio  ⏳ não iniciado, e é o último de propósito

Na tela do clip pronto: monta descrição a partir dos padrões declarados (usando título da
fonte, canal e a legenda do trecho, que o Estúdio já tem) e o conjunto de hashtag da vez,
e copia tudo para a área de transferência já no formato de colar no app.

- Sem chave de API e sem chamada a modelo: o molde é texto, você edita antes de postar. Chave
  de API seria segredo no cliente, o que a regra inviolável do projeto proíbe, e dependência
  nova num projeto que não tem nenhuma.
- É o passo que **mexe em `video-ops.js`** e portanto o único que exige `.\provas.ps1`
  verde antes de concluir.

**Pronto quando:** um clip real gera descrição + hashtags no clipboard, o nome do padrão
e do conjunto aparecem na tela para você copiar na nota, e `.\provas.ps1` continua em 1728
verificações, zero falhas (ou o total novo conferido e atualizado no `CLAUDE.md`).

## 5. Onde mexe

| Checkpoint | Arquivos |
|---|---|
| CP1 | vault `Cortes`: `_modelo-clip.md`, `INDEX.md` — **fora do repositório** |
| CP2 | vault `Cortes`: `INDEX.md` |
| CP3 | novo script + fixture, no repositório. Nenhum arquivo existente alterado |
| CP4 | `video-ops.js`, `video-ops.css`, `test-video-ops.js`, `test-video-ops-dom.js` |

## 6. Riscos conhecidos

- **Diluir a amostra.** Quatro padrões de descrição × dois conjuntos de hashtag = oito
  grupos. A 5 clips por semana, nenhum grupo chega a 10 antes de meses. Mitigação: começar
  com **dois** padrões e **um** conjunto, e só abrir o leque quando um grupo passar de 10.
- **Testar duas coisas ao mesmo tempo.** O campo `variavel_testada` existe para pegar isso,
  mas só funciona se for preenchido com honestidade. Código nenhum conserta isso.
- **Confundir correlação com causa.** Um clip que estourou com SET-B estourou por causa do
  SET-B? Quase certamente não. O portão do §3 existe para segurar essa conclusão.
- **Duas verdades no modelo de clip.** `docs/_templates/` do repositório tem um modelo de
  clip próprio, com campos parecidos. Depois do CP1 os dois divergem. Ver §7.

## 7. Fora do escopo — informar, não executar

`docs/_templates/Sem título.md` (modelo do plugin *Templates* deste repositório) ficou em
2026-09-14 justamente por ter campos que o `_modelo-clip.md` do vault não tinha: hipótese,
`views_24h`/`views_7d`, conclusão. O CP1 acabou de levar hipótese para o vault, então a
justificativa daquele arquivo encolheu e os dois modelos agora se sobrepõem de verdade.

Decidir qual fica é decisão do usuário sobre dono de assunto, não trabalho deste plano.
Registrado aqui para não ser redescoberto.
