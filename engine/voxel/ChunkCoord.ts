export const CHUNK_SIZE = 16;
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;

export interface ChunkCoord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LocalCoord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function chunkKey(coord: ChunkCoord): string {
  return `${coord.x},${coord.y},${coord.z}`;
}

export function parseChunkKey(key: string): ChunkCoord {
  const [x, y, z] = key.split(",").map((value) => Number.parseInt(value, 10));
  return { x, y, z };
}

export function chunkOrigin(coord: ChunkCoord): { x: number; y: number; z: number } {
  return {
    x: coord.x * CHUNK_SIZE,
    y: coord.y * CHUNK_SIZE,
    z: coord.z * CHUNK_SIZE
  };
}

export function voxelIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE + y * CHUNK_AREA;
}

export function inChunkBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE;
}

export function worldToChunk(x: number, y: number, z: number): ChunkCoord {
  return {
    x: Math.floor(x / CHUNK_SIZE),
    y: Math.floor(y / CHUNK_SIZE),
    z: Math.floor(z / CHUNK_SIZE)
  };
}

export function worldToLocal(x: number, y: number, z: number): LocalCoord {
  return {
    x: euclideanModulo(Math.floor(x), CHUNK_SIZE),
    y: euclideanModulo(Math.floor(y), CHUNK_SIZE),
    z: euclideanModulo(Math.floor(z), CHUNK_SIZE)
  };
}

export function euclideanModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
