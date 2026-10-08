import {config} from "./config";

export type GameplaySpan = {
  from: number;
  to: number;
  duration: number;
  sourceIn: number;
  sourceOut: number;
  label: string;
};

// Source/out and timeline/to are EXCLUSIVE, in composition frames.
export function buildTimeline(settings = config) {
  const frame = (seconds: number) => Math.round(seconds * settings.fps);
  const total = frame(settings.duration);
  const start = Math.max(0, Math.min(total, frame(settings.scenes.gameplayStart)));
  const limit = Math.max(start, Math.min(total, frame(settings.scenes.endingStart), total - Math.max(0, frame(settings.gameplay.holdSeconds ?? 0))));
  const sourceFrames = Number.isFinite(settings.gameplay.sourceDuration) ? Math.max(0, Math.floor(settings.gameplay.sourceDuration * settings.fps)) : 0;
  const spans: GameplaySpan[] = [];
  let cursor = start;

  settings.gameplay.segments.forEach((segment, index) => {
    if (!Number.isFinite(segment.in) || !Number.isFinite(segment.out)) return;
    const sourceIn = Math.max(0, Math.min(sourceFrames, frame(segment.in)));
    const sourceOut = Math.max(sourceIn, Math.min(sourceFrames, frame(segment.out)));
    let duration = Math.min(sourceOut - sourceIn, limit - cursor);
    if (duration <= 0) return;

    // Beats are composition seconds. Only shorten internal cuts: never extend
    // a source range or shift a verified shot outside its requested segment.
    if (settings.music.snapCuts && index < settings.gameplay.segments.length - 1) {
      const end = cursor + duration;
      const window = Math.max(0, frame(settings.music.snapWindow));
      const beats = settings.music.beats.filter(Number.isFinite).map(frame)
        .filter((beat) => beat > cursor && beat <= end && end - beat <= window);
      if (beats.length) duration = Math.max(...beats) - cursor;
    }
    spans.push({from: cursor, to: cursor + duration, duration, sourceIn, sourceOut: sourceIn + duration, label: segment.label});
    cursor += duration;
  });

  return {
    segments: spans,
    start,
    limit,
    holdFrom: cursor,
    holdDuration: total - cursor,
    holdSourceFrame: spans.length ? spans[spans.length - 1].sourceOut - 1 : null,
  };
}
