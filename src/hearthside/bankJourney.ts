import type {Household} from '../core/types.ts';
import {canonical} from '../ledgerSync/patch.ts';
import {decodeExperience,type SharedExperience} from './contracts.ts';
import type {HearthsideOperation} from './commands.ts';
import {vaultAssert,vaultObject} from './vaultContracts.ts';
import {hearthsideFocusId,parseHearthsideRoute} from './routes.ts';
import {parseHouseRoute} from './houseRoutes.ts';
import type {BankCreationContext,BankCreationStorage} from './bankCreation.ts';
import {bankLinkBasis,validateBankReceipt,type BankScope,type KittyAcceptedCommand} from './bankReceipt.ts';
export type ExperienceBankLink={id:string;operation:Extract<HearthsideOperation,{kind:'experience.save'}>;goalBasis:string;attempted:boolean};
export type ExperienceBankJourney={version:1;scope:BankScope;experience:SharedExperience;context:BankCreationContext;returnPath:string;focusId:string;mode:'choose'|'new'|'existing';bankId:string|null;creationId:string|null;link:ExperienceBankLink|null};
export const bankJourneyKey=(scope:BankScope,id:string)=>`hearth:experience-bank:${JSON.stringify([scope.identity,scope.environment,scope.householdId,scope.memberId,id])}`;
const uuid=(id:unknown)=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
function validExperienceReturnPath(path:string,scope:BankScope,id:string):boolean{
 if(!path.startsWith('/')||path.startsWith('//'))return false;
 const legacy=parseHearthsideRoute(path,scope.householdId);
 if(legacy?.object?.kind==='experience'&&legacy.object.id===id)return true;
 const house=parseHouseRoute(path,scope.householdId);
 return house?.scope==='household'&&house.object===`experience/${id}`;
}
export function newBankJourney(scope:BankScope,experience:SharedExperience,returnPath:string,focusId:string):ExperienceBankJourney{
 const current=decodeExperience(experience);return decodeBankJourney({version:1,scope,experience:current,context:{id:crypto.randomUUID(),experienceId:current.id,experienceRevision:current.revision,name:current.title.slice(0,100),purpose:current.intention.slice(0,1000)},returnPath,focusId,mode:'choose',bankId:null,creationId:null,link:null},scope,current.id);
}
export function decodeBankJourney(raw:unknown,scope:BankScope,id:string):ExperienceBankJourney{
 const r=vaultObject(raw,['version','scope','experience','context','returnPath','focusId','mode','bankId','creationId','link']);
 const experience=decodeExperience(r.experience),c=vaultObject(r.context,['id','experienceId','experienceRevision','name','purpose']);
 vaultAssert(r.version===1&&canonical(r.scope)===canonical(scope)&&experience.id===id&&uuid(c.id)&&c.experienceId===id&&c.experienceRevision===experience.revision&&c.name===experience.title.slice(0,100)&&c.purpose===experience.intention.slice(0,1000)&&typeof r.returnPath==='string'&&r.returnPath.length<=3000&&validExperienceReturnPath(r.returnPath,scope,id)&&typeof r.focusId==='string'&&['choose','new','existing'].includes(String(r.mode))&&(r.bankId===null||typeof r.bankId==='string'&&r.bankId.length<=160)&&(r.creationId===null||uuid(r.creationId)),'BANK_JOURNEY_INVALID');
 let link:ExperienceBankLink|null=null;if(r.link!==null){const l=vaultObject(r.link,['id','operation','goalBasis','attempted']),op=vaultObject(l.operation,['kind','expectedRevision','value']),value=decodeExperience(op.value);vaultAssert(uuid(l.id)&&op.kind==='experience.save'&&value.id===id&&Number.isSafeInteger(op.expectedRevision)&&value.revision===Number(op.expectedRevision)+1&&value.references.some(ref=>ref.kind==='bank'&&ref.id===r.bankId)&&typeof l.goalBasis==='string'&&l.goalBasis.length<=10000&&typeof l.attempted==='boolean','BANK_LINK_REVIEW_INVALID');link={id:l.id as string,operation:{kind:'experience.save',expectedRevision:Number(op.expectedRevision),value},goalBasis:l.goalBasis,attempted:l.attempted};}
 return {version:1,scope,experience,context:c as BankCreationContext,returnPath:r.returnPath,focusId:hearthsideFocusId(r.focusId),mode:r.mode as ExperienceBankJourney['mode'],bankId:r.bankId as string|null,creationId:r.creationId as string|null,link};
}
export function readBankJourney(storage:BankCreationStorage,scope:BankScope,id:string):ExperienceBankJourney|null {const raw=storage.getItem(bankJourneyKey(scope,id));if(raw===null)return null;if(raw.length>128*1024)throw Error('BANK_JOURNEY_INVALID');return decodeBankJourney(JSON.parse(raw),scope,id);}
export function saveBankJourney(storage:BankCreationStorage,j:ExperienceBankJourney){storage.setItem(bankJourneyKey(j.scope,j.experience.id),JSON.stringify(decodeBankJourney(j,j.scope,j.experience.id)));}
export {bankLinkBasis} from './bankReceipt.ts';
export function reviewBankLink(h:Household,j:ExperienceBankJourney):ExperienceBankLink{
 const experience=h.hearthside?.experiences.find(e=>e.id===j.experience.id),goal=h.goals.find(g=>g.id===j.bankId&&g.shared&&!g.envelope?.archivedAt&&g.status!=='retired');
 if(!experience||experience.state==='archived'||!goal)throw Error('BANK_LINK_SOURCE_UNAVAILABLE');
 return{id:crypto.randomUUID(),operation:{kind:'experience.save',expectedRevision:experience.revision,value:{...experience,revision:experience.revision+1,references:[...experience.references.filter(r=>!(r.kind==='bank'&&r.id===goal.id)),{kind:'bank',id:goal.id}]}},goalBasis:bankLinkBasis(goal),attempted:false};
}
export function assertBankLinkReview(h:Household,j:ExperienceBankJourney):void{
 const l=j.link,experience=h.hearthside?.experiences.find(e=>e.id===j.experience.id),goal=h.goals.find(g=>g.id===j.bankId);
 if(!l||!experience||experience.state==='archived'||experience.revision!==l.operation.expectedRevision||canonical(l.operation.value)!==canonical({...experience,revision:experience.revision+1,references:[...experience.references.filter(r=>!(r.kind==='bank'&&r.id===j.bankId)),{kind:'bank',id:j.bankId}]})||!goal||bankLinkBasis(goal)!==l.goalBasis||!goal.shared)throw Error('BANK_LINK_REVIEW_CHANGED');
}
export function acceptedBankLink(value:KittyAcceptedCommand,j:ExperienceBankJourney):boolean {
 if(!j.link)throw Error('BANK_LINK_REVIEW_REQUIRED');validateBankReceipt(value,j.link.id,j.scope,'hearthside');
 return Boolean(value.household.goals.some(g=>g.id===j.bankId&&g.shared)&&value.household.hearthside?.experiences.some(e=>e.id===j.experience.id&&e.revision>=j.link!.operation.value.revision&&e.references.some(r=>r.kind==='bank'&&r.id===j.bankId)));
}
