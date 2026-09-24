import {VILLAGE_SITES,VILLAGE_WATERFRONT} from './layout.ts';

/** Shared physical limits for terrain, walking, planting and the two map scales. */
export const HARBOUR_LAND = Object.freeze({ radius:84, lawn:58, terrace:10.4, shore:73.2, overview:160 });

export const HARBOUR_WANDERS = [
  {id:'orchard',name:'The old orchard',at:[-47,25],words:'Apple trees, a low stone wall, and nowhere you have to be.'},
  {id:'lookout',name:'Northlight lookout',at:[-5,-62],words:'The whole harbour behind you. The next part of the journey ahead.'},
  {id:'tidepools',name:'The tide pools',at:[49,43],words:'Small pools keep a piece of the sky when the tide goes out.'},
  {id:'meadow',name:'The long meadow',at:[-17,51],words:'A little room between one thing and the next.'},
] as const;
export type HarbourWanderId = typeof HARBOUR_WANDERS[number]['id'];

/** Physical landmark trunks/posts share their dimensions with the renderer. */
export const HARBOUR_LANDMARK_SOLIDS=[
  ...([[-3,-2],[-3,2],[3,-2],[3,2]] as const).map(([x,z],i)=>({kind:'circle' as const,id:`orchard-trunk-${i}`,x:HARBOUR_WANDERS[0].at[0]+x,z:HARBOUR_WANDERS[0].at[1]+z,r:.24})),
  ...([-2.3,2.3] as const).flatMap((x,i)=>([-1.6,1.6] as const).map((z,j)=>({kind:'circle' as const,id:`lookout-post-${i}-${j}`,x:HARBOUR_WANDERS[1].at[0]+x,z:HARBOUR_WANDERS[1].at[1]+z,r:.13}))),
  ...HARBOUR_WANDERS.map(w=>({kind:'circle' as const,id:`${w.id}-waymarker`,x:w.at[0]+1.5,z:w.at[1],r:.1})),
];

type Point=readonly[number,number];
const curve=(from:Point,control:Point,to:Point):Point[]=>Array.from({length:19},(_,i)=>{
  const t=i/18;return [(1-t)*(1-t)*from[0]+2*(1-t)*t*control[0]+t*t*to[0],(1-t)*(1-t)*from[1]+2*(1-t)*t*control[1]+t*t*to[1]];
});
const join=(first:Point[],second:Point[]):Point[]=>[...first,...second.slice(1)];
const north:Point=[0,-18],south:Point=[0,20],east:Point=[23,-4],west:Point=[-25,4];
const northEnd:Point=[-3,-43],southEnd:Point=[0,44],eastEnd:Point=[31,-17],westEnd:Point=[-35,14];
const approaches:Record<keyof typeof VILLAGE_SITES,readonly[Point,Point]>={
  home:[south,[-12,13]],bank:[north,[3,-17]],library:[north,[-12,-8]],
  glasshouse:[west,[-32,-2]],studio:[east,[22,7]],cottage:[south,[12,21]],boathouse:[eastEnd,[30,-29]],
};

/** Four shared village roads branch into quieter paths. Rendering, map and tree
 * clearances read this same graph; the final points still belong to real doors. */
export const HARBOUR_LANES = [
  {id:'north-road',points:join(curve([0,0],[1,-7],north),curve(north,[-1,-28],northEnd))},
  {id:'south-road',points:join(curve([0,0],[-1,8],south),curve(south,[3,31],southEnd))},
  {id:'east-road',points:join(curve([0,0],[11,-1],east),curve(east,[29,-6],eastEnd))},
  {id:'west-road',points:join(curve([0,0],[-11,0],west),curve(west,[-32,6],westEnd))},
  ...Object.entries(VILLAGE_SITES).filter(([,site])=>site.spot[1]>-70).map(([id,site])=>{
    const [x,z]=site.spot,yaw=Math.atan2(-x,-z),c=Math.cos(yaw),s=Math.sin(yaw);
    const end:Point=[x+site.door[0]*c+(site.door[1]+1.1)*s,z+(site.door[1]+1.1)*c-site.door[0]*s];
    const [from,control]=approaches[id as keyof typeof VILLAGE_SITES];
    return {id:site.entry,points:curve(from,control,end)};
  }),
  {id:'campfire',points:curve(southEnd,[2,59],[VILLAGE_WATERFRONT.spot[0],VILLAGE_WATERFRONT.spot[1]-VILLAGE_WATERFRONT.door[1]-1.1])},
  {id:'orchard',points:join(curve(westEnd,[-35,32],[-47,31]),curve([-47,31],[-47,28],HARBOUR_WANDERS[0].at))},
  {id:'lookout',points:curve(northEnd,[-7,-54],HARBOUR_WANDERS[1].at)},
  {id:'tidepools',points:join(curve(east,[44,-5],[45,20]),curve([45,20],[57,31],HARBOUR_WANDERS[2].at))},
  {id:'meadow',points:curve(southEnd,[-10,42],HARBOUR_WANDERS[3].at)},
];

export function distanceToTrail(x:number,z:number,points:readonly(readonly[number,number])[]):number{
  let closest=Infinity;
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!,dx=b[0]-a[0],dz=b[1]-a[1],square=dx*dx+dz*dz;
    const t=square?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/square)):0;
    closest=Math.min(closest,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return closest;
}
