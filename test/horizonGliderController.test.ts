import {describe,expect,it} from 'vitest';
import {createGliderController,createParachuteController,POSE_SECONDS,PAD_THRESHOLDS,stillDoor} from '../src/harbour/horizon/movers/glider/controller.ts';
import {DEEP_JETTY} from '../src/harbour/horizon/movers/glider/corridor.ts';
import {FOLD_MARGIN,TRIM_GLIDE} from '../src/harbour/horizon/movers/glider/landing.ts';
import {MOVER_SOUNDS} from '../src/harbour/horizon/movers/shared/mode.ts';
import {SOUTH_WIND} from '../src/harbour/horizon/movers/shared/wind.ts';
import {launchFromPad,launchWing,padHeading,padLip,stepWing,type WingEnv} from '../src/harbour/horizon/movers/glider/wing.ts';
import {fly,input,pad,realHorizon,syntheticEnv,FRAME} from './fixtures/horizonFlight.ts';

const {world,env:real}=realHorizon();
const threshold=(id:string)=>world.thresholds.find(t=>t.id===id)!;
const standing=(id:string,yaw=0)=>{const t=threshold(id);return{x:t.at[0],y:t.height!,z:t.at[1],yaw};};

describe('the run-off at each of the three pads',()=>{
  for(const [padId,thresholdId] of Object.entries(PAD_THRESHOLDS)){
    it(`${thresholdId}: the wing goes on, three steps of forward input run to the lip, then flight (the snap on that frame)`,()=>{
      const c=createGliderController({env:real});c.enter(threshold(thresholdId),standing(thresholdId));
      const frames=fly(c,()=>({forward:1,bar:1}),()=>c.phase()==='flight'||c.phase()==='flare',10);
      const phases=[...new Set(frames.map(f=>f.phase))];
      expect(phases[0]).toBe('wear');expect(phases).toContain('run');expect(['flight','flare']).toContain(phases.at(-1));
      const lip=frames.findIndex(f=>f.phase==='flight'||f.phase==='flare');
      expect(frames[lip]!.sound).toBe(MOVER_SOUNDS.snap);expect(frames.filter(f=>f.sound===MOVER_SOUNDS.snap)).toHaveLength(1);
      // Wear 0.6 s + three steps at 4 m/s (0.75 s), ending at the pad's visible lip.
      expect(frames[lip]!.t).toBeGreaterThan(1.3);expect(frames[lip]!.t).toBeLessThan(1.45);
      const p=frames[lip]!.pose;expect(real.groundAt(p.x+Math.sin(p.yaw)*.5,p.z+Math.cos(p.yaw)*.5,p.y+.5)).toBeLessThan(p.y-.5);
      // Faces along the edge's normal: the edge runs east–west, so the wing leaves north or south.
      const yaw=frames[lip]!.pose.yaw;expect(Math.abs(Math.sin(yaw))).toBeLessThan(1e-9);
      // Flight: the height bubble and a place bubble (Fold) are live.
      fly(c,()=>({}),()=>false,1.5);expect(c.phase()).toBe('flight');expect(c.hud().height).toBeGreaterThan(8);expect(c.hud().place?.action).toBe('fold');
      void padId;
    });
  }
  it('letting go before the lip stops at the lip: no flight, no fall',()=>{
    const c=createGliderController({env:real});c.enter(threshold('crownLaunch'),standing('crownLaunch'));
    fly(c,t=>t<.6+.4?{bar:1,forward:1}:{},()=>false,3);
    expect(c.phase()).toBe('run');
    const p=c.bodyPose(),lip=threshold('crownLaunch');
    expect(Math.hypot(p.x-lip.at[0],p.z-lip.at[1])).toBeGreaterThan(1);expect(p.y).toBeCloseTo(lip.height!,6);
    expect(c.finished!()).toBe(false);expect(c.sound()).toBeNull();
    // "Step back" (the Fold bubble on the pad) walks off the pad on foot.
    expect(c.hud().place).toMatchObject({label:'Step back',action:'fold'});
    c.update(FRAME,input({fold:true}));expect(c.finished!()).toBe(true);expect(c.exit().cut).toBeUndefined();
  });
  it('runs off the side the rider faces when it falls away, else the side that does',()=>{
    const yawAt=(id:string,facing:number)=>{const c=createGliderController({env:real});c.enter(threshold(id),standing(id,facing));return Math.abs(c.bodyPose().yaw);};
    // The Prow's deck drops 43 m on both sides: the rider's choice.
    expect(yawAt('prowPlatform',0)).toBeCloseTo(0,9);expect(yawAt('prowPlatform',Math.PI)).toBeCloseTo(Math.PI,9);
    // The Crown's south shoulder falls 1.4 m in 20 m (unflyable); its north face 14.5 m: north either way.
    expect(yawAt('crownLaunch',0)).toBeCloseTo(Math.PI,9);expect(yawAt('crownLaunch',Math.PI)).toBeCloseTo(Math.PI,9);
    // The Lamp gallery runs off over the sea.
    expect(yawAt('lampGallery',0)).toBeCloseTo(Math.PI,9);
  });
});

