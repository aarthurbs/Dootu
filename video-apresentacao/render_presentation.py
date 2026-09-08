from __future__ import annotations

import math
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
CAPTURES = ROOT / "capturas"
NARRATION = ROOT / "narracao"
FFMPEG = ROOT / "_tools" / "imageio_ffmpeg" / "binaries" / "ffmpeg-win-x86_64-v7.1.exe"
WIDTH, HEIGHT, FPS = 1920, 1080, 24
RED = (231, 24, 72)
NAVY = (10, 15, 28)
WHITE = (248, 249, 252)

SCENES = [
    dict(kind="title", duration=4, title="HUBI", subtitle="Uma nova forma de aprender, evoluir e dominar a programação."),
    dict(image="01-central.png", duration=6, title="UM HUB. TODAS AS FERRAMENTAS.", subtitle="Estudo, produtividade e marketplace", cursor=((1530, 82), (1218, 484))),
    dict(image="02-prompt-preenchido.png", duration=5, title="PROMPTS EM 5 PILARES", subtitle="Crie, organize e salve", cursor=((1520, 45), (1160, 855))),
    dict(image="03-prompt-salvo.png", duration=4, title="IDEIAS REUTILIZÁVEIS", subtitle="Projetos, tags e favoritos", cursor=((1210, 420), (1284, 590))),
    dict(image="04-cyberlab-aula.png", duration=6, title="CYBERLAB", subtitle="Aulas profundas + progresso visível", cursor=((98, 451), (815, 405))),
    dict(image="05-cyberlab-checkpoint.png", duration=6, title="CHECKPOINTS REAIS", subtitle="70% para avançar", cursor=((1270, 132), (968, 300))),
    dict(image="06-praticando-aprovado.png", duration=7, title="PRÁTICA AUTO-CORRIGIDA", subtitle="Do conceito à habilidade", cursor=((97, 373), (1090, 581))),
    dict(image="07-precificacao-inputs.png", duration=6, title="PRECIFICAÇÃO MULTI-PLATAFORMA", subtitle="Custos e taxas transparentes", cursor=((1180, 250), (1110, 440))),
    dict(image="08-precificacao-comparativo.png", duration=7, title="COMPARE MARGENS", subtitle="Cinco marketplaces, uma decisão", cursor=((1120, 392), (862, 694))),
    dict(image="09-inventario-importado.png", duration=7, title="INVENTÁRIO AMAZON", subtitle="Importe TXT. Encontre qualquer SKU.", cursor=((1572, 314), (838, 626))),
    dict(image="10-radar-ecommerce.png", duration=5, title="RADAR E-COMMERCE", subtitle="Informação atualizada e separada", cursor=((751, 212), (1113, 451))),
    dict(image="11-radar-claude.png", duration=5, title="CLAUDE & LOOPS", subtitle="Skills, estratégia e oportunidades", cursor=((899, 212), (1081, 704))),
    dict(image="12-fluxos.png", duration=6, title="FLUXOS VISUAIS", subtitle="Processos claros, ponta a ponta", cursor=((842, 108), (1090, 352))),
    dict(image="14-central-final.png", duration=5, title="HUBI", subtitle="Aprenda. Organize. Execute.", cursor=((313, 31), (943, 289))),
    dict(kind="outro", duration=6, title="ENTRE PARA O TIME.", subtitle="Comece sua evolução agora."),
]

VOICE_STARTS = {
    "00-abertura.wav": 0.0,
    "01-central.wav": 4.2,
    "02-prompts.wav": 10.0,
    "03-cyberlab.wav": 19.2,
    "04-praticando.wav": 31.3,
    "05-precificacao.wav": 38.0,
    "06-inventario.wav": 51.0,
    "07-radar.wav": 59.3,
    "08-fluxos.wav": 68.0,
    "09-final.wav": 80.0,
}


