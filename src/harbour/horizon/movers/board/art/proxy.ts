/**
 * The board's greybox (RIDE §11: "greybox deck through VehicleArt until pass 2b"). Dimensions
 * from Skate v2's boardGeometry.ts (0.66 × 0.31 deck, top at 0.11; wheels at the trucks). The
 * group's origin is the contact point under the board's centre; +z is the nose.
 *
 * The runtime does not attach it yet (HANDOFF-notes/board.md): it belongs under the rider's
 * figure, yawed by the body's yaw, pitched by `pose.pitch` and rolled by `pose.roll`.
 */
import * as THREE from 'three';

export const BOARD_PROXY = Object.freeze({
  length: 0.66, width: 0.31, top: 0.11, thickness: 0.022,
  wheelRadius: 0.05, wheelWidth: 0.042, truckZ: 0.218, wheelX: 0.134,
});

export interface BoardProxy {
  group: THREE.Group;
  /** Where the rider's feet stand, where a first-person camera would sit, and the ground contact. */
  anchors: { seat: THREE.Object3D; cameraMount: THREE.Object3D; contact: THREE.Object3D };
  dispose(): void;
}

export function buildBoardProxy(): BoardProxy {
  const P = BOARD_PROXY, group = new THREE.Group();
  group.name = 'board.proxy';
  const deckMat = new THREE.MeshStandardMaterial({color: 0x8a8f96, roughness: 0.85});
  const wheelMat = new THREE.MeshStandardMaterial({color: 0xd9d4c7, roughness: 0.6});
  const deckGeo = new THREE.BoxGeometry(P.width, P.thickness, P.length);
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.name = 'board.deck';
  deck.position.y = P.top - P.thickness / 2;
  group.add(deck);
  const wheelGeo = new THREE.CylinderGeometry(P.wheelRadius, P.wheelRadius, P.wheelWidth, 12);
  wheelGeo.rotateZ(Math.PI / 2);   // axle along x
  for (const z of [-P.truckZ, P.truckZ]) for (const x of [-P.wheelX, P.wheelX]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.name = 'board.wheel';
    wheel.position.set(x, P.wheelRadius, z);
    group.add(wheel);
  }
  const anchor = (name: string, y: number, z = 0): THREE.Object3D => { const o = new THREE.Object3D(); o.name = name; o.position.set(0, y, z); group.add(o); return o; };
  const anchors = {seat: anchor('board.seat', P.top), cameraMount: anchor('board.cameraMount', P.top + 1.1, -0.1), contact: anchor('board.contact', 0)};
  return {
    group, anchors,
    dispose() { deckGeo.dispose(); wheelGeo.dispose(); deckMat.dispose(); wheelMat.dispose(); group.removeFromParent(); },
  };
}
