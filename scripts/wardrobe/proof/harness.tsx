import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '../../../src/theme/ThemeProvider.tsx';
import HerculesDressingRoom from '../../../src/wardrobe/HerculesDressingRoom.tsx';
import {HerculesPortrait} from '../../../src/Hercules.tsx';
import {WornLookContext} from '../../../src/wardrobe/Appearance.tsx';
import {catalogHousehold} from '../../../src/core/index.ts';
import {splitForSync,assembleHousehold} from '../../../src/core/sync.ts';
import {capturedIntent} from '../../../src/ledgerSync/capture.ts';
import {commandFromCapture,type Scope} from '../../../src/ledgerSync/protocol.ts';
import {prepareCommand,type AuthorityState} from '../../../src/ledgerSync/authority.ts';
import type {KitchenCommand} from '../../../src/kitchenCommand.ts';
import '../../../src/styles.css';
const seed=catalogHousehold(),a=splitForSync(seed,'MEM-001'),b=splitForSync(seed,'MEM-002');
let state:AuthorityState={sequence:seed.revision,shared:a.shared,personal:new Map([['MEM-001',a.personal],['MEM-002',b.personal]])};const receipts=new Set<string>();
function Harness(){const[member,setMember]=useState('MEM-001'),[open,setOpen]=useState(false),[generation,setGeneration]=useState(0),[lose,setLose]=useState(false),[online,setOnline]=useState(true),[proof,setProof]=useState('');const h=assembleHousehold(state.shared,state.personal.get(member));
 const onCommand:KitchenCommand=async(fn,options)=>{
  if(options?.recoverConfirmation&&receipts.has(options.confirmationId!)){options.onRecoveredConfirmation?.();return null;}
  const current=assembleHousehold(state.shared,state.personal.get(member));const scope:Scope={environment:seed.environment,householdId:seed.householdId,memberId:member,subject:`synthetic-${member}`,role:'owner',expires:Date.now()+60_000,aclEpoch:1};
  try{const candidate=fn(current),command=await commandFromCapture(capturedIntent(candidate.household)!,scope,options?.confirmationId??crypto.randomUUID()),accepted=await prepareCommand(state,command,scope,()=>{});state={sequence:accepted.receipt.sequence,shared:accepted.shared,personal:new Map([...state.personal,[member,accepted.personal]])};receipts.add(command.id);setGeneration(n=>n+1);setProof(JSON.stringify({postedIds:accepted.receipt.postedIds,member,kind:command.steps[0].kind,operation:command.steps[0].args[0].operation.kind,sharedGallery:state.shared.companionGallery?.length??0}));if(lose){setLose(false);return null;}return {kind:'synchronized',ok:true,household:assembleHousehold(state.shared,state.personal.get(member))} as never;}catch(error){setProof(String(error));options?.onDefinitiveRejected?.();return null;}
 };
 return <ThemeProvider><WornLookContext.Provider value={h.companionProfile?.wornLook.value??null}><div style={{padding:30}}><h1>Synthetic wardrobe acceptance</h1><p>Actual dressing-room components and command authority. No hosted service or real identity.</p><label>Member<select aria-label="Synthetic member" value={member} onChange={e=>setMember(e.target.value)}><option value="MEM-001">Bianca fixture</option><option value="MEM-002">Jonathan fixture</option></select></label><label><input type="checkbox" checked={lose} onChange={e=>setLose(e.target.checked)}/> Lose next acknowledgement</label><label><input type="checkbox" checked={online} onChange={e=>setOnline(e.target.checked)}/> Connected fixture</label><button onClick={()=>setOpen(true)}>Open dressing room</button><HerculesPortrait mood="content" hat={null} chain={null} collar={null} house={null} size={180}/><pre data-proof data-generation={generation}>{proof}</pre><pre data-private>{JSON.stringify({member,worn:h.companionProfile?.wornLook.value,saved:h.companionProfile?.savedLooks.filter(r=>r.value).map(r=>r.value?.name)??[],gallery:h.companionGallery?.filter(r=>r.value).map(r=>r.value?.look.name)??[]})}</pre></div>{open&&<HerculesDressingRoom key={member} environment={h.environment} householdId={h.householdId} memberId={member} view="household" household={h} onCommand={onCommand} connected={online} onClose={()=>setOpen(false)}/>}</WornLookContext.Provider></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
