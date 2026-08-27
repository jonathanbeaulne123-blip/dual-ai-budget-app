// jsdom ships runtime types through its API but this repository does not carry
// the optional @types/jsdom package. Keep this focused artifact test dependency-free.
// @ts-expect-error -- jsdom has no declaration package in this repository.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "public/roadmap/index.html"), "utf8");
const dataScript = readFileSync(resolve(root, "public/roadmap/roadmap-data.js"), "utf8");
const appScript = readFileSync(resolve(root, "public/roadmap/app.js"), "utf8");
const workerScript = readFileSync(resolve(root, "workers/site.js"), "utf8");
const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");

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
    expect(document.querySelectorAll("#update-list .update-item")).toHaveLength(2);
    expect(document.body.textContent).toContain("Pre-traction");
    expect(document.body.textContent).toContain("Public");
    expect(document.body.textContent).toContain("main@93df0ec");
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

  it("stays read-only and independent from household runtime state", () => {
    const runtime = `${dataScript}\n${appScript}`;
    expect(runtime).not.toMatch(/\bfetch\s*\(/);
    expect(runtime).not.toMatch(/localStorage|sessionStorage|supabase|VITE_|householdSnapshot/);
    expect(html).toContain('name="viewport"');
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('name="robots" content="index,follow"');
    expect(html).toContain('rel="canonical" href="https://hearth-books.jonathan-beaulne123.workers.dev/roadmap/"');
  });

  it("maps the clean roadmap address to the standalone page in development and production", () => {
    expect(viteConfig).toContain('req.url = "/roadmap/index.html"');
    expect(workerScript).toContain('url.pathname = "/roadmap/index.html"');
    expect(workerScript).toContain("env.ASSETS.fetch(assetRequest)");
  });
});
