/**
 * The mountain's authored planting plan (pure data, seeded, shared by the renderer, trunk
 * collision and the camera's foliage clearance).
 *
 * Not a uniform scatter: every district has its own tree archetypes and groves placed to
 * frame its entrance and the route choices near it; hedgerows and avenues follow the road
 * and lane a few units outside their edges; the open hillside grows woodland whose kind
 * follows altitude and whose density follows a slow noise (so there are glades). Nothing
 * stands in the road, lane, path, stair, bridge, platform, apron or plot footprints, the
 * river, the reservoir bowl or on a cliff.
 */
import {DISTRICTS,RESERVED_PLOTS,MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,RIVER,DAM,BUILDING_SITES,SUMMIT_OBSERVATORY_SITE,GOAL_PAVILION_SITE,FUNICULAR_LINE,GONDOLA_LINE,KITTY_CHAMBERS,SKILL_BRANCHES,mountainBaseHeight,type Biome,type Point3} from './definition.ts';
import {PATH_EDGES} from './pathGraph.ts';
import {groundHeightAt} from '../scene/ground.ts';

export type TreeKind='round'|'fruit'|'birch'|'pine'|'alpine'|'poplar';
export type ShrubKind='shrub'|'flowering'|'hedge'|'heath'|'boulder';
export type MountainTree={x:number;y:number;z:number;size:number;spin:number;kind:TreeKind;tint:number;lean:number};
export type MountainShrub={x:number;y:number;z:number;size:number;spin:number;kind:ShrubKind;tint:number;stretch:number};
export type FlowerCluster={x:number;y:number;z:number;radius:number;count:number;colour:number;seed:number};

const hash=(x:number,z:number)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};
function noise(x:number,z:number){const xi=Math.floor(x),zi=Math.floor(z),fx=x-xi,fz=z-zi,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}

