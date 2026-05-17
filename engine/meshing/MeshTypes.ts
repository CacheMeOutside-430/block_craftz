export interface MeshData {
  readonly positions: number[];
  readonly normals: number[];
  readonly uvs: number[];
  readonly colors: number[];
  readonly indices: number[];
  readonly transparent: boolean;
}

export function createMeshData(transparent: boolean): MeshData {
  return {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
    indices: [],
    transparent
  };
}

export interface ChunkMesh {
  readonly opaque: MeshData;
  readonly transparent: MeshData;
  readonly version: number;
}
