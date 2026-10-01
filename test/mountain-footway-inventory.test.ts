import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// Pure data helper: no terrain, native scene or controller module graph.
import {mountainFootwayRoutes,nativeFootwayRoutes} from '../scripts/horizon/mountain-footway-routes.mjs';
const snapshot=JSON.parse(readFileSync(fileURLToPath(new URL('../src/harbour/horizon/land/mountainV2/v2-data.json',import.meta.url)),'utf8'));
const named=['walk mountainV2.promenade','walk crown','walk summit','walk summitStation','crownLaunch.stair','walk footQuay','walk lakerim','southPortal.link'];
const points=[[0,0,0],[2,0,0]],bed=(id:string)=>({id,kind:'walk',points});
const world={regions:[{id:'mountainV2',footprint:{minX:-1,maxX:3,minZ:-1,maxZ:1}}],beds:[...named.map(bed),bed('yearWalk'),{...bed('spur stillwater'),kind:'road'}],journey:{stations:[{id:'jan',stretch:{from:'dec',points}}]}};
describe('independent native footway audit inventory',()=>{
 it('retains every old attempt and appends the52 exact authored paths without fabricated connecting segments',()=>{
  const old=mountainFootwayRoutes(world,world),all=mountainFootwayRoutes(world,world,snapshot,snapshot),native=all.slice(old.length);
  expect(all.slice(0,old.length)).toEqual(old);expect(snapshot.nativePlanning.walks).toHaveLength(52);expect(native).toHaveLength(52);
  expect(new Set(native.map((r:any)=>r.sourcePathId)).size).toBe(52);
  native.forEach((r:any,i:number)=>{const source=snapshot.nativePlanning.walks[i];expect(r.points).toBe(source.points);expect(r.sourcePathId).toBe(source.id);expect(r.sourceBedId).toBeNull();expect(r.sourceWidthM).toBe(source.halfWidth*2);expect(r.sourceRange).toEqual([0,source.points.length-1]);expect(r.baseline.status).toBe('native-export-unchanged');});
 });
 it('retains short paths as invalid attempts and separates missing baseline from unchanged source',()=>{
  const changed=structuredClone(snapshot);changed.nativePlanning.walks[0].points[0][1]+=.1;
  expect(nativeFootwayRoutes(changed,snapshot)[0]!.baseline.status).toBe('native-source-changed');
  expect(nativeFootwayRoutes(snapshot)[0]!.baseline.status).toBe('not-compared');
  const short={nativePlanning:{walks:[{id:'short',kind:'path',halfWidth:1,points:[[1,2,3],[1.1,2,3]]}]}};
  const routes=nativeFootwayRoutes(short);expect(routes).toHaveLength(1);expect(routes[0]!.validAttempt).toBe(false);expect(routes[0]!.points).toEqual(short.nativePlanning.walks[0]!.points);
 });
});
