// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BooksPage } from "../src/Books.tsx";
import { catalogHousehold, configureHouseholdFund } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function householdWithFund() {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: "MEM-001",
    openedOn: "2026-09-01",
    createdBy: "MEM-001",
  }).household;
}

describe("Register kitchen placement", () => {
  it("opens a focused Shared account in its Chart register", () => {
    const household = householdWithFund();
    act(() => {
      root.render(createElement(BooksPage, {
        household,
        booksHousehold: household,
        memberId: "MEM-001",
        view: "household",
        booksStatus: null,
        focusedAccountId: "ACC-CHEQUING",
        sourceFocus: null,
        onFocusAccount: () => undefined,
        onClearSource: () => undefined,
        onChange: () => undefined,
        onRemove: () => undefined,
        onPayAccount: () => undefined,
        onAddToAccount: () => undefined,
        onCommand: () => undefined,
      }));
    });

    expect(host.textContent).toContain("Account register");
    const account = host.querySelector("select") as HTMLSelectElement | null;
    expect(account?.value).toBe("ACC-CHEQUING");
    expect(account?.selectedOptions[0]?.textContent).toContain("Everyday chequing");
  });

  it("opens the shared Register room from the Month Spread request", () => {
    const household = householdWithFund();
    const onConsumeRequestedPane = vi.fn();
    act(() => {
      root.render(createElement(BooksPage, {
        household,
        booksHousehold: household,
        memberId: "MEM-002",
        view: "household",
        booksStatus: null,
        focusedAccountId: null,
        sourceFocus: null,
        requestedPane: "fund-register",
        onConsumeRequestedPane,
        onFocusAccount: () => undefined,
        onClearSource: () => undefined,
        onChange: () => undefined,
        onRemove: () => undefined,
        onPayAccount: () => undefined,
        onAddToAccount: () => undefined,
        onCommand: () => undefined,
      }));
    });

    expect(onConsumeRequestedPane).toHaveBeenCalledTimes(1);
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Register")).toBe(true);
    expect(host.querySelector(".register")?.getAttribute("aria-label")).toMatch(/the register$/);
    expect(host.textContent).toContain("Nothing owed this month yet.");
  });

  it("does not offer the shared Register room on a Personal floor", () => {
    const household = householdWithFund();
    act(() => {
      root.render(createElement(BooksPage, {
        household,
        booksHousehold: household,
        memberId: "MEM-002",
        view: "personal",
        booksStatus: null,
        focusedAccountId: null,
        sourceFocus: null,
        onFocusAccount: () => undefined,
        onClearSource: () => undefined,
        onChange: () => undefined,
        onRemove: () => undefined,
        onPayAccount: () => undefined,
        onAddToAccount: () => undefined,
        onCommand: () => undefined,
      }));
    });

    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Register")).toBe(false);
    expect(host.querySelector(".register")).toBeNull();
  });
});
