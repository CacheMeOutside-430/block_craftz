import { Matrix4 } from "./Matrix4";
import { Quaternion } from "./Quaternion";
import { Vec3 } from "./Vector";

export class Transform {
  position = new Vec3();
  rotation = Quaternion.identity();
  scale = new Vec3(1, 1, 1);

  matrix(): Matrix4 {
    return Matrix4.compose(this.position, this.rotation, this.scale);
  }

  forward(): Vec3 {
    return this.rotation.rotateVector(new Vec3(0, 0, -1)).normalize();
  }

  right(): Vec3 {
    return this.rotation.rotateVector(new Vec3(1, 0, 0)).normalize();
  }

  up(): Vec3 {
    return this.rotation.rotateVector(new Vec3(0, 1, 0)).normalize();
  }
}
