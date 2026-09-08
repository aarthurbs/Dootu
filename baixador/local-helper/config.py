"""Configuracao do baixador local. Sem logica de rede aqui."""
import shutil
from pathlib import Path

PORT = 8770

# ponytail: fora do repositorio de proposito — nenhum byte de video entra no repo.
DOWNLOAD_DIR = Path.home() / "Downloads" / "yt-dlp"


def ensure_download_dir():
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return DOWNLOAD_DIR


def yt_dlp_path():
    return shutil.which("yt-dlp")


def ffmpeg_path():
    return shutil.which("ffmpeg")
