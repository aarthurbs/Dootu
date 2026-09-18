---
paths:
  - "video-results.js"
  - "test-video-results.js"
description: Regras ativas da tela Resultados dos cortes (registro de publicação, medições e análise de padrões).
---

# Resultados dos cortes (`video-results.js`) — regras ATIVAS

Tela `resultados` do Estúdio. Autorizada pelo usuário em 2026-09-14 para **aprender com o
que já foi publicado**: quais formatos rendem mais audiência, engajamento e retenção.

**Isto NÃO reabre o pipeline de publicação apagado em 2026-08-21.** Nada de contas,
material de terceiro, aprovação por hash, Drive, CSV ou agendamento — o site não publica
nada, não fala com API de plataforma e não tem tela de post. Aqui só se REGISTRA à mão o
que já foi publicado por fora e se olha o resultado. Os tokens apagados daquele pipeline
continuam apagados; não referenciar nenhum deles.

## A fronteira com o `video-ops.js`
- Módulo próprio, IIFE próprio, `window.videoResults` = `{html, act, field, count, __}`.
- O `video-ops.js` toca isto em **cinco pontos só**: `FLOW_HINT.resultados`, a aba em
  `tabsHTML`, o ramo em `render()`, o `action.indexOf('res-') === 0` no `onRootClick` e o
  `[data-res-filter]` no `onRootChange`. Nada mais deve cruzar.
- **Quem repinta é o `video-ops.js`.** `act()` e `field()` devolvem `true` quando a tela
  precisa ser redesenhada, e quem chama `renderKeepingScroll()` é a raiz. Dois módulos
  escrevendo no mesmo `innerHTML` acabaria com um apagando o outro.
- **`clips` chega por parâmetro** (`api.html(LIB.clips)`). Ler `pp_video_clips_v1` daqui
  criaria uma segunda cópia que pode divergir da que o Estúdio já tem em memória.
- Módulo ausente não derruba nada: `resultsAPI()` devolve `null` e a aba **diz o motivo**
  (BP-008). Há check para os dois ramos no `test-video-ops-dom.js`.

## Dados
- Chave **própria** `pp_video_results_v1` — `{version, posts[], notas[]}`.
  `pp_video_clips_v1` e `pp_video_projects_v1` são **lidos por fora e nunca escritos**;
  há check que compara o texto bruto das duas chaves antes e depois de gravar.
- `postedAt` e `medicoes[].at` são `datetime-local` **local** (`YYYY-MM-DDTHH:MM`), sem
  fuso. Converter para UTC deslocaria o horário de publicação, que é justamente um dos
  campos que se quer analisar.
- **BP-014:** `sanitize`, `postEntry`, `medEntry` e `notaEntry` são exportadas em `__` e o
  teste as chama com o dado construído, nos DOIS ramos (com e sem `medicoes`/`notas`).
  Dado ilegível **não é sobrescrito**: vira tela de recuperação, como na Central.
- Todo valor de conjunto fechado passa por `daLista()`. O `<select>` não é garantia — o
  value vem do DOM, e DOM é entrada.

## As três regras aritméticas (o núcleo da tela)
Quebrar qualquer uma faz a tela mentir com número. Cada uma tem check dedicado.

1. **Ausência não é zero.** Métrica não informada é `null` e sai como "não informado".
   `numOuNulo('')` é `null`; `numOuNulo('0')` é `0` — zero DIGITADO é um dado. Publicação
   sem medição na janela não conta como 0 em mediana nenhuma; vai para o fim da ordenação.
2. **Nunca somar duas medições.** As contagens das plataformas são ACUMULADAS: somar a
   medição de 24 h com a de 7 dias conta as mesmas visualizações duas vezes. Toda conta
   passa por `medicaoDaJanela`, que escolhe **uma** medição por publicação (`ultima`,
   `24h` = 12–48 h, `7d` = 120–240 h) e devolve `null` quando não há nenhuma na janela. No
   detalhe, a coluna de variação é uma SUBTRAÇÃO entre medições vizinhas — nunca soma.
3. **Associação não é causa.** Todo padrão sai com: quantas publicações e quantos CORTES o
   sustentam, contra quantas foi comparado, as duas medianas, até 3 exemplos clicáveis, uma
   hipótese que muda UMA característica por vez, e o rótulo "Associação observada, não causa
   comprovada". Grupo com menos de 2, ou resto com menos de 2, não vira observação; menos de
   4 publicações medidas no recorte devolve **"dados insuficientes"**, não um padrão fraco.
   Diferença abaixo de **15%** não é apresentada. Os resultados FRACOS também são listados —
   olhar só vencedor é viés de sobrevivente.

## Taxa de engajamento
- Componentes: curtidas + comentários + compartilhamentos + salvamentos. Entram **só os que
  foram medidos**, e a `assinatura` carrega quais foram, mais o denominador.
- **Fórmula e denominador ficam à vista** (BP-003). Sem componente nenhum, ou com
  denominador ausente/zero, a taxa **não é calculada** e o motivo é escrito (BP-008 + BP-004
  — `divide()` guarda o zero).
- **Taxas de assinaturas diferentes não se comparam.** `porAssinatura` rankeia só o maior
  grupo de assinatura igual e DIZ quantas ficaram de fora.
- **Não existe nota única de "potencial viral".** Os destaques são três blocos separados —
  audiência (visualizações), engajamento (taxa) e retenção (% de conclusão) — porque um
  número só esconderia qual deles mudou. É a mesma razão pela qual a nota do hub de
  recomendações não aparece no card.

## Comparabilidade
`avisos()` diz quando o recorte mistura plataformas, perfis ou orgânico com impulsionado —
não bloqueia, mas dizer é obrigatório: comparar TikTok com Instagram calado produz um
"formato vencedor" que é só a diferença entre as duas plataformas. Grupo com `n < 3` sai
marcado como **amostra pequena**.

## Interação
- **Só o filtro redesenha.** Os campos do formulário são lidos no salvar (`leForm`/`leMed`);
  redesenhar a cada tecla tiraria o foco — mesma armadilha que o `ytUrlWrite` evita (BP-001).
- **Erro de validação não apaga o que foi digitado**: `UI.draft` guarda o formulário e a
  tela volta preenchida. Há check para isso.
- Botões explícitos para editar/remover, nunca `dblclick` (BP-001).
- Sem animação de entrada: cada troca de filtro redesenha a seção, e um fade que reproduz
  dezenas de vezes por sessão lê como lentidão. Movimento só em resposta a gesto, < 300 ms.

## Validação
`node test-video-results.js` — ou `.\provas.ps1` (a suíte está registrada nele).
