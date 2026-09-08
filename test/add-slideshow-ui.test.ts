// @vitest-environment jsdom
import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { AddSlideshow, type AddFormFields, type AddMode } from "../src/AddSlideshow.tsx";
import { catalogHousehold, todayKey, JOINT, NeedsConfirmationError, type Visibility } from "../src/core/index.ts";

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
  splitProbe = false,
  roster = household,
  shares = { "MEM-001": 50, "MEM-002": 50 },
  scopeValid = true,
  duplicateReview = false,
}: {
  mode: AddMode;
  onPost: () => void;
  splitProbe?: boolean;
  roster?: typeof household;
  shares?: Record<string, number>;
  scopeValid?: boolean;
  duplicateReview?: boolean;
}) {
  const [form, setForm] = useState<AddFormFields>(() => splitProbe ? { ...emptyForm(), amount: "0.01", who: "split" } : emptyForm());
  const [slideIndex, setSlideIndex] = useState(splitProbe ? 4 : 0);
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
    household: roster,
    booksHousehold: roster,
    pickerAccounts: household.accounts.filter((account) => account.active),
    categories,
    today,
    slideIndex,
    onSlideIndex: setSlideIndex,
    shiftGate: "choose",
    hasWorkJobs: false,
    shiftPreview: { netTipsCents: 0, wagesCents: 0 },
    onHoursDirty: () => undefined,
    hoursDirty: false,
    onClockIn: () => undefined,
    onAlreadyOff: () => undefined,
    onSignOut: () => undefined,
    onNeverMind: () => undefined,
    busy: false,
    error: "",
    onDismissError: () => undefined,
    onGoMore: () => undefined,
    confirm: duplicateReview ? new NeedsConfirmationError("duplicate", "Review duplicate") : null,
    confirmPanelRef: { current: null },
    onConfirmAnyway: onPost,
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
    splitPercents: shares,
    splitScopeValid: scopeValid,
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
  it("shows the canonical one-cent split rather than independently rounding both shares", () => {
    const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
    try {
      act(()=>root.render(createElement(Harness,{mode:"expense",onPost:()=>{},splitProbe:true})));
      const text=host.querySelector(".split-card")!.textContent!;
      expect(text.match(/\$0\.01/g)).toHaveLength(1);
      expect(text).toContain("$0.00");
    }finally{act(()=>root.unmount());host.remove();}
  });
  it("retains every owner in the three-member fallback and blocks invalid or stale review", () => {
    const roster={...household,members:[...household.members,{...household.members[0]!,id:"THIRD",name:"Third person"}]};
    const host=document.createElement("div");document.body.append(host);const root=createRoot(host);let posts=0;
    try {
      act(()=>root.render(createElement(Harness,{mode:"expense",onPost:()=>posts++,splitProbe:true,roster,shares:{"MEM-001":50,"MEM-002":50,THIRD:0}})));
      expect(host.querySelectorAll('.split-card input')).toHaveLength(3);
      expect(host.textContent).toContain('negative remainder');
      const confirm=host.querySelector<HTMLButtonElement>('[data-add-confirm]')!;expect(confirm.disabled).toBe(true);act(()=>confirm.click());expect(posts).toBe(0);
      act(()=>root.render(createElement(Harness,{mode:"expense",onPost:()=>posts++,splitProbe:true,scopeValid:false})));
      expect(host.textContent).toContain('Review current members');expect(confirm.disabled).toBe(true);
    }finally{act(()=>root.unmount());host.remove();}
  });
  it("blocks both posting paths during a held preview and restores the reviewed cents on cancellation", () => {
    for (const duplicateReview of [false,true]) {
      const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let posts=0;
      try {
        act(()=>root.render(createElement(Harness,{mode:'expense',onPost:()=>posts++,splitProbe:true,duplicateReview})));
        const slider=host.querySelector<HTMLButtonElement>('[role=slider]')!,lane=host.querySelector<HTMLElement>('.cut-lane')!;
        slider.setPointerCapture=()=>{};slider.hasPointerCapture=()=>false;slider.releasePointerCapture=()=>{};
        lane.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:200,bottom:44,width:200,height:44,toJSON:()=>{}});
        const pointer=(type:string,x:number)=>{const e=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,button:0});Object.defineProperties(e,{pointerId:{value:1},isPrimary:{value:true}});act(()=>slider.dispatchEvent(e));};
        pointer('pointerdown',100);pointer('pointermove',0);
        expect(slider.getAttribute('aria-valuenow')).toBe('0');
        const buttons=[host.querySelector<HTMLButtonElement>('[data-add-confirm]')!,...Array.from(host.querySelectorAll<HTMLButtonElement>('button')).filter(b=>b.textContent==='Add anyway')];
        for(const button of buttons){expect(button.disabled).toBe(true);act(()=>button.click());}expect(posts).toBe(0);
        pointer('pointercancel',0);expect(slider.getAttribute('aria-valuenow')).toBe('50');
        expect(host.querySelectorAll('[data-cut-cents]')[0]!.textContent).toBe('$0.01');
        act(()=>buttons[0]!.click());expect(posts).toBe(1);
      }finally{act(()=>root.unmount());host.remove();}
    }
  });
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

  it("lets the focused Switch kind disclosure own Enter", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(createElement(Harness, { mode: "expense", onPost: () => undefined }));
    });
    const amountKey = [...host.querySelectorAll(".cad-pad-keys button")]
      .find((button) => button.getAttribute("aria-label") === "1") as HTMLButtonElement;
    act(() => { amountKey.click(); });
    const disclosure = host.querySelector(".add-slideshow-switch > summary") as HTMLElement;
    disclosure.focus();
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => { disclosure.dispatchEvent(enter); });
    expect(enter.defaultPrevented).toBe(false);
    expect(host.querySelector("[data-add-slide]")?.getAttribute("data-add-slide")).toBe("amount");
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
