import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original room joinery. Static pieces share a material/interaction batch;
 * a room owns and disposes every resource it allocates. No financial state. */
export class Craft {
  private batches = new Map<string, { material: THREE.MeshStandardMaterial; parts: THREE.BufferGeometry[]; anchor?: string }>();
  private resources = new Set<{dispose():void}>();
  constructor(readonly root: THREE.Group) {}
  material(colour: string, metal = false) {
    const key = `${colour}:${metal}`;
    let batch = this.batches.get(key);
    if (!batch) {
      const material = new THREE.MeshStandardMaterial({ color: colour, roughness: metal ? .35 : .79, metalness: metal ? .65 : 0 });
      this.resources.add(material); batch = { material, parts: [] }; this.batches.set(key, batch);
    }
    return batch.material;
  }
  piece(geometry: THREE.BufferGeometry, colour: string, xyz: readonly number[], rotation: readonly number[] = [0,0,0], anchor?: string, metal = false) {
    if(geometry.index){const indexed=geometry;geometry=geometry.toNonIndexed();indexed.dispose();}
    geometry.rotateX(rotation[0] ?? 0).rotateY(rotation[1] ?? 0).rotateZ(rotation[2] ?? 0);
    geometry.translate(xyz[0]!, xyz[1]!, xyz[2]!);
    const key = `${colour}:${metal}:${anchor ?? ''}`;
    const batch = this.batches.get(key) ?? { material: this.material(colour, metal), parts: [], anchor };
    batch.parts.push(geometry); this.batches.set(key, batch);
  }
  box(size: readonly number[], at: readonly number[], colour: string, anchor?: string, rotation?: readonly number[]) {
    this.piece(new THREE.BoxGeometry(size[0],size[1],size[2]), colour, at, rotation, anchor);
  }
  cylinder(top: number, bottom: number, height: number, at: readonly number[], colour: string, anchor?: string, rotation?: readonly number[]) {
    this.piece(new THREE.CylinderGeometry(top,bottom,height,24), colour, at, rotation, anchor);
  }
  ring(radius:number, tube:number, at:readonly number[], colour:string, anchor?:string, rotation?:readonly number[]) {
    this.piece(new THREE.TorusGeometry(radius,tube,6,32),colour,at,rotation,anchor,true);
  }
  vessel(at:readonly number[], radius:number, height:number, colour:string, anchor?:string) {
    const profile = [[.38,0],[.68,.025],[.9,.2],[1,.48],[.88,.7],[.57,.82],[.55,.94],[.6,1],[.48,1],[.45,.92],[.48,.83],[.72,.67],[.83,.45],[.7,.15],[0,.1]].map(([x,y])=>new THREE.Vector2(x!*radius,y!*height));
    this.piece(new THREE.LatheGeometry(profile,24),colour,at,undefined,anchor);
  }
  leg(x:number,z:number,height:number,colour:string,anchor?:string) {
    const profile = [[.11,0],[.12,.04],[.07,.12],[.065,.25],[.09,.3],[.06,.38],[.07,.78],[.12,.85],[.12,1]].map(([r,y])=>new THREE.Vector2(r!,y!*height));
    this.piece(new THREE.LatheGeometry(profile,12),colour,[x,0,z],undefined,anchor);
  }
  arch(width:number,height:number,at:readonly number[],colour:string,anchor?:string) {
    const r=width/2, spring=height-r, shape=new THREE.Shape();
    shape.moveTo(-r,0); shape.lineTo(r,0); shape.lineTo(r,spring); shape.absarc(0,spring,r,0,Math.PI,false); shape.lineTo(-r,0);
    this.piece(new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:false,curveSegments:24}),colour,at,undefined,anchor);
  }
  plant(x:number,y:number,z:number,scale=1,pot='#b7754f',anchor?:string) {
    this.vessel([x,y,z],.19*scale,.3*scale,pot,anchor);
    for(let i=0;i<9;i++) {
      const angle=i*2.4, reach=(.16+(i%3)*.09)*scale;
      this.cylinder(.009*scale,.012*scale,.45*scale,[x+Math.sin(angle)*reach*.3,y+.43*scale,z+Math.cos(angle)*reach*.3],'#46563b',anchor,[Math.cos(angle)*.3,0,Math.sin(angle)*.3]);
      const leaf=new THREE.SphereGeometry(1,8,6);leaf.scale(.095*scale,.2*scale,.022*scale);
      this.piece(leaf,i%2?'#71835b':'#4a6247',[x+Math.sin(angle)*reach,y+(.58+(i%3)*.08)*scale,z+Math.cos(angle)*reach],[.6,angle,.35],anchor);
    }
  }
  lamp(x:number,y:number,z:number,colour:string,anchor?:string) {
    this.cylinder(.14,.19,.04,[x,y,z],'#b28b45',anchor);
    this.cylinder(.024,.035,.45,[x,y+.25,z],'#b28b45',anchor);
    this.piece(new THREE.SphereGeometry(.23,20,10,0,Math.PI*2,0,Math.PI/2),colour,[x,y+.48,z],undefined,anchor);
    this.cylinder(.22,.22,.012,[x,y+.48,z],'#efcf86',anchor);
    const light=new THREE.PointLight('#ffd894',.65,3,2); light.position.set(x,y+.42,z);this.root.add(light);
  }
  finish() {
    for(const {material,parts,anchor} of this.batches.values()) {
      if(!parts.length)continue;
      const geometry=mergeGeometries(parts,false);
      for(const part of parts)part.dispose();
      if(!geometry)continue;
      this.resources.add(geometry);
      const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;
      mesh.name=anchor?`crafted-${anchor}`:'crafted-joinery';
      if(anchor)mesh.userData.anchor=anchor;
      this.root.add(mesh);
    }
    this.batches.clear();
    return {dispose:()=>{for(const item of this.resources)item.dispose();this.resources.clear();}};
  }
}
