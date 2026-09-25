// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import HorizonWorld from '../src/harbour/horizon/HorizonWorld.tsx';
import type {HarbourWorldProps} from '../src/harbour/HarbourWorld.tsx';
import type {HorizonStageProps} from '../src/harbour/horizon/HorizonStage.tsx';
import type {Host} from '../src/harbour/horizon/world/definition.ts';
import {readHouseReturnOnDevice} from '../src/house/navigation.ts';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const state=vi.hoisted(()=>({stage:null as HorizonStageProps|null,feed:vi.fn()}));
vi.mock('../src/harbour/horizon/HorizonStage.tsx',()=>({default:(props:HorizonStageProps)=>{state.stage=props;return null;}}));
vi.mock('../src/harbour/presence/feed.ts',()=>({publishLocalPose:()=>()=>{},useWorldFeed:(options:unknown)=>{state.feed(options);return{walk:null};}}));
vi.mock('../src/softPresenceWorld.ts',()=>({readWorldPresenceShare:()=> 'together'}));
let root:Root|undefined;
afterEach(()=>{if(root)act(()=>root!.unmount());root=undefined;localStorage.clear();vi.clearAllMocks();});
const body={world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:1490,y:14,z:1165,yaw:-Math.PI/2};
const identity={environment:'development' as const,householdId:'HH-fixture-horizon',memberId:'MEM-fixture-horizon',scope:'personal' as const};
function mount(){
 const navigate=vi.fn(),open=vi.fn(),route={householdId:identity.householdId,scope:identity.scope,room:'home',level:'middle',object:{type:'old',id:'old'}};
 const props={household:{environment:identity.environment,householdId:identity.householdId},memberId:identity.memberId,scope:identity.scope,route,onNavigateLocation:navigate,onOpen:open,presence:{optedOut:true}} as unknown as HarbourWorldProps;
 root=createRoot(document.createElement('div'));act(()=>root!.render(createElement(HorizonWorld,props)));return{navigate,open,props};
}
it('opens all seven existing tools in the same scope and saves the outward return body',()=>{
 const {navigate,open}=mount();
 for(const [id,place,target] of [['home','kitchen','conversation'],['bank','bank','loft-banks'],['library','library','books'],['glasshouse','glasshouse','planner'],['studio','kiln','pottery'],['cottage','cottage','wardrobe'],['boathouse','boathouse','wishes']]){
  act(()=>state.stage!.onDoor!({id,toolPlaceId:place,placeIds:[place]} as Host,body));
  expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({householdId:identity.householdId,scope:'personal',surface:target,object:undefined}));
  expect(readHouseReturnOnDevice(identity,'horizon')?.body).toEqual(body);
 }
 expect(open).not.toHaveBeenCalled();
 expect(state.feed).toHaveBeenLastCalledWith(expect.objectContaining({view:'personal',softPresenceOptedOut:true,world:body.world}));
});
it('loads the new member identity return instead of retaining the previous saved body',()=>{
 const {props}=mount();act(()=>state.stage!.onDoor!({id:'home',toolPlaceId:'kitchen',placeIds:['kitchen']} as Host,body));
 act(()=>root!.render(createElement(HorizonWorld,{...props,memberId:'MEM-other'})));
 expect(state.stage!.initialBody).toBeUndefined();
});

it('saves the walker when the stage leaves for the Reading edition',()=>{
 mount();
 state.stage!.onRuntime!({savedBody:()=>body} as Parameters<NonNullable<HorizonStageProps['onRuntime']>>[0]);
 state.stage!.onRuntime!(null);
 expect(readHouseReturnOnDevice(identity,'horizon')?.body).toEqual(body);
});
