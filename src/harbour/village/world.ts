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

/** Curved approaches leave the square open and give each destination its own lane. */
export function harbourLane(end:readonly[number,number], steps=48): readonly (readonly[number,number])[] {
  const eastWest=Math.abs(end[0])>Math.abs(end[1]),gate:readonly[number,number]=eastWest?[Math.sign(end[0])*8,0]:[0,Math.sign(end[1])*8];
  const control:readonly[number,number]=[gate[0]+end[0]*.32,gate[1]+end[1]*.32];
  const trunk=Array.from({length:9},(_,i)=>[gate[0]*i/8,gate[1]*i/8] as const);
  return [...trunk,...Array.from({length:steps},(_,i)=>{const t=(i+1)/steps;return [(1-t)*(1-t)*gate[0]+2*(1-t)*t*control[0]+t*t*end[0],(1-t)*(1-t)*gate[1]+2*(1-t)*t*control[1]+t*t*end[1]] as const;})];
}

/** Rendering and planting use the same road centre lines. */
export const HARBOUR_LANES = [
  ...Object.values(VILLAGE_SITES).map(site=>{
    const [x,z]=site.spot,yaw=Math.atan2(-x,-z),c=Math.cos(yaw),s=Math.sin(yaw);
    return {id:site.entry,points:harbourLane([x+site.door[0]*c+(site.door[1]+1.1)*s,z+(site.door[1]+1.1)*c-site.door[0]*s])};
  }),
  {id:'campfire',points:harbourLane(VILLAGE_WATERFRONT.spot)},
  ...HARBOUR_WANDERS.map(wander=>({id:wander.id,points:harbourLane(wander.at)})),
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
