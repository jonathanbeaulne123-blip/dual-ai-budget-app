// @vitest-environment jsdom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { SharedLedgerStory } from "../src/SharedLedgerStory.tsx";
import { PersonalLedgerFolio } from "../src/PersonalLedgerFolio.tsx";
import { LedgerPurposeBanner } from "../src/LedgerPurposeBanner.tsx";
import { CollapsibleCard } from "../src/theme/PaperTheme.tsx";
import {
  buildPersonalLedgerStory,
  buildSharedLedgerStory,
  catalogHousehold,
  configureHouseholdFund,
  projectLedgerExperience,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ledger story DOM", () => {
  it("keeps Fund free-to-spend wording and custody disclosure on Shared, not Personal", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const household = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: "MEM-001",
      openedOn: "2026-09-01",
      createdBy: "MEM-001",
    }).household;
    const shared = projectLedgerExperience(household, "MEM-002", "household", "2026-09-01");
    const personal = projectLedgerExperience(household, "MEM-002", "personal", "2026-09-01");
    if (!shared.ok || !personal.ok) throw new Error("expected ok");
    act(() => {
      root.render(createElement(SharedLedgerStory, {
        story: buildSharedLedgerStory(shared.scopedHousehold, "2026-09-01"),
        onOpenFund: () => undefined,
        onOpenHealth: () => undefined,
      }));
    });
    expect(host.textContent).toContain("Fund free-to-spend");
    expect(host.textContent).toContain("not global safe-to-spend");
    expect(host.textContent).toContain("The money remains in Bianca’s savings. Hearth cannot move it.");
    expect(host.querySelectorAll("h3").length).toBeGreaterThan(3);
    expect(host.textContent).not.toContain("Who spent more");
    act(() => {
      root.render(createElement(PersonalLedgerFolio, {
        story: buildPersonalLedgerStory(personal.scopedHousehold, "MEM-002", "2026-09-01"),
        onOpenBooks: () => undefined,
        onOpenFund: () => undefined,
      }));
    });
    expect(host.textContent).toContain("folio");
    expect(host.textContent).not.toContain("Fund free-to-spend");
    expect(host.textContent).not.toContain("Who needs to do what");
    act(() => {
      root.render(createElement(LedgerPurposeBanner, {
        tab: "calendar",
        view: "household",
        label: "Household Ledger",
      }));
    });
    expect(host.textContent).toContain("Household calendar");
    act(() => {
      root.render(createElement(CollapsibleCard, {
        title: "Add personal bank",
        hint: "New goal. Not a second envelope.",
        defaultOpen: false,
        children: createElement("input", { "aria-label": "New bank name" }),
      }));
    });
    const details = host.querySelector("details");
    expect(details).toBeTruthy();
    expect(details?.open).toBe(false);
    expect(details?.getAttribute("defaultOpen")).toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});
