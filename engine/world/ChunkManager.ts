import { EventBus } from "../core";
import { TaskScheduler } from "../tasks";
import type { TerrainGenerator } from "../generation";
import { Vec3 } from "../math";
import {
  CHUNK_SIZE,
  Chunk,
  type ChunkCoord,
  chunkKey,
  parseChunkKey,
  worldToChunk
} from "../voxel";

export interface ChunkEvents {
  chunkLoaded: Chunk;
  chunkUnloaded: ChunkCoord;
  chunkChanged: Chunk;
}

export interface StreamingOptions {
  readonly radius: number;
  readonly minChunkY: number;
  readonly maxChunkY: number;
  readonly maxQueuedPerUpdate: number;
}

export class ChunkManager {
  readonly events = new EventBus<ChunkEvents>();
  private readonly chunks = new Map<string, Chunk>();
  private readonly pending = new Map<string, Promise<Chunk>>();

  constructor(
    private readonly generator: TerrainGenerator,
    private readonly scheduler: TaskScheduler
  ) {}

  get loadedCount(): number {
    return this.chunks.size;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  getChunk(coord: ChunkCoord): Chunk | undefined {
    return this.chunks.get(chunkKey(coord));
  }

  loadedChunks(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  async loadChunk(coord: ChunkCoord): Promise<Chunk> {
    const key = chunkKey(coord);
    const existing = this.chunks.get(key);
    if (existing) {
      return existing;
    }
    const queued = this.pending.get(key);
    if (queued) {
      return queued;
    }
    const promise = this.scheduler.schedule(() => this.generator.generateChunk(coord));
    this.pending.set(key, promise);
    const chunk = await promise;
    this.pending.delete(key);
    this.chunks.set(key, chunk);
    this.events.emit("chunkLoaded", chunk);
    return chunk;
  }

  markChanged(chunk: Chunk): void {
    chunk.version++;
    chunk.dirtyMesh = true;
    chunk.dirtyLight = true;
    this.events.emit("chunkChanged", chunk);
  }

  streamAround(position: Vec3, options: StreamingOptions): Promise<Chunk[]> {
    const center = worldToChunk(position.x, position.y, position.z);
    const wanted = new Set<string>();
    const toLoad: ChunkCoord[] = [];

    for (let z = center.z - options.radius; z <= center.z + options.radius; z++) {
      for (let x = center.x - options.radius; x <= center.x + options.radius; x++) {
        const distSq = (x - center.x) * (x - center.x) + (z - center.z) * (z - center.z);
        if (distSq > options.radius * options.radius) {
          continue;
        }
        for (let y = options.minChunkY; y <= options.maxChunkY; y++) {
          const coord = { x, y, z };
          const key = chunkKey(coord);
          wanted.add(key);
          if (!this.chunks.has(key) && !this.pending.has(key)) {
            toLoad.push(coord);
          }
        }
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!wanted.has(key)) {
        this.chunks.delete(key);
        this.events.emit("chunkUnloaded", chunk.coord);
      }
    }

    toLoad.sort((a, b) => {
      const da = (a.x - center.x) ** 2 + (a.z - center.z) ** 2 + Math.abs(a.y - center.y);
      const db = (b.x - center.x) ** 2 + (b.z - center.z) ** 2 + Math.abs(b.y - center.y);
      return da - db;
    });

    return Promise.all(toLoad.slice(0, options.maxQueuedPerUpdate).map((coord) => this.loadChunk(coord)));
  }

  findLoadedAround(position: Vec3, radiusBlocks: number): Chunk[] {
    const center = worldToChunk(position.x, position.y, position.z);
    const radiusChunks = Math.ceil(radiusBlocks / CHUNK_SIZE);
    const result: Chunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (
        Math.abs(chunk.coord.x - center.x) <= radiusChunks &&
        Math.abs(chunk.coord.y - center.y) <= radiusChunks &&
        Math.abs(chunk.coord.z - center.z) <= radiusChunks
      ) {
        result.push(chunk);
      }
    }
    return result;
  }

  serializeLoadedKeys(): string[] {
    return [...this.chunks.keys()];
  }

  restoreChunk(chunk: Chunk): void {
    this.chunks.set(chunk.key, chunk);
    this.events.emit("chunkLoaded", chunk);
  }

  unloadAll(): void {
    for (const key of [...this.chunks.keys()]) {
      const coord = parseChunkKey(key);
      this.chunks.delete(key);
      this.events.emit("chunkUnloaded", coord);
    }
  }
}
