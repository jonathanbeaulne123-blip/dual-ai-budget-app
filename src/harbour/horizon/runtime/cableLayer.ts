import * as THREE from 'three';
import {CardBuilder,type CardBuild} from '../../art/cardScene.ts';
import type {WorldDefinition} from '../world/definition.ts';
import type {StructureSolid} from '../land/interfaces.ts';
import {HORIZON_MANIFEST as M} from '../world/manifest.ts';
import {addSolid,CABLE_LINE} from './cards.ts';

/**
 * Wave 6 (LOOK, candidate 4: "cables in the sky with no anchors" on pages A, F, L; D's zip cable "ending in mid-air before the
 * platform"): a cable line is partitioned by triangle location like everything else, so a span over a resident district
 * rendered while its towers and stations — in districts that were not resident, drawn only as bare coarse terrain — did not.
 * The rule: a cable never renders without its anchors. Cable lines leave the district cards; this layer draws each SPAN
 * (anchor k → k+1) once the chunks of both its anchors are in, and draws an anchor's own solids (tower, station platform)
 * whenever its district is not resident (a resident district draws them itself). Collision is unchanged (the chunks).
 */
export interface CableAnchor {xy:[number,number];solid:RegExp}
export interface CableSystem {id:string;line:string;anchors:CableAnchor[]}
export function cableSystems():CableSystem[]{
  const g=M.cable.G1 as unknown as {from:[number,number];to:[number,number];towers:[number,number][]},z=M.cable.ZIP as unknown as {from:[number,number];to:[number,number]};
  return [
    {id:'G1',line:'G1.cable',anchors:[{xy:g.from,solid:/^platform\.gondolaBase\./},...g.towers.map(xy=>({xy,solid:/^G1\.towers/})),{xy:g.to,solid:/^platform\.gondolaTop\./}]},
    {id:'ZIP',line:'ZIP.cable',anchors:[{xy:z.from,solid:/^platform\.prowPlatform\./},{xy:z.to,solid:/^platform\.zipLanding\./}]},
  ];
}
/** The span (anchor k → k+1) a plan point lies over: the nearest segment of the anchor polyline. */
export function spanOf(anchors:readonly {xy:readonly [number,number]}[],x:number,z:number):number{
  let best=0,distance=Infinity;
  for(let k=1;k<anchors.length;k++){const a=anchors[k-1]!.xy,b=anchors[k]!.xy,dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1))),d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);if(d<distance){distance=d;best=k-1;}}
  return best;
}
export interface CableLayer {group:THREE.Group;rebuild():void;update(resident:ReadonlySet<string>,journey:boolean):void;stats():{spans:{system:string;span:number;drawn:boolean}[];anchorsDrawn:string[]};materials():THREE.Material[];dispose():void}
/** `ready(district)`: that district's chunk (collision and render solids) is in; `anchorDistricts(xy)`: the districts an anchor's solids may lie in. */
export function createCableLayer(world:WorldDefinition,tier:'full'|'lite',ready:(district:string)=>boolean,anchorDistricts:(xy:readonly [number,number])=>string[],onBuild?:(build:CardBuild)=>void):CableLayer{
  const group=new THREE.Group();group.name='horizon.cables';
  const systems=cableSystems();
  type Built={solids:StructureSolid[];open:boolean[];spans:CardBuild|null;anchors:Map<string,CardBuild>;state:{system:string;span:number;drawn:boolean}[]};
  const built=new Map<string,Built>();
  const release=(value:Built)=>{value.spans?.dispose();for(const anchor of value.anchors.values())anchor.dispose();};
  return{group,
    rebuild(){
      const all=world.geometry?.solids??[];
      for(const system of systems){
        const open=system.anchors.map(a=>anchorDistricts(a.xy).every(ready));
        const solids=all.filter(s=>{const source=s.sourceId??s.id.replace(/@[^@]*$/,'');return source===system.line||system.anchors.some(a=>a.solid.test(source))&&ready(s.districtId);});
        const previous=built.get(system.id);
        if(previous&&open.every((value,i)=>value===previous.open[i])&&solids.length===previous.solids.length&&solids.every((solid,i)=>solid===previous.solids[i]))continue;
        const spanOpen=system.anchors.slice(1).map((_,k)=>open[k]!&&open[k+1]!);
        const builders=new Map<string,CardBuilder>(),line=new CardBuilder(`horizon.cables.spans.${system.id}`,tier,{ink:'#5b5447',cell:4096,shadows:false});let lineTris=0;
        for(const solid of solids){
          const source=solid.sourceId??solid.id.replace(/@[^@]*$/,'');
          if(source===system.line){
            const p=tier==='lite'?(solid.litePositions??solid.positions):solid.positions,ix=tier==='lite'?(solid.liteIndices??solid.indices):solid.indices,keep:number[]=[];
            for(let i=0;i<ix.length;i+=3){const x=(p[ix[i]!*3]!+p[ix[i+1]!*3]!+p[ix[i+2]!*3]!)/3,z=(p[ix[i]!*3+2]!+p[ix[i+1]!*3+2]!+p[ix[i+2]!*3+2]!)/3;if(spanOpen[spanOf(system.anchors,x,z)])keep.push(ix[i]!,ix[i+1]!,ix[i+2]!);}
            if(keep.length){addSolid(line,{...solid,positions:p,indices:keep,litePositions:undefined,liteIndices:undefined},tier);lineTris+=keep.length/3;}
          }else if(!CABLE_LINE.test(source)){
            let builder=builders.get(solid.districtId);if(!builder){builder=new CardBuilder(`horizon.cables.anchors.${system.id}.${solid.districtId}`,tier,{ink:'#5b5447',cell:4096,shadows:false});builders.set(solid.districtId,builder);}addSolid(builder,solid,tier);
          }
        }
        const next:Built={solids,open,spans:lineTris?line.finish():null,anchors:new Map(),state:spanOpen.map((drawn,span)=>({system:system.id,span,drawn}))};
        if(next.spans){group.add(next.spans.group);onBuild?.(next.spans);}
        for(const [id,builder] of builders){const anchor=builder.finish();next.anchors.set(id,anchor);group.add(anchor.group);onBuild?.(anchor);}
        if(previous)release(previous);built.set(system.id,next);
      }
    },
    update(resident,journey){group.visible=!journey;for(const value of built.values())for(const [id,b] of value.anchors)b.group.visible=!resident.has(id);},
    stats:()=>({spans:[...built.values()].flatMap(value=>value.state.map(s=>({...s}))),anchorsDrawn:[...new Set([...built.values()].flatMap(value=>[...value.anchors].filter(([,b])=>b.group.visible).map(([id])=>id)))]}),
    materials:()=>[...built.values()].flatMap(value=>[...Object.values(value.spans?.materials??{}),...[...value.anchors.values()].flatMap(b=>Object.values(b.materials))]),
    dispose(){for(const value of built.values())release(value);built.clear();group.removeFromParent();group.clear();},
  };
}
