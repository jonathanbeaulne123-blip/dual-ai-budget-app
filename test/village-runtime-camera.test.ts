// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountHarbourWorld, type HarbourRuntime } from "../src/harbour/scene/runtime.ts";
import { PLACES, SCENE_DRESSING } from "../src/harbour/scene/place.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import "../src/harbour/village/VillageCourt.ts";
import { prepareVillageInterior } from "../src/harbour/village/interior.ts";
import "../src/harbour/village/LoftScene.ts";

Object.defineProperty(HTMLCanvasElement.prototype,"getContext",{configurable:true,value:()=>null});
const release = vi.fn();
vi.mock("../src/house/world/rendererOwner.ts", () => ({ acquireWorldRenderer: () => ({ active:true, renderer:{render:vi.fn(),setSize:vi.fn(),info:{render:{calls:0},memory:{geometries:0,textures:0}}}, requestFrame:(cb:FrameRequestCallback)=>requestAnimationFrame(cb),cancelFrame:(id:number)=>cancelAnimationFrame(id),listenCanvas:()=>()=>undefined,release }) }));
const household=seedDemoHousehold({today:"2026-09-20"}), reading=buildHarbourReading(household,household.members[0]!.id,"2026-09-20","current");

describe("runtime camera ownership",()=>{
 let host:HTMLDivElement, world:HarbourRuntime|undefined, frames=new Map<number,FrameRequestCallback>(), serial=0,clock=1000;
 const run=(n:number)=>{for(let i=0;i<n;i+=1){const work=[...frames.values()];frames.clear();clock+=34;work.forEach(cb=>cb(clock));}};
 beforeEach(()=>{world=undefined;frames.clear();serial=0;clock=1000;release.mockClear();vi.stubGlobal("requestAnimationFrame",(cb:FrameRequestCallback)=>{frames.set(++serial,cb);return serial});vi.stubGlobal("cancelAnimationFrame",(id:number)=>frames.delete(id));vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});vi.stubGlobal("IntersectionObserver",class{observe(){}disconnect(){}});vi.spyOn(performance,"now").mockImplementation(()=>clock);host=document.createElement("div");host.getBoundingClientRect=()=>({width:1200,height:800,left:0,top:0,right:1200,bottom:800,x:0,y:0,toJSON:()=>({})}) as DOMRect;document.body.append(host);});
 afterEach(()=>{delete document.documentElement.dataset.motion;world?.dispose();host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
 prepareVillageInterior("tower");const mount=(place="tower")=>world=mountHarbourWorld(host,"classic","lite",{onReady:vi.fn(),onFailure:vi.fn(),place:PLACES[place as keyof typeof PLACES],reading,dressing:SCENE_DRESSING.classic});
 it("invalidate preserves an inactive room Look camera",()=>{const stage=mount()!;stage.go("court");run(200);const before=stage.camera();stage.invalidate();run(200);expect(stage.body()!.following()).toBe(false);expect(stage.camera()).toEqual(before);});
 it("quick enter ends follow and retains a room view",()=>{const stage=mount("court")!,body=stage.body()!;body.input({forward:1,strafe:0});run(20);expect(stage.body()!.following()).toBe(true);stage.enter("tower",{reduced:true});run(4);expect(stage.body()!.following()).toBe(false);expect(stage.placeId()).toBe("tower");expect(stage.camera().every(Number.isFinite)).toBe(true);});
 it("honours the app's Reduced preference and keeps the inactive walking camera out of the view", async()=>{
  const stage=mount("court")!;run(200);const before=stage.camera();
  document.documentElement.dataset.motion="reduced";await Promise.resolve();
  expect(stage.camera()).toEqual(before);
  stage.look({target:[0,1,0],r:20,theta:.2,phi:.7});const cut=stage.camera();
  expect(cut).not.toEqual(before);run(1);expect(stage.camera()).toEqual(cut);
 });
 it("fails closed for a missing destination and releases its lease once",()=>{const stage=mount("court")!, before=stage.placeId(); const saved=PLACES.tower; delete PLACES.tower; stage.enter("tower",{reduced:true}); expect(stage.placeId()).toBe(before); PLACES.tower=saved; release.mockClear(); stage.dispose(); stage.dispose(); expect(release).toHaveBeenCalledTimes(1);});
 it('hands a deliberate further zoom to Journey once, and never from an interior or tool',()=>{
  const onJourney=vi.fn();
  world=mountHarbourWorld(host,'classic','lite',{onReady:vi.fn(),onFailure:vi.fn(),onJourney,place:PLACES.court,reading,dressing:SCENE_DRESSING.classic});
  world.go('sky');run(200);expect(onJourney).not.toHaveBeenCalled();
  world.setToolOpen(true);host.dispatchEvent(new WheelEvent('wheel',{deltaY:400}));expect(onJourney).not.toHaveBeenCalled();
  world.setToolOpen(false);world.enter('tower',{reduced:true});host.dispatchEvent(new WheelEvent('wheel',{deltaY:400}));expect(onJourney).not.toHaveBeenCalled();
  world.enter('court',{reduced:true});world.go('sky');run(200);
  host.dispatchEvent(new WheelEvent('wheel',{deltaY:140}));expect(onJourney).not.toHaveBeenCalled();
  host.dispatchEvent(new WheelEvent('wheel',{deltaY:140}));host.dispatchEvent(new WheelEvent('wheel',{deltaY:400}));expect(onJourney).toHaveBeenCalledTimes(1);
 });
});
