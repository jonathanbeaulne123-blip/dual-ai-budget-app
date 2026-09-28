export type AdaptiveTier = 'full' | 'lite';
export type QualityProfile = {pixelRatio:number;shadowSize:number};

/** Asset detail and physics never change. Only raster and shadow resolution do. */
export function qualityProfile(tier:AdaptiveTier,level:number,deviceRatio:number):QualityProfile {
  const base=Math.min(Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1,tier==='full'?1.5:1);
  const step=Math.max(0,Math.min(3,Math.floor(level)));
  return {pixelRatio:Math.max(base*[1,.9,.8,.7][step]!,Math.min(base,.75)),shadowSize:(tier==='full'?2048:1024)/(step>=2?2:1)};
}

/** Observe consecutive rendered frames, never wall time spent sleeping.
 * Two slow windows lower one step. Recovery needs eight healthy windows and
 * at least 15 active seconds since a reduction; no per-frame resize churn.
 */
export function createAdaptiveQuality(tier:AdaptiveTier) {
  let level=0,activeMs=0,warmup=1000,elapsed=0,work=0,count=0,slow=0,badWindows=0,goodWindows=0,recoverAfter=0;
  let latest:{frameMs:number;workMs:number;slowFraction:number}|null=null;
  const changes:{at:number;level:number;reason:'pressure'|'recovery'}[]=[];
  const clearWindow=()=>{elapsed=work=count=slow=0;};
  const interrupt=()=>{clearWindow();badWindows=goodWindows=0;warmup=1000;};
  return {
    profile:(deviceRatio:number)=>qualityProfile(tier,level,deviceRatio),
    interrupt,
    sample(frameMs:number,workMs:number):boolean {
      if(!Number.isFinite(frameMs)||frameMs<=0||!Number.isFinite(workMs)||workMs<0){interrupt();return false;}
      // A one-off long task cannot outweigh an otherwise healthy window.
      const duration=Math.min(frameMs,100);activeMs+=duration;
      if(warmup>0){warmup-=duration;return false;}
      elapsed+=duration;work+=Math.min(workMs,100);count++;if(frameMs>20||workMs>14)slow++;
      if(elapsed<1000||count<12)return false;
      latest={frameMs:elapsed/count,workMs:work/count,slowFraction:slow/count};
      const pressured=latest.frameMs>19.5||latest.slowFraction>=.15;
      const healthy=latest.frameMs<=17.8&&latest.workMs<=12&&latest.slowFraction<=.05;
      badWindows=pressured?badWindows+1:0;goodWindows=healthy?goodWindows+1:0;clearWindow();
      let reason:'pressure'|'recovery'|null=null;
      if(badWindows>=2&&level<3){level++;recoverAfter=activeMs+15_000;reason='pressure';}
      else if(goodWindows>=8&&level>0&&activeMs>=recoverAfter){level--;reason='recovery';}
      if(!reason)return false;
      changes.push({at:activeMs,level,reason});if(changes.length>24)changes.shift();
      badWindows=goodWindows=0;warmup=500;return true;
    },
    stats:()=>({level,atFloor:level===3,latest:latest?{...latest}:null,changes:changes.map(row=>({...row}))}),
  };
}
