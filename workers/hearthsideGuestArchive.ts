import type {DurableObjectStorage,R2Bucket} from '@cloudflare/workers-types';
import {guestAssert,guestDigest,guestDigestValue,guestInteger,guestRecord} from '../src/hearthside/guestContracts.ts';
type Row={key:string;data:string};type Meta={scope:string;sequence:number;archived:number;digest:string};
type Journal={version:1;scope:string;sequence:number;previous:string;rows:Row[]};type Head={version:1;scope:string;sequence:number;digest:string};
type Restore={target:Head;sequence:number;digest:string};
const ZERO='0'.repeat(64),LIMIT=512*1024;
const parse=<T>(text:string):T=>{try{return JSON.parse(text) as T;}catch{throw Error('GUEST_ARCHIVE_CORRUPT');}};
function scopeName(value:string){guestAssert(/^(room|card)\/[0-9a-f-]{36}$/.test(value)||/^street\/[0-9a-f-]{36}$/.test(value)||/^host\/HH-[A-Za-z0-9_-]{1,96}$/.test(value),'GUEST_INVALID_SCOPE');return `development/${value}`;}
function checkRow(row:Row){guestAssert(row&&typeof row.key==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./:-]{0,240}$/.test(row.key)&&typeof row.data==='string'&&new TextEncoder().encode(row.data).length<LIMIT-2048,'GUEST_ARCHIVE_CORRUPT');const data=parse<unknown>(row.data);guestAssert(data&&typeof data==='object'&&!Array.isArray(data),'GUEST_ARCHIVE_CORRUPT');}
function transition(oldData:string|undefined,newData:string){if(!oldData)return;const old=parse<Record<string,unknown>>(oldData),next=parse<Record<string,unknown>>(newData);guestAssert(!(old.state==='revoked'&&next.state!=='revoked')&&!(old.revoked===true&&next.revoked!==true),'GUEST_ARCHIVE_CORRUPT');}

