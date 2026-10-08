// All times are seconds; screen points use pixels in the ORIGINAL setup photo.
export type Point = readonly [number, number];
export type Quad = readonly [Point, Point, Point, Point];

export const config = {
  width: 1080,
  height: 1920,
  fps: 60,
  duration: 21,
  assets: {
    setup: "valorant/setup.png",
    chamber: "valorant/chamber.png",
    gameplay: "valorant/gameplay.mp4" as string | null,
    music: null as string | null,
    font: "valorant/Montserrat-ExtraBold.ttf",
  },
  scenes: {zoomStart: 2, replacementStart: 5, chamberStart: 6, gameplayStart: 8, endingStart: 20},
  setup: {
    width: 1600, height: 900,
    // TL, TR, BR, BL. Calibrated against the actual photographed display.
    screen: [[541.6207275, 223.1599731], [1102.2232666, 221.3548889], [1092.949585, 528.6977539], [555.3218384, 536.6503906]] as Quad,
    initialScale: 1.017,
    breathingScale: 1.04,
    approachScale: 2.52,
    brightness: 1.08,
    redEdgeShade: 0.3,
    screenMatch: {brightness: 1.06, saturation: 0.86},
    blendEnd: 5.65,
  },
  chamber: {width: 1672, height: 941, finalScale: 1.035},
  background: {blur: 30, overscan: 1.14, brightness: 0.68, saturation: 0.91},
  title: {enabled: true, text: "CHAMBER", start: 6.2, end: 7.75, size: 76, left: 64, bottom: 46},
  gameplay: {
    sourceDuration: 29.48,
    // Source in/out at normal speed. Adjust these after replacing the media.
    segments: [{in: 0.15, out: 12.15, label: "Sequência original — quatro eliminações e ACE"}],
    // Source timestamps of VERIFIED highlights; no music supplied yet.
    highlights: [{at: 4.583, strong: false}, {at: 6.517, strong: false}, {at: 7.467, strong: false}, {at: 10.217, strong: true}],
    holdSeconds: 1,
  },
  music: {startFrom: 0, beats: [] as number[], snapCuts: false, snapWindow: 0.12},
  audio: {gameplay: 0.85, music: 0.32, fadeSeconds: 0.06, musicFadeIn: 0.4, fadeOut: 0.4},
  effects: {impactScale: 0.018, shakePixels: 2.2, flashOpacity: 0.065, impactSeconds: 0.18, cutBlur: 0.65},
  ending: {fadeSeconds: 0.38},
};

export const bandHeight = config.width * config.chamber.height / config.chamber.width;
export const totalFrames = Math.round(config.duration * config.fps);
export const secondsToFrames = (seconds: number) => Math.round(seconds * config.fps);
