import { formatCad } from "./money.ts";
import { hourInToronto, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { monthSummary } from "./budget.ts";
import { householdWallet } from "./accounts.ts";
import { appointmentPublicTitle, outstandingClaims, upcomingVisitBoard } from "./appointments.ts";
import { buildMonthBoard, isOutgoingBill } from "./board.ts";
import { activeOpenShift, previewHoursLabel } from "./shiftClock.ts";
import { herculesPageBrief, kettlePhase, type HearthTab } from "./hercules.ts";
import { leftoverProjection } from "./sitDown.ts";
import type { Household } from "./types.ts";
import type { LedgerView } from "./types.ts";
import type { HerculesNumberSource } from "./herculesProvenance.ts";
import type { InstrumentId } from "./officeLayout.ts";

function cardChip(name: string | null | undefined): string {
  return name ? `What's on the ${name}?` : "What's on the Visa?";
}

export type HerculesPageSurface = {
  tab: HearthTab;
  spoken: string;
  lesson: string | null;
  chips: string[];
  placeholder: string;
  fact: { label: string; value: string; source?: HerculesNumberSource } | null;
};

function visitFact(household: Household, today: DateKey): { label: string; value: string } | null {
  const next = upcomingVisitBoard(household, today)[0];
  if (!next) return null;
  const appointment = household.appointments.find((row) => row.id === next.appointmentId);
  const title = appointment ? appointmentPublicTitle(appointment, "hercules") : next.title;
  return { label: "Next visit", value: `${next.date} · ${title}` };
}

function billFact(household: Household, today: DateKey): { label: string; value: string } | null {
  const next = buildMonthBoard(household, monthKeyFromDateKey(today), today).upcoming
    .find(isOutgoingBill);
  if (!next) return null;
  return { label: "Next date", value: `${next.date} · ${next.title}` };
}

export function herculesPageSurface(
  tab: HearthTab,
  household: Household,
  today: DateKey,
  now = new Date(),
  context: { memberId: string; view: LedgerView } = { memberId: household.members[0]?.id ?? "", view: "household" },
): HerculesPageSurface {
  const spoken = herculesPageBrief(household, tab, today, now);
  const month = monthSummary(household, monthKeyFromDateKey(today));
  const wallet = householdWallet(household, today);
  const leftover = leftoverProjection(household, today);
  const owing = outstandingClaims(household)[0];
  const punch = activeOpenShift(household.kitchen);

  if (tab === "add") {
    return {
      tab,
      spoken,
      lesson: "Confirm still writes.",
      chips: [],
      placeholder: "loafing…",
      fact: punch ? { label: "On the clock", value: previewHoursLabel(punch.startedAt, now.getTime()) } : null,
    };
  }

  if (tab === "plan") {
    return {
      tab,
      spoken,
      lesson: "Leftover is cash-like minus bills and card mins. Confirm parks goal cash in Goals savings.",
      chips: ["Sit-down?", "Leftover?", "We good?"],
      placeholder: "ask about the plan…",
      fact: { label: "Leftover", value: formatCad(leftover.leftoverCents), source: { route: "plan", view: context.view, surface: "postcard", label: "Open the sit-down calculation" } },
    };
  }

  if (tab === "calendar") {
    return {
      tab,
      spoken,
      lesson: "Dates remind. Mark paid writes.",
      chips: ["Which bill?", "What's owed?", "Start this goal"],
      placeholder: "ask about a date…",
      fact: visitFact(household, today) ?? billFact(household, today),
    };
  }

  if (tab === "ledger") {
    return {
      tab,
      spoken,
      lesson: "Fieldwork. The journal is the source.",
      chips: ["Opinion?", "Working capital?", "Balance sheet"],
      placeholder: "ask the books…",
      fact: { label: "Month net", value: formatCad(month.netActualCents), source: { route: "ledger", view: context.view, label: "Open the income statement" } },
    };
  }

  if (tab === "more") {
    return {
      tab,
      spoken,
      lesson: "Health is the adult screen.",
      chips: ["Health", "What broke?", "We good?"],
      placeholder: "ask Health…",
      fact: owing ? { label: "Owed to us", value: formatCad(owing.expectedCents - owing.receivedCents - owing.writtenOffCents), source: { route: "calendar", view: context.view, surface: "claims", claimId: owing.id, label: "Open the claim" } } : {
        label: "Hour",
        value: `${hourInToronto(now)}h ${kettlePhase(today, hourInToronto(now))}`,
      },
    };
  }

  const hot = wallet.hottestCard;
  return {
    tab: "home",
    spoken,
    lesson: punch
      ? "Hours are a preview until sign-out Confirm."
      : "The desk projects the books. Confirm still posts.",
    chips: punch
      ? ["Log shift", cardChip(hot?.account.name), "We good?"]
      : ["We good?", cardChip(hot?.account.name), "What now?"],
    placeholder: "ask Hercules…",
    fact: punch
      ? { label: "On the clock", value: previewHoursLabel(punch.startedAt, now.getTime()), source: { route: "home", view: context.view, surface: "timesheet", memberId: context.memberId, label: "Open the timesheet" } }
      : hot
        ? { label: hot.account.name, value: formatCad(hot.owedCents), source: { route: "ledger", view: context.view, surface: "wallet", accountId: hot.account.id, label: `Open ${hot.account.name}` } }
        : { label: "Month net", value: formatCad(month.netActualCents), source: { route: "ledger", view: context.view, label: "Open the income statement" } },
  };
}

export type HerculesInstrumentSurface = {
  id: InstrumentId | "window";
  spoken: string;
  lesson: string;
  chips: string[];
  pose: "pounce" | "perch" | "loaf" | "stretch";
};

/** Sample questions when a desk instrument opens. He still never posts. */
export function herculesInstrumentSurface(
  id: InstrumentId | "window",
  household: Household,
  today: DateKey,
): HerculesInstrumentSurface {
  const wallet = householdWallet(household, today);
  const hot = wallet.hottestCard;
  const punch = activeOpenShift(household.kitchen);
  const visit = upcomingVisitBoard(household, today)[0];
  const bill = buildMonthBoard(household, monthKeyFromDateKey(today), today).upcoming.find(isOutgoingBill);

  const table: Record<InstrumentId | "window", HerculesInstrumentSurface> = {
    window: {
      id: "window",
      spoken: "Rain stays on the glass. Numbers stay on paper.",
      lesson: "Weather is atmosphere. It never carries CAD.",
      chips: ["We good?", "What now?"],
      pose: "perch",
    },
    calculator: {
      id: "calculator",
      spoken: punch ? "Pad's for tips mid-shift. Confirm still posts the shift." : "Milk — ordinary groceries. Confirm posts them.",
      lesson: "The pad previews. Confirm posts. Shift math on the pad never writes.",
      chips: ["Groceries", "Log shift", "We good?"],
      pose: "pounce",
    },
    blotter: {
      id: "blotter",
      spoken: "That's the month pressed into paper. I read it. I don't write it.",
      lesson: "Net is a projection of posted rows.",
      chips: ["Opinion?", "Working capital?", "Balance sheet"],
      pose: "loaf",
    },
    wallet: {
      id: "wallet",
      spoken: hot ? `What's on the ${hot.account.name}? Paydown is a transfer.` : "Cash on the tray. Paydown is a transfer.",
      lesson: "The tray is the running books. Statement owed is the cycle. Paydown is never an expense.",
      chips: [cardChip(hot?.account.name), "Pay the card?", "We good?"],
      pose: "perch",
    },
    accounts: {
      id: "accounts",
      spoken: "Balances and last posts. Bank apps taught tiles. We still have no bank feed.",
      lesson: "Mint overview, YNAB envelope facts. Confirm still posts from Add.",
      chips: [cardChip(hot?.account.name), "Working capital?", "We good?"],
      pose: "perch",
    },
    calendar: {
      id: "calendar",
      spoken: bill ? `Which bill? ${bill.title} is a date, not a post.` : "Dates remind. Mark paid writes.",
      lesson: "Shifts, visits, bills, and owed-to-us land on the same board. None of those taps post.",
      chips: ["Which bill?", "What's owed?", "Calendar"],
      pose: "stretch",
    },
    appointments: {
      id: "appointments",
      spoken: visit ? "A visit is on the board. Start this goal is your tap, not mine." : "No visit on the horizon. Quiet titles stay coded in my mouth.",
      lesson: "I propose goals. A human starts them.",
      chips: ["Start this goal", "What's owed?", "Calendar"],
      pose: "loaf",
    },
    mail: {
      id: "mail",
      spoken: "Bills live here. Paychecks do not. Bianca pay is income, not a bill.",
      lesson: "Mark paid still Confirm + postEntry.",
      chips: ["Which bill?", "Calendar", "What now?"],
      pose: "pounce",
    },
    claims: {
      id: "claims",
      spoken: "Owed to us. Settlement is a transfer. Never income.",
      lesson: "When it lands, settle. I don't write the transfer.",
      chips: ["What's owed?", "Calendar", "We good?"],
      pose: "perch",
    },
    timesheet: {
      id: "timesheet",
      spoken: punch ? "You're on the clock. Hours are a preview until sign-out Confirm." : "Clock in starts a preview. A new day is just a clock.",
      lesson: "Punch is not a post. Confirm still posts the shift.",
      chips: ["Log shift", "Tips this week", "We good?"],
      pose: punch ? "pounce" : "stretch",
    },
    chalkboard: {
      id: "chalkboard",
      spoken: "Draw or type. Save keeps it. Delete only — chalk never posts.",
      lesson: "Weather sits on the glass. Confirm still posts groceries.",
      chips: ["Groceries", "Remember payday", "We good?"],
      pose: "loaf",
    },
    wardrobe: {
      id: "wardrobe",
      spoken: "Hats, chains, the house — outfits only. Kitchen ledger notes live with the groceries.",
      lesson: "Cosmetics never post. Remember … keeps a note.",
      chips: ["Remember payday", "Opinion?", "We good?"],
      pose: "loaf",
    },
    postcard: {
      id: "postcard",
      spoken: "Sit-down is three acts. Confirm still moves leftover. I clap.",
      lesson: "Plan is dollars. I just clap.",
      chips: ["Sit-down?", "Leftover?", "We good?"],
      pose: "perch",
    },
    cookoff: {
      id: "cookoff",
      spoken: "Kitchen vs takeout: groceries feed you twice; coffee & lunches feed the till.",
      lesson: "Nobody gets named. That's the point.",
      chips: ["Groceries", "Why?", "We good?"],
      pose: "pounce",
    },
    jars: {
      id: "jars",
      spoken: "Pigs — goal envelopes — fill from posted contributions. Cash lives in Goals savings.",
      lesson: "Contribute on Plan. Mark purchased posts an expense from Goals savings.",
      chips: ["Start this goal", "Sit-down?", "Leftover?"],
      pose: "loaf",
    },
    lamp: {
      id: "lamp",
      spoken: "Dark lamp, clean Health. Lit lamp, look at More.",
      lesson: "Health is the adult screen. I hide when it's dirty.",
      chips: ["Health", "What broke?", "We good?"],
      pose: "stretch",
    },
    tictactoe: {
      id: "tictactoe",
      spoken: "Your move. Two phones. No CAD on the grid.",
      lesson: "Turn-based. Games never post.",
      chips: ["We good?", "Groceries", "What now?"],
      pose: "pounce",
    },
    hangman: {
      id: "hangman",
      spoken: "Household words — milk (groceries), hydro, visor. Not the Tuesday visit.",
      lesson: "Guessing is a kitchen scribble. Quiet titles stay off the board.",
      chips: ["Groceries", "We good?", "What now?"],
      pose: "pounce",
    },
    opinion: {
      id: "opinion",
      spoken: "That's the auditor's stamp. I read the books. I don't write them.",
      lesson: "Opinion is a projection of Health and statements. Confirm still posts.",
      chips: ["Opinion?", "Working capital?", "We good?"],
      pose: "loaf",
    },
    leftover: {
      id: "leftover",
      spoken: "Leftover is cash-like minus bills minus card minimums. Not month net.",
      lesson: "Sit-down moves leftover. I clap. Confirm still writes.",
      chips: ["Leftover?", "Sit-down?", "We good?"],
      pose: "perch",
    },
    nextDue: {
      id: "nextDue",
      spoken: "Dates remind. Mark paid writes.",
      lesson: "Next bill is an outflow. Paychecks are not bills.",
      chips: ["Which bill?", "Calendar", "What now?"],
      pose: "stretch",
    },
    sync: {
      id: "sync",
      spoken: "Sharing is a freshness light, not a second ledger.",
      lesson: "This phone's replica. Confirm still posts locally first.",
      chips: ["We good?", "What now?", "Health"],
      pose: "stretch",
    },
    four: {
      id: "four",
      spoken: "Pine versus copper. Two phones. No CAD in the grid.",
      lesson: "Turn-based kitchen scribble. Games never post.",
      chips: ["We good?", "Groceries", "What now?"],
      pose: "pounce",
    },
    fleet: {
      id: "fleet",
      spoken: "Milk, Visa, Hydro, Jar, Pad — household-safe names. Fog of war, not the journal.",
      lesson: "Kitchen Fleet never posts. Quiet titles stay off the board.",
      chips: ["Groceries", "We good?", "What now?"],
      pose: "pounce",
    },
    panes: {
      id: "panes",
      spoken: "Mullions on the glass. Boxes are play. Rain still has no CAD.",
      lesson: "Pane Boxes never post. Weather stays atmosphere.",
      chips: ["We good?", "Groceries", "What now?"],
      pose: "pounce",
    },
  };
  return table[id];
}
