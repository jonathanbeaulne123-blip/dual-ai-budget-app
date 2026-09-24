/** Authored geography. Geometry, navigation, recreation and maps share these metres. */
export type Point3 = readonly [number, number, number];
export const MOUNTAIN_VERSION = 'hearth-mountain-1';
export const WORLD_BOUNDS = {minX:-180,maxX:180,minZ:-310,maxZ:84,minY:-8,maxY:150} as const;
export type District = {id:string;name:string;at:Point3;radius:number;biome:'garden'|'orchard'|'woods'|'meadow'|'alpine'|'summit';destination:string;words:string};
export const DISTRICTS: readonly District[] = [
  {id:'hearth',name:'Hearth Terrace',at:[94,20,-100],radius:22,biome:'garden',destination:'kitchen',words:'A front garden above the harbour. Come home by the long way.'},
  {id:'orchard',name:'Orchard Hollow',at:[-104,34,-136],radius:23,biome:'orchard',destination:'cottage',words:'Apple blossom, clover and a sunny doorstep for Hercules.'},
  {id:'library',name:'Library Woods',at:[99,51,-174],radius:23,biome:'woods',destination:'library',words:'A reading courtyard between the birches and the gorge.'},
  {id:'glasshouse',name:'Glasshouse Meadows',at:[-102,66,-213],radius:23,biome:'meadow',destination:'glasshouse',words:'Plans take root beside the water and the wildflowers.'},
  {id:'reservoir',name:'Reservoir Heights',at:[25,83,-239],radius:29,biome:'alpine',destination:'loft-banks',words:'The glass dam holds a visible picture of the shared Fund.'},
  {id:'summit',name:'Summit Commons',at:[5,110,-284],radius:23,biome:'summit',destination:'journey',words:'The whole neighbourhood below. A new way down ahead.'},
];
export const RESERVED_PLOTS = [
  {id:'woodland-clearing',name:'Woodland clearing',at:[-118,42,-170] as Point3,half:[11,9] as const,words:'An open woodland plot, held for a future idea.'},
  {id:'sunny-shelf',name:'Sunny meadow shelf',at:[112,60,-211] as Point3,half:[12,10] as const,words:'A sunny terrace with room to grow.'},
  {id:'high-terrace',name:'High rocky terrace',at:[-63,97,-273] as Point3,half:[10,9] as const,words:'A quiet high plot; its view and access are reserved.'},
] as const;
export const BUILDING_SITES = {home:[94,-100],cottage:[-104,-136],library:[99,-174],glasshouse:[-102,-213]} as const;
export const BASIN = {x:25,z:-239,bottom:72,top:88,radius:16,angle:Math.PI*.73} as const;
/** Uphill road control points. Alternating slopes give the descent room to breathe. */
const ROAD_CONTROL: readonly Point3[] = [[0,1.4,-45],[42,8,-62],[89,19,-85],[82,20,-112],[25,23,-109],[-43,28,-112],[-100,34,-123],[-103,35,-148],[-37,41,-157],[31,46,-155],[91,51,-167],[94,53,-192],[30,57,-194],[-37,61,-190],[-95,66,-203],[-108,69,-229],[-43,77,-251],[25,83,-261],[80,91,-253],[86,98,-279],[45,107,-292],[5,110,-284]];
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
/** Rounded horizontal bends; monotone elevation interpolation avoids overshooting a plateau. */
function rounded(points:readonly Point3[]):Point3[]{
  const out:Point3[]=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[Math.max(0,i-1)]!,b=points[i]!,c=points[i+1]!,d=points[Math.min(points.length-1,i+2)]!;
    const n=Math.max(8,Math.ceil(Math.hypot(c[0]-b[0],c[2]-b[2])/3));
    for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;
      const coord=(j:0|2)=>.5*((2*b[j])+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t2+(-a[j]+3*b[j]-3*c[j]+d[j])*t3);
      out.push([coord(0),mix(b[1],c[1],smooth(t)),coord(2)]);
    }
  }
  out.push(points[points.length-1]!);return out;
}
export const MOUNTAIN_ROAD: readonly Point3[] = rounded(ROAD_CONTROL.map(p=>[p[0]*.76,p[1],p[2]] as Point3));
export const TOWN_RACE_ROAD:readonly Point3[]=rounded([[0,1.4,-45],[-5,1.4,-25],[-5,1.4,-15],[18,1.4,-6],[24,1.4,18],[31,1.4,39],[31,1.4,58],[31,1.4,65]]);
export type RouteProjection={point:Point3;distance:number;index:number;t:number;gradientX:number;gradientZ:number};
type RouteIndex={cells:Map<string,number[]>;minX:number;maxX:number;minZ:number;maxZ:number};
const routeIndices=new WeakMap<object,RouteIndex>(),CELL=16;
function routeIndex(points:readonly Point3[]):RouteIndex{
  const cached=routeIndices.get(points);if(cached)return cached;
  const index:RouteIndex={cells:new Map(),minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!;
    for(let x=Math.floor(Math.min(a[0],b[0])/CELL);x<=Math.floor(Math.max(a[0],b[0])/CELL);x++)for(let z=Math.floor(Math.min(a[2],b[2])/CELL);z<=Math.floor(Math.max(a[2],b[2])/CELL);z++){
      const key=`${x}:${z}`,bucket=index.cells.get(key)??[];bucket.push(i);index.cells.set(key,bucket);
      index.minX=Math.min(index.minX,x);index.maxX=Math.max(index.maxX,x);index.minZ=Math.min(index.minZ,z);index.maxZ=Math.max(index.maxZ,z);
    }
  }routeIndices.set(points,index);return index;
}
export function nearestOnRoute(x:number,z:number,points:readonly Point3[]=MOUNTAIN_ROAD):RouteProjection{
  let bestD=Infinity,bestI=1,bestT=0;
  const check=(i:number)=>{const a=points[i-1]!,b=points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz,t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(l||1)),ex=x-a[0]-dx*t,ez=z-a[2]-dz*t,d=ex*ex+ez*ez;if(d<bestD){bestD=d;bestI=i;bestT=t;}};
  if(points.length<200){for(let i=1;i<points.length;i++)check(i);}
  else{
    const index=routeIndex(points),cx=Math.floor(x/CELL),cz=Math.floor(z/CELL),limit=Math.max(Math.abs(cx-index.minX),Math.abs(cx-index.maxX),Math.abs(cz-index.minZ),Math.abs(cz-index.maxZ));
    // Far landscape vertices must not expand hundreds of empty grid cells.
    const outside=Math.max(index.minX-cx,cx-index.maxX,index.minZ-cz,cz-index.maxZ);
    if(outside>2){for(let i=1;i<points.length;i++)check(i);}
    else for(let r=0;r<=limit;r++){
      for(let ix=cx-r;ix<=cx+r;ix++)for(let iz=cz-r;iz<=cz+r;iz++){if(r&&ix!==cx-r&&ix!==cx+r&&iz!==cz-r&&iz!==cz+r)continue;for(const i of index.cells.get(`${ix}:${iz}`)??[])check(i);}
      const border=Math.min(x-(cx-r)*CELL,(cx+r+1)*CELL-x,z-(cz-r)*CELL,(cz+r+1)*CELL-z);if(bestD<border*border)break;
    }
  }
  const a=points[bestI-1]!,b=points[bestI]!,dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz;
  return {point:[mix(a[0],b[0],bestT),mix(a[1],b[1],bestT),mix(a[2],b[2],bestT)],distance:Math.sqrt(bestD),index:bestI-1,t:bestT,gradientX:(b[1]-a[1])*dx/(l||1),gradientZ:(b[1]-a[1])*dz/(l||1)};
}
export const ROAD_HALF_WIDTH=4.8;
export const ROAD_LENGTH=MOUNTAIN_ROAD.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-MOUNTAIN_ROAD[i]![0],p[1]-MOUNTAIN_ROAD[i]![1],p[2]-MOUNTAIN_ROAD[i]![2]),0);
const downhill=[...MOUNTAIN_ROAD].reverse();
export const SKILL_BRANCHES=[
  {id:'dam-promenade',entry:30,exit:65,halfWidth:2,material:'metal' as const,via:[[48,91,-239],[42,89,-224],[25,88,-220],[8,87,-224],[-10,86,-222],[-30,82,-228],[-48,79,-241]] as Point3[]},
  {id:'library-balcony',entry:135,exit:170,halfWidth:1.6,material:'wood' as const,via:[[85,55,-187],[88,54.5,-174],[83,54,-164],[68,52.5,-161],[47,49,-155]] as Point3[]},
  {id:'hearth-awning',entry:242,exit:280,halfWidth:1.5,material:'wood' as const,via:[[35,23.94,-102],[60,23.92,-94],[79,23.9,-89],[90,21,-83],[94,21,-74],[84,21,-66],[67,17,-67]] as Point3[]},
].map(b=>({...b,points:rounded([downhill[b.entry]!,...b.via,downhill[b.exit]!]).map(p=>{const q=nearestOnRoute(p[0],p[2]),ends=[downhill[b.entry]!,downhill[b.exit]!],distance=Math.min(...ends.map(at=>Math.hypot(p[0]-at[0],p[2]-at[2]))),rise=3.8*smooth(distance/18),weight=1-smooth((q.distance-ROAD_HALF_WIDTH-b.halfWidth-.5)/3);return [p[0],mix(p[1],Math.max(p[1],q.point[1]+rise),weight),p[2]] as Point3;})}));
export const FOOTPATHS = [...DISTRICTS,...RESERVED_PLOTS].map(d=>{
  const q=nearestOnRoute(d.at[0],d.at[2]);return {id:d.id,points:[q.point,d.at] as readonly Point3[]};
});
export const RIVER:readonly Point3[]=[[25,82,-239],[10,70,-218],[-2,56,-189],[14,42,-163],[3,26,-133],[13,12,-97],[3,1,-57],[3,.18,-34],[-8,.18,-15],[-8,.18,20],[12,.05,48],[9,-.1,69]];
export const FUNICULAR_STOPS=[{id:'town',name:'Town square',at:[-20,1.31,-37] as Point3},{id:'hearth',name:'Hearth Terrace',at:[60,20,-95] as Point3},{id:'library',name:'Library Woods',at:[62,51,-169] as Point3},{id:'reservoir',name:'Reservoir Heights',at:[47,83,-240] as Point3}];
export const GONDOLA_STOPS=[{id:'quay',name:'Waterfront',at:[-22,.57,47] as Point3},{id:'summit',name:'Summit Commons',at:[-7,110,-277] as Point3}];
export type TransportKind='funicular'|'gondola';
export const TRANSPORT_STOPS={funicular:FUNICULAR_STOPS,gondola:GONDOLA_STOPS};
/** A shared elevated alignment for the cabin, track and supports. */
export function transportPoint(kind:TransportKind,from:number,to:number,t:number):Point3{
  const stops=TRANSPORT_STOPS[kind],v=from+(to-from)*smooth(t),i=Math.min(stops.length-2,Math.floor(v)),u=v-i,a=stops[i]!.at,b=stops[i+1]!.at;
  const x=mix(a[0],b[0],u),z=mix(a[2],b[2],u),base=mix(a[1],b[1],u);
  // The trestle clears every intermediate ridge; endpoints stay at platforms.
  const clearance=kind==='gondola'?24:4;
  const y=Math.max(base,mountainBaseHeight(x,z))+Math.sin(Math.PI*u)*clearance;
  return [x,y,z];
}
export function districtAt(x:number,z:number):District|null{return DISTRICTS.reduce<District|null>((best,d)=>Math.hypot(x-d.at[0],z-d.at[2])<(best?Math.hypot(x-best.at[0],z-best.at[2]):Infinity)?d:best,null);}
export function mountainContains(x:number,z:number):boolean{return z<-48&&z>=WORLD_BOUNDS.minZ&&Math.abs(x)<=165&&(nearestOnRoute(x,z).distance<=ROAD_HALF_WIDTH+.3||SKILL_BRANCHES.some(b=>nearestOnRoute(x,z,b.points).distance<=b.halfWidth+.3)||mountainBaseHeight(x,z)>-.3);}
/** Terrain is intentionally separate from elevated bridge decks. */
export function mountainBaseHeight(x:number,z:number):number{
  if(z>-48)return -.75;
  const envelope=smooth((-z-48)/30)*smooth((z+310)/18)*smooth((170-Math.abs(x))/35);
  let h=-.7;
  for(const d of [...DISTRICTS,...RESERVED_PLOTS]){
    const r='radius'in d?d.radius:16,dist=Math.hypot(x-d.at[0],z-d.at[2]);
    h=Math.max(h,d.at[1]-Math.max(0,dist-r)*.8);
  }
  h+=Math.sin(x*.16+z*.09)*Math.cos(z*.13)*1.8;
  for(const d of [...DISTRICTS,...RESERVED_PLOTS]){const r='radius'in d?d.radius:16,w=1-smooth((Math.hypot(x-d.at[0],z-d.at[2])-r+3)/8);h=mix(h,d.at[1],w);}
  const river=nearestOnRoute(x,z,RIVER),cut=1-smooth((river.distance-4)/7);
  if(z>-230)h=mix(h,Math.min(h,river.point[1]-2),cut);
  const lake=Math.hypot(x-BASIN.x,z-BASIN.z);if(lake<BASIN.radius+2)h=mix(h,BASIN.bottom-1,1-smooth((lake-BASIN.radius)/2));
  const road=nearestOnRoute(x,z),bridge=river.distance<9&&z>-230;
  if(!bridge&&road.distance<10)h=mix(h,road.point[1]-.1,1-smooth((road.distance-ROAD_HALF_WIDTH)/5));
  for(const path of FOOTPATHS){const p=nearestOnRoute(x,z,path.points);if(p.distance<4)h=mix(h,p.point[1]-.06,1-smooth((p.distance-1.8)/2.2));}
  // Stable foundations and sheltered arrival aprons, independent of nearby cuts.
  for(const d of DISTRICTS.slice(0,4)){const distance=Math.hypot(x-d.at[0],z-d.at[2]);if(distance<9)h=mix(h,d.at[1],1-smooth((distance-7)/2));}
  for(const stop of [...FUNICULAR_STOPS,...GONDOLA_STOPS]){const distance=Math.hypot(x-stop.at[0],z-stop.at[2]);if(distance<5)h=mix(h,stop.at[1],1-smooth((distance-3)/2));}
  h=mix(-.75,h,envelope);
  // Small authored cuts expose the approach and landing; the deck remains authoritative.
  for(const branch of SKILL_BRANCHES){const p=nearestOnRoute(x,z,branch.points);if(p.distance<branch.halfWidth+1)h=mix(h,Math.min(h,p.point[1]-.12),1-smooth(p.distance-branch.halfWidth));}
  return h;
}
export const WORLD_DEFINITION={version:MOUNTAIN_VERSION,bounds:WORLD_BOUNDS,districts:DISTRICTS,reservedPlots:RESERVED_PLOTS,road:MOUNTAIN_ROAD,paths:FOOTPATHS,river:RIVER,basin:BASIN,transport:TRANSPORT_STOPS,buildings:BUILDING_SITES} as const;
