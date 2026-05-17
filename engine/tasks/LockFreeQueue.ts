export class RingQueue<T> {
  private readonly values: Array<T | undefined>;
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    if (capacity <= 0 || (capacity & (capacity - 1)) !== 0) {
      throw new Error("RingQueue capacity must be a power of two");
    }
    this.values = new Array<T | undefined>(capacity);
  }

  push(value: T): boolean {
    if (this.count === this.capacity) {
      return false;
    }
    this.values[this.tail] = value;
    this.tail = (this.tail + 1) & (this.capacity - 1);
    this.count++;
    return true;
  }

  pop(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }
    const value = this.values[this.head];
    this.values[this.head] = undefined;
    this.head = (this.head + 1) & (this.capacity - 1);
    this.count--;
    return value;
  }

  get size(): number {
    return this.count;
  }
}

export class WorkStealingDeque<T> {
  private readonly items: T[] = [];

  push(value: T): void {
    this.items.push(value);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  steal(): T | undefined {
    return this.items.shift();
  }

  get size(): number {
    return this.items.length;
  }
}
