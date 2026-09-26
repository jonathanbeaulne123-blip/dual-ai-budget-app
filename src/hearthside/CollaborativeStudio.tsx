import {NestProp} from '../kitty/NestProp.tsx';
import {assertNestDocumentVisible} from './nestDesignSource.ts';
import type {NestDesignSource} from './nestDesignBinding.ts';
import type {KittySculptV1} from '../core/types.ts';
import {NativeWidgetEntry} from './NativeWidgetEntry.tsx';
import {nativeWidgetPlugin} from './nativeBootstrap.ts';
import {KeyboardPaint} from './KeyboardPaint.tsx';
import {RejectedDesignEdit} from './RejectedDesignEdit.tsx';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Household, KittyPart, KittyStrokeV1, KittyStampKind } from '../core/types.ts';
import { KITTY_BODIES, KITTY_EARS, KITTY_EYES, KITTY_HEADS, KITTY_MOUTHS, KITTY_NOSES, KITTY_TAILS, KITTY_WHISKERS, KITTY_PARTS, KITTY_STAMP_KINDS, KITTY_FEATURES, KITTY_STUDIO_LIMITS, quantizeKittyStroke } from '../core/kittyStudio.ts';
import { KittyStage, type KittyHit, type KittyStageApi } from '../kitty/KittyStage.tsx';
import { KittyFlat } from '../kitty/studio/flat.tsx';
import { useDesignClient } from './DesignProvider.tsx';
import { projectKittyDesign,snapshotKittyDesignRevision } from './design.ts';
import {DesignExportSurface} from './DesignExportSurface.tsx';
import {NativeSceneSurface,type NativeFundingIntent,type NativeReceiptUpdate} from './NativeSceneSurface.tsx';
import {useAppearance} from '../theme/ThemeProvider.tsx';
import {hearthsidePath} from './routes.ts';
import {kittyBankBackingStep} from '../core/kittyBanks.ts';
import {playBankFacts} from '../core/herculesPlay.ts';
import {todayKey} from '../core/calendar.ts';
import type { KittyDesignOperation, KittyShapeField } from './designContracts.ts';
import { attachCreativePresence, type CreativePeer } from './creativePresence.ts';
import { HEARTHSIDE_FLAGS } from './flags.ts';
import './collaborativeStudio.css';

