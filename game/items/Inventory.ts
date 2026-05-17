import type { ItemDefinition } from "./Items";

export interface InventorySlot {
  itemId: string | null;
  count: number;
}

export class HotbarInventory {
  readonly slots: InventorySlot[];
  selected = 0;

  constructor(
    private readonly items: readonly ItemDefinition[],
    size = 9
  ) {
    this.slots = Array.from({ length: size }, (_, index) => {
      const item = items[index % items.length];
      return { itemId: item.id, count: item.stackSize };
    });
  }

  select(index: number): void {
    this.selected = ((index % this.slots.length) + this.slots.length) % this.slots.length;
  }

  selectedSlot(): InventorySlot {
    return this.slots[this.selected];
  }

  selectedItem(): ItemDefinition | undefined {
    const slot = this.selectedSlot();
    return slot.itemId ? this.itemById(slot.itemId) : undefined;
  }

  add(itemId: string, count: number): number {
    let remaining = count;
    const definition = this.itemById(itemId);
    if (!definition) {
      return remaining;
    }
    for (const slot of this.slots) {
      if (remaining <= 0) break;
      if (slot.itemId !== itemId || slot.count >= definition.stackSize) continue;
      const accepted = Math.min(remaining, definition.stackSize - slot.count);
      slot.count += accepted;
      remaining -= accepted;
    }
    for (const slot of this.slots) {
      if (remaining <= 0) break;
      if (slot.itemId !== null && slot.count > 0) continue;
      const accepted = Math.min(remaining, definition.stackSize);
      slot.itemId = itemId;
      slot.count = accepted;
      remaining -= accepted;
    }
    return remaining;
  }

  removeSelected(count: number): boolean {
    const slot = this.selectedSlot();
    if (!slot.itemId || slot.count < count) {
      return false;
    }
    slot.count -= count;
    if (slot.count <= 0) {
      slot.itemId = null;
      slot.count = 0;
    }
    return true;
  }

  snapshot(): Array<{ item: string; count: number }> {
    return this.slots.map((slot) => ({ item: slot.itemId ?? "", count: slot.count }));
  }

  private itemById(itemId: string): ItemDefinition | undefined {
    return this.items.find((item) => item.id === itemId);
  }
}
