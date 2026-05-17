import * as THREE from "three";
import type { BlockDefinition } from "../voxel";

export function createBlockAtlas(blocks: readonly BlockDefinition[], columns = 8, tileSize = 16): THREE.CanvasTexture {
  const rows = Math.max(1, Math.ceil(blocks.length / columns));
  const canvas = document.createElement("canvas");
  canvas.width = columns * tileSize;
  canvas.height = rows * tileSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const block of blocks) {
    const x = block.atlas.x * tileSize;
    const y = block.atlas.y * tileSize;
    drawTile(ctx, x, y, tileSize, block);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, block: BlockDefinition): void {
  if (block.name === "air") {
    return;
  }
  ctx.fillStyle = block.color;
  ctx.fillRect(x, y, size, size);
  const shade = block.transparent ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)";
  ctx.fillStyle = shade;
  for (let i = 0; i < size; i += 4) {
    const hash = (block.id * 31 + i * 17) % size;
    ctx.fillRect(x + hash, y + i, 2, 2);
  }
  if (block.name.includes("ore")) {
    ctx.fillStyle = block.name.includes("iron") ? "#e5b083" : "#232323";
    for (let i = 0; i < 6; i++) {
      const px = x + ((block.id * 7 + i * 5) % (size - 3));
      const py = y + ((block.id * 11 + i * 3) % (size - 3));
      ctx.fillRect(px, py, 3, 3);
    }
  }
  if (block.fluid) {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = block.color;
    ctx.fillRect(x, y, size, size);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.35);
    ctx.quadraticCurveTo(x + size * 0.5, y + size * 0.1, x + size, y + size * 0.35);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}
