import {AtmosphereControl} from '../theme/AppearancePicker.tsx';
import {SharedLifeRestore} from './SharedLifeRestore.tsx';
import {ExperienceBankEntry} from './ExperienceBankEntry.tsx';
import type {KittyAcceptedCommandReader} from './bankReceipt.ts';
import {EncounterEntry} from './EncounterEntry.tsx';
import {WinMemorySource} from './WinMemorySource.tsx';
import {GuestVisitsEntry} from './GuestVisitsEntry.tsx';
import {HEARTHSIDE_FLAGS} from './flags.ts';
import {ExperienceWorktable} from './workspaceSurface.tsx';
import {workspaceExperienceContext} from './workspaceContext.ts';
import {StudioShelf} from './StudioShelf.tsx';
import {RoomHistory} from './RoomHistory.tsx';
import {StudioHandoff} from "./StudioHandoff.tsx";
import {FuturePath,FutureHorizonPicker,type FutureHorizon} from './FutureLandscape.tsx';
import {MemoryPublicationEntry} from './MemoryPublicationEntry.tsx';
import {ProjectorEntry} from './ProjectorEntry.tsx';
import {HearthsideVaultProvider,useHearthsideVault} from './VaultProvider.tsx';
import type {LedgerSyncClient} from '../ledgerSync/client.ts';
import {MemoryArtwork,useMemoryDesigns,SavedPiecePreview} from './MemoryArtwork.tsx';
import {Occasions} from './Occasions.tsx';
import { CollaborativeStudio } from './CollaborativeStudio.tsx';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Household } from '../core/types.ts';
import type { KitchenCommand } from '../kitchenCommand.ts';
import { useAppearance } from '../theme/ThemeProvider.tsx';
import { decodeHearthside, HEARTHSIDE_ROOMS, EXPERIENCE_STATES, memoryKeptByEveryone, type HearthsideRoom, type SharedExperience, type MemoryComposition, type PlacedNote, type SharedReference } from './contracts.ts';
import { hearthsidePath, parseHearthsideRoute, HEARTHSIDE_LABEL, type HearthsideRoute } from './routes.ts';
import { useHearthsideCommands } from './useHearthsideCommands.ts';
import { emptyDrafts, readHearthsideDrafts } from './drafts.ts';
import { HouseholdRoom } from './HouseholdRoom.tsx';
import {useNativeFundingReview} from './nativeFundingReview.ts';
import {LifeStepComposer} from './LifeStepComposer.tsx';
import { ROOMS, JOURNEYS } from './catalogue.ts';
import { KittyBankRoom, type KittySubmissionReader } from '../kitty/KittyBankRoom.tsx';
import { CanonicalKittyFlat } from './DesignProvider.tsx';
import { kittyBankBackingStep } from '../core/kittyBanks.ts';
import { todayKey } from '../core/calendar.ts';
import { playBankFacts } from '../core/herculesPlay.ts';
import { formatCad } from '../core/money.ts';
import './hearthside.css';

