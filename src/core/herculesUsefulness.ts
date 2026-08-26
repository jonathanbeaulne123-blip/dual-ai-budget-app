import { companionMood } from "./companion.ts";
import { leftoverProjection } from "./sitDown.ts";
import { composeNotices } from "./notices.ts";
import { runHealthCheck } from "./health.ts";
import { outstandingClaims, upcomingVisitProposals } from "./appointments.ts";
import { fullOpenGoals } from "./goalVault.ts";
import { shiftPostingStreak } from "./shiftStreak.ts";
import { householdWallet } from "./accounts.ts";
import type { DateKey } from "./calendar.ts";
import type { Household } from "./types.ts";

/**
 * How much Hercules can actually contribute right now.
 * Read-only projection — never invents CAD, never posts.
 * Green = real books insight; yellow = soft nudge; red = mostly presence.
 * 80+ means a loaded desk he can name without guessing (D-113).
 */
export type UsefulnessLight = "red" | "yellow" | "green";

export type HerculesUsefulness = {
  score: number;
  light: UsefulnessLight;
  reasons: string[];
  /** 0–1 animation intensity. More useful → more animated beg. */
  animation: number;
  spoken: string;
  /** First tap opens How can I help when the desk scores 80+ (D-097 / D-113). */
  openHelpOnTap: boolean;
};

export type HerculesTapIntent = "open-help" | "beg" | "close";

/** Pure tap policy so 80 usefulness is one tap, not beg-then-chat. */
export function herculesTapIntent(input: {
  openHelpOnTap: boolean;
  chatOpen: boolean;
  begging: boolean;
}): HerculesTapIntent {
  if (input.chatOpen) return "close";
  if (input.begging || input.openHelpOnTap) return "open-help";
  return "beg";
}

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
  const wallet = householdWallet(household, today);
  const hot = wallet.hottestCard;
  const habit = notices.find((item) => item.kind === "habit-preset");
  const otherNotices = notices.filter((item) => item.kind !== "habit-preset");

  let score = 12;
  const reasons: string[] = [];

  if (leftover.leftoverCents > 0) {
    score += 24;
    reasons.push("Leftover is ready for sit-down");
  } else if (leftover.shortfallCents > 0) {
    score += 8;
    reasons.push("Sit-down still runs — nothing leftover to move");
  }
  if (claims.length) {
    score += Math.min(16, 12 + (claims.length - 1) * 2);
    reasons.push(claims.length === 1 ? "A claim is outstanding" : `${claims.length} claims outstanding`);
  }
  if (visits.length) {
    score += 10;
    reasons.push("A visit goal proposal is waiting");
  }
  if (full.length) {
    score += 12;
    reasons.push(`${full[0]!.name} is full — Mark purchased`);
  }
  if (habit) {
    score += 12;
    reasons.push("Save a repeated merchant as a preset");
  }
  if (otherNotices.length) {
    score += Math.min(8, 6 + (otherNotices.length - 1) * 2);
    reasons.push("A desk notice is open");
  }
  if (streak.waiting) {
    score += 10;
    reasons.push("Shift still needs Confirm");
  }
  if (hot && hot.owedCents > 0) {
    score += 8;
    reasons.push(`${hot.account.name} still has a statement balance`);
  }
  if (findings.length) {
    score += Math.min(20, 12 + findings.length * 4);
    reasons.push(findings.length === 1 ? "Health has a finding" : `${findings.length} Health findings`);
  } else if (mood === "restless") {
    score += 8;
    reasons.push("Something on the desk is restless");
  }

  score = Math.max(0, Math.min(100, score));
  const light = lightFromScore(score);
  const animation = score / 100;
  const openHelpOnTap = score >= 80;
  const spoken =
    score >= 80
      ? reasons[0]
        ? `Ears back. ${reasons[0]}. Tap me and I'll open the prompts.`
        : "Ears back. I have leftover, a card, or a claim. Tap me."
      : light === "green"
        ? reasons[0]
          ? `Ears back. ${reasons[0]}. Tap me and I'll open the prompts.`
          : "Ears back. I have something useful. Tap me."
        : light === "yellow"
          ? reasons[0]
            ? `mrrp — ${reasons[0]}. Tap me if you want help.`
            : "mrrp. I might help. Tap me."
          : "I'm mostly here for company. Tap me for chat anyway.";

  return { score, light, reasons: reasons.slice(0, 4), animation, spoken, openHelpOnTap };
}
