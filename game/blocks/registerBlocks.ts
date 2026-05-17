import { VoxelRegistry } from "../../engine/voxel";

export interface GameBlockIds {
  air: number;
  grass: number;
  dirt: number;
  stone: number;
  sand: number;
  sandstone: number;
  snow: number;
  water: number;
  log: number;
  leaves: number;
  coalOre: number;
  ironOre: number;
  lamp: number;
  brick: number;
  lava: number;
  wire: number;
}

export function registerGameBlocks(registry = new VoxelRegistry()): { registry: VoxelRegistry; blocks: GameBlockIds } {
  const grass = registry.register({
    name: "grass",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 1,
    atlas: { x: 1, y: 0 },
    color: "#5f9f45"
  }).id;
  const dirt = registry.register({
    name: "dirt",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 1,
    atlas: { x: 2, y: 0 },
    color: "#7a5435"
  }).id;
  const stone = registry.register({
    name: "stone",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 4,
    atlas: { x: 3, y: 0 },
    color: "#8d9290"
  }).id;
  const sand = registry.register({
    name: "sand",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 0.6,
    atlas: { x: 4, y: 0 },
    color: "#d6c37d"
  }).id;
  const sandstone = registry.register({
    name: "sandstone",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 2,
    atlas: { x: 5, y: 0 },
    color: "#c9ad64"
  }).id;
  const snow = registry.register({
    name: "snow",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 0.5,
    atlas: { x: 6, y: 0 },
    color: "#e8f4f8"
  }).id;
  const water = registry.register({
    name: "water",
    solid: false,
    opaque: false,
    transparent: true,
    fluid: true,
    fluidViscosity: 0.72,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 100,
    atlas: { x: 7, y: 0 },
    color: "#3f8fd8"
  }).id;
  const log = registry.register({
    name: "log",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 2,
    atlas: { x: 0, y: 1 },
    color: "#8b5a2b"
  }).id;
  const leaves = registry.register({
    name: "leaves",
    solid: true,
    opaque: false,
    transparent: true,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 0.2,
    atlas: { x: 1, y: 1 },
    color: "#3f7f38"
  }).id;
  const coalOre = registry.register({
    name: "coal_ore",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 4,
    atlas: { x: 2, y: 1 },
    color: "#767b7a"
  }).id;
  const ironOre = registry.register({
    name: "iron_ore",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 4,
    atlas: { x: 3, y: 1 },
    color: "#9a9485"
  }).id;
  const lamp = registry.register({
    name: "lamp",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [15, 12, 8],
    signal: false,
    blastResistance: 1,
    atlas: { x: 4, y: 1 },
    color: "#ffd36c"
  }).id;
  const brick = registry.register({
    name: "brick",
    solid: true,
    opaque: true,
    transparent: false,
    fluid: false,
    fluidViscosity: 0,
    light: [0, 0, 0],
    signal: false,
    blastResistance: 6,
    atlas: { x: 5, y: 1 },
    color: "#8f4b42"
  }).id;
  const lava = registry.register({
    name: "lava",
    solid: false,
    opaque: false,
    transparent: true,
    fluid: true,
    fluidViscosity: 0.9,
    light: [15, 6, 1],
    signal: false,
    blastResistance: 100,
    atlas: { x: 6, y: 1 },
    color: "#e65a22"
  }).id;
  const wire = registry.register({
    name: "signal_wire",
    solid: false,
    opaque: false,
    transparent: true,
    fluid: false,
    fluidViscosity: 0,
    light: [2, 0, 0],
    signal: true,
    blastResistance: 0.1,
    atlas: { x: 7, y: 1 },
    color: "#d13b2f"
  }).id;

  return {
    registry,
    blocks: {
      air: 0,
      grass,
      dirt,
      stone,
      sand,
      sandstone,
      snow,
      water,
      log,
      leaves,
      coalOre,
      ironOre,
      lamp,
      brick,
      lava,
      wire
    }
  };
}