export type HearthsideProps = {
  household: Household; memberId: string; identity: string; connected: boolean; busy?: boolean;
  onCommand: KitchenCommand; onReadSubmission?: KittySubmissionReader;
  onReadAcceptedCommand?:KittyAcceptedCommandReader;
  onReadAcceptedHousehold?:(id:string)=>Promise<Household|null>;
  practical: ReactNode; studio: ReactNode;
  vaultSource?:()=>LedgerSyncClient|null;
  letters?: (onClose:()=>void,theme:'classic'|'taylor'|'newfoundland')=>ReactNode;
  onWorkspace?:(experience:SharedExperience)=>void;
  onReference: (reference: SharedReference, experience: SharedExperience) => void;
  initialRoom?: HearthsideRoom;
};
export default function Hearthside(props: HearthsideProps) {
  const child=<HearthsideHousehold key={`${props.identity}:${props.household.householdId}:${props.memberId}`} {...props}/>;
  return props.vaultSource?<HearthsideVaultProvider household={props.household} memberId={props.memberId} identity={props.identity} connected={props.connected} source={props.vaultSource}>{child}</HearthsideVaultProvider>:child;
}
function HearthsideHousehold({household:h,memberId,identity,connected,busy,onCommand,onReadSubmission,onReadAcceptedCommand,onReadAcceptedHousehold,practical,studio,letters,onReference,onWorkspace,initialRoom,vaultSource}:HearthsideProps) {
  const vault=useHearthsideVault();
  const appearance=useAppearance(), theme=appearance.scene.theme, state=decodeHearthside(h.hearthside);
  const scope={environment:h.environment,householdId:h.householdId,memberId}, commands=useHearthsideCommands(scope,identity,connected,onCommand);
  const [route,setRoute]=useState<HearthsideRoute>(()=>parseHearthsideRoute(window.location.href,h.householdId)??{version:1,householdId:h.householdId,room:initialRoom??'common',mode:'present'});
  const [tool,setTool]=useState<'practical'|'studio'|'letters'|'occasions'|'projector'|'history'|'worktable'|'guests'|'encounters'|'wardrobe'|'restore'|null>(route.surface??null), [bank,setBank]=useState<{id?:string}|null>(null);
  const nativeFunding=useNativeFundingReview(h,memberId,onCommand,onReadSubmission,onReadAcceptedHousehold);
  const [horizon,setHorizon]=useState<FutureHorizon>('season');
  const [lifeStep,setLifeStep]=useState<'task'|'date'|null>(null);
  const draftsKey=`hearth:hearthside:drafts:${identity}`;
  const [recovery] = useState(() => { try { return {drafts:readHearthsideDrafts(sessionStorage,draftsKey),error:''}; } catch { return {drafts:emptyDrafts(),error:'The device draft could not be read. Your shared room is still available.'}; } });
  const [experienceDraft,setExperienceDraft]=useState<SharedExperience|null>(recovery.drafts.experience), [memoryDraft,setMemoryDraft]=useState<MemoryComposition|null>(recovery.drafts.memory), [noteDraft,setNoteDraft]=useState<PlacedNote|null>(recovery.drafts.note);
  const root=useRef<HTMLElement>(null), returnFocus=useRef<string>('hearthside-title');
  const activeMembers=h.members.filter(m=>m.active).map(m=>m.id), actorName=h.members.find(m=>m.id===memberId)?.name??'You';
  const memories=state.memories.filter(m=>!m.withdrawn);
  const selectedExperience=route.object?.kind==='experience'?state.experiences.find(e=>e.id===route.object!.id):undefined;
  const selectedMemory=route.object?.kind==='memory'?state.memories.find(m=>m.id===route.object!.id):undefined;
  const memoryArtwork=useMemoryDesigns(selectedMemory?.designs??[]),draftArtwork=useMemoryDesigns(memoryDraft?.designs??[]);
  const selectedNote=route.object?.kind==='note'?state.notes.find(n=>n.id===route.object!.id):undefined;
  const [draftMessage,setDraftMessage]=useState(recovery.error || (Object.values(recovery.drafts).some(Boolean)?'Your unfinished draft is here.':''));
  useEffect(()=>{
    const pop=()=>{const next=parseHearthsideRoute(window.location.href,h.householdId);if(next){setRoute(next);setTool(next.surface??null);setBank(null);setLifeStep(null);requestAnimationFrame(()=>document.getElementById(window.history.state?.hearthsideFocus??'hearthside-title')?.focus());}};
    window.addEventListener('popstate',pop);
    if (!window.location.pathname.startsWith('/house/together/')) window.history.replaceState({...window.history.state,hearthTab:'play'},'',hearthsidePath(route));
    // A tool return may mount this lazy room after App's next animation frame.
    // Restore only an explicitly recorded target inside this household surface.
    const arrivalFocus=window.history.state?.hearthsideFocus;
    if(typeof arrivalFocus==='string'){
      const target=document.getElementById(arrivalFocus);
      if(target&&root.current?.contains(target)){target.scrollIntoView?.({block:'center'});target.focus({preventScroll:true});}
    }
    return()=>window.removeEventListener('popstate',pop);
  },[identity]);
  useEffect(()=>{
    if (recovery.error && !experienceDraft && !memoryDraft && !noteDraft) return;
    try { if(experienceDraft||memoryDraft||noteDraft)sessionStorage.setItem(draftsKey,JSON.stringify({experience:experienceDraft,memory:memoryDraft,note:noteDraft}));else sessionStorage.removeItem(draftsKey); }
    catch {setDraftMessage('This device cannot keep drafts after closing. Keep this page open.');}
  },[experienceDraft,memoryDraft,noteDraft,draftsKey]);
  useEffect(()=>{ if(experienceDraft||memoryDraft||noteDraft){const editor=root.current?.querySelector<HTMLElement>('.hearthside-editor');editor?.scrollIntoView?.({block:'start'});editor?.querySelector<HTMLInputElement>('input,textarea')?.focus();} },[Boolean(experienceDraft),Boolean(memoryDraft),Boolean(noteDraft)]);
  const encounterEntry=(encounterId?:string)=><EncounterEntry identity={identity} environment={h.environment} householdId={h.householdId} memberId={memberId} connection={vault.connection} theme={theme}
    roster={h.members.filter(m=>m.active).map(m=>({memberId:m.id,name:m.name}))} encounterId={encounterId} enabled={connected&&HEARTHSIDE_FLAGS.vaultPublication}
    readContent={async signal=>{const source=vaultSource?.(),current=vault.connection;if(!source||!current||current.identity!==identity||source.options.scope.environment!==h.environment||source.options.scope.householdId!==h.householdId||source.options.scope.memberId!==memberId||source.options.scope.subject!==current.scope.subject)throw Error('SCOPE_CHANGED');return source.hearthsideContent(signal);}}
    onOpenEncounter={id=>openObject('encounter',id)} onOpenPiece={(pieceId,designId)=>openObject('piece',pieceId,designId)} onOpenMemory={id=>openObject('memory',id)} onOpenWardrobe={()=>openTool('wardrobe')}
    onMemoryDraft={async candidate=>{if(memoryDraft&&memoryDraft.id!==candidate.id)return false;if(!memoryDraft)setMemoryDraft(candidate);requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('[aria-label="Memory draft"] input')?.focus());return true;}}/>;
  function navigate(next:HearthsideRoute) {
    returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement.id||'hearthside-title':'hearthside-title';
    window.history.replaceState({...window.history.state,hearthsideFocus:returnFocus.current},'',window.location.href);
    setRoute(next);setTool(next.surface??null);setBank(null);setLifeStep(null);
    window.history.pushState({hearthTab:'play'},'',hearthsidePath(next));
    requestAnimationFrame(()=>document.getElementById('hearthside-focus-title')?.focus());
  }
  const roomRoute=(room=route.room):HearthsideRoute=>({version:1,householdId:h.householdId,room,mode:room==='conservatory'?'imagine':room==='theatre'?'remember':'present'});
  function openObject(kind:NonNullable<HearthsideRoute['object']>['kind'],id:string,designId?:string){const origin=document.activeElement instanceof HTMLElement?document.activeElement.id||'hearthside-title':'hearthside-title';navigate({...route,surface:undefined,studioSelection:undefined,object:kind==='piece'?{kind,id,designId:designId!}:{kind,id},returnContext:{path:hearthsidePath({...route,returnContext:undefined}),focusId:origin}});}
  function closeFocused(){const origin=route.returnContext?.focusId??returnFocus.current;setTool(null);setBank(null);navigate(route.returnContext?parseHearthsideRoute(route.returnContext.path,h.householdId)??roomRoute():roomRoute());requestAnimationFrame(()=>document.getElementById(origin)?.focus());}
  function beginExperience(title=''){if(experienceDraft){setDraftMessage('Your intention draft is open below.');return;}setExperienceDraft({version:1,id:`EXP-${crypto.randomUUID()}`,revision:1,title,intention:'',state:'dreaming',horizon:route.room==='conservatory'?horizon:'tonight',createdBy:memberId,references:[]});}
  function beginNote(){if(noteDraft){setDraftMessage('Your note draft is open below.');return;}setNoteDraft({version:1,id:`NOTE-${crypto.randomUUID()}`,revision:1,authorId:memberId,text:'',room:route.room,experienceId:selectedExperience?.id??null,archived:false});}
  function beginMemory(experienceId:string|null=selectedExperience?.id??null){if(memoryDraft){setDraftMessage('Your memory draft is open below.');return;}setMemoryDraft({version:1,id:`MEMORY-${crypto.randomUUID()}`,revision:1,title:selectedExperience?.title??'',date:null,experienceId,media:[],designs:[],recollections:[{memberId,text:''}],hideAmounts:true,approvals:[],withdrawn:false});}
  function editMemory(memory:MemoryComposition){setMemoryDraft({...memory,revision:memory.revision+1,approvals:[],recollections:memory.recollections.some(r=>r.memberId===memberId)?memory.recollections:[...memory.recollections,{memberId,text:''}]});}
  function openTool(kind:'practical'|'studio'|'letters'|'occasions'|'projector'|'history'|'worktable'|'guests'|'encounters'|'wardrobe'|'restore'){const origin=document.activeElement instanceof HTMLElement?document.activeElement.id||'hearthside-title':'hearthside-title';navigate({...route,surface:kind,studioSelection:kind==='studio'||kind==='wardrobe'?route.studioSelection:undefined,returnContext:{path:hearthsidePath({...route,returnContext:undefined}),focusId:origin}});}
  function rememberStudioSelection(designId:string,pieceId:string) {
    const next:HearthsideRoute=route.object?.kind==='piece'?{...route,object:{kind:'piece',id:pieceId,designId}}:{...route,studioSelection:{designId,pieceId}};
    if(hearthsidePath(next)===hearthsidePath(route))return;
    setRoute(next);
    window.history.replaceState(window.history.state,'',hearthsidePath(next));
  }
  async function retrySave() {
    const request=commands.retry;
    if (!request || !await commands.retryNow()) return;
    const op=request.operation;
    if (op.kind==='experience.save') { if (JSON.stringify(experienceDraft)===JSON.stringify(op.value)) setExperienceDraft(null); openObject('experience',op.value.id); }
    if (op.kind==='memory.compose') { if (JSON.stringify(memoryDraft)===JSON.stringify(op.value)) setMemoryDraft(null); openObject('memory',op.value.id); }
    if (op.kind==='note.save' && JSON.stringify(noteDraft)===JSON.stringify(op.value)) setNoteDraft(null);
  }
  function bankView(id?:string){returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement.id:'hearthside-title';setBank({id});}
  function memoryPublication(candidate:MemoryComposition,editable=false){return <MemoryPublicationEntry key={`${candidate.id}:${editable?'draft':'read'}`} household={h} memberId={memberId} identity={identity} connected={connected} candidate={candidate} editable={editable} commands={commands} source={vaultSource} theme={theme} artwork={<MemoryArtwork references={candidate.designs} snapshots={editable?draftArtwork.snapshots:memoryArtwork.snapshots}/>} artworkReady={editable?draftArtwork.ready:memoryArtwork.ready} onChange={value=>{if(editable)setMemoryDraft(value);}} onComposed={value=>{setMemoryDraft(null);openObject('memory',value.id);}} onWithdrawn={()=>{setMemoryDraft(null);closeFocused();}}/>;}
  const selected=Boolean(route.object), focused=selected||tool!==null;
  return <main className="hearthside" data-world={theme} data-room={route.room} data-paused={appearance.paused} ref={root} aria-labelledby="hearthside-title">
    <header className="hearthside-arrival"><div><p className="hearthside-eyebrow">Our shared home</p><h1 id="hearthside-title" tabIndex={-1}>{HEARTHSIDE_LABEL}</h1></div><div className="hearthside-arrival-settings"><span className="hearthside-scope">{h.members.filter(m=>m.active).map(m=>m.name).join(' & ')}</span><AtmosphereControl/></div></header>
    <nav className="hearthside-room-nav" aria-label="Rooms">{HEARTHSIDE_ROOMS.map(room=><button id={`hearthside-room-${room}`} key={room} aria-current={route.room===room?'page':undefined} onClick={()=>navigate(roomRoute(room))}>{ROOMS[room].name}</button>)}</nav>
    {!focused&&<>
      {route.room==='conservatory'&&<FutureHorizonPicker value={horizon} onChange={setHorizon}/>}
      <HouseholdRoom memberId={memberId} horizon={route.room==='conservatory'?horizon:undefined} household={h} room={route.room} theme={theme} paused={appearance.paused} canArrange={commands.canStart} onOpen={openObject} onNavigate={room=>navigate(roomRoute(room))} submit={commands.submit}/>
      <section className="hearthside-room-actions" aria-label={`Things to do in the ${ROOMS[route.room].name.toLowerCase()}`}>
        <div className="hearthside-scene-actions">
          {letters&&(route.room==='common'||route.room==='theatre')&&<button id="hearthside-open-letters" onClick={()=>openTool('letters')}>Letters, voice, and capsules</button>}
          {route.room==='common'&&<><button id="hearthside-add-intention" onClick={()=>beginExperience()}>Add an intention</button><button id="hearthside-write-note" onClick={beginNote}>Leave a little note</button><button id="hearthside-sit-together" onClick={()=>openTool('practical')}>Sit together</button></>}
          {route.room==='studio'&&<><button id="hearthside-open-studio" onClick={()=>openTool('studio')}>Enter the Studio</button><button id="hearthside-banks" onClick={()=>bankView()}>Our painted banks</button></>}
          {(route.room==='common'||route.room==='conservatory')&&<button id="hearthside-discoveries" onClick={()=>openTool('encounters')}>Discover a season together</button>}
          {route.room==='conservatory'&&<button id="hearthside-new-dream" onClick={()=>beginExperience()}>Plant a possibility</button>}
          {(route.room==='conservatory'||route.room==='theatre')&&<button id="hearthside-occasions" onClick={()=>openTool('occasions')}>Dates that mean something</button>}
          {route.room==='common'&&HEARTHSIDE_FLAGS.guestPublication&&<button id="hearthside-guests" onClick={()=>openTool('guests')}>Our doorway and private street</button>}
          <button id="hearthside-history" onClick={()=>openTool('history')}>Our room, as it was</button>
          {vaultSource&&<button id="hearthside-restore" onClick={()=>openTool('restore')}>Review an earlier shared-life version</button>}
          {route.room==='theatre'&&<button id="hearthside-projector" onClick={()=>openTool('projector')}>Set out our story</button>}
          {route.room==='theatre'&&<button id="hearthside-new-memory" onClick={()=>beginMemory(null)}>Keep an ordinary day</button>}
        </div>
      </section>
      {route.room==='studio'&&<StudioShelf household={h} memberId={memberId} onOpen={(designId,pieceId)=>openObject('piece',pieceId,designId)}/>}
      {route.room==='theatre'&&<section className="hearthside-memory-wall" aria-labelledby="hearthside-memories-title"><h2 id="hearthside-memories-title">Invitations to remember</h2>{memories.filter(m=>!memoryKeptByEveryone(m,activeMembers)).length?<div className="hearthside-experience-grid">{memories.filter(m=>!memoryKeptByEveryone(m,activeMembers)).map(m=><button id={`hearthside-memory-${m.id}`} key={m.id} className="hearthside-memory" onClick={()=>openObject('memory',m.id)}><small>{memoryKeptByEveryone(m,activeMembers)?'Kept by us both':'An invitation to remember'}</small><strong>{m.title}</strong>{m.recollections.map(r=><span key={r.memberId}>“{r.text}”</span>)}</button>)}</div>:<p className="hearthside-empty">Words are enough. Keep an ordinary day whenever you want.</p>}</section>}
      <section className="hearthside-invitations" aria-label="Things we can do">{JOURNEYS.filter(j=>j.room===route.room).map(j=><button id={`hearthside-journey-${j.id}`} key={j.id} onClick={()=>{if(j.id==='leave-something')beginNote();else if(j.id==='remember')beginMemory(null);else if(j.id==='care-for-life')openTool('practical');else if(j.id==='make-together')openTool('studio');else beginExperience(j.prompt);}}>{j.label}<span aria-hidden="true">↗</span></button>)}</section>
    </>}
    {focused&&<section className="hearthside-focused"><button className="hearthside-back" onClick={closeFocused}>← Back to {ROOMS[route.room].name.toLowerCase()}</button>
      {tool==='restore'?<SharedLifeRestore household={h} memberId={memberId} identity={identity} theme={theme} connected={connected} source={vaultSource??(()=>null)} onCommand={onCommand} onClose={closeFocused} onEditMemory={id=>{const memory=state.memories.find(m=>m.id===id&&!m.withdrawn);if(memory){openObject('memory',id);editMemory(memory);}}} renderDesign={reference=><SavedPiecePreview reference={reference}/>}/>:tool==='encounters'||!tool&&route.object?.kind==='encounter'?encounterEntry(route.object?.kind==='encounter'?route.object.id:undefined):tool==='guests'?<GuestVisitsEntry household={h} theme={theme} onClose={closeFocused}/>:tool==='worktable'&&selectedExperience?<ExperienceWorktable hearthside={{scope:{identity,environment:h.environment,householdId:h.householdId,memberId},experience:workspaceExperienceContext(selectedExperience),onReturn:closeFocused}}/>:tool==='history'?<RoomHistory household={h} memberId={memberId} identity={identity} room={route.room} horizon={horizon} theme={theme} canSave={commands.canStart} submit={commands.submit} onCurrent={target=>openObject(target.kind,target.id,target.kind==='piece'?target.designId:undefined)}/>:tool==='projector'?<ProjectorEntry household={h} memberId={memberId} identity={identity} source={vaultSource} theme={theme} onClose={closeFocused} onReviewMemory={id=>openObject('memory',id)}/>:tool==='occasions'||route.object?.kind==='occasion'?<Occasions state={state} memberId={memberId} identity={identity} canSave={commands.canStart} submit={commands.submit} onOpen={openObject} selectedId={route.object?.kind==='occasion'?route.object.id:undefined}/>:tool==='letters'?letters?.(closeFocused,theme):tool==='practical'?practical:tool==='studio'||tool==='wardrobe'||route.object?.kind==='piece'?<CollaborativeStudio key={tool==='wardrobe'?'wardrobe':'clay'} initialTab={tool==='wardrobe'?'wardrobe':'shape'} handoff={(documentId,pieceId,revision,pending)=><StudioHandoff household={h} memberId={memberId} identity={identity} design={{version:1,documentId,pieceId,revision}} canSave={commands.canStart&&!pending} submit={commands.submit}/>} acceptedReceipt={nativeFunding.receipt} onFundingIntent={intent=>{const id=nativeFunding.begin(intent);if(id)setBank({id});}} initialDesignId={route.object?.kind==='piece'?route.object.designId:route.studioSelection?.designId} initialPieceId={route.object?.kind==='piece'?route.object.id:route.studioSelection?.pieceId} onSelection={rememberStudioSelection} returnPath={hearthsidePath(route)} household={h} memberId={memberId} wardrobe={studio} onKeep={selectedExperience?(designId,pieceId,revision)=>{void commands.submit({kind:'experience.save',expectedRevision:selectedExperience.revision,value:{...selectedExperience,revision:selectedExperience.revision+1,references:[...selectedExperience.references.filter(r=>!(r.kind==='piece'&&r.id===pieceId&&r.designId===designId)),{kind:'piece',id:pieceId,designId,revision}]}});}:undefined}/>:selectedExperience?<>
        <p className="hearthside-eyebrow">{selectedExperience.state==='paused'?'Resting for now':'Something of ours'}</p><h2 id="hearthside-focus-title" tabIndex={-1}>{selectedExperience.title}</h2><p className="hearthside-intention">{selectedExperience.intention}</p>
        <div className="hearthside-actions"><button onClick={()=>setExperienceDraft({...selectedExperience,revision:selectedExperience.revision+1})}>Shape this intention</button><button onClick={beginNote}>Leave a note</button><button onClick={()=>openTool('studio')}>Make something for this</button><button id="hearthside-experience-worktable" onClick={()=>onWorkspace?onWorkspace(selectedExperience):openTool('worktable')}>Work on this with Hercules</button><button onClick={()=>setLifeStep('task')}>Choose a next step</button><button onClick={()=>setLifeStep('date')}>Make time for this</button><button onClick={()=>beginMemory()}>Remember this</button></div>
        <ExperienceBankEntry key={`bank:${selectedExperience.id}`} household={h} experience={selectedExperience} identity={identity} memberId={memberId} connected={connected} busy={busy} canStart={commands.canStart} onCommand={onCommand} onReadSubmission={onReadSubmission} onReadAcceptedCommand={onReadAcceptedCommand}/>
        {route.room==='conservatory'&&<FuturePath key={`future:${selectedExperience.id}`} household={h} memberId={memberId} experience={selectedExperience} onReference={r=>r.kind==='bank'?bankView(r.id):onReference(r,selectedExperience)}/>}
        {lifeStep&&<LifeStepComposer kind={lifeStep} experience={selectedExperience} household={h} memberId={memberId} identity={identity} canSave={commands.canStart} submit={commands.submit} onClose={()=>setLifeStep(null)}/>}
        <section className="hearthside-linked"><h3>Connected to this</h3>{selectedExperience.references.map((r,i)=>{const goal=r.kind==='bank'?h.goals.find(g=>g.id===r.id&&g.shared):null;const facts=goal?playBankFacts(h,goal.id,memberId):null;return <article key={`${r.kind}:${r.planVersionId??''}:${r.id}`}>
          {goal&&facts&&<div className="hearthside-cat"><CanonicalKittyFlat goal={goal} step={kittyBankBackingStep(h,goal,todayKey())} title={goal.name}/></div>}
          <div><strong>{goal?.name??(r.kind==='task'?h.tasks?.find(t=>t.id===r.id&&t.visibility==='household')?.title:r.kind==='calendar-event'?h.nativeEvents?.find(e=>e.id===r.id&&e.visibility==='household')?.title:r.kind==='artifact'?state.artifactPublications?.find(p=>p.id===r.id&&p.state!=='withdrawn')?.title:r.kind==='memory'?state.memories.find(m=>m.id===r.id)?.title:r.kind==='plan-line'?h.planVersions?.find(p=>p.id===r.planVersionId)?.lines.find(l=>l.id===r.id)?.labelSnapshot:undefined)??'Linked part of our life'}</strong><small>{goal?(facts?`${formatCad(facts.backingCents)} currently backed`:'Backing is unavailable'):r.kind.replaceAll('-',' ')}</small></div>
          <button id={`hearthside-linked-${i}`} onClick={()=>r.kind==='bank'?bankView(r.id):r.kind==='memory'?openObject('memory',r.id):r.kind==='piece'?openObject('piece',r.id,r.designId):r.kind==='occasion'?openObject('occasion',r.id):onReference(r,selectedExperience)}>Open</button></article>;})}
          {!selectedExperience.references.length&&<p>This can be complete just as it is. Add a plan, date or bank when it helps.</p>}
        </section>
        {state.notes.filter(n=>n.experienceId===selectedExperience.id&&!n.archived).map(n=><blockquote key={n.id}>{n.text}<cite>{h.members.find(m=>m.id===n.authorId)?.name}</cite></blockquote>)}
        {memories.filter(m=>m.experienceId===selectedExperience.id).map(m=><button className="hearthside-memory-link" id={`hearthside-memory-${m.id}`} key={m.id} onClick={()=>openObject('memory',m.id)}>Revisit {m.title}</button>)}
      </>:selectedMemory&&!selectedMemory.withdrawn?<>
        <p className="hearthside-eyebrow">{selectedMemory.date??'A moment, in our own time'}</p><h2 id="hearthside-focus-title" tabIndex={-1}>{selectedMemory.title}</h2>
        <MemoryArtwork references={selectedMemory.designs} snapshots={memoryArtwork.snapshots}/>
        <WinMemorySource source={selectedMemory.legacySource}/><div className="hearthside-recollections">{h.members.filter(m=>m.active).map(member=><article key={member.id}><h3>{member.name} remembers</h3><p>{selectedMemory.recollections.find(r=>r.memberId===member.id)?.text||'Room for their own words.'}</p></article>)}</div>
        <p>{memoryKeptByEveryone(selectedMemory,activeMembers)?'We both chose to keep this version.':'Each of us chooses whether to keep this exact composition.'}</p>
        <div className="hearthside-actions"><button onClick={()=>editMemory(selectedMemory)}>Add or edit my recollection</button>{!selectedMemory.publication&&<button disabled={!commands.canStart||!memoryArtwork.ready||selectedMemory.approvals.some(a=>a.memberId===memberId&&a.revision===selectedMemory.revision)} onClick={()=>void commands.submit({kind:'memory.keep',id:selectedMemory.id,expectedRevision:selectedMemory.revision})}>{selectedMemory.approvals.some(a=>a.memberId===memberId&&a.revision===selectedMemory.revision)?'You chose to keep this':'Keep this version'}</button>}</div>
        {selectedMemory.publication&&memoryPublication(selectedMemory)}
        {selectedMemory.experienceId&&<button onClick={()=>openObject('experience',selectedMemory.experienceId!)}>Return to the intention</button>}
        {!selectedMemory.publication&&<details><summary>Memory choices</summary><button disabled={!commands.canStart} onClick={()=>void commands.submit({kind:'memory.withdraw',id:selectedMemory.id,expectedRevision:selectedMemory.revision}).then(ok=>{if(ok)closeFocused();})}>Withdraw from our memory display</button></details>}
      </>:selectedNote&&!selectedNote.archived?<><h2 id="hearthside-focus-title" tabIndex={-1}>A little something</h2><blockquote className="hearthside-letter-paper">{selectedNote.text}<cite>{h.members.find(m=>m.id===selectedNote.authorId)?.name}</cite></blockquote>{selectedNote.experienceId&&<button onClick={()=>openObject('experience',selectedNote.experienceId!)}>Open its intention</button>}{selectedNote.authorId===memberId&&<button onClick={()=>setNoteDraft({...selectedNote,revision:selectedNote.revision+1})}>Edit my note</button>}</>:<><h2 id="hearthside-focus-title" tabIndex={-1}>This object is no longer here</h2><p>Your other shared experiences are still in the room.</p></>}
    </section>}
    {experienceDraft&&<section className="hearthside-editor" aria-label="Intention draft"><form onSubmit={e=>{e.preventDefault();void commands.submit({kind:'experience.save',expectedRevision:experienceDraft.revision-1,value:experienceDraft}).then(ok=>{if(ok){setExperienceDraft(null);openObject('experience',experienceDraft.id);}});}}><p className="hearthside-eyebrow">In our own words</p><h2>{experienceDraft.revision===1?'An intention for us':'Shape our intention'}</h2><label>What shall we call it?<input required maxLength={240} value={experienceDraft.title} onChange={e=>setExperienceDraft({...experienceDraft,title:e.target.value})}/></label><label>Why it matters<textarea aria-label="Why it matters" maxLength={4000} value={experienceDraft.intention} onChange={e=>setExperienceDraft({...experienceDraft,intention:e.target.value})}/></label><div className="hearthside-field-pair"><label>When might it fit?<select aria-label="When might it fit?" value={experienceDraft.horizon} onChange={e=>setExperienceDraft({...experienceDraft,horizon:e.target.value as SharedExperience['horizon']})}><option value="tonight">A little time soon</option><option value="season">This season</option><option value="someday">Someday</option></select></label><label>Where we are<select aria-label="Where we are" value={experienceDraft.state} onChange={e=>setExperienceDraft({...experienceDraft,state:e.target.value as SharedExperience['state']})}>{EXPERIENCE_STATES.map(s=><option key={s} value={s}>{({dreaming:'Imagining it',preparing:'Making it possible',lived:'We lived it',paused:'Resting for now',archived:'Put away'})[s]}</option>)}</select></label></div>
      <details><summary>Connect existing parts of our life</summary><div className="hearthside-link-choices">{[...h.goals.filter(g=>g.shared).map(g=>({reference:{kind:'bank',id:g.id} as SharedReference,label:g.name})),...(h.tasks??[]).filter(t=>t.visibility==='household'&&!t.deleted).map(t=>({reference:{kind:'task',id:t.id} as SharedReference,label:t.title})),...(h.nativeEvents??[]).filter(e=>e.visibility==='household'&&!e.deleted).map(e=>({reference:{kind:'calendar-event',id:e.id} as SharedReference,label:e.title})),...(h.planVersions??[]).filter(p=>p.scope==='household'&&p.state==='active').flatMap(p=>p.lines.map(l=>({reference:{kind:'plan-line',id:l.id,planVersionId:p.id} as SharedReference,label:l.labelSnapshot})))].map(({reference,label})=>{const same=(r:SharedReference)=>r.kind===reference.kind&&r.id===reference.id&&r.planVersionId===reference.planVersionId;return <label key={`${reference.kind}:${reference.planVersionId??''}:${reference.id}`}><input type="checkbox" checked={experienceDraft.references.some(same)} onChange={e=>setExperienceDraft({...experienceDraft,references:e.target.checked?[...experienceDraft.references,reference]:experienceDraft.references.filter(r=>!same(r))})}/><span>{label}<small>{reference.kind.replaceAll('-',' ')}</small></span></label>;})}</div></details>
      <div className="hearthside-actions"><button disabled={!commands.canStart}>Save our intention</button><button type="button" onClick={()=>setExperienceDraft(null)}>Cancel</button></div></form></section>}
    {noteDraft&&<section className="hearthside-editor" aria-label="Note draft"><form onSubmit={e=>{e.preventDefault();void commands.submit({kind:'note.save',expectedRevision:noteDraft.revision-1,value:noteDraft}).then(ok=>{if(ok)setNoteDraft(null);});}}><h2>A little something, from {actorName}</h2><label>Your note<textarea aria-label="Your note" required maxLength={4000} value={noteDraft.text} onChange={e=>setNoteDraft({...noteDraft,text:e.target.value})}/></label><p>Shared with the people in this home.</p><div className="hearthside-actions"><button disabled={!commands.canStart}>Leave this note</button><button type="button" onClick={()=>setNoteDraft(null)}>Cancel</button></div></form></section>}
    {memoryDraft&&<section className="hearthside-editor" aria-label="Memory draft"><form onSubmit={e=>{e.preventDefault();if(memoryDraft.media.length)return;const plain={...memoryDraft};delete plain.publication;void commands.submit({kind:'memory.compose',expectedRevision:memoryDraft.revision-1,value:plain}).then(ok=>{if(ok){setMemoryDraft(null);openObject('memory',memoryDraft.id);}});}}><h2>What I remember</h2><WinMemorySource source={memoryDraft.legacySource}/><label>A name for this moment<input required maxLength={240} value={memoryDraft.title} onChange={e=>setMemoryDraft({...memoryDraft,title:e.target.value})}/></label><label>My words<textarea aria-label="My words" maxLength={6000} value={memoryDraft.recollections.find(r=>r.memberId===memberId)?.text??''} onChange={e=>setMemoryDraft({...memoryDraft,recollections:[...memoryDraft.recollections.filter(r=>r.memberId!==memberId),{memberId,text:e.target.value}]})}/></label><label>A date, if you want one<input type="date" value={memoryDraft.date??''} onChange={e=>setMemoryDraft({...memoryDraft,date:e.target.value||null})}/></label><label className="hearthside-checkbox"><input type="checkbox" checked={memoryDraft.hideAmounts} onChange={e=>setMemoryDraft({...memoryDraft,hideAmounts:e.target.checked})}/>Keep amounts out of this memory</label><details><summary>Keep a piece exactly as it is now</summary>{state.designs.flatMap(design=>design.pieceIds.map((pieceId,i)=>{const selected=memoryDraft.designs.some(ref=>ref.documentId===design.designId&&ref.pieceId===pieceId);return <label className="hearthside-checkbox" key={`${design.designId}:${pieceId}`}><input type="checkbox" checked={selected} onChange={e=>setMemoryDraft({...memoryDraft,designs:e.target.checked?[...memoryDraft.designs,{version:1,documentId:design.designId,pieceId,revision:design.revision}]:memoryDraft.designs.filter(ref=>!(ref.documentId===design.designId&&ref.pieceId===pieceId))})}/>{design.bankId?h.goals.find(g=>g.id===design.bankId)?.name??'Our piece':'Our Studio piece'} {i+1} · revision {design.revision}</label>;}))}<MemoryArtwork references={memoryDraft.designs} snapshots={draftArtwork.snapshots}/></details><p>We each choose whether to keep the resulting version.</p>{memoryPublication(memoryDraft,true)}<div className="hearthside-actions">{!memoryDraft.media.length&&<button disabled={!commands.canStart||!draftArtwork.ready}>Share this composition for us to keep</button>}<button type="button" onClick={()=>setMemoryDraft(null)}>Cancel</button></div></form></section>}
    {(commands.message||draftMessage||!connected)&&<aside className="hearthside-status" role="status">{commands.message||draftMessage||'Your room is here. Reconnect to save something shared.'}{commands.retry&&<button disabled={commands.pending||!connected} onClick={()=>void retrySave()}>Check and retry this save</button>}</aside>}
    {nativeFunding.message&&<p role="status">{nativeFunding.message}</p>}
    {bank&&<KittyBankRoom household={h} view="household" memberId={memberId} identity={identity} busy={busy} onCommand={nativeFunding.command} onReadSubmission={nativeFunding.read} onReadAcceptedCommand={onReadAcceptedCommand} initialGoalId={bank.id} returnTo="Hearthside" onClose={()=>{setBank(null);requestAnimationFrame(()=>document.getElementById(returnFocus.current)?.focus());}}/>}
  </main>;
}
