/**
 * Hearth Mountain art on the shipped geography: nothing floats, nothing is buried, nothing
 * stands in a walk, and the terrain's painting reads the land in every direction.
 * Runs the exact placements, plans and lattice the renderer uses (full and lite tiers).
 */
import {describe,it,expect} from 'vitest';
import {groundHeightAt,TERRAIN_LATTICE_BOUNDS} from '../src/harbour/scene/ground.ts';
import {landHeight} from '../src/harbour/mountain/art/land.ts';
import {mountainProps,PROP_SINK} from '../src/harbour/mountain/art/placements.ts';
import {DISTRICT_FIXTURES,STATION_SOLIDS,DISTRICT_ART_SOLIDS,SUMMIT_ART_SOLIDS} from '../src/harbour/mountain/artGeometry.ts';
import {townArrivalPose,damViewPose,summitViewPose} from '../src/harbour/camera/mountainPoses.ts';
import {poseEye} from '../src/harbour/camera/poses.ts';
import {mountainPlanting,plantingClearance,crownOf} from '../src/harbour/mountain/planting.ts';
import {mountainStrata,STRATA_GRADE} from '../src/harbour/mountain/art/rockArt.ts';
import {MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,DOOR_APRONS,RESERVOIR,TRANSPORT_LINES,OVERLOOKS,mountainBaseHeight,type RoadLine} from '../src/harbour/mountain/definition.ts';
import {PATH_EDGES} from '../src/harbour/mountain/pathGraph.ts';
import {reservoirOutline} from '../src/harbour/mountain/art/damArt.ts';
import {overlookTop,OVERLOOK_RADIUS,footInCorridor} from '../src/harbour/mountain/art/spots.ts';
import {funicularBents} from '../src/harbour/mountain/art/transportArt.ts';
import {buildLattice,groundMasks} from '../src/harbour/scene/groundPaint.ts';

type P2=readonly [number,number];
const corners=(p:{x:number;z:number;yaw:number;half:readonly [number,number]}):P2[]=>{
  const c=Math.cos(p.yaw),s=Math.sin(p.yaw),out:P2[]=[];
  for(const lx of [-p.half[0],0,p.half[0]])for(const lz of [-p.half[1],0,p.half[1]])out.push([p.x+lx*c+lz*s,p.z+lz*c-lx*s]);
  return out;
};
const segDist=(x:number,z:number,a:readonly number[],b:readonly number[])=>{const dx=b[0]!-a[0]!,dz=b[2]!-a[2]!,l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0]!)*dx+(z-a[2]!)*dz)/l));return Math.hypot(x-a[0]!-dx*t,z-a[2]!-dz*t);};
const inRoad=(x:number,z:number,line:RoadLine)=>line.samples.some((s,i)=>i>0&&segDist(x,z,line.samples[i-1]!.at,s.at)<s.halfWidth);
const inPath=(x:number,z:number)=>PATH_EDGES.some(e=>e.points.some((p,i)=>i>0&&segDist(x,z,e.points[i-1]!,p)<e.halfWidth));
const inApron=(x:number,z:number)=>DOOR_APRONS.some(d=>{const c=Math.cos(d.apron.yaw),s=Math.sin(d.apron.yaw),dx=x-d.apron.at[0],dz=z-d.apron.at[2];return Math.abs(dx*c-dz*s)<d.apron.half[0]&&Math.abs(dz*c+dx*s)<d.apron.half[1];});
const inPoly=(x:number,z:number,poly:readonly (readonly number[])[])=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i]!,b=poly[j]!;if((a[2]!>z)!==(b[2]!>z)&&x<(b[0]!-a[0]!)*(z-a[2]!)/(b[2]!-a[2]!)+a[0]!)inside=!inside;}return inside;};
// The reservoir's water plan at its full level, upstream of the glass (the renderer's own outline).
const RESERVOIR_PLAN=reservoirOutline(RESERVOIR.level).map(([x,z])=>[x,0,z] as const);
const inReservoir=(x:number,z:number)=>inPoly(x,z,RESERVOIR_PLAN)&&groundHeightAt(x,z)<RESERVOIR.level;
const onPlatform=(x:number,z:number)=>Object.values(TRANSPORT_LINES).some(l=>l.stations.some(st=>{const p=st.platform,c=Math.cos(p.yaw),s=Math.sin(p.yaw),dx=x-p.at[0],dz=z-p.at[2];return Math.abs(dx*s+dz*c)<p.half[0]&&Math.abs(dx*c-dz*s)<p.half[1];}));

