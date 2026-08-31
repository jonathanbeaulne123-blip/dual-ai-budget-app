// @vitest-environment jsdom
import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { AddSlideshow, type AddFormFields, type AddMode } from "../src/AddSlideshow.tsx";
import { catalogHousehold, todayKey, JOINT, type Visibility } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const household = catalogHousehold("development");
const today = todayKey(new Date("2026-08-31T16:00:00.000Z"));

function emptyForm(): AddFormFields {
  return {
    date: today,
    amount: "",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "",
    place: "",
    who: JOINT,
    fromAccountId: "ACC-CHEQUING",
    toAccountId: "ACC-VISA",
    memberId: "MEM-002",
    sales: "0",
    cashTips: "0",
    ccTips: "0",
    hours: "",
    customersServed: "40",
    staffingCount: "4",
    eventTag: "regular",
    visibility: "household" as Visibility,
    occurredAt: "",
    useHouseholdFund: false,
    fundedAmount: "",
    fundDestinationAccountId: "ACC-VISA",
  };
}

const placePrefs = {
  displayTimeZone: "America/Toronto",
  locationAllowed: false,
  addPromptSeen: true,
  stampTime: true,
  stampCoords: true,
  shareCoordsWithModel: false,
  updatedAt: "2026-08-31T00:00:00.000Z",
};

function Harness({
  mode,
  onPost,
}: {
  mode: AddMode;
  onPost: () => void;
}) {
  const [form, setForm] = useState<AddFormFields>(() => emptyForm());
  const [slideIndex, setSlideIndex] = useState(0);
  const categories = household.categories.filter((category) => (
    category.recordType === "category"
    && category.active
    && category.transactionType === (mode === "income" ? "income" : "expense")
  ));
  return createElement(AddSlideshow, {
    sheetRef: { current: null },
    mode,
    onSwitchMode: () => undefined,
    form,
    setForm,
    household,
    booksHousehold: household,
    pickerAccounts: household.accounts.filter((account) => account.active),
    categories,
    today,
    slideIndex,
    onSlideIndex: setSlideIndex,
    shiftGate: "choose",
    hasWorkJobs: false,
    shiftPreview: { netTipsCents: 0, wagesCents: 0 },
    shiftTick: 0,
    onHoursDirty: () => undefined,
    onClockIn: () => undefined,
    onAlreadyOff: () => undefined,
    onSignOut: () => undefined,
    onNeverMind: () => undefined,
    busy: false,
    error: "",
    onDismissError: () => undefined,
    onGoMore: () => undefined,
    confirm: null,
    confirmPanelRef: { current: null },
    onConfirmAnyway: () => undefined,
    postLabel: "Post $12.50",
    onPost,
    onClose: () => undefined,
    persistCategory: () => undefined,
    presetId: null,
    onPresetId: () => undefined,
    onSavePreset: () => undefined,
    onForgetPreset: () => undefined,
    categoryTouched: false,
    onCategoryTouched: () => undefined,
    codingHint: "",
    onCodingHint: () => undefined,
    splitPercents: { "MEM-001": 50, "MEM-002": 50 },
    onMemberPercent: () => undefined,
    addDetails: false,
    onAddDetails: () => undefined,
    placePrefs,
    onPlacePrefs: () => undefined,
    environment: "development",
    showLocationPrompt: false,
    onShowLocationPrompt: () => undefined,
    locationBusy: false,
    applyConfiguredStamps: () => undefined,
    clearLocationStamp: () => undefined,
    displayZone: "America/Toronto",
    experienceLine: "",
  });
}

describe("Add slideshow UI", () => {
  it("walks expense amount → category → account → note → Confirm, and Confirm is the only post", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const posts: number[] = [];
    act(() => {
      root.render(createElement(Harness, { mode: "expense", onPost: () => { posts.push(1); } }));
    });
    const sheet = host.querySelector("[data-add-slideshow]") as HTMLElement;
    expect(sheet.getAttribute("data-add-slideshow")).toBe("expense");
    expect(sheet.getAttribute("data-add-slide")).toBe("amount");
    expect(host.querySelector("#add-sheet-title")?.textContent).toBe("How much did you spend?");
    const enter = [...host.querySelectorAll("button")].find((button) => button.textContent === "Enter") as HTMLButtonElement;
    expect(enter.disabled).toBe(true);
    const tap = (label: string) => {
      const button = [...host.querySelectorAll(".cad-pad-keys button")].find((key) => key.getAttribute("aria-label") === label) as HTMLButtonElement;
      act(() => { button.click(); });
    };
    tap("1");
    tap("2");
    tap("5");
    tap("0");
    const enterAfter = [...host.querySelectorAll("button")].find((button) => button.textContent === "Enter") as HTMLButtonElement;
    expect(enterAfter.disabled).toBe(false);
    expect(host.querySelector(".cad-pad-display")?.textContent).toBe("$12.50");
    act(() => { enterAfter.click(); });
    expect(host.querySelector("[data-add-slide]")?.getAttribute("data-add-slide")).toBe("category");
    expect(host.querySelector("#add-sheet-title")?.textContent).toBe("In which category?");
    expect(host.querySelector("[data-add-category-toggle]")?.textContent).toBe("Add category");
    const groceries = [...host.querySelectorAll("button.chip")].find((button) => button.textContent === "Groceries") as HTMLButtonElement;
    act(() => { groceries.click(); });
    expect(host.querySelector("[data-add-slide]")?.getAttribute("data-add-slide")).toBe("account");
    expect(host.querySelector("[data-add-account-tiles]")).toBeTruthy();
    const visa = [...host.querySelectorAll(".wallet-tile")].find((button) => button.textContent?.includes("Visa")) as HTMLButtonElement;
    act(() => { visa.click(); });
    expect(host.querySelector("[data-add-slide]")?.getAttribute("data-add-slide")).toBe("note");
    const skip = [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip") as HTMLButtonElement;
    act(() => { skip.click(); });
    expect(host.querySelector("[data-add-slide]")?.getAttribute("data-add-slide")).toBe("confirm");
    expect(host.querySelector("#add-sheet-title")?.textContent).toBe("Post this expense?");
    expect(posts).toEqual([]);
    const confirm = host.querySelector("[data-add-confirm]") as HTMLButtonElement;
    act(() => { confirm.click(); });
    expect(posts).toEqual([1]);
    act(() => root.unmount());
    host.remove();
  });

  it("uses unique first prompts for income, transfer, and shift", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    for (const [mode, title] of [
      ["income", "How much came in?"],
      ["transfer", "How much are you moving?"],
      ["shift", "Who is working?"],
    ] as const) {
      act(() => {
        root.render(createElement(Harness, { mode, onPost: () => undefined }));
      });
      expect(host.querySelector("#add-sheet-title")?.textContent).toBe(title);
      expect(host.querySelector("[data-add-slideshow]")?.getAttribute("data-add-slideshow")).toBe(mode);
    }
    act(() => root.unmount());
    host.remove();
  });
});
