# Decisão — Capa do TikTok e edição manual no Estúdio

**Data:** 2026-09-30 · **Quem decidiu:** o usuário (operador do Estúdio)

## O que foi decidido
1. Cinco recursos novos no editor do corte: **capa do TikTok**, **música de fundo**, **remover
   trechos do meio**, **texto fixo na tela** e **zoom pontual leve**.
2. **Música só de arquivo do PC** (MP3/M4A/WAV). Nada de link nem yt-dlp para áudio.
3. **Capa = PNG 1080×1920 salvo ao lado do MP4.** O operador manda ao celular e escolhe no app
   ("Selecionar capa → Enviar da galeria"). Nada embutido no MP4 e nada por API — a API de envio
   do TikTok não tem parâmetro de capa.
4. **Fundo da capa = um quadro do próprio corte**, escolhido pelo operador, com o enquadramento do
   corte.
5. Tudo é posicionado pelo operador num momento que ele escolhe, dentro da direção editorial já
   escrita: sem música alta, sem neon, sem emoji, sem texto em movimento, sem zoom agressivo, sem
   efeito disparado só porque o tempo passou.

## Por quê
Cortes de podcast de negócios precisam de acabamento, não de efeito: uma capa legível no perfil,
uma trilha discreta, tirar um tropeço no meio da fala, uma informação fixa na hora certa e uma
aproximação leve num ponto de ênfase. O operador decide cada um; o sistema não decide nenhum.

## O que ficou definido na execução (medido)
- O volume da música é intenção (Baixa/Média), e o servidor transforma em ganho medindo a voz.
  Com a partida de 20/14 dB abaixo da voz, o MP4 final saiu com ~18/12 dB, porque a normalização
  final comprime a mistura. **Calibrado para 22/16 dB**, o que dá ~20/14 dB no arquivo.
- Há **um só dono do tempo** (o mapa de remoções no Python). A tela não remapeia nada: ela só pula
  os trechos removidos na prévia.
- Todo recurso é opcional. **Corte salvo antes disto exporta idêntico**, provado por fixture e por
  hash de stills.

## Fora desta decisão
Música por link, publicação direta ou capa por API, capa dentro do MP4, o pipeline de publicação
apagado em 2026-08-21, apagar faixas da biblioteca (fica como pendência), ducking, sincronia com a
batida, transições, B-roll, figurinhas, texto em movimento.
