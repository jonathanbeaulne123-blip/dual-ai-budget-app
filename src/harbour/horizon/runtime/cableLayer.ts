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
  const systems=cableSystems();let spans:CardBuild|null=null,anchors=new Map<string,CardBuild>(),spanState:{system:string;span:number;drawn:boolean}[]=[];
  const anchorReady=(a:CableAnchor)=>anchorDistricts(a.xy).every(ready);
  function clear(){if(spans){group.remove(spans.group);spans.dispose();spans=null;}for(const b of anchors.values()){group.remove(b.group);b.dispose();}anchors=new Map();}
  return{group,
    rebuild(){
      clear();spanState=[];
      const solids=(world.geometry?.solids??[]) as (StructureSolid&{sourceId?:string})[],builders=new Map<string,CardBuilder>(),line=new CardBuilder('horizon.cables.spans',tier,{ink:'#5b5447',cell:4096,shadows:false});let lineTris=0;
      for(const system of systems){
        const open=system.anchors.map(anchorReady),spanOpen=system.anchors.slice(1).map((_,k)=>open[k]!&&open[k+1]!);
        spanOpen.forEach((drawn,span)=>spanState.push({system:system.id,span,drawn}));
        for(const solid of solids){if((solid.sourceId??solid.id.replace(/@[^@]*$/,''))!==system.line)continue;
          const p=tier==='lite'?(solid.litePositions??solid.positions):solid.positions,ix=tier==='lite'?(solid.liteIndices??solid.indices):solid.indices,keep:number[]=[];
          for(let i=0;i<ix.length;i+=3){const x=(p[ix[i]!*3]!+p[ix[i+1]!*3]!+p[ix[i+2]!*3]!)/3,z=(p[ix[i]!*3+2]!+p[ix[i+1]!*3+2]!+p[ix[i+2]!*3+2]!)/3;if(spanOpen[spanOf(system.anchors,x,z)])keep.push(ix[i]!,ix[i+1]!,ix[i+2]!);}
          if(keep.length){addSolid(line,{...solid,positions:[...p],indices:keep,litePositions:undefined,liteIndices:undefined},tier);lineTris+=keep.length/3;}
        }
        // Anchors: per district, for when that district is not resident.
        for(const solid of solids){const source=solid.sourceId??solid.id.replace(/@[^@]*$/,'');if(!system.anchors.some(a=>a.solid.test(source))||CABLE_LINE.test(source)||!ready(solid.districtId))continue;
          let b=builders.get(solid.districtId);if(!b){b=new CardBuilder(`horizon.cables.anchors.${solid.districtId}`,tier,{ink:'#5b5447',cell:4096,shadows:false});builders.set(solid.districtId,b);}
          addSolid(b,solid,tier);}
      }
      if(lineTris){spans=line.finish();group.add(spans.group);onBuild?.(spans);}
      for(const [id,builder] of builders){const built=builder.finish();anchors.set(id,built);group.add(built.group);onBuild?.(built);}
    },
    update(resident,journey){group.visible=!journey;for(const [id,b] of anchors)b.group.visible=!resident.has(id);},
    stats:()=>({spans:spanState.map(s=>({...s})),anchorsDrawn:[...anchors].filter(([,b])=>b.group.visible).map(([id])=>id)}),
    materials:()=>[...(spans?Object.values(spans.materials):[]),...[...anchors.values()].flatMap(b=>Object.values(b.materials))],
    dispose:clear,
  };
}
