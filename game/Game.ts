import { DebugState } from "../engine/debug";
import { ECS, registerEngineComponents } from "../engine/ecs";
import { FluidEngine } from "../engine/fluids";
import { TerrainGenerator } from "../engine/generation";
import { LightEngine } from "../engine/lighting";
import { AABB, Vec3 } from "../engine/math";
import { AuthoritativeServer, InMemoryTransport } from "../engine/network";
import { bodyBounds, PhysicsWorld, type PhysicsBody } from "../engine/physics";
import { FrameProfiler } from "../engine/profiling";
import { CameraController, VoxelRenderer } from "../engine/renderer";
import { LocalStorageRegionStore, SaveSystem } from "../engine/serialization";
import { DebugOverlay } from "../engine/ui";
import { World } from "../engine/world";
import { HotbarInventory } from "./items";
import { ITEMS } from "./items/Items";
import { registerGameBlocks } from "./blocks/registerBlocks";
import type { Player } from "./entities/Player";
import type { ItemDefinition } from "./items/Items";

interface ItemDrop {
  readonly entity: number;
  readonly itemId: string;
  readonly blockId: number;
  readonly body: PhysicsBody;
  age: number;
}

export class VoxelGame {
  private readonly blockSetup = registerGameBlocks();
  private readonly generator = new TerrainGenerator({ seed: 1337, blocks: this.blockSetup.blocks });
  private readonly world = new World(this.blockSetup.registry, this.generator);
  private readonly renderer: VoxelRenderer;
  private readonly controller: CameraController;
  private readonly physics = new PhysicsWorld(this.blockSetup.registry);
  private readonly lights = new LightEngine();
  private readonly fluids = new FluidEngine();
  private readonly profiler = new FrameProfiler();
  private readonly debug = new DebugState();
  private readonly overlay: DebugOverlay;
  private readonly save = new SaveSystem(new LocalStorageRegionStore());
  private readonly server = new AuthoritativeServer(new InMemoryTransport());
  private readonly ecs = new ECS();
  private readonly components = registerEngineComponents(this.ecs);
  private readonly player: Player;
  private readonly itemById = new Map(ITEMS.map((item) => [item.id, item]));
  private readonly itemByBlock = new Map(ITEMS.filter((item) => item.block).map((item) => [item.block!, item]));
  private readonly drops = new Map<number, ItemDrop>();
  private lastTime = 0;
  private accumulator = 0;
  private tick = 0;
  private meshQueue = 0;
  private selectedTarget: ReturnType<World["raycast"]> = null;
  private jumpBuffer = 0;
  private coyoteTime = 0;
  private interactionPulse = 0;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new VoxelRenderer(host, this.blockSetup.registry);
    this.controller = new CameraController(this.renderer.renderer.domElement);
    const spawnTerrain = this.generator.sampleTerrain(0, 0);
    const spawn = new Vec3(8, spawnTerrain.height + 6, 8);
    const body = this.physics.createBody(spawn.clone());
    const inventory = new HotbarInventory(ITEMS);
    const entity = this.ecs.create([
      {
        type: this.components.Transform,
        value: { position: body.position.toArray(), rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      },
      {
        type: this.components.Velocity,
        value: { velocity: body.velocity.toArray() }
      },
      {
        type: this.components.Collider,
        value: { halfExtents: body.halfExtents.toArray(), grounded: body.grounded }
      },
      {
        type: this.components.Inventory,
        value: { slots: inventory.snapshot(), selected: inventory.selected }
      },
      {
        type: this.components.ChunkLoader,
        value: { radius: 2 }
      }
    ]);
    this.player = {
      id: "local-player",
      entity,
      body,
      inventory,
      selectedBlock: this.blockSetup.blocks.grass,
      spawn
    };
    this.overlay = new DebugOverlay(host);
    this.overlay.setToolbar(this.hotbarSlots(), this.controller.selectedSlot);
    this.fluids.register({ blockId: this.blockSetup.blocks.water, maxLevel: 8, horizontalDecay: 1, tickRate: 5 });
    this.fluids.register({ blockId: this.blockSetup.blocks.lava, maxLevel: 6, horizontalDecay: 2, tickRate: 12 });
    this.server.connect("local");
    this.installWorldEvents();
    this.installPointerActions();
  }

