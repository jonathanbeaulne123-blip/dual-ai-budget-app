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
import type { BooksAsk } from "./askBooks.ts";
import type { Household } from "./types.ts";
import { householdWallet } from "./accounts.ts";
import { shiftPostingStreak } from "./shiftStreak.ts";

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
  | "attack";

export type HerculesTalk = {
  spoken: string;
  lesson: string | null;
  fact: { label: string; value: string } | null;
  replies: string[];
  pose: HerculesPose;
  topic: string;
  attention: boolean;
};

const MAX_SPOKEN = 110;

function clip(text: string, max = MAX_SPOKEN): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 48 ? space : max - 1).replace(/[,:;.–-]$/, "")}…`;
}

function oneFact(rows: { label: string; value: string }[]): HerculesTalk["fact"] {
  const row = rows[0];
  return row ? { label: row.label, value: row.value } : null;
}

function poseFromMood(mood: CompanionMood, celebrating: boolean): HerculesPose {
  if (celebrating) return "celebrate";
  if (mood === "hiding") return "hide";
  if (mood === "restless") return "pace";
  if (mood === "glowing") return "loaf";
  return "loaf";
}

function repliesFor(mood: CompanionMood, tab: HearthTab, topic: string): string[] {
  if (topic === "identity") return ["Opinion?", "Scratch"];
  if (topic === "opinion") return ["Working capital?", "Balance sheet"];
  if (topic === "fieldwork") return ["Opinion?", "Policies?"];
  if (topic === "wallet") return ["Pay the card?", "What's on the Visa?"];
  if (topic === "cook") return ["Why?", "Milk"];
  if (topic === "bills") return ["Calendar", "What now?"];
  if (topic === "health") return ["Health", "What now?"];
  if (topic === "forecast") return ["Tips this week", "We good?"];
  if (topic === "shift") return ["Log shift", "We good?"];
  if (mood === "hiding") return ["Health", "What broke?"];
  if (mood === "restless") return ["Which bill?", "What now?"];
  if (tab === "calendar") return ["Which bill?", "We good?"];
  if (tab === "ledger") return ["Opinion?", "Working capital?"];
  if (tab === "plan") return ["Sit-down?", "We good?"];
  return ["We good?", "What now?", "Milk"];
}

export function herculesNeedsCheck(household: Household, today: DateKey): boolean {
  const name = household.kitchen.companion.name || "Hercules";
  const { mood } = companionMood(household, today, name);
  if (mood === "hiding" || mood === "restless") return true;
  return !household.transactions.some((tx) => !tx.isDuplicate && tx.date === today && tx.subcategoryId === "SUB-FOOD-GROCERIES");
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
  return {
    spoken,
    lesson: null,
    fact: oneFact(ask.rows),
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
    } else if (sunday) {
      const recap = weekRecap(household, today);
      spoken = clip(recap.rows[0] ? `Sunday. Out ${recap.rows[0].value} this week.` : "Sunday. Tap me for the week.");
      lesson = "One breath. Then go live your life.";
      topic = "recap";
    } else if (phase === "morning") {
      spoken = "Mrrp. Morning. Coffee counts. Groceries count more.";
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
      spoken = "I'm here. Scratch me or ask a number.";
    }
  } else if (phase === "morning") {
    spoken = "Mrrp. Morning. Coffee counts. Groceries count more.";
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
    spoken = "I'm here. Scratch me or ask a number.";
  }

  return {
    spoken,
    lesson,
    fact: null,
    replies: repliesFor(view.mood, tab, topic).slice(0, 3),
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
      replies: ["Milk", "We good?"],
      pose: "pounce",
      topic: "cook",
      attention: false,
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

  const ask = askHercules(household, question, today);
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
  } else if (/visa|pay the card|utilization|cashback|rewards|savings|tfsa/.test(q)) {
    topic = "wallet";
    lesson = "Paydown is a transfer. Interest is a look until you post it.";
  } else if (/alright|we good|health/.test(q)) {
    topic = "health";
    lesson = "If I'm hiding, start at Health. If I'm loafing, you're fine.";
  } else if (/postcard|sit-?down/.test(q)) {
    topic = "postcard";
    const card = sitDownPostcard(household);
    lesson = card.ready ? "The close lives on the chalkboard if you pin it." : "Plan → Apply is the close. I just clap.";
  } else if (/recap|envelope/.test(q)) {
    topic = "recap";
    lesson = "Screenshot the bubble. Don't screenshot a lecture.";
  }

  const talk = talkFromAsk(household, ask, today, tab, topic);
  talk.lesson = lesson;
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
