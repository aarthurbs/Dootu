# AGENTS.md — Protocolo da base de conhecimento

Como um agente (Claude, Codex, outro modelo) lê, atualiza e mantém o
conhecimento deste projeto. Curto de propósito: regra que ninguém lê não
governa nada.

> O conteúdo anterior deste arquivo era uma cópia desatualizada do `CLAUDE.md`
> (declarava-se "retrato ANTIGO" na primeira linha). Para contexto de projeto e
> regras de código, vá ao `CLAUDE.md`. Versão antiga: `git show HEAD:AGENTS.md`.

## Antes de qualquer coisa

1. [`docs/Constituicao.md`](docs/Constituicao.md) — governança Usee. Nos temas
   dela, prevalece sobre preferência geral.
2. [`docs/INDEX.md`](docs/INDEX.md) — o mapa. **Sempre primeiro**, antes de
   abrir qualquer nota.
3. [`CLAUDE.md`](CLAUDE.md) + [`.claude/rules/`](.claude/rules/) — regras de
   **código** (carregam por caminho de arquivo). Não são base de conhecimento:
   não mover, não duplicar dentro de `docs/`.

Nunca leia o vault inteiro para uma tarefa pontual. Antes de abrir uma nota:
*"preciso disto para a tarefa atual?"* Se não, não abra. Não abra vários vaults
por precaução — comece pelo mais relacionado à tarefa.

## As quatro camadas

Vivem em `docs/`. Cada uma tem o contrato de escrita no seu próprio `README.md`.

| Camada | Contém | Regra de escrita |
|---|---|---|
| [`docs/00-Sources/`](docs/00-Sources/) | Material bruto: conversa, pesquisa, medição, relatório, doc de terceiro. | **Não reescrever.** Só acrescentar arquivo novo. Corrigir uma fonte = anotar no Wiki, nunca editar a fonte. |
| [`docs/01-Wiki/`](docs/01-Wiki/) | Conhecimento consolidado: como as coisas são e por quê. | **Editar a nota existente.** Nota nova só quando nenhuma é dona do assunto. |
| [`docs/02-Execution/`](docs/02-Execution/) | Plano, pendência, teste, trabalho ativo. | Estado explícito por item. Concluído **sai da camada**: aprendizado → Wiki, escolha → Decisions. |
| [`docs/03-Decisions/`](docs/03-Decisions/) | Decisão técnica/de produto + o raciocínio. | **Append-only.** Decisão não se apaga: `Status: Substituída por <arquivo>`. |

## Hierarquia de fontes (em caso de conflito)

1. O que o usuário disse nesta conversa.
2. O código / o arquivo em disco.
3. [`docs/Constituicao.md`](docs/Constituicao.md).
4. O `INDEX.md` e as notas do vault.
5. Preferência geral e hábito.

**A fonte da verdade é o código, não a documentação.** Nota que discorda do
arquivo em disco está errada, e é a nota que se corrige. Ao encontrar
divergência: corrigir a nota e registrar em [`docs/log.md`](docs/log.md).

## Fluxos

`INGEST` (chegou material novo) · `QUERY` (responder) · `LINT` (manutenção).

Passo a passo em [`docs/01-Wiki/fluxos-kb.md`](docs/01-Wiki/fluxos-kb.md).
Quando o usuário disser o nome do fluxo, siga-o. Fora isso, `QUERY` é o padrão.

## Invioláveis

- **Não inventar.** Sem fonte: escrever "não verificado" ou perguntar.
- **Preferir editar a criar.** Arquivo novo exige que nenhum existente sirva.
- **Segredo nunca entra em nota** — nem em nome de arquivo, título ou
  frontmatter. Vault não é cofre.
- **Não expandir o escopo.** Melhoria fora do pedido: informar depois de
  concluir, sem executar.
- **Todo arquivo é alcançável pelo `INDEX.md`.** Órfão é lixo com data.
- Mudança relevante numa camada → uma linha no `log.md`. Trivialidade, não.
- Não está claro em qual camada (ou em qual vault) registrar → **perguntar**,
  em vez de escolher no chute.
