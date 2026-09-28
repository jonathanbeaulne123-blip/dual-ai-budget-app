// Reconciliation 2 (Stage A candidate 6 × main #554–#559): main's new movers on the Stage A land (MANIFEST v2.5 moverAnchors_v2_5).
import {describe,expect,it} from 'vitest';
import {HORIZON_MANIFEST} from '../src/harbour/horizon/world/manifest.ts';
import {createVessels,launchBody} from '../src/harbour/horizon/movers/fleet/model.ts';
import {resolveTouchdown} from '../src/harbour/horizon/movers/glider/landing.ts';
import {HORIZON_WALKABLE_DEGREES} from '../src/harbour/horizon/runtime/geography.ts';
import {realHorizon} from './fixtures/horizonFlight.ts';

const anchors=(HORIZON_MANIFEST as unknown as {moverAnchors_v2_5:{fleet:{moorings:Record<string,[number,number]>;yacht:[number,number]}}}).moverAnchors_v2_5;
describe('v2.5: the fleet\'s code-owned anchors are the ones the manifest records',()=>{
  it('moorings, the yacht and the launch dock',()=>{
    const v=Object.fromEntries(createVessels().map(v=>[v.id,[v.x,v.z]]));
    for(const id of ['kayak','dinghy','motorboat'])expect(v[id],id).toEqual(anchors.fleet.moorings[id]);
    expect(v.yacht).toEqual(anchors.fleet.yacht);
    const dock=HORIZON_MANIFEST.structures.floatplaneDock as unknown as [number,number];
    expect(Math.hypot(launchBody.x-dock[0],launchBody.z-dock[1])).toBeLessThan(4);
  });
  it('the launch body stands on the floatplane dock, dry (candidate-6 bake)',()=>{
    const {geography:g}=realHorizon(),s=g.surface(launchBody.x,launchBody.z,launchBody.y+.5)!;
    expect(s.id.startsWith('floatplaneDock.')).toBe(true);expect(s.y).toBeCloseTo(1.2,2);
    expect(g.submerged(launchBody.x,launchBody.z,s.y)).toBe(false);
  });
});
describe('v2.5: a fall that ends in water or on unwalkable ground never returns the body to a submerged node',()=>{
  it('every fade on an 80 m grid (water and > 40° ground) lands on a dry surface within 1 m of its node',()=>{
    const {env,geography:g}=realHorizon();let fades=0;const wet:string[]=[];
    for(let x=40;x<2200;x+=80)for(let z=40;z<1800;z+=80){
      const top=g.waterLevel(x,z),s=g.surface(x,z,400),inWater=top!==null&&(!s||top>=s.y);
      if(!inWater&&!(s&&s.slope>HORIZON_WALKABLE_DEGREES))continue;
      const y=inWater?top!:s!.y,o=resolveTouchdown(env.landingContext(y),{x,y,z,mode:'parachute'},{airspeed:5,sink:4,groundSpeed:5,flared:false});
      if(o.kind==='walkoff'||o.kind==='tumble')continue;fades++;
      const at=g.surface(o.at[0],o.at[2],o.at[1]+1);
      if(!at||Math.abs(at.y-o.at[1])>1||g.submerged(o.at[0],o.at[2],at.y))wet.push(`${x},${z} → ${o.kind} ${o.at.map(v=>v.toFixed(1))}`);
    }
    expect(fades).toBeGreaterThan(300);   // measured 400+ on candidate 6 (the 40 m probe: 1,567 fades of 1,618 touchdowns)
    expect(wet).toEqual([]);
  },60000);
});
describe('v2.5 × #559: the galley sails with the yacht and needs the harbour chunk like the fleet',()=>{
  it('the menu board at the moored yacht stands over harbour water, inside the harbour district',async()=>{
    const {toWorld}=await import('../src/harbour/horizon/movers/fleet/model.ts');
    const {KITCHEN_BOARD}=await import('../src/harbour/horizon/kitchen/geometry.ts');
    const {districtAt}=await import('../src/harbour/horizon/world/districts.ts');
    const k=(HORIZON_MANIFEST as unknown as {moverAnchors_v2_5:{kitchen:{board:string}}}).moverAnchors_v2_5.kitchen;
    expect(k.board).toContain('[-2.6, main deck 3.85, -10.6]');
    expect([KITCHEN_BOARD.x,KITCHEN_BOARD.y,KITCHEN_BOARD.z]).toEqual([-2.6,3.85,-10.6]);
    const {geography:g}=realHorizon(),yacht=createVessels().find(v=>v.id==='yacht')!,p=toWorld(yacht as never,KITCHEN_BOARD);
    expect([p.x,p.z].map(v=>+v.toFixed(1))).toEqual([1617.4,1329.4]);   // measured, reconciliation 2 (#559)
    expect(districtAt(p.x,p.z)).toBe('harbour');
    for(const [dx,dz] of [[-7,-22],[7,-22],[-7,22],[7,22]])expect(districtAt(yacht.x+dx,yacht.z+dz)).toBe('harbour');
    expect(g.ground(p.x,p.z)).toBeCloseTo(-12,1);expect(g.waterLevel(p.x,p.z)).toBe(0);
  });
});
