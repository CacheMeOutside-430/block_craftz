export class FixedClock {
  private accumulator = 0;
  private lastTime = 0;
  private readonly maxFrameTime: number;

  constructor(
    public readonly fixedDelta = 1 / 60,
    maxFrameTime = 0.25
  ) {
    this.maxFrameTime = maxFrameTime;
  }

  reset(nowSeconds: number): void {
    this.lastTime = nowSeconds;
    this.accumulator = 0;
  }

  advance(nowSeconds: number, fixedStep: (dt: number) => void, variableStep?: (dt: number, alpha: number) => void): void {
    let frameTime = nowSeconds - this.lastTime;
    this.lastTime = nowSeconds;
    if (!Number.isFinite(frameTime) || frameTime < 0) {
      frameTime = 0;
    }
    frameTime = Math.min(frameTime, this.maxFrameTime);
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedDelta) {
      fixedStep(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
    }

    variableStep?.(frameTime, this.accumulator / this.fixedDelta);
  }
}
