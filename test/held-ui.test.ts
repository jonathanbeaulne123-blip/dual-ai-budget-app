// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HouseholdFundPanel } from "../src/HouseholdFundPanel.tsx";
import {
  HOUSEHOLD_FUND_HOLD_COPY,
  catalogHousehold,
  compileHousehold,
  configureHouseholdFund,
  emptyHousehold,
  formatCad,
  formatDateLabel,
  holdHouseholdFundContribution,
  householdFundContributionMotions,
  projectHouseholdFund,
  proposeHouseholdFundContribution,
  todayKey,
  type CommitResult,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";
const AMOUNT = "310";
const FORBIDDEN_COPY = /denied|rejected|declined|blocked|failed|waiting for Bianca|action required|overdue|you should/i;

const panelSource = readFileSync(resolve(process.cwd(), "src/HouseholdFundPanel.tsx"), "utf8");
const stylesSource = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

let root: Root;
let container: HTMLDivElement;
let styleTag: HTMLStyleElement;

function configuredFund(): Household {
  const household = emptyHousehold("development");
  household.members = [
    { id: BIANCA, name: "Bianca", color: "#c45c26", active: true, updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: JONATHAN, name: "Jonathan", color: "#2f6b4f", active: true, updatedAt: "2026-01-01T00:00:00.000Z" },
  ];
  return configureHouseholdFund(household, {
    custodianMemberId: BIANCA,
    createdBy: BIANCA,
    openedOn: DATE,
  }).household;
}

function openProposal(household = configuredFund()): Household {
  return proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: AMOUNT,
    date: DATE,
  }).household;
}

function heldProposal(note = "Can we check the rent total first?"): Household {
  const proposed = openProposal();
  const motion = householdFundContributionMotions(proposed)[0]!;
  return holdHouseholdFundContribution(proposed, {
    memberId: BIANCA,
    proposalEventId: motion.proposal.id,
    note,
    date: DATE,
  }).household;
}

function buttonNamed(label: string, scope: ParentNode = container): HTMLButtonElement | undefined {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent === label) as HTMLButtonElement | undefined;
}

function motionCard(): HTMLElement {
  const card = container.querySelector(".fund-motion-card");
  expect(card).toBeTruthy();
  return card as HTMLElement;
}

function expectMinTouch(button: HTMLButtonElement) {
  const height = Number.parseFloat(button.style.minHeight || getComputedStyle(button).minHeight);
  const width = Number.parseFloat(button.style.minWidth || getComputedStyle(button).minWidth);
  expect(button.tagName).toBe("BUTTON");
  expect(height).toBeGreaterThanOrEqual(44);
  expect(width).toBeGreaterThanOrEqual(44);
}

function StatefulPanel({
  initial,
  memberId,
  householdRef,
  commandLog,
}: {
  initial: Household;
  memberId: string;
  householdRef: { current: Household };
  commandLog?: Array<(current: Household) => CommitResult>;
}) {
  const [household, setHousehold] = useState(initial);
  householdRef.current = household;
  return createElement(HouseholdFundPanel, {
    household,
    memberId,
    view: "household",
    onCommand: (command) => {
      commandLog?.push(command);
      setHousehold((current) => {
        const next = command(current).household;
        householdRef.current = next;
        return next;
      });
    },
  });
}

function renderPanel(household: Household, memberId: string, onCommand: (command: (current: Household) => CommitResult) => void = () => undefined) {
  act(() => {
    root.render(createElement(HouseholdFundPanel, {
      household,
      memberId,
      view: "household",
      onCommand,
    }));
  });
}

