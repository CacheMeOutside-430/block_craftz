import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vec3 } from "../engine/math";

describe("math primitives", () => {
  it("inverts composed transforms", () => {
    const matrix = Matrix4.compose(
      new Vec3(3, 4, 5),
      Quaternion.fromAxisAngle(new Vec3(0, 1, 0), Math.PI / 4),
      new Vec3(2, 2, 2)
    );
    const inverse = Matrix4.invert(matrix);
    const point = new Vec3(7, 8, 9);
    const restored = inverse.transformPoint(matrix.transformPoint(point));
    expect(restored.distance(point)).toBeLessThan(0.0001);
  });
});
