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
