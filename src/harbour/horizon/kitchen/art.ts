import * as THREE from 'three';
import {createBodyFigure} from '../../body/figure.ts';
import {DECK,type Point} from '../movers/fleet/layout.ts';
import type {VehicleDressing} from '../movers/shared/vehicleArt.ts';
import {INGREDIENTS,STATIONS,TROLLEY_DOCKS,TASK_SECONDS} from './config.ts';
import type {ChefId,KitchenItem,KitchenState,KitchenStation} from './types.ts';

export type KitchenArtOptions={firstPersonChef?:ChefId;reducedMotion?:boolean;unlocks?:string[]};
const PALETTES={classic:{ink:'#294a50',paper:'#fff5dc',wood:'#bd8e57',steel:'#718a89',chef0:'#247b98',chef1:'#ab467b'},taylor:{ink:'#82536b',paper:'#fff0df',wood:'#c29280',steel:'#ae8c85',chef0:'#427e9c',chef1:'#b55d86'},newfoundland:{ink:'#1d5966',paper:'#f5edcc',wood:'#9c7848',steel:'#6a918c',chef0:'#277aad',chef1:'#b24938'}};
type Label={object:THREE.Object3D;text:(value:string)=>void;refresh:()=>void;dispose:()=>void};
/** Everything is yacht-local. The runtime owns the yacht transform and every chef's pose. */
export function createKitchenArt(theme:VehicleDressing='classic'){
  let palette=PALETTES[theme],disposed=false;
  const root=new THREE.Group();root.name='yacht-kitchen';
  const permanent=new THREE.Group(),play=new THREE.Group();root.add(permanent,play);
  const geometries=new Map<string,THREE.BufferGeometry>(),materials=new Map<string,THREE.MeshStandardMaterial>(),roleMaterials=new Map<keyof typeof palette,THREE.MeshStandardMaterial>(),textures=new Set<THREE.Texture>(),spriteMaterials=new Set<THREE.SpriteMaterial>(),labels=new Set<Label>();
  function material(color:string){let m=materials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.82,flatShading:true});materials.set(color,m);}return m;}
  function role(name:keyof typeof palette){let m=roleMaterials.get(name);if(!m){m=new THREE.MeshStandardMaterial({color:palette[name],roughness:.8,flatShading:true});roleMaterials.set(name,m);}return m;}
  function geometry(key:string,make:()=>THREE.BufferGeometry){let g=geometries.get(key);if(!g){g=make();geometries.set(key,g);}return g;}
  function mesh(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0){const object=new THREE.Mesh(g,m);object.name=name;object.position.set(x,y,z);object.castShadow=object.receiveShadow=true;parent.add(object);return object;}
  const box=(parent:THREE.Object3D,name:string,w:number,h:number,d:number,m:THREE.Material,x=0,y=0,z=0)=>mesh(parent,name,geometry(`box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d)),m,x,y,z);
  const cylinder=(parent:THREE.Object3D,name:string,r:number,h:number,m:THREE.Material,x=0,y=0,z=0,sides=12)=>mesh(parent,name,geometry(`cylinder:${r}:${h}:${sides}`,()=>new THREE.CylinderGeometry(r,r,h,sides)),m,x,y,z);
  function label(parent:THREE.Object3D,value:string,width=1.2,height=.26):Label{
    let object:THREE.Object3D=new THREE.Group(),draw=(text:string)=>{object.userData.label=text;};
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const context=canvas.getContext('2d');
      if(context){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const m=new THREE.SpriteMaterial({map:texture,depthTest:true,transparent:true});spriteMaterials.add(m);object=new THREE.Sprite(m);object.scale.set(width,height,1);draw=(text)=>{context.clearRect(0,0,512,96);context.fillStyle=palette.ink;context.fillRect(0,0,512,96);context.fillStyle=palette.paper;context.font='600 33px system-ui, sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(text,256,48,485);texture.needsUpdate=true;object.userData.label=text;};}
    }
    let current='';const out:Label={object,text(text){if(text!==current){current=text;draw(text);}},refresh(){draw(current);},dispose(){labels.delete(out);if(object instanceof THREE.Sprite){const m=object.material;if(m.map){textures.delete(m.map);m.map.dispose();}spriteMaterials.delete(m);m.dispose();}object.removeFromParent();}};parent.add(object);labels.add(out);out.text(value);return out;
  }
  // A small physical menu board, with no obstacle or remote activation attached to it.
  const menu=new THREE.Group();menu.name='yacht.kitchen.menu-board';menu.position.set(-2.6,DECK.main,-10.6);permanent.add(menu);
  box(menu,'menu-post',.065,1.12,.065,role('wood'),0,.56,0);box(menu,'menu-board',.96,.66,.075,role('wood'),0,1.31,0);box(menu,'menu-face',.86,.56,.012,role('ink'),0,1.31,.043);
  const menuLabel=label(menu,'YACHT KITCHEN',.88,.21);menuLabel.object.position.set(0,1.43,.06);const menuHint=label(menu,'MENU  ·  E',.74,.17);menuHint.object.position.set(0,1.17,.06);
  const fixtures=new Map<string,THREE.Group>();
  for(const station of STATIONS.filter(s=>s.area==='deck'||s.kind==='trolley'||s.kind==='extinguisher')){
    const g=new THREE.Group();g.name=station.id+'.kitchen-art';g.position.set(station.at.x,station.at.y,station.at.z);permanent.add(g);fixtures.set(station.id,g);
    if(station.kind==='appliance'){
      box(g,'grill-body',1.35,.45,.85,role('ink'),0,.61,0);box(g,'grill-rim',1.44,.10,.94,role('steel'),0,.91,0);for(let i=-4;i<=4;i++)box(g,'grill-bar-'+i,.04,.04,.75,role('steel'),i*.14,.98,0);for(const x of[-.5,.5])box(g,'grill-leg',.07,.45,.07,role('steel'),x,.22,0);
    }else if(station.kind==='trolley'){
      box(g,'cart-shelf',1.25,.08,.78,role('wood'),0,.3,0);box(g,'cart-top',1.35,.10,.85,role('paper'),0,.87,0);for(const x of[-.55,.55])for(const z of[-.3,.3]){box(g,'cart-upright',.05,.65,.05,role('steel'),x,.5,z);const wheel=cylinder(g,'cart-wheel',.1,.06,role('ink'),x,.12,z,10);wheel.rotation.z=Math.PI/2;}box(g,'cart-handle',1.35,.055,.055,role('steel'),0,1.06,.43);
    }else if(station.kind==='extinguisher'){
      // The movable extinguisher item is supplied by the engine; this is its wall bracket.
      box(g,'extinguisher-bracket',.35,.5,.08,role('steel'),0,.74,0);const sign=label(g,'EXTINGUISHER',.95,.2);sign.object.position.y=1.3;
    }
  }
  const docks=TROLLEY_DOCKS.map((at,index)=>{const g=new THREE.Group();g.name='trolley-dock-'+index;g.position.set(at.x,at.y+.014,at.z);permanent.add(g);for(const x of[-.8,.8])box(g,'dock-stripe',.045,.016,1.05,role('ink'),x,0,0);for(const z of[-.52,.52])box(g,'dock-stripe',1.64,.016,.045,role('ink'),0,0,z);const sign=label(g,index===0?'LOAD':'SERVE',.8,.22);sign.object.position.set(0,.18,.8);return g;});
  // Earned mementos are visual additions; they do not replace furniture or add collision.
  const glass=new THREE.Group();glass.name='reward.galley-sea-glass';permanent.add(glass);box(glass,'sea-glass-inset',1.05,.025,.42,material('#64aea8'),0,DECK.main+.966,-8.2);
  const runner=new THREE.Group();runner.name='reward.sunset-table';permanent.add(runner);box(runner,'sunset-runner',.48,.018,2.4,material('#d89563'),4.65,DECK.main+.824,-17);
  const trophy=new THREE.Group();trophy.name='reward.captains-memento';trophy.position.set(1,DECK.main+.95,-3.2);permanent.add(trophy);cylinder(trophy,'memento-plinth',.18,.08,role('wood'));const mast=box(trophy,'memento-mast',.025,.4,.025,material('#d1ab50'),0,.25,0);const sail=mesh(trophy,'memento-sail',geometry('memento-sail',()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.28,0,0,0,.34,0],3));g.setIndex([0,1,2,2,1,0]);g.computeVertexNormals();return g;}),role('paper'),.025,.14,0);sail.rotation.y=.2;mast.userData.cosmetic=true;
  const chefArt=([0,1] as const).map(id=>{
    const group=new THREE.Group();group.name=`kitchen.chef.${id}`;play.add(group);const figure=createBodyFigure({coat:palette[id===0?'chef0':'chef1'],skin:id===0?'#e4b88c':'#805a43',hair:id===0?'#543a2a':'#292724'});group.add(figure.group);
    const hat=new THREE.Group();hat.position.y=1.25;group.add(hat);cylinder(hat,'chef-hat-band',.16,.075,role(id===0?'chef0':'chef1'),0,.01,0,10);cylinder(hat,'chef-hat',id===0?.18:.2,id===0?.23:.15,role('paper'),0,id===0?.15:.11,0,id===0?8:6);
    const apron=box(group,'earned-chef-apron',.36,.44,.055,role('paper'),0,.65,.2);box(group,'apron-pocket',.17,.1,.015,role(id===0?'chef0':'chef1'),0,.62,.235);
    const identity=label(group,`CHEF ${id+1}`,1.05,.23);identity.object.position.y=1.79;
    const ring=mesh(group,'chef-foot-marker',geometry('ring:'+id,()=>new THREE.RingGeometry(.30,.37,id===0?32:4)),role(id===0?'chef0':'chef1'),0,.015,0);ring.rotation.x=-Math.PI/2;
    return{group,figure,apron,hat,identity,previous:{x:0,z:0}};
  });
  const stationArt=new Map<string,{group:THREE.Group;label:Label;progress:THREE.Mesh;target:THREE.Group;fire:THREE.Group}>();
  function getStation(station:KitchenStation){let out=stationArt.get(station.id);if(out)return out;
    const group=new THREE.Group();group.name=station.id+'.status';play.add(group);const name=label(group,station.label,1.8,.26);name.object.position.y=.60;
    const track=box(group,'task-track',1,.045,.09,role('ink'),0,.36,0),progress=box(group,'task-progress',1,.05,.095,material('#edc471'),0,.36,.005);track.userData.presentation=true;
    const target=new THREE.Group();group.add(target);for(const x of[-.75,.75])box(target,'target-edge',.045,.045,1.1,role('chef0'),x,.05,0);for(const z of[-.55,.55])box(target,'target-edge',1.55,.045,.045,role('chef0'),0,.05,z);
    const fire=new THREE.Group();fire.name='contained-kitchen-fire';group.add(fire);for(let i=0;i<5;i++){const flame=mesh(fire,'flame',geometry('flame',()=>new THREE.ConeGeometry(.13,.55,5)),material(i%2?'#f5c15a':'#d26532'),(i-2)*.2,.3,(i%2)*.12);flame.rotation.z=(i-2)*.08;}fire.visible=false;
    out={group,label:name,progress,target,fire};stationArt.set(station.id,out);return out;
  }
  const itemArt=new Map<string,{group:THREE.Group;signature:string;label:Label;transit:number}>();
  function food(parent:THREE.Group,item:KitchenItem){
    if(item.kind==='plate'){cylinder(parent,'plate-rim',.32,.045,item.dirty?material('#aeaa91'):role('paper'));cylinder(parent,'plate-centre',.265,.048,item.dirty?material('#817763'):role('paper'));if(item.dirty)for(let n=0;n<3;n++)box(parent,'dirty-mark',.1,.006,.075,material('#77614a'),Math.sin(n*2)*.15,.029,Math.cos(n*2)*.13);return;}
    if(item.kind==='extinguisher'){cylinder(parent,'extinguisher',.13,.4,material('#b74538'),0,.2);box(parent,'extinguisher-handle',.2,.04,.055,role('ink'),0,.43);box(parent,'extinguisher-label',.16,.18,.025,role('paper'),0,.22,.13);return;}
    if(!item.ingredient)return;const id=item.ingredient,prepared=item.phase==='prepared',cooked=item.phase==='ready'||item.phase==='cooking',burnt=item.phase==='burnt',m=material(burnt?'#3b3630':cooked?({tomato:'#b43e27',bread:'#b87536',fish:'#d6bc7b',pasta:'#f0d181',patty:'#684536',bun:'#c89855',lettuce:'#649547'}[id]):INGREDIENTS[id].color);
    if(prepared){for(let n=0;n<5;n++)box(parent,'chopped-'+id,.1,.075,.1,m,Math.sin(n*2.4)*.18,.045,Math.cos(n*2.4)*.15);return;}
    if(id==='tomato'||id==='bun'){const g=geometry('rounded-food',()=>new THREE.IcosahedronGeometry(.21,1));const obj=mesh(parent,id,g,m,0,.18);obj.scale.y=id==='bun'?.65:1;if(id==='tomato')box(parent,'tomato-leaf',.16,.03,.09,material('#4d773a'),0,.37);}
    else if(id==='lettuce'){for(let n=0;n<4;n++){const obj=mesh(parent,'lettuce-leaf',geometry('leaf',()=>new THREE.IcosahedronGeometry(.2,0)),m,Math.sin(n*1.7)*.09,.09,Math.cos(n*1.7)*.09);obj.scale.y=.4;}}
    else if(id==='fish'){const f=mesh(parent,'fish',geometry('fish',()=>new THREE.IcosahedronGeometry(.2,1)),m,0,.08);f.scale.set(1.6,.4,.75);const tail=mesh(parent,'fish-tail',geometry('fish-tail',()=>new THREE.ConeGeometry(.15,.19,3)),m,-.35,.08);tail.rotation.z=Math.PI/2;}
    else if(id==='pasta'){for(let n=0;n<6;n++){const p=cylinder(parent,'pasta-strand',.02,.4,m,(n-2.5)*.04,.04,0,5);p.rotation.x=Math.PI/2;p.rotation.z=n*.05;}}
    else if(id==='patty'){cylinder(parent,'patty',.23,.10,m,0,.05);if(cooked&&!burnt)for(let n=-1;n<=1;n++)box(parent,'grill-line',.31,.006,.02,material('#413326'),0,.105,n*.10);}
    else box(parent,'bread',.41,.11,.29,m,0,.055);
    if(item.phase==='cooking'){const pan=cylinder(parent,'cookware',.29,.07,role('steel'),0,-.035);pan.userData.presentation=true;box(parent,'pan-handle',.34,.04,.07,role('ink'),.4,-.035);}
  }
  function getItem(item:KitchenItem){const signature=[item.kind,item.ingredient,item.phase,item.dirty].join(':');let out=itemArt.get(item.id);if(out?.signature===signature)return out;if(out){out.group.removeFromParent();out.label.dispose();}
    const group=new THREE.Group();group.name='kitchen.item.'+item.id;play.add(group);food(group,item);const name=label(group,'',1.25,.21);name.object.position.y=item.kind==='extinguisher'?.62:.49;out={group,signature,label:name,transit:item.location.kind==='transit'?Math.max(.001,item.location.remaining):0};itemArt.set(item.id,out);return out;
  }
  function itemPoint(item:KitchenItem,state:KitchenState,stations:KitchenStation[],depth=0):Point|null{
    if(depth>2)return null;const location=item.location;
    if(location.kind==='hands'){const chef=state.chefs.find(c=>c.id===location.chef);return chef?{x:chef.pose.x+Math.sin(chef.pose.yaw)*.5,y:chef.pose.y+.8,z:chef.pose.z+Math.cos(chef.pose.yaw)*.5}:null;}
    if(location.kind==='station'){const s=stations.find(s=>s.id===location.station);return s?{x:s.surface.x+(s.capacity>1?(location.slot%2-.5)*.64:0),y:s.surface.y+.10+Math.floor(location.slot/2)*.06,z:s.surface.z}:null;}
    if(location.kind==='container'){const container=state.items[location.container],at=container&&itemPoint(container,state,stations,depth+1);if(!at)return null;const n=container.contents.indexOf(item.id),count=container.contents.length;return{x:at.x+(count>1?Math.sin(n*Math.PI*2/count)*.12:0),y:at.y+.065+n*.025,z:at.z+(count>1?Math.cos(n*Math.PI*2/count)*.12:0)};}
    if(location.kind==='transit'){const art=getItem(item);if(!art.transit)art.transit=Math.max(.001,location.remaining);const t=1-Math.max(0,Math.min(1,location.remaining/art.transit));return{x:location.from.x+(location.to.x-location.from.x)*t,y:location.from.y+(location.to.y-location.from.y)*t+Math.sin(t*Math.PI)*.8,z:location.from.z+(location.to.z-location.from.z)*t};}
    return null;
  }
  const toss=([0,1] as const).map(id=>{const lineGeometry=new THREE.BufferGeometry();geometries.set('toss-'+id,lineGeometry);const lineMaterial=new THREE.LineDashedMaterial({color:palette[id===0?'chef0':'chef1'],dashSize:.15,gapSize:.10});const line=new THREE.Line(lineGeometry,lineMaterial);line.name='chef-toss-preview-'+id;play.add(line);const target=mesh(play,'chef-toss-target-'+id,geometry('toss-ring',()=>new THREE.RingGeometry(.22,.28,24)),role(id===0?'chef0':'chef1'));target.rotation.x=-Math.PI/2;return{line,target,material:lineMaterial};});
  return{root,
    update(state:KitchenState,stations:KitchenStation[],tossTargets:Partial<Record<ChefId,Point>>={},options:KitchenArtOptions={}){
      if(disposed)return;const active=['ready','playing','paused','results'].includes(state.phase);play.visible=active;menu.visible=!active;const unlocks=options.unlocks??[];glass.visible=unlocks.includes('galley-sea-glass');runner.visible=unlocks.includes('sunset-table');trophy.visible=unlocks.includes('captains-memento');
      for(const dock of docks)dock.visible=active&&state.service==='banquet';
      for(const [id,g]of fixtures){const s=stations.find(s=>s.id===id);if(s)g.position.set(s.at.x,s.at.y,s.at.z);g.visible=id.endsWith('trolley')?active&&state.service==='banquet':id.endsWith('deck-grill')?active&&state.service==='sunset':true;}
      for(const [i,art]of chefArt.entries()){const chef=state.chefs.find(c=>c.id===i);art.group.visible=active&&!!chef&&i<state.players&&options.firstPersonChef!==i;if(!chef)continue;const distance=Math.hypot(chef.pose.x-art.previous.x,chef.pose.z-art.previous.z),moving=distance>.0001;art.group.position.set(chef.pose.x,chef.pose.y,chef.pose.z);art.group.rotation.y=chef.pose.yaw;art.figure.pose(options.reducedMotion?0:state.elapsed*7,moving&&!options.reducedMotion?1:0,options.reducedMotion?0:state.elapsed);art.previous={x:chef.pose.x,z:chef.pose.z};art.apron.visible=unlocks.includes('chef-apron');art.identity.text(`CHEF ${i+1}${!chef.connected?' · PAUSED':''}`);}
      for(const art of stationArt.values())art.group.visible=false;
      for(const s of stations){const art=getStation(s);art.group.visible=active;art.group.position.set(s.surface.x,s.surface.y+.04,s.surface.z);const items=Object.values(state.items).filter(item=>item.location.kind==='station'&&item.location.station===s.id),chefs=state.chefs.filter(c=>c.target===s.id&&c.id<state.players),task=state.chefs.find(c=>c.task?.station===s.id),fire=(state.fires[s.id]??0)>0;
        let text=s.label,progress=0;const cooking=items.find(item=>item.phase==='cooking'),ready=items.some(item=>item.phase==='ready'),burnt=items.some(item=>item.phase==='burnt');if(fire)text='FIRE · EXTINGUISH';else if(burnt)text='BURNT · DISCARD';else if(cooking){text='COOKING';progress=cooking.progress;}else if(ready)text='READY · COLLECT';else if(task){text=task.task!.kind.toUpperCase();const held=task.held?state.items[task.held]:undefined,work=held??items[0];progress=work?work.progress/(task.task!.kind==='wash'?TASK_SECONDS.wash:task.task!.kind==='extinguish'?TASK_SECONDS.extinguish:work.ingredient?INGREDIENTS[work.ingredient].prepSeconds||1:1):0;}
        if(s.kind==='storage'&&chefs[0]&&s.ingredients?.length)text=INGREDIENTS[s.ingredients[chefs[0].selection%s.ingredients.length]!].label+' · E pick · Q change';if(s.kind==='trolley')text=state.trolley.secured?'TROLLEY SECURED · F release':state.trolley.progress>=1?'TROLLEY ARRIVED · F secure':'TROLLEY MOVING';art.label.text((chefs.length?chefs.map(c=>c.id+1).join('+')+' · ':'')+text);art.label.object.visible=chefs.length>0||!!task||!!cooking||ready||burnt||fire;art.label.object.position.z=s.kind==='serve'||s.kind==='return'?Math.sign(s.approach.z-s.at.z)*.55:0;art.group.getObjectByName('task-track')!.visible=progress>0;art.target.visible=chefs.length>0;art.target.traverse(o=>{if(o instanceof THREE.Mesh)o.material=role(chefs[0]?.id===1?'chef1':'chef0');});art.progress.visible=progress>0;art.progress.scale.x=Math.max(.001,Math.min(1,progress));art.progress.position.x=-(1-Math.min(1,progress))/2;art.fire.visible=fire;
      }
      const live=new Set<string>();for(const item of Object.values(state.items)){if(item.location.kind==='discarded'||item.location.kind==='return')continue;const art=getItem(item),at=itemPoint(item,state,stations);live.add(item.id);art.group.visible=active&&!!at;if(at)art.group.position.set(at.x,at.y,at.z);const location=item.location;art.label.object.visible=location.kind!=='container'&&(location.kind==='hands'||item.phase==='burnt'||item.phase==='ready');const stateLabel=item.kind==='plate'?(item.dirty?'DIRTY PLATE':item.contents.length?`PLATE · ${item.contents.length} COMPONENTS`:'CLEAN PLATE'):item.kind==='extinguisher'?'EXTINGUISHER':`${INGREDIENTS[item.ingredient!].label} · ${item.phase.toUpperCase()}`;art.label.text(stateLabel);if(location.kind!=='transit')art.transit=0;}
      for(const [id,art]of itemArt)if(!live.has(id)){art.group.removeFromParent();art.label.dispose();itemArt.delete(id);}
      for(const [i,art]of toss.entries()){const at=tossTargets[i as ChefId],chef=state.chefs.find(c=>c.id===i);art.line.visible=art.target.visible=active&&!!at&&!!chef;if(!at||!chef)continue;art.target.position.set(at.x,at.y+.03,at.z);const points=[];for(let n=0;n<=20;n++){const t=n/20;points.push(new THREE.Vector3(chef.pose.x+(at.x-chef.pose.x)*t,chef.pose.y+.8+(at.y-chef.pose.y-.8)*t+Math.sin(t*Math.PI)*.8,chef.pose.z+(at.z-chef.pose.z)*t));}art.line.geometry.setFromPoints(points);art.line.computeLineDistances();}
    },
    setTheme(next:VehicleDressing){palette=PALETTES[next];for(const [name,m]of roleMaterials)m.color.set(palette[name]);for(const l of labels)l.refresh();for(const [i,t]of toss.entries())t.material.color.set(palette[i===0?'chef0':'chef1']);},
    dispose(){if(disposed)return;disposed=true;for(const art of chefArt)art.figure.dispose();for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();for(const m of roleMaterials.values())m.dispose();for(const t of textures)t.dispose();for(const m of spriteMaterials)m.dispose();for(const art of toss)art.material.dispose();root.removeFromParent();root.clear();},
  };
}
