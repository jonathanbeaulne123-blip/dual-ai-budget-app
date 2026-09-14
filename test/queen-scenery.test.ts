// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { resolveThemeScene } from "../src/theme/scenes.ts";
import { createQueenScenery, queenSceneryKind, JELLYBEAN_COLOURS, type QueenSceneryKind } from "../src/queen/world/queenScenery.ts";
import { QueenSceneryFlat } from "../src/queen/QueenSceneryFlat.tsx";

const KINDS: QueenSceneryKind[] = ["clouds", "row", "office"];
const flat = (kind: QueenSceneryKind | null) => renderToStaticMarkup(createElement(QueenSceneryFlat, { kind }));

describe("The worlds shared Home opens into", () => {
  it("gives each of the three shared-home scenes a world, and nothing else one", () => {
    // Shared home resolves to exactly three scenes; every one of them is a place.
    for (const theme of ["classic", "taylor", "newfoundland"] as const) {
      const scene = resolveThemeScene(theme, "home", "household");
      expect(queenSceneryKind(scene.id), `${theme} shared home`).not.toBeNull();
    }
    expect(queenSceneryKind(resolveThemeScene("taylor", "home", "household").id)).toBe("clouds");
    expect(queenSceneryKind(resolveThemeScene("newfoundland", "home", "household").id)).toBe("row");
    expect(queenSceneryKind(resolveThemeScene("classic", "home", "household").id)).toBe("office");
    // A route that is not shared Home keeps the bare field: no world is invented for it.
    // `entry` is the exception and not a special case — Taylor's and Newfoundland's
    // entry resolve to the *same scene* as their shared home, so they are the same place.
    for (const route of ["calendar", "plan", "ledger", "more", "till", "shift"] as const) {
      for (const theme of ["classic", "taylor", "newfoundland"] as const) {
        expect(queenSceneryKind(resolveThemeScene(theme, route, "household").id), `${theme} ${route}`).toBeNull();
      }
    }
    for (const theme of ["classic", "taylor", "newfoundland"] as const) {
      const entry = resolveThemeScene(theme, "entry", "household"), home = resolveThemeScene(theme, "home", "household");
      expect(queenSceneryKind(entry.id), `${theme} entry`).toBe(entry.id === home.id ? queenSceneryKind(home.id) : null);
    }
    expect(queenSceneryKind(resolveThemeScene("taylor", "home", "personal").id)).toBeNull();
    expect(queenSceneryKind(null)).toBeNull();
    expect(queenSceneryKind("harbour")).toBeNull();
  });

  it("builds each world in three layers of depth, with the near layer in front of her and the distance behind", () => {
    for (const kind of KINDS) {
      const world = createQueenScenery(kind);
      world.group.updateMatrixWorld(true);
      const depths: number[] = [];
      world.group.traverse((object) => {
        if (object === world.group) return;
        depths.push(object.getWorldPosition(new THREE.Vector3()).z);
      });
      expect(depths.length, `${kind} has objects`).toBeGreaterThan(20);
      // A distance well behind her, a middle around her, and something in front of the z = 0 plane she stands on.
      expect(Math.min(...depths), `${kind} distance`).toBeLessThan(-12);
      expect(Math.max(...depths), `${kind} near layer`).toBeGreaterThan(0.5);
      expect(depths.filter((z) => z > -12 && z < 0).length, `${kind} middle`).toBeGreaterThan(3);
      world.dispose();
    }
  });

  it("paints Jellybean Row in the six colours the drawn row has always used", () => {
    const world = createQueenScenery("row");
    const worn = new Set<string>();
    world.group.traverse((object) => {
      const mesh = object as unknown as { isMesh?: boolean; material?: { color?: { getHexString(): string } } };
      if (mesh.isMesh && mesh.material?.color) worn.add(`#${mesh.material.color.getHexString()}`);
    });
    for (const colour of JELLYBEAN_COLOURS) expect(worn.has(colour), colour).toBe(true);
    world.dispose();
  });

  it("moves on the clock and nowhere else: the same second is always the same frame", () => {
    for (const kind of KINDS) {
      const world = createQueenScenery(kind);
      const read = () => {
        const rows: string[] = [];
        world.group.traverse((object) => rows.push(`${object.position.x.toFixed(4)},${object.position.y.toFixed(4)},${object.scale.x.toFixed(4)},${object.rotation.z.toFixed(4)}`));
        return rows.join("|");
      };
      expect(world.animated, `${kind} animates`).toBe(true);
      const rest = read();
      expect(world.tick(7.5)).toBe(true);
      const at = read();
      expect(at, `${kind} moves`).not.toBe(rest);
      world.tick(21);
      world.tick(7.5);
      expect(read(), `${kind} is a pure function of the clock`).toBe(at);
      world.dispose();
    }
  });

  it("does not move at all when motion is not welcome", () => {
    for (const kind of KINDS) {
      const world = createQueenScenery(kind, { reducedMotion: true });
      const read = () => { const rows: string[] = []; world.group.traverse((o) => rows.push(`${o.position.x},${o.position.y},${o.rotation.z}`)); return rows.join("|"); };
      const rest = read();
      expect(world.animated, `${kind} is still`).toBe(false);
      expect(world.tick(12), `${kind} refuses the clock`).toBe(false);
      expect(read(), `${kind} has not moved`).toBe(rest);
      world.dispose();
    }
  });

  it("returns every geometry, material and texture on unmount", () => {
    for (const kind of KINDS) {
      const world = createQueenScenery(kind);
      const counts = world.counts();
      expect(counts.geometries, `${kind} geometries`).toBeGreaterThan(1);
      expect(counts.materials, `${kind} materials`).toBeGreaterThan(2);
      expect(counts.moving, `${kind} declares what it moves`).toBeGreaterThan(0);
      world.dispose();
      expect(world.disposed).toBe(true);
      expect(world.counts()).toMatchObject({ geometries: 0, materials: 0, textures: 0, moving: 0 });
      expect(world.group.children).toHaveLength(0);
      world.dispose();
    }
  });

  it("carries no reading: no money, no text, and nothing named like one of her reserved channels", () => {
    // Her reserved meshes are all named `queen-<channel>`; nothing in a world may
    // claim one of those names, or a lookup for a reading would find scenery.
    const reserved = /^queen-(vine|crown|face|eyes?|brow|mouth|seam|hands|feet|stone|belly|underside|shoulders|skirt|head|ear[LR]|tail|paws?|charm|bank|plinth)(-|$)/;
    for (const kind of KINDS) {
      const world = createQueenScenery(kind);
      world.group.traverse((object) => {
        expect(reserved.test(object.name), `${object.name} in ${kind}`).toBe(false);
      });
      world.dispose();
    }
  });

  it("draws the same three layers with no WebGL at all, and nothing when a scene has no world", () => {
    expect(flat(null)).toBe("");
    for (const kind of KINDS) {
      const markup = flat(kind);
      expect(markup, `${kind} renders`).toContain(`queen-flat-scene--${kind}`);
      expect(markup, `${kind} is decorative`).toContain('aria-hidden="true"');
      for (const layer of ["flat-far", "flat-near"]) expect(markup.includes(layer), `${kind} ${layer}`).toBe(true);
      // No text, no numbers a person could read as money.
      expect(markup.includes("<text")).toBe(false);
    }
    // The drawn row wears the same six colours as the sculpted one.
    const row = flat("row");
    for (const colour of JELLYBEAN_COLOURS) expect(row.includes(colour), colour).toBe(true);
  });
});
