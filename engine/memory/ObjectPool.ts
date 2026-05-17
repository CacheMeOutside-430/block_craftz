export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly active = new Set<T>();

  constructor(
    private readonly create: () => T,
    private readonly resetObject: (value: T) => void = () => {}
  ) {}

  acquire(): T {
    const value = this.free.pop() ?? this.create();
    this.active.add(value);
    return value;
  }

  release(value: T): void {
    if (!this.active.delete(value)) {
      throw new Error("Attempted to release an object that is not active in this pool");
    }
    this.resetObject(value);
    this.free.push(value);
  }

  releaseAll(): void {
    for (const value of this.active) {
      this.resetObject(value);
      this.free.push(value);
    }
    this.active.clear();
  }

  get activeCount(): number {
    return this.active.size;
  }

  get freeCount(): number {
    return this.free.length;
  }
}
