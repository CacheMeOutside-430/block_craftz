import { Chunk, type ChunkCoord, chunkKey, parseChunkKey } from "../voxel";
import { ChunkSerializer } from "./ChunkSerializer";

export interface RegionStore {
  read(key: string): Promise<Uint8Array | null>;
  write(key: string, payload: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryRegionStore implements RegionStore {
  private readonly data = new Map<string, Uint8Array>();

  async read(key: string): Promise<Uint8Array | null> {
    return this.data.get(key)?.slice() ?? null;
  }

  async write(key: string, payload: Uint8Array): Promise<void> {
    this.data.set(key, payload.slice());
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }
}

export class LocalStorageRegionStore implements RegionStore {
  constructor(private readonly prefix = "sovereign-voxel") {}

  async read(key: string): Promise<Uint8Array | null> {
    const value = localStorage.getItem(`${this.prefix}:${key}`);
    return value ? base64ToBytes(value) : null;
  }

  async write(key: string, payload: Uint8Array): Promise<void> {
    const tempKey = `${this.prefix}:${key}:tmp`;
    const finalKey = `${this.prefix}:${key}`;
    localStorage.setItem(tempKey, bytesToBase64(payload));
    localStorage.setItem(finalKey, localStorage.getItem(tempKey)!);
    localStorage.removeItem(tempKey);
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(`${this.prefix}:${key}`);
  }

  async keys(): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${this.prefix}:`) && !key.endsWith(":tmp")) {
        out.push(key.slice(this.prefix.length + 1));
      }
    }
    return out;
  }
}

export class SaveSystem {
  private readonly serializer = new ChunkSerializer();

  constructor(private readonly store: RegionStore) {}

  async saveChunk(chunk: Chunk): Promise<void> {
    await this.store.write(chunkKey(chunk.coord), this.serializer.encode(chunk));
  }

  async loadChunk(coord: ChunkCoord): Promise<Chunk | null> {
    const payload = await this.store.read(chunkKey(coord));
    if (!payload) {
      return null;
    }
    try {
      return this.serializer.decode(payload);
    } catch {
      await this.store.write(`${chunkKey(coord)}.corrupt`, payload);
      await this.store.delete(chunkKey(coord));
      return null;
    }
  }

  async listChunks(): Promise<ChunkCoord[]> {
    const keys = await this.store.keys();
    return keys.filter((key) => !key.endsWith(".corrupt")).map(parseChunkKey);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
