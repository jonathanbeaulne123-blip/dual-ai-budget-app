// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {createKitchenEngine} from '../src/harbour/horizon/kitchen/model.ts';
import type {KitchenCommand,KitchenView} from '../src/harbour/horizon/kitchen/types.ts';

// Keep both the stage and KitchenHUD real: the runtime's external keyboard path
// must be reflected after an immediate React button command between two polls.
let engine=createKitchenEngine();
const view=():KitchenView=>({state:engine.snapshot(),stations:[],connections:[{chef:0,kind:'keyboard',label:'Keyboard',connected:true}],available:true,resumable:true,progress:{version:1,completed:{},best:{},unlocks:[]},storageWarning:null,tossTargets:{},targetLabels:{}});
const kitchenInput=vi.fn();
const kitchenCommand=vi.fn((command:KitchenCommand)=>{if(command.type==='exit')engine.exit();else if(command.type==='open')engine.open();else if(command.type==='action')engine.action(command.chef,command.action);return true;});
vi.mock('../src/harbour/scene/worldMount.ts',()=>({mountHorizonWorld:async()=>({
  mode:()=>'walk',shotId:()=>'A',offers:()=>[],moverState:()=>({mode:'feet',attached:false,hud:null,perspective:'activity'}),
  fleetActions:()=>[],fleetState:()=>({vessels:[],swimming:false,perspective:'activity',sitting:null,saveFailed:false}),
  // #560 (merged beside #559) added the stage's home calls; the same mock rows as horizonQuickLayerModes (reconciliation 2).
  setHome(){},visitHome:()=>true,homeActions:()=>[],
  kitchenView:view,kitchenCommand,kitchenInput,setKitchenSound(){},
  setTheme(){},setCruiserTheme(){},setCruiserSkin(){},toggleCruiser(){},recoverCruiser(){},cyclePerspective(){},cycleCamera(){},resumeEquipment(){},
  pause(){},setComfort(){},setReducedMotion(){},setCalm(){},setMode(){},dispose(){},input(){},look(){},jump(){},jumpHold(){},enterDoor(){},cutTo(){},world:{views:[]},
})}));
vi.mock('../src/harbour/horizon/movers/glider/index.ts',()=>({registerGliderModes:()=>()=>{}}));

beforeAll(()=>{
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  window.matchMedia=((query:string)=>({matches:false,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent:()=>false})) as typeof window.matchMedia;
  globalThis.ResizeObserver??=class{observe(){}unobserve(){}disconnect(){}} as unknown as typeof ResizeObserver;
});
beforeEach(()=>{vi.useFakeTimers();engine=createKitchenEngine();engine.open();kitchenCommand.mockClear();kitchenInput.mockClear();});
let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.useRealTimers();});

async function render(paused=false){
 const {default:HorizonStage}=await import('../src/harbour/horizon/HorizonStage.tsx');
 if(!host){host=document.createElement('div');document.body.append(host);root=createRoot(host);}
 await act(async()=>{root!.render(createElement(HorizonStage,{paused}));});
 await act(async()=>{await vi.dynamicImportSettled();await vi.advanceTimersByTimeAsync(200);});
}

describe('Yacht Kitchen stage snapshot synchronization',()=>{
  it('renders the same menu again when keyboard reopening follows a close before the next poll',async()=>{
    const {default:HorizonStage}=await import('../src/harbour/horizon/HorizonStage.tsx');
    host=document.createElement('div');document.body.append(host);root=createRoot(host);
    await act(async()=>{root!.render(createElement(HorizonStage));});
    await act(async()=>{await vi.dynamicImportSettled();});
    await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
    const initialSnapshot=JSON.stringify(view());
    const close=host.querySelector<HTMLButtonElement>('button[aria-label="Close kitchen menu"]');
    expect(close).not.toBeNull();expect(host.textContent).toContain('Resume service');

    act(()=>close!.click());
    expect(kitchenCommand).toHaveBeenCalledWith({type:'exit'});
    expect(host.querySelector('.kitchen-menu')).toBeNull();
    // E is handled by the runtime, outside the React command callback. Return
    // exactly the previous menu snapshot before another 200 ms poll can run.
    engine.open();
    expect(JSON.stringify(view())).toBe(initialSnapshot);
    await act(async()=>{await vi.advanceTimersByTimeAsync(200);});

    expect(host.querySelector('.kitchen-menu')).not.toBeNull();
    expect([...host.querySelectorAll('button')].some(button=>button.textContent==='Resume service')).toBe(true);
  });
  it('keeps service, player and comfort drafts mounted while Tools hides the kitchen',async()=>{
    await render();const menu=host!.querySelector('.kitchen-menu')!;
    const services=menu.querySelectorAll<HTMLInputElement>('input[name="kitchen-service"]'),players=menu.querySelectorAll<HTMLInputElement>('input[name="kitchen-players"]');
    const forgiveness=menu.querySelector<HTMLSelectElement>('.kitchen-assists select')!,large=[...menu.querySelectorAll('label')].find(label=>label.textContent?.includes('Larger kitchen text'))!.querySelector<HTMLInputElement>('input')!;
    act(()=>{services[2]!.click();players[1]!.click();forgiveness.value='1.5';forgiveness.dispatchEvent(new Event('change',{bubbles:true}));large.click();});
    await render(true);expect(menu.isConnected).toBe(true);expect(menu.closest('[hidden]')).not.toBeNull();
    await render(false);expect(host!.querySelector('.kitchen-menu')).toBe(menu);expect(menu.closest('[hidden]')).toBeNull();
    expect(services[2]!.checked).toBe(true);expect(players[1]!.checked).toBe(true);expect(forgiveness.value).toBe('1.5');expect(large.checked).toBe(true);
  });
  it('keeps focus on native kitchen action buttons after accessible activation',async()=>{
    engine.start('practice',1);engine.action(0,{type:'ready'});await render();
    const pick=[...host!.querySelectorAll<HTMLButtonElement>('.kitchen-touch__actions button')].find(button=>button.textContent?.includes('Pick / place'))!;
    act(()=>{pick.focus();pick.click();});expect(kitchenInput).toHaveBeenCalledWith(0,{interact:true});expect(document.activeElement).toBe(pick);
  });

  it('focuses the world when ready starts play so movement keys work immediately',async()=>{
    engine.start('practice',1);await render();
    const ready=[...host!.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.includes('Ready, Chef 1'))!;
    act(()=>{ready.focus();ready.click();});expect(engine.state().phase).toBe('playing');expect(document.activeElement).toBe(host!.querySelector('.horizon-stage'));
  });

});
