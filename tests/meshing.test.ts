import { describe, expect, it } from "vitest";
import { GreedyMesher } from "../engine/meshing";
import { Chunk } from "../engine/voxel";
import { registerGameBlocks } from "../game/blocks";

describe("greedy meshing", () => {
  it("merges a solid chunk into six quads", () => {
    const { registry, blocks } = registerGameBlocks();
    const chunk = new Chunk({ x: 0, y: 0, z: 0 });
    chunk.fill(blocks.stone);
    const mesh = new GreedyMesher(registry).meshChunk(chunk);
    expect(mesh.opaque.indices.length / 6).toBe(6);
  });
});
