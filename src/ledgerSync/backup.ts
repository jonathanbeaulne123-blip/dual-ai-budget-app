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
import { decodeDesignArchiveReference, type DesignArchiveReference } from '../hearthside/designArchive.ts';
export type RestorePointSummary = Omit<RestorePoint, "shared">;
export type Checkpoint = {
  version: 2;
  scope: string;
  authorityInstance: string;
  sequence: number;
  shared: SharedEnvelope;
  personal: [string, PersonalEnvelope][];
  receipts: Receipt[];
  designs?: DesignArchiveReference[];
  /** Original receipt semantics; UUID reservation survives authority recovery. */
  importedReceipts?: CommandReceipt[];
  /** Present only after the complete immutable legacy manifest was imported. */
  reservationDigests?: string[];
  restorePoints?: RestorePointSummary[];
  /** Exact source binding for scoped import audit after authority recovery. */
  importBindings?: Record<string, { sourceHash: string; sourceRevision: number; at: string }>;
};
export type ArchiveRecord = {
  scope: string;
  authorityInstance: string;
  event: AcceptedEvent;
  receipt: Receipt | null;
  designs?: DesignArchiveReference[];
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
  const designs = new Map((state.designs??[]).map(raw=>{const ref=decodeDesignArchiveReference(raw);return [ref.designId,ref];}));
  if(designs.size!==(state.designs??[]).length)throw Error('DESIGN_ARCHIVE_CONFLICT');
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
    for(const raw of record.data.designs??[]) {
      const ref=decodeDesignArchiveReference(raw), prior=designs.get(ref.designId);
      if(prior?ref.revision!==prior.revision+1:ref.revision!==0)throw Error('DESIGN_ARCHIVE_GAP');
      designs.set(ref.designId,ref);
    }
    state.sequence = event.sequence;
  }
  state.personal = [...personal];
  state.receipts = [...receipts.values()];
  if(designs.size)state.designs=[...designs.values()];
  for(const index of state.shared.hearthside?.designs??[]){
    const ref=designs.get(index.designId);if(!ref||ref.revision!==index.revision||ref.bankId!==index.bankId)throw Error('DESIGN_ARCHIVE_REFERENCE_MISSING');
  }
  for(const goal of [...state.shared.goals,...state.personal.flatMap(([,own])=>own.goals??[])]){
    const selected=goal.envelope?.designRef;if(!selected)continue;
    const ref=designs.get(selected.designId);if(!ref||ref.revision!==selected.revision||ref.bankId!==goal.id)throw Error('DESIGN_ARCHIVE_REFERENCE_MISSING');
  }
  for(const row of [...(state.shared.kittyNestDesigns??[]),...state.personal.flatMap(([,own])=>own.kittyNestDesigns??[])]){
    if(!row.designRef)continue;const ref=designs.get(row.designRef.designId);if(!ref||ref.revision!==row.designRef.revision||ref.bankId!==null)throw Error('DESIGN_ARCHIVE_REFERENCE_MISSING');
  }
  for (const [memberId, own] of state.personal) {
    if (own.memberId !== memberId) throw new Error("PERSONAL_SCOPE_MISMATCH");
    assertAcceptableBooks(
      assembleHousehold(state.shared, own, { linked: true }),
    );
  }
  return state;
}
