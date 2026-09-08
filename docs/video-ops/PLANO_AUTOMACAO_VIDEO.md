# Plano executável — automação de conteúdo em vídeo

**Estado em 31/07/2026.** Este documento continua o trabalho registrado em
`chat-auditoria-video-ops.md`; ele não substitui nem reinicia a implementação.

## 1. Resumo do arquivo analisado

O projeto é uma central local, integrada ao site atual, para controlar dez contas
separadas por nicho, localizar conteúdo, comprovar o direito de uso, criar cortes,
gerar versões distintas para TikTok e Instagram, revisar, aprovar, publicar e medir.
A arquitetura decidida é deliberadamente incremental:

- navegador: metadados, estados, fila e auditoria;
- Google Drive para Desktop: mídia e documentos sincronizados;
- trabalhador local futuro: Python + FFmpeg, usando arquivos JSON de trabalho e
  resultado, gravação `.part` e renomeação atômica;
- publicação inicialmente manual/nativa, sempre após aprovação humana;
- backend Supabase e APIs oficiais somente quando volume e benefício justificarem.

O objetivo de volume original é pelo menos três vídeos por dia, mas não deve ser
interpretado como três vídeos por conta. No piloto, qualidade, direitos e capacidade
operacional são os gargalos. A escalada para três/dia **no total** só ocorre após os
critérios da seção 14.

## 2. Diagnóstico do trabalho anterior

### Concluído pelo Claude

1. Auditoria da versão anterior do Estúdio de Vídeo e desenho incremental da
   arquitetura navegador + Drive + trabalhador local.
2. Instalação/validação de Python 3.12.10, pip 25, FFmpeg 7.1 e Google Drive para
   Desktop em `G:\Meu Drive`; a escrita atômica no Drive foi testada.
3. Repositório Git inicializado; base anterior preservada no commit `b0f60c8`.
4. Fase 1.1 entregue no commit `4c6c90d`:
   - schema v4;
   - linhas editoriais, criadores, permissões, fontes, cortes, variantes e artefatos;
   - permissão por plataforma e validade;
   - revalidação centralizada da aprovação;
   - migração do schema v3 com backup em `pp_video_ops_v3_backup`;
   - pacote de publicação e caminho de Drive;
   - testes de domínio e de DOM.
5. Decisão registrada: um corte aprovado gera variantes TikTok e Instagram; cada
   conta pertence a uma plataforma e as contas-irmãs se ligam por linha editorial.
6. Pesquisa inicial correta sobre APIs: conexão real não é segura em um site apenas
   client-side e foi adiada.

### Incompleto ou interrompido

1. Fase 1.2: painel consolidado das dez contas, filtros cruzados e paginação simples.
2. Formatos de publicação: o campo `placement` começou a ser adicionado, mas não
   chegou ao formulário, cartões, exportações e migração compatível.
3. A suíte principal falha porque o novo campo alterou o snapshot de aprovação sem
   migrar aprovações válidas anteriores; o teste de DOM continua passando.
4. Fase 1.3: calendário editorial de sete dias e conflitos.
5. Trabalhador local: transcrição, cortes, renderização e fila ainda não existem.
6. `transcripts` e snapshots históricos de métricas ainda não fazem parte do modelo.
7. Não houve validação visual real no navegador da entrega anterior.
8. Publicação e métricas oficiais por API permanecem corretamente adiadas.

O diff interrompido foi preservado em
`docs/video-ops/checkpoints/F1.2-parcial-2026-07-31.patch` antes de qualquer ajuste.

## 3. Decisões preservadas e aperfeiçoadas

| Tema | Decisão |
|---|---|
| Arquitetura | Evoluir o site Vanilla JS; não criar servidor Node nem framework novo. |
| Segredos | Nenhum token, cookie ou chave no navegador, `localStorage`, Drive ou Git. |
| Mídia | Arquivos no Drive; `localStorage` guarda apenas metadados compactos. |
| Originais | Imutáveis; hash SHA-256 e origem registrados antes da edição. |
| Direitos | Permissão e método de obtenção são dois portões independentes. |
| Edição | Um corte mestre; uma decisão editorial própria por plataforma. |
| Publicação | Aprovação humana obrigatória; no piloto, ferramentas nativas. |
| Automação | Determinística, idempotente e local antes de serviços externos. |
| Volume | Meta futura de 3/dia total; piloto começa abaixo e escala por critérios. |
| Tendências | Sinais oficiais + planilha editorial; sem scraping automatizado. |
| Legendas | Local por padrão; revisão humana obrigatória de nomes, números e CTA. |

