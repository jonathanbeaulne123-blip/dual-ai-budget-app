// @vitest-environment jsdom
import {webcrypto} from 'node:crypto';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {catalogHousehold,type Household,type CommitResult} from '../src/core/index.ts';
import {HouseholdHome} from '../src/HouseholdHome.tsx';
import type {KittyCommandOptions} from '../src/kitty/KittyBankRoom.tsx';
import type {Win} from '../src/core/chapters.ts';
import {emptyHearthside} from '../src/hearthside/contracts.ts';
import {WinMemoryReview} from '../src/hearthside/WinMemoryReview.tsx';
import {WinMemorySource} from '../src/hearthside/WinMemorySource.tsx';
import {adoptWinMemory,type AdoptWinMemoryOperation} from '../src/hearthside/winMemory.ts';
import {buildProjectorPages} from '../src/hearthside/projectorCanvas.ts';
import {projectorManifest} from '../src/hearthside/projectorStory.ts';
import {captureProjectorSelection} from '../src/hearthside/projectorComposition.ts';
import {guestSourceCatalogue} from '../workers/hearthsideGuestSource.ts';
import {captureGuestSources} from '../src/hearthside/guestProjection.ts';
vi.mock('../src/kitty/KittyStage.tsx',()=>({KittyStage:()=>null}));
vi.mock('../src/kitty/studio/flat.tsx',()=>({KittyFlat:()=>createElement('svg')}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('crypto',webcrypto);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const legacy:Win={version:1,id:'WIN-earlier',chapterId:null,level:'shared-win',title:'The first ordinary evening',evidenceRefs:[],shownAt:'2026-09-01T12:00:00.000Z',fadedAt:null,keptByMemberIds:['MEM-001','MEM-002'],authoredNote:'A note whose author was never recorded.',hideAmounts:false,updatedAt:'2026-09-01T12:00:00.000Z'};
const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
function fixture(){const h=catalogHousehold();h.wins=[structuredClone(legacy)];h.hearthside=emptyHearthside();return h;}
describe('earlier Win review and exact public captions',()=>{
 it('waits for accepted state and retries the same request, then opens one actual memory',async()=>{const h=fixture(),open=vi.fn(),adopt=vi.fn(async(_op:AdoptWinMemoryOperation,_id:string,_recover:boolean)=>null);let memory:ReturnType<typeof adoptWinMemory>|undefined;const render=()=>root.render(createElement(WinMemoryReview,{household:h,win:legacy,memory,busy:false,onAdopt:adopt,onOpen:open}));await act(async()=>render());expect(host.textContent).toContain('earlier records');expect(host.textContent).not.toContain('Kept as a Memory');await act(async()=>button('Review as a memory').click());expect(open).not.toHaveBeenCalled();await act(async()=>button('Retry opening the memory').click());expect(adopt.mock.calls[1]?.slice(0,2)).toEqual(adopt.mock.calls[0]?.slice(0,2));expect(adopt.mock.calls[1]?.[2]).toBe(true);memory=adoptWinMemory(h,'MEM-001',adopt.mock.calls[0]![0]);await act(async()=>render());expect(open).toHaveBeenCalledExactlyOnceWith(memory.id);});
 it('takes the actual Home Win into the accepted Theatre memory with one non-financial request',async()=>{
  let h=fixture();const open=vi.fn(),go=vi.fn(),command=vi.fn(async(fn:(current:Household)=>CommitResult,options?:KittyCommandOptions)=>{expect(options).toMatchObject({confirmationId:expect.any(String),recoverConfirmation:false,suppressUndo:true});const accepted=fn(h);expect(accepted.postedIds).toEqual([]);h=accepted.household;render();return accepted;});
  const render=()=>root.render(createElement(HouseholdHome,{household:h,memberId:'MEM-001',today:'2026-09-12',freshness:'current',busy:false,onCommand:command,onGo:go,onOpenSetup:vi.fn(),onOpenMemory:open}));await act(async()=>render());await act(async()=>button('Review as a memory').click());expect(command).toHaveBeenCalledTimes(1);expect(open).toHaveBeenCalledExactlyOnceWith(h.hearthside!.memories[0]!.id);expect(h.hearthside!.memories[0]!.approvals).toEqual([]);expect(go).not.toHaveBeenCalled();expect(host.textContent).not.toContain('Keep as Memory');
 });
 it('labels unknown authorship in the rendered exact review, retaining long original text',async()=>{const h=fixture(),memory=adoptWinMemory(h,'MEM-001',{kind:'memory.adopt-win',winId:legacy.id,memoryId:(await import('../src/hearthside/winMemory.ts')).winMemoryId(h,legacy.id),expectedWinDigest:(await import('../src/hearthside/winMemory.ts')).winSourceDigest(legacy)});await act(async()=>root.render(createElement(WinMemorySource,{source:memory.legacySource})));expect(host.textContent).toContain('Earlier note · author not recorded');expect(host.textContent).toContain(legacy.authoredNote);expect(host.textContent).not.toContain('MEM-001');expect(host.textContent).toContain('exact composition now');});
 it('renders the unattributed note in projector pages and excludes its source identities from downloadable story metadata',async()=>{const h=fixture(),{winAdoptionOperation}=await import('../src/hearthside/winMemory.ts');const memory=adoptWinMemory(h,'MEM-001',winAdoptionOperation(h,legacy));memory.approvals=[{memberId:'MEM-001',revision:1},{memberId:'MEM-002',revision:1}];const selection=captureProjectorSelection([memory],['MEM-001','MEM-002'],[JSON.stringify([memory.id,memory.revision])],{theme:'classic',secondsPerPage:5,showAmounts:false,amountSnapshots:[]}),prepared={selection,assets:[],warnings:[]};const pages=buildProjectorPages(prepared,text=>text.length*8);expect(pages[0]!.columns[0]).toMatchObject({memberId:null,label:'Earlier note · author not recorded',lines:[legacy.authoredNote]});const manifest=JSON.stringify(projectorManifest(prepared));expect(manifest).toContain(legacy.authoredNote);expect(manifest).not.toContain('WIN-earlier');expect(manifest).not.toContain('historicalKeptMemberIds');expect(manifest).not.toContain('sourceDigest');});
 it('copies only the reviewed note into the guest arrangement',async()=>{const h=fixture(),{winAdoptionOperation}=await import('../src/hearthside/winMemory.ts'),memory=adoptWinMemory(h,'MEM-001',winAdoptionOperation(h,legacy));memory.approvals=[{memberId:'MEM-001',revision:1},{memberId:'MEM-002',revision:1}];h.hearthside!.memories=[memory];const catalogue=guestSourceCatalogue(h.hearthside!,['MEM-001','MEM-002'],{piece:async()=>null,active:async()=>false,media:async()=>new Response(null,{status:404})});const row=catalogue.memory(memory.id)!;expect(row.earlierNote).toEqual({label:'Earlier note · author not recorded',text:legacy.authoredNote});expect(JSON.stringify(row)).not.toContain('WIN-earlier');expect(JSON.stringify(row)).not.toContain('historicalKeptMemberIds');const copy=await captureGuestSources({publicationId:crypto.randomUUID(),title:'Our room',welcome:'Come in',theme:'classic',room:'theatre',mode:'anytime',items:[{kind:'memory',id:memory.id,revision:1,x:0.5,y:0.5}]},catalogue);expect(JSON.stringify(copy.arrangement)).toContain(legacy.authoredNote);expect(JSON.stringify(copy.arrangement)).not.toMatch(/WIN-earlier|MEM-001|historicalKeptMemberIds|sourceDigest/);});
});
