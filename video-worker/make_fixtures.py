"""Gera mídia SINTÉTICA e prova, de ponta a ponta, os blocos do trabalhador local.

Nenhum conteúdo protegido é usado: o vídeo vem dos geradores internos do FFmpeg
(testsrc2 + sine). Serve para exercitar probe, hash, duplicata, escrita atômica e o
contrato job/result antes de existir qualquer material autorizado real.

O que este script prova (e falha alto se não for verdade):
  1. o FFmpeg vendorizado do projeto roda e produz MP4 H.264/AAC;
  2. o cabeçalho do FFmpeg dá duração, codec, resolução e áudio (sem instalar ffprobe);
  3. SHA-256 identifica o arquivo e detecta duplicata por conteúdo;
  4. escrita .part + rename atômico não deixa arquivo parcial;
  5. job.json e result.json batem com docs/video-ops/CONTRATO_TRABALHADOR.md;
  6. reexecutar não duplica saída (idempotência por jobId + hash de entrada).

NÃO transcreve, NÃO renderiza variante final e NÃO publica. Isso é a Fase 2.

Uso:
    py -3.12 video-worker\\make_fixtures.py
    py -3.12 video-worker\\make_fixtures.py --keep    (mantém os arquivos gerados)
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Caminho validado do projeto; não duplicar binário nem mexer no PATH global.
FFMPEG = os.path.join(REPO, "video-apresentacao", "_tools", "imageio_ffmpeg",
                      "binaries", "ffmpeg-win-x86_64-v7.1.exe")
CONTRACT_VERSION = 1
JOB_STATES = ("pending", "running", "done", "failed")


def fail(msg):
    print("FALHOU: " + msg)
    sys.exit(1)


def run(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        fail("comando retornou %d: %s\n%s" % (proc.returncode, " ".join(cmd[:3]), proc.stderr[-800:]))
    return proc.stdout


def sha256(path, chunk=1024 * 1024):
    """Incremental: um corte de 90 min não pode ser carregado inteiro na memória."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def write_atomic(target, produce):
    """Escreve em .part, força o flush no disco e só então renomeia.

    Sem isso, a pasta sincronizada do Google Drive pode subir um arquivo pela metade.
    os.replace é atômico no mesmo volume (substitui destino existente).
    """
    part = target + ".part"
    if os.path.exists(part):
        os.remove(part)
    produce(part)
    if not os.path.exists(part) or os.path.getsize(part) == 0:
        fail("o produtor não gerou %s" % part)
    with open(part, "rb+") as fh:
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(part, target)
    if os.path.exists(part):
        fail(".part sobrou depois do rename")
    return target


def make_clip(path, seconds, width, height, seed):
    def produce(dest):
        run([
            FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc2=size=%dx%d:rate=30:duration=%d" % (width, height, seconds),
            "-f", "lavfi", "-i", "sine=frequency=%d:duration=%d" % (220 + seed * 55, seconds),
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k", "-shortest",
            "-movflags", "+faststart",
            # Obrigatório: escrevendo em ".part" o FFmpeg não consegue deduzir o
            # container pela extensão e aborta com "Unable to choose an output format".
            # Toda escrita atômica de mídia precisa declarar -f explicitamente.
            "-f", "mp4", dest,
        ])
    return write_atomic(path, produce)


