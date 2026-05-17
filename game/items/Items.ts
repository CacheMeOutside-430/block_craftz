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
  { id: "sandstone", name: "Sandstone", stackSize: 64, block: "sandstone" },
  { id: "snow", name: "Snow", stackSize: 64, block: "snow" },
  { id: "log", name: "Log", stackSize: 64, block: "log" },
  { id: "leaves", name: "Leaves", stackSize: 64, block: "leaves" },
  { id: "coal_ore", name: "Coal Ore", stackSize: 64, block: "coal_ore" },
  { id: "iron_ore", name: "Iron Ore", stackSize: 64, block: "iron_ore" },
  { id: "brick", name: "Brick", stackSize: 64, block: "brick" },
  { id: "lamp", name: "Lamp", stackSize: 16, block: "lamp" },
  { id: "water", name: "Water", stackSize: 1, block: "water" },
  { id: "wire", name: "Wire", stackSize: 64, block: "signal_wire" }
];
