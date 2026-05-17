import type { DebugSnapshot } from "../debug";

export class DebugOverlay {
  readonly root: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private readonly toolbar: HTMLDivElement;
  private readonly notice: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.stats = document.createElement("div");
    this.stats.className = "panel stats";
    this.toolbar = document.createElement("div");
    this.toolbar.className = "panel toolbar";
    this.notice = document.createElement("div");
    this.notice.className = "panel notice";
    this.notice.textContent = "Sovereign Voxel Engine";
    const reticle = document.createElement("div");
    reticle.className = "reticle";
    this.root.append(this.stats, this.toolbar, this.notice, reticle);
    parent.append(this.root);
  }

  setToolbar(blocks: readonly string[], selected: number): void {
    this.toolbar.replaceChildren(
      ...blocks.map((block, index) => {
        const slot = document.createElement("div");
        slot.className = `slot${index === selected ? " active" : ""}`;
        slot.textContent = block.slice(0, 4).toUpperCase();
        slot.title = block;
        return slot;
      })
    );
  }

  update(snapshot: DebugSnapshot): void {
    const profiler = Object.entries(snapshot.profiler)
      .slice(0, 5)
      .map(([name, value]) => `${name}: ${value.toFixed(2)}ms`)
      .join("<br>");
    this.stats.innerHTML = [
      `FPS: ${snapshot.fps.toFixed(0)}`,
      `Chunks: ${snapshot.chunksLoaded} loaded / ${snapshot.chunksPending} pending`,
      `Mesh queue: ${snapshot.meshQueue}`,
      `Player: ${snapshot.player.map((v) => v.toFixed(1)).join(", ")}`,
      profiler
    ]
      .filter(Boolean)
      .join("<br>");
  }
}
