import { ValidationError } from "./types.ts";

/**
 * The loft's rack (2026-09-15): shelves on the wall, and what they mean.
 *
 * Jonathan: "we need more of a shelving system than just one shelf. the
 * different shelves should act as weights. higher might get weight 5 while the
 * lowest shelf might get weight 1. or by percentage. you should be able to
 * choose a cutoff point for funding on each shelf and assign how much is being
 * split up automatically both horizontally or vertically. this should not be
 * done with information and inputs, but through physical touch." And, on the
 * shelves being fixed: "we can't make it rigid, it needs to be adjustable."
 *
 * So a rack is a short list of shelves, top first. Each shelf has:
 * - a **share** (1–10): the brass weight on its end. When money is poured over
 *   the rack, the shelves take it in proportion to their shares;
 * - a **fill mark** (0–20 twentieths): the pin on the post beside it. Once every
 *   bank on the shelf stands at that mark, the shelf is full for this pour and
 *   its share flows down to the shelves that still have room;
 * - its **banks**, left to right, each with a **split** (1–10): the dividers
 *   between them. A shelf's take is shared among its banks by their splits, a
 *   bank never taking more than its room to the mark; what a bank cannot hold
 *   moves along the shelf, then down.
 *
 * The rack is a plan, kept on the Build plan bank's own design row beside the
 * shelf's order (`kittyNestDesigns`), so one rearrangement is one save and the
 * last save wins. **It carries no money.** The pour is arithmetic over a sum
 * the books already allow — the Fund's safe surplus — and what it proposes is
 * posted only through `allocateHouseholdFundSurplus`, behind Confirm, by the
 * custodian. Everything here is pure and exact in integer cents.
 */
export const RACK_LIMITS = { shelves: 5, share: 10, split: 10, marks: 20, keys: 200 } as const;

export type RackShelfV1 = {
  id: string;
  /** 1–10: the brass weight. */
  share: number;
  /** 0–20: the pin, in twentieths of full. 20 is "to the crown". */
  cutoff: number;
  /** Design keys, left to right. */
  keys: string[];
  /** 1–10 per key, the dividers; equal when absent or short. */
  splits?: number[];
};
export type QueenRackV1 = { version: 1; shelves: RackShelfV1[] };

const fail = (): never => { throw new ValidationError("This rack needs an updated Hearth. Reload and try again."); };
const int = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Validate a stored rack, exactly; anything else is refused rather than guessed at. */
export function shapeQueenRack(value: unknown): QueenRackV1 | undefined {
  if (value === undefined) return undefined;
  const r = value as QueenRackV1;
  if (!r || typeof r !== "object" || Object.keys(r).some((key) => !["version", "shelves"].includes(key)) || r.version !== 1
    || !Array.isArray(r.shelves) || r.shelves.length === 0 || r.shelves.length > RACK_LIMITS.shelves) return fail();
  const seen = new Set<string>();
  const ids = new Set<string>();
  let keyCount = 0;
  const shelves = r.shelves.map((raw): RackShelfV1 => {
    const s = raw as RackShelfV1;
    if (!s || typeof s !== "object" || Object.keys(s).some((key) => !["id", "share", "cutoff", "keys", "splits"].includes(key))
      || typeof s.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(s.id) || ids.has(s.id)
      || !int(s.share, 1, RACK_LIMITS.share) || !int(s.cutoff, 0, RACK_LIMITS.marks)
      || !Array.isArray(s.keys) || s.keys.some((key) => typeof key !== "string" || !key || key.length > 300 || seen.has(key))
      || (s.splits !== undefined && (!Array.isArray(s.splits) || s.splits.length !== s.keys.length || s.splits.some((n) => !int(n, 1, RACK_LIMITS.split))))) return fail();
    ids.add(s.id);
    for (const key of s.keys) seen.add(key);
    keyCount += s.keys.length;
    return { id: s.id, share: s.share, cutoff: s.cutoff, keys: [...s.keys], ...(s.splits ? { splits: [...s.splits] } : {}) };
  });
  if (keyCount > RACK_LIMITS.keys) return fail();
  return { version: 1, shelves };
}

/** The rack a shelf order implies before anyone has hung a second shelf: one shelf, full share, fill mark at the crown. */
export function rackFromOrder(order: readonly string[]): QueenRackV1 {
  return { version: 1, shelves: [{ id: "shelf-1", share: 5, cutoff: RACK_LIMITS.marks, keys: [...order] }] };
}

/**
 * The rack as it stands for the banks the loft actually has: keys the loft no
 * longer holds are dropped, banks the rack does not name are set on the lowest
 * shelf at the right, in the loft's own order. Never mutates.
 */
