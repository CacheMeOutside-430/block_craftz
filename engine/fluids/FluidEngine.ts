import type { World } from "../world";
import { CHUNK_SIZE, worldToChunk, worldToLocal, voxelIndex } from "../voxel";

export interface FluidRule {
  readonly blockId: number;
  readonly maxLevel: number;
  readonly horizontalDecay: number;
  readonly tickRate: number;
}

interface FluidTick {
  x: number;
  y: number;
  z: number;
  due: number;
}

export class FluidEngine {
  private readonly rules = new Map<number, FluidRule>();
  private readonly queue: FluidTick[] = [];

  register(rule: FluidRule): void {
    this.rules.set(rule.blockId, rule);
  }

  schedule(x: number, y: number, z: number, dueTick: number): void {
    this.queue.push({ x, y, z, due: dueTick });
  }

  scheduleChunk(world: World, tick: number): void {
    for (const chunk of world.chunks.loadedChunks()) {
      const origin = {
        x: chunk.coord.x * CHUNK_SIZE,
        y: chunk.coord.y * CHUNK_SIZE,
        z: chunk.coord.z * CHUNK_SIZE
      };
      chunk.forEachVoxel((block, x, y, z) => {
        if (this.rules.has(block)) {
          this.schedule(origin.x + x, origin.y + y, origin.z + z, tick);
        }
      });
    }
  }

  step(world: World, tick: number, budget = 256): number {
    this.queue.sort((a, b) => a.due - b.due || a.x - b.x || a.y - b.y || a.z - b.z);
    let processed = 0;
    while (this.queue.length > 0 && this.queue[0].due <= tick && processed < budget) {
      const event = this.queue.shift()!;
      this.process(world, event, tick);
      processed++;
    }
    return processed;
  }

  private process(world: World, event: FluidTick, tick: number): void {
    const block = world.getBlock(event.x, event.y, event.z);
    const rule = this.rules.get(block);
    if (!rule) {
      return;
    }
    const level = this.getLevel(world, event.x, event.y, event.z);
    const below = world.getBlock(event.x, event.y - 1, event.z);
    if (below === 0) {
      world.setBlock(event.x, event.y - 1, event.z, block);
      this.setLevel(world, event.x, event.y - 1, event.z, rule.maxLevel);
      this.schedule(event.x, event.y - 1, event.z, tick + rule.tickRate);
      return;
    }

    if (level <= 1) {
      return;
    }
    const nextLevel = level - rule.horizontalDecay;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    for (const [dx, dz] of dirs) {
      const nx = event.x + dx;
      const nz = event.z + dz;
      const target = world.getBlock(nx, event.y, nz);
      if (target === 0) {
        world.setBlock(nx, event.y, nz, block);
        this.setLevel(world, nx, event.y, nz, nextLevel);
        this.schedule(nx, event.y, nz, tick + rule.tickRate);
      } else if (target === block && this.getLevel(world, nx, event.y, nz) + 1 < nextLevel) {
        this.setLevel(world, nx, event.y, nz, nextLevel);
        this.schedule(nx, event.y, nz, tick + rule.tickRate);
      }
    }
  }

  private getLevel(world: World, x: number, y: number, z: number): number {
    const chunk = world.chunks.getChunk(worldToChunk(x, y, z));
    if (!chunk) {
      return 0;
    }
    const local = worldToLocal(x, y, z);
    return chunk.fluidLevel[voxelIndex(local.x, local.y, local.z)] || 8;
  }

  private setLevel(world: World, x: number, y: number, z: number, level: number): void {
    const chunk = world.chunks.getChunk(worldToChunk(x, y, z));
    if (!chunk) {
      return;
    }
    const local = worldToLocal(x, y, z);
    chunk.fluidLevel[voxelIndex(local.x, local.y, local.z)] = Math.max(0, Math.min(15, level));
    chunk.dirtyMesh = true;
  }
}