describe('the sim\'s launch and ground (CAM requests 1 and 2)',()=>{
  it('launchFromPad starts at the pad\'s real lip with its outward heading — the controller uses it as is',()=>{
    for(const pad of real.envelope.launchPads!){
      const start=launchFromPad(pad.edge,real.groundAt,{facing:0}),h=pad.edge[0]![1];
      const heading=padHeading(pad.edge,0,real.groundAt),lip=padLip(pad.edge,heading,real.groundAt);
      expect(start.heading).toBeCloseTo(heading,9);expect(start.phase).toBe('flight');expect(start.y).toBeCloseTo(h,9);
      // Half a metre past the start the ground has fallen away (the visible lip), and the lip is past the edge line.
      expect(lip).toBeGreaterThan(0);
      expect(real.groundAt(start.x+Math.sin(heading)*.5,start.z+Math.cos(heading)*.5,h+.5)).toBeLessThan(h-.5);
      const run=launchFromPad(pad.edge,real.groundAt,{facing:0,run:true});expect(Math.hypot(run.x-start.x,run.z-start.z)).toBeCloseTo(3,6);expect(run.phase).toBe('run');
    }
    // The Crown runs off north whichever way the rider faces (its south shoulder barely drops: FLIGHT §2.1).
    const crown=real.envelope.launchPads!.find(p=>p.id==='crown')!;
    for(const facing of [0,Math.PI])expect(Math.abs(launchFromPad(crown.edge,real.groundAt,{facing}).heading)).toBeCloseTo(Math.PI,9);
  });
  it('WingEnv.ground takes the rider\'s height: a deck above the wing is not ground, the same deck below it is',()=>{
    // A bridge deck at h 50 over flat ground at 0, x 90…110.
    const deck=(x:number,y?:number)=>x>=90&&x<=110&&(y===undefined||y>=49.5)?50:0;
    const env:WingEnv={wind:SOUTH_WIND,lift:()=>0,ground:(x,_z,y)=>deck(x,y)};
    const fly=(y:number)=>{let w={...launchWing([[0,y,0],[0,y,6]],Math.PI/2),airspeed:11};for(let i=0;i<60*12&&w.phase!=='touchdown';i++)w=stepWing(w,{bar:0,bank:0},env,1/60);return w;};
    const under=fly(40);expect(under.x).toBeGreaterThan(110);expect(under.phase).not.toBe('touchdown');
    // From 58 m the wing sinks onto the deck (inside the flare band, flying east over it).
    let over={...launchWing([[80,52,0],[80,52,6]],Math.PI/2),airspeed:11};
    for(let i=0;i<60*12&&over.phase!=='touchdown';i++)over=stepWing(over,{bar:1,bank:0},env,1/60);
    expect(over.phase).toBe('touchdown');expect(over.y).toBe(50);expect(over.x).toBeGreaterThan(90);expect(over.x).toBeLessThanOrEqual(110.3);
    // The live env: the same rule through geography (a point under the Bight Bridge's deck reads the water, not the deck).
    const live=real.wingEnv(),g5=real.envelope.volumes!.find(v=>v.id==='bightBridge')!;
    expect(live.ground(g5.centre[0],g5.centre[2],g5.centre[1])).toBeLessThan(g5.centre[1]);
  });
});