/** SQL mutation + monotonic outbox are atomic; R2 durability precedes successful acknowledgement. */
export class GuestArchive {
  private depth=0;private lane:Promise<void>=Promise.resolve();
  constructor(readonly storage:DurableObjectStorage,private bucket?:Pick<R2Bucket,'get'|'put'>){
    storage.sql.exec('CREATE TABLE IF NOT EXISTS guest_records(key TEXT PRIMARY KEY,data TEXT NOT NULL)');
    storage.sql.exec('CREATE TABLE IF NOT EXISTS guest_meta(key TEXT PRIMARY KEY,data TEXT NOT NULL)');
    storage.sql.exec('CREATE TABLE IF NOT EXISTS guest_outbox(sequence INTEGER PRIMARY KEY,data TEXT NOT NULL)');
    storage.sql.exec('CREATE TABLE IF NOT EXISTS guest_restore(key TEXT PRIMARY KEY,data TEXT NOT NULL)');
  }
  private state<T>(key:string):T|undefined {const row=this.storage.sql.exec<{data:string}>('SELECT data FROM guest_meta WHERE key=?',key).toArray()[0];return row?parse<T>(row.data):undefined;}
  private setState(key:string,value:unknown){this.storage.sql.exec('INSERT INTO guest_meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data',key,JSON.stringify(value));}
  private raw(key:string,staging=false){const table=staging?'guest_restore':'guest_records';return this.storage.sql.exec<{data:string}>(`SELECT data FROM ${table} WHERE key=?`,key).toArray()[0]?.data;}
  get<T>(key:string):T|undefined {const row=this.raw(key);return row?parse<T>(row):undefined;}
  list<T>(prefix:string):T[]{return this.storage.sql.exec<Row>('SELECT key,data FROM guest_records WHERE key>=? AND key<? ORDER BY key',prefix,prefix+'\uffff').toArray().map(r=>parse<T>(r.data));}
  transaction<T>(action:()=>T):T {if(this.depth)return action();return this.storage.transactionSync(()=>{this.depth++;try{return action();}finally{this.depth--;}});}
  put(key:string,value:unknown){this.transaction(()=>{const meta=this.state<Meta>('meta');guestAssert(meta&&!this.state('restore'),'GUEST_RESTORE_REQUIRED');const row={key,data:JSON.stringify(value)};checkRow(row);const old=this.raw(key);if(old===row.data)return;transition(old,row.data);this.storage.sql.exec('INSERT INTO guest_records VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data',key,row.data);meta.sequence++;guestInteger(meta.sequence,1);this.storage.sql.exec('INSERT INTO guest_outbox VALUES(?,?)',meta.sequence,JSON.stringify([row]));this.setState('meta',meta);});}
  private serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.lane.catch(()=>{}).then(work);this.lane=next.then(()=>{},()=>{});return next;}
  private prefix(scope:string){return `hearthside-guest-archive-v1/${scope}/`;}
  private journalKey(scope:string,n:number){return this.prefix(scope)+`journal/${String(n).padStart(16,'0')}.json`;}
  private async read<T>(key:string,limit=LIMIT):Promise<{value:T;etag:string}|null>{guestAssert(this.bucket,'GUEST_UNAVAILABLE');const object=await this.bucket.get(key);if(!object)return null;guestAssert(object.size<=limit,'GUEST_ARCHIVE_CORRUPT');const bytes=await object.arrayBuffer();guestAssert(bytes.byteLength<=limit,'GUEST_ARCHIVE_CORRUPT');return {value:parse<T>(new TextDecoder().decode(bytes)),etag:object.etag};}
  private async head(scope:string){const head=await this.read<Head>(this.prefix(scope)+'head.json',4096);if(head){guestRecord(head.value,['version','scope','sequence','digest']);guestAssert(head.value.version===1&&head.value.scope===scope,'GUEST_ARCHIVE_CORRUPT');guestInteger(head.value.sequence,1);guestDigestValue(head.value.digest);}return head;}
  private async immutable(key:string,value:unknown){guestAssert(this.bucket,'GUEST_UNAVAILABLE');const text=JSON.stringify(value);guestAssert(new TextEncoder().encode(text).length<=LIMIT,'GUEST_SELECTION_TOO_LARGE');const result=await this.bucket.put(key,text,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});if(!result)guestAssert(JSON.stringify((await this.read(key))?.value)===text,'GUEST_ARCHIVE_CONFLICT');}
  async ready(name:string):Promise<void>{return this.serial(async()=>{const scope=scopeName(name);guestAssert(this.bucket,'GUEST_UNAVAILABLE');guestAssert(!this.state('restore'),'GUEST_RESTORE_REQUIRED');let meta=this.state<Meta>('meta');if(!meta){guestAssert(!await this.head(scope)&&!await this.read(this.journalKey(scope,1)),'GUEST_RESTORE_REQUIRED');meta={scope,sequence:0,archived:0,digest:ZERO};this.setState('meta',meta);}guestAssert(meta.scope===scope,'GUEST_SCOPE_MISMATCH');await this.flushLocked(scope,meta.sequence);});}
  async flush(name:string):Promise<void>{const scope=scopeName(name),target=this.state<Meta>('meta')?.sequence;guestAssert(target!==undefined,'GUEST_RESTORE_REQUIRED');return this.serial(()=>this.flushLocked(scope,target));}
  private async flushLocked(scope:string,target:number){
    guestAssert(this.bucket,'GUEST_UNAVAILABLE');let meta=this.state<Meta>('meta')!;
    while(meta.archived<target){const sequence=meta.archived+1,row=this.storage.sql.exec<{data:string}>('SELECT data FROM guest_outbox WHERE sequence=?',sequence).toArray()[0];guestAssert(row,'GUEST_ARCHIVE_CORRUPT');const rows=parse<Row[]>(row.data);rows.forEach(checkRow);const journal:Journal={version:1,scope,sequence,previous:meta.digest,rows},digest=await guestDigest(journal);
      await this.immutable(this.journalKey(scope,sequence),{journal,digest});const head=await this.head(scope);
      if(head?.value.sequence===sequence){guestAssert(head.value.digest===digest,'GUEST_ARCHIVE_CONFLICT');}
      else {guestAssert((head?.value.sequence??0)===meta.archived&&(head?.value.digest??ZERO)===meta.digest,'GUEST_ARCHIVE_CONFLICT');const next:Head={version:1,scope,sequence,digest};const written=await this.bucket.put(this.prefix(scope)+'head.json',JSON.stringify(next),{onlyIf:head?{etagMatches:head.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});if(!written)guestAssert(JSON.stringify((await this.head(scope))?.value)===JSON.stringify(next),'GUEST_ARCHIVE_CONFLICT');}
      this.transaction(()=>{const current=this.state<Meta>('meta')!;current.archived=sequence;current.digest=digest;this.setState('meta',current);this.storage.sql.exec('DELETE FROM guest_outbox WHERE sequence<=?',sequence);});meta=this.state<Meta>('meta')!;
    }
  }
  /** Internal operator capability only: fenced empty DO, latest durable journal, staged bounded replay. */
  async restore(name:string,maxEntries=128){return this.serial(async()=>{
    const scope=scopeName(name);guestInteger(maxEntries,1,128);guestAssert(this.bucket,'GUEST_UNAVAILABLE');
    const count=this.storage.sql.exec<{n:number}>('SELECT count(*) AS n FROM guest_records').toArray()[0]!.n;guestAssert(count===0&&this.storage.sql.exec<{n:number}>('SELECT count(*) AS n FROM guest_outbox').toArray()[0]!.n===0,'GUEST_RESTORE_NOT_EMPTY');
    let latest=await this.head(scope);let target:Head=latest?.value??{version:1,scope,sequence:0,digest:ZERO};
    // A lost head acknowledgement cannot hide a later durable revocation.
    let discovering=false;for(let scan=0;scan<128;scan++){const tail=await this.read<{journal:Journal;digest:string}>(this.journalKey(scope,target.sequence+1));if(!tail)break;const {journal,digest}=tail.value;guestAssert(journal.version===1&&journal.scope===scope&&journal.sequence===target.sequence+1&&journal.previous===target.digest&&await guestDigest(journal)===digest,'GUEST_ARCHIVE_CORRUPT');target={version:1,scope,sequence:journal.sequence,digest};if(scan===127)discovering=Boolean(await this.read(this.journalKey(scope,target.sequence+1)));}
    guestAssert(target.sequence>0,'GUEST_NOT_FOUND');
    if(target.sequence!==(latest?.value.sequence??0)){const changed=await this.bucket.put(this.prefix(scope)+'head.json',JSON.stringify(target),{onlyIf:latest?{etagMatches:latest.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});guestAssert(changed||JSON.stringify((await this.head(scope))?.value)===JSON.stringify(target),'GUEST_ARCHIVE_CONFLICT');latest=await this.head(scope);}
    if(discovering)return {complete:false,sequence:this.state<Restore>('restore')?.sequence??0,target:target.sequence};
    let stage=this.state<Restore>('restore');if(!stage){stage={target,sequence:0,digest:ZERO};this.setState('restore',stage);}else{guestAssert(stage.target.scope===scope&&target.sequence>=stage.target.sequence,'GUEST_ARCHIVE_CONFLICT');stage.target=target;}
    for(let n=0;n<maxEntries&&stage.sequence<target.sequence;n++){const item=await this.read<{journal:Journal;digest:string}>(this.journalKey(scope,stage.sequence+1));guestAssert(item,'GUEST_ARCHIVE_CORRUPT');const {journal,digest}=item.value;guestAssert(journal.version===1&&journal.scope===scope&&journal.sequence===stage.sequence+1&&journal.previous===stage.digest&&await guestDigest(journal)===digest,'GUEST_ARCHIVE_CORRUPT');this.transaction(()=>{for(const row of journal.rows){checkRow(row);transition(this.raw(row.key,true),row.data);this.storage.sql.exec('INSERT INTO guest_restore VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data',row.key,row.data);}stage!.sequence=journal.sequence;stage!.digest=digest;this.setState('restore',stage);});}
    if(stage.sequence<target.sequence)return {complete:false,sequence:stage.sequence,target:target.sequence};guestAssert(stage.digest===target.digest,'GUEST_ARCHIVE_CORRUPT');
    const finalHead=await this.head(scope);guestAssert(JSON.stringify(finalHead?.value)===JSON.stringify(target)&&!await this.read(this.journalKey(scope,target.sequence+1)),'GUEST_ARCHIVE_CONFLICT');
    this.transaction(()=>{this.storage.sql.exec('INSERT INTO guest_records SELECT key,data FROM guest_restore');this.storage.sql.exec('DELETE FROM guest_restore');this.storage.sql.exec("DELETE FROM guest_meta WHERE key='restore'");this.setState('meta',{scope,sequence:target.sequence,archived:target.sequence,digest:target.digest});});return {complete:true,sequence:target.sequence,target:target.sequence};
  });}
}
