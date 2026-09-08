# -*- coding: utf-8 -*-
"""Gráfico "Mais reproduzidos" do YouTube: normalização e regiões de pico.

Módulo PURO de propósito — nada de rede, de subprocess nem do `worker`. Ele é importado
tanto pelo `ytclip.py` (Estúdio de Vídeos) quanto pelo baixador local, e qualquer
dependência a mais aqui obrigaria cada um dos dois a carregar o mundo do outro.

O detector de região nasceu dentro do `ytclip.py` e continua exportado de lá pelo nome
antigo (`heatmap_peaks`): o `serve.py` e as checagens do `test_ytclip.py` chamam por esse
nome, e renomear seria quebrar código que funciona para não ganhar nada.

O que este módulo NÃO faz: escolher corte. Ele mede audiência observada e para aí. Quem
decide o corte é o operador, cruzando isto com legenda, capítulo e assunto.
"""

SOURCE = "youtube_heatmap"

# Os limiares vivem aqui, num lugar só, porque o pedido exige poder afinar sem caçar
# número solto pelo código. Os valores padrão reproduzem exatamente o comportamento que
# o test_ytclip.py já fixava antes deste módulo existir.
CONFIG = {
    "minBuckets": 8,          # menos que isso não é gráfico, é ruído
    "flatSpreadRatio": 0.02,  # desvio abaixo de 2% do topo => gráfico chato, sem pico
    "minPeakValue": 0.0,      # valor normalizado (0..1) mínimo para a região contar
    "minGapSec": 0.0,         # distância mínima entre picos independentes
    "maxPeaks": 20,           # teto de picos guardados
}


def _cfg(config):
    merged = dict(CONFIG)
    if config:
        merged.update(config)
    return merged


def _buckets(heatmap):
    """Baldes válidos do yt-dlp -> [{'start','end','value'}] com float. Função pura.

    Balde sem `start_time` ou sem `value` é descartado em vez de virar zero: zero seria
    uma medição de audiência que ninguém mediu.
    """
    out = []
    for bucket in heatmap or []:
        if not isinstance(bucket, dict):
            continue
        start, value = bucket.get("start_time"), bucket.get("value")
        if start is None or value is None:
            continue
        try:
            start = float(start)
            value = float(value)
            end = float(bucket.get("end_time") if bucket.get("end_time") is not None else start)
        except (TypeError, ValueError):
            continue
        out.append({"start": start, "end": end, "value": value})
    return out


def heatmap_peaks(heatmap, config=None):
    """Baldes acima da média + 1 desvio, vizinhos fundidos.

    Devolve [{'start','end','value','ratio'}], `ratio` = valor sobre o pico do vídeo,
    ordenado do mais reproduzido para o menos. Lista vazia quando o vídeo não publica o
    gráfico — e aí nenhum candidato cita audiência, porque não houve audiência medida.
    """
    cfg = _cfg(config)
    buckets = _buckets(heatmap)
    if len(buckets) < cfg["minBuckets"]:
        return []
    values = [b["value"] for b in buckets]
    top = max(values)
    if top <= 0:
        return []
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    spread = variance ** 0.5
    # Gráfico chato não tem "momento mais reproduzido": com desvio ~0 o corte `mean + desvio`
    # cai em cima da própria média e TODO balde vira pico — o vídeo inteiro seria sugerido
    # como destaque. Abaixo de 2% do topo o sinal não distingue nada e é descartado inteiro,
    # em vez de virar sugestão que finge medir audiência.
    if spread <= top * cfg["flatSpreadRatio"]:
        return []
    threshold = mean + spread
    peaks = []
    current = None
    for bucket in buckets:
        if bucket["value"] >= threshold:
            if current and bucket["start"] - current["end"] <= 0.01:
                current["end"] = bucket["end"]
                current["value"] = max(current["value"], bucket["value"])
            else:
                current = {"start": bucket["start"], "end": bucket["end"], "value": bucket["value"]}
                peaks.append(current)
        else:
            current = None
    for peak in peaks:
        peak["ratio"] = peak["value"] / top
    peaks.sort(key=lambda p: p["value"], reverse=True)
    return peaks


def most_replayed(heatmap, config=None):
    """Gráfico cru do yt-dlp -> {'available','source','points','peaks'}. Função pura.

    `value` sai normalizado (0..1) contra o topo do PRÓPRIO vídeo: é intensidade relativa
    de replay, nunca contagem de visualização. O número cru do yt-dlp não se perde — ele
    fica no .info.json que o download grava do lado do arquivo.

    Nenhum pico não é erro: vídeo novo ou pouco visto simplesmente não publica o gráfico,
    e aí `available` sai False com as listas vazias, do jeito que o pedido descreve.
    """
    cfg = _cfg(config)
    buckets = _buckets(heatmap)
    top = max([b["value"] for b in buckets], default=0.0)
    if not buckets or top <= 0:
        return {"available": False, "source": SOURCE, "points": [], "peaks": []}

    points = [{"start": round(b["start"], 3), "end": round(b["end"], 3),
               "value": round(b["value"] / top, 4)} for b in buckets]

    regions = heatmap_peaks(heatmap, cfg)
    peaks = []
    for region in regions:
        inside = [b for b in buckets if b["end"] > region["start"] and b["start"] < region["end"]]
        if not inside:
            continue
        strongest = max(inside, key=lambda b: b["value"])
        peak_time = (strongest["start"] + strongest["end"]) / 2.0
        if region["ratio"] < cfg["minPeakValue"]:
            continue
        # Dois picos colados descrevem o mesmo momento; o pedido quer região independente,
        # não a mesma cena repetida. Como `regions` já vem do mais forte para o mais fraco,
        # o que sobrevive ao filtro é sempre o mais reproduzido da vizinhança.
        if any(abs(peak_time - kept["peakTime"]) < cfg["minGapSec"] for kept in peaks):
            continue
        peaks.append({
            "start": round(region["start"], 3),
            "end": round(region["end"], 3),
            "peakTime": round(peak_time, 3),
            "peakValue": round(region["ratio"], 4),
            "averageValue": round(sum(b["value"] for b in inside) / len(inside) / top, 4),
            "rank": len(peaks) + 1,
        })
        if len(peaks) >= cfg["maxPeaks"]:
            break

    return {"available": bool(peaks), "source": SOURCE, "points": points, "peaks": peaks}
