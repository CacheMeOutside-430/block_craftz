export type BufferUsage = "vertex" | "index" | "uniform" | "storage" | "staging";
export type TextureFormat = "rgba8" | "rgba16f" | "depth24";

export interface GpuBuffer {
  readonly id: number;
  readonly usage: BufferUsage;
  readonly byteLength: number;
  data: ArrayBuffer;
}

export interface GpuTexture {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly format: TextureFormat;
}

export interface DescriptorSet {
  readonly id: number;
  readonly bindings: Map<number, GpuBuffer | GpuTexture>;
}

export class CommandBuffer {
  private readonly commands: Array<() => void> = [];

  record(command: () => void): void {
    this.commands.push(command);
  }

  execute(): void {
    for (const command of this.commands) {
      command();
    }
    this.commands.length = 0;
  }
}

export class GpuDevice {
  private nextId = 1;
  private readonly buffers = new Map<number, GpuBuffer>();
  private readonly textures = new Map<number, GpuTexture>();

  createBuffer(usage: BufferUsage, byteLength: number, initial?: ArrayBufferView): GpuBuffer {
    const buffer: GpuBuffer = {
      id: this.nextId++,
      usage,
      byteLength,
      data: new ArrayBuffer(byteLength)
    };
    if (initial) {
      new Uint8Array(buffer.data).set(new Uint8Array(initial.buffer, initial.byteOffset, Math.min(initial.byteLength, byteLength)));
    }
    this.buffers.set(buffer.id, buffer);
    return buffer;
  }

  updateBuffer(buffer: GpuBuffer, offset: number, data: ArrayBufferView): void {
    if (offset + data.byteLength > buffer.byteLength) {
      throw new Error("GPU buffer update exceeds allocation");
    }
    new Uint8Array(buffer.data, offset, data.byteLength).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  createTexture(width: number, height: number, format: TextureFormat): GpuTexture {
    const texture: GpuTexture = { id: this.nextId++, width, height, format };
    this.textures.set(texture.id, texture);
    return texture;
  }

  createDescriptorSet(bindings: Array<[number, GpuBuffer | GpuTexture]>): DescriptorSet {
    return { id: this.nextId++, bindings: new Map(bindings) };
  }

  createCommandBuffer(): CommandBuffer {
    return new CommandBuffer();
  }

  stats(): { buffers: number; textures: number; bytes: number } {
    let bytes = 0;
    for (const buffer of this.buffers.values()) {
      bytes += buffer.byteLength;
    }
    return { buffers: this.buffers.size, textures: this.textures.size, bytes };
  }
}
