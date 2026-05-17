import { BinaryReader, BinaryWriter } from "./Binary";
import { Chunk, type ChunkCoord } from "../voxel";

const CHUNK_SCHEMA_VERSION = 1;

export class ChunkSerializer {
  encode(chunk: Chunk): Uint8Array {
    const writer = new BinaryWriter();
    writer.writeString("SVCH");
    writer.writeU16(CHUNK_SCHEMA_VERSION);
    writer.writeI32(chunk.coord.x).writeI32(chunk.coord.y).writeI32(chunk.coord.z);
    writer.writeU8(chunk.getBitsPerEntry());
    const palette = chunk.paletteBlocks();
    writer.writeVarUint(palette.length);
    for (const block of palette) {
      writer.writeVarUint(block);
    }
    const packed = chunk.packedData();
    const compressed = rleEncodeUint32(packed);
    writer.writeVarUint(compressed.length);
    for (const value of compressed) {
      writer.writeU32(value.value);
      writer.writeVarUint(value.count);
    }
    writer.writeBytes(chunk.sunlight);
    writer.writeBytes(chunk.blockLightR);
    writer.writeBytes(chunk.blockLightG);
    writer.writeBytes(chunk.blockLightB);
    writer.writeBytes(chunk.fluidLevel);
    return writer.toUint8Array();
  }

  decode(payload: Uint8Array): Chunk {
    const reader = new BinaryReader(payload);
    const magic = reader.readString();
    if (magic !== "SVCH") {
      throw new Error("Invalid chunk magic");
    }
    const version = reader.readU16();
    if (version > CHUNK_SCHEMA_VERSION) {
      throw new Error(`Unsupported chunk schema version: ${version}`);
    }
    const coord: ChunkCoord = { x: reader.readI32(), y: reader.readI32(), z: reader.readI32() };
    const bits = reader.readU8();
    const paletteLength = reader.readVarUint();
    const palette: number[] = [];
    for (let i = 0; i < paletteLength; i++) {
      palette.push(reader.readVarUint());
    }
    const runCount = reader.readVarUint();
    const runs: Array<{ value: number; count: number }> = [];
    for (let i = 0; i < runCount; i++) {
      runs.push({ value: reader.readU32(), count: reader.readVarUint() });
    }
    const chunk = new Chunk(coord);
    chunk.importPacked(palette, bits, rleDecodeUint32(runs));
    chunk.sunlight.set(reader.readBytes(chunk.sunlight.length));
    chunk.blockLightR.set(reader.readBytes(chunk.blockLightR.length));
    chunk.blockLightG.set(reader.readBytes(chunk.blockLightG.length));
    chunk.blockLightB.set(reader.readBytes(chunk.blockLightB.length));
    chunk.fluidLevel.set(reader.readBytes(chunk.fluidLevel.length));
    return chunk;
  }
}

function rleEncodeUint32(values: Uint32Array): Array<{ value: number; count: number }> {
  const runs: Array<{ value: number; count: number }> = [];
  if (values.length === 0) {
    return runs;
  }
  let current = values[0];
  let count = 1;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === current) {
      count++;
    } else {
      runs.push({ value: current, count });
      current = values[i];
      count = 1;
    }
  }
  runs.push({ value: current, count });
  return runs;
}

function rleDecodeUint32(runs: Array<{ value: number; count: number }>): Uint32Array {
  const length = runs.reduce((sum, run) => sum + run.count, 0);
  const out = new Uint32Array(length);
  let cursor = 0;
  for (const run of runs) {
    out.fill(run.value, cursor, cursor + run.count);
    cursor += run.count;
  }
  return out;
}
