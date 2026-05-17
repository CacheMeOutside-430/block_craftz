import { Vec3 } from "../../engine/math";
import type { PhysicsBody } from "../../engine/physics";
import type { Entity } from "../../engine/ecs";
import type { HotbarInventory } from "../items";

export interface Player {
  readonly id: string;
  readonly entity: Entity;
  readonly body: PhysicsBody;
  readonly inventory: HotbarInventory;
  selectedBlock: number;
  spawn: Vec3;
}