describe('mountain art stands on the land',()=>{
  it('composes the art land exactly as the ground the body walks on',()=>{
    for(let x=-190;x<=190;x+=7.3)for(let z=-390;z<=80;z+=6.1)expect(landHeight(x,z)).toBeCloseTo(groundHeightAt(x,z),9);
  });
  it('seats every free-standing prop: no foot floats more than 0.15 or sinks more than 0.4 under its footprint',()=>{
    const props=mountainProps(),failures:string[]=[];
    expect(props.length).toBeGreaterThan(40);
    for(const p of props){
      if(p.on==='pad'){
        // A bench levelled on a pad: the pad's top meets the highest ground and its foot is under the lowest.
        const ys=corners(p).map(([x,z])=>groundHeightAt(x,z));
        expect(p.bottom-Math.max(...ys),p.id).toBeGreaterThanOrEqual(0);expect(p.bottom-Math.max(...ys),p.id).toBeLessThan(.15);
        expect(p.padFoot!,p.id).toBeLessThan(Math.min(...ys));
        continue;
      }
      if(p.on){
        // A prop on a built surface stands on that surface, and the surface is under its whole footprint.
        const o=OVERLOOKS.find(v=>`overlook:${v.id}`===p.on)!;
        expect(p.bottom,p.id).toBeCloseTo(overlookTop(o),6);
        for(const [x,z] of corners(p))expect(Math.hypot(x-o.at[0],z-o.at[2]),p.id).toBeLessThan(OVERLOOK_RADIUS-.3);
        continue;
      }
      expect(p.bottom,p.id).toBeCloseTo(Math.min(...corners(p).map(([x,z])=>groundHeightAt(x,z)))-PROP_SINK,6);
      for(const [x,z] of corners(p)){const g=groundHeightAt(x,z),float=p.bottom-g,sink=g-p.bottom;if(float>.15||sink>.4+PROP_SINK*0)failures.push(`${p.id} ${float>.15?'floats':'sinks'} ${(float>.15?float:sink).toFixed(2)}`);}
    }
    expect(failures).toEqual([]);
  });
  it('keeps every prop footprint out of the road, lanes, paths, stairs, door aprons, platforms and the reservoir',()=>{
    const failures:string[]=[];
    const check=(id:string,pts:P2[])=>{for(const [x,z] of pts){
      if(inRoad(x,z,MOUNTAIN_ROAD_LINE)||inRoad(x,z,ORCHARD_LANE_LINE))failures.push(`${id} road`);
      else if(inPath(x,z))failures.push(`${id} path`);else if(inApron(x,z))failures.push(`${id} apron`);
      else if(onPlatform(x,z))failures.push(`${id} platform`);else if(inReservoir(x,z))failures.push(`${id} reservoir`);}};
    for(const p of mountainProps())check(p.id,corners(p));
    // Fixtures collide by their axis-aligned solid, so the whole solid must stay out of every walk.
    for(const f of DISTRICT_FIXTURES)check(f.id,[[f.solid.min[0],f.solid.min[2]],[f.solid.max[0],f.solid.min[2]],[f.solid.max[0],f.solid.max[2]],[f.solid.min[0],f.solid.max[2]]]);
    expect([...new Set(failures)]).toEqual([]);
  });
  it('seats district fixtures on the lowest ground under them and never above it',()=>{
    for(const f of DISTRICT_FIXTURES){
      const ys=corners({x:f.at[0],z:f.at[2],yaw:f.yaw,half:f.half}).map(([x,z])=>groundHeightAt(x,z));
      expect(f.at[1]-Math.min(...ys),f.id).toBeLessThanOrEqual(.15);
      expect(Math.max(...ys)-f.at[1],f.id).toBeLessThan(.95);
    }
  });
});

