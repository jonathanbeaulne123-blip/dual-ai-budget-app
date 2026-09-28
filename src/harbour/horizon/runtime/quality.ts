import type * as THREE from 'three';
import type {QualityProfile} from '../../../house/world/adaptiveQuality.ts';

/** Call only for the foreground lease, before painting, or with configure's raw renderer. */
export function applyHorizonQuality(renderer:THREE.WebGLRenderer,sun:THREE.DirectionalLight,profile:QualityProfile,restore=false) {
  if(renderer.getPixelRatio()!==profile.pixelRatio)renderer.setPixelRatio(profile.pixelRatio);
  const shadow=sun.shadow;
  if(restore||shadow.mapSize.x!==profile.shadowSize){
    // Three allocates a changed size only when the old render target is gone.
    shadow.map?.dispose();shadow.map=null;shadow.mapPass?.dispose();shadow.mapPass=null;
    shadow.mapSize.set(profile.shadowSize,profile.shadowSize);
    renderer.shadowMap.needsUpdate=true;
  }
  shadow.normalBias=1.5*2*shadow.camera.right/profile.shadowSize;
}
