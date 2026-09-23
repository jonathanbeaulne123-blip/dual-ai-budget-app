import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { housePath,parseHouseRoute } from '../src/hearthside/houseRoutes.ts';
import { hearthsidePath,parseHearthsideRoute } from '../src/hearthside/routes.ts';
import { houseTargetRoute,houseLifeRoute,houseRouteFromLife,houseRoomRoute,houseSurfaceRoute } from '../src/house/navigation.ts';
import { houseCameraRoute } from '../src/house/returnCache.ts';
import { binderyDivisionFor } from '../src/house/bindery.ts';
import { libraryInterior } from '../src/harbour/interiors/libraryInterior.ts';
import { studioInterior } from '../src/harbour/interiors/studioInterior.ts';
import { libraryDressingFrom } from '../src/harbour/library/dressing.ts';
import { kilnDressingFrom } from '../src/harbour/kiln/dressing.ts';
const origin={householdId:'HH-review',scope:'household' as const,room:'making' as const,level:'above' as const};
describe('authored room continuity',()=>{
  it.each([['wheel','shape'],['paint','paint'],['kiln','kiln']] as const)('opens %s, keeps the selected piece and restores %s on reload',(object,bench)=>{
    const entry=houseTargetRoute(origin,'pottery',object);
    expect(entry.studioTab).toBe(bench);
    const life={...houseLifeRoute(entry),studioSelection:{designId:'DESIGN-one',pieceId:'PIECE-one'}};
    const legacy=parseHearthsideRoute(hearthsidePath(life),origin.householdId)!;
    const selected=houseRouteFromLife(legacy,'household');
    expect(selected).toMatchObject({...origin,surface:'pottery',studioTab:bench,studioSelection:life.studioSelection});
    expect(parseHouseRoute(housePath(selected),origin.householdId)).toEqual(selected);
    expect(houseRoomRoute(selected)).not.toHaveProperty('studioTab');
    expect(()=>housePath(houseCameraRoute(selected))).not.toThrow();
  });
  it('keeps an addressed piece while turning the workbench, without making a new object',()=>{
    const entry=houseTargetRoute(origin,'pottery','piece/PIECE-one/DESIGN-one');
    const life={...houseLifeRoute(entry),studioTab:'paint' as const};
    const selected=houseRouteFromLife(life,'household');
    expect(selected.object).toBe(entry.object);
    expect(selected.studioTab).toBe('paint');
    expect(parseHearthsideRoute(hearthsidePath(life),origin.householdId)).toEqual(life);
  });
  it('rejects a bench on a non-studio surface and unknown benches',()=>{
    for(const surface of ['books','letters','pottery'])expect(parseHouseRoute(`/house/making/above?household=HH-review&surface=${surface}&bench=unknown`,'HH-review')).toBeNull();
    expect(parseHouseRoute('/house/making/above?household=HH-review&surface=books&bench=paint','HH-review')).toBeNull();
    expect(parseHearthsideRoute('/hearthside/rooms/studio?household=HH-review&surface=letters&bench=paint','HH-review')).toBeNull();
    const wardrobe=houseSurfaceRoute({...origin,surface:'pottery',studioTab:'paint'},'wardrobe');
    expect(wardrobe.studioTab).toBeUndefined();
    expect(()=>housePath(wardrobe)).not.toThrow();
  });
  it('opens Today and Record explicitly without mistaking another object for a chapter',()=>{
    expect(binderyDivisionFor('chapter/today')).toBe('Today');expect(binderyDivisionFor('chapter/record')).toBe('Record');expect(binderyDivisionFor('chapter/made-up')).toBeNull();
  });
});
describe('original room resources',()=>{
  it.each(['classic','taylor','newfoundland'])('builds %s with finite geometry and releases each allocated resource',theme=>{
    for(const build of [()=>{const root=new THREE.Group();return {root,handle:libraryInterior(root,libraryDressingFrom(theme))};},()=>{const root=new THREE.Group();return {root,handle:studioInterior(root,kilnDressingFrom(theme))};}]){
      const {root,handle}=build(),resources=new Set<THREE.BufferGeometry|THREE.Material>();let triangles=0;
      root.traverse(node=>{if(node instanceof THREE.Mesh){resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])resources.add(material);const position=node.geometry.getAttribute('position');expect([...position.array].every(Number.isFinite)).toBe(true);triangles+=position.count/3;}});
      expect(triangles).toBeGreaterThan(1000);expect(triangles).toBeLessThan(200000);
      const spies=[...resources].map(resource=>vi.spyOn(resource,'dispose'));handle.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);handle.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
