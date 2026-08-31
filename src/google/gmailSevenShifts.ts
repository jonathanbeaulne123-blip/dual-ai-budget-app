import type { GoogleService } from "../core/types.ts";
import { uploadEvidence, type EvidenceCaptureSummary, type EvidenceScope } from "../imports/evidenceClient.ts";
import { withGoogle } from "./engine.ts";

export const SEVENSHIFTS_GMAIL_QUERY = "from:(7shifts.com)";
export const DEFAULT_GMAIL_IMPORT_LIMIT = 500;
export const MAX_GMAIL_IMPORT_LIMIT = 1_000;

type GmailMessageList = {
  messages?: Array<{ id?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailRawMessage = {
  id?: string;
  raw?: string;
};

export type GmailSevenShiftsImportProgress = {
  discovered: number;
  inspected: number;
  imported: number;
  duplicates: number;
  rejected: number;
};

export type GmailSevenShiftsImportResult = GmailSevenShiftsImportProgress & {
  truncated: boolean;
  query: string;
};

function abortError(): DOMException {
  return new DOMException("Gmail import was cancelled.", "AbortError");
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : abortError();
}

export function decodeGmailRaw(value: string): Uint8Array {
  const clean = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean.padEnd(Math.ceil(clean.length / 4) * 4, "="))) {
    throw new Error("Gmail returned an invalid raw message.");
  }
  const binary = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function unfoldedHeaders(bytes: Uint8Array): string {
  const prefix = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 64 * 1024));
  const boundary = prefix.search(/\r?\n\r?\n/);
  return (boundary >= 0 ? prefix.slice(0, boundary) : prefix).replace(/\r?\n[ \t]+/g, " ");
}

export function sevenShiftsSender(raw: Uint8Array): string | null {
  const fromLine = unfoldedHeaders(raw).split(/\r?\n/).find((line) => /^from\s*:/i.test(line));
  if (!fromLine) return null;
  const value = fromLine.replace(/^from\s*:/i, "").trim();
  const bracketed = value.match(/<\s*([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Z0-9.-]+))\s*>/i);
  const bare = value.match(/^\s*([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Z0-9.-]+))\s*$/i);
  const mailbox = bracketed ?? bare;
  if (!mailbox) return null;
  const domain = mailbox[2]!.toLowerCase().replace(/\.$/, "");
  return domain === "7shifts.com" || domain.endsWith(".7shifts.com") ? mailbox[1]!.toLowerCase() : null;
}

function boundedLimit(value: number | undefined): number {
  const parsed = Number(value ?? DEFAULT_GMAIL_IMPORT_LIMIT);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("Gmail import limit must be a positive integer.");
  return Math.min(parsed, MAX_GMAIL_IMPORT_LIMIT);
}

function boundedAfter(value: string | undefined): string {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) throw new Error("Gmail import start must be YYYY/MM/DD.");
  return clean;
}

function gmailListUrl(query: string, pageToken?: string): string {
  const params = new URLSearchParams({ q: query, maxResults: "500", includeSpamTrash: "false" });
  if (pageToken) params.set("pageToken", pageToken);
  return `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`;
}

function gmailRawUrl(messageId: string): string {
  const params = new URLSearchParams({ format: "raw", fields: "id,raw" });
  return `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?${params}`;
}

export async function importSevenShiftsFromGmail(input: {
  scope: EvidenceScope;
  enabledServices?: Iterable<string>;
  loginHint?: string;
  after?: string;
  limit?: number;
  signal?: AbortSignal;
  onProgress?: (progress: GmailSevenShiftsImportProgress) => void;
}): Promise<GmailSevenShiftsImportResult> {
  const limit = boundedLimit(input.limit);
  const after = boundedAfter(input.after);
  const query = `${SEVENSHIFTS_GMAIL_QUERY}${after ? ` after:${after}` : ""}`;
  const requiredServices: GoogleService[] = ["identity", "gmail"];
  const progress: GmailSevenShiftsImportProgress = { discovered: 0, inspected: 0, imported: 0, duplicates: 0, rejected: 0 };
  const report = () => input.onProgress?.({ ...progress });

  return withGoogle({
    environment: input.scope.environment,
    memberId: input.scope.memberId,
    householdId: input.scope.householdId,
    services: requiredServices,
    ...(input.enabledServices ? { enabledServices: input.enabledServices } : {}),
    loginHint: input.loginHint,
    interactive: true,
    fn: async (google) => {
      const ids: string[] = [];
      let pageToken: string | undefined;
      let truncated = false;
      do {
        assertNotAborted(input.signal);
        const list = await google.fetch<GmailMessageList>(google.session.accessToken, gmailListUrl(query, pageToken), { signal: input.signal });
        const pageIds = (list.messages ?? []).map((row) => String(row.id || "")).filter((id) => /^[A-Za-z0-9_-]{4,200}$/.test(id));
        for (const id of pageIds) {
          if (ids.length >= limit) { truncated = true; break; }
          ids.push(id);
        }
        progress.discovered = ids.length;
        report();
        pageToken = truncated ? undefined : String(list.nextPageToken || "") || undefined;
      } while (pageToken);

      for (const id of ids) {
        assertNotAborted(input.signal);
        const message = await google.fetch<GmailRawMessage>(google.session.accessToken, gmailRawUrl(id), { signal: input.signal });
        progress.inspected += 1;
        if (message.id !== id || !message.raw) {
          progress.rejected += 1;
          report();
          continue;
        }
        const raw = decodeGmailRaw(message.raw);
        if (!sevenShiftsSender(raw)) {
          progress.rejected += 1;
          report();
          continue;
        }
        const capture: EvidenceCaptureSummary = await uploadEvidence(input.scope, raw, {
          captureKind: "gmail-7shifts-email",
          contentType: "message/rfc822",
        }, input.signal);
        if (capture.duplicate) progress.duplicates += 1;
        else progress.imported += 1;
        report();
      }
      return { ...progress, truncated, query };
    },
  });
}
