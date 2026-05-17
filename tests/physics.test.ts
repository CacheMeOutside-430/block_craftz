import { describe, expect, it } from "vitest";
import { PhysicsWorld } from "../engine/physics";
import { Vec3 } from "../engine/math";
import { registerGameBlocks } from "../game/blocks";

describe("physics", () => {
  it("resolves falling bodies against voxel ground", () => {
    const { registry, blocks } = registerGameBlocks();
    const physics = new PhysicsWorld(registry);
    const body = physics.createBody(new Vec3(0.5, 3, 0.5), new Vec3(0.3, 0.9, 0.3));
    const sample = {
      getBlock: (_x: number, y: number, _z: number) => (y <= 0 ? blocks.stone : blocks.air)
    };
    for (let i = 0; i < 120; i++) {
      physics.step(body, sample, 1 / 60);
    }
    expect(body.grounded).toBe(true);
    expect(body.position.y).toBeGreaterThan(0.89);
  });
});
