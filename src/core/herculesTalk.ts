import { hourInToronto, weekdaySunday0, type DateKey } from "./calendar.ts";
import { companionMood, describeCompanion, type CompanionMood } from "./companion.ts";
import {
  askHercules,
  cookOffScore,
  groceryHighFive,
  kettlePhase,
  shiftForecastDisplay,
  sitDownPostcard,
  weekRecap,
  type HearthTab,
} from "./hercules.ts";
import { formatCad } from "./money.ts";
import type { BooksAsk, HerculesAskContext } from "./askBooks.ts";
import { herculesFactId, type HerculesGroundedFact, type HerculesNumberSource } from "./herculesProvenance.ts";
import type { Household } from "./types.ts";
import { householdWallet } from "./accounts.ts";
import { claimsTraySentence, outstandingClaims, upcomingVisitProposals } from "./appointments.ts";
import { bubbleNotice, deskNotices } from "./notices.ts";
import { shiftPostingStreak } from "./shiftStreak.ts";
import { herculesPageSurface } from "./herculesPage.ts";
import { herculesUsefulness } from "./herculesUsefulness.ts";
import { memoryFactForTopic, topicUsesKitchenMemories } from "./herculesLedger.ts";

export type HerculesPose =
  | "loaf"
  | "walk"
  | "jump"
  | "stretch"
  | "wash"
  | "sleep"
  | "hide"
  | "pace"
  | "celebrate"
  | "pounce"
  | "perch"
  | "lick"
  | "bump"
  | "attack"
  | "sit"
  | "beg"
  | "bag";

export type HerculesTalk = {
  spoken: string;
  lesson: string | null;
  fact: { label: string; value: string; source?: HerculesNumberSource } | null;
  /** Structured, clickable claims. Never inferred from prose. */
  facts?: HerculesGroundedFact[];
  replies: string[];
  pose: HerculesPose;
  topic: string;
  attention: boolean;
};

const MAX_SPOKEN = 140;

