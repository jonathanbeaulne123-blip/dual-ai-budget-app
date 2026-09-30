// Journey baseline captures for the Bridge Book: ten sites at Region and Stop. Headless SwiftShader Chromium; not device evidence.
//   node docs/horizon/evidence/bridges/map/harness/capture.mjs <outDir> <prefix>   (from the repo root)
//   THEMES=classic,taylor,newfoundland ONLY=<comma list of pose names> to narrow a run.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const [,, outDir = "docs/horizon/evidence/bridges/before/map", prefix = "before"] = process.argv;
mkdirSync(outDir, { recursive: true });
const repo = process.cwd(), root = fileURLToPath(new URL(".", import.meta.url));
const server = await createServer({ root, configFile: false, publicDir: resolve(repo, "public"), logLevel: "warn",
  server: { port: 5292, strictPort: true, host: "127.0.0.1", fs: { allow: [repo] } }, optimizeDeps: { entries: [root + "main.ts"] } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.HORIZON_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const report = {};
try {
  for (const theme of (process.env.THEMES ?? "classic").split(",")) {
    const page = await browser.newPage({ viewport: { width: Number(process.env.WIDTH??1280), height: 800 } });
    const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(`http://127.0.0.1:5292/?theme=${theme}&width=${process.env.WIDTH??1280}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
    const poses = [
      ["bight-region", {x:560,y:1100}, "region"],
      ["bight-stop", {x:560,y:1100}, "stop"],
      ["highspan-region", {x:1240,y:1105}, "region"],
      ["highspan-stop", {x:1240,y:1105}, "stop"],
      ["quay-region", {x:1350,y:1345}, "region"],
      ["quay-stop", {x:1350,y:1345}, "stop"],
      ["apron-region", {x:1158,y:949}, "region"],
      ["apron-stop", {x:1158,y:949}, "stop"],
      ["hollow-region", {x:893,y:600}, "region"],
      ["hollow-stop", {x:893,y:600}, "stop"],
      ["canal-region", {x:1300.5,y:748}, "region"],
      ["canal-stop", {x:1300.5,y:748}, "stop"],
      ["prow-loop-region", {x:1606.65,y:688.75}, "region"],
      ["prow-loop-stop", {x:1606.65,y:688.75}, "stop"],
      ["trestle-region", {x:902.3,y:900.5}, "region"],
      ["trestle-stop", {x:902.3,y:900.5}, "stop"],
      ["garden-region", {x:965.7,y:761.1}, "region"],
      ["garden-stop", {x:965.7,y:761.1}, "stop"],
      ["reach-region", {x:1255,y:1251}, "region"],
      ["reach-stop", {x:1255,y:1251}, "stop"]
    ];
    for (const [name, target, tier] of poses) {
      if (process.env.ONLY && !process.env.ONLY.split(",").includes(name)) continue;
      const info = await page.evaluate(([t, tr]) => window.__cap.frame(t, tr), [target, tier]);
      await page.waitForTimeout(300);
      const file = `${prefix}-${theme}-${name}.png`;
      await page.locator("#host").screenshot({ path: `${outDir}/${file}` });
      const labels=await page.locator('.journey-bridge-label').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},clipped:r.left<0||r.right>innerWidth};}));
      report[file] = {...info,labels}; console.log(file, JSON.stringify(report[file]));
    }
    if (errs.length) console.log("errors", errs.slice(0, 5));
    report[`errors-${theme}`] = errs;
    await page.close();
  }
} finally { writeFileSync(`${outDir}/${prefix}-report.json`, JSON.stringify(report, null, 2)); await browser.close(); await server.close(); }
