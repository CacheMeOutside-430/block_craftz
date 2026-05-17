import { Vec3 } from "../math";
import type { ChunkCoord } from "../voxel";

export interface ReplicatedEntity {
  readonly id: number;
  readonly position: Vec3;
  readonly components: Record<string, unknown>;
}

export interface ClientInterest {
  readonly id: string;
  position: Vec3;
  chunkRadius: number;
}

export class ReplicationGraph {
  private readonly clients = new Map<string, ClientInterest>();
  private readonly entities = new Map<number, ReplicatedEntity>();

  updateClient(client: ClientInterest): void {
    this.clients.set(client.id, { ...client, position: client.position.clone() });
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  updateEntity(entity: ReplicatedEntity): void {
    this.entities.set(entity.id, { ...entity, position: entity.position.clone() });
  }

  relevantEntities(clientId: string): ReplicatedEntity[] {
    const client = this.clients.get(clientId);
    if (!client) {
      return [];
    }
    const radiusBlocks = client.chunkRadius * 16;
    return [...this.entities.values()].filter((entity) => entity.position.distanceSq(client.position) <= radiusBlocks * radiusBlocks);
  }

  relevantChunks(clientId: string, loaded: Iterable<ChunkCoord>): ChunkCoord[] {
    const client = this.clients.get(clientId);
    if (!client) {
      return [];
    }
    const cx = Math.floor(client.position.x / 16);
    const cz = Math.floor(client.position.z / 16);
    return [...loaded].filter((coord) => {
      const dx = coord.x - cx;
      const dz = coord.z - cz;
      return dx * dx + dz * dz <= client.chunkRadius * client.chunkRadius;
    });
  }
}

export interface DeltaRecord {
  readonly id: number;
  readonly changed: Record<string, unknown>;
}

export class DeltaCompressor {
  private previous = new Map<number, string>();

  diff(entities: ReplicatedEntity[]): DeltaRecord[] {
    const result: DeltaRecord[] = [];
    for (const entity of entities) {
      const encoded = JSON.stringify(entity.components);
      if (this.previous.get(entity.id) !== encoded) {
        result.push({ id: entity.id, changed: entity.components });
        this.previous.set(entity.id, encoded);
      }
    }
    return result;
  }

  reset(): void {
    this.previous.clear();
  }
}
