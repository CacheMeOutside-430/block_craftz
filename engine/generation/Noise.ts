import { DeterministicRandom } from "../core";

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class PerlinNoise {
  private readonly perm = new Uint8Array(512);

  constructor(seed: number | string) {
    const rng = new DeterministicRandom(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = rng.integer(0, i);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  noise3(x: number, y: number, z: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const aaa = this.perm[this.perm[this.perm[xi] + yi] + zi];
    const aba = this.perm[this.perm[this.perm[xi] + yi + 1] + zi];
    const aab = this.perm[this.perm[this.perm[xi] + yi] + zi + 1];
    const abb = this.perm[this.perm[this.perm[xi] + yi + 1] + zi + 1];
    const baa = this.perm[this.perm[this.perm[xi + 1] + yi] + zi];
    const bba = this.perm[this.perm[this.perm[xi + 1] + yi + 1] + zi];
    const bab = this.perm[this.perm[this.perm[xi + 1] + yi] + zi + 1];
    const bbb = this.perm[this.perm[this.perm[xi + 1] + yi + 1] + zi + 1];

    const x1 = lerp(grad(aaa, xf, yf, zf), grad(baa, xf - 1, yf, zf), u);
    const x2 = lerp(grad(aba, xf, yf - 1, zf), grad(bba, xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);
    const x3 = lerp(grad(aab, xf, yf, zf - 1), grad(bab, xf - 1, yf, zf - 1), u);
    const x4 = lerp(
      grad(abb, xf, yf - 1, zf - 1),
      grad(bbb, xf - 1, yf - 1, zf - 1),
      u
    );
    return lerp(y1, lerp(x3, x4, v), w);
  }

  noise2(x: number, y: number): number {
    return this.noise3(x, y, 0);
  }
}

export class SimplexNoise {
  private readonly perm = new Uint8Array(512);
  private static readonly grad3 = [
    [1, 1, 0],
    [-1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
    [1, 0, 1],
    [-1, 0, 1],
    [1, 0, -1],
    [-1, 0, -1],
    [0, 1, 1],
    [0, -1, 1],
    [0, 1, -1],
    [0, -1, -1]
  ] as const;

  constructor(seed: number | string) {
    const rng = new DeterministicRandom(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = rng.integer(0, i);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  noise2(xin: number, yin: number): number {
    const f2 = 0.5 * (Math.sqrt(3) - 1);
    const g2 = (3 - Math.sqrt(3)) / 6;
    const s = (xin + yin) * f2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * g2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + g2;
    const y1 = y0 - j1 + g2;
    const x2 = x0 - 1 + 2 * g2;
    const y2 = y0 - 1 + 2 * g2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
    const n0 = this.corner2(gi0, x0, y0);
    const n1 = this.corner2(gi1, x1, y1);
    const n2 = this.corner2(gi2, x2, y2);
    return 70 * (n0 + n1 + n2);
  }

  noise3(xin: number, yin: number, zin: number): number {
    const f3 = 1 / 3;
    const g3 = 1 / 6;
    const s = (xin + yin + zin) * f3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * g3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);

    let i1 = 0;
    let j1 = 0;
    let k1 = 0;
    let i2 = 0;
    let j2 = 0;
    let k2 = 0;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1;
        i2 = 1;
        j2 = 1;
      } else if (x0 >= z0) {
        i1 = 1;
        i2 = 1;
        k2 = 1;
      } else {
        k1 = 1;
        i2 = 1;
        k2 = 1;
      }
    } else if (y0 < z0) {
      k1 = 1;
      j2 = 1;
      k2 = 1;
    } else if (x0 < z0) {
      j1 = 1;
      j2 = 1;
      k2 = 1;
    } else {
      j1 = 1;
      i2 = 1;
      j2 = 1;
    }

    const x1 = x0 - i1 + g3;
    const y1 = y0 - j1 + g3;
    const z1 = z0 - k1 + g3;
    const x2 = x0 - i2 + 2 * g3;
    const y2 = y0 - j2 + 2 * g3;
    const z2 = z0 - k2 + 2 * g3;
    const x3 = x0 - 1 + 3 * g3;
    const y3 = y0 - 1 + 3 * g3;
    const z3 = z0 - 1 + 3 * g3;
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const gi0 = this.perm[ii + this.perm[jj + this.perm[kk]]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]] % 12;
    const gi2 = this.perm[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]] % 12;
    const gi3 = this.perm[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] % 12;
    return (
      32 *
      (this.corner3(gi0, x0, y0, z0) +
        this.corner3(gi1, x1, y1, z1) +
        this.corner3(gi2, x2, y2, z2) +
        this.corner3(gi3, x3, y3, z3))
    );
  }

  derivative2(x: number, y: number): { value: number; dx: number; dy: number } {
    const e = 0.001;
    const value = this.noise2(x, y);
    return {
      value,
      dx: (this.noise2(x + e, y) - this.noise2(x - e, y)) / (2 * e),
      dy: (this.noise2(x, y + e) - this.noise2(x, y - e)) / (2 * e)
    };
  }

  private corner2(gi: number, x: number, y: number): number {
    let t = 0.5 - x * x - y * y;
    if (t < 0) {
      return 0;
    }
    const g = SimplexNoise.grad3[gi];
    t *= t;
    return t * t * (g[0] * x + g[1] * y);
  }

  private corner3(gi: number, x: number, y: number, z: number): number {
    let t = 0.6 - x * x - y * y - z * z;
    if (t < 0) {
      return 0;
    }
    const g = SimplexNoise.grad3[gi];
    t *= t;
    return t * t * (g[0] * x + g[1] * y + g[2] * z);
  }
}

export function fbm2(
  noise: { noise2(x: number, y: number): number },
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2,
  gain = 0.5
): number {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise.noise2(x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return sum / norm;
}

export function ridgedMultifractal2(
  noise: { noise2(x: number, y: number): number },
  x: number,
  y: number,
  octaves: number
): number {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let weight = 1;
  for (let i = 0; i < octaves; i++) {
    let signal = 1 - Math.abs(noise.noise2(x * frequency, y * frequency));
    signal *= signal;
    signal *= weight;
    weight = Math.min(Math.max(signal * 2, 0), 1);
    sum += signal * amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return sum;
}

export function domainWarp2(
  noise: { noise2(x: number, y: number): number },
  x: number,
  y: number,
  strength: number
): { x: number; y: number } {
  const qx = noise.noise2(x + 5.2, y + 1.3);
  const qy = noise.noise2(x + 8.7, y + 2.8);
  return { x: x + qx * strength, y: y + qy * strength };
}

export function voronoi2(seed: number, x: number, y: number): { distance: number; cellX: number; cellY: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = Number.POSITIVE_INFINITY;
  let cellX = xi;
  let cellY = yi;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const hash = DeterministicRandom.hash3(seed, cx, 0, cy);
      const px = cx + ((hash & 0xffff) / 0xffff);
      const py = cy + (((hash >>> 16) & 0xffff) / 0xffff);
      const d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d < best) {
        best = d;
        cellX = cx;
        cellY = cy;
      }
    }
  }
  return { distance: Math.sqrt(best), cellX, cellY };
}

