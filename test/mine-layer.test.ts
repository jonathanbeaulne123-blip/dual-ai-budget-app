import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { assembleHousehold, catalogHousehold, splitForSync } from "../src/core/index.ts";
import { addGoal } from "../src/core/commands.ts";
import { completeTask, saveTask, type TaskInput } from "../src/core/tasks.ts";
import { ownsPrivateGoal, ownsPrivateTask } from "../src/core/pathFootpaths.ts";
import { householdForAiDisclosure } from "../src/core/visibility.ts";
import { MINE_FUND_WORDS, MINE_HOSTS, mineCamp, mineLayer, spaceForView } from "../src/harbour/mine/mineLayer.ts";
import { readPersonalToday } from "../src/harbour/desk/personalModel.ts";
import type { Household } from "../src/core/types.ts";

/** Fictional two-member household: Bianca (MEM-001) and Jonathan (MEM-002). No real data. */
const B = "MEM-001", J = "MEM-002";
const TODAY = "2026-09-15";
const draft = (patch: Partial<TaskInput["task"]> = {}): TaskInput["task"] => ({
  visibility: "personal", title: "Fictional step", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none",
  assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
});
const task = (h: Household, id: string, memberId: string, patch: Partial<TaskInput["task"]> = {}) =>
  saveTask(h, { memberId, id: `TASK-${id}`, expectedRevision: 0, task: draft(patch) }).household;

/** Both members' private rows in one in-memory snapshot — the worst case the guard must survive. */
function twoMembers(): Household {
  let h = catalogHousehold();
  h = task(h, "b-pottery", B, { title: "Fictional: sign up for pottery night", doDate: "2026-09-20" });
  h = task(h, "b-late", B, { title: "Fictional: return the library book", dueDate: "2026-09-01" });
  h = task(h, "b-undated", B, { title: "Fictional: sketch a birdhouse" });
  h = task(h, "b-done", B, { title: "Fictional: water the fern" });
  h = completeTask(h, { memberId: B, id: "TASK-b-done", expectedRevision: 1 }).household;
  h = task(h, "b-money", B, { title: "Fictional: new running shoes", expectedAmountCents: 12_000, dueDate: "2026-09-30" });
  h = task(h, "j-secret", J, { title: "PARTNER SECRET STEP" });
  h = task(h, "shared", B, { visibility: "household", title: "SHARED FERRY STEP" });
  h = addGoal(h, { name: "Fictional kayak", target: 900, shared: false, ownerMemberId: B }).household;
  h = addGoal(h, { name: "PARTNER SECRET BANK", target: 400, shared: false, ownerMemberId: J }).household;
  h = addGoal(h, { name: "SHARED ROOF BANK", target: 5000, shared: true }).household;
  return h;
}

