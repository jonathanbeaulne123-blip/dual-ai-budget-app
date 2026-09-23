/** Original Harbour spots. Rendering, physics, planting and the map read this table. */
export type SkatePoint = readonly [number, number];
export type SkateRamp = {id:string; x:number; z:number; width:number; length:number; height:number; yaw:number; kind:'kicker'|'table'|'halfpipe'};
export type SkateRail = {id:string; a:SkatePoint; b:SkatePoint; height:number; name:string};
export const SKATE_SPOTS = [
  {id:'tideline',name:'Tideline Park',x:25,z:-13,halfWidth:12,halfDepth:9,words:'A little concrete. A lot of possibility.',start:[20,-5] as SkatePoint,yaw:Math.PI},
  {id:'bookends',name:'Bookends Plaza',x:-14,z:-6,halfWidth:6,halfDepth:5,words:'Low ledges. Long lines. One more try.',start:[-12,-2] as SkatePoint,yaw:Math.PI},
  {id:'drydock',name:'Drydock',x:30,z:-32,halfWidth:7,halfDepth:5,words:'Salt air and a rail all the way home.',start:[27,-28] as SkatePoint,yaw:Math.PI},
  {id:'orchard',name:'Orchard Banks',x:-44,z:32,halfWidth:5,halfDepth:4,words:'Found between the apple trees.',start:[-40,34] as SkatePoint,yaw:-Math.PI/2},
  {id:'northlight',name:'Northlight Run',x:-6,z:-54,halfWidth:4,halfDepth:5,words:'The island ends. The line goes on.',start:[-4,-50] as SkatePoint,yaw:Math.PI},
  {id:'tidepools',name:'Tidepool Terrace',x:48,z:36,halfWidth:5,halfDepth:4,words:'Save a little speed for the way back.',start:[45,33] as SkatePoint,yaw:0},
] as const;
export type SkateSpotId = typeof SKATE_SPOTS[number]['id'];
export const SKATE_RAMPS:readonly SkateRamp[] = [
  {id:'tideline-halfpipe',x:31,z:-15,width:6,length:12,height:2.1,yaw:0,kind:'halfpipe'},
  {id:'tideline-launch',x:19,z:-14,width:3.4,length:4,height:1.15,yaw:Math.PI,kind:'kicker'},
  {id:'tideline-funbox',x:24,z:-13,width:3,length:6,height:.75,yaw:Math.PI,kind:'table'},
  {id:'bookends-bank',x:-17,z:-6,width:3,length:6,height:.75,yaw:0,kind:'table'},
  {id:'drydock-launch',x:34,z:-32,width:3,length:4,height:.9,yaw:Math.PI,kind:'kicker'},
  {id:'orchard-hip',x:-45,z:32,width:3,length:6,height:1,yaw:Math.PI/2,kind:'table'},
  {id:'northlight-kicker',x:-7,z:-56,width:3,length:4,height:1.1,yaw:Math.PI,kind:'kicker'},
  {id:'tidepool-bank',x:50,z:36,width:3,length:5,height:.8,yaw:0,kind:'table'},
];
export const SKATE_RAILS:readonly SkateRail[] = [
  {id:'tideline-flatbar',name:'Tideline flatbar',a:[16,-8],b:[16,-18],height:.52},
  {id:'tideline-ledge',name:'The long ledge',a:[22,-8],b:[26,-8],height:.42},
  {id:'bookends-rail',name:'Bookends rail',a:[-11,-3],b:[-11,-10],height:.5},
  {id:'drydock-rail',name:'Drydock rail',a:[26,-29],b:[26,-36],height:.6},
  {id:'orchard-rail',name:'Orchard rail',a:[-42,30],b:[-42,35],height:.48},
  {id:'tidepool-rail',name:'Tidepool rail',a:[46,33],b:[46,39],height:.45},
];
export const SKATE_ROUTES = [
  {id:'first-line',name:'First light',detail:'A lap of Tideline. Learn the corners.',seconds:[24,36,55],points:[[20,-5],[15,-9],[15,-20],[25,-23],[38,-20],[38,-5],[24,-3]]},
  {id:'north-run',name:'Chase the lighthouse',detail:'Out of the square and all the way to Northlight.',seconds:[18,27,42],points:[[0,-8],[0,-18],[-3,-36],[-4,-47],[-5,-61]]},
  {id:'coast-run',name:'Salt on the wheels',detail:'Follow the east road to the tide pools.',seconds:[23,35,55],points:[[12,-1],[23,-4],[37,4],[45,20],[48,31],[49,43]]},
  {id:'orchard-run',name:'The scenic way',detail:'Find Bookends, then follow the western lane.',seconds:[22,34,52],points:[[-6,0],[-16,0],[-25,4],[-35,14],[-36,26],[-44,32]]},
  {id:'meadow-run',name:'Meet me by the sea',detail:'A south-road cruise through the long meadow.',seconds:[22,34,55],points:[[0,9],[0,20],[2,32],[0,44],[-10,48],[-17,51]]},
] as const;
export type SkateRouteId = typeof SKATE_ROUTES[number]['id'];
export const SKATE_DECKS = [
  {id:'tideline',name:'Tideline',colour:'#43c7b6',ink:'#153d41',discoveries:0},
  {id:'afterglow',name:'Afterglow',colour:'#ee9dc0',ink:'#823d71',discoveries:0},
  {id:'saltwood',name:'Saltwood',colour:'#e6ae56',ink:'#36536c',discoveries:0},
  {id:'orchard',name:'Wild apple',colour:'#b5d576',ink:'#355c42',discoveries:2},
  {id:'northlight',name:'Northlight',colour:'#89b9ef',ink:'#253453',discoveries:4},
  {id:'islander',name:'Islander',colour:'#f1dfb4',ink:'#9b443e',discoveries:6},
] as const;
export type SkateDeckId = typeof SKATE_DECKS[number]['id'];

