import * as THREE from "three";
import { GreedyMesher, type MeshData } from "../meshing";
import type { World } from "../world";
import type { Chunk, VoxelRegistry } from "../voxel";
import { chunkKey } from "../voxel";
import { createBlockAtlas } from "./TextureAtlas";

interface ChunkObjects {
  version: number;
  opaque?: THREE.Mesh;
  transparent?: THREE.Mesh;
}

export class VoxelRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.05, 1200);
  private readonly mesher: GreedyMesher;
  private readonly worldGroup = new THREE.Group();
  private readonly chunks = new Map<string, ChunkObjects>();
  private readonly queued = new Set<string>();
  private readonly opaqueMaterial: THREE.MeshLambertMaterial;
  private readonly transparentMaterial: THREE.MeshLambertMaterial;
  private readonly highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 })
  );
  private readonly viewModel = new THREE.Group();
  private readonly heldItem = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial());
  private readonly playerBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 1.8, 0.66),
    new THREE.MeshLambertMaterial({ color: 0x3f7fb5, transparent: true, opacity: 0.42 })
  );
  private readonly dropMeshes = new Map<number, THREE.Mesh>();
  private frame = 0;

  constructor(
    private readonly host: HTMLElement,
    registry: VoxelRegistry
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x8fc4e8);
    this.scene.fog = new THREE.FogExp2(0x8fc4e8, 0.008);
    this.camera.position.set(8, 64, 8);
    this.mesher = new GreedyMesher(registry);
    const atlas = createBlockAtlas(registry.all());
    this.opaqueMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    this.setupScene();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  enqueue(chunk: Chunk): void {
    this.queued.add(chunk.key);
  }

  removeChunk(key: string): void {
    const objects = this.chunks.get(key);
    if (!objects) {
      return;
    }
    if (objects.opaque) {
      this.worldGroup.remove(objects.opaque);
      objects.opaque.geometry.dispose();
    }
    if (objects.transparent) {
      this.worldGroup.remove(objects.transparent);
      objects.transparent.geometry.dispose();
    }
    this.chunks.delete(key);
  }

  sync(world: World, budget = 3): number {
    let built = 0;
    for (const chunk of world.chunks.loadedChunks()) {
      if (chunk.dirtyMesh) {
        this.enqueue(chunk);
      }
    }
    for (const key of [...this.queued]) {
      const chunk = world.chunks.getChunk(parseKey(key));
      if (!chunk) {
        this.queued.delete(key);
        this.removeChunk(key);
        continue;
      }
      this.upsertChunk(world, chunk);
      this.queued.delete(key);
      built++;
      if (built >= budget) {
        break;
      }
    }
    return this.queued.size;
  }

  render(): void {
    this.frame++;
    this.renderer.render(this.scene, this.camera);
  }

  setTargetHighlight(position: { x: number; y: number; z: number } | null): void {
    this.highlight.visible = !!position;
    if (position) {
      this.highlight.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
    }
  }

  updateViewModel(blockId: number, movingAmount: number, interacting: boolean): void {
    const block = this.registry.get(blockId);
    const material = this.heldItem.material as THREE.MeshLambertMaterial;
    material.color.set(block.color);
    const bob = Math.sin(this.frame * 0.18) * 0.018 * movingAmount;
    const swing = interacting ? Math.sin(Math.min(1, movingAmount + 0.6) * this.frame * 0.5) * 0.08 : 0;
    this.viewModel.position.set(0.46 + swing, -0.42 + bob, -0.76);
    this.viewModel.rotation.set(-0.28 + bob * 2, -0.38 + swing, 0.12);
    this.viewModel.visible = blockId !== 0;
  }

  updatePlayerBody(position: { x: number; y: number; z: number }, yaw: number): void {
    this.playerBody.position.set(position.x, position.y, position.z);
    this.playerBody.rotation.y = yaw;
  }

  upsertDrop(id: number, position: { x: number; y: number; z: number }, blockId: number, age: number): void {
    let mesh = this.dropMeshes.get(id);
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), new THREE.MeshLambertMaterial());
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.dropMeshes.set(id, mesh);
    }
    const block = this.registry.get(blockId);
    const material = mesh.material as THREE.MeshLambertMaterial;
    material.color.set(block.color);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(age * 2.2, age * 3.1, age * 1.3);
  }

  removeDrop(id: number): void {
    const mesh = this.dropMeshes.get(id);
    if (!mesh) {
      return;
    }
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    this.dropMeshes.delete(id);
  }

  resize(): void {
    const width = this.host.clientWidth || window.innerWidth;
    const height = this.host.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose(): void {
    for (const key of [...this.chunks.keys()]) {
      this.removeChunk(key);
    }
    this.opaqueMaterial.dispose();
    this.transparentMaterial.dispose();
    for (const id of [...this.dropMeshes.keys()]) {
      this.removeDrop(id);
    }
    this.renderer.dispose();
  }

  private upsertChunk(world: World, chunk: Chunk): void {
    const key = chunkKey(chunk.coord);
    const existing = this.chunks.get(key);
    if (existing?.version === chunk.version) {
      return;
    }
    if (existing) {
      this.removeChunk(key);
    }
    const mesh = this.mesher.meshChunk(chunk, (x, y, z) => world.getBlock(x, y, z));
    const objects: ChunkObjects = { version: mesh.version };
    if (mesh.opaque.indices.length > 0) {
      objects.opaque = this.makeMesh(mesh.opaque, this.opaqueMaterial);
      this.worldGroup.add(objects.opaque);
    }
    if (mesh.transparent.indices.length > 0) {
      objects.transparent = this.makeMesh(mesh.transparent, this.transparentMaterial);
      this.worldGroup.add(objects.transparent);
    }
    this.chunks.set(key, objects);
  }

  private makeMesh(mesh: MeshData, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(mesh.colors, 3));
    geometry.setIndex(mesh.indices);
    geometry.computeBoundingSphere();
    const object = new THREE.Mesh(geometry, material);
    object.frustumCulled = true;
    object.castShadow = false;
    object.receiveShadow = true;
    return object;
  }

  private setupScene(): void {
    this.scene.add(this.worldGroup);
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.playerBody.visible = false;
    this.scene.add(this.playerBody);
    this.heldItem.position.set(0, 0, 0);
    this.heldItem.castShadow = false;
    this.heldItem.receiveShadow = false;
    this.viewModel.add(this.heldItem);
    this.camera.add(this.viewModel);
    this.scene.add(this.camera);
    const hemi = new THREE.HemisphereLight(0xdff5ff, 0x38452d, 1.3);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d2, 1.2);
    sun.position.set(80, 140, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    this.scene.add(sun);
  }
}

function parseKey(key: string): { x: number; y: number; z: number } {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
}