export function rackSettled(rack: QueenRackV1 | undefined, present: readonly string[], order: readonly string[] = []): QueenRackV1 {
  const base = rack ?? rackFromOrder(order.filter((key) => present.includes(key)));
  const have = new Set(present);
  const shelves = base.shelves.map((shelf) => {
    const keep = shelf.keys.map((key, i) => [key, shelf.splits?.[i] ?? null] as const).filter(([key]) => have.has(key));
    return { ...shelf, keys: keep.map(([key]) => key), ...(shelf.splits ? { splits: keep.map(([, split]) => split ?? 1) } : {}) };
  });
  const named = new Set(shelves.flatMap((shelf) => shelf.keys));
  const strays = present.filter((key) => !named.has(key));
  if (strays.length) {
    const last = shelves[shelves.length - 1]!;
    shelves[shelves.length - 1] = { ...last, keys: [...last.keys, ...strays], ...(last.splits ? { splits: [...last.splits, ...strays.map(() => 1)] } : {}) };
  }
  return { version: 1, shelves };
}

/** The flat left-to-right, top-to-bottom order the rack implies — what the older `order` list held. */
export function rackOrder(rack: QueenRackV1): string[] {
  return rack.shelves.flatMap((shelf) => shelf.keys);
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));
const withSplits = (shelf: RackShelfV1): number[] => shelf.keys.map((_key, i) => shelf.splits?.[i] ?? 1);

// ---- moves: each returns a new rack, never the same one -------------------

export function rackMoveKey(rack: QueenRackV1, key: string, toShelf: number, toIndex: number): QueenRackV1 {
  const shelves = rack.shelves.map((shelf) => ({ ...shelf, keys: [...shelf.keys], splits: withSplits(shelf) }));
  const fromShelf = shelves.findIndex((shelf) => shelf.keys.includes(key));
  if (fromShelf < 0) return rack;
  const from = shelves[fromShelf]!;
  const fromIndex = from.keys.indexOf(key);
  const split = from.splits[fromIndex]!;
  from.keys.splice(fromIndex, 1); from.splits.splice(fromIndex, 1);
  const target = shelves[clamp(toShelf, 0, shelves.length - 1)]!;
  let at = clamp(toIndex, 0, target.keys.length);
  if (target === from && toIndex > fromIndex) at = clamp(toIndex - 1, 0, target.keys.length);
  target.keys.splice(at, 0, key); target.splits.splice(at, 0, split);
  return { version: 1, shelves: shelves.map(tidy) };
}

export function rackSetShare(rack: QueenRackV1, shelfId: string, share: number): QueenRackV1 {
  return { version: 1, shelves: rack.shelves.map((shelf) => shelf.id === shelfId ? { ...shelf, share: clamp(share, 1, RACK_LIMITS.share) } : shelf) };
}

export function rackSetCutoff(rack: QueenRackV1, shelfId: string, cutoff: number): QueenRackV1 {
  return { version: 1, shelves: rack.shelves.map((shelf) => shelf.id === shelfId ? { ...shelf, cutoff: clamp(cutoff, 0, RACK_LIMITS.marks) } : shelf) };
}

/** Slide the divider between the bank at `index` and the one to its right: one step gives the left bank more, or less. */
export function rackSlideDivider(rack: QueenRackV1, shelfId: string, index: number, toward: "left" | "right"): QueenRackV1 {
  return { version: 1, shelves: rack.shelves.map((shelf) => {
    if (shelf.id !== shelfId || index < 0 || index + 1 >= shelf.keys.length) return shelf;
    const splits = withSplits(shelf);
    const left = splits[index]!, right = splits[index + 1]!;
    // Sliding right widens the left bank's share and narrows its neighbour's, within 1–10 each.
    if (toward === "right") { if (right > 1) splits[index + 1] = right - 1; else if (left < RACK_LIMITS.split) splits[index] = left + 1; }
    else { if (left > 1) splits[index] = left - 1; else if (right < RACK_LIMITS.split) splits[index + 1] = right + 1; }
    return tidy({ ...shelf, splits });
  }) };
}

/** Hang a shelf below the lowest (or above the top), empty, at the next share down. */
export function rackHangShelf(rack: QueenRackV1, where: "above" | "below" = "below"): QueenRackV1 {
  if (rack.shelves.length >= RACK_LIMITS.shelves) return rack;
  let i = 1;
  while (rack.shelves.some((shelf) => shelf.id === `shelf-${i}`)) i += 1;
  const fresh: RackShelfV1 = { id: `shelf-${i}`, share: where === "below" ? Math.max(1, Math.min(...rack.shelves.map((s) => s.share)) - 1) : Math.min(RACK_LIMITS.share, Math.max(...rack.shelves.map((s) => s.share)) + 1), cutoff: RACK_LIMITS.marks, keys: [] };
  return { version: 1, shelves: where === "below" ? [...rack.shelves, fresh] : [fresh, ...rack.shelves] };
}

/** Take an empty shelf down. A shelf with banks on it, or the last shelf, stays. */
export function rackTakeDown(rack: QueenRackV1, shelfId: string): QueenRackV1 {
  const shelf = rack.shelves.find((row) => row.id === shelfId);
  if (!shelf || shelf.keys.length || rack.shelves.length <= 1) return rack;
  return { version: 1, shelves: rack.shelves.filter((row) => row.id !== shelfId) };
}

