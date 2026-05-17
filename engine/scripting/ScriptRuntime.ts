export interface ScriptApi {
  readonly emit: (event: string, payload: unknown) => void;
  readonly random: () => number;
  readonly getFlag: (name: string) => unknown;
  readonly setFlag: (name: string, value: unknown) => void;
}

export interface ScriptModule {
  readonly name: string;
  readonly hooks: Record<string, (payload: unknown, api: ScriptApi) => void>;
}

export class ScriptRuntime {
  private readonly modules = new Map<string, ScriptModule>();
  private readonly flags = new Map<string, unknown>();
  private readonly emitted: Array<{ event: string; payload: unknown }> = [];

  register(module: ScriptModule): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Script module already registered: ${module.name}`);
    }
    this.modules.set(module.name, module);
  }

  unregister(name: string): void {
    this.modules.delete(name);
  }

  dispatch(hook: string, payload: unknown): void {
    const api: ScriptApi = {
      emit: (event, eventPayload) => this.emitted.push({ event, payload: eventPayload }),
      random: deterministicUnit,
      getFlag: (name) => this.flags.get(name),
      setFlag: (name, value) => this.flags.set(name, value)
    };
    for (const module of this.modules.values()) {
      module.hooks[hook]?.(payload, api);
    }
  }

  drainEvents(): Array<{ event: string; payload: unknown }> {
    return this.emitted.splice(0);
  }
}

let scriptRandomState = 0x12345678;
function deterministicUnit(): number {
  scriptRandomState = Math.imul(scriptRandomState ^ (scriptRandomState >>> 15), 1 | scriptRandomState);
  scriptRandomState ^= scriptRandomState + Math.imul(scriptRandomState ^ (scriptRandomState >>> 7), 61 | scriptRandomState);
  return ((scriptRandomState ^ (scriptRandomState >>> 14)) >>> 0) / 0x100000000;
}
