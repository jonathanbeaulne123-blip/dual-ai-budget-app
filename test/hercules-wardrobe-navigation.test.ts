// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import type {WardrobeScene} from '../src/wardrobe/scene.ts';
import {fittingDraftKey} from '../src/wardrobe/draft.ts';
const mock=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('../src/wardrobe/scene.ts',()=>({createWardrobeScene:mock.create}));
import HerculesDressingRoom from '../src/wardrobe/HerculesDressingRoom.tsx';
import {FITTING_ITEMS,COLLECTIONS,WARDROBE_COLOURS} from '../src/wardrobe/catalogue.ts';
import {availableColours,cyclePiece,piecesInColour,pushRecent,readRecent,searchPieces,typingTarget,wornPieces,RECENT_LIMIT} from '../src/wardrobe/navigation.ts';
import {COMPANION_SLOTS} from '../src/core/herculesCompanionContracts.ts';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,host:HTMLDivElement,scene:WardrobeScene;
const props={environment:'development',householdId:'HOUSE',memberId:'ME',view:'household' as const,busy:false};
const buttons=()=>[...document.querySelectorAll('button')];
const button=(label:string)=>buttons().find(b=>b.textContent===label||b.getAttribute('aria-label')===label)!;
const click=async(label:string)=>act(async()=>button(label).click());
const key=async(init:KeyboardEventInit,target:Element=document.querySelector('.fitting-stage')!)=>act(async()=>{target.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,...init}));});
const lastLook=()=>vi.mocked(scene.setLook).mock.calls.at(-1)?.[0];
const render=async()=>act(async()=>root.render(createElement(HerculesDressingRoom,{...props,onClose:vi.fn()})));
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));scene={setCollection:vi.fn(),setKeepsake:vi.fn(),setRoom:vi.fn(),setLook:vi.fn(),setPose:vi.fn(),setPaused:vi.fn(),setCamera:vi.fn(),setMirror:vi.fn(),dispose:vi.fn()};mock.create.mockReset().mockResolvedValue(scene);vi.useFakeTimers({shouldAdvanceTime:true});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('Wardrobe navigation helpers',()=>{
 it('searches names, collections, slots, shapes and details, word by word',()=>{
  expect(searchPieces(FITTING_ITEMS,'').length).toBe(FITTING_ITEMS.length);
  expect(searchPieces(FITTING_ITEMS,'toque').map(p=>p.id)).toEqual(expect.arrayContaining(['cozy-toque','toque']));
  expect(searchPieces(FITTING_ITEMS,'Newfoundland rain').every(p=>p.collection==='rain')).toBe(true);
  expect(searchPieces(FITTING_ITEMS,'round glasses').map(p=>p.id)).toContain('cozy-glasses');
  expect(searchPieces(FITTING_ITEMS,'sou’wester')).toHaveLength(1);
  expect(searchPieces(FITTING_ITEMS,'zzzz')).toHaveLength(0);
 });
 it('cycles within one slot, wraps, and steps from nothing to the first or last piece',()=>{
  const heads=FITTING_ITEMS.filter(p=>p.slot==='head');
  expect(cyclePiece(FITTING_ITEMS,'head',null,1)).toBe(heads[0]);expect(cyclePiece(FITTING_ITEMS,'head',null,-1)).toBe(heads.at(-1));
  expect(cyclePiece(FITTING_ITEMS,'head',heads[0]!.id,1)).toBe(heads[1]);expect(cyclePiece(FITTING_ITEMS,'head',heads[0]!.id,-1)).toBe(heads.at(-1));
  expect(cyclePiece(FITTING_ITEMS,'head',heads.at(-1)!.id,1)).toBe(heads[0]);
  expect(cyclePiece(FITTING_ITEMS.filter(p=>p.slot!=='charm'),'charm',null,1)).toBeNull();
 });
 it('offers only colours a piece actually comes in and lists pieces by colour',()=>{
  const colours=availableColours();expect(colours.length).toBeGreaterThan(10);expect(colours).not.toContain('legacy-original');
  for(const colour of colours){expect(colour in WARDROBE_COLOURS).toBe(true);expect(piecesInColour(FITTING_ITEMS,colour).length).toBeGreaterThan(0);}
  expect(piecesInColour(FITTING_ITEMS,'brass').every(p=>p.variants.includes('brass'))).toBe(true);
 });
 it('caps recents at twelve, dedupes, ignores unknown ids and tolerates a broken store',()=>{
  let list:string[]=[];for(const item of FITTING_ITEMS.slice(0,20))list=pushRecent(list,item.id);
  expect(list).toHaveLength(RECENT_LIMIT);expect(list[0]).toBe(FITTING_ITEMS[19]!.id);
  list=pushRecent(list,FITTING_ITEMS[10]!.id);expect(list.filter(x=>x===FITTING_ITEMS[10]!.id)).toHaveLength(1);expect(list[0]).toBe(FITTING_ITEMS[10]!.id);
  expect(readRecent({getItem:()=>JSON.stringify(['nope','cozy-toque',7])},'k')).toEqual(['cozy-toque']);
  expect(readRecent({getItem:()=>{throw Error('blocked');}},'k')).toEqual([]);expect(readRecent(null,'k')).toEqual([]);
  expect(wornPieces({version:1,id:'x',name:'x',catalogueVersion:1,selections:{charm:{itemId:'gone',variantId:'v'},head:{itemId:'cozy-toque',variantId:'moss'}}}).map(w=>w.slot)).toEqual(['head','charm']);
  const input=document.createElement('input');document.body.append(input);expect(typingTarget(input)).toBe(true);expect(typingTarget(document.body)).toBe(false);input.remove();
 });
});
describe('Wardrobe navigation in the room',()=>{
 it('shows what Hercules is wearing, jumps the rail to a slot and removes from the chip',async()=>{
  await render();const wearing=document.querySelector('.fitting-wearing')!;
  expect(wearing.textContent).toContain('Cable-knit sweater');expect(wearing.textContent).toContain('Pom-pom toque');
  await click('Body: Cable-knit sweater. Show body pieces');
  expect(document.querySelector('.fitting-slot-tabs [aria-selected=true]')!.textContent).toBe('Body');
  expect([...document.querySelectorAll('.fitting-hangers button')].every(b=>b.getAttribute('data-slot')==='body')).toBe(true);
  await click('Remove Cable-knit sweater');expect(lastLook()?.selections.body).toBeUndefined();expect(wearing.textContent).not.toContain('Cable-knit sweater');
 });
 it('steps through the current slot with the arrows and [ ] keys, and skips text fields',async()=>{
  await render();await act(async()=>button('Head').click());const heads=FITTING_ITEMS.filter(p=>p.collection==='cozy'&&p.slot==='head');
  await click('Next head piece');expect(lastLook()?.selections.head?.itemId).toBe(heads[0]!.id);
  await act(async()=>button('Tiny office manager').click());await act(async()=>button('All').click());await act(async()=>button('Head').click());
  await key({key:']'});expect(lastLook()?.selections.head?.itemId).toBe('office-visor');
  await key({key:'['});expect(lastLook()?.selections.head?.itemId).toBe('office-visor');
  await key({key:'Backspace'});expect(lastLook()?.selections.head).toBeUndefined();
  const search=document.querySelector<HTMLInputElement>('.fitting-search input')!;await key({key:'Backspace'},search);expect(lastLook()?.selections.head).toBeUndefined();
  await key({key:']'},search);expect(lastLook()?.selections.head).toBeUndefined();
 });
 it('Shift+S surprises within locks and F favourites the piece on the table',async()=>{
  await render();await key({key:'f'});expect(JSON.parse(localStorage.getItem(fittingDraftKey('development','HOUSE','ME')+':favourites')!)).toEqual(['cozy-sweater']);expect(button('Unfavourite piece')).toBeDefined();
  await click('Lock body');const before=lastLook()!;await key({key:'S',shiftKey:true});const after=lastLook()!;
  expect(after.selections.body).toEqual(before.selections.body);expect(after).not.toEqual(before);
  await key({key:'s',shiftKey:false});expect(lastLook()).toEqual(after);
 });
 it('searches with a live result count, then clears back to collection chips',async()=>{
  await render();const search=document.querySelector<HTMLInputElement>('.fitting-search input')!;
  await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;setter.call(search,'rain');search.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>{vi.advanceTimersByTime(250);});
  const count=document.getElementById('fitting-search-count')!;expect(count.getAttribute('aria-live')).toBe('polite');expect(count.textContent).toMatch(/^\d+ pieces match “rain”/);
  expect([...document.querySelectorAll('.fitting-hangers button')].length).toBe(searchPieces(FITTING_ITEMS,'rain').length);
  await click('Kitchen royalty');expect(search.value).toBe('');await act(async()=>{vi.advanceTimersByTime(250);});
  expect(document.querySelector('.fitting-collection h2')!.textContent).toBe('Kitchen royalty');expect(button('Kitchen royalty').getAttribute('aria-pressed')).toBe('true');
 });
 it('keeps a device-local recently worn shelf and colour-first mode',async()=>{
  await render();await click('Tiny office manager');await click('Try Green visor');await click('Try Silk tie');
  expect(JSON.parse(localStorage.getItem(fittingDraftKey('development','HOUSE','ME')+':recent')!)).toEqual(['office-tie','office-visor']);
  await click('Recently worn');expect([...document.querySelectorAll('.fitting-hangers button')].map(b=>b.getAttribute('aria-label'))).toEqual(['Try Silk tie','Try Green visor']);
  await click('Pieces in brass');expect(document.querySelector('.fitting-collection h2')!.textContent).toBe('Everything in brass');
  expect([...document.querySelectorAll('.fitting-hangers button')].length).toBe(piecesInColour(FITTING_ITEMS,'brass').length);
  await click('Try Round reading glasses');expect(lastLook()?.selections.eyewear).toEqual({itemId:'cozy-glasses',variantId:'brass'});
  await click('Any colour');expect(document.querySelector('.fitting-collection h2')!.textContent).toBe('Recently worn');await click('Recently worn');expect(document.querySelector('.fitting-collection h2')!.textContent).toBe('Tiny office manager');
 });
 it('offers saved and collection looks as tappable cards with a 2D preview',async()=>{
  const {catalogHousehold}=await import('../src/core/index.ts');const {companionFor}=await import('../src/core/herculesCompanion.ts');const h=catalogHousehold();
  h.companionProfile=companionFor(h,'MEM-001');h.companionProfile.savedLooks=[{id:'L1',revision:1,value:{version:1,id:'L1',name:'Tuesday tie',catalogueVersion:1,selections:{neckwear:{itemId:'office-tie',variantId:'claret'}}}}];
  await act(async()=>root.render(createElement(HerculesDressingRoom,{...props,environment:h.environment,householdId:h.householdId,memberId:'MEM-001',household:h,onClose:vi.fn()})));
  const strip=document.querySelector('.fitting-look-strip')!;expect(strip.querySelectorAll('li')).toHaveLength(1+COLLECTIONS.length);expect(strip.querySelectorAll('.herc').length).toBe(1+COLLECTIONS.length);
  await act(async()=>[...strip.querySelectorAll('button')].find(b=>b.textContent?.includes('Tuesday tie'))!.click());expect(lastLook()?.selections).toEqual({neckwear:{itemId:'office-tie',variantId:'claret'}});
 });
 it('lists every slot as a tab, including new slots, with a worn marker',async()=>{
  await render();const tabs=[...document.querySelectorAll('.fitting-slot-tabs [role=tab]')].map(t=>t.textContent);
  expect(tabs).toHaveLength(COMPANION_SLOTS.length+1);expect(tabs[0]).toBe('All');
  expect(document.querySelector('.fitting-slot-tabs [data-worn=true]')).not.toBeNull();
 });
});
