import { Vec3 } from "../math";

export interface PlayerInput {
  readonly sequence: number;
  readonly tick: number;
  readonly move: Vec3;
  readonly jump: boolean;
}

export interface PredictedState {
  readonly sequence: number;
  readonly position: Vec3;
  readonly velocity: Vec3;
}

export class PredictionBuffer {
  private readonly inputs: PlayerInput[] = [];
  private readonly states: PredictedState[] = [];

  pushInput(input: PlayerInput): void {
    this.inputs.push(input);
    if (this.inputs.length > 128) {
      this.inputs.shift();
    }
  }

  pushState(state: PredictedState): void {
    this.states.push({ sequence: state.sequence, position: state.position.clone(), velocity: state.velocity.clone() });
    if (this.states.length > 128) {
      this.states.shift();
    }
  }

  reconcile(authoritative: PredictedState): PlayerInput[] {
    const predicted = this.states.find((state) => state.sequence === authoritative.sequence);
    if (!predicted || predicted.position.distance(authoritative.position) < 0.05) {
      return [];
    }
    return this.inputs.filter((input) => input.sequence > authoritative.sequence);
  }
}

export class Interpolator {
  private readonly snapshots: Array<{ tick: number; position: Vec3 }> = [];

  push(tick: number, position: Vec3): void {
    this.snapshots.push({ tick, position: position.clone() });
    this.snapshots.sort((a, b) => a.tick - b.tick);
    while (this.snapshots.length > 32) {
      this.snapshots.shift();
    }
  }

  sample(tick: number): Vec3 | null {
    if (this.snapshots.length === 0) {
      return null;
    }
    let previous = this.snapshots[0];
    for (const next of this.snapshots) {
      if (next.tick >= tick) {
        const span = Math.max(1, next.tick - previous.tick);
        const t = Math.max(0, Math.min(1, (tick - previous.tick) / span));
        return previous.position.clone().scale(1 - t).add(next.position.clone().scale(t));
      }
      previous = next;
    }
    return previous.position.clone();
  }
}
