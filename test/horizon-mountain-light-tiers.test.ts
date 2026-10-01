import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {lampsForTier,selectLiteLamps} from '../src/harbour/horizon/land/corridor/lights';
import {mountainLightTargets} from '../src/harbour/horizon/land/corridor/mountain';
import {createCorridorArt} from '../src/harbour/horizon/runtime/corridorArt';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition';

const world=JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json','utf8')) as WorldDefinition;
const mountain=world.corridors!.find(c=>c.id==='mountainV2.road')!;

describe('Mountain lite keeps its night cues with whole authored lamps',()=>{
 it('covers every bend, entrance, endpoint and garden stop within an actual 12 m pool in both tiers',()=>{
  const targets=[...mountainLightTargets(mountain.stations),...mountain.stops.map(s=>[s.at[0],s.at[2]] as const)];
  const lite=lampsForTier(mountain,'lite');
  expect(new Set(mountain.liteLampIds).size).toBe(mountain.liteLampIds!.length);
  // Both tiers may retain the same minimum safety set; lite still subtracts
  // secondary kit details. Removing a required fixture is never a budget fix.
  expect(lite.length).toBeLessThanOrEqual(mountain.lamps.length);expect(lite.length).toBeGreaterThan(0);
  for(const lamp of lite)expect(mountain.lamps).toContain(lamp);
  for(const theme of ['classic','taylor','newfoundland'] as const)for(const tier of ['full','lite'] as const){
   const art=createCorridorArt({...world,corridors:[mountain]},{theme,tier});
   try{
    // Runtime includes the real garden fixture; legacy threshold/bead anchors
    // are absent here and cannot masquerade as road-lantern pool coverage.
    const anchors=art.lampAnchors();
    expect(anchors.some(a=>a.id==='mountainV2.stop.library-garden.lamp')).toBe(true);
    for(const p of targets){
     expect(anchors.some(a=>a.pool&&a.poolRadius===12&&Math.hypot(p[0]-a.pool[0],p[1]-a.pool[2])<=a.poolRadius),`${theme}/${tier} target ${p}`).toBe(true);
    }
   }finally{art.dispose();}
  }
  for(const lamp of mountain.lamps.filter(l=>l.kind!=='roadLantern'))expect(lite).toContain(lamp);
 });
 it('rejects an uncovered full-tier target instead of widening the accepted pool',()=>{
  expect(()=>selectLiteLamps(mountain.lamps,[[1e6,1e6]])).toThrow('no full-tier pool coverage');
  expect(()=>selectLiteLamps([],[[0,0]])).toThrow('no full-tier pool coverage');
 });
 it('builds precisely the retained lamp heads in all three themes, without replacing lamp definitions',()=>{
  const before=JSON.stringify(mountain);
  for(const theme of ['classic','taylor','newfoundland'] as const){
   const art=createCorridorArt({...world,corridors:[mountain]},{theme,tier:'lite'});
   const heads=new Set(art.lampHeads().map(l=>l.id));
   for(const lamp of mountain.lamps)expect(heads.has(lamp.id)).toBe(mountain.liteLampIds!.includes(lamp.id));
   art.dispose();
  }
  expect(JSON.stringify(mountain)).toBe(before);
  expect(lampsForTier(mountain,'full')).toBe(mountain.lamps);
  const withoutSelection={lamps:mountain.lamps};expect(lampsForTier(withoutSelection,'lite')).toBe(mountain.lamps);
 });
});
