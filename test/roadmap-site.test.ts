// jsdom ships runtime types through its API but this repository does not carry
// the optional @types/jsdom package. Keep this focused artifact test dependency-free.
// @ts-expect-error -- jsdom has no declaration package in this repository.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "public/roadmap/index.html"), "utf8");
const dataScript = readFileSync(resolve(root, "public/roadmap/roadmap-data.js"), "utf8");
const appScript = readFileSync(resolve(root, "public/roadmap/app.js"), "utf8");
const workerScript = readFileSync(resolve(root, "workers/site.js"), "utf8");
const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");
const sheetsMuseumPath = resolve(root, "public/roadmap/museum/2026-08-17-sheets-era-roadmap.html");

function renderRoadmap() {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost/roadmap/",
  });
  dom.window.eval(dataScript);
  dom.window.eval(appScript);
  return dom;
}

describe("roadmap website", () => {
  it("renders the complete dated roadmap from structured data", () => {
    const dom = renderRoadmap();
    const { document } = dom.window;

    expect(document.querySelectorAll(".score-card")).toHaveLength(6);
    expect(document.querySelectorAll("#lens-tabs [role=tab]")).toHaveLength(4);
    expect(document.querySelectorAll("#gate-tabs [role=tab]")).toHaveLength(6);
    expect(document.querySelectorAll("#metric-rows tr")).toHaveLength(6);
    expect(document.querySelectorAll("#phase-list .phase-card")).toHaveLength(10);
    expect(document.querySelectorAll("#update-list .update-item")).toHaveLength(3);
    expect(document.querySelectorAll("#milestone-list .milestone")).toHaveLength(17);
    expect(document.querySelectorAll("#vision-principles .vision-principle")).toHaveLength(4);
    expect(document.querySelectorAll("#museum-list .museum-exhibit")).toHaveLength(2);
    expect(document.body.textContent).toContain("Pre-traction");
    expect(document.body.textContent).toContain("Public");
    expect(document.body.textContent).toContain("main@93df0ec");
  });

  it("states the current Hearth vision before presenting dated evidence", () => {
    const dom = renderRoadmap();
    const { document } = dom.window;
    const vision = document.getElementById("vision")?.textContent ?? "";

    expect(vision).toContain("Canada-first household general ledger and companion kitchen for two people");
    expect(vision).toContain("Books · 5");
    expect(vision).toContain("Kitchen · 3");
    expect(vision).toContain("No device is the host");
    expect(vision).toContain("PGlite");
    expect(vision).toContain("pre-traction");
  });

  it("keeps the two dated museum exhibits separate from the canonical roadmap", () => {
    const dom = renderRoadmap();
    const { document } = dom.window;
    const exhibits = [...document.querySelectorAll<HTMLElement>("#museum-list .museum-exhibit")];
    const times = exhibits.map((exhibit) => exhibit.querySelector("time")?.getAttribute("datetime"));
    const sourceLinks = exhibits.map((exhibit) => exhibit.querySelector<HTMLAnchorElement>("a.museum-link"));

    expect(times).toEqual(["2026-08-17", "2026-08-23"]);
    expect(exhibits[0].textContent).toContain("Google Sheets + Apps Script");
    expect(exhibits[1].textContent).toContain("Big Thinking");
    expect(exhibits.every((exhibit) => exhibit.textContent?.toLowerCase().includes("superseded"))).toBe(true);
    expect(sourceLinks[0]?.getAttribute("href")).toBe("./museum/2026-08-17-sheets-era-roadmap.html");
    expect(sourceLinks[1]?.getAttribute("href")).toContain("claude.ai/code/artifact/");
    expect(sourceLinks.every((link) => link?.target === "_blank" && link.rel === "noopener noreferrer")).toBe(true);
    expect(document.querySelectorAll("#museum iframe")).toHaveLength(0);
    expect(document.querySelectorAll("#phase-list .phase-card")).toHaveLength(10);
    expect(existsSync(sheetsMuseumPath)).toBe(true);
    expect(readFileSync(sheetsMuseumPath, "utf8")).toContain("updated Aug 17, 2026");
  });

  it("labels Git-backed times separately from date-only artifact milestones", () => {
    const dom = renderRoadmap();
    const { document } = dom.window;
    const journey = document.getElementById("journey")?.textContent ?? "";
    const dateTimes = [...document.querySelectorAll("#milestone-list time")].map((time) => time.getAttribute("datetime"));

    expect(journey).toContain("Git timestamp · shown to minute");
    expect(journey).toContain("Artifact date · time unrecorded");
    expect(dateTimes).toContain("2026-08-17");
    expect(dateTimes).toContain("2026-08-27T15:56:20-04:00");
  });

  it("switches analysis lenses and evidence gates", () => {
    const dom = renderRoadmap();
    const { document, MouseEvent } = dom.window;
    const lensTabs = document.querySelectorAll<HTMLButtonElement>("#lens-tabs [role=tab]");
    const gateTabs = document.querySelectorAll<HTMLButtonElement>("#gate-tabs [role=tab]");

    lensTabs[3].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(lensTabs[3].getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("lens-panel")?.textContent).toContain("pre-traction");

    gateTabs[5].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(gateTabs[5].getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("gate-panel")?.textContent).toContain("Market shape and capital choice");
  });

  it("filters phases without deleting them from the structured roadmap", () => {
    const dom = renderRoadmap();
    const { document, MouseEvent } = dom.window;
    const filters = document.querySelectorAll<HTMLButtonElement>("#phase-filters button");

    filters[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelectorAll("#phase-list .phase-card")).toHaveLength(5);
    expect(document.getElementById("phase-status")?.textContent).toContain("5 of 10");

    filters[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelectorAll("#phase-list .phase-card")).toHaveLength(5);
    expect(document.body.textContent).toContain("Other households and platform shape");
  });

  it("activates lens and evidence tabs with Enter and Space", () => {
    const dom = renderRoadmap();
    const lensTabs = [...dom.window.document.querySelectorAll<HTMLButtonElement>("#lens-tabs [role='tab']")];
    const gateTabs = [...dom.window.document.querySelectorAll<HTMLButtonElement>("#gate-tabs [role='tab']")];

    lensTabs[1]?.focus();
    lensTabs[1]?.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(lensTabs[1]?.getAttribute("aria-selected")).toBe("true");

    gateTabs[1]?.focus();
    gateTabs[1]?.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(gateTabs[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("stays read-only and independent from household runtime state", () => {
    const runtime = `${dataScript}\n${appScript}`;
    expect(runtime).not.toMatch(/\bfetch\s*\(/);
    expect(runtime).not.toMatch(/localStorage|sessionStorage|supabase|VITE_|householdSnapshot/);
    expect(html).toContain('name="viewport"');
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('name="robots" content="index,follow"');
    expect(html).toContain('rel="canonical" href="https://hearth-books.jonathan-beaulne123.workers.dev/roadmap/"');
    expect(html).not.toContain("<iframe");
  });

  it("maps the clean roadmap address in development and lets Cloudflare resolve the directory index", () => {
    expect(viteConfig).toContain('req.url = "/roadmap/index.html"');
    expect(workerScript).not.toContain('url.pathname = "/roadmap/index.html"');
    expect(workerScript).toContain("env.ASSETS.fetch(request)");
  });
});
