import { DeterministicRandom } from "../core";
import { Chunk, CHUNK_SIZE, type ChunkCoord, chunkOrigin } from "../voxel";
import { type Biome, DEFAULT_BIOMES, chooseBiome } from "./Biome";
import {
  PerlinNoise,
  SimplexNoise,
  domainWarp2,
  fbm2,
  ridgedMultifractal2,
  voronoi2
} from "./Noise";

export interface TerrainBlockIds {
  air: number;
  grass: number;
  dirt: number;
  stone: number;
  sand: number;
  sandstone: number;
  snow: number;
  water: number;
  log: number;
  leaves: number;
  coalOre: number;
  ironOre: number;
  lamp: number;
  brick: number;
}

export interface TerrainGeneratorOptions {
  readonly seed: number | string;
  readonly seaLevel?: number;
  readonly blocks?: Partial<TerrainBlockIds>;
  readonly biomes?: readonly Biome[];
}

const DEFAULT_BLOCKS: TerrainBlockIds = {
  air: 0,
  grass: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  sandstone: 5,
  snow: 6,
  water: 7,
  log: 8,
  leaves: 9,
  coalOre: 10,
  ironOre: 11,
  lamp: 12,
  brick: 13
};

export class TerrainGenerator {
  readonly seed: number;
  readonly seaLevel: number;
  readonly blocks: TerrainBlockIds;
  private readonly perlin: PerlinNoise;
  private readonly simplex: SimplexNoise;
  private readonly caveNoise: SimplexNoise;
  private readonly biomes: readonly Biome[];

  constructor(options: TerrainGeneratorOptions) {
    this.seed = typeof options.seed === "number" ? options.seed >>> 0 : DeterministicRandom.hashString(options.seed);
    this.seaLevel = options.seaLevel ?? 37;
    this.blocks = { ...DEFAULT_BLOCKS, ...options.blocks };
    this.perlin = new PerlinNoise(this.seed);
    this.simplex = new SimplexNoise(this.seed ^ 0x9e3779b9);
    this.caveNoise = new SimplexNoise(this.seed ^ 0x85ebca6b);
    this.biomes = options.biomes ?? DEFAULT_BIOMES;
  }