## 4. Evidências, hipóteses e experimentos

As recomendações abaixo usam três rótulos:

- **Confirmado:** documentação da plataforma, lei ou comportamento verificável.
- **Observacional:** correlação em uma amostra de fornecedor; não prova causalidade.
- **Experimento:** ponto de partida interno a validar nas próprias contas.

### Evidência confirmada

- O TikTok declara que interações — incluindo assistir até o fim, pular e tempo de
  exibição — costumam pesar mais que outros sinais. Portanto, retenção é um objetivo
  coerente; a plataforma não publica uma fórmula universal de ranking.
  [TikTok: como recomenda conteúdo](https://support.tiktok.com/pt_BR/using-tiktok/exploring-videos/how-tiktok-recommends-content)
- O TikTok Creative Center permite observar hashtags, músicas, criadores e vídeos
  por região e período. É fonte de descoberta, não autorização para copiar.
  [Creative Center](https://ads.tiktok.com/business/creativecenter/hashtag/find)
- A API de postagem do TikTok exige consulta atual do criador, consentimento e
  auditoria para posts públicos. Clientes não auditados ficam em `SELF_ONLY`, e as
  diretrizes rejeitam uma ferramenta interna feita para copiar conteúdo arbitrário.
  [Diretrizes de compartilhamento](https://developers.tiktok.com/doc/content-sharing-guidelines/)
- No Instagram, publicação por API é para contas profissionais; Stories têm
  restrições adicionais conforme o tipo de login/conta. Reels publicados por API
  precisam de vídeo acessível por URL pública, o que o Drive local não fornece.
  [Documentação oficial da Meta no Postman](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- O Instagram informa que Reels com mais de três minutos não serão recomendados a
  novas audiências, apesar de permitir vídeos mais longos na criação.
  [Ajuda do Instagram sobre duração](https://www.facebook.com/help/instagram/225190788256708)
- Insights de Reels incluem visualizações, tempo de exibição, tempo médio, alcance,
  curtidas, comentários, salvamentos, compartilhamentos e seguidores obtidos.
  [Ajuda do Instagram sobre insights](https://www.facebook.com/help/instagram/202865988324236?locale=en_GB)

### Evidência observacional

- Uma análise da Buffer de 11,4 milhões de TikToks encontrou o maior ganho eficiente
  ao passar de uma para duas a cinco publicações semanais; o ganho veio sobretudo de
  ampliar a chance de um resultado excepcional. É correlação, não regra do algoritmo.
  [Buffer — frequência no TikTok](https://buffer.com/resources/how-often-should-you-post-on-tiktok/)
- Em dois milhões de posts do Instagram, a mesma empresa encontrou o maior salto de
  alcance por post entre 1–2 e 3–5 publicações semanais. A seleção de contas e nichos
  limita a generalização.
  [Buffer — frequência no Instagram](https://buffer.com/resources/how-often-to-post-on-instagram/)
- Estudos de fornecedores apontam saturação crescente de vídeo curto e concentração
  das visualizações de Reels nos primeiros dias. Servem para escolher janelas de
  medição, não para prometer alcance.
  [Metricool 2025](https://metricool.com/social-media-short-video-report-2025/),
  [Socialinsider](https://www.socialinsider.io/blog/how-long-does-it-take-for-reels-to-get-views/)

### Hipóteses a testar, não fatos

1. Cortes de 15–35 s terão melhor conclusão para ideias simples; 35–60 s vencerão
   quando o contexto aumentar compartilhamentos e salvamentos.
2. TikTok aceitará ritmo visual mais rápido; Instagram recompensará uma edição mais
   limpa, capa e contexto que facilitem salvar e compartilhar.
3. Uma mudança visual a cada 1,5–3 s pode ajudar vídeos muito rápidos, mas não deve
   cortar uma frase ou apagar uma pausa com função narrativa.
4. Legenda em blocos curtos, com no máximo duas linhas, melhorará compreensão sem som.
5. O horário ótimo será encontrado por conta; horários universais não serão usados.

## 5. Modelo de produção para TikTok

### Especificação operacional inicial

- tela: 9:16, 1080×1920, H.264 + AAC, 30 fps como padrão interno;
- versão: sem marca d’água de outra rede e sem introdução com logotipo;
- duração A: 15–35 s para uma ideia ou surpresa;
- duração B: 35–60 s para explicação curta;
- abertura: a promessa, tensão, resultado ou frase mais forte nos primeiros 0–1,5 s;
- corpo: progressão sem repetição; cortes em mudanças de ideia, não em cronômetro;
- encerramento: payoff e uma ação coerente — comentar, responder ou ver a parte 2;
- legenda: queimada na variante e arquivo SRT/VTT ao lado; até duas linhas, contraste
  alto, sem cobrir rosto, mãos ou interface; conferir no preview do aplicativo;
- texto na tela: uma mensagem dominante por cena; palavras-chave, não parágrafos;
- som: voz inteligível; música apenas com licença válida para aquela conta e região;
- descoberta: TikTok Creative Center + pesquisa manual no próprio nicho, registrando
  data, país, tema, som e velocidade de crescimento; nunca copiar só por estar em alta.

### Hooks para testar

1. **Resultado primeiro:** “Isto reduziu X para Y — o detalhe foi este.”
2. **Contradição:** “O conselho comum falha quando…”
3. **Erro reconhecível:** “Se você faz X, provavelmente perde Y aqui.”
4. **Curiosidade concreta:** “Repare no que acontece aos 12 segundos.”
5. **Prova antes da tese:** mostrar o resultado e depois explicar.

Não fabricar urgência, resultado ou citação. O hook deve existir no conteúdo autorizado
ou ser uma narração editorial verdadeira.

### Métricas TikTok

- visualizações qualificadas disponíveis no painel;
- tempo médio e proporção assistida;
- conclusão/assistiu até o fim, quando disponível;
- compartilhamentos e favoritos por visualização;
- comentários substantivos por visualização;
- seguidores e visitas ao perfil atribuídos;
- origem do tráfego e pesquisa, quando disponíveis.

A Display API oficial expõe contagens públicas, mas não substitui a retenção nativa e
exige Login Kit, permissões e aprovação.
[TikTok Display API](https://developers.tiktok.com/doc/display-api-overview/)

## 6. Modelo de produção para Instagram Reels

### Especificação operacional inicial

- tela: 9:16, 1080×1920, H.264 + AAC, 30 fps como padrão interno;
- duração A: 20–45 s para descoberta;
- duração B: 45–90 s para tutorial, contexto ou história que gere salvamento;
- abertura: promessa legível em até dois segundos e contexto suficiente para quem não
  conhece a conta;
- corpo: ritmo um pouco menos frenético, espaço para compreensão e enquadramento limpo;
- capa: título curto próprio para a grade, rosto/objeto central e área segura;
- legenda: revisão visual mais sóbria, até duas linhas, sem texto nas bordas;
- encerramento: CTA de salvar, compartilhar ou seguir somente quando fizer sentido;
- distribuição: testar compartilhar no feed e, quando disponível, Trial Reels para
  validar ideias primeiro com não seguidores.

O Instagram afirma que Trial Reels são mostrados inicialmente a não seguidores; os
resultados publicados pela Meta são dados do próprio produto, não experimento
independente. [Meta — Trial Reels](https://about.fb.com/news/2025/06/inspiring-creativity-that-brings-people-together/)

### Métricas Instagram

- alcance total e de não seguidores, quando exibido;
- visualizações, tempo médio e tempo total de exibição;
- compartilhamentos, salvamentos, comentários e curtidas por alcance;
- visitas ao perfil e seguidores obtidos;
- desempenho após 1 h, 24 h e 7 dias; fechamento comparável em 30 dias.

### Diferença prática em relação ao TikTok

O corte mestre pode ser o mesmo, mas a variante não é uma simples cópia:

- TikTok: hook mais abrupto, descoberta por comportamento e linguagem mais direta;
- Reels: capa, contexto, valor de salvar/compartilhar e encaixe no perfil pesam mais na
  decisão editorial;
- áudio, texto, CTA e descrição são licenciados/escritos separadamente;
- nunca transportar marca d’água, áudio licenciado apenas numa plataforma ou elementos
  interativos próprios da outra.

## 7. Frequência e contas por nicho

1. Manter uma conta por plataforma em cada linha editorial, sem misturar nichos.
2. Começar com **uma linha piloto**: TikTok + Instagram relacionados.
3. Semanas 3–4: 3–5 posts/semana por plataforma, derivados de 3–5 cortes mestres.
4. Semanas 5–8: até 1–2 cortes mestres/dia no total se a fila estiver saudável.
5. Semanas 9–12: testar 3 cortes/dia no total, jamais 3/dia por cada uma das dez contas.
6. Abrir a segunda linha editorial somente após quatro semanas de dados úteis e os
   critérios de escala satisfeitos.

Essa rampa preserva a meta do projeto e evita transformar volume em conteúdo fraco,
risco jurídico ou fila impossível de revisar.

## 8. Descoberta de recentes, tendências e antigos virais

### Fontes permitidas

- conteúdo próprio e arquivos originais do criador;
- links/arquivos enviados pelo titular com autorização escrita;
- bibliotecas com licença compatível e comprovante salvo;
- downloads nativos quando o criador habilitou o recurso, sem burlar proteção;
- TikTok Creative Center, painéis de tendências e pesquisa manual para **sinais**, não
  para capturar automaticamente mídia alheia.

### Score editorial simples

Cada candidato recebe 0–2 em cinco critérios: atualidade, aderência ao nicho, força do
hook, possibilidade de transformação editorial e segurança de direitos. Só entra na
fila com direitos/método válidos e nota editorial mínima de 7/10.

Para recentes, registrar visualizações e idade do post e comparar a velocidade apenas
com conteúdos semelhantes. Para antigos virais, procurar ideias que continuam úteis,
confirmar novamente a permissão e criar um novo ângulo; não republicar o arquivo antigo
como se fosse novo. Nenhum limiar universal de “viral” será embutido.

## 9. Portão de direitos e conformidade

Antes de importar:

1. identificar criador/titular e URL/origem;
2. salvar o arquivo ou mensagem que prova a permissão;
3. registrar plataformas, território, monetização, período, direito de editar,
   sublicenciamento e possibilidade de revogação;
4. validar separadamente música, imagens, marcas, voz/imagem de pessoas e menores;
5. validar se o **método de download** respeita os termos da fonte;
6. calcular SHA-256 do original e marcá-lo como imutável;
7. se qualquer item estiver incerto, mandar para quarentena e não publicar.

Dar crédito ou ter baixado/comprado o arquivo não substitui autorização.
[Ajuda do Instagram sobre copyright](https://www.facebook.com/help/instagram/354736791367645?locale=en_GB),
[TikTok sobre copyright](https://support.tiktok.com/en/safety-hc/account-and-user-safety/copyright?invalid_lang=fi)

Os termos de ambas as plataformas restringem coleta automatizada sem autorização.
[Termos do TikTok](https://t.tiktok.com/legal/page/us/terms-of-service/en),
[Termos do Instagram](https://www.facebook.com/help/instagram/581066165581870)

No Brasil, uso econômico de obra e tratamento de dados pessoais exigem análise do caso,
finalidade e base adequada. Este plano não substitui parecer jurídico.
[Lei 9.610/1998](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm?rel=outbound),
[LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

Remover marca d’água só é aceitável a partir do original fornecido pelo titular e com
autorização; nunca remover para ocultar procedência, aviso de IA ou titularidade.

## 10. Legendas — comparação e decisão

| Opção | Privacidade | Automação | PT-BR | Custo | Decisão |
|---|---|---:|---|---:|---|
| OpenAI Whisper original | local | boa, Python/PyTorch | multilíngue; medir localmente | grátis | referência, mas pesado |
| faster-whisper | local | excelente, timestamps/VAD | mesma família; medir | grátis | **motor principal futuro** |
| whisper.cpp | local | boa, binário portátil | mesma família; medir | grátis | alternativa leve |
| Subtitle Edit 5 | local por padrão | assistida por GUI | permite revisão humana | grátis | **backup operacional** |
| WhisperX | local, alguns modelos externos | alta | alinhamento/diarização | grátis | adiar; complexo |
| legenda nativa das plataformas | nuvem | manual | variável | grátis | contingência, não arquivo-mestre |
| editores/serviços online | nuvem | alta | variável | freemium/pago | só se vantagem mensurada |

O Whisper original documenta modelos multilíngues e troca entre memória, velocidade e
precisão. [OpenAI Whisper](https://github.com/openai/whisper)
`faster-whisper` funciona em CPU INT8, oferece timestamps por palavra e VAD, usa Python
3.9+ e PyAV; GPU atual exige CUDA 12/cuDNN 9.
[faster-whisper](https://github.com/SYSTRAN/faster-whisper)
O Subtitle Edit oferece interface local e várias implementações Whisper.
[Documentação Subtitle Edit](https://github.com/SubtitleEdit/docs)

**Recomendação principal:** no trabalhador da Fase 2, `faster-whisper` fixado por versão,
CPU INT8 e modelo `small` como primeiro benchmark. Subir para `medium` apenas se a queda
de erros justificar o tempo e a memória. Não instalar antes do benchmark.

**Backup:** Subtitle Edit 5 portátil com `whisper.cpp`, para transcrever e corrigir pela
interface quando o trabalhador falhar ou a pessoa preferir fluxo visual.

Saídas preservadas: `transcript.json` com palavras/tempos, SRT, VTT e ASS do estilo.
A variante final contém legenda queimada, mas o texto editável nunca é descartado.

Critérios internos do benchmark de 10 minutos em PT-BR: tempo de execução, pico de RAM,
taxa de palavras erradas, nomes/números errados e desvio de sincronização. Metas iniciais
do projeto — não alegações do fornecedor —: WER ≤12% em fala limpa, ≤20% em áudio ruim e
100% de revisão de nomes, valores, datas e CTA.

## 11. Fluxo operacional completo

```text
Descoberta -> Direitos e método -> Original imutável -> Catálogo -> Transcrição
          -> Corte mestre -> Variante TikTok + variante Instagram -> Revisão
          -> Aprovação humana -> Agendamento/publicação nativa -> Métricas
          -> Comparação por conta/coorte -> próxima hipótese
```

### Estados e portões

1. **Descoberto:** metadados mínimos, ainda não baixado.
2. **Quarentena:** dúvida de direito, método, malware, formato ou identidade.
3. **Autorizado:** prova válida por plataforma/data e método permitido.
4. **Original armazenado:** hash calculado; arquivo nunca sobrescrito.
5. **Transcrito:** JSON + SRT/VTT; revisão técnica pendente.
6. **Cortado:** `inSec < outSec`, vínculo ao original e motivo editorial.
7. **Variantes prontas:** especificações e textos próprios por plataforma.
8. **Em revisão:** checklist humano de direitos, sentido, áudio, texto e safe zone.
9. **Aprovado:** snapshot sensível congelado; qualquer mudança volta a pendente.
10. **Agendado/publicado:** confirmação humana, URL e horário real registrados.
11. **Medido:** snapshots em 1 h, 24 h, 7 d e 30 d.

Falha nunca vira sucesso silencioso. Cada trabalho tem `jobId`, tentativas limitadas,
erro legível e possibilidade de retomar sem duplicar saída.

## 12. Estrutura de pastas e arquivos

Continuar a árvore já decidida, sem duplicar mídia para representar status:

```text
G:\Meu Drive\Projeto Automação de Vídeos\
├── Criadores e permissões\
│   ├── criadores\<creatorId>\
│   └── permissoes\<permissionId>\prova-original.ext
├── Fontes originais\<sourceId>\
│   ├── original.ext
│   └── manifest.json
├── Cortes mestres\<clipId>\master.mp4
├── Variantes\
│   ├── TikTok\<handle>\<YYYY>\<MM>\
│   └── Instagram\<handle>\<YYYY>\<MM>\
├── Legendas e capas\<clipId>\
│   ├── transcript.json
│   ├── legenda.srt
│   ├── legenda.vtt
│   ├── estilo.ass
│   └── capa.jpg
├── Publicados\<plataforma>\<handle>\<YYYY>\<MM>\manifest.json
├── Relatórios\metricas\<YYYY-MM-DD>.csv
├── Erros de processamento\<jobId>\erro.json
├── _jobs\pending|running|done|failed\
└── _results\<jobId>.json
```

O status vive no manifesto/sistema, não em cópias dentro de pastas “pendente” e
“aprovado”. Nome recomendado:
`<clipId>-<tema>-<plataforma>-<handle>-vNN.mp4`. O ID, não o título, garante unicidade.

## 13. Plano de automação

### Manual no começo

- descoberta e avaliação editorial;
- comprovação de direito/método;
- escolha dos trechos e hooks;
- correção da transcrição;
- revisão visual, aprovação e publicação;
- coleta das métricas que não têm exportação estável.

### Automatizar primeiro

1. criação/validação de pastas e manifestos;
2. hash, duração, codec, dimensões e detecção de duplicata;
3. extração de áudio e transcrição local;
4. geração de SRT/VTT e arquivos de revisão;
5. renderização FFmpeg com presets TikTok/Reels;
6. fila local, retries, escrita atômica e logs;
7. pacote de publicação e exportação CSV.

### Automatizar depois, se aprovado

- calendário e lembretes;
- importação por arquivo/export oficial de métricas;
- publicação via Meta somente com Supabase Edge Functions e tokens em segredo;
- TikTok apenas se o produto satisfizer o caso de uso e passar auditoria oficial.

Não automatizar: obtenção por scraping, login por robô, cookies de navegador, evasão de
limites, remoção de sinais de autoria e decisão final de publicar.

## 14. Plano de três meses

| Semana | Preparar/testar | Manual x automático | Critério de saída |
|---:|---|---|---|
| 1 | Fechar F1.2, formatos, migração e painel | código; sem mídia real | testes verdes e diff preservado |
| 2 | Paginação/filtros com 500 registros e QA no navegador | automático + QA humano | sem travar, scroll preservado |
| 3 | Árvore do Drive, formulário de direitos e 6 fontes autorizadas | direitos manual; hash automático depois | 100% com prova e origem |
| 4 | Piloto de 3–5 posts/semana por plataforma | edição e legenda GUI/manual | nenhum post sem aprovação |
| 5 | Benchmark PT-BR: faster-whisper x Subtitle Edit/whisper.cpp | ensaio local | motor escolhido por dados |
| 6 | Trabalhador: job/result, hash, probe e transcrição | automação local | reexecução sem duplicata |
| 7 | FFmpeg: mestre + duas variantes e legendas | escolha humana; render automático | ≥90% aprovadas na 1ª revisão |
| 8 | retries, `.part`, falhas, espaço e teste de fila | automático | ≥95% dos jobs sem intervenção técnica |
| 9 | Agendamento nativo e 1–2 cortes/dia total | aprovação/publicação humana | backlog <1 dia |
| 10 | snapshots 1h/24h/7d e painel comparável | coleta semi-manual | ≥90% das métricas completas |
| 11 | testes de hook, duração e legenda; remake autorizado | decisão humana | uma variável por experimento |
| 12 | teste de 3 cortes/dia total e decisão F3 | híbrido | go/no-go documentado |

### Manter, trocar ou descartar ferramenta

- **Manter:** reduz tempo/erro mensurável em pelo menos 10 vídeos, sem fragilizar
  segurança ou direitos.
- **Ajustar/trocar:** falha em >5% dos trabalhos, exige correção recorrente ou degrada
  legenda/edição em duas semanas consecutivas.
- **Descartar:** viola termos, requer cookies/segredos inseguros, fica sem manutenção
  relevante, produz resultado não auditável ou custa mais tempo do que poupa.

### Quando o projeto está funcionando

Todos estes itens precisam ser verdadeiros:

- 0 publicações sem aprovação e 100% das fontes publicadas com prova de direito;
- ≥95% dos trabalhos locais concluídos sem correção técnica manual;
- ≥90% das variantes aprovadas na primeira revisão;
- fila pendente inferior a um dia e armazenamento com pelo menos 20% livre;
- métricas de 24 h e 7 d completas em ≥90% dos posts;
- em uma coorte mínima de 20 posts comparáveis, melhoria de pelo menos 20% na métrica
  principal escolhida (retenção média ou compartilhamentos+salvamentos), sem piorar a
  taxa de incidentes;
- produzir três cortes/dia total sem ultrapassar a capacidade humana acordada.

“Viralizar” não é critério isolado: um outlier não prova que o processo funciona.

## 15. Riscos e controles

| Risco | Controle |
|---|---|
| Direito autoral/uso de imagem | prova vinculada, escopo por plataforma/data, quarentena |
| Música válida só numa rede | licença separada; trilha própria por variante |
| Scraping/violação de termos | pesquisa manual, APIs/exports oficiais, sem cookies |
| Malware/supply chain | fonte oficial, versão fixada, hash/assinatura, scan, menor privilégio |
| Segredos no frontend/Drive | nenhum OAuth agora; futuro somente Edge Function/Vault |
| Publicação errada | aprovação humana + snapshot que invalida ao editar |
| Métrica vazia tratada como zero | guardar `null` e estado “indisponível” |
| Arquivo corrompido/sincronização parcial | `.part`, flush, rename, hash e confirmação manual |
| Disco/Drive cheio | alerta antes do job; original nunca apagado automaticamente |
| Dependência complexa | recurso nativo/FFmpeg primeiro; benchmark antes de instalar |
| Conteúdo homogêneo/“fazenda” | linhas editoriais reais, transformação e revisão humana |
| IA/alteração sintética não sinalizada | campo de declaração e rótulo exigido pela plataforma |

O TikTok exige rotulagem em certos conteúdos gerados ou significativamente alterados
por IA. [TikTok — conteúdo gerado por IA](https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content?authuser=0)

## 16. Próximas ações em ordem de prioridade

1. Corrigir a compatibilidade do snapshot e completar `placement` na Fase 1.2.
2. Entregar visão consolidada, filtros cruzados e carregamento progressivo.
3. Executar testes de domínio, DOM, sintaxe e QA visual com 500 registros.
4. Pilotar uma linha editorial e seis fontes com autorização comprovada.
5. Medir manualmente o tempo real por vídeo antes de instalar transcrição adicional.
6. Benchmark de legenda PT-BR e escolha da versão fixada.
7. Construir o trabalhador local mínimo, sem publicação automática.
8. Só após 12 semanas decidir se calendário F1.3 e APIs F3 têm retorno suficiente.

## Auditoria de simplificação

A skill solicitada `ponytail-audit` não está instalada nem disponível nesta sessão. Ela
não foi simulada como se tivesse sido executada. A auditoria manual equivalente removeu
ou adiou os seguintes excessos:

- OAuth e publicação por API antes de existir backend e caso de uso aprovado;
- n8n/Docker/banco adicional para uma fila local que JSON + Python resolvem;
- scraping e download por cookies;
- dez contas ativas antes de validar uma linha piloto;
- seleção “inteligente” de melhores momentos antes de haver amostra rotulada;
- cópias de arquivos para representar estados;
- regras voláteis de plataforma embutidas no frontend;
- fotos/carrosséis no primeiro trabalhador, cujo objetivo é vídeo curto.

Esta auditoria deve ser repetida no fim de cada fase. Se `ponytail-audit` for instalada
depois, a primeira ação será auditar este plano e registrar diferenças, sem recomeçar.
