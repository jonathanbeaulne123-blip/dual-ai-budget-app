import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
  worker: {
    format: "es",
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/hercules/chat": {
        target: "https://hearth-books.jonathan-beaulne123.workers.dev",
        changeOrigin: true,
      },
      "/documents/scan": {
        target: "https://hearth-books.jonathan-beaulne123.workers.dev",
        changeOrigin: true,
      },
    },
  },
  preview: { host: true, port: 4173 },
  build: {
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // PGlite starts a PostgreSQL/WASM runtime per test file. An unbounded pool
    // starves the existing five-second tests on high-core CI and desktop hosts.
    maxWorkers: 4,
  },
});
