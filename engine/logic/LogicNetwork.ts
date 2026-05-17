import { Vec3 } from "../math";

export type LogicNodeKind = "wire" | "source" | "not" | "and" | "or" | "repeater";

export interface LogicNode {
  readonly id: string;
  readonly kind: LogicNodeKind;
  readonly position: Vec3;
  readonly inputs: string[];
  readonly delay: number;
  strength: number;
  nextStrength: number;
}

export class LogicNetwork {
  private readonly nodes = new Map<string, LogicNode>();
  private tick = 0;

  addNode(node: Omit<LogicNode, "nextStrength">): void {
    this.nodes.set(node.id, { ...node, nextStrength: node.strength });
  }

  removeNode(id: string): void {
    this.nodes.delete(id);
    for (const node of this.nodes.values()) {
      const inputs = node.inputs.filter((input) => input !== id);
      if (inputs.length !== node.inputs.length) {
        this.nodes.set(node.id, { ...node, inputs });
      }
    }
  }

  setSource(id: string, strength: number): void {
    const node = this.nodes.get(id);
    if (!node || node.kind !== "source") {
      throw new Error(`Missing source node: ${id}`);
    }
    node.strength = clampSignal(strength);
    node.nextStrength = node.strength;
  }

  update(): void {
    this.tick++;
    const ordered = [...this.nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const node of ordered) {
      node.nextStrength = this.evaluate(node);
    }
    for (const node of ordered) {
      if (node.delay === 0 || this.tick % node.delay === 0) {
        node.strength = node.nextStrength;
      }
    }
  }

  strength(id: string): number {
    return this.nodes.get(id)?.strength ?? 0;
  }

  snapshot(): Array<{ id: string; kind: LogicNodeKind; strength: number; inputs: string[] }> {
    return [...this.nodes.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((node) => ({ id: node.id, kind: node.kind, strength: node.strength, inputs: [...node.inputs] }));
  }

  private evaluate(node: LogicNode): number {
    if (node.kind === "source") {
      return node.strength;
    }
    const values = node.inputs.map((id) => this.nodes.get(id)?.strength ?? 0);
    const max = values.length > 0 ? Math.max(...values) : 0;
    switch (node.kind) {
      case "wire":
        return Math.max(0, max - 1);
      case "not":
        return max > 0 ? 0 : 15;
      case "and":
        return values.length > 0 && values.every((value) => value > 0) ? Math.min(...values) : 0;
      case "or":
        return max;
      case "repeater":
        return max > 0 ? 15 : 0;
      default:
        return 0;
    }
  }
}

function clampSignal(value: number): number {
  return Math.max(0, Math.min(15, Math.floor(value)));
}
