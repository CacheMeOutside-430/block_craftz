export interface Allocation {
  readonly buffer: ArrayBuffer;
  readonly byteOffset: number;
  readonly byteLength: number;
}

export class ArenaAllocator {
  private readonly buffer: ArrayBuffer;
  private offset = 0;
  private readonly markers: number[] = [];

  constructor(public readonly capacity: number) {
    this.buffer = new ArrayBuffer(capacity);
  }

  get used(): number {
    return this.offset;
  }

  allocate(byteLength: number, alignment = 8): Allocation {
    const aligned = (this.offset + alignment - 1) & ~(alignment - 1);
    const next = aligned + byteLength;
    if (next > this.capacity) {
      throw new Error(`Arena exhausted: requested ${byteLength}, available ${this.capacity - aligned}`);
    }
    this.offset = next;
    return { buffer: this.buffer, byteOffset: aligned, byteLength };
  }

  allocateFloat32(count: number, alignment = 16): Float32Array {
    const allocation = this.allocate(count * Float32Array.BYTES_PER_ELEMENT, alignment);
    return new Float32Array(allocation.buffer, allocation.byteOffset, count);
  }

  allocateUint32(count: number, alignment = 16): Uint32Array {
    const allocation = this.allocate(count * Uint32Array.BYTES_PER_ELEMENT, alignment);
    return new Uint32Array(allocation.buffer, allocation.byteOffset, count);
  }

  mark(): number {
    this.markers.push(this.offset);
    return this.offset;
  }

  rewind(marker?: number): void {
    const target = marker ?? this.markers.pop();
    if (target === undefined || target < 0 || target > this.offset) {
      throw new Error("Invalid arena marker");
    }
    this.offset = target;
  }

  reset(): void {
    this.offset = 0;
    this.markers.length = 0;
  }
}
