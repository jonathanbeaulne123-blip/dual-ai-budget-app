import { bridgeFrame, bridgeLength } from '../land/bridges/frames';
/** Bridge architecture is painted from the SAME baked indexed members as collision.
 * Each resident district owns a merged card batch; three authored joint/lantern kits
 * share structural dimensions. Themes never change the walkable or blocking mesh. */
import * as THREE from 'three';
import { CardBuilder, rgb, type CardBuild, type RGB } from '../../art/cardScene';
import { createBuildTask } from '../../../house/world/buildTask';
import type { WorldDefinition } from '../world/definition';
import type { StructureSolid, XYZ } from '../land/interfaces';
import { bridgeOwner } from '../land/bridges/catalog';
import { solidTriangle } from './cards';
import { districtAt } from '../world/districts';
export type BridgeTheme='classic'|'taylor'|'newfoundland';
export const BRIDGE_PALETTES={
  classic:{ink:'#43352b',stone:'#dbc69e',timber:'#aa7547',metal:'#665641',roof:'#b46c45',trim:'#d2ad66',glass:'#ffe6ac'},
  taylor:{ink:'#54404d',stone:'#eee1c5',timber:'#d5a6ad',metal:'#876c9e',roof:'#ac7695',trim:'#faead6',glass:'#f8d9bb'},
  newfoundland:{ink:'#293e43',stone:'#b4b5ac',timber:'#89968a',metal:'#374c55',roof:'#486776',trim:'#bc5e42',glass:'#ffdb8a'},
} as const;
export const bridgeMaterialColour=(s:StructureSolid,theme:BridgeTheme):RGB=>{
  const p=BRIDGE_PALETTES[theme];return rgb(s.role==='roof'?p.roof:s.surface==='metal'?p.metal:/timber|boardwalk|wood/.test(s.surface)?p.timber:s.id.endsWith('planters')?'#718a51':p.stone);
};
const oStep=(tier:string)=>tier==='full'?4:8;
export function* bridgeDistrictSteps(world:WorldDefinition,id:string,tier:'full'|'lite',theme:BridgeTheme):Generator<void,CardBuild,void>{
  const p=BRIDGE_PALETTES[theme],b=new CardBuilder(`bridge-art.${id}.${theme}`,tier,{ink:p.ink,cell:10000,shadows:true});
  for(const s of world.geometry?.solids??[]){if(s.districtId!==id||!bridgeOwner(s.sourceId??s.id))continue;
    const pos=tier==='lite'?(s.litePositions??s.positions):s.positions,ix=tier==='lite'?(s.liteIndices??s.indices):s.indices,color=bridgeMaterialColour(s,theme);
    for(let i=0;i<ix.length;i+=3){if(i%1536===0)yield;const v=(n:number):XYZ=>{const k=ix[i+n]!*3;return[pos[k]!,pos[k+1]!,pos[k+2]!];};solidTriangle(b,v(0),v(1),v(2),color);}
  }
  for(const bridge of world.bridges??[])for(const light of bridge.lights){const [x,y,z]=light.at;if(districtAt(x,z)!==id)continue;
    const trim=rgb(p.trim),glass=rgb(p.glass);
    // Brass shoes and square lanterns; folded gussets and punched tabs; iron cages and rivets.
    // All detail is inset on the common lamp envelope, never an unmodelled route barrier.
    // Lite retains every luminous bead, but drops most high cable housings.
    // These are ornamental, outboard details; shared structural/collision members stay intact.
    const detailed=tier==='full'||light.kind!=='necklace'||bridge.lights.indexOf(light)%16===0;
    if(detailed&&theme==='classic'){
      b.box(x,z,0,.14,.14,y-.14,y+.18,trim);b.box(x,z,0,.19,.19,y+.18,y+.25,trim);
    }else if(detailed&&theme==='taylor'){
      b.flat([[-.2,0],[-.16,.34],[.16,.34],[.2,0]],[x-.22,y-.15,z],[x+.22,y-.15,z],trim);
      for(const dx of [-.1,.1])b.line([x+dx,y-.09,z+.03],[x+dx,y+.15,z+.03],rgb(p.ink));
    }else if(detailed){
      b.post(x,z,y-.18,y+.2,.16,trim,6);
      for(const dx of [-.15,.15])b.beam([x+dx,y-.18,z],[x+dx,y+.22,z],.045,.045,rgb(p.metal));
      b.box(x,z,0,.2,.18,y+.2,y+.3,rgb(p.metal));
    }
    b.quad([x-.1,y-.07,z+.17],[x+.1,y-.07,z+.17],[x+.1,y+.13,z+.17],[x-.1,y+.13,z+.17],glass,'glow');
  }
  for(const bridge of world.bridges??[]){if(bridge.family!=='garden')continue;
    const length=bridgeLength(bridge.path);
    for(let s=8;s<length;s+=oStep(tier))for(const side of [-1,1]){const [x,y,z]=bridgeFrame(bridge.path,s,side*2.05,.46);if(districtAt(x,z)!==id)continue;
      if(theme==='classic'){b.post(x,z,y,y+.5,.06,rgb('#587447'),5);for(const dx of [-.2,0,.2])b.flat([[-.18,0],[0,.28],[.18,0]],[x+dx-.1,y+.4,z],[x+dx+.1,y+.4,z],rgb('#d9b976'));}
      else if(theme==='taylor'){for(const dx of [-.2,.2])b.flat([[-.2,0],[0,.65],[.2,.1]],[x+dx-.15,y,z],[x+dx+.15,y,z],rgb(dx<0?'#b77d94':'#cfb8dc'));}
      else{for(const dx of [-.22,0,.22])b.beam([x+dx,y,z],[x+dx+.13,y+.65,z+.12],.055,.06,rgb('#879b74'));b.post(x,z,y+.4,y+.55,.12,rgb('#b79aaa'),6);}
    }
  }
  return yield* b.finishSteps();
}
export function createBridgeArt(world:WorldDefinition,o:{tier:'full'|'lite';theme:BridgeTheme;material?:(m:THREE.Material)=>void;changed?:()=>void}){
  const group=new THREE.Group();group.name='horizon-bridge-art';
  const built=new Map<string,CardBuild>(),tasks=new Map<string,ReturnType<typeof createBuildTask<CardBuild>>>();let night=0,pending=false;
  const nightOf=(build:CardBuild)=>{const glow=build.materials.glow;if(glow){glow.transparent=true;glow.opacity=.12+.88*night;}};
  return {group,
    update(resident:ReadonlySet<string>){
      for(const [id,build]of built)if(!resident.has(id)){build.group.removeFromParent();build.dispose();built.delete(id);o.changed?.();}
      for(const [id,task]of tasks)if(!resident.has(id)){task.cancel();tasks.delete(id);}
      const eligible=[...resident].filter(id=>(world.geometry?.solids??[]).some(s=>s.districtId===id&&bridgeOwner(s.sourceId??s.id)));
      for(const id of eligible){if(built.has(id))continue;
        if(!(world.geometry?.solids??[]).some(s=>s.districtId===id&&bridgeOwner(s.sourceId??s.id)))continue;
        let task=tasks.get(id);if(!task){task=createBuildTask(bridgeDistrictSteps(world,id,o.tier,o.theme));tasks.set(id,task);}
        const build=task.advance();if(build){for(const m of Object.values(build.materials))o.material?.(m);nightOf(build);group.add(build.group);built.set(id,build);tasks.delete(id);o.changed?.();}break;
      }
      pending=eligible.some(id=>!built.has(id));
    },
    building:()=>pending||tasks.size>0,
    setNight(k:number){night=k;for(const build of built.values())nightOf(build);},
    stats(){return [...built].map(([id,b])=>{let calls=0,triangles=0;b.group.traverse(obj=>{const m=obj as THREE.Mesh;if(!m.isMesh&&!(obj as THREE.Line).isLine&&!(obj as THREE.Points).isPoints)return;calls++;if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.getAttribute('position')?.count??0)/3;});return{id,calls,triangles,visible:b.group.visible};});},
    dispose(){for(const t of tasks.values())t.cancel();tasks.clear();for(const b of built.values())b.dispose();built.clear();group.removeFromParent();},
  };
}
