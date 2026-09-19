// @vitest-environment jsdom
import {webcrypto} from 'node:crypto';
import {act,createElement,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {KittyBankRoom} from '../src/kitty/KittyBankRoom.tsx';
import {NestBankDetail} from '../src/kitty/KittyNest.tsx';
import {HearthsideDesignClientProvider} from '../src/hearthside/DesignProvider.tsx';
import {CollaborativeStudio} from '../src/hearthside/CollaborativeStudio.tsx';
import {HearthsideDesignClient} from '../src/hearthside/designClient.ts';
import {acceptKittyDesignOperation,createKittyDesignDocument,projectKittyDesign} from '../src/hearthside/design.ts';
import {migrateNestDesign} from '../src/hearthside/nestDesignSource.ts';
import {applyAcceptedDesignReference} from '../src/hearthside/designProjection.ts';
import {catalogHousehold,financialAuditHash,type Household,type CommitResult} from '../src/core/index.ts';
import {projectKittyNest} from '../src/core/kittyNest.ts';
import type {KittyDesignDocument} from '../src/hearthside/designContracts.ts';
vi.mock('../src/hearthside/flags.ts',()=>({HEARTHSIDE_FLAGS:{collaborativeDesign:true,nativeAR:false,exports:false}}));
vi.mock('../src/kitty/KittyStage.tsx',()=>({KittyStage:({piece,ornament}:any)=>createElement('div',{'data-stage':piece?.id,'data-ornament':ornament?JSON.stringify(ornament):''})}));
vi.mock('../src/kitty/studio/flat.tsx',()=>({KittyFlat:({piece}:any)=>createElement('svg',{'data-piece':piece?.id,'data-colours':piece?.paint.strokes.map((s:any)=>s.color).join(',')})}));
vi.mock('../src/hearthside/creativePresence.ts',()=>({attachCreativePresence:()=>({close(){},preview(){}})}));
vi.mock('../src/theme/ThemeProvider.tsx',()=>({useAppearance:()=>({scene:{theme:'classic'}})}));
let root:Root,host:HTMLDivElement,client:HearthsideDesignClient,h:Household,docs:Map<string,KittyDesignDocument>,render:()=>void,lost:boolean,requests:any[];
const button=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===text)!;
async function click(text:string){expect(button(text),text).toBeTruthy();expect(button(text).disabled,text).toBe(false);await act(async()=>{button(text).click();await new Promise(r=>setTimeout(r,15));});}
const command=async(fn:(h:Household)=>CommitResult)=>{try{h=fn(h).household;render();return {ok:true,household:h};}catch(e){return{ok:false,userMessage:(e as Error).message};}};
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();sessionStorage.clear();h=catalogHousehold();h.householdId='HH-nest-ui';docs=new Map();lost=false;requests=[];render=()=>{};host=document.createElement('div');document.body.append(host);root=createRoot(host);client=new HearthsideDesignClient({environment:h.environment,householdId:h.householdId,memberId:'MEM-001',identity:'fictional',token:async()=> 'synthetic',storage:localStorage,fetch:async(_url,init)=>{
 const request=JSON.parse(init!.body as string);requests.push(request);let d:KittyDesignDocument,receipt=null;
 if(request.kind==='create'){d=request.nestSource?[...docs.values()].find(doc=>doc.nest?.designKey===request.nestSource.designKey)??migrateNestDesign(h,'MEM-001',request.designId,request.nestSource):docs.get(request.designId)??createKittyDesignDocument(request.designId,{environment:h.environment,householdId:h.householdId,ownerMemberId:null});}
 else {d=docs.get(request.designId??request.operation.designId)!;if(request.kind==='operate'){const accepted=acceptKittyDesignOperation(d,request.operation,{environment:h.environment,householdId:h.householdId,actorId:'MEM-001',order:d.revision+1,acceptedAt:new Date().toISOString()});d=accepted.document;receipt=accepted.receipt;}}
 docs.set(d.id,d);h=applyAcceptedDesignReference(h,d,null);render();if(lost){lost=false;throw new TypeError('Lost acknowledgement');}
 return Response.json({version:1,...(request.knownRevision===undefined?{document:d}:{delta:{designId:d.id,baseRevision:request.knownRevision,revision:d.revision,entries:d.operations.slice(request.knownRevision)}}),receipt,sequence:d.revision});
 }});});
