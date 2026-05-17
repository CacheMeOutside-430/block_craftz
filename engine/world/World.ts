import { TerrainGenerator } from "../generation";
import { Vec3 } from "../math";
import { TaskScheduler } from "../tasks";
import {
  type BlockId,
  type ChunkCoord,
  VoxelRegistry,
  CHUNK_SIZE,
  chunkKey,
  worldToChunk,
  worldToLocal,
  voxelRaycast,
  type VoxelHit
} from "../voxel";
import { ChunkManager } from "./ChunkManager";

export class World {
  readonly chunks: ChunkManager;

  constructor(
    readonly registry: VoxelRegistry,
    readonly generator: TerrainGenerator,
    scheduler = new TaskScheduler()
  ) {
    this.chunks = new ChunkManager(generator, scheduler);
  }

  getBlock(x: number, y: number, z: number): BlockId {
    const chunk = this.chunks.getChunk(worldToChunk(x, y, z));
    if (!chunk) {
      return 0;
    }
    const local = worldToLocal(x, y, z);
    return chunk.getBlock(local.x, local.y, local.z);
  }

  setBlock(x: number, y: number, z: number, block: BlockId): boolean {
    const coord = worldToChunk(x, y, z);
    const chunk = this.chunks.getChunk(coord);
    if (!chunk) {
      return false;
    }
    const local = worldToLocal(x, y, z);
    chunk.setBlock(local.x, local.y, local.z, block);
    this.chunks.markChanged(chunk);
    this.markNeighborBoundaries(coord, local.x, local.y, local.z);
    return true;
  }

  isSolidBlock(block: BlockId): boolean {
    return this.registry.get(block).solid;
  }

  isOpaqueBlock(block: BlockId): boolean {
    return this.registry.get(block).opaque;
  }

  raycast(origin: Vec3, direction: Vec3, maxDistance: number): VoxelHit | null {
    return voxelRaycast(
      origin,
      direction,
      maxDistance,
      (x, y, z) => this.getBlock(x, y, z),
      (block) => this.registry.get(block).solid
    );
  }

  private markNeighborBoundaries(coord: ChunkCoord, x: number, y: number, z: number): void {
    const checks: ChunkCoord[] = [];
    if (x === 0) checks.push({ x: coord.x - 1, y: coord.y, z: coord.z });
    if (x === CHUNK_SIZE - 1) checks.push({ x: coord.x + 1, y: coord.y, z: coord.z });
    if (y === 0) checks.push({ x: coord.x, y: coord.y - 1, z: coord.z });
    if (y === CHUNK_SIZE - 1) checks.push({ x: coord.x, y: coord.y + 1, z: coord.z });
    if (z === 0) checks.push({ x: coord.x, y: coord.y, z: coord.z - 1 });
    if (z === CHUNK_SIZE - 1) checks.push({ x: coord.x, y: coord.y, z: coord.z + 1 });
    for (const neighbor of checks) {
      const chunk = this.chunks.getChunk(neighbor);
      if (chunk) {
        chunk.dirtyMesh = true;
        chunk.dirtyLight = true;
        this.chunks.markChanged(chunk);
      }
    }
  }

  keyAtWorld(x: number, y: number, z: number): string {
    return chunkKey(worldToChunk(x, y, z));
  }
}