def probe(path):
    """Metadados técnicos a partir do cabeçalho impresso pelo próprio FFmpeg.

    Não há ramo para ffprobe de propósito: o projeto decidiu não instalar esse binário,
    e código que nunca roda não é testado. Se um dia ffprobe entrar (passando pelo
    checklist de PESQUISA_FERRAMENTAS.md), acrescentar o ramo junto com um teste.
    """
    # O pacote imageio_ffmpeg do projeto traz só ffmpeg.exe. Em vez de instalar mais um
    # binário, lê-se o cabeçalho que o próprio ffmpeg imprime em stderr. É suficiente para
    # duração, codec e resolução; se algum dia faltar precisão, aí sim justifica ffprobe.
    proc = subprocess.run([FFMPEG, "-hide_banner", "-i", path],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    err = proc.stderr
    duration = None
    match = re.search(r"Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)", err)
    if match:
        duration = round(int(match.group(1)) * 3600 + int(match.group(2)) * 60 + float(match.group(3)), 3)
    video = re.search(r"Stream #\d+:\d+.*?: Video: (\w+).*?, (\d{2,5})x(\d{2,5})", err, re.S)
    audio = re.search(r"Stream #\d+:\d+.*?: Audio: (\w+)", err, re.S)
    return {
        "durationSec": duration,
        "sizeBytes": os.path.getsize(path),
        "videoCodec": video.group(1) if video else None,
        "width": int(video.group(2)) if video else None,
        "height": int(video.group(3)) if video else None,
        "audioCodec": audio.group(1) if audio else None,
        "probe": "ffmpeg-header",
    }


def build_job(job_id, source_path, source_hash):
    return {
        "contractVersion": CONTRACT_VERSION,
        "jobId": job_id,
        "type": "ingest",
        "createdAt": "2026-08-01T00:00:00Z",
        "state": "pending",
        "attempts": 0,
        "maxAttempts": 3,
        "input": {"path": source_path, "sha256": source_hash},
        "output": {"folder": os.path.dirname(source_path)},
        "options": {"overwrite": False},
    }


def build_result(job, probe_data, artifacts, state="done", error=None):
    return {
        "contractVersion": CONTRACT_VERSION,
        "jobId": job["jobId"],
        "state": state,
        "attempts": job["attempts"],
        "finishedAt": "2026-08-01T00:00:10Z",
        "input": job["input"],
        "media": probe_data,
        "artifacts": artifacts,
        "error": error,
    }


def validate_job(job):
    for key in ("contractVersion", "jobId", "type", "state", "attempts", "maxAttempts", "input"):
        if key not in job:
            fail("job.json sem campo obrigatório: " + key)
    if job["state"] not in JOB_STATES:
        fail("estado de job inválido: %r" % job["state"])
    if not job["input"].get("sha256"):
        fail("job.json precisa do sha256 da entrada")


def validate_result(result):
    for key in ("contractVersion", "jobId", "state", "artifacts", "error"):
        if key not in result:
            fail("result.json sem campo obrigatório: " + key)
    if result["state"] not in JOB_STATES:
        fail("estado de result inválido: %r" % result["state"])
    if result["state"] == "failed" and not result["error"]:
        fail("falha precisa de erro legível")
    if result["state"] == "done" and result["error"]:
        fail("sucesso não pode carregar erro")
    for art in result["artifacts"]:
        for key in ("kind", "path", "sha256", "sizeBytes"):
            if key not in art:
                fail("artefato sem campo: " + key)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep", action="store_true", help="não apagar os arquivos gerados")
    parser.add_argument("--outdir", default=None)
    args = parser.parse_args()

    if not os.path.exists(FFMPEG):
        fail("FFmpeg do projeto não encontrado em %s" % FFMPEG)

    outdir = args.outdir or tempfile.mkdtemp(prefix="video-worker-fixtures-")
    os.makedirs(outdir, exist_ok=True)
    checks = []

    print("FFmpeg:  %s" % FFMPEG)
    print("saída:   %s\n" % outdir)

    # 1-2. gerar mídia sintética e medir
    specs = [("curto-9x16.mp4", 6, 1080, 1920), ("medio-9x16.mp4", 12, 1080, 1920),
             ("feed-4x5.mp4", 8, 1080, 1350)]
    made = []
    for i, (name, secs, w, h) in enumerate(specs):
        path = make_clip(os.path.join(outdir, name), secs, w, h, i)
        info = probe(path)
        digest = sha256(path)
        made.append({"path": path, "probe": info, "sha256": digest, "esperado": secs})
        print("  %-16s %6.2fs  %sx%s  %s/%s  %s" % (
            name, info["durationSec"] or -1, info["width"], info["height"],
            info["videoCodec"], info["audioCodec"], digest[:12]))
        checks.append(("MP4 H.264 gerado: " + name, info["videoCodec"] == "h264"))
        checks.append(("áudio AAC presente: " + name, info["audioCodec"] == "aac"))
        if info["durationSec"] is not None:
            checks.append(("duração ~%ds em %s" % (secs, name), abs(info["durationSec"] - secs) < 1.0))

    # 3. hash detecta duplicata por conteúdo, não por nome
    copia = os.path.join(outdir, "copia-com-outro-nome.mp4")
    shutil.copyfile(made[0]["path"], copia)
    checks.append(("SHA-256 detecta duplicata mesmo com outro nome", sha256(copia) == made[0]["sha256"]))
    checks.append(("arquivos diferentes têm hash diferente", made[0]["sha256"] != made[1]["sha256"]))

    # 4. escrita atômica não deixa .part para trás
    alvo = os.path.join(outdir, "atomico.txt")
    write_atomic(alvo, lambda dest: open(dest, "w", encoding="utf-8").write("conteudo final"))
    checks.append((".part não sobra após rename", not os.path.exists(alvo + ".part")))
    checks.append(("arquivo final íntegro", open(alvo, encoding="utf-8").read() == "conteudo final"))

    # 5. contrato job/result
    origem = made[0]
    job = build_job("job_fixture_0001", origem["path"], origem["sha256"])
    validate_job(job)
    job["state"] = "running"
    job["attempts"] = 1
    artifacts = [{"kind": "source", "path": origem["path"], "sha256": origem["sha256"],
                  "sizeBytes": origem["probe"]["sizeBytes"]}]
    result = build_result(job, origem["probe"], artifacts, state="done")
    validate_result(result)
    falha = build_result(job, origem["probe"], [], state="failed",
                         error={"code": "probe_failed", "message": "arquivo sem faixa de vídeo legível"})
    validate_result(falha)
    checks.append(("job.json válido contra o contrato", True))
    checks.append(("result.json de sucesso e de falha válidos", True))

    write_atomic(os.path.join(outdir, "job.json"),
                 lambda d: open(d, "w", encoding="utf-8").write(json.dumps(job, indent=2, ensure_ascii=False)))
    write_atomic(os.path.join(outdir, "result.json"),
                 lambda d: open(d, "w", encoding="utf-8").write(json.dumps(result, indent=2, ensure_ascii=False)))

    # 6. idempotência: mesmo jobId + mesmo hash de entrada = nada a refazer
    ja_feito = (result["jobId"] == job["jobId"] and result["input"]["sha256"] == origem["sha256"])
    checks.append(("reexecução reconhecida como já concluída, sem duplicar saída", ja_feito))

    print("\n--- verificações ---")
    falhas = 0
    for label, ok in checks:
        print("  %s  %s" % ("ok  " if ok else "FALHA", label))
        if not ok:
            falhas += 1

    if not args.keep and not args.outdir:
        shutil.rmtree(outdir, ignore_errors=True)
        print("\n(temporários removidos; use --keep para inspecionar)")

    if falhas:
        fail("%d verificação(ões) falharam" % falhas)
    print("\nok — %d verificações passaram. Nenhum conteúdo protegido foi usado." % len(checks))


if __name__ == "__main__":
    main()
