import type { FrameProfiler } from "../profiling";

export interface DebugSnapshot {
  readonly fps: number;
  readonly chunksLoaded: number;
  readonly chunksPending: number;
  readonly meshQueue: number;
  readonly player: [number, number, number];
  readonly profiler: Record<string, number>;
}

export class DebugState {
  private frameTimes: number[] = [];
  snapshot: DebugSnapshot = {
    fps: 0,
    chunksLoaded: 0,
    chunksPending: 0,
    meshQueue: 0,
    player: [0, 0, 0],
    profiler: {}
  };

  update(
    dt: number,
    values: Omit<DebugSnapshot, "fps" | "profiler">,
    profiler: FrameProfiler
  ): DebugSnapshot {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 90) {
      this.frameTimes.shift();
    }
    const average = this.frameTimes.reduce((sum, value) => sum + value, 0) / Math.max(1, this.frameTimes.length);
    this.snapshot = {
      ...values,
      fps: average > 0 ? 1 / average : 0,
      profiler: profiler.report()
    };
    return this.snapshot;
  }
}
