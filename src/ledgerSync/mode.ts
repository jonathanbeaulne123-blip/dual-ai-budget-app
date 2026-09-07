import type { Environment } from "../core/types.ts";
export function ledgerSyncEnabled(environment: Environment): boolean {
  const requested = String(import.meta.env.VITE_LEDGER_SYNC_V2 ?? "");
  if (requested === "0") return false;
  if (import.meta.env.MODE === "test" && requested !== "1") return false;
  return environment === "development";
}
export function localLedgerIdentity(memberId: string): string | null {
  return String(import.meta.env.VITE_LEDGER_SYNC_LOCAL_AUTH ?? "") === "1" &&
    typeof location !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(location.hostname)
    ? `local:${memberId}`
    : null;
}
