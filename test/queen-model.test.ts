// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import * as THREE from "three";
import { QUEEN_GLAZE_AXIS, queenModelStill, queenWorldStill } from "../src/queen/world/queenAuthoring.ts";
import { QUEEN_HEIGHT, createQueenSculpture } from "../src/queen/world/queenSculpture.ts";
import { HOME_BANK_MODELS, QUEEN_MODEL_SHA256, QUEEN_MODEL_URL, parseQueenModel, queenModelAnchors, queenModelLook, queenModelPart } from "../src/queen/world/queenModel.ts";
import { queenStill } from "../src/core/queenPresentation.ts";
import { defaultKittyPaint } from "../src/core/kittyStudio.ts";
import { createHomeBankModel } from "../src/queen/world/homeBankModel.ts";

const file = resolve(process.cwd(), `public${QUEEN_MODEL_URL}`);
const bytes = readFileSync(file);
/** jsdom's TextDecoder refuses Node's buffers, so the GLB header is read through Node's own decoder for this suite. */
const load = async (path = file) => {
  const b = readFileSync(path);
  const copy = new ArrayBuffer(b.byteLength);
  new Uint8Array(copy).set(b);
  return parseQueenModel(copy);
};

describe("The Mandevilla Queen — Jonathan's model, exactly as supplied (D-266)", () => {
  it("ships the supplied file byte for byte, with a transfer copy that inflates to the same bytes", () => {
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(QUEEN_MODEL_SHA256);
    const inflated = gunzipSync(readFileSync(`${file}.gz`));
    expect(createHash("sha256").update(inflated).digest("hex")).toBe(QUEEN_MODEL_SHA256);
  });

  it("parses with her named parts and measures where the readings go", async () => {
    const model = await load();
    for (const name of ["Ceramic | cat head and ears", "Ceramic | torso and meditating paws", "Pot | hand-thrown terracotta", "Pot | saucer", "Living hair | crown vines", "Living hair | left vines", "Living hair | right vines", "Bank | coin slot rim"]) {
      expect(queenModelPart(model, name), name).not.toBeNull();
    }
    const anchors = queenModelAnchors(model);
    expect(anchors.height).toBeCloseTo(1, 2);
    expect(anchors.crown.y).toBeGreaterThan(0.85);
    expect(anchors.saucer.radius).toBeGreaterThan(0.2);
    expect(anchors.pot.top).toBeGreaterThan(anchors.pot.bottom);
    // The planter flares: wider at its rim than at its foot.
    expect(anchors.pot.radiusAt(anchors.pot.top)).toBeGreaterThan(anchors.pot.radiusAt(anchors.pot.bottom));
    expect(anchors.hair.left.every((p) => p.x < 0)).toBe(true);
    expect(anchors.hair.right.every((p) => p.x > 0)).toBe(true);
    expect(anchors.hair.left).toHaveLength(5);
  });

  it("stands her at the Queen's framing height, base on the floor, and hides the drawn figure", async () => {
    const queen = createQueenSculpture();
    const model = await load();
    queen.setModel(model);
    expect(queen.modelState).toBe("model");
    queen.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    expect(box.max.y - box.min.y).toBeCloseTo(QUEEN_HEIGHT, 2);
    expect(box.min.y).toBeCloseTo(0, 3);
    for (const part of Object.values(queen.paintable)) expect(part.visible).toBe(false);
    expect(queen.reserved.face.visible).toBe(false);
    expect(queen.reserved.vine.visible).toBe(false);
    // The crown light is kept and moved onto her vine crown.
    expect(queen.reserved.crownLight.visible).toBe(true);
    expect(queen.reserved.crown.position.y).toBeGreaterThan(QUEEN_HEIGHT * 0.85);
    queen.dispose();
  });

  it("never changes how she looks, whatever the readings do", async () => {
    const queen = createQueenSculpture();
    const model = await load();
    queen.setModel(model);
    model.updateMatrixWorld(true);
    const before = queenModelLook(model);
    const paint = defaultKittyPaint();
    queen.setPaint({ ...paint, base: "midnight" });
    queen.setGlaze(QUEEN_GLAZE_AXIS.matte);
    queen.setGlaze(QUEEN_GLAZE_AXIS.glazed);
    queen.setFill(10);
    queen.setFill(0);
    queen.setCrown(true);
    queen.setSeams(3);
    queen.setVine(true, 4, 4);
    queen.setFeet(["near", "soon", "later"]);
    queen.setPose({ scale: 0.82, lean: -0.05, eyes: "open", gaze: "body", brow: "weighted", mouth: "set" });
    queen.setCharms([{ id: "c1", kind: "sitting-cat", part: "body", u: 0.5, v: 0.5, spin: 0, tilt: 0, scale: 1, color: "#b33a63" } as never]);
    queen.setForm({ rings: 3, handles: { belly: 1.1, waist: 0.9, shoulder: 1, neck: 1 } });
    queen.setMarks({ initials: ["J", "B"], date: "2026-09-15" });
    queen.setTipped(true);
    queen.setTipped(false);
    queen.setBreath(0.05);
    model.updateMatrixWorld(true);
    expect(queenModelLook(model)).toBe(before);
    // No mesh or material of hers was swapped, hidden or recoloured.
    model.traverse((node) => expect(node.visible).toBe(true));
    queen.dispose();
  });

  it("carries every reading around her", async () => {
    const queen = createQueenSculpture();
    queen.setModel(await load());
    const around = queen.aroundModel;
    // Fill: one brass coin a step, stacked beside the planter.
    queen.setFill(0);
    expect(around.coinStack.filter((coin) => coin.visible)).toHaveLength(0);
    queen.setFill(7);
    expect(around.coinStack.filter((coin) => coin.visible)).toHaveLength(7);
    expect(around.coins.visible).toBe(true);
    expect(around.coins.position.x).toBeGreaterThan(1);
    // Freshness: polished coins when glazed, dull when matte.
    queen.setGlaze(QUEEN_GLAZE_AXIS.matte);
    const dull = around.coinMaterial.roughness;
    queen.setGlaze(QUEEN_GLAZE_AXIS.glazed);
    expect(around.coinMaterial.roughness).toBeLessThan(dull);
    // Crown: lit only when both are present.
    queen.setCrown(true);
    expect(around.crownLight.intensity).toBeGreaterThan(0);
    queen.setCrown(false);
    expect(around.crownLight.intensity).toBe(0);
    // Seams: kintsugi on the planter, one per mend, up to three.
    queen.setSeams(2);
    expect(around.seams.filter((seam) => seam.visible)).toHaveLength(2);
    // The drawn seams stay hidden under the model.
    expect(queen.reserved.seams.every((seam) => !seam.visible)).toBe(true);
    // The Chapter: young leaves per act, buds per goal in motion.
    queen.setVine(true, 2, 3);
    expect(around.leaves.filter((leaf) => leaf.visible)).toHaveLength(3);
    expect(around.buds.filter((bud) => bud.visible)).toHaveLength(3);
    queen.setVine(false, 0, 0);
    expect(around.leaves.filter((leaf) => leaf.visible)).toHaveLength(0);
    expect(around.buds.filter((bud) => bud.visible)).toHaveLength(0);
    // Stones at her feet stand outside her saucer.
    queen.setFeet(["near"]);
    expect(queen.reserved.stones[0]!.visible).toBe(true);
    // Charms are not drawn on her: the 3D pick yields to the flat pick.
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 10), new THREE.Vector3(0, 0, -1));
    expect(queen.pick(ray)).toBeNull();
    // Charms are kept, not drawn on her; the drawn figure wears them again.
    queen.setCharms([{ id: "c1", kind: "sitting-cat", part: "body", u: 0.5, v: 0.5, spin: 0, tilt: 0, scale: 1, color: "#b33a63" } as never]);
    expect(queen.charmCounts().instances).toBe(0);
    queen.setModel(null);
    expect(queen.charmCounts().instances).toBe(1);
    queen.dispose();
  });

  it("shows nothing of the drawn figure while the model is on its way, and draws her again if it never arrives", () => {
    const queen = createQueenSculpture();
    queen.setAwaitingModel(true);
    expect(queen.modelState).toBe("awaiting");
    expect(queen.paintable.head.visible).toBe(false);
    queen.setSeams(2);
    expect(queen.reserved.seams.every((seam) => !seam.visible)).toBe(true);
    queen.setAwaitingModel(false);
    expect(queen.modelState).toBe("drawn");
    expect(queen.paintable.head.visible).toBe(true);
    expect(queen.reserved.seams.filter((seam) => seam.visible)).toHaveLength(2);
    queen.dispose();
  });

  it("releases the model with her, and can hand back to the drawn figure", async () => {
    const queen = createQueenSculpture();
    const model = await load();
    queen.setModel(model);
    expect(queen.counts().geometries).toBeGreaterThan(36);
    queen.setModel(null);
    expect(queen.modelState).toBe("drawn");
    expect(queen.paintable.head.visible).toBe(true);
    queen.setModel(await load());
    queen.dispose();
    expect(queen.counts().geometries).toBe(0);
    expect(queen.counts().textures).toBe(0);
  });

  it("describes only what the sculpted figure shows", () => {
    const still = queenStill({ state: "needs-us", destination: "fund" }, "current");
    const words = queenModelStill(still);
    expect(words).toMatch(/Mandevilla Queen/);
    expect(words).toMatch(/eyes closed as sculpted/);
    expect(words).toMatch(/coins beside her polished/);
    const world = (text: string) => text.slice(text.indexOf("In the world:"));
    expect(world(words)).not.toMatch(/eyes open/);
    expect(world(queenWorldStill(still))).toMatch(/eyes open/);
    expect(queenModelStill(queenStill({ state: "checking", destination: "status" }, "stale"))).toMatch(/coins beside her dull/);
  });
});

