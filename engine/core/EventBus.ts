export type EventHandler<T> = (event: T) => void;

export class EventBus<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<Events[keyof Events]>>>();

  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    const set = this.handlers.get(type) ?? new Set<EventHandler<Events[keyof Events]>>();
    set.add(handler as EventHandler<Events[keyof Events]>);
    this.handlers.set(type, set);
    return () => this.off(type, handler);
  }

  off<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as EventHandler<Events[keyof Events]>);
  }

  emit<K extends keyof Events>(type: K, event: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) {
      return;
    }
    for (const handler of [...set]) {
      handler(event as Events[keyof Events]);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
