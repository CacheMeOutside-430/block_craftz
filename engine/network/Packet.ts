import { BinaryReader, BinaryWriter } from "../serialization";

export enum PacketKind {
  Hello = 1,
  Input = 2,
  EntitySnapshot = 3,
  ChunkData = 4,
  Ack = 5,
  Correction = 6
}

export interface Packet {
  readonly kind: PacketKind;
  readonly sequence: number;
  readonly tick: number;
  readonly payload: Uint8Array;
}

export class PacketCodec {
  encode(packet: Packet): Uint8Array {
    const writer = new BinaryWriter();
    writer.writeU8(packet.kind);
    writer.writeU32(packet.sequence);
    writer.writeU32(packet.tick);
    writer.writeVarUint(packet.payload.length);
    writer.writeBytes(packet.payload);
    return writer.toUint8Array();
  }

  decode(bytes: Uint8Array): Packet {
    const reader = new BinaryReader(bytes);
    const kind = reader.readU8() as PacketKind;
    const sequence = reader.readU32();
    const tick = reader.readU32();
    const length = reader.readVarUint();
    return { kind, sequence, tick, payload: reader.readBytes(length) };
  }
}

export class SnapshotWriter {
  private readonly writer = new BinaryWriter();

  entity(id: number, components: Record<string, unknown>): this {
    this.writer.writeU32(id);
    const json = JSON.stringify(components);
    this.writer.writeString(json);
    return this;
  }

  toPacket(kind: PacketKind, sequence: number, tick: number): Packet {
    return { kind, sequence, tick, payload: this.writer.toUint8Array() };
  }
}
