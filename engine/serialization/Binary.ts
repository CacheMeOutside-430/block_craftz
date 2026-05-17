export class BinaryWriter {
  private readonly bytes: number[] = [];

  writeU8(value: number): this {
    this.bytes.push(value & 0xff);
    return this;
  }

  writeU16(value: number): this {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff);
    return this;
  }

  writeU32(value: number): this {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    return this;
  }

  writeI32(value: number): this {
    return this.writeU32(value >>> 0);
  }

  writeF32(value: number): this {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    this.writeBytes(new Uint8Array(buffer));
    return this;
  }

  writeVarUint(value: number): this {
    let v = value >>> 0;
    while (v >= 0x80) {
      this.writeU8((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    this.writeU8(v);
    return this;
  }

  writeString(value: string): this {
    const encoded = new TextEncoder().encode(value);
    this.writeVarUint(encoded.length);
    this.writeBytes(encoded);
    return this;
  }

  writeBytes(value: Uint8Array): this {
    for (const byte of value) {
      this.bytes.push(byte);
    }
    return this;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

export class BinaryReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  readU8(): number {
    this.ensure(1);
    return this.bytes[this.offset++];
  }

  readU16(): number {
    this.ensure(2);
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readU32(): number {
    this.ensure(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readI32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readF32(): number {
    this.ensure(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readVarUint(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.readU8();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        return result >>> 0;
      }
      shift += 7;
      if (shift > 35) {
        throw new Error("Invalid varuint encoding");
      }
    }
  }

  readString(): string {
    const length = this.readVarUint();
    const bytes = this.readBytes(length);
    return new TextDecoder().decode(bytes);
  }

  readBytes(length: number): Uint8Array {
    this.ensure(length);
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  private ensure(length: number): void {
    if (this.offset + length > this.bytes.length) {
      throw new Error("Unexpected end of binary payload");
    }
  }
}
