/**
 * Greybox art for the two wings (FLIGHT.md §1, §5), through `greyboxArt` / `VEHICLE_ANCHORS` until pass 2b's
 * kit: the hang glider (10 m triangle, keel, base bar) with the rider's figure hung prone at the seat anchor,
 * and the square canopy on 5 m lines over an upright rider. The tail light is a white *card* at the
 * `runningLights[0]` anchor — never a THREE light. No text.
 *
 * `update(state, dt, figure)` places the art from the controller's `artState()` and returns false when the
 * art is finished (the wing folded away over 2 s after landing, the canopy gathered in three steps, or the
 * mode ended without flying — a reduced-motion cut). The runtime then removes it.
 */
import * as THREE from 'three';
import {RUNNING_LIGHT_COLOURS,VEHICLE_ANCHORS,VEHICLE_DIMENSIONS,greyboxArt,type VehicleDressing,type VehicleTier} from '../shared/vehicleArt.ts';
import type {FlightArtState} from './controller.ts';

export const FOLD_SECONDS=2;
/** The canopy is gathered into the bag on the rider's back in three steps, this long each. */
export const GATHER_STEP_SECONDS=.3;
export const GATHER_STEPS=3;
/** The sim's position is the contact (feet / base-bar tips); the hang point is this far above it. */
export const GLIDER_HANG_ABOVE_CONTACT=-(VEHICLE_ANCHORS.glider?.contact[1]??-1.3);
export const CHUTE_SEAT_ABOVE_CONTACT=-(VEHICLE_ANCHORS.parachute?.contact[1]??-1.2);
/** Prone under the keel: head forward (+z), face down. Rotation about +x by +90°. */
const PRONE=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);

function tailLightCard(at:readonly [number,number,number]){
  const card=new THREE.Mesh(new THREE.PlaneGeometry(.22,.22),new THREE.MeshBasicMaterial({color:RUNNING_LIGHT_COLOURS.white,side:THREE.DoubleSide,toneMapped:false}));
  card.name='tailLight.card';card.position.set(at[0],at[1],at[2]);card.userData.lightCard=true;return card;
}
function bar(length:number,axis:'x'|'z',material:THREE.Material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?length:.05,.05,axis==='z'?length:.05),material);return mesh;
}

export interface FlightArt{root:THREE.Group;update(state:FlightArtState,dt:number,figure?:THREE.Object3D|null):boolean;dispose():void}