function clip(text: string, max = MAX_SPOKEN): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 48 ? space : max - 1).replace(/[,:;.–-]$/, "")}…`;
}

function oneFact(rows: { label: string; value: string; source?: HerculesNumberSource }[]): HerculesTalk["fact"] {
  const row = rows[0];
  return row ? { label: row.label, value: row.value, source: row.source } : null;
}

function defaultFactSource(context: HerculesAskContext, topic: string): HerculesNumberSource {
  if (topic === "forecast" || topic === "shift" || topic === "timesheet") {
    return { route: "home", view: context.view, surface: "timesheet", label: "Open the timesheet" };
  }
  if (topic === "bills" || topic === "calendar" || topic === "claims" || topic === "visit") {
    return { route: "calendar", view: context.view, surface: topic === "claims" ? "claims" : "calendar", label: "Open Calendar" };
  }
  if (topic === "postcard" || topic === "cook" || topic === "jars") {
    return { route: "plan", view: context.view, surface: topic === "postcard" ? "postcard" : topic === "jars" ? "jars" : "cookoff", label: "Open Plan" };
  }
  if (topic === "wallet") {
    return { route: "ledger", view: context.view, surface: "wallet", label: "Open the account ledger" };
  }
  return { route: "ledger", view: context.view, label: "Open the journal source" };
}

function poseFromMood(mood: CompanionMood, celebrating: boolean): HerculesPose {
  if (celebrating) return "celebrate";
  if (mood === "hiding") return "hide";
  if (mood === "restless") return "pace";
  if (mood === "glowing") return "loaf";
  return "loaf";
}

function repliesFor(mood: CompanionMood, tab: HearthTab, topic: string): string[] {
  if (topic === "identity") return ["Opinion?", "Scratch — say hi"];
  if (topic === "opinion") return ["Working capital?", "Balance sheet"];
  if (topic === "fieldwork") return ["Opinion?", "Policies?"];
  if (topic === "wallet" || topic === "accounts") return ["Pay the card?", "What's on the Visa?"];
  if (topic === "cook") return ["Why?", "Groceries"];
  if (topic === "bills" || topic === "calendar" || topic === "mail") return ["Calendar", "What now?"];
  if (topic === "health") return ["Health", "What now?"];
  if (topic === "forecast") return ["Tips this week", "We good?"];
  if (topic === "shift" || topic === "timesheet") return ["Log shift", "We good?"];
  if (topic === "wardrobe") return ["Remember payday", "Opinion?"];
  if (topic === "jars") return ["Start this goal", "Sit-down?"];
  if (topic === "tictactoe" || topic === "hangman" || topic === "game") return ["We good?", "Groceries"];
  if (topic === "chalkboard") return ["Groceries", "We good?"];
  if (topic === "claims") return ["What's owed?", "Start this goal"];
  if (topic === "visit") return ["Start this goal", "Calendar"];
  if (topic === "notice") return ["Save as preset", "What now?"];
  if (mood === "hiding") return ["Health", "What broke?"];
  if (mood === "restless") return ["Which bill?", "What now?"];
  if (tab === "calendar") return ["Which bill?", "What's owed?", "Start this goal"];
  if (tab === "ledger") return ["Opinion?", "Working capital?"];
  if (tab === "plan") return ["Sit-down?", "Leftover?", "We good?"];
  if (tab === "more") return ["Health", "What broke?", "We good?"];
  return ["We good?", "What now?", "Groceries"];
}

export function herculesNeedsCheck(household: Household, today: DateKey): boolean {
  const name = household.kitchen.companion.name || "Hercules";
  const { mood } = companionMood(household, today, name);
  if (mood === "hiding" || mood === "restless") return true;
  return herculesUsefulness(household, today).light === "green";
}

export function herculesMutters(household: Household, today: DateKey, now = new Date()): boolean {
  const name = household.kitchen.companion.name || "Hercules";
  const { mood } = companionMood(household, today, name);
  if (mood === "hiding" || mood === "restless") return true;
  const streak = shiftPostingStreak(household, today);
  return streak.waiting && kettlePhase(today, hourInToronto(now)) === "after-shift";
}

export function talkFromAsk(
  household: Household,
  ask: BooksAsk,
  today: DateKey,
  tab: HearthTab,
  topic: string,
  context: HerculesAskContext = { memberId: household.members[0]?.id ?? "", view: "household" },
): HerculesTalk {
  const name = household.kitchen.companion.name || "Hercules";
  const { mood } = companionMood(household, today, name);
  const five = groceryHighFive(household, today);
  const spoken = clip(ask.sentence
    .replace(/\bThis is a projection, not permission\.?/gi, "")
    .replace(/\bHe never posts money\.?/gi, "")
    .replace(/\bI will answer from the journal\.?/gi, "")
    .replace(/\bPower SQL stays read-only\.?/gi, "")
    .replace(/\bNot a leaderboard\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim());
  const fallbackSource = ask.source ?? defaultFactSource(context, topic);
  const facts = ask.rows.map((row, index) => ({
    id: herculesFactId(row.label, row.value, index),
    label: row.label,
    value: row.value,
    source: row.source ?? fallbackSource,
    basis: row.basis ?? "journal" as const,
  }));
  return {
    spoken,
    lesson: null,
    fact: oneFact(ask.rows),
    facts,
    replies: repliesFor(mood, tab, topic).slice(0, 3),
    pose: poseFromMood(mood, five.yes),
    topic,
    attention: herculesNeedsCheck(household, today),
  };
}

export function herculesIdle(
  household: Household,
  tab: HearthTab,
  today: DateKey,
  now = new Date(),
): HerculesTalk {
  const view = describeCompanion(household, today);
  const five = groceryHighFive(household, today);
  const phase = kettlePhase(today, hourInToronto(now));
  const sunday = weekdaySunday0(today) === 0;
  let spoken: string;
  let lesson: string | null = null;
  let topic = "idle";
  let pose = poseFromMood(view.mood, five.yes);

  if (five.yes) {
    spoken = `${five.names.join(" and ")} both bought food. That's the move.`;
    lesson = "A household is two phones posting milk, not a lecture.";
    topic = "high-five";
    pose = "celebrate";
  } else if (view.mood === "hiding") {
    spoken = "Psst. The books are messy. I'm under here.";
    lesson = "Health first. I hide until the journal is honest.";
    topic = "health";
    pose = "hide";
  } else if (view.mood === "restless") {
    spoken = clip(view.reason);
    lesson = "Dates remind. Mark paid writes. I won't fake a fee.";
    topic = "bills";
    pose = "pace";
  } else if (tab === "add") {
    spoken = "I'll loaf. You confirm. I don't write.";
    topic = "add";
    pose = "sleep";
  } else if (tab === "ledger") {
    spoken = "Fieldwork. Trial first. Then the rec. Then I loaf.";
    lesson = "I walk the journal. I don't write it.";
    topic = "fieldwork";
    pose = "stretch";
  } else if (tab === "home") {
    const hot = householdWallet(household, today).hottestCard;
    if (hot?.utilization != null && hot.utilization >= 0.8) {
      spoken = clip(hot.hercules);
      lesson = "Paydown is a transfer. I don't invent APR.";
      topic = "wallet";
      pose = "pace";
    } else if (outstandingClaims(household)[0]) {
      spoken = clip(claimsTraySentence(household, today));
      lesson = "That is a transfer when it lands. Never income.";
      topic = "claims";
      pose = "perch";
    } else if (upcomingVisitProposals(household, today)[0]) {
      const proposal = upcomingVisitProposals(household, today)[0]!;
      spoken = clip(proposal.hercules);
      lesson = "I propose the jar. You tap Start. I don't write.";
      topic = "visit";
      pose = proposal.appointmentId && household.appointments.find((item) => item.id === proposal.appointmentId)?.memberId === "companion"
        ? "celebrate"
        : "loaf";
    } else if (sunday) {
      const recap = weekRecap(household, today);
      spoken = clip(recap.rows[0] ? `Sunday. Out ${recap.rows[0].value} this week.` : "Sunday. Tap me for the week.");
      lesson = "One breath. Then go live your life.";
      topic = "recap";
    } else if (phase === "morning") {
      spoken = "Mrrp. Morning. Coffee counts. Milk — groceries — count more.";
      lesson = "The ordinary grocery is how households stay friends.";
      topic = "morning";
      pose = "stretch";
    } else if (phase === "after-shift") {
      const streak = shiftPostingStreak(household, today);
      spoken = clip(streak.spoken);
      lesson = streak.lesson;
      topic = "shift";
      pose = streak.fresh && streak.count >= 2 ? "celebrate" : streak.waiting ? "pounce" : "loaf";
    } else if (view.mood === "glowing") {
      spoken = "Unmodified. Sunbeam. Don't jinx it.";
      lesson = "An unmodified opinion means the journal balances and Health is clean.";
      topic = "opinion";
      pose = "loaf";
    } else {
      spoken = "I'm here. Scratch — say hi — or ask a number.";
    }
  } else {
    const surface = herculesPageSurface(tab, household, today, now);
    spoken = clip(surface.spoken);
    lesson = surface.lesson;
    topic = tab;
  }

  const surface = herculesPageSurface(tab, household, today, now);
  const topicReplies = topic !== "idle" && topic !== "morning" && topic !== "recap" && topic !== "high-five";
  return {
    spoken,
    lesson,
    fact: surface.fact,
    replies: (topicReplies || five.yes || view.mood === "hiding" || view.mood === "restless" || !surface.chips.length
      ? repliesFor(view.mood, tab, topic)
      : surface.chips
    ).slice(0, 3),
    pose,
    topic,
    attention: herculesNeedsCheck(household, today),
  };
}

