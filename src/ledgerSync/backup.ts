import { assembleHousehold } from "../core/sync.ts";
import { assertAcceptableBooks } from "../core/commandRuntime.ts";
import type {
  PersonalEnvelope,
  SharedEnvelope,
  RestorePoint,
  CommandReceipt,
} from "../core/types.ts";
import type { AcceptedEvent, Receipt } from "./protocol.ts";
import { digest, project } from "./patch.ts";
export type RestorePointSummary = Omit<RestorePoint, "shared">;
export type Checkpoint = {
  version: 2;
  scope: string;
  authorityInstance: string;
  sequence: number;
  shared: SharedEnvelope;
  personal: [string, PersonalEnvelope][];
  receipts: Receipt[];
  /** Original receipt semantics; UUID reservation survives authority recovery. */
  importedReceipts?: CommandReceipt[];
  /** Present only after the complete immutable legacy manifest was imported. */
  reservationDigests?: string[];
  restorePoints?: RestorePointSummary[];
};
export type ArchiveRecord = {
  scope: string;
  authorityInstance: string;
  event: AcceptedEvent;
  receipt: Receipt | null;
};
export type Sealed<T> = { data: T; sha256: string };
export async function seal<T>(data: T): Promise<Sealed<T>> {
  return { data, sha256: await digest(data) };
}
export async function restoreArchive(
  scope: string,
  checkpoint: Sealed<Checkpoint>,
  records: Sealed<ArchiveRecord>[],
): Promise<Checkpoint> {
  if ((await digest(checkpoint.data)) !== checkpoint.sha256)
    throw new Error("CHECKPOINT_CHECKSUM");
  const state = structuredClone(checkpoint.data);
  if (
    state.version !== 2 ||
    state.scope !== scope ||
    `${state.shared.environment}/${state.shared.householdId}` !== scope
  )
    throw new Error("BACKUP_SCOPE_MISMATCH");
  const personal = new Map(state.personal),
    receipts = new Map(state.receipts.map((r) => [r.id, r]));
  for (const record of records) {
    if ((await digest(record.data)) !== record.sha256)
      throw new Error("ARCHIVE_CHECKSUM");
    if (
      record.data.scope !== scope ||
      record.data.authorityInstance !== state.authorityInstance
    )
      throw new Error("ARCHIVE_AUTHORITY_MISMATCH");
    const { event, receipt } = record.data;
    if (event.sequence !== state.sequence + 1) throw new Error("ARCHIVE_GAP");
    state.shared = project(state.shared, event.shared);
    if (event.personal) {
      const own = personal.get(event.memberId!);
      if (!own) throw new Error("PERSONAL_CHECKPOINT_REQUIRED");
      personal.set(event.memberId!, project(own, event.personal));
    }
    if (receipt) {
      if (receipt.sequence !== event.sequence || receipts.has(receipt.id))
        throw new Error("RECEIPT_CONFLICT");
      receipts.set(receipt.id, receipt);
    }
    state.sequence = event.sequence;
  }
  state.personal = [...personal];
  state.receipts = [...receipts.values()];
  for (const [memberId, own] of state.personal) {
    if (own.memberId !== memberId) throw new Error("PERSONAL_SCOPE_MISMATCH");
    assertAcceptableBooks(
      assembleHousehold(state.shared, own, { linked: true }),
    );
  }
  return state;
}
