import type { SqlStorage, R2Bucket } from '@cloudflare/workers-types';
import { checkpointKittyDesign, restoreKittyDesignCheckpoint } from '../src/hearthside/design.ts';
import { canonicalDesignJSON, KITTY_DESIGN_LIMITS, type KittyAcceptedDesignOperation, type KittyDesignDocument } from '../src/hearthside/designContracts.ts';
import { decodeDesignArchiveReference, restoreDesignArchive, type DesignArchiveNode, type DesignArchiveReference } from '../src/hearthside/designArchive.ts';
import { digest } from '../src/ledgerSync/patch.ts';

/** Called only inside LedgerRoom's serialized authority. No household replica carries this journal. */
export class HearthsideDesignStore {
  private cache=new Map<string,{hash:string;document:KittyDesignDocument}>();
  constructor(private sql: SqlStorage, private archive: R2Bucket) {
    sql.exec('CREATE TABLE IF NOT EXISTS creative_header(id TEXT PRIMARY KEY,bank TEXT,owner TEXT,reference TEXT,creator TEXT,request TEXT)');
    sql.exec('CREATE TABLE IF NOT EXISTS creative_baseline(id TEXT,part INTEGER,data TEXT,PRIMARY KEY(id,part))');
    sql.exec('CREATE TABLE IF NOT EXISTS creative_operation(id TEXT,revision INTEGER,operation TEXT UNIQUE,data TEXT,PRIMARY KEY(id,revision))');
    sql.exec('CREATE TABLE IF NOT EXISTS creative_archive(sequence INTEGER,id TEXT,reference TEXT,PRIMARY KEY(sequence,id))');
    sql.exec('CREATE TABLE IF NOT EXISTS creative_size(id TEXT PRIMARY KEY,bytes INTEGER)');
    sql.exec('CREATE TABLE IF NOT EXISTS creative_broadcast(sequence INTEGER PRIMARY KEY)');
  }
  header(id:string) { return this.sql.exec<{id:string;bank:string|null;owner:string|null;reference:string;creator:string;request:string}>('SELECT * FROM creative_header WHERE id=?',id).toArray()[0]; }
  forBank(bankId:string){
    const rows=this.sql.exec<{id:string}>('SELECT id FROM creative_header WHERE bank=?',bankId).toArray();
    if(rows.length>1)throw Error('DESIGN_BANK_HISTORY_CONFLICT');
    return rows[0]?this.read(rows[0].id):null;
  }
  references():DesignArchiveReference[] { return this.sql.exec<{reference:string}>('SELECT reference FROM creative_header ORDER BY id').toArray().map(r=>decodeDesignArchiveReference(JSON.parse(r.reference))); }
  eventReferences(sequence:number):DesignArchiveReference[] { return this.sql.exec<{reference:string}>('SELECT reference FROM creative_archive WHERE sequence=? ORDER BY id',sequence).toArray().map(r=>decodeDesignArchiveReference(JSON.parse(r.reference))); }
  read(id:string):KittyDesignDocument|null {
    const header=this.header(id); if(!header)return null;
    const reference=decodeDesignArchiveReference(JSON.parse(header.reference)),cached=this.cache.get(id);
    if(cached?.hash===reference.sha256)return cached.document;
    const baseline=this.sql.exec<{data:string}>('SELECT data FROM creative_baseline WHERE id=? ORDER BY part',id).toArray().map(r=>r.data).join('');
    const raw=JSON.parse(baseline) as {document:KittyDesignDocument};
    raw.document.operations=this.sql.exec<{data:string}>('SELECT data FROM creative_operation WHERE id=? ORDER BY revision',id).toArray().map(r=>JSON.parse(r.data) as KittyAcceptedDesignOperation);
    raw.document.revision=reference.revision;
    const document=restoreKittyDesignCheckpoint(JSON.stringify(raw));
    this.cache.set(id,{hash:reference.sha256,document});return document;
  }
  private size(document:KittyDesignDocument):number {
    const header=this.header(document.id),prior=this.sql.exec<{bytes:number}>('SELECT bytes FROM creative_size WHERE id=?',document.id).toArray()[0];
    if(!header||!prior)return new TextEncoder().encode(checkpointKittyDesign(document)).length;
    const old=decodeDesignArchiveReference(JSON.parse(header.reference));
    const entry=document.operations.at(-1);if(!entry||entry.order!==old.revision+1)throw Error('DESIGN_STORAGE_REVISION_CONFLICT');
    return prior.bytes+new TextEncoder().encode(canonicalDesignJSON(entry)).length+(document.operations.length>1?1:0)+String(document.revision).length-String(old.revision).length;
  }
  async prepare(document:KittyDesignDocument, bankId:string|null):Promise<DesignArchiveReference> {
    const scope=`${document.scope.environment}/${document.scope.householdId}`;
    if(this.size(document)>KITTY_DESIGN_LIMITS.checkpointBytes)throw Error('CHECKPOINT_LIMIT');
    const prior=this.header(document.id), previous=prior?decodeDesignArchiveReference(JSON.parse(prior.reference)):null;
    if(previous && previous.revision+1!==document.revision)throw Error('DESIGN_STORAGE_REVISION_CONFLICT');
    const node:DesignArchiveNode = !previous || document.revision%100===0
      ? {version:1,scope,designId:document.id,revision:document.revision,kind:'checkpoint',checkpoint:checkpointKittyDesign(document)}
      : {version:1,scope,designId:document.id,revision:document.revision,kind:'operation',previous:previous.sha256,entry:document.operations.at(-1)!};
    const sha256=await digest(node);
    // Blob first. A crash before SQL commit leaves an unreachable immutable object, never an accepted edit.
    await this.archive.put(`${encodeURIComponent(scope)}/designs/${sha256}`,JSON.stringify(node));
    return {version:1,designId:document.id,revision:document.revision,sha256,bankId};
  }
  /** Joins the same SQL transaction as the accepted event, reference and receipt. */
  commit(document:KittyDesignDocument,reference:DesignArchiveReference,sequence:number,created:{actor:string;request:string}) {
    const bytes=this.size(document);
    const existing=this.header(document.id);
    if(reference.bankId){const prior=this.forBank(reference.bankId);if(prior&&prior.id!==document.id)throw Error('DESIGN_BANK_HISTORY_CONFLICT');}
    if(!existing) {
      const baseline=checkpointKittyDesign({...document,revision:0,operations:[]});
      for(let at=0;at<baseline.length;at+=60000)this.sql.exec('INSERT INTO creative_baseline VALUES (?,?,?)',document.id,at/60000,baseline.slice(at,at+60000));
    }
    this.sql.exec('INSERT OR REPLACE INTO creative_header VALUES (?,?,?,?,?,?)',document.id,reference.bankId,document.scope.ownerMemberId,JSON.stringify(reference),existing?.creator??created.actor,existing?.request??created.request);
    for(const entry of existing?document.operations.slice(-1):document.operations)this.sql.exec('INSERT INTO creative_operation VALUES (?,?,?,?)',document.id,entry.order,JSON.stringify([document.id,entry.operation.id]),JSON.stringify(entry));
    this.sql.exec('INSERT OR REPLACE INTO creative_size VALUES (?,?)',document.id,bytes);
    this.sql.exec('INSERT INTO creative_archive VALUES (?,?,?)',sequence,document.id,JSON.stringify(reference));
  }
  remember(document:KittyDesignDocument,reference:DesignArchiveReference){this.cache.set(document.id,{hash:reference.sha256,document});}
  async recover(scope:string,reference:DesignArchiveReference) {
    return restoreDesignArchive(scope,reference,async hash=>{
      const object=await this.archive.get(`${encodeURIComponent(scope)}/designs/${hash}`);
      if(!object)throw Error('DESIGN_ARCHIVE_MISSING');return object.json();
    });
  }
}
