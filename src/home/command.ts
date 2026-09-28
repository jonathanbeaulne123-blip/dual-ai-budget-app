import type {KitchenCommand} from '../kitchenCommand.ts';
import {commitPersonalLife,type PersonalLifeOperation} from '../hearthside/personalLifeCommands.ts';
export async function commitHome(run:KitchenCommand,memberId:string,operation:Extract<PersonalLifeOperation,{kind:'home.save'}>){
 const id=crypto.randomUUID();let failure:unknown;
 const outcome=await run(h=>{try{return commitPersonalLife(h,{version:1,id,scope:{environment:h.environment,householdId:h.householdId,memberId},operation});}catch(e){failure=e;throw e;}},{confirmationId:id});
 if(failure)throw failure;if(!outcome?.ok)throw Error(outcome?.userMessage??'Home not saved. Your draft is kept.');
}
