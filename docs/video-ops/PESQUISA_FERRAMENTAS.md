# Pesquisa de ferramentas e repositórios

**Corte da pesquisa:** 31/07/2026. A atividade informada abaixo é a última release ou
atividade relevante encontrada, não uma garantia de suporte futuro. A auditoria foi
documental/estática: repositório, manifestos, releases, issues e avisos publicados.
Nenhum binário novo foi instalado ou executado, e não se afirma que um projeto seja
“livre de malware”. Antes de adotar: baixar apenas da origem oficial, validar hash ou
assinatura quando houver, analisar no Windows Security e fixar a versão.

## Resultado executivo

| Necessidade | Escolha | Estado |
|---|---|---|
| Inspeção/renderização de mídia | FFmpeg 7.1 já validado | manter |
| Corte manual sem recompressão | LosslessCut | opcional no piloto |
| Legenda com interface | Subtitle Edit 5 portátil | backup recomendado |
| Legenda automatizada | faster-whisper CPU INT8 | benchmark antes de instalar |
| Alternativa portátil de legenda | whisper.cpp | benchmark/backup |
| Detecção de cenas | PySceneDetect | adiar; só se economizar tempo |
| Corte de silêncio/movimento | auto-editor | experimento isolado |
| Download genérico | yt-dlp | não usar como padrão |
| “Melhores momentos”/diarização | WhisperX | descartar no trimestre inicial |
| Orquestrador visual | n8n | descartar no trimestre inicial |
| Publicação | ferramentas nativas das plataformas | manter humana |

## Comparação consolidada

