import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { addFlatPad, bed } from '../beds/profiles';
import { gradeRoute } from '../beds/solver';
import { box, districtAt, nearestOnPath, plan, solid } from '../structures/mesh';

export interface HostSite { id:string; door:XYZ; normal:XY; apron:XY[]; padId:string; approachBedId:string }
/** Physical doorway faces are omitted; the lintel, jambs and roof remain solid. */
export function buildHostSites(cuts:LandCuts,base:HeightQuery):HostSite[] {
  const sites:HostSite[]=[];
  for(const h of M.hosts){
    const [w,d]=h.footprint_m as unknown as XY,p=h.xy as unknown as XY;
    const normal:XY=h.door.startsWith('west')?[-1,0]:h.door.startsWith('east')?[1,0]:h.door.startsWith('south-east')?[Math.SQRT1_2,Math.SQRT1_2]:[0,1];
    // The Library doorway is on the southeast wall corner, with its approach square to that face.
    const extent=h.door.startsWith('south-east')?Math.min(w,d)/2:normal[0]! !==0?w/2:d/2;
    const door:XYZ=[p[0]!+normal[0]!*extent,h.h,p[1]!+normal[1]!*extent];
    const apronCentre:XY=[door[0]!+normal[0]!*4,door[2]!+normal[1]!*4],rotation=Math.atan2(normal[1]!,normal[0]!)*180/Math.PI;
    const pad=addFlatPad(cuts,`host.${h.id}`,'host',p,h.h,[w+2,d+2]);pad.placeId=h.placeIds[0]!;pad.door=door;
    const apron=addFlatPad(cuts,`host.${h.id}.apron`,'landing',apronCentre,h.h,[10,10],rotation);apron.door=door;
    const shell=solid(`host.${h.id}.walls`,'host','stone','wall',[],districtAt(...p)),roof=solid(`host.${h.id}.roof`,'host','stone','roof',[],districtAt(...p));
    const opening=2.4,clear=2.6,wall=.4,wallH=h.roofH_eu-.35;
    if(normal[0]! ===-1||normal[0]! ===1){
      const x=p[0]!+normal[0]!*(w/2-wall/2);for(const side of [-1,1])box(shell,[x,p[1]!+side*(d/4+opening/4)],h.h+wallH,[wall,(d-opening)/2],h.h);
      box(shell,[x,p[1]!],h.h+wallH,[wall,opening],h.h+clear);
      box(shell,[p[0]!-normal[0]!*(w/2-wall/2),p[1]!],h.h+wallH,[wall,d],h.h);
      for(const side of [-1,1])box(shell,[p[0]!,p[1]!+side*(d/2-wall/2)],h.h+wallH,[w,wall],h.h);
    }else{
      for(const side of [-1,1])box(shell,[p[0]!+side*(w/4+opening/4),p[1]!+d/2-wall/2],h.h+wallH,[(w-opening)/2,wall],h.h);
      box(shell,[p[0]!,p[1]!+d/2-wall/2],h.h+wallH,[opening,wall],h.h+clear);
      box(shell,[p[0]!,p[1]!-d/2+wall/2],h.h+wallH,[w,wall],h.h);
      for(const side of [-1,1])box(shell,[p[0]!+side*(w/2-wall/2),p[1]!],h.h+wallH,[wall,d],h.h);
    }
    box(roof,p,h.h+h.roofH_eu,[w+1,d+1],h.h+h.roofH_eu-.35);
    if(h.id==='library'){
      pad.rotationDegrees=-45;
      for(const geometry of [shell,roof])for(let i=0;i<geometry.positions.length;i+=3){const x=geometry.positions[i]!-p[0]!,z=geometry.positions[i+2]!-p[1]!;geometry.positions[i]! =p[0]!+(x+z)*Math.SQRT1_2;geometry.positions[i+2]! =p[1]!+(z-x)*Math.SQRT1_2;}
    }
    cuts.solids.push(shell,roof);
    // Connect to the local public route at its nearest point, then turn onto the apron normal.
    const preferred:Record<string,string[]>={home:['walk square'],bank:['walk square'],library:['spur library','walk garden'],glasshouse:['spur glasshouse','walk garden'],studio:['spur studio'],cottage:['spur cottage','walk garden'],boathouse:['spur boathouse']};
    const candidates=cuts.beds.filter(b=>preferred[h.id]!.includes(b.id));
    let nearest=candidates.map(b=>({b,...nearestOnPath(apronCentre,b.points)})).sort((a,b)=>a.distance-b.distance)[0]!;
    if(!nearest)throw new Error(`Missing public approach for ${h.id}`);
    const entry:XY=[door[0]!+normal[0]!*9,door[2]!+normal[1]!*9],start=plan(nearest.at),controls:XY[]=[start,entry,[door[0]!,door[2]!]];
    const lengthNeeded=Math.abs(nearest.at[1]!-h.h)/.08;
    if(lengthNeeded>nearest.distance+6){
      // A broad courtyard return increases accessible length without moving the door or street.
      const tangent:XY=[-normal[1]!,normal[0]!],extra=(lengthNeeded-nearest.distance)/2+8;
      controls.splice(1,0,[entry[0]!+tangent[0]!*extra,entry[1]!+tangent[1]!*extra],[entry[0]!+normal[0]!*8+tangent[0]!*extra,entry[1]!+normal[1]!*8+tangent[1]!*extra]);
    }
    const id=`host.${h.id}.approach`,points=gradeRoute(id,controls,base,.08,[{xy:start,height:nearest.at[1]!,reason:'public bed'},{xy:[door[0]!,door[2]!],height:h.h,reason:'door'}],cuts.diagnostics);
    const approach=bed(id,'walk',points);approach.maxGrade=.08;cuts.beds.push(approach);pad.serviceBedId=id;apron.serviceBedId=id;
    const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),outline:XY[]=[[-5,-5],[-5,5],[5,5],[5,-5]].map(([x,z])=>[apronCentre[0]!+x!*c-z!*s,apronCentre[1]!+x!*s+z!*c]);
    sites.push({id:h.id,door,normal,apron:outline,padId:pad.id,approachBedId:id});
  }
  return sites;
}