export function thermalErosion(height: Float32Array, width: number, iterations: number, talus = 1.2): void {
  const delta = new Float32Array(height.length);
  for (let iter = 0; iter < iterations; iter++) {
    delta.fill(0);
    for (let y = 1; y < width - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = x + y * width;
        const h = height[index];
        const neighbors = [index - 1, index + 1, index - width, index + width];
        for (const n of neighbors) {
          const diff = h - height[n];
          if (diff > talus) {
            const move = (diff - talus) * 0.25;
            delta[index] -= move;
            delta[n] += move;
          }
        }
      }
    }
    for (let i = 0; i < height.length; i++) {
      height[i] += delta[i];
    }
  }
}

export function hydraulicErosion(height: Float32Array, width: number, iterations: number): void {
  const water = new Float32Array(height.length);
  const sediment = new Float32Array(height.length);
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < water.length; i++) {
      water[i] += 0.01;
    }
    for (let y = 1; y < width - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = x + y * width;
        const total = height[index] + water[index];
        const neighbors = [index - 1, index + 1, index - width, index + width];
        for (const n of neighbors) {
          const diff = total - (height[n] + water[n]);
          if (diff > 0) {
            const flow = diff * 0.08;
            water[index] -= flow;
            water[n] += flow;
            const carry = Math.min(height[index] * 0.001, flow * 0.05);
            height[index] -= carry;
            sediment[n] += carry;
          }
        }
      }
    }
    for (let i = 0; i < height.length; i++) {
      height[i] += sediment[i] * 0.12;
      sediment[i] *= 0.88;
      water[i] *= 0.72;
    }
  }
}
