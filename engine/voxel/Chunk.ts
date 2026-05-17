import type { BlockId } from "./Block";
import {
  CHUNK_SIZE,
  CHUNK_VOLUME,
  type ChunkCoord,
  chunkKey,
  inChunkBounds,
  voxelIndex
} from "./ChunkCoord";

export class Chunk {
  private palette: BlockId[] = [0];
  private paletteIndex = new Map<BlockId, number>([[0, 0]]);
  private bitsPerEntry = 1;
  private data = new Uint32Array(Math.ceil((CHUNK_VOLUME * this.bitsPerEntry) / 32));
  readonly sunlight = new Uint8Array(CHUNK_VOLUME);
  readonly blockLightR = new Uint8Array(CHUNK_VOLUME);
  readonly blockLightG = new Uint8Array(CHUNK_VOLUME);
  readonly blockLightB = new Uint8Array(CHUNK_VOLUME);
  readonly fluidLevel = new Uint8Array(CHUNK_VOLUME);
  version = 0;
  dirtyMesh = true;
  dirtyLight = true;

  constructor(public readonly coord: ChunkCoord) {}

  get key(): string {
    return chunkKey(this.coord);
  }

  reset(): void {
    this.palette = [0];
    this.paletteIndex = new Map<BlockId, number>([[0, 0]]);
    this.bitsPerEntry = 1;
    this.data = new Uint32Array(Math.ceil(CHUNK_VOLUME / 32));
    this.sunlight.fill(0);
    this.blockLightR.fill(0);
    this.blockLightG.fill(0);
    this.blockLightB.fill(0);
    this.fluidLevel.fill(0);
    this.version++;
    this.dirtyMesh = true;
    this.dirtyLight = true;
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (!inChunkBounds(x, y, z)) {
      return 0;
    }
    return this.getBlockByIndex(voxelIndex(x, y, z));
  }

  getBlockByIndex(index: number): BlockId {
    return this.palette[this.readPaletteIndex(index)] ?? 0;
  }

  setBlock(x: number, y: number, z: number, block: BlockId): void {
    if (!inChunkBounds(x, y, z)) {
      return;
    }
    this.setBlockByIndex(voxelIndex(x, y, z), block);
  }

  setBlockByIndex(index: number, block: BlockId): void {
    const paletteSlot = this.ensurePaletteIndex(block);
    this.writePaletteIndex(index, paletteSlot);
    this.version++;
    this.dirtyMesh = true;
    this.dirtyLight = true;
  }

  fill(block: BlockId): void {
    this.palette = [block];
    this.paletteIndex = new Map<BlockId, number>([[block, 0]]);
    this.bitsPerEntry = 1;
    this.data = new Uint32Array(Math.ceil(CHUNK_VOLUME / 32));
    this.sunlight.fill(0);
    this.blockLightR.fill(0);
    this.blockLightG.fill(0);
    this.blockLightB.fill(0);
    this.fluidLevel.fill(0);
    this.version++;
    this.dirtyMesh = true;
    this.dirtyLight = true;
  }

  paletteBlocks(): readonly BlockId[] {
    return this.palette;
  }

  packedData(): Uint32Array {
    return this.data.slice();
  }

  importPacked(palette: BlockId[], bitsPerEntry: number, data: Uint32Array): void {
    if (palette.length === 0 || bitsPerEntry < 1) {
      throw new Error("Invalid chunk payload");
    }
    this.palette = [...palette];
    this.paletteIndex = new Map(this.palette.map((block, index) => [block, index]));
    this.bitsPerEntry = bitsPerEntry;
    this.data = data.slice();
    this.version++;
    this.dirtyMesh = true;
    this.dirtyLight = true;
  }

  getBitsPerEntry(): number {
    return this.bitsPerEntry;
  }

  forEachVoxel(callback: (block: BlockId, x: number, y: number, z: number, index: number) => void): void {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const index = voxelIndex(x, y, z);
          callback(this.getBlockByIndex(index), x, y, z, index);
        }
      }
    }
  }

  checksum(): number {
    let hash = 2166136261;
    for (let i = 0; i < CHUNK_VOLUME; i++) {
      hash ^= this.getBlockByIndex(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private ensurePaletteIndex(block: BlockId): number {
    const existing = this.paletteIndex.get(block);
    if (existing !== undefined) {
      return existing;
    }
    const nextIndex = this.palette.length;
    this.palette.push(block);
    this.paletteIndex.set(block, nextIndex);
    const requiredBits = Math.max(1, Math.ceil(Math.log2(this.palette.length)));
    if (requiredBits > this.bitsPerEntry) {
      this.repack(requiredBits);
    }
    return nextIndex;
  }

  private readPaletteIndex(index: number): number {
    const bit = index * this.bitsPerEntry;
    const word = bit >>> 5;
    const offset = bit & 31;
    const mask = (1 << this.bitsPerEntry) - 1;
    const low = this.data[word] >>> offset;
    const spill = offset + this.bitsPerEntry - 32;
    if (spill > 0) {
      const highMask = (1 << spill) - 1;
      return (low | ((this.data[word + 1] & highMask) << (this.bitsPerEntry - spill))) & mask;
    }
    return low & mask;
  }

  private writePaletteIndex(index: number, paletteSlot: number): void {
    const bit = index * this.bitsPerEntry;
    const word = bit >>> 5;
    const offset = bit & 31;
    const mask = (1 << this.bitsPerEntry) - 1;
    this.data[word] = (this.data[word] & ~(mask << offset)) | ((paletteSlot & mask) << offset);
    const spill = offset + this.bitsPerEntry - 32;
    if (spill > 0) {
      const highMask = (1 << spill) - 1;
      this.data[word + 1] = (this.data[word + 1] & ~highMask) | ((paletteSlot >>> (this.bitsPerEntry - spill)) & highMask);
    }
  }

  private repack(newBitsPerEntry: number): void {
    const oldData = this.data;
    const oldBits = this.bitsPerEntry;
    const readOld = (index: number): number => {
      const bit = index * oldBits;
      const word = bit >>> 5;
      const offset = bit & 31;
      const mask = (1 << oldBits) - 1;
      const low = oldData[word] >>> offset;
      const spill = offset + oldBits - 32;
      if (spill > 0) {
        return (low | ((oldData[word + 1] & ((1 << spill) - 1)) << (oldBits - spill))) & mask;
      }
      return low & mask;
    };
    this.bitsPerEntry = newBitsPerEntry;
    this.data = new Uint32Array(Math.ceil((CHUNK_VOLUME * newBitsPerEntry) / 32));
    for (let i = 0; i < CHUNK_VOLUME; i++) {
      this.writePaletteIndex(i, readOld(i));
    }
  }
}
