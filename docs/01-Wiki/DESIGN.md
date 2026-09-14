# HUBI — Design System

Este documento é o contrato visual do Seller-Arthur. Ele combina a clareza
editorial do Perplexity com uma presença discreta do Washington Wizards.

## Direção

A interface deve parecer uma central de trabalho precisa, silenciosa e confiável.
O conteúdo e as ferramentas vêm antes da decoração. O Wizards aparece como
assinatura — logo, vermelho, azul e contexto esportivo — e não como imagem de
fundo.

Palavras-chave: **direto, focado, denso, legível, esportivo na medida**.

## Identidade preservada

- Logo circular do Wizards no acionador do menu.
- Nome HUBI.
- Vermelho Wizards como ação principal e foco.
- Azul Wizards como apoio informacional.
- Placar esportivo no cabeçalho.
- Animação especial de início de rodada, por ser um evento funcional e raro.

## O que sai

- Imagem de jogadores no fundo.
- Imagem promocional na lateral.
- Gradientes decorativos, brilhos e sombras coloridas.
- Títulos condensados e excesso de caixa alta.
- Cards translúcidos sobre imagens.
- Animações de entrada em sequência.

## Cores

Há três níveis de superfície. Não criar um quarto nível sem necessidade.

| Token | Valor padrão | Uso |
|---|---:|---|
| `--bg` | `#0f0f10` | fundo da aplicação |
| `--bg-subtle` | `#141416` | áreas de trabalho extensas |
| `--surface` | `#19191b` | cards e painel lateral |
| `--surface-2` | `#222225` | hover, campos e áreas elevadas |
| `--surface-3` | `#2a2a2e` | seleção e estados fortes |
| `--border` | `#303034` | divisores e contornos |
| `--text` | `#f2f2f2` | texto principal |
| `--text-dim` | `#a1a1a6` | texto secundário |
| `--text-muted` | `#68686e` | legenda e placeholder |
| `--accent` | `#e31837` | ação primária e foco |
| `--accent-2` | `#4d82d8` | informação esportiva e apoio |

O vermelho não é decoração. Dentro de cada tela, ele deve apontar a ação mais
importante ou o estado selecionado.

## Tipografia

- Interface e leitura: `Inter`, seguida da pilha de fontes do sistema.
- Código: `ui-monospace`, `Cascadia Code`, `Consolas`, monospace.
- Números: `font-variant-numeric: tabular-nums`.
- Título de página: 32 px, peso 600, line-height 1.2.
- Título de seção: 18–22 px, peso 600.
- Corpo: 14–15 px, line-height 1.6.
- Metadado: 11–13 px.

Não usar fonte condensada na navegação ou em títulos. Caixa alta fica restrita a
siglas e pequenos indicadores esportivos.

## Espaçamento

Escala base de 4 px:

- `4`: detalhes internos.
- `8`: gap compacto.
- `12`: controles.
- `16`: padding de card.
- `24`: separação entre componentes.
- `32`: separação entre seções.
- `48`: ritmo de página.

Conteúdo de leitura usa largura máxima de 760 px. Dashboards, tabelas e Fluxos
podem usar até 1200 px ou toda a área disponível.

## Formas

- Campo e card: 8 px.
- Modal e painel: 12 px.
- Tags e avatares: formato pill.
- A borda comunica elevação; sombras ficam restritas ao menu e aos modais.

## Componentes

### Cabeçalho

Plano, escuro e com uma borda inferior. O logo abre o menu sem deslocar o
conteúdo. Categorias se comportam como abas com sublinhado, não como cápsulas
coloridas.

### Menu lateral

Drawer de 280 px sobreposto ao conteúdo. Superfície sólida, sem fotografia.
O topo recebe apenas uma faixa curta vermelho/azul como assinatura Wizards.

### Cards

Superfície sólida, borda de 1 px e raio de 8 px. Sem blur, glow ou faixa
decorativa. Hover muda a superfície e sobe no máximo 1 px.

### Botões

- Primário: vermelho, texto branco, raio de 8 px.
- Secundário: transparente, borda neutra.
- Perigo: fundo vermelho escuro, texto claro.
- Todo controle clicável comprime para `scale(.97)` no estado ativo.

### Campos

Superfície sólida, borda neutra, raio de 8–12 px. O foco usa borda vermelha e
outline visível, sem glow.

### Tabelas

Cabeçalho discreto, linhas horizontais, números tabulares e hover suave. Evitar
cards aninhados ao redor de cada célula.

## Movimento

- Hover: 120–160 ms.
- Menu: 220 ms com curva suave e interrompível.
- Modal: até 220 ms.
- Sem animação de entrada em sequência para conteúdo normal.
- A transição atua apenas em propriedades específicas.
- `prefers-reduced-motion` reduz tudo a estado imediato.

## Responsividade

- Desktop: cabeçalho completo; conteúdo centralizado.
- Até 1000 px: categorias continuam navegáveis, placar pode ocultar.
- Até 760 px: categorias viram uma faixa horizontal abaixo do cabeçalho; busca
  ocupa a largura disponível.
- Até 560 px: ação “Novo prompt” vira botão compacto; cards ficam em uma coluna;
  padding lateral de 16 px.

## Acessibilidade

- Contraste mínimo AA.
- Foco visível com `outline`.
- Estado selecionado não depende apenas de cor.
- Targets clicáveis com pelo menos 36 px; preferir 44 px no celular.
- Drawer mantém os atributos `aria-expanded` e `aria-hidden`.

## Anti-padrões

- Imagem ou gradiente no fundo global.
- Glow neon.
- `transition: all`.
- `ease-in` em interações de UI.
- Cards pill.
- Mais de uma ação vermelha competindo na mesma seção.
- Texto sobre imagem.
- Refatorar o DOM ou a lógica de negócio apenas para alcançar aparência.
