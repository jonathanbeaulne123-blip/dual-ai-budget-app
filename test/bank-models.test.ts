// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import * as THREE from "three";
import { PAY_BANK_MODELS, UMBRELLA_BANK_MODELS, bankModelFor, payBankFor, umbrellaBankKey, type BankModelKey } from "../src/queen/world/bankModels.ts";
import { parseQueenModel, queenModelLook } from "../src/queen/world/queenModel.ts";
import { SPENDING_UMBRELLAS, UMBRELLAS } from "../src/core/fundRules.ts";
import { cellarJars } from "../src/core/queenCellar.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { cellarIncomeJars } from "../src/core/cellarIncomeJars.ts";
import { contributionGlaze } from "../src/queen/QueenCellarExtras.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { addRecurrence } from "../src/core/commands.ts";
import { ALEX, TODAY, fundBill, fundedHousehold, migrated } from "./fixtures/fund-model.ts";
import type { Household, Shift } from "../src/core/types.ts";

const ALL = [...Object.values(UMBRELLA_BANK_MODELS), ...Object.values(PAY_BANK_MODELS)];
const fileOf = (url: string) => resolve(process.cwd(), `public${url}`);
const bytesOf = (url: string) => {
  const b = readFileSync(fileOf(url));
  const copy = new ArrayBuffer(b.byteLength);
  new Uint8Array(copy).set(b);
  return copy;
};

describe("The Queen's household — Jonathan's fourteen models, exactly as supplied", () => {
  it("ships every file byte for byte, with a transfer copy that inflates to the same bytes", () => {
    for (const model of ALL) {
      const bytes = readFileSync(fileOf(model.url));
      expect(bytes.byteLength, model.name).toBe(model.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), model.name).toBe(model.sha256);
      expect(createHash("sha256").update(gunzipSync(readFileSync(`${fileOf(model.url)}.gz`))).digest("hex"), `${model.name}.gz`).toBe(model.sha256);
    }
  });

  it("keeps the umbrella banks under 0.8 MB and the higher-resolution pay pair under 1.5 MB", () => {
    for (const model of Object.values(UMBRELLA_BANK_MODELS)) expect(model.bytes, model.name).toBeLessThanOrEqual(800_000);
    for (const model of Object.values(PAY_BANK_MODELS)) expect(model.bytes, model.name).toBeLessThanOrEqual(1_500_000);
  });

  it("gives every spending umbrella its own bank, and the two that aren't spending none", () => {
    expect(Object.keys(UMBRELLA_BANK_MODELS).sort()).toEqual(SPENDING_UMBRELLAS.map((row) => row.id).sort());
    expect(new Set(Object.values(UMBRELLA_BANK_MODELS).map((row) => row.url)).size).toBe(12);
    for (const umbrella of UMBRELLAS) {
      const key = umbrellaBankKey(umbrella.id);
      if (umbrella.spending) expect(bankModelFor(key!)?.role, umbrella.id).toBe(umbrella.name);
      else expect(key, umbrella.id).toBeNull();
    }
    expect(umbrellaBankKey(null)).toBeNull();
    expect(bankModelFor("pay:clink")?.name).toBe("Clink");
    expect(bankModelFor("pay:nobody" as BankModelKey)).toBeNull();
  });

  it("parses each one standing on the floor, one unit tall, with nothing required of the loader", async () => {
    for (const model of ALL) {
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(readFileSync(fileOf(model.url))).slice(20, 20 + new DataView(bytesOf(model.url)).getUint32(12, true))));
      expect(json.extensionsRequired ?? [], model.name).toEqual([]);
      const root = await parseQueenModel(bytesOf(model.url));
      const box = new THREE.Box3().setFromObject(root);
      expect(box.max.y - box.min.y, model.name).toBeCloseTo(1, 2);
      expect(box.min.y, model.name).toBeCloseTo(0, 2);
    }
  });

  it("stands Clink for shifts and tips, and Poise for a salary", () => {
    expect(payBankFor("shifts")).toBe("clink");
    expect(payBankFor("salary")).toBe("poise");
  });
});

describe("the cellar names each bill's umbrella once sorted, and nothing before", () => {
  it("carries the umbrella id on the same terms as its hue", () => {
    let h = fundedHousehold("2000");
    h = fundBill(h, { note: "Fictional hydro", amount: "300", subcategoryId: "SUB-HOUSING-ELECTRIC", day: 28 }).household;
    const before = cellarJars(projectKittyNest(h, ALEX, "household", TODAY), h, TODAY);
    expect(before.every((jar) => jar.umbrellaId === null)).toBe(true);
    const sorted = migrated(h);
    const hydro = cellarJars(projectKittyNest(sorted, ALEX, "household", TODAY), sorted, TODAY).find((jar) => jar.label.includes("hydro"))!;
    expect(hydro.umbrellaId).toBe("utilities");
    expect(bankModelFor(umbrellaBankKey(hydro.umbrellaId)!)?.name).toBe("Wick");
  });
});

