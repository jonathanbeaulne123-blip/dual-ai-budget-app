/**
 * Which toy stands for a stop (Horizon Clock, L3; pure). The prototype's props, chosen from what the stop IS — its
 * kind, origin, board kind, set-aside pot and (for bills) a few plain label words. Never from an amount or a status:
 * the toy says WHAT, the coin stack under it says HOW MUCH and whether it is recorded.
 */
import type { Stop } from "../contracts.ts";

export type PropKind =
  | "pay" | "fund" | "rent" | "phone" | "internet" | "gas" | "hydro" | "music" | "vet" | "umbrella" | "groceries" | "tooth"
  | "jar" | "coin" | "campfire" | "flag" | "star" | "pin" | "home" | "heart";

/** Label words → toy, first match wins (bills only). Plain household words; an unknown bill is a coin. */
const BILL_WORDS: readonly [RegExp, PropKind][] = [
  [/\b(rent|mortgage|condo|strata)\b/i, "rent"],
  [/\b(phones?|mobile|cell)\b/i, "phone"],
  [/\b(internet|wi-?fi|broadband|isp)\b/i, "internet"],
  [/\b(gas|enbridge|fuel)\b/i, "gas"],
  [/\b(hydro|electric|electricity|power|water)\b/i, "hydro"],
  [/\b(spotify|music|netflix|stream|streaming|subscription|disney|crave)\b/i, "music"],
  [/\b(vet|veterinar)/i, "vet"],
  [/\b(insurance|insure)\b/i, "umbrella"],
  [/\b(groceries|grocery|food|market)\b/i, "groceries"],
  [/\b(dentist|dental|hygienist|tooth|teeth|doctor|clinic|physio)\b/i, "tooth"],
];

export function propKindFor(stop: Stop): PropKind {
  switch (stop.kind) {
    case "income":
      return stop.origin === "fund-estimate" || stop.origin === "fund-confirmed" ? "fund" : "pay";
    case "commitment": {
      // Money set aside in a pot is a standing jar (set aside is NOT paid; the stack under it says so).
      if (stop.setAside) return "jar";
      for (const [words, kind] of BILL_WORDS) if (words.test(stop.label)) return kind;
      if (stop.boardKind === "subscription") return "music";
      if (stop.boardKind === "potential-expense") return "groceries";
      if (stop.boardKind === "visit") return "tooth";
      return "coin";
    }
    case "review":
      return stop.reviewKind === "weekly-sitdown" ? "flag" : "campfire";
    case "plan":
      return stop.planKind === "goal" ? "star" : "pin";
    case "milestone":
      return "home";
    case "memory":
      return "heart";
  }
}
