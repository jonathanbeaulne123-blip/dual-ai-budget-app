import { formatCad } from "./money.ts";
import { leftoverProjection } from "./sitDown.ts";
import { composeNotices } from "./notices.ts";
import { herculesInstrumentSurface, herculesPageSurface } from "./herculesPage.ts";
import { fullOpenGoals, goalsVaultAccount, vaultReceiptBlurb } from "./goalVault.ts";
import { buildMonthBoard, isOutgoingBill } from "./board.ts";
import { monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { upcomingVisitBoard } from "./appointments.ts";
import type { HearthTab } from "./hercules.ts";
import type { InstrumentId } from "./officeLayout.ts";
import type { Household } from "./types.ts";

/**
 * Event language that should open Calendar on the wide desk.
 * Leftover math that only mentions bills stays on Plan.
 */
export function calendarEventIntent(text: string): boolean {
  const q = text.trim().toLowerCase();
  if (!q) return false;
  if (/\bleftover\b/.test(q) && !/\b(appointment|subscription|calendar|event)\b/.test(q)) return false;
  return (
    /\b(appointments?|bill payments?|subscriptions?|which bill|calendar|events?|payday|due dates?|visits?)\b/.test(q)
    || /\b(hydro|netflix|spotify|phone bill)\b/.test(q)
  );
}

export type HelpCommand = {
  id: string;
  label: string;
  prompt: string;
  go?: HearthTab;
  expand?: InstrumentId | "window";
};

function uniqueCommands(rows: HelpCommand[]): HelpCommand[] {
  const seen = new Set<string>();
  const out: HelpCommand[] = [];
  for (const row of rows) {
    const key = row.prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.slice(0, 8);
}

export function helpCommands(input: {
  tab: HearthTab;
  instrument: InstrumentId | "window" | null;
  household: Household;
  today: DateKey;
}): HelpCommand[] {
  const { tab, instrument, household, today } = input;
  const leftover = leftoverProjection(household, today);
  const rows: HelpCommand[] = [
    {
      id: "leftover",
      label: leftover.leftoverCents ? `Leftover ${formatCad(leftover.leftoverCents)}` : "Leftover?",
      prompt: "Leftover?",
      go: "plan",
      expand: "postcard",
    },
  ];

  const bill = buildMonthBoard(household, monthKeyFromDateKey(today), today).upcoming.find(isOutgoingBill);
  if (bill) {
    rows.push({
      id: "bill",
      label: `Which bill? ${bill.title}`,
      prompt: "Which bill?",
      go: "calendar",
      expand: "calendar",
    });
  }

  const visit = upcomingVisitBoard(household, today)[0];
  if (visit) {
    rows.push({
      id: "visit",
      label: "What's owed?",
      prompt: "What's owed?",
      go: "calendar",
      expand: "appointments",
    });
  }

  const full = fullOpenGoals(household)[0];
  if (full) {
    rows.push({
      id: "purchased",
      label: `${full.name} is full`,
      prompt: "Mark purchased",
      expand: "jars",
    });
  }

  const notice = composeNotices(household, today)[0];
  if (notice) {
    rows.push({
      id: `notice-${notice.key}`,
      label: notice.kind === "habit-preset" ? "Save as preset" : "What now?",
      prompt: notice.kind === "habit-preset" ? "Save as preset" : "What now?",
    });
  }

  if (tab === "plan" || instrument === "postcard" || instrument === "jars") {
    rows.push({
      id: "sit-down",
      label: "Sit-down?",
      prompt: "Sit-down?",
      go: "plan",
      expand: "postcard",
    });
  }

  const chips = instrument
    ? herculesInstrumentSurface(instrument, household, today).chips
    : herculesPageSurface(tab, household, today).chips;
  for (const [index, label] of chips.entries()) {
    rows.push({
      id: `chip-${index}`,
      label,
      prompt: label,
      expand: ["Which bill?", "Calendar"].includes(label) ? "calendar" : undefined,
      go: label === "Health" || label === "What broke?" ? "more"
        : label === "Sit-down?" || label === "Leftover?" ? "plan"
          : label === "Which bill?" || label === "Calendar" ? "calendar"
            : label === "Tonight?" || label === "Protect or chase?" || label === "Tax milk?" ? "shift"
            : undefined,
    });
  }

  return uniqueCommands(rows);
}

export function matchHelpCommand(commands: HelpCommand[], text: string): HelpCommand | undefined {
  const q = text.trim().toLowerCase();
  if (!q) return undefined;
  return commands.find((row) => (
    row.label.toLowerCase() === q
    || row.prompt.toLowerCase() === q
    || row.id.toLowerCase() === q
  ));
}

export function openHelpState(input: {
  tab: HearthTab;
  instrument: InstrumentId | "window" | null;
  household: Household;
  today: DateKey;
}): { spoken: string; replies: string[]; commands: HelpCommand[] } {
  const commands = helpCommands(input);
  return {
    spoken: helpIntro(input.tab, input.instrument, input.household, input.today),
    replies: commands.map((row) => row.label),
    commands,
  };
}

/** One living sentence from leftover, calendar, notices, and jars — not a job description. */
export function helpIntro(
  tab: HearthTab,
  instrument: InstrumentId | "window" | null,
  household: Household,
  today: DateKey,
): string {
  const leftover = leftoverProjection(household, today);
  const bill = buildMonthBoard(household, monthKeyFromDateKey(today), today).upcoming.find(isOutgoingBill);
  const full = fullOpenGoals(household)[0];
  const notice = composeNotices(household, today)[0];
  const vault = goalsVaultAccount(household);
  const parts: string[] = [];

  if (instrument === "jars" || tab === "plan") {
    parts.push(vaultReceiptBlurb(household, today));
  } else if (leftover.leftoverCents > 0) {
    parts.push(`Leftover is ${formatCad(leftover.leftoverCents)} after bills and card mins.`);
  } else if (leftover.shortfallCents > 0) {
    parts.push("Nothing leftover to move. Sit-down still runs.");
  }

  if (instrument === "calendar" || tab === "calendar") {
    parts.push(bill ? `${bill.title} is a date, not a post.` : "No outgoing bill on the board.");
  } else if (bill && calendarEventIntent("which bill")) {
    parts.push(`${bill.title} lives on Calendar.`);
  }

  if (full) parts.push(`${full.name} is full. Mark purchased is on Goals.`);
  if (notice && notice.kind === "habit-preset") parts.push(notice.spoken);
  if (vault && instrument === "accounts") parts.push(`${vault.name} is the sinking-fund vault, not the everyday HIS.`);

  if (!parts.length) {
    const surface = instrument
      ? herculesInstrumentSurface(instrument, household, today)
      : herculesPageSurface(tab, household, today);
    return surface.spoken;
  }
  return parts.slice(0, 3).join(" ");
}
