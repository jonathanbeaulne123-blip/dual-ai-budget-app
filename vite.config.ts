import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

function roadmapRoute() {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const pathname = req.url?.split(/[?#]/, 1)[0];
    if (pathname === "/roadmap" || pathname === "/roadmap/") {
      req.url = "/roadmap/index.html";
    }
    next();
  };

  return {
    name: "hearth-roadmap-route",
    configureServer(server: { middlewares: { use: (handler: typeof rewrite) => void } }) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server: { middlewares: { use: (handler: typeof rewrite) => void } }) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [roadmapRoute(), react()],
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
      "/hercules/plan": {
        target: "https://hearth-books.jonathan-beaulne123.workers.dev",
        changeOrigin: true,
      },
      "/hercules/rig": {
        target: "https://hearth-books.jonathan-beaulne123.workers.dev",
        changeOrigin: true,
      },
      "/documents/scan": {
        target: "https://hearth-books.jonathan-beaulne123.workers.dev",
        changeOrigin: true,
      },
      "/bank/flinks": {
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
    // PGlite starts a PostgreSQL/WASM runtime per test file. Running those
    // runtimes concurrently starves otherwise-fast tests on CI and desktop.
    maxWorkers: 1,
    testTimeout: 15_000,
  },
});
