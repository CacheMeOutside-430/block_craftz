import { describe, expect, it } from "vitest";
import { PacketCodec, PacketKind } from "../engine/network";

describe("packet codec", () => {
  it("round-trips packet payloads", () => {
    const codec = new PacketCodec();
    const packet = { kind: PacketKind.Input, sequence: 7, tick: 99, payload: new Uint8Array([1, 2, 3]) };
    expect(codec.decode(codec.encode(packet))).toEqual(packet);
  });
});
