"""Gera a identidade do canal Ecommerce Puro em SVG (vetor self-contained) e PNG.

Uma fonte de verdade: o bloco TOKENS, mais UMA lista de cena por peca que os dois
renderizadores (SVG e PNG) consomem. Dois renderizadores lendo a mesma cena nao
podem divergir -- e a mesma razao pela qual `captions.margem_inferior` e dona unica
da ancora da legenda neste projeto.

Os SVGs saem com o texto CONVERTIDO EM CURVAS, entao nao dependem de fonte instalada
em lugar nenhum -- e o que um logo tem de ser.

    py -3.12 logo-ecommerce-puro/gerar.py

Precisa da Montserrat variavel ao lado deste arquivo (nao vai no repo: os SVGs ja sao
finais, a fonte so serve para REgerar):

    curl -sL -o "logo-ecommerce-puro/Montserrat[wght].ttf" \
      "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"
"""

import os
import sys

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageChops, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
FONTE = os.path.join(AQUI, "Montserrat[wght].ttf")
PESO = 800  # ExtraBold -- o peso do wordmark da referencia

# --------------------------------------------------------------------- tokens
# Medidos na referencia (716041ec...png): 0 pixels cromaticos. A marca e monocromatica.
# Nao ha cor de destaque para extrair, e inventar uma seria inventar a marca.
PRETO = "#000000"
BRANCO = "#FFFFFF"

TOKENS = {
    "lockup_w": 1200,
    "lockup_h": 820,
    "ct_margem": 26,        # respiro do monograma ate a borda do quadro
    "ct_tracking": 0.02,    # em ems
    "ct_stroke": 13,        # contorno vazado -- a assinatura visual da marca
    # placa (a mesma composicao serve de badge, so muda a escala)
    "pad_x": 52,            # respiro lateral dentro da placa
    "pad_topo": 46,
    "pad_base": 40,
    "gap": 30,              # entre ECOMMERCE e a linha do PURO
    "puro_cap": 44,
    "puro_tracking": 0.40,  # letterspacing largo, como na referencia
    "filete_h": 7,          # espessura dos filetes que ladeiam PURO
    "filete_gap": 34,       # respiro entre filete e a palavra
    "badge_w": 760,         # badge = so a placa, para o card 1080x1920
    "badge_escala": 0.62,
    "mono_lado": 512,       # monograma isolado (avatar / marca d'agua)
    "mono_margem": 44,
    "mono_stroke": 9,
}


class Fonte:
    """Le glifos como curvas. Nada aqui depende de fonte instalada no sistema."""

    def __init__(self, caminho, peso):
        tt = TTFont(caminho)
        if "fvar" in tt:
            tt = instantiateVariableFont(tt, {"wght": peso}, inplace=True)
        self.tt = tt
        self.gs = tt.getGlyphSet()
        self.cmap = tt.getBestCmap()
        self.upem = tt["head"].unitsPerEm
        self.cap = getattr(tt["OS/2"], "sCapHeight", 0) or int(self.upem * 0.7)

    def _glifos(self, texto):
        for ch in texto:
            nome = self.cmap.get(ord(ch))
            if nome is not None:
                yield nome

    def _percorrer(self, caneta, texto, cap, x, baseline, tracking):
        s = cap / self.cap
        cursor = x
        for nome in self._glifos(texto):
            self.gs[nome].draw(
                TransformPen(caneta, Transform().translate(cursor, baseline).scale(s, -s))
            )
            cursor += self.tt["hmtx"][nome][0] * s + tracking * self.upem * s

    def largura(self, texto, cap, tracking=0.0):
        """Largura de AVANCO (inclui as laterais do glifo). Serve para centrar."""
        s = cap / self.cap
        nomes = list(self._glifos(texto))
        w = sum(self.tt["hmtx"][n][0] for n in nomes) * s
        return w + tracking * self.upem * s * max(len(nomes) - 1, 0)

    def cap_para_largura(self, texto, largura, tracking=0.0):
        return largura * 100.0 / self.largura(texto, 100, tracking)

    def caixa(self, texto, cap, tracking=0.0):
        """Caixa da TINTA (xMin, yMin, xMax, yMax) com a base em y=0, y crescendo p/ baixo.

        E o que evita o corte: a Montserrat tem overshoot nas redondas, entao o `C`
        passa do cap-height em cima e da linha de base em baixo. Centrar pelo cap
        nominal cortaria a curva -- foi o que aconteceu na primeira versao.
        """
        caneta = BoundsPen(self.gs)
        self._percorrer(caneta, texto, cap, 0, 0, tracking)
        return caneta.bounds

    def encaixar(self, texto, larg, alt, tracking=0.0):
        """Devolve (cap, x, baseline) que centra a TINTA num retangulo larg x alt."""
        x0, y0, x1, y1 = self.caixa(texto, 1000, tracking)
        cap = 1000 * min(larg / (x1 - x0), alt / (y1 - y0))
        x0, y0, x1, y1 = self.caixa(texto, cap, tracking)
        return cap, (larg - (x1 - x0)) / 2 - x0, (alt - (y1 - y0)) / 2 - y0

    def path(self, texto, cap, x, baseline, tracking=0.0):
        caneta = SVGPathPen(self.gs, ntos=lambda v: f"{v:.2f}")
        self._percorrer(caneta, texto, cap, x, baseline, tracking)
        return caneta.getCommands()


