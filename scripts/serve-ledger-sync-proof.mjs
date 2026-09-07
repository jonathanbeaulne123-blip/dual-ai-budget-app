import { build, preview } from "vite";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// A separate test-only bundle: never include the local-auth entry in shipping dist.
process.env.VITE_LEDGER_SYNC_V2 = "1";
process.env.VITE_LEDGER_SYNC_LOCAL_AUTH = "1";
const outDir = await mkdtemp(join(tmpdir(), "hearth-ledger-app-proof-"));
const config = {
  configFile: resolve("vite.config.ts"),
  build: {
    outDir,
    rollupOptions: { input: resolve("test/browser/ledger-sync-app.html") },
  },
};
await build(config);
const server = await preview({
  ...config,
  preview: {
    host: "localhost",
    port: Number(process.env.HEARTH_LEDGER_PROOF_PORT ?? 5195),
    strictPort: true,
    proxy: {
      "/ledger-sync": {
        target: process.env.HEARTH_LEDGER_PROXY ?? "http://127.0.0.1:8792",
        ws: true,
      },
    },
  },
});
server.printUrls();