describe('mountain art keeps the authored views open',()=>{
  it('puts no art solid (stations, district furniture, observatory, pavilion) across the town, dam or summit view before the land',()=>{
    const solids=[...STATION_SOLIDS,...DISTRICT_ART_SOLIDS,...SUMMIT_ART_SOLIDS],r=.12,hits:string[]=[];
    for(const [name,pose] of [['town',townArrivalPose('desktop')],['dam',damViewPose('desktop')],['summit',summitViewPose('desktop')]] as const){
      const e=poseEye(pose),t=pose.target,L=Math.hypot(t[0]-e[0],t[1]-e[1],t[2]-e[2]);
      for(let d=0;d<L;d+=.1){const u=d/L,x=e[0]+(t[0]-e[0])*u,y=e[1]+(t[1]-e[1])*u,z=e[2]+(t[2]-e[2])*u;
        if(y<groundHeightAt(x,z))break;
        const s=solids.find(s=>x>s.min[0]-r&&x<s.max[0]+r&&y>s.min[1]-r&&y<s.max[1]+r&&z>s.min[2]-r&&z<s.max[2]+r);
        if(s){hits.push(`${name}:${s.id}@${d.toFixed(1)}`);break;}}
    }
    expect(hits).toEqual([]);
  });
});

describe('mountain planting and rock follow an authored plan',()=>{
  for(const tier of ['full','lite'] as const)it(`plants ${tier} trees rooted to the slope, clear of every walk, in groves rather than a scatter`,()=>{
    const plan=mountainPlanting(tier);
    expect(plan.trees.length).toBeGreaterThan(tier==='full'?500:250);
    expect(plan.trees.length).toBeLessThan(tier==='full'?1400:800);
    for(const t of plan.trees){
      expect(Math.abs(t.y-mountainBaseHeight(t.x,t.z))).toBeLessThan(1e-6);
      const r=crownOf(t).trunk;
      // The trunk's foot (drawn a quarter unit below the root) reaches the ground on every side.
      for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]])expect(t.y-.25-groundHeightAt(t.x+dx!,t.z+dz!)).toBeLessThan(.15);
      expect(plantingClearance(t.x,t.z)).toBeGreaterThan(0);
      expect(inRoad(t.x,t.z,MOUNTAIN_ROAD_LINE)||inRoad(t.x,t.z,ORCHARD_LANE_LINE)||inPath(t.x,t.z)||inApron(t.x,t.z)||inReservoir(t.x,t.z)).toBe(false);
    }
    // Groves, not a scatter: tree counts in 12-unit cells are strongly over-dispersed (variance well
    // above the mean), where an evenly spaced scatter would sit near or below one.
    const counts=new Map<string,number>();
    for(let x=-170;x<170;x+=12)for(let z=-380;z<-60;z+=12)counts.set(`${Math.floor(x/12)}:${Math.floor(z/12)}`,0);
    for(const t of plan.trees){const k=`${Math.floor(t.x/12)}:${Math.floor(t.z/12)}`;if(counts.has(k))counts.set(k,counts.get(k)!+1);}
    const v=[...counts.values()],mean=v.reduce((a,b)=>a+b,0)/v.length,variance=v.reduce((a,b)=>a+(b-mean)**2,0)/v.length;
    expect(variance/mean).toBeGreaterThan(2.5);
    // Three to five archetypes in the wooded and orchard biomes, one kind dominating the orchard.
    expect(new Set(plan.trees.map(t=>t.kind)).size).toBeGreaterThanOrEqual(5);
  });
  it('draws rock strata only on cliffs too steep to walk, on their contours, clear of every corridor',()=>{
    const strata=mountainStrata('full');
    expect(strata.length).toBeGreaterThan(500);
    for(const l of strata){
      const mx=(l.a[0]+l.b[0])/2,mz=(l.a[1]+l.b[1])/2;
      expect(l.grade).toBeGreaterThanOrEqual(STRATA_GRADE);
      // Each ledge lies on its contour: within a fraction of a unit (horizontally) of where the land
      // is at the ledge's height, so its buried inner edge (0.5 into the face) is never exposed.
      expect(Math.abs(mountainBaseHeight(mx,mz)-l.y)/l.grade).toBeLessThan(.5);
      expect(plantingClearance(mx,mz,{bowl:false})).toBeGreaterThan(1.5);
      expect(Math.hypot(...l.out)).toBeCloseTo(1,6);
    }
    expect(mountainStrata('lite').length).toBeLessThan(strata.length);
  });
});

