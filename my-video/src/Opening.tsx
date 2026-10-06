import {Img, staticFile} from "remotion";
import {bandHeight, config, type Quad} from "./config";
import {cssMatrix, homography, mix, progress, rectangle, smooth} from "./geometry";

export function screenAt(t: number): Quad {
  const s = config.setup;
  const first = smooth(progress(t, 0, config.scenes.zoomStart));
  const push = smooth(progress(t, config.scenes.zoomStart, config.scenes.chamberStart));
  const breathing = mix(s.initialScale, s.breathingScale, first);
  const scale = config.width / s.width * mix(breathing, s.approachScale, push);
  const cx = s.screen.reduce((sum, p) => sum + p[0], 0) / 4;
  const cy = s.screen.reduce((sum, p) => sum + p[1], 0) / 4;
  const focusX = mix(s.width / 2 - 12, cx, push);
  const focusY = mix(s.height / 2, cy, push);
  const flatten = smooth(progress(t, config.scenes.replacementStart, config.scenes.chamberStart));
  const target = rectangle(config.width, bandHeight);
  return s.screen.map(([x, y], i) => [
    mix(config.width / 2 + (x - focusX) * scale, target[i][0], flatten),
    mix(bandHeight / 2 + (y - focusY) * scale, target[i][1], flatten),
  ]) as unknown as Quad;
}

export const Opening = ({time, debug = false}: {time: number; debug?: boolean}) => {
  const s = config.setup;
  const corners = screenAt(time);
  const photoMatrix = cssMatrix(homography(s.screen, corners));
  const chamberMatrix = cssMatrix(homography(rectangle(config.chamber.width, config.chamber.height), corners));
  const blend = smooth(progress(time, config.scenes.replacementStart, s.blendEnd));
  const color = smooth(progress(time, s.blendEnd, config.scenes.chamberStart));
  return <>
    <div style={{position: "absolute", left: 0, top: 0, width: s.width, height: s.height, transform: photoMatrix, transformOrigin: "0 0"}}>
      <Img src={staticFile(config.assets.setup)} style={{width: "100%", height: "100%", display: "block", filter: `brightness(${s.brightness}) contrast(1.015)`}} />
      <div style={{position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 76%, rgba(13,18,25,${s.redEdgeShade}) 100%)`}} />
    </div>
    {blend > 0 && <Img src={staticFile(config.assets.chamber)} style={{position: "absolute", left: 0, top: 0, width: config.chamber.width, height: config.chamber.height, maxWidth: "none", transform: chamberMatrix, transformOrigin: "0 0", opacity: blend, filter: `brightness(${mix(s.screenMatch.brightness, 1, color)}) saturate(${mix(s.screenMatch.saturation, 1, color)})`}} />}
    {debug && <svg width={config.width} height={bandHeight} style={{position: "absolute", inset: 0}}>
      <polygon points={corners.map((p) => p.join(",")).join(" ")} fill="none" stroke="#ffdd00" strokeWidth={3} />
      {corners.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={7} fill="#ff3366" /><text x={Math.min(config.width - 120, Math.max(12, x + 12))} y={Math.min(bandHeight - 10, Math.max(24, y - 10))} fill="white" stroke="black" paintOrder="stroke" strokeWidth={3} fontSize={22}>{["TL", "TR", "BR", "BL"][i]}</text></g>)}
    </svg>}
  </>;
};

export const Chamber = ({time}: {time: number}) => {
  const zoom = mix(1, config.chamber.finalScale, smooth(progress(time, config.scenes.chamberStart, config.scenes.gameplayStart)));
  return <Img src={staticFile(config.assets.chamber)} style={{width: config.width, height: bandHeight, display: "block", transform: `scale(${zoom})`, transformOrigin: "50% 43%"}} />;
};

export const ChamberTitle = ({time}: {time: number}) => {
  const title = config.title;
  if (!title.enabled || time < title.start || time >= title.end) return null;
  const enter = 1 - Math.pow(1 - progress(time, title.start, title.start + 0.24), 3);
  const exit = smooth(progress(time, title.end - 0.16, title.end));
  return <div style={{position: "absolute", left: title.left, bottom: title.bottom, right: 60, color: "white", fontFamily: "ChamberDisplay, sans-serif", fontSize: title.size, fontWeight: 800, letterSpacing: 3, lineHeight: 1, textShadow: "0 3px 12px rgba(0,0,0,.42)", opacity: enter * (1 - exit), transform: `translateY(${(1 - enter) * 16 - exit * 6}px)`, overflowWrap: "anywhere"}}>{title.text}</div>;
};
