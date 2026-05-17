export interface RenderPassContext {
  readonly frame: number;
}

export interface RenderPass {
  readonly name: string;
  readonly reads?: readonly string[];
  readonly writes?: readonly string[];
  readonly after?: readonly string[];
  execute(context: RenderPassContext): void;
}

export class RenderGraph {
  private readonly passes = new Map<string, RenderPass>();

  add(pass: RenderPass): this {
    if (this.passes.has(pass.name)) {
      throw new Error(`Duplicate render pass: ${pass.name}`);
    }
    this.passes.set(pass.name, pass);
    return this;
  }

  clear(): void {
    this.passes.clear();
  }

  execute(context: RenderPassContext): void {
    for (const pass of this.sortedPasses()) {
      pass.execute(context);
    }
  }

  private sortedPasses(): RenderPass[] {
    const result: RenderPass[] = [];
    const temporary = new Set<string>();
    const permanent = new Set<string>();
    const visit = (pass: RenderPass) => {
      if (permanent.has(pass.name)) {
        return;
      }
      if (temporary.has(pass.name)) {
        throw new Error(`Render graph cycle at ${pass.name}`);
      }
      temporary.add(pass.name);
      for (const dep of pass.after ?? []) {
        const dependency = this.passes.get(dep);
        if (!dependency) {
          throw new Error(`Render pass ${pass.name} depends on missing pass ${dep}`);
        }
        visit(dependency);
      }
      temporary.delete(pass.name);
      permanent.add(pass.name);
      result.push(pass);
    };
    for (const pass of this.passes.values()) {
      visit(pass);
    }
    return result;
  }
}
