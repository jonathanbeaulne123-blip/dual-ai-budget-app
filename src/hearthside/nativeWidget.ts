import type {Environment} from '../core/types.ts';
export interface NativeWidgetPlugin {
  widgetAvailability():Promise<{supported:boolean;reason:string}>;
  setWidget(input:{selectionId:string;scopeDigest:string;pngBase64:string}):Promise<void>;
  clearWidget():Promise<void>;
}
export type NativeWidgetScope={environment:Environment;householdId:string;memberId:string;subject:string};
export type NativeWidgetSelection={version:1;designId:string;pieceId:string;revision:number;pngBase64:string};
const digest=async(value:unknown)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function nativeWidgetScopeDigest(scope:NativeWidgetScope):Promise<string>{
  if(!['development','production'].includes(scope.environment)||Object.values(scope).some(v=>!v||v.length>300))throw new Error('The widget household is unavailable.');return digest(['hearth-widget-v1',scope.environment,scope.householdId,scope.memberId,scope.subject]);
}
/** Explicit review binds exact image bytes and immutable identity. No bank/backing fields are accepted. */
export async function reviewNativeWidget(scope:NativeWidgetScope,selection:NativeWidgetSelection):Promise<{scopeDigest:string;reviewDigest:string;selection:NativeWidgetSelection}>{
  if(Object.keys(selection).sort().join(',')!=='designId,pieceId,pngBase64,revision,version'||selection.version!==1||!Number.isSafeInteger(selection.revision)||selection.revision<0||![selection.designId,selection.pieceId].every(v=>typeof v==='string'&&v.length>0&&v.length<=180)||!/^iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(selection.pngBase64)||selection.pngBase64.length>700000)throw new Error('Choose a captured immutable sculpture image.');
  const scopeDigest=await nativeWidgetScopeDigest(scope),snapshot=Object.freeze({...selection});return{scopeDigest,reviewDigest:await digest([scopeDigest,snapshot]),selection:snapshot};
}
export class NativeWidgetController {
  private ready=false;private generation=0;private scopeDigest:string|null=null;private tail:Promise<void>=Promise.resolve();
  constructor(private readonly plugin:NativeWidgetPlugin){}
  async enterScope(scope:NativeWidgetScope|null):Promise<void>{
    const generation=++this.generation,scopeDigest=scope?await nativeWidgetScopeDigest(scope):null;if(generation!==this.generation)return;
    // Startup and every actual scope transition clear an old selection. Re-entering never opts in.
    if(this.scopeDigest===scopeDigest&&scopeDigest!==null&&this.ready)return;this.ready=false;this.scopeDigest=scopeDigest;
    const work=this.tail.catch(()=>{}).then(()=>this.plugin.clearWidget());this.tail=work;await work;if(generation===this.generation)this.ready=true;
  }
  async select(scope:NativeWidgetScope,selection:NativeWidgetSelection,reviewDigest:string):Promise<void>{
    const generation=this.generation,review=await reviewNativeWidget(scope,selection);
    if(!this.ready||generation!==this.generation||this.scopeDigest!==review.scopeDigest||review.reviewDigest!==reviewDigest)throw new Error('Review this widget again in the selected household.');
    const work=this.tail.catch(()=>{}).then(async()=>{if(generation!==this.generation)throw new Error('The widget household changed.');await this.plugin.setWidget({selectionId:crypto.randomUUID(),scopeDigest:review.scopeDigest,pngBase64:review.selection.pngBase64});});this.tail=work;await work;
  }
  async clear():Promise<void>{const generation=++this.generation;this.ready=false;const work=this.tail.catch(()=>{}).then(()=>this.plugin.clearWidget());this.tail=work;await work;if(generation===this.generation)this.ready=true;}
}
