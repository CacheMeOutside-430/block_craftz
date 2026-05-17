import { EPSILON, Vec3 } from "./Vector";

export class Quaternion {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
    public w = 1
  ) {}

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  normalize(): this {
    const len = Math.hypot(this.x, this.y, this.z, this.w);
    if (len > EPSILON) {
      const inv = 1 / len;
      this.x *= inv;
      this.y *= inv;
      this.z *= inv;
      this.w *= inv;
    }
    return this;
  }

  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w);
  }

  multiply(q: Quaternion): this {
    const ax = this.x;
    const ay = this.y;
    const az = this.z;
    const aw = this.w;
    const bx = q.x;
    const by = q.y;
    const bz = q.z;
    const bw = q.w;
    this.x = aw * bx + ax * bw + ay * bz - az * by;
    this.y = aw * by - ax * bz + ay * bw + az * bx;
    this.z = aw * bz + ax * by - ay * bx + az * bw;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
  }

  rotateVector(v: Vec3): Vec3 {
    const qv = new Quaternion(v.x, v.y, v.z, 0);
    const result = this.clone().multiply(qv).multiply(this.conjugate());
    return new Vec3(result.x, result.y, result.z);
  }

  static identity(): Quaternion {
    return new Quaternion();
  }

  static fromAxisAngle(axis: Vec3, radians: number): Quaternion {
    const n = axis.clone().normalize();
    const half = radians * 0.5;
    const s = Math.sin(half);
    return new Quaternion(n.x * s, n.y * s, n.z * s, Math.cos(half)).normalize();
  }

  static fromEuler(pitch: number, yaw: number, roll: number): Quaternion {
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    return new Quaternion(
      sr * cp * cy - cr * sp * sy,
      cr * sp * cy + sr * cp * sy,
      cr * cp * sy - sr * sp * cy,
      cr * cp * cy + sr * sp * sy
    ).normalize();
  }

  static multiply(a: Quaternion, b: Quaternion): Quaternion {
    return a.clone().multiply(b);
  }

  static slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
    let bx = b.x;
    let by = b.y;
    let bz = b.z;
    let bw = b.w;
    let cos = a.x * bx + a.y * by + a.z * bz + a.w * bw;

    if (cos < 0) {
      cos = -cos;
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    }

    if (cos > 0.9995) {
      return new Quaternion(
        a.x + t * (bx - a.x),
        a.y + t * (by - a.y),
        a.z + t * (bz - a.z),
        a.w + t * (bw - a.w)
      ).normalize();
    }

    const theta0 = Math.acos(Math.min(1, Math.max(-1, cos)));
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - (cos * sinTheta) / sinTheta0;
    const s1 = sinTheta / sinTheta0;

    return new Quaternion(
      a.x * s0 + bx * s1,
      a.y * s0 + by * s1,
      a.z * s0 + bz * s1,
      a.w * s0 + bw * s1
    ).normalize();
  }
}
