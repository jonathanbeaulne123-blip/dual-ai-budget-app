import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {createCorridorArt} from '../src/harbour/horizon/runtime/corridorArt';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition';

describe('packed corridor lamps preserve ordinary lamp shadow state',()=>{
  for(const theme of ['classic','taylor','newfoundland'] as const)for(const tier of ['full','lite'] as const)it(`${theme}/${tier} keeps installed renderer depth defaults and the packed transform`,()=>{
    const art=createCorridorArt({corridors:[]} as unknown as WorldDefinition,{theme,tier,ground:()=>0});
    // WebGLShadowMap uses this constructor for ordinary meshes. Its getDepthMaterial
    // applies the same source-material flags after selecting default OR custom depth.
    const ordinaryDepth=new THREE.MeshDepthMaterial();
    try{
      const depth=art.materials.lampDepth as THREE.MeshDepthMaterial;
      expect(depth).toBeInstanceOf(THREE.MeshDepthMaterial);
      for(const key of ['depthPacking','opacity','transparent','side','depthTest','depthWrite','depthFunc','colorWrite','blending','alphaTest','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','wireframe','wireframeLinewidth'] as const){
        expect(depth[key],`depth ${key}`).toBe(ordinaryDepth[key]);
      }
      const lamp=art.materials.lamp as THREE.MeshStandardMaterial, packed=art.materials.packedLamp as THREE.MeshStandardMaterial;
      for(const key of ['visible','wireframe','side','shadowSide','alphaMap','alphaTest','alphaToCoverage','map','clipShadows','clippingPlanes','clipIntersection','displacementMap','displacementScale','displacementBias','wireframeLinewidth'] as const){
        expect(packed[key],`shadow source ${key}`).toEqual(lamp[key]);
      }
      const shader={vertexShader:THREE.ShaderLib.depth.vertexShader,fragmentShader:THREE.ShaderLib.depth.fragmentShader,uniforms:{}} as Parameters<THREE.Material['onBeforeCompile']>[0];
      depth.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
      expect(shader.vertexShader.match(/attribute mat4 aInstanceMatrix;/g)??[]).toHaveLength(1);
      expect(shader.vertexShader).toContain('mvPosition = aInstanceMatrix * mvPosition;');
      expect(shader.vertexShader).not.toContain('#include <project_vertex>');
      expect(shader.fragmentShader).toBe(THREE.ShaderLib.depth.fragmentShader);
    }finally{ordinaryDepth.dispose();art.dispose();}
  });
});
