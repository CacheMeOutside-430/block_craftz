import { JobGraph, TaskScheduler } from "../tasks";

export interface SystemContext {
  readonly fixedDelta: number;
  readonly frame: number;
}

export interface ECSSystem {
  readonly name: string;
  readonly after?: readonly string[];
  update(context: SystemContext): void | Promise<void>;
}

export class SystemScheduler {
  private readonly systems = new Map<string, ECSSystem>();

  constructor(private readonly tasks: TaskScheduler) {}

  add(system: ECSSystem): this {
    if (this.systems.has(system.name)) {
      throw new Error(`System already registered: ${system.name}`);
    }
    this.systems.set(system.name, system);
    return this;
  }

  async update(context: SystemContext): Promise<void> {
    const graph = new JobGraph();
    for (const system of this.systems.values()) {
      graph.add(system.name, () => system.update(context), [...(system.after ?? [])]);
    }
    await this.tasks.runGraph(graph);
  }
}
