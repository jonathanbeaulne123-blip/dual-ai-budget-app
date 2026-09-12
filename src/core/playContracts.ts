/** Finite, serializable Play resources. No URLs, financial values or arbitrary scene transforms. */
export const PLAY_AREAS = ['dressing','gallery','banks','cabinet','window','desk'] as const;
export type PlayArea = typeof PLAY_AREAS[number];
export const PLAY_COMPOSITIONS = ['centrepiece','gallery','collector'] as const;
export const PLAY_THEMES = ['classic','taylor','newfoundland'] as const;
export const PLAY_POSES = ['loaf','sit','walk','stretch','sleep','perch'] as const;
export const PLAY_REWARDS = ['camera','theatre','key','orrery','lantern','projector'] as const;
export type PlayReward = typeof PLAY_REWARDS[number];
export const PLAY_DISCOVERIES = ['portrait','drawer','bell','mirror','spool','lamp','latch','tea','paper','ribbon','lighthouse','boat'] as const;
export type PlayDiscovery = typeof PLAY_DISCOVERIES[number];
export const PLAY_KEEPSAKES = ['teapot','plant','books','globe','house','shell','ribbon','spool'] as const;
export const PLAY_SLOTS = [...Array.from({length:8},(_,i)=>`portrait-${i+1}`),...Array.from({length:3},(_,i)=>`bank-${i+1}`),...Array.from({length:6},(_,i)=>`toy-${i+1}`),...Array.from({length:4},(_,i)=>`keepsake-${i+1}`)];
export type PortraitSettings = {pose:typeof PLAY_POSES[number];light:'daylight'|'lamplight'|'studio';crop:'head'|'seated'|'full';format:'square'|'portrait';background:'cream'|'rose'|'harbour';frame:'brass'|'wood'|'paper';caption:string};
export const DEFAULT_PORTRAIT:PortraitSettings={pose:'sit',light:'daylight',crop:'full',format:'portrait',background:'cream',frame:'brass',caption:''};
export type PlayPlacement={kind:'portrait'|'bank'|'toy'|'keepsake';id:string};
export type PlaySlot={id:string;revision:number;value:PlayPlacement|null};
export type PlayDecor={composition:typeof PLAY_COMPOSITIONS[number];frame:'brass'|'wood'|'paper';furnishing:'warm'|'light'|'deep';lighting:'daylight'|'lamplight'|'studio'};
export type PlayAward={id:PlayReward;ruleVersion:1;evidence:string;claimedBy:string};
export type PlayRoom={version:1;decor:{revision:number;value:PlayDecor};slots:PlaySlot[];awards:PlayAward[];pinnedGoals:string[]};
export type PlayPrivate={version:1;revision:number;portrait:PortraitSettings;discoveries:PlayDiscovery[];awards:PlayAward[];sound:boolean;paused:boolean};
export const emptyPlayRoom=():PlayRoom=>({version:1,decor:{revision:0,value:{composition:'centrepiece',frame:'brass',furnishing:'warm',lighting:'daylight'}},slots:[],awards:[],pinnedGoals:[]});
export const emptyPlayPrivate=():PlayPrivate=>({version:1,revision:0,portrait:{...DEFAULT_PORTRAIT},discoveries:[],awards:[],sound:false,paused:false});
function obj(v:unknown,keys:string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('INVALID_PLAY_RESOURCE');const proto=Object.getPrototypeOf(v);if(proto!==Object.prototype&&proto!==null)throw Error('INVALID_PLAY_PROTOTYPE');for(const key of Reflect.ownKeys(v)){if(typeof key!=='string'||!keys.includes(key)||!('value' in Object.getOwnPropertyDescriptor(v,key)!))throw Error('INVALID_PLAY_FIELD');}return v as Record<string,unknown>;}
function word(v:unknown,max=128):string{if(typeof v!=='string'||v.length>max||!v.trim()||/[\u0000-\u001f]/.test(v))throw Error('INVALID_PLAY_TEXT');return v;}
function pick<T extends string>(v:unknown,options:readonly T[]):T{if(!options.includes(v as T))throw Error('INVALID_PLAY_CHOICE');return v as T;}
function rev(v:unknown):number{if(!Number.isSafeInteger(v)||(v as number)<0)throw Error('INVALID_PLAY_REVISION');return v as number;}
function list<T>(v:unknown,max:number,decode:(v:unknown)=>T):T[]{if(!Array.isArray(v)||v.length>max||Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1||Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).some(d=>!d||!('value' in d)))throw Error('PLAY_LIMIT');return v.map(decode);}
function unique<T>(rows:T[],key:(v:T)=>string):T[]{if(new Set(rows.map(key)).size!==rows.length)throw Error('DUPLICATE_PLAY_RESOURCE');return rows;}
export function decodePortrait(v:unknown):PortraitSettings{const r=obj(v,['pose','light','crop','format','background','frame','caption']);if(typeof r.caption!=='string'||r.caption.length>180||/[\u0000-\u001f]/.test(r.caption))throw Error('INVALID_PORTRAIT_CAPTION');return {pose:pick(r.pose,PLAY_POSES),light:pick(r.light,['daylight','lamplight','studio']),crop:pick(r.crop,['head','seated','full']),format:pick(r.format,['square','portrait']),background:pick(r.background,['cream','rose','harbour']),frame:pick(r.frame,['brass','wood','paper']),caption:r.caption};}
export function decodePlayPlacement(v:unknown):PlayPlacement|null{if(v===null)return null;const r=obj(v,['kind','id']);const kind=pick(r.kind,['portrait','bank','toy','keepsake']);const id=word(r.id);if(kind==='toy')pick(id,PLAY_REWARDS);if(kind==='keepsake')pick(id,PLAY_KEEPSAKES);return {kind,id};}
export function decodePlayDecor(v:unknown):PlayDecor{const r=obj(v,['composition','frame','furnishing','lighting']);return {composition:pick(r.composition,PLAY_COMPOSITIONS),frame:pick(r.frame,['brass','wood','paper']),furnishing:pick(r.furnishing,['warm','light','deep']),lighting:pick(r.lighting,['daylight','lamplight','studio'])};}
function award(v:unknown):PlayAward{const r=obj(v,['id','ruleVersion','evidence','claimedBy']);if(r.ruleVersion!==1)throw Error('PLAY_RULE_VERSION');return {id:pick(r.id,PLAY_REWARDS),ruleVersion:1,evidence:word(r.evidence,240),claimedBy:word(r.claimedBy)};}
export function decodePlayRoom(v:unknown):PlayRoom{if(v===undefined)return emptyPlayRoom();const r=obj(v,['version','decor','slots','awards','pinnedGoals']);if(r.version!==1)throw Error('PLAY_VERSION');const d=obj(r.decor,['revision','value']);return {version:1,decor:{revision:rev(d.revision),value:decodePlayDecor(d.value)},slots:unique(list(r.slots,21,v=>{const s=obj(v,['id','revision','value']);const id=pick(s.id,PLAY_SLOTS),value=decodePlayPlacement(s.value);if(value&&!id.startsWith(value.kind==='portrait'?'portrait-':value.kind==='bank'?'bank-':value.kind==='toy'?'toy-':'keepsake-'))throw Error('PLAY_SLOT_MISMATCH');return {id,revision:rev(s.revision),value};}),s=>s.id),awards:unique(list(r.awards,6,award),a=>a.id),pinnedGoals:unique(list(r.pinnedGoals,3,v=>word(v)),s=>s)};}
export function decodePlayPrivate(v:unknown):PlayPrivate{if(v===undefined)return emptyPlayPrivate();const r=obj(v,['version','revision','portrait','discoveries','awards','sound','paused']);if(r.version!==1||typeof r.sound!=='boolean'||typeof r.paused!=='boolean')throw Error('PLAY_VERSION');return {version:1,revision:rev(r.revision),portrait:decodePortrait(r.portrait),discoveries:unique(list(r.discoveries,12,v=>pick(v,PLAY_DISCOVERIES)),s=>s),awards:unique(list(r.awards,6,award),a=>a.id),sound:r.sound,paused:r.paused};}
export type PlayOperation=
 |{kind:'slot';slotId:string;expectedRevision:number;value:PlayPlacement|null}
 |{kind:'decor';expectedRevision:number;value:PlayDecor}
 |{kind:'private';expectedRevision:number;portrait:PortraitSettings;sound:boolean;paused:boolean}
 |{kind:'discover';discovery:PlayDiscovery;theme:typeof PLAY_THEMES[number];galleryId?:string}
 |{kind:'claim';reward:PlayReward;goalId?:string;share?:boolean}
 |{kind:'pin';goalId:string;pinned:boolean};

