import {describe,expect,it} from 'vitest';
import {HORIZON_MANIFEST,parseHorizonManifest,requireScaleFactor} from '../src/harbour/horizon/world/manifest.ts';

const manifest=HORIZON_MANIFEST;
describe('Horizon manifest v1.6',()=>{
  it('uses Jonathan’s confirmed full scale while rejecting an unconfirmed bake',()=>{
    expect(parseHorizonManifest(manifest)).toBe(manifest);
    expect(manifest.scale.factor).toBe(1);
    expect(requireScaleFactor()).toBe(1);
    expect(()=>requireScaleFactor({...manifest,scale:{...manifest.scale,status:'recommended'}})).toThrow('D13 open');
    expect(()=>parseHorizonManifest({...manifest,scale:{status:'recommended'}})).toThrow('Invalid Horizon manifest');
    expect(manifest.journeys.at_active_scale).toEqual(manifest.journeys.at_factor_1_0);
    expect(manifest.journeys.targets_s['square→library by bicycle']).toBe(150);
    expect(manifest.journeys.at_active_scale['square→library by bicycle'].time_s).toBeGreaterThan(150);
  });
  it('has the authored ids and counts without treating the two lake places as hosts',()=>{
    expect(manifest.hosts).toHaveLength(7);
    const harbourIds=new Set([...manifest.hosts.flatMap(host=>host.placeIds),...manifest.places.map(place=>place.id)]);
    expect(harbourIds).toEqual(new Set(['court','campfire','kitchen','tower','cellar','atlas','bank','library','glasshouse','kiln','cottage','boathouse','L01','L02']));
    expect(manifest.districts).toHaveLength(13);
    expect(manifest.neighbourhoods).toHaveLength(7);
    expect(manifest.views).toHaveLength(12);
    expect(manifest.sky.gates).toHaveLength(12);
    expect(['S1','S2','S3','S4'].every(id=>Object.hasOwn(manifest.skate,id))).toBe(true);
    expect(manifest.reserves.terraces.plots).toEqual([[1552,832],[1528,896],[1512,952]]);
    expect(manifest.reserves.terraces.rot_deg).toEqual([-67,23,23]);
    expect(manifest.reserves.terraces.placeIds).toEqual(['plot.terraces.1','plot.terraces.2','plot.terraces.3']);
    expect(manifest.reserves.bightShore.plots).toHaveLength(4);
    expect(Object.keys(manifest.reserves.small)).toHaveLength(2);
    const ids=[...manifest.reserves.terraces.placeIds,...manifest.reserves.bightShore.placeIds,
      ...Object.values(manifest.reserves.small).map(reserve=>reserve.placeId)];
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
    expect(ids).not.toContain('plot.terraces.4');
    expect(manifest.reserves.retiredPlaceIds).toEqual(['plot.terraces.4']);
  });
  it('carries the geometry and naming rules needed by the land pass',()=>{
    for(const key of ['districts','landforms','roads','skate','structures','water','journey','pastimes'])expect(manifest.names).toHaveProperty(key);
    expect(manifest.names.idRule).toContain('camelCase');
    for(const crossing of manifest.crossings)expect(['over','under','threshold']).toContain(crossing.resolution);
    for(const threshold of manifest.thresholds)for(const mode of threshold.modes)expect(mode).toMatch(/^[^→]+(?:→[^→]+)+$/);
    expect(manifest.thresholds.find(threshold=>threshold.id==='damPortage')?.modes).toEqual(['canoe→feet→canoe']);
    expect(manifest.reserves.rotRule).toContain('rot_deg');
    for(const reserve of [manifest.reserves.terraces,manifest.reserves.bightShore]){
      expect(reserve.rot_deg).toHaveLength(reserve.plots.length);
      expect(reserve.placeIds).toHaveLength(reserve.plots.length);
      reserve.rot_deg.forEach(angle=>expect(Number.isFinite(angle)).toBe(true));
    }
    expect(manifest.hostRule).toContain('footprint_m');
    expect(manifest.hostRule).toContain('roofH_eu');
    for(const host of manifest.hosts){expect(host.footprint_m).toHaveLength(2);expect(Number.isFinite(host.roofH_eu)).toBe(true);}
    expect(manifest.viewRule).toContain('target');
    for(const view of manifest.views){expect(view.target).toHaveLength(2);expect(view.fov_deg).toBeGreaterThan(0);expect(view.radius_eu).toBeGreaterThan(0);}
  });
  it('preserves coordination notes without hiding the shared Deep plan point',()=>{
    const crossing=manifest.crossings.find(row=>row.a==='S4'&&row.b==='VBS');
    expect(crossing).toMatchObject({at:[874,941],resolution:'threshold',district:'green'});
    expect(crossing?.districtNote).toContain('unless pass 1');
    expect(manifest.routePairNotes).toHaveLength(2);
    expect(manifest.routePairNotes.find(row=>row.a==='DEEP_RUN'&&row.b==='ORE')).toMatchObject({
      kind:'shared-plan-point',sharedPlanPoints:[[1300,420]],
    });
    for(const note of manifest.routePairNotes)expect(note).not.toHaveProperty('resolution');
  });
  it.each(['n/a','bridge',''])('rejects unresolved crossing resolution %j on load',resolution=>{
    expect(()=>parseHorizonManifest({...manifest,crossings:[{...manifest.crossings[0],resolution}]})).toThrow('Invalid Horizon crossing');
  });
  it('rejects nonnumeric crossing points and metadata disguised as a resolution',()=>{
    expect(()=>parseHorizonManifest({...manifest,crossings:[{...manifest.crossings[0],at:[NaN,0]}]})).toThrow('Invalid Horizon crossing');
    expect(()=>parseHorizonManifest({...manifest,crossings:[{...manifest.crossings[0],at:''}]})).toThrow('Invalid Horizon crossing');
    expect(()=>parseHorizonManifest({...manifest,routePairNotes:[{...manifest.routePairNotes[0],resolution:'over'}]})).toThrow('Invalid Horizon route-pair note');
  });
  it.each(['canoe→','→feet','canoe→→feet','canoe→  →feet','canoe'])('rejects incomplete mode sequence %j',mode=>{
    expect(()=>parseHorizonManifest({...manifest,thresholds:[{...manifest.thresholds[0],modes:[mode]}]})).toThrow('Invalid Horizon threshold mode sequence');
  });
  it('rejects misaligned reserve data and retired IDs',()=>{
    const terraces=manifest.reserves.terraces;
    for(const broken of [{...terraces,rot_deg:[0]},{...terraces,placeIds:['plot.terraces.1']},
      {...terraces,placeIds:['plot.terraces.1','plot.terraces.2','plot.terraces.4']}]){
      expect(()=>parseHorizonManifest({...manifest,reserves:{...manifest.reserves,terraces:broken}})).toThrow(/Invalid Horizon reserve/);
    }
    for(const placeId of ['plot.terraces.1','plot.terraces.4']){
      expect(()=>parseHorizonManifest({...manifest,reserves:{...manifest.reserves,
        small:{...manifest.reserves.small,sealedDrift:{...manifest.reserves.small.sealedDrift,placeId}},
      }})).toThrow('Invalid Horizon small reserve');
    }
  });
});

