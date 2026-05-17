import { describe, expect, it } from "vitest";
import { TerrainGenerator } from "../engine/generation";

describe("terrain generation", () => {
  it("is reproducible for the same seed and coordinate", () => {
    const a = new TerrainGenerator({ seed: "world" }).generateChunk({ x: 2, y: 1, z: -4 });
    const b = new TerrainGenerator({ seed: "world" }).generateChunk({ x: 2, y: 1, z: -4 });
    const c = new TerrainGenerator({ seed: "other" }).generateChunk({ x: 2, y: 1, z: -4 });
    expect(a.checksum()).toBe(b.checksum());
    expect(a.checksum()).not.toBe(c.checksum());
  });
});
