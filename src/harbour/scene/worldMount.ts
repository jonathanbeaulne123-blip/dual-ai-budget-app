import {HORIZON_AVAILABLE} from '../flag.ts';
/** The Horizon's mount seam (development, or live under D15). Neither the review nor the Desk imports Mountain's scene to load Horizon. */
export async function mountHorizonWorld(host:HTMLElement,options:import('../horizon/runtime/index.ts').HorizonOptions){
  if(!HORIZON_AVAILABLE)throw new Error('The Horizon is not switched on in this build.');
  const {mountHorizon}=await import('../horizon/runtime/index.ts');
  return mountHorizon(host,options);
}
