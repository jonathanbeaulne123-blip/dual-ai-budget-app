// Jonathan 2026-10-04: "make sure all gilders spots are accessible, if there is a model for the glider have it at each glider spot."
// The three launch pads, measured on the REAL baked world (public/horizon/world + terrain): the Guide's stand on each deck,
// inside the threshold's offer reach and facing the run-off; the parked glider on the same deck, clear of the stand and the
// stair; the dead-offer filter (the Prow's zip has no controller); and the runtime's restore keeping the stand (never a snap).
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES} from '../src/harbour/horizon/runtime/geography';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2';
import {restoreHorizonPosition,HORIZON_RESTORE_TOLERANCE} from '../src/harbour/horizon/runtime/savedPosition';
import {createMoverRegistry,type MoverDeps} from '../src/harbour/horizon/movers/shared/registry';
import {offersAt,OFFER_DY,OFFER_REACH} from '../src/harbour/horizon/movers/shared/threshold';
import type {ModeController} from '../src/harbour/horizon/movers/shared/mode';
import {padHeading,RUN_DROP} from '../src/harbour/horizon/movers/glider/wing';
import {createParkedGlider} from '../src/harbour/horizon/movers/glider/art';
import {HORIZON_MANIFEST} from '../src/harbour/horizon/world/manifest';
import {HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD} from '../src/worldGeography';
import {GLIDER_PADS,GLIDER_PAD_DRAW_RADIUS,createGliderPads,distanceToParkedGlider,gliderPadNear,gliderPadPlacement,gliderPadRefusal,gliderPadStand,liveTravelOffers,stairEnds,standOffers,type GliderPadPlacement} from '../src/harbour/horizon/runtime/gliderPads';
import type {LandCuts} from '../src/harbour/horizon/land/interfaces';
import type {Point3,WorldDefinition} from '../src/harbour/horizon/world/definition';

