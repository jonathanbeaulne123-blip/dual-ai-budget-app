export const HOME_PLOTS=['plot.terraces.1','plot.terraces.2','plot.terraces.3','plot.bight.1','plot.bight.2','plot.bight.3','plot.bight.4'] as const;
export type HomePlotClaim={memberId:string;plotId:string};
export function decodeHomePlots(value:unknown):HomePlotClaim[]{
 if(!Array.isArray(value)||value.length>HOME_PLOTS.length)throw Error('HOME_PLOTS_INVALID');
 const rows=Array.from(value,v=>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!['memberId','plotId'].includes(k)||!('value' in Object.getOwnPropertyDescriptor(v,k)!))||typeof v.memberId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(v.memberId)||!HOME_PLOTS.includes(v.plotId))throw Error('HOME_PLOTS_INVALID');return{memberId:v.memberId as string,plotId:v.plotId as string};});
 if(new Set(rows.map(r=>r.memberId)).size!==rows.length||new Set(rows.map(r=>r.plotId)).size!==rows.length)throw Error('HOME_PLOT_ALREADY_CLAIMED');return rows;
}
/** The authority serializes claims. Existing residents never move when a new member arrives. */
export function claimHomePlot(existing:HomePlotClaim[]|undefined,memberId:string){const claims=decodeHomePlots(existing??[]),prior=claims.find(r=>r.memberId===memberId);if(prior)return{claims,plotId:prior.plotId};const plotId=HOME_PLOTS.find(p=>!claims.some(c=>c.plotId===p));if(!plotId)throw Error('HOME_PLOTS_FULL: All seven surveyed residential plots are assigned. Your draft is kept.');return{claims:[...claims,{memberId,plotId}],plotId};}
