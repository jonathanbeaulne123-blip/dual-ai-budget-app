import { Box3, Triangle, Vector3 } from 'three';
import { solidBounds } from '../../world/geometry';
import type { BridgeDefinition } from './types';
import type { LandDiagnostic, XYZ } from '../interfaces';
import { bridgeFrame, bridgeLength } from './frames';
import { nearestOnPath } from '../structures/mesh';
interface Geometry {
  surface(x:number,z:number,y:number,step:number):{id:string;y:number}|null;
  ceiling(x:number,z:number,y:number):number;
  blocker(x:number,z:number,y:number,radius:number):string|null;
}
/** Offline samples use the collision query itself. A green sample grid is not a ridden
 * or swept-volume acceptance; witnesses remain serialized for independent replay. */
export function measureBridgeEnvelopes(bridges:BridgeDefinition[],g:Geometry,diagnostics:LandDiagnostic[]):void {
  for(const b of bridges){
    let samples=0,blocked=0,missing=0,error=0,headroom=Infinity,witness:XYZ|null=null;
    const check=(p:XYZ)=>{
      samples++;const hit=g.surface(p[0],p[2],p[1],.48);
      if(!hit||!(hit.id.startsWith(b.id+'.')||hit.id.startsWith(b.route+'.'))){missing++;witness??=p;return;}
      const dy=Math.abs(hit.y-p[1]);error=Math.max(error,dy);
      const clear=g.ceiling(p[0],p[2],hit.y)-hit.y;headroom=Math.min(headroom,clear);
      if(g.blocker(p[0],p[2],hit.y,.3)||clear<1.3||dy>.02){blocked++;witness??=p;}
    };
    // Hollow shares the crossing with S4: its clear walking strip is 0.6 m
    // toward the shelter, beside the retained skate rail. No controller steering is changed.
    const offset=b.family==='covered'?.6:0;
    const length=bridgeLength(b.path),n=Math.ceil(length/.25);
    for(let k=0;k<=n;k++)for(const off of [-.6,0,.6])check(bridgeFrame(b.path,length*k/n,off+offset));
    b.passages[0]={...b.passages[0]!,width:1.8,headroom:Number.isFinite(headroom)?headroom:null,status:blocked||missing?'blocked':'measured',
      reason:'Static 1.8 m walking envelope sampled against final collision; real-controller traversal and full swept volume remain separate.',
      envelope:{offset,height:1.3,radius:.3,sampleStep:.25,samples,blocked,missing,maximumSurfaceError:error,witness}};
    diagnostics.push({id:`bridges.${b.id}.walkEnvelope`,severity:blocked||missing?'conflict':'info',message:`${b.name}: ${blocked} blocked and ${missing} unsupported of ${samples} collision samples; maximum surface error ${error.toFixed(4)}. Static samples only.`,measured:blocked+missing,required:0,...(witness?{at:[witness[0],witness[2]] as const}:{})});
    const start=samples,before=blocked+missing,station=nearestOnPath([b.meeting.at[0],b.meeting.at[2]],b.path).along;
    const a=bridgeFrame(b.path,Math.max(0,station-.1)),c=bridgeFrame(b.path,Math.min(length,station+.1)),d=Math.hypot(c[0]-a[0],c[2]-a[2])||1,dx=(c[0]-a[0])/d,dz=(c[2]-a[2])/d;
    for(let u=-1.5;u<=1.5;u+=.25)for(let v=-1.5;v<=1.5;v+=.25)check([b.meeting.at[0]+dx*u-dz*v,b.meeting.at[1],b.meeting.at[2]+dz*u+dx*v]);
    b.meeting.status=blocked+missing===before?'built':'unverified';
    diagnostics.push({id:`bridges.${b.id}.meetingEnvelope`,severity:blocked+missing===before?'info':'conflict',message:`${b.meeting.name}: ${blocked+missing-before} failing samples of ${samples-start} across the flat 3 x 3 m standing area. Walking access remains a separate runtime test.`,measured:blocked+missing-before,required:0});
  }
}

/** A flight gate's plane is not the whole crossing. Test its full rectangular aperture
 * through the deck's width against actual member triangles, including thin hangers. */
export function measureBridgeFlightEnvelopes(bridges:BridgeDefinition[],solids:import('../interfaces').StructureSolid[],sky:import('../../world/definition').FlightEnvelope,diagnostics:LandDiagnostic[]):void {
  for(const b of bridges){const gate=sky.volumes?.find(v=>v.kind==='gate'&&v.id===b.id);if(!gate)continue;
    const centre=nearestOnPath([gate.centre[0],gate.centre[2]],b.path).at,c=Math.cos(gate.yaw),s=Math.sin(gate.yaw),halfW=gate.halfSize[0],halfH=gate.halfSize[1],halfD=b.width/2+2;
    const box=new Box3(new Vector3(-halfW,-halfH,-halfD),new Vector3(halfW,halfH,halfD)),triangle=new Triangle();
    const local=(out:Vector3,x:number,y:number,z:number)=>{const dx=x-centre[0],dz=z-centre[2];return out.set(dx*c-dz*s,y-gate.centre[1],dx*s+dz*c);};
    const hits=new Set<string>();
    for(const solid of solids){
      const bounds=solidBounds(solid),radius=halfW+halfD+2;
      if(bounds.max[0]<centre[0]-radius||bounds.min[0]>centre[0]+radius||bounds.max[2]<centre[2]-radius||bounds.min[2]>centre[2]+radius||bounds.max[1]<gate.centre[1]-halfH||bounds.min[1]>gate.centre[1]+halfH)continue;
      for(let i=0;i<solid.indices.length;i+=3){for(let j=0;j<3;j++){const k=solid.indices[i+j]!*3;local(j===0?triangle.a:j===1?triangle.b:triangle.c,solid.positions[k]!,solid.positions[k+1]!,solid.positions[k+2]!);}if(box.intersectsTriangle(triangle)){hits.add(solid.id);break;}}
    }
    b.passages.push({id:`${b.id}.flight`,mode:'glider',relation:'through',route:gate.id,width:halfW*2,headroom:halfH*2,status:hits.size?'blocked':'measured',reason:`Full crossing aperture tested against member triangles; ${hits.size} intersecting solids: ${[...hits].join(', ')||'none'}. A ridden flight and terrain envelope remain separate.`});
    diagnostics.push({id:`bridges.${b.id}.flightEnvelope`,severity:hits.size?'conflict':'info',message:b.passages.at(-1)!.reason,measured:hits.size,required:0,at:[centre[0],centre[2]]});
  }
}