describe('touchdown outcomes → exit or cut',()=>{
  const env=syntheticEnv();
  it('a flared landing on the Green: walk-off, a 0.8 s pose, then exit on the spot (no cut)',()=>{
    const c=createGliderController({env});c.enter(pad('test',1040,1000,30),{x:1040,y:30,z:1000,yaw:0});
    const frames=fly(c,()=>{const p=c.bodyPose();return{bar:c.phase()==='run'||c.phase()==='wear'?1:p.y-20<1.5?-1:0};},()=>c.finished!(),60);
    expect(c.outcome()).toMatchObject({kind:'walkoff',label:'the Green',rule:'field'});
    const landed=frames.findIndex(f=>f.phase==='pose');
    expect(frames.at(-1)!.t-frames[landed]!.t).toBeGreaterThanOrEqual(POSE_SECONDS-FRAME*1.5);
    const exit=c.exit();expect(exit.cut).toBeUndefined();expect(exit.label).toBeUndefined();expect(exit.at).toEqual(c.outcome()!.at);
  });
  it('an unflared landing: the tumble (a roll), then exit on the spot — never a crash',()=>{
    const c=createGliderController({env});c.enter(pad('test',1040,1000,30),{x:1040,y:30,z:1000,yaw:0});
    const frames=fly(c,()=>({bar:c.phase()==='run'||c.phase()==='wear'?1:.5}),()=>c.finished!(),60);
    expect(c.outcome()?.kind).toBe('tumble');expect(frames.some(f=>f.phase==='pose'&&(f.pose.pitch??0)<-1)).toBe(true);expect(c.exit().cut).toBeUndefined();
  });
  it('water: exits at once with a cut to the nearest shore node, labelled "→ …"',()=>{
    const c=createGliderController({env});c.enter(pad('test',950,860,30),{x:950,y:30,z:860,yaw:0});
    const frames=fly(c,()=>({bar:1}),()=>c.finished!(),60);
    expect(c.outcome()).toMatchObject({kind:'fadeShore',rule:'water',wet:20});expect(frames.some(f=>f.phase==='pose')).toBe(false);
    const exit=c.exit();expect(exit.cut).toBe(true);expect(exit.label?.startsWith('→ ')).toBe(true);expect(exit.at).toEqual([1006,20,950]);
  });
  it('the Throat: admitted within 40 m of the mouth, down the chute, the splash (splashEcho on that frame), the jetty cut',()=>{
    const c=createGliderController({env});c.enter(pad('test',1300,250,115),{x:1300,y:115,z:250,yaw:0});
    const frames=fly(c,()=>({bar:c.phase()==='run'||c.phase()==='wear'?1:c.phase()==='level'?-1:0}),()=>c.finished!(),60);
    const phases=[...new Set(frames.map(f=>f.phase))];
    expect(phases).toEqual(expect.arrayContaining(['corridor','level']));
    expect(frames.at(-1)!.sound).toBe(MOVER_SOUNDS.splashEcho);expect(frames.filter(f=>f.sound===MOVER_SOUNDS.splashEcho)).toHaveLength(1);
    expect(c.outcome()).toMatchObject({kind:'deepSmall',echoes:3,rule:'deep'});
    expect(c.exit()).toMatchObject({at:DEEP_JETTY.at,cut:true,label:'→ the jetty'});
  });
});

describe('Fold',()=>{
  const env=syntheticEnv();
  it('names the nearest reachable field in the place bubble and fades there, labelled',()=>{
    const c=createGliderController({env});c.enter(pad('test',1040,700,120),{x:1040,y:120,z:700,yaw:0});
    fly(c,()=>({bar:1}),()=>c.phase()==='flight',5);fly(c,()=>({}),()=>false,1);
    const p=c.bodyPose(),green=world.sky.landings.find(l=>l.id==='green')! as unknown as {xy:[number,number];height:number};
    const place=c.hud().place!;expect(place).toMatchObject({label:'the Green',action:'fold'});
    expect(p.y-green.height).toBeGreaterThanOrEqual(place.distance/TRIM_GLIDE+FOLD_MARGIN);
    c.update(FRAME,input({fold:true}));
    expect(c.finished!()).toBe(true);
    expect(c.exit()).toEqual({at:[green.xy[0],green.height,green.xy[1]],yaw:expect.any(Number),cut:true,label:'→ the Green'});
  });
  it('with no field in reach it still offers a way down: the path below, never nothing',()=>{
    const c=createGliderController({env});c.enter(pad('test',200,300,40),{x:200,y:40,z:300,yaw:Math.PI});
    fly(c,()=>({bar:1}),()=>c.phase()==='flight',5);fly(c,()=>({}),()=>false,.5);
    expect(c.hud().place).toMatchObject({action:'fold'});
    c.update(FRAME,input({fold:true}));expect(c.exit().cut).toBe(true);
  });
});

