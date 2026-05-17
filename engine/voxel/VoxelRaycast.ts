import { Vec3 } from "../math";
import type { BlockId } from "./Block";

export interface VoxelHit {
  readonly position: Vec3;
  readonly normal: Vec3;
  readonly block: BlockId;
  readonly distance: number;
}

export function voxelRaycast(
  origin: Vec3,
  direction: Vec3,
  maxDistance: number,
  sample: (x: number, y: number, z: number) => BlockId,
  isSolid: (block: BlockId) => boolean
): VoxelHit | null {
  const dir = direction.clone().normalize();
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;
  const nextBoundaryX = x + (dir.x > 0 ? 1 : 0);
  const nextBoundaryY = y + (dir.y > 0 ? 1 : 0);
  const nextBoundaryZ = z + (dir.z > 0 ? 1 : 0);

  let tMaxX = dir.x === 0 ? Number.POSITIVE_INFINITY : (nextBoundaryX - origin.x) / dir.x;
  let tMaxY = dir.y === 0 ? Number.POSITIVE_INFINITY : (nextBoundaryY - origin.y) / dir.y;
  let tMaxZ = dir.z === 0 ? Number.POSITIVE_INFINITY : (nextBoundaryZ - origin.z) / dir.z;
  const tDeltaX = dir.x === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dir.x);
  const tDeltaY = dir.y === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dir.y);
  const tDeltaZ = dir.z === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dir.z);
  let distance = 0;
  let normal = new Vec3();

  while (distance <= maxDistance) {
    const block = sample(x, y, z);
    if (isSolid(block)) {
      return { position: new Vec3(x, y, z), normal, block, distance };
    }

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      distance = tMaxX;
      tMaxX += tDeltaX;
      normal = new Vec3(-stepX, 0, 0);
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      distance = tMaxY;
      tMaxY += tDeltaY;
      normal = new Vec3(0, -stepY, 0);
    } else {
      z += stepZ;
      distance = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = new Vec3(0, 0, -stepZ);
    }
  }
  return null;
}
