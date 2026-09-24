// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { accountActivity, walletForListedAccounts } from "../src/core/accounts.ts";
import { accountRows, chosenAccount } from "../src/core/accountsWidget.ts";
import { booksPresentationFloor } from "../src/core/ledgerExperience.ts";
import { formatCad } from "../src/core/money.ts";
import type { Household } from "../src/core/types.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import { DeskShell, type DeskShellProps } from "../src/harbour/desk/DeskShell.tsx";

/**
 * The Desk's Accounts page (SIMPLE_VIEW_DESK S3 §3): one tile per shared
 * account with the Fund board's own `accountRows` figures — unchanged, the
 * accountsWidget-vs-Books-floor ruling is Jonathan's — the glance pick
 * marked, a card's utilization, and a tap that unfolds the account's recent
 * register rows in place. Fictional demo data only.
 */
const unknown = vi.hoisted(() => ({ on: false }));
vi.mock("../src/core/accountsWidget.ts", async (original) => {
  const real = await original<typeof import("../src/core/accountsWidget.ts")>();
  return {
    ...real,
    accountRows: (...args: Parameters<typeof real.accountRows>) => {
      const rows = real.accountRows(...args);
      return unknown.on ? rows.map((row, i) => (i === 0 ? { ...row, balanceCents: Number.NaN } : row)) : rows;
    },
  };
});

const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const reading = buildHarbourReading(household, memberId, today, "current");