describe("Protect and Build — Jonathan's Guardian and Mastermind (D-267)", () => {
  const bankFile = (id: keyof typeof HOME_BANK_MODELS) => resolve(process.cwd(), `public${HOME_BANK_MODELS[id].url}`);

  it("ships both files byte for byte, with transfer copies that inflate to the same bytes", () => {
    for (const id of ["protect", "build"] as const) {
      const bytes = readFileSync(bankFile(id));
      expect(createHash("sha256").update(bytes).digest("hex"), id).toBe(HOME_BANK_MODELS[id].sha256);
      expect(createHash("sha256").update(gunzipSync(readFileSync(`${bankFile(id)}.gz`))).digest("hex"), id).toBe(HOME_BANK_MODELS[id].sha256);
    }
    expect(HOME_BANK_MODELS.protect.name).toBe("Mandevilla Guardian");
    expect(HOME_BANK_MODELS.build.name).toBe("Mandevilla Mastermind");
  });

  it("stands each as a bank that grows with its fill and never changes how it looks", async () => {
    for (const [id, part] of [["protect", "Heraldic shield"], ["build", "Queen chess piece"]] as const) {
      const template = await load(bankFile(id));
      expect(queenModelPart(template, part), part).not.toBeNull();
      template.updateMatrixWorld(true);
      const templateLook = queenModelLook(template);
      const bank = createHomeBankModel(template, HOME_BANK_MODELS[id].name);
      bank.group.updateMatrixWorld(true);
      const before = queenModelLook(bank.model);
      const box = () => { bank.group.updateMatrixWorld(true); return new THREE.Box3().setFromObject(bank.group); };
      expect(box().min.y).toBeCloseTo(0, 3);
      const empty = box().max.y;
      bank.setFill(10);
      expect(box().max.y).toBeGreaterThan(empty * 1.5);
      expect(box().min.y).toBeCloseTo(0, 3);
      bank.setFill(0);
      expect(queenModelLook(bank.model)).toBe(before);
      // A bank is a clone: disposing it leaves the shared template whole.
      bank.dispose();
      expect(bank.group.children).toHaveLength(0);
      expect(queenModelLook(template)).toBe(templateLook);
    }
  });
});
