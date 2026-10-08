import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {getStaticFiles} from "@remotion/studio";
import {bandHeight, config} from "./config";
import {Opening, Chamber, ChamberTitle} from "./Opening";
import {Gameplay, Soundtrack} from "./Gameplay";
import {progress, smooth} from "./geometry";
import {buildTimeline} from "./timeline";

export type ValorantProps = {debugScreen: boolean; gameplayEnabled: boolean; musicEnabled: boolean};

// Both copies evaluate the same frame and transformations. Only the sharp copy
// plays audio and carries text/debug guides.
export const ValorantEdit = ({debugScreen, gameplayEnabled, musicEnabled}: ValorantProps) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const time = frame / fps;
  const files = getStaticFiles();
  const hasGameplay = gameplayEnabled && config.assets.gameplay && files.some((f) => f.name === config.assets.gameplay) && buildTimeline().segments.length > 0;
  const scene = (blur: boolean) => {
    if (time < config.scenes.chamberStart) return <Opening time={time} debug={!blur && debugScreen} />;
    if (time < config.scenes.gameplayStart || !hasGameplay) return <Chamber time={time} />;
    return <Gameplay muted={blur} />;
  };
  const bandTop = (config.height - bandHeight) / 2;
  const backgroundScale = config.height / bandHeight * config.background.overscan;
  const ending = smooth(progress(frame, durationInFrames - Math.round(config.ending.fadeSeconds * fps), durationInFrames - 1));
  return <AbsoluteFill style={{backgroundColor: "#080b10", overflow: "hidden"}}>
    <style>{`@font-face {font-family: ChamberDisplay; src: url('${staticFile(config.assets.font)}') format('truetype'); font-weight: 800; font-display: block;}`}</style>
    <div style={{position: "absolute", top: bandTop, width: config.width, height: bandHeight, overflow: "hidden", transform: `scale(${backgroundScale})`, filter: `blur(${config.background.blur / backgroundScale}px) brightness(${config.background.brightness}) saturate(${config.background.saturation})`}}>{scene(true)}</div>
    <div style={{position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(4,7,12,.13), transparent 38%, transparent 62%, rgba(4,7,12,.2))"}} />
    <div style={{position: "absolute", top: bandTop, width: config.width, height: bandHeight, overflow: "hidden"}}>
      {scene(false)}
      <ChamberTitle time={time} />
    </div>
    {musicEnabled && <Soundtrack src={config.assets.music && files.some((f) => f.name === config.assets.music) ? config.assets.music : null} />}
    <AbsoluteFill style={{backgroundColor: "black", opacity: ending}} />
  </AbsoluteFill>;
};