  async start(): Promise<void> {
    await this.world.chunks.streamAround(this.player.body.position, {
      radius: 2,
      minChunkY: 0,
      maxChunkY: 5,
      maxQueuedPerUpdate: 128
    });
    this.fluids.scheduleChunk(this.world, this.tick);
    this.lastTime = performance.now() / 1000;
    requestAnimationFrame((time) => this.frame(time / 1000));
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, now - this.lastTime);
    this.lastTime = now;
    this.profiler.beginFrame();
    this.accumulator += dt;
    while (this.accumulator >= 1 / 60) {
      this.fixedUpdate(1 / 60);
      this.accumulator -= 1 / 60;
    }
    this.update(dt);
    requestAnimationFrame((time) => this.frame(time / 1000));
  }

  private fixedUpdate(dt: number): void {
    this.tick++;
    const wasGrounded = this.player.body.grounded;
    if (wasGrounded) {
      this.coyoteTime = 0.1;
    } else {
      this.coyoteTime = Math.max(0, this.coyoteTime - dt);
    }
    if (this.controller.wantsJump()) {
      this.jumpBuffer = 0.12;
    } else {
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    }
    if ((this.jumpBuffer > 0 || this.controller.isJumpHeld()) && (this.player.body.grounded || this.coyoteTime > 0)) {
      this.player.body.grounded = true;
      this.physics.jump(this.player.body);
      this.jumpBuffer = 0;
      this.coyoteTime = 0;
    }
    const move = this.controller.movementAcceleration(this.player.body.grounded);
    this.physics.step(this.player.body, this.world, dt, move);
    this.updateDrops(dt);
    this.syncPlayerComponents();
    this.fluids.step(this.world, this.tick, 64);
    if (this.tick % 15 === 0) {
      void this.world.chunks.streamAround(this.player.body.position, {
        radius: 2,
        minChunkY: 0,
        maxChunkY: 5,
        maxQueuedPerUpdate: 8
      });
    }
    this.server.replication.updateEntity({
      id: 1,
      position: this.player.body.position,
      components: {
        transform: this.player.body.position.toArray(),
        velocity: this.player.body.velocity.toArray()
      }
    });
    this.server.replicate(this.tick);
  }

  private update(dt: number): void {
    this.profiler.begin("world");
    this.player.inventory.select(this.controller.selectedSlot);
    this.player.selectedBlock = this.selectedHotbarBlock();
    this.updateCamera();
    this.updateTargeting();
    this.handleBlockActions();
    this.lights.updateDirty(this.world, 3);
    this.profiler.end("world");

    this.profiler.begin("meshing");
    this.meshQueue = this.renderer.sync(this.world, 3);
    this.profiler.end("meshing");

    const horizontalSpeed = Math.hypot(this.player.body.velocity.x, this.player.body.velocity.z);
    const moveAmount = Math.min(1, horizontalSpeed / 4.3);
    this.interactionPulse = Math.max(0, this.interactionPulse - dt * 5.5);
    this.renderer.updateViewModel(this.player.selectedBlock, moveAmount, this.interactionPulse > 0);
    this.renderer.updatePlayerBody(this.player.body.position, this.controller.rotationEuler().yaw);
    this.profiler.begin("render");
    this.renderer.render();
    this.profiler.end("render");

    this.overlay.setToolbar(this.hotbarSlots(), this.controller.selectedSlot);
    this.overlay.update(
      this.debug.update(
        dt,
        {
          chunksLoaded: this.world.chunks.loadedCount,
          chunksPending: this.world.chunks.pendingCount,
          meshQueue: this.meshQueue,
          player: this.player.body.position.toArray()
        },
        this.profiler
      )
    );
  }

  private updateCamera(): void {
    const eye = this.player.body.position.clone().add(new Vec3(0, 0.72, 0));
    this.renderer.camera.position.set(eye.x, eye.y, eye.z);
    const { yaw, pitch } = this.controller.rotationEuler();
    this.renderer.camera.rotation.order = "YXZ";
    this.renderer.camera.rotation.y = yaw;
    this.renderer.camera.rotation.x = pitch;
    this.renderer.camera.rotation.z = 0;
  }

  private handleBlockActions(): void {
    const mineRequested = this.controller.consumeMine();
    const placeRequested = this.controller.consumePlace();
    if (!mineRequested && !placeRequested) {
      return;
    }
    const hit = this.selectedTarget;
    if (hit) {
      if (mineRequested && hit.block !== this.blockSetup.blocks.air) {
        if (this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, this.blockSetup.blocks.air)) {
          this.spawnDrop(hit.block, hit.position.clone().add(new Vec3(0.5, 0.5, 0.5)), hit.normal);
          this.interactionPulse = 1;
        }
      }
      if (placeRequested && this.player.selectedBlock !== this.blockSetup.blocks.air && this.player.inventory.selectedSlot().count > 0) {
        const place = hit.position.clone().add(hit.normal);
        if (this.canPlaceAt(place) && this.world.setBlock(place.x, place.y, place.z, this.player.selectedBlock)) {
          this.player.inventory.removeSelected(1);
          this.interactionPulse = 1;
        }
      }
    }
  }

  private selectedHotbarBlock(): number {
    const item = this.player.inventory.selectedItem();
    return item?.block ? this.blockSetup.registry.id(item.block) : this.blockSetup.blocks.air;
  }

  private updateTargeting(): void {
    const origin = new Vec3(
      this.renderer.camera.position.x,
      this.renderer.camera.position.y,
      this.renderer.camera.position.z
    );
    this.selectedTarget = this.world.raycast(origin, this.controller.lookDirection(), 5.2);
    this.renderer.setTargetHighlight(this.selectedTarget?.position ?? null);
  }

  private canPlaceAt(position: Vec3): boolean {
    if (this.world.getBlock(position.x, position.y, position.z) !== this.blockSetup.blocks.air) {
      return false;
    }
    const blockBounds = new AABB(position.clone(), position.clone().add(new Vec3(1, 1, 1)));
    return !blockBounds.intersects(bodyBounds(this.player.body));
  }

  private spawnDrop(blockId: number, position: Vec3, normal: Vec3): void {
    const item = this.itemForBlock(blockId);
    if (!item) {
      return;
    }
    const body = this.physics.createBody(position, new Vec3(0.14, 0.14, 0.14));
    body.friction = 4;
    body.velocity = normal.clone().scale(1.4).add(new Vec3((Math.sin(this.tick) + 0.25) * 0.35, 2.4, Math.cos(this.tick) * 0.35));
    const entity = this.ecs.create([
      {
        type: this.components.Transform,
        value: { position: body.position.toArray(), rotation: [0, 0, 0, 1], scale: [0.28, 0.28, 0.28] }
      },
      {
        type: this.components.Velocity,
        value: { velocity: body.velocity.toArray() }
      },
      {
        type: this.components.Renderable,
        value: { mesh: "item_drop", material: item.id, visible: true }
      }
    ]);
    this.drops.set(entity, { entity, itemId: item.id, blockId, body, age: 0 });
  }

  private updateDrops(dt: number): void {
    for (const drop of [...this.drops.values()]) {
      drop.age += dt;
      const distance = drop.body.position.distance(this.player.body.position);
      if (distance < 3) {
        const pull = Vec3.sub(this.player.body.position, drop.body.position).normalize().scale((3 - distance) * 18);
        this.physics.step(drop.body, this.world, dt, pull);
      } else {
        this.physics.step(drop.body, this.world, dt);
      }
      if (distance < 0.85 && this.player.inventory.add(drop.itemId, 1) === 0) {
        this.removeDrop(drop);
        continue;
      }
      if (drop.age > 180) {
        this.removeDrop(drop);
        continue;
      }
      this.renderer.upsertDrop(drop.entity, drop.body.position, drop.blockId, drop.age);
      this.ecs.addComponent(drop.entity, this.components.Transform, {
        position: drop.body.position.toArray(),
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        scale: [0.28, 0.28, 0.28] as [number, number, number]
      });
      this.ecs.addComponent(drop.entity, this.components.Velocity, { velocity: drop.body.velocity.toArray() });
    }
  }

  private removeDrop(drop: ItemDrop): void {
    this.renderer.removeDrop(drop.entity);
    this.ecs.destroy(drop.entity);
    this.drops.delete(drop.entity);
  }

  private itemForBlock(blockId: number): ItemDefinition | undefined {
    const block = this.blockSetup.registry.get(blockId);
    return this.itemByBlock.get(block.name);
  }

  private hotbarSlots(): Array<{ label: string; count: number }> {
    return this.player.inventory.slots.map((slot) => {
      const item = slot.itemId ? this.itemById.get(slot.itemId) : undefined;
      return { label: item?.name ?? "", count: slot.count };
    });
  }

  private syncPlayerComponents(): void {
    this.ecs.addComponent(this.player.entity, this.components.Transform, {
      position: this.player.body.position.toArray(),
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      scale: [1, 1, 1] as [number, number, number]
    });
    this.ecs.addComponent(this.player.entity, this.components.Velocity, { velocity: this.player.body.velocity.toArray() });
    this.ecs.addComponent(this.player.entity, this.components.Collider, {
      halfExtents: this.player.body.halfExtents.toArray(),
      grounded: this.player.body.grounded
    });
    this.ecs.addComponent(this.player.entity, this.components.Inventory, {
      slots: this.player.inventory.snapshot(),
      selected: this.player.inventory.selected
    });
  }

  private installWorldEvents(): void {
    this.world.chunks.events.on("chunkLoaded", (chunk) => this.renderer.enqueue(chunk));
    this.world.chunks.events.on("chunkChanged", (chunk) => this.renderer.enqueue(chunk));
    this.world.chunks.events.on("chunkUnloaded", (coord) => this.renderer.removeChunk(`${coord.x},${coord.y},${coord.z}`));
  }

  private installPointerActions(): void {
    window.addEventListener("beforeunload", () => {
      for (const chunk of this.world.chunks.loadedChunks()) {
        void this.save.saveChunk(chunk);
      }
    });
  }
}
