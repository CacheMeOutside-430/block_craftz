export class DeterministicRandom {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === "number" ? seed >>> 0 : DeterministicRandom.hashString(seed);
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  nextUint(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  next(): number {
    return this.nextUint() / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  integer(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  fork(salt: number | string): DeterministicRandom {
    const saltHash = typeof salt === "number" ? salt >>> 0 : DeterministicRandom.hashString(salt);
    return new DeterministicRandom((this.state ^ saltHash ^ 0x9e3779b9) >>> 0);
  }

  static hashString(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  static hash3(seed: number, x: number, y: number, z: number): number {
    let h = seed >>> 0;
    h ^= Math.imul(x | 0, 0x8da6b343);
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
    h ^= Math.imul(y | 0, 0xd8163841);
    h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
    h ^= Math.imul(z | 0, 0xcb1ab31f);
    return (h ^ (h >>> 15)) >>> 0;
  }
}
