export type Vector3 = [number, number, number];

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const smooth = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const unit = (a: Vector3): Vector3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

// mulberry32: acak yang bisa diulang dari seed yang sama
export const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// noise 2D yang berulang tiap 8 sel, cukup untuk tekstur kecil
export const valueNoise = (random: () => number) => {
  const grid = Array.from({ length: 64 }, () => random());
  const at = (x: number, y: number) => grid[(x & 7) + (y & 7) * 8];
  return (x: number, y: number) => {
    const left = Math.floor(x);
    const top = Math.floor(y);
    const fx = x - left;
    const fy = y - top;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const upper = at(left, top) + (at(left + 1, top) - at(left, top)) * sx;
    const lower = at(left, top + 1) + (at(left + 1, top + 1) - at(left, top + 1)) * sx;
    return upper + (lower - upper) * sy;
  };
};

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
