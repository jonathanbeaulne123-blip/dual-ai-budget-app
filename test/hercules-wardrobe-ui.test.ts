// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import type {WardrobeScene} from '../src/wardrobe/scene.ts';
import {fittingDraftKey} from '../src/wardrobe/draft.ts';
const mock=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('../src/wardrobe/scene.ts',()=>({createWardrobeScene:mock.create}));
import {FittingFigure} from '../src/wardrobe/FittingFigure.tsx';
import {COZY_LOOK} from '../src/wardrobe/catalogue.ts';
import HerculesDressingRoom from '../src/wardrobe/HerculesDressingRoom.tsx';
import {WardrobeEntrance,WardrobeRoomHost} from '../src/wardrobe/WardrobeEntrance.tsx';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,host:HTMLDivElement,scene:WardrobeScene;
const props={environment:'development',householdId:'HOUSE',memberId:'ME',view:'household' as const,busy:false};
const button=(label:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label)!;
const click=async(label:string)=>act(async()=>button(label).click());
const render=async()=>act(async()=>root.render(createElement(HerculesDressingRoom,{...props,onClose:vi.fn()})));
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));scene={setCollection:vi.fn(),setKeepsake:vi.fn(),setRoom:vi.fn(),setLook:vi.fn(),setPose:vi.fn(),setPaused:vi.fn(),setCamera:vi.fn(),setMirror:vi.fn(),dispose:vi.fn()};mock.create.mockReset().mockResolvedValue(scene);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('Hercules dressing room recovery',()=>{
 it('keeps matching outfit layers inside the existing body and head in lightweight poses',async()=>{
  for(const pose of ['loaf','sit','walk'] as const){await act(async()=>root.render(createElement(FittingFigure,{look:COZY_LOOK,pose})));expect(host.querySelector('.herc-body [data-fitting-item="cozy-sweater"]')).not.toBeNull();expect(host.querySelector('.herc-head [data-fitting-item="cozy-toque"]')).not.toBeNull();expect(host.querySelector('.herc-head [data-fitting-item="cozy-glasses"]')).not.toBeNull();}
 });
 it('applies the latest edits, pause and pose when a delayed scene finishes',async()=>{
  let finish!:(value:WardrobeScene)=>void;mock.create.mockImplementation(()=>new Promise<WardrobeScene>(resolve=>{finish=resolve;}));await render();
  await click('Pause motion');await click('Cable-knit sweater: rose');await click('Hercules’s poses');await click('A curious tilt');
  await act(async()=>finish(scene));expect(scene.setPaused).toHaveBeenLastCalledWith(true);expect(scene.setPose).toHaveBeenLastCalledWith('head-tilt');
  expect(vi.mocked(scene.setLook).mock.calls.at(-1)?.[0].selections.body?.variantId).toBe('rose');
 });
 it('aborts an unfinished load and disposes a late result without installing it',async()=>{
  let finish!:(value:WardrobeScene)=>void;mock.create.mockImplementation(()=>new Promise<WardrobeScene>(resolve=>{finish=resolve;}));await render();
  const options=mock.create.mock.calls[0]![1];await act(async()=>root.render(null));expect(options.signal.aborted).toBe(true);
  await act(async()=>finish(scene));expect(scene.dispose).toHaveBeenCalledOnce();expect(scene.setLook).not.toHaveBeenCalled();
 });
 it('keeps colour and undo controls usable after 3D fails, then retries with the current look',async()=>{
  mock.create.mockRejectedValueOnce(Error('WebGL unavailable'));await render();expect(document.body.textContent).toContain('3D is unavailable');
  await click('Cable-knit sweater: slate');await click('Undo');await click('Redo');await click('Retry 3D');
  expect(mock.create).toHaveBeenCalledTimes(2);expect(vi.mocked(scene.setLook).mock.calls.at(-1)?.[0].selections.body?.variantId).toBe('slate');
 });
 it('shows storage failure, prevents garment-specific poses without a garment and disposes for 2D',async()=>{
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});await render();expect(document.body.textContent).toContain('Device storage is unavailable');
  await click('Remove cable-knit sweater');await click('Hercules’s poses');expect(button('Check a sleeveAdd body first').disabled).toBe(true);expect(button('Admire a capeRequires a cape').disabled).toBe(true);
  await click('Compare 2D look');expect(scene.dispose).toHaveBeenCalled();expect(document.body.textContent).toContain('2D outfit preview');expect(button('A curious tilt').disabled).toBe(true);expect(document.body.textContent).toContain('Fitting poses are available in 3D');
 });
 it('a scope remount never copies the prior member draft into the new scope',async()=>{
  const draw=(memberId:string)=>createElement(HerculesDressingRoom,{...props,key:memberId,memberId,onClose:vi.fn()});await act(async()=>root.render(draw('ME')));await click('Cable-knit sweater: rose');
  await act(async()=>root.render(draw('PARTNER')));expect(vi.mocked(scene.setLook).mock.calls.at(-1)?.[0].selections.body?.variantId).toBe('cream');
  expect(JSON.parse(localStorage.getItem(fittingDraftKey('development','HOUSE','ME'))!).selections.body.variantId).toBe('rose');
 });
 it('the stable host opens only its scope and retains the room when its opener unmounts',async()=>{
  const draw=(show:boolean)=>createElement('div',null,show&&createElement(WardrobeEntrance,props),createElement(WardrobeRoomHost,props),createElement('button',{className:'ph-desk-drawer'},'Desk'));
  await act(async()=>root.render(draw(true)));
  await act(async()=>window.dispatchEvent(new CustomEvent('hearth:open-fitting',{detail:{...props,memberId:'SOMEONE-ELSE'}})));expect(document.querySelector('[role=dialog]')).toBeNull();
  button('Open dressing room').focus();await click('Open dressing room');
  await vi.waitFor(()=>expect(document.querySelector('.hercules-fitting-backdrop')).not.toBeNull());
  await act(async()=>root.render(draw(false)));expect(document.querySelector('.hercules-fitting-backdrop')).not.toBeNull();
  await click('Close dressing room');expect(document.activeElement?.textContent).toBe('Desk');
 });
});

