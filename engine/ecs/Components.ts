import type { ComponentType, ECS } from "./ECS";

export interface TransformComponent {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
}

export interface VelocityComponent {
  velocity: [number, number, number];
}

export interface ColliderComponent {
  halfExtents: [number, number, number];
  grounded: boolean;
}

export interface InventoryComponent {
  slots: Array<{ item: string; count: number }>;
  selected: number;
}

export interface AIComponent {
  behavior: string;
  target?: [number, number, number];
  state: Record<string, number | string | boolean>;
}

export interface RenderableComponent {
  mesh: string;
  material: string;
  visible: boolean;
}

export interface AudioSourceComponent {
  clip: string;
  gain: number;
  loop: boolean;
  spatial: boolean;
}

export interface HealthComponent {
  current: number;
  max: number;
}

export interface ChunkLoaderComponent {
  radius: number;
}

export interface EngineComponents {
  Transform: ComponentType<TransformComponent>;
  Velocity: ComponentType<VelocityComponent>;
  Collider: ComponentType<ColliderComponent>;
  Inventory: ComponentType<InventoryComponent>;
  AI: ComponentType<AIComponent>;
  Renderable: ComponentType<RenderableComponent>;
  AudioSource: ComponentType<AudioSourceComponent>;
  Health: ComponentType<HealthComponent>;
  ChunkLoader: ComponentType<ChunkLoaderComponent>;
}

export function registerEngineComponents(ecs: ECS): EngineComponents {
  return {
    Transform: ecs.registerComponent<TransformComponent>("Transform"),
    Velocity: ecs.registerComponent<VelocityComponent>("Velocity"),
    Collider: ecs.registerComponent<ColliderComponent>("Collider"),
    Inventory: ecs.registerComponent<InventoryComponent>("Inventory"),
    AI: ecs.registerComponent<AIComponent>("AI"),
    Renderable: ecs.registerComponent<RenderableComponent>("Renderable"),
    AudioSource: ecs.registerComponent<AudioSourceComponent>("AudioSource"),
    Health: ecs.registerComponent<HealthComponent>("Health"),
    ChunkLoader: ecs.registerComponent<ChunkLoaderComponent>("ChunkLoader")
  };
}