  generateChunk(coord: ChunkCoord): Chunk {
    const chunk = new Chunk(coord);
    const origin = chunkOrigin(coord);
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = origin.x + x;
        const wz = origin.z + z;
        const terrain = this.sampleTerrain(wx, wz);
        for (let y = 0; y < CHUNK_SIZE; y++) {
          const wy = origin.y + y;
          const block = this.chooseBlock(wx, wy, wz, terrain.height, terrain.biome);
          chunk.setBlock(x, y, z, block);
        }
        this.placeColumnFeatures(chunk, x, z, wx, wz, terrain.height, terrain.biome);
      }
    }
    this.placeChunkStructures(chunk);
    chunk.dirtyMesh = true;
    chunk.dirtyLight = true;
    return chunk;
  }

  sampleTerrain(x: number, z: number): { height: number; biome: Biome; temperature: number; humidity: number } {
    const climateWarp = domainWarp2(this.simplex, x * 0.0025, z * 0.0025, 2.5);
    const temperature = Math.min(1, Math.max(0, fbm2(this.perlin, climateWarp.x + 101, climateWarp.y, 4) * 0.5 + 0.5));
    const humidity = Math.min(1, Math.max(0, fbm2(this.perlin, climateWarp.x, climateWarp.y + 313, 4) * 0.5 + 0.5));
    const continent = fbm2(this.simplex, x * 0.0018, z * 0.0018, 5) * 0.5 + 0.5;
    const mountains = ridgedMultifractal2(this.simplex, x * 0.006, z * 0.006, 5);
    const detail = fbm2(this.perlin, x * 0.025, z * 0.025, 4);
    const biome = chooseBiome(this.biomes, temperature, humidity, continent);
    const height =
      biome.minHeight +
      continent * biome.heightScale +
      mountains * (biome.name === "alpine" ? 28 : 9) +
      detail * 4;
    return {
      height: Math.max(4, Math.floor(height)),
      biome,
      temperature,
      humidity
    };
  }

  private chooseBlock(x: number, y: number, z: number, height: number, biome: Biome): number {
    if (y > height) {
      return y <= this.seaLevel ? this.blocks.water : this.blocks.air;
    }
    if (this.isCave(x, y, z, height)) {
      return y <= this.seaLevel - 3 ? this.blocks.water : this.blocks.air;
    }
    if (y === height) {
      return this.blockForName(biome.surface);
    }
    if (y > height - 4) {
      return this.blockForName(biome.subsurface);
    }
    const ore = this.oreAt(x, y, z);
    return ore ?? this.blocks.stone;
  }

  private blockForName(name: string): number {
    return this.blocks[name as keyof TerrainBlockIds] ?? this.blocks.stone;
  }

  private isCave(x: number, y: number, z: number, surface: number): boolean {
    if (y > surface - 5 || y < 4) {
      return false;
    }
    const tunnel = Math.abs(this.caveNoise.noise3(x * 0.052, y * 0.08, z * 0.052));
    const chamber = this.caveNoise.noise3(x * 0.022 + 90, y * 0.03, z * 0.022 - 17);
    const ravine = Math.abs(this.simplex.noise2(x * 0.012 + 44, z * 0.012 - 9));
    return tunnel < 0.082 || chamber > 0.64 || (ravine < 0.035 && y < surface - 10);
  }

  private oreAt(x: number, y: number, z: number): number | null {
    const hash = DeterministicRandom.hash3(this.seed ^ 0x51ed270b, x, y, z);
    const vein = this.perlin.noise3(x * 0.12, y * 0.12, z * 0.12);
    if (y < 46 && vein > 0.52 && (hash & 31) === 0) {
      return this.blocks.coalOre;
    }
    if (y < 34 && vein < -0.55 && (hash & 63) === 0) {
      return this.blocks.ironOre;
    }
    return null;
  }

  private placeColumnFeatures(
    chunk: Chunk,
    lx: number,
    lz: number,
    wx: number,
    wz: number,
    height: number,
    biome: Biome
  ): void {
    const localSurfaceY = height - chunk.coord.y * CHUNK_SIZE;
    if (localSurfaceY < 0 || localSurfaceY >= CHUNK_SIZE - 7) {
      return;
    }
    const hash = DeterministicRandom.hash3(this.seed ^ 0x7759, wx, 0, wz);
    const chance = (hash & 0xffff) / 0xffff;
    if (chance > biome.vegetationDensity) {
      return;
    }
    if (biome.name === "desert") {
      const cactusHeight = 2 + (hash % 3);
      for (let i = 1; i <= cactusHeight && localSurfaceY + i < CHUNK_SIZE; i++) {
        chunk.setBlock(lx, localSurfaceY + i, lz, this.blocks.log);
      }
      return;
    }
    this.placeTree(chunk, lx, localSurfaceY + 1, lz, 4 + (hash % 3));
  }

  private placeTree(chunk: Chunk, x: number, y: number, z: number, height: number): void {
    for (let i = 0; i < height && y + i < CHUNK_SIZE; i++) {
      chunk.setBlock(x, y + i, z, this.blocks.log);
    }
    const crownY = y + height;
    for (let oy = -2; oy <= 2; oy++) {
      for (let oz = -2; oz <= 2; oz++) {
        for (let ox = -2; ox <= 2; ox++) {
          const dist = Math.abs(ox) + Math.abs(oz) + Math.max(0, Math.abs(oy) - 1);
          if (dist <= 3) {
            chunk.setBlock(x + ox, crownY + oy, z + oz, this.blocks.leaves);
          }
        }
      }
    }
  }

  private placeChunkStructures(chunk: Chunk): void {
    const cityCell = voronoi2(this.seed ^ 0xabcddcba, chunk.coord.x / 10, chunk.coord.z / 10);
    const localRng = new DeterministicRandom(DeterministicRandom.hash3(this.seed, chunk.coord.x, chunk.coord.y, chunk.coord.z));
    if (chunk.coord.y === 2 && cityCell.distance < 0.05 && localRng.chance(0.34)) {
      this.placeRuin(chunk, localRng.integer(3, 10), localRng.integer(2, 6), localRng.integer(3, 10));
    }
    if (chunk.coord.y === 1 && localRng.chance(0.028)) {
      this.placeDungeon(chunk);
    }
  }

  private placeRuin(chunk: Chunk, x0: number, y0: number, z0: number): void {
    for (let z = z0; z < Math.min(CHUNK_SIZE, z0 + 5); z++) {
      for (let x = x0; x < Math.min(CHUNK_SIZE, x0 + 5); x++) {
        chunk.setBlock(x, y0, z, this.blocks.brick);
        if (x === x0 || z === z0 || x === x0 + 4 || z === z0 + 4) {
          chunk.setBlock(x, y0 + 1, z, this.blocks.brick);
          if ((x + z) % 2 === 0) {
            chunk.setBlock(x, y0 + 2, z, this.blocks.brick);
          }
        }
      }
    }
    chunk.setBlock(x0 + 2, y0 + 2, z0 + 2, this.blocks.lamp);
  }

  private placeDungeon(chunk: Chunk): void {
    for (let y = 4; y <= 9; y++) {
      for (let z = 4; z <= 11; z++) {
        for (let x = 4; x <= 11; x++) {
          const wall = x === 4 || x === 11 || z === 4 || z === 11 || y === 4 || y === 9;
          chunk.setBlock(x, y, z, wall ? this.blocks.brick : this.blocks.air);
        }
      }
    }
    chunk.setBlock(7, 5, 7, this.blocks.lamp);
  }
}
