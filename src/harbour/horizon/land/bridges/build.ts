import { bridgeLength, bridgeFrame } from './frames';
import { bed } from '../beds/profiles';
import type { HeightQuery, LandCuts, StructureSolid, XYZ } from '../interfaces';
import { box, districtAt, mix, prism, slab, solid } from '../structures/mesh';
import { pier } from '../structures/foundations';
import { BRIDGE_CAST } from './catalog';
import type { BridgeDefinition } from './types';

const clear=(s:StructureSolid|undefined)=>{if(s){s.positions=[];s.indices=[];}};
/** Architectural members replace the generic support kit. Deck axes/grades and their route ownership stay intact. */
export function buildBridgeLandmarks(cuts:LandCuts,ground:HeightQuery):void {
  cuts.bridges=[];
  for(const c of BRIDGE_CAST){
    const carried=cuts.beds.find(b=>b.id===`structure.${c.id}`);if(!carried)continue;
    const path=carried.points,L=bridgeLength(path),W=carried.width,mid=bridgeFrame(path,L/2),district=districtAt(mid[0],mid[2]);
    const P=(s:number,o=0,h=0)=>bridgeFrame(path,s,o,h);
    const own=()=>cuts.solids.filter(s=>s.id.startsWith(c.id+'.'));
    const get=(suffix:string)=>cuts.solids.find(s=>s.id===`${c.id}.${suffix}`);
    const make=(suffix:string,kind:string,surface='timber',role:StructureSolid['role']='support')=>{const s=solid(`${c.id}.${suffix}`,kind,surface,role,[...carried.structureIds.map(id=>'structure.'+id),...get('deck')?.bedIds??[]],district);cuts.solids.push(s);return s;};
    const beam=(out:StructureSolid,s0:number,s1:number,o:number,h0:number,h1:number,w=.35,d=.4)=>slab(out,P(s0,o,h0),P(s1,o,h1),w,d);
    const post=(out:StructureSolid,s:number,o:number,low:number,high:number,w=.4)=>{const p=P(s,o);box(out,[p[0],p[2]],p[1]+high,[w,w],p[1]+low);};
    const lights:BridgeDefinition['lights']=(cuts.bridgeLightSeeds?.[c.id]??[]).map((at,i)=>({id:`bridge.${c.id}.light.${i}`,at,kind:'necklace'}));
    const lamp=(s:number,o:number,h:number,kind:BridgeDefinition['lights'][number]['kind']='lantern')=>lights.push({id:`bridge.${c.id}.light.${lights.length}`,at:P(s,o,h),kind});
    if(c.family==='arch'){
      clear(get('truss'));const ribs=make('ribs','arch','metal');const from=(L-44)/2,to=(L+44)/2;
      const seats=make('springingSeats','capBeam','stone');
      for(const station of [from,to])slab(seats,P(station,-W/2-1,-.4),P(station,W/2+1,-.4),1.4,.2);
      for(const side of [-1,1]){const off=side*(W/2+.5),N=20,Y=(t:number)=>9*4*t*(1-t);
        for(let k=0;k<N;k++)beam(ribs,mix(from,to,k/N),mix(from,to,(k+1)/N),off,Y(k/N),Y((k+1)/N),.7,.7);
        for(let k=1;k<N;k+=2){const s=mix(from,to,k/N);post(ribs,s,off,-.55,Y(k/N)-.5,.2);lamp(s,off,Y(k/N),'rib');}}
    }else if(c.family==='bascule'){
      clear(get('supports'));const supports=get('supports')!,bearings=make('hingeBeams','capBeam','metal'),houses=make('machinery','headFrame','stone');
      const from=L/2-18,to=L/2+18;
      for(const s of [0,from,to,L]){for(const side of [-1,1]){const p=P(s,side*(W/2-.7));pier(supports,[p[0],p[2]],p[1]-.6,ground,[1.2,1.2],[2.6,2.6]);}slab(bearings,P(s,-W/2,-.6),P(s,W/2,-.6),1.2,.6);}
      for(const [s,direction] of [[from,-1],[to,1]])for(const side of [-1,1]){
        const p=P(s!,side*(W/2+1.2));pier(supports,[p[0],p[2]],p[1]+.1,ground,[2,2],[3.2,3.2]);
        box(houses,[p[0],p[2]],p[1]+4.2,[2,2],p[1]);
        beam(bearings,s!,s!+direction!*5,side*(W/2+.7),1.4,3.5,.5,.7);
        lamp(s!,side*(W/2+1.2),4.55);
      }
      // Closed leaves have their own visibly expressed underside girders and a centre joint.
      const leaves=make('leafGirders','beam','metal');for(const side of [-1,1]){beam(leaves,from,L/2,side*(W/2-.6),-.6,-.6,.5,.55);beam(leaves,L/2,to,side*(W/2-.6),-.6,-.6,.5,.55);}
    }else if(c.family==='ribbon'){
      clear(get('supports'));const supports=get('supports')!,ribbon=make('tensionRibbon','beam','metal');
      for(const s of [0,L])for(const side of [-1,1]){const p=P(s,side*(W/2-.4));pier(supports,[p[0],p[2]],p[1]-.6,ground,[.8,.8],[2.5,2.5]);}
      for(const side of [-1,1])for(let k=0;k<20;k++){const Y=(t:number)=>-.6-.15*Math.sin(Math.PI*t);beam(ribbon,L*k/20,L*(k+1)/20,side*(W/2-.3),Y(k/20),Y((k+1)/20),.24,.15);post(ribbon,L*k/20,side*(W/2-.3),Y(k/20)-.05,-.55,.18);}
      for(let s=0;s<=L;s+=5)lamp(s,W/2,1.12,'footlight');
    }else if(c.family==='covered'){
      const roof=get('roof')!;clear(roof);roof.surface='timber';const truss=make('roofTruss','truss');
      // Top plates overlap the existing posts and bear into the pitched roof.
      for(const side of [-1,1])beam(truss,0,L,side*(W/2-.6),4.3,4.3,.35,.4);
      for(let s=0;s<L;s+=4){const e=Math.min(L,s+4);for(const side of [-1,1]){
        slab(roof,P(s,0,6),P(e,0,6),.12,.35); // ridge closes the seam
        const a=P(s,side*(W/2+.5),4),b=P(s,0,6),d=P(e,0,6),eave=P(e,side*(W/2+.5),4);
        const corners=side<0?[a,b,d,eave]:[eave,d,b,a];
        const n=roof.positions.length/3;for(const p of corners)roof.positions.push(p[0],p[1]-.35,p[2]);for(const p of corners)roof.positions.push(...p);
        roof.indices.push(...[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7].map(i=>i+n));
        if(s%8===0){beam(truss,s,e,side*(W/2-.4),1.3,3.8,.22,.24);post(truss,s,side*(W/2-.45),2.6,4.3,.12);lamp(s,side*(W/2-.45),2.65,'window');}}
      }
    }else if(c.family==='masonry'){
      clear(get('truss'));clear(get('supports'));const supports=get('supports')!,arches=make('voussoirs','arch','stone'),count=3,bay=L/count;
      for(let k=0;k<=count;k++)for(const side of [-1,1]){const p=P(k*bay,side*(W/2-.65));pier(supports,[p[0],p[2]],p[1]-.6,ground,[1,1],[2.2,2.2]);}
      for(let k=0;k<count;k++)for(const side of [-1,1])for(let i=0;i<12;i++){const Y=(t:number)=>-2.5+1.8*Math.sin(Math.PI*t);beam(arches,k*bay+bay*i/12,k*bay+bay*(i+1)/12,side*(W/2-.4),Y(i/12),Y((i+1)/12),.9,.55);}
      for(let k=0;k<=count;k++)lamp(k*bay,W/2,1.25);
    }else if(c.family==='cantilever'){
      clear(get('supports'));clear(get('caps'));clear(get('girders'));const supports=get('supports')??make('supports','pier'),arms=make('cantileverArms','truss');
      for(const s of [0,L])for(const side of [-1,1]){const p=P(s,side*(W/2-.5));pier(supports,[p[0],p[2]],p[1]-.6,ground,[.8,.8],[2.4,2.4]);}
      for(const side of [-1,1]){const o=side*(W/2-.4);
        for(let s=0;s<L;s+=.5){const e=Math.min(L,s+.5);beam(arms,s,e,o,-.6,-.6,.45,.45);
          const h=(v:number)=>-.65-1.55*Math.max(0,1-Math.min(v,L-v)/(L*.43));
          if(e<=L*.43||s>=L*.57){beam(arms,s,e,o,h(s),h(e),.45,.45);post(arms,s,o,h(s),-.55,.18);}}}
      cuts.diagnostics=cuts.diagnostics.filter(d=>!d.id.startsWith('structures.'+c.id+'.'));
      cuts.diagnostics.push({id:`structures.${c.id}.cantilever`,severity:'info',message:'Route-following edge arms replace intermediate bents; lower-route clearance requires a fresh swept-body audit.'});
      for(const s of [0,L*.43,L*.57,L])lamp(s,W/2,1.15,'footlight');
    }else if(c.family==='trestle'||c.family==='boardwalk'){
      const bracing=make('crossBraces','beam'),bearings=cuts.bridgeBearingSeeds?.[c.id];
      for(let k=1;k<(bearings?.stations.length??0);k++){
        const s=bearings!.stations[k-1]!,e=bearings!.stations[k]!;
        if(e-s>12)continue; // Do not brace across an intentionally omitted lower-route bent.
        for(const o of bearings!.offsets){
          const a=P(s,o),b=P(e,o),low=Math.max(ground(a[0],a[2]),ground(b[0],b[2]))+.5;
          if(Math.min(a[1],b[1])-low>1.5){beam(bracing,s,e,o,-1.2,Math.max(-3,low-b[1]),.2,.25);beam(bracing,s,e,o,Math.max(-3,low-a[1]),-1.2,.2,.25);}
        }
      }
      for(let s=0;s<=L;s+=8)lamp(s,W/2,1.15,'footlight');
      for(const s of own().filter(s=>s.role==='deck'))s.surface='boardwalk';
    }else if(c.family==='garden'){
      clear(get('truss'));const frame=make('rigidFrame','beam','stone'),planters=make('planters','beam','stone','rail');
      for(const side of [-1,1]){for(let s=0;s<L;s+=2){const e=Math.min(L,s+2);beam(frame,s,e,side*(W/2-.45),-.6,-.6,.8,.55);
        // Beds sit outboard of the original 3.2eu walking strip.
        if(side<0||s>=6)beam(planters,s,e,side*2.05,.45,.45,.7,.45);}
        for(let s=4;s<L;s+=8)lamp(s,side*2.05,.85,'footlight');}
    }
    const route=get('deck')?.bedIds.find(id=>!id.startsWith('structure.'))??carried.id;
    const meetingBed=c.id==='bightBridge'?cuts.beds.find(b=>b.id==='structure.bightBridge.lookout'):undefined;
    // Reach's west side borders the protected reachMeadow landing disk. Keep the
    // regatta bay on the east side, retaining the existing end-of-rail approach.
    const meetingSide=c.id==='reachBoardwalk'?-1:1;
    const ms=Math.min(4,L/4),meetingAt=cuts.bridgeMeetingSeeds?.[c.id]??(meetingBed?bridgeFrame(meetingBed.points,bridgeLength(meetingBed.points)/2):P(ms,meetingSide*(W/2+2.75)));
    if(!meetingBed){
      // A side bay follows the carried grade so its entire entrance meets the deck.
      // Its connector opens the existing delayed rail run, using the ordinary junction rule.
      const floor=make('meetingDeck','bridge','boardwalk','deck'),rail=make('meetingRail','handrail','metal','rail'),legs=make('meetingSupports','beam','metal');
      const Q=(s:number,o:number):XYZ=>{const p=P(s,meetingSide*o),blend=Math.max(0,Math.min(1,(o-(W/2-.1))/.9));return[p[0],mix(p[1],meetingAt[1],blend),p[2]];};
      // The inner 0.9 m blends the route grade into a flat 3 m standing bay.
      for(let s=ms-2.5;s<ms+2.5;s+=.25)for(const [a,b] of [[W/2-.1,W/2+.8],[W/2+.8,W/2+5.3]]){
        const corners=[Q(s,a!),Q(s,b!),Q(s+.25,b!),Q(s+.25,a!)];if(meetingSide<0)corners.reverse();prism(floor,corners,corners.map(p=>p[1]-.6));
      }
      const boundary=[Q(ms-2.5,W/2-.05),...Array.from({length:21},(_,i)=>Q(ms-2.5+i*.25,W/2+5.25)),Q(ms+2.5,W/2-.05)];
      for(let k=1;k<boundary.length;k++){const a=boundary[k-1]!,b=boundary[k]!;slab(rail,a,b,.16,1.05,0,1.05);}
      for(const s of [ms-1.6,ms+1.6]){const a=Q(s,W/2-1),b=Q(s,W/2+5.3);slab(legs,[a[0],a[1]-.55,a[2]],[b[0],b[1]-.55,b[2]],.35,.3);}
      if(c.family==='covered'){
        const roof=make('meetingRoof','roof','timber','roof'),posts=make('meetingPosts','beam');
        slab(roof,Q(ms-2.5,W/2+2.3),Q(ms+2.5,W/2+2.3),5,.35,0,3.6);
        for(const s of [ms-2.2,ms+2.2]){const p=Q(s,W/2+4.5);box(posts,[p[0],p[2]],p[1]+3.5,[.22,.22],p[1]);}
      }
      const connector=bed(`structure.${c.id}.meeting`,'walk',[P(ms,0),meetingAt],false);connector.width=3.2;connector.structureIds=[c.id];cuts.beds.push(connector);
      lights.push({id:`bridge.${c.id}.meeting.light`,at:Q(ms-2.2,W/2+4.6).map((v,k)=>k===1?v+1.15:v) as unknown as XYZ,kind:'lantern'});
    }
    if(!lights.length)for(let s=0;s<=L;s+=12)lamp(s,W/2,1.2,c.family==='suspension'?'necklace':'lantern');
    const members=own().map(s=>({id:s.id,role:s.role,surface:s.surface}));
    cuts.bridges.push({id:c.id,name:c.name,family:c.family,route,width:W,path:[...path],members,
      meeting:{id:`bridge.${c.id}.meeting`,name:c.meeting,at:meetingAt,size:[3,3],status:'built'},
      lights,map:{at:mid,glyph:c.family},districtIds:[district],
      passages:[{id:`${c.id}.deck`,mode:'walk',relation:'over',route,width:W,headroom:c.family==='covered'?3.65:null,status:'unverified',reason:'Built deck; real-controller and swept-body acceptance required.'}],
      budget:{fullTriangles:own().reduce((n,s)=>n+s.indices.length/3,0),liteTriangles:own().reduce((n,s)=>n+(s.liteIndices??s.indices).length/3,0),maxDraws:4},
      ...(c.family==='bascule'?{operation:{kind:'twin-bascule' as const,state:'seated' as const,reason:'Leaves remain mechanically seated until collision and occupancy interlocks are active.'}}:{})});
  }
}
/** Refresh references after all rail gaps and final-ground settlement. */
export function finalizeBridges(cuts:LandCuts):BridgeDefinition[]{
  return (cuts.bridges??[]).map(b=>{const members=cuts.solids.filter(s=>s.id.startsWith(b.id+'.'));return {...b,passages:b.passages.map(p=>({...p})),meeting:{...b.meeting},members:members.map(s=>({id:s.id,role:s.role,surface:s.surface})),districtIds:[...new Set(members.map(s=>s.districtId))],budget:{...b.budget,fullTriangles:members.reduce((n,s)=>n+s.indices.length/3,0),liteTriangles:members.reduce((n,s)=>n+(s.liteIndices??s.indices).length/3,0)}};});
}
