// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {WardrobeScene} from '../src/wardrobe/scene.ts';
const mock=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('../src/wardrobe/scene.ts',()=>({createWardrobeScene:mock.create}));
vi.mock('../src/play/portrait.tsx',()=>({Portrait:({look}:{look:{id:string}})=>createElement('div',{'data-stage-portrait':look.id}),portraitUrl:()=>'',exportPortrait:vi.fn()}));
import HerculesPlay from '../src/play/HerculesPlay.tsx';
import {catalogHousehold} from '../src/core/seed.ts';
import {commitCompanion} from '../src/core/herculesCompanion.ts';
import {companionFor} from '../src/core/herculesCompanion.ts';
import {commitCompanionGallery} from '../src/core/herculesWardrobe.ts';
import {commitCompanionPlay} from '../src/core/herculesPlay.ts';
import {COZY_LOOK,COLLECTION_LOOKS} from '../src/wardrobe/catalogue.ts';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,host:HTMLDivElement,scene:WardrobeScene;
function staged(){let h=catalogHousehold(),memberId=h.members[0]!.id;const scope=companionFor(h,memberId).scope;h=commitCompanion(h,{version:1,id:crypto.randomUUID(),scope,operation:{kind:'look.save',look:COZY_LOOK,expectedRevision:0}}).household;h=commitCompanionGallery(h,{version:1,id:crypto.randomUUID(),scope,operation:{kind:'gallery.publish',galleryId:'stage-source',sourceLookId:COZY_LOOK.id,expectedLookRevision:1,expectedRevision:0}}).household;h=commitCompanionPlay(h,{version:1,id:crypto.randomUUID(),scope,operation:{kind:'stage-outfit',expectedRevision:0,galleryId:'stage-source',expectedGalleryRevision:1}}).household;h.companionProfile!.wornLook={revision:1,value:COLLECTION_LOOKS.rain};return {h,memberId};}
const draw=(h:ReturnType<typeof staged>['h'],memberId:string)=>createElement(HerculesPlay,{household:h,memberId,connected:true,onCommand:vi.fn() as never,onGoal:vi.fn(),onTogether:vi.fn(),embedded:true});
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));scene={setCollection:vi.fn(),setKeepsake:vi.fn(),setRoom:vi.fn(),setLook:vi.fn(),setPose:vi.fn(),setPaused:vi.fn(),setCamera:vi.fn(),setMirror:vi.fn(),setZone:vi.fn(),setDisplays:vi.fn(),dispose:vi.fn()};mock.create.mockReset();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('shared stage outfit rendering',()=>{
 it('uses the same public staged outfit in a delayed 3D room and the illustrated room, never the private worn look',async()=>{let resolve!:(scene:WardrobeScene)=>void;mock.create.mockImplementation(()=>new Promise<WardrobeScene>(done=>{resolve=done;}));const {h,memberId}=staged();await act(async()=>root.render(draw(h,memberId)));await act(async()=>resolve(scene));await vi.waitFor(()=>expect(vi.mocked(scene.setLook)).toHaveBeenCalled());expect(vi.mocked(scene.setLook).mock.calls.at(-1)![0]).toMatchObject({id:'shared-stage-outfit',selections:COZY_LOOK.selections});expect(vi.mocked(scene.setLook).mock.calls.at(-1)![0].id).not.toBe(COLLECTION_LOOKS.rain.id);const button=[...host.querySelectorAll('button')].find(item=>item.textContent==='Illustrated view')!;await act(async()=>button.click());expect(host.querySelector('[data-stage-portrait="shared-stage-outfit"]')).not.toBeNull();expect(host.querySelector(`[data-stage-portrait="${COLLECTION_LOOKS.rain.id}"]`)).toBeNull();});
});
