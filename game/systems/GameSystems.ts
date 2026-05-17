import type { World } from "../../engine/world";

export class AutosaveSystem {
  private elapsed = 0;

  constructor(
    private readonly interval: number,
    private readonly save: (world: World) => Promise<void>
  ) {}

  update(world: World, dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= this.interval) {
      this.elapsed = 0;
      void this.save(world);
    }
  }
}
