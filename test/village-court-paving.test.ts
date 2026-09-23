import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {buildHarbourLanes} from '../src/harbour/village/lanes.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
describe('village paths',()=>{
  it('uses one walking-ground mesh conforming to the hills',()=>{
    const material=new THREE.MeshBasicMaterial(),lanes=buildHarbourLanes(material),positions=lanes.geometry.getAttribute('position');
    expect(lanes.userData.ground).toBe(true);expect(lanes.material).toBe(material);
    expect(positions.count).toBeGreaterThan(500);expect(positions.count).toBeLessThan(3000);
    for(let i=0;i<positions.count;i++)expect(positions.getY(i)).toBeCloseTo(groundHeightAt(positions.getX(i),positions.getZ(i))+.035,5);
    const normals=lanes.geometry.getAttribute('normal');for(let i=0;i<normals.count;i++)expect(normals.getY(i)).toBeGreaterThan(.9);
    lanes.geometry.dispose();material.dispose();
  });
});
