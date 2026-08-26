import { parseHerculesReadToolPlan, type HerculesReadToolPlan } from "./herculesTools.ts";
import type { HearthTab } from "./hercules.ts";
import type { LedgerView } from "./types.ts";

export const HERCULES_PLAN_PATH = "/hercules/plan";
export const HERCULES_KITCHEN_PLAN = "https://hearth-books.jonathan-beaulne123.workers.dev/hercules/plan";

export type HerculesPlannerRequest = {
  message: string;
  page: HearthTab;
  view: LedgerView;
};

type PlannerFetch = (input: string, init?: RequestInit) => Promise<Response>;

function plannerUrls(): string[] {
  const urls = [HERCULES_PLAN_PATH];
  if (typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    urls.push(HERCULES_KITCHEN_PLAN);
  }
  return urls;
}

function plannerAllowed(message: string): boolean {
  const value = message.trim();
  if (!value) return false;
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i.test(value)) return false;
  if (/^(?:please\s+)?(?:add|post|pay|transfer|delete|remove|change|edit|write|save|log)\b/i.test(value)) return false;
  if (/\b(?:can|could|would|will) you\s+(?:add|post|pay|transfer|delete|remove|change|edit|write|save|log)\b/i.test(value)) return false;
  return true;
}

export function shouldPlanHerculesTools(message: string): boolean {
  return /\b(account|balance|cash|chequ|check|saving|visa|master\s*card|credit|transaction|spent|spend|expense|income|earned|wage|tip|shift|bill|due|rent|hydro|phone|grocer|food|coffee|category|merchant|month|week|compare|change|difference|goal|jar|owed|owing|claim|afford|money|net worth|budget|plan|variance|duplicate|audit|health|books|trial balance|largest|biggest|oracle|monte\s*carlo|forecast|runway|tax\s*milk|outlook|simulate)\b/i.test(message);
}

export function herculesPlannerPayload(request: HerculesPlannerRequest): string {
  return JSON.stringify({
    message: request.message.replace(/\s+/g, " ").trim().slice(0, 400),
    page: request.page,
    view: request.view,
  });
}

export async function planHerculesReadTools(
  request: HerculesPlannerRequest,
  deps?: { fetch?: PlannerFetch; timeoutMs?: number },
): Promise<HerculesReadToolPlan> {
  if (!plannerAllowed(request.message)) return { calls: [] };
  const fetchFn = deps?.fetch ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchFn) return { calls: [] };
  const body = herculesPlannerPayload(request);
  for (const url of plannerUrls()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps?.timeoutMs ?? 3500);
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (!response.ok || !(response.headers.get("content-type") || "").includes("json")) continue;
      const data = await response.json() as { ok?: boolean; plan?: unknown };
      if (!data.ok) continue;
      const plan = parseHerculesReadToolPlan(data.plan);
      if (plan.calls.length) return plan;
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return { calls: [] };
}