export function rampLocal(r:SkateRamp,x:number,z:number):SkatePoint {
  const dx=x-r.x,dz=z-r.z,c=Math.cos(r.yaw),s=Math.sin(r.yaw);
  return [dx*c-dz*s,dz*c+dx*s];
}
export function rampWorld(r:SkateRamp,x:number,z:number):SkatePoint {
  const c=Math.cos(r.yaw),s=Math.sin(r.yaw);return [r.x+x*c+z*s,r.z+z*c-x*s];
}
/** Same profile is tessellated by the scene; no invisible launch volumes. */
export function rampRise(r:SkateRamp,localZ:number):number {
  const t=Math.max(0,Math.min(1,localZ/r.length+.5));
  if(r.kind==='kicker')return r.height*t*t;
  if(r.kind==='table')return r.height*Math.min(1,t*3,(1-t)*3);
  return r.height*Math.pow(Math.max(0,(Math.abs(t-.5)-.16)/.34),2);
}
export function skateSurface(x:number,z:number,ground:(x:number,z:number)=>number):{y:number;ramp:string|null} {
  let y=ground(x,z),ramp:string|null=null;
  if(SKATE_SPOTS.some(p=>Math.abs(x-p.x)<=p.halfWidth&&Math.abs(z-p.z)<=p.halfDepth))y+=.035;
  for(const r of SKATE_RAMPS){const [lx,lz]=rampLocal(r,x,z);if(Math.abs(lx)<=r.width/2&&Math.abs(lz)<=r.length/2){y+=rampRise(r,lz);ramp=r.id;break;}}
  return {y,ramp};
}
export function railPoint(r:SkateRail,t:number,ground:(x:number,z:number)=>number):{x:number;y:number;z:number} {
  return {x:r.a[0]+(r.b[0]-r.a[0])*t,z:r.a[1]+(r.b[1]-r.a[1])*t,
    y:ground(...r.a)+(ground(...r.b)-ground(...r.a))*t+r.height+.035};
}
