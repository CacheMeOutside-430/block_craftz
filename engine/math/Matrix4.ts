import { Quaternion } from "./Quaternion";
import { EPSILON, Vec3, Vec4 } from "./Vector";

export class Matrix4 {
  readonly m: Float32Array;

  constructor(values?: ArrayLike<number>) {
    this.m = new Float32Array(16);
    if (values) {
      this.m.set(values);
    } else {
      this.identity();
    }
  }

  identity(): this {
    const m = this.m;
    m.fill(0);
    m[0] = 1;
    m[5] = 1;
    m[10] = 1;
    m[15] = 1;
    return this;
  }

  clone(): Matrix4 {
    return new Matrix4(this.m);
  }

  multiply(b: Matrix4): this {
    this.m.set(Matrix4.multiply(this, b).m);
    return this;
  }

  transformPoint(v: Vec3): Vec3 {
    const m = this.m;
    const x = v.x;
    const y = v.y;
    const z = v.z;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const invW = Math.abs(w) > EPSILON ? 1 / w : 1;
    return new Vec3(
      (m[0] * x + m[4] * y + m[8] * z + m[12]) * invW,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) * invW,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) * invW
    );
  }

  transformVector4(v: Vec4): Vec4 {
    const m = this.m;
    return new Vec4(
      m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12] * v.w,
      m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13] * v.w,
      m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14] * v.w,
      m[3] * v.x + m[7] * v.y + m[11] * v.z + m[15] * v.w
    );
  }

  invert(): this {
    const inv = Matrix4.invert(this);
    this.m.set(inv.m);
    return this;
  }

  transpose(): this {
    const m = this.m;
    let tmp = m[1];
    m[1] = m[4];
    m[4] = tmp;
    tmp = m[2];
    m[2] = m[8];
    m[8] = tmp;
    tmp = m[3];
    m[3] = m[12];
    m[12] = tmp;
    tmp = m[6];
    m[6] = m[9];
    m[9] = tmp;
    tmp = m[7];
    m[7] = m[13];
    m[13] = tmp;
    tmp = m[11];
    m[11] = m[14];
    m[14] = tmp;
    return this;
  }

  static identity(): Matrix4 {
    return new Matrix4();
  }

  static translation(v: Vec3): Matrix4 {
    const out = new Matrix4();
    out.m[12] = v.x;
    out.m[13] = v.y;
    out.m[14] = v.z;
    return out;
  }

  static scale(v: Vec3): Matrix4 {
    const out = new Matrix4();
    out.m[0] = v.x;
    out.m[5] = v.y;
    out.m[10] = v.z;
    return out;
  }

  static rotation(q: Quaternion): Matrix4 {
    const x = q.x;
    const y = q.y;
    const z = q.z;
    const w = q.w;
    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;
    const xx = x * x2;
    const xy = x * y2;
    const xz = x * z2;
    const yy = y * y2;
    const yz = y * z2;
    const zz = z * z2;
    const wx = w * x2;
    const wy = w * y2;
    const wz = w * z2;
    return new Matrix4([
      1 - (yy + zz),
      xy + wz,
      xz - wy,
      0,
      xy - wz,
      1 - (xx + zz),
      yz + wx,
      0,
      xz + wy,
      yz - wx,
      1 - (xx + yy),
      0,
      0,
      0,
      0,
      1
    ]);
  }

  static compose(position: Vec3, rotation: Quaternion, scale: Vec3): Matrix4 {
    return Matrix4.multiply(Matrix4.translation(position), Matrix4.multiply(Matrix4.rotation(rotation), Matrix4.scale(scale)));
  }

  static multiply(a: Matrix4, b: Matrix4): Matrix4 {
    const out = new Matrix4();
    const am = a.m;
    const bm = b.m;
    const om = out.m;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        om[col * 4 + row] =
          am[0 * 4 + row] * bm[col * 4 + 0] +
          am[1 * 4 + row] * bm[col * 4 + 1] +
          am[2 * 4 + row] * bm[col * 4 + 2] +
          am[3 * 4 + row] * bm[col * 4 + 3];
      }
    }
    return out;
  }

  static perspective(fovYRadians: number, aspect: number, near: number, far: number): Matrix4 {
    const f = 1 / Math.tan(fovYRadians / 2);
    const nf = 1 / (near - far);
    return new Matrix4([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) * nf,
      -1,
      0,
      0,
      2 * far * near * nf,
      0
    ]);
  }

  static orthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number
  ): Matrix4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    return new Matrix4([
      -2 * lr,
      0,
      0,
      0,
      0,
      -2 * bt,
      0,
      0,
      0,
      0,
      2 * nf,
      0,
      (left + right) * lr,
      (top + bottom) * bt,
      (far + near) * nf,
      1
    ]);
  }

  static lookAt(eye: Vec3, target: Vec3, up: Vec3): Matrix4 {
    const z = Vec3.sub(eye, target).normalize();
    const x = up.clone().cross(z).normalize();
    const y = z.clone().cross(x).normalize();
    return new Matrix4([
      x.x,
      y.x,
      z.x,
      0,
      x.y,
      y.y,
      z.y,
      0,
      x.z,
      y.z,
      z.z,
      0,
      -x.dot(eye),
      -y.dot(eye),
      -z.dot(eye),
      1
    ]);
  }

  static invert(mat: Matrix4): Matrix4 {
    const a = mat.m;
    const out = new Matrix4();
    const o = out.m;

    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (Math.abs(det) <= EPSILON) {
      throw new Error("Matrix is not invertible");
    }
    det = 1 / det;

    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
  }
}
