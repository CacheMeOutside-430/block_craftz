import { Matrix4 } from "./Matrix4";
import { Vec3 } from "./Vector";

export class AABB {
  constructor(
    public min: Vec3,
    public max: Vec3
  ) {}

  clone(): AABB {
    return new AABB(this.min.clone(), this.max.clone());
  }

  translate(v: Vec3): AABB {
    return new AABB(Vec3.add(this.min, v), Vec3.add(this.max, v));
  }

  expand(v: Vec3): AABB {
    return new AABB(Vec3.sub(this.min, v), Vec3.add(this.max, v));
  }

  intersects(other: AABB): boolean {
    return (
      this.min.x <= other.max.x &&
      this.max.x >= other.min.x &&
      this.min.y <= other.max.y &&
      this.max.y >= other.min.y &&
      this.min.z <= other.max.z &&
      this.max.z >= other.min.z
    );
  }

  containsPoint(point: Vec3): boolean {
    return (
      point.x >= this.min.x &&
      point.x <= this.max.x &&
      point.y >= this.min.y &&
      point.y <= this.max.y &&
      point.z >= this.min.z &&
      point.z <= this.max.z
    );
  }

  center(): Vec3 {
    return new Vec3(
      (this.min.x + this.max.x) * 0.5,
      (this.min.y + this.max.y) * 0.5,
      (this.min.z + this.max.z) * 0.5
    );
  }

  size(): Vec3 {
    return Vec3.sub(this.max, this.min);
  }

  rayIntersect(origin: Vec3, direction: Vec3, maxDistance = Number.POSITIVE_INFINITY): number | null {
    let tMin = 0;
    let tMax = maxDistance;
    const axes: Array<"x" | "y" | "z"> = ["x", "y", "z"];
    for (const axis of axes) {
      const invD = 1 / direction[axis];
      let t0 = (this.min[axis] - origin[axis]) * invD;
      let t1 = (this.max[axis] - origin[axis]) * invD;
      if (invD < 0) {
        const swap = t0;
        t0 = t1;
        t1 = swap;
      }
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
      if (tMax < tMin) {
        return null;
      }
    }
    return tMin;
  }

  static fromCenterSize(center: Vec3, size: Vec3): AABB {
    const half = size.clone().scale(0.5);
    return new AABB(Vec3.sub(center, half), Vec3.add(center, half));
  }

  static union(a: AABB, b: AABB): AABB {
    return new AABB(Vec3.min(a.min, b.min), Vec3.max(a.max, b.max));
  }
}

export class Plane {
  constructor(
    public normal: Vec3,
    public distance: number
  ) {}

  normalize(): this {
    const len = this.normal.length();
    if (len > 0) {
      this.normal.scale(1 / len);
      this.distance /= len;
    }
    return this;
  }

  distanceToPoint(point: Vec3): number {
    return this.normal.dot(point) + this.distance;
  }
}

export class Frustum {
  constructor(public planes: Plane[]) {}

  intersectsAABB(box: AABB): boolean {
    for (const plane of this.planes) {
      const p = new Vec3(
        plane.normal.x >= 0 ? box.max.x : box.min.x,
        plane.normal.y >= 0 ? box.max.y : box.min.y,
        plane.normal.z >= 0 ? box.max.z : box.min.z
      );
      if (plane.distanceToPoint(p) < 0) {
        return false;
      }
    }
    return true;
  }

  containsPoint(point: Vec3): boolean {
    return this.planes.every((plane) => plane.distanceToPoint(point) >= 0);
  }

  static fromMatrix(matrix: Matrix4): Frustum {
    const m = matrix.m;
    const planes = [
      new Plane(new Vec3(m[3] + m[0], m[7] + m[4], m[11] + m[8]), m[15] + m[12]),
      new Plane(new Vec3(m[3] - m[0], m[7] - m[4], m[11] - m[8]), m[15] - m[12]),
      new Plane(new Vec3(m[3] + m[1], m[7] + m[5], m[11] + m[9]), m[15] + m[13]),
      new Plane(new Vec3(m[3] - m[1], m[7] - m[5], m[11] - m[9]), m[15] - m[13]),
      new Plane(new Vec3(m[3] + m[2], m[7] + m[6], m[11] + m[10]), m[15] + m[14]),
      new Plane(new Vec3(m[3] - m[2], m[7] - m[6], m[11] - m[10]), m[15] - m[14])
    ];
    planes.forEach((plane) => plane.normalize());
    return new Frustum(planes);
  }
}