function renderStateful(initial: Household, memberId: string, householdRef: { current: Household }, commandLog?: Array<(current: Household) => CommitResult>) {
  act(() => {
    root.render(createElement(StatefulPanel, { initial, memberId, householdRef, commandLog }));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  styleTag = document.createElement("style");
  styleTag.textContent = stylesSource;
  document.head.appendChild(styleTag);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  styleTag.remove();
});

describe("Held contribution motion UI", () => {
  it("keeps the sealed motion selector as the only waiting-queue fold", () => {
    expect(panelSource).toContain("householdFundContributionMotions");
    expect(panelSource).toContain("HOUSEHOLD_FUND_HOLD_COPY");
    expect(panelSource).toContain("holdHouseholdFundContribution");
    expect(panelSource).toContain("releaseHouseholdFundHold");
    expect(panelSource).toContain("withdrawHouseholdFundContribution");
    expect(panelSource).not.toContain("Waiting for Bianca");
    expect(panelSource.match(/householdFundContributionMotions\(/g)?.length).toBe(1);
    expect(panelSource).not.toMatch(/event\.kind === "contribution-proposed"/);
  });

  it("shows equal Confirm received and Hold controls for an open custodian view", () => {
    renderPanel(openProposal(), BIANCA);
    const card = motionCard();
    const confirm = buttonNamed("Confirm received", card)!;
    const hold = buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, card)!;
    expect(confirm).toBeTruthy();
    expect(hold).toBeTruthy();
    expect(confirm.className).toContain("primary");
    expect(hold.className).toContain("ghost");
    expect(confirm.parentElement).toBe(hold.parentElement);
    expectMinTouch(confirm);
    expectMinTouch(hold);
    expect(card.textContent).toContain("Jonathan");
    expect(card.textContent).toContain(formatCad(31_000));
    expect(card.textContent).toContain(formatDateLabel(DATE));
  });

  it("holds with a note through onCommand and keeps Confirm beside the calm status", () => {
    const householdRef = { current: openProposal() };
    const beforeProjection = projectHouseholdFund(householdRef.current, DATE);
    const beforeJournal = compileHousehold(householdRef.current).entries;
    renderStateful(householdRef.current, BIANCA, householdRef);

    act(() => buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, motionCard())!.click());
    const note = Array.from(motionCard().querySelectorAll("input")).find((input) => input.id !== "fund-contribution-amount") as HTMLInputElement;
    expect(note).toBeTruthy();
    expect(note.placeholder).toBe(HOUSEHOLD_FUND_HOLD_COPY.notePlaceholder);
    expect(container.querySelector(`label[for="${note.id}"]`)).toBeTruthy();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(note, "Can we check the rent total first?");
      note.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, motionCard())!.click());

    const card = motionCard();
    expect(card.getAttribute("data-fund-motion-status")).toBe("held");
    expect(card.textContent).toContain(HOUSEHOLD_FUND_HOLD_COPY.status);
    expect(card.textContent).toContain(`Bianca held this on ${formatDateLabel(todayKey())}.`);
    expect(card.textContent).toContain("Can we check the rent total first?");
    expect(buttonNamed("Confirm received", card)).toBeTruthy();
    expect(projectHouseholdFund(householdRef.current, DATE)).toEqual(beforeProjection);
    expect(compileHousehold(householdRef.current).entries).toEqual(beforeJournal);
    expect(householdFundContributionMotions(householdRef.current)[0]?.status).toBe("held");
  });

  it("shows Release Hold only to the holder and Withdraw proposal only to the proposer", () => {
    const held = heldProposal();
    renderPanel(held, BIANCA);
    const biancaCard = motionCard();
    expect(buttonNamed("Release Hold", biancaCard)).toBeTruthy();
    expect(buttonNamed("Confirm received", biancaCard)).toBeTruthy();
    expect(buttonNamed("Withdraw proposal", biancaCard)).toBeUndefined();
    expect(buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, biancaCard)).toBeUndefined();

    renderPanel(held, JONATHAN);
    const jonathanCard = motionCard();
    expect(buttonNamed("Withdraw proposal", jonathanCard)).toBeTruthy();
    expect(buttonNamed("Release Hold", jonathanCard)).toBeUndefined();
    expect(buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, jonathanCard)).toBeUndefined();
    expect(buttonNamed("Confirm received", jonathanCard)).toBeUndefined();
    expect(jonathanCard.textContent).toContain(HOUSEHOLD_FUND_HOLD_COPY.status);
    expect(jonathanCard.textContent).not.toMatch(FORBIDDEN_COPY);
  });

  it("releases back to open and withdraws the motion from the waiting queue", () => {
    const householdRef = { current: heldProposal() };
    renderStateful(householdRef.current, BIANCA, householdRef);
    act(() => buttonNamed("Release Hold", motionCard())!.click());
    expect(motionCard().getAttribute("data-fund-motion-status")).toBe("open");
    expect(buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, motionCard())).toBeTruthy();
    expect(householdFundContributionMotions(householdRef.current)[0]?.status).toBe("open");

    act(() => {
      root.render(createElement(StatefulPanel, {
        initial: householdRef.current,
        memberId: JONATHAN,
        householdRef,
      }));
    });
    act(() => buttonNamed("Withdraw proposal", motionCard())!.click());
    expect(container.querySelector(".fund-motion-card")).toBeNull();
    expect(container.textContent).not.toMatch(/0 items/i);
    expect(householdFundContributionMotions(householdRef.current)[0]?.status).toBe("withdrawn");
  });

  it("confirms a held proposal through confirmHouseholdFundContribution and leaves the queue", () => {
    const householdRef = { current: heldProposal() };
    const commandLog: Array<(current: Household) => CommitResult> = [];
    renderStateful(householdRef.current, BIANCA, householdRef, commandLog);
    act(() => buttonNamed("Confirm received", motionCard())!.click());
    expect(commandLog).toHaveLength(1);
    expect(commandLog[0]!.toString()).toContain("confirmHouseholdFundContribution");
    expect(container.querySelector(".fund-motion-card")).toBeNull();
    expect(householdFundContributionMotions(householdRef.current)[0]?.status).toBe("confirmed");
    expect(projectHouseholdFund(householdRef.current, DATE)).toMatchObject({
      pendingContributionsCents: 0,
      confirmedContributionsCents: 31_000,
      operatingBalanceCents: 31_000,
    });
  });

  it("does not give a non-custodian a working Hold control after rerender as the other member", () => {
    const open = openProposal();
    renderPanel(open, JONATHAN);
    expect(buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, motionCard())).toBeUndefined();

    renderPanel(open, BIANCA);
    expect(buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, motionCard())).toBeTruthy();

    const ignored: Array<(current: Household) => CommitResult> = [];
    renderPanel(open, JONATHAN, (command) => ignored.push(command));
    expect(buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action)).toBeUndefined();
    expect(buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, motionCard())).toBeUndefined();
    expect(ignored).toHaveLength(0);
    expect(householdFundContributionMotions(open)[0]?.status).toBe("open");
  });

  it("keeps a 320px action row from overflowing while controls stay 44px", () => {
    container.style.width = "320px";
    renderPanel(openProposal(), BIANCA);
    const actions = motionCard().querySelector(".fund-motion-actions") as HTMLElement;
    expect(actions).toBeTruthy();
    actions.style.width = "320px";
    expect(getComputedStyle(actions).flexWrap).toBe("wrap");
    expect(actions.scrollWidth).toBeLessThanOrEqual(Math.max(actions.clientWidth, 320));
    expectMinTouch(buttonNamed("Confirm received", actions)!);
    expectMinTouch(buttonNamed(HOUSEHOLD_FUND_HOLD_COPY.action, actions)!);
  });

  it("keeps the Fund custody disclosure and forbids refusal copy", () => {
    renderPanel(openProposal(), BIANCA);
    expect(container.textContent).toContain("The money remains in Bianca’s savings. Hearth cannot move it.");
    expect(container.textContent).not.toMatch(FORBIDDEN_COPY);
    expect(container.textContent).not.toMatch(/\bpending\b/i);
    expect(catalogHousehold().members.map((row) => row.name)).toEqual(["Bianca", "Jonathan"]);
  });
});
