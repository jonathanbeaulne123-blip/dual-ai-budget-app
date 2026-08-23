import { companionMood } from "./companion.ts";
import { leftoverProjection } from "./sitDown.ts";
import { composeNotices } from "./notices.ts";
import { runHealthCheck } from "./health.ts";
import { outstandingClaims, upcomingVisitProposals } from "./appointments.ts";
import { fullOpenGoals } from "./goalVault.ts";
import { shiftPostingStreak } from "./shiftStreak.ts";
import type { DateKey } from "./calendar.ts";
import type { Household } from "./types.ts";

/**
 * How much Hercules can actually contribute right now.
 * Read-only projection — never invents CAD, never posts.
 * Green = real books insight; yellow = soft nudge; red = mostly presence.
 */
export type UsefulnessLight = "red" | "yellow" | "green";

export type HerculesUsefulness = {
  score: number;
  light: UsefulnessLight;
  reasons: string[];
  /** 0–1 animation intensity. More useful → more animated beg. */
  animation: number;
  spoken: string;
};

function lightFromScore(score: number): UsefulnessLight {
  if (score >= 55) return "green";
  if (score >= 25) return "yellow";
  return "red";
}

export function herculesUsefulness(household: Household, today: DateKey): HerculesUsefulness {
  const name = household.kitchen.companion.name || "Hercules";
  const { mood } = companionMood(household, today, name);
  const findings = runHealthCheck(household);
  const leftover = leftoverProjection(household, today);
  const notices = composeNotices(household, today);
  const claims = outstandingClaims(household);
  const visits = upcomingVisitProposals(household, today);
  const full = fullOpenGoals(household);
  const streak = shiftPostingStreak(household, today);
  const groceryToday = household.transactions.some(
    (tx) => !tx.isDuplicate && tx.date === today && tx.subcategoryId === "SUB-FOOD-GROCERIES",
  );

  let score = 8;
  const reasons: string[] = [];

  if (findings.length) {
    score += Math.min(40, 18 + findings.length * 6);
    reasons.push(findings.length === 1 ? "Health has a finding" : `${findings.length} Health findings`);
  }
  if (leftover.leftoverCents > 0) {
    score += 18;
    reasons.push("Leftover is ready for sit-down");
  }
  if (claims.length) {
    score += Math.min(16, 8 + claims.length * 3);
    reasons.push(claims.length === 1 ? "A claim is outstanding" : `${claims.length} claims outstanding`);
  }
  if (visits.length) {
    score += 10;
    reasons.push("A visit jar proposal is waiting");
  }
  if (full.length) {
    score += 14;
    reasons.push(`${full[0]!.name} is full — Purchased?`);
  }
  if (notices.length) {
    score += Math.min(12, 6 + notices.length * 2);
    reasons.push("A desk notice is open");
  }
  if (streak.waiting) {
    score += 8;
    reasons.push("Shift still needs Confirm");
  }
  if (mood === "hiding" || mood === "restless") {
    score += 10;
    reasons.push(mood === "hiding" ? "Books need a check-in" : "Something on the desk is restless");
  }
  if (!groceryToday) {
    score += 4;
    reasons.push("No grocery posted today");
  }

  score = Math.max(0, Math.min(100, score));
  const light = lightFromScore(score);
  const animation = score / 100;
  const spoken =
    light === "green"
      ? reasons[0]
        ? `Ears back. ${reasons[0]}. Tap me again and I'll open the prompts.`
        : "Ears back. I have something useful. Tap again."
      : light === "yellow"
        ? reasons[0]
          ? `mrrp — ${reasons[0]}. Tap again if you want help.`
          : "mrrp. I might help. Tap again."
        : "I'm mostly here for company. Tap again for chat anyway.";

  return { score, light, reasons: reasons.slice(0, 4), animation, spoken };
}
