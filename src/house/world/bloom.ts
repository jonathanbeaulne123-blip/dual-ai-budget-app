import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { QueenStyle } from "../queenStyle.ts";

export type BloomEvidence = {id: string; title: string; kind:"intention"|"lived"|"revision"|"care"; date: string | null; revision: number};
export const BLOOM_MASTER_SHA256 = "ddde35ae3ce025563ab546b13dc54f6f4376a1cddffe947c14dca082e05c2561";
const hash = (text: string) => [...text].reduce((sum,c)=>Math.imul(sum ^ c.charCodeAt(0),16777619)>>>0,2166136261);
/** Which tier of her the figure is cloned from. `lite` is the decimated court copy: same node names, a quarter of the bytes. */
export type BloomTier = "full" | "lite";
export const BLOOM_MASTERS: Readonly<Record<BloomTier,string>> = Object.freeze({
  full: "/models/mandevilla-living-presence.glb",
  lite: "/models/mandevilla-living-presence.court.glb",
});
type MasterHold = {model:Promise<THREE.Group>|null;root:THREE.Group|null;users:number};
/** One hold per file, ref-counted: a page that shows her twice downloads her once. */
const holds = new Map<string,MasterHold>();
const holdFor = (url:string):MasterHold => { let hold=holds.get(url); if(!hold){hold={model:null,root:null,users:0};holds.set(url,hold);} return hold; };
async function acquireMaster(url:string){const hold=holdFor(url);hold.users++;try{hold.model??=new GLTFLoader().loadAsync(url).then(gltf=>{hold.root=gltf.scene;return gltf.scene;});return await hold.model;}catch(error){hold.users--;hold.model=null;throw error;}}
function releaseMaster(url:string){const hold=holds.get(url);if(!hold)return;hold.users--;if(hold.users===0&&hold.root){disposeObject(hold.root);hold.root=null;hold.model=null;}}
/**
 * What is drawn around the master. The house keeps both (today's look); the
 * Court asks for `{decoration:false}` so nothing is drawn over her own pot —
 * no second pot, crown torus, trellis or eggs — while the growth stems stay.
 * `tier` picks the file she is cloned from; it does not change what is drawn.
 */
