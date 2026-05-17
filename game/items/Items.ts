export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly stackSize: number;
  readonly block?: string;
}

export const ITEMS: readonly ItemDefinition[] = [
  { id: "grass", name: "Grass", stackSize: 64, block: "grass" },
  { id: "dirt", name: "Dirt", stackSize: 64, block: "dirt" },
  { id: "stone", name: "Stone", stackSize: 64, block: "stone" },
  { id: "sand", name: "Sand", stackSize: 64, block: "sand" },
  { id: "brick", name: "Brick", stackSize: 64, block: "brick" },
  { id: "lamp", name: "Lamp", stackSize: 16, block: "lamp" },
  { id: "water", name: "Water", stackSize: 1, block: "water" },
  { id: "wire", name: "Wire", stackSize: 64, block: "signal_wire" }
];
