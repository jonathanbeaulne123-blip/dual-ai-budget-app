import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { addFlatPad, bed } from '../beds/profiles';
import { gradeRoute } from '../beds/solver';
import { box, distance, districtAt, mitredSlab, nearestOnPath, plan, solid } from '../structures/mesh';

/** road (L1): the lay-by stands BESIDE its road, flush with it, never on the carriageway: its road-side edge is at the paved
 * half (5 eu) and it runs along the road at the road's height (a slab on a 5–9 % grade was a 0.3–0.6 step for 16 m of the
 * Drive, and at plot terraces.1 it lay across the whole carriageway). LAYBY_DEPTH is its depth off the paved edge. */
export const LAYBY_DEPTH=6;
/** A plot's retaining walls stand at local x = ±PLOT_WALL[0] and z = ±PLOT_WALL[1] (outside its 64 × 44 pad and 6 eu margin). */
const PLOT_WALL=[38,28] as const;
/** road (L1): half the opening cut in a plot wall where its service drive crosses it, square to the drive (its 5 eu + 1.5 clear
 * either side); along an oblique wall the gap is this over the sine of the crossing angle (capped). */
const PLOT_GATE=4;
/** One plot's serving geometry, from the manifest and the built road (buildReserves lays it; the Year Walk, built earlier, reads
 * the same service line). `edge` is the road's paved edge on the plot's side at the nearest point; the service drive leaves it
 * square to the road, turns to the apron and ends at the door; `layby` is the lay-by's centre, size and plan rotation. */
interface PlotService { id:string; road:BedCut; height:number; nearest:{at:XYZ;segment:number;along:number}; normal:XY; toward:number; door:XY; apron:XY; edge:XY; mouth:XY; layby:{centre:XY;size:XY;rotation:number}; line:XY[] }
function plotService(cuts:LandCuts,area:'terraces'|'bightShore',i:number):PlotService|undefined {
  const data=M.reserves[area]!,road=cuts.beds.find(b=>b.id===(area==='terraces'?'V01':'VBS'));if(!road)return undefined;
  const p=data.plots[i] as unknown as XY,rotation=data.rot_deg[i]!,nearest=nearestOnPath(p,road.points),height=nearest.at[1]!,theta=rotation*Math.PI/180,normal:XY=[-Math.sin(theta),Math.cos(theta)];
  const toward=(nearest.at[0]!-p[0]!)*normal[0]!+(nearest.at[2]!-p[1]!)*normal[1]!>=0?1:-1,door:XY=[p[0]!+normal[0]!*toward*22,p[1]!+normal[1]!*toward*22],apron:XY=[door[0]!+normal[0]!*toward*3,door[1]!+normal[1]!*toward*3];
  // The road's frame at the nearest point: unit tangent, and the side the plot is on.
  const a=road.points[nearest.segment]!,b=road.points[Math.min(road.points.length-1,nearest.segment+1)]!,len=Math.hypot(b[0]-a[0],b[2]-a[2])||1,t:XY=[(b[0]-a[0])/len,(b[2]-a[2])/len];
  let n:XY=[-t[1],t[0]];if((p[0]-nearest.at[0])*n[0]+(p[1]-nearest.at[2])*n[1]<0)n=[-n[0],-n[1]];
  const half=road.width/2+road.shoulder,edge:XY=[nearest.at[0]+n[0]*half,nearest.at[2]+n[1]*half],mouth:XY=[edge[0]+n[0]*LAYBY_DEPTH,edge[1]+n[1]*LAYBY_DEPTH];
  const layby={centre:[edge[0]+n[0]*LAYBY_DEPTH/2,edge[1]+n[1]*LAYBY_DEPTH/2] as XY,size:[16,LAYBY_DEPTH] as XY,rotation:Math.atan2(t[1],t[0])*180/Math.PI};
  return {id:`${data.placeIds[i]!}.service`,road,height,nearest,normal,toward,door,apron,edge,mouth,layby,line:[plan(nearest.at),edge,mouth,apron,door]};
}
/** W7-A (A1.3): each large plot's service drive (lay-by on its road → apron → door) at its level, from the manifest and the
 * built road - the same line buildReserves lays. The Year Walk (built before the reserves) meets these drives at grade. */
export function reserveServiceLines(cuts:LandCuts):{id:string;points:XYZ[]}[] {
  const out:{id:string;points:XYZ[]}[]=[];
  for(const area of ['terraces','bightShore']as const)M.reserves[area]!.plots.forEach((_,i)=>{const s=plotService(cuts,area,i);if(s)out.push({id:s.id,points:s.line.slice(1).map(q=>[q[0],s.height,q[1]] as XYZ)});});
  return out;
}
/** road (L1): the lay-by strip: mitred slab pieces along the road's own points (the stretch within 8 eu of the plot's nearest
 * point, ends interpolated), offset to the plot's side between the paved edge and LAYBY_DEPTH beyond it, at the road's heights.
 * Where a structure floor already carries the road beside the plot (the Prow gallery: its 17 eu floor is the pull-in) no strip is
 * laid; the pad stays as the lay-by's footprint (the kerb gap and the corridor's `layby` gap read it). */
