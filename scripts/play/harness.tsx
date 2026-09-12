/** Local fictional acceptance fixture. No hosted writes or real identities. */
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,useAppearance,useSceneBinding} from '../../src/theme/ThemeProvider.tsx';
import HerculesPlay from '../../src/play/HerculesPlay.tsx';
import {catalogHousehold} from '../../src/core/index.ts';
import {companionFor,commitCompanion} from '../../src/core/herculesCompanion.ts';
import {commitCompanionGallery} from '../../src/core/herculesWardrobe.ts';
import {commitCompanionPlay} from '../../src/core/herculesPlay.ts';
import {COLLECTION_LOOKS} from '../../src/wardrobe/catalogue.ts';
import {DEFAULT_PORTRAIT,emptyPlayRoom,PLAY_REWARDS} from '../../src/core/playContracts.ts';
import {splitForSync,assembleHousehold} from '../../src/core/sync.ts';
import {capturedIntent} from '../../src/ledgerSync/capture.ts';
import {commandFromCapture,type Scope} from '../../src/ledgerSync/protocol.ts';
import {prepareCommand,type AuthorityState} from '../../src/ledgerSync/authority.ts';
import type {KitchenCommand} from '../../src/kitchenCommand.ts';
import '../../src/styles.css';
let seed=catalogHousehold();const owner='MEM-001';const scope=companionFor(seed,owner).scope;
if(!new URLSearchParams(location.search).has('empty'))for(const [i,id] of ['cozy','rain','office','applause'].entries()){
 seed=commitCompanion(seed,{version:1,id:crypto.randomUUID(),scope,operation:{kind:'look.save',expectedRevision:0,look:{...COLLECTION_LOOKS[id]!,id:'look-'+i,portrait:{...DEFAULT_PORTRAIT,caption:'Fictional portrait fixture'}}}}).household;
 seed=commitCompanionGallery(seed,{version:1,id:crypto.randomUUID(),scope,operation:{kind:'gallery.publish',galleryId:'frame-'+i,sourceLookId:'look-'+i,expectedLookRevision:1,expectedRevision:0}}).household;
 seed=commitCompanionPlay(seed,{version:1,id:crypto.randomUUID(),scope,operation:{kind:'slot',slotId:'portrait-'+(i+1),expectedRevision:0,value:{kind:'portrait',id:'frame-'+i}}}).household;
}
seed.companionProfile={...companionFor(seed,owner),wornLook:{revision:1,value:COLLECTION_LOOKS.cozy!}};
if(new URLSearchParams(location.search).has('toys')){seed.playRoom??=emptyPlayRoom();seed.playRoom.awards=PLAY_REWARDS.map(id=>({id,ruleVersion:1,evidence:'synthetic-fixture',claimedBy:owner}));}
const parts=splitForSync(seed,owner);let state:AuthorityState={sequence:seed.revision,shared:parts.shared,personal:new Map([[owner,parts.personal],['MEM-002',splitForSync(seed,'MEM-002').personal]])};const receipts=new Set<string>();
function Harness(){useSceneBinding('more','household',false);const appearance=useAppearance();const[member,setMember]=useState(owner),[generation,setGeneration]=useState(0),[connected,setConnected]=useState(true),[lose,setLose]=useState(false),[proof,setProof]=useState('');const h=assembleHousehold(state.shared,state.personal.get(member));
 useEffect(()=>{appearance.store?.apply((new URLSearchParams(location.search).get('theme')??'classic') as 'classic');},[appearance.store]);
 const onCommand:KitchenCommand=async(fn,options)=>{if(!connected)return null;if(options?.recoverConfirmation&&receipts.has(options.confirmationId!)){options.onRecoveredConfirmation?.();return null;}const scope:Scope={environment:h.environment,householdId:h.householdId,memberId:member,subject:'synthetic-'+member,role:'owner',expires:Date.now()+60000,aclEpoch:1};try{const current=assembleHousehold(state.shared,state.personal.get(member)),candidate=fn(current),command=await commandFromCapture(capturedIntent(candidate.household)!,scope,options?.confirmationId??crypto.randomUUID()),accepted=await prepareCommand(state,command,scope,()=>{});state={sequence:accepted.receipt.sequence,shared:accepted.shared,personal:new Map([...state.personal,[member,accepted.personal]])};receipts.add(command.id);setGeneration(n=>n+1);setProof('Accepted '+command.steps[0]!.kind+' · posted money IDs '+accepted.receipt.postedIds.length);if(lose){setLose(false);return null;}return {kind:'synchronized',ok:true,household:assembleHousehold(state.shared,state.personal.get(member))} as never;}catch(e){setProof(String(e));options?.onDefinitiveRejected?.();return null;}};
 return <><header style={{padding:12,display:'flex',gap:12,flexWrap:'wrap',background:'#fff',color:'#222'}}><strong>Synthetic Play proof</strong><label>Member<select aria-label="Fixture member" value={member} onChange={e=>setMember(e.target.value)}><option>MEM-001</option><option>MEM-002</option></select></label><label><input type="checkbox" checked={connected} onChange={e=>setConnected(e.target.checked)}/>Connected</label><label><input type="checkbox" checked={lose} onChange={e=>setLose(e.target.checked)}/>Lose next acknowledgement</label><output data-proof data-generation={generation}>{proof}</output></header><HerculesPlay key={member} household={h} memberId={member} connected={connected} onCommand={onCommand} onGoal={id=>setProof('Open existing Plan: '+(id??'all banks'))} onTogether={()=>setProof('Open Together')}/></>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Harness/></ThemeProvider>);
