// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PhoneFold, PHONE_FOLD_OPEN_KEY } from "../src/PhoneFold.tsx";
import { StatusFold, statusFoldKey } from "../src/theme/StatusFold.tsx";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import { kitchenPrimaryNav, sceneTabFor } from "../src/core/ledgerExperience.ts";
import { phoneFoldOrder } from "../src/core/officePhone.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Feedback row 5: one way to each place, one primary action, everything else behind one remembered disclosure. */
describe("One route to each place", () => {
  it("retires the household secondary nav: Calendar, Work and the Status Centre are not duplicated above the bar", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).not.toMatch(/household-secondary/);
    expect(app).not.toMatch(/aria-label="Household tools"/);
    expect(readFileSync("src/plan-studio.css", "utf8")).not.toMatch(/household-secondary/);
    expect(kitchenPrimaryNav("household")).toEqual(["home", "ledger", "plan", "together"]);
    expect(kitchenPrimaryNav("personal")).toEqual(["home", "calendar", "shift", "ledger", "plan"]);
  });
  it("+ means add in both spaces — four money verbs, no navigation verbs", () => {
    for (const view of ["household", "personal"] as const) {
      expect(fabClosedLabel(view)).toBe("Add money");
      for (const tab of ["home", "calendar", "shift", "ledger", "plan", "together", "more", "planner"]) {
        const actions = fabActionsFor(view, tab);
        expect(actions).toHaveLength(4);
        expect(actions.every(action => action.kind === "add" && action.money)).toBe(true);
        expect(new Set(actions.map(action => action.kind === "add" ? action.mode : action.kind)).size).toBe(4);
      }
    }
  });
  it("keeps one tab vocabulary: Together borrows More's scene, nothing else is remapped", () => {
    expect(sceneTabFor("together")).toBe("more");
    expect(sceneTabFor("planner")).toBe("more");
    for (const tab of ["home", "plan", "calendar", "shift", "ledger", "more", "till"] as const) expect(sceneTabFor(tab)).toBe(tab);
    expect(readFileSync("src/App.tsx", "utf8")).not.toMatch(/tab === "together" \? "more" : tab/);
  });
});

describe("The fold is a fold", () => {
  async function mount(items = phoneFoldOrder({ stories: ["blotter", "jars", "postcard", "timesheet"], ownShift: true, overdue: true, health: true, needs: true })) {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(createElement(PhoneFold, { items, render: (id) => createElement("button", null, id) })));
    return { host, close: async () => { await act(async () => root.unmount()); host.remove(); } };
  }
  it("hides what is below at rest, says how much waits, and remembers being opened", async () => {
    localStorage.clear();
    const m = await mount();
    try {
      const line = m.host.querySelector<HTMLButtonElement>("button.ph-fold-line")!;
      expect(line).not.toBeNull();
      expect(line.getAttribute("aria-expanded")).toBe("false");
      expect(line.textContent).toMatch(/the fold · \d+ more/);
      const below = m.host.querySelector<HTMLElement>("#ph-fold-below")!;
      expect(below.classList.contains("is-folded")).toBe(true);
      expect(below.getAttribute("aria-hidden")).toBe("true");
      expect(below.querySelectorAll("[data-fold-id]").length).toBeGreaterThan(0);
      await act(async () => line.click());
      expect(line.getAttribute("aria-expanded")).toBe("true");
      expect(below.classList.contains("is-folded")).toBe(false);
      expect(below.getAttribute("aria-hidden")).toBeNull();
      expect(localStorage.getItem(PHONE_FOLD_OPEN_KEY)).toBe("open");
    } finally { await m.close(); }
    const again = await mount();
    try { expect(again.host.querySelector("button.ph-fold-line")!.getAttribute("aria-expanded")).toBe("true"); } finally { await again.close(); }
  });
  it("draws a plain separator when everything fits above", async () => {
    localStorage.clear();
    const m = await mount(phoneFoldOrder({ stories: ["blotter"], ownShift: false, overdue: false, health: false, needs: false }).slice(0, 2));
    try {
      expect(m.host.querySelector("button.ph-fold-line")).toBeNull();
      expect(m.host.querySelector('.ph-fold-line[role="separator"]')).not.toBeNull();
    } finally { await m.close(); }
  });
});

describe("Status Centre folds", () => {
  it("opens Needs us by default, keeps the others closed, remembers a choice, and forces open on attention", async () => {
    localStorage.clear();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    const tree = (attention: boolean) => createElement("div", null,
      createElement(StatusFold, { id: "needs-us", title: "Needs us", defaultOpen: true, forceOpen: attention, children: createElement("p", null, "sync") }),
      createElement(StatusFold, { id: "household", title: "Household", count: 3, children: createElement("button", null, "Start from scratch") }),
    );
    try {
      await act(async () => root.render(tree(false)));
      const folds = [...host.querySelectorAll<HTMLDetailsElement>("details.status-fold")];
      expect(folds.map(fold => fold.open)).toEqual([true, false]);
      expect(folds[1]!.querySelector(".status-fold__count")?.textContent).toBe("3");
      expect(folds[1]!.querySelector("summary h2.status-group")?.textContent).toBe("Household");
      expect(folds[1]!.querySelector("button")?.textContent).toBe("Start from scratch");
      await act(async () => { folds[0]!.open = false; folds[0]!.dispatchEvent(new Event("toggle")); });
      expect(localStorage.getItem(statusFoldKey("needs-us"))).toBe("closed");
      await act(async () => root.render(tree(true)));
      expect(host.querySelector<HTMLDetailsElement>("#status-needs-us")!.open).toBe(true);
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});
