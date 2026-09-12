import {decodeMemoryPublicationBinding} from '../src/hearthside/memoryPublication.ts';
import type {R2Bucket,SqlStorage} from '@cloudflare/workers-types';
import type {Scope} from '../src/ledgerSync/protocol.ts';
import {digest} from '../src/ledgerSync/patch.ts';
import {designRecord} from '../src/hearthside/designContracts.ts';
import {vaultId,type VaultReference,type VaultAcceptance} from '../src/hearthside/vaultContracts.ts';

type Accepted={version:1;actor:{memberId:string;subject:string};receipt:VaultAcceptance};
function reference(raw:unknown,scope:Scope):VaultReference {
  designRecord(raw,['version','publicationId','digest','kind','environment','householdId','memory'],['version','publicationId','digest','kind','environment','householdId']);
  if(raw.version!==1||raw.environment!==scope.environment||raw.householdId!==scope.householdId||typeof raw.digest!=='string'||!/^[a-f0-9]{64}$/.test(raw.digest)||!['letter','capsule','answer','shared-memory','guest'].includes(String(raw.kind)))throw Error('INVALID_ACCEPTANCE');
  const memory=raw.memory===undefined?undefined:decodeMemoryPublicationBinding(raw.memory);
  if(raw.kind==='shared-memory'&&!memory||memory&&(raw.kind!=='shared-memory'||memory.publicationId!==raw.publicationId||memory.publicationDigest!==raw.digest))throw Error('INVALID_ACCEPTANCE');
  return {...(memory?{memory}:{}),version:1,publicationId:vaultId(raw.publicationId),digest:raw.digest,kind:raw.kind as VaultReference['kind'],environment:scope.environment,householdId:scope.householdId};
}
/** Private immutable receipts. No letter existence, audience or identifier enters a household replica. */
export class HearthsideAcceptanceStore {
  constructor(private sql:SqlStorage,private archive:R2Bucket){sql.exec('CREATE TABLE IF NOT EXISTS vault_acceptance(id TEXT PRIMARY KEY,data TEXT NOT NULL)');}
  async accept(scope:Scope,raw:unknown,check:()=>void):Promise<VaultAcceptance>{
    const ref=reference(raw,scope),identity=await digest([scope.environment,scope.householdId,ref.publicationId]);
    const key=`hearthside-acceptance-v1/${encodeURIComponent(scope.environment+'/'+scope.householdId)}/${identity}`;
    const local=this.sql.exec<{data:string}>('SELECT data FROM vault_acceptance WHERE id=?',identity).toArray()[0];
    let accepted:Accepted|undefined;
    if(local)accepted=JSON.parse(local.data) as Accepted;
    else {
      // Empty-authority recovery looks up the immutable receipt under its same identity.
      // Financial checkpoint restoration never rewinds or replaces this namespace.
      const object=await this.archive.get(key);
      if(object){const sealed=await object.json<{data:Accepted;sha256:string}>();if(await digest(sealed.data)!==sealed.sha256)throw Error('ACCEPTANCE_CHECKSUM');accepted=sealed.data;}
    }
    check();
    if(accepted){
      const {receiptId,acceptedAt,...saved}=accepted.receipt;
      if(accepted.version!==1||accepted.actor.memberId!==scope.memberId||accepted.actor.subject!==scope.subject||await digest(saved)!==await digest(ref)||receiptId!==`VAULT-${identity}`||!Number.isSafeInteger(acceptedAt)||acceptedAt<=0)throw Error('ACCEPTANCE_CHANGED');
    }else {
      accepted={version:1,actor:{memberId:scope.memberId,subject:scope.subject},receipt:{...ref,receiptId:`VAULT-${identity}`,acceptedAt:Date.now()}};
      await this.archive.put(key,JSON.stringify({data:accepted,sha256:await digest(accepted)}));
      check();
    }
    // R2 is durable before SQLite acknowledges. A lost SQL write or response resumes above.
    this.sql.exec('INSERT INTO vault_acceptance VALUES (?,?) ON CONFLICT(id) DO NOTHING',identity,JSON.stringify(accepted));
    return structuredClone(accepted.receipt);
  }
}
