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
  fact: { label: string; value: string } | null;
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
      lesson: "Leftover is cash-like minus bills and card mins. Confirm parks jars in the Goals vault.",
      chips: ["Sit-down?", "Leftover?", "We good?"],
      placeholder: "ask about the plan…",
      fact: { label: "Leftover", value: formatCad(leftover.leftoverCents) },
    };
  }

  if (tab === "calendar") {
    return {
      tab,
      spoken,
      lesson: "Dates remind. Mark paid writes.",
      chips: ["Which bill?", "What's owed?", "Start this jar"],
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
      fact: { label: "Month net", value: formatCad(month.netActualCents) },
    };
  }

  if (tab === "more") {
    return {
      tab,
      spoken,
      lesson: "Health is the adult screen.",
      chips: ["Health", "What broke?", "We good?"],
      placeholder: "ask Health…",
      fact: owing ? { label: "Owed to us", value: formatCad(owing.expectedCents - owing.receivedCents - owing.writtenOffCents) } : {
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
      ? { label: "On the clock", value: previewHoursLabel(punch.startedAt, now.getTime()) }
      : hot
        ? { label: hot.account.name, value: formatCad(hot.owedCents) }
        : { label: "Month net", value: formatCad(month.netActualCents) },
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
      spoken: punch ? "Pad's for tips mid-shift. Confirm still posts the shift." : "Milk is the ordinary grocery. Confirm writes it.",
      lesson: "The pad previews. Confirm posts. Shift math on the pad never writes.",
      chips: ["Milk", "Log shift", "We good?"],
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
      spoken: visit ? "A visit is on the board. Start this jar is your tap, not mine." : "No visit on the horizon. Quiet titles stay coded in my mouth.",
      lesson: "I propose jars. A human starts them.",
      chips: ["Start this jar", "What's owed?", "Calendar"],
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
      spoken: "Scribble. Neaten stays on this phone. bought opens Add.",
      lesson: "Chalk never posts. Confirm still writes milk.",
      chips: ["Milk", "Remember payday", "We good?"],
      pose: "loaf",
    },
    wardrobe: {
      id: "wardrobe",
      spoken: "Hats, chains, the house. Kitchen ledger notes live with the milk.",
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
      spoken: "Kitchen versus till. Groceries feed you twice.",
      lesson: "Nobody gets named. That's the point.",
      chips: ["Milk", "Why?", "We good?"],
      pose: "pounce",
    },
    jars: {
      id: "jars",
      spoken: "Pigs fill from posted contributions. Cash lives in the Goals vault.",
      lesson: "Contribute on Plan. Purchased? posts an expense from the vault.",
      chips: ["Start this jar", "Sit-down?", "Leftover?"],
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
      chips: ["We good?", "Milk", "What now?"],
      pose: "pounce",
    },
    hangman: {
      id: "hangman",
      spoken: "Household words. Milk, hydro, visor. Not the Tuesday visit.",
      lesson: "Guessing is a kitchen scribble. Quiet titles stay off the board.",
      chips: ["Milk", "We good?", "What now?"],
      pose: "pounce",
    },
  };
  return table[id];
}
