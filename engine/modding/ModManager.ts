import { ScriptRuntime, type ScriptModule } from "../scripting";
import type { VoxelRegistry, BlockRegistration } from "../voxel";

export interface ModManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly blocks?: BlockRegistration[];
  readonly scripts?: ScriptModule[];
}

export class ModManager {
  private readonly mods = new Map<string, ModManifest>();

  constructor(
    private readonly registry: VoxelRegistry,
    private readonly scripts: ScriptRuntime
  ) {}

  load(manifest: ModManifest): void {
    if (this.mods.has(manifest.id)) {
      throw new Error(`Mod already loaded: ${manifest.id}`);
    }
    for (const block of manifest.blocks ?? []) {
      this.registry.register(block);
    }
    for (const script of manifest.scripts ?? []) {
      this.scripts.register(script);
    }
    this.mods.set(manifest.id, manifest);
  }

  list(): readonly ModManifest[] {
    return [...this.mods.values()];
  }
}