def font(size: int, bold: bool = False, condensed: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/bahnschrift.ttf") if condensed else None,
        Path("C:/Windows/Fonts/seguisb.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf") if bold else Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_LABEL = font(21, bold=True)
FONT_TITLE = font(42, bold=True, condensed=True)
FONT_SUBTITLE = font(25)
FONT_HERO = font(116, bold=True, condensed=True)
FONT_HERO_SUB = font(39)
FONT_SMALL = font(18, bold=True)


def ease_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 4


def ease_in_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def load_capture(name: str) -> Image.Image:
    image = Image.open(CAPTURES / name).convert("RGB")
    if image.size != (WIDTH, HEIGHT):
        image = image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    return image


CAPTURE_CACHE = {
    scene["image"]: load_capture(scene["image"])
    for scene in SCENES
    if scene.get("image")
}
BACKGROUND = CAPTURE_CACHE["01-central.png"]


def ken_burns(image: Image.Image, progress: float, reverse: bool = False) -> Image.Image:
    p = 1 - progress if reverse else progress
    zoom = 1.0 + 0.035 * ease_in_out(p)
    scaled = image.resize((round(WIDTH * zoom), round(HEIGHT * zoom)), Image.Resampling.LANCZOS)
    max_x = scaled.width - WIDTH
    max_y = scaled.height - HEIGHT
    x = round(max_x * (0.22 + 0.38 * ease_in_out(progress)))
    y = round(max_y * (0.18 + 0.25 * ease_in_out(progress)))
    return scaled.crop((x, y, x + WIDTH, y + HEIGHT))


def vignette(frame: Image.Image) -> Image.Image:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 0, WIDTH, 64), fill=(4, 6, 12, 55))
    draw.rectangle((0, HEIGHT - 215, WIDTH, HEIGHT), fill=(4, 6, 12, 158))
    draw.rectangle((0, 0, 250, HEIGHT), fill=(4, 6, 12, 28))
    return Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")


def draw_cursor(draw: ImageDraw.ImageDraw, scene: dict, progress: float) -> None:
    start, end = scene.get("cursor", ((1500, 900), (1100, 600)))
    move = ease_in_out(min(1.0, progress / 0.62))
    x = round(start[0] + (end[0] - start[0]) * move)
    y = round(start[1] + (end[1] - start[1]) * move)
    if 0.54 <= progress <= 0.72:
        ripple = (progress - 0.54) / 0.18
        radius = round(13 + 42 * ease_out(ripple))
        alpha = round(220 * (1 - ripple))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=(*RED, alpha), width=5)
    points = [(x, y), (x + 8, y + 34), (x + 17, y + 24), (x + 27, y + 44), (x + 37, y + 39), (x + 27, y + 19), (x + 41, y + 17)]
    shadow = [(px + 3, py + 4) for px, py in points]
    draw.polygon(shadow, fill=(0, 0, 0, 170))
    draw.polygon(points, fill=(255, 255, 255, 255), outline=(15, 18, 24, 255))


def draw_scene_overlay(frame: Image.Image, scene: dict, progress: float, index: int) -> Image.Image:
    rgba = frame.convert("RGBA")
    draw = ImageDraw.Draw(rgba, "RGBA")
    intro = ease_out(min(1.0, progress / 0.16))
    caption_x = round(302 - 28 * (1 - intro))
    caption_y = HEIGHT - 142
    draw.rounded_rectangle((caption_x, caption_y - 43, caption_x + 166, caption_y - 8), radius=17, fill=(*RED, 230))
    draw.text((caption_x + 18, caption_y - 38), f"RECURSO {index:02d}", font=FONT_LABEL, fill=WHITE)
    draw.text((caption_x, caption_y), scene["title"], font=FONT_TITLE, fill=WHITE, stroke_width=1, stroke_fill=(0, 0, 0, 140))
    draw.text((caption_x, caption_y + 52), scene["subtitle"], font=FONT_SUBTITLE, fill=(218, 222, 232, 255))
    draw.rounded_rectangle((WIDTH - 306, 86, WIDTH - 70, 126), radius=20, fill=(10, 15, 28, 175), outline=(255, 255, 255, 34), width=1)
    draw.ellipse((WIDTH - 286, 100, WIDTH - 274, 112), fill=(*RED, 255))
    draw.text((WIDTH - 260, 96), "NAVEGAÇÃO REAL", font=FONT_SMALL, fill=WHITE)
    draw.rectangle((0, HEIGHT - 6, WIDTH, HEIGHT), fill=(255, 255, 255, 25))
    draw.rectangle((0, HEIGHT - 6, round(WIDTH * progress), HEIGHT), fill=(*RED, 255))
    draw_cursor(draw, scene, progress)
    return rgba.convert("RGB")


