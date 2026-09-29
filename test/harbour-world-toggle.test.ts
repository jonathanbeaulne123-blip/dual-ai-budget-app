import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HARBOUR_DEV, horizonEnabled } from "../src/harbour/flag.ts";
import { defaultHarbourWorld, harbourWorldSearch, readHarbourWorld, resetHarbourWorldPreference, setHarbourWorld } from "../src/harbour/harbourWorld.ts";

describe("harbourWorldSearch (pure)", () => {
  it("sets world=horizon and clears it for mountain", () => {
    expect(harbourWorldSearch("", "horizon")).toBe("?world=horizon");
    expect(harbourWorldSearch("?world=horizon", "mountain")).toBe("");
  });

  it("preserves seed, member, story and sun when flipping", () => {
    const base = "?seed=mountain&story=growing&run=first&member=MEM-001&sun=15:30";
    const toHorizon = new URLSearchParams(harbourWorldSearch(base, "horizon").slice(1));
    expect(toHorizon.get("seed")).toBe("mountain");
    expect(toHorizon.get("story")).toBe("growing");
    expect(toHorizon.get("run")).toBe("first");
    expect(toHorizon.get("member")).toBe("MEM-001");
    expect(toHorizon.get("sun")).toBe("15:30");
    expect(toHorizon.get("world")).toBe("horizon");
    const back = new URLSearchParams(harbourWorldSearch(harbourWorldSearch(base, "horizon"), "mountain").slice(1));
    expect(back.get("world")).toBeNull();
    expect(back.get("member")).toBe("MEM-001");
    expect(back.get("sun")).toBe("15:30");
  });

  it("accepts search without a leading ?", () => {
    expect(harbourWorldSearch("member=MEM-001", "horizon")).toBe("?member=MEM-001&world=horizon");
  });
});

describe("readHarbourWorld", () => {
  it("matches horizonEnabled: horizon only in DEV with world=horizon", () => {
    resetHarbourWorldPreference();
    expect(readHarbourWorld("?world=horizon")).toBe(horizonEnabled("?world=horizon") ? "horizon" : "mountain");
    resetHarbourWorldPreference();
    expect(readHarbourWorld("")).toBe("mountain");
    expect(readHarbourWorld("?seed=mountain")).toBe("mountain");
  });

  it("keeps a DEV preference after housePath wipes world from the search", () => {
    resetHarbourWorldPreference();
    if (!HARBOUR_DEV) {
      expect(readHarbourWorld("?world=horizon")).toBe("mountain");
      return;
    }
    expect(readHarbourWorld("?world=horizon")).toBe("horizon");
    // App house navigation replaces search with household/scope only.
    expect(readHarbourWorld("?household=HH-MOUNTAIN-GROWING-first&scope=household")).toBe("horizon");
    setHarbourWorld("mountain", { replaceState: vi.fn() }, { pathname: "/house/home/middle", search: "?household=HH&scope=household", hash: "" });
    expect(readHarbourWorld("?household=HH&scope=household")).toBe("mountain");
  });
});

