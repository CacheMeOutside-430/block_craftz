import { AABB, Vec3 } from "../math";
import type { BlockId, VoxelRegistry } from "../voxel";

export interface PhysicsBody {
  position: Vec3;
  previousPosition: Vec3;
  velocity: Vec3;
  halfExtents: Vec3;
  grounded: boolean;
  friction: number;
  restitution: number;
}

export interface PhysicsSample {
  getBlock(x: number, y: number, z: number): BlockId;
}

export interface CollisionHit {
  readonly time: number;
  readonly normal: Vec3;
}

export class SpatialHash<T> {
  private readonly cells = new Map<string, Set<T>>();

  constructor(private readonly cellSize: number) {}

  clear(): void {
    this.cells.clear();
  }

  insert(bounds: AABB, value: T): void {
    const minX = Math.floor(bounds.min.x / this.cellSize);
    const minY = Math.floor(bounds.min.y / this.cellSize);
    const minZ = Math.floor(bounds.min.z / this.cellSize);
    const maxX = Math.floor(bounds.max.x / this.cellSize);
    const maxY = Math.floor(bounds.max.y / this.cellSize);
    const maxZ = Math.floor(bounds.max.z / this.cellSize);
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const key = `${x},${y},${z}`;
          const cell = this.cells.get(key) ?? new Set<T>();
          cell.add(value);
          this.cells.set(key, cell);
        }
      }
    }
  }

  query(bounds: AABB): Set<T> {
    const result = new Set<T>();
    const minX = Math.floor(bounds.min.x / this.cellSize);
    const minY = Math.floor(bounds.min.y / this.cellSize);
    const minZ = Math.floor(bounds.min.z / this.cellSize);
    const maxX = Math.floor(bounds.max.x / this.cellSize);
    const maxY = Math.floor(bounds.max.y / this.cellSize);
    const maxZ = Math.floor(bounds.max.z / this.cellSize);
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const cell = this.cells.get(`${x},${y},${z}`);
          if (cell) {
            for (const value of cell) {
              result.add(value);
            }
          }
        }
      }
    }
    return result;
  }
}

export class PhysicsWorld {
  gravity = new Vec3(0, -28, 0);
  maxVelocity = 80;
  stairHeight = 0.55;

  constructor(private readonly registry: VoxelRegistry) {}

  createBody(position: Vec3, halfExtents = new Vec3(0.33, 0.9, 0.33)): PhysicsBody {
    return {
      position,
      previousPosition: position.clone(),
      velocity: new Vec3(),
      halfExtents,
      grounded: false,
      friction: 12,
      restitution: 0
    };
  }

  step(body: PhysicsBody, sample: PhysicsSample, dt: number, inputAcceleration = new Vec3()): void {
    body.previousPosition.copy(body.position);
    const fluidDrag = this.fluidDrag(body, sample);
    body.velocity.add(this.gravity.clone().scale(dt * (1 - fluidDrag * 0.65)));
    body.velocity.add(inputAcceleration.clone().scale(dt));
    body.velocity.x = applyFriction(body.velocity.x, body.grounded ? body.friction : body.friction * 0.08, dt);
    body.velocity.z = applyFriction(body.velocity.z, body.grounded ? body.friction : body.friction * 0.08, dt);
    clampVelocity(body.velocity, this.maxVelocity);
    body.velocity.scale(1 - fluidDrag * Math.min(0.85, dt * 4));
    this.move(body, sample, body.velocity.clone().scale(dt));
  }

  jump(body: PhysicsBody, impulse = 9.2): void {
    if (body.grounded) {
      body.velocity.y = impulse;
      body.grounded = false;
    }
  }

  sweptAABB(moving: AABB, velocity: Vec3, target: AABB): CollisionHit | null {
    const invEntry = new Vec3();
    const invExit = new Vec3();
    if (velocity.x > 0) {
      invEntry.x = target.min.x - moving.max.x;
      invExit.x = target.max.x - moving.min.x;
    } else {
      invEntry.x = target.max.x - moving.min.x;
      invExit.x = target.min.x - moving.max.x;
    }
    if (velocity.y > 0) {
      invEntry.y = target.min.y - moving.max.y;
      invExit.y = target.max.y - moving.min.y;
    } else {
      invEntry.y = target.max.y - moving.min.y;
      invExit.y = target.min.y - moving.max.y;
    }
    if (velocity.z > 0) {
      invEntry.z = target.min.z - moving.max.z;
      invExit.z = target.max.z - moving.min.z;
    } else {
      invEntry.z = target.max.z - moving.min.z;
      invExit.z = target.min.z - moving.max.z;
    }

    const entry = new Vec3(
      velocity.x === 0 ? Number.NEGATIVE_INFINITY : invEntry.x / velocity.x,
      velocity.y === 0 ? Number.NEGATIVE_INFINITY : invEntry.y / velocity.y,
      velocity.z === 0 ? Number.NEGATIVE_INFINITY : invEntry.z / velocity.z
    );
    const exit = new Vec3(
      velocity.x === 0 ? Number.POSITIVE_INFINITY : invExit.x / velocity.x,
      velocity.y === 0 ? Number.POSITIVE_INFINITY : invExit.y / velocity.y,
      velocity.z === 0 ? Number.POSITIVE_INFINITY : invExit.z / velocity.z
    );
    const entryTime = Math.max(entry.x, entry.y, entry.z);
    const exitTime = Math.min(exit.x, exit.y, exit.z);
    if (entryTime > exitTime || (entry.x < 0 && entry.y < 0 && entry.z < 0) || entryTime > 1 || entryTime < 0) {
      return null;
    }
    const normal = new Vec3();
    if (entry.x >= entry.y && entry.x >= entry.z) {
      normal.x = invEntry.x < 0 ? 1 : -1;
    } else if (entry.y >= entry.z) {
      normal.y = invEntry.y < 0 ? 1 : -1;
    } else {
      normal.z = invEntry.z < 0 ? 1 : -1;
    }
    return { time: entryTime, normal };
  }

