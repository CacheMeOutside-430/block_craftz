import { WorkStealingDeque } from "./LockFreeQueue";

export type Task<T> = () => Promise<T> | T;

export class Barrier {
  private remaining: number;
  private resolve!: () => void;
  readonly promise: Promise<void>;

  constructor(count: number) {
    this.remaining = count;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
    if (count === 0) {
      this.resolve();
    }
  }

  signal(): void {
    this.remaining--;
    if (this.remaining <= 0) {
      this.resolve();
    }
  }
}

export class JobGraph {
  private readonly nodes = new Map<string, { task: Task<void>; deps: Set<string>; dependents: Set<string> }>();

  add(name: string, task: Task<void>, dependencies: string[] = []): this {
    if (this.nodes.has(name)) {
      throw new Error(`Job already exists: ${name}`);
    }
    this.nodes.set(name, { task, deps: new Set(dependencies), dependents: new Set() });
    return this;
  }

  finalize(): this {
    for (const [name, node] of this.nodes) {
      for (const dep of node.deps) {
        const parent = this.nodes.get(dep);
        if (!parent) {
          throw new Error(`Job ${name} depends on missing job ${dep}`);
        }
        parent.dependents.add(name);
      }
    }
    return this;
  }

  entries(): Array<[string, { task: Task<void>; deps: Set<string>; dependents: Set<string> }]> {
    return [...this.nodes.entries()];
  }
}

interface QueuedTask<T> {
  readonly task: Task<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
}

export class TaskScheduler {
  private readonly lanes: WorkStealingDeque<QueuedTask<unknown>>[];
  private active = 0;
  private cursor = 0;

  constructor(
    public readonly concurrency = Math.max(1, Math.min(8, globalThis.navigator?.hardwareConcurrency ?? 4))
  ) {
    this.lanes = Array.from({ length: concurrency }, () => new WorkStealingDeque<QueuedTask<unknown>>());
  }

  schedule<T>(task: Task<T>, lane = 0): Promise<T> {
    const target = this.lanes[lane % this.lanes.length];
    const promise = new Promise<T>((resolve, reject) => {
      target.push({ task, resolve: resolve as (value: unknown) => void, reject });
    });
    this.pump();
    return promise;
  }

  async runGraph(graph: JobGraph): Promise<void> {
    graph.finalize();
    const entries = graph.entries();
    const remainingDeps = new Map<string, number>();
    const nodes = new Map(entries);
    const ready: string[] = [];
    for (const [name, node] of entries) {
      remainingDeps.set(name, node.deps.size);
      if (node.deps.size === 0) {
        ready.push(name);
      }
    }

    const barrier = new Barrier(entries.length);
    const launch = (name: string) => {
      const node = nodes.get(name);
      if (!node) {
        return;
      }
      void this.schedule(async () => {
        await node.task();
        for (const dependent of node.dependents) {
          const next = (remainingDeps.get(dependent) ?? 0) - 1;
          remainingDeps.set(dependent, next);
          if (next === 0) {
            launch(dependent);
          }
        }
        barrier.signal();
      });
    };

    ready.forEach(launch);
    await barrier.promise;
  }

  private pump(): void {
    while (this.active < this.concurrency) {
      const next = this.pickNext();
      if (!next) {
        break;
      }
      this.active++;
      queueMicrotask(async () => {
        try {
          next.resolve(await next.task());
        } catch (error) {
          next.reject(error);
        } finally {
          this.active--;
          this.pump();
        }
      });
    }
  }

  private pickNext(): QueuedTask<unknown> | undefined {
    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[(this.cursor + i) % this.lanes.length];
      const own = lane.pop();
      if (own) {
        this.cursor = (this.cursor + i + 1) % this.lanes.length;
        return own;
      }
    }
    for (const lane of this.lanes) {
      const stolen = lane.steal();
      if (stolen) {
        return stolen;
      }
    }
    return undefined;
  }
}
