import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./engine", import.meta.url)),
      "@game": fileURLToPath(new URL("./game", import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    target: "es2022",
    sourcemap: true
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