/** A spatial index of everything planting must keep clear of: [x, z, radius] discs and polyline corridors. */
type Corridor={points:readonly (readonly [number,number])[];half:number};
let corridors:Corridor[]|null=null;
function keepClear():Corridor[]{
  if(corridors)return corridors;
  const c:Corridor[]=[];
  const line=(pts:readonly Point3[],half:number,every=1)=>c.push({points:pts.filter((_,i)=>i%every===0||i===pts.length-1).map(p=>[p[0],p[2]] as const),half});
  line(MOUNTAIN_ROAD_LINE.samples.map(s=>s.at),MOUNTAIN_ROAD_LINE.samples[40]!.halfWidth+.6,2);
  line(ORCHARD_LANE_LINE.samples.map(s=>s.at),ORCHARD_LANE_LINE.samples[0]!.halfWidth+.6,2);
  for(const e of PATH_EDGES)line(e.points,e.halfWidth+.4);
  line(RIVER,3.4);
  line(FUNICULAR_LINE.path,2.6,3);
  for(const b of SKILL_BRANCHES)line(b.points,b.halfWidth+1,2);
  corridors=c;return c;
}
const discs=():[number,number,number][]=>[
  ...Object.values(BUILDING_SITES).map(s=>[s[0],s[1],8] as [number,number,number]),
  ...RESERVED_PLOTS.map(p=>[p.at[0],p.at[2],Math.hypot(p.half[0],p.half[1])+1] as [number,number,number]),
  [SUMMIT_OBSERVATORY_SITE.at[0],SUMMIT_OBSERVATORY_SITE.at[2],9],[GOAL_PAVILION_SITE.at[0],GOAL_PAVILION_SITE.at[2],8],
  ...[...FUNICULAR_LINE.stations,...GONDOLA_LINE.stations].map(s=>[s.platform.at[0],s.platform.at[2],7] as [number,number,number]),
  ...GONDOLA_LINE.towers.map(t=>[t[0],t[2],5] as [number,number,number]),
  ...KITTY_CHAMBERS.map(k=>[k.at[0],k.at[2],k.radius+3] as [number,number,number]),
];
/** Horizontal clearance from every corridor edge and keep-out disc (negative inside). */
export function plantingClearance(x:number,z:number,opts:{bowl?:boolean}={}):number{
  let best=Infinity;
  for(const c of keepClear()){const P=c.points;for(let i=1;i<P.length;i++){const a=P[i-1]!,b=P[i]!;if(Math.abs(x-a[0])>40&&Math.abs(x-b[0])>40)continue;if(Math.abs(z-a[1])>40&&Math.abs(z-b[1])>40)continue;
    const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)),d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)-c.half;if(d<best)best=d;}}
  for(const [dx,dz,r] of discs()){const d=Math.hypot(x-dx,z-dz)-r;if(d<best)best=d;}
  // The dam, its apron and the reservoir bowl (`bowl:false` keeps only the dam's own band, for rock that may line the bowl).
  const dd=Math.hypot(x-DAM.centre[0],z-DAM.centre[2]);
  if(opts.bowl===false){if(Math.abs(dd-DAM.radius)<8&&Math.abs(Math.atan2(x-DAM.centre[0],z-DAM.centre[2]))<DAM.halfAngle*1.3)best=Math.min(best,Math.abs(dd-DAM.radius)-8);return best;}
  if(dd<DAM.radius+8&&z>DAM.centre[2]-30)best=Math.min(best,dd-DAM.radius-8);
  if(Math.hypot(x-(DAM.centre[0]-2),z-(DAM.centre[2]-6))<40&&mountainBaseHeight(x,z)<88)best=Math.min(best,-1);
  return best;
}
const slopeAt=(x:number,z:number)=>Math.hypot(mountainBaseHeight(x+1,z)-mountainBaseHeight(x-1,z),mountainBaseHeight(x,z+1)-mountainBaseHeight(x,z-1))/2;
const biomeAt=(x:number,z:number,y:number):Biome=>{let best:Biome|null=null,d=Infinity;for(const di of DISTRICTS){const e=Math.hypot(x-di.at[0],z-di.at[2])-di.radius;if(e<d){d=e;best=di.biome;}}
  if(best&&d<34)return best;return y>92?'summit':y>72?'alpine':y>50?'meadow':y>28?'woods':'garden';};

/** Which trees grow in a biome (weights), and how big. */
const ARCHETYPES:Record<Biome,readonly [TreeKind,number][]>={
  garden:[['round',4],['fruit',2],['poplar',1],['birch',1]],
  orchard:[['fruit',8],['round',1],['poplar',1]],
  woods:[['birch',5],['pine',4],['round',2]],
  meadow:[['round',2],['poplar',2],['birch',1],['pine',1]],
  alpine:[['alpine',6],['pine',2]],
  summit:[['alpine',1]],
};
const pick=(list:readonly [TreeKind,number][],u:number):TreeKind=>{const total=list.reduce((a,[,w])=>a+w,0);let t=u*total;for(const [k,w] of list){t-=w;if(t<=0)return k;}return list[0]![0];};

