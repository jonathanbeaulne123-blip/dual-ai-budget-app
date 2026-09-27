import {describe,expect,it} from 'vitest';
import {HORIZON_MANIFEST,parseHorizonManifest,requireScaleFactor} from '../src/harbour/horizon/world/manifest.ts';

const manifest=HORIZON_MANIFEST;
describe('Horizon manifest v2.0',()=>{
  it('uses Jonathan’s confirmed full scale while rejecting an unconfirmed bake',()=>{
    expect(parseHorizonManifest(manifest)).toBe(manifest);
    expect(manifest.scale.factor).toBe(1);
    expect(requireScaleFactor()).toBe(1);
    expect(()=>requireScaleFactor({...manifest,scale:{...manifest.scale,status:'recommended'}})).toThrow('D13 open');
    expect(()=>parseHorizonManifest({...manifest,scale:{status:'recommended'}})).toThrow('Invalid Horizon manifest');
    expect(manifest.journeys.at_active_scale).toEqual(manifest.journeys.at_factor_1_0);
    expect(manifest.journeys.targets_s['square→library by bicycle']).toBe(185);
    expect(manifest.journeys.at_active_scale['square→library by bicycle'].time_s).toBeLessThanOrEqual(185);
    expect(manifest.journeys.targets_v1_6['square→library by bicycle']).toBe(150);
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
    expect(manifest.viewRule.landscape).toContain('target');
    expect(manifest.viewRule.portrait).toContain('45°');
    for(const view of manifest.views){expect(view.portrait.fov_deg).toBeGreaterThanOrEqual(45);expect(Number.isFinite(view.target_h)).toBe(true);}
    for(const view of manifest.views){expect(view.target).toHaveLength(2);expect(view.fov_deg).toBeGreaterThan(0);expect(view.radius_eu).toBeGreaterThan(0);}
  });
  it('registers every Stage A intersection with a proof class and keeps the reserved rows authored (v1.8; decided v2.0)',()=>{
    const rows=manifest.crossings as unknown as {a:string;b:string;resolution:string;kind?:string;source?:string;reserved?:string}[];
    expect(rows.every(r=>['crossing','junction','sharedStretch','footway','waterBody','waterConfluence','modeTransfer'].includes(r.kind!))).toBe(true);
    // v2.0: Jonathan's 2026-09-27 rulings decided every reserved row but the Hollow neck (#7, now D-C10); ZIP x G1 is
    // "under" (D-A2) and VG x walk garden is "over" on gardenWalkBridge (D-A7). The data changed by ruling, not by test.
    expect(rows.filter(r=>r.reserved).map(r=>`${r.a} x ${r.b} ${r.resolution} ${r.reserved}`)).toEqual(['S4 x walk garden threshold D-C10']);
    const decided=rows as unknown as {a:string;b:string;resolution:string;decided?:string}[];
    expect(decided.filter(r=>r.decided?.startsWith('D-A')).map(r=>`${r.a} x ${r.b} ${r.resolution}`).sort()).toEqual(['FERRY x bightBridge under','S1 x damPortage threshold','S4 x VG threshold','S4 x walk garden threshold','V01 x walk bightPier threshold','V01+S2 x Bight mouth over','VG x walk garden over','ZIP x G1 under']);
    const host=manifest.hosts.find(h=>h.id==='glasshouse')!;expect(host.footprint_m).toEqual([25,18]);expect(host.xy).toEqual([1007.5,790]);
    const gate=manifest.sky.gates.find(g=>g.id==='highSpan')!;expect([gate.h,...(gate.aperture_m ?? [])]).toEqual([17,40,12]);
    const views=manifest.views as unknown as {id:string;subjects:string[];portrait?:{frames:string[]}}[];
    expect(views.find(v=>v.id==='A')!.subjects).not.toContain('the Crown');expect(views.find(v=>v.id==='D')!.portrait!.frames).not.toContain('the Lamp');
  });
  it('preserves coordination notes without hiding the shared Deep plan point',()=>{
    const crossing=manifest.crossings.find(row=>row.a==='S4'&&row.b==='VBS');
    expect(crossing).toMatchObject({at:[874,941],resolution:'threshold',district:'green'});
    expect(crossing?.districtNote).toContain('unless pass 1');
    const retired=manifest.routePairNotes.filter(row=>(row as {kind?:string}).kind==='retired register row (v1.8)');
    // v1.9 (W3-A): 45 bake rows without a plan hit in the v1.9 build (or duplicates) + 3 authored rows whose routes moved.
    const retired19=manifest.routePairNotes.filter(row=>(row as {kind?:string}).kind==='retired register row (v1.9)');
    expect(retired19).toHaveLength(48);
    expect(retired19.filter(row=>!(row as {retiredRow?:{source?:string}}).retiredRow?.source).map(row=>`${row.a} x ${row.b}`).sort()).toEqual(['DEEP_RUN x walk prow','S2 x walk bightPier','walk bightPier x water wash']);
    // v2.0: 19 rows retired by the rulings (1 D-A1, 12 D-A3, 4 D-C7, 2 D-C11), each with its reason.
    const retired20=manifest.routePairNotes.filter(row=>(row as {kind?:string}).kind==='retired register row (v2.0)');
    expect(retired20).toHaveLength(19);
    expect(retired20.filter(row=>/marketRamp/.test(`${row.a} ${row.b}`))).toHaveLength(2);
    expect(manifest.routePairNotes.length-retired.length-retired19.length-retired20.length).toBe(2);
    // v1.8: the nine stale register rows without a plan intersection (R1-11) are retired here with their reason.
    expect(retired.map(row=>`${row.a} x ${row.b}`).sort()).toEqual(['S1 finish x V01','S2 x V01','S3 x V01','S3 x town quay','S3 x walk dune','S4 x spur studio','ZIP x town','plane x everything','walk reach x VG']);
    expect(manifest.routePairNotes.find(row=>row.a==='DEEP_RUN'&&row.b==='ORE')).toMatchObject({
      kind:'shared-plan-point',sharedPlanPoints:[[1300,420]],
    });
    for(const note of manifest.routePairNotes)expect(note).not.toHaveProperty('resolution');
  });
  it('carries Jonathan’s 2026-09-27 rulings as numbers (v2.0)',()=>{
    const m=manifest as unknown as Record<string,any>;
    expect(m.version).toBe('2.0');
    // D-A1: 245 m, one 36 m steel arch at s 98-134, 11.4 clear; an 8 m hull at 46° needs 32.0 m of the 34 m clear.
    const bb=m.structures.bightBridge;expect(bb.span_m).toBe(245);expect(bb.v1_9.span_m).toBe(230);
    expect(bb.opening).toMatchObject({at_s:[98,134],width_m:36,kind:'steel-arch',clearWidth_m:34});expect(bb.opening.clear_eu).toBeGreaterThanOrEqual(11.4);
    expect(m.water_routes.FERRY.beam_m).toBe(8);
    const need=(w:number,deg:number)=>8/Math.sin(deg*Math.PI/180)+w/Math.tan(deg*Math.PI/180);
    expect(need(bb.section.width_m,46)).toBeLessThanOrEqual(bb.opening.clearWidth_m-2);expect(bb.opening.needAlongAxis_m.at_46deg).toBeCloseTo(need(bb.section.width_m,46),1);
    expect(bb.s2Flyover.clear_eu).toBeGreaterThanOrEqual(5);expect(bb.lookout.size_m).toEqual([24,7.2]);
    // S2 is continuous over the deck with >= 2 trick spots on the bridge's own structure, each with a ground line and no jump.
    const spots=m.skate.S2.spots as {id:string;kind:string;on:string;groundLine:string;requiredJump:boolean}[];
    expect(spots.filter(x=>/bightBridge/.test(x.on)).length).toBeGreaterThanOrEqual(2);
    for(const x of spots){expect(['rail','kerb','wall','bollard','stair','bank lip']).toContain(x.kind);expect(x.groundLine.length).toBeGreaterThan(0);expect(x.requiredJump).toBe(false);}
    expect(m.skate.S2.westRamp.grade_pct).toBeLessThanOrEqual(m.profiles.skateMain.grade_max_pct);expect(m.skate.S2.eastDescent.grade_pct).toBeLessThanOrEqual(14);
    // D-A3: station [1335,535] deck 150, towers 120-200 apart and no authored height, summit target 205 (was 375).
    const g=m.cable.G1;expect(g.to).toEqual([1335,535]);expect(g.toH).toBe(150);expect(g.towers).toHaveLength(3);
    const d=[0,...g.towerDistances_m,Math.hypot(g.to[0]-g.from[0],g.to[1]-g.from[1])];
    for(let i=1;i<d.length;i++){expect(d[i]-d[i-1]).toBeGreaterThanOrEqual(m.profiles.cable.towerSpacing_m[0]);expect(d[i]-d[i-1]).toBeLessThanOrEqual(m.profiles.cable.towerSpacing_m[1]);}
    for(const t of g.towers)expect(t).toHaveLength(2);
    expect(m.structures.gondolaStations.crownStation).toEqual([1335,535]);expect(m.walks.crownFromGondola.pts[0]).toEqual([1335,535]);
    expect(manifest.journeys.targets_s['square→summit by gondola + walk']).toBe(205);expect(m.journeys.targets_v1_9['square→summit by gondola + walk']).toBe(375);
    expect(manifest.journeys.at_active_scale['square→summit by gondola + walk'].time_s).toBeLessThanOrEqual(205);
    // D-A4 gallery at candidate A; D-A5 the glass-face card; D-A8 November on the Prow top; D-C11 stairs only.
    expect(m.structures.prowTunnel).toMatchObject({xy:[1592,890],kind:'gallery',length_m:90});
    expect(m.lights.find((l:{id:string})=>l.id==='dam.glassFace').on).toContain('golden hour');
    expect(m.journey.stations.find((s:{id:string})=>s.id==='nov')).toMatchObject({xy:[1626,904],pad_rot_deg:90});
    expect(m.structures.marketStair.stepFree.length_eu).toBe(295);expect(JSON.stringify(manifest.crossings)).not.toContain('marketRamp');
    // Group B/C: K re-posed, H at golden hour, the Throat's built aperture, L01 on the slab, plot bight.1 off the paths.
    const views=manifest.views as unknown as {id:string;xy:number[];target:number[];bestHour:string}[];
    expect(views.find(v=>v.id==='K')).toMatchObject({xy:[994,770],target:[1120,815]});expect(views.find(v=>v.id==='H')!.bestHour).toBe('golden hour');
    expect(m.underground.doors.throat.collarAperture_m).toBe(10.8);expect(manifest.places.find(p=>p.id==='L01')!.xy).toEqual([1173,912]);
    expect(manifest.reserves.bightShore.plots[0]).toEqual([814,919]);
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
