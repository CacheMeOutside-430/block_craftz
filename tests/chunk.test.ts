import { describe, expect, it } from "vitest";
import { Chunk, CHUNK_VOLUME } from "../engine/voxel";
import { ChunkSerializer } from "../engine/serialization";

describe("palette chunks", () => {
  it("stores blocks in a bit-packed palette and round-trips serialization", () => {
    const chunk = new Chunk({ x: -1, y: 2, z: 3 });
    chunk.setBlock(0, 0, 0, 7);
    chunk.setBlock(15, 15, 15, 11);
    expect(chunk.getBlock(0, 0, 0)).toBe(7);
    expect(chunk.getBlock(15, 15, 15)).toBe(11);
    expect(chunk.packedData().length).toBeLessThan(CHUNK_VOLUME);
    const serializer = new ChunkSerializer();
    const copy = serializer.decode(serializer.encode(chunk));
    expect(copy.coord).toEqual(chunk.coord);
    expect(copy.getBlock(0, 0, 0)).toBe(7);
    expect(copy.getBlock(15, 15, 15)).toBe(11);
    expect(copy.checksum()).toBe(chunk.checksum());
  });
});