type Plan={trees:MountainTree[];shrubs:MountainShrub[];flowers:FlowerCluster[];tufts:{x:number;y:number;z:number;size:number;spin:number;tint:number}[]};
const plans=new Map<string,Plan>();
export function mountainPlanting(tier:'full'|'lite'):Plan{
  const cached=plans.get(tier);if(cached)return cached;
  let seed=84731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const trees:MountainTree[]=[],shrubs:MountainShrub[]=[],flowers:FlowerCluster[]=[],tufts:Plan['tufts']=[];
  const lite=tier==='lite';
  // A coarse occupancy grid keeps crowns apart.
  const occ=new Map<string,{x:number;z:number;r:number}[]>(),key=(x:number,z:number)=>`${Math.floor(x/6)}:${Math.floor(z/6)}`;
  const free=(x:number,z:number,r:number)=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const cell=occ.get(`${Math.floor(x/6)+i}:${Math.floor(z/6)+j}`);if(cell)for(const o of cell)if(Math.hypot(x-o.x,z-o.z)<r+o.r)return false;}return true;};
  const mark=(x:number,z:number,r:number)=>{const k=key(x,z),cell=occ.get(k)??[];cell.push({x,z,r});occ.set(k,cell);};
  const tryTree=(x:number,z:number,kind:TreeKind|null,size:number,need=1.6,pack=.85):boolean=>{
    if(z>-52||x<-178||x>178||z<-386)return false;
    const y=mountainBaseHeight(x,z);if(y<1.2)return false;
    if(slopeAt(x,z)>(kind==='pine'||kind==='alpine'||kind===null?1.25:1.05))return false;
    const r=(kind==='poplar'||kind==='birch'||kind==='alpine'?1.1:1.7)*size;
    if(plantingClearance(x,z)<r*.9+need-1)return false;
    if(!free(x,z,r*pack))return false;
    const b=biomeAt(x,z,y),k=kind??pick(ARCHETYPES[b],rand());
    // The trunk's foot must reach the ground on every side: no tree on a carved step or a bench lip.
    {const tr=crownOf({kind:k,size}).trunk;for(const [dx,dz] of [[tr,0],[-tr,0],[0,tr],[0,-tr]] as const)if(y-.25-groundHeightAt(x+dx,z+dz)>.12)return false;}
    if(b==='summit'&&y>98&&k!=='alpine')return false;
    trees.push({x,y,z,size,spin:rand()*6.283,kind:k,tint:rand(),lean:(rand()-.5)*.12});mark(x,z,r*pack);return true;
  };
  // 1. District groves: three to five clumps around each district, framing its entrance.
  for(const d of DISTRICTS){
    const groves=d.biome==='summit'?2:d.biome==='meadow'?3:d.biome==='orchard'?5:d.biome==='woods'?7:4;
    for(let g=0;g<groves;g++){
      const a=g/groves*Math.PI*2+rand()*.8,r=d.radius+6+rand()*14,cx=d.at[0]+Math.cos(a)*r,cz=d.at[2]+Math.sin(a)*r;
      const n=(d.biome==='orchard'?14:d.biome==='woods'?20:d.biome==='summit'?3:8)*(lite?.6:1);
      for(let k=0;k<n;k++){const aa=rand()*6.283,rr=Math.sqrt(rand())*(d.biome==='orchard'?11:8);
        // Orchard rows: fruit trees on a loose grid, a real orchard not a scatter.
        const [x,z]=d.biome==='orchard'?[cx+Math.round(Math.cos(aa)*rr/3.6)*3.6+(rand()-.5)*.6,cz+Math.round(Math.sin(aa)*rr/3.6)*3.6+(rand()-.5)*.6]:[cx+Math.cos(aa)*rr,cz+Math.sin(aa)*rr];
        tryTree(x,z,null,.75+rand()*.5);}
    }
  }
  // 2. Avenues and hedgerows along the road and lane, framing bends and junctions.
  for(const line of [MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE]){
    const S=line.samples;
    for(let i=12;i<S.length-6;i+=lite?11:7){const s=S[i]!;if(s.support==='bridge')continue;
      if(noise(i*.035,line===MOUNTAIN_ROAD_LINE?3:9)<.42)continue;
      for(const side of [1,-1]){const off=s.halfWidth+3.4+rand()*2.2,x=s.at[0]+s.normal[0]*off*side,z=s.at[2]+s.normal[2]*off*side;
        const y=mountainBaseHeight(x,z);if(Math.abs(y-s.at[1])>3)continue;
        const b=biomeAt(x,z,y),kind:TreeKind=b==='alpine'||b==='summit'?'alpine':b==='woods'?(rand()<.5?'birch':'pine'):b==='orchard'?'fruit':rand()<.4?'poplar':'round';
        tryTree(x,z,kind,.7+rand()*.35);
        // Hedge segments between the avenue trees in the lower, garden districts.
        if((b==='garden'||b==='orchard')&&rand()<.55){const hx=s.at[0]+s.normal[0]*(s.halfWidth+2.1)*side,hz=s.at[2]+s.normal[2]*(s.halfWidth+2.1)*side,hy=mountainBaseHeight(hx,hz);
          if(plantingClearance(hx,hz)>.2&&Math.abs(hy-s.at[1])<1.6)shrubs.push({x:hx,y:hy,z:hz,size:.8,spin:Math.atan2(s.tangent[0],s.tangent[2]),kind:'hedge',tint:rand(),stretch:2.6});}
      }
    }
  }
  // 3. The open hillside: stands of trees (one kind leading, a few others mixed in) whose crowns
  //    crowd into one canopy, with open meadow glades between the stands.
  const stands=lite?34:62;let made=0;
  for(let g=0;g<stands*8&&made<stands;g++){
    const cx=(rand()-.5)*336,cz=-64-rand()*312,cy=mountainBaseHeight(cx,cz);
    if(cy<2.5||noise(cx/27,cz/27)<.42||plantingClearance(cx,cz)<3||slopeAt(cx,cz)>1)continue;
    made++;
    const lead=pick(ARCHETYPES[biomeAt(cx,cz,cy)],rand()),n=(lite?6:9)+Math.floor(rand()*(lite?4:7)),spread=4.5+rand()*5.5;
    let placed=0;
    for(let k=0;k<n*4&&placed<n;k++){const a=rand()*6.283,r=spread*Math.sqrt(rand());
      if(tryTree(cx+Math.cos(a)*r,cz+Math.sin(a)*r,rand()<.72?lead:null,.72+rand()*.62,1.6,.58))placed++;}
  }
  // 4. Shrubs, heath, boulders: under the trees' edges and on the open slopes.
  for(let i=0;i<(lite?900:2200);i++){
    const x=(rand()-.5)*330,z=-58-rand()*315,y=mountainBaseHeight(x,z);if(y<1.2)continue;
    const cl=plantingClearance(x,z);if(cl<.8)continue;const sl=slopeAt(x,z);if(sl>1.25)continue;
    const b=biomeAt(x,z,y),u=rand();
    const kind:ShrubKind=b==='summit'?(u<.7?'heath':'boulder'):b==='alpine'?(u<.45?'boulder':u<.8?'heath':'shrub'):b==='meadow'?(u<.5?'flowering':'shrub'):b==='garden'?(u<.4?'flowering':'shrub'):'shrub';
    if(kind==='boulder'&&cl<2)continue;
    shrubs.push({x,y,z,size:kind==='boulder'?.6+rand()*1.1:.5+rand()*.6,spin:rand()*6.283,kind,tint:rand(),stretch:1});
  }
  // 5. Flower clusters: drifts in the meadows, clover in the orchard, beds near the Hearth.
  for(const d of DISTRICTS){
    const n=d.biome==='meadow'?60:d.biome==='orchard'?40:d.biome==='garden'?34:d.biome==='woods'?16:d.biome==='alpine'?16:10;
    for(let k=0;k<n*(lite?.6:1);k++){const a=rand()*6.283,r=d.radius*.6+rand()*(d.radius+18),x=d.at[0]+Math.cos(a)*r,z=d.at[2]+Math.sin(a)*r,y=mountainBaseHeight(x,z);
      if(plantingClearance(x,z)<.6||slopeAt(x,z)>.8||y<1)continue;
      flowers.push({x,y,z,radius:.9+rand()*1.6,count:6+Math.floor(rand()*(d.biome==='meadow'?14:9)),colour:Math.floor(rand()*5),seed:Math.floor(rand()*1e6)});}
  }
  // 6. Grass tufts along the path and road verges.
  for(const e of PATH_EDGES){if(e.kind!=='path')continue;for(let i=0;i<e.points.length;i+=lite?3:1){const p=e.points[i]!;for(const side of [-1,1]){if(rand()<.35)continue;
    const a=i+1<e.points.length?e.points[i+1]!:e.points[i-1]!,dx=a[0]-p[0],dz=a[2]-p[2],l=Math.hypot(dx,dz)||1,off=e.halfWidth+.35+rand()*.8,x=p[0]-dz/l*off*side,z=p[2]+dx/l*off*side;
    if(plantingClearance(x,z)<-.05)continue;tufts.push({x,y:mountainBaseHeight(x,z),z,size:.5+rand()*.5,spin:rand()*6.283,tint:rand()});}}}
  for(let i=20;i<MOUNTAIN_ROAD_LINE.samples.length;i+=lite?6:3){const s=MOUNTAIN_ROAD_LINE.samples[i]!;if(s.support==='bridge')continue;for(const side of [1,-1]){if(rand()<.5)continue;const off=s.halfWidth+.7+rand()*1.2,x=s.at[0]+s.normal[0]*off*side,z=s.at[2]+s.normal[2]*off*side,y=mountainBaseHeight(x,z);
    if(Math.abs(y-s.at[1])>.8||plantingClearance(x,z)<-.1)continue;tufts.push({x,y,z,size:.5+rand()*.6,spin:rand()*6.283,tint:rand()});}}
  const plan={trees,shrubs,flowers,tufts};plans.set(tier,plan);return plan;
}
/** The renderer, trunk collision and camera foliage clearance share one seeded plan. */
export function mountainTrees(tier:'full'|'lite'):readonly MountainTree[]{return mountainPlanting(tier).trees;}

