import { parseFlinks, type FlinksAccountsPayload, type ParsedOfxBatch } from "../core/index.ts";

export const FLINKS_SYNC_PATH = "/flinks/sync";
export const FLINKS_LOGIN_STORAGE_KEY = "hearth.flinks.loginId";

export function readStoredFlinksLoginId(): string {
  try {
    return localStorage.getItem(FLINKS_LOGIN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function storeFlinksLoginId(loginId: string): void {
  const trimmed = loginId.trim();
  try {
    if (trimmed) localStorage.setItem(FLINKS_LOGIN_STORAGE_KEY, trimmed);
    else localStorage.removeItem(FLINKS_LOGIN_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export async function syncFlinksAccounts(input: {
  loginId?: string;
  requestId?: string;
}, fetcher: typeof fetch = fetch): Promise<{ batch: ParsedOfxBatch; requestId: string }> {
  const loginId = input.loginId?.trim() || readStoredFlinksLoginId();
  const requestId = input.requestId?.trim() ?? "";
  if (!loginId && !requestId) {
    throw new Error("Connect Flinks first, or paste the LoginId from the demo Connect flow.");
  }
  let response: Response;
  try {
    response = await fetcher(FLINKS_SYNC_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginId: loginId || undefined,
        requestId: requestId || undefined,
      }),
    });
  } catch (caught) {
    throw new Error(caught instanceof Error ? caught.message : String(caught));
  }
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`Flinks sync returned ${response.status}.`);
  const data = await response.json() as {
    ok?: boolean;
    requestId?: string;
    institution?: string | null;
    accounts?: FlinksAccountsPayload["Accounts"];
    error?: string;
  };
  if (!response.ok || !data.ok || !data.accounts?.length) {
    throw new Error(data.error || `Flinks sync returned ${response.status}.`);
  }
  const payload: FlinksAccountsPayload = {
    RequestId: data.requestId ?? requestId,
    Institution: data.institution ?? undefined,
    Accounts: data.accounts,
  };
  const batch = parseFlinks(payload, data.institution ?? "Flinks");
  if (data.requestId && loginId) storeFlinksLoginId(loginId);
  return { batch, requestId: data.requestId ?? requestId };
}
