// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { Charter } from "../src/Charter.tsx";
import {
  SIGNATURE_VIEW,
  catalogHousehold,
  foundHouseholdCharter,
  grantCharterPermission,
  holdCharterAmendment,
  proposeCharterAmendment,
  signHouseholdCharter,
  signatureLines,
} from "../src/core/index.ts";
import type { Household } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";

function found(household = catalogHousehold()): Household {
  return foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "This money is for the roof over us, the cat, and one week away a year.",
    splitRule: "remainder",
    splitNote: "Bianca puts in what she can spare after her own bills. I make up the difference.",
    ceilingKind: "hours-per-week",
    ceilingValue: "24",
    cadence: "weekly",
    cadenceWeekday: 0,
    clauses: [{ heading: "Bills", body: "The Fund covers agreed household bills." }],
    date: DATE,
  }).household;
}

describe("charter page", () => {
  it("returns both signature lines in stable charter order", () => {
    const household = found();
    expect(SIGNATURE_VIEW).toEqual({ ruleWidth: 260, ruleGap: 10, nameSize: 12 });
    expect(signatureLines(household.charter!, household.members)).toEqual([
      { memberId: BIANCA, name: "Bianca", signedAt: null },
      { memberId: JONATHAN, name: "Jonathan", signedAt: null },
    ]);
  });

  it("lets only the viewer sign their own line and keeps the other line silent", () => {
    const household = found();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let current = household;

    act(() => {
      root.render(createElement(Charter, {
        household: current,
        memberId: JONATHAN,
        onCommit: (fn) => {
          current = fn(current).household;
        },
        onDismiss: () => {},
      }));
    });

    expect(host.textContent).toContain("This money is for the roof over us, the cat, and one week away a year.");
    expect(host.textContent).toContain("Bianca holds the money. Hearth can't move it.");
    expect(host.textContent).toContain("One of us covers what's left");
    expect(host.textContent).toContain("24 hours a week");
    expect(host.textContent).toContain("Every Sunday.");
    expect(host.textContent).not.toMatch(/pending|awaiting signature|action required|reminder/i);

    const jonathanBlock = [...host.querySelectorAll(".charter-sig")].find((node) => (
      node.textContent?.includes("Jonathan")
    ));
    const biancaBlock = [...host.querySelectorAll(".charter-sig")].find((node) => (
      node.textContent?.includes("Bianca")
    ));
    expect(jonathanBlock?.textContent).toContain("sign");
    expect(biancaBlock?.textContent).not.toContain("sign");
    expect(biancaBlock?.textContent).not.toMatch(/Jonathan/);

    act(() => root.unmount());
    host.remove();
  });

  it("renders a signed date on one line and still no prompt toward the other member", () => {
    let household = found();
    household = grantCharterPermission(household, {
      memberId: JONATHAN,
      actorMemberId: BIANCA,
      label: "Bianca can spend from the Fund on anything we've already agreed is a household bill.",
    }).household;
    household = signHouseholdCharter(household, {
      memberId: BIANCA,
      at: "2026-08-24T12:00:00-04:00",
    }).household;

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(createElement(Charter, {
        household,
        memberId: JONATHAN,
        onCommit: () => {},
        onDismiss: () => {},
      }));
    });

    expect(host.textContent).toContain("Bianca · 24 Aug 2026");
    expect(host.textContent).toContain("Jonathan");
    expect(host.textContent).toContain("sign");
    const biancaBlock = [...host.querySelectorAll(".charter-sig")].find((node) => (
      node.textContent?.includes("Bianca")
    ));
    expect(biancaBlock?.textContent).not.toContain("sign");
    expect(host.textContent).not.toMatch(/please sign|waiting on Bianca|unsigned/i);

    act(() => root.unmount());
    host.remove();
  });

  it("lists held amendments without refusal language", () => {
    let household = found();
    const proposed = proposeCharterAmendment(household, {
      memberId: JONATHAN,
      field: "purpose",
      toText: "Keep a shared home and protect both people's time.",
    });
    household = holdCharterAmendment(proposed.household, {
      memberId: BIANCA,
      amendmentId: proposed.postedIds[0]!,
      note: "What would you want to know first?",
    }).household;

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(createElement(Charter, {
        household,
        memberId: JONATHAN,
        onCommit: () => {},
        onDismiss: () => {},
      }));
    });
    expect(host.textContent).toMatch(/Bianca held this/);
    expect(host.textContent).toContain("What would you want to know first?");
    expect(host.textContent).not.toMatch(/denied|rejected|declined/i);
    act(() => root.unmount());
    host.remove();
  });

  it("keeps unsigned-line restraint in the page source", () => {
    const source = readFileSync(join(process.cwd(), "src/Charter.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/charter.css"), "utf8");
    const view = readFileSync(join(process.cwd(), "src/core/charterView.ts"), "utf8");
    expect(css).toContain("width: 260px");
    expect(view).toContain("ruleWidth: 260");
    expect(source).not.toMatch(/\bpending\b/i);
    expect(source).not.toMatch(/\brequired\b/i);
    expect(source).not.toMatch(/\breminder\b/i);
    expect(source).not.toMatch(/badge/i);
    expect(source).not.toMatch(/!\s*[`'"]/);
    expect(source).not.toMatch(/\bpercent\b/i);
    expect(source).not.toMatch(/\bratio\b/i);
    expect(view).not.toMatch(/\bpercent\b/i);
    expect(view).not.toMatch(/\bratio\b/i);
    expect(view).not.toMatch(/\bdenied\b/i);
  });
});
