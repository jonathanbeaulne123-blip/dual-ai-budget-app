/**
 * Guide-map data drawn from the shipped geography: coast and contours traced from the ground,
 * the road, lane, bridges, paths and stairs, the river, the dam and reservoir, stations,
 * gates, districts and plots. Coordinates are world x/z (the map's viewBox is world units).
 */
import {DISTRICTS,RESERVED_PLOTS,RIVER,MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,GORGE_BRIDGES,MOUNTAIN_PATH_GRAPH,TRANSPORT_LINES,DAM_PARTS,RESERVOIR,OVERLOOKS,TOWN_RACE_ROAD,mountainBaseHeight,type Point3} from './definition.ts';
import {MOUNTAIN_GATES} from './course.ts';
import {islandHeight} from './islandShape.ts';

export type MapLine={id:string;d:string;kind:string;label?:string};
export type MapPoint={id:string;x:number;z:number;kind:string;label:string};
const f=(n:number)=>Math.round(n*10)/10;
const path=(pts:readonly(readonly[number,number])[],close=false)=>pts.length?`M${pts.map(p=>`${f(p[0])} ${f(p[1])}`).join('L')}${close?'Z':''}`:'';
const xz=(pts:readonly Point3[],step=1)=>pts.filter((_,i)=>i%step===0||i===pts.length-1).map(p=>[p[0],p[2]] as const);

/** Marching squares over the ground at a coarse step; returns joined polylines per level. */
function contours(levels:readonly number[],step=4):{level:number;lines:[number,number][][]}[]{
  const minX=-196,maxX=196,minZ=-392,maxZ=84,cols=Math.floor((maxX-minX)/step),rows=Math.floor((maxZ-minZ)/step);
  const h=(x:number,z:number)=>z>-48?islandHeight(x,z):Math.max(islandHeight(x,z),mountainBaseHeight(x,z));
  const grid:number[]=[];for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++)grid.push(h(minX+c*step,minZ+r*step));
  const at=(c:number,r:number)=>grid[r*(cols+1)+c]!;
  return levels.map(level=>{
    const segs:[[number,number],[number,number]][]=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const v=[at(c,r),at(c+1,r),at(c+1,r+1),at(c,r+1)],x0=minX+c*step,z0=minZ+r*step;
      const e=(i:number):[number,number]=>{const a=[[0,0],[1,0],[1,1],[0,1]][i]!,b=[[1,0],[1,1],[0,1],[0,0]][i]!,va=v[i]!,vb=v[(i+1)%4]!,t=(level-va)/((vb-va)||1e-9);return [x0+(a[0]!+(b[0]!-a[0]!)*t)*step,z0+(a[1]!+(b[1]!-a[1]!)*t)*step];};
      const idx=(v[0]!>level?1:0)|(v[1]!>level?2:0)|(v[2]!>level?4:0)|(v[3]!>level?8:0);
      const table:Record<number,[number,number][]>={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};
      for(const [a,b] of table[idx]??[])segs.push([e(a),e(b)]);
    }
    // Join segments end to end into polylines.
    const key=(p:[number,number])=>`${f(p[0])},${f(p[1])}`,byStart=new Map<string,number[]>();
    segs.forEach((s,i)=>{for(const p of s){const k=key(p),l=byStart.get(k)??[];l.push(i);byStart.set(k,l);}});
    const used=new Set<number>(),lines:[number,number][][]=[];
    for(let i=0;i<segs.length;i++){if(used.has(i))continue;used.add(i);const line=[...segs[i]!];
      for(const dir of [1,-1])for(;;){const end=dir===1?line[line.length-1]!:line[0]!,next=(byStart.get(key(end))??[]).find(j=>!used.has(j));if(next===undefined)break;used.add(next);const s=segs[next]!,o=key(s[0])===key(end)?s[1]:s[0];if(dir===1)line.push(o);else line.unshift(o);}
      if(line.length>3)lines.push(line.filter((_,k)=>k%2===0||k===line.length-1));
    }
    return {level,lines};
  });
}
let cached:ReturnType<typeof build>|null=null;
function build(){
  const levels=contours([.2,25,50,75,100]);
  const lines:MapLine[]=[
    ...levels.flatMap(l=>l.lines.map((pts,i)=>({id:`contour:${l.level}:${i}`,d:path(pts),kind:l.level<1?'coast':'contour'}))),
    {id:'river',d:path(xz(RIVER)),kind:'river',label:'River'},
    {id:'reservoir',d:path(xz(RESERVOIR.shore),true),kind:'reservoir',label:'Reservoir'},
    {id:'road',d:path(xz(MOUNTAIN_ROAD_LINE.samples.map(s=>s.at),4)),kind:'road',label:'Mountain road'},
    {id:'lane',d:path(xz(ORCHARD_LANE_LINE.samples.map(s=>s.at),4)),kind:'lane',label:'Orchard Lane'},
    {id:'town-lane',d:path(xz(TOWN_RACE_ROAD,2)),kind:'lane',label:'Town lane'},
    ...GORGE_BRIDGES.map(b=>({id:`bridge:${b.id}`,d:path(xz(b.deck,3)),kind:'bridge',label:b.name})),
    ...MOUNTAIN_PATH_GRAPH.edges.filter(e=>e.kind!=='road').map(e=>({id:e.id,d:path(xz(e.points,2)),kind:e.kind})),
    {id:'dam',d:path(xz(DAM_PARTS.arc)),kind:'dam',label:'Glass dam'},
    ...Object.values(TRANSPORT_LINES).map(l=>({id:`transport:${l.kind}`,d:path(xz(l.path,6)),kind:l.kind,label:l.kind==='funicular'?'Funicular':'Gondola'})),
  ];
  const points:MapPoint[]=[
    ...DISTRICTS.map(d=>({id:d.id,x:d.at[0],z:d.at[2],kind:'district',label:d.name})),
    ...RESERVED_PLOTS.map(p=>({id:p.id,x:p.at[0],z:p.at[2],kind:'plot',label:p.name})),
    ...Object.values(TRANSPORT_LINES).flatMap(l=>l.stations.map(s=>({id:`${l.kind}:${s.id}`,x:s.platform.at[0],z:s.platform.at[2],kind:l.kind,label:`${s.name} ${l.kind}`}))),
    ...MOUNTAIN_GATES.map(g=>({id:g.id,x:g.at[0],z:g.at[2],kind:'gate',label:g.name??'Gate'})),
    ...OVERLOOKS.map(o=>({id:o.id,x:o.at[0],z:o.at[2],kind:'overlook',label:o.name})),
    {id:'town-square',x:0,z:0,kind:'town',label:'Town square'},
  ];
  return {viewBox:'-196 -392 392 476',lines,points};
}
/** Built on first use (the panel is lazy), then shared. */
export function mountainMap(){return cached??=build();}