const bytes=(p:string)=>{const b=readFileSync(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const world=parseHorizonDefinition(bytes('public/horizon/world/horizon-geo-1.json.gz')) as unknown as WorldDefinition&{collision:Omit<LandCuts,'solids'|'diagnostics'>;geometry:{solids:LandCuts['solids']}};
const cuts={...world.collision,solids:world.geometry.solids,diagnostics:[]} as LandCuts;
const terrain=bytes('public/horizon/terrain/horizon-geo-1.bin');
const tiers=(['full','lite'] as const).map(tier=>{
  const field=decodeTerrainAsset(terrain,tier),geo=createHorizonGeography(field,cuts);
  // The runtime's own placed region (runtime/index.ts): the Crown deck stands inside Mountain v2's footprint.
  geo.addDynamic(createMountainV2Region({walkingJoinSolids:cuts.solids,horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:terraceBedExclusion(cuts.beds),exclude:mouthExclusion(cuts.mouths),terrainStep:field.step}).provider);
  return{tier,geo};
});
const clear=stairEnds(cuts.beds);
const placementsFor=(geo:ReturnType<typeof createHorizonGeography>)=>GLIDER_PADS.map(p=>gliderPadPlacement(world,p.id,(x,z,y)=>geo.surface(x,z,y),geo.ground,clear));
/** The runtime's restore check (runtime/index.ts restoreStand). */
const restoreStand=(geo:ReturnType<typeof createHorizonGeography>)=>(x:number,z:number,y:number)=>{const at=geo.surface(x,z,y+.5,HORIZON_RESTORE_TOLERANCE);return at&&at.slope<=HORIZON_WALKABLE_DEGREES&&!geo.submerged(x,z,at.y)&&!geo.blocked(x,z,at.y)?{standY:at.y}:null;};
const DECKS={crown:170,prow:100,lampGallery:25};

describe('the three glider launch pads on the baked world',()=>{
  for(const {tier,geo} of tiers)describe(tier,()=>{
    const placements=placementsFor(geo);
    for(const pad of GLIDER_PADS)describe(pad.label,()=>{
      const p=placements.find(row=>row?.id===pad.id) as GliderPadPlacement;
      it('stands the body on the deck, walkable, dry and unblocked',()=>{
        expect(p).toBeTruthy();expect(p.deck).toBeCloseTo(DECKS[pad.id],2);
        const floor=geo.surface(p.stand.x,p.stand.z,p.stand.y+.5)!;
        expect(Math.abs(floor.y-p.stand.y)).toBeLessThan(.05);expect(floor.slope).toBeLessThanOrEqual(HORIZON_WALKABLE_DEGREES);
        expect(geo.submerged(p.stand.x,p.stand.z,p.stand.y)).toBe(false);expect(geo.blocked(p.stand.x,p.stand.z,p.stand.y)).toBe(false);
      });
      it('keeps the stand through the runtime restore (never a snap to a path node)',()=>{
        const out=restoreHorizonPosition({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',...p.stand},world.pathGraph!,geo.ground,restoreStand(geo));
        expect([out.x,out.z]).toEqual([p.stand.x,p.stand.z]);expect(out.y).toBeCloseTo(p.deck,2);expect(out.yaw).toBe(p.heading);
      });
      it('is inside the threshold\'s offer reach: on foot it is offered the glider there',()=>{
        const t=world.thresholds.find(row=>row.id===pad.thresholdId)!;
        expect(standOffers(p,t)).toBe(true);
        const offers=offersAt(world,{...p.stand},'feet',geo.ground);
        expect(offers.some(o=>o.thresholdId===pad.thresholdId&&o.to==='glider')).toBe(true);
        expect(Math.hypot(p.stand.x-t.at[0],p.stand.z-t.at[1])).toBeLessThanOrEqual(OFFER_REACH);expect(Math.abs(p.stand.y-t.height!)).toBeLessThanOrEqual(OFFER_DY);
      });
      it('faces the run-off: the glider\'s own pad heading, the ground falling away ahead',()=>{
        const launch=world.sky.launchPads!.find(l=>l.id===pad.id)!,groundAt=(x:number,z:number,y:number)=>geo.surface(x,z,y)?.y??geo.ground(x,z);
        expect(p.heading).toBe(padHeading(launch.edge as Point3[],0,groundAt));
        expect(padHeading(launch.edge as Point3[],p.stand.yaw,groundAt)).toBe(p.heading);   // the run the rider takes facing the stand's yaw
        const ahead=groundAt(p.stand.x+Math.sin(p.heading)*20,p.stand.z+Math.cos(p.heading)*20,p.deck+.5);
        expect(p.deck-ahead).toBeGreaterThanOrEqual(RUN_DROP);
      });
      it('parks the glider model on the same deck, nose along the run-off, clear of the stand and the stair',()=>{
        const f=[Math.sin(p.prop.yaw),Math.cos(p.prop.yaw)];
        expect(p.prop.yaw).toBe(p.heading);
        // The keel to within 0.5 m of the nose (1.1 of its 1.6) stands on the deck; a parked nose may reach over the rail.
        for(const [along] of [[0],[1.1]] as const){const s=geo.surface(p.prop.x+f[0]!*along,p.prop.z+f[1]!*along,p.deck+.5);expect(s&&Math.abs(s.y-p.deck)).toBeLessThan(.05);}
        expect(p.prop.y).toBeCloseTo(p.deck,2);
        expect(distanceToParkedGlider([p.stand.x,p.stand.z],p.prop)).toBeGreaterThanOrEqual(1.2);
        for(const end of clear.filter(e=>Math.hypot(e[0]-p.stand.x,e[1]-p.stand.z)<12))expect(distanceToParkedGlider(end,p.prop)).toBeGreaterThanOrEqual(1);
      });
    });
  });
  it('the Guide\'s stand needs no deck geometry (a pad whose chunk has not arrived) and stands where the resident one does',()=>{
    const bare=createHorizonGeography(decodeTerrainAsset(terrain,'full'),{...cuts,solids:[]});
    for(const pad of GLIDER_PADS){
      const s=gliderPadStand(world,pad.id,(x,z)=>bare.ground(x,z))!,full=placementsFor(tiers[0]!.geo).find(p=>p?.id===pad.id)!;
      expect([s.stand.x,s.stand.y,s.stand.z]).toEqual([full.stand.x,full.stand.y,full.stand.z]);
      // The heading needs the deck and the Crown's Mountain v2 ground (bare terrain can read the run-off backwards), so the
      // runtime recomputes the stand when the Guide is used; only the stand's position is promised without them.
    }
  });
  it('the hint fires within 25 m of a pad (3D), never from under the Prow tower',()=>{
    const stands=placementsFor(tiers[0]!.geo) as GliderPadPlacement[];
    const crown=stands.find(p=>p.id==='crown')!,prow=stands.find(p=>p.id==='prow')!;
    expect(gliderPadNear(stands,{x:crown.stand.x+10,y:crown.stand.y-5,z:crown.stand.z})?.id).toBe('crown');
    expect(gliderPadNear(stands,{x:prow.stand.x,y:56.75,z:prow.stand.z})).toBeNull();   // the ground under the tower is 43 m below the deck
    expect(gliderPadNear(stands,{x:1455,y:12,z:1175})).toBeNull();
  });
});

describe('dead offers are not rendered',()=>{
  const geo=tiers[0]!.geo,deps={world,geography:geo,manifest:HORIZON_MANIFEST,reducedMotion:false,calm:false,tier:'full'} as MoverDeps;
  const stub=(id:'glider'|'parachute')=>():ModeController=>({id} as unknown as ModeController);
  it('the Prow offers only the glider: its zip "clip in" stays in the data with no controller',()=>{
    const registry=createMoverRegistry(deps);registry.register('glider',stub('glider'));registry.register('parachute',stub('parachute'));
    const prow=world.thresholds.find(t=>t.id==='prowPlatform')!,body={x:prow.at[0],y:prow.height!,z:prow.at[1],yaw:0};
    expect(registry.offers(body).map(o=>o.to).sort()).toEqual(['glider','zip']);   // the data keeps zip for its controller
    expect(liveTravelOffers(registry,body).map(o=>o.id)).toEqual(['prowPlatform:feet→glider']);
  });
  it('a mode whose controller is not registered (yet) never offers a button, and appears once it is',()=>{
    const registry=createMoverRegistry(deps),crown=world.thresholds.find(t=>t.id==='crownLaunch')!,body={x:crown.at[0],y:crown.height!,z:crown.at[1],yaw:0};
    expect(registry.offers(body).length).toBeGreaterThan(0);expect(liveTravelOffers(registry,body)).toEqual([]);
    registry.register('glider',stub('glider'));expect(liveTravelOffers(registry,body).map(o=>o.to)).toEqual(['glider']);
  });
  it('every world threshold offered on foot is either live or names a mode with no controller in the runtime',()=>{
    // The runtime registers board, bicycle, cruiser, gondola, funicular, boats, glider and parachute; zip, cart, balloon and ferry have none.
    const registered=['board','bicycle','cruiser','gondola','funicular','kayak','dinghy','motorboat','yacht','glider','parachute'] as const;
    const registry=createMoverRegistry(deps);for(const id of registered)registry.register(id,()=>({id} as unknown as ModeController));
    for(const t of world.thresholds){if(t.carried)continue;const body={x:t.at[0],y:t.height??geo.ground(t.at[0],t.at[1]),z:t.at[1],yaw:0};
      for(const o of registry.offers(body).filter(o=>o.thresholdId===t.id)){const live=liveTravelOffers(registry,body).some(l=>l.id===o.id);expect(live,`${o.id}`).toBe((registered as readonly string[]).includes(o.to));}}
  });
});

describe('the Guide refuses safely',()=>{
  const free={riding:false,airborne:false,kitchen:false,monorail:false,seated:false,sitting:false,skating:false};
  it('only a free walker may be taken to a pad',()=>{
    expect(gliderPadRefusal(free)).toBeNull();
    for(const key of Object.keys(free) as (keyof typeof free)[])expect(gliderPadRefusal({...free,[key]:true}),key).toMatch(/first|before/);
  });
});

describe('the parked glider model',()=>{
  it('is the flight greybox standing on its base bar, non-colliding, lite without the A-frame, the tail light only at night',()=>{
    const full=createParkedGlider('classic','full'),lite=createParkedGlider('newfoundland','lite');
    expect(full.root.getObjectByName('greybox.glider.sail')).toBeTruthy();expect(full.root.getObjectByName('greybox.glider.baseBar')).toBeTruthy();
    expect(lite.root.getObjectByName('greybox.glider.baseBar')).toBeUndefined();
    const box=new THREE.Box3().setFromObject(full.root);expect(box.min.y).toBeGreaterThanOrEqual(-.05);expect(box.min.y).toBeLessThan(.2);   // the base bar on the deck
    const card=full.root.getObjectByName('tailLight.card')!;expect(card.visible).toBe(false);full.setNight(true);expect(card.visible).toBe(true);
    full.dispose();lite.dispose();
  });
  it('shows near and resident, hides while flown from that pad, far, or on the island map; rebuilt on a theme change; gone on dispose',()=>{
    const scene=new THREE.Scene(),placements=placementsFor(tiers[0]!.geo) as GliderPadPlacement[];
    const pads=createGliderPads(scene,world,id=>placements.find(p=>p.id===id)??null,{theme:'classic',tier:'full'});
    const crown=placements.find(p=>p.id==='crown')!,root=()=>scene.children.find(c=>c.userData.gliderPad==='crown')!;
    pads.update(crown.stand,null,true,()=>false,false);expect(root()).toBeUndefined();   // not resident: nothing built
    pads.update(crown.stand,null,true,()=>true,false);expect(root().visible).toBe(true);
    expect(root().position.toArray()).toEqual([crown.prop.x,crown.prop.y,crown.prop.z]);
    pads.update(crown.stand,'crownLaunch',true,()=>true,false);expect(root().visible).toBe(false);
    pads.update(crown.stand,null,false,()=>true,false);expect(root().visible).toBe(false);
    pads.update({x:crown.stand.x+GLIDER_PAD_DRAW_RADIUS+1,z:crown.stand.z},null,true,()=>true,false);expect(root().visible).toBe(false);
    pads.update(crown.stand,null,true,()=>true,true);expect(root().visible).toBe(true);
    const before=root();pads.setTheme('taylor');expect(root()).not.toBe(before);
    pads.update(crown.stand,null,true,()=>true,false);expect(root().visible).toBe(true);
    pads.dispose();expect(scene.children.some(c=>c.userData.gliderPad)).toBe(false);
  });
});
