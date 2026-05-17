import { FixedClock } from "./Clock";

export interface EngineModule {
  readonly name: string;
  initialize?(engine: EngineRuntime): Promise<void> | void;
  fixedUpdate?(dt: number): void;
  update?(dt: number, alpha: number): void;
  dispose?(): void;
}

export class EngineRuntime {
  private readonly modules: EngineModule[] = [];
  private readonly clock = new FixedClock(1 / 60);
  private running = false;
  private frameHandle = 0;
  frame = 0;

  addModule(module: EngineModule): this {
    if (this.modules.some((existing) => existing.name === module.name)) {
      throw new Error(`Engine module already registered: ${module.name}`);
    }
    this.modules.push(module);
    return this;
  }

  getModule<T extends EngineModule>(name: string): T {
    const module = this.modules.find((candidate) => candidate.name === name);
    if (!module) {
      throw new Error(`Missing engine module: ${name}`);
    }
    return module as T;
  }

  async initialize(): Promise<void> {
    for (const module of this.modules) {
      await module.initialize?.(this);
    }
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.clock.reset(performance.now() / 1000);
    const tick = () => {
      if (!this.running) {
        return;
      }
      this.clock.advance(
        performance.now() / 1000,
        (dt) => {
          this.frame++;
          for (const module of this.modules) {
            module.fixedUpdate?.(dt);
          }
        },
        (dt, alpha) => {
          for (const module of this.modules) {
            module.update?.(dt, alpha);
          }
        }
      );
      this.frameHandle = requestAnimationFrame(tick);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  dispose(): void {
    this.stop();
    for (const module of [...this.modules].reverse()) {
      module.dispose?.();
    }
    this.modules.length = 0;
  }
}
