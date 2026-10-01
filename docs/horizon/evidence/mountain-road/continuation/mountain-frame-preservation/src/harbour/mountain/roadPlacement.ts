import type {Point3} from './math.ts';
/** A repaired transverse draw frame may be mitred or displaced. Non-road scenery
 * keeps its authored placement frame, including seeded planting decisions. Road
 * decks, edge rails, bridge frames and physical collision keep reading `normal`. */
export function placementRoadNormal(sample:{normal:Point3;placementNormal?:Point3}):Point3{
  return sample.placementNormal??sample.normal;
}
