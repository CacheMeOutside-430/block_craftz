import { Vec3 } from "../math";

export class CameraController {
  private readonly keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private jumpQueued = false;
  private mineQueued = false;
  private placeQueued = false;
  private readonly sensitivity = 0.0022;
  selectedSlot = 0;

  constructor(private readonly element: HTMLElement) {
    element.addEventListener("click", () => {
      if (document.pointerLockElement !== element) {
        void element.requestPointerLock();
      }
    });
    document.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (event.code === "Space" && !event.repeat) {
        this.jumpQueued = true;
      }
      if (/^Digit[1-9]$/.test(event.code)) {
        this.selectedSlot = Number(event.code.slice(5)) - 1;
      }
    });
    document.addEventListener("keyup", (event) => this.keys.delete(event.code));
    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== element) {
        return;
      }
      this.yaw -= event.movementX * this.sensitivity;
      this.pitch -= event.movementY * this.sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch));
    });
    element.addEventListener("mousedown", (event) => {
      if (document.pointerLockElement !== element) {
        void element.requestPointerLock();
      }
      if (event.button === 0) {
        this.mineQueued = true;
      } else if (event.button === 2) {
        this.placeQueued = true;
      }
    });
    element.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.selectedSlot += event.deltaY > 0 ? 1 : -1;
      this.selectedSlot = ((this.selectedSlot % 9) + 9) % 9;
    });
    element.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  wantsJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  isJumpHeld(): boolean {
    return this.keys.has("Space");
  }

  consumeMine(): boolean {
    const queued = this.mineQueued;
    this.mineQueued = false;
    return queued;
  }

  consumePlace(): boolean {
    const queued = this.placeQueued;
    this.placeQueued = false;
    return queued;
  }

  isSprinting(): boolean {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  }

  movementVector(): Vec3 {
    const forward = new Vec3(Math.sin(this.yaw), 0, Math.cos(this.yaw) * -1);
    const right = new Vec3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const move = new Vec3();
    if (this.keys.has("KeyW")) move.add(forward);
    if (this.keys.has("KeyS")) move.sub(forward);
    if (this.keys.has("KeyD")) move.add(right);
    if (this.keys.has("KeyA")) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize();
    }
    return move;
  }

  movementAcceleration(grounded: boolean): Vec3 {
    const acceleration = grounded ? (this.isSprinting() ? 70 : 52) : 18;
    return this.movementVector().scale(acceleration);
  }

  isMoving(): boolean {
    return this.movementVector().lengthSq() > 0;
  }

  lookDirection(): Vec3 {
    const cp = Math.cos(this.pitch);
    return new Vec3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  rotationEuler(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }
}
