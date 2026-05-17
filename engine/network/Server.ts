import { EventBus } from "../core";
import { BinaryWriter } from "../serialization";
import { PacketCodec, PacketKind, type Packet } from "./Packet";
import { DeltaCompressor, ReplicationGraph } from "./Replication";

export interface NetworkEvents {
  clientConnected: string;
  clientDisconnected: string;
  packet: { clientId: string; packet: Packet };
}

export interface Transport {
  send(clientId: string, payload: Uint8Array): void;
}

export class InMemoryTransport implements Transport {
  readonly sent: Array<{ clientId: string; payload: Uint8Array }> = [];

  send(clientId: string, payload: Uint8Array): void {
    this.sent.push({ clientId, payload });
  }
}

export class AuthoritativeServer {
  readonly events = new EventBus<NetworkEvents>();
  readonly replication = new ReplicationGraph();
  private readonly codec = new PacketCodec();
  private readonly compressors = new Map<string, DeltaCompressor>();
  private sequence = 1;
  private clients = new Set<string>();

  constructor(private readonly transport: Transport) {}

  connect(clientId: string): void {
    this.clients.add(clientId);
    this.compressors.set(clientId, new DeltaCompressor());
    this.events.emit("clientConnected", clientId);
  }

  disconnect(clientId: string): void {
    this.clients.delete(clientId);
    this.compressors.delete(clientId);
    this.replication.removeClient(clientId);
    this.events.emit("clientDisconnected", clientId);
  }

  receive(clientId: string, bytes: Uint8Array): void {
    const packet = this.codec.decode(bytes);
    this.events.emit("packet", { clientId, packet });
    this.send(clientId, {
      kind: PacketKind.Ack,
      sequence: this.sequence++,
      tick: packet.tick,
      payload: new BinaryWriter().writeU32(packet.sequence).toUint8Array()
    });
  }

  replicate(tick: number): void {
    for (const clientId of this.clients) {
      const compressor = this.compressors.get(clientId);
      if (!compressor) {
        continue;
      }
      const deltas = compressor.diff(this.replication.relevantEntities(clientId));
      if (deltas.length === 0) {
        continue;
      }
      const payload = new TextEncoder().encode(JSON.stringify(deltas));
      this.send(clientId, { kind: PacketKind.EntitySnapshot, sequence: this.sequence++, tick, payload });
    }
  }

  send(clientId: string, packet: Packet): void {
    this.transport.send(clientId, this.codec.encode(packet));
  }
}
