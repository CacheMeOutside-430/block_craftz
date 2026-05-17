export class ChunkPool<T extends { reset(): void }> {
  private readonly buckets = new Map<string, T[]>();

  constructor(private readonly factory: (key: string) => T) {}

  acquire(key: string): T {
    const bucket = this.buckets.get(key);
    const value = bucket?.pop() ?? this.factory(key);
    value.reset();
    return value;
  }

  release(key: string, value: T): void {
    value.reset();
    const bucket = this.buckets.get(key) ?? [];
    bucket.push(value);
    this.buckets.set(key, bucket);
  }

  trim(maxPerBucket: number): void {
    for (const bucket of this.buckets.values()) {
      if (bucket.length > maxPerBucket) {
        bucket.length = maxPerBucket;
      }
    }
  }
}