describe("how a partner is paid decides their pay bank, from shared facts only", () => {
  const SAM = "MEM-002";
  const shift = (visibility: Shift["visibility"]): Shift => ({
    id: `SHIFT-${visibility}`, date: "2026-09-09", memberId: SAM, accountId: "ACC-CHEQUING", salesCents: 0, cashTipsCents: 0, ccTipsCents: 0, hours: 6,
    floorTipOutCents: 0, barTipOutCents: 0, ccTipOutCents: 0, netTipsCents: 8000, wagesCents: 12000,
    settings: { floorPct: 0, barPct: 0, barRoundCents: 0, ccPct: 0, hourlyRateCents: 0 }, settingsFingerprint: "fiction",
    wagesTransactionId: "", tipsTransactionId: "", createdBy: SAM, visibility, createdAt: "2026-09-09T22:00:00.000Z", updatedAt: "2026-09-09T22:00:00.000Z",
  });
  const books = (edit: (h: Household) => Household) => {
    let h = planLifeFixture("household");
    h = { ...h, members: h.members.map((row) => row.id === SAM ? { ...row, earningCadence: undefined } : row) };
    // A shared pay date for Sam so a jar exists either way.
    h = { ...h, members: h.members.map((row) => row.id === SAM ? { ...row, earningCadence: { cadence: "biweekly" as const, anchorDate: "2026-09-11", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" } } : row) };
    return edit(h);
  };
  const styleOf = (h: Household, viewer: string) => cellarIncomeJars(h, { today: "2026-09-16", memberId: viewer }).jars.find((jar) => jar.memberId === SAM)?.payStyle;

  it("reads a Work pay schedule as shifts, the same on both phones", () => {
    const h = books((x) => x);
    expect(styleOf(h, ALEX)).toBe("shifts");
    expect(styleOf(h, SAM)).toBe("shifts");
  });

  it("reads a salary when there's no Work schedule and no shared shift, even if a private shift exists", () => {
    const h = books((x) => {
      const income = x.categories.find((row) => row.recordType === "category" && row.transactionType === "income")!.id;
      const salaried = addRecurrence(x, { cadence: "biweekly", nextDate: "2026-09-25", type: "income", amount: "1900", accountId: "ACC-CHEQUING", subcategoryId: income, note: "Fictional salary", splits: [{ party: SAM, amountCents: 190000 }] }).household;
      return { ...salaried, members: salaried.members.map((row) => row.id === SAM ? { ...row, earningCadence: undefined } : row), shifts: [...salaried.shifts.filter((row) => row.memberId !== SAM), shift("personal")] };
    });
    const sam = cellarIncomeJars(h, { today: "2026-09-16", memberId: ALEX }).jars.filter((jar) => jar.memberId === SAM);
    expect(sam.length).toBeGreaterThan(0);
    expect(sam.every((jar) => jar.payStyle === "salary")).toBe(true);
    // A shift Sam shared turns it to Clink, on either phone.
    const shared = { ...h, shifts: [...h.shifts, shift("household")] };
    expect(styleOf(shared, ALEX)).toBe("shifts");
  });
});

describe("a contribution bank glazes as contributions arrive", () => {
  it("is bisque with nothing in, part-glazed against the pay it imagined, and whole once it's met", () => {
    expect(contributionGlaze({ contributedCents: 0, payCents: 40000 })).toBe(0);
    expect(contributionGlaze({ contributedCents: 10000, payCents: 40000 })).toBe(0.25);
    expect(contributionGlaze({ contributedCents: 50000, payCents: 40000 })).toBe(1);
    // An unshared or hidden pay has no measure: anything in glazes it whole.
    expect(contributionGlaze({ contributedCents: 1, payCents: 0 })).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The room itself, with WebGL stubbed: jsdom has no GPU, and nothing here is about pixels.
vi.mock("three", async (original) => {
  const real = await original<typeof import("three")>();
  class StubRenderer {
    domElement = document.createElement("canvas");
    localClippingEnabled = false;
    outputColorSpace = ""; toneMapping = 0; toneMappingExposure = 1;
    setPixelRatio() {} setSize() {} render() {} dispose() {} forceContextLoss() {}
  }
  class StubPmrem { fromScene(): never { throw new Error("no GPU"); } dispose() {} }
  return { ...real, WebGLRenderer: StubRenderer, PMREMGenerator: StubPmrem };
});

describe("the cellar room stands the models without changing how they look", () => {
  // jsdom has no 2D canvas either; the room already copes with a null context.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  const load = async () => {
    const { createQueenRoomWorld } = await import("../src/queen/world/queenRoomWorld.ts");
    return createQueenRoomWorld;
  };
  const host = () => { const el = document.createElement("div"); Object.defineProperties(el, { clientWidth: { value: 400 }, clientHeight: { value: 300 } }); return el; };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const modelsIn = (scene: THREE.Object3D) => scene.children.flatMap((c) => c.children).filter((c) => c.name.startsWith("queen-room-model-"));
  const drawnIn = (scene: THREE.Object3D) => scene.children.flatMap((c) => c.children).filter((c) => c.name.startsWith("queen-room-vessel-") && c.name !== "queen-room-vessels");

  it("draws nothing while a model loads, then the model; the template's look never changes", async () => {
    const createQueenRoomWorld = await load();
    const template = await parseQueenModel(bytesOf(UMBRELLA_BANK_MODELS.utilities.url));
    const look = queenModelLook(template);
    let arrive: (value: THREE.Object3D) => void = () => {};
    const world = createQueenRoomWorld(host(), { room: "cellar", loadModel: () => new Promise((r) => { arrive = r; }) });
    expect(world.renderer.localClippingEnabled).toBe(true);
    world.setVessels([{ id: "cellar:hydro", kind: "bill", fill: 0.5, model: { key: "umbrella:utilities" } }]);
    expect(modelsIn(world.scene)).toHaveLength(0);
    expect(drawnIn(world.scene)).toHaveLength(0);
    arrive(template);
    await flush();
    expect(modelsIn(world.scene)).toHaveLength(1);
    expect(world.stats().models).toBe(1);
    world.layout({ host: { x: 0, y: 0, w: 400, h: 300 }, seats: { "cellar:hydro": { x: 180, y: 100, w: 40, h: 60 } } });
    // Paid in full: every surface is its own glazed self, and the bisque copy is gone.
    world.setVessels([{ id: "cellar:hydro", kind: "bill", fill: 1, model: { key: "umbrella:utilities" } }]);
    const seat = modelsIn(world.scene)[0]!;
    const [glazed, bisque] = (seat.children[0] as THREE.Group).children;
    expect(glazed!.visible).toBe(true);
    expect(bisque!.visible).toBe(false);
    // Glazed meshes wear copies of the model's own materials, so its colours and finishes stand unchanged.
    const own = new Map<string, THREE.Material>();
    template.traverse((n) => { if (n instanceof THREE.Mesh) own.set(n.name, n.material as THREE.Material); });
    glazed!.traverse((n) => {
      if (!(n instanceof THREE.Mesh)) return;
      const m = n.material as THREE.MeshPhysicalMaterial, o = own.get(n.name) as THREE.MeshPhysicalMaterial;
      expect(m).not.toBe(o);
      expect(m.color.getHex()).toBe(o.color.getHex());
      expect(m.roughness).toBe(o.roughness);
      expect(m.clippingPlanes).toHaveLength(1);
    });
    world.dispose();
    expect(queenModelLook(template)).toBe(look);
  });

  it("stands unpaid bisque, glass for pay not yet in, and the drawn jar when a model can't load", async () => {
    const createQueenRoomWorld = await load();
    const template = await parseQueenModel(bytesOf(UMBRELLA_BANK_MODELS.food.url));
    const world = createQueenRoomWorld(host(), { room: "cellar", loadModel: (key) => key === "umbrella:food" ? Promise.resolve(template) : Promise.reject(new Error("offline")) });
    world.setVessels([
      { id: "a", kind: "bill", fill: 0, model: { key: "umbrella:food" } },
      { id: "b", kind: "goal", fill: 0, model: { key: "umbrella:food", glass: true } },
      { id: "c", kind: "bill", fill: 0.3, model: { key: "umbrella:home" } },
    ]);
    await flush(); await flush();
    const models = modelsIn(world.scene);
    expect(models.map((m) => m.name).sort()).toEqual(["queen-room-model-a", "queen-room-model-b"]);
    const parts = (name: string) => (models.find((m) => m.name === name)!.children[0] as THREE.Group).children;
    expect(parts("queen-room-model-a")[0]!.visible).toBe(false);
    expect(parts("queen-room-model-a")[1]!.visible).toBe(true);
    const glass = parts("queen-room-model-b");
    expect(glass[0]!.visible).toBe(false);
    glass[1]!.traverse((n) => { if (n instanceof THREE.Mesh) expect((n.material as THREE.Material).transparent).toBe(true); });
    // Home never arrived: the drawn jar stands in its place.
    expect(drawnIn(world.scene).map((g) => g.name)).toContain("queen-room-vessel-c");
    world.setVessels([]);
    expect(modelsIn(world.scene)).toHaveLength(0);
    world.dispose();
  });
});
