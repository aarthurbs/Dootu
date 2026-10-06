import type {CSSProperties} from "react";
import {Audio, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {bandHeight, config, secondsToFrames, totalFrames} from "./config";
import {clamp, smooth} from "./geometry";
import {buildTimeline} from "./timeline";

const mediaStyle: CSSProperties = {
  width: config.width, height: bandHeight, objectFit: "cover", display: "block",
};

export function Gameplay({muted = false}: {muted?: boolean}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timeline = buildTimeline();
  const src = config.assets.gameplay;
  if (!src || timeline.holdSourceFrame === null) return null;

  const activeIndex = timeline.segments.findIndex((span) => frame >= span.from && frame < span.to);
  const active = timeline.segments[activeIndex];
  const sourceFrame = active ? active.sourceIn + frame - active.from : timeline.holdSourceFrame;
  let impact = 0;
  let shakeX = 0;
  let shakeY = 0;
  let flash = 0;
  if (active) config.gameplay.highlights.forEach((highlight) => {
    const age = (sourceFrame - secondsToFrames(highlight.at)) / fps;
    if (age < 0 || age >= config.effects.impactSeconds) return;
    const pulse = Math.sin(Math.PI * clamp(age / config.effects.impactSeconds));
    impact = Math.max(impact, pulse);
    if (highlight.strong) {
      shakeX += Math.sin(age * fps * 1.7) * pulse * config.effects.shakePixels;
      shakeY += Math.sin(age * fps * 2.3) * pulse * config.effects.shakePixels * 0.5;
      flash = Math.max(flash, config.effects.flashOpacity * clamp(1 - age * fps / 3));
    }
  });
  const cutAge = active ? frame - active.from : -1;
  const cutBlur = activeIndex > 0 && cutAge < 2 ? config.effects.cutBlur * (1 - cutAge / 2) : 0;
  const fade = Math.max(1, secondsToFrames(config.audio.fadeSeconds));
  // Both tracks share conservative headroom if music is enabled.
  const headroom = Math.max(1, clamp(config.audio.gameplay) + (config.assets.music ? clamp(config.audio.music) : 0));

  return <div style={{position: "absolute", inset: 0, width: config.width, height: bandHeight, overflow: "hidden"}}>
    <div style={{width: "100%", height: "100%", transform: `translate(${shakeX}px, ${shakeY}px) scale(${1 + impact * config.effects.impactScale})`, filter: cutBlur ? `blur(${cutBlur}px)` : undefined}}>
      {timeline.segments.map((span, index) => <Sequence key={index} name={span.label} from={span.from} durationInFrames={span.duration} layout="none">
        <OffthreadVideo src={staticFile(src)} trimBefore={span.sourceIn} trimAfter={span.sourceOut} muted={muted}
          volume={(localFrame) => clamp(config.audio.gameplay) / headroom * smooth(Math.min(localFrame / fade, (span.duration - 1 - localFrame) / fade))}
          style={mediaStyle} />
      </Sequence>)}
      {timeline.holdDuration > 0 && <Sequence name="Pausa final" from={timeline.holdFrom} durationInFrames={timeline.holdDuration} layout="none">
        <Freeze frame={0}>
          <OffthreadVideo src={staticFile(src)} trimBefore={timeline.holdSourceFrame} trimAfter={timeline.holdSourceFrame + 1} muted style={mediaStyle} />
        </Freeze>
      </Sequence>}
    </div>
    {flash > 0 && <div style={{position: "absolute", inset: 0, background: "white", opacity: flash, pointerEvents: "none"}} />}
  </div>;
}

// src is a public/ relative path. Parent may explicitly pass null when a
// configured optional file is absent; no Audio element is then mounted.
export function Soundtrack({src = config.assets.music}: {src?: string | null}) {
  if (!src) return null;
  const start = Math.max(0, secondsToFrames(config.music.startFrom));
  const fadeIn = Math.max(1, secondsToFrames(config.audio.musicFadeIn));
  const fadeOut = Math.max(1, secondsToFrames(config.audio.fadeOut));
  const headroom = Math.max(1, clamp(config.audio.gameplay) + clamp(config.audio.music));
  return <Audio src={staticFile(src)} trimBefore={start}
    volume={(frame) => clamp(config.audio.music) / headroom * smooth(Math.min(frame / fadeIn, (totalFrames - 1 - frame) / fadeOut))} />;
}
