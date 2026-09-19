import { acceptKittyDesignOperation, checkpointKittyDesign, restoreKittyDesignCheckpoint } from './design.ts';
import { designAssert, designId, designInteger, designRecord, type KittyAcceptedDesignOperation, type KittyDesignDocument } from './designContracts.ts';
import { digest } from '../ledgerSync/patch.ts';

/** Private archive location is derived by authority; this value contains no capability. */
export type DesignArchiveReference = { version: 1; designId: string; revision: number; sha256: string; bankId: string | null };
export type DesignArchiveNode = { version: 1; scope: string; designId: string; revision: number } & (
  { kind: 'checkpoint'; checkpoint: string } |
  { kind: 'operation'; previous: string; entry: KittyAcceptedDesignOperation }
);
export function decodeDesignArchiveReference(input: unknown): DesignArchiveReference {
  designRecord(input, ['version','designId','revision','sha256','bankId']);
  designAssert(input.version === 1, 'DESIGN_ARCHIVE_VERSION', 'A compatible creative archive reader is required.');
  designId(input.designId); designInteger(input.revision);
  designAssert(typeof input.sha256 === 'string' && /^[a-f0-9]{64}$/.test(input.sha256), 'DESIGN_ARCHIVE_HASH', 'The creative archive reference is damaged.');
  if (input.bankId !== null) designId(input.bankId);
  return {version:1,designId:input.designId,revision:input.revision,sha256:input.sha256,bankId:input.bankId as string|null};
}
export async function restoreDesignArchive(scope: string, input: DesignArchiveReference, read: (hash: string) => Promise<unknown>): Promise<KittyDesignDocument> {
  const reference = decodeDesignArchiveReference(input), suffix: KittyAcceptedDesignOperation[] = [], seen = new Set<string>();
  let hash = reference.sha256, expectedRevision = reference.revision;
  // Authority checkpoints every hundred edits. A longer chain is corrupt, not a reason to truncate undo.
  for (let count=0; count<=100; count++) {
    designAssert(!seen.has(hash), 'DESIGN_ARCHIVE_CYCLE', 'Creative history contains a cycle.'); seen.add(hash);
    const raw = await read(hash);
    designAssert(await digest(raw) === hash, 'DESIGN_ARCHIVE_CHECKSUM', 'Creative history failed its checksum.');
    designRecord(raw,['version','scope','designId','revision','kind','checkpoint','previous','entry'],['version','scope','designId','revision','kind']);
    designAssert(raw.version===1 && raw.scope===scope && raw.designId===reference.designId && raw.revision===expectedRevision,'DESIGN_ARCHIVE_SCOPE','Creative history belongs to a different revision or household.');
    if(raw.kind==='checkpoint') {
      designRecord(raw,['version','scope','designId','revision','kind','checkpoint']);
      designAssert(typeof raw.checkpoint==='string','DESIGN_ARCHIVE_SHAPE','Creative checkpoint is missing.');
      let document=restoreKittyDesignCheckpoint(raw.checkpoint);
      designAssert(document.id===reference.designId && `${document.scope.environment}/${document.scope.householdId}`===scope && document.revision===expectedRevision,'DESIGN_ARCHIVE_SCOPE','Creative checkpoint scope is invalid.');
      for(const entry of suffix.reverse()) document=acceptKittyDesignOperation(document,entry.operation,{environment:document.scope.environment,householdId:document.scope.householdId,actorId:entry.actorId,order:entry.order,acceptedAt:entry.acceptedAt}).document;
      checkpointKittyDesign(document);
      return document;
    }
    designRecord(raw,['version','scope','designId','revision','kind','previous','entry']);
    designAssert(raw.kind==='operation' && typeof raw.previous==='string' && /^[a-f0-9]{64}$/.test(raw.previous),'DESIGN_ARCHIVE_SHAPE','Creative archive link is invalid.');
    designRecord(raw.entry,['operation','actorId','order','acceptedAt']);
    designAssert(raw.entry.order===expectedRevision && expectedRevision>0,'DESIGN_ARCHIVE_GAP','Creative history contains a gap.');
    suffix.push(raw.entry as KittyAcceptedDesignOperation); hash=raw.previous; expectedRevision--;
  }
  throw Error('DESIGN_ARCHIVE_CHECKPOINT_MISSING');
}