def title_card(progress: float, outro: bool = False) -> Image.Image:
    bg = BACKGROUND.filter(ImageFilter.GaussianBlur(8)).convert("RGBA")
    shade = Image.new("RGBA", bg.size, (6, 9, 18, 198 if not outro else 214))
    frame = Image.alpha_composite(bg, shade)
    draw = ImageDraw.Draw(frame, "RGBA")
    for i in range(36):
        angle = i * 2.399 + progress * 0.8
        radius = 130 + (i % 9) * 42 + 34 * math.sin(progress * math.pi)
        x = WIDTH / 2 + math.cos(angle) * radius
        y = HEIGHT / 2 + math.sin(angle) * radius * 0.46
        r = 2 + i % 3
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(*((RED if i % 2 else (72, 125, 210))), 130))
    ring = 250 + 160 * ease_out(min(1.0, progress / 0.55))
    draw.ellipse((WIDTH / 2 - ring, HEIGHT / 2 - ring * 0.45, WIDTH / 2 + ring, HEIGHT / 2 + ring * 0.45), outline=(*RED, 115), width=5)
    title = "ENTRE PARA O TIME." if outro else "HUBI"
    subtitle = "Comece sua evolução agora." if outro else "Uma nova forma de aprender, evoluir e dominar a programação."
    title_font = FONT_TITLE if outro else FONT_HERO
    box = draw.textbbox((0, 0), title, font=title_font)
    draw.text(((WIDTH - (box[2] - box[0])) / 2, 405 if outro else 372), title, font=title_font, fill=WHITE, stroke_width=2, stroke_fill=(0, 0, 0, 150))
    sub_box = draw.textbbox((0, 0), subtitle, font=FONT_HERO_SUB)
    draw.text(((WIDTH - (sub_box[2] - sub_box[0])) / 2, 505 if outro else 505), subtitle, font=FONT_HERO_SUB, fill=(224, 228, 238, 255))
    if outro:
        address = "HUBI  •  localhost:5500"
        address_box = draw.textbbox((0, 0), address, font=FONT_SUBTITLE)
        draw.rounded_rectangle((WIDTH / 2 - 205, 605, WIDTH / 2 + 205, 662), radius=28, fill=(*RED, 220))
        draw.text(((WIDTH - (address_box[2] - address_box[0])) / 2, 618), address, font=FONT_SUBTITLE, fill=WHITE)
    return frame.convert("RGB")