describe("Mine layer: the owner-only read model", () => {
  it("draws only the signed-in member's private footpaths, steps and banks", () => {
    const layer = mineLayer(twoMembers(), B, TODAY);
    expect(layer.memberId).toBe(B);
    expect(layer.empty).toBe(false);
    expect(layer.footpaths.map((f) => f.id).sort()).toEqual(["TASK-b-done", "TASK-b-late", "TASK-b-money", "TASK-b-pottery", "TASK-b-undated"]);
    // Steps are the open ones, dated first (late first), undated last; the done one is a walked footpath, not a stake.
    expect(layer.steps.map((s) => s.id)).toEqual(["TASK-b-late", "TASK-b-pottery", "TASK-b-money", "TASK-b-undated"]);
    expect(layer.steps[0]).toMatchObject({ label: "Fictional: return the library book", when: "2026-09-01", late: true, money: false });
    expect(layer.steps.find((s) => s.id === "TASK-b-money")).toMatchObject({ money: true, late: false });
    expect(layer.banks.map((b) => b.label)).toEqual(["Fictional kayak"]);
    expect(layer.banks[0]!.id).toBe(`goal:${layer.banks[0]!.goalId}`);
  });

  it("NEVER includes another member's private rows, nor a household row (two-member fixture)", () => {
    const h = twoMembers();
    const mine = JSON.stringify(mineLayer(h, B, TODAY));
    for (const leak of ["PARTNER SECRET STEP", "PARTNER SECRET BANK", "TASK-j-secret", "SHARED FERRY STEP", "SHARED ROOF BANK", "TASK-shared"]) expect(mine).not.toContain(leak);
    const theirs = mineLayer(h, J, TODAY);
    expect(theirs.steps.map((s) => s.label)).toEqual(["PARTNER SECRET STEP"]);
    expect(theirs.banks.map((b) => b.label)).toEqual(["PARTNER SECRET BANK"]);
    const theirsText = JSON.stringify(theirs);
    for (const leak of ["pottery", "library book", "kayak", "SHARED FERRY STEP", "SHARED ROOF BANK"]) expect(theirsText).not.toContain(leak);
  });

  it("the partner's device never holds my private rows, so its Mine layer cannot draw them", () => {
    const h = twoMembers();
    const partner = splitForSync(h, J);
    const device = assembleHousehold(partner.shared, partner.personal);
    const layer = JSON.stringify(mineLayer(device, J, TODAY));
    expect(layer).not.toContain("pottery");
    expect(layer).not.toContain("kayak");
    expect(layer).toContain("PARTNER SECRET STEP");
  });

  it("carries no amount anywhere: labels, dates and states only", () => {
    const layer = mineLayer(twoMembers(), B, TODAY);
    const keys = new Set<string>();
    const walk = (value: unknown) => { if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { keys.add(k); walk(v); } };
    walk(layer);
    expect([...keys].filter((k) => /cents|amount|balance|target/i.test(k))).toEqual([]);
    expect(JSON.stringify(layer)).not.toMatch(/\$\s?\d|12000|120\.00|900/);
  });

  it("an unknown, blank or forged member reads an empty layer", () => {
    const h = twoMembers();
    expect(mineLayer(h, "", TODAY)).toMatchObject({ footpaths: [], steps: [], banks: [], empty: true });
    expect(mineLayer(h, "MEM-999", TODAY).empty).toBe(true);
    expect(mineLayer(catalogHousehold(), B, TODAY).empty).toBe(true);
  });

  it("re-checks a bank row by row even if a projection hands back a foreign goal", () => {
    expect(ownsPrivateGoal({ shared: false, ownerMemberId: B }, B)).toBe(true);
    expect(ownsPrivateGoal({ shared: false, ownerMemberId: J }, B)).toBe(false);
    expect(ownsPrivateGoal({ shared: true, ownerMemberId: B }, B)).toBe(false);
    expect(ownsPrivateGoal({ shared: false, ownerMemberId: null }, "")).toBe(false);
    expect(ownsPrivateTask({ deleted: false, visibility: "personal", createdBy: B }, B)).toBe(true);
    expect(ownsPrivateTask({ deleted: false, visibility: "personal", createdBy: J }, B)).toBe(false);
    expect(ownsPrivateTask({ deleted: true, visibility: "personal", createdBy: B }, B)).toBe(false);
    expect(ownsPrivateTask({ deleted: false, visibility: "household", createdBy: B }, B)).toBe(false);
    expect(ownsPrivateTask({ deleted: false, visibility: "personal", createdBy: B }, "")).toBe(false);
  });

  it("adds nothing to the household or to the model disclosure", () => {
    const h = twoMembers();
    const before = JSON.stringify(h);
    mineLayer(h, B, TODAY);
    expect(JSON.stringify(h)).toBe(before);
    const disclosed = JSON.stringify(householdForAiDisclosure(h, B, { view: "household" }));
    expect(disclosed).not.toContain("pottery night");
    expect(disclosed).not.toContain("PARTNER SECRET");
  });

  it("hosts keep their meaning, the Fund stays shared, and the camp card is the Desk's own model", () => {
    expect(MINE_HOSTS.steps.place).toBe("glasshouse");
    expect(MINE_HOSTS.banks.place).toBe("tower");
    expect(MINE_FUND_WORDS).toBe("the shared Fund");
    expect(spaceForView("personal")).toBe("mine");
    expect(spaceForView("household")).toBe("ours");
    expect(spaceForView(undefined)).toBe("ours");
    const h = twoMembers();
    expect(mineCamp(h, B, TODAY)).toEqual(readPersonalToday(h, B, TODAY));
  });
});

/** Every `captureCommand`-wrapped export in src, by name. */
function commandNames(): Set<string> {
  const names = new Set<string>();
  const root = resolve(__dirname, "../src");
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      for (const match of readFileSync(path, "utf8").matchAll(/export const (\w+)\s*=\s*captureCommand\(/g)) names.add(match[1]!);
    }
  };
  walk(root);
  return names;
}

describe("Mine layer: static fences", () => {
  const files = ["../src/harbour/mine/mineLayer.ts", "../src/harbour/mine/MineLayer.tsx", "../src/harbour/mine/MineRibbon.tsx"].map((p) => resolve(__dirname, p));
  it("imports no command, and never reaches commands.ts, capture, pathWorld writers or sync", () => {
    const commands = commandNames();
    expect(commands.has("saveTask")).toBe(true);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const imports = [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)];
      for (const [, names, from] of imports) {
        expect(from, file).not.toMatch(/core\/commands|ledgerSync|capture|core\/pathWorld|core\/sync/);
        for (const name of names!.split(",").map((n) => n.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0]!.trim()).filter(Boolean)) expect(commands.has(name), `${file} imports command ${name}`).toBe(false);
      }
      expect(source).not.toMatch(/captureCommand|localStorage|sessionStorage|fetch\(/);
      expect(dirname(file)).toMatch(/harbour\/mine$/);
    }
  });

  it("speaks the brief's vocabulary: Mine, steps, Kitty Banks, the shared Fund — never the retired words", () => {
    const retired = /Add money|Master Planner|Our plans|\bTogether\b|Hearthside|\bPlay\b|Our Path|Meet the Queen|Quick travel|Village map|Sit-down|Pay it|My private house|Personal Journey|Your own island|\bpots?\b|\bjars?\b/;
    for (const file of files) {
      const copy = [...readFileSync(file, "utf8").matchAll(/"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "").join("\n");
      expect(copy, file).not.toMatch(retired);
    }
    const layer = readFileSync(files[1]!, "utf8");
    expect(layer).toMatch(/steps/);
    expect(layer).toMatch(/Kitty Banks?/);
  });
});
