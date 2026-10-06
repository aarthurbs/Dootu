import type {Point, Quad} from "./config";

export const clamp = (v: number, low = 0, high = 1) => Math.min(high, Math.max(low, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {const p = clamp(t); return p * p * p * (p * (p * 6 - 15) + 10);};
export const progress = (t: number, start: number, end: number) => clamp((t - start) / Math.max(0.0001, end - start));
export const rectangle = (w: number, h: number): Quad => [[0, 0], [w, 0], [w, h], [0, h]];

// Solve the 8 projective coefficients. Unlike a rotate/skew approximation,
// this maps all four measured corners exactly, keeping the face/card registered.
export function homography(from: Quad, to: Quad): number[] {
  const rows: number[][] = [];
  from.forEach(([x, y], i) => {
    const [u, v] = to[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    if (Math.abs(divisor) < 1e-10) throw new Error("Screen corners must form a non-degenerate quadrilateral.");
    rows[col] = rows[col].map((v) => v / divisor);
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      rows[row] = rows[row].map((v, j) => v - factor * rows[col][j]);
    }
  }
  return [...rows.map((row) => row[8]), 1];
}

export function mapPoint(h: number[], [x, y]: Point): Point {
  const d = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
}

export const cssMatrix = (h: number[]) => `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].join(",")})`;

