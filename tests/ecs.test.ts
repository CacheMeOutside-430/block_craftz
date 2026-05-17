import { describe, expect, it } from "vitest";
import { ECS, registerEngineComponents } from "../engine/ecs";

describe("archetype ECS", () => {
  it("migrates entities between archetypes while preserving component data", () => {
    const ecs = new ECS();
    const components = registerEngineComponents(ecs);
    const entity = ecs.create([
      {
        type: components.Transform,
        value: { position: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      }
    ]);
    ecs.addComponent(entity, components.Health, { current: 5, max: 10 });
    const transform = ecs.getComponent(entity, components.Transform);
    const health = ecs.getComponent(entity, components.Health);
    expect(transform?.position).toEqual([1, 2, 3]);
    expect(health?.current).toBe(5);
    expect([...ecs.query([components.Transform, components.Health])]).toHaveLength(1);
  });
});
