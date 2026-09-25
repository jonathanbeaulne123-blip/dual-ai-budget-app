/**
 * The land's height, composed exactly as `scene/ground.ts` `groundHeightAt` composes it
 * (island, baked mountain, town channel), without importing the renderer's ground module.
 * Collision data (`artGeometry.ts`) is evaluated while `surfaces.ts` loads, and
 * `scene/ground.ts` reaches the skate park (and so `surfaces.ts`) through its planting;
 * this leaf keeps that import graph acyclic. test/mountain-art-kit.test.ts holds the two equal.
 */
import {islandHeight} from '../islandShape.ts';
import {mountainBaseHeight} from '../definition.ts';
import {mountainGround} from '../mountainGround.ts';
import {townChannelHeight} from '../townChannel.ts';

export function landHeight(x:number,z:number):number{
  if(z<-48)return Math.max(islandHeight(x,z),mountainBaseHeight(x,z));
  const island=z<-30?Math.max(islandHeight(x,z),mountainGround(x,z)):islandHeight(x,z);
  return townChannelHeight(x,z,island);
}
