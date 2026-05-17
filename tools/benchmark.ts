import { performance } from "node:perf_hooks";
import { TerrainGenerator } from "../engine/generation";

const generator = new TerrainGenerator({ seed: 1337 });
const start = performance.now();
let checksum = 0;

for (let x = -4; x <= 4; x++) {
  for (let z = -4; z <= 4; z++) {
    const chunk = generator.generateChunk({ x, y: 1, z });
    checksum = (checksum + chunk.checksum()) >>> 0;
  }
}

const elapsedMs = performance.now() - start;
console.log(JSON.stringify({ chunks: 81, elapsedMs, chunksPerSecond: 81000 / elapsedMs, checksum }, null, 2));
