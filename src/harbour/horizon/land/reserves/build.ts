import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { addFlatPad, bed } from '../beds/profiles';
import { gradeRoute } from '../beds/solver';
import { box, districtAt, nearestOnPath, plan, solid } from '../structures/mesh';

/** W7-A (A1.3): each large plot's service drive (lay-by on its road → apron → door) at its level, from the manifest and the
 * built road - the same line buildReserves lays. The Year Walk (built before the reserves) meets these drives at grade. */
export function reserveServiceLines(cuts:LandCuts):{id:string;points:XYZ[]}[] {
  const out:{id:string;points:XYZ[]}[]=[];
  for(const area of ['terraces','bightShore']as const){
    const data=M.reserves[area]!,road=cuts.beds.find(b=>b.id===(area==='terraces'?'V01':'VBS'));if(!road)continue;
    data.plots.forEach((coords,i)=>{
      const p=coords as unknown as XY,rotation=data.rot_deg[i]!,nearest=nearestOnPath(p,road.points),height=nearest.at[1]!,theta=rotation*Math.PI/180,normal:XY=[-Math.sin(theta),Math.cos(theta)];
      const toward=(nearest.at[0]!-p[0]!)*normal[0]!+(nearest.at[2]!-p[1]!)*normal[1]!>=0?1:-1,door:XY=[p[0]!+normal[0]!*toward*22,p[1]!+normal[1]!*toward*22],apron:XY=[door[0]!+normal[0]!*toward*3,door[1]!+normal[1]!*toward*3];
      out.push({id:`${data.placeIds[i]!}.service`,points:[plan(nearest.at),apron,door].map(q=>[q[0],height,q[1]] as XYZ)});
    });
  }
  return out;
}
export function buildReserves(cuts:LandCuts,base:HeightQuery):void {
  for(const area of ['terraces','bightShore']as const){
    const data=M.reserves[area]!,road=cuts.beds.find(b=>b.id===(area==='terraces'?'V01':'VBS'))!;
    data.plots.forEach((coords,i)=>{
      const p=coords as unknown as XY,id=data.placeIds[i]!,rotation=data.rot_deg[i]!,nearest=nearestOnPath(p,road.points);
      // A pad's level comes from its serving lay-by, so accessibility is a geometric constraint.
      const height=nearest.at[1]!,pad=addFlatPad(cuts,id,'reserve',p,height,data.size_m as unknown as XY,rotation);pad.margin=6;pad.blend=8;pad.placeId=id;
      const theta=rotation*Math.PI/180,normal:XY=[-Math.sin(theta),Math.cos(theta)],toward=(nearest.at[0]!-p[0]!)*normal[0]!+(nearest.at[2]!-p[1]!)*normal[1]!>=0?1:-1;
      const door:XY=[p[0]!+normal[0]!*toward*22,p[1]!+normal[1]!*toward*22],apron:XY=[door[0]!+normal[0]!*toward*3,door[1]!+normal[1]!*toward*3];pad.door=[door[0]!,height,door[1]!];
      addFlatPad(cuts,`${id}.apron`,'landing',apron,height,[14,6],rotation);addFlatPad(cuts,`${id}.layby`,'landing',plan(nearest.at),height,[16,7],rotation);
      const serviceId=`${id}.service`;pad.serviceBedId=serviceId;const pts=gradeRoute(serviceId,[plan(nearest.at),apron,door],()=>height,.12,[{xy:door,height,reason:'apron'}],cuts.diagnostics);cuts.beds.push(bed(serviceId,'spur',pts));
      const wall=solid(`${id}.retaining`,'retainingWall','rock','wall',[serviceId],districtAt(...p));
      // Walls are outside the entire six metre clear margin, with an open service side.
      const wallSection=(dx:number,dz:number,size:XY)=>{const x=p[0]+dx*Math.cos(theta)-dz*Math.sin(theta),z=p[1]+dx*Math.sin(theta)+dz*Math.cos(theta),ground=base(x,z);box(wall,[x,z],height+1.15,size,Math.min(ground-.2,height-.6),rotation);};
      for(const side of [-1,1])wallSection(side*38,0,[.6,56]);
      wallSection(0,-toward*28,[76,.6]);
      for(const side of [-1,1])wallSection(side*22.5,toward*28,[31,.6]);
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
