import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildRoomPlaything, type PlaythingRoom } from "../src/harbour/village/playthings.ts";

const dressing = { theme: "classic", stone: "#777", joint: "#555", moss: "#486", plinth: "#777", timber: "#765", metal: "#b98", gate: "#654", terrace: "#765", lawn: "#486", sky: "#cdf", sea: "#579", fog: "#abc", fogNear: 1, fogFar: 10, light: { sun: "#fff", hemiSky: "#fff", hemiGround: "#333", intensity: 1 } } as const;
const rooms: PlaythingRoom[] = ["kitchen", "tower", "cellar", "atlas", "bank", "library", "glasshouse", "kiln", "cottage", "boathouse"];

describe("village room playthings", () => {
  it("makes a distinct, animated tactile object for every room", () => {
    const signatures = new Set<string>();
    for (const room of rooms) {
      const made = buildRoomPlaything(room, dressing, "lite"), names: string[] = [];
      made.group.traverse(node => names.push(node.name));
      expect(made.anchors()).toHaveLength(1); expect(made.regions()[0]!.box?.isEmpty()).toBe(false); expect(made.animate(1, .016)).toBe(false);
      expect(made.interact(`${room}-plaything`)).toBeTruthy(); expect(made.animate(1, .016)).toBe(true); expect(made.animate(3, 3)).toBe(true); expect(made.animate(3.1, .016)).toBe(false);
      made.group.traverse(node => { if ((node as THREE.Mesh).isMesh) expect(node.userData.anchor).toBe(`${room}-plaything`); });
      signatures.add(names.filter(name => name.startsWith(`${room}-`)).join("/")); expect(new THREE.Box3().setFromObject(made.group).isEmpty()).toBe(false); made.dispose(); made.dispose();
    }
    expect(signatures.size).toBe(rooms.length);
  });

  it("keeps recognised mechanisms geometric instead of anonymous balls", () => {
    for (const [room, part] of [["kitchen", "kettle-body"], ["atlas", "atlas-globe"], ["library", "book-page"], ["kiln", "pottery-clay"], ["boathouse", "projector-lens"]] as const) {
      const made = buildRoomPlaything(room, dressing, "full"); expect(made.group.getObjectByName(`${room}-${part}`)).toBeTruthy(); made.dispose();
    }
  });
});