describe("D15 live switch", () => {
  it("defaults to the Horizon only when the live switch is on", () => {
    expect(defaultHarbourWorld(true)).toBe("horizon");
    expect(defaultHarbourWorld(false)).toBe("mountain");
  });

  it("production follows the switch and ignores the world query", () => {
    resetHarbourWorldPreference();
    expect(readHarbourWorld("", false, true)).toBe("horizon");
    expect(readHarbourWorld("?world=horizon", false, false)).toBe("mountain");
    expect(readHarbourWorld("?world=mountain", false, true)).toBe("horizon");
  });

  it("development starts from the build default and the toggle still wins", () => {
    resetHarbourWorldPreference();
    expect(readHarbourWorld("", true, true)).toBe("horizon");
    expect(readHarbourWorld("", true, false)).toBe("mountain");
    expect(readHarbourWorld("?world=horizon", true, false)).toBe("horizon");
    resetHarbourWorldPreference();
  });

  it("the mount, the product paths and the Journey Board's Enter buttons share one availability gate", () => {
    const root = process.cwd();
    const flag = readFileSync(join(root, "src/harbour/flag.ts"), "utf8");
    expect(flag).toMatch(/HORIZON_LIVE = HARBOUR_ENABLED && import\.meta\.env\.VITE_HEARTH_HORIZON === "1"/);
    expect(flag).toMatch(/HORIZON_AVAILABLE = HARBOUR_DEV \|\| HORIZON_LIVE/);
    expect(readFileSync(join(root, "src/harbour/scene/worldMount.ts"), "utf8")).toMatch(/if\(!HORIZON_AVAILABLE\)throw/);
    expect(readFileSync(join(root, "src/harbour/HarbourWorld.tsx"), "utf8")).toMatch(/return HORIZON_AVAILABLE && \(homeBook\?\.visitRequested/);
    const board = readFileSync(join(root, "src/journey/ui/JourneyBoardView.tsx"), "utf8");
    expect(board).toMatch(/const canEnterHorizon = live && HORIZON_AVAILABLE/);
    expect(board).not.toMatch(/horizonLocation=\{live \?/);
  });

  it("the live build switches it on and deploys the chunked assets, never the raw bake", () => {
    const root = process.cwd();
    expect(readFileSync(join(root, ".github/workflows/pages.yml"), "utf8")).toMatch(/VITE_HEARTH_HORIZON: "1"/);
    const ignore = readFileSync(join(root, "public/.assetsignore"), "utf8");
    expect(ignore).not.toMatch(/^\/horizon\/\*\*$/m);
    expect(ignore).toMatch(/^\/horizon\/world\/horizon-geo-\*\.json$/m);
  });
});

describe("setHarbourWorld", () => {
  it("updates only the world query via replaceState and keeps other keys", () => {
    resetHarbourWorldPreference();
    const replaceState = vi.fn();
    const loc = { pathname: "/__review", search: "?seed=mountain&member=MEM-001", hash: "" };
    const result = setHarbourWorld("horizon", { replaceState }, loc);
    if (!HARBOUR_DEV) {
      expect(result).toBe("mountain");
      expect(replaceState).not.toHaveBeenCalled();
      return;
    }
    expect(result).toBe("horizon");
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState.mock.calls[0]![2]).toBe("/__review?seed=mountain&member=MEM-001&world=horizon");
  });

  it("clears world when returning to mountain", () => {
    resetHarbourWorldPreference();
    const replaceState = vi.fn();
    const loc = { pathname: "/", search: "?world=horizon&sun=09:00", hash: "#court" };
    if (!HARBOUR_DEV) {
      expect(setHarbourWorld("mountain", { replaceState }, loc)).toBe("mountain");
      expect(replaceState).not.toHaveBeenCalled();
      return;
    }
    setHarbourWorld("mountain", { replaceState }, loc);
    const url = String(replaceState.mock.calls[0]![2]);
    expect(url.startsWith("/?")).toBe(true);
    expect(url.endsWith("#court")).toBe(true);
    const params = new URLSearchParams(url.slice(url.indexOf("?") + 1, url.indexOf("#")));
    expect(params.get("world")).toBeNull();
    expect(params.get("sun")).toBe("09:00");
  });
});

describe("full-App wiring (static)", () => {
  const root = process.cwd();
  const app = readFileSync(join(root, "src/App.tsx"), "utf8");
  const world = readFileSync(join(root, "src/harbour/HarbourWorld.tsx"), "utf8");
  const toggle = readFileSync(join(root, "src/harbour/nav/WorldToggle.tsx"), "utf8");

  it("App mounts WorldToggle beside Compass and remounts HarbourWorld by world id", () => {
    expect(app).toMatch(/import \{ WorldToggle \} from '\.\/harbour\/nav\/WorldToggle\.tsx'/);
    expect(app).toMatch(/HARBOUR_ENABLED\?<><WorldToggle\/><Compass /);
    expect(app).toMatch(/key=\{`\$\{environment\}:\$\{household\.householdId\}:\$\{actorId\}:\$\{harbourWorld\}`\}/);
  });

  it("HarbourWorld uses the reactive world selector; Home Book visit still forces Horizon", () => {
    expect(world).toMatch(/useHarbourWorld/);
    expect(world).toMatch(/homeBook\?\.visitRequested \|\| world === "horizon"/);
    expect(world).not.toMatch(/URLSearchParams\(window\.location\.search\)\.get\("world"\)/);
  });

  it("WorldToggle is DEV-gated and names both worlds for assistive tech", () => {
    expect(toggle).toMatch(/if \(!HARBOUR_DEV\) return null/);
    expect(toggle).toMatch(/aria-label="Harbour world for dissection"/);
    expect(toggle).toMatch(/aria-pressed=\{world === id\}/);
    expect(toggle).toMatch(/Mountain/);
    expect(toggle).toMatch(/Horizon/);
  });

  it("whole-house review banner links Horizon rehearsal", () => {
    const review = readFileSync(join(root, "scripts/serve-whole-house-review.mjs"), "utf8");
    expect(review).toMatch(/world=horizon/);
    expect(review).toMatch(/Horizon rehearsal/);
  });
});
