import type {HarbourReading} from '../data/reading.ts';

export type MountainRecoveryScope = {environment:string;householdId:string};
export type MountainWear = 0 | .35 | 1;
export type MountainRecoveryView = {
  wear:MountainWear; repaired:boolean; repairs:number; careDays:number|null;
  frozen:boolean; words:string;
};
type Reading = Pick<HarbourReading,'condition'|'freshness'|'basin'|'mountainCareDays'>;
type Observation = {
  version:1; identity:string; revision:number; asOf:string; wear:MountainWear;
  repairs:number; careDays:number|null;
};
export type RecoveryStorage = Pick<Storage,'getItem'|'setItem'>;
export const mountainRecoveryKey = (scope:MountainRecoveryScope) =>
  `hearth:mountain:observations:v1:${encodeURIComponent(scope.environment)}:${encodeURIComponent(scope.householdId)}`;
const dateKey = (value:unknown):value is string => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const wearValue = (value:unknown):value is MountainWear => value===0 || value===.35 || value===1;
const careValue = (value:unknown):value is number|null => value===null || (Number.isSafeInteger(value) && Number(value)>=0);

/** Observations, not reconstructed history. There is no timer, ledger write or new condition rule. */
export function createMountainRecovery(scope:MountainRecoveryScope,storage:RecoveryStorage|null=null) {
  const key=mountainRecoveryKey(scope),prefix=`${scope.environment}:${scope.householdId}:`;
  let saved:Observation|null=null;
  try {
    const value:unknown=JSON.parse(storage?.getItem(key)??'null');
    if(value && typeof value==='object') {
      const v=value as Partial<Observation>;
      if(v.version===1 && typeof v.identity==='string' && v.identity.startsWith(prefix) &&
        Number.isSafeInteger(v.revision) && Number(v.revision)>=0 && dateKey(v.asOf) && wearValue(v.wear) &&
        Number.isSafeInteger(v.repairs) && Number(v.repairs)>=0 && Number(v.repairs)<=4 && careValue(v.careDays)) saved=v as Observation;
    }
  } catch { /* Restricted storage and corrupt presentation data cannot prevent entry. */ }
  function view(frozen:boolean):MountainRecoveryView {
    const repairs=saved?.repairs??0;
    return {wear:saved?.wear??0,repaired:repairs>0,repairs,careDays:saved?.careDays??null,frozen,
      words:frozen
        ? saved?'The last supported landscape is held while the shared picture is checked.':'Waiting for a supported shared picture. No repair history has been assumed.'
        : repairs>0?'Mended edges remember recovery observed on this device.':'This device has not observed a completed repair yet.'};
  }
  return {
    snapshot:()=>view(true),
    observe(reading:Reading|null|undefined):MountainRecoveryView {
      const b=reading?.basin,c=reading?.condition;
      if(!reading || reading.freshness!=='current' || !b?.known || b.motion===false || !b.identity.startsWith(prefix) ||
        !Number.isSafeInteger(b.revision) || b.revision<0 || !dateKey(b.asOf) || !c || c.state==='checking') return view(true);
      // These are the existing selector's bands. Cents, activity and visitor motion are never inputs here.
      if(!['settled','growing','wilting','weathered'].includes(c.state))return view(true);
      const wear:MountainWear=c.state==='weathered'?1:c.state==='wilting'?.35:0;
      const previous=saved?.identity===b.identity?saved:null;
      // Old delivery, a backwards clock, and conflicting evidence at the same cursor cannot write history.
      if(previous && (b.revision<previous.revision || b.asOf<previous.asOf ||
        (b.revision===previous.revision && b.asOf===previous.asOf && wear!==previous.wear))) return view(true);
      const careDays=careValue(reading.mountainCareDays)?reading.mountainCareDays:previous?.careDays??null;
      const next:Observation={version:1,identity:b.identity,revision:b.revision,asOf:b.asOf,wear,
        repairs:Math.min(4,(previous?.repairs??0)+(previous && previous.wear>0 && wear===0?1:0)),careDays};
      if(JSON.stringify(next)!==JSON.stringify(saved)) {
        saved=next;
        try {storage?.setItem(key,JSON.stringify(saved));} catch { /* Keep the current session's truthful observations. */ }
      }
      return view(false);
    },
  };
}
