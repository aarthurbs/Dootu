"""Provas do trabalhador local, ponta a ponta, com mídia SINTÉTICA.

Nenhum conteúdo protegido é usado: o vídeo vem dos geradores internos do FFmpeg
(testsrc2 + sine). Complementa make_fixtures.py, que prova os blocos do contrato; aqui o
alvo é o worker.py de verdade — validação, sandbox de caminho, recorte, render vertical,
escrita atômica, espaço em disco, idempotência e isolamento de falha entre variantes.

O que este script prova (e falha alto se não for verdade):
   1. arquivo inexistente             -> input_missing
   2. caminho fora da raiz            -> path_outside_root (absoluto externo, .., destino)
   3. vídeo sem faixa de áudio        -> renderiza e RELATA a ausência, sem travar
   4. arquivo inválido/corrompido     -> probe_failed
   5. início/fim inválido             -> cut_invalid (negativo, invertido, além do fim, NaN, inf)
   6. corte de 15s                    -> duração dentro da tolerância declarada
   7. corte de 30s                    -> duração dentro da tolerância declarada
   8. saída 1080x1920                 -> conferido no cabeçalho do arquivo gerado
   9. H.264 + AAC                     -> conferido no cabeçalho do arquivo gerado
  10. escrita atômica                 -> .part não sobra no sucesso nem na falha
  11. falta de espaço                 -> no_space ANTES de produzir arquivo
  12. reexecução                      -> não duplica nem regrava (idempotência)
  13. falha isolada de uma variante   -> as outras três continuam válidas
  14. entrada apontando p/ variante   -> input_not_source (sem recodificação em cascata)

Uso:
    py -3.12 video-worker\\test_worker.py
    py -3.12 video-worker\\test_worker.py --keep   (mantém a raiz temporária p/ inspeção)
"""

import argparse
import json
import os
import re
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import captions  # noqa: E402  (modulo PURO: so para FONTE_DIR/FONTE_ARQUIVO)
import worker  # noqa: E402

CHECKS = []


def check(label, ok):
    CHECKS.append((label, bool(ok)))
    return bool(ok)


def fail(msg):
    print("FALHOU: " + msg)
    sys.exit(1)


def make_source(path, seconds, width, height, audio=True):
    """Original sintético. Horizontal de propósito: é o caso que exercita o 9:16."""
    def produce(dest):
        args = ["-hide_banner", "-loglevel", "error", "-y",
                "-f", "lavfi", "-i",
                "testsrc2=size=%dx%d:rate=30:duration=%d" % (width, height, seconds)]
        if audio:
            args += ["-f", "lavfi", "-i", "sine=frequency=330:duration=%d" % seconds]
        args += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
        args += (["-c:a", "aac", "-b:a", "96k", "-shortest"] if audio else ["-an"])
        args += ["-movflags", "+faststart", "-f", "mp4", dest]
        worker.run_ffmpeg(args)
    return worker.write_atomic(path, produce)


def build_job(job_id, job_type, rel_input, digest, folder=None, file_name=None, options=None):
    return {
        "contractVersion": 1, "jobId": job_id, "type": job_type,
        "createdAt": "2026-08-03T00:00:00Z", "state": "pending",
        "attempts": 0, "maxAttempts": 3,
        "input": {"path": rel_input, "sha256": digest},
        "output": {"folder": folder or ".", "fileName": file_name or (job_id + ".mp4")},
        "options": options or {"overwrite": False},
    }


def run(job, root, reserve_bytes=0):
    result, _ = worker.process_job(job, root, "2026-08-03T00:00:10Z", reserve_bytes)
    return result


def err_code(result):
    return (result.get("error") or {}).get("code")


