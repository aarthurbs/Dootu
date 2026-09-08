# Agente `video-growth-loop`

**Criado em:** 02/08/2026 · **Finalidade:** auditar, pesquisar, testar e aperfeiçoar
continuamente a estratégia, o código, a produção, a edição, a publicação e a análise de
vídeos curtos, preservando direitos, aprovação humana, segurança e simplicidade.

As **instruções do agente** vivem em `.claude/agents/video-growth-loop.md` (formato nativo
do Claude Code: frontmatter `name`/`description`/`tools` + prompt). Este documento é a
referência **humana**: como acionar, o que esperar e os dois instrumentos que uma pessoa
usa na operação — a rubrica de qualidade e o radar de tendências.

Não duplicar aqui o conteúdo do arquivo do agente. Se divergirem, o arquivo do agente vence.

## Como acionar

```text
Execute um novo ciclo do video-growth-loop.
```

ou o comando `/video-growth-loop`, que aceita um foco opcional:

```text
/video-growth-loop trilha B
/video-growth-loop direitos
```

## O que um ciclo entrega

Sempre nesta ordem: diagnóstico · evidências · melhoria selecionada · alternativas
descartadas · implementação · testes · antes/depois · riscos restantes · arquivos
alterados · próxima ação · checkpoint.

Limites por ciclo: **uma** melhoria principal e no máximo **uma** correção pequena
relacionada. `"nenhuma mudança necessária"` é resultado válido e esperado com frequência.

## Estado de dados — leia antes de cobrar análise editorial

Enquanto não houver contas, fontes autorizadas e posts publicados, as trilhas **A**
(editorial) e **C** (operação) não têm o que analisar. O agente marca **"sem baseline"** e
trabalha só no que é verificável: código, testes, migrações, infraestrutura de direitos,
contratos e documentação. Isso é comportamento correto, não preguiça — insight editorial
sem dado é invenção.

O que destrava cada trilha está em `PILOTO.md §6`.

---

## Rubrica de qualidade de um corte

Avaliar de **0 a 5** cada critério. A nota **não substitui** a revisão humana; ela torna a
recusa discutível em vez de subjetiva.

| # | Critério | 0 | 5 |
|---|---|---|---|
| 1 | Força do hook | ninguém para | primeira frase segura sozinha |
| 2 | Clareza sem contexto | precisa ter visto a live | entende do zero |
| 3 | Payoff | promete e não entrega | entrega o que prometeu |
| 4 | Ritmo | arrastado ou picotado | avança sem repetir |
| 5 | Valor emocional ou prático | indiferente | dá para usar ou sentir |
| 6 | Autenticidade | soa fabricado | é a fala real |
| 7 | Aderência ao nicho | fora da linha editorial | exatamente o que a conta promete |
| 8 | Potencial de compartilhamento | ninguém manda pra alguém | dá vontade de mandar |
| 9 | Potencial de salvamento | descartável | serve para voltar depois |
| 10 | Legibilidade | texto cortado ou ilegível | legível em tela pequena |
| 11 | Qualidade do áudio | difícil entender | limpo e inteligível |
| 12 | Segurança jurídica | dúvida sobre direito | prova vinculada e vigente |
| 13 | Diferenciação editorial | igual a qualquer canal | reconhecível como nosso |

**Reprovação automática** — nota irrelevante, o corte não vai:

- direito não comprovado;
- música sem licença para aquela conta e região;
- marca-d'água indevida;
- corte que altera o sentido da fala;
- informação falsa;
- baixa inteligibilidade;
- texto fora da área segura;
- duplicação sem transformação editorial;
- conteúdo que só faz sentido com contexto ausente;
- ausência de aprovação humana.

Bloco para copiar na revisão:

```text
Corte: <clipId> · Conta: <@handle> · Plataforma: <TikTok|Reels> · Formato: <placement>
Hook _ / Clareza _ / Payoff _ / Ritmo _ / Valor _ / Autenticidade _ / Nicho _
Compartilhar _ / Salvar _ / Legibilidade _ / Áudio _ / Jurídico _ / Diferenciação _
Reprovação automática acionada? (não | qual)
Decisão: aprovar | ajustar | rejeitar     Motivo:
```

---

## Radar de tendências seguro

Tendência é **sinal de descoberta**, nunca autorização para baixar ou republicar.

**Fontes aceitáveis:** TikTok Creative Center; painéis e ferramentas oficiais; pesquisa
manual; analytics nativos das próprias contas; relatórios publicados; arquivos enviados
por criadores; APIs oficiais aprovadas; exportações oficiais.

**Proibido:** scraping, captura automatizada, cookies de navegador, login por robô,
qualquer coisa que contrarie os termos das plataformas.

Registrar cada tendência assim (colar em `REGISTROS.md`):

```text
TEND-<n>
Fonte:              (com link)
Data de consulta:
Região:
Nicho:
Idade do sinal:
Estágio:            nascente | crescente | saturada | em queda
Aderência à conta:  por que combina com a nossa promessa editorial
Risco de cópia:     alto | médio | baixo — e o que nos diferencia
Transformação:      o que faríamos de original em cima disso
Direitos:           o que precisaríamos autorizar para usar
Prazo:              até quando vale testar
```

Se "Transformação" ficar vazio, a tendência não entra: reproduzir sem transformar é
justamente o que faz um canal virar fazenda de conteúdo.

---

## Histórico de decisões do agente

| Ciclo | Data | Problema | Decisão | Resultado |
|---|---|---|---|---|
| 1 | 02/08/2026 | `driveTree()` omitia `Fontes originais/`, `_jobs/` e `_results/`, das quais `PLANO §12`, `CONTRATO_TRABALHADOR §1` e o checklist do `PILOTO.md` dependem | corrigir a árvore e travar com teste | aplicado; ver `PROGRESSO.md` |
