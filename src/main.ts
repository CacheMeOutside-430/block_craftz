import { VoxelGame } from "@game/Game";
import "./styles.css";

const host = document.getElementById("app");
if (!host) {
  throw new Error("Missing #app host element");
}

const game = new VoxelGame(host);
void game.start();