def variant_options(variant_id, in_sec, out_sec, reframe, platform, target):
    return {"inSec": in_sec, "outSec": out_sec, "reframe": reframe, "variantId": variant_id,
            "platform": platform,
            "placement": "tiktok_video" if platform == "tiktok" else "ig_reels",
            "renderVersion": 1, "targetSec": target, "overwrite": False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep", action="store_true")
    args = parser.parse_args()

    if not os.path.exists(worker.FFMPEG):
        fail("FFmpeg do projeto não encontrado em %s" % worker.FFMPEG)

    root = tempfile.mkdtemp(prefix="video-worker-testes-")
    fontes = os.path.join(root, "Fontes originais")
    variantes = os.path.join(root, "Variantes")
    pending = os.path.join(root, "_jobs", "pending")
    for folder in (fontes, variantes, pending):
        os.makedirs(folder, exist_ok=True)
    fora = tempfile.mkdtemp(prefix="video-worker-fora-")

    print("FFmpeg: %s" % worker.FFMPEG)
    print("raiz:   %s" % root)
    print("fora:   %s\n" % fora)

    # ---------------------------------------------------------------- mídia sintética
    src = make_source(os.path.join(fontes, "aula-horizontal.mp4"), 45, 1280, 720, audio=True)
    src_rel = "Fontes originais/aula-horizontal.mp4"
    src_sha = worker.sha256(src)
    mudo = make_source(os.path.join(fontes, "sem-audio.mp4"), 20, 1280, 720, audio=False)
    mudo_sha = worker.sha256(mudo)
    info = worker.probe(src)
    print("  original  %.2fs  %sx%s  %s/%s" % (info["durationSec"], info["width"], info["height"],
                                               info["videoCodec"], info["audioCodec"]))
    check("original sintético é horizontal (exercita a conversão 9:16)",
          info["width"] > info["height"])
    check("original sintético tem áudio", info["audioCodec"] == "aac")

    # ---------------------------------------------------------------- 1. inexistente
    r = run(build_job("t_inexistente", "ingest", "Fontes originais/nao-existe.mp4", src_sha), root)
    check("1. arquivo inexistente -> input_missing", err_code(r) == "input_missing")
    check("1. falha traz mensagem legível em português",
          "não encontrado" in (r["error"]["message"] or ""))
    check("1. falha nunca vira sucesso silencioso", r["state"] == "failed" and not r["artifacts"])

    # ---------------------------------------------------------------- 2. fora da raiz
    externo = os.path.join(fora, "externo.mp4")
    shutil.copyfile(src, externo)
    r = run(build_job("t_absoluto", "ingest", externo, worker.sha256(externo)), root)
    check("2. caminho absoluto externo -> path_outside_root", err_code(r) == "path_outside_root")
    r = run(build_job("t_travessia", "ingest", "Fontes originais/../../externo.mp4", src_sha), root)
    check("2. travessia com .. -> path_outside_root", err_code(r) == "path_outside_root")
    for bruto in ("..", "../vizinho.mp4", os.path.join(fora, "externo.mp4")):
        try:
            worker.inside_root(root, bruto, "teste")
            check("2. inside_root recusa %r" % bruto, False)
        except worker.WorkerError as exc:
            check("2. inside_root recusa %r" % bruto, exc.code == "path_outside_root")
    check("2. inside_root aceita caminho relativo legítimo",
          worker.inside_root(root, src_rel, "teste") == os.path.realpath(src))
    r = run(build_job("t_saida_fora", "render_variant", src_rel, src_sha, folder=fora,
                      file_name="x.mp4",
                      options=variant_options("var_x", 0, 3, "crop", "tiktok", 3)), root)
    check("2. destino fora da raiz -> path_outside_root", err_code(r) == "path_outside_root")

    # ---------------------------------------------------------------- 4. inválido
    quebrado = os.path.join(fontes, "quebrado.mp4")
    with open(quebrado, "wb") as handle:
        handle.write(b"isto nao e um mp4" * 100)
    r = run(build_job("t_invalido", "ingest", "Fontes originais/quebrado.mp4",
                      worker.sha256(quebrado)), root)
    check("4. arquivo inválido -> probe_failed", err_code(r) == "probe_failed")
    vazio = os.path.join(fontes, "vazio.mp4")
    open(vazio, "wb").close()
    r = run(build_job("t_vazio", "ingest", "Fontes originais/vazio.mp4", "0" * 64), root)
    check("4. arquivo vazio -> input_empty", err_code(r) == "input_empty")

    # ---------------------------------------------------------------- hash e contrato
    r = run(build_job("t_hash", "ingest", src_rel, "f" * 64), root)
    check("hash divergente -> hash_mismatch", err_code(r) == "hash_mismatch")
    r = run(build_job("t_ingest", "ingest", src_rel, src_sha), root)
    check("ingest válido -> done", r["state"] == "done" and not r["error"])
    check("ingest mede duração, codec, resolução e áudio",
          r["media"]["durationSec"] > 44 and r["media"]["videoCodec"] == "h264"
          and r["media"]["width"] == 1280 and r["media"]["audioCodec"] == "aac")
    check("ingest calcula o SHA-256 da entrada", r["artifacts"][0]["sha256"] == src_sha)
    versao_errada = build_job("t_contrato", "ingest", src_rel, src_sha)
    versao_errada["contractVersion"] = 99
    check("contractVersion diferente -> contract_version",
          err_code(run(versao_errada, root)) == "contract_version")
    # O sha256 da entrada é obrigatório em render_variant e opcional em ingest: é o
    # próprio ingest que o calcula (esclarecimento do contrato §3/§6).
    sem_hash = build_job("t_sem_hash", "render_variant", src_rel, src_sha, folder="Variantes",
                         file_name="sem-hash.mp4",
                         options=variant_options("var_sh", 0, 3, "crop", "tiktok", 3))
    sem_hash["input"].pop("sha256")
    check("render sem sha256 da entrada -> job_invalid",
          err_code(run(sem_hash, root)) == "job_invalid")
    check("render sem sha256 não produz arquivo",
          not os.path.exists(os.path.join(variantes, "sem-hash.mp4")))
    ingest_sem_hash = build_job("t_ingest_sem_hash", "ingest", src_rel, src_sha)
    ingest_sem_hash["input"].pop("sha256")
    r = run(ingest_sem_hash, root)
    check("ingest sem sha256 é aceito (é ele que calcula o hash)",
          r["state"] == "done" and r["artifacts"][0]["sha256"] == src_sha)
    r = run(build_job("t_transcribe", "transcribe", src_rel, src_sha), root)
    check("tipo do contrato ainda não implementado -> unsupported_type",
          err_code(r) == "unsupported_type" and not r["artifacts"])

    # ---------------------------------------------------------------- 5. recorte inválido
    casos = [
        ("negativo", {"inSec": -5, "outSec": 10}),
        ("invertido", {"inSec": 20, "outSec": 10}),
        ("iguais", {"inSec": 12, "outSec": 12}),
        ("alem-da-duracao", {"inSec": 10, "outSec": 999}),
        ("nan", {"inSec": float("nan"), "outSec": 10}),
        ("infinito", {"inSec": 0, "outSec": float("inf")}),
        ("texto", {"inSec": "abc", "outSec": 10}),
        ("ausente", {}),
    ]
    for rotulo, corte in casos:
        opts = variant_options("var_bad", 0, 3, "crop", "tiktok", 3)
        opts.pop("inSec")
        opts.pop("outSec")
        opts.update(corte)
        r = run(build_job("t_corte_" + rotulo, "render_variant", src_rel, src_sha,
                          folder="Variantes", file_name="nao-deve-existir.mp4",
                          options=opts), root)
        check("5. recorte %s -> cut_invalid" % rotulo, err_code(r) == "cut_invalid")
    check("5. recorte inválido não deixa arquivo para trás",
          not os.path.exists(os.path.join(variantes, "nao-deve-existir.mp4")))

    # ---------------------------------------------------------------- 11. falta de espaço
    livre = shutil.disk_usage(variantes).free
    r = run(build_job("t_espaco", "render_variant", src_rel, src_sha, folder="Variantes",
                      file_name="sem-espaco.mp4",
                      options=variant_options("var_e", 0, 5, "crop", "tiktok", 5)),
            root, reserve_bytes=livre + 10 ** 9)
    check("11. espaço insuficiente -> no_space", err_code(r) == "no_space")
    check("11. no_space acontece ANTES de produzir arquivo",
          not os.path.exists(os.path.join(variantes, "sem-espaco.mp4")))

    # ---------------------------------------------------------------- 10. escrita atômica
    alvo = os.path.join(variantes, "atomico.txt")

    def explode(dest):
        with open(dest, "w", encoding="utf-8") as handle:
            handle.write("metade")
        raise RuntimeError("falha simulada no meio da produção")
    try:
        worker.write_atomic(alvo, explode)
        check("10. produtor que falha propaga o erro", False)
    except RuntimeError:
        check("10. produtor que falha propaga o erro", True)
    check("10. falha no meio não deixa .part", not os.path.exists(alvo + ".part"))
    check("10. falha no meio não cria o arquivo final", not os.path.exists(alvo))
    worker.write_atomic(alvo, lambda d: open(d, "w", encoding="utf-8").write("final"))
    check("10. sucesso remove o .part", not os.path.exists(alvo + ".part"))
    check("10. arquivo final íntegro", open(alvo, encoding="utf-8").read() == "final")

    # ------------------------------------------ 3. sem áudio + 6/7/8/9 as quatro variantes
    r = run(build_job("t_mudo", "render_variant", "Fontes originais/sem-audio.mp4", mudo_sha,
                      folder="Variantes", file_name="mudo-vertical.mp4",
                      options=variant_options("var_mudo", 2, 7, "blur", "tiktok", 5)), root)
    check("3. original sem áudio renderiza sem travar", r["state"] == "done")
    if r["state"] == "done":
        art = r["artifacts"][0]
        check("3. ausência de áudio é RELATADA, não inventada",
              art["audioCodec"] is None
              and "não tem faixa de áudio" in (r.get("notes") or {}).get("audio", ""))
        check("3. vídeo sem áudio ainda sai 1080x1920",
              art["width"] == 1080 and art["height"] == 1920)

    matriz = [
        ("job_render_var_t15_v1", "var_t15", 5.0, 20.0, "blur", "tiktok", 15),
        ("job_render_var_i15_v1", "var_i15", 5.0, 20.0, "crop", "instagram", 15),
        ("job_render_var_t30_v1", "var_t30", 10.0, 40.0, "blur", "tiktok", 30),
        ("job_render_var_i30_v1", "var_i30", 10.0, 40.0, "crop", "instagram", 30),
    ]
    produzidos = {}
    for job_id, var_id, ini, fim, reframe, plataforma, alvo_seg in matriz:
        nome = "%s-%s-v1.mp4" % (var_id, plataforma)
        r = run(build_job(job_id, "render_variant", src_rel, src_sha, folder="Variantes",
                          file_name=nome,
                          options=variant_options(var_id, ini, fim, reframe, plataforma, alvo_seg)),
                root)
        rotulo = "%s %ds (%s)" % (plataforma, alvo_seg, reframe)
        if not check("6/7. render %s concluído" % rotulo, r["state"] == "done"):
            print("      erro: %s" % (r.get("error") or {}))
            continue
        art = r["artifacts"][0]
        produzidos[var_id] = os.path.join(root, art["path"].replace("/", os.sep))
        esperado = fim - ini
        print("  %-26s %6.3fs  %sx%s  %s/%s  %s" % (
            rotulo, art["durationSec"], art["width"], art["height"],
            art["videoCodec"], art["audioCodec"], art["sha256"][:12]))
        check("6/7. duração de %s dentro de +-%.2fs" % (rotulo, worker.TOLERANCE_SEC),
              abs(art["durationSec"] - esperado) <= worker.TOLERANCE_SEC)
        check("8. %s sai 1080x1920" % rotulo, art["width"] == 1080 and art["height"] == 1920)
        check("9. %s é H.264/AAC" % rotulo,
              art["videoCodec"] == "h264" and art["audioCodec"] == "aac")
        check("%s registra tamanho, caminho e SHA-256" % rotulo,
              art["sizeBytes"] > 0 and art["path"] and len(art["sha256"]) == 64)
        check("%s nasce do original (sourceSha256 confere)" % rotulo,
              art["sourceSha256"] == src_sha)
        check("%s não deixa .part" % rotulo, not os.path.exists(produzidos[var_id] + ".part"))

    check("as 4 variantes são arquivos independentes", len(set(produzidos.values())) == 4)
    if len(produzidos) == 4:
        hashes = set(worker.sha256(caminho) for caminho in produzidos.values())
        check("TikTok e Instagram são arquivos distintos (nenhum é cópia do outro)",
              len(hashes) == 4)
    check("original permanece intocado", worker.sha256(src) == src_sha)

    # ---------------------------------------------- 14. variante nunca serve de entrada
    if produzidos:
        algum = next(iter(produzidos.values()))
        rel = os.path.relpath(algum, root).replace("\\", "/")
        r = run(build_job("t_cascata", "render_variant", rel, worker.sha256(algum),
                          folder="Variantes", file_name="cascata.mp4",
                          options=variant_options("var_c", 0, 3, "crop", "instagram", 3)), root)
        check("14. entrada apontando para variante -> input_not_source",
              err_code(r) == "input_not_source")

    # ---------------------------------------------------------------- 12. idempotência
    if "var_t15" in produzidos:
        job_id = "job_render_var_t15_v1"
        caminho = produzidos["var_t15"]
        job = build_job(job_id, "render_variant", src_rel, src_sha, folder="Variantes",
                        file_name=os.path.basename(caminho),
                        options=variant_options("var_t15", 5.0, 20.0, "blur", "tiktok", 15))
        # O result gravado é a memória da idempotência (contrato §6): o atalho só existe
        # quando _results/<jobId>.json já está no disco. Este setup o grava como o worker
        # gravaria — e só DEPOIS dele o mtime de referência é lido, senão o teste mediria
        # a própria renderização do setup em vez da reexecução.
        worker.write_json_atomic(os.path.join(worker.results_dir(root), job_id + ".json"),
                                 run(job, root))
        antes_mtime = os.path.getmtime(caminho)
        antes_sha = worker.sha256(caminho)
        antes_arquivos = sorted(os.listdir(variantes))
        r2, reusado = worker.process_job(job, root, "2026-08-03T00:01:00Z")
        check("12. reexecução reconhecida como já concluída", reusado and r2.get("reused"))
        check("12. reexecução não regrava o arquivo",
              os.path.getmtime(caminho) == antes_mtime and worker.sha256(caminho) == antes_sha)
        check("12. reexecução não duplica saída na pasta",
              sorted(os.listdir(variantes)) == antes_arquivos)
        opts_v2 = variant_options("var_t15", 5.0, 20.0, "blur", "tiktok", 15)
        opts_v2["renderVersion"] = 2
        r3 = run(build_job("job_render_var_t15_v2", "render_variant", src_rel, src_sha,
                           folder="Variantes", file_name="var_t15-tiktok-v2.mp4",
                           options=opts_v2), root)
        check("12. jobId novo produz artefato novo (nova versão é outro trabalho)",
              r3["state"] == "done" and r3["artifacts"][0]["renderVersion"] == 2)
        check("12. a nova versão não sobrescreveu a anterior",
              worker.sha256(caminho) == antes_sha)

    # ------------------------------------ 13. falha isolada + máquina de estados por pasta
    lote = [
        ("job_lote_ok1", variant_options("var_l1", 0.0, 4.0, "crop", "tiktok", 4), "l1.mp4"),
        ("job_lote_ruim", variant_options("var_l2", 40.0, 999.0, "crop", "tiktok", 4), "l2.mp4"),
        ("job_lote_ok2", variant_options("var_l3", 6.0, 10.0, "crop", "instagram", 4), "l3.mp4"),
        ("job_lote_ok3", variant_options("var_l4", 12.0, 16.0, "blur", "instagram", 4), "l4.mp4"),
    ]
    for job_id, opts, nome in lote:
        worker.write_json_atomic(os.path.join(pending, job_id + ".json"),
                                 build_job(job_id, "render_variant", src_rel, src_sha,
                                           folder="Variantes", file_name=nome, options=opts))
    codigo = worker.main(["--root", root, "--finished-at", "2026-08-03T00:02:00Z"])
    check("13. lote com uma falha retorna código de saída 1", codigo == 1)
    estados = {}
    for job_id, _opts, _nome in lote:
        with open(os.path.join(root, "_results", job_id + ".json"), encoding="utf-8") as handle:
            estados[job_id] = json.load(handle)
    check("13. as três variantes boas do lote ficaram done",
          all(estados[j]["state"] == "done"
              for j in ("job_lote_ok1", "job_lote_ok2", "job_lote_ok3")))
    check("13. a variante ruim falhou sozinha", estados["job_lote_ruim"]["state"] == "failed")
    check("13. os arquivos das variantes boas existem",
          all(os.path.exists(os.path.join(variantes, n)) for n in ("l1.mp4", "l3.mp4", "l4.mp4")))
    check("13. a variante que falhou não deixou arquivo",
          not os.path.exists(os.path.join(variantes, "l2.mp4")))
    check("13. job concluído foi movido para _jobs/done",
          os.path.exists(os.path.join(root, "_jobs", "done", "job_lote_ok1.json")))
    check("13. job com falha foi movido para _jobs/failed",
          os.path.exists(os.path.join(root, "_jobs", "failed", "job_lote_ruim.json")))
    check("13. pending esvaziou depois da varredura", not os.listdir(pending))
    check("13. result.json existe também para a falha, com código e mensagem",
          bool(estados["job_lote_ruim"]["error"]["code"])
          and bool(estados["job_lote_ruim"]["error"]["message"]))
    check("13. result de falha não carrega artefato", not estados["job_lote_ruim"]["artifacts"])

    # ------------------------------------------------- 15. fonte empacotada (fontsdir)
    # O libass NAO falha quando nao acha a fonte: ele troca calado. Medido nesta maquina com
    # -loglevel info, o antes e o depois desta mudanca:
    #   sem a fonte ao lado -> fontselect: (Inter, 700, 0) -> Arial-BoldMT
    #   com ela             -> fontselect: (Inter, 700, 0) -> Inter-Bold
    # A prova aqui e COMPORTAMENTAL: um corte REAL com legenda, e a fonte tem de ter sido
    # depositada ao lado do .ass. Assercao no texto do worker.py passaria igual com a linha
    # `_place_font(pasta)` apagada -- e o corte voltaria a sair em Arial, calado.
    legendas = os.path.join(root, "legenda-fonte")
    os.makedirs(legendas, exist_ok=True)
    ass_path = os.path.join(legendas, "prova.ass")
    with open(ass_path, "w", encoding="utf-8") as h:
        h.write(captions.to_ass([{"start": 0.0, "end": 2.0, "text": "prova de fonte"}],
                                video_h=608))
    com_leg = os.path.join(root, "com-legenda.mp4")
    worker.render_cut(src, com_leg, 1.0, 2.0, "blur", True, ass_file=ass_path)
    check("15. render_cut deposita a fonte empacotada ao lado do .ass (para o fontsdir=.)",
          os.path.isfile(os.path.join(legendas, captions.FONTE_ARQUIVO)))
    check("15b. o filtro pede fontsdir com legenda e NAO pede sem legenda",
          "fontsdir=." in worker.build_filter("blur", "x.ass")
          and "fontsdir" not in worker.build_filter("blur"))
    check("15c. o corte com legenda saiu de verdade", os.path.getsize(com_leg) > 0)

    # ---------------------------- 16. qualidade do 9:16 (enquadramento, cor, encode, audio)
    # 16a-16f: o ENQUADRAMENTO. A prova e o arquivo RENDERIZADO, nao o texto do filtro: o
    # `build_filter` saber montar o crop nao prova que a altura do video visivel mudou.
    # Como o quadro de saida e sempre 1080x1920 nos quatro perfis (o que muda e a AREA do
    # video dentro dele), a altura visivel e medida OLHANDO O PIXEL: a moldura e a cor
    # chapada do preset, uniforme, entao as linhas que diferem dela sao a area do video.
    def altura_visivel(caminho):
        """Altura, em px, da area de VIDEO dentro do 1080x1920. Le UMA coluna de pixels."""
        bruto = os.path.join(root, "coluna.rawvideo")
        worker.run_ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", caminho,
                           "-frames:v", "1", "-filter_complex",
                           # `format=gray` ANTES do crop: em yuv420p o `crop` arredonda a
                           # largura para multiplo de 2, entao `w=1` virava 0 e o FFmpeg
                           # recusava ("non positive size for width '0'"). Em gray nao ha
                           # subamostragem de croma e a coluna de 1px passa.
                           "[0:v]format=gray,crop=w=1:h=1920:x=540:y=0[c]",
                           "-map", "[c]", "-f", "rawvideo", "-pix_fmt", "gray", bruto])
        with open(bruto, "rb") as fh:
            coluna = fh.read()
        os.remove(bruto)
        moldura = coluna[0]
        vivas = [i for i, v in enumerate(coluna) if abs(v - moldura) > 12]
        return (vivas[-1] - vivas[0] + 1) if vivas else 0

    enquadra = {}
    for perfil in ("blur", "crop11", "crop45"):
        saida = os.path.join(root, "enq-%s.mp4" % perfil)
        worker.render_cut(src, saida, 1.0, 1.0, perfil, True)
        enquadra[perfil] = (worker.probe(saida), altura_visivel(saida))
    check("16a. os tres perfis saem no quadro 1080x1920 (o que muda e a area do video)",
          all(i["width"] == 1080 and i["height"] == 1920 for i, _ in enquadra.values()))
    # As alturas do `serve.video_box`, medidas no pixel. Tolerancia de 2px: a borda do
    # testsrc2 nao e degrade, mas o encode a 4:2:0 mistura uma linha na fronteira.
    for letra, perfil, esperado in (("b", "blur", 608), ("c", "crop11", 1080),
                                    ("d", "crop45", 1350)):
        medido = enquadra[perfil][1]
        check("16%s. %s: o video ocupa %dpx de altura (medido: %d)"
              % (letra, perfil, esperado, medido), abs(medido - esperado) <= 2)
    # Polaridade: as tres tem de ser DIFERENTES. Sem isto, um `_crop_source` que devolvesse
    # sempre "" (ou seja, recorte nenhum) passaria nos checks de quadro acima.
    check("16e. e as tres alturas sao distintas (recorte que nao recorta reprova aqui)",
          len({enquadra[p][1] for p in enquadra}) == 3)
    check("16f. no 1:1 e no 4:5 a cadeia recorta a FONTE antes de deitar",
          "crop='min(iw,ih*1/1)'" in worker.build_filter("crop11")
          and "crop='min(iw,ih*4/5)'" in worker.build_filter("crop45")
          and "crop='min(" not in worker.build_filter("blur"))

    # 16g: o `blur` sai IDENTICO ao de antes do seletor existir -- e o que garante que todo
    # trecho ja salvo (que nao manda a chave) nao muda de aparencia de tabela.
    check("16g. `blur` nao ganhou o segmento de recorte (nem com miniatura e tarja)",
          "crop='min(" not in worker.build_filter("blur", None, "t.webp", 656)
          and "crop='min(" not in worker.build_filter("blur", "x.ass"))
    # E o `crop` de quadro cheio TAMBEM nao recebe o segmento -- o motivo esta MEDIDO:
    # aplicando a expressao generica a ele, `min(iw, ih*9/16)` num 1920x1080 da 607.5, o
    # filtro TRUNCA para 607, a proporcao deixa de ser 9:16 e o `decrease` erra a altura por
    # 2px -> 1080x1918, que o `check_output` reprova. Numa fonte 1280x720 o encode falhou.
    check("16h. o `crop` de quadro cheio continua no ramo dedicado, sem o segmento",
          "crop='min(" not in worker.build_filter("crop")
          and "crop=1080:1920" in worker.build_filter("crop"))

    # 16i-16k: COR. As tags saem no ARQUIVO, nao so no texto do filtro. Medido neste build:
    # `-color_primaries`/`-color_trc` como flags de ENCODER sao IGNORADAS (saem `unknown`),
    # e so o `setparams` na cadeia grava as quatro. Por isso a prova le o arquivo.
    cor = os.path.join(root, "cor.mp4")
    worker.render_cut(src, cor, 1.0, 1.0, "blur", True)
    tags = worker.run_ffmpeg(["-hide_banner", "-i", cor, "-f", "null", "-"])
    check("16i. o filtro termina nas tags de cor, nos QUATRO perfis",
          all(worker.build_filter(p).endswith("," + worker.COR_TAGS)
              for p in worker.REFRAMES))
    check("16j. e o arquivo entregue sai em bt709, nao mais em faixa cheia de JPEG",
          "bt709" in tags and "yuvj420p" not in tags)
    check("16k. o `setparams` cobre matriz, primarias, transferencia E faixa",
          all(k in worker.COR_TAGS for k in ("colorspace=bt709", "color_primaries=bt709",
                                             "color_trc=bt709", "range=tv")))

    # 16l: ENCODE. Igualdade da lista, e a ausencia do QSV e afirmada: hardware entrega menos
    # qualidade por bit, e este e o arquivo que vai ao ar.
    check("16l. o 9:16 encoda em x264 `slow` e sem QSV",
          worker.video_encoder_args() == ["-c:v", "libx264", "-preset", "slow",
                                          "-crf", "18"])
    check("16m. e o probe de QSV foi apagado junto (ficou sem chamador)",
          "h264_qsv" not in worker.video_encoder_args()
          and not hasattr(worker, "_QSV"))

    # 16n-16x: ACABAMENTO (audio a -14 LUFS + tag de cor no MESMO passe). Os TRES estados, e
    # nenhum levanta -- quem chama e o `_send_video`, no caminho de um download que ja deu
    # certo, e falhar aqui nao e motivo para nao entregar o video.
    #
    # A prova da COR le o ARQUIVO PRODUZIDO, nunca o texto do comando: `in arquivo` so prova
    # que alguem escreveu a palavra (licao de 2026-08-26). A leitura e o cabecalho do proprio
    # FFmpeg, como no 16j -- este projeto nao instala ffprobe (CONTRATO_TRABALHADOR §9) e a
    # linha `Video:` diz tudo. Formato MEDIDO neste build:
    #   yuv420p(tv, bt709/unknown/unknown, progressive)   <- matriz marcada, resto nao
    #   yuv420p(tv, bt709, progressive)                   <- as QUATRO batendo (colapsa)
    # E o `primarias/transferencia/matriz` colapsar num `bt709` unico E a assinatura de
    # sucesso: o FFmpeg so imprime uma vez quando os tres coincidem.
    def cabecalho(arquivo):
        err = worker.run_ffmpeg(["-hide_banner", "-i", arquivo, "-f", "null", "-"])
        linha = next(l for l in err.splitlines() if "Video:" in l)
        # `findall`/[-1], nunca `search`: numa fonte longa o FFmpeg imprime linhas de
        # PROGRESSO antes do total, e a primeira e um numero transitorio (medido: 877 de
        # 1350 nos 45 s desta fonte). Pegar a primeira faz o check comparar dois instantes
        # de decodificacao e reprovar com os arquivos identicos -- armadilha do proprio teste.
        quadros = re.findall(r"frame=\s*(\d+)", err)
        return {"linha": linha,
                "cor": re.search(r"(yuv\w+)\(([^)]*)\)", linha).group(0),
                "quadros": int(quadros[-1]) if quadros else None}

    # Fonte no estado em que o Remotion entrega: matriz e faixa marcadas, transferencia e
    # primarias NAO -- porque este build IGNORA `-color_trc`/`-color_primaries` como flag de
    # encoder, que e a forma exata em que o Remotion as emite.
    sem_tag = os.path.join(root, "sem-tag.mp4")
    worker.run_ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", src,
                       "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                       "-colorspace", "bt709", "-color_range", "tv",
                       "-c:a", "copy", "-f", "mp4", sem_tag])
    antes = cabecalho(sem_tag)
    check("16n. a fonte reproduz o defeito do Remotion: bt709 na matriz, resto `unknown`",
          antes["cor"] == "yuv420p(tv, bt709/unknown/unknown, progressive)")
    norm = os.path.join(root, "norm.mp4")
    check("16o. com faixa de audio o passe roda e devolve `normalizado`",
          worker.finish_video(sem_tag, norm) == worker.AUDIO_OK
          and os.path.getsize(norm) > 0)
    # P1: as QUATRO tags no arquivo entregue. `bt470bg`/`pc` era o dano visivel; o par
    # `unknown` era a assimetria entre os dois renderizadores, que neste projeto e o defeito.
    depois = cabecalho(norm)
    check("16p. e o arquivo entregue sai com as QUATRO tags em bt709, faixa tv (P1)",
          depois["cor"] == "yuv420p(tv, bt709, progressive)")
    # P8: nao recodificou. Mesmo codec, mesmo pix_fmt e MESMA contagem de quadros -- o passe
    # reescreve o VUI do SPS, nao os pixels.
    check("16q. e nao recodificou: codec, pix_fmt e contagem de quadros iguais (P8)",
          worker.probe(norm)["videoCodec"] == worker.probe(sem_tag)["videoCodec"]
          and depois["quadros"] == antes["quadros"] and depois["quadros"] > 0
          and depois["cor"].startswith("yuv420p("))
    # P4: a cor entrou no MESMO passe do audio, entao o loudnorm tem de continuar acertando.
    # O que se mede e o resultado: `input_i` do loudnorm SOBRE o arquivo ja entregue.
    medida = worker.run_ffmpeg(["-hide_banner", "-nostats", "-i", norm, "-af",
                                "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                                "-f", "null", "-"])
    lido = json.loads(medida[medida.index("{"):medida.rindex("}") + 1])
    check("16r. o audio continua indo para -14 LUFS (P4, medido %s)" % lido["input_i"],
          abs(float(lido["input_i"]) + 14.0) <= 1.5)
    # P2/P3: o ramo SEM faixa de audio TAMBEM produz arquivo. Ele saia com um `return`
    # antecipado, e por ali o clipe sem audio nunca receberia a correcao de cor -- calado.
    # Corte de podcast sempre tem audio, mas o /api/video-cut aceita MP4 local qualquer.
    muda = os.path.join(root, "sem-audio.mp4")
    worker.run_ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-an",
                       "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                       "-colorspace", "bt709", "-color_range", "tv", "-f", "mp4", muda])
    sem_som = os.path.join(root, "n2.mp4")
    check("16s. sem faixa de audio devolve AUDIO_SEM_FAIXA (nao e erro, e um fato) (P3)",
          worker.finish_video(muda, sem_som) == worker.AUDIO_SEM_FAIXA)
    check("16t. e ainda assim produz arquivo, com as quatro tags de cor (P2)",
          os.path.exists(sem_som) and os.path.getsize(sem_som) > 0
          and cabecalho(sem_som)["cor"] == "yuv420p(tv, bt709, progressive)")
    # P6: o check que impede o PIOR desfecho. O `-bsf:v h264_metadata` FALHA em stream que nao
    # e H.264, e a falha derrubaria o passe inteiro -> AUDIO_NORM_FAILED -> o clipe sairia sem
    # normalizar o AUDIO, que e audivel e importa muito mais que duas tags informativas.
    mp4v = os.path.join(root, "mpeg4.mp4")
    worker.run_ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", src,
                       "-c:v", "mpeg4", "-pix_fmt", "yuv420p", "-c:a", "copy",
                       "-f", "mp4", mp4v])
    outro = os.path.join(root, "n4.mp4")
    check("16u. video nao-H.264 NAO derruba o passe: audio normalizado, sem a tag (P6)",
          worker.finish_video(mp4v, outro) == worker.AUDIO_OK
          and worker.probe(outro)["videoCodec"] == "mpeg4")
    # Polaridade que importa: arquivo ILEGIVEL nao pode colapsar em "nao tem audio". O
    # `probe` le o cabecalho do stderr do FFmpeg e NAO levanta -- devolve tudo None -- entao
    # sem a guarda do videoCodec um MP4 truncado saia como AUDIO_SEM_FAIXA. Medido.
    ruim = os.path.join(root, "ruim.mp4")
    with open(ruim, "wb") as fh:
        fh.write(b"nao sou um mp4")
    check("16v. arquivo ilegivel devolve AUDIO_NORM_FAILED, distinto de `sem faixa`",
          worker.finish_video(ruim, os.path.join(root, "n3.mp4"))
          == worker.AUDIO_FAILED)
    check("16w. o conjunto de estados e fechado e nesta ordem (nao foi renomeado)",
          worker.AUDIO_STATES == (worker.AUDIO_OK, worker.AUDIO_SEM_FAIXA,
                                  worker.AUDIO_FAILED))
    # P7: o caminho FFmpeg ja saia com as quatro (vem do `setparams` no filtro) e continua --
    # este plano nao o toca, e a prova existe para garantir que nao tocou.
    check("16x. o caminho FFmpeg (render_cut) continua com as quatro tags (P7)",
          cabecalho(cor)["cor"] == "yuv420p(tv, bt709, progressive)")

    # ---------------------------------------------------------------- relatório
    print("\n--- verificações ---")
    falhas = 0
    for label, ok in CHECKS:
        print("  %s  %s" % ("ok  " if ok else "FALHA", label))
        if not ok:
            falhas += 1

    if not args.keep:
        shutil.rmtree(root, ignore_errors=True)
        shutil.rmtree(fora, ignore_errors=True)
        print("\n(temporários removidos; use --keep para inspecionar)")
    else:
        print("\nraiz mantida em %s" % root)

    if falhas:
        fail("%d verificação(ões) falharam" % falhas)
    print("\nok — %d verificações passaram. Nenhum conteúdo protegido foi usado." % len(CHECKS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
