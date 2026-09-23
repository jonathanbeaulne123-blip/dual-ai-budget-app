import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("village court paving", () => {
  it("batches every tagged lane paver into one walking-ground instanced mesh", () => {
    const source = readFileSync(new URL("../src/harbour/village/VillageCourt.ts", import.meta.url), "utf8");
    expect(source).toContain("new THREE.InstancedMesh(paverGeometry,stone,pavers.length)"); expect(source).toContain("lanes.userData.ground=true"); expect(source).toContain("lanes.name='village-lanes'");
    expect(source).not.toContain("`${kind}-lane-${n}`");
  });
});
