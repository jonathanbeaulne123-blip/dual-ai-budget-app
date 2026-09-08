import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || ".artifacts/three-worlds/references");
const origin = process.env.HEARTH_THEME_ORIGIN || "http://127.0.0.1:5184";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.HEARTH_BROWSER_CHANNEL ? { channel: process.env.HEARTH_BROWSER_CHANNEL } : {}) });
const cases = ["classic", "taylor", "newfoundland"].flatMap(theme =>
  ["household", "personal"].flatMap(scope =>
    ["home", "calendar", "plan", "ledger", "more", scope === "personal" ? "shift" : "till"].map(route => [theme, scope, route])));
const records = [];
try {
  for (const width of [320, 390, 720, 1100, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const [theme, scope, route] of cases) {
      await page.goto(`${origin}/?themeStudio=1&theme=${theme}&scope=${scope}&route=${route}`);
      await page.locator(".theme-scene-heading").waitFor();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      await page.evaluate(() => document.fonts.ready);
      const name = `${theme}-${scope}-${route}-${width}.png`;
      await page.screenshot({ path: resolve(output, name), animations: "disabled" });
      const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, scene: document.documentElement.dataset.scene }));
      if (metrics.scrollWidth > width) throw new Error(`Horizontal overflow: ${name} ${metrics.scrollWidth}`);
      records.push({ name, ...metrics });
    }
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(resolve(output, "reference-index.json"), JSON.stringify({ kind: "Synthetic component scene specimens; not full-App proof", browser: process.env.HEARTH_BROWSER_CHANNEL || "playwright-chromium", records }, null, 2));
console.log(JSON.stringify({ output, screenshots: records.length }));