describe('Complete wardrobe interactions',()=>{
 it('keeps all new and legacy SVG pieces inside their actual pose anchors',async()=>{
  const {FITTING_ITEMS}=await import('../src/wardrobe/catalogue.ts');
  for(const item of FITTING_ITEMS)for(const pose of ['loaf','sit','walk'] as const){const look={...COZY_LOOK,selections:{[item.slot]:{itemId:item.id,variantId:item.variants[0]!}}};await act(async()=>root.render(createElement(FittingFigure,{look,pose})));const part=['neckwear','charm'].includes(item.slot)?'ruff':['head','eyewear'].includes(item.slot)?'head':item.slot==='tail'?'tail':'body';expect(host.querySelector(`.herc-${part} [data-fitting-item="${item.id}"]`),`${item.id}/${pose}`).not.toBeNull();}
 });
 it('requires acknowledgement to wear, disables offline writes and retries the same uncertain identity',async()=>{
  const {catalogHousehold}=await import('../src/core/index.ts');const h=catalogHousehold();let finish!:(value:unknown)=>void;
  const command=vi.fn((_fn:unknown,_options:unknown)=>new Promise(resolve=>{finish=resolve;}));const draw=(connected=true)=>createElement(HerculesDressingRoom,{...props,environment:h.environment,householdId:h.householdId,memberId:'MEM-001',household:h,connected,onCommand:command as never,onClose:vi.fn()});
  await act(async()=>root.render(draw(false)));expect(button('Wear this').disabled).toBe(true);await act(async()=>root.render(draw()));await click('Cable-knit sweater: rose');await click('Wear this');expect(command).toHaveBeenCalledTimes(1);expect(document.body.textContent).toContain('Waiting for your household');expect(h.companionProfile).toBeUndefined();
  await act(async()=>finish({kind:'accepted-local',ok:true}));expect(document.body.textContent).toContain('Not confirmed yet');expect(button('Wear this').disabled).toBe(true);const id=command.mock.calls[0]![1];await click('Retry unconfirmed request');expect((command.mock.calls[1] as unknown[])[1]).toMatchObject({confirmationId:(id as {confirmationId:string}).confirmationId,recoverConfirmation:true});
  await act(async()=>finish({kind:'synchronized',ok:true}));expect(document.body.textContent).toContain('Wearing this look. Confirmed');expect(localStorage.getItem(`hearth:wardrobe-receipt:${h.environment}:${h.householdId}:MEM-001`)).toBeNull();
 });
 it('contains definitive conflicts, and a late acknowledgement cannot write receipt state into a new member',async()=>{
  const {catalogHousehold}=await import('../src/core/index.ts');const h=catalogHousehold();let finish!:(value:unknown)=>void;const command=vi.fn((_fn:unknown,options:{onDefinitiveRejected:()=>void})=>{options.onDefinitiveRejected();return null;});
  const draw=(memberId:string,onCommand:unknown)=>createElement(HerculesDressingRoom,{...props,key:memberId,environment:h.environment,householdId:h.householdId,memberId,household:h,connected:true,onCommand:onCommand as never,onClose:vi.fn()});
  await act(async()=>root.render(draw('MEM-001',command)));await click('Wear this');expect(document.body.textContent).toContain('Not saved. Review');expect(button('Retry unconfirmed request')).toBeUndefined();
  const delayed=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));await act(async()=>root.render(draw('MEM-001',delayed)));await click('Wear this');await act(async()=>root.render(draw('MEM-002',delayed)));await act(async()=>finish({kind:'synchronized',ok:true}));expect(document.body.textContent).not.toContain('Wearing this look. Confirmed');expect(localStorage.getItem(`hearth:wardrobe-receipt:${h.environment}:${h.householdId}:MEM-001`)).not.toBeNull();expect(localStorage.getItem(`hearth:wardrobe-receipt:${h.environment}:${h.householdId}:MEM-002`)).toBeNull();
 });
 it('checks a reopened uncertain request before replaying an already accepted old revision',async()=>{
  const {catalogHousehold}=await import('../src/core/index.ts');const {companionFor}=await import('../src/core/herculesCompanion.ts');const h=catalogHousehold(),scope=companionFor(h,'MEM-001').scope,id=crypto.randomUUID();
  h.companionProfile=companionFor(h,'MEM-001');h.companionProfile.wornLook={revision:2,value:{...COZY_LOOK,selections:{}}};
  localStorage.setItem(`hearth:wardrobe-receipt:${h.environment}:${h.householdId}:MEM-001`,JSON.stringify({id,operation:{kind:'look.wear',look:COZY_LOOK,expectedRevision:0}}));
  const command=vi.fn((_fn:unknown,options:{recoverConfirmation?:boolean;confirmationId?:string;onRecoveredConfirmation?:()=>void})=>{expect(options.recoverConfirmation).toBe(true);expect(options.confirmationId).toBe(id);options.onRecoveredConfirmation?.();return null;});
  await act(async()=>root.render(createElement(HerculesDressingRoom,{...props,...scope,household:h,connected:true,onCommand:command as never,onClose:vi.fn()})));await click('Retry unconfirmed request');expect(document.body.textContent).toContain('Earlier request confirmed');expect(h.companionProfile.wornLook.revision).toBe(2);expect(h.companionProfile.wornLook.value!.selections).toEqual({});expect(button('Retry unconfirmed request')).toBeUndefined();
 });
 it('explains incompatible replacements before applying them and keeps explicit None through view changes',async()=>{
  await render();await click('Tiny office manager');await click('Try Pinstripe jacket');expect(document.body.textContent).toContain('This piece replaces Cable-knit sweater');expect(vi.mocked(scene.setLook).mock.calls.at(-1)?.[0].selections.body?.itemId).toBe('cozy-sweater');await click('Replace and try on');expect(vi.mocked(scene.setLook).mock.calls.at(-1)?.[0].selections.outerwear?.itemId).toBe('office-jacket');await click('No accessories');await act(async()=>root.render(createElement(HerculesDressingRoom,{...props,view:'personal',onClose:vi.fn()})));expect(vi.mocked(scene.setLook).mock.calls.at(-1)?.[0].selections).toEqual({});expect(vi.mocked(scene.setRoom).mock.calls.at(-1)?.[0].personal).toBe(true);expect(scene.dispose).not.toHaveBeenCalled();
 });
});