const grids=new Map<string,Map<string,MountainTree[]>>();
/** Conservative crown volumes keep a following camera outside opaque leaves. */
export function mountainFoliageAt(x:number,y:number,z:number,tier:'full'|'lite'):boolean{
  let grid=grids.get(tier);if(!grid){grid=new Map();for(const tree of mountainTrees(tier)){const key=`${Math.floor(tree.x/12)}:${Math.floor(tree.z/12)}`,cell=grid.get(key)??[];cell.push(tree);grid.set(key,cell);}grids.set(tier,grid);}
  const cx=Math.floor(x/12),cz=Math.floor(z/12);
  for(let i=cx-1;i<=cx+1;i++)for(let j=cz-1;j<=cz+1;j++)for(const t of grid.get(`${i}:${j}`)??[]){
    const {base,top,radius}=crownOf(t);
    if(y>t.y+base&&y<t.y+top&&Math.hypot(x-t.x,z-t.z)<radius)return true;
  }
  return false;
}
/** Crown extents per archetype (in world units, scaled by size): the renderer draws inside these. */
export function crownOf(t:{kind:TreeKind;size:number}):{base:number;top:number;radius:number;trunk:number;trunkTop:number}{
  const s=t.size;
  switch(t.kind){
    case 'fruit':return {base:1.3*s,top:3.4*s,radius:1.9*s,trunk:.2*s,trunkTop:1.9*s};
    case 'birch':return {base:2.2*s,top:6.4*s,radius:1.3*s,trunk:.14*s,trunkTop:4.6*s};
    case 'pine':return {base:1.1*s,top:6.2*s,radius:1.9*s,trunk:.2*s,trunkTop:2*s};
    case 'alpine':return {base:.9*s,top:6.6*s,radius:1.3*s,trunk:.17*s,trunkTop:1.6*s};
    case 'poplar':return {base:1.4*s,top:7.2*s,radius:1.1*s,trunk:.16*s,trunkTop:2.6*s};
    default:return {base:1.6*s,top:5*s,radius:2.2*s,trunk:.22*s,trunkTop:2.6*s};
  }
}
