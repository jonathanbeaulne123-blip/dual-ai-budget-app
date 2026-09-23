import * as THREE from "three";
import type { TowerBank, TowerReading } from "../data/reading.ts";
import { EngravedPlate, engravedWords, plateFinish } from "../court/engraved.ts";
import { registerPlace, type Anchor, type Place, type PlaceHandle, type PlaceReading, type Pose, type Region } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { bankHeight, createBankSculpture, type BankSculpture } from "../tower/banks.ts";

/** The home loft is a single usable room, not the legacy four-storey tower. */
export const LOFT_LAYOUT = Object.freeze({ halfX: 4.5, halfZ: 3.5, shelfY: [0.8, 1.7, 2.4] as const, columns: 6 });
const EMPTY_TOWER: TowerReading = { shelves: [], jug: { safeCents: 0, custodian: false, holder: null }, gun: { available: false }, largestTargetCents: 0, smallestTargetCents: 0 };

type LoftSlot = { bank: TowerBank; sculpture: BankSculpture; plate: EngravedPlate; position: readonly [number, number, number] };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const localBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number) => new THREE.Box3(new THREE.Vector3(x - hx, y - hy, z - hz), new THREE.Vector3(x + hx, y + hy, z + hz));

function safeReading(reading: PlaceReading | null): TowerReading {
  return reading?.tower ?? EMPTY_TOWER;
}

function bankWords(bank: TowerBank): string {
  return `${bank.name} — ${engravedWords(bank.cents)} of ${engravedWords(bank.targetCents)}. Open the Loft.`;
}
function bankSignature(reading: TowerReading): string {
  return [reading.smallestTargetCents, reading.largestTargetCents, ...reading.shelves.flatMap(shelf => shelf.banks).map(bank => [bank.key, bank.name, bank.cents, bank.targetCents, bank.step, bank.goalId ?? ""].join("~"))].join("|");
}

