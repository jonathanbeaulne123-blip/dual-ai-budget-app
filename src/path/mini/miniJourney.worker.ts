import type { DateKey } from "../../core/calendar.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import { miniFund, miniJourneyBase, miniMonth, type MiniJourneyBase } from "./miniJourneyModel.ts";

/**
 * The simple view's read-model off the interaction thread (D-284/D-285). A big household (Our Story) takes
 * seconds to read; the page asks for it in stages and draws each as it lands. Nothing here stores or posts.
 */
type Options = { memberId: string; view: LedgerView; today: DateKey };
type Request = { id: number; token: number; household?: Household; options: Options } & (
  | { kind: "base" }
  | { kind: "month"; monthKey: string }
  | { kind: "fund" }
);

const households = new Map<number, Household>();
const bases = new Map<string, MiniJourneyBase>();
const baseKey = (token: number, o: Options) => `${token}|${o.memberId}|${o.view}|${o.today}`;

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.household) {
      households.set(request.token, request.household);
      // Keep the last two households only (the one on screen and the one arriving).
      for (const token of [...households.keys()]) if (token < request.token - 1) households.delete(token);
      for (const key of [...bases.keys()]) if (Number(key.split("|")[0]) < request.token - 1) bases.delete(key);
    }
    const household = households.get(request.token);
    if (!household) throw new Error("unknown household");
    const key = baseKey(request.token, request.options);
    const base = () => {
      let hit = bases.get(key);
      if (!hit) { hit = miniJourneyBase(household, request.options); bases.set(key, hit); }
      return hit;
    };
    const result = request.kind === "base" ? base()
      : request.kind === "fund" ? miniFund(household, request.options.memberId, request.options.today)
        : miniMonth(household, request.monthKey, { ...request.options, journey: base() });
    self.postMessage({ id: request.id, result });
  } catch (error) {
    self.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
  }
};