describe('the parachute controller',()=>{
  const env=syntheticEnv();
  const bail=world.thresholds.find(t=>t.id==='bailOut')!;
  const jump=(h:number,plane=stillDoor(1040,h,1000))=>{const c=createParachuteController({env,plane:()=>plane});c.enter({...bail,at:[plane.x,plane.z],height:h},{x:plane.x,y:h,z:plane.z,yaw:0});return c;};
  it('freefall offers Pull; pulling opens the canopy with the snap on that frame',()=>{
    const c=jump(220);
    fly(c,()=>({}),()=>false,1);expect(c.phase()).toBe('freefall');expect(c.hud().place).toEqual({label:'Pull',distance:0,action:'pull'});
    const frames=fly(c,()=>({pull:true}),()=>c.phase()!=='freefall',1);
    expect(c.phase()).toBe('opening');expect(frames.at(-1)!.sound).toBe(MOVER_SOUNDS.snap);
    fly(c,()=>({}),()=>c.phase()==='canopy',3);expect(c.phase()).toBe('canopy');
  });
  it('auto-pulls at 45 m above the ground when nobody pulls',()=>{
    const c=jump(200);let openedAt=NaN;
    fly(c,()=>({}),()=>{if(c.phase()==='opening'&&Number.isNaN(openedAt))openedAt=c.bodyPose().y-20;return c.phase()==='canopy';},30);
    expect(openedAt).toBeLessThanOrEqual(45+1);expect(openedAt).toBeGreaterThan(40);
  });
  it('lands, plays the pose, and is finished; the exit is on foot where it touched',()=>{
    const c=jump(120);
    fly(c,()=>{const agl=c.bodyPose().y-20;return{pull:true,bar:agl<5?-1:0};},()=>c.finished!(),120);
    expect(c.finished!()).toBe(true);expect(['walkoff','tumble']).toContain(c.outcome()?.kind);
    expect(c.exit().at[1]).toBeCloseTo(20,6);
  });
  it('is refused below 60 m above the ground (nothing to fly; exits where it stood)',()=>{
    const c=jump(70);expect(c.finished!()).toBe(true);expect(c.exit().at).toEqual([1040,70,1000]);
  });
});

describe('the greybox art (index.ts drives it from artState)',async()=>{
  const THREE=await import('three');
  const {createFlightArt,FOLD_SECONDS,GATHER_STEPS,GATHER_STEP_SECONDS}=await import('../src/harbour/horizon/movers/glider/art.ts');
  const base={flying:true,ended:false,stage:'flight',pose:{x:1000,y:100,z:900,yaw:.4,pitch:-.1,bank:.5},open:1,landedFor:null,faded:false};
  it('builds a 10 m wing and a canopy with a white tail-light card and no light objects, no text',()=>{
    for(const kind of ['glider','parachute'] as const){
      const art=createFlightArt(kind);let lights=0;art.root.traverse(o=>{if(o instanceof THREE.Light)lights++;});
      expect(lights).toBe(0);expect(art.root.getObjectByName('tailLight.card')).toBeDefined();
      const box=new THREE.Box3().setFromObject(art.root);if(kind==='glider')expect(box.max.x-box.min.x).toBeCloseTo(10,1);
      art.dispose();
    }
  });
  it('banks and pitches the wing group, hangs the rider prone in flight, folds away over 2 s after landing',()=>{
    const art=createFlightArt('glider'),figure=new THREE.Group();
    expect(art.update({...base,kind:'glider'},1/60,figure)).toBe(true);expect(art.root.visible).toBe(true);
    expect(new THREE.Euler().setFromQuaternion(art.root.quaternion,'YXZ').z).toBeCloseTo(.5,6);expect(new THREE.Euler().setFromQuaternion(art.root.quaternion,'YXZ').x).toBeCloseTo(.1,6);
    const head=new THREE.Vector3(0,1,0).applyQuaternion(figure.quaternion);expect(Math.abs(head.y)).toBeLessThan(.2);// lying along the keel
    let t=0,alive=true;while(alive&&t<5){alive=art.update({...base,kind:'glider',stage:'pose',landedFor:t},1/60,figure);t+=1/60;}
    expect(alive).toBe(false);expect(t).toBeGreaterThanOrEqual(FOLD_SECONDS-1e-6);expect(t).toBeLessThan(FOLD_SECONDS+.05);
  });
  it('gathers the canopy in three steps, and never shows a wing for a mode that never flew',()=>{
    const chute=createFlightArt('parachute');let t=0,alive=true;
    while(alive&&t<5){alive=chute.update({...base,kind:'parachute',stage:'pose',landedFor:t},1/60,null);t+=1/60;}
    expect(t).toBeCloseTo(GATHER_STEPS*GATHER_STEP_SECONDS,1);
    const cut=createFlightArt('glider');expect(cut.update({...base,kind:'glider',flying:false,ended:true},1/60,null)).toBe(false);expect(cut.root.visible).toBe(false);
  });
});
