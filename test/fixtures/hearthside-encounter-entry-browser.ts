export const encounterEntryBrowser=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {EncounterEntry} from './src/hearthside/EncounterEntry.tsx';
import {MemoryPublication} from './src/hearthside/MemoryPublication.tsx';
import {KittyFlat} from './src/kitty/studio/flat.tsx';
import {HearthsideVaultClient,IndexedDbVaultUploadQueue} from './src/hearthside/vaultClient.ts';
import {LedgerSyncClient} from './src/ledgerSync/client.ts';
import {hearthsidePath,parseHearthsideRoute} from './src/hearthside/routes.ts';
import {EncounterSharedClient} from './src/hearthside/encounterSharedClient.ts';
import {EncounterEntryController} from './src/hearthside/encounterEntryController.ts';
import {encounterCompositionDigest} from './src/hearthside/encounterContracts.ts';
import {encounterKeepsakePng,encounterKeepsakeSvg} from './src/hearthside/encounterKeepsake.ts';
import {ENCOUNTER_WARDROBE} from './src/hearthside/encounterWardrobe.ts';
import {canonical} from './src/ledgerSync/patch.ts';import {sha256String} from './src/core/synchronousHash.ts';
const actor=new URL(location.href).searchParams.get('actor')||sessionStorage.getItem('entry-actor')||'A';sessionStorage.setItem('entry-actor',actor);
const scope={environment:'development',householdId:'HH-ENTRY',memberId:actor,subject:actor==='A'?'11111111-1111-4111-a111-111111111111':'22222222-2222-4222-a222-222222222222'};
const token=async()=>'synthetic-'+actor,queue=new IndexedDbVaultUploadQueue(),client=new HearthsideVaultClient(scope,token,queue);
const connection={identity:'signed-'+actor,scope,client,token},source=new LedgerSyncClient({scope,token,adopt:async()=>{},status:()=>{}});
const readContent=signal=>source.hearthsideContent(signal),root=createRoot(document.getElementById('root'));
let theme=sessionStorage.getItem('entry-theme')||'classic',draft=JSON.parse(sessionStorage.getItem('entry-memory-draft')||'null'),selectedMemory=null,piece=null,wardrobe=false;
const roster=[{memberId:'A',name:'Alex'},{memberId:'B',name:'Sam'}];
const route=()=>parseHearthsideRoute(location.pathname+location.search,'HH-ENTRY');
function navigate(object){const origin=location.pathname+location.search;history.pushState({},'',hearthsidePath({version:1,householdId:'HH-ENTRY',room:'conservatory',mode:'present',object,returnContext:origin.startsWith('/hearthside/')?{path:origin,focusId:'entry-return'}:undefined}));render();}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw Error(value.code||value.error);return value;}
async function openMemory(id){const fresh=await readContent();selectedMemory=fresh.state.memories.find(m=>m.id===id);if(!selectedMemory)throw Error('MEMORY_CHANGED');navigate({kind:'memory',id});}
async function openPiece(id,designId){const r=await fetch('/fixture/design/'+encodeURIComponent(designId),{headers:{Authorization:'Bearer '+await token()}});const view=await r.json();piece=view.pieces.find(p=>p.piece.id===id);if(!piece)throw Error('PIECE_MISSING');navigate({kind:'piece',id,designId});}
function render(){const selected=route(),candidate=draft||selectedMemory;
 root.render(<React.StrictMode><button id="entry-return" onClick={()=>{draft=null;selectedMemory=null;piece=null;wardrobe=false;sessionStorage.removeItem('entry-memory-draft');history.back();render();}}>Back to our encounter</button>
 {piece?<section aria-label="Actual canonical Studio piece"><h2>Our actual Studio piece</h2><KittyFlat piece={piece.piece} fired={piece.status==='fired'}/><p>{piece.status} · revision {piece.revision}</p></section>:wardrobe?<section><h2>Our actual wardrobe entrance</h2></section>:<>
 <EncounterEntry identity={connection.identity} environment={scope.environment} householdId={scope.householdId} memberId={actor} connection={connection} readContent={readContent} theme={theme} roster={roster}
 encounterId={selected?.object?.kind==='encounter'?selected.object.id:undefined} onOpenEncounter={id=>navigate({kind:'encounter',id})} onOpenPiece={(id,design)=>void openPiece(id,design)}
 onOpenMemory={id=>void openMemory(id)} onOpenWardrobe={()=>{wardrobe=true;render();}} onMemoryDraft={async value=>{if(draft&&draft.id!==value.id)return false;if(!draft){draft=value;sessionStorage.setItem('entry-memory-draft',JSON.stringify(value));}render();return true;}}/>
 {candidate&&<section aria-label="Actual memory draft and review"><h2>What I remember</h2><label>My own recollection<textarea value={candidate.recollections.find(r=>r.memberId===actor)?.text||''} readOnly/></label>
 <MemoryPublication client={client} scope={scope} theme={theme} roster={roster} candidate={candidate} editable={Boolean(draft)}
 onChange={value=>{draft=value;sessionStorage.setItem('entry-memory-draft',JSON.stringify(value));render();}}
 compose={async value=>{await post('/fixture/compose',value);draft=null;sessionStorage.removeItem('entry-memory-draft');selectedMemory=value;render();return true;}}
 keep={async binding=>{await post('/fixture/keep',binding);selectedMemory=(await readContent()).state.memories.find(m=>m.id===binding.memoryId);render();return true;}}
 withdraw={async()=>false}/></section>}
 </>}
 </React.StrictMode>);
}
window.entryProof={theme:value=>{theme=value;sessionStorage.setItem('entry-theme',value);render();},openEncounter:id=>{draft=null;selectedMemory=null;piece=null;navigate({kind:'encounter',id});},content:()=>readContent(),draft:()=>draft,dispose:()=>{root.unmount();client.dispose();queue.close();source.stop();}};
window.entryTools={EncounterSharedClient,EncounterEntryController,connection,readContent,encounterCompositionDigest,encounterKeepsakePng,encounterKeepsakeSvg,wardrobe:ENCOUNTER_WARDROBE,canonical,sha256String};
window.addEventListener('popstate',()=>{draft=null;selectedMemory=null;piece=null;render();});render();
`;
