/**
 * The house archetype: a plinth, walls in the dressing's construction, a roof of the record's form (gable, hip,
 * pyramid, shed or flat) whose drawn planes are its collision planes, a door, windows and an optional chimney.
 * Crofts, longhouses, barns, shielings, lift stations, cottages, studios, sheds, shacks and the prairie station are
 * this archetype with their own walls, roofs and openings.
 */
import {
  box,rectOf,plinth,footShade,walls,band,windowAt,doorAt,roofGable,gableVols,roofHip,hipVols,roofShed,shedVols,roofFlat,flatVols,
  stencil,ICON,faceHalf,doorFace,shade,pick,
  type DrawCtx,type Plan,type Rect,type Vol,type RGB,
} from './core.ts';
import type {BuildingRecord,Face} from '../../neighbourhoods/types.ts';

export type HouseForm='gable'|'hip'|'shed'|'flat';
export type HousePlan=Plan&{r:Rect;wallH:number;rise:number;ov:number;form:HouseForm;chimney:[number,number]|null;chimTop:number;parapet:number};
export type HouseOpts={pitch?:number;ov?:number;chimney?:boolean|'gable'|'side';parapet?:number;ovx?:number};

const rad=(d:number)=>d*Math.PI/180;
export function formOf(rec:BuildingRecord):HouseForm{const f=rec.roof.form;return f==='hip'||f==='pyramid'?'hip':f==='shed'?'shed':f==='flat'||f==='none'?'flat':'gable';}
export function housePlan(rec:BuildingRecord,o:HouseOpts={}):HousePlan{
  const r=rectOf(rec.size.w/2,rec.size.d/2),wallH=Math.max(1.8,rec.size.h),form=formOf(rec),pitch=rec.roof.pitch||o.pitch||35;
  const ov=rec.roof.overhang>0?rec.roof.overhang:(o.ov??.4),half=form==='hip'?Math.min(r.hx,r.hz):r.hz,rise=form==='flat'?0:form==='shed'?2*r.hz*Math.tan(rad(pitch)):half*Math.tan(rad(pitch));
  const parapet=form==='flat'?(o.parapet??.5):0;
  const vols:Vol[]=[box(0,0,r.hx+.18,r.hz+.18,'ground',0,'support','stone'),box(0,0,r.hx,r.hz,0,wallH,'wall','stone')];
  if(form==='gable')vols.push(...gableVols(r,wallH,rise,ov,o.ovx??ov*.6));else if(form==='hip')vols.push(...hipVols(r,wallH,rise,ov));else if(form==='shed')vols.push(...shedVols(r,wallH,rise,ov));else vols.push(...flatVols(r,wallH,parapet));
  let chimney:[number,number]|null=null,chimTop=0;
  if(o.chimney){chimney=o.chimney==='gable'?[r.hx-.45,0]:o.chimney==='side'?[0,-r.hz+.45]:[r.hx*.55,-r.hz*.3];chimTop=wallH+rise+1.1;vols.push(box(chimney[0],chimney[1],.35,.35,wallH,chimTop,'wall','stone'));}
  return {vols,eave:wallH,top:Math.max(wallH+rise+(parapet>0?parapet+.08:0)+(form==='shed'?ov*rise/(2*r.hz):0),chimTop),r,wallH,rise,ov,form,chimney,chimTop,parapet};
}
export type HouseDraw={wall:RGB;roof:RGB;skin?:DrawCtx['pal']['skin'];ridge?:RGB;chimney?:RGB;plinthCol?:RGB;eaveBand?:RGB;base?:RGB;ovx?:number;seams?:number;seamCol?:RGB;shade?:boolean};
/** Plinth, walls, bands, roof and chimney; openings are the caller's. */
export function houseShell(c:DrawCtx,p:HousePlan,o:HouseDraw){
  const {b,F,pal,full,floor}=c,{r}=p,eave=floor+p.wallH;
  plinth(c,r,floor,.18,o.plinthCol);walls(c,r,floor,eave,o.wall,{skin:o.skin});
  if(o.base)band(c,r,floor,floor+.6,o.base,.03);
  if(o.eaveBand)band(c,r,eave-.22,eave,o.eaveBand,.06);
  const ro={col:o.roof,wall:o.wall,ridge:o.ridge,seams:o.seams,seamCol:o.seamCol};
  if(p.form==='gable')roofGable(c,r,eave,p.rise,p.ov,ro,o.ovx??p.ov*.6);else if(p.form==='hip')roofHip(c,r,eave,p.rise,p.ov,ro);else if(p.form==='shed')roofShed(c,r,eave,p.rise,p.ov,ro);else roofFlat(c,r,eave,p.parapet,o.wall,o.wall,pal.trim);
  if(p.chimney){const q=F.W(p.chimney[0],p.chimney[1],0),col=o.chimney??pal.stone;b.box(q[0],q[2],F.yaw,.35,.35,eave+p.rise*.2,floor+p.chimTop,col,shade(col,.84));if(full)b.box(q[0],q[2],F.yaw,.45,.45,floor+p.chimTop,floor+p.chimTop+.14,pal.stoneLit,shade(pal.stoneLit,.8));}
  if(o.shade!==false)footShade(c,r);
}
/** The door on its face (record `door.u` is the offset along the face, eu) and evenly spaced windows that avoid it. */
export function houseOpenings(c:DrawCtx,p:HousePlan,o:{door?:{w?:number;h?:number;col?:RGB;arch?:boolean}|false;win?:{w:number;h:number;sill:number;arch?:boolean;shutters?:boolean};faces?:readonly Face[];spacing?:number;lit?:number;skipGable?:boolean}={}){
  const {rec,pal,floor,full}=c,{r}=p,df=doorFace(rec),hl=faceHalf(r,df),du=Math.max(-hl+.8,Math.min(hl-.8,rec.door?.u??0));
  if(o.door!==false){const d=o.door??{};doorAt(c,r,df,du,floor,d.w??1.05,Math.min(d.h??2.1,p.wallH-.3),d.col??pal.door,{arch:d.arch,lit:d.arch});}
  const win=o.win??{w:.8,h:1,sill:1},spacing=o.spacing??2.6,faces=o.faces??['front','back','left','right'];
  for(const f of faces){if(o.skipGable&&(f==='left'||f==='right'))continue;const h=faceHalf(r,f),n=Math.max(1,Math.floor((h*2-.6)/spacing));
    for(let i=0;i<n;i++){const u=-h+h*2*(i+.5)/n;if(f===df&&Math.abs(u-du)<1.2)continue;if(win.sill+win.h>p.wallH-.2)continue;
      windowAt(c,r,f,u,floor+win.sill,win.w,win.h,{lit:c.h(i*7+f.length)<(o.lit??.6),arch:win.arch,shutters:win.shutters&&full?'open':false});}}
  if(c.theme==='taylor'&&full)stencil(c,r,df,du,floor+Math.min(p.wallH-.4,2.6),.18,ICON.hearth,pal.tape[0]!);
}
export {pick};
