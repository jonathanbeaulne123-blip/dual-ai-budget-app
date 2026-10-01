import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {createCorridorArt} from '../src/harbour/horizon/runtime/corridorArt';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition';

// Compile only the exact runtime fog function and its WeakMap. Importing the
// complete runtime would need a DOM/world; a hand-written fog twin could miss
// the same composition bug this regression protects against.
const runtime=readFileSync(new URL('../src/harbour/horizon/runtime/index.ts',import.meta.url),'utf8');
const start=runtime.indexOf('const fogHooks=new WeakMap<THREE.Material,FogHook>();');
if(start<0)throw new Error('Runtime fog source fence changed');
const block=runtime.slice(start).match(/^const fogHooks=[\s\S]*?\nfunction fogHook\([\s\S]*?\n}/)?.[0];
if(!block)throw new Error('Runtime fog function boundary changed');
const {code}=transformSync(block,{loader:'ts',format:'cjs'});
type FogHook={fade:{value:number};cap:{value:number}};
const fogHook=new Function(`${code}; return fogHook;`)() as (material:THREE.Material,cap?:number)=>FogHook;

describe('packed corridor lamps compose once with actual runtime fog',()=>{
  for(const theme of ['classic','taylor','newfoundland'] as const)for(const tier of ['full','lite'] as const)it(`${theme}/${tier} preserves one lamp and one fog stage`,()=>{
    const art=createCorridorArt({corridors:[]} as unknown as WorldDefinition,{theme,tier,ground:()=>0});
    try{
      // Exactly mountCorridor's material iteration order: both the logical lamp
      // material and the packed submission material receive the runtime wrapper.
      const hooks=new Map<THREE.Material,FogHook>();
      for(const material of Object.values(art.materials))hooks.set(material,fogHook(material));
      const material=art.materials.packedLamp!;
      expect(material).toBeDefined();
      const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<THREE.Material['onBeforeCompile']>[0];
      material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
      expect(shader.fragmentShader.match(/uniform float uHorizonFade;/g)??[]).toHaveLength(1);
      expect(shader.fragmentShader.match(/uniform float uHorizonFogCap;/g)??[]).toHaveLength(1);
      expect(shader.fragmentShader.match(/float horizonFogFactor=/g)??[]).toHaveLength(2); // The exact EXP2 / linear preprocessor alternatives.
      expect(shader.vertexShader.match(/attribute float aGlow;/g)??[]).toHaveLength(1);
      expect(shader.vertexShader.match(/attribute mat4 aInstanceMatrix;/g)??[]).toHaveLength(1);
      expect(shader.vertexShader).toContain('mvPosition = aInstanceMatrix * mvPosition;');
      expect(shader.uniforms.uHorizonFade).toBe(hooks.get(material)!.fade);
      expect(shader.uniforms.uHorizonFogCap).toBe(hooks.get(material)!.cap);
      expect(shader.uniforms.uNight).toBeDefined();expect(shader.uniforms.uDayGlass).toBeDefined();
    }finally{art.dispose();}
  });
});
