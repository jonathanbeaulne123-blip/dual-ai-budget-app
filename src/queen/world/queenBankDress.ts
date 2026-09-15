import type { BankForm } from "./queenBankSculpture.ts";

/**
 * How a kitty bank is dressed for its purpose (2026-09-15).
 *
 * Jonathan: "we need more unique shapes, hats, props, anything to make it
 * extremely clear what purpose each bank serves." The body was already the
 * purpose (one silhouette each, `BANK_SCULPT`); this adds one **dressing** per
 * purpose so the purpose reads from across the room, the way a postman reads
 * from his cap before you see the letters:
 *
 * - a **house bill** is the postman's cat: a peaked cap slid back on her head
 *   and an envelope leaning on her paws — bills arrive in the post;
 * - a **recurring payment** (a loan, an insurance, a transit pass) is the
 *   wind-up cat: a clockwork key in her back — it goes again on its own;
 * - a **subscription** wears a collar with a bell — it rings every month;
 * - an **appointment** wears a calendar leaf as a hat, a ring through its top
 *   and the day's corner folded — it is on a date;
 * - a **planned expense** is frosted glass under a folded paper hat — a plan
 *   on paper, nothing posted yet;
 * - a **goal** (the loft's Build bank) plants a pennant beside her — something
 *   to reach;
 * - a **month on the ribbon** stays bare: every jar is the same jar.
 *
 * Every piece is placed so the crown stays free — the open slot still accepts
 * and the lid still refuses, in front of any hat. Pure data: both renderers
 * (`queenBankSculpture` in three.js, `QueenBankFlat` in SVG) read this one
 * table, and the words go into the accessible names and the cellar's key line.
 * No money is read here.
 */
export type BankHat = "none" | "cap" | "calendar" | "paper";
export type BankBack = "none" | "key";
export type BankCollar = "none" | "bell";
export type BankFoot = "none" | "envelope" | "flag";

export type BankDress = { hat: BankHat; back: BankBack; collar: BankCollar; foot: BankFoot };

export const BANK_DRESS: Record<BankForm, BankDress> = {
  jar: { hat: "none", back: "none", collar: "none", foot: "none" },
  goal: { hat: "none", back: "none", collar: "none", foot: "flag" },
  bill: { hat: "cap", back: "none", collar: "none", foot: "envelope" },
  recurring: { hat: "none", back: "key", collar: "none", foot: "none" },
  subscription: { hat: "none", back: "none", collar: "bell", foot: "none" },
  appointment: { hat: "calendar", back: "none", collar: "none", foot: "none" },
  planned: { hat: "paper", back: "none", collar: "none", foot: "none" },
};

/** The dressing in words, for the accessible name and the line beneath the gate. Empty for a bare jar. */
export const BANK_DRESS_WORDS: Record<BankForm, string> = {
  jar: "",
  goal: "a pennant planted beside her",
  bill: "a postman's cap and an envelope",
  recurring: "a wind-up key in her back",
  subscription: "a collar with a bell",
  appointment: "a calendar leaf for a hat",
  planned: "a folded paper hat",
};

/** The pieces a form wears, in the order a reader would name them. */
export function bankDressPieces(form: BankForm): Array<BankHat | BankBack | BankCollar | BankFoot> {
  const d = BANK_DRESS[form];
  return [d.hat, d.back, d.collar, d.foot].filter((piece): piece is Exclude<typeof piece, "none"> => piece !== "none");
}
