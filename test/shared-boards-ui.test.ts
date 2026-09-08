// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold, saveBoardTask, saveBoardMilestone, type Household, type CommitResult } from "../src/core/index.ts";
import { forecastReceiptHousehold } from "./fixtures/forecast-receipts.ts";
import type { ScenarioSourceContext } from "../src/scenarioSourceContext.ts";
import { SharedBoards, requestSharedBoard, SHARED_BOARD_EVENT, type SharedBoardsProps } from "../src/widgets/SharedBoards.tsx";
vi.mock("../src/widgets/BoardPhotos.tsx", () => ({ BoardPhotos: () => h("p", null, "Photo spaces") }));
let host: HTMLDivElement; let root: Root; let household: Household;
let commands: ((current: Household) => CommitResult)[];
const today = "2026-09-08"; const memberId = "MEM-002";
function props(): SharedBoardsProps { return { household, memberId, today, busy: false, onCommand: fn => { commands.push(fn); }, onOpenGoals: vi.fn() }; }
async function render(next: Partial<SharedBoardsProps> = {}) { await act(async () => root.render(h(SharedBoards, { ...props(), ...next }))); }
function button(name: string) { const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(row => row.getAttribute("aria-label") === name || row.textContent === name); if (!found) throw new Error(`Missing ${name}`); return found; }
async function click(name: string) { await act(async () => button(name).click()); }
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
}
function selected() { return host.querySelector<HTMLButtonElement>('.shared-boards-selectors [aria-selected=true]')!.textContent; }
function pointer(target: Element, type: string, x: number, y: number, extra = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, pointerType: "touch", button: 0, isPrimary: true, ...extra }); target.dispatchEvent(event); return event;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }) as never);
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  sessionStorage.clear(); commands = [];
  household = seedDemoHousehold({ environment: "development", today });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("shared household boards", () => {
  it("loops both directions and retains every permitted page and typed draft across hides/themes", async () => {
    await render(); expect(host.querySelectorAll('.shared-board-page')).toHaveLength(5);
    const note = host.querySelector<HTMLTextAreaElement>('.chalk-compose--live textarea')!; await type(note, "Keep my unfinished note");
    await click("Previous board"); expect(selected()).toBe("Shift Ask");
    await click("Next board"); expect(selected()).toBe("Notes");
    await click("To-do"); await click("Add to-do");
    const title = host.querySelector<HTMLInputElement>('[aria-label="to-do title"]')!; await type(title, "Buy stamps");
    for (const theme of ["taylor", "newfoundland", "classic"]) { document.documentElement.dataset.theme = theme; await render(); await click("Goals"); await click("To-do"); }
    expect(host.querySelector('[aria-label="to-do title"]')).toBe(title); expect(title.value).toBe("Buy stamps");
    await click("Notes"); expect(host.querySelector('.chalk-compose--live textarea')).toBe(note); expect(note.value).toBe("Keep my unfinished note");
    expect(host.querySelectorAll('.shared-board-page:not([hidden])')).toHaveLength(1);
  });
  it("persists an unmounted request and isolates event/storage scope", async () => {
    const scope = { environment: household.environment, householdId: household.householdId, memberId };
    const received = vi.fn(); window.addEventListener(SHARED_BOARD_EVENT, received);
    requestSharedBoard(scope, "ask");
    const openKey = `hearth:shared-board-open:${scope.environment}:${scope.householdId}:${scope.memberId}`;
    expect(sessionStorage.getItem(openKey)).toBe("ask"); sessionStorage.removeItem(openKey);
    await render(); expect(selected()).toBe("Shift Ask"); expect(received).toHaveBeenCalledOnce();
    await act(async () => requestSharedBoard({ ...scope, householdId: "HH-OTHER" }, "photos")); expect(selected()).toBe("Shift Ask");
    await act(async () => requestSharedBoard(scope, "tasks")); expect(selected()).toBe("To-do");
    household = { ...household, householdId: "HH-OTHER" }; await render(); expect(selected()).toBe("Photos");
    window.removeEventListener(SHARED_BOARD_EVENT, received);
  });
  it("keeps five tabs for both roles without rendering another member’s Ask, and withholds boards from inactive/unknown viewers", async () => {
    await render({ memberId: "MEM-001" }); expect(host.querySelectorAll('[role=tab]')).toHaveLength(5);
    await click("Shift Ask"); expect(host.textContent).toContain("There isn’t a Shift Ask for your household role"); expect(host.querySelector('.ask')).toBeNull();
    await render(); expect(host.querySelectorAll('[role=tab]')).toHaveLength(5); expect(host.querySelector('.ask')).not.toBeNull();
    await render({ memberId: "unknown" }); expect(host.querySelector('.shared-boards')).toBeNull();
    household = { ...household, members: household.members.map(row => ({ ...row, active: false })) }; await render(); expect(host.querySelector('canvas')).toBeNull();
  });
  it("observes frame swipes while leaving drawing, inputs, sliders, links and vertical gestures native", async () => {
    await render(); const frame = host.querySelector('.shared-boards-pages')!;
    await act(async () => { expect(pointer(frame, "pointerdown", 160, 40).defaultPrevented).toBe(false); pointer(frame, "pointerup", 40, 45); }); expect(selected()).toBe("Photos");
    await act(async () => { pointer(frame, "pointerdown", 40, 40); pointer(frame, "pointerup", 160, 45); }); expect(selected()).toBe("Notes");
    for (const tag of ["input", "textarea", "select", "button", "canvas", "a", "div"]) {
      const target = document.createElement(tag); if (tag === "div") target.setAttribute("role", "slider"); frame.append(target);
      await act(async () => { pointer(target, "pointerdown", 160, 40); expect(pointer(target, "pointerup", 20, 40).defaultPrevented).toBe(false); }); expect(selected()).toBe("Notes"); target.remove();
    }
    await act(async () => { pointer(frame, "pointerdown", 160, 40); pointer(frame, "pointerup", 20, 240); }); expect(selected()).toBe("Notes");
  });
  it("supports keyboard tabs and native touch without a duplicate pointer swipe", async () => {
    await render(); const notes = host.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')!;
    await act(async () => { notes.focus(); notes.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); });
    expect(selected()).toBe("Shift Ask"); expect(document.activeElement?.getAttribute("role")).toBe("tab");
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }))); expect(selected()).toBe("Notes");
    const frame = host.querySelector('.shared-boards-pages')!;
    const touch = (type: string, x: number, ending = false) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const point = { identifier: 3, clientX: x, clientY: 30 };
      Object.assign(event, { touches: ending ? [] : [point], changedTouches: [point] }); frame.dispatchEvent(event); return event;
    };
    await act(async () => {
      pointer(frame, "pointerdown", 200, 30); expect(touch("touchstart", 200).defaultPrevented).toBe(false);
      pointer(frame, "pointerup", 30, 30); expect(touch("touchend", 30, true).defaultPrevented).toBe(false);
    });
    expect(selected()).toBe("Photos");
  });
  it("keeps an unacknowledged typed note until its accepted household note arrives", async () => {
    await render(); const note = host.querySelector<HTMLTextAreaElement>('.chalk-compose--live textarea')!; await type(note, "Milk tomorrow"); await click("Save note");
    expect(commands).toHaveLength(1); await render(); expect(note.value).toBe("Milk tomorrow");
    household = commands[0]!(household).household; await render(); expect(note.value).toBe("");
  });
  it("forwards Notes receipt options through SharedBoards and preserves pending drafts across themes/pages", async () => {
    let reject: ((rejection?: { retryable: boolean }) => void) | undefined;
    const onCommand: SharedBoardsProps['onCommand'] = (fn, options) => { commands.push(fn); reject = options?.onDefinitiveRejected; return Promise.resolve(null); };
    await render({ onCommand }); const note = host.querySelector<HTMLTextAreaElement>('.chalk-compose--live textarea')!;
    await type(note, 'Keep this intent'); await click('Save note'); expect(button('Save note').disabled).toBe(true);
    for (const theme of ['classic', 'taylor', 'newfoundland']) {
      await click('Goals'); document.documentElement.dataset.theme = theme; await render({ onCommand }); await click('Notes');
      expect(button('Save note').disabled).toBe(true); expect(note.value).toBe('Keep this intent');
    }
    await act(async () => reject?.({ retryable: true })); await click('Retry note'); expect(commands).toHaveLength(2);
    household = commands[1]!(household).household; await render({ onCommand }); expect(note.value).toBe('');
  });
  it("freezes edit versions, retains collision drafts, and rejects callbacks from a retired A-B-A room", async () => {
    household = saveBoardTask(household, { memberId, id: "BOARD-TASK-test", title: "First", assigneeId: null, dueDate: null, completed: false, expectedVersion: 0 }).household;
    await render(); await click("To-do"); await click("Edit First"); const input = host.querySelector<HTMLInputElement>('[aria-label="to-do title"]')!; await type(input, "My draft"); await click("Save to-do");
    const delayed = commands[0]!;
    household = saveBoardTask(household, { memberId, id: "BOARD-TASK-test", title: "Partner change", assigneeId: null, dueDate: null, completed: false, expectedVersion: 1 }).household;
    expect(() => delayed(household)).toThrow(); await render(); expect(input.value).toBe("My draft"); expect(button("Save to-do").disabled).toBe(true);
    const a = household; household = { ...household, householdId: "HH-OTHER" }; await render(); household = a; await render(); expect(() => delayed(a)).toThrow(/no longer open/);
  });
  it("completes and collapses milestones without changing accepted savings", async () => {
    household = saveBoardMilestone(household, { memberId, id: "BOARD-MILESTONE-test", title: "A weekend away", dueDate: "2026-10-01", completed: false, expectedVersion: 0 }).household;
    const savings = structuredClone(household.goals); await render(); await click("Goals"); await click("Complete A weekend away"); household = commands[0]!(household).household; await render();
    expect(household.goals).toEqual(savings); expect(button("Completed (1) +").getAttribute("aria-expanded")).toBe("false"); await click("Completed (1) +"); expect(button("Reopen A weekend away")).toBeDefined();
  });
  it("retains the existing phone Reach controls and drafts with the accepted viewer source", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    household = forecastReceiptHousehold();
    const source: ScenarioSourceContext = { household, isCurrent: () => true, accepted: { kind: "accepted", ownBooks: "ready", acceptedRevision: household.revision, acceptedStateId: `fictional:${household.revision}:shared-board`, scope: { environment: household.environment, householdId: household.householdId, memberId, subject: "fictional-own-user", viewerRoom: "personal", targetRoom: "household", fundId: household.householdFund!.id, authorityGeneration: "shared-board" } } };
    await render({ view: "personal", scenarioSource: source }); await click("Shift Ask");
    expect(host.querySelector('.ask.is-phone-reach')).not.toBeNull();
    for (let attempt = 0; attempt < 150 && !host.querySelector('[aria-label="Receipt source"]'); attempt++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(host.querySelector('[aria-label="Receipt source"]')).not.toBeNull();
    const amount = host.querySelector<HTMLInputElement>('[aria-label="Assumed remaining CAD"]')!;
    expect(amount).not.toBeNull(); await type(amount, "46");
    await click("Goals"); document.documentElement.dataset.theme = "newfoundland";
    await render({ view: "personal", scenarioSource: source }); await click("Shift Ask");
    expect(host.querySelector('[aria-label="Assumed remaining CAD"]')).toBe(amount); expect(amount.value).toBe("46");
    expect(button("Review receipt assumption")).toBeDefined(); expect(commands).toHaveLength(0);
  });
  it("does not offer retry drawing before an outcome proves no write", async () => {
    vi.useFakeTimers(); await render(); const canvas = host.querySelector<HTMLCanvasElement>('.chalkboard-live-board > canvas')!;
    await act(async () => { pointer(canvas, "pointerdown", 20, 20); pointer(canvas, "pointermove", 80, 80); pointer(canvas, "pointerup", 80, 80); vi.advanceTimersByTime(600); });
    expect(commands).toHaveLength(1); expect(host.querySelector('.chalkboard-live-board > canvas')).toBe(canvas);
    expect(host.querySelector('.chalk-retry')).toBeNull();
    await act(async () => vi.advanceTimersByTime(30000)); expect(commands).toHaveLength(1);
  });
  it("latches repeated typed submits immediately while acceptance is unknown", async () => {
    await render(); const note = host.querySelector<HTMLTextAreaElement>('.chalk-compose--live textarea')!;
    await type(note, "Only once");
    const form = note.closest('form')!;
    await act(async () => { for (let n = 0; n < 3; n++) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(commands).toHaveLength(1); expect(button('Save note').disabled).toBe(true);
    await type(note, "A newer draft"); await click('Save note'); expect(commands).toHaveLength(1);
    household = commands[0]!(household).household; await render(); expect(note.value).toBe('A newer draft');
    expect(button('Save note').disabled).toBe(false);
  });
  it.each([false, true])("preserves strokes drawn while awaiting acceptance, including active stroke %s", async activeStroke => {
    vi.useFakeTimers(); await render(); const canvas = host.querySelector<HTMLCanvasElement>('.chalkboard-live-board > canvas')!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 280, width: 320, height: 280, toJSON: () => ({}) });
    await act(async () => { pointer(canvas, "pointerdown", 20, 20); pointer(canvas, "pointermove", 80, 80); pointer(canvas, "pointerup", 80, 80); vi.advanceTimersByTime(600); });
    expect(host.querySelector('.chalkboard-live-board > canvas')).toBe(canvas);
    await act(async () => { pointer(canvas, "pointerdown", 100, 100); pointer(canvas, "pointermove", 150, 150); if (!activeStroke) pointer(canvas, "pointerup", 150, 150); vi.advanceTimersByTime(600); });
    expect(commands).toHaveLength(1);
    household = commands[0]!(household).household; await render();
    if (activeStroke) await act(async () => pointer(canvas, "pointerup", 150, 150));
    await act(async () => vi.advanceTimersByTime(600)); expect(commands).toHaveLength(2);
    household = commands[1]!(household).household; await render();
    const saved = household.kitchen.chalkboard.filter(note => note.author === memberId && note.ink);
    expect(saved).toHaveLength(2); expect(saved.every(note => note.ink!.strokes.length === 1)).toBe(true);
    expect(saved.flatMap(note => note.ink!.strokes.map(stroke => stroke.points[0]!.x)).sort()).toEqual([20 / 320, 100 / 320]);
    expect(host.querySelector('.chalkboard-live-board > canvas')).toBe(canvas);
  });
  it("cancels a queued live drawing save when the household is retired", async () => {
    vi.useFakeTimers(); await render(); const canvas = host.querySelector<HTMLCanvasElement>('.chalkboard-live-board > canvas')!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 280, width: 320, height: 280, toJSON: () => ({}) });
    await act(async () => { pointer(canvas, "pointerdown", 20, 20); pointer(canvas, "pointermove", 80, 80); pointer(canvas, "pointerup", 80, 80); });
    expect(commands).toHaveLength(0); household = { ...household, householdId: "HH-OTHER" }; await render(); await act(async () => vi.advanceTimersByTime(600)); expect(commands).toHaveLength(0);
  });
});
