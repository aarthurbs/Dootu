# Fluxos da base de conhecimento — INGEST, QUERY, LINT

Os três modos de operação da KB. O protocolo geral (camadas, hierarquia de
fontes, invioláveis) está em [`../../AGENTS.md`](../../AGENTS.md); aqui está o
passo a passo de cada fluxo.

Quando o usuário disser o nome do fluxo, siga-o. Fora isso, `QUERY` é o padrão.

---

## INGEST — chegou material novo

Fonte nova: conversa, pesquisa, medição, relatório, doc de terceiro.

1. **Guardar cru.** Arquivo em [`../00-Sources/`](../00-Sources/), sem
   parafrasear. Nome com data: `AAAA-MM-DD-assunto.md`.
2. **Ler uma vez.** Extrair só o que é **reutilizável no futuro** — não a
   narrativa, não o passo a passo da conversa.
3. **Para cada afirmação extraída**, achar pelo [`../INDEX.md`](../INDEX.md) a
   nota do Wiki que já é dona do assunto. Então classificar:
   - **Confirma** o que já está lá → não fazer nada. Silêncio é resultado válido.
   - **Acrescenta** → editar aquela nota, citando o arquivo de origem.
   - **Contradiz** → conferir o código primeiro. O código ganha: corrigir a nota
     e registrar no [`../log.md`](../log.md). Se o código for silencioso, marcar
     como aberto nos dois sentidos e avisar o usuário.
   - **Sem dona** → nota nova, e só então.
4. **Foi uma escolha, não um fato?** (decidiu-se fazer X em vez de Y) → registro
   em [`../03-Decisions/`](../03-Decisions/), com o porquê e o que foi rejeitado.
5. **Atualizar o `INDEX.md`** só se nasceu ou morreu arquivo. **Atualizar o
   `log.md`** só se um leitor futuro precisaria saber.
6. **Relatar:** arquivos tocados, afirmações descartadas, contradições achadas.

Não criar arquivo por precaução. Não registrar trivialidade, log de execução
nem histórico de conversa.

---

## QUERY — responder uma pergunta

1. [`../INDEX.md`](../INDEX.md) **primeiro**. Sempre.
2. Escolher o **conjunto mínimo** de arquivos capaz de responder. Abrir um por
   vez; parar assim que a resposta estiver de pé.
3. Nunca carregar uma camada inteira "por segurança". Nunca abrir um segundo
   vault por precaução.
4. Antes de abrir cada nota: *"preciso disto para a tarefa atual?"* Se não, não abrir.
5. **Doc e código divergem** → responder pelo **código**, dizer que a nota está
   velha e oferecer a correção.
6. **Resposta não está na KB** → dizer isso. Não preencher a lacuna por inferência.
7. Citar os arquivos usados, para o próximo leitor não repetir a busca.

---

## LINT — varredura de manutenção

Roda **quando pedido**, não automaticamente. **Relatar; só aplicar correção
quando autorizado.** Cinco checagens:

| Checagem | Como detectar | Correção |
|---|---|---|
| **Link quebrado** | Todo `[texto](caminho)` e `[[wikilink]]` resolve para arquivo existente | Repontar ou remover |
| **Duplicado / contraditório** | Mesmo assunto em ≥2 notas; nota que afirma o oposto de outra ou do código | Consolidar na nota dona; **o código ganha** |
| **Desatualizado** | Nota que descreve código inexistente (grepar o token no repo); plano cujo alvo já foi entregue | Corrigir, ou arquivar com data |
| **Órfão** | Arquivo não alcançável a partir do `INDEX.md` | Linkar, ou apagar se ninguém vai reabrir |
| **Pendência morta** | Item de `02-Execution/` marcado como aberto cujo trabalho já está no código ou no `log.md` | Fechar; aprendizado → Wiki, escolha → Decisions |

**Saída:** uma lista agrupada por checagem — arquivo + linha + o que está errado
+ correção sugerida. Sem edição silenciosa.

Ponto de partida para a checagem de link quebrado — o `awk` descarta bloco de
código e o `sed` descarta código inline, senão o próprio exemplo abaixo é
reportado como link quebrado:

```sh
# links relativos que não resolvem (rodar na raiz do repo)
for f in AGENTS.md $(find docs -name '*.md'); do
  awk '/^```/{c=!c; next} !c' "$f" | sed 's/`[^`]*`//g' \
  | grep -o ']([^)]*)' | sed 's/^](//; s/)$//' | grep -v '^http' | while read -r p; do
      p="${p%%#*}"
      if [ -n "$p" ] && [ ! -e "$(dirname "$f")/$p" ]; then echo "QUEBRADO $f -> $p"; fi
    done
done
```

Para a checagem de órfão, alcançável = o `INDEX.md` linka **o arquivo ou
qualquer pasta ancestral** dele. Sem a regra da pasta ancestral o check acusa
dezenas de falsos positivos — e LINT que grita lobo ninguém lê:

```sh
# arquivos da KB não alcançáveis pelo INDEX (rodar na raiz do repo)
links=$(awk '/^```/{c=!c; next} !c' docs/INDEX.md | grep -o ']([^)]*)' \
        | sed 's/^](//; s/)$//; s/#.*//; s|/$||' | grep -v '^http' | grep . | sort -u)
find docs -name '*.md' | sed 's|^docs/||' | grep -v '^INDEX.md$' | while read -r f; do
  ok=0; p="$f"
  while [ -n "$p" ] && [ "$p" != "." ]; do
    if echo "$links" | grep -qxF "$p"; then ok=1; break; fi
    np=$(dirname "$p"); [ "$np" = "$p" ] && break; p="$np"
  done
  [ "$ok" -eq 0 ] && echo "ORFAO docs/$f"
done
```
