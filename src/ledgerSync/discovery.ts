import { stageLedgerCreation } from "./creationStore.ts";
import { assembleHousehold } from "../core/sync.ts";
import type { Environment } from "../core/types.ts";
import { assertAcceptableBooks } from "../core/commandRuntime.ts";
import { financialAuditHash } from "../core/commandIdentity.ts";
import type { Replica } from "./protocol.ts";
export async function fetchLedgerSnapshot(
  environment: Environment,
  householdId: string,
  memberId: string,
  token: string,
) {
  const response = await fetch(
    `/ledger-sync/v2/${environment}/${householdId}/snapshot`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok)
    throw new Error(`Ledger connection failed (${response.status}).`);
  const replica = (await response.json()) as Replica;
  if (
    replica.shared.environment !== environment ||
    replica.shared.householdId !== householdId ||
    replica.personal.memberId !== memberId
  )
    throw new Error("SCOPE_MISMATCH");
  const household = assembleHousehold(replica.shared, replica.personal, {
    linked: true,
  });
  household.revision = replica.sequence;
  household.baseRevision = replica.sequence;
  assertAcceptableBooks(household);
  household.booksAcceptedHash = await financialAuditHash(household);
  return household;
}

export async function createLedger(
  input: import("../core/types.ts").Household,
  memberId: string,
  token: string,
  subject: string,
) {
  const household = await stageLedgerCreation(input, memberId, subject);
  const response = await fetch(
    `/ledger-sync/v2/${household.environment}/${household.householdId}/create`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ household, memberId }),
    },
  );
  if (!response.ok)
    throw new Error((await response.json()).error ?? "CREATE_FAILED");
  return fetchLedgerSnapshot(
    household.environment,
    household.householdId,
    memberId,
    token,
  );
}

export async function deleteLedger(
  environment: Environment,
  householdId: string,
  token: string,
) {
  const response = await fetch(
    `/ledger-sync/v2/${environment}/${householdId}/delete`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok)
    throw new Error((await response.json()).error ?? "DELETE_FAILED");
  return { ok: true as const };
}
