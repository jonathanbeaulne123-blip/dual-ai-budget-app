/**
 * A2 / A15 (brief §4.3, §8): composite contrast of the glass over the island.
 *
 * For each dressing, by day and by night (a device clock at night, through the
 * context's time zone), on the 390 phone and the 1100 desktop:
 *   1. screenshot the island with the glass hidden (the patch behind it);
 *   2. read each bubble's, pill's and the dock's real fill (rgba) and ink;
 *   3. composite the fill over every pixel behind it and take the worst ratio.
 * Two alphas are measured: the one this browser renders (the lite tier and
 * the fallbacks draw the glass solid, alpha 1) and the dressing's glass tint
 * (`--glass-fill`, what a full-tier device draws). The Record word and "+" are
 * measured against the opaque accent (A15).
 *
 * Only the home pose is measured, not the twelve Sketchbook poses.
 *
 * Run:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node_modules/.bin/vitest run test/browser/tool-atlas/contrast.test.ts
 */
import { writeFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contrast, launchOptions, openHome, parseColor, startHarness, type Harness, type Theme } from "./harness.ts";

const report: Array<Record<string, unknown>> = [];
let harness: Harness;

beforeAll(async () => { harness = await startHarness(await chromium.launch(launchOptions())); }, 600_000);
afterAll(async () => {
  if (process.env.TOOL_ATLAS_CONTRAST_REPORT) writeFileSync(process.env.TOOL_ATLAS_CONTRAST_REPORT, JSON.stringify(report, null, 1));
  await harness?.close();
});

/** An IANA zone whose clock now reads night (21:00–04:59) or day (10:00–15:59). */
function zoneAt(kind: "day" | "night"): string {
  const zones = ["Pacific/Honolulu", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo", "Atlantic/Azores", "Europe/London", "Europe/Paris", "Europe/Athens", "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"];
  for (const zone of zones) {
    const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
    if (kind === "night" ? hour >= 21 || hour < 5 : hour >= 10 && hour < 16) return zone;
  }
  return kind === "night" ? "Asia/Tokyo" : "America/Toronto";
}

type Region = { id: string; kind: "label" | "icon" | "card"; rect: [number, number, number, number]; fill: string; glassFill: string; ink: string[] };

async function regions(page: Page): Promise<{ regions: Region[]; accent: Array<{ id: string; accent: string; ink: string }>; night: boolean }> {
  return page.evaluate(() => {
    const px = (r: DOMRect): [number, number, number, number] => [Math.max(0, Math.floor(r.left)), Math.max(0, Math.floor(r.top)), Math.min(innerWidth, Math.ceil(r.right)), Math.min(innerHeight, Math.ceil(r.bottom))];
    const out: Array<{ id: string; kind: "label" | "icon" | "card"; rect: [number, number, number, number]; fill: string; glassFill: string; ink: string[] }> = [];
    const accent: Array<{ id: string; accent: string; ink: string }> = [];
    for (const anchor of document.querySelectorAll<HTMLElement>(".glass-chrome [data-glass-bubble]")) {
      const id = anchor.dataset.glassBubble ?? "?";
      const glassFill = getComputedStyle(anchor).getPropertyValue("--glass-fill").trim();
      const circle = anchor.querySelector<HTMLElement>(".glass-bubble:not(.glass-bubble--host)") ?? anchor.querySelector<HTMLElement>(".fab");
      if (!circle) continue;
      const cs = getComputedStyle(circle);
      if (anchor.classList.contains("is-accent")) {
        accent.push({ id: `${id} word and +`, accent: cs.backgroundColor, ink: cs.color });
      } else {
        out.push({ id: `${id} icon`, kind: "icon", rect: px(circle.getBoundingClientRect()), fill: cs.backgroundColor, glassFill, ink: [cs.color] });
      }
      const pill = anchor.querySelector<HTMLElement>(".glass-bubble__label:not(.glass-bubble__label--tip)");
      if (pill && pill.getBoundingClientRect().width) {
        const ps = getComputedStyle(pill);
        if (anchor.classList.contains("is-accent")) accent.push({ id: `${id} pill`, accent: ps.backgroundColor, ink: ps.color });
        else out.push({ id: `${id} pill`, kind: "label", rect: px(pill.getBoundingClientRect()), fill: ps.backgroundColor, glassFill, ink: [ps.color] });
      }
    }
    const dock = document.querySelector<HTMLElement>(".glass-dock");
    const glass = document.querySelector<HTMLElement>(".glass-dock__glass");
    if (dock && glass) {
      const inks = new Set<string>();
      const walker = document.createTreeWalker(glass, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const p = n.parentElement;
        if (!p || !(n.textContent ?? "").trim() || !p.getBoundingClientRect().width) continue;
        const s = getComputedStyle(p);
        if ((s.clipPath || "").includes("inset(50%)")) continue;
        // Text on its own opaque chip (the selected Ours | Mine option) is not on the glass.
        let own = false;
        for (let e: HTMLElement | null = p; e && e !== glass; e = e.parentElement) { const bg = getComputedStyle(e).backgroundColor; if (!/rgba\(.*,\s*0\)$/.test(bg) && bg !== "transparent" && !bg.startsWith("rgba(0, 0, 0, 0")) { own = true; break; } }
        if (!own) inks.add(s.color);
      }
      out.push({ id: "dock (strip and card)", kind: "card", rect: px(glass.getBoundingClientRect()), fill: getComputedStyle(glass).backgroundColor, glassFill: getComputedStyle(dock).getPropertyValue("--glass-fill").trim(), ink: [...inks] });
    }
    return { regions: out, accent, night: !!document.querySelector("[data-glass-night], .glass-dock[data-night]") };
  });
}

/** The worst contrast of `ink` over `fill` composited on every pixel of the patch. */
function worst(raw: { data: Buffer; width: number; channels: number }, rect: [number, number, number, number], fill: [number, number, number, number], ink: [number, number, number, number]): number {
  let min = Infinity;
  const [x0, y0, x1, y1] = rect;
  const a = fill[3];
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
    const i = (y * raw.width + x) * raw.channels;
    const bg = [raw.data[i]!, raw.data[i + 1]!, raw.data[i + 2]!];
    const comp = [0, 1, 2].map(c => a * fill[c]! + (1 - a) * bg[c]!);
    // Text drawn with its own alpha (the night ink) composites over the glass too.
    const inkRgb = [0, 1, 2].map(c => ink[3] * ink[c]! + (1 - ink[3]) * comp[c]!);
    min = Math.min(min, contrast(inkRgb, comp));
  }
  return Math.round(min * 100) / 100;
}

