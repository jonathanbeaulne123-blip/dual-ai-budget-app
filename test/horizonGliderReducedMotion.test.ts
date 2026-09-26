import {describe,expect,it,vi} from 'vitest';
import {createModeRegistry} from '../src/harbour/horizon/movers/registry.ts';
import {createMoverHook} from '../src/harbour/horizon/runtime/moverHook.ts';
import {thresholdTransitions} from '../src/harbour/horizon/movers/shared/threshold.ts';
import type {ModeController} from '../src/harbour/horizon/movers/shared/mode.ts';
import {parseBailQuery,registerBailOutProvider,registerGliderModes,startDevParachute,type GliderRuntime} from '../src/harbour/horizon/movers/glider/index.ts';
import {createGliderController,padLandings,type FlightController} from '../src/harbour/horizon/movers/glider/controller.ts';
import {cameraFov} from '../src/harbour/horizon/movers/glider/camera.ts';
import {stillDoor} from '../src/harbour/horizon/movers/glider/controller.ts';
import {realHorizon} from './fixtures/horizonFlight.ts';
import {HARBOUR_DEV} from '../src/harbour/flag.ts';

const {world,env,geography,cuts}=realHorizon();
const threshold=(id:string)=>world.thresholds.find(t=>t.id===id)!;
const on=(id:string)=>{const t=threshold(id);return{x:t.at[0],y:t.height??0,z:t.at[1],yaw:0};};

/** The runtime's accept path (runtime/index.ts `accept`) over the real registry and hook, with the M6 registration. */
function harness(settings:{reducedMotion:boolean;calm:boolean}){
  const movers=createModeRegistry(world.thresholds),body={x:0,y:0,z:0,yaw:0},hook=createMoverHook({body,ground:geography.ground});
  const arts:{tick:(dt:number,figure:never)=>boolean}[]=[],attachMover=vi.fn((c:ModeController)=>hook.attach(c));
  const runtime={movers,world,geography,assets:{cuts},moverArt:(_o:unknown,tick:(dt:number,f:never)=>boolean)=>{arts.push({tick});return()=>{};},settings:()=>({tier:'full' as const,...settings}),reviewDate:()=>new Date('2026-06-21T19:30:00Z'),attachMover,body:()=>({...body})} as unknown as GliderRuntime;
  registerGliderModes(runtime);
  function accept(id:string,to='glider'){
    Object.assign(body,on(id));
    const offer=movers.offers(body).find(o=>o.thresholdId===id&&o.to===to)!,taken=movers.accept(offer,body)!;
    const controller=taken.controller as FlightController;
    if(settings.reducedMotion||settings.calm){hook.attach(null);return{controller,cut:controller.reducedMotionCut()};}
    runtime.attachMover(controller);return{controller,cut:null};
  }
  return{movers,hook,arts,attachMover,accept,runtime,body};
}

describe('the launch sheet under reduced motion (FLIGHT.md §6)',()=>{
  const ids=(padId:string)=>padLandings(padId,env).map(l=>l.id);
  it('lists each pad\'s reachable landings',()=>{
    expect(ids('crown')).toEqual(['green','reachMeadow','sands','strip','deep']);
    expect(ids('prow')).toEqual(['reachMeadow','sands','green']);
    expect(ids('lampGallery')).toEqual(['sandbar','strip']);
    expect(padLandings('crown',env).map(l=>l.label)).toEqual(['the Green','the Reach meadow','Long Sands','the strip','the Deep, through the Throat']);
    expect(padLandings('prow',env).find(l=>l.id==='sands')!.label).toBe('Long Sands (afternoon)');
    expect(padLandings('lampGallery',env).map(l=>l.label)).toEqual(['the sandbar',"the Flats' strip"]);
  });
  it('the sandbar is the Bight shore path node nearest [600, 1030], on dry ground by the water',()=>{
    const sandbar=padLandings('lampGallery',env)[0]!;
    // Measured: [735, 1, 961], 152 m away — the nodes nearer (≈ [547, −6, 1084]) run under the water and are not a shore.
    expect(Math.hypot(sandbar.xy[0]-600,sandbar.xy[1]-1030)).toBeLessThan(160);expect(sandbar.height!).toBeGreaterThanOrEqual(0);
    expect(env.water(sandbar.xy[0],sandbar.xy[1],sandbar.height!+.3)).toBeNull();
    expect(env.shoreNode(600,1030)?.label).toBe('Bight Shore');
  });
  it('every landing has a finite place and height (the cut lands on foot there)',()=>{
    for(const padId of ['crown','prow','lampGallery','parachute'])for(const l of padLandings(padId,env))expect([...l.xy,l.height??0].every(Number.isFinite)).toBe(true);
  });
});

