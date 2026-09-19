/**
 * The loft's money gun (2026-09-15).
 *
 * Jonathan: "there needs to be a money gun that takes from the household fund
 * to throw cash into the desired kitty banks. users should be able to visibly
 * watch the kitty bank grow as it fills up."
 *
 * The gun is the jug aimed at one bank at a time. Each shot is a bill of the
 * chosen size thrown at a bank; shots only add up here, on this device, and
 * nothing moves until the round is sent. A round is posted once, behind the
 * app's Confirm, through the Fund's existing month-end rollover
 * (`allocateHouseholdFundSurplus`) — so the custodian alone may fire, the
 * round can never exceed the Fund's safe surplus, and a bank is never shot past
 * its target. No new money writer; everything here is pure and exact in cents.
 */
export const GUN_BILLS = [500, 2_000, 5_000, 10_000] as const;
export type GunBill = (typeof GUN_BILLS)[number];
export type GunTarget = { goalId: string; name: string; amountCents: number; targetCents: number };
/** The round so far: cents thrown at each goal, in the order first hit. */
export type GunRound = ReadonlyArray<{ goalId: string; cents: number }>;

export const gunRoundTotal = (round: GunRound) => round.reduce((sum, row) => sum + row.cents, 0);
export const gunLanded = (round: GunRound, goalId: string) => round.find((row) => row.goalId === goalId)?.cents ?? 0;

/** Room left in a bank before it reaches its target, after what this round has already thrown at it. */
export function gunRoom(target: GunTarget, round: GunRound): number {
  return Math.max(0, target.targetCents - Math.max(0, target.amountCents) - gunLanded(round, target.goalId));
}

/**
 * One shot. The bill is trimmed to what the bank still has room for and to what
 * is left of the safe surplus; a shot that can land nothing changes nothing.
 */
export function gunFire(round: GunRound, target: GunTarget, bill: number, safeCents: number): { round: GunRound; landed: number; why: "landed" | "trimmed" | "full" | "empty" } {
  if (!Number.isSafeInteger(bill) || bill <= 0) return { round, landed: 0, why: "empty" };
  const room = gunRoom(target, round);
  const left = Math.max(0, safeCents - gunRoundTotal(round));
  if (room <= 0) return { round, landed: 0, why: "full" };
  if (left <= 0) return { round, landed: 0, why: "empty" };
  const landed = Math.min(bill, room, left);
  const next = round.some((row) => row.goalId === target.goalId)
    ? round.map((row) => (row.goalId === target.goalId ? { ...row, cents: row.cents + landed } : row))
    : [...round, { goalId: target.goalId, cents: landed }];
  return { round: next, landed, why: landed < bill ? "trimmed" : "landed" };
}

/** The studio growth step a bank would stand at with this round in it. */
export function gunStep(target: Pick<GunTarget, "amountCents" | "targetCents">, landedCents: number): number {
  if (target.targetCents <= 0) return 0;
  return Math.max(0, Math.min(10, Math.floor(((Math.max(0, target.amountCents) + landedCents) / target.targetCents) * 10)));
}

/** The round in words, for the line and for Confirm. */
export function gunWords(round: GunRound, names: ReadonlyMap<string, string>, safeCents: number, format: (cents: number) => string): string {
  const total = gunRoundTotal(round);
  if (!total) return `Aim at a bank and fire; nothing moves until you send it. ${format(safeCents)} of the Fund's safe surplus is loaded.`;
  const parts = round.filter((row) => row.cents > 0).map((row) => `${format(row.cents)} at ${names.get(row.goalId) ?? "a bank"}`);
  return `${parts.join(", ")} — ${format(total)} thrown, ${format(Math.max(0, safeCents - total))} still loaded.`;
}
