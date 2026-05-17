export type BlockId = number;

export interface BlockDefinition {
  readonly id: BlockId;
  readonly name: string;
  readonly solid: boolean;
  readonly opaque: boolean;
  readonly transparent: boolean;
  readonly fluid: boolean;
  readonly fluidViscosity: number;
  readonly light: [number, number, number];
  readonly signal: boolean;
  readonly blastResistance: number;
  readonly atlas: { x: number; y: number };
  readonly color: string;
}

export type BlockRegistration = Omit<BlockDefinition, "id">;

export class VoxelRegistry {
  private readonly blocks: BlockDefinition[] = [];
  private readonly idsByName = new Map<string, BlockId>();

  constructor() {
    this.register({
      name: "air",
      solid: false,
      opaque: false,
      transparent: true,
      fluid: false,
      fluidViscosity: 0,
      light: [0, 0, 0],
      signal: false,
      blastResistance: 0,
      atlas: { x: 0, y: 0 },
      color: "#00000000"
    });
  }

  register(definition: BlockRegistration): BlockDefinition {
    if (this.idsByName.has(definition.name)) {
      throw new Error(`Duplicate block registration: ${definition.name}`);
    }
    const block: BlockDefinition = { id: this.blocks.length, ...definition };
    this.blocks.push(block);
    this.idsByName.set(block.name, block.id);
    return block;
  }

  get(id: BlockId): BlockDefinition {
    const block = this.blocks[id];
    if (!block) {
      throw new Error(`Unknown block id: ${id}`);
    }
    return block;
  }

  id(name: string): BlockId {
    const id = this.idsByName.get(name);
    if (id === undefined) {
      throw new Error(`Unknown block: ${name}`);
    }
    return id;
  }

  maybeId(name: string): BlockId | undefined {
    return this.idsByName.get(name);
  }

  all(): readonly BlockDefinition[] {
    return this.blocks;
  }
}
