import {
  formatHerculesBriefing,
  localHerculesChat,
  sanitizeHerculesReply,
  type HerculesBriefing,
  type HerculesGrounded,
} from "./herculesPersonality.ts";
import type { HerculesLedgerExcerpt, HerculesNoticeView, HerculesWorkplaceContext } from "./herculesPrivacy.ts";
import type { HerculesMemoryView } from "./herculesLedger.ts";
import type { Environment } from "./types.ts";

export type HerculesChatTurn = {
  role: "user" | "hercules";
  text: string;
};

export type HerculesChatRequest = {
  message: string;
  briefing: HerculesBriefing;
  grounded: HerculesGrounded;
  /** Rate-limit key for the kitchen Worker. Never a secret. */
  householdId?: string;
  /** Labels only. Amounts stripped to CAD. Kind tells the model what the note is for. */
  memories?: HerculesMemoryView[];
  notices?: HerculesNoticeView[];
  ledger?: HerculesLedgerExcerpt;
  /** Pre-trimmed line excerpt; Worker prefers this over JSON blob. */
  ledgerLines?: string;
  figures?: string[];
  /** Present only after the requesting owner opts in for this one model call. */
  workplaceContext?: HerculesWorkplaceContext | null;
};

export type HerculesChatResult = {
  text: string;
  source: "ai" | "local";
  provider: HerculesChatProvider;
};

export type HerculesChatProvider = "gemini" | "groq" | "openai" | "workers-ai" | "ai" | "local";

export function herculesProviderLabel(provider: HerculesChatProvider): string {
  if (provider === "gemini") return "Gemini";
  if (provider === "groq") return "Groq";
  if (provider === "openai") return "OpenAI";
  if (provider === "workers-ai") return "Workers AI";
  if (provider === "local") return "On-device";
  return "AI";
}

export type HerculesReplyContext = {
  environment: Environment;
  householdId: string;
  memberId: string;
  requestId: number;
};

/**
 * A model reply belongs to the exact viewer scope that sent it. A response from
 * an older request, ledger, member, or environment is stale and must not reach
 * UI state or the kitchen chat ledger.
 */
export function isCurrentHerculesReply(
  started: HerculesReplyContext,
  current: HerculesReplyContext,
): boolean {
  return started.requestId === current.requestId
    && started.environment === current.environment
    && started.householdId === current.householdId
    && started.memberId === current.memberId;
}

export const HERCULES_CHAT_PATH = "/hercules/chat";
export const HERCULES_KITCHEN_CHAT =
  "https://hearth-books.jonathan-beaulne123.workers.dev/hercules/chat";

type ChatFetch = (input: string, init?: RequestInit) => Promise<Response>;

function chatUrls(): string[] {
  const urls = [HERCULES_CHAT_PATH];
  if (typeof location !== "undefined") {
    const host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1") urls.push(HERCULES_KITCHEN_CHAT);
  }
  return urls;
}

async function readAiReply(res: Response): Promise<{ reply: string; provider: HerculesChatProvider } | null> {
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.includes("json")) return null;
  const data = (await res.json()) as { ok?: boolean; reply?: unknown; provider?: unknown };
  if (!data?.ok || typeof data.reply !== "string") return null;
  const reply = data.reply.trim();
  if (!reply) return null;
  const provider = data.provider === "gemini"
    || data.provider === "groq"
    || data.provider === "openai"
    || data.provider === "workers-ai"
    ? data.provider
    : "ai";
  return { reply, provider };
}

export function herculesModelPayload(req: HerculesChatRequest): string {
  return JSON.stringify({
    householdId: req.householdId ? String(req.householdId).slice(0, 64) : undefined,
    message: req.message.trim().slice(0, 400),
    briefing: formatHerculesBriefing(req.briefing, req.memories ?? []).slice(0, 800),
    grounded: {
      spoken: String(req.grounded.spoken || "").slice(0, 220),
      lesson: req.grounded.lesson ? String(req.grounded.lesson).slice(0, 180) : null,
      fact: req.grounded.fact
        ? {
            label: String(req.grounded.fact.label).slice(0, 80),
            value: String(req.grounded.fact.value).slice(0, 48),
          }
        : null,
    },
    memories: (req.memories ?? []).slice(-12).map((row) => ({
      kind: String(row.kind).slice(0, 16),
      label: String(row.label).slice(0, 48),
    })),
    notices: (req.notices ?? []).slice(0, 8).map((item) => ({
      key: String(item.key).slice(0, 120),
      kind: String(item.kind).slice(0, 32),
      spoken: String(item.spoken).slice(0, 220),
      cad: item.cad ? String(item.cad).slice(0, 16) : null,
      action: item.action,
    })),
    ledger: req.ledger ?? null,
    ledgerLines: req.ledgerLines ? String(req.ledgerLines).slice(0, 4500) : undefined,
    figures: (req.figures ?? []).slice(0, 80),
    workplaceContext: req.workplaceContext ? {
      scope: "requesting-member-selected",
      coworkers: req.workplaceContext.coworkers.slice(0, 200).map((row) => ({
        displayName: String(row.displayName).slice(0, 80),
        jobName: String(row.jobName).slice(0, 80),
        locationName: String(row.locationName).slice(0, 80),
        observedRoles: row.observedRoles.slice(0, 16).map((role) => String(role).slice(0, 80)),
        recentAttendance: row.recentAttendance.slice(0, 12).map((item) => ({
          date: String(item.date).slice(0, 10),
          status: String(item.status).slice(0, 32),
          roleLabel: String(item.roleLabel).slice(0, 80),
        })),
      })),
    } : null,
  });
}

export async function chatHercules(
  req: HerculesChatRequest,
  deps?: { fetch?: ChatFetch; timeoutMs?: number },
): Promise<HerculesChatResult> {
  const local = (): HerculesChatResult => ({
    text: localHerculesChat(req.message, req.briefing, req.grounded),
    source: "local",
    provider: "local",
  });
  const fetchFn = deps?.fetch ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchFn || !req.message.trim()) return local();

  const timeoutMs = deps?.timeoutMs ?? 9000;
  const body = herculesModelPayload(req);

  for (const url of chatUrls()) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const result = await readAiReply(res);
      if (result) {
        return {
          text: sanitizeHerculesReply(result.reply, req.grounded.spoken, req.figures ?? [], req.message),
          source: "ai",
          provider: result.provider,
        };
      }
    } catch {
      continue;
    }
  }

  return local();
}