let host: HTMLDivElement, root: Root;
beforeEach(() => { unknown.on = false; vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function mount(props: Partial<DeskShellProps> = {}) {
  const opened: Array<[string, string | undefined]> = [];
  const all: DeskShellProps = { household, memberId, scope: "household", today, reading, initialPage: "accounts", onOpen: (t, o) => opened.push([t, o]), ...props };
  await act(async () => root.render(createElement(DeskShell, all)));
  return { opened };
}
const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const qa = <T extends Element = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];

describe("Accounts, household scope", () => {
  it("stands one tile per accountRows row with its figure unchanged, the utilization and the glance pick", async () => {
    await mount();
    expect(q("[data-desk]").dataset.deskPage).toBe("accounts");
    expect(host.querySelector("[data-desk-coming]")).toBeNull();
    const rows = accountRows(household, memberId, today);
    const chosen = chosenAccount(household, memberId, today)!;
    const tiles = qa("[data-desk-account]");
    expect(tiles.map(tile => tile.dataset.deskAccount)).toEqual(rows.map(row => row.accountId));
    expect(tiles.map(tile => tile.querySelector(".desk-account__balance .desk-figure")!.textContent)).toEqual(rows.map(row => formatCad(row.balanceCents)));
    expect(tiles.map(tile => tile.querySelector(".desk-account__balance .desk-accounts__label")!.textContent)).toEqual(rows.map(row => row.balanceLabel));
    for (const row of rows.filter(row => row.utilization !== null)) {
      expect(q(`[data-desk-account="${row.accountId}"] .desk-account__util`).textContent).toBe(`${Math.round(row.utilization! * 100)}% of limit used`);
    }
    expect(qa(".desk-account__util").length).toBe(rows.filter(row => row.utilization !== null).length);
    const glanced = tiles.filter(tile => tile.querySelector(".desk-account__badge--glance"));
    expect(glanced.map(tile => tile.dataset.deskAccount)).toEqual([chosen.accountId]);
    expect(q("[data-desk-glance]").dataset.deskGlance).toBe(chosen.accountId);
    expect(q("[data-desk-glance] .desk-figure").textContent).toContain(formatCad(chosen.balanceCents));
    const fundCard = rows.find(row => row.isFundCard);
    if (fundCard) expect(q(`[data-desk-account="${fundCard.accountId}"]`).textContent).toContain("Fund card");
  });

  it("unfolds a tile in place to its latest register rows — date, words, amount — and folds it again", async () => {
    await mount();
    const row = accountRows(household, memberId, today).find(item => item.accountId === "ACC-CHEQUING")!;
    const tile = q(`[data-desk-account="${row.accountId}"]`);
    const press = tile.querySelector<HTMLButtonElement>(".desk-account__press")!;
    const register = tile.querySelector<HTMLElement>(".desk-account__register")!;
    expect(press.getAttribute("aria-expanded")).toBe("false");
    expect(register.hidden).toBe(true);
    expect(press.getAttribute("aria-controls")).toBe(register.id);
    await act(async () => press.click());
    expect(press.getAttribute("aria-expanded")).toBe("true");
    expect(register.hidden).toBe(false);
    expect(tile.closest("li")!.classList.contains("is-open")).toBe(true);
    const expected = accountActivity(booksPresentationFloor(household, memberId, "household"), row.accountId).slice(0, 8);
    expect(expected.length).toBeGreaterThan(0);
    const shown = [...register.querySelectorAll<HTMLElement>("[data-desk-activity]")];
    expect(shown.map(tr => tr.dataset.deskActivity)).toEqual(expected.map(tx => tx.id));
    expect(shown.map(tr => tr.querySelectorAll("td")[2]!.textContent)).toEqual(expected.map(tx => formatCad(tx.amountCents)));
    expect(shown[0]!.querySelectorAll("td").length).toBe(3);
    await act(async () => press.click());
    expect(press.getAttribute("aria-expanded")).toBe("false");
    expect(register.hidden).toBe(true);
  });

  it("opens only one account at a time", async () => {
    await mount();
    const presses = qa<HTMLButtonElement>(".desk-account__press");
    await act(async () => presses[0]!.click());
    await act(async () => presses[1]!.click());
    expect(presses.map(press => press.getAttribute("aria-expanded"))).toEqual(["false", "true", ...presses.slice(2).map(() => "false")]);
  });

  it("opens the Standing Book's Accounts division — the Wallet pane — through the Bindery's door", async () => {
    const { opened } = await mount();
    await act(async () => q<HTMLButtonElement>('[data-desk-door="books"]').click());
    expect(opened).toEqual([["books", "bindery/cut-bank"]]);
  });

  it("engraves an unknown balance —, never $0", async () => {
    unknown.on = true;
    await mount();
    const first = qa("[data-desk-account]")[0]!;
    expect(first.querySelector(".desk-account__balance .desk-figure")!.textContent).toBe("—");
    expect(first.querySelector(".desk-account__press")!.getAttribute("aria-label")).toMatch(/: — /);
  });
});

describe("Accounts, personal scope", () => {
  it("renders without a crash and says shared accounts are read in Shared when there are no personal rooms", async () => {
    await mount({ scope: "personal" });
    expect(q("[data-desk-accounts]").dataset.deskAccounts).toBe("personal");
    expect(host.querySelector("[data-desk-account]")).toBeNull();
    expect(q("[data-desk-glance]").textContent).toMatch(/Shared accounts are read in Shared/);
    expect(q("[data-desk-glance]").textContent).not.toMatch(/\$0/);
  });

  it("shows this member's own accounts with the Wallet's figure, and never the shared ones", async () => {
    const chequing = household.accounts.find(account => account.id === "ACC-CHEQUING")!;
    const mine = { ...chequing, id: "ACC-DESK-MINE", name: "My pocket", scope: "personal" as const, ownerMemberId: memberId };
    const theirs = { ...chequing, id: "ACC-DESK-THEIRS", name: "Their pocket", scope: "personal" as const, ownerMemberId: household.members[1]!.id };
    const withPersonal: Household = { ...household, accounts: [...household.accounts, mine, theirs] };
    await mount({ household: withPersonal, scope: "personal" });
    const tiles = qa("[data-desk-account]");
    expect(tiles.map(tile => tile.dataset.deskAccount)).toEqual(["ACC-DESK-MINE"]);
    const tile = walletForListedAccounts(withPersonal, ["ACC-DESK-MINE"], today).tiles[0]!;
    expect(tiles[0]!.querySelector(".desk-account__balance .desk-figure")!.textContent).toBe(formatCad(tile.displayCents));
    await act(async () => tiles[0]!.querySelector<HTMLButtonElement>(".desk-account__press")!.click());
    expect(tiles[0]!.textContent).toMatch(/Nothing posted to this account yet/);
  });
});
