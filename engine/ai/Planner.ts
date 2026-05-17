export interface Goal {
  readonly name: string;
  readonly desired: Record<string, boolean>;
  readonly priority: number;
}

export interface PlanningAction {
  readonly name: string;
  readonly cost: number;
  readonly preconditions: Record<string, boolean>;
  readonly effects: Record<string, boolean>;
}

export class GoalPlanner {
  plan(state: Record<string, boolean>, goals: readonly Goal[], actions: readonly PlanningAction[]): PlanningAction[] {
    const orderedGoals = [...goals].sort((a, b) => b.priority - a.priority);
    for (const goal of orderedGoals) {
      const plan = this.planForGoal(state, goal, actions);
      if (plan.length > 0 || satisfies(state, goal.desired)) {
        return plan;
      }
    }
    return [];
  }

  private planForGoal(state: Record<string, boolean>, goal: Goal, actions: readonly PlanningAction[]): PlanningAction[] {
    const queue: Array<{ state: Record<string, boolean>; path: PlanningAction[]; cost: number }> = [
      { state: { ...state }, path: [], cost: 0 }
    ];
    const seen = new Set<string>();
    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;
      const key = JSON.stringify(current.state);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (satisfies(current.state, goal.desired)) {
        return current.path;
      }
      for (const action of actions) {
        if (!satisfies(current.state, action.preconditions)) {
          continue;
        }
        queue.push({
          state: { ...current.state, ...action.effects },
          path: [...current.path, action],
          cost: current.cost + action.cost
        });
      }
    }
    return [];
  }
}

function satisfies(state: Record<string, boolean>, conditions: Record<string, boolean>): boolean {
  return Object.entries(conditions).every(([key, value]) => state[key] === value);
}
