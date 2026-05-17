import type { World } from "../world";
import { CHUNK_SIZE, Chunk, chunkOrigin, voxelIndex } from "../voxel";

interface LightNode {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
}

export class LightEngine {
  updateChunk(world: World, chunk: Chunk): void {
    chunk.sunlight.fill(0);
    chunk.blockLightR.fill(0);
    chunk.blockLightG.fill(0);
    chunk.blockLightB.fill(0);
    this.computeSunlight(world, chunk);
    this.computeBlockLights(world, chunk);
    chunk.dirtyLight = false;
  }

  updateDirty(world: World, maxChunks = 4): number {
    let updated = 0;
    for (const chunk of world.chunks.loadedChunks()) {
      if (chunk.dirtyLight) {
        this.updateChunk(world, chunk);
        updated++;
        if (updated >= maxChunks) {
          break;
        }
      }
    }
    return updated;
  }

  private computeSunlight(world: World, chunk: Chunk): void {
    const origin = chunkOrigin(chunk.coord);
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        let light = this.hasOpaqueAbove(world, origin.x + x, origin.y + CHUNK_SIZE, origin.z + z) ? 0 : 15;
        for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
          const index = voxelIndex(x, y, z);
          const block = chunk.getBlock(x, y, z);
          if (world.registry.get(block).opaque) {
            light = 0;
          } else {
            chunk.sunlight[index] = light;
            if (light > 0 && !world.registry.get(block).transparent) {
              light = Math.max(0, light - 2);
            }
          }
        }
      }
    }
  }

  private hasOpaqueAbove(world: World, x: number, startY: number, z: number): boolean {
    for (let y = startY; y < startY + CHUNK_SIZE * 2; y++) {
      if (world.registry.get(world.getBlock(x, y, z)).opaque) {
        return true;
      }
    }
    return false;
  }

  private computeBlockLights(world: World, chunk: Chunk): void {
    const origin = chunkOrigin(chunk.coord);
    const queue: LightNode[] = [];
    chunk.forEachVoxel((blockId, x, y, z) => {
      const block = world.registry.get(blockId);
      const [r, g, b] = block.light;
      if (r > 0 || g > 0 || b > 0) {
        const index = voxelIndex(x, y, z);
        chunk.blockLightR[index] = r;
        chunk.blockLightG[index] = g;
        chunk.blockLightB[index] = b;
        queue.push({ x: origin.x + x, y: origin.y + y, z: origin.z + z, r, g, b });
      }
    });

    let cursor = 0;
    const dirs = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1]
    ];
    while (cursor < queue.length) {
      const node = queue[cursor++];
      for (const [dx, dy, dz] of dirs) {
        const nx = node.x + dx;
        const ny = node.y + dy;
        const nz = node.z + dz;
        const block = world.registry.get(world.getBlock(nx, ny, nz));
        if (block.opaque) {
          continue;
        }
        const next = {
          x: nx,
          y: ny,
          z: nz,
          r: Math.max(0, node.r - 1),
          g: Math.max(0, node.g - 1),
          b: Math.max(0, node.b - 1)
        };
        if (next.r === 0 && next.g === 0 && next.b === 0) {
          continue;
        }
        const localX = nx - origin.x;
        const localY = ny - origin.y;
        const localZ = nz - origin.z;
        if (localX < 0 || localX >= CHUNK_SIZE || localY < 0 || localY >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) {
          const neighbor = world.chunks.getChunk({ x: Math.floor(nx / CHUNK_SIZE), y: Math.floor(ny / CHUNK_SIZE), z: Math.floor(nz / CHUNK_SIZE) });
          if (neighbor) {
            neighbor.dirtyLight = true;
          }
          continue;
        }
        const index = voxelIndex(localX, localY, localZ);
        if (
          next.r > chunk.blockLightR[index] ||
          next.g > chunk.blockLightG[index] ||
          next.b > chunk.blockLightB[index]
        ) {
          chunk.blockLightR[index] = Math.max(chunk.blockLightR[index], next.r);
          chunk.blockLightG[index] = Math.max(chunk.blockLightG[index], next.g);
          chunk.blockLightB[index] = Math.max(chunk.blockLightB[index], next.b);
          queue.push(next);
        }
      }
    }
  }
}
