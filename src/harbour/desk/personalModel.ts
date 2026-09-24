/**
 * The Desk's personal Today, read (SIMPLE_VIEW_DESK S5). Pure functions over
 * shipped core selectors only — the same ones the Office reads for a personal
 * folio, so the Desk and the Office say one thing:
 *
 * - the six personal plates: `personalPlates` (`core/deskPlates.ts`) over the
 *   personal-scope household the Office reads (`projectLedgerExperience(...,
 *   "personal", ...).scopedHousehold`), its `buildDashboard` and its
 *   `shiftPostingStreak`;
 * - the three wax seals: `deskMonthSeals` over that dashboard's `month`
 *   (`monthSummary` of the personal-scope household) — the Office phone's
 *   "Personal income this month" seal;
 * - the Hercules corner: the household Today's own `readHercules`, asked in
 *   personal scope.
 *
 * Nothing here posts, writes or moves money, and nothing computes a balance of
 * its own. Personal scope has no shared Fund and so no Fund walk: the `month`
 * plate's running-net spark stands in the Level's slot. A member the ledger
 * does not know reads `null` everywhere, and "—" downstream.
 */
import { formatMonthLabel, monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import { PERSONAL_PLATE_IDS, personalPlates, type DeskPlateModel, type PersonalPlateId } from "../../core/deskPlates.ts";
import { buildDashboard } from "../../core/insights.ts";
import { projectLedgerExperience } from "../../core/ledgerExperience.ts";
import { deskMonthSeals, type DeskMonthSeals } from "../../core/officeWide.ts";
import { shiftPostingStreak } from "../../core/shiftStreak.ts";
import type { Household } from "../../core/types.ts";

export { PERSONAL_PLATE_IDS };
export type { PersonalPlateId };

/** The plate that stands in the Level's slot: the month's running net, drawn as a spark. */
export const PERSONAL_LEVEL_PLATE: PersonalPlateId = "month";

/**
 * Where each personal plate's source lives, as a door. Shifts is not a house
 * object: the App routes `shift` to the Shifts page (the same `goTab("shift")`
 * the + dial's "Add a shift" row uses); every other door is an ordinary
 * `openHouseObject` target.
 */
export const PERSONAL_PLATE_DOORS: Readonly<Record<PersonalPlateId, { target: string; words: string }>> = Object.freeze({
  clock: { target: "shift", words: "Open Shifts" },
  tips: { target: "shift", words: "Open Shifts" },
  pay: { target: "shift", words: "Open Shifts" },
  wallet: { target: "books", words: "Open the books" },
  "mine-saving": { target: "loft-banks", words: "Open Kitty Banks" },
  month: { target: "books", words: "Open the books" },
});

/** The words under each seal, the Office phone's own ("Personal income this month"). */
export const PERSONAL_SEAL_WORDS = Object.freeze({
  in: { label: "Money in", sub: "Personal income this month" },
  out: { label: "Money out", sub: "Personal expenses this month" },
  leftover: { label: "Leftover", sub: "Posted in minus posted expenses" },
});

export type PersonalToday = {
  /** The six plates in the Office's order (clock, tips, pay, wallet, mine-saving, month). Empty when unknown. */
  plates: DeskPlateModel[];
  /** Null is unknown: every seal reads "—". */
  seals: DeskMonthSeals | null;
  monthLabel: string;
};

/** "2026-09" → "September". */
function monthWord(today: DateKey): string {
  return formatMonthLabel(monthKeyFromDateKey(today)).replace(/\s\d{4}$/, "");
}

/**
 * Read the personal front page. One `projectLedgerExperience`, one
 * `buildDashboard`, one streak — the Office's inputs, read once. `now` only
 * reaches `buildDashboard`'s freshness hours, which the plates and seals never
 * read, so it is pinned to the civil day to keep this pure.
 */
export function readPersonalToday(household: Household, memberId: string, today: DateKey): PersonalToday {
  const monthLabel = monthWord(today);
  try {
    const experience = projectLedgerExperience(household, memberId, "personal", today);
    if (!experience.ok) return { plates: [], seals: null, monthLabel };
    const scoped = experience.scopedHousehold;
    const dashboard = buildDashboard(scoped, today, new Date(`${today}T12:00:00Z`));
    const streak = shiftPostingStreak(scoped, today);
    const plates = personalPlates({ household: scoped, dashboard, today, memberId, streak });
    return { plates, seals: deskMonthSeals(dashboard.month), monthLabel };
  } catch {
    return { plates: [], seals: null, monthLabel };
  }
}

/** The door a plate opens; an unknown id falls back to the books rather than a dead card. */
export function personalPlateDoor(id: string): { target: string; words: string } {
  return (PERSONAL_PLATE_DOORS as Record<string, { target: string; words: string }>)[id] ?? { target: "books", words: "Open the books" };
}