type Payload=KittyDesignOperation extends infer T?T extends KittyDesignOperation?Omit<T,'version'|'id'|'designId'|'pieceId'|'gestureId'>:never:never;
const shapes={body:KITTY_BODIES,head:KITTY_HEADS,ears:KITTY_EARS,eyes:KITTY_EYES,mouth:KITTY_MOUTHS,whiskers:KITTY_WHISKERS,tail:KITTY_TAILS,nose:KITTY_NOSES};
const colourNames=[['#bb4964','Rose'],['#487d78','Sea glass'],['#4c6092','Evening blue'],['#dca540','Honey'],['#63453b','Cocoa'],['#f7eee0','Cream']] as const;
const uuid=(prefix:string)=>`${prefix}-${crypto.randomUUID()}`;
export type CollaborativeStudioProps={audience?:'personal';returnPath?:string;onSelection?:(designId:string,pieceId:string)=>void;nestSource?:NestDesignSource;initialSculpt?:KittySculptV1;household:Household;memberId:string;bankId?:string;initialDesignId?:string;initialPieceId?:string;initialTab?:'shape'|'paint'|'kiln'|'wardrobe';onTabChange?:(tab:'shape'|'paint'|'kiln')=>void;writesEnabled?:boolean;handoff?:(designId:string,pieceId:string,revision:number,pending:boolean)=>ReactNode;onKeep?:(designId:string,pieceId:string,revision:number)=>void;onFundingIntent?:(intent:NativeFundingIntent)=>void;acceptedReceipt?:NativeReceiptUpdate;wardrobe?:ReactNode};
export function CollaborativeStudio(props:CollaborativeStudioProps){
  return <StudioSession key={`${props.household.environment}:${props.household.householdId}:${props.memberId}:${props.audience??'household'}:${props.bankId??(props.nestSource?JSON.stringify([props.nestSource.view,props.nestSource.designKey]):'free')}`} {...props}/>;
}
function StudioSession({audience,returnPath,onSelection,nestSource,initialSculpt,household,memberId,bankId,initialDesignId,initialPieceId,initialTab='shape',onTabChange,writesEnabled=HEARTHSIDE_FLAGS.collaborativeDesign,onKeep,onFundingIntent,acceptedReceipt,wardrobe,handoff}:CollaborativeStudioProps){
  const client=useDesignClient(),bank=household.goals.find(g=>g.id===bankId);
  const appearance=useAppearance(),[surface,setSurface]=useState<{kind:'export'|'ar'|'widget';revision:number}|null>(null);
  const [designId,setDesignId]=useState(initialDesignId??bank?.envelope?.designRef?.designId??''),[pieceId,setPieceId]=useState(initialPieceId??'');
  const [joined,setJoined]=useState(false),[tab,setTab]=useState<'shape'|'paint'|'kiln'|'wardrobe'>(initialTab),[message,setMessage]=useState('');
  const [colour,setColour]=useState('#bb4964'),[size,setSize]=useState(14),[opacity,setOpacity]=useState(.9),[mirror,setMirror]=useState(false),[eraser,setEraser]=useState(false),[part,setPart]=useState<KittyPart>('body');
  const [u,setU]=useState(.5),[v,setV]=useState(.5),[stampKind,setStampKind]=useState<KittyStampKind>('heart'),[stampText,setStampText]=useState(''),[stampId,setStampId]=useState('');
  const [peers,setPeers]=useState<CreativePeer[]>([]),[presenceState,setPresenceState]=useState('offline'),[fireReview,setFireReview]=useState<number|null>(null),[reveal,setReveal]=useState<string|null>(null);
  const stage=useRef<KittyStageApi|null>(null),presence=useRef<ReturnType<typeof attachCreativePresence>|null>(null),active=useRef<{gestureId:string;stroke:KittyStrokeV1;epoch:number;surface:number;designId:string;pieceId:string;operationId:string}|null>(null),deviceId=useRef(uuid('DEVICE'));
  const live=useRef({designId,pieceId,joined});live.current={designId,pieceId,joined};
  const personalAudience=audience==='personal'||nestSource?.view==='personal'||Boolean(bank&&!bank.shared);
  const expectedOwner=personalAudience?memberId:null;
  const cachedDocument=client?.documents.get(designId);
  const document=useMemo(()=>{if(!cachedDocument)return undefined;try{assertNestDocumentVisible(household,memberId,cachedDocument);return cachedDocument.scope.ownerMemberId===expectedOwner?cachedDocument:undefined;}catch{return undefined;}},[cachedDocument,household,memberId,expectedOwner]);
  const audienceConflict=Boolean(cachedDocument&&!document);
  const view=useMemo(()=>document?projectKittyDesign(document):null,[document]);
  const row=pieceId?view?.pieces.find(p=>p.piece.id===pieceId):view?.pieces.find(p=>p.piece.id===view.displayPieceId)??view?.pieces[0];
  const requestedTab=useRef(initialTab);
  useEffect(()=>{if(requestedTab.current===initialTab)return;requestedTab.current=initialTab;finishStroke(false);setTab(initialTab);},[initialTab]);
  const requestedSelection=useRef({designId:initialDesignId,pieceId:initialPieceId});
  useEffect(()=>{const prior=requestedSelection.current;requestedSelection.current={designId:initialDesignId,pieceId:initialPieceId};if(prior.designId===initialDesignId&&prior.pieceId===initialPieceId)return;const target=initialDesignId??bank?.envelope?.designRef?.designId??'';if(target===live.current.designId&&(initialPieceId??'')===live.current.pieceId)return;finishStroke(false);setJoined(false);setSurface(null);setDesignId(target);setPieceId(initialPieceId??'');},[initialDesignId,initialPieceId]);
  const currentId=row?.piece.id??'';live.current={designId,pieceId:currentId||pieceId,joined};
  const selectionCallback=useRef(onSelection);selectionCallback.current=onSelection;
  useEffect(()=>{if(document&&currentId&&projectKittyDesign(document).pieces.some(p=>p.piece.id===currentId))selectionCallback.current?.(document.id,currentId);},[document?.id,currentId]);
  useEffect(()=>setSurface(null),[designId,currentId]);
  const requests=client?.pending.filter(p=>p.request.kind==='operate'?p.request.operation.designId===designId:p.request.designId===designId)??[];
  const designShelf=personalAudience&&household.personalLife?.ownerMemberId===memberId?household.personalLife.designs:personalAudience?[]:household.hearthside?.designs??[];
  const indexedRevision=designShelf.find(index=>index.designId===designId)?.revision??bank?.envelope?.designRef?.revision??0;
  const blocked=Boolean(!joined||!writesEnabled||!client||client.storageError||requests.some(p=>p.status!=='queued'));
  const editable=Boolean(row?.status==='clay'&&!blocked),waiting=Boolean(requests.length);
  const ownGestures=view?.gestures.filter(g=>g.actorId===memberId&&g.pieceId===currentId&&g.editable)??[];
  const undo=ownGestures.filter(g=>g.active).at(-1),redo=ownGestures.filter(g=>!g.active).sort((a,b)=>b.revision-a.revision)[0];
  useEffect(()=>{if(client&&designId)void client.load(designId,indexedRevision);},[client,designId,indexedRevision]);
  useEffect(()=>{if(!designId&&bank?.envelope?.designRef)setDesignId(bank.envelope.designRef.designId);},[bank?.envelope?.designRef,designId]);
  useEffect(()=>{
    if(!client||!joined||!designId||!currentId||document?.scope.ownerMemberId)return;
    presence.current=attachCreativePresence({environment:household.environment,householdId:household.householdId,target:{designId,pieceId:currentId,room:'studio',deviceId:deviceId.current},token:client.options.token,onPeers:setPeers,onState:setPresenceState});
    return ()=>{finishStroke(false);presence.current?.close();presence.current=null;};
  },[client,joined,designId,currentId,household.environment,household.householdId,document?.scope.ownerMemberId]);
  const pendingStrokes=requests.flatMap(r=>r.request.kind==='operate'&&r.request.operation.kind==='append-stroke'&&r.request.operation.pieceId===currentId?[r.request.operation.stroke]:[]);
  const ghostStrokes=peers.flatMap(p=>p.stroke?[p.stroke]:[]);
  const stagePiece=useMemo(()=>row?{...row.piece,paint:{...row.piece.paint,strokes:[...row.piece.paint.strokes,...pendingStrokes,...ghostStrokes,...(active.current?[active.current.stroke]:[])]}}:null,[row,JSON.stringify(pendingStrokes),JSON.stringify(ghostStrokes),JSON.stringify(active.current?.stroke)]);
  async function submit(payload:Payload,gestureId=uuid('GESTURE'),target=currentId){
    if(!client||!joined||!writesEnabled||!document||document.scope.ownerMemberId!==expectedOwner){setMessage(personalAudience?'That shared piece cannot be changed from your Personal studio.':'That private piece cannot be changed from Our studio.');return false;}
    const selected=designId;
    try{
      const accepted=await client.enqueue({version:1,kind:'operate',operation:{version:1,id:uuid('OP'),designId:selected,pieceId:target,gestureId,...payload} as KittyDesignOperation});
      if(live.current.designId!==selected)return false;
      setMessage(accepted?personalAudience?'Kept in your private creative history.':'Kept in your shared creative history.':'Your edit is retained while its receipt is checked.');return accepted;
    }catch(error){setMessage(error instanceof Error?error.message:'This edit could not be retained.');return false;}
  }
  async function start(){
    if(!client||!writesEnabled)return;
    const selected=designId||uuid('DESIGN');setDesignId(selected);
    const cached=client.documents.get(selected);if(cached&&cached.scope.ownerMemberId!==expectedOwner){setJoined(false);setMessage(personalAudience?'That shared piece cannot be opened in your Personal studio.':'That private piece cannot be opened in Our studio.');return;}
    setJoined(true);
    try{if(!cached){const ok=await client.enqueue({version:1,kind:'create',designId:selected,bankId:bankId??null,...(audience?{audience}:{}),...(nestSource?{nestSource}:{})});if(!ok){setJoined(false);return;}}
      // A repeated bank migration can resolve to a document another member already created.
      const found=client.documents.get(client.resolutions.get(selected)??selected);
      if(found&&found.scope.ownerMemberId===expectedOwner){setDesignId(found.id);if(!projectKittyDesign(found).pieces.length){const id=uuid('PIECE');setPieceId(id);await client.enqueue({version:1,kind:'operate',operation:{version:1,id:uuid('OP'),designId:found.id,pieceId:id,gestureId:uuid('GESTURE'),kind:'create-piece',base:'cream',...(initialSculpt?{sculpt:initialSculpt}:{})}});}}
      else if(found)throw Error(personalAudience?'That shared piece cannot be opened in your Personal studio.':'That private piece cannot be opened in Our studio.');
    }catch(error){setJoined(false);setMessage(error instanceof Error?error.message:'This Studio could not be opened.');}
  }
  function finishStroke(announce=true){
    const stroke=active.current;active.current=null;if(!stroke||!client||!stroke.stroke.pts.length)return;
    presence.current?.preview(stroke.gestureId,null);
    // Capture the gesture's original scope/surface before a room or piece changes.
    // enqueue persists synchronously even when the provider has already closed.
    void client.enqueue({version:1,kind:'operate',operation:{version:1,id:stroke.operationId,designId:stroke.designId,pieceId:stroke.pieceId,gestureId:stroke.gestureId,kind:'append-stroke',expectedEditEpoch:stroke.epoch,surfaceRevision:stroke.surface,stroke:quantizeKittyStroke(stroke.stroke)}}).then(accepted=>{if(announce&&live.current.designId===stroke.designId)setMessage(accepted?'Your brush mark is kept.':'Your brush mark is retained while its receipt is checked.');}).catch(error=>{if(announce)setMessage(error instanceof Error?error.message:'This brush mark could not be retained.');});
  }
  function paint(hit:KittyHit|null,phase:'down'|'move'|'up'){
    if(phase==='up'){finishStroke();return;}if(!editable||!row||!hit)return;
    if(phase==='down')active.current={gestureId:uuid('GESTURE'),operationId:uuid('OP'),designId,pieceId:currentId,epoch:row.editEpoch,surface:row.surfaceRevisions[hit.part],stroke:{part:hit.part,tool:eraser?'eraser':'brush',color:colour,size,opacity,mirror,pts:[]}};
    const drawing=active.current;if(!drawing)return;
    if(hit.part!==drawing.stroke.part){finishStroke();return;}
    const pts=drawing.stroke.pts;if(pts.length>=4000){finishStroke();setMessage('That stroke is kept. Lift the brush and continue.');return;}
    const previous=pts.length;if(previous>=2&&Math.hypot(hit.uv.u-pts[previous-2]!,hit.uv.v-pts[previous-1]!)<.003)return;
    pts.push(hit.uv.u,hit.uv.v);stage.current?.paintStroke(drawing.stroke,Math.max(0,previous/2-1));presence.current?.preview(drawing.gestureId,drawing.stroke);
  }
  useEffect(()=>{if(active.current&&row&&active.current.surface!==row.surfaceRevisions[active.current.stroke.part])finishStroke();},[row?.surfaceRevisions]);
  async function shape(field:KittyShapeField,value:string|number){if(!row)return;await submit({kind:'change-shape-field',field,value,expectedFieldRevision:row.fieldRevisions[`shape:${field}`]??0,expectedEditEpoch:row.editEpoch});}
  const selectedStamp=row?.piece.paint.stamps.find(s=>s.id===stampId);
  const selection=surface&&document?{identity:{environment:household.environment,householdId:household.householdId,memberId,designId:document.id,pieceId:currentId,revision:surface.revision},piece:snapshotKittyDesignRevision(document,currentId,surface.revision).piece,...(document.nest?{appearance:document.nest.appearance}:{})}:null;
  const surfaceBank=bank??household.goals.find(goal=>goal.envelope?.designRef?.designId===designId),facts=surfaceBank?playBankFacts(household,surfaceBank.id,memberId):null;
  function closeSurface(){setSurface(null);requestAnimationFrame(()=>window.document.getElementById('studio-accepted-design-tools')?.focus());}
  if(surface&&selection)return surface.kind==='widget'?<NativeWidgetEntry selection={selection} onClose={closeSurface}/>:surface.kind==='export'?<DesignExportSurface enabled={HEARTHSIDE_FLAGS.exports} selection={selection} theme={appearance.scene.theme} onClose={closeSurface}/>:<NativeSceneSurface enabled={HEARTHSIDE_FLAGS.nativeAR} selection={selection} theme={appearance.scene.theme} fundingEnabled={Boolean(surfaceBank&&onFundingIntent)} backing={surfaceBank&&facts?{status:'available',step:kittyBankBackingStep(household,surfaceBank,todayKey())}:{status:'unavailable'}} returnPath={returnPath??hearthsidePath({version:1,householdId:household.householdId,room:'studio',mode:'present',object:{kind:'piece',id:currentId,designId}})} onFundingIntent={intent=>{if(onFundingIntent)onFundingIntent(intent);else setMessage('Open this piece’s bank in the Loft to review backing.');}} acceptedReceipt={acceptedReceipt} onClose={closeSurface}/>;
  return <section className="collaborative-studio" aria-label={personalAudience?'My private pottery Studio':'Our pottery Studio'} data-joined={joined}>
    <header><p className="kicker">{personalAudience?'Private clay and colour':'Clay, colour, and a little time together'}</p><h2>{bank?.name??(personalAudience?'My making table':'Our making table')}</h2><p>A piece can be something you make for its own sake.</p>
      <div className="studio-presence" role="status">{joined?<><span className="studio-participant">You are at the table</span>{peers.map(peer=><span className="studio-participant" key={peer.deviceId}>{household.members.find(m=>m.id===peer.memberId)?.name??'A household member'} {peer.stroke?'is painting':'is here'}</span>)}{presenceState!=='present'&&!personalAudience&&<small>Live presence is reconnecting.</small>}</>:<span>{personalAudience?'Join when you want to make in your private studio.':'Join the table when you want to make or share live presence.'}</span>}</div>
      <button onClick={()=>joined?(finishStroke(),setJoined(false)):void start()} disabled={!client||!writesEnabled||audienceConflict}>{joined?'Leave the making table':document?'Join this piece':audienceConflict?'Unavailable in this studio':bankId?'Open our clay':'Start a piece'}</button>
      {!writesEnabled&&<p>Collaborative making is awaiting activation. Saved artwork remains available.</p>}
    </header>
    {!bankId&&!nestSource&&<nav className="studio-shelf" aria-label={personalAudience?'My private pieces':'Our pieces'}>{designShelf.map((index,i)=><button key={index.designId} aria-pressed={designId===index.designId} onClick={()=>{finishStroke();setJoined(false);setPieceId('');setDesignId(index.designId);}}>{personalAudience?`My piece ${i+1}`:'bankId' in index&&index.bankId?household.goals.find(g=>g.id===index.bankId)?.name??'A painted bank':`Our piece ${i+1}`}</button>)}{wardrobe&&<button onClick={()=>{finishStroke();setTab('wardrobe');}}>Wardrobe and portraits</button>}</nav>}
    {client?.storageError&&<p role="alert">{client.storageError}</p>}
    {client?.pending.some(p=>p.status==='uncertain')&&<div className="studio-recovery" role="status"><p>Some edits are waiting for a verified receipt. They remain on this device.</p><button onClick={()=>void client.retry()}>Check the same receipts</button></div>}
    {client?.pending.filter(p=>p.status==='rejected'&&(p.request.kind==='create'?p.request.designId:p.request.operation.designId)===designId).map(p=><RejectedDesignEdit key={p.id} client={client} pending={p} enabled={joined&&writesEnabled}/>) }
    {message&&<p role="status">{message}</p>}
    {audienceConflict&&<p role="alert">{personalAudience?'This is a shared piece. Open it from Our studio; it cannot be changed or kept as Personal here.':'This is a private piece. Open it from your Personal studio; it cannot be changed or kept as Household here.'}</p>}
    {designId&&!document&&!audienceConflict&&<p role="status">{client?.errors.get(designId)||cachedDocument?'This artwork is unavailable. Your saved work has not been replaced.':'Opening the saved clay…'}<button onClick={()=>void client?.load(designId)}>Try loading again</button></p>}
    {pieceId&&document&&!row&&<p role="status">This selected piece is unavailable. Choose a piece deliberately to continue.</p>}
    {tab==='wardrobe'?<><button onClick={()=>setTab('shape')}>Back to clay and colour</button>{wardrobe}</>:row&&<>
      <nav className="studio-benches" aria-label="Making benches">{(['shape','paint','kiln'] as const).map(bench=><button aria-pressed={tab===bench} key={bench} onClick={()=>{finishStroke();setTab(bench);onTabChange?.(bench);}}>{bench==='shape'?'Shape the clay':bench==='paint'?'Paint and decorate':'The kiln'}</button>)}</nav>
      <div className="collaborative-studio-workspace">
        <div className="collaborative-studio-stage"><KittyStage ornament={document?.nest?.appearance} piece={stagePiece} glaze="cream" open={false} name={bank?.name??'Our piece'} mode={editable&&tab==='paint'?'paint':'view'} step={0} fired={row.status==='fired'} apiRef={stage} brush={{size,color:colour,erasing:eraser}} onPaint={paint}/><p className="studio-state">{waiting?'Your recent marks are awaiting receipts.':row.status==='fired'?'Fired and kept.':row.status==='archived'?'Kept in your archive.':'Working clay.'} {ghostStrokes.length?'Live partner marks are temporary until accepted.':''}</p></div>
        <div className="collaborative-studio-tools">
          <div className="studio-history"><button disabled={!editable||waiting||!undo} onClick={()=>undo&&void submit({kind:'undo-gesture',targetGestureId:undo.id,expectedGestureRevision:undo.revision,expectedEditEpoch:row.editEpoch})}>Undo my last gesture</button><button disabled={!editable||waiting||!redo} onClick={()=>redo&&void submit({kind:'redo-gesture',targetGestureId:redo.id,expectedGestureRevision:redo.revision,expectedEditEpoch:row.editEpoch})}>Redo my gesture</button></div>
          {tab==='shape'&&<fieldset disabled={!editable||waiting}><legend>The shape of this one</legend>{Object.entries(shapes).map(([field,choices])=><label key={field}>{field}<select value={row.piece.sculpt[field as keyof typeof shapes]} onChange={event=>void shape(field as KittyShapeField,event.target.value)}>{choices.map(choice=><option key={choice}>{choice}</option>)}</select></label>)}{row.piece.sculpt.profile.map((value,index)=><label key={index}>{['Belly','Waist','Shoulder','Neck'][index]}<input type="range" min={KITTY_STUDIO_LIMITS.profileMin} max={KITTY_STUDIO_LIMITS.profileMax} step="0.05" value={value} onChange={event=>void shape(`profile.${index}` as KittyShapeField,Number(event.target.value))}/></label>)}<details><summary>Fine details</summary>{KITTY_FEATURES.map(field=><label key={field}>{field} size<input type="range" min={KITTY_STUDIO_LIMITS.featureMin} max={KITTY_STUDIO_LIMITS.featureMax} step="0.05" value={row.piece.sculpt.features?.[field]??1} onChange={event=>void shape(`features.${field}`,Number(event.target.value))}/></label>)}</details></fieldset>}
          {tab==='paint'&&<><fieldset disabled={!editable}><legend>Our paint tray</legend><div className="studio-colours">{colourNames.map(([value,label])=><button type="button" aria-label={label} aria-pressed={colour===value} style={{background:value}} key={value} onClick={()=>setColour(value)}/>)}</div><label>Mix a colour<input type="color" value={colour} onChange={e=>setColour(e.target.value)}/></label><label>Brush width<input type="range" min="2" max="70" value={size} onChange={e=>setSize(Number(e.target.value))}/></label><label>Opacity<input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label><label><input type="checkbox" checked={mirror} onChange={e=>setMirror(e.target.checked)}/>Mirror my brush</label><label><input type="checkbox" checked={eraser} onChange={e=>setEraser(e.target.checked)}/>Eraser</label><label>Surface<select value={part} onChange={e=>setPart(e.target.value as KittyPart)}>{KITTY_PARTS.map(p=><option key={p}>{p}</option>)}</select></label><button disabled={waiting} onClick={()=>void submit({kind:'change-dip',part,color:colour,expectedFieldRevision:row.fieldRevisions[`dip:${part}`]??0,expectedEditEpoch:row.editEpoch})}>Dip this surface</button>{client&&<KeyboardPaint client={client} designId={designId} pieceId={currentId} part={part} style={{tool:eraser?'eraser':'brush',color:colour,size,opacity,mirror}} epoch={row.editEpoch} surfaceRevision={row.surfaceRevisions[part]} u={u} v={v} enabled={editable} onU={setU} onV={setV}/>}<details><summary>Stamps and little additions</summary><label>Choose an addition<select value={stampKind} onChange={e=>setStampKind(e.target.value as KittyStampKind)}>{KITTY_STAMP_KINDS.map(kind=><option key={kind}>{kind}</option>)}</select></label>{stampKind==='initial'&&<label>Letter<input maxLength={2} value={stampText} onChange={e=>setStampText(e.target.value)}/></label>}<button disabled={waiting||stampKind==='initial'&&!stampText.trim()} onClick={()=>void submit({kind:'add-stamp',expectedEditEpoch:row.editEpoch,stamp:{id:uuid('STAMP'),anchor:'belly',kind:stampKind,color:colour,size:.22,rotation:0,part,u,v,...(stampKind==='initial'?{text:stampText}:{})}})}>Place at the chosen position</button><label>Adjust an addition<select value={stampId} onChange={e=>setStampId(e.target.value)}><option value="">Choose</option>{row.piece.paint.stamps.map((stamp,i)=><option key={stamp.id} value={stamp.id}>{stamp.kind} {i+1}</option>)}</select></label>{selectedStamp&&<><label>Size<input type="range" min={KITTY_STUDIO_LIMITS.stampSize[0]} max={KITTY_STUDIO_LIMITS.stampSize[1]} step="0.02" disabled={waiting} value={selectedStamp.size} onChange={e=>void submit({kind:'update-stamp',stampId,field:'size',value:Number(e.target.value),expectedFieldRevision:row.fieldRevisions[`stamp:${stampId}:size`]??0,expectedEditEpoch:row.editEpoch})}/></label><button disabled={waiting} onClick={()=>void submit({kind:'update-stamp',stampId,field:'placement',value:{part,u,v},expectedFieldRevision:row.fieldRevisions[`stamp:${stampId}:placement`]??0,expectedEditEpoch:row.editEpoch})}>Move to the chosen position</button></>}</details></fieldset></>}
          {tab==='kiln'&&<section aria-label="Firing review"><h3>{row.status==='fired'?'This firing is part of your story':'Ready for the kiln?'}</h3><p>Firing keeps this exact revision. You can return to the same piece and keep making later.</p>{row.recoverablePaint.length>0&&<p>{row.recoverablePaint.length} marks belong to an earlier surface. They remain in this piece’s history.</p>}{row.status==='clay'?<button disabled={blocked||waiting||Boolean(active.current)} onClick={()=>setFireReview(row.revision)}>Review this firing</button>:row.status==='fired'?<button disabled={blocked||waiting} onClick={()=>void submit({kind:'reopen',expectedRevision:row.revision})}>Bring it back to the table</button>:null}{fireReview!==null&&<div className="studio-firing-review" role="group" aria-label="Keep this firing"><KittyFlat piece={row.piece}/>{document?.nest&&<NestProp ornament={document.nest.appearance}/>}<p>Keep the piece shown here, at revision {fireReview}.</p>{peers.some(p=>p.stroke)&&<p>Someone is still painting. New marks may change this review.</p>}<button disabled={blocked||waiting||fireReview!==row.revision} onClick={async()=>{if(await submit({kind:'fire',expectedRevision:fireReview})){setReveal(currentId);setFireReview(null);}}}>Fire this revision</button><button onClick={()=>setFireReview(null)}>Back to making</button>{fireReview!==row.revision&&<p>The piece changed. Review it again before firing.</p>}</div>}{reveal===currentId&&row.status==='fired'&&<div className="studio-reveal" role="status"><strong>A little thing, made with care.</strong><p>This reveal stays in the piece’s history for later.</p></div>}<button disabled={blocked||waiting||view?.displayPieceId===currentId||row.status==='archived'} onClick={()=>view&&void submit({kind:'select-display',expectedDisplayRevision:view.displayRevision})}>Display this piece</button>{onKeep&&<button disabled={waiting||!document||document.scope.ownerMemberId!==expectedOwner} onClick={()=>{if(document&&document.scope.ownerMemberId===expectedOwner)onKeep(designId,currentId,view!.revision);}}>{personalAudience?'Keep this piece with my private memory':'Link this piece to our intention'}</button>}<details><summary>Earlier firings and recoverable paint</summary>{row.snapshots.map(snapshot=><figure key={snapshot.id}><KittyFlat piece={snapshot.piece}/>{document?.nest&&<NestProp ornament={document.nest.appearance}/>}<figcaption>Firing from {new Date(snapshot.acceptedAt).toLocaleDateString()} · revision {snapshot.revision}</figcaption><button disabled={!HEARTHSIDE_FLAGS.exports} onClick={()=>setSurface({kind:'export',revision:snapshot.revision})}>Make files from this firing</button><button disabled={!HEARTHSIDE_FLAGS.nativeAR} onClick={()=>setSurface({kind:'ar',revision:snapshot.revision})}>Place this firing beside me</button></figure>)}{row.recoverablePaint.map((paint,i)=><p key={paint.operationId??i}>Mark on {paint.stroke.part}, kept with its earlier shape.</p>)}</details><button disabled={blocked||waiting||row.status==='archived'} onClick={()=>void submit({kind:'archive-piece',expectedRevision:row.revision})}>Put this piece in the archive</button></section>}
        </div>
      </div>
      <nav className="studio-piece-shelf" aria-label="Pieces in this design">{view?.pieces.map((piece,i)=><button key={piece.piece.id} aria-pressed={piece.piece.id===currentId} onClick={()=>{finishStroke();setPieceId(piece.piece.id);setFireReview(null);}}><KittyFlat piece={piece.piece}/><span>Piece {i+1} · {piece.status}</span></button>)}<button disabled={blocked||waiting} onClick={()=>{const id=uuid('PIECE');void submit({kind:'create-piece',base:'cream'},uuid('GESTURE'),id).then(ok=>{if(ok)setPieceId(id);});}}>Start another piece</button></nav>
    </>}
    {row&&document&&<section className="studio-accepted-tools" aria-labelledby="studio-accepted-design-tools"><h3 id="studio-accepted-design-tools" tabIndex={-1}>A piece beyond the table</h3><p>Use the accepted piece at revision {document.revision}, or choose an earlier firing below.</p><button disabled={!HEARTHSIDE_FLAGS.exports} onClick={()=>{finishStroke();setSurface({kind:'export',revision:document.revision});}}>Make production files</button><button disabled={!HEARTHSIDE_FLAGS.nativeAR} onClick={()=>{finishStroke();setSurface({kind:'ar',revision:document.revision});}}>Place this piece beside me</button>{nativeWidgetPlugin()&&<button onClick={()=>{finishStroke();setSurface({kind:'widget',revision:document.revision});}}>Keep this sculpture on my home screen</button>}{(!HEARTHSIDE_FLAGS.exports||!HEARTHSIDE_FLAGS.nativeAR)&&<small>Production files and native AR have separate activation controls.</small>}</section>}
    {row&&document&&row.status!=='archived'&&handoff?.(designId,currentId,document.revision,waiting||Boolean(active.current))}
  </section>;
}