function laybyStrip(cuts:LandCuts,id:string,s:PlotService):void {
  const road=s.road,pts=road.points,arcs=[0];for(let i=1;i<pts.length;i++)arcs.push(arcs[i-1]!+distance(plan(pts[i-1]!),plan(pts[i]!)));
  const total=arcs.at(-1)!,at=(q:number):XYZ=>{q=Math.max(0,Math.min(total,q));let i=arcs.findIndex(a=>a>=q);if(i<=0)return pts[0]!;const a=pts[i-1]!,b=pts[i]!,t=(q-arcs[i-1]!)/((arcs[i]!-arcs[i-1]!)||1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];};
  const from=Math.max(0,s.nearest.along-8),to=Math.min(total,s.nearest.along+8),line:XYZ[]=[at(from),...pts.filter((_,i)=>arcs[i]!>from+.2&&arcs[i]!<to-.2),at(to)];
  const pad={id:`${id}.layby`,kind:'landing' as const,centre:[s.layby.centre[0],s.height,s.layby.centre[1]] as XYZ,size:s.layby.size,rotationDegrees:s.layby.rotation,margin:0,blend:0,deck:true};cuts.pads.push(pad);
  // A gallery on this road (MANIFEST structures.<id> kind gallery with its route; its floor is laid later by structures) covers the
  // plot's stretch: its floor is the pull-in there.
  const covered=Object.values(M.structures as unknown as Record<string,{kind?:string;route?:string;xy?:number[];length_m?:number}>).some(g=>g&&typeof g==='object'&&g.kind==='gallery'&&g.route===road.id&&!!g.xy&&Math.abs(nearestOnPath(g.xy as unknown as XY,pts).along-s.nearest.along)<(g.length_m??60)/2+8);
  if(covered)return;
  const slab=solid(`${id}.layby.slab`,'pad','stone','floor',[],districtAt(...s.layby.centre)),half=road.width/2+road.shoulder;
  for(let i=1;i<line.length;i++){const a=line[i-1]!,b=line[i]!,len=distance(plan(a),plan(b))||1,left:XY=[-(b[2]-a[2])/len,(b[0]-a[0])/len],side=Math.sign(left[0]*(s.mouth[0]-s.edge[0])+left[1]*(s.mouth[1]-s.edge[1]))||1;
    mitredSlab(slab,line,i,LAYBY_DEPTH,.35,side*(half+LAYBY_DEPTH/2));}
  cuts.solids.push(slab);
}
export function buildReserves(cuts:LandCuts,base:HeightQuery):void {
  for(const area of ['terraces','bightShore']as const){
    const data=M.reserves[area]!;
    data.plots.forEach((coords,i)=>{
      const p=coords as unknown as XY,id=data.placeIds[i]!,rotation=data.rot_deg[i]!,s=plotService(cuts,area,i)!,{height,door,apron}=s;
      // A pad's level comes from its serving lay-by, so accessibility is a geometric constraint.
      const pad=addFlatPad(cuts,id,'reserve',p,height,data.size_m as unknown as XY,rotation);pad.margin=6;pad.blend=8;pad.placeId=id;
      const theta=rotation*Math.PI/180;pad.door=[door[0]!,height,door[1]!];
      addFlatPad(cuts,`${id}.apron`,'landing',apron,height,[14,6],rotation);
      // road (L1): the lay-by beside the road (LAYBY_DEPTH off the paved edge, 16 eu along it), flush with the road's edge
      // everywhere: a strip that follows the road's own heights, not a flat slab (on the Drive's 7 % a flat 16 m slab stood
      // 0.56 proud of the edge at one end). Its pad is a deck (it shapes no terrain; the road's blend is its ground).
      laybyStrip(cuts,id,s);
      // The service drive leaves the road's edge (a flush entry: its first metres are the road's own shoulder height), crosses
      // the lay-by square to the road and runs to the apron and the door, level.
      const serviceId=`${id}.service`;pad.serviceBedId=serviceId;
      const pts=gradeRoute(serviceId,s.line.slice(1),()=>height,.12,[{xy:s.edge,height,reason:'the road edge'},{xy:door,height,reason:'apron'}],cuts.diagnostics);cuts.beds.push(bed(serviceId,'spur',pts));
      const wall=solid(`${id}.retaining`,'retainingWall','rock','wall',[serviceId],districtAt(...p));
      // Walls are outside the entire six metre clear margin, with an open service side. road (L1): the service drive passes
      // through the wall on the service side: that wall is laid in two runs with a gap where the drive crosses it
      // (the drive stalled against it at every plot: the wall stood across its line 6 eu inside the door).
      const wallSection=(dx:number,dz:number,size:XY)=>{const x=p[0]+dx*Math.cos(theta)-dz*Math.sin(theta),z=p[1]+dx*Math.sin(theta)+dz*Math.cos(theta),ground=base(x,z);box(wall,[x,z],height+1.15,size,Math.min(ground-.2,height-.6),rotation);};
      // road (L1): each wall is laid in runs with a gate wherever the service drive's own line crosses it (the drive stalled
      // against the side or service wall at every plot).
      const local=(q:XYZ):XY=>{const dx=q[0]-p[0],dz=q[2]-p[1];return [dx*Math.cos(theta)+dz*Math.sin(theta),-dx*Math.sin(theta)+dz*Math.cos(theta)];},drive=pts.map(local);
      const walls:{axis:0|1;at:number}[]=[{axis:0,at:-PLOT_WALL[0]},{axis:0,at:PLOT_WALL[0]},{axis:1,at:-PLOT_WALL[1]},{axis:1,at:PLOT_WALL[1]}];
      for(const w of walls){const span=w.axis===0?PLOT_WALL[1]:PLOT_WALL[0],gaps:[number,number][]=[];
        for(let k=1;k<drive.length;k++){const a=drive[k-1]!,b=drive[k]!,da=a[w.axis]-w.at,db=b[w.axis]-w.at;if(da*db>0||da===db)continue;
          const t=da/(da-db),u=a[1-w.axis]!+(b[1-w.axis]!-a[1-w.axis]!)*t,len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,sin=Math.max(.35,Math.abs(b[w.axis]-a[w.axis])/len);
          if(Math.abs(u)<=span+PLOT_GATE)gaps.push([u-PLOT_GATE/sin,u+PLOT_GATE/sin]);}
        let from=-span;for(const [g0,g1] of gaps.sort((m,n)=>m[0]-n[0])){if(g0-from>.5){const c=(from+Math.min(g0,span))/2,l=Math.min(g0,span)-from;w.axis===0?wallSection(w.at,c,[.6,l]):wallSection(c,w.at,[l,.6]);}from=Math.max(from,g1);}
        if(span-from>.5){const c=(from+span)/2,l=span-from;w.axis===0?wallSection(w.at,c,[.6,l]):wallSection(c,w.at,[l,.6]);}}
      cuts.solids.push(wall);const marker=solid(`${id}.marker`,'threshold','stone','marker',[serviceId],districtAt(...p));box(marker,door,height+.025,[2,.6],height-.05,rotation);cuts.solids.push(marker);
      const green=M.protected.green,localCentre:XY=[green.cx-p[0]!,green.cy-p[1]!];
      const lx=localCentre[0]!*Math.cos(theta)+localCentre[1]!*Math.sin(theta),lz=-localCentre[0]!*Math.sin(theta)+localCentre[1]!*Math.cos(theta),clearance=Math.hypot(Math.max(0,Math.abs(lx)-38),Math.max(0,Math.abs(lz)-28));
      if(clearance<green.r)cuts.diagnostics.push({id:`reserve.${id}.green`,severity:'conflict',message:`${id} clear margin enters the Green`,measured:clearance,required:green.r});
    });
  }
  for(const [id,r]of Object.entries(M.reserves.small)){
    // v1.9: the hangar bay's door faces the strip (west) and its access walk is its service (plot.<n>.service), from the
    // strip's east edge to the door, outside the plot (P31: the access ran through the plot; was hangar.access).
    const under=id==='sealedDrift',p=r.xy as unknown as XY,pad=addFlatPad(cuts,r.placeId,'reserve',p,under?42:38,under?[18,12]:[11,18],0,under),doorX=under?p[0]!+9:p[0]!-5.5;pad.placeId=r.placeId;pad.margin=6;pad.door=[doorX,pad.centre[1]!,p[1]!];pad.serviceBedId=under?'underground.sealedDrift':`${r.placeId}.service`;
    if(!under){const strip=M.structures.strip,t=(p[1]!-strip.from[1]!)/(strip.to[1]!-strip.from[1]!),edge=strip.from[0]!+(strip.to[0]!-strip.from[0]!)*t+strip.width_m/2;cuts.beds.push(bed(`${r.placeId}.service`,'walk',[[Math.min(edge,doorX-1),38,p[1]!],[doorX,38,p[1]!]]));}
  }
}
