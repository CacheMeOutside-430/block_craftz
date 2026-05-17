import { DebugState } from "../engine/debug";
import { ECS, registerEngineComponents } from "../engine/ecs";
import { FluidEngine } from "../engine/fluids";
import { TerrainGenerator } from "../engine/generation";
import { LightEngine } from "../engine/lighting";
import { Vec3 } from "../engine/math";
import { AuthoritativeServer, InMemoryTransport } from "../engine/network";
import { PhysicsWorld } from "../engine/physics";
import { FrameProfiler } from "../engine/profiling";
import { CameraController, VoxelRenderer } from "../engine/renderer";
import { LocalStorageRegionStore, SaveSystem } from "../engine/serialization";
import { DebugOverlay } from "../engine/ui";
import { World } from "../engine/world";
import { HotbarInventory } from "./items";
import { ITEMS } from "./items/Items";
import { registerGameBlocks } from "./blocks/registerBlocks";
import type { Player } from "./entities/Player";

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
  private readonly hotbar = ITEMS.filter((item) => item.block);
  private lastTime = 0;
  private accumulator = 0;
  private tick = 0;
  private meshQueue = 0;
  private mineRequested = false;
  private placeRequested = false;

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
    this.overlay.setToolbar(this.hotbar.map((item) => item.name), this.controller.selectedSlot);
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
    const move = this.controller.movementVector().scale(this.player.body.grounded ? 85 : 32);
    if (this.controller.wantsJump()) {
      this.physics.jump(this.player.body);
    }
    this.physics.step(this.player.body, this.world, dt, move);
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
    this.handleBlockActions();
    this.lights.updateDirty(this.world, 3);
    this.profiler.end("world");

    this.profiler.begin("meshing");
    this.meshQueue = this.renderer.sync(this.world, 3);
    this.profiler.end("meshing");

    this.updateCamera();
    this.profiler.begin("render");
    this.renderer.render();
    this.profiler.end("render");

    this.player.selectedBlock = this.selectedHotbarBlock();
    this.overlay.setToolbar(this.hotbar.map((item) => item.name), this.controller.selectedSlot);
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
    const eye = this.player.body.position.clone().add(new Vec3(0, 0.62, 0));
    this.renderer.camera.position.set(eye.x, eye.y, eye.z);
    const { yaw, pitch } = this.controller.rotationEuler();
    this.renderer.camera.rotation.order = "YXZ";
    this.renderer.camera.rotation.y = yaw;
    this.renderer.camera.rotation.x = pitch;
    this.renderer.camera.rotation.z = 0;
  }

  private handleBlockActions(): void {
    if (!this.mineRequested && !this.placeRequested) {
      return;
    }
    const origin = new Vec3(
      this.renderer.camera.position.x,
      this.renderer.camera.position.y,
      this.renderer.camera.position.z
    );
    const direction = this.controller.lookDirection();
    const hit = this.world.raycast(origin, direction, 7);
    if (hit) {
      if (this.mineRequested) {
        this.world.setBlock(hit.position.x, hit.position.y, hit.position.z, this.blockSetup.blocks.air);
      }
      if (this.placeRequested) {
        const place = hit.position.clone().add(hit.normal);
        this.world.setBlock(place.x, place.y, place.z, this.player.selectedBlock);
      }
    }
    this.mineRequested = false;
    this.placeRequested = false;
  }

  private selectedHotbarBlock(): number {
    const item = this.hotbar[((this.controller.selectedSlot % this.hotbar.length) + this.hotbar.length) % this.hotbar.length];
    return item.block ? this.blockSetup.registry.id(item.block) : this.blockSetup.blocks.grass;
  }

  private installWorldEvents(): void {
    this.world.chunks.events.on("chunkLoaded", (chunk) => this.renderer.enqueue(chunk));
    this.world.chunks.events.on("chunkChanged", (chunk) => this.renderer.enqueue(chunk));
    this.world.chunks.events.on("chunkUnloaded", (coord) => this.renderer.removeChunk(`${coord.x},${coord.y},${coord.z}`));
  }

  private installPointerActions(): void {
    this.renderer.renderer.domElement.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.mineRequested = true;
      } else if (event.button === 2) {
        this.placeRequested = true;
      }
    });
    window.addEventListener("beforeunload", () => {
      for (const chunk of this.world.chunks.loadedChunks()) {
        void this.save.saveChunk(chunk);
      }
    });
  }
}
