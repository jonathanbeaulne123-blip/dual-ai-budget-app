import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildBankHall, buildHomeFittings, buildVillageBuilding, VILLAGE_FOOTPRINTS, type VillageBuildingKind } from "../src/harbour/village/architecture.ts";

const dressing = { theme: "classic", stone: "#777", joint: "#555", moss: "#486", plinth: "#777", timber: "#765", metal: "#b98", gate: "#654", terrace: "#765", lawn: "#486", sky: "#cdf", sea: "#579", fog: "#abc", fogNear: 1, fogFar: 10, light: { sun: "#fff", hemiSky: "#fff", hemiGround: "#333", intensity: 1 } } as const;
const kinds: VillageBuildingKind[] = ["home", "bank", "library", "glasshouse", "studio", "cottage", "boathouse"];
const box = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);

describe("authored village architecture", () => {
  it("keeps seven room-scale, distinct local footprints and removable cutaways", () => {
    const signatures = new Set<string>();
    for (const kind of kinds) {
      const made = buildVillageBuilding(kind, dressing, "full"), bounds = box(made.group), [hx, hz] = VILLAGE_FOOTPRINTS[kind];
      expect(bounds.min.x).toBeLessThanOrEqual(-hx); expect(bounds.max.x).toBeGreaterThanOrEqual(hx); expect(bounds.min.z).toBeLessThanOrEqual(-hz);
      expect(made.roof.parent).toBe(made.group); expect(made.front.parent).toBe(made.group); expect(made.roof).not.toBe(made.front);
      signatures.add(`${Math.round(bounds.max.y * 10)}:${made.group.children.map(x => x.name).join("/")}`); made.dispose(); made.dispose(); expect(made.group.parent).toBeNull();
    }
    expect(signatures.size).toBe(kinds.length);
  });

  it("builds genuine framed door openings instead of a front-wall box with a sign", () => {
    const home = buildVillageBuilding("home", dressing, "lite");
    const names: string[] = []; home.front.traverse(node => names.push(node.name));
    expect(names).toContain("home-front-wall-left"); expect(names).toContain("home-front-wall-right"); expect(names).toContain("home-door");
    expect(names).not.toContain("home-front-wall"); home.dispose();
  });

  it("keeps full and lite building budgets bounded while retaining complete shells", () => {
    const count = (o: THREE.Object3D) => { let n = 0; o.traverse(x => { if ((x as THREE.Mesh).isMesh) n++; }); return n; };
    const full = buildVillageBuilding("bank", dressing, "full"), lite = buildVillageBuilding("bank", dressing, "lite");
    // Village buildings are copied seven times into a Court: cap the individual shell.
    expect(count(full.group)).toBeGreaterThan(12); expect(count(full.group)).toBeLessThanOrEqual(72);
    expect(count(lite.group)).toBeGreaterThan(12); expect(count(lite.group)).toBeLessThanOrEqual(count(full.group)); full.dispose(); lite.dispose();
  });

  it("gives the bank its Queen and books doors, regions, and an owned hall root", () => {
    const hall = buildBankHall(dressing, "lite"), byId = Object.fromEntries(hall.anchors().map(a => [a.id, a]));
    expect(hall.group.name).toBe("bank-hall"); expect(byId.queen?.door?.target).toBe("queen"); expect(byId.books?.door?.target).toBe("books"); expect(byId.vault?.door?.target).toBe("books");
    expect(hall.regions()).toHaveLength(4); hall.dispose(); hall.dispose();
  });

  it("fits every home extension in its room and leaves a named books route", () => {
    for (const room of ["kitchen", "tower", "cellar", "atlas"] as const) {
      const art = buildHomeFittings(room, dressing, "lite"); expect(art.anchors()).toHaveLength(1); expect(art.anchors()[0]!.door?.target).toBe("books"); expect(box(art.group).isEmpty()).toBe(false); art.dispose();
    }
  });
});
