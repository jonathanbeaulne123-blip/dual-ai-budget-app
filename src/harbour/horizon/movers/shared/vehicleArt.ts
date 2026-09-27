/**
 * Vehicle art seam (passes/02-movers.md rule 6; FLIGHT.md §1). Dimensions and anchors are fixed
 * here, by the interface; pass 2b's kit implements `build` with authored dressings and the greybox
 * proxies below stand in until then. No lights are created: running lights are anchors for light
 * cards (STYLE §1.11, LIGHT §3), never dynamic lights. No text.
 *
 * Vehicle-local frame: origin at the first seat, +y up, +z forward (the runtime's yaw 0 faces +z),
 * so +x is the vehicle's left (port) and −x its right (starboard).
 */
import * as THREE from 'three';
import type {ModeId,Vec3} from './mode.ts';

export type VehicleDressing='classic'|'taylor'|'newfoundland';
export type VehicleTier='full'|'lite';
export type VehicleId=Exclude<ModeId,'feet'>;
export type RunningLightColour='port'|'starboard'|'white';
/** STYLE §1.11 running-light colours. */
export const RUNNING_LIGHT_COLOURS:Record<RunningLightColour,string>={port:'#e0463a',starboard:'#3fb07a',white:'#f6f4ea'};
export interface VehicleAnchors{seat:Vec3[];cameraMount:Vec3;runningLights:{at:Vec3;colour:RunningLightColour}[];contact:Vec3}
export interface VehicleArt{build(dressing:VehicleDressing,tier:VehicleTier):THREE.Object3D;anchors:VehicleAnchors}

/** Fixed dimensions in metres (engine units at scale 1.0). `null` = not fixed yet (the mover's track fixes it before pass 2b). */
export const VEHICLE_DIMENSIONS={
  glider:{span:10,keel:3.2},
  parachute:{canopy:[7,3] as const,lines:5},
  board:null,bicycle:null,gondola:null,cart:null,zip:null,plane:null,balloon:null,row:null,canoe:null,dinghy:null,ferry:null,
} as const satisfies Record<VehicleId,unknown>;

const G=VEHICLE_DIMENSIONS.glider,P=VEHICLE_DIMENSIONS.parachute;
/** Keel line height above the hang point. */
const KEEL_Y=.3;
export const VEHICLE_ANCHORS:Partial<Record<VehicleId,VehicleAnchors>>={
  // Hang glider: the rider hangs prone at the hang point under the keel; nose forward, tips aft.
  glider:{seat:[[0,0,0]],cameraMount:[0,KEEL_Y,-1.2],runningLights:[{at:[0,KEEL_Y,-G.keel/2],colour:'white'}],contact:[0,-1.3,0]},
  // Square canopy: the rider upright in the harness, the canopy `lines` above.
  parachute:{seat:[[0,0,0]],cameraMount:[0,.3,-.6],runningLights:[{at:[0,.1,-.2],colour:'white'}],contact:[0,-1.2,0]},
};

const GREY:Record<VehicleDressing,string>={classic:'#b9b2a2',taylor:'#c9c2b4',newfoundland:'#aab3b0'};
function material(dressing:VehicleDressing){return new THREE.MeshStandardMaterial({color:GREY[dressing],roughness:.9,metalness:0,side:THREE.DoubleSide});}
function flatTriangle(dressing:VehicleDressing){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,KEEL_Y,G.keel/2, G.span/2,KEEL_Y,-G.keel/2, -G.span/2,KEEL_Y,-G.keel/2],3));
  geometry.setIndex([0,1,2]);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material(dressing));mesh.name='greybox.glider.sail';return mesh;
}
function canopyOnLines(dressing:VehicleDressing){
  const group=new THREE.Group(),[w,d]=P.canopy,canopy=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material(dressing));
  canopy.rotation.x=-Math.PI/2;canopy.position.y=P.lines;canopy.name='greybox.parachute.canopy';group.add(canopy);
  const points:number[]=[];for(const x of[-w/2,w/2])for(const z of[-d/2,d/2])points.push(0,.2,0,x,P.lines,z);
  const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  const segments=new THREE.LineSegments(lines,new THREE.LineBasicMaterial({color:'#5d5a52'}));segments.name='greybox.parachute.lines';group.add(segments);
  return group;
}
/**
 * A greybox proxy honouring the fixed dimensions and anchors: the glider a flat triangle, the
 * parachute a flat rectangle on four lines, every other vehicle a 1 × 1 × 2 placeholder block
 * until its track fixes dimensions.
 */
export function greyboxArt(id:VehicleId):VehicleArt{
  const anchors=VEHICLE_ANCHORS[id]??{seat:[[0,0,0]],cameraMount:[0,1.5,-3],runningLights:[],contact:[0,0,0]};
  return{anchors,build(dressing){
    const root=new THREE.Group();root.name=`greybox.${id}`;
    if(id==='glider')root.add(flatTriangle(dressing));
    else if(id==='parachute')root.add(canopyOnLines(dressing));
    else{const block=new THREE.Mesh(new THREE.BoxGeometry(1,1,2),material(dressing));block.position.y=.5;root.add(block);}
    root.userData.anchors=anchors;return root;
  }};
}
