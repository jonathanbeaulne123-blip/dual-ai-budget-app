/** Input-driver planning only. The controller's physics and profile remain authoritative.
 * Backward v² pass makes the speed limit at every corner reachable under ordinary braking. */
export function routeSpeedPlan(length, limitAt, {step=.5,deceleration=1}={}) {
  if (!(length>0 && step>0 && deceleration>0)) throw new Error('Invalid route speed plan');
  const samples=Array.from({length:Math.ceil(length/step)+1},(_,i)=>({d:Math.min(length,i*step),speed:limitAt(Math.min(length,i*step))}));
  if(samples.some(p=>!Number.isFinite(p.speed)||p.speed<=0))throw new Error('Invalid route speed limit');
  for(let i=samples.length-2;i>=0;i--){const next=samples[i+1],p=samples[i];p.speed=Math.min(p.speed,Math.sqrt(next.speed**2+2*deceleration*(next.d-p.d)));}
  // The lower neighbouring bound is conservative between samples; no position/velocity writes.
  const at=d=>{const i=Math.max(0,Math.min(samples.length-1,Math.floor(d/step)));return Math.min(samples[i].speed,samples[Math.min(samples.length-1,i+1)].speed);};
  return {at,samples,step,deceleration};
}
