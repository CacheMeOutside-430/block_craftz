export type BehaviorStatus = "success" | "failure" | "running";

export interface BehaviorContext {
  readonly time: number;
  readonly blackboard: Map<string, unknown>;
}

export interface BehaviorNode {
  tick(context: BehaviorContext): BehaviorStatus;
}

export class ActionNode implements BehaviorNode {
  constructor(private readonly action: (context: BehaviorContext) => BehaviorStatus) {}

  tick(context: BehaviorContext): BehaviorStatus {
    return this.action(context);
  }
}

export class SequenceNode implements BehaviorNode {
  private cursor = 0;

  constructor(private readonly children: BehaviorNode[]) {}

  tick(context: BehaviorContext): BehaviorStatus {
    while (this.cursor < this.children.length) {
      const status = this.children[this.cursor].tick(context);
      if (status === "running") {
        return "running";
      }
      if (status === "failure") {
        this.cursor = 0;
        return "failure";
      }
      this.cursor++;
    }
    this.cursor = 0;
    return "success";
  }
}

export class SelectorNode implements BehaviorNode {
  private cursor = 0;

  constructor(private readonly children: BehaviorNode[]) {}

  tick(context: BehaviorContext): BehaviorStatus {
    while (this.cursor < this.children.length) {
      const status = this.children[this.cursor].tick(context);
      if (status === "running") {
        return "running";
      }
      if (status === "success") {
        this.cursor = 0;
        return "success";
      }
      this.cursor++;
    }
    this.cursor = 0;
    return "failure";
  }
}

export interface UtilityConsideration {
  readonly name: string;
  score(context: BehaviorContext): number;
}

export interface UtilityAction {
  readonly name: string;
  readonly considerations: UtilityConsideration[];
  execute(context: BehaviorContext): BehaviorStatus;
}

export class UtilityAI {
  constructor(private readonly actions: UtilityAction[]) {}

  choose(context: BehaviorContext): UtilityAction | null {
    let best: UtilityAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const action of this.actions) {
      const score = action.considerations.reduce((product, consideration) => {
        return product * Math.max(0, Math.min(1, consideration.score(context)));
      }, 1);
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }
    return best;
  }

  tick(context: BehaviorContext): BehaviorStatus {
    return this.choose(context)?.execute(context) ?? "failure";
  }
}