export type BloomQueenOptions = { decoration?: boolean; growth?: boolean; tier?: BloomTier };
export const BLOOM_QUEEN_HEIGHT = 2.05;
export async function createBloomQueen(style: QueenStyle, evidence: BloomEvidence[], options: BloomQueenOptions = {}): Promise<THREE.Group> {
  const {decoration:withDecoration=true,growth:withGrowth=true,tier="full"}=options;
  // A lite tier that cannot find its court copy still gets her: the master is
  // the fallback, exactly as it was before the tiers existed.
  let url = BLOOM_MASTERS[tier] ?? BLOOM_MASTERS.full;
  let loaded: THREE.Group;
  try { loaded = await acquireMaster(url); }
  catch (error) { if (url === BLOOM_MASTERS.full) throw error; url = BLOOM_MASTERS.full; loaded = await acquireMaster(url); }
  const group = new THREE.Group(); group.name = "Bloom V2 · Living Presence";
  const sculpture = loaded.clone(true);
  sculpture.traverse(node=>{node.userData.bloomSharedResource=true;});
  group.userData.releaseBloomMaster=()=>releaseMaster(url);
  const box = new THREE.Box3().setFromObject(sculpture), size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3());
  sculpture.position.set(-center.x,-box.min.y,-center.z);
  const normal = new THREE.Group(); normal.name="Normalised master"; normal.add(sculpture); normal.scale.setScalar(BLOOM_QUEEN_HEIGHT / Math.max(size.y,.01)); group.add(normal);
  sculpture.traverse(node => {if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=true;}});
  group.userData.evidence=evidence;
  if(withDecoration){
  const decoration = new THREE.Group(); decoration.name="Personal styling · never financial form";
  group.add(decoration);
  const potColor={terracotta:0xb66547,porcelain:0xf0e7d4,"sea-glass":0x609e91}[style.pot];
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(.54,.41,.42,32),new THREE.MeshStandardMaterial({color:potColor,roughness:.3,metalness:.05})); pot.position.y=-.06; decoration.add(pot);
  if(style.crown!=="none"){
    const crown=new THREE.Mesh(new THREE.TorusGeometry(.29,.025,6,40),new THREE.MeshStandardMaterial({color:style.crown==="brass"?0xcaa252:0x718348,metalness:.35,roughness:.45}));crown.rotation.x=Math.PI/2;crown.position.y=1.97;decoration.add(crown);
  }
  if(style.trellis!=="none")for(let i=0;i<5;i++){
    const angle=(i-2)*.22, x=(i-2)*.3;
    const points=style.trellis==="fan"?[new THREE.Vector3(0,.1,-.35),new THREE.Vector3(Math.sin(angle)*1.7,2.3,-.35)]:[new THREE.Vector3(x,.2,-.4),new THREE.Vector3(x,2.1+(.4-Math.abs(x)*.5),-.4)];
    decoration.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),8,.013,5,false),new THREE.MeshStandardMaterial({color:0xa78652,roughness:.7})));
  }
  for(let i=0;i<3;i++){
    const minion=new THREE.Mesh(new THREE.SphereGeometry(.14,14,10),new THREE.MeshStandardMaterial({color:[0xd9bd84,0x8ca890,0xcf937f][i],roughness:.34}));minion.scale.y=1.45;
    minion.position.set(style.minions==="pairs"?(i-1)*.4:Math.cos((i+1)*.8)*.85,.11,style.minions==="garden"?-.65: .5+Math.sin(i)*.18);decoration.add(minion);
  }
  }
  if(withGrowth)group.add(createBloomGrowth(style,evidence));
  return group;
}
/** The supported-history stems and blooms alone, seated at the group origin (stem bases at y≈0.15). The Court seats them at the roots itself. */
export function createBloomGrowth(style: QueenStyle, evidence: BloomEvidence[]): THREE.Group {
  const growth=new THREE.Group();growth.name="Supported history · identity anchored";
  // Each authored event has its own stable branch. Appending history cannot move another branch.
  for(const row of evidence.slice(0,36)){
    const seed=hash(row.id),angle=(seed%628)/100, height=.5+(seed%130)/100, radius=.45+(seed%25)/100;
    const end=new THREE.Vector3(Math.cos(angle)*radius,height,Math.sin(angle)*radius);
    const stem=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,.15,0),new THREE.Vector3(end.x*.4,height*.6,end.z*.6),end]),12,.018,5,false),new THREE.MeshStandardMaterial({color:0x527653,roughness:.8}));growth.add(stem);
    const bloomColor=row.kind==="care"?0xfff3d7:style.flowers==="ivory"?0xf8e9d6:style.flowers==="rose"?0xe39bae:0xc54350;
    if(row.kind==="lived"||row.kind==="care")for(let p=0;p<5;p++){
      const petal=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),new THREE.MeshStandardMaterial({color:bloomColor,roughness:.58}));petal.scale.set(1.1,.42,1.5);petal.position.copy(end).add(new THREE.Vector3(Math.cos(p*Math.PI*.4)*.08,Math.sin(p*Math.PI*.4)*.06,0));growth.add(petal);
    } else {const bud=new THREE.Mesh(new THREE.SphereGeometry(row.kind==="revision"?.045:.07,8,6),new THREE.MeshStandardMaterial({color:row.kind==="revision"?0xab884c:0x6f944e}));bud.position.copy(end);growth.add(bud);}
  }
  return growth;
}
export function disposeObject(root: THREE.Object3D): void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(node=>{if(node instanceof THREE.Mesh&&!node.userData.bloomSharedResource){geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);}}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  if(typeof root.userData.releaseBloomMaster==="function"){const release=root.userData.releaseBloomMaster;delete root.userData.releaseBloomMaster;release();}
}
