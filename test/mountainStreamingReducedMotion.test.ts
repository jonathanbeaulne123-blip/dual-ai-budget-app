// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {fadeIn,REDUCED_DETAIL_FADE_MS,setStreamQuiet} from '../src/harbour/mountain/streaming.ts';

afterEach(()=>{delete document.documentElement.dataset.motion;setStreamQuiet(false);vi.restoreAllMocks();vi.unstubAllGlobals();});

it('uses the app setting for a 300 ms fade even when the OS setting is normal',()=>{
  let time=0;
  vi.spyOn(performance,'now').mockImplementation(()=>time);
  vi.stubGlobal('matchMedia',()=>({matches:false}));
  document.documentElement.dataset.motion='reduced';
  setStreamQuiet(true);
  const material=new THREE.MeshBasicMaterial({opacity:.8});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material),group=new THREE.Group();group.add(mesh);
  const fade=fadeIn(group),paint=()=>{(mesh.onBeforeRender as ()=>void)();};
  paint();expect(material.opacity).toBe(0);
  time=REDUCED_DETAIL_FADE_MS/2;paint();expect(material.opacity).toBeCloseTo(.4);
  time=REDUCED_DETAIL_FADE_MS;paint();expect(material.opacity).toBe(.8);
  expect(material.transparent).toBe(false);
  fade.cancel();mesh.geometry.dispose();material.dispose();
});
