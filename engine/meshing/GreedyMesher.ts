import type { BlockDefinition, BlockId, VoxelRegistry } from "../voxel";
import { CHUNK_SIZE, Chunk, chunkOrigin } from "../voxel";
import { createMeshData, type ChunkMesh, type MeshData } from "./MeshTypes";

interface FaceMask {
  readonly block: BlockId;
  readonly normalAxis: 0 | 1 | 2;
  readonly normalSign: 1 | -1;
  readonly transparent: boolean;
}

type BlockSampler = (worldX: number, worldY: number, worldZ: number) => BlockId;

export class GreedyMesher {
  constructor(
    private readonly registry: VoxelRegistry,
    private readonly atlasColumns = 8
  ) {}

  meshChunk(chunk: Chunk, sampleWorld?: BlockSampler): ChunkMesh {
    const opaque = createMeshData(false);
    const transparent = createMeshData(true);
    const origin = chunkOrigin(chunk.coord);
    const dims = [CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE];
    const x = [0, 0, 0];
    const q = [0, 0, 0];
    const mask: Array<FaceMask | null> = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(null);

    const blockAt = (lx: number, ly: number, lz: number): BlockId => {
      if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
        return chunk.getBlock(lx, ly, lz);
      }
      return sampleWorld?.(origin.x + lx, origin.y + ly, origin.z + lz) ?? 0;
    };

    for (let d = 0 as 0 | 1 | 2; d < 3; d = (d + 1) as 0 | 1 | 2) {
      const u = ((d + 1) % 3) as 0 | 1 | 2;
      const v = ((d + 2) % 3) as 0 | 1 | 2;
      q[0] = 0;
      q[1] = 0;
      q[2] = 0;
      q[d] = 1;

      for (x[d] = -1; x[d] < dims[d]; ) {
        let n = 0;
        for (x[v] = 0; x[v] < dims[v]; x[v]++) {
          for (x[u] = 0; x[u] < dims[u]; x[u]++) {
            const a = x[d] >= 0 ? blockAt(x[0], x[1], x[2]) : 0;
            const b =
              x[d] < dims[d] - 1 ? blockAt(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : blockAt(x[0] + q[0], x[1] + q[1], x[2] + q[2]);
            mask[n++] = this.faceBetween(a, b, d);
          }
        }

        x[d]++;
        n = 0;
        for (let j = 0; j < dims[v]; j++) {
          for (let i = 0; i < dims[u]; ) {
            const face = mask[n];
            if (!face) {
              i++;
              n++;
              continue;
            }

            let w = 1;
            while (i + w < dims[u] && this.sameFace(face, mask[n + w])) {
              w++;
            }

            let h = 1;
            outer: while (j + h < dims[v]) {
              for (let k = 0; k < w; k++) {
                if (!this.sameFace(face, mask[n + k + h * dims[u]])) {
                  break outer;
                }
              }
              h++;
            }

            x[u] = i;
            x[v] = j;
            const du = [0, 0, 0];
            const dv = [0, 0, 0];
            du[u] = w;
            dv[v] = h;
            const target = face.transparent ? transparent : opaque;
            this.pushQuad(target, face, [x[0], x[1], x[2]], du, dv, origin);

            for (let yy = 0; yy < h; yy++) {
              for (let xx = 0; xx < w; xx++) {
                mask[n + xx + yy * dims[u]] = null;
              }
            }

            i += w;
            n += w;
          }
        }
      }
    }

    chunk.dirtyMesh = false;
    return { opaque, transparent, version: chunk.version };
  }

  private faceBetween(a: BlockId, b: BlockId, axis: 0 | 1 | 2): FaceMask | null {
    if (a === b) {
      return null;
    }
    const air = 0;
    const aDef = this.registry.get(a);
    const bDef = this.registry.get(b);
    if (a !== air && this.visibleAgainst(aDef, bDef)) {
      return { block: a, normalAxis: axis, normalSign: 1, transparent: aDef.transparent && !aDef.opaque };
    }
    if (b !== air && this.visibleAgainst(bDef, aDef)) {
      return { block: b, normalAxis: axis, normalSign: -1, transparent: bDef.transparent && !bDef.opaque };
    }
    return null;
  }

  private visibleAgainst(block: BlockDefinition, neighbor: BlockDefinition): boolean {
    if (neighbor.id === 0) {
      return true;
    }
    if (block.fluid && neighbor.fluid && block.id === neighbor.id) {
      return false;
    }
    return !neighbor.opaque || block.transparent !== neighbor.transparent;
  }

  private sameFace(a: FaceMask | null, b: FaceMask | null): boolean {
    return (
      !!a &&
      !!b &&
      a.block === b.block &&
      a.normalAxis === b.normalAxis &&
      a.normalSign === b.normalSign &&
      a.transparent === b.transparent
    );
  }

  private pushQuad(
    mesh: MeshData,
    face: FaceMask,
    position: number[],
    du: number[],
    dv: number[],
    origin: { x: number; y: number; z: number }
  ): void {
    const base = mesh.positions.length / 3;
    const p = position;
    const vertices =
      face.normalSign > 0
        ? [p, add(p, du), add(add(p, du), dv), add(p, dv)]
        : [p, add(p, dv), add(add(p, du), dv), add(p, du)];
    const normal = [0, 0, 0];
    normal[face.normalAxis] = face.normalSign;
    const block = this.registry.get(face.block);
    const tile = block.atlas;
    const ts = 1 / this.atlasColumns;
    const u0 = tile.x * ts;
    const v0 = tile.y * ts;
    const u1 = u0 + ts;
    const v1 = v0 + ts;
    const uv = [
      [u0, v1],
      [u1, v1],
      [u1, v0],
      [u0, v0]
    ];
    const color = colorToRgb(block.color);
    for (let i = 0; i < 4; i++) {
      mesh.positions.push(vertices[i][0] + origin.x, vertices[i][1] + origin.y, vertices[i][2] + origin.z);
      mesh.normals.push(normal[0], normal[1], normal[2]);
      mesh.uvs.push(uv[i][0], uv[i][1]);
      mesh.colors.push(color[0], color[1], color[2]);
    }
    mesh.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function add(a: number[], b: number[]): number[] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function colorToRgb(color: string): [number, number, number] {
  const normalized = color.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2) || "ff", 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4) || "ff", 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6) || "ff", 16) / 255;
  return [r, g, b];
}
