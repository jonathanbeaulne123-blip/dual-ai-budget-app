import {BASIN,DISTRICTS,RESERVED_PLOTS,FOOTPATHS,SKILL_BRANCHES,RIVER,nearestOnRoute,mountainBaseHeight} from './definition.ts';
export type MountainTree={x:number;y:number;z:number;size:number;spin:number};
const plans=new Map<string,readonly MountainTree[]>();
/** The renderer, trunk collision and camera foliage clearance share one seeded plan. */
export function mountainTrees(tier:'full'|'lite'):readonly MountainTree[]{
  const cached=plans.get(tier);if(cached)return cached;
  let seed=84731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const trees:MountainTree[]=[];
  for(let i=0;i<(tier==='full'?1100:550);i++){
    const x=(rand()-.5)*292,z=-65-rand()*228,y=mountainBaseHeight(x,z),size=.65+rand()*1.3,spin=rand()*6.28;
    if(y<1||y>86||nearestOnRoute(x,z).distance<8||nearestOnRoute(x,z,RIVER).distance<9||Math.hypot(x-BASIN.x,z-BASIN.z)<BASIN.radius+5)continue;
    if(z>BASIN.z&&z<BASIN.z+48&&Math.abs(x-BASIN.x)<25)continue;
    if(DISTRICTS.some(d=>Math.hypot(x-d.at[0],z-d.at[2])<18)||RESERVED_PLOTS.some(p=>Math.abs(x-p.at[0])<p.half[0]+3&&Math.abs(z-p.at[2])<p.half[1]+3))continue;
    if(FOOTPATHS.some(p=>nearestOnRoute(x,z,p.points).distance<5)||SKILL_BRANCHES.some(b=>nearestOnRoute(x,z,b.points).distance<b.halfWidth+4))continue;
    if(Math.abs(y-mountainBaseHeight(x+.5,z))>1.2)continue;
    trees.push({x,y,z,size,spin});
  }
  plans.set(tier,trees);return trees;
}
const grids=new Map<string,Map<string,MountainTree[]>>();
/** Conservative crown volumes keep a following camera outside opaque leaves. */
export function mountainFoliageAt(x:number,y:number,z:number,tier:'full'|'lite'):boolean{
  let grid=grids.get(tier);if(!grid){grid=new Map();for(const tree of mountainTrees(tier)){const key=`${Math.floor(tree.x/12)}:${Math.floor(tree.z/12)}`,cell=grid.get(key)??[];cell.push(tree);grid.set(key,cell);}grids.set(tier,grid);}
  const cx=Math.floor(x/12),cz=Math.floor(z/12);
  for(let i=cx-1;i<=cx+1;i++)for(let j=cz-1;j<=cz+1;j++)for(const t of grid.get(`${i}:${j}`)??[]){
    if(y>t.y+.4*t.size&&y<t.y+5.2*t.size&&Math.hypot(x-t.x,z-t.z)<2.4*t.size)return true;
  }
  return false;
}