def build_visual() -> Path:
    output = ROOT / "visual-body.mp4"
    command = [
        str(FFMPEG), "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    scene_index = 0
    previous = None
    for scene in SCENES:
        frames = round(scene["duration"] * FPS)
        for frame_number in range(frames):
            progress = frame_number / max(1, frames - 1)
            if scene.get("kind") == "title":
                current = title_card(progress)
            elif scene.get("kind") == "outro":
                current = title_card(progress, outro=True)
            else:
                scene_index += 1 if frame_number == 0 else 0
                current = ken_burns(CAPTURE_CACHE[scene["image"]], progress, reverse=scene_index % 2 == 0)
                current = vignette(current)
                current = draw_scene_overlay(current, scene, progress, scene_index)
            if previous is not None and frame_number < round(0.28 * FPS):
                blend = ease_out(frame_number / max(1, round(0.28 * FPS)))
                current = Image.blend(previous, current, blend)
            process.stdin.write(current.tobytes())
            previous = current
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("Falha ao renderizar o vídeo.")
    return output


def read_wave(path: Path, target_rate: int = 48_000) -> np.ndarray:
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        rate = source.getframerate()
        samples = np.frombuffer(source.readframes(source.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if rate != target_rate:
        old = np.linspace(0, 1, len(samples), endpoint=False)
        new = np.linspace(0, 1, round(len(samples) * target_rate / rate), endpoint=False)
        samples = np.interp(new, old, samples).astype(np.float32)
    return samples


def build_audio(duration: float) -> Path:
    sample_rate = 48_000
    count = round(duration * sample_rate)
    music = np.zeros(count, dtype=np.float32)
    rng = np.random.default_rng(7)
    bpm = 118
    beat = 60 / bpm

    chords = [
        (146.83, 174.61, 220.00),
        (116.54, 146.83, 174.61),
        (130.81, 164.81, 196.00),
        (130.81, 164.81, 220.00),
    ]
    block = beat * 8
    for start in np.arange(0, duration, block):
        chord = chords[int(start / block) % len(chords)]
        length = min(block, duration - start)
        n = round(length * sample_rate)
        t = np.arange(n, dtype=np.float32) / sample_rate
        pad = sum(np.sin(2 * np.pi * frequency * t) for frequency in chord) / len(chord)
        pad *= 0.035 * (0.55 + 0.45 * np.sin(np.pi * np.minimum(1, t / 0.55)))
        offset = round(start * sample_rate)
        music[offset:offset + n] += pad[: count - offset]

    for beat_index, start in enumerate(np.arange(0, duration, beat)):
        offset = round(start * sample_rate)
        length = min(round(0.28 * sample_rate), count - offset)
        t = np.arange(length, dtype=np.float32) / sample_rate
        kick = np.sin(2 * np.pi * (72 - 38 * t) * t) * np.exp(-15 * t) * 0.38
        music[offset:offset + length] += kick
        if beat_index % 4 in (1, 3):
            noise = rng.standard_normal(length).astype(np.float32)
            snare = noise * np.exp(-20 * t) * 0.11
            music[offset:offset + length] += snare
        for half in (0.0, beat / 2):
            hat_offset = round((start + half) * sample_rate)
            hat_len = min(round(0.055 * sample_rate), count - hat_offset)
            if hat_len > 0:
                hat_t = np.arange(hat_len, dtype=np.float32) / sample_rate
                hat = rng.standard_normal(hat_len).astype(np.float32) * np.exp(-55 * hat_t) * 0.035
                music[hat_offset:hat_offset + hat_len] += hat

    transitions = np.cumsum([scene["duration"] for scene in SCENES])[:-1]
    for start in transitions:
        offset = max(0, round((start - 0.18) * sample_rate))
        length = min(round(0.36 * sample_rate), count - offset)
        t = np.arange(length, dtype=np.float32) / sample_rate
        whoosh = rng.standard_normal(length).astype(np.float32) * np.sin(np.pi * t / max(t[-1], 0.001)) * 0.045
        music[offset:offset + length] += whoosh

    voice = np.zeros(count, dtype=np.float32)
    speech_ranges = []
    for name, start in VOICE_STARTS.items():
        samples = read_wave(NARRATION / name, sample_rate)
        offset = round(start * sample_rate)
        end = min(count, offset + len(samples))
        voice[offset:end] += samples[: end - offset]
        speech_ranges.append((offset, end))

    gain = np.full(count, 0.72, dtype=np.float32)
    fade = round(0.12 * sample_rate)
    for start, end in speech_ranges:
        gain[max(0, start - fade):min(count, end + fade)] = 0.24
    mixed = np.clip(music * gain + voice * 0.92, -0.98, 0.98)
    stereo = np.column_stack((mixed, mixed))
    pcm = (stereo * 32767).astype(np.int16)
    output = ROOT / "audio-body.wav"
    with wave.open(str(output), "wb") as target:
        target.setnchannels(2)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        target.writeframes(pcm.tobytes())
    return output


def mux(visual: Path, audio: Path) -> Path:
    output = ROOT / "HUBI-apresentacao-body.mp4"
    command = [
        str(FFMPEG), "-y", "-i", str(visual), "-i", str(audio),
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
        "-movflags", "+faststart", str(output),
    ]
    subprocess.run(command, check=True)
    return output


if __name__ == "__main__":
    assert FFMPEG.exists(), FFMPEG
    assert all((CAPTURES / scene["image"]).exists() for scene in SCENES if scene.get("image"))
    expected_duration = sum(scene["duration"] for scene in SCENES)
    assert expected_duration == 85
    visual_path = build_visual()
    audio_path = build_audio(expected_duration)
    final_path = mux(visual_path, audio_path)
    print(final_path)
