import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wanderFly } from "../src/HerculesFly.tsx";
import { HERC_MTL, HERC_SOURCE_GLB, HERC_SOURCE_MTL } from "../src/herculesMaterials.ts";

const POSES = [
  "loaf", "walk", "jump", "stretch", "wash", "sleep", "hide",
  "pace", "celebrate", "pounce", "perch", "lick", "bump", "attack",
] as const;

describe("Hercules mark and figure", () => {
  it("does not import the ledger from the figure or the dress", () => {
    const figure = readFileSync("src/HerculesFigure.tsx", "utf8");
    const dress = readFileSync("src/HerculesDress.tsx", "utf8");
    const fly = readFileSync("src/HerculesFly.tsx", "utf8");
    const materials = readFileSync("src/herculesMaterials.ts", "utf8");
    for (const src of [figure, dress, fly, materials]) {
      expect(src).not.toMatch(/from ["'].*core/);
      expect(src).not.toMatch(/postEntry/);
    }
  });

  it("paints the ruff before the head and keeps flip off .herc", () => {
    const figure = readFileSync("src/HerculesFigure.tsx", "utf8");
    expect(figure.indexOf("herc-ruff")).toBeLessThan(figure.indexOf("herc-head"));
    expect(figure).toMatch(/herc-flip-wrap/);
    expect(figure).not.toMatch(/className=\{`herc .*herc-flip/);
  });

  it("gives every pose a distinct CSS class and raises a paw on attack", () => {
    const css = readFileSync("src/hercules.css", "utf8");
    for (const pose of POSES) {
      expect(css).toContain(`.herc-pose-${pose}`);
    }
    const attack = css.slice(css.indexOf(".herc-pose-attack"));
    expect(attack).toMatch(/herc-leg-front/);
    expect(attack).toMatch(/rotate\(-6[0-9]deg\)/);
    const bump = css.slice(css.indexOf(".herc-pose-bump"), css.indexOf(".herc-pose-hide"));
    expect(bump).not.toMatch(/herc-leg-front/);
  });

  it("ships a separate favicon with a dark-tab contrast block", () => {
    const favicon = readFileSync("public/favicon.svg", "utf8");
    const mark = readFileSync("public/hercules-mark.svg", "utf8");
    const html = readFileSync("index.html", "utf8");
    expect(html).toMatch(/rel="icon"[^>]*href="\/favicon\.svg"/);
    expect(html).not.toMatch(/icon\.png/);
    expect(favicon).toMatch(/prefers-color-scheme:\s*dark/);
    expect(favicon).not.toMatch(/M32 44 C31 47/);
    expect(mark).toMatch(/currentColor/);
    expect(mark.length + favicon.length).toBeLessThan(8_000);
    const comments = mark.match(/<!--[\s\S]*?-->/g) ?? [];
    for (const comment of comments) {
      expect(comment.slice(4, -3)).not.toMatch(/--/);
    }
  });

  it("keeps the 3D source out of the Worker assets directory", () => {
    const glb = readFileSync(HERC_SOURCE_GLB);
    const mtl = readFileSync(HERC_SOURCE_MTL, "utf8");
    expect(glb.subarray(0, 4).toString("ascii")).toBe("glTF");
    expect(glb.length).toBeGreaterThan(1_000_000);
    expect(mtl).toMatch(/newmtl furWhite/);
    expect(mtl).toMatch(/newmtl furTan/);
    expect(HERC_MTL.furWhite.hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("hides the fly from assistive tech and never puts a dollar in its drawing", () => {
    const fly = readFileSync("src/HerculesFly.tsx", "utf8");
    expect(fly).toMatch(/aria-hidden="true"/);
    expect(fly).not.toMatch(/formatCad|\$[0-9]/);
    const spot = wanderFly({ w: 390, h: 800 }, 76, () => 0.5);
    expect(spot.x).toBeGreaterThan(0);
    expect(spot.y).toBeGreaterThan(0);
    expect(spot.y).toBeLessThan(800 - 76);
  });
});

describe("useFurniture publish path", () => {
  it("does not poll layout on a timer", () => {
    const src = readFileSync("src/widgets/useFurniture.ts", "utf8");
    expect(src).not.toMatch(/setInterval/);
    expect(src).toMatch(/requestAnimationFrame/);
    expect(src).toMatch(/ResizeObserver/);
  });
});
