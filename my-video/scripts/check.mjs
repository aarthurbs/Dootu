import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {config, bandHeight, totalFrames} from '../src/config.ts';
import {homography, mapPoint, rectangle, smooth} from '../src/geometry.ts';

const original = rectangle(config.chamber.width, config.chamber.height);
const registration = homography(original, config.setup.screen);
for (let i = 0; i < 4; i++) {
  const actual = mapPoint(registration, original[i]);
  assert.ok(Math.hypot(actual[0] - config.setup.screen[i][0], actual[1] - config.setup.screen[i][1]) < 1e-7);
}
const flatten = homography(config.setup.screen, rectangle(config.width, bandHeight));
for (let i = 0; i < 4; i++) {
  const actual = mapPoint(flatten, mapPoint(registration, original[i]));
  const expected = rectangle(config.width, bandHeight)[i];
  assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-7);
}
assert.throws(() => homography([[0, 0], [0, 0], [0, 0], [0, 0]], original));
assert.equal(smooth(-1), 0);
assert.equal(smooth(2), 1);
assert.equal(totalFrames, Math.round(config.duration * config.fps));
const sceneTimes = [0, ...Object.values(config.scenes), config.duration];
assert.ok(sceneTimes.every((t, i) => i === 0 || t > sceneTimes[i - 1]), 'Scene times must be increasing.');
for (const name of ['setup', 'chamber', 'font']) assert.ok(existsSync(`public/${config.assets[name]}`), `Required asset missing: ${name}`);
for (const segment of config.gameplay.segments) {
  assert.ok(segment.in >= 0 && segment.out > segment.in && segment.out <= config.gameplay.sourceDuration);
}
console.log('OK: projective registration, continuity at full screen, easing bounds, timeline and required media.');
