export interface Recipe {
  readonly id: string;
  readonly inputs: Record<string, number>;
  readonly output: { item: string; count: number };
}

export const RECIPES: readonly Recipe[] = [
  { id: "brick_from_stone", inputs: { stone: 4 }, output: { item: "brick", count: 4 } },
  { id: "lamp_from_ore", inputs: { coal: 1, iron: 1, sand: 1 }, output: { item: "lamp", count: 1 } },
  { id: "wire_from_ore", inputs: { iron: 1 }, output: { item: "wire", count: 6 } }
];
