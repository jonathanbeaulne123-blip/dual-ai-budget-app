// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("../src/kitty/KittyStage.tsx", () => ({ KittyStage: () => null }));
import {
  KittyBankRoom,
  type KittyCommandOptions,
} from "../src/kitty/KittyBankRoom.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import type { Household, CommitResult } from "../src/core/index.ts";
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (row) => row.textContent?.trim() === name,
  )!;
async function click(name: string) {
  await act(async () => button(name).click());
}
async function fill(label: string, value: string) {
  const container = [...document.querySelectorAll("label")].find(
    (row) => row.textContent?.trim() === label,
  )!;
  const input = container.querySelector("input,textarea") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      input.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function fixture(reject: boolean | "unknown" | "throw" = false) {
  let h = planLifeFixture("personal");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    calls: KittyCommandOptions[] = [];
  const render = () =>
    root.render(
      createElement(KittyBankRoom, {
        household: h,
        view: "personal",
        memberId: "MEM-001",
        identity: "fictional-personal",
        onClose: () => {},
        onCommand: async (
          fn: (h: Household) => CommitResult,
          options?: KittyCommandOptions,
        ) => {
          if (options) calls.push(options);
          if (reject === "throw") throw new Error("Fictional lost response");
          if (reject === "unknown") return null;
          if (reject)
            return {
              ok: false,
              household: h,
              userMessage: "Fictional rejected write",
            };
          const result = fn(h);
          h = result.household;
          render();
          return { ok: true, household: h };
        },
      }),
    );
  await act(async () => render());
  return {
    get h() {
      return h;
    },
    calls,
    render: async (next: Household) => {
      h = next;
      await act(async () => render());
    },
    close: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
describe("Kitty room acceptance and draft recovery", () => {
  it("keeps a rejected review and inputs instead of showing a success receipt", async () => {
    const m = await fixture(true);
    try {
      await click("Use money");
      await fill("Spent (CAD)", "25");
      await fill("What was it for?", "Fictional supplies");
      await click("Review purchase");
      expect(m.calls).toHaveLength(0);
      await click("Final Confirm");
      expect(document.body.textContent).toContain("Fictional rejected write");
      expect(button("Final Confirm")).toBeTruthy();
      expect(document.body.textContent).not.toContain("Saved to the books");
      const id = m.calls[0]!.confirmationId;
      await click("Final Confirm");
      expect(m.calls[1]!.confirmationId).toBe(id);
    } finally {
      await m.close();
    }
  });
  it("retains a lost response across remount and checks its original id", async () => {
    sessionStorage.clear();
    const m = await fixture("throw");
    await click("Use money");
    await fill("Spent (CAD)", "25");
    await fill("What was it for?", "Fictional supplies");
    await click("Review purchase");
    await click("Final Confirm");
    expect(button("Check saved status")).toBeTruthy();
    expect(button("Cancel").disabled).toBe(true);
    const id = m.calls[0]!.confirmationId;
    await m.close();
    const n = await fixture("unknown");
    try {
      expect(button("Check saved status")).toBeTruthy();
      await click("Check saved status");
      expect(n.calls[0]!.confirmationId).toBe(id);
      expect(n.calls[0]!.recoverConfirmation).toBe(true);
    } finally {
      await n.close();
      sessionStorage.clear();
    }
  });
  it("does not overwrite a concurrent purpose edit using the latest timestamp", async () => {
    const m = await fixture();
    try {
      await click("Edit purpose & style");
      await fill("Purpose", "Local purpose draft");
      const changed = structuredClone(m.h);
      changed.goals[0]!.updatedAt = "2026-09-11T23:59:59.000Z";
      await m.render(changed);
      await click("Save details & glaze");
      expect(document.body.textContent).toContain("This bank changed");
      expect(m.h.goals[0]!.envelope?.purpose).not.toBe("Local purpose draft");
    } finally {
      await m.close();
    }
  });
});
