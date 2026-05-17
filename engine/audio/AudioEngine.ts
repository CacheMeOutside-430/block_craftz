import { Vec3 } from "../math";

export interface AudioClip {
  readonly name: string;
  readonly buffer: AudioBuffer;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private readonly clips = new Map<string, AudioClip>();
  private readonly active = new Set<AudioBufferSourceNode>();
  private master: GainNode | null = null;

  async initialize(): Promise<void> {
    if (this.context) {
      return;
    }
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.72;
    this.master.connect(this.context.destination);
  }

  async decode(name: string, bytes: ArrayBuffer): Promise<AudioClip> {
    await this.initialize();
    const buffer = await this.context!.decodeAudioData(bytes.slice(0));
    const clip = { name, buffer };
    this.clips.set(name, clip);
    return clip;
  }

  play(name: string, position?: Vec3, gain = 1, loop = false): void {
    if (!this.context || !this.master) {
      return;
    }
    const clip = this.clips.get(name);
    if (!clip) {
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = clip.buffer;
    source.loop = loop;
    const gainNode = this.context.createGain();
    gainNode.gain.value = gain;
    if (position) {
      const panner = this.context.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      source.connect(gainNode).connect(panner).connect(this.master);
    } else {
      source.connect(gainNode).connect(this.master);
    }
    source.onended = () => this.active.delete(source);
    this.active.add(source);
    source.start();
  }

  setListener(position: Vec3, forward: Vec3, up: Vec3): void {
    if (!this.context) {
      return;
    }
    const listener = this.context.listener;
    listener.positionX.value = position.x;
    listener.positionY.value = position.y;
    listener.positionZ.value = position.z;
    listener.forwardX.value = forward.x;
    listener.forwardY.value = forward.y;
    listener.forwardZ.value = forward.z;
    listener.upX.value = up.x;
    listener.upY.value = up.y;
    listener.upZ.value = up.z;
  }

  stopAll(): void {
    for (const source of this.active) {
      source.stop();
    }
    this.active.clear();
  }
}
