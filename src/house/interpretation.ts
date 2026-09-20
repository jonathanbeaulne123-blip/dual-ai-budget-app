import type {Household,LedgerView} from "../core/types.ts";
import type {BloomEvidence} from "./world/bloom.ts";
import {decodePersonalLife} from "../hearthside/personalLifeContracts.ts";

/** Interpretation has no command authority. Authored recollections are never inferred from spending. */
export function livingEvidence(household:Household,memberId:string,scope:LedgerView):BloomEvidence[]{
  const experiences=scope==="household"?household.hearthside?.experiences??[]:decodePersonalLife(household.personalLife,memberId).experiences;
  return experiences.filter(row=>row.state!=="archived").flatMap(row=>{
    const base:BloomEvidence={id:row.id,title:row.title,kind:row.state==="lived"&&row.livedOn?"lived":"intention",date:row.livedOn??null,revision:row.revision};
    return row.revision>1?[base,{...base,id:`${row.id}:revision`,kind:"revision" as const}]:[base];
  });
}
