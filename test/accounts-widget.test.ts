// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  accountRows,
  addAccount,
  assembleHousehold,
  catalogHousehold,
  chosenAccount,
  configureHouseholdFund,
  mergePersonal,
  setGlanceAccount,
  splitForSync,
  ValidationError,
  type CommitResult,
  type Household,
} from "../src/core/index.ts";
import { AccountsStage } from "../src/AccountsStage.tsx";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";

const widgetSource = readFileSync(resolve(process.cwd(), "src/core/accountsWidget.ts"), "utf8");
const stageSource = readFileSync(resolve(process.cwd(), "src/AccountsStage.tsx"), "utf8");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fundHousehold(custodian = BIANCA): Household {
  let household = configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: custodian, openedOn: "2026-08-01", createdBy: custodian,
  }).household;
  // Exactly one shared credit card, so resolveSwipeCardAccount resolves
  // deterministically to "ready" instead of "ambiguous".
  household = {
    ...household,
    accounts: household.accounts.map((account) => (
      account.id === "ACC-MC" ? { ...account, active: false } : account
    )),
  };
  return household;
}

function withPersonalChequing(household: Household, memberId: string, name: string): Household {
  return addAccount(household, { name, kind: "chequing", scope: "personal", ownerMemberId: memberId }).household;
}

