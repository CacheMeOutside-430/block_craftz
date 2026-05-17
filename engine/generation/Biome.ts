export interface Biome {
  readonly name: string;
  readonly minHeight: number;
  readonly heightScale: number;
  readonly temperature: number;
  readonly humidity: number;
  readonly surface: string;
  readonly subsurface: string;
  readonly vegetationDensity: number;
}

export const DEFAULT_BIOMES: readonly Biome[] = [
  {
    name: "tundra",
    minHeight: 36,
    heightScale: 16,
    temperature: 0.12,
    humidity: 0.42,
    surface: "snow",
    subsurface: "dirt",
    vegetationDensity: 0.02
  },
  {
    name: "plains",
    minHeight: 32,
    heightScale: 12,
    temperature: 0.56,
    humidity: 0.48,
    surface: "grass",
    subsurface: "dirt",
    vegetationDensity: 0.12
  },
  {
    name: "forest",
    minHeight: 34,
    heightScale: 18,
    temperature: 0.62,
    humidity: 0.74,
    surface: "grass",
    subsurface: "dirt",
    vegetationDensity: 0.36
  },
  {
    name: "desert",
    minHeight: 30,
    heightScale: 10,
    temperature: 0.88,
    humidity: 0.16,
    surface: "sand",
    subsurface: "sandstone",
    vegetationDensity: 0.015
  },
  {
    name: "alpine",
    minHeight: 48,
    heightScale: 38,
    temperature: 0.28,
    humidity: 0.44,
    surface: "stone",
    subsurface: "stone",
    vegetationDensity: 0.03
  }
];

export function chooseBiome(biomes: readonly Biome[], temperature: number, humidity: number, elevation: number): Biome {
  let best = biomes[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const biome of biomes) {
    const elevationBias = biome.name === "alpine" ? Math.max(0, elevation - 0.55) * -0.9 : 0;
    const score =
      Math.abs(biome.temperature - temperature) * 1.25 +
      Math.abs(biome.humidity - humidity) +
      Math.abs((biome.minHeight - 28) / 42 - elevation) * 0.28 +
      elevationBias;
    if (score < bestScore) {
      bestScore = score;
      best = biome;
    }
  }
  return best;
}