async function measure(theme: Theme, time: "day" | "night", width: number, height: number) {
  const { context, page } = await openHome(harness, { theme, width, height, timezoneId: zoneAt(time) });
  try {
    const found = await regions(page);
    await page.addStyleTag({ content: ".glass-chrome, .glass-dock, .village-character { visibility: hidden !important; }" });
    await page.waitForTimeout(400);
    const behind = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const raw = { data: behind.data, width: behind.info.width, channels: behind.info.channels };
    const rows = found.regions.flatMap(r => r.ink.map(ink => {
      const needs = r.kind === "icon" ? 3 : 4.5;
      const rendered = worst(raw, r.rect, parseColor(r.fill), parseColor(ink));
      const glassFill = r.glassFill ? parseColor(r.glassFill) : null;
      const glass = glassFill ? worst(raw, r.rect, glassFill, parseColor(ink)) : null;
      return { id: r.id, kind: r.kind, ink, fill: r.fill, glassFill: r.glassFill, rendered, glass, needs };
    }));
    const accents = found.accent.map(a => ({ id: a.id, accent: a.accent, ink: a.ink, ratio: Math.round(contrast(parseColor(a.ink), parseColor(a.accent)) * 100) / 100, needs: 4.5 }));
    const entry = { theme, time, width, zone: zoneAt(time), nightDrawn: found.night, rows, accents };
    report.push(entry);
    return entry;
  } finally {
    await context.close();
  }
}

describe("A2 / A15 · composite contrast of the glass over the island", () => {
  for (const theme of ["classic", "taylor", "newfoundland"] as const) {
    it(`${theme}: labels ≥ 4.5, icons ≥ 3, card text ≥ 4.5 over the busiest patch, day and night; the Record word ≥ 4.5 on its accent`, async () => {
      const cells = [await measure(theme, "day", 390, 844), await measure(theme, "night", 390, 844), await measure(theme, "day", 1100, 800)];
      const failures: string[] = [];
      for (const cell of cells) {
        for (const row of cell.rows) {
          if (row.rendered < row.needs) failures.push(`${cell.time} ${cell.width} ${row.id} ${row.ink}: ${row.rendered} as drawn`);
          if (row.glass !== null && row.glass < row.needs) failures.push(`${cell.time} ${cell.width} ${row.id} ${row.ink}: ${row.glass} on glass (${row.glassFill})`);
        }
        for (const a of cell.accents) if (a.ratio < a.needs) failures.push(`${cell.time} ${cell.width} ${a.id}: ${a.ratio}`);
      }
      expect(failures).toEqual([]);
    }, 900_000);
  }
});
