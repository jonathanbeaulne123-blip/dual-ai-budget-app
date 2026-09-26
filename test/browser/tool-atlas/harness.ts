/**
 * The Tool Atlas browser harness (Wave 3a, brief §8).
 *
 * Runs the ordinary App in Chromium against the fictional Development demo
 * household (`seedDemoHousehold` through "Open the demo household table"),
 * built with the deployed presentation flags (.github/workflows/pages.yml
 * lines 57-76) and none of the Auth, Supabase or continuity flags, so nothing
 * leaves the loopback. Chromium draws WebGL through SwiftShader.
 *
 * `TOOL_ATLAS_BASE=http://127.0.0.1:5211/` reuses a server you already run
 * (see scripts/capture-tool-atlas-evidence.py); otherwise the harness starts
 * Vite itself. `TOOL_ATLAS_CHROMIUM` names a Chromium binary; otherwise the
 * one Playwright expects, or else any build under PLAYWRIGHT_BROWSERS_PATH.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type LaunchOptions, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

export const FLAGS: Record<string, string> = {
  VITE_HEARTH_HOUSE_WORLD: "1",
  VITE_HEARTH_HARBOUR: "1",
  VITE_FUND_MODEL_V2: "1",
  VITE_CELLAR_V3: "1",
  VITE_HERCULES_WORKSPACE: "1",
  VITE_PLAN_SYSTEM_V2: "1",
  VITE_QUEENS_NEST: "1",
  VITE_HERCULES_ACTIONS: "1",
  VITE_HERCULES_CHAT: "1",
  VITE_HERCULES_DISCOVERY: "1",
  VITE_HERCULES_DRESSING_ROOM: "1",
};

export const APPEARANCE_KEY = "hearth:appearance:v1:development:guest";
export type Theme = "classic" | "taylor" | "newfoundland";

const GL_ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--disable-background-networking"];

function chromiumBinary(): string | undefined {
  if (process.env.TOOL_ATLAS_CHROMIUM) return process.env.TOOL_ATLAS_CHROMIUM;
  try { if (existsSync(chromium.executablePath())) return undefined; } catch { /* fall through */ }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
    for (const sub of ["chrome-linux64", "chrome-linux"]) {
      const candidate = join(root, dir, sub, "chrome");
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export type Harness = { origin: string; browser: Browser; close: () => Promise<void> };

/** How the specs launch Chromium (each spec calls `chromium.launch(launchOptions())` itself, so the lane guard sees a browser suite). */
export function launchOptions(): LaunchOptions {
  const executablePath = chromiumBinary();
  return { headless: true, args: GL_ARGS, ...(executablePath ? { executablePath } : {}) };
}

/** Vite (unless TOOL_ATLAS_BASE names a running server) around a browser the spec launched. */
export async function startHarness(browser: Browser): Promise<Harness> {
  let server: ViteDevServer | null = null;
  let origin = process.env.TOOL_ATLAS_BASE?.replace(/\/$/, "") ?? "";
  if (!origin) {
    const define = Object.fromEntries(Object.entries(FLAGS).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]));
    server = await createServer({
      root: process.cwd(),
      cacheDir: "node_modules/.tool-atlas-browser-vite",
      logLevel: "error",
      define,
      server: { host: "127.0.0.1", port: 0, strictPort: false },
    });
    await server.listen();
    const address = server.httpServer?.address();
    origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  }
  return {
    origin,
    browser,
    close: async () => { await browser.close(); await server?.close(); },
  };
}

export type HomeOptions = {
  theme?: Theme; width?: number; height?: number; timezoneId?: string; reducedMotion?: "reduce" | "no-preference";
  /** A fixed wall clock (timers still run), so the demo seeds the same fixture every day. */
  fixedTime?: string;
  /** Per-viewer bubble use counts (`hearth:atlas:used:<member>:<bubble>`), written before the App reads them. */
  usedCounts?: { member: string; count: number };
};

/** A fresh context in the demo household, standing at home (the island, Ours), the first-visit chooser closed. */
export async function openHome(harness: Harness, options: HomeOptions = {}): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
  const context = await harness.browser.newContext({
    viewport: { width: options.width ?? 390, height: options.height ?? 844 },
    deviceScaleFactor: 1,
    reducedMotion: options.reducedMotion ?? "no-preference",
    ...(options.timezoneId ? { timezoneId: options.timezoneId } : {}),
  });
  const theme = options.theme ?? "classic";
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, JSON.stringify({ appearance: { theme: value, atmosphere: false }, pending: false })); } catch { /* private mode */ }
  }, [APPEARANCE_KEY, theme] as const);
  if (options.usedCounts) {
    await context.addInitScript(({ member, count }) => {
      for (const kind of ["record", "tools", "flip"]) { try { localStorage.setItem(`hearth:atlas:used:${member}:${kind}`, String(count)); } catch { /* private mode */ } }
    }, options.usedCounts);
  }
  // A28: orientation is never locked. Record any attempt.
  await context.addInitScript(() => {
    const w = window as unknown as { __orientationLocked?: boolean };
    w.__orientationLocked = false;
    try {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (orientation) orientation.lock = () => { w.__orientationLocked = true; return Promise.resolve(); };
    } catch { /* no Screen Orientation API */ }
  });
  // Nothing leaves the loopback.
  await context.route("**/*", route => new URL(route.request().url()).origin === harness.origin ? route.continue() : route.abort());
  const page = await context.newPage();
  if (options.fixedTime) await page.clock.setFixedTime(new Date(options.fixedTime));
  page.setDefaultTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(harness.origin + "/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open the demo household table" }).click({ timeout: 180_000 });
  await page.getByText("Choose yourself").waitFor({ timeout: 120_000 });
  await page.getByRole("button", { name: "I am Jonathan" }).click();
  await page.waitForFunction(() => !document.querySelector(".welcome-card") && !!document.querySelector(".app"), undefined, { timeout: 180_000 });
  await waitIsland(page);
  await page.waitForFunction(() => !/Validating the local journal/.test(document.body.textContent ?? ""), undefined, { timeout: 90_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  const close = page.getByRole("button", { name: "Close character choices" });
  if (await close.count()) { await close.click(); await page.waitForTimeout(400); }
  return { context, page, errors };
}

export async function waitIsland(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const world = document.querySelector<HTMLElement>(".harbour-world");
    return Boolean(world && world.dataset.worldStatus === "ready" && !document.querySelector("[data-desk]") && document.querySelector(".glass-dock"));
  }, undefined, { timeout: 180_000 });
}

/** Activate without a pointer (as a keyboard or switch does): the island does not walk. */
export async function press(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().evaluate((element: HTMLElement) => { element.focus(); element.click(); });
}

/** A short description of the focused element, for order and return checks. */
export async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return "body";
    const stop = element.closest("[data-glass-bubble]")?.getAttribute("data-glass-bubble")
      ?? (element.closest(".glass-strip") ? "strip" : null)
      ?? (element.closest("[data-camp-card]") ? "card" : null);
    const name = (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
    return `${stop ?? element.tagName.toLowerCase()}|${name}`;
  });
}

/** Relative luminance and contrast (WCAG 2.x). */
export function luminance([r, g, b]: readonly number[]): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);
}
export function contrast(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
/** `rgb(…)` / `rgba(…)` → [r, g, b, a]. */
export function parseColor(value: string): [number, number, number, number] {
  const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 1];
}
