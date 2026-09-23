// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildBankDetails } from "../src/harbour/village/bankDetails.ts";

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: () => null });
const dressing = { theme: "classic", stone: "#777", joint: "#555", moss: "#486", plinth: "#777", timber: "#765", metal: "#b98", gate: "#654", terrace: "#765", lawn: "#486", sky: "#cdf", sea: "#579", fog: "#abc", fogNear: 1, fogFar: 10, light: { sun: "#fff", hemiSky: "#fff", hemiGround: "#333", intensity: 1 } } as const;

describe("village bank details", () => {
  it("uses instanced floor inlay and detailed teller, vault, consultation and Fund surfaces", () => {
    const made = buildBankDetails(dressing, "lite");
    const dark = made.group.getObjectByName("bank-floor-inlay-dark") as THREE.InstancedMesh, light = made.group.getObjectByName("bank-floor-inlay-light") as THREE.InstancedMesh;
    expect(dark.isInstancedMesh).toBe(true); expect(light.isInstancedMesh).toBe(true); expect(dark.count + light.count).toBe(49);
    for (const name of ["bank-teal-runner", "bank-teller-grille-bar", "bank-ledger-trim", "bank-wall-clock", "bank-vault-pin", "bank-consultation-chair-back", "bank-household-fund-plaque"]) expect(made.group.getObjectByName(name)).toBeTruthy();
    made.dispose(); made.dispose(); expect(made.group.parent).toBeNull();
  });
});
