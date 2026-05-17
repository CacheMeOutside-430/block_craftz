export class ShaderLibrary {
  private readonly sources = new Map<string, string>();
  private readonly timestamps = new Map<string, number>();

  async load(name: string, url: string): Promise<string> {
    const response = await fetch(`${url}?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Failed to load shader ${name}: ${response.status}`);
    }
    const text = await response.text();
    this.sources.set(name, text);
    this.timestamps.set(name, Date.now());
    return text;
  }

  get(name: string): string {
    const source = this.sources.get(name);
    if (!source) {
      throw new Error(`Shader not loaded: ${name}`);
    }
    return source;
  }

  timestamp(name: string): number {
    return this.timestamps.get(name) ?? 0;
  }
}