describe("the accounts widget", () => {
  it("defaults the custodian's glance to the Fund's backing card", () => {
    const household = fundHousehold(BIANCA);
    const chosen = chosenAccount(household, BIANCA, TODAY);
    expect(chosen?.accountId).toBe("ACC-VISA");
    expect(chosen?.isFundCard).toBe(true);
  });

  it("defaults a non-custodian to the first Shared account and keeps their Personal everyday account off the Fund surface", () => {
    let household = fundHousehold(BIANCA);
    household = withPersonalChequing(household, JONATHAN, "Jonathan everyday");
    const chosen = chosenAccount(household, JONATHAN, TODAY);
    expect(chosen?.scope).toBe("shared");
    expect(chosen?.name).not.toBe("Jonathan everyday");
    expect(chosen?.isFundCard).toBe(false);
  });

  it("falls back to the first Shared account when a non-custodian has no stored choice", () => {
    const household = fundHousehold(BIANCA);
    const chosen = chosenAccount(household, JONATHAN, TODAY);
    expect(chosen).not.toBeNull();
    expect(chosen?.scope).toBe("shared");
  });

  it("a default is a starting point, never a lock — setGlanceAccount overrides it", () => {
    const before = fundHousehold(BIANCA);
    const household = setGlanceAccount(before, { memberId: BIANCA, accountId: "ACC-CHEQUING", createdBy: BIANCA }).household;
    const chosen = chosenAccount(household, BIANCA, TODAY);
    expect(chosen?.accountId).toBe("ACC-CHEQUING");
  });

  it("commits through the explicit member-Personal cloud-authority scope", () => {
    const household = fundHousehold(BIANCA);
    const result = setGlanceAccount(household, { memberId: BIANCA, accountId: "ACC-CHEQUING", createdBy: BIANCA });
    expect(result).toMatchObject({ persistenceScope: "member-personal", personalMemberId: BIANCA });
    expect(result.undo.commandKind).toBe("glance-account-personal");
    expect(result.household.members.find((member) => member.id === BIANCA)?.glanceAccountUpdatedAt).toMatch(/Z$/);
  });

  it("keeps a glance choice out of Shared and round-trips it only through the choosing member's Personal envelope", () => {
    let household = fundHousehold(BIANCA);
    household = withPersonalChequing(household, BIANCA, "Bianca private chequing");
    const privateAccount = household.accounts.find((account) => account.name === "Bianca private chequing")!;
    household = setGlanceAccount(household, {
      memberId: BIANCA,
      accountId: "ACC-CHEQUING",
      createdBy: BIANCA,
    }).household;

    const bianca = splitForSync(household, BIANCA);
    expect(JSON.stringify(bianca.shared)).not.toContain("glanceAccountId");
    expect(JSON.stringify(bianca.shared)).not.toContain(privateAccount.id);
    expect(bianca.personal.glanceAccountId).toBe("ACC-CHEQUING");
    expect(bianca.personal.glanceAccountUpdatedAt).toMatch(/Z$/);

    const jonathan = splitForSync(household, JONATHAN);
    expect(jonathan.personal.glanceAccountId).toBeUndefined();
    const restored = assembleHousehold(bianca.shared, bianca.personal);
    expect(restored.members.find((member) => member.id === BIANCA)?.glanceAccountId).toBe("ACC-CHEQUING");
    expect(restored.members.find((member) => member.id === JONATHAN)?.glanceAccountId).toBeUndefined();
  });

  it("converges concurrent Personal glance choices by their record clock", () => {
    const personal = splitForSync(fundHousehold(BIANCA), BIANCA).personal;
    const older = {
      ...personal,
      glanceAccountId: "ACC-MC",
      glanceAccountUpdatedAt: "2026-09-03T10:00:00.000Z",
    };
    const newer = {
      ...personal,
      glanceAccountId: "ACC-VISA",
      glanceAccountUpdatedAt: "2026-09-03T11:00:00.000Z",
    };
    expect(mergePersonal(older, newer).glanceAccountId).toBe("ACC-VISA");
    expect(mergePersonal(newer, older).glanceAccountId).toBe("ACC-VISA");
  });

  it("only the member themself can choose what their board shows", () => {
    const household = fundHousehold(BIANCA);
    expect(() => setGlanceAccount(household, { memberId: BIANCA, accountId: "ACC-VISA", createdBy: JONATHAN }))
      .toThrow(ValidationError);
    expect(() => setGlanceAccount(household, { memberId: BIANCA, accountId: "ACC-VISA", createdBy: JONATHAN }))
      .toThrow("Only you can choose what your board shows.");
  });

  it("refuses to point the Shared glance at any Personal account, including the member's own", () => {
    let household = fundHousehold(BIANCA);
    household = withPersonalChequing(household, BIANCA, "Bianca private chequing");
    household = withPersonalChequing(household, JONATHAN, "Jonathan private chequing");
    const ownAccount = household.accounts.find((account) => account.name === "Bianca private chequing")!;
    const partnerAccount = household.accounts.find((account) => account.name === "Jonathan private chequing")!;
    expect(() => setGlanceAccount(household, { memberId: BIANCA, accountId: ownAccount.id, createdBy: BIANCA }))
      .toThrow("Choose an account you can see.");
    expect(() => setGlanceAccount(household, { memberId: BIANCA, accountId: partnerAccount.id, createdBy: BIANCA }))
      .toThrow("Choose an account you can see.");
  });

  it("keeps every Personal account off the Shared Fund surface for either member", () => {
    let household = fundHousehold(BIANCA);
    household = withPersonalChequing(household, BIANCA, "Bianca private chequing");
    household = withPersonalChequing(household, JONATHAN, "Jonathan private chequing");

    const jonathanBlob = JSON.stringify(accountRows(household, JONATHAN, TODAY));
    expect(jonathanBlob).not.toContain("Bianca private chequing");
    expect(jonathanBlob).not.toContain("Jonathan private chequing");

    const biancaBlob = JSON.stringify(accountRows(household, BIANCA, TODAY));
    expect(biancaBlob).not.toContain("Jonathan private chequing");
    expect(biancaBlob).not.toContain("Bianca private chequing");
  });

  it("sorts Shared accounts alphabetically and excludes Personal rows", () => {
    let household = fundHousehold(BIANCA);
    household = withPersonalChequing(household, BIANCA, "Zzz personal");
    const rows = accountRows(household, BIANCA, TODAY);
    expect(rows.every((row) => row.scope === "shared")).toBe(true);
    expect(rows.map((row) => row.name)).toEqual([...rows.map((row) => row.name)].sort((left, right) => left.localeCompare(right)));
    expect(JSON.stringify(rows)).not.toContain("Zzz personal");
  });

  it("computes no total across scopes — a fence over both the module and the stage", () => {
    for (const source of [widgetSource, stageSource]) {
      expect(source).not.toMatch(/\breduce\(/);
      expect(source).not.toMatch(/total|netWorth|percent|ratio|rank/i);
    }
  });

  it("cannot post, settle, or move a cent", () => {
    for (const source of [widgetSource, stageSource]) {
      expect(source).not.toMatch(/\b(postEntry|postTransfer|confirmHouseholdFundSettlement|commit)\s*\(/);
    }
  });
});

describe("the accounts stage", () => {
  function mount(household: Household, memberId: string, opts: {
    onOpenAccount?: (accountId: string) => void;
    onKitchen?: (fn: (current: Household) => CommitResult) => void;
  } = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(AccountsStage, {
        household,
        memberId,
        today: TODAY,
        onOpenAccount: opts.onOpenAccount ?? (() => {}),
        onKitchen: opts.onKitchen ?? (() => {}),
      }));
    });
    return { container, root };
  }

  function rowByName(container: HTMLElement, name: string): HTMLElement {
    const row = [...container.querySelectorAll(".accounts-stage-row")]
      .find((candidate) => candidate.querySelector(".accounts-stage-name")?.textContent?.includes(name));
    if (!row) throw new Error(`expected a row named ${name}`);
    return row as HTMLElement;
  }

  it("opens the clicked account's books exactly once", () => {
    const household = fundHousehold(BIANCA);
    const opened: string[] = [];
    const { container, root } = mount(household, BIANCA, { onOpenAccount: (id) => opened.push(id) });
    const visaRow = rowByName(container, "Visa");
    const openButton = visaRow.querySelector(".accounts-stage-open") as HTMLButtonElement;
    expect(openButton).toBeTruthy();
    act(() => { openButton.click(); });
    expect(opened).toEqual(["ACC-VISA"]);
    act(() => { root.unmount(); });
    container.remove();
  });

  it("gives every chooser and card gauge an account-specific accessible name", () => {
    const household = fundHousehold(BIANCA);
    const visa = household.accounts.find((account) => account.id === "ACC-VISA")!;
    household.accounts.push({ ...structuredClone(visa), id: "ACC-VISA-SECOND" });
    const { container, root } = mount(household, BIANCA);
    const chooserNames = [...container.querySelectorAll<HTMLButtonElement>(".accounts-stage-choose")]
      .map((button) => button.getAttribute("aria-label"));
    expect(chooserNames.length).toBeGreaterThan(1);
    expect(new Set(chooserNames).size).toBe(chooserNames.length);
    expect(chooserNames).toContain("Show Visa, Credit cards 1 at a glance");
    expect(chooserNames).toContain("Show Visa, Credit cards 2 at a glance");
    expect(chooserNames).toContain("Show Everyday chequing at a glance");
    expect(container.querySelector('.accounts-stage-gauge[aria-label^="Visa, Credit cards 1: "]')).toBeTruthy();
    act(() => { root.unmount(); });
    container.remove();
  });

  it("choosing a row dispatches setGlanceAccount through onKitchen for the viewer's own board", () => {
    const household = fundHousehold(BIANCA);
    let dispatched: ((current: Household) => CommitResult) | null = null;
    const { container, root } = mount(household, BIANCA, { onKitchen: (fn) => { dispatched = fn; } });
    const everydayRow = rowByName(container, "Everyday chequing");
    const chooseButton = everydayRow.querySelector(".accounts-stage-choose") as HTMLButtonElement;
    expect(chooseButton.disabled).toBe(false);
    act(() => { chooseButton.click(); });
    expect(dispatched).not.toBeNull();
    const result = dispatched!(household);
    const updatedMember = result.household.members.find((member) => member.id === BIANCA);
    expect(updatedMember?.glanceAccountId).toBe("ACC-CHEQUING");
    act(() => { root.unmount(); });
    container.remove();
  });
});
