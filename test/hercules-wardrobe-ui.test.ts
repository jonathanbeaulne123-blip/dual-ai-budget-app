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
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));scene={setLook:vi.fn(),setPose:vi.fn(),setPaused:vi.fn(),setCamera:vi.fn(),setMirror:vi.fn(),dispose:vi.fn()};mock.create.mockReset().mockResolvedValue(scene);});
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
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});await render();expect(document.body.textContent).toContain('could not be kept');
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