describe('Horizon manifest v1.7 (RIDE §8.3, D40, D42)',()=>{
  const paces=manifest.paces as unknown as Record<string,{roll:number|null;pushGrip:number|null}>;
  const surfaces=manifest.surfaces as unknown as Record<string,{pace:string;grip:number|null}>;
  it('is version 1.7, dated, and says what changed',()=>{
    expect(manifest.version).toBe('1.7');
    expect(manifest.date).toBe('2026-09-26');
    expect(manifest.status).toContain('v1.7: paces and surface grip (RIDE D42)');
  });
  it('gives every surface a numeric grip except duff, which is never a bed',()=>{
    const expected:Record<string,number|null>={paved:1,packedEarth:.95,ochre:.85,apron:1,bankedTurf:1.1,boardwalk:.9,cobble:.7,gravel:.6,sand:.5,plaza:1,snow:.4,ice:.2,duff:null,stone:1};
    expect(Object.keys(surfaces)).toHaveLength(14);
    expect(new Set(Object.keys(surfaces))).toEqual(new Set(Object.keys(expected)));
    for(const [id,row] of Object.entries(surfaces)){
      if(id==='duff'){expect(row.grip).toBeNull();expect(row.pace).toBe('n/a');continue;}
      expect(typeof row.grip,id).toBe('number');expect(Number.isFinite(row.grip),id).toBe(true);expect(row.grip,id).toBe(expected[id]);
    }
  });
  it('gives pads, station slabs and the park a stone row that grips like pavement',()=>{
    expect(surfaces.stone).toEqual({pace:'threshold',footstep:'stone',grip:1,note:'threshold pads, station slabs and the Tideline park'});
  });
  it('carries the six paces with their roll and push grip',()=>{
    expect(Object.keys(paces).sort()).toEqual(['fast','flow','n/a','skate','slow','threshold']);
    expect(paces.fast).toMatchObject({roll:.12,pushGrip:1});
    expect(paces.flow).toMatchObject({roll:.25,pushGrip:.9});
    expect(paces.slow).toMatchObject({roll:.6,pushGrip:.8});
    expect(paces.threshold).toMatchObject({roll:1.8,pushGrip:.5});
    expect(paces.skate).toMatchObject({roll:.03,pushGrip:null});
    expect(paces['n/a']).toMatchObject({roll:null,pushGrip:null});
    expect((manifest.paces['n/a'] as {note:string}).note).toContain('offbed');
  });
  it('resolves every surface default pace and every skate segment pace to a paces row',()=>{
    for(const [id,row] of Object.entries(surfaces))expect(Object.hasOwn(paces,row.pace),id).toBe(true);
    for(const id of ['S1','S2','S3','S4'] as const)for(const segment of manifest.skate[id].segments){
      expect(Object.hasOwn(paces,segment.pace),`${id} ${segment.name}`).toBe(true);
      expect(Object.hasOwn(surfaces,segment.surface),`${id} ${segment.name}`).toBe(true);
    }
  });
  it('makes the park forgiving rather than assisted, and keeps the v1.6 numbers',()=>{
    expect(manifest.skate.park.note).toBe('Skate v2 park; forgiving landings only (RIDE D40); no race');
    expect(manifest.skate.park).toMatchObject({xy:[1020,1430],size:[60,32]});
    expect(manifest.speeds_ms.board).toBe(7);
    expect(manifest.skate.S1.segments.map(s=>[s.pace,s.surface])).toEqual([['fast','paved'],['flow','bankedTurf'],['flow','apron'],['fast','paved'],['slow','cobble'],['fast','paved']]);
    expect(manifest.skate.S3.segments[2]).toMatchObject({name:'The square',pace:'threshold',surface:'plaza'});
  });
});
