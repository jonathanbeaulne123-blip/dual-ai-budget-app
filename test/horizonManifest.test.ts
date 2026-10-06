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
    expect(manifest.journeys.targets_s['square→library by bicycle']).toBe(243);   // v2.3: planned at the bicycle's 6.0 cap (185 at 8)
    expect(manifest.journeys.at_active_scale['square→library by bicycle'].time_s).toBeLessThanOrEqual(185);
    expect(manifest.journeys.targets_v1_6['square→library by bicycle']).toBe(150);
  });
  it('has the authored ids and counts without treating the two lake places as hosts',()=>{
    expect(manifest.hosts).toHaveLength(7);
    const harbourIds=new Set([...manifest.hosts.flatMap(host=>host.placeIds),...manifest.places.map(place=>place.id)]);
    // V3 (D-M11): nine highland places (no host, no pad money): Glacier Peak, Glacier Springs, Bench Hamlet, Westwatch Chapel, Orchard
    // Bench, the Twin Tarns, Fallswatch, Rim Lookout and High Shieling Ranch.
    const v3=['glacierPeak','glacierSprings','benchHamlet','westwatch','orchardBench','twinTarns','fallswatch','rimLookout','highShieling'];
    expect(harbourIds).toEqual(new Set(['court','campfire','kitchen','tower','cellar','atlas','bank','library','glasshouse','kiln','cottage','boathouse','L01','L02',...v3]));
    for(const id of v3)expect(manifest.hosts.some(h=>h.placeIds.includes(id)),id).toBe(false);
    expect(manifest.districts).toHaveLength(13);
    expect(manifest.neighbourhoods).toHaveLength(7);
    expect(manifest.views).toHaveLength(12);
    expect(manifest.sky.gates).toHaveLength(12);
    expect(['S1','S2','S3','S4'].every(id=>Object.hasOwn(manifest.skate,id))).toBe(true);
    expect(manifest.reserves.terraces.plots).toEqual([[1552,832],[1528,896],[1512,952]]);   // v2.4: terraces.1 back to v2.2 (v2.3's 1.0 m move walled the walk to L02; R3-32 open)
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
    // v2.6 (D-M3): the dam portage is retired with the dam (kept verbatim under retired_v2_6).
    expect(manifest.thresholds.some(threshold=>threshold.id==='damPortage')).toBe(false);
    expect((manifest as unknown as {retired_v2_6:Record<string,{value:{modes:string[]}}>}).retired_v2_6['thresholds.damPortage']!.value.modes).toEqual(['canoe→feet→canoe']);
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
    expect(decided.filter(r=>r.decided?.startsWith('D-A')).map(r=>`${r.a} x ${r.b} ${r.resolution}`).sort()).toEqual(['FERRY x bightBridge under','S4 x VG threshold','S4 x walk garden threshold','V01 x walk bightPier threshold','V01+S2 x Bight mouth over','VG x walk garden over']);   // v2.6: S1 x damPortage (D-M3) and ZIP x G1 (D-M6: v2's gondola no longer meets the zip) are retired
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
  it('carries Jonathan’s 2026-09-27 rulings as numbers (v2.0) and the Wave 5 integration data (v2.1)',()=>{
    const m=manifest as unknown as Record<string,any>;
    expect(m.version).toBe('3.0');   // v3.0 = Mountain V3 (D-M11); v2.6 = Pass 5, Mountain v2 placed (D-M1..D-M10); was '2.4' (candidate 6). v2.2 = v2.1 + main's data-only v1.7 blocks (reconciliation); v2.3 = Wave 7 (W7-A); v2.4 = Wave 7 integrator 4; v2.5 = reconciled with main #554-#558
    // D-A1: 245 m, one steel arch, 11.4 clear; an 8 m hull at 46° needs 32.0 m. Ruled 36 m at s 98-134 (kept as opening.v2_0);
    // v2.1 (design lead, reversible): 40 m at s 103-143, 38 clear - the hull cleared the east pier by -3.99 at 36 m, +1.37 at 40.
    const bb=m.structures.bightBridge;expect(bb.span_m).toBe(245);expect(bb.v1_9.span_m).toBe(230);
    expect(bb.opening).toMatchObject({at_s:[103,143],width_m:40,kind:'steel-arch',clearWidth_m:38});expect(bb.opening.v2_0).toMatchObject({at_s:[98,134],width_m:36,clearWidth_m:34});
    expect(bb.bents['arch piers']).toEqual(bb.opening.at_s);expect(bb.opening.hullClearance_eu.v2_1_40m_s103_143).toBeGreaterThan(0);expect(bb.opening.clear_eu).toBeGreaterThanOrEqual(11.4);
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
    // v2.6 (D-M6): G1 is Mountain v2's gondola; the D-A3 line is kept as cable.G1.v2_5 (checked here as it was ruled).
    const g=m.cable.G1.v2_5;expect(g.to).toEqual([1335,535]);expect(g.toH).toBe(150);expect(g.towers).toHaveLength(3);
    const d=[0,...g.towerDistances_m,Math.hypot(g.to[0]-g.from[0],g.to[1]-g.from[1])];
    for(let i=1;i<d.length;i++){expect(d[i]-d[i-1]).toBeGreaterThanOrEqual(m.profiles.cable.towerSpacing_m[0]);expect(d[i]-d[i-1]).toBeLessThanOrEqual(m.profiles.cable.towerSpacing_m[1]);}
    for(const t of g.towers)expect(t).toHaveLength(2);
    expect(m.structures.gondolaStations.v2_5.crownStation).toEqual([1335,535]);expect(m.retired_v2_6['walks.crownFromGondola'].value.pts[0]).toEqual([1335,535]);
    expect(m.journeys.targets_s['v2_5_square→summit by gondola + walk']).toBe(205);expect(m.journeys.targets_v1_9['square→summit by gondola + walk']).toBe(375);
    // v2.6: the summit journey walks to v2's quay until D-M6b (measured 420.6 s on the v2.6 bake, target 465).
    expect(manifest.journeys.targets_s['square→summit by gondola + walk']).toBe(465);
    // D-A4 gallery at candidate A; D-A5 the glass-face card; D-A8 November on the Prow top; D-C11 stairs only.
    expect(m.structures.prowTunnel).toMatchObject({xy:[1592,890],kind:'gallery',length_m:90});
    expect(m.lights.find((l:{id:string})=>l.id==='dam.glassFace').on).toContain('golden hour');
    expect(m.journey.stations.find((s:{id:string})=>s.id==='nov')).toMatchObject({xy:[1626,904],pad_rot_deg:90});
    expect(m.structures.marketStair.v2_0_stepFree.length_eu).toBe(295);expect(m.structures.marketStair.stepFree).toMatchObject({route:['walk square'],length_eu:94});expect(m.structures.marketStair.stepFree.grade_pct.max).toBeLessThanOrEqual(8);expect(JSON.stringify(manifest.crossings)).not.toContain('marketRamp');
    // Group B/C: K re-posed, H at golden hour, the Throat's built aperture, L01 on the slab, plot bight.1 off the paths.
    const views=manifest.views as unknown as {id:string;xy:number[];target:number[];bestHour:string}[];
    expect(views.find(v=>v.id==='K')).toMatchObject({xy:[994,770],target:[1120,815]});expect(views.find(v=>v.id==='H')!.bestHour).toBe('golden hour');
    expect(m.underground.doors.throat.collarAperture_m).toBe(10.8);expect((manifest.places.find(p=>p.id==='L01') as unknown as {v2_5_xy:number[]}).v2_5_xy).toEqual([1173,912]);   // v2.6 (D-M3): L01 is on Mountain v2's crest (below)
    expect(manifest.reserves.bightShore.plots[0]).toEqual([813,918.8]);   // v2.3: D-D2 nudge 1.0 m (v2.0 [814,919])
    // v2.1 (Wave 5 integration, design lead): the numbers the merged bake measured.
    expect(m.structures.coveStair.to_h).toBe(1.0);expect(m.structures.coveStair.v2_0_to_h).toBe(1.8);
    // v2.6 (D-M6): Mountain v2's gondola no longer meets the zip; the D-A2 row is kept under retired_v2_6.crossings.
    const zip=(m.retired_v2_6.crossings.value as {a:string;b:string}[]).find(r=>r.a==='ZIP'&&r.b==='G1') as unknown as {resolution:string;measured:{separation_eu:number}};expect(zip.resolution).toBe('under');expect(zip.measured.separation_eu).toBe(15);
    expect(manifest.crossings.some(r=>r.a==='ZIP'&&r.b==='G1')).toBe(false);
    expect(manifest.crossings.some(r=>r.a==='jetty.bightPier'&&r.b==='FERRY'&&JSON.stringify(r.at)==='[560,890]'&&r.resolution==='threshold')).toBe(true);
    const D=m.views.find((v:{id:string})=>v.id==='D');expect(D.subjects).toEqual(['surf','the zipline landing']);expect(D.deferred.some((x:string)=>x.startsWith('the Lamp (Pass 2b'))).toBe(true);
    expect(m.hosts.find((h:{id:string})=>h.id==='bank')).toMatchObject({footprint_m:[20,18],xy:[1443,1125],v2_0_footprint_m:[26,18]});
    expect(m.views.find((v:{id:string})=>v.id==='H').portrait.xy).toEqual([428,760]);expect(m.walks.lakerim).toMatchObject({v2_1_surface_m:5.2,v2_1_shoulder_m:1.2});expect(m.walks.lakerim.surface_m).toBeUndefined();
    expect(m.structures.bightSpurTrestle).toMatchObject({v2_3_to:[886.7,916],v2_3_length_m:56,v2_0_to:[891.6,906]});   // v2.4 extends it again (below)
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
describe('Horizon manifest v2.2: main\'s v1.7 sky data on the v2.1 land',()=>{
  it('adds FLIGHT.md sky data without a geography change',()=>{
    expect(manifest.version).toBe('3.0');   // v3.0 = Mountain V3 (D-M11); v2.6 = Pass 5 (Mountain v2); was '2.4' (candidate 6); v2.5 = reconciled with main #554-#560
    expect(manifest.sky.gliderPolar).toHaveLength(5);
    expect(manifest.sky.parachute).toMatchObject({forward_ms:6,sink_ms:3,freefallCap_ms:30,autoPull_agl_m:45,minBail_agl_m:60,canopy_m:[7,3]});
    expect(manifest.sky.corridors.throat).toMatchObject({gate:12,to:[1300,420],slope_deg:30,level_m:25,splashH:42,coneDeg:25,maxBankDeg:20});
    expect(manifest.sky.dropZone).toMatchObject({xy:manifest.sky.landings.green.xy,rings_m:[5,10,25]});
    for(const key of ['green','reachMeadow','sands'] as const)expect(manifest.sky.landings[key].modes).toContain('parachute');
    expect(manifest.sky.landingModes.deep).toEqual(['glider']);
    // The Drop Zone follows the green landing onto the v2.1 land ([1040,1065] was the v1.6 green landing).
    // D-WW77 (The Water's Way, RULINGS 1): the target 10 m ESE of the v2.1 [1028,1112], its field edge clear of the Year Walk.
    expect(manifest.sky.dropZone.xy).toEqual([1037.2,1115.8]);expect((manifest.sky.dropZone as unknown as {v2_7_xy:number[]}).v2_7_xy).toEqual([1028,1112]);expect((manifest.sky.dropZone as unknown as {v1_7_xy:number[]}).v1_7_xy).toEqual([1040,1065]);
    // Stage A v1.7's target stands (96.0 s measured on candidate 5 from the lookout launch); D34's [70,110] is recorded beside it.
    expect(manifest.journeys.targets_s['crown→lamp by glider']).toEqual([85,120]);
    expect(manifest.journeys.targets_s.decisions['crown→lamp by glider']).toContain("D34 applied pending Jonathan's confirmation");
    expect((manifest.journeys.targets_s.decisions as unknown as {v2_2_d34:number[]}).v2_2_d34).toEqual([70,110]);
  });
  it('rejects a carried threshold without a carrier or with a broken mode sequence',()=>{
    const row=manifest.carriedThresholds[0]!;
    expect(()=>parseHorizonManifest({...manifest,carriedThresholds:[{...row,carriedBy:''}]})).toThrow('Invalid Horizon carried threshold');
    expect(()=>parseHorizonManifest({...manifest,carriedThresholds:[{...row,modes:['plane→']}]})).toThrow('Invalid Horizon carried threshold');
  });
});

describe('Horizon manifest v2.2: main\'s v1.7 RIDE data (§8.3, D40, D42)',()=>{
  const paces=manifest.paces as unknown as Record<string,{roll:number|null;pushGrip:number|null}>;
  const surfaces=manifest.surfaces as unknown as Record<string,{pace:string;grip:number|null}>;
  it('is version 2.2 (now 2.3), dated, and says what changed',()=>{
    expect(manifest.version).toBe('3.0');   // v3.0 = Mountain V3 (D-M11, the Highlands and the Falls); v2.6 = Pass 5 (Mountain v2); was '2.4' (candidate 6)
    expect(manifest.date).toBe('2026-10-04');   // v3.0 (Mountain V3)
    expect(manifest.status).toContain('v2.2: paces and surface grip (RIDE D42)');
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
  it('makes the park forgiving rather than assisted, and keeps the park and S1/S3 numbers',()=>{
    expect(manifest.skate.park.note).toBe('Skate v2 park; forgiving landings only (RIDE D40); no race');
    expect(manifest.skate.park).toMatchObject({xy:[1020,1430],size:[60,32]});
    // Stage A v1.7 (journeys at scale 1.0) set the planning speeds board 10 / bicycle 8; the board and bicycle movers do not read
    // speeds_ms (their kernels set pace; the bicycle caps at 6.0). v2.2 keeps Stage A's number; the journey rows vs the movers' ride
    // logs (D44) are an open item (RECONCILE.md).
    expect(manifest.speeds_ms.board).toBe(10);expect(manifest.speeds_ms.bicycle).toBe(6);   // v2.3: the bicycle's cap (was 8)
    // v2.6 (D-M5): S1's upper half is Mountain v2's course (its nine segments), then the sill, the Notch shelf, the Reach, the quay.
    expect(manifest.skate.S1.segments.map(s=>s.name)).toEqual(['Summit start','Alpine bends','Dam overlook','Meadow sweep','Woodland bridges','Library balcony','Neighbourhood switchbacks','Town canal crossing','Waterfront finish','Sill','Notch shelf','Reach boardwalk','Quay finish']);
    expect(manifest.skate.S1.segments.slice(-3).map(s=>[s.pace,s.surface])).toEqual([['fast','paved'],['slow','cobble'],['fast','paved']]);
    expect((manifest.skate.S1 as unknown as {v2_5_segments:{pace:string;surface:string}[]}).v2_5_segments.map(s=>[s.pace,s.surface])).toEqual([['fast','paved'],['flow','bankedTurf'],['flow','apron'],['fast','paved'],['slow','cobble'],['fast','paved']]);
    expect(manifest.skate.S3.segments[2]).toMatchObject({name:'The square',pace:'threshold',surface:'plaza'});
  });
});
describe('Horizon manifest v2.3: Stage A Wave 7 (W7-A)',()=>{
  const m=manifest as unknown as Record<string,any>;
  it('D-D6: page J looks east through the Needle\'s Eye from the Prow, with a ground point for Walk',()=>{
    const J=m.views.find((v:{id:string})=>v.id==='J');
    expect(J).toMatchObject({xy:[1665,695],target:[1790,681],target_h:20,eyeH:51.6,subjects:['the arch','the Prow'],ground:{xy:[1607.3,690.9],h:48.5}});   // v2.4: 15 m south (the Prow in the 16:9 frame)
    expect(J.v2_3).toMatchObject({xy:[1665,680],eyeH:51.5,target_h:25});
    expect(J.v2_2).toMatchObject({xy:[1840,1000],eyeH:60});expect(J.portrait.frames).toEqual(['the arch','the Prow']);
  });
  it('plans the bicycle at its 6.0 cap and re-targets the library ride at the measured 220.6 s + 10 %',()=>{
    expect(m.speeds_ms).toMatchObject({bicycle:6,v2_2_bicycle:8});
    expect(m.journeys.targets_s['square→library by bicycle']).toBe(243);expect(Math.ceil(220.6*1.1)).toBe(243);
    expect(m.journeys.targets_s.decisions['v2_2_square→library by bicycle']).toBe(185);
  });
  it('D-D8: the lake-rim trail keeps its profile and ends at the gallery exit, not along the dam crest',()=>{
    expect(m.walks.lakerim.pts.at(-1)).toEqual([1166,905]);expect(m.walks.lakerim.v2_2_pts.at(-1)).toEqual([1140,905]);
    expect(manifest.crossings.some(r=>r.a==='walk lakerim'&&r.b==='river lower')).toBe(false);
    // v2.6 (D-M3): the dam crest walk is retired with the dam (its register row moved to retired_v2_6.crossings).
    expect(manifest.crossings.some(r=>r.a==='walk damCrest'&&r.b==='river lower')).toBe(false);
    expect((m.retired_v2_6.crossings.value as {a:string;b:string}[]).some(r=>r.a==='walk damCrest'&&r.b==='river lower')).toBe(true);
  });
  it('seats the market stair\'s head on the upper street (it stood 6 m over the square) and keeps D-C11',()=>{
    expect(m.structures.marketStair).toMatchObject({head:[1472,18,1115],foot:[1472,12,1134],v2_2_head:[1480,18,1150],twin:'none (stairs only)'});
    expect(m.structures.marketStair.stepFree.route).toEqual(['walk square']);
  });
  it('moves plots bight.1 and terraces.1 1.0 m off the Year Walk and puts two failed over/unders at grade',()=>{
    expect(m.reserves.bightShore.plots[0]).toEqual([813,918.8]);expect(m.reserves.bightShore.v2_2_plots[0]).toEqual([814,919]);
    expect(m.reserves.terraces.v2_3_plots[0]).toEqual([1551.1,832.5]);expect(m.reserves.terraces.plots[0]).toEqual([1552,832]);   // v2.4 reverted it (below)
    const row=(a:string,b:string)=>manifest.crossings.find(r=>r.a===a&&r.b===b&&(r as {note?:string}).note?.startsWith('v2.3')) as unknown as {resolution:string;v2_2_resolution:string}|undefined;
    expect(row('S4','yearWalk')).toMatchObject({resolution:'threshold',v2_2_resolution:'under'});
    expect(row('yearWalk','plot.bight.1.service')).toMatchObject({resolution:'threshold',v2_2_resolution:'under'});
  });
});
describe('Horizon manifest v2.4: Stage A Wave 7 (integrator 4)',()=>{
  const m=manifest as unknown as Record<string,any>,view=(id:string)=>m.views.find((v:{id:string})=>v.id===id);
  it('gives D, E (on the Crown launch deck), G, H, I, J and L a Walk ground point',()=>{
    expect(Object.fromEntries('DEGHIJL'.split('').map(id=>[id,view(id).ground]))).toEqual({D:{xy:[1181,1401],h:3},E:{xy:[1306,482],h:170},G:{xy:[1300,440],h:40.6},H:{xy:[440,760],h:38},I:{xy:[1284.8,1215],h:9.5},J:{xy:[1607.3,690.9],h:48.5},L:{xy:[1477,1289],h:3}});
  });
  it('D-D7: G looks up the skylight shaft; H is an aerial eye over the strip (eye 39.6 → 48)',()=>{
    expect(view('G')).toMatchObject({xy:[1320,404],target:[1320,380],target_h:110,subjects:['the skylight shaft']});expect(view('G').v2_3.xy).toEqual([1300,440]);
    expect(view('H')).toMatchObject({eyeH:48,target_h:20,portrait:{eyeH:48,target_h:20}});expect(view('H').v2_3).toMatchObject({eyeH_measured:39.6,target_h:30});
  });
  it('moves the Reach meadow onto a clear field, re-seats gate 10, raises the quay finish and extends the spur trestle',()=>{
    expect(m.sky.landings.reachMeadow).toMatchObject({xy:[1195,1205],v2_3_xy:[1143,1167],r:40});
    expect(m.sky.gates.find((g:{id:string})=>g.id==='northFace')).toMatchObject({h:139,v2_3_h:130});
    expect(m.structures.landingQuay).toMatchObject({finish_h:4.7,v2_3_finish_h:3});
    expect(m.structures.bightSpurTrestle).toMatchObject({from:[923.6,874.5],to:[881,926.5],length_m:68,v2_3_length_m:56});
    expect(m.structures.prowLoopFootbridge).toMatchObject({from:[1603.5,674.6],to:[1609.8,702.9],width_m:6});
    expect(m.reserves.terraces).toMatchObject({plots:[[1552,832],[1528,896],[1512,952]]});
  });
});
describe('Horizon manifest v2.6: Mountain v2 placed on the Crown (Pass 5, T1 Land)',()=>{
  const m=manifest as unknown as Record<string,any>;
  it('declares the placed region and parses with it (D-M1, D-M2)',()=>{
    expect(parseHorizonManifest(manifest)).toBe(manifest);
    expect(m.regions).toEqual([expect.objectContaining({id:'mountainV2',kind:'placedWorld',offset:{x:1308,y:54,z:764},footprint:{minX:1108,maxX:1508,minZ:368,maxZ:848}})]);
    expect(m.regions[0].decisions).toEqual(['D-M1','D-M2','D-M3','D-M4','D-M5','D-M6','D-M7','D-M8','D-M9','D-M10']);
  });
  it('retires Crown Road, the Shoulder Tunnel, the dam, its gallery and portage, the Cup and the upper river, verbatim',()=>{
    expect(m.roads).not.toHaveProperty('V02');for(const k of ['shoulderTunnel','dam','lakesideSwitchback','s1Flyover','crownWalkBridge','inletFootbridge'])expect(m.structures).not.toHaveProperty(k);
    expect(m.underground).not.toHaveProperty('damGallery');expect(m.water).not.toHaveProperty('cup');expect(m.water.river).not.toHaveProperty('upper');expect(m.walks).not.toHaveProperty('crownFromGondola');
    for(const k of ['roads.V02','structures.shoulderTunnel','structures.dam','structures.lakesideSwitchback','underground.damGallery','water.cup','water.river.upper','thresholds.damPortage','walks.crownFromGondola'])expect(m.retired_v2_6[k]?.value,k).toBeDefined();
    expect(m.retired_v2_6['roads.V02'].value.pts[0]).toEqual([1433.3,335.6]);
  });
  it('adds the Mountain Road, v2\'s gondola, L01 on v2\'s crest and S1 on v2\'s course (D-M3..D-M6)',()=>{
    expect(m.roads.V03).toMatchObject({label:'Mountain Road',profile:'road',grade_max_pct:10});expect(m.roads.V03.pts[0]).toEqual([1599.5,790.8]);
    expect(m.structures.mountainRoadTunnel).toMatchObject({kind:'tunnel',route:'V03'});
    expect(m.cable.G1).toMatchObject({from:[1282,810],to:[1300,480],fromH:54.53,toH:158.05,authoredTowers:[100,128,158],drawnBy:'mountainV2'});
    expect(m.places.find((p:{id:string})=>p.id==='L01')).toMatchObject({xy:[1316,539.2],h:142,v2_5_xy:[1173,912]});
    expect(m.skate.S1.mountainV2.upperPts).toBeGreaterThan(100);expect(m.skate.S1.mountainV2.gates).toHaveLength(17);
    expect(m.thresholds.find((t:{id:string})=>t.id==='gondolaBase').xy).toEqual([1279.71,810.73]);
    expect(m.underground.doors.southPortal.h).toBe(67.5);expect(m.water.river.sill).toMatchObject({xy:[1136,896],level:50});
    expect(m.journey.stations.find((s:{id:string})=>s.id==='jan').xy).toEqual([1364,650]);
  });
});
