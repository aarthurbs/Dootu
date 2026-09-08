# Registros — experimentos e aprendizados

**Criado em:** 02/08/2026 · **Estado: vazio.** Não há conta, fonte autorizada nem post
publicado. Nada aqui foi preenchido com dado inventado, e nada deve ser.

Este arquivo reúne os dois registros que crescem a cada ciclo: **experimentos editoriais**
e a **biblioteca de aprendizados**. Ficam juntos de propósito — são alimentados pelos
mesmos posts, no mesmo momento, e separá-los criaria dois arquivos vazios que ninguém abre.

Referência estável (rubrica, radar, como acionar o agente): `AGENTE_VIDEO_GROWTH_LOOP.md`.

---

## Parte 1 — Experimentos editoriais

### Regras

- **uma variável principal por experimento.** Mudar duração e hook juntos não ensina nada;
- não comparar nichos ou contas diferentes como se fossem equivalentes;
- **um viral não é vitória.** Outlier não prova processo;
- 6–10 posts por hipótese = **sinal exploratório**, nunca conclusão;
- confirmação exige pelo menos **20 posts comparáveis**;
- registrar sazonalidade, tema, duração e horário — eles confundem o resultado;
- **resultado negativo é registrado**, sempre. Experimento escondido vira crença;
- correlação não vira causalidade por insistência.

### Modelo (copiar para cada experimento)

```text
ID:                   EXP-<n>
Data de início:
Data de conclusão:
Plataforma:           TikTok | Instagram Reels        (nunca as duas no mesmo experimento)
Conta:                @handle
Nicho / linha:
Hipótese:             o que se acredita e por quê
Variável modificada:  a ÚNICA coisa que muda
Versão de controle:   como era
Versão de teste:      como ficou
Qtd. de posts:        controle _ / teste _
Métrica principal:
Métricas secundárias: até três
Resultado:            números crus, sem arredondar a favor
Limitações:           amostra, sazonalidade, tema, horário, o que não foi controlado
Nível de conclusão:   sinal exploratório | confirmado (≥20 comparáveis) | inconclusivo
Decisão:              adotar | descartar | repetir com mais amostra
Próxima hipótese:
```

### Experimentos registrados

Nenhum. O primeiro só pode começar depois de existirem posts publicados com autorização
comprovada — ver `PILOTO.md §6`.

---

## Parte 2 — Biblioteca de aprendizados

### Regra que impede o pior erro

**Não criar regra universal a partir de poucos exemplos.** Todo aprendizado carrega quantos
vídeos o sustentam, em qual conta, em qual período — e uma data para ser revisto. Um
aprendizado sem prazo de validade vira superstição operacional.

### Modelo (copiar para cada aprendizado)

```text
ID:                 APR-<n>
Padrão observado:
Categoria:          hook | duração | estrutura | ritmo | densidade de cortes |
                    legenda | bloco de texto | cor | posição do texto | capa | CTA |
                    tema | criador | horário | formato | motivo de rejeição |
                    erro jurídico | erro operacional
Vídeos observados:  quantos
Plataforma:         TikTok | Instagram Reels
Conta:              @handle
Período:            de _ até _
Evidência:          o que sustenta — número, print descrito, experimento EXP-<n>
Nível de confiança: baixo (<10 vídeos) | médio (10–19) | alto (≥20 comparáveis)
Ainda é válido?     sim | não | a verificar
Revisar em:         data
```

### Aprendizados registrados

Nenhum ainda por observação de conteúdo publicado.

Os dois itens abaixo são **aprendizados técnicos** do ciclo 1, obtidos de execução real e
não de conteúdo — ficam aqui porque são exatamente o tipo de coisa que se perde entre
sessões:

```text
ID:                 APR-T1
Padrão observado:   escrevendo em ".part", o FFmpeg não deduz o container pela extensão e
                    aborta com "Unable to choose an output format". Toda escrita atômica
                    de mídia precisa de -f <formato> explícito.
Categoria:          erro operacional (trabalhador local)
Evidência:          execução real de video-worker/make_fixtures.py em 01/08/2026
Nível de confiança: alto — reproduzido e corrigido; hoje coberto pelo harness
Ainda é válido?     sim
Revisar em:         quando o FFmpeg do projeto for atualizado
```

```text
ID:                 APR-T3
Padrão observado:   recusar uma requisição HTTP ANTES de ler o corpo enviado entrega um
                    reset de conexão, não a mensagem de erro: no Windows, fechar o socket
                    com bytes ainda por ler manda RST e o `fetch` perde a resposta, caindo
                    no catch genérico. O operador lê o motivo ERRADO ("o renderizador não
                    está ativo") com o servidor de pé. Toda recusa antecipada precisa
                    descartar o corpo (com teto) antes de responder.
Categoria:          erro operacional (ponte navegador ↔ renderizador local)
Evidência:          test_serve.py passou numa rodada e falhou na seguinte com
                    ConnectionAbortedError em 12/08/2026; corrigido em serve.py:_error →
                    _drain e coberto pelas provas 15/15b/15c
Nível de confiança: alto — reproduzido, corrigido e com teste que falha se a guarda sair
Ainda é válido?     sim
Revisar em:         se a rota passar a aceitar upload sem Content-Length (streaming)
```

```text
ID:                 APR-T4
Padrão observado:   guarda de recurso (espaço, cota, memória) tem de vir antes da MAIOR
                    escrita, não antes da última. A rota do corte conferia o disco só na
                    hora de gerar o MP4 (~10 MB) e gravava o original enviado (até 12 GB)
                    sem conferir nada. O nó `conferir_espaco` do grafo estava certo; o
                    caminho que o operador usa é que não tinha equivalente.
Categoria:          erro operacional (ordem das guardas)
Evidência:          sonda com 0 byte livre em 12/08/2026: `receive(3145728)` acontecia e
                    `ensure_space` nunca era chamado; depois da correção o inverso
Nível de confiança: alto — medido antes e depois
Ainda é válido?     sim
Revisar em:         se a fonte deixar de subir pelo HTTP (leitura direta do disco)
```

```text
ID:                 APR-T2
Padrão observado:   o pacote imageio_ffmpeg do projeto não traz ffprobe. Duração, codec e
                    resolução saem do cabeçalho que o próprio ffmpeg imprime, o que já se
                    mostrou suficiente — evitando instalar mais um binário.
Categoria:          erro operacional (dependências)
Evidência:          execução real de video-worker/make_fixtures.py em 01/08/2026
Nível de confiança: alto para mídia sintética; a verificar com mídia real variada
Ainda é válido?     sim
Revisar em:         no primeiro arquivo real cujo cabeçalho não for lido corretamente
```

---

## Parte 3 — Radar de tendências

Nenhuma tendência registrada. Modelo e fontes aceitáveis estão em
`AGENTE_VIDEO_GROWTH_LOOP.md`. Lembrete que vale repetir: **tendência não é autorização**.
