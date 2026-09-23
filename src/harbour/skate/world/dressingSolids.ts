/**
 * The park's dressing as sim colliders (integration, wave 3). `dressPark`
 * stands hedges, fence flats, bleachers, lamps, masts, pots, a crate and rope
 * posts round the spots, off every pad, apron, lane and route. They are not in
 * `field.solids` (the render owns them); the ride merges these solids in so a
 * rider on the grass bumps into a hedge instead of passing through it. Every
 * piece has a `top`: an air over a low crate still clears it.
 *
 * A registry, so the ride (driver: no three.js) never builds meshes: the park
 * scene registers the footprints it built (`buildSkatePark`, at startup), and
 * tests or the lab without a scene call `ensureSkateDressing` (dressingBuild.ts).
 */
import type {SkateSolid} from '../contract.ts';
import type {SkateWorldField} from './field.ts';
import type {DressingFootprint} from './meshesKit.ts';

/** Footprints (world) → sim solids: the oriented box when the piece has one, else its footprint circle. */
export function dressingSolids(footprints:readonly DressingFootprint[]):SkateSolid[] {
  return footprints.map((d):SkateSolid=>d.box
    ?{kind:'obox',id:`dressing:${d.id}`,x:d.x,z:d.z,halfX:d.box.hx,halfZ:d.box.hz,yaw:d.box.yaw,top:d.top}
    :{kind:'circle',id:`dressing:${d.id}`,x:d.x,z:d.z,r:d.r,top:d.top});
}

const registry=new WeakMap<SkateWorldField,readonly SkateSolid[]>();
/** The park scene hands over the footprints it built for this field. */
export function rememberDressing(field:SkateWorldField,footprints:readonly DressingFootprint[]):void {
  registry.set(field,Object.freeze(dressingSolids(footprints)));
}
/** The dressing colliders registered for this field ([] before any park scene or `ensureSkateDressing`). */
export function skateDressingSolids(field:SkateWorldField):readonly SkateSolid[] {
  return registry.get(field)??[];
}
export function hasSkateDressing(field:SkateWorldField):boolean {return registry.has(field);}
