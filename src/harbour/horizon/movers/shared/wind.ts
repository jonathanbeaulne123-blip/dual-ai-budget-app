/**
 * Wind (FLIGHT.md §2.2). A read-only source: pass 2b's wind clock implements `WindSource`;
 * until then every mover reads the constant south wind at 4 m/s. Nothing here reads money or time
 * beyond the `t` it is handed.
 */

/**
 * `dir` is the direction the wind blows FROM, in radians, 0 = north, clockwise (π/2 = east, π = south).
 * `speed` is m/s (= engine units per second at scale 1.0).
 */
export interface WindSample{dir:number;speed:number}
/** Sample at engine position (x east, y up, z south) and time `t` in seconds. */
export interface WindSource{sample(x:number,y:number,z:number,t:number):WindSample}

export const SOUTH_WIND:WindSample=Object.freeze({dir:Math.PI,speed:4});
/** The placeholder until the wind clock: from the south at 4 m/s everywhere, always. */
export function constantWind(sample:WindSample=SOUTH_WIND):WindSource{const fixed=Object.freeze({...sample});return{sample:()=>fixed};}

/**
 * The air's velocity over the ground in engine axes `[vx, vz]` (x east, z south; north is −z).
 * A south wind (dir π) moves the air north: `[0, −speed]`.
 */
export function windVelocity(sample:WindSample):[number,number]{return[-Math.sin(sample.dir)*sample.speed,Math.cos(sample.dir)*sample.speed];}
