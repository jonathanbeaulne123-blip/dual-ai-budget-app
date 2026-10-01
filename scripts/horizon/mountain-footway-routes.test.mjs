import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contiguousClips} from './mountain-footway-routes.mjs';
test('a route that exits and re-enters keeps two independent clipped pieces',()=>{
 const p=contiguousClips([[0,2,0],[2,4,0],[2,6,2],[0,8,2]],[{minX:0,maxX:1,minZ:-1,maxZ:3}]);
 assert.equal(p.length,2);assert.deepEqual(p[0].points,[[0,2,0],[1,3,0]]);assert.deepEqual(p[1].points,[[1,7,2],[0,8,2]]);
 assert.deepEqual(p.map(q=>[q.sourceFrom,q.sourceTo]),[[0,.5],[2.5,3]]);
});
test('overlapping audit areas do not duplicate or disconnect a source segment',()=>{
 const p=contiguousClips([[0,0,0],[4,8,0]],[{minX:0,maxX:3,minZ:-1,maxZ:1},{minX:2,maxX:4,minZ:-1,maxZ:1}]);
 assert.equal(p.length,1);assert.deepEqual(p[0].points,[[0,0,0],[4,8,0]]);
});
test('closed Year Walk indexing does not join its last clip back to its first',()=>{
 const p=contiguousClips([[0,0,0],[3,0,0],[3,0,3],[0,0,0]],[{minX:-1,maxX:1,minZ:-1,maxZ:1}]);
 assert.equal(p.length,2);assert.equal(p[0].sourceFrom,0);assert.equal(p[1].sourceTo,3);
});
