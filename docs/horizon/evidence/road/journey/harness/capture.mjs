// Journey land captures for the road pass (ROAD.md §7): the board scene over the land at the default Region framing, Sky,
// and Region / Stop over each span. Headless SwiftShader Chromium; not device evidence.
//   node docs/horizon/evidence/road/journey/harness/capture.mjs <outDir> <prefix>   (from the repo root)
//   THEMES=classic,taylor,newfoundland ONLY=<comma list of pose names> to narrow a run.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const [,, outDir = "docs/horizon/evidence/road/journey", prefix = "after"] = process.argv;
mkdirSync(outDir, { recursive: true });
const repo = process.cwd(), root = new URL(".", import.meta.url).pathname;
const server = await createServer({ root, configFile: false, publicDir: resolve(repo, "public"), logLevel: "warn",
  server: { port: 5291, strictPort: true, host: "127.0.0.1", fs: { allow: [repo] } }, optimizeDeps: { entries: [root + "main.ts"] } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.HORIZON_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const report = {};
try {
  for (const theme of (process.env.THEMES ?? "classic").split(",")) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(`http://127.0.0.1:5291/?theme=${theme}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
    const poses = [
      ["default-region", "piece", "region"],
      ["sky", "piece", "sky"],
      ["bight-region", { x: 560, y: 1098 }, "region"],
      ["bight-stop", { x: 560, y: 1098 }, "stop"],
      ["quay-stop", { x: 1340, y: 1340 }, "stop"],
      ["highspan-stop", { x: 1240, y: 1102 }, "stop"],
      ["prow-stop", { x: 1590, y: 890 }, "stop"],
      // Long Sands (R10): boulevard reaches show here once the corridor is baked.
      ["sands-region", { x: 880, y: 1290 }, "region"],
      ["sands-stop", { x: 880, y: 1290 }, "stop"],
      ["canal-stop", { x: 1300, y: 750 }, "stop"],
      ["tunnel-stop", { x: 1440, y: 790 }, "stop"],
    ];
    for (const [name, target, tier] of poses) {
      if (process.env.ONLY && !process.env.ONLY.split(",").includes(name)) continue;
      const info = await page.evaluate(([t, tr]) => window.__cap.frame(t, tr), [target, tier]);
      await page.waitForTimeout(300);
      const file = `${prefix}-${theme}-${name}.png`;
      await page.locator("#host").screenshot({ path: `${outDir}/${file}` });
      report[file] = info; console.log(file, JSON.stringify(info));
    }
    if (errs.length) console.log("errors", errs.slice(0, 5));
    report[`errors-${theme}`] = errs;
    await page.close();
  }
} finally { writeFileSync(`${outDir}/${prefix}-report.json`, JSON.stringify(report, null, 2)); await browser.close(); await server.close(); }