describe('terrain painting',()=>{
  const L=buildLattice(TERRAIN_LATTICE_BOUNDS,'lite',groundHeightAt),m=groundMasks(L,'lite',groundHeightAt);
  it('reads slope in every direction, not just along x',()=>{
    // Vertices on steep ground whose fall is mostly along z must read as steep too.
    let zSteep=0,read=0;
    for(let i=0;i<m.n;i++){const x=L.positions[i*3]!,z=L.positions[i*3+2]!;if(z>-50)continue;
      const gx=(groundHeightAt(x+1,z)-groundHeightAt(x-1,z))/2,gz=(groundHeightAt(x,z+1)-groundHeightAt(x,z-1))/2;
      if(Math.abs(gz)>1.2&&Math.abs(gx)<.2){zSteep++;if(m.slope[i]!>1)read++;}}
    expect(zSteep).toBeGreaterThan(20);expect(read/zSteep).toBeGreaterThan(.95);
  });
  it('blends districts softly instead of by nearest centre',()=>{
    // Across the mountain's grassy ground, biome weights change gradually between neighbouring
    // vertices (rock paints the steep faces, where the land itself changes abruptly).
    let jumps=0,pairs=0;
    for(let r=1;r<L.rows;r+=3)for(let c=1;c<L.cols;c+=3){const i=r*(L.cols+1)+c,j=i+1;if(L.positions[i*3+2]!>-60||m.slope[i]!>.8||m.slope[j]!>.8)continue;pairs++;
      for(const b of Object.keys(m.biome) as (keyof typeof m.biome)[])if(Math.abs(m.biome[b]![i]!-m.biome[b]![j]!)>.2){jumps++;break;}}
    expect(pairs).toBeGreaterThan(500);expect(jumps/pairs).toBeLessThan(.01);
  });
  it('faces every lattice triangle up and keeps the coast on the fine lattice',()=>{
    const P=L.positions,I=L.indices;let down=0;
    for(let k=0;k<I.length;k+=3){const a=I[k]!*3,b=I[k+1]!*3,c=I[k+2]!*3,ux=P[b]!-P[a]!,uz=P[b+2]!-P[a+2]!,vx=P[c]!-P[a]!,vz=P[c+2]!-P[a+2]!;if(uz*vx-ux*vz<=0)down++;}
    expect(down).toBe(0);
    // The island's coast (radius about 57 round the square) lies in the fine band on both tiers.
    const full=buildLattice(TERRAIN_LATTICE_BOUNDS,'full',groundHeightAt);
    for(const lat of [L,full]){const step=(xs:Float32Array,a:number,b:number)=>{let worst=0;for(let i=1;i<xs.length;i++)if(xs[i]!>=a&&xs[i-1]!<=b)worst=Math.max(worst,xs[i]!-xs[i-1]!);return worst;};
      expect(step(lat.xs,-62,62)).toBeLessThanOrEqual(lat===full?1.26:2.01);expect(step(lat.zs,-60,70)).toBeLessThanOrEqual(lat===full?1.26:2.01);}
  });
  it('shades gullies and the land’s own shadow',()=>{
    let gully=0,shadowed=0;for(let i=0;i<m.n;i++){if(m.cavity[i]!>1)gully++;if(m.sun[i]!>.5)shadowed++;}
    expect(gully).toBeGreaterThan(200);expect(shadowed).toBeGreaterThan(200);
  });
});

describe('transport and bridge supports stand clear of the walks',()=>{
  it('never stands a funicular bent in a road, lane or path it crosses: a girder spans it',()=>{
    const bents=funicularBents('full');
    expect(bents.length).toBeGreaterThan(20);
    for(const t of bents.filter(b=>!b.spans))for(const f of t.feet)expect(footInCorridor(f[0],groundHeightAt(f[0],f[2]),f[2]),`bent ${t.i}`).toBe(false);
    // An independent check on the drawn feet: none inside the road or lane at its own level.
    for(const t of bents.filter(b=>!b.spans))for(const f of t.feet)for(const line of [MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE])
      expect(line.samples.some(s=>Math.abs(s.at[1]-groundHeightAt(f[0],f[2]))<3&&Math.hypot(f[0]-s.at[0],f[2]-s.at[2])<s.halfWidth),`bent ${t.i}`).toBe(false);
    // Every crossing of the road or lane at ground level is spanned, not stood in.
    expect(bents.some(b=>b.spans)).toBe(true);
  });
});