/** A compact timber loft that consumes only the established tower reading. */
export function createLoft(scene: THREE.Scene, dressing: { timber: string; metal: string; stone: string }, reading: PlaceReading | null, quality: RenderTier): PlaceHandle {
  const group = new THREE.Group(); group.name = "village-loft";
  const owned: { dispose(): void }[] = [];
  const material = (color: string, roughness = 0.8) => { const value = new THREE.MeshStandardMaterial({ color, roughness }); owned.push(value); return value; };
  const wood = material(dressing.timber), brass = material(dressing.metal, 0.45), stone = material(dressing.stone, 0.92), glass = material("#a9c7c4", 0.2), cushion = material("#c1a47d", .9);
  const add = (size: readonly [number, number, number], at: readonly [number, number, number], name: string, source = wood, rotation?: readonly [number, number, number]): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(...size), mesh = new THREE.Mesh(geometry, source); geometry.translate(0, 0, 0); owned.push(geometry); mesh.name = name; mesh.position.set(...at); if(rotation)mesh.rotation.set(...rotation); mesh.castShadow = quality === "full"; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  add([9, .14, 7], [0, 0, 0], "loft-timber-floor");
  add([9, 3.1, .16], [0, 1.55, -3.42], "loft-back-wall", stone);
  add([.16, 3.1, 7], [-4.42, 1.55, 0], "loft-west-wall", stone);
  add([.16, 3.1, 7], [4.42, 1.55, 0], "loft-east-wall", stone);
  for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) add([.18, 2.95, .24], [x, 1.48, -3.22], "loft-back-beam", wood);
  const glassWindow=add([2.2, 1.04, .035], [0, 1.75, -3.32], "loft-back-window-glass", glass);(glassWindow.material as THREE.MeshStandardMaterial).transparent=true;(glassWindow.material as THREE.MeshStandardMaterial).opacity=.62;
  add([2.35, .09, .1], [0, 2.31, -3.32], "loft-back-window-top", brass);add([.09, 1.15, .1], [-1.13, 1.75, -3.32], "loft-back-window-left", brass);add([.09, 1.15, .1], [1.13, 1.75, -3.32], "loft-back-window-right", brass);add([.055, 1.0, .1], [0, 1.75, -3.29], "loft-window-mullion", brass);
  add([2.62, .16, .62], [0, .67, -2.82], "loft-window-seat");
  add([2.38, .09, .52], [0, .79, -2.72], "loft-window-seat-cushion", cushion);
  for (const side of [-1,1]) for(const x of [-3.4,0,3.4]) add([3.15,.11,.12],[x,2.88,-.5],"loft-sloped-rafter",wood,[0,0,-side*.28]);
  // The portals occupy the front corners; furniture deliberately leaves both clear.
  add([.86, .11, 1.25], [-2, .07, 1.7], "loft-kitchen-stair-clear");
  add([.86, .11, 1.25], [2, .07, -1.5], "loft-atlas-stair-clear");
  const lamp = new THREE.PointLight("#f4cd82", quality === "full" ? .7 : .4, 6); lamp.position.set(0, 2.75, -.6); group.add(lamp);

  const shelfGroup=new THREE.Group();shelfGroup.name="loft-adaptive-bank-shelves";group.add(shelfGroup);
  let shelfParts:THREE.BufferGeometry[]=[];
  const rebuildShelves=(rows:number,rowY:readonly number[])=>{for(const geometry of shelfParts)geometry.dispose();shelfParts=[];shelfGroup.clear();for(let index=0;index<rows;index++){const y=rowY[index]!;for(const [size,at,name] of [[[7.25,.12,.7],[0,y,-2.55],`loft-bank-shelf-${index}`],[[.12,.68,.58],[-3.55,y-.32,-2.55],`loft-shelf-post-left-${index}`],[[.12,.68,.58],[3.55,y-.32,-2.55],`loft-shelf-post-right-${index}`]] as const){const geometry=new THREE.BoxGeometry(size[0],size[1],size[2]);shelfParts.push(geometry);const item=new THREE.Mesh(geometry,wood);item.name=name;item.position.set(at[0],at[1],at[2]);item.receiveShadow=true;shelfGroup.add(item);}}};
  let slots: LoftSlot[] = [], current = safeReading(reading), signature = bankSignature(current), disposed = false;
  const clearSlots = () => { for (const slot of slots) { slot.sculpture.dispose(); slot.plate.dispose(); } slots = []; };
  const rebuild = (next: TowerReading) => {
    clearSlots(); current = next;
    const banks = next.shelves.flatMap(shelf => shelf.banks);
    const rows=Math.max(1,Math.ceil(banks.length/LOFT_LAYOUT.columns));
    const rowY=Array.from({length:rows},(_,index)=>rows===1?1.55:.62+index*(1.82/(rows-1)));rebuildShelves(rows,rowY);
    const finish = plateFinish("current");
    for (let index = 0; index < banks.length; index++) {
      const bank = banks[index]!, row = Math.floor(index / LOFT_LAYOUT.columns), column = index % LOFT_LAYOUT.columns;
      const y = rowY[row]!, x = -2.75 + column * 1.1, z = -2.52;
      const sculpture = createBankSculpture(bank, { brass: dressing.metal, wood: dressing.timber });
      sculpture.setScale(bankHeight(bank.targetCents, next.smallestTargetCents, next.largestTargetCents));
      sculpture.setFill(bank.step, false); sculpture.group.position.set(x, y + .07, z); sculpture.group.userData.anchor = `bank:${bank.key}`;
      sculpture.group.traverse(node => { node.userData.anchor = `bank:${bank.key}`; }); group.add(sculpture.group);
      const plate = new EngravedPlate({ stone: dressing.stone, ink: "#30251f", size: "small", fit: true }, .96, .25);
      plate.set(`${bank.name}\n${Math.round(clamp(bank.step, 0, 10) * 10)}%`, finish); plate.mesh.position.set(x, y + .18, z + .43); plate.mesh.rotation.x = -.55; plate.mesh.userData.anchor = `bank:${bank.key}`; group.add(plate.mesh);
      slots.push({ bank, sculpture, plate, position: [x, y + .35, z] });
    }
  };
  rebuild(current); scene.add(group);

  const anchors = (): Anchor[] => [
    { id: "home-down", position: [-2, 0, 1.7], zone: "portal", label: "Down to the Kitchen" },
    { id: "home-atlas", position: [2, 0, -1.5], zone: "portal", label: "Step into the Atlas nook" },
    { id: "loft-banks", position: [0, 1.1, -2.15], zone: "shelf", label: "The bank shelves — open the Loft", door: { target: "loft-banks" } },
    ...slots.map(slot => ({ id: `bank:${slot.bank.key}`, position: slot.position, zone: "bank", label: bankWords(slot.bank), door: { target: "loft-banks", object: `bank/plan:${slot.bank.goalId ?? slot.bank.key}` } })),
  ];
  const poses = (): Record<string, Pose> => ({
    "tower:desktop": { target: [0, 1.25, -1.7], r: 4.6, theta: 0, phi: 1.14 },
    "tower:phone": { target: [0, 1.3, -1.85], r: 3.6, theta: 0, phi: 1.18 },
    "object:loft-banks:desktop": { target: [0, 1.2, -2.35], r: 3.2, theta: 0, phi: 1.2 },
    "object:loft-banks:phone": { target: [0, 1.2, -2.35], r: 2.8, theta: 0, phi: 1.2 },
  });
  return {
    group,
    update(next) { const tower=safeReading(next), nextSignature=bankSignature(tower); if(nextSignature===signature)return;signature=nextSignature;rebuild(tower); },
    animate(t) { lamp.intensity = (quality === "full" ? .68 : .38) + Math.sin(t * 2) * .03; return slots.some(slot => slot.sculpture.update(t * 1000)); },
    anchors,
    poses,
    regions: (): Region[] => anchors().map(anchor => ({ id: anchor.id, group: "tower", label: anchor.label, box: localBox(anchor.position[0], anchor.position[1], anchor.position[2], anchor.zone === "bank" ? .42 : .65, .55, .48) })),
    dispose() { if (disposed) return; disposed = true; clearSlots(); for(const geometry of shelfParts)geometry.dispose();shelfParts=[]; scene.remove(group); for (const item of owned) item.dispose(); group.clear(); },
  };
}

/** The village entry replaces the legacy multi-floor stone tower when imported. */
export const loftPlace: Place = registerPlace({ id: "tower", build: (scene, dressing, reading, quality) => createLoft(scene, dressing, reading, quality) });
