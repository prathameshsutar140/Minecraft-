import { BiomeType } from '../types/game';

/**
 * Deterministic seeded PRNG + 2D/3D gradient value/Perlin noise for Java-style terrain generation.
 */
export class SeededNoise {
  public readonly seed: number;
  private perm: Uint8Array;

  constructor(seed: number) {
    this.seed = seed | 0;
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    let s = (this.seed ^ 0x9e3779b9) >>> 0;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad2(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) !== 0 ? -u : u) + ((h & 2) !== 0 ? -2.0 * v : 2.0 * v) * 0.5;
  }

  private grad3(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const x1 = this.lerp(this.grad2(aa, xf, yf), this.grad2(ba, xf - 1, yf), u);
    const x2 = this.lerp(this.grad2(ab, xf, yf - 1), this.grad2(bb, xf - 1, yf - 1), u);
    return this.lerp(x1, x2, v);
  }

  public noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    const res = this.lerp(
      this.lerp(
        this.lerp(this.grad3(this.perm[AA], xf, yf, zf), this.grad3(this.perm[BA], xf - 1, yf, zf), u),
        this.lerp(this.grad3(this.perm[AB], xf, yf - 1, zf), this.grad3(this.perm[BB], xf - 1, yf - 1, zf), u),
        v
      ),
      this.lerp(
        this.lerp(this.grad3(this.perm[AA + 1], xf, yf, zf - 1), this.grad3(this.perm[BA + 1], xf - 1, yf, zf - 1), u),
        this.lerp(this.grad3(this.perm[AB + 1], xf, yf - 1, zf - 1), this.grad3(this.perm[BB + 1], xf - 1, yf - 1, zf - 1), u),
        v
      ),
      w
    );
    return res;
  }

  public fbm2D(x: number, y: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2D(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  public hash2D(x: number, z: number): number {
    let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(this.seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  public hash3D(x: number, y: number, z: number): number {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + this.seed) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  public getBiome(wx: number, wz: number): BiomeType {
    const temp = this.fbm2D(wx * 0.0045 + 100, wz * 0.0045 + 100, 3);
    const moisture = this.fbm2D(wx * 0.0045 - 200, wz * 0.0045 + 300, 3);
    const weirdness = this.fbm2D(wx * 0.006 + 500, wz * 0.006 - 500, 3);

    if (weirdness > 0.28) return 'mountains';
    if (weirdness < -0.22 && temp > -0.15) return 'cherry';
    if (temp > 0.2 && moisture < 0.0) return 'desert';
    if (temp < -0.18) return 'taiga';
    if (moisture > 0.05) return 'forest';
    return 'plains';
  }

  public getSurfaceHeight(wx: number, wz: number, biome?: BiomeType): number {
    const b = biome ?? this.getBiome(wx, wz);
    const base = this.fbm2D(wx * 0.008, wz * 0.008, 4);
    const detail = this.fbm2D(wx * 0.025 + 40, wz * 0.025 - 40, 2);
    const ridge = 1 - Math.abs(this.noise2D(wx * 0.012 - 80, wz * 0.012 + 80));

    let height = 27 + base * 10 + detail * 2.5;
    if (b === 'plains') {
      height = 27 + base * 5 + detail * 1.4;
    } else if (b === 'cherry') {
      height = 31 + base * 6 + detail * 1.8;
    } else if (b === 'desert') {
      height = 26 + base * 5.5 + detail * 1.6;
    } else if (b === 'forest') {
      height = 28 + base * 7.5 + detail * 2.0;
    } else if (b === 'taiga') {
      height = 30 + base * 9 + detail * 2.5;
    } else if (b === 'mountains') {
      height = 31 + base * 13 + ridge * 11 + detail * 3.0;
    }

    // Carve rivers slightly
    const riverNoise = Math.abs(this.fbm2D(wx * 0.006 + 900, wz * 0.006 - 900, 2));
    if (riverNoise < 0.045) {
      const t = riverNoise / 0.045;
      const riverBed = 19;
      height = riverBed * (1 - t) + height * t;
    }

    return Math.max(5, Math.min(58, Math.round(height)));
  }
}
