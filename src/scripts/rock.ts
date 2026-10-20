import { clamp, seeded, valueNoise, type Vector3 } from './math';

export type RockBody = {
  size: number;
  normal: Float32Array;
  albedo: Float32Array;
  coverage: Float32Array;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  image: ImageData;
  shadedLight?: Vector3;
  shadedHeat?: number;
};

// tiap batu menyimpan peta normal dan warna permukaan; cahayanya dihitung ulang tiap frame dari arah sumber cahaya
export const makeRockBody = (size: number): RockBody => {
  const random = seeded(Math.floor(Math.random() * 1e9));
  const noise = valueNoise(random);
  const lobes = [[2, random() * 6.28, 0.12], [3, random() * 6.28, 0.07], [5, random() * 6.28, 0.035]];
  const craters = Array.from({ length: 7 }, () => ({ x: random() * 1.2 - 0.6, y: random() * 1.2 - 0.6, r: 0.08 + random() * 0.2 }));
  const count = size * size;
  const normal = new Float32Array(count * 3);
  const albedo = new Float32Array(count);
  const coverage = new Float32Array(count);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const angle = Math.atan2(v, u);
      let edge = 0.86;
      for (const [lobe, phase, amount] of lobes) edge *= 1 + amount * Math.sin(lobe * angle + phase);
      const reach = Math.hypot(u, v) / edge;
      const index = y * size + x;
      coverage[index] = clamp((1 - reach) * size * edge * 0.5, 0, 1);
      if (coverage[index] <= 0) continue;
      const inside = Math.min(reach, 0.999);
      let nx = u / edge + (noise(u * 4 + 0.15, v * 4) - noise(u * 4 - 0.15, v * 4)) * 0.6;
      let ny = v / edge + (noise(u * 4, v * 4 + 0.15) - noise(u * 4, v * 4 - 0.15)) * 0.6;
      const nz = Math.sqrt(1 - inside * inside);
      let tone = 0.55 + (noise(u * 6 + 3, v * 6) - 0.5) * 0.35;
      for (const crater of craters) {
        const dx = u - crater.x;
        const dy = v - crater.y;
        const depth = Math.hypot(dx, dy) / crater.r;
        if (depth < 1) {
          // dinding kawah miring ke arah pusatnya
          nx -= (dx / crater.r) * 0.9 * (1 - depth);
          ny -= (dy / crater.r) * 0.9 * (1 - depth);
          tone *= 0.88;
        } else if (depth < 1.25) {
          tone *= 1.08;
        }
      }
      const length = Math.hypot(nx, ny, nz) || 1;
      normal[index * 3] = nx / length;
      normal[index * 3 + 1] = ny / length;
      normal[index * 3 + 2] = nz / length;
      albedo[index] = tone;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  return { size, normal, albedo, coverage, canvas, context, image: context.createImageData(size, size) };
};

// cahaya hangat yang sedikit membungkus, sinar tepi untuk sisi yang membelakangi cahaya, ditambah pijar kalau batu panas
export const shadeBody = (body: RockBody, light: Vector3, heat: number) => {
  // arah cahaya relatif batu berubah pelan; bayangan yang nyaris sama tidak perlu dihitung ulang per piksel
  const last = body.shadedLight;
  if (last && last[0] * light[0] + last[1] * light[1] + last[2] * light[2] > 0.9995 && Math.abs((body.shadedHeat ?? 0) - heat) < 0.02) return;
  body.shadedLight = light;
  body.shadedHeat = heat;
  const { size, normal, albedo, coverage, image } = body;
  const data = image.data;
  for (let index = 0; index < size * size; index++) {
    const offset = index * 4;
    const cover = coverage[index];
    if (cover <= 0) {
      data[offset + 3] = 0;
      continue;
    }
    const facing = normal[index * 3] * light[0] + normal[index * 3 + 1] * light[1] + normal[index * 3 + 2] * light[2];
    const wrap = Math.max(0, (facing + 0.3) / 1.3);
    const rim = Math.pow(1 - normal[index * 3 + 2], 3) * Math.max(0, -light[2]) * 0.9;
    const lit = wrap + rim;
    const tone = albedo[index];
    data[offset] = Math.min(255, tone * (lit * 255 + 26) + heat * 130);
    data[offset + 1] = Math.min(255, tone * (lit * 214 + 28) + heat * 50);
    data[offset + 2] = Math.min(255, tone * (lit * 160 + 40) + heat * 12);
    data[offset + 3] = cover * 255;
  }
  body.context.putImageData(image, 0, 0);
};