export function decodePlayOperation(value:unknown):PlayOperation{
 const kind=(Object.getOwnPropertyDescriptor(value??{},'kind')?.value) as string;
 const keys:Record<string,string[]>={slot:['kind','slotId','expectedRevision','value'],decor:['kind','expectedRevision','value'],private:['kind','expectedRevision','portrait','sound','paused'],discover:['kind','discovery','theme','galleryId'],claim:['kind','reward','goalId','share'],pin:['kind','goalId','pinned']};
 if(!keys[kind])throw Error('PLAY_OPERATION_UNKNOWN');const r=obj(value,keys[kind]!);
 if(kind==='slot')return {kind,slotId:pick(r.slotId,PLAY_SLOTS),expectedRevision:rev(r.expectedRevision),value:decodePlayPlacement(r.value)};
 if(kind==='decor')return {kind,expectedRevision:rev(r.expectedRevision),value:decodePlayDecor(r.value)};
 if(kind==='private'){if(typeof r.sound!=='boolean'||typeof r.paused!=='boolean')throw Error('PLAY_INVALID_SETTINGS');return {kind,expectedRevision:rev(r.expectedRevision),portrait:decodePortrait(r.portrait),sound:r.sound,paused:r.paused};}
 if(kind==='discover')return {kind,discovery:pick(r.discovery,PLAY_DISCOVERIES),theme:pick(r.theme,PLAY_THEMES),...(r.galleryId!==undefined?{galleryId:word(r.galleryId)}:{})};
 if(kind==='claim'){if(r.share!==undefined&&typeof r.share!=='boolean')throw Error('PLAY_INVALID_SHARE');return {kind,reward:pick(r.reward,PLAY_REWARDS),...(r.goalId!==undefined?{goalId:word(r.goalId)}:{}),...(r.share!==undefined?{share:r.share as boolean}:{})};}
 if(typeof r.pinned!=='boolean')throw Error('PLAY_INVALID_PIN');return {kind:'pin',goalId:word(r.goalId),pinned:r.pinned};
}

export function validatePlayEnvelope(v:unknown):void { const r=obj(v,['version','id','scope','operation']); if(r.version!==1)throw Error('PLAY_VERSION');word(r.id);const scope=obj(r.scope,['environment','householdId','memberId']);word(scope.environment);word(scope.householdId);word(scope.memberId); }
