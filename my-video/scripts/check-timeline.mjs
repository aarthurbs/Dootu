import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

// Load the actual TS modules without another runner dependency.
function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText;
  new Function("require", "exports", code)((name) => {
    assert(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}
const {config} = load("../src/config.ts");
const {buildTimeline} = load("../src/timeline.ts", {"./config": {config}});
const normal = buildTimeline();
assert.equal(normal.start, 480);
assert.equal(normal.limit, 1200);
assert.equal(normal.holdFrom, 1200);
assert.equal(normal.holdDuration, 60);
assert.equal(normal.holdSourceFrame, 728);
assert(normal.segments.every((s) => s.sourceIn >= 0 && s.sourceOut <= Math.floor(config.gameplay.sourceDuration * config.fps) && s.duration === s.sourceOut - s.sourceIn));

const snapped = buildTimeline({...config,
  gameplay: {...config.gameplay, segments: [{in: 0.15, out: 2.15, label: "one"}, {in: 5, out: 7, label: "two"}]},
  music: {...config.music, snapCuts: true, beats: [9.9, 10.05, NaN]},
});
assert.equal(snapped.segments[0].to, 594);
assert.equal(snapped.segments[0].sourceOut, 123);
assert.equal(snapped.segments[1].from, 594);
assert.equal(snapped.segments[1].sourceIn, 300);

const clamped = buildTimeline({...config, gameplay: {...config.gameplay, sourceDuration: 2, segments: [
  {in: -1, out: 100, label: "clamped"},
  {in: 4, out: 5, label: "outside source"},
  {in: NaN, out: 1, label: "invalid"},
  {in: 1, out: 0, label: "reversed"},
]}});
assert.equal(clamped.segments.length, 1);
assert.equal(clamped.segments[0].sourceIn, 0);
assert.equal(clamped.segments[0].sourceOut, 120);
assert.equal(clamped.holdSourceFrame, 119);
assert.equal(clamped.holdDuration, 660);
const truncated = buildTimeline({...config, gameplay: {...config.gameplay, segments: [{in: 0, out: 25, label: "long"}]}});
assert.equal(truncated.segments[0].duration, 720);
assert.equal(truncated.segments[0].sourceOut, 720);
for (const sourceDuration of [0, -1, NaN]) {
  assert.equal(buildTimeline({...config, gameplay: {...config.gameplay, sourceDuration}}).holdSourceFrame, null);
}
assert.equal(buildTimeline({...config, gameplay: {...config.gameplay, segments: []}}).holdSourceFrame, null);
console.log("Timeline OK: source bounds, invalid ranges, duration cap, final hold, conservative beat snapping.");