afterEach(async()=>{await act(async()=>{root.unmount();client.close();});host.remove();vi.unstubAllGlobals();});
const provider=(element:ReturnType<typeof createElement>)=>createElement(HearthsideDesignClientProvider,{client,children:element});
it('opens the real King room, prepares its name, joins canonical making, keeps keyboard paint, fires and finishes setup without a Goal',async()=>{
 const money=await financialAuditHash(h),goals=structuredClone(h.goals);document.documentElement.dataset.theme='newfoundland';
 render=()=>root.render(provider(createElement(KittyBankRoom,{household:h,view:'household',memberId:'MEM-001',identity:'nest-ui',initialBankId:'king',onClose:()=>{},onCommand:command})));await act(async()=>render());
 await click('Prepare our King');expect(h.kittyNestDesigns).toHaveLength(1);await click('Start a piece');expect(docs.size).toBe(1);expect(document.querySelector('[data-joined="true"]')).toBeTruthy();
 const d=[...docs.values()][0]!;expect(d.nest?.appearance.theme).toBe('newfoundland');expect(projectKittyDesign(d).pieces[0]?.piece.sculpt.body).toBe('tall');
 document.documentElement.dataset.theme='taylor';await act(async()=>render());expect(JSON.parse(document.querySelector('[data-ornament]')!.getAttribute('data-ornament')!).theme).toBe('newfoundland');expect(document.querySelector('[data-joined="true"]')).toBeTruthy();
 await click('Paint and decorate');await click('Add point at 50%, 50%');await click('Finish my 1-point line');expect(projectKittyDesign(docs.get(d.id)!).pieces[0]?.piece.paint.strokes).toHaveLength(1);
 await click('Undo my last gesture');expect(projectKittyDesign(docs.get(d.id)!).pieces[0]?.piece.paint.strokes).toHaveLength(0);await click('Redo my gesture');
 await click('The kiln');await click('Review this firing');await click('Fire this revision');await click('Finish the King chapter');expect(h.kittyNestDesigns![0]!.setupCompletedAt).toBeTruthy();expect(h.kittyNestDesigns![0]!.designRef?.designId).toBe(d.id);expect(h.kittyNestDesigns![0]!.studio).toBeUndefined();expect(h.goals).toEqual(goals);expect(await financialAuditHash(h)).toBe(money);
});
it('echoes accepted selection into its route without leaving the table, honors same-design piece Back, and refuses a missing selection',async()=>{
 let route:(designId:string,pieceId:string)=>void=()=>{};const echoes:string[]=[];
 function Flow(){const [selection,setSelection]=useState<{designId:string;pieceId:string}|null>(null);route=(designId,pieceId)=>setSelection({designId,pieceId});return createElement(CollaborativeStudio,{household:h,memberId:'MEM-001',initialDesignId:selection?.designId,initialPieceId:selection?.pieceId,onSelection:(designId,pieceId)=>{echoes.push(pieceId);setSelection({designId,pieceId});}});}
 render=()=>root.render(provider(createElement(Flow)));await act(async()=>render());await click('Start a piece');expect(host.querySelector('[data-joined="true"]')).toBeTruthy();expect(echoes.length).toBe(1);
 const d=[...docs.values()][0]!,first=projectKittyDesign(d).pieces[0]!.piece.id;await act(async()=>{await client.enqueue({version:1,kind:'operate',operation:{version:1,id:'OP-second',designId:d.id,pieceId:'PIECE-second',gestureId:'GESTURE-second',kind:'create-piece',base:'rose'}});route(d.id,'PIECE-second');});
 expect(host.querySelector('[data-stage="PIECE-second"]')).toBeTruthy();expect(host.querySelector('[data-joined="false"]')).toBeTruthy();await click('Join this piece');await act(async()=>route(d.id,first));expect(host.querySelector(`[data-stage="${first}"]`)).toBeTruthy();expect(host.querySelector('[data-joined="false"]')).toBeTruthy();
 const count=echoes.length;await act(async()=>route(d.id,'MISSING'));expect(host.textContent).toContain('This selected piece is unavailable');expect(host.querySelector('[data-stage]')).toBeNull();expect(echoes).toHaveLength(count);
});
it('keeps a lost migration identity across reload and presents paid canonical pottery without editing controls',async()=>{
 render=()=>root.render(provider(createElement(KittyBankRoom,{household:h,view:'household',memberId:'MEM-001',identity:'nest-ui',initialBankId:'king',onClose:()=>{},onCommand:command})));await act(async()=>render());await click('Prepare our King');lost=true;await click('Start a piece');expect(client.pending[0]?.status).toBe('uncertain');const id=client.pending[0]!.id;
 await act(async()=>{await client.retry();});expect(client.pending).toEqual([]);expect(docs.size).toBe(1);expect(requests.filter(r=>r.kind==='create').map(r=>r.designId)).toEqual([id,id]);
 // A migrated baseline can be a saved receipt's exact revision. It must never open the current shared wheel.
 const d=docs.get(id)!;await act(async()=>{await client.enqueue({version:1,kind:'operate',operation:{version:1,id:'OP-first',designId:id,pieceId:'PIECE-receipt',gestureId:'GESTURE-first',kind:'create-piece',base:'cream'}});});
 const bank={...projectKittyNest(h,'MEM-001','household','2026-09-12').king,tier:'bill' as const,state:'broken' as const};expect(d.nest).toBeTruthy();render=()=>root.render(provider(createElement(NestBankDetail,{bank,h,memberId:'MEM-001',view:'household',identity:'paid',busy:false,theme:'classic',run:async fn=>{h=fn(h).household;return true;},readLatest:()=>h,onSelect:()=>{}})));await act(async()=>render());expect(host.textContent).toContain('exact appearance saved with its receipt');expect(host.querySelector('.collaborative-studio')).toBeNull();expect(host.querySelector('[data-piece="PIECE-receipt"]')).toBeTruthy();
});
