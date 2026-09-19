import {useEffect,useRef,useState} from 'react';
import {StampGlyph} from '../kitty/studio/glyphs.tsx';
import {Encounter,SeasonalDiscoveries} from './Encounter.tsx';
import {ENCOUNTER_WARDROBE} from './encounterWardrobe.ts';
import {encounterCompositionDigest} from './encounterContracts.ts';
import {memoryKeptByEveryone} from './contracts.ts';
import {EncounterEntryController,type EncounterConnection,type EncounterContent,type EncounterEntryCallbacks} from './encounterEntryController.ts';
import {encounterMemoryIdentity,type EncounterMemoryBridge} from './encounterEntryBridge.ts';
import type {EncounterSharedPending} from './encounterSharedClient.ts';
import type {EncounterTheme} from './encounterPacks.ts';
import './encounterEntry.css';

export type EncounterEntryProps=EncounterEntryCallbacks&{
  identity:string;environment:'development'|'production';householdId:string;memberId:string;
  connection:EncounterConnection|null;readContent:(signal:AbortSignal)=>Promise<EncounterContent>;
  theme:EncounterTheme;roster:{memberId:string;name:string}[];encounterId?:string;enabled?:boolean;
  onOpenWardrobe:()=>void;request?:typeof fetch;
};
function message(error:unknown){const code=error instanceof Error?error.message:'';
  if(/SCOPE_CHANGED|AUDIENCE_CHANGED|UNAUTHENTICATED/.test(code))return'The signed-in account or household changed. Private drafts stay with their original account.';
  if(/ENCOUNTER_IMAGE_REVIEW_CHANGED/.test(code))return'This device already kept a different rendering of that reviewed card. Open the saved preview below to resume that exact copy.';
  if(/MEMORY_DRAFT_ALREADY_OPEN/.test(code))return'Another memory draft is open. Finish or close it, then resume this card below.';
  if(/MEMORY_WITHDRAWN/.test(code))return'That memory has been withdrawn. It will not be recreated by retrying this encounter.';
  if(/ENCOUNTER_CHANGED|REVEAL_REQUIRED|OUTCOME_REVIEW_REQUIRED/.test(code))return'The composition or reveal changed. Refresh and review the current versions before making a keepsake.';
  if(/ENCOUNTER_RECOVERY_INVALID/.test(code))return'This saved request could not be verified. Nothing was sent. Keep this device’s data for recovery.';
  if(/PRIVATE_STORAGE/.test(code))return'This device could not keep the request safely. Free some device storage and try again.';
  if(/PENDING_ENCOUNTER_ACTION/.test(code))return'An interrupted shared action is waiting below. Retry its original request before starting another.';
  return'That did not finish. Your saved request and private image stay available for an explicit retry.';
}
const wardrobe=ENCOUNTER_WARDROBE.map(item=>({...item,preview:<StampGlyph value={item.stamp.kind}/>}));
export function EncounterEntry(props:EncounterEntryProps){
  const scope=props.connection?.scope,matching=Boolean(props.connection&&props.connection.identity===props.identity&&scope?.environment===props.environment&&scope.householdId===props.householdId&&scope.memberId===props.memberId);
  if(!matching)return <section className="encounter-entry" data-theme={props.theme}><h2>Our seasonal discoveries</h2><p role="status">Open this household with your signed-in account to save and reveal private answers.</p></section>;
  return <ScopedEncounterEntry key={JSON.stringify([props.identity,props.environment,props.householdId,props.memberId,scope!.subject])} {...props} connection={props.connection!}/>;
}
function ScopedEncounterEntry(props:EncounterEntryProps&{connection:EncounterConnection}){
  const latest=useRef(props);latest.current=props;
  const [controller,setController]=useState<EncounterEntryController|null>(null),[content,setContent]=useState<EncounterContent|null>(null),[pending,setPending]=useState<EncounterSharedPending|null>(null);
  const [bridge,setBridge]=useState<EncounterMemoryBridge|null>(null),[digest,setDigest]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const alive=useRef(false),working=useRef(false),active=useRef<EncounterEntryController|null>(null);
  const update=async(c:EncounterEntryController)=>{const selectedId=latest.current.encounterId,fresh=await c.refresh(),saved=await c.shared.pending();if(!alive.current||active.current!==c)return;setContent(fresh);setPending(saved);
    const encounter=fresh.state.encounters?.find(e=>e.id===selectedId);const composition=encounter?await encounterCompositionDigest(encounter):'';
    const image=encounter?await c.bridgeFor(encounter):null;if(alive.current&&active.current===c&&latest.current.encounterId===selectedId){setDigest(composition);setBridge(image);}
  };
  useEffect(()=>{
    alive.current=true;const c=new EncounterEntryController(props.connection,signal=>latest.current.readContent(signal),{
      onOpenEncounter:id=>latest.current.onOpenEncounter(id),onOpenPiece:(piece,design)=>latest.current.onOpenPiece(piece,design),
      onMemoryDraft:memory=>latest.current.onMemoryDraft(memory),onOpenMemory:id=>latest.current.onOpenMemory(id)},props.request);
    active.current=c;setController(c);void update(c).catch(e=>{if(alive.current&&active.current===c)setError(message(e));});
    return()=>{alive.current=false;if(active.current===c)active.current=null;c.close();};
  },[props.connection]);
  useEffect(()=>{setBridge(null);setDigest('');if(controller)void update(controller).catch(e=>{if(alive.current&&active.current===controller)setError(message(e));});},[props.encounterId,controller]);
  const run=async(action:()=>Promise<void>)=>{if(!controller||working.current||props.enabled===false)return;working.current=true;setBusy(true);setError('');setNotice('');
    try{await action();}catch(e){if(alive.current)setError(message(e));}finally{
      if(alive.current){try{setPending(await controller.shared.pending());await update(controller);}catch(e){if(alive.current)setError(message(e));}}
      working.current=false;if(alive.current)setBusy(false);
    }
  };
  const submit=async(operation:Parameters<EncounterEntryController['submit']>[0])=>{
    if(!controller||props.enabled===false)throw Error('SCOPE_CHANGED');
    try{const accepted=await controller.submit(operation);await update(controller);return accepted;}
    finally{if(alive.current)setPending(await controller.shared.pending());}
  };
  const current=content?.state.encounters?.find(e=>e.id===props.encounterId),ids=current&&digest?encounterMemoryIdentity(props.connection.scope,current.id,digest):null;
  const memory=content?.state.memories.find(m=>m.id===ids?.memoryId),kept=memory&&content&&memoryKeptByEveryone(memory,content.memberIds);
  const linked=Boolean(current?.outcomes.some(o=>o.kind==='memory'&&o.id===memory?.id&&o.revision===memory.revision&&o.recipeDigest===digest));
  return <section className="encounter-entry" data-theme={props.theme} aria-label="Our seasonal discoveries" aria-busy={busy}>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {props.enabled===false&&<p role="status">Shared making is unavailable here. Your saved encounters remain available to open.</p>}
    <div className="encounter-entry-toolbar"><button disabled={busy||!controller} onClick={()=>void run(async()=>{await update(controller!);setNotice('The current shared room is open.');})}>Refresh the shared room</button></div>
    {pending&&<aside className="encounter-entry-recovery"><h3>One shared action is waiting</h3><p>Its original request is saved on this device. Retrying cannot make another keepsake.</p><button disabled={busy||props.enabled===false} onClick={()=>void run(async()=>{await controller!.retry();setNotice('That same shared action has been recovered.');})}>Retry saved shared action</button></aside>}
    {!content?<p role="status">Opening the current household…</p>:!props.encounterId?
      <fieldset className="encounter-entry-discoveries" disabled={busy||Boolean(pending)||props.enabled===false}><legend className="encounter-entry-sr">Choose an encounter</legend><SeasonalDiscoveries theme={props.theme} encounters={content.state.encounters??[]} onOpen={props.onOpenEncounter} onStart={pack=>void run(()=>controller!.start(pack))}/></fieldset>:
      !current?<p role="status">This encounter is not available in this household. Return to the conservatory to choose another.</p>:<>
        <Encounter client={props.connection.client} scope={props.connection.scope} theme={props.theme} encounter={current} roster={props.roster}
          enabled={props.enabled!==false&&!busy&&!pending} submit={submit} refresh={()=>update(controller!)}
          onReplay={pack=>void run(()=>controller!.start(pack))} wardrobe={wardrobe} onOpenWardrobe={props.onOpenWardrobe}
          experiences={content.state.experiences.filter(e=>e.state!=='archived').map(e=>({id:e.id,title:e.title}))}
          onStudioKeepsake={async recipe=>{try{await controller!.studio(recipe.encounterId,recipe.compositionDigest);}finally{if(alive.current){setPending(await controller!.shared.pending());await update(controller!);}}}}
          onMemoryKeepsake={async input=>{try{await controller!.memory(input);}finally{if(alive.current)await update(controller!);}}}/>
        {bridge&&!memory&&<aside className="encounter-entry-recovery"><h3>Your reviewed card is ready to resume</h3><p>This private device copy contains the composition you deliberately chose. Opening it creates a memory draft for a separate shared review.</p>
          <PrivateCardPreview image={bridge.image}/><button disabled={busy||Boolean(pending)||props.enabled===false} onClick={()=>void run(()=>controller!.resumeMemory(bridge))}>Resume this reviewed memory draft</button>
          <button disabled={busy} onClick={()=>void run(async()=>{await controller!.discardBridge(bridge);setBridge(null);})}>Remove this device recovery copy</button></aside>}
        {memory&&!memory.withdrawn&&<aside className="encounter-entry-outcome"><h3>Our memory from this encounter</h3><button onClick={()=>props.onOpenMemory(memory.id)}>Open our memory review</button>
          {!linked&&<><p>{kept?'Both people kept the current memory. You can now attach this exact version to the encounter.':'Open the memory so each person can review and keep the current composition.'}</p><button disabled={!kept||busy||Boolean(pending)||props.enabled===false} onClick={()=>void run(async()=>{await controller!.linkMemory(current.id,digest);setNotice('This exact kept memory is linked to our encounter.');})}>Link this kept memory to our encounter</button></>}
          {linked&&<p>This exact kept memory is linked here.</p>}</aside>}
        {current.outcomes.filter(o=>o.kind==='memory'&&o.id!==memory?.id).map(outcome=>{const earlier=content.state.memories.find(m=>m.id===outcome.id&&!m.withdrawn);return earlier?<aside className="encounter-entry-outcome" key={outcome.id}><h3>{earlier.title}</h3><p>A memory kept from an earlier composition of this encounter.</p><button onClick={()=>props.onOpenMemory(earlier.id)}>Open this earlier memory</button></aside>:null;})}
        {current.outcomes.filter(o=>o.kind==='design'&&content.state.designs.some(d=>d.designId===o.designId&&d.pieceIds.includes(o.id))).map(o=><aside className="encounter-entry-outcome" key={`${o.designId}/${o.id}`}><h3>Our piece from this encounter</h3><button onClick={()=>props.onOpenPiece(o.id,o.designId!)}>Continue with our actual Studio piece</button></aside>)}
      </>}
  </section>;
}
function PrivateCardPreview({image}:{image:Blob}){
  const [url,setUrl]=useState<string|null>(null);useEffect(()=>{const next=URL.createObjectURL(image);setUrl(next);return()=>URL.revokeObjectURL(next);},[image]);
  return url?<img className="encounter-entry-card" src={url} alt="The saved card containing our deliberately reviewed answers and arrangement"/>:null;
}