export function createFlightArt(kind:'glider'|'parachute',dressing:VehicleDressing='classic',tier:VehicleTier='full',night:()=>boolean=()=>true):FlightArt{
  const art=greyboxArt(kind),root=new THREE.Group(),wing=art.build(dressing,tier);root.name=`flight.${kind}`;root.visible=false;
  const frame=new THREE.MeshStandardMaterial({color:'#5d5a52',roughness:.8});
  root.add(wing);
  let canopy:THREE.Object3D|null=null;
  if(kind==='glider'){
    const keel=bar(VEHICLE_DIMENSIONS.glider.keel,'z',frame);keel.position.y=.3;keel.name='greybox.glider.keel';wing.add(keel);
    const base=bar(1.4,'x',frame);base.position.set(0,-1.3,.3);base.name='greybox.glider.baseBar';wing.add(base);
  }else{
    canopy=wing.getObjectByName('greybox.parachute.canopy')?.parent??wing;
  }
  const light=art.anchors.runningLights[0],lightCard=light?tailLightCard(light.at):null;if(lightCard)wing.add(lightCard);
  const position=new THREE.Vector3(),quat=new THREE.Quaternion(),euler=new THREE.Euler(0,0,0,'YXZ'),offset=new THREE.Vector3();
  let done=false,landedT=0;
  return{
    root,
    update(state,_dt,figure){
      if(done)return false;
      // Never flew (a reduced-motion cut): nothing to show.
      if(state.ended&&!state.flying){done=true;root.visible=false;return false;}
      if(!state.flying){root.visible=false;return true;}
      // A fade takes the wing with the rider: gone at once.
      if(state.faded||(state.ended&&state.landedFor===null)){done=true;root.visible=false;return false;}
      const p=state.pose,landed=state.landedFor!==null;
      root.visible=true;
      if(!landed){
        euler.set(-(p.pitch??0),p.yaw,p.bank??0,'YXZ');quat.setFromEuler(euler);
        const lift=kind==='glider'?GLIDER_HANG_ABOVE_CONTACT:CHUTE_SEAT_ABOVE_CONTACT;
        position.set(p.x,p.y+lift,p.z);root.position.copy(position);root.quaternion.copy(quat);root.scale.setScalar(1);
        if(kind==='glider'&&figure&&(state.stage==='flight'||state.stage==='corridor')){
          // In the air the rider hangs prone at the seat (the runtime's own figure, turned prone under the keel); on the pad they run upright.
          figure.quaternion.copy(quat).multiply(PRONE);
          offset.set(0,-.35,-.6).applyQuaternion(quat);figure.position.copy(position).add(offset);
        }
        if(lightCard)lightCard.visible=night();
        if(canopy){const open=Math.max(0,Math.min(1,state.open));canopy.visible=open>0;canopy.scale.set(Math.max(.05,open),Math.max(.05,open),Math.max(.05,open));}
        return true;
      }
      // Once the controller hands the feet back, finish stowing on the live figure (also on moving decks).
      landedT=state.ended?Math.max(landedT+_dt,state.landedFor??0):state.landedFor??0;
      if(state.ended&&figure){root.position.copy(figure.position);root.quaternion.copy(figure.quaternion);}
      const t=landedT;
      if(kind==='glider'){
        // The wing folds to a bundle over 2 s where it touched down, and is gone.
        const k=Math.min(1,t/FOLD_SECONDS);root.scale.set(Math.max(.02,1-k),Math.max(.1,1-k*.9),Math.max(.02,1-k));
        if(k>=1){done=true;root.visible=false;return false;}
      }else{
        // The canopy collapses and is gathered in three steps.
        const steps=Math.min(GATHER_STEPS,Math.floor(t/GATHER_STEP_SECONDS)),k=1-steps/GATHER_STEPS;
        if(canopy){canopy.scale.set(Math.max(.02,k),Math.max(.02,k*.3),Math.max(.02,k));canopy.position.y=-(1-k)*VEHICLE_DIMENSIONS.parachute.lines*.9;}
        if(steps>=GATHER_STEPS){done=true;root.visible=false;return false;}
      }
      return true;
    },
    dispose(){root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});},
  };
}

/**
 * A parked glider for a launch pad (Jonathan 2026-10-04: "if there is a model for the glider have it at each glider spot").
 * The same greybox wing, keel and base bar as the flying art, standing still on its base bar: the root's origin is the
 * contact (the deck), the hang point `GLIDER_HANG_ABOVE_CONTACT` above it, the nose along +z. Nothing here moves or
 * collides; the tail light card shows only at night (`setNight`). Lite keeps the sail and keel and drops the base bar.
 */
export interface ParkedGlider{root:THREE.Group;setNight(on:boolean):void;dispose():void}
export function createParkedGlider(dressing:VehicleDressing='classic',tier:VehicleTier='full'):ParkedGlider{
  const art=greyboxArt('glider'),root=new THREE.Group(),wing=art.build(dressing,tier);root.name='parked.glider';
  const frame=new THREE.MeshStandardMaterial({color:'#5d5a52',roughness:.8});
  wing.position.y=GLIDER_HANG_ABOVE_CONTACT;root.add(wing);
  const keel=bar(VEHICLE_DIMENSIONS.glider.keel,'z',frame);keel.position.y=.3;keel.name='greybox.glider.keel';wing.add(keel);
  if(tier==='full'){
    const base=bar(1.4,'x',frame);base.position.set(0,-1.3,.3);base.name='greybox.glider.baseBar';wing.add(base);
    // The two uprights from the keel to the base bar ends (an A-frame), so it reads as standing, not floating.
    for(const side of[-1,1]){const upright=new THREE.Mesh(new THREE.BoxGeometry(.04,1.62,.04),frame);upright.position.set(side*.35,-.5,.3);upright.rotation.z=side*.42;upright.name='greybox.glider.upright';wing.add(upright);}
  }
  const light=art.anchors.runningLights[0],lightCard=light?tailLightCard(light.at):null;if(lightCard){lightCard.visible=false;wing.add(lightCard);}
  root.traverse(o=>{o.castShadow=false;o.receiveShadow=false;o.matrixAutoUpdate=false;o.updateMatrix();});
  return{
    root,
    setNight(on){if(lightCard)lightCard.visible=on;},
    dispose(){root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});},
  };
}
