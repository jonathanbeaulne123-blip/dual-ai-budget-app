import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildRoomDressing, type RoomDressingRoom } from "../src/harbour/village/roomDressing.ts";

const dressing = { theme: "classic", stone: "#777", joint: "#555", moss: "#486", plinth: "#777", timber: "#765", metal: "#b98", gate: "#654", terrace: "#765", lawn: "#486", sky: "#cdf", sea: "#579", fog: "#abc", fogNear: 1, fogFar: 10, light: { sun: "#fff", hemiSky: "#fff", hemiGround: "#333", intensity: 1 } } as const;
const rooms: RoomDressingRoom[] = ["kitchen", "tower", "cellar", "atlas", "bank", "library", "glasshouse", "kiln", "cottage", "boathouse"];

describe("village room dressing", () => {
  it("keeps a compact authored side arrangement for every room", () => {
    for (const room of rooms) { const made = buildRoomDressing(room, dressing, "lite"); expect(new THREE.Box3().setFromObject(made.group).isEmpty()).toBe(false); expect(made.group.getObjectByName(`${room}-side-table`)).toBeTruthy(); made.dispose(); made.dispose(); }
  });
  it("rearranges real furniture, replaces live plant geometry and changes its light", () => {
    const made = buildRoomDressing("kitchen", dressing, "full"), chair = made.group.getObjectByName("kitchen-chair-a-group")!, table = made.group.getObjectByName("kitchen-side-table-group")!, lamp = made.group.getObjectByName("kitchen-dressing-lamp") as THREE.PointLight;
    const gather = chair.position.clone(), tableGather = table.position.clone(); made.apply({ layout: "open", plant: "flowers", light: "daylight", displays: [{ kind: "memory", id: "unread", revision: 4 }] });
    expect(chair.position.distanceTo(gather)).toBeGreaterThanOrEqual(.5); expect(table.position.distanceTo(tableGather)).toBeGreaterThanOrEqual(.5); expect(chair.getObjectByName("kitchen-chair-a-leg")).toBeTruthy(); expect(chair.getObjectByName("kitchen-chair-a-back")).toBeTruthy(); expect(made.group.getObjectByName("kitchen-table-lamp-shade")).toBeTruthy(); expect(made.group.getObjectByName("kitchen-flower-bloom-0")).toBeTruthy(); expect(made.group.getObjectByName("kitchen-fern-frond-0")).toBeFalsy(); expect(lamp.color.getHexString()).toBe(new THREE.Color("#d8ecff").getHexString());
    made.apply({ layout: "gather", plant: "fern", light: "warm" }); expect(made.group.getObjectByName("kitchen-fern-frond-0")).toBeTruthy(); expect(made.group.getObjectByName("kitchen-frame")).toBeFalsy(); made.dispose();
  });
});
