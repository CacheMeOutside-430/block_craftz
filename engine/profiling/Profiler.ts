export interface ProfileSample {
  readonly name: string;
  readonly durationMs: number;
  readonly frame: number;
}

export class FrameProfiler {
  private readonly active = new Map<string, number>();
  private readonly samples: ProfileSample[] = [];
  frame = 0;

  beginFrame(): void {
    this.frame++;
  }

  begin(name: string): void {
    this.active.set(name, performance.now());
  }

  end(name: string): void {
    const start = this.active.get(name);
    if (start === undefined) {
      throw new Error(`Profiler marker was not started: ${name}`);
    }
    this.active.delete(name);
    this.samples.push({ name, durationMs: performance.now() - start, frame: this.frame });
    if (this.samples.length > 2048) {
      this.samples.splice(0, this.samples.length - 2048);
    }
  }

  measure<T>(name: string, fn: () => T): T {
    this.begin(name);
    try {
      return fn();
    } finally {
      this.end(name);
    }
  }

  average(name: string, frames = 120): number {
    const minFrame = this.frame - frames;
    const values = this.samples.filter((sample) => sample.name === name && sample.frame >= minFrame);
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, sample) => sum + sample.durationMs, 0) / values.length;
  }

  report(): Record<string, number> {
    const names = new Set(this.samples.map((sample) => sample.name));
    const out: Record<string, number> = {};
    for (const name of names) {
      out[name] = this.average(name);
    }
    return out;
  }
}

export class MemoryProfiler {
  sample(): { usedJSHeapSize?: number; totalJSHeapSize?: number; timestamp: number } {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
    return {
      usedJSHeapSize: memory?.usedJSHeapSize,
      totalJSHeapSize: memory?.totalJSHeapSize,
      timestamp: performance.now()
    };
  }
}

export class GpuTimer {
  private lastStart = 0;
  private lastDuration = 0;

  begin(): void {
    this.lastStart = performance.now();
  }

  end(): number {
    this.lastDuration = performance.now() - this.lastStart;
    return this.lastDuration;
  }

  last(): number {
    return this.lastDuration;
  }
}