| Ferramenta | Tecnologia/instalação | Windows/UI | Atividade observada | Dificuldade | Vale neste projeto? |
|---|---|---|---|---|---|
| [FFmpeg](https://ffmpeg.org/) | C; binário local já presente | sim; terminal | 7.1 já testado no projeto | média | sim, motor base |
| [Subtitle Edit](https://github.com/SubtitleEdit/subtitleedit) | .NET autocontido + motores opcionais | sim; GUI | 5.0.0, 22/06/2026 | baixa | sim, backup/revisão |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | Python ≥3.9, CTranslate2, PyAV | sim; terminal/API | repo ativo; requisitos atuais revisados | média | sim, após benchmark |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | C/C++, binário e modelo | sim; terminal | 1.9.1, 19/06/2026 | média | sim, alternativa |
| [OpenAI Whisper](https://github.com/openai/whisper) | Python, PyTorch, FFmpeg | sim; terminal/API | documentação ativa | média/alta | referência, não padrão |
| [LosslessCut](https://github.com/mifi/lossless-cut) | Electron/TypeScript + FFmpeg | sim; GUI | 3.68.0, 29/01/2026 | baixa | útil para corte bruto |
| [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) | Python, OpenCV/PyAV | sim; CLI/Python | 0.7, 03/05/2026 | média | opcional |
| [auto-editor](https://github.com/WyattBlue/auto-editor) | Nim/Python; binário/CLI | sim; CLI, GUI paga separada | 30.3.0, 27/05/2026 | média | só experimento |
| [WhisperX](https://github.com/m-bain/whisperX) | Python, PyTorch, wav2vec2 | possível; CLI/API | ativo | alta | não agora |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Python/binário + JS runtime/FFmpeg recomendados | sim; terminal | 2026.06.09 | média | condicional e restrito |
| [n8n](https://github.com/n8n-io/n8n) | TypeScript/Node, Docker ou cloud | sim; web | 2.30.5, 15/07/2026 | alta operacional | não agora |

## Auditoria individual

### 1. FFmpeg — recomendado e já disponível

- **Finalidade/funcionamento:** leitura de metadados, normalização, corte, crop 9:16,
  mixagem, loudness, legendas e codificação H.264/AAC por linha de comando.
- **Requisitos:** o binário 7.1 já foi validado neste computador; não instalar outro.
- **Interface:** terminal; será escondido atrás do trabalhador local.
- **Vantagens:** determinístico, maduro, scriptável e evita um editor/cloud adicional.
- **Limitações:** filtros e escaping exigem testes; corte sem recodificação depende de
  keyframes; fontes e ASS precisam viajar com o job.
- **Segurança/privacidade:** local, sem permissão de conta. Trata arquivos fornecidos;
  manter versão corrigida e nunca montar comando de shell com texto cru de usuário.
- **Termos:** neutro; legalidade depende do arquivo e codec. Não concede direito de uso.
- **Decisão:** motor único para `probe`, proxy e render final.

### 2. Subtitle Edit 5 — backup operacional recomendado

- **Finalidade/funcionamento:** gerar, editar, sincronizar e exportar legendas; integra
  Whisper original, faster-whisper e whisper.cpp, além de revisão visual.
- **Tecnologia/licença:** aplicativo autocontido; repositório MIT.
- **Windows/UI:** GUI; a versão 5 é recomendada pelo projeto para Windows 10 22H2+ e é
  autocontida. Release 5.0.0 em 22/06/2026.
- **Instalação:** preferir pacote portátil oficial; o motor e o modelo são downloads
  separados. Não ativar serviços online sem necessidade.
- **Vantagens:** amigável para quem ainda está desenvolvendo conhecimentos técnicos,
  correção de tempos/texto e saída em formatos de legenda.
- **Limitações:** o modo GUI não é a automação principal; diferentes motores opcionais
  têm requisitos próprios; versão 5 é reescrita e merece piloto antes de substituir 4.
- **Permissões/privacidade:** acesso aos vídeos e pastas escolhidos. Processamento local
  fica local; serviços opcionais enviam os dados mínimos ao provedor selecionado.
- **Segurança:** grande superfície de codecs e componentes opcionais. Baixar apenas de
  [SubtitleEdit/subtitleedit](https://github.com/SubtitleEdit/subtitleedit) e manter os
  componentes atualizados.
- **Termos:** não publica nem baixa conteúdo por conta própria no fluxo proposto.
- **Decisão:** adotar como contingência e revisão; não instalar automaticamente.

Fontes: [changelog 5.0.0](https://github.com/SubtitleEdit/subtitleedit/blob/main/Changelog.txt),
[motores de áudio para texto](https://github.com/SubtitleEdit/docs).

### 3. faster-whisper — candidato principal de transcrição

- **Finalidade/funcionamento:** implementação Whisper sobre CTranslate2; decodifica por
  PyAV, transcreve em CPU/GPU, oferece timestamps por palavra, lote e Silero VAD.
- **Tecnologia/licença:** Python, MIT; Python 3.9+.
- **Windows/UI:** biblioteca/terminal; integra-se ao trabalhador Python. Não tem GUI
  oficial central, embora existam interfaces comunitárias.
- **Instalação:** ambiente virtual isolado e versões fixadas. CPU INT8 primeiro. GPU
  atual requer CUDA 12, cuBLAS e cuDNN 9 e, por isso, está fora do piloto.
- **Vantagens:** apropriado para automação, tende a consumir menos memória/tempo que a
  implementação PyTorch e não exige FFmpeg do sistema porque PyAV traz as bibliotecas.
- **Limitações:** primeiro uso baixa modelos; precisão PT-BR depende de áudio/modelo;
  VAD pode remover fala baixa se agressivo; ecossistema Python/CTranslate2 muda.
- **Permissões/privacidade:** arquivo local; rede apenas para instalar pacote/modelo.
  Modelos devem ser baixados uma vez, registrados por hash e reutilizados offline.
- **Segurança:** dependências nativas e modelos são supply chain. Fixar Python lock,
  hashes e commit/release; não instalar diretamente de `master`.
- **Termos:** não toca plataformas; resultado continua sujeito aos direitos da mídia.
- **Decisão:** benchmarkar `small` CPU INT8; manter apenas se bater tempo/qualidade.

Fonte: [requisitos e recursos do faster-whisper](https://github.com/SYSTRAN/faster-whisper).

### 4. whisper.cpp — alternativa portátil

- **Finalidade/funcionamento:** inferência Whisper em C/C++, com modelos convertidos e
  opções quantizadas; gera legenda via CLI.
- **Tecnologia/licença:** C/C++, MIT.
- **Windows/UI:** binários Windows e terminal; pode ser usado dentro do Subtitle Edit.
- **Instalação:** binário oficial + modelo. Preferir CPU genérico até conhecer GPU.
- **Atividade:** 1.9.1 em 19/06/2026.
- **Vantagens:** runtime compacto, local e fácil de empacotar sem Python.
- **Limitações:** modelo é download separado; quantização troca precisão por tamanho;
  releases 1.8.7/1.9.0 tiveram um crash específico em builds BLAS do Windows, corrigido
  no ciclo 1.9.1 — razão para testar exatamente o artefato escolhido.
- **Permissões/privacidade:** somente arquivos/pastas escolhidos e download inicial.
- **Segurança:** validar release/hash; não usar binários recompilados de terceiros.
- **Decisão:** backup técnico do faster-whisper e motor do Subtitle Edit.

Fontes: [release 1.9.1](https://github.com/ggml-org/whisper.cpp/discussions/3895),
[issue Windows BLAS](https://github.com/ggml-org/whisper.cpp/issues/3889).

### 5. OpenAI Whisper — referência, não padrão inicial

- **Finalidade/funcionamento:** implementação original PyTorch do modelo Whisper.
- **Tecnologia/licença:** Python/PyTorch, MIT; FFmpeg necessário.
- **Windows/UI:** CLI/API, sem GUI própria.
- **Vantagens:** referência do modelo, multilíngue, modelos documentados.
- **Limitações:** instalação e memória maiores; `medium` requer cerca de 5 GB de VRAM e
  `large` cerca de 10 GB segundo o projeto; desempenho real varia por idioma/hardware.
- **Privacidade/segurança:** local, porém PyTorch e modelos aumentam a cadeia de
  dependências. O carregador oficial valida SHA-256 dos modelos.
- **Decisão:** usar como baseline de qualidade somente se o benchmark exigir.

Fonte: [README do Whisper](https://github.com/openai/whisper/blob/main/README.md?plain=1).

### 6. LosslessCut — útil para corte bruto manual

- **Finalidade/funcionamento:** marca segmentos e corta/concatena usando FFmpeg sem
  recodificar quando possível; também detecta silêncio e permite tags.
- **Tecnologia/licença:** Electron/TypeScript, GPL-2.0-only; FFmpeg empacotado.
- **Windows/UI:** GUI, pacote 7z; Windows 7/8/8.1 antigos não são mais suportados.
- **Atividade:** release assinada 3.68.0 em 29/01/2026; projeto mantido por uma pessoa.
- **Vantagens:** rápido, visual e não degrada o original em cortes brutos.
- **Limitações:** cortes podem deslocar para keyframes; pacote grande (~centenas de MB);
  não resolve crop, legendas queimadas e identidade final sem recodificação.
- **Permissões/privacidade:** lê/grava somente os arquivos escolhidos; versão de loja
  oferece atualizações automáticas, GitHub exige atualização manual.
- **Segurança:** release/commit verificados e attestation são bons sinais, não garantia.
  Electron amplia superfície; não abrir mídia não confiável fora da quarentena.
- **Termos:** não baixa/publica; neutro quanto às plataformas.
- **Decisão:** opcional para o editor humano; trabalhador continuará em FFmpeg.

Fontes: [repositório](https://github.com/mifi/lossless-cut),
[releases](https://github.com/mifi/lossless-cut/releases),
[manifesto e dependências](https://github.com/mifi/lossless-cut/blob/master/package.json).

### 7. PySceneDetect — detector de cenas, não de “melhores momentos”

- **Finalidade/funcionamento:** detecta transições por conteúdo/limiar e exporta cenas;
  não entende valor semântico, hook ou relevância.
- **Tecnologia:** Python com OpenCV/PyAV/MoviePy; Windows dispõe de distribuição pronta.
- **Windows/UI:** CLI/API; instaladores portáteis/assinados foram publicados pelo projeto.
- **Atividade:** v0.7 em 03/05/2026, release de quebra que melhora timestamps/VFR.
- **Vantagens:** gera candidatos de corte e boundaries objetivos.
- **Limitações:** dependências grandes, major release incompatível e falsos cortes em
  câmera móvel; não substitui seleção humana ou transcrição.
- **Permissões/privacidade:** local, sem contas. Dependências leem codecs e imagens.
- **Segurança:** fixar v0.7 e testar VFR; não misturar versões 0.6/0.7 da API.
- **Decisão:** adiar; ativar só se avaliação de 10 vídeos provar economia de tempo.

Fonte: [releases do PySceneDetect](https://github.com/Breakthrough/PySceneDetect/releases).

### 8. auto-editor — experimento controlado

- **Finalidade/funcionamento:** remove/acelera trechos conforme volume, movimento e
  outras regras; exporta edições. Não julga mérito editorial.
- **Tecnologia/licença:** código principalmente Nim, parte Python, Unlicense; os binários
  podem incluir componentes sob outras licenças. A GUI é proprietária e separada.
- **Windows/UI:** CLI open source; GUI não faz parte do repositório.
- **Atividade:** 30.3.0 em 27/05/2026.
- **Vantagens:** pode acelerar remoção de silêncio em gravação própria.
- **Limitações:** corta pausas expressivas, respirações e timing cômico; acrescenta outra
  linguagem/ferramenta que o FFmpeg já cobre parcialmente.
- **Privacidade/permissões:** local; arquivos de entrada/saída.
- **Segurança:** binário precisa ser validado separadamente do código; executar em cópia,
  nunca sobre o original.
- **Decisão:** não integrar. Teste manual A/B em dez vídeos próprios; descartar se a
  correção consumir o tempo economizado.

Fonte: [repositório e release](https://github.com/WyattBlue/auto-editor).

### 9. WhisperX — tecnicamente forte, operacionalmente excessivo agora

- **Finalidade:** alinhamento palavra a palavra e diarização sobre Whisper.
- **Tecnologia:** Python, PyTorch, wav2vec2 e modelos adicionais.
- **Windows/UI:** CLI/API; configuração de GPU e modelos mais complexa.
- **Vantagens:** timestamps/diarização quando há múltiplos falantes.
- **Limitações:** maior cadeia de modelos, memória, downloads e possíveis termos/tokens
  de provedores de modelos; clipes curtos de um falante não justificam a complexidade.
- **Privacidade:** pode ser local, mas modelos adicionais têm origens/licenças próprias.
- **Decisão:** descartar nos três primeiros meses; reavaliar só com erro mensurado de
  alinhamento ou demanda real de diarização.

Fontes: [WhisperX](https://github.com/m-bain/whisperX),
[artigo](https://arxiv.org/abs/2303.00747).

### 10. yt-dlp — apenas para uma exceção autorizada e permitida

- **Finalidade/funcionamento:** extrator genérico de mídia e metadados de sites.
- **Tecnologia/licença:** Python/binário; Unlicense com componentes MIT/ISC; FFmpeg e
  runtime JavaScript são recomendados para parte dos sites.
- **Windows/UI:** executável e terminal; não possui GUI oficial principal.
- **Atividade:** 2026.06.09, release com hashes, assinaturas e attestation.
- **Vantagens:** metadados, formatos e robustez em fontes que permitem esse uso.
- **Limitações:** extratores quebram com mudanças dos sites; uso em TikTok/Instagram pode
  contrariar termos mesmo quando existe autorização autoral. Autorização do criador e
  permissão técnica da plataforma são portões separados.
- **Segurança:** releases recentes corrigiram injeção via `--netrc-cmd`, criação perigosa
  de tipos de arquivo, execução via aria2c e vazamento de cookies com curl. Nunca usar
  `--exec`, `--netrc-cmd`, cookies de navegador, aria2c ou nomes de saída não sanitizados.
- **Permissões/privacidade:** pode receber cookies e executar programas, mas o fluxo deste
  projeto **proíbe** ambos. Rede e escrita ficam limitadas à fonte autorizada/quarentena.
- **Termos:** não usar para scraping ou captura automatizada de TikTok/Instagram. Preferir
  arquivo original do criador ou botão oficial de download quando habilitado.
- **Decisão:** não instalar nem integrar por padrão. Exceção aprovada caso a caso para
  fonte cujo direito e termos permitam download, sempre na última release estável.

Fontes: [release 2026.06.09](https://github.com/yt-dlp/yt-dlp/releases),
[README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md).

### 11. n8n — não recomendado nesta etapa

- **Finalidade:** orquestrador visual de APIs, webhooks e rotinas.
- **Tecnologia/licença:** TypeScript/Node, fair-code; self-host via servidor/Docker ou cloud.
- **Windows/UI:** interface web; para ficar confiável requer serviço permanente, banco,
  backups, atualização e proteção de credenciais.
- **Atividade:** 2.30.5 em 15/07/2026.
- **Vantagens:** muitos conectores e visualização de fluxos.
- **Limitações:** complexidade desproporcional a uma fila local de JSON; não remove a
  necessidade de backend, OAuth, auditorias e aprovação humana.
- **Segurança/privacidade:** concentra credenciais e acesso a arquivos. Em janeiro/2026,
  o projeto publicou correção crítica de acesso não autenticado a arquivos em certos
  workflows; isso exemplifica o custo de operar e atualizar uma instância exposta.
- **Termos:** um conector não torna scraping/postagem automaticamente permitido.
- **Decisão:** descartar no trimestre inicial. Python + pastas `jobs/results` são menores,
  auditáveis e suficientes.

Fontes: [repositório n8n](https://github.com/n8n-io/n8n),
[advisory GHSA-v4pr-fm98-w9pg](https://github.com/n8n-io/n8n/security/advisories/GHSA-v4pr-fm98-w9pg).

## Ferramentas nativas e serviços pagos

### Agendamento/publicação

- **TikTok Web Business Suite:** usar quando disponível na conta; o próprio TikTok
  descreve agenda e analytics do ambiente de negócios. Não pede que o projeto guarde
  senha/token. [Web Business Suite](https://ads.tiktok.com/help/article/navigate-web-business-suite?lang=nl)
- **Meta Business Suite/Instagram:** preferir agendamento nativo para a conta profissional
  durante o piloto. A confirmação final e URL retornam manualmente à central.
- **APIs:** adiar. A API TikTok não atende bem a um utilitário interno de republicação;
  a Meta exige servidor, tokens e URL pública da mídia.

### Editores/legendas online

CapCut, Descript, VEED, OpusClip e similares podem reduzir edição manual, mas enviam
vídeo/voz a terceiros, têm termos/limites/custos variáveis e geram dependência de
projeto proprietário. Só testar um serviço pago se:

1. o titular permitiu processamento por terceiros;
2. a política de retenção/treinamento de dados foi aceita;
3. dez vídeos mostrarem economia líquida ≥30%;
4. o projeto continua exportável em MP4 + SRT/VTT;
5. não houver login compartilhado ou automação proibida.

Nenhum serviço pago apresenta hoje vantagem comprovada sobre o conjunto já disponível:
FFmpeg + revisão humana + candidato local Whisper.

## Checklist mínimo antes de instalar qualquer repositório

1. Confirmar URL oficial, licença, release e última atividade.
2. Ler README, changelog, manifestos de dependência, issues abertas e advisories.
3. Baixar release imutável; registrar versão, URL, SHA-256 e assinatura/attestation.
4. Verificar arquivo no Windows Security; não ignorar alerta sem investigação.
5. Usar pasta/ambiente virtual isolado e usuário sem privilégios administrativos.
6. Negar cookies, tokens e pastas fora de `Projeto Automação de Vídeos`.
7. Rodar em um arquivo de quarentena, comparar hash do original e inspecionar saídas.
8. Documentar rede, arquivos e processos observados.
9. Medir ganho em dez vídeos; remover se não cumprir o critério.
10. Repetir a auditoria antes de atualizar versão.

## Comandos planejados — não executar antes do benchmark/aprovação

Os comandos abaixo são para retomada técnica; não foram executados nesta fase.

```powershell
# Ambiente isolado futuro do trabalhador
py -3.12 -m venv .video-worker-venv

# Após escolher e fixar versões/hashes em requirements.lock
.\.video-worker-venv\Scripts\python.exe -m pip install --require-hashes -r requirements.lock

# Verificações de mídia com o FFmpeg já existente
ffprobe -v error -show_streams -show_format "arquivo.mp4"
Get-FileHash -Algorithm SHA256 "arquivo.mp4"
```

O caminho real do FFmpeg deve vir da configuração validada do projeto; não duplicar
binários nem alterar globalmente o `PATH` sem necessidade.

## Auditoria de simplificação

A skill `ponytail-audit` solicitada não está disponível. A revisão manual aplicada ao
catálogo concluiu:

- escolher um motor por função, com um backup claro;
- usar o FFmpeg já instalado antes de instalar editores/servidores;
- benchmarkar legenda antes de adicionar dependências;
- impedir yt-dlp de virar captura padrão;
- não adotar n8n, WhisperX, GPU/CUDA ou serviços pagos sem dor mensurada;
- separar “projeto mantido” de “binário seguro”: ambos ainda exigem verificação local.
