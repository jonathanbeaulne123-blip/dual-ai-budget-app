// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {seedDemoHousehold} from '../src/core/seed.ts';
import {DeskShell,type DeskShellProps} from '../src/harbour/desk/DeskShell.tsx';
import {DeskPlace,deskOutdoorDistrict} from '../src/harbour/desk/DeskPlace.tsx';
import {publishEditionAvailability} from '../src/harbour/nav/editionAvailability.ts';
import {chooseMotionEdition} from '../src/harbour/nav/QuickSheet.tsx';
import {flipMotionEdition} from '../src/harbour/nav/Compass.tsx';
import {readLeavingTable} from '../src/harbour/desk/leavingModel.ts';
import {MountainPanel} from '../src/harbour/mountain/MountainPanel.tsx';
const today='2026-09-20',household=seedDemoHousehold({today}),memberId=household.members[0]!.id;
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);publishEditionAvailability({flat:false,reason:null});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();publishEditionAvailability({flat:false,reason:null});vi.unstubAllGlobals();});
async function desk(props:Partial<DeskShellProps>={}){await act(async()=>root.render(createElement(DeskShell,{household,memberId,scope:'household',today,reading:null,onOpen:vi.fn(),...props})));}
it('holds supported figures and keeps the selected page through a hidden tool visit; clears on household change',async()=>{
 await desk();await act(async()=>host.querySelector<HTMLButtonElement>('[data-desk-chip=accounts]')!.click());
 const figures=()=>[...host.querySelectorAll('.desk-figure')].map(x=>x.textContent);
 const before=figures();expect(before.length).toBeGreaterThan(0);
 const changed=structuredClone(household);changed.accounts=[];
 await desk({household:changed,ready:false,hidden:true});expect(host.querySelector('section')!.hidden).toBe(true);
 await desk({household:changed,ready:false});expect(host.querySelector('[data-desk-page=accounts]')).not.toBeNull();expect(figures()).toEqual(before);expect(host.textContent).toContain('Supported as of');
 await desk({household:{...changed,householdId:'different'},ready:false});expect(figures()).toEqual([]);expect(host.textContent).toContain('Waiting for a supported reading');
});
it('shows no figures before supported books arrive and keeps doors available',async()=>{const onOpen=vi.fn();await desk({ready:false,onOpen});expect(host.querySelector('.desk-figure')).toBeNull();await act(async()=>[...host.querySelectorAll('button')].find(x=>x.textContent==='Open the Fund')!.click());expect(onOpen).toHaveBeenCalledWith('fund');});
it('blocks every edition writer when the device cannot draw and explains the fallback',async()=>{
 await act(async()=>publishEditionAvailability({flat:true,reason:'no-webgl'}));const storage={setItem:vi.fn(),getItem:()=> 'flat'};
 chooseMotionEdition('illustrated',storage);flipMotionEdition(storage);expect(storage.setItem).not.toHaveBeenCalled();
 await desk();expect(host.querySelector('[data-desk-flip]')?.getAttribute('aria-disabled')).toBe('true');expect(host.textContent).toContain('cannot draw the 3D world');
});
it('preserves pottery station object routes',async()=>{const onOpen=vi.fn();await act(async()=>root.render(createElement(DeskPlace,{place:'kiln',onOpen,onVisit:vi.fn(),onGuide:vi.fn()})));await act(async()=>{for(const button of host.querySelectorAll('nav button'))(button as HTMLButtonElement).click();});expect(onOpen.mock.calls).toEqual([['pottery','wheel'],['pottery','paint'],['pottery','kiln']]);});
it('does not turn an unreadable payments table into zero',()=>{expect(readLeavingTable(null,null,today)).toMatchObject({available:false,totalCents:null});});
it('offers town and mountain doors without WebGL, closes for financial tools, and restores focus only on dismissal',async()=>{
 const trigger=document.createElement('button');document.body.append(trigger);trigger.focus();const onOpen=vi.fn(),onAction=vi.fn();
 await act(async()=>root.render(createElement(MountainPanel,{flat:true,open:true,onOpenChange:vi.fn(),statusLine:null,onAction,onOpen})));
 expect(document.activeElement).toBe(host.querySelector('[role=dialog]'));expect(host.textContent).toContain('Pottery Studio');expect(host.textContent).toContain('Library Woods');
 await act(async()=>[...host.querySelectorAll('button')].find(x=>x.textContent==='The glass dam')!.click());await act(async()=>[...host.querySelectorAll('button')].find(x=>x.textContent==='Open the Fund')!.click());expect(onOpen).toHaveBeenCalledWith('fund');
 await act(async()=>root.unmount());expect(document.activeElement).not.toBe(trigger);root=createRoot(host);trigger.remove();
});

it('names the summit from height-aware geography, without treating the road below as that plateau',async()=>{
 expect(deskOutdoorDistrict([-7.315,110,-277])?.id).toBe('summit');expect(deskOutdoorDistrict([5,0,-284])).toBeUndefined();
 const onOpen=vi.fn();await act(async()=>root.render(createElement(DeskPlace,{place:'court',outdoorAt:[-7.315,110,-277],onOpen,onVisit:vi.fn(),onGuide:vi.fn()})));
 expect(host.textContent).toContain('Summit Commons');expect(host.textContent).not.toContain('Town square · at the waterfront');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Open Journey')!.click());expect(onOpen).toHaveBeenCalledWith('journey');
});