export function talkHercules(
  household: Household,
  question: string,
  today: DateKey,
  tab: HearthTab = "home",
  lastTopic = "",
  context: HerculesAskContext = { memberId: household.members[0]?.id ?? "", view: "household" },
): HerculesTalk {
  const q = question.trim().toLowerCase().replace(/['’]/g, "");
  const view = describeCompanion(household, today);
  const name = view.name;

  if (!q || q === "scratch" || q === "hey" || q === "mrrp") {
    const idle = herculesIdle(household, tab, today);
    idle.spoken = q === "scratch" ? "Prrrp. Still your cat. Still not a ledger." : idle.spoken;
    idle.pose = q === "scratch" ? "loaf" : idle.pose;
    return idle;
  }

  if (q === "why" && lastTopic === "cook") {
    return {
      spoken: "Groceries feed you twice. Coffee out feeds the till.",
      lesson: "Win the kitchen week. Nobody gets named. That's the point.",
      fact: null,
      replies: ["Groceries", "We good?"],
      pose: "pounce",
      topic: "cook",
      attention: false,
    };
  }

  if (/\b(what did you notice|noticed that|your notices|presets?)\b/.test(q) || /\btim hortons\b/.test(q)) {
    const bubble = bubbleNotice(household, today);
    const desk = deskNotices(household, today);
    const spoken = bubble
      ? clip(bubble.spoken)
      : desk[0]
        ? clip(desk[0].spoken)
        : "Nothing new. Post milk — ordinary groceries. I'll watch.";
    return {
      spoken,
      lesson: bubble?.lesson ?? "I notice on this phone. A tap saves a preset. I never post.",
      fact: bubble?.cad ? { label: bubble.kind, value: bubble.cad } : null,
      replies: bubble ? ["Save as preset", "Not now"] : ["We good?", "Groceries"],
      pose: "perch",
      topic: "notice",
      attention: Boolean(bubble),
    };
  }

  if (/\b(start this jar|start the jar)\b/.test(q)) {
    const proposal = upcomingVisitProposals(household, today)[0];
    return {
      spoken: proposal
        ? clip(`${proposal.hercules} Calendar → Appointments. You tap Start. I don't write.`)
        : "No jar to start. A typical cost on a visit comes first.",
      lesson: "Creating a goal is a household write. I propose. A human confirms.",
      fact: proposal ? { label: proposal.title, value: `${formatCad(proposal.weeklyCents)}/wk` } : null,
      replies: ["What's owed?", "Calendar"],
      pose: "loaf",
      topic: "visit",
      attention: herculesNeedsCheck(household, today),
    };
  }

  if (q === "why") {
    return {
      spoken: lastTopic === "bills"
        ? "Unpaid bills lie to next-you. Post them when money actually left."
        : "I only say what the journal already knows.",
      lesson: "A friend who posts for you is a thief. I won't.",
      fact: null,
      replies: ["We good?", "What now?"],
      pose: "loaf",
      topic: lastTopic || "why",
      attention: herculesNeedsCheck(household, today),
    };
  }

  const ask = askHercules(household, question, today, context);
  let topic = "ask";
  let lesson: string | null = "I read. You write. That's how we stay friends.";
  if (/who are you|maine coon|hercules|ember|your name/.test(q)) {
    topic = "identity";
    lesson = "Auditor on the counter. Big cat. Small advice.";
  } else if (/opinion|trial balance|balance sheet|p&l|cash flow|reconcil|aged|close pack|working capital|equity roll|subsequent|policies|going concern/.test(q)) {
    topic = "opinion";
    lesson = "Statements are projections. Confirm still writes. I never post.";
  } else if (/what should|what now|coach|advise/.test(q)) {
    topic = view.mood === "hiding" ? "health" : view.mood === "restless" ? "bills" : "coach";
    lesson = view.mood === "content" || view.mood === "glowing"
      ? "Budgeting is milk, then bills, then treats. In that order."
      : lesson;
  } else if (/overspend|overspent|over spent|spending habit|who spent|who paid/.test(q)) {
    topic = "member-spend";
    lesson = "Shared posts can teach a pattern. Partner-personal rows stay out of my paws.";
  } else if (/eat this week|afford.*(?:food|grocer)|food.*this week/.test(q)) {
    topic = "food";
    lesson = "I compare the groceries plan with cash-like money. I do not promise the future.";
  } else if (/income|earned|wages|tips|shift|hours worked/.test(q) && /week/.test(q)) {
    topic = /shift|hours/.test(q) ? "shift" : "income";
    lesson = "Posted shifts and income are facts. Open previews are not.";
  } else if (/cook|kitchen vs/.test(q)) {
    topic = "cook";
    const cook = cookOffScore(household, today);
    lesson = cook.winner === "kitchen" ? "You fed the house. That's the win." : "Cook louder. Takeout isn't a moral failing. It's a week.";
  } else if (/bill|due|calendar/.test(q)) {
    topic = "bills";
    lesson = "Calendar is a reminder. Confirm is the write.";
  } else if (/forecast|shift pulse/.test(q)) {
    topic = "forecast";
    const forecast = shiftForecastDisplay(household);
    lesson = forecast.unlocked ? "A pulse is a guess with homework. I won't post it." : "Eight real weeks. Then I'll talk tips.";
  } else if (/visa|mastercard|pay the card|utilization|cashback|rewards|savings|tfsa/.test(q)) {
    topic = "wallet";
    lesson = "The tray is the running books. Statement owed is the cycle. Paydown is a transfer.";
  } else if (/alright|we good|health/.test(q)) {
    topic = "health";
    lesson = "If I'm hiding, start at Health. If I'm loafing, you're fine.";
  } else if (/postcard|sit-?down|sit down|leftover/.test(q)) {
    topic = "postcard";
    const card = sitDownPostcard(household);
    lesson = card.ready ? "The close lives on the chalkboard if you pin it." : "Leftover is cash-like minus bills and card mins. Confirm still moves.";
  } else if (/recap|envelope/.test(q)) {
    topic = "recap";
    lesson = "Screenshot the bubble. Don't screenshot a lecture.";
  }

  const talk = talkFromAsk(household, ask, today, tab, topic, context);
  talk.lesson = lesson;
  const memoryFact = memoryFactForTopic(household, topic);
  if (memoryFact && (topicUsesKitchenMemories(topic) || !talk.fact)) {
    talk.fact = memoryFact;
  }
  if (topic === "identity") {
    talk.spoken = clip(`I'm ${name}. Auditor on the counter. I don't write the books.`);
    talk.pose = "pounce";
  }
  return talk;
}

export function herculesReplies(household: Household, today: DateKey, tab: HearthTab): string[] {
  const name = household.kitchen.companion.name || "Hercules";
  const { mood } = companionMood(household, today, name);
  return repliesFor(mood, tab, "idle").slice(0, 3);
}
