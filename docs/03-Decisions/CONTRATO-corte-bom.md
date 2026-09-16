# CONTRATO — o que é um corte bom no Dootu

**Data:** 2026-09-16 · **Vale para:** a recomendação (`video-worker/ytclip.py`) e a conferência
do operador antes de baixar.

Existe porque faltava: o repositório já tinha o
[contrato de qualidade do CLIP](CONTRATO-qualidade-clip.md), que é sobre **o arquivo** — cor,
bitrate, LUFS, enquadramento. Nada dizia o que é um corte bom **de conteúdo**, e o relato de
2026-09-16 foi exatamente esse: *"não sabemos como o corte deve ficar"*. Sem critério escrito,
cada ajuste no detector vira gosto, e gosto não se prova nem se repete.

**Uma frase:** um corte bom é **uma ideia inteira, dita por alguém, que cabe em um minuto e se
entende sem o episódio.**

---

## 1. As cinco condições

Todas obrigatórias. As quatro primeiras **reprovam** — audiência alta não resgata nenhuma delas.

| # | condição | o que reprova |
|---|---|---|
| 1 | **Abre numa frase inteira** | abrir no meio de uma oração, ou em conector solto ("mas", "então", "isso") que pendura o sentido numa fala que ficou de fora |
| 2 | **Se entende sozinho** | depender do que foi dito antes; conversa picada (troca de falante a cada linha); fala censurada ou marcada como `[risadas]`/`[música]` |
| 3 | **Diz a que vem no começo** | não dar para dizer sobre o que é; ou o assunto só aparecer depois da abertura |
| 4 | **Fecha o raciocínio** | terminar com a fala no ar, ou a última frase não concluir |
| 5 | **Cabe em 1 minuto** | ideia que não fecha dentro do teto — e aí o trecho é **descartado, nunca aparado** |

A condição 3 entrou em 2026-09-16 e é a única que olha **o que foi dito**; as outras quatro
medem a **forma**. Foi a falta dela que deixava passar trecho impecavelmente formado e sobre
coisa nenhuma — o "está ficando muito fora do assunto" do relato.

A condição 5 descarta em vez de aparar porque as duas coisas se contradizem: cortar no minuto
uma ideia que ia até 1:20 produz exatamente o defeito da condição 4. Lista menor é resultado
aceito; corte truncado não é.

---

## 2. A forma do corte

- **Duração:** mira **35 s**, teto suave da história **45 s**, teto duro **60 s**, piso **15 s**.
  Ideia forte de 25 s é um corte; história completa de 45 s é outro. **Não existe duração
  padrão** — corte do mesmo tamanho toda vez é cronômetro, não edição.
- **Bordas:** no instante da **palavra** quando a legenda traz tempo por palavra; na fala
  inteira quando não traz. O card diz qual dos dois foi.
- **Respiro:** o corte não começa no ataque da consoante nem termina na última sílaba — e o
  respiro só ocupa silêncio que **já existe**, nunca invade a fala vizinha.
- **Título:** sai da fala escolhida, ou do capítulo quando o corte **abre** nele. Nunca do
  título do vídeo.

---

## 3. O que NÃO é critério

- **Audiência não decide.** O gráfico de "Mais reproduzidos" vale **no máximo 12 dos 100
  pontos** e entra **depois** dos vetos: pico alto autoriza *procurar* um momento completo por
  perto, nunca *aprovar* um trecho incoerente. Na abertura do vídeo o sinal ainda leva desconto,
  porque ali ele mede carregamento de página.
- **A nota não é previsão.** Os 0–100 existem para **ordenar a lista**, e por isso o card mostra
  a palavra ("Recomendado", "Bom candidato", "Vale conferir") e não o número. O Estúdio não mede
  audiência futura e não deve escrever nada que sugira isso.
- **Categoria é palpite da legenda**, não medição — e aparece dita assim.

---

## 4. Onde cada regra mora

Fonte da verdade é o código; esta tabela é o mapa, e nota que discordar do arquivo está errada.

| condição | no código | constante |
|---|---|---|
| 1. abre em frase inteira | `_window` (recuo até início firme) + fator `abertura` | `FRASE_PAUSA_SEC`, `FECHO_PAUSA_SEC`, `DANGLING_OPENERS` |
| 2. se entende sozinho | fator `independencia` | `NAO_FALA_POR_MIN`, `TROCA_POR_MIN` |
| 3. diz a que vem | `_assunto_de` + fator `assunto` | `ASSUNTO_FRASES_ABERTURA`, `ASSUNTO_GANCHO_MIN`, `CATEGORY_LEXICON`, `HOOK_PATTERNS` |
| 4. fecha o raciocínio | `_fecha_ideia` + fator `fecho` | `CLOSE_PAUSE_SEC`, `STORY_CLIP_SEC` |
| 5. cabe em 1 minuto | teto do laço do `_window` + guarda do `_candidates` | `MAX_CLIP_SEC`, `MAX_FALA_SEC` |
| audiência com teto | `_interesse_de` + `avaliar` | `INTERESSE_PESO`, `ABERTURA_VIDEO_SEC` |
| descarte explicado | `_resumo_reprovas` | `REPROVA_LABEL` |

Pesos: `abertura` 18 · `independencia` 15 · `assunto` 16 · `desenvolvimento` 13 · `fecho` 18 ·
`confiabilidade` 8 — somam 88, mais 12 de audiência. Provas em `test_ytclip.py`, blocos **25**
(teto) e **26** (assunto).

---

## 5. O que o operador confere antes de baixar

1. **A primeira fala** orienta quem chega agora? (é o que decide nos primeiros segundos)
2. **A última fala** termina a ideia, ou ficou frase pela metade?
3. **Dá para dizer o assunto** ouvindo só o trecho?
4. A duração no card é a que se quer publicar?

Se a lista saiu curta ou vazia, a tela diz por quê — "descartei 7 porque começavam no meio da
ideia" e "não achei nada" são coisas diferentes, e recurso que reprova calado é indistinguível
de recurso quebrado.

---

## 6. Fora deste contrato, de propósito

- Legenda, enquadramento, cor, áudio e render: são do
  [contrato de qualidade do clip](CONTRATO-qualidade-clip.md).
- Rastreamento de falante e detecção de corte de câmera.
- Previsão de desempenho, gancho "viral", promessa de alcance — o Estúdio não mede isso e não
  deve fingir que mede.
- O que funcionou **depois de publicado**: isso é do vault `Cortes`, não deste repositório.
