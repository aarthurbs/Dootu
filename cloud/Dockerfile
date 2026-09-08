# Imagem da ANÁLISE (Fase 1). Contexto de build = raiz do repositório:
#   docker build -f cloud/Dockerfile -t clips-probe .
#
# Sem FFmpeg de propósito: o caminho do probe nunca chama FFmpeg (worker.FFMPEG é
# só uma string montada no import). Imagem menor e uma superfície a menos.
FROM python:3.12-slim

# O yt-dlp entra como BINÁRIO no PATH — ytclip._run o chama por subprocess.
# NÃO fixar versão: o YouTube muda e yt-dlp velho quebra. Reconstruir a imagem
# quando o probe começar a falhar é a manutenção real deste serviço.
RUN pip install --no-cache-dir yt-dlp

WORKDIR /app
# Achatado: probe_server.py insere ../video-worker no sys.path só quando a pasta
# existe (dev). Aqui os 4 módulos ficam ao lado e o import resolve direto.
COPY video-worker/ytclip.py video-worker/worker.py \
     video-worker/captions.py video-worker/heatmap.py ./
COPY cloud/probe_server.py ./

# Usuário sem privilégio: o processo só precisa ler os próprios .py e falar rede.
RUN useradd --create-home --uid 10001 clips
USER clips

ENV PORT=8080
EXPOSE 8080
CMD ["python", "-u", "probe_server.py"]