# -------------------------------------------------------------------- cenas
# Cada peca vira uma lista de operacoes. Um so layout, dois renderizadores.
#   ("rect",     x, y, w, h, cor)
#   ("texto",    txt, cap, x, baseline, tracking, cor)
#   ("contorno", txt, cap, x, baseline, tracking, stroke, cor)

def cena_placa(f, largura, escala, dx, dy, tinta, papel):
    """A placa ECOMMERCE/PURO. Devolve (altura, ops)."""
    t = TOKENS
    pad_x, pad_topo = t["pad_x"] * escala, t["pad_topo"] * escala
    pad_base, gap = t["pad_base"] * escala, t["gap"] * escala
    fil_h, fil_gap = t["filete_h"] * escala, t["filete_gap"] * escala
    cap_puro = t["puro_cap"] * escala

    cap_eco = f.cap_para_largura("ECOMMERCE", largura - 2 * pad_x)
    base_eco = pad_topo + cap_eco
    base_puro = base_eco + gap + cap_puro
    altura = base_puro + pad_base

    w_puro = f.largura("PURO", cap_puro, t["puro_tracking"])
    x_puro = (largura - w_puro) / 2
    y_fil = base_puro - cap_puro / 2 - fil_h / 2
    fim_esq, ini_dir = x_puro - fil_gap, x_puro + w_puro + fil_gap

    return altura, [
        ("rect", dx, dy, largura, altura, tinta),
        ("texto", "ECOMMERCE", cap_eco, dx + pad_x, dy + base_eco, 0.0, papel),
        ("texto", "PURO", cap_puro, dx + x_puro, dy + base_puro, t["puro_tracking"], papel),
        ("rect", dx + pad_x, dy + y_fil, fim_esq - pad_x, fil_h, papel),
        ("rect", dx + ini_dir, dy + y_fil, largura - pad_x - ini_dir, fil_h, papel),
    ]


def cena_lockup(f, tinta, papel):
    t = TOKENS
    W, H = t["lockup_w"], t["lockup_h"]
    m = t["ct_margem"]
    cap, x, base = f.encaixar("CT", W - 2 * m, H - 2 * m, t["ct_tracking"])
    ops = [("contorno", "CT", cap, m + x, m + base, t["ct_tracking"], t["ct_stroke"], tinta)]
    altura, placa = cena_placa(f, W, 1.0, 0, 0, tinta, papel)
    ops += [_mover(op, 0, (H - altura) / 2) for op in placa]
    return W, H, ops


def cena_badge(f, tinta, papel):
    """So a placa. E a parte LEGIVEL da marca -- e a que entra no card 1080x1920."""
    W = TOKENS["badge_w"]
    altura, ops = cena_placa(f, W, TOKENS["badge_escala"], 0, 0, tinta, papel)
    return W, round(altura, 2), ops


