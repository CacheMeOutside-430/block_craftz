import { Vec3 } from "../math";
import type { World } from "../world";

export interface PathNode {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface NavigationOptions {
  readonly maxIterations: number;
  readonly allowDiagonal: boolean;
  readonly maxFall: number;
  readonly stepHeight: number;
}

const DEFAULT_OPTIONS: NavigationOptions = {
  maxIterations: 4096,
  allowDiagonal: false,
  maxFall: 3,
  stepHeight: 1
};

export class PriorityQueue<T> {
  private readonly heap: Array<{ item: T; priority: number }> = [];

  push(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }
    const top = this.heap[0].item;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.heap[parent].priority <= this.heap[index].priority) {
        break;
      }
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private sinkDown(index: number): void {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

export class AStarPathfinder {
  findPath(world: World, start: Vec3, goal: Vec3, options: Partial<NavigationOptions> = {}): Vec3[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startNode = { x: Math.floor(start.x), y: Math.floor(start.y), z: Math.floor(start.z) };
    const goalNode = { x: Math.floor(goal.x), y: Math.floor(goal.y), z: Math.floor(goal.z) };
    const open = new PriorityQueue<PathNode>();
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const startKey = key(startNode);
    open.push(startNode, 0);
    gScore.set(startKey, 0);

    let iterations = 0;
    while (open.size > 0 && iterations++ < opts.maxIterations) {
      const current = open.pop()!;
      const currentKey = key(current);
      if (current.x === goalNode.x && current.y === goalNode.y && current.z === goalNode.z) {
        return reconstruct(cameFrom, currentKey).map(parseNode).map((node) => new Vec3(node.x + 0.5, node.y, node.z + 0.5));
      }
      for (const next of this.neighbors(world, current, opts)) {
        const nextKey = key(next);
        const cost = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + distance(current, next);
        if (cost < (gScore.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
          cameFrom.set(nextKey, currentKey);
          gScore.set(nextKey, cost);
          open.push(next, cost + heuristic(next, goalNode));
        }
      }
    }
    return [];
  }

  private neighbors(world: World, node: PathNode, options: NavigationOptions): PathNode[] {
    const dirs = options.allowDiagonal
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1]
        ]
      : [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ];
    const result: PathNode[] = [];
    for (const [dx, dz] of dirs) {
      const x = node.x + dx;
      const z = node.z + dz;
      for (let dy = options.stepHeight; dy >= -options.maxFall; dy--) {
        const y = node.y + dy;
        if (isWalkable(world, x, y, z)) {
          result.push({ x, y, z });
          break;
        }
      }
    }
    return result;
  }
}

export function isWalkable(world: World, x: number, y: number, z: number): boolean {
  const feet = world.registry.get(world.getBlock(x, y, z));
  const head = world.registry.get(world.getBlock(x, y + 1, z));
  const floor = world.registry.get(world.getBlock(x, y - 1, z));
  return !feet.solid && !head.solid && floor.solid;
}

function key(node: PathNode): string {
  return `${node.x},${node.y},${node.z}`;
}

function parseNode(value: string): PathNode {
  const [x, y, z] = value.split(",").map(Number);
  return { x, y, z };
}

function heuristic(a: PathNode, b: PathNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

function distance(a: PathNode, b: PathNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function reconstruct(cameFrom: Map<string, string>, current: string): string[] {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.push(current);
  }
  return path.reverse();
}