/** Drop `splits` when they are all equal, so a rack nobody divided stays small. */
function tidy(shelf: RackShelfV1 & { splits?: number[] }): RackShelfV1 {
  const splits = shelf.splits;
  if (!splits || splits.every((n) => n === splits[0])) { const { splits: _drop, ...rest } = shelf; return rest; }
  return { ...shelf, splits: [...splits] };
}

// ---- the pour ---------------------------------------------------------------

export type RackBank = { key: string; goalId: string | null; name: string; amountCents: number; targetCents: number };
export type PourLine = { key: string; goalId: string | null; name: string; cents: number };
export type PourShelf = { id: string; share: number; cutoff: number; roomCents: number; cents: number; lines: PourLine[]; full: boolean };
export type Pour = { pouredCents: number; placedCents: number; leftCents: number; shelves: PourShelf[] };

/** Exact cents by weight, the last party taking the remainder, then clamped to each room — with what would not fit handed on. */
function fillByWeight(pool: number, weights: number[], rooms: number[]): number[] {
  const out = weights.map(() => 0);
  let left = pool;
  const open = new Set(weights.map((_w, i) => i).filter((i) => rooms[i]! > 0 && weights[i]! > 0));
  while (left > 0 && open.size) {
    const idx = [...open];
    const total = idx.reduce((sum, i) => sum + weights[i]!, 0);
    let given = 0;
    idx.forEach((i, n) => {
      const want = n === idx.length - 1 ? left - given : Math.round((left * weights[i]!) / total);
      const take = Math.min(want, rooms[i]! - out[i]!);
      out[i]! += take; given += take;
      if (out[i]! >= rooms[i]!) open.delete(i);
    });
    left -= given;
    if (given === 0) break;
  }
  return out;
}

/**
 * What a pour of `pouredCents` over this rack would place, exactly: shelves by
 * share, each capped at the room its banks have to their mark; within a shelf
 * by splits, each bank capped at its own room; what nowhere can hold is left
 * in the Fund. Deterministic; integer cents throughout.
 */
export function rackPour(rack: QueenRackV1, banks: readonly RackBank[], pouredCents: number): Pour {
  const byKey = new Map(banks.map((bank) => [bank.key, bank]));
  const shelves = rack.shelves.map((shelf) => {
    const rows = shelf.keys.map((key) => byKey.get(key)).filter((bank): bank is RackBank => Boolean(bank));
    const rooms = rows.map((bank) => Math.max(0, Math.round((bank.targetCents * shelf.cutoff) / RACK_LIMITS.marks) - bank.amountCents));
    return { shelf, rows, rooms, roomCents: rooms.reduce((sum, r) => sum + r, 0) };
  });
  const poured = Math.max(0, Math.round(pouredCents));
  const takes = fillByWeight(poured, shelves.map((s) => s.shelf.share), shelves.map((s) => s.roomCents));
  const out: PourShelf[] = shelves.map((s, i) => {
    const splits = s.shelf.keys.map((key, n) => byKey.has(key) ? s.shelf.splits?.[n] ?? 1 : null).filter((n): n is number => n !== null);
    const cents = fillByWeight(takes[i]!, splits, s.rooms);
    return {
      id: s.shelf.id, share: s.shelf.share, cutoff: s.shelf.cutoff, roomCents: s.roomCents, cents: takes[i]!,
      lines: s.rows.map((bank, n) => ({ key: bank.key, goalId: bank.goalId, name: bank.name, cents: cents[n]! })),
      full: s.roomCents === 0 || takes[i]! >= s.roomCents,
    };
  });
  const placedCents = out.reduce((sum, s) => sum + s.cents, 0);
  return { pouredCents: poured, placedCents, leftCents: poured - placedCents, shelves: out };
}

/** The pour in one breath, for the line beneath the rack. Figures are allowed here: this is Confirm's own preview. */
export function pourWords(pour: Pour, format: (cents: number) => string): string {
  if (pour.pouredCents <= 0) return "Nothing to pour.";
  const parts = pour.shelves.filter((shelf) => shelf.cents > 0).map((shelf, i, all) => {
    const name = all.length === 1 ? "the shelf" : i === 0 ? "the top shelf" : i === all.length - 1 ? "the bottom shelf" : `shelf ${pour.shelves.indexOf(shelf) + 1}`;
    return `${format(shelf.cents)} to ${name} (${shelf.lines.filter((line) => line.cents > 0).map((line) => `${line.name} ${format(line.cents)}`).join(", ")})`;
  });
  const left = pour.leftCents > 0 ? `; ${format(pour.leftCents)} stays in the Fund${pour.shelves.every((s) => s.full) ? " — every shelf is at its mark" : ""}` : "";
  return parts.length ? `${parts.join("; ")}${left}.` : `Every shelf is at its mark; ${format(pour.pouredCents)} stays in the Fund.`;
}

/** A shelf's share of the rack, for the wall: "3 of 9". */
export function shelfShareWords(rack: QueenRackV1, shelfId: string): string {
  const total = rack.shelves.reduce((sum, shelf) => sum + shelf.share, 0);
  const shelf = rack.shelves.find((row) => row.id === shelfId);
  return shelf ? `${shelf.share} of ${total}` : "";
}