def cena_monograma(f, tinta, papel):
    t = TOKENS
    L, m = t["mono_lado"], t["mono_margem"]
    cap, x, base = f.encaixar("CT", L - 2 * m, L - 2 * m, t["ct_tracking"])
    return L, L, [
        ("rect", 0, 0, L, L, tinta),
        ("contorno", "CT", cap, m + x, m + base, t["ct_tracking"], t["mono_stroke"], papel),
    ]


def _mover(op, dx, dy):
    if op[0] == "rect":
        return ("rect", op[1] + dx, op[2] + dy, op[3], op[4], op[5])
    return (op[0], op[1], op[2], op[3] + dx, op[4] + dy) + op[5:]


# ------------------------------------------------------------------- SVG
def svg(f, cena):
    w, h, ops = cena
    partes = []
    for op in ops:
        if op[0] == "rect":
            _, x, y, rw, rh, cor = op
            partes.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{rw:.2f}" '
                          f'height="{rh:.2f}" fill="{cor}"/>')
        elif op[0] == "texto":
            _, txt, cap, x, base, tr, cor = op
            partes.append(f'<path d="{f.path(txt, cap, x, base, tr)}" fill="{cor}"/>')
        else:
            _, txt, cap, x, base, tr, sw, cor = op
            partes.append(f'<path d="{f.path(txt, cap, x, base, tr)}" fill="none" '
                          f'stroke="{cor}" stroke-width="{sw}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="{w}" height="{h}">' + "".join(partes) + "</svg>")


# ------------------------------------------------------------------- PNG
def png(f, ttf, cena, caminho, escala=1.0):
    w, h, ops = cena
    im = Image.new("RGBA", (round(w * escala), round(h * escala)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def escrever(alvo, txt, cap, x, base, tr, cor, sw=0):
        fnt = ImageFont.truetype(ttf, round(cap * escala * f.upem / f.cap))
        passo = tr * f.upem * (cap * escala / f.cap)
        cursor = x * escala
        for ch in txt:
            alvo.text((cursor, base * escala), ch, font=fnt, fill=cor, anchor="ls",
                      stroke_width=sw, stroke_fill=cor)
            cursor += fnt.getlength(ch) + passo

    for op in ops:
        if op[0] == "rect":
            _, x, y, rw, rh, cor = op
            d.rectangle([x * escala, y * escala, (x + rw) * escala, (y + rh) * escala], fill=cor)
        elif op[0] == "texto":
            _, txt, cap, x, base, tr, cor = op
            escrever(d, txt, cap, x, base, tr, cor)
        else:
            # vazado: silhueta engrossada MENOS a silhueta cheia = anel
            _, txt, cap, x, base, tr, sw, cor = op
            cheio, grosso = Image.new("L", im.size, 0), Image.new("L", im.size, 0)
            escrever(ImageDraw.Draw(cheio), txt, cap, x, base, tr, 255)
            escrever(ImageDraw.Draw(grosso), txt, cap, x, base, tr, 255,
                     sw=max(round(sw * escala / 2), 1))
            im.paste(Image.new("RGBA", im.size, cor),
                     mask=ImageChops.subtract(grosso, cheio))
    im.save(caminho)


PECAS = (("lockup", cena_lockup), ("badge", cena_badge), ("monograma", cena_monograma))
VARIANTES = (("fundo-claro", PRETO, BRANCO), ("fundo-escuro", BRANCO, PRETO))

if __name__ == "__main__":
    if not os.path.exists(FONTE):
        sys.exit(f"falta a fonte: {FONTE}\nveja o comando curl no topo deste arquivo")
    F = Fonte(FONTE, PESO)
    estatica = os.path.join(AQUI, "_montserrat-800.ttf")
    F.tt.save(estatica)
    try:
        for nome, tinta, papel in VARIANTES:
            for peca, fn in PECAS:
                cena = fn(F, tinta, papel)
                base = os.path.join(AQUI, f"{peca}-{nome}")
                with open(base + ".svg", "w", encoding="utf-8") as fh:
                    fh.write(svg(F, cena))
                png(F, estatica, cena, base + ".png")
                print(os.path.basename(base) + ".svg/.png")
    finally:
        os.remove(estatica)
