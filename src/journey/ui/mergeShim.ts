/**
 * TODO-merge FIX-A — local stand-ins for the names lane FIX-A exports from `model/` and `contracts.ts`. Every value
 * prefers FIX-A's export when it exists on the module (so after the merge the real words and fields win at once),
 * and falls back to the agreed wording below. The orchestrator deletes this file and switches the imports to
 * `../model/index.ts` / `../contracts.ts` at merge.
 *
 * Names (agreed with FIX-A): `MAP_WORDS.settingAsideNext`, `MAP_WORDS.yearCaption`, `MAP_WORDS.flatKey`,
 * `MAP_WORDS.purseGloss`, `signedMoney(cents)`, `Digest.nextIsSettingAside`, `JourneyBoardProps.recordModes`
 * (`JourneyRecordMode`, incl. "shift" and "transfer"), ActionCall `{ name: "enterHorizonCentre" }`.
 */
import type { ActionCall, Digest, JourneyBoard, RecordMode, Stop } from "../contracts.ts";
import * as model from "../model/index.ts";
import { MAP_WORDS } from "../model/index.ts";

type Words = typeof MAP_WORDS & Partial<{ settingAsideNext: string; yearCaption: string; flatKey: string; purseGloss: string }>;
const W = MAP_WORDS as Words;

/** TODO-merge FIX-A: `MAP_WORDS.settingAsideNext` etc. */
export const SHIM_WORDS = {
  settingAsideNext: W.settingAsideNext ?? "Setting aside next",
  yearCaption: W.yearCaption ?? "Each stack = bills on the map that month · ring = $1,000 · not all spending",
  flatKey: W.flatKey ?? "No stacks in this view: solid = recorded, dashed = not recorded, mint in, gold out",
  purseGloss: W.purseGloss ?? "money here now",
} as const;

/** TODO-merge FIX-A: `signedMoney(cents)` from model/ — "+$2,100.00" / "−$12.00", the sign from the value. */
export function signedMoney(cents: number): string {
  const real = (model as unknown as { signedMoney?: (c: number) => string }).signedMoney;
  if (real) return real(cents);
  const abs = (Math.abs(cents) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${cents < 0 ? "−" : "+"}$${abs}`;
}

/** TODO-merge FIX-A: `Digest.nextIsSettingAside`. Until then: the next stop is a set-aside (jar) commitment. */
export function nextIsSettingAside(board: Pick<JourneyBoard, "digest" | "stops">): boolean {
  const flag = (board.digest as Digest & { nextIsSettingAside?: boolean }).nextIsSettingAside;
  if (typeof flag === "boolean") return flag;
  const next = board.digest.nextLeavingStopId ? board.stops.find((s) => s.id === board.digest.nextLeavingStopId) : undefined;
  return isSettingAside(next);
}
export function isSettingAside(stop: Stop | undefined): boolean {
  return Boolean(stop && stop.kind === "commitment" && stop.setAside);
}

/** TODO-merge FIX-A: `JourneyRecordMode` (contracts). The App's `fabActionsFor` modes. */
export type JourneyRecordMode = RecordMode;
/** TODO-merge FIX-A: `JourneyBoardProps.recordModes`. */
export type RecordModesProp = { recordModes?: readonly JourneyRecordMode[] };

/** TODO-merge FIX-A: ActionCall `{ name: "enterHorizonCentre" }` — handled only by the dial's own run function. */
export type DialCall = ActionCall | { name: "enterHorizonCentre" };
