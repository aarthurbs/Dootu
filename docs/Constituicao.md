# Constituição — Usee Brasil

Base de governança dos vaults Obsidian da Usee. Curta de propósito: regra que ninguém lê não governa nada.

## 1. Onde vivem os vaults

Todos em `C:\Usee Brasil\Obsidian\<nome do vault>`. `Geral Usee` é obrigatório — é este.

## 2. Como consultar

1. A tarefa e o contexto já dado na conversa.
2. O `INDEX.md` do vault relevante — sempre primeiro.
3. A nota específica que o índice apontar.
4. Outras notas, só se forem necessárias.

Nunca ler o vault inteiro para uma tarefa pontual. Antes de abrir uma nota, a pergunta é: "preciso disto para a tarefa atual?" Se não, não abrir. Não abrir vários vaults por precaução — começar pelo mais relacionado.

## 3. Hierarquia de fontes (em caso de conflito)

1. O que o usuário disse nesta conversa.
2. O código / o arquivo em disco.
3. Esta Constituição.
4. O `INDEX.md` e as notas do vault.
5. Preferência geral e hábito.

**A fonte da verdade é o código, não a documentação.** Nota que discorda do arquivo em disco está errada e é a nota que se corrige.

## 4. O que registrar

Só conhecimento útil no futuro. **Preferir editar nota existente a criar nova.**

Não registrar: trivialidade, log de execução, histórico de conversa, lista de arquivos alterados.

O vault deve ficar curto, organizado e fácil de consultar. Nota que ninguém vai reabrir é lixo com data.

## 5. Segurança e confidencialidade

- Segredo (chave de API, `client_secret`, `refresh_token`, `service_role`, senha) **nunca** vai para nota de vault. Vault não é cofre.
- Dado de cliente e número de faturamento só no vault do negócio, nunca em nota que possa ser compartilhada.
- Nada de credencial em nome de arquivo, em título de nota ou em frontmatter.

## 6. Escopo

Não expandir a tarefa pedida. Não alterar documentação, código, estrutura ou padrão não relacionado. Melhoria fora do escopo: informar depois de concluir, sem executar.

## 7. Em qual vault registrar

Se não estiver claro, **perguntar** em vez de escolher no chute.
