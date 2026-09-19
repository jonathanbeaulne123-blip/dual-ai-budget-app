import {decodeNestSource,type NestDesignSource} from './nestDesignBinding.ts';
import {reviewRejectedEdit,type RejectedEditReview} from './designRecovery.ts';
import type { Environment } from '../core/types.ts';
import { acceptKittyDesignOperation, decodeKittyDesignDocument, type KittyDesignReceipt } from './design.ts';
import { canonicalDesignJSON, decodeKittyDesignOperation, designArray, designId, designRecord, type KittyAcceptedDesignOperation, type KittyDesignDocument, type KittyDesignOperation } from './designContracts.ts';

export type DesignRequest={version:1;kind:'create';designId:string;bankId:string|null;audience?:'personal';nestSource?:NestDesignSource}|{version:1;kind:'operate';operation:KittyDesignOperation};
export type PendingDesignRequest={id:string;request:DesignRequest;status:'queued'|'uncertain'|'rejected';message:string};
type Options={environment:Environment;householdId:string;memberId:string;identity:string;token:()=>Promise<string>;storage?:Storage;fetch?:typeof fetch};
const DEFINITE=new Set(['INVALID_NEST_SOURCE','DESIGN_NEST_UNAVAILABLE','DESIGN_NEST_GOAL_CONFLICT','DESIGN_NEST_HISTORY_CONFLICT','DESIGN_AUDIENCE_CONFLICT','INVALID_ID','INVALID_VALUE','INVALID_REVISION','INVALID_FIELD','INVALID_SHAPE','INVALID_TIME','INVALID_BASELINE','OPERATION_TOO_LARGE','OPERATION_ID_REUSED','ORDER_CONFLICT','STALE_GESTURE','FIELD_REVISION_CONFLICT','STALE_FIELD','STALE_PIECE','PIECE_NOT_FOUND','PIECE_UNAVAILABLE','PIECE_ARCHIVED','PIECE_ALREADY_EXISTS','PIECE_LIMIT','HISTORY_LIMIT','CHECKPOINT_LIMIT','DESIGN_BANK_UNAVAILABLE','DESIGN_ID_CONFLICT','DESIGN_OWNERSHIP_CHANGED','KITTY_DESIGN_WRITES_PAUSED','STALE_EDIT_EPOCH','PIECE_FIRED','PIECE_NOT_FIRED','STALE_DISPLAY','GESTURE_CONFLICT','NOT_YOUR_GESTURE','UNKNOWN_SURFACE','PAINT_LIMIT','STAMP_LIMIT','STAMP_EXISTS','STAMP_UNAVAILABLE','FIRING_LIMIT','HOUSEHOLD_STORAGE_LIMIT','DESIGN_REVISION_AHEAD']);
export class DesignTransportError extends Error { constructor(public code:string,public definite:boolean){super(code);} }
/** Accepted documents are a cache; retained requests are private and partitioned by authenticated identity. */
export class HearthsideDesignClient {
  readonly documents=new Map<string,KittyDesignDocument>();
  readonly errors=new Map<string,string>();
  readonly receipts=new Map<string,KittyDesignReceipt>();
  readonly resolutions=new Map<string,string>();
  pending:PendingDesignRequest[]=[];
  storageError='';
  private storage:Storage|undefined;
  private key:string;
  private stopped=false;
  private controller=new AbortController();
  private listeners=new Set<()=>void>();
  private reads=new Map<string,Promise<KittyDesignDocument|null>>();
  private flushPromise:Promise<void>|null=null;
  private version=0;
  constructor(readonly options:Options){
    this.key=`hearthside-creative-requests:${JSON.stringify([options.environment,options.householdId,options.memberId,options.identity])}`;
    try{this.storage=options.storage??globalThis.localStorage;const raw=this.storage?.getItem(this.key);if(raw){if(raw.length>2*1024*1024)throw Error('limit');const rows=JSON.parse(raw);if(!Array.isArray(rows)||rows.length>100)throw Error('shape');this.pending=rows.map(row=>{designRecord(row,['id','request','status','message']);designId(row.id);const request=decodeRequest(row.request);if(row.id!==(request.kind==='create'?request.designId:request.operation.id)||rows.filter(other=>other.id===row.id).length!==1)throw Error('identity');return {id:row.id,request,status:'uncertain',message:'This edit was retained. Check its receipt before continuing.'};});}}
    catch{this.storageError='This device could not reopen the retained creative edits. They have been left in place.';}
  }
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  snapshot=()=>this.version;
  private changed(){this.version++;for(const listener of this.listeners)listener();}
  private persist(next:PendingDesignRequest[]){
    if(this.storageError)throw Error(this.storageError);
    try{if(!this.storage)throw Error('unavailable');const raw=JSON.stringify(next);if(raw.length>2*1024*1024||next.length>100)throw Error('limit');this.storage.setItem(this.key,raw);this.pending=next;this.changed();}
    catch{throw Error('This device cannot safely retain another edit. Keep the Studio open and free some device storage.');}
  }
  private async request(body:unknown):Promise<Record<string,unknown>> {
    if(this.stopped)throw Error('CREATIVE_SCOPE_CLOSED');
    const token=await this.options.token();if(this.stopped)throw Error('CREATIVE_SCOPE_CLOSED');
    const response=await (this.options.fetch??fetch)(`/ledger-sync/v2/${this.options.environment}/${this.options.householdId}/design`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:this.controller.signal});
    const value=await response.json() as Record<string,unknown>;
    if(!response.ok){const code=typeof value.error==='string'?value.error:'DESIGN_REQUEST_UNCERTAIN';throw new DesignTransportError(code,DEFINITE.has(code));}
    if(value.version!==1)throw Error('CREATIVE_RESPONSE_VERSION');
    return value;
  }
  private adopt(raw:unknown){
    const document=decodeKittyDesignDocument(raw);
    if(document.scope.environment!==this.options.environment||document.scope.householdId!==this.options.householdId||document.scope.ownerMemberId!==null&&document.scope.ownerMemberId!==this.options.memberId)throw Error('CREATIVE_RESPONSE_SCOPE');
    const prior=this.documents.get(document.id);if(!prior||prior.revision<=document.revision)this.documents.set(document.id,document);
    this.errors.delete(document.id);this.changed();return document;
  }
  private acceptResponse(value:Record<string,unknown>,basis:KittyDesignDocument|undefined){
    if(value.document!==undefined)return this.adopt(value.document);
    const delta=value.delta;designRecord(delta,['designId','baseRevision','revision','entries']);designArray(delta.entries,20000);
    if(!basis||basis.id!==delta.designId||basis.revision!==delta.baseRevision)throw Error('CREATIVE_DELTA_BASIS');
    let document=basis;
    for(const raw of delta.entries){designRecord(raw,['operation','actorId','order','acceptedAt']);const entry=raw as KittyAcceptedDesignOperation;if(entry.order!==document.revision+1)throw Error('CREATIVE_DELTA_GAP');document=acceptKittyDesignOperation(document,entry.operation,{environment:this.options.environment,householdId:this.options.householdId,actorId:entry.actorId,order:entry.order,acceptedAt:entry.acceptedAt}).document;}
    if(document.revision!==delta.revision)throw Error('CREATIVE_DELTA_GAP');
    const prior=this.documents.get(document.id);if(!prior||prior.revision<=document.revision)this.documents.set(document.id,document);this.errors.delete(document.id);this.changed();return document;
  }
  async load(id:string,minimumRevision=0):Promise<KittyDesignDocument|null>{
    designId(id);const cached=this.documents.get(id);if(cached&&cached.revision>=minimumRevision)return cached;
    const prior=this.reads.get(id);if(prior)return prior.then(document=>document&&document.revision<minimumRevision?this.load(id,minimumRevision):document);
    const work=this.request({version:1,kind:'read',designId:id,...(cached?{knownRevision:cached.revision}:{})}).then(value=>{if(this.stopped)return null;const document=this.acceptResponse(value,cached);if(document.id!==id||document.revision<minimumRevision)throw Error('CREATIVE_RESPONSE_REVISION');return document;}).catch(error=>{if(!this.stopped){this.errors.set(id,error instanceof Error?error.message:'This artwork could not be loaded.');this.changed();}return null;}).finally(()=>this.reads.delete(id));
    this.reads.set(id,work);return work;
  }
  async enqueue(input:DesignRequest){
    const request=decodeRequest(input),id=request.kind==='create'?request.designId:request.operation.id;
    const prior=this.pending.find(row=>row.id===id);
    if(prior&&canonicalDesignJSON(prior.request)!==canonicalDesignJSON(request))throw Error('CREATIVE_REQUEST_ID_REUSED');
    if(!prior)this.persist([...this.pending,{id,request,status:'queued',message:'Waiting for its accepted receipt.'}]);
    await this.flush();
    return !this.pending.some(row=>row.id===id);
  }
  async reviewRejected(id:string):Promise<RejectedEditReview>{
    const row=this.pending.find(p=>p.id===id);if(row?.status!=='rejected'||row.request.kind!=='operate')throw Error('CHECK_CREATIVE_RECEIPT_FIRST');
    const basis=this.documents.get(row.request.operation.designId),value=await this.request({version:1,kind:'read',designId:row.request.operation.designId,...(basis?{knownRevision:basis.revision}:{})});
    if(this.stopped)throw Error('CREATIVE_SCOPE_CLOSED');const current=this.acceptResponse(value,basis);
    return reviewRejectedEdit(row.request.operation,current,this.options.memberId,{operation:'OP-'+crypto.randomUUID(),gesture:'GESTURE-'+crypto.randomUUID(),stamp:'STAMP-'+crypto.randomUUID()});
  }
  async reapplyRejected(id:string,review:RejectedEditReview){
    const row=this.pending.find(p=>p.id===id);if(row?.status!=='rejected'||row.request.kind!=='operate'||this.stopped)throw Error('CHECK_CREATIVE_RECEIPT_FIRST');
    const document=this.documents.get(row.request.operation.designId);if(!document||document.revision!==review.baseRevision)throw Error('The piece changed. Refresh the retained edit comparison.');
    const checked=reviewRejectedEdit(row.request.operation,document,this.options.memberId,{operation:review.operation.id,gesture:review.operation.gestureId,stamp:review.operation.kind==='add-stamp'?review.operation.stamp.id:'STAMP-unused'});
    if(canonicalDesignJSON(checked.operation)!==canonicalDesignJSON(review.operation)||review.operation.id===id||this.pending.some(p=>p.id===review.operation.id))throw Error('CREATIVE_REVIEW_CHANGED');
    const request:DesignRequest={version:1,kind:'operate',operation:checked.operation};
    // Replace locally in one durable write. If storage fails, the rejected original remains intact.
    this.persist(this.pending.map(p=>p.id===id?{id:checked.operation.id,request,status:'queued',message:'Your reviewed choice is waiting for its receipt.'}:p));
    await this.flush();return !this.pending.some(p=>p.id===checked.operation.id);
  }
  async retry(){this.persist(this.pending.map(row=>row.status==='uncertain'?{...row,status:'queued',message:'Checking its original receipt…'}:row));await this.flush();}
  /** Rejected work stays available until the author explicitly discards or revises it. */
  async discardRejected(id:string){const row=this.pending.find(row=>row.id===id);if(row?.status!=='rejected')throw Error('CHECK_CREATIVE_RECEIPT_FIRST');this.persist(this.pending.filter(row=>row.id!==id));await this.flush();}
  private flush():Promise<void>{
    if(this.flushPromise)return this.flushPromise;
    const run=async()=>{
      while(!this.stopped){
        const key=(item:PendingDesignRequest)=>item.request.kind==='create'?item.request.designId:item.request.operation.designId;
        const row=this.pending.find((item,index)=>item.status==='queued'&&!this.pending.slice(0,index).some(prior=>key(prior)===key(item)));if(!row)return;
        try{
          const basis=row.request.kind==='operate'?this.documents.get(row.request.operation.designId):undefined;
          const value=await this.request({...row.request,...(basis?{knownRevision:basis.revision}:{})});if(this.stopped)return;
          const document=this.acceptResponse(value,basis);
          if(row.request.kind==='operate'&&document.id!==row.request.operation.designId || row.request.kind==='create'&&row.request.audience==='personal'&&document.scope.ownerMemberId!==this.options.memberId)throw Error('CREATIVE_RESPONSE_SCOPE');
          if(row.request.kind==='operate'){const operation=row.request.operation,entry=document.operations.find(item=>item.operation.id===operation.id),receipt=value.receipt as KittyDesignReceipt|undefined;if(!receipt||receipt.version!==1||receipt.designId!==document.id||receipt.id!==operation.id||receipt.actorId!==this.options.memberId||receipt.kind!==operation.kind||receipt.revision!==entry?.order||entry.actorId!==this.options.memberId||canonicalDesignJSON(entry.operation)!==canonicalDesignJSON(operation))throw Error('CREATIVE_RECEIPT_MISMATCH');this.receipts.set(receipt.id,receipt);}else {if(row.request.nestSource&&(!document.nest||document.nest.view!==row.request.nestSource.view||document.nest.designKey!==row.request.nestSource.designKey))throw Error('CREATIVE_RESPONSE_SCOPE');this.resolutions.set(row.request.designId,document.id);}
          // Removal happens after accepted content and receipt were verified. Failure leaves the same identity retryable.
          this.persist(this.pending.filter(item=>item.id!==row.id));
        }catch(error){
          if(this.stopped)return;
          const definite=error instanceof DesignTransportError&&error.definite;
          const message=definite?'This edit needs a change before it can be accepted. Your work is retained.':'The connection ended before we could verify this edit. Retry checks the same receipt.';
          const pending=this.pending.map(item=>item.id===row.id?{...item,status:definite?'rejected' as const:'uncertain' as const,message}:item);
          try{this.persist(pending);}catch{this.pending=pending;this.storageError='The retained edits could not be updated on this device. Keep this Studio open.';this.changed();}return;
        }
      }
    };
    this.flushPromise=run().finally(()=>{this.flushPromise=null;});return this.flushPromise;
  }
  close(){this.stopped=true;this.controller.abort();this.documents.clear();this.receipts.clear();this.listeners.clear();}
}
function decodeRequest(value:unknown):DesignRequest {
  designRecord(value,['version','kind','designId','bankId','audience','nestSource','operation'],['version','kind']);
  if(value.version!==1)throw Error('CREATIVE_REQUEST_VERSION');
  if(value.kind==='operate'){designRecord(value,['version','kind','operation']);return {version:1,kind:'operate',operation:decodeKittyDesignOperation(value.operation)};}
  designRecord(value,['version','kind','designId','bankId','audience','nestSource'],['version','kind','designId','bankId']);if(value.kind!=='create')throw Error('CREATIVE_REQUEST_KIND');designId(value.designId);if(value.bankId!==null)designId(value.bankId);if(value.audience!==undefined&&value.audience!=='personal')throw Error('DESIGN_AUDIENCE_CONFLICT');
  const nestSource=value.nestSource===undefined?undefined:decodeNestSource(value.nestSource);if(nestSource&&value.bankId!==null)throw Error('DESIGN_NEST_GOAL_CONFLICT');
  if(value.audience==='personal'&&(value.bankId!==null||nestSource))throw Error('DESIGN_AUDIENCE_CONFLICT');
  return {version:1,kind:'create',designId:value.designId,bankId:value.bankId as string|null,...(value.audience==='personal'?{audience:'personal' as const}:{}),...(nestSource?{nestSource}:{})};
}
