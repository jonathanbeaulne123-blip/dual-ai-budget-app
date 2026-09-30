import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildLandCuts} from '../src/harbour/horizon/land/beds/build.ts';
import {baseHeight,sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {buildThresholds,buildWorldLines} from '../src/harbour/horizon/world/build.ts';
import {mountainRoadChain} from '../src/harbour/horizon/land/corridor/chain.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2/index.ts';
import {createBoardContact} from '../src/harbour/horizon/movers/shared/ground/contact.ts';
import {BICYCLE_PROFILE} from '../src/harbour/horizon/movers/bicycle/profile.ts';
import {BOARD_PROFILE} from '../src/harbour/horizon/movers/board/profile.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import {bedPath,pointAt} from '../src/harbour/horizon/movers/board/situations.ts';
import type {LandCuts} from '../src/harbour/horizon/land/interfaces.ts';
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const baked=parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),field=decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')),'full');
// One source build proves the actual publication site, independently of stale baked metadata.
const source=buildLandCuts(baseHeight),cuts={...baked.collision,beds:source.beds,solids:baked.geometry.solids,diagnostics:[]} satisfies LandCuts;
const world={...baked,beds:source.beds,collision:cuts,thresholds:buildThresholds(field,cuts,baked.crossingProofs)};
const geography=createHorizonGeography(field,cuts);geography.addDynamic(createMountainV2Region({horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:terraceBedExclusion(world.collision.beds),exclude:mouthExclusion(world.collision.mouths),terrainStep:field.step}).provider);
const bike=createBoardContact(geography,world,M,BICYCLE_PROFILE),board=createBoardContact(geography,world,M,BOARD_PROFILE),withoutMarkers=createBoardContact(geography,{...world,thresholds:[]},M,BICYCLE_PROFILE);
const chain=mountainRoadChain(source.beds)!,part=chain.parts.find(p=>p.id==='mountainV2.footLane')!,path=bedPath({...baked.beds.find(b=>b.id==='V03')!,points:chain.points});
const at=(d:number)=>{const p=pointAt(path,part.from+d),surface=geography.surface(p.x,p.z,p.y,.5)!;return{x:p.x,z:p.z,y:surface.y};};
describe('Mountain through-road source metadata',()=>{
  it('publishes the exact native Foot lane as road metadata without a second floor or terrain cut',()=>{
    const lane=source.beds.find(b=>b.id===part.id)!;
    expect(lane.kind).toBe('road');expect(lane.width).toBe(7);expect(lane.terrainCut).toBe(false);
    expect(lane.points).toEqual(chain.points.filter((_,i)=>chain.widths[i]!.s>=part.from-1e-6&&chain.widths[i]!.s<=part.to+1e-6));
    expect(source.solids.some(s=>s.bedIds.includes(lane.id))).toBe(false);
    expect(buildWorldLines(cuts).find(l=>l.id===lane.id)?.bedIds).toEqual([lane.id]);
  });
  it('keeps all22m of the actual Foot lane bicycle-legal including its previously skate-only reach',()=>{
    for(let d=0;d<=22;d+=.5){const p=at(d),c=bike.sample(p.x,p.z,p.y)!;expect(c.legal).toBe(true);expect(c.pushGrip).toBeGreaterThan(0);}
  });
  it('retains the road surface pace inside joining markers while the joining board retains threshold pace',()=>{
    let checked=0;
    for(let d=0;d<=22;d+=.5){const p=at(d),c=bike.sample(p.x,p.z,p.y)!,pad=bike.padAt(p.x,p.z,p.y);if(!pad?.throughBedIds?.includes(part.id))continue;
      expect(c.pace).toBe(withoutMarkers.sample(p.x,p.z,p.y)!.pace);expect(board.sample(p.x,p.z,p.y)!.pace).toBe('threshold');checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('keeps Stillwater rolling through its three joining pads and the shared Foot pad',()=>{
    const footId='crossing.cross.mountainV2FootLane.mountainV2Road.1';
    const ids=['crossing.cross.spurCottage.spurStillwater.1','crossing.cross.spurStillwater.yearWalk.2','crossing.cross.spurStillwater.yearWalk.3',footId];
    // Three independently proved crossings at the exact common endpoint reuse one
    // physical pad; its id names the native routes, not every route it carries.
    const foot=world.collision.pads.find(p=>p.id===footId)!;
    for(const crossingId of ['cross.mountainV2Road.spurStillwater.1','cross.s1.spurStillwater.1','cross.mountainV2FootLane.spurStillwater.1']){
      const proof=baked.crossingProofs.find(p=>p.id===crossingId)!;
      expect(proof,crossingId).toMatchObject({padId:footId,resolution:'threshold',built:true,clearancePass:true});
      expect(proof.at,crossingId).toEqual([foot.centre[0],foot.centre[2]]);
      // The full native curve starts at54.649977 while the authored Foot anchor
      // is54.65. The shared pad uses their mean: prove the23-micrometre seam,
      // rather than requiring the old millimetre-rounded export's false equality.
      expect(Math.abs(proof.heightA-foot.centre[1]),crossingId).toBeLessThan(.00003);
      expect(Math.abs(proof.heightB-foot.centre[1]),crossingId).toBeLessThan(.00003);
      expect(proof.separation,crossingId).toBeLessThan(.00003);
    }
    const linkStart=source.beds.find(b=>b.id==='spur stillwater')!.points[0]!;
    expect([linkStart[0],linkStart[2]]).toEqual([foot.centre[0],foot.centre[2]]);
    expect(Math.abs(linkStart[1]-foot.centre[1])).toBeLessThan(.00003);
    // The higher Year Walk crossing shares the pad id but fails clearance. It
    // must never become the reason the through-road exemption is published.
    const higher=baked.crossingProofs.find(p=>p.id==='cross.spurStillwater.yearWalk.1')!;
    expect(higher).toMatchObject({padId:footId,built:false,clearancePass:false});
    expect(world.thresholds.filter(t=>t.throughBedIds?.includes('spur stillwater')).map(t=>t.id).sort()).toEqual([...ids].sort());
    for(const id of ids){
      const threshold=world.thresholds.find(t=>t.id===id)!,pad=world.collision.pads.find(p=>p.id===threshold.padId)!;
      const p=pad.centre,surface=geography.surface(p[0],p[2],p[1],.5)!,contact=bike.sample(p[0],p[2],surface.y)!;
      if(id===footId){
        // The visible Year Walk gravel shoulder can be the top floor at this
        // shared pad (54.732501m in the full-curve fixture). Through metadata
        // removes threshold drag; it must not relabel that real surface paved.
        const ordinary=withoutMarkers.sample(p[0],p[2],surface.y)!;
        expect(contact,id).toMatchObject({legal:true,material:surface.material,pace:ordinary.pace,roll:ordinary.roll,pushGrip:ordinary.pushGrip});
        expect(contact.pace,id).not.toBe('threshold');
        expect(['mountainV2.road','mountainV2.footLane','spur stillwater']).toContain(contact.bedId);
      }else{
        expect(contact,id).toMatchObject({legal:true,pace:'fast',roll:.12,pushGrip:1});
        expect(contact.bedId,id).toBe('spur stillwater');
      }
      expect(contact.pace,id).toBe(withoutMarkers.sample(p[0],p[2],surface.y)!.pace);
      // The crossing still offers the joining board its deliberate dismount pace.
      expect(board.sample(p[0],p[2],surface.y)!.pace,id).toBe('threshold');
    }
    const onlyFailedFootProof=buildThresholds(field,cuts,baked.crossingProofs.filter(p=>p.padId!==footId||p.id===higher.id));
    expect(onlyFailedFootProof.find(t=>t.padId===footId)!.throughBedIds).not.toContain('spur stillwater');
    const unproved=buildThresholds(field,cuts,baked.crossingProofs.map(p=>p.padId&&ids.includes(p.padId)?{...p,clearancePass:false}:p));
    expect(unproved.some(t=>t.throughBedIds?.includes('spur stillwater'))).toBe(false);
    // Unrelated pads retain exactly their previous through-route metadata.
    for(const t of world.thresholds.filter(t=>!ids.includes(t.id)))expect(unproved.find(q=>q.id===t.id)?.throughBedIds,t.id).toEqual(t.throughBedIds);
  });
  it('preserves the original threshold pace when a marker has no through-road designation',()=>{
    const legacy={...world,thresholds:world.thresholds.map(t=>({...t,throughBedIds:undefined}))},contact=createBoardContact(geography,legacy,M,BICYCLE_PROFILE),p=at(0);
    expect(contact.padAt(p.x,p.z,p.y)).not.toBeNull();expect(contact.sample(p.x,p.z,p.y)!.pace).toBe('threshold');
  });
});
