// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {createDetailStream,fadeIn,setStreamQuiet} from '../src/harbour/mountain/streaming.ts';
import {CardBuilder} from '../src/harbour/art/cardScene.ts';
import {decodeWorldPresence} from '../src/ledgerSync/worldPresenceWire.ts';
import {stationPlatforms,walkGraph} from '../src/harbour/body/geography.ts';
import {validHouseBody} from '../src/house/navigation.ts';
afterEach(()=>{delete document.documentElement.dataset.motion;setStreamQuiet(false);vi.restoreAllMocks();});
it('app reduced motion shows streamed material immediately even when OS motion is normal',()=>{
 document.documentElement.dataset.motion='reduced';vi.stubGlobal('matchMedia',()=>({matches:false}));
 const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({opacity:.75}),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);group.add(mesh);
 fadeIn(group);expect(material.opacity).toBe(.75);expect(material.transparent).toBe(false);mesh.geometry.dispose();material.dispose();
});
it('builds one district per update and retains it through a quick tool round-trip',()=>{
 const dispose=vi.fn(),build=vi.fn(()=>({dispose}));
 const stream=createDetailStream([{id:'a',at:[0,0],radius:75},{id:'b',at:[200,0],radius:75},{id:'c',at:[400,0],radius:75}],build);
 stream.update(0,0,true,0);expect(build).toHaveBeenCalledTimes(1);
 stream.update(0,0,true,16);expect(build).toHaveBeenCalledTimes(2);
 stream.update(0,0,true,32);expect(build).toHaveBeenCalledTimes(3);
 stream.update(0,0,false,100);stream.update(0,0,false,3999);expect(dispose).not.toHaveBeenCalled();
 stream.update(0,0,true,4000);expect(build).toHaveBeenCalledTimes(3);
 stream.update(0,0,false,5000);stream.update(0,0,false,9001);expect(dispose).toHaveBeenCalledTimes(2);stream.dispose();
});
it('renders the authored decal and wax buckets',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 const b=new CardBuilder('test','lite',{ink:'#222222'}),cell=b.at(0,0),a=[0,0,0] as const,c=[1,0,0] as const,d=[0,1,0] as const;
 cell.kit.tri(cell.data.decals,a,c,d,[1,0,0]);cell.kit.tri(cell.data.wax,a,c,d,[1,1,0]);
 const built=b.finish();expect(built.group.children.filter(m=>m.name.endsWith('decals'))).toHaveLength(2);built.dispose();
});
it('admits both mountain wire generations without erasing their identity; rejects unknown worlds',()=>{
 for(const world of ['hearth-mountain-1','hearth-mountain-2']){
 expect(decodeWorldPresence({type:'world-step',version:1,world,x:55,y:88,z:-220,yaw:0,moving:true})).toMatchObject({world,x:55,y:88,z:-220});
 expect(validHouseBody({place:'court',world,x:55,y:88,z:-220,yaw:0})).toBe(true);
 }
 expect(()=>decodeWorldPresence({type:'world-step',version:1,world:'unknown',x:0,z:0,yaw:0,moving:false})).toThrow();
});
it('reuses station and graph data after first construction',()=>{expect(stationPlatforms()).toBe(stationPlatforms());expect(walkGraph()).toBe(walkGraph());});