  private move(body: PhysicsBody, sample: PhysicsSample, delta: Vec3): void {
    body.grounded = false;
    this.moveAxis(body, sample, "x", delta.x);
    this.moveAxis(body, sample, "y", delta.y);
    this.moveAxis(body, sample, "z", delta.z);
  }

  private moveAxis(body: PhysicsBody, sample: PhysicsSample, axis: "x" | "y" | "z", amount: number): void {
    if (amount === 0) {
      return;
    }
    body.position[axis] += amount;
    let bounds = bodyBounds(body);
    const solids = this.overlappingSolidBlocks(bounds, sample);
    for (const block of solids) {
      const blockBox = new AABB(new Vec3(block.x, block.y, block.z), new Vec3(block.x + 1, block.y + 1, block.z + 1));
      if (!bounds.intersects(blockBox)) {
        continue;
      }
      if (axis === "y") {
        if (amount > 0) {
          body.position.y = blockBox.min.y - body.halfExtents.y - 1e-5;
        } else {
          body.position.y = blockBox.max.y + body.halfExtents.y + 1e-5;
          body.grounded = true;
        }
        body.velocity.y *= -body.restitution;
      } else {
        if (this.tryStep(body, sample, axis, amount)) {
          bounds = bodyBounds(body);
          continue;
        }
        if (amount > 0) {
          body.position[axis] = blockBox.min[axis] - body.halfExtents[axis] - 1e-5;
        } else {
          body.position[axis] = blockBox.max[axis] + body.halfExtents[axis] + 1e-5;
        }
        body.velocity[axis] = 0;
      }
      bounds = bodyBounds(body);
    }
  }

  private tryStep(body: PhysicsBody, sample: PhysicsSample, axis: "x" | "z", amount: number): boolean {
    if (!body.grounded) {
      return false;
    }
    const original = body.position.clone();
    body.position.y += this.stairHeight;
    body.position[axis] += amount > 0 ? 1e-4 : -1e-4;
    if (this.overlappingSolidBlocks(bodyBounds(body), sample).length === 0) {
      body.grounded = false;
      this.moveAxis(body, sample, "y", -this.stairHeight);
      return true;
    }
    body.position.copy(original);
    return false;
  }

  private overlappingSolidBlocks(bounds: AABB, sample: PhysicsSample): Array<{ x: number; y: number; z: number }> {
    const result: Array<{ x: number; y: number; z: number }> = [];
    const minX = Math.floor(bounds.min.x);
    const minY = Math.floor(bounds.min.y);
    const minZ = Math.floor(bounds.min.z);
    const maxX = Math.floor(bounds.max.x);
    const maxY = Math.floor(bounds.max.y);
    const maxZ = Math.floor(bounds.max.z);
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const block = sample.getBlock(x, y, z);
          if (this.registry.get(block).solid) {
            result.push({ x, y, z });
          }
        }
      }
    }
    return result;
  }

  private fluidDrag(body: PhysicsBody, sample: PhysicsSample): number {
    const block = sample.getBlock(Math.floor(body.position.x), Math.floor(body.position.y), Math.floor(body.position.z));
    const definition = this.registry.get(block);
    return definition.fluid ? definition.fluidViscosity : 0;
  }
}

export function bodyBounds(body: PhysicsBody): AABB {
  return new AABB(Vec3.sub(body.position, body.halfExtents), Vec3.add(body.position, body.halfExtents));
}

function applyFriction(value: number, friction: number, dt: number): number {
  const drop = friction * dt;
  if (Math.abs(value) <= drop) {
    return 0;
  }
  return value - Math.sign(value) * drop;
}

function clampVelocity(velocity: Vec3, max: number): void {
  const len = velocity.length();
  if (len > max) {
    velocity.scale(max / len);
  }
}