describe('accepting under reduced motion or calm view: the cut, never a flight',()=>{
  for(const settings of [{reducedMotion:true,calm:false},{reducedMotion:false,calm:true}]){
    for(const id of ['crownLaunch','prowPlatform','lampGallery']){
      it(`${id} (${settings.reducedMotion?'reduced motion':'calm'}): returns the pad's sheet, attaches nothing, shows no wing`,()=>{
        const h=harness(settings),{controller,cut}=h.accept(id);
        expect(cut?.landings.length).toBeGreaterThan(0);expect(h.hook.attached()).toBeNull();expect(h.attachMover).not.toHaveBeenCalled();
        expect(controller.artState().flying).toBe(false);
        // The sheet's choice ends the mode (runtime cutTo → registry.finish): back to feet, the art removes itself unseen.
        h.movers.finish();expect(h.movers.active()).toBe('feet');
        expect(h.arts.at(-1)!.tick(1/60,null as never)).toBe(false);
        // No FOV change: the controller never left the walk camera.
        expect(controller.camera().fov).toBe(45);
      });
    }
  }
  it('the flight cam never changes FOV under reduced motion',()=>{
    for(const kind of ['glider','corridor','freefall','canopy'] as const)for(const v of [8,11,17,30])expect(cameraFov(kind,v,'full',true)).toBe(55);
  });
  it('the dev jump is refused under reduced motion and calm view',()=>{
    for(const s of [{reducedMotion:true,calm:false},{reducedMotion:false,calm:true}])expect(startDevParachute(harness(s).runtime,{x:1040,z:1000,h:300})).toBeNull();
  });
});

describe('the offers read exactly as the brief says',()=>{
  it('"Run off", "Run off the gallery", and the bail-out\'s "Jump" (a 0.5 s hold: vehicle → vehicle)',()=>{
    const h=harness({reducedMotion:false,calm:false});
    const label=(id:string)=>{Object.assign(h.body,on(id));return h.movers.offers(h.body).filter(o=>o.thresholdId===id).map(o=>o.action);};
    expect(label('crownLaunch')).toEqual(['Run off']);expect(label('lampGallery')).toEqual(['Run off the gallery']);expect(label('prowPlatform')).toEqual(['Run off']);
    expect(thresholdTransitions(threshold('bailOut'))).toEqual([{from:'plane',to:'parachute',action:'Jump'}]);
  });
  it('offers Jump from the plane only ≥ 60 m above the ground under it (M7 plugs the plane in)',()=>{
    const h=harness({reducedMotion:false,calm:false}),plane=stillDoor(1040,200,1000);let door:ReturnType<typeof stillDoor>|null=plane;
    h.movers.register('plane',()=>({id:'plane',enter(){},update(){},exit:()=>({at:[435,40,690],yaw:0}),bodyPose:()=>({x:door!.x,y:door!.y,z:door!.z,yaw:0}),camera:()=>({eye:[0,0,0],look:[0,0,1],fov:55,roll:0}),sound:()=>null,reducedMotionCut:()=>({landings:[]}),hud:()=>({})}));
    Object.assign(h.body,on('strip'));h.movers.accept(h.movers.offers(h.body).find(o=>o.to==='plane')!,h.body);
    const off=registerBailOutProvider(h.runtime,()=>door);
    Object.assign(h.body,{x:1040,y:200,z:1000});
    const jump=h.movers.offers(h.body).find(o=>o.to==='parachute');expect(jump).toMatchObject({action:'Jump',from:'plane',at:[1040,1000],height:200});
    door={...plane,y:env.groundAt(1040,1000,200)+59};Object.assign(h.body,{y:door.y});expect(h.movers.offers(h.body).some(o=>o.to==='parachute')).toBe(false);
    door=plane;Object.assign(h.body,{y:200});
    const taken=h.movers.accept(h.movers.offers(h.body).find(o=>o.to==='parachute')!,h.body)!;
    expect(taken.controller?.id).toBe('parachute');expect((taken.controller as FlightController).phase()).toBe('freefall');
    off();
  });
  it('a glider controller made directly still offers its pad\'s sheet',()=>{
    const c=createGliderController({env});c.enter(threshold('lampGallery'),on('lampGallery'));
    expect(c.reducedMotionCut().landings.map(l=>l.id)).toEqual(['sandbar','strip']);
  });
});

describe('the dev jump (?bail=x,z,h)',()=>{
  it('parses three finite numbers, else nothing',()=>{
    expect(parseBailQuery('?world=horizon&bail=1040,1000,300')).toEqual({x:1040,z:1000,h:300});
    for(const q of ['?bail=1040,1000','?bail=a,b,c','?world=horizon',''])expect(parseBailQuery(q)).toBeNull();
  });
  it('starts a parachute in freefall from the point in development (a flight: attached), and refuses below 60 m',()=>{
    const h=harness({reducedMotion:false,calm:false}),c=startDevParachute(h.runtime,{x:1040,z:1000,h:300});
    if(!HARBOUR_DEV){expect(c).toBeNull();return;}
    expect(c?.id).toBe('parachute');expect(h.attachMover).toHaveBeenCalledWith(c);expect((c as FlightController).phase()).toBe('freefall');
    expect(startDevParachute(harness({reducedMotion:false,calm:false}).runtime,{x:1040,z:1000,h:env.groundAt(1040,1000,300)+50})).toBeNull();
  });
});
