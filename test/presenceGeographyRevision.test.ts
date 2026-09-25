import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {CURRENT_WORLD_GEOGRAPHY,isMountainWorld} from '../src/worldGeography.ts';
import {decodeWorldPresence} from '../src/ledgerSync/worldPresenceWire.ts';
import {localBodyFromPose} from '../src/ledgerSync/worldPresenceMount.tsx';
import {WalkTogether} from '../src/harbour/presence/WalkTogether.tsx';
import {restoredBodyAt} from '../src/harbour/body/geography.ts';
import {MOUNTAIN_PATH_GRAPH} from '../src/harbour/mountain/definition.ts';

it('sends the actual geography revision and keeps old wire generations recognizable',()=>{
  expect(CURRENT_WORLD_GEOGRAPHY).toBe('hearth-mountain-geo-2');
  const outgoing=localBodyFromPose({target:[0,0,0],theta:0,body:{world:'hearth-mountain-2',x:75,z:-180,y:38,yaw:0}});
  expect(outgoing.world).toBe(CURRENT_WORLD_GEOGRAPHY);
  expect(localBodyFromPose({target:[0,0,0],theta:0,body:{world:CURRENT_WORLD_GEOGRAPHY,x:75,z:-180,y:38,yaw:0}}).world).toBe(CURRENT_WORLD_GEOGRAPHY);
  expect(localBodyFromPose({target:[2,0,3],theta:0}).world).toBe(CURRENT_WORLD_GEOGRAPHY);
  for(const world of [CURRENT_WORLD_GEOGRAPHY,'hearth-mountain-1','hearth-mountain-2']){
    expect(isMountainWorld(world)).toBe(true);
    expect(decodeWorldPresence({type:'world-step',version:1,world,x:75,z:-180,y:38,yaw:0,moving:true})).toMatchObject({world,x:75,z:-180,y:38});
  }
});

it('labels a version-mismatched peer unavailable instead of displaying a live position',()=>{
  const html=renderToStaticMarkup(createElement(WalkTogether,{
    environment:'development',share:'live',onShare:()=>{},walk:{pose:()=>null},walkName:'Partner',
    worldUnavailable:true,soft:null,here:'court',placeName:'the square',softPresenceOptedOut:false,hasPartner:true,
  }));
  expect(html).toContain('data-world-unavailable');
  expect(html).toContain('live position is unavailable');
  expect(html).not.toContain('data-walk-together-line');
});

it('migrates an old saved body to its nearest path node when the old height is unsafe',()=>{
  const old={x:120,z:-200,y:140,yaw:0.7,geo:'hearth-mountain-geo-1'};
  const expected=MOUNTAIN_PATH_GRAPH.nodes.reduce((best,node)=>{
    const distance=Math.hypot(node.at[0]-old.x,node.at[2]-old.z,node.at[1]-old.y);
    return distance<best.distance?{node,distance}:best;
  },{node:MOUNTAIN_PATH_GRAPH.nodes[0]!,distance:Infinity}).node;
  const restored=restoredBodyAt(old);
  expect(restored.migrated).toBe(true);
  expect([restored.x,restored.y,restored.z]).toEqual(expected.at);
});
