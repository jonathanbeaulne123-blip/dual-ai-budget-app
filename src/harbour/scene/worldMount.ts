import {HARBOUR_DEV} from '../flag.ts';
/** Lightweight development seam. Neither the review nor the Desk imports Mountain's scene to load Horizon. */
export async function mountHorizonWorld(host:HTMLElement,options:import('../horizon/runtime/index.ts').HorizonOptions){
  if(!HARBOUR_DEV)throw new Error('Horizon is available only in development.');
  const {mountHorizon}=await import('../horizon/runtime/index.ts');
  return mountHorizon(host,options);
}
