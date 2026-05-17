import { EventBus } from "../core";

export type Entity = number;

export interface ComponentType<T = any> {
  readonly id: number;
  readonly name: string;
  readonly clone: (value: T) => T;
}

export interface ComponentValue<T = any> {
  readonly type: ComponentType<T>;
  readonly value: T;
}

interface Archetype {
  readonly key: string;
  readonly types: ComponentType<any>[];
  readonly columns: Map<number, unknown[]>;
  readonly entities: Entity[];
}

export interface ECSEvents {
  entityCreated: Entity;
  entityDestroyed: Entity;
  componentAdded: { entity: Entity; component: string };
  componentRemoved: { entity: Entity; component: string };
}

export class ECS {
  readonly events = new EventBus<ECSEvents>();
  private nextEntity = 1;
  private nextComponent = 1;
  private readonly componentTypes = new Map<string, ComponentType<any>>();
  private readonly archetypes = new Map<string, Archetype>();
  private readonly locations = new Map<Entity, { archetype: Archetype; row: number }>();

  registerComponent<T>(name: string, clone: (value: T) => T = structuredClone): ComponentType<T> {
    if (this.componentTypes.has(name)) {
      throw new Error(`Component already registered: ${name}`);
    }
    const type: ComponentType<T> = { id: this.nextComponent++, name, clone };
    this.componentTypes.set(name, type as ComponentType<any>);
    return type;
  }

  create(components: ComponentValue[] = []): Entity {
    const entity = this.nextEntity++;
    const archetype = this.getArchetype(components.map((component) => component.type as ComponentType<any>));
    const row = archetype.entities.length;
    archetype.entities.push(entity);
    for (const type of archetype.types) {
      const incoming = components.find((component) => component.type.id === type.id);
      archetype.columns.get(type.id)?.push(incoming?.value);
    }
    this.locations.set(entity, { archetype, row });
    this.events.emit("entityCreated", entity);
    return entity;
  }

  destroy(entity: Entity): void {
    const location = this.locations.get(entity);
    if (!location) {
      return;
    }
    this.removeRow(location.archetype, location.row);
    this.locations.delete(entity);
    this.events.emit("entityDestroyed", entity);
  }

  addComponent<T>(entity: Entity, type: ComponentType<T>, value: T): void {
    const location = this.requireLocation(entity);
    if (location.archetype.columns.has(type.id)) {
      location.archetype.columns.get(type.id)![location.row] = value;
      return;
    }
    const values = this.readComponents(location.archetype, location.row);
    values.push({ type, value });
    this.moveEntity(entity, values);
    this.events.emit("componentAdded", { entity, component: type.name });
  }

  removeComponent<T>(entity: Entity, type: ComponentType<T>): void {
    const location = this.requireLocation(entity);
    if (!location.archetype.columns.has(type.id)) {
      return;
    }
    const values = this.readComponents(location.archetype, location.row).filter((component) => component.type.id !== type.id);
    this.moveEntity(entity, values);
    this.events.emit("componentRemoved", { entity, component: type.name });
  }

  getComponent<T>(entity: Entity, type: ComponentType<T>): T | undefined {
    const location = this.locations.get(entity);
    if (!location) {
      return undefined;
    }
    return location.archetype.columns.get(type.id)?.[location.row] as T | undefined;
  }

  has(entity: Entity, type: ComponentType<any>): boolean {
    const location = this.locations.get(entity);
    return !!location?.archetype.columns.has(type.id);
  }

  query<T extends readonly ComponentType<any>[]>(
    types: T
  ): IterableIterator<{ entity: Entity; components: { [K in keyof T]: T[K] extends ComponentType<infer V> ? V : never } }> {
    const matches = [...this.archetypes.values()].filter((archetype) => types.every((type) => archetype.columns.has(type.id)));
    function* iterate(): IterableIterator<{
      entity: Entity;
      components: { [K in keyof T]: T[K] extends ComponentType<infer V> ? V : never };
    }> {
      for (const archetype of matches) {
        for (let row = 0; row < archetype.entities.length; row++) {
          const components = types.map((type) => archetype.columns.get(type.id)![row]) as {
            [K in keyof T]: T[K] extends ComponentType<infer V> ? V : never;
          };
          yield { entity: archetype.entities[row], components };
        }
      }
    }
    return iterate();
  }

  snapshot(): SerializedECS {
    const entities: SerializedEntity[] = [];
    for (const [entity, location] of this.locations) {
      entities.push({
        id: entity,
        components: this.readComponents(location.archetype, location.row).map((component) => ({
          name: component.type.name,
          value: (component.type as ComponentType<any>).clone(component.value)
        }))
      });
    }
    entities.sort((a, b) => a.id - b.id);
    return { nextEntity: this.nextEntity, entities };
  }

  restore(snapshot: SerializedECS): void {
    this.clear();
    this.nextEntity = snapshot.nextEntity;
    for (const entityData of snapshot.entities) {
      const components = entityData.components.map((component) => {
        const type = this.componentTypes.get(component.name);
        if (!type) {
          throw new Error(`Missing component type during restore: ${component.name}`);
        }
        return { type, value: component.value };
      });
      const archetype = this.getArchetype(components.map((component) => component.type));
      const row = archetype.entities.length;
      archetype.entities.push(entityData.id);
      for (const type of archetype.types) {
        const incoming = components.find((component) => component.type.id === type.id);
        archetype.columns.get(type.id)?.push(incoming?.value);
      }
      this.locations.set(entityData.id, { archetype, row });
    }
  }

  clear(): void {
    this.archetypes.clear();
    this.locations.clear();
  }

  private moveEntity(entity: Entity, values: ComponentValue[]): void {
    const old = this.requireLocation(entity);
    const archetype = this.getArchetype(values.map((component) => component.type as ComponentType<any>));
    const row = archetype.entities.length;
    archetype.entities.push(entity);
    for (const type of archetype.types) {
      const incoming = values.find((component) => component.type.id === type.id);
      archetype.columns.get(type.id)?.push(incoming?.value);
    }
    this.removeRow(old.archetype, old.row);
    this.locations.set(entity, { archetype, row });
  }

  private removeRow(archetype: Archetype, row: number): void {
    const last = archetype.entities.length - 1;
    const moved = archetype.entities[last];
    archetype.entities[row] = moved;
    archetype.entities.pop();
    for (const column of archetype.columns.values()) {
      column[row] = column[last];
      column.pop();
    }
    if (row !== last) {
      this.locations.set(moved, { archetype, row });
    }
  }

  private readComponents(archetype: Archetype, row: number): ComponentValue[] {
    return archetype.types.map((type) => ({
      type,
      value: archetype.columns.get(type.id)![row]
    }));
  }

  private requireLocation(entity: Entity): { archetype: Archetype; row: number } {
    const location = this.locations.get(entity);
    if (!location) {
      throw new Error(`Unknown entity: ${entity}`);
    }
    return location;
  }

  private getArchetype(types: ComponentType<any>[]): Archetype {
    const sorted = [...types].sort((a, b) => a.id - b.id);
    const key = sorted.map((type) => type.id).join("|");
    let archetype = this.archetypes.get(key);
    if (!archetype) {
      archetype = {
        key,
        types: sorted,
        columns: new Map(sorted.map((type) => [type.id, []])),
        entities: []
      };
      this.archetypes.set(key, archetype);
    }
    return archetype;
  }
}

export interface SerializedECS {
  readonly nextEntity: number;
  readonly entities: SerializedEntity[];
}

export interface SerializedEntity {
  readonly id: Entity;
  readonly components: Array<{ readonly name: string; readonly value: unknown }>;
}
