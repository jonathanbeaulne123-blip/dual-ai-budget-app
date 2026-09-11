import type { ActionContext, ActionDefinition, ActionField, ActionValues } from './herculesActions.ts';
import { addAccount } from './commands.ts';
import { ACCOUNT_KIND_LABEL, ACCOUNT_KINDS, INVESTMENT_VEHICLES } from './accountKinds.ts';

const detail = (key:string,label:string,question:string,kind:ActionField['kind']='text'):ActionField => ({key,label,question:`${question} You can say skip.`,kind,optional:true,...(key==='institution'?{maxLength:32}:{})});
export function accountGuideFields(_c:ActionContext,v:ActionValues):ActionField[] {
 if (!v.kind || !v.name) return [];
 const choice:ActionField={key:'details',label:'Account details',question:'Would you like to add the account details now, or skip them for now?',optional:true,choices:()=>[{value:'yes',label:'Yes, add details'},{value:'skip',label:'Skip for now'}]};
 if(v.details!=='yes')return [choice];
 return [choice,detail('institution','Institution','Which bank or institution is it with?'),detail('last4','Last four digits','What are the last four digits? Never enter the full account or card number.'),
 ...(v.kind==='credit' ? [detail('creditLimit','Credit limit (CAD)','What is the credit limit?','money'),detail('aprPercent','Annual interest rate (%)','What is the purchase interest rate?','number'),detail('cashbackPercent','Cashback rate (%)','What is the base cashback rate? For a points card, enter 0; points are not cashback.','number'),detail('groceryCashbackPercent','Grocery cashback rate (%)','Does it have a different grocery cashback rate?','number'),detail('statementDay','Statement day (1–28)','Which day does the statement close?','number'),detail('dueDaysAfterStatement','Days until payment is due (1–30)','How many days after the statement is payment due?','number')] : []),
 ...(v.kind==='savings' ? [detail('apyPercent','Annual savings rate (%)','What is the savings interest rate?','number'),{...detail('purpose','Savings purpose','Is this everyday savings or the Goals savings vault?'),choices:()=>[{value:'general',label:'Everyday savings'},{value:'goals',label:'Goals savings vault'}]}] : []),
 ...(v.kind==='investment' ? [{...detail('vehicle','Investment account','What kind of investment account is it?'),choices:()=>INVESTMENT_VEHICLES.map(x=>({value:x.id,label:x.label}))}] : [])];
}
export function inferAccountKind(message:string):string|undefined {
 const kinds=[[/\b(?:credit(?: card)?|visa|master\s?card|amex|american express)\b/i,'credit'],[/\b(?:chequing|checking|debit)\b/i,'chequing'],[/\b(?:savings|hisa)\b/i,'savings'],[/\b(?:investment|brokerage|tfsa|rrsp|fhsa)\b/i,'investment'],[/\b(?:receivable|owed to (?:me|us))\b/i,'receivable']] as const;
 const matched=kinds.filter(([pattern])=>pattern.test(message));
 return matched.length===1?matched[0]![1]:undefined;
}
export const accountGuideAction:ActionDefinition={id:'add-account',title:'Add an account',example:'Add an account',
 match:/\b(?:add|create|open|set up) (?:an? |my |new )*(?:(?:credit|debit|visa|master\s?card|amex|american express|savings|hisa|chequing|checking|investment|brokerage|tfsa|rrsp|fhsa|receivable)\b(?:[^.!?;]{0,50}?\b)?(?:account|card)\b|account\b|(?:visa|master\s?card|amex|american express)\b)/i,
 views:['household','personal'],fields:[{key:'name',maxLength:40,label:'Name',question:'What would you like to name it?'},{key:'kind',label:'Account type',question:'What kind of account is it?',choices:()=>ACCOUNT_KINDS.map(value=>({value,label:ACCOUNT_KIND_LABEL[value]}))}],dynamicFields:accountGuideFields,
 consequence:'Create this account with the settings shown. Skipped card terms use Hearth defaults, not verified bank terms; check them before relying on estimates. Opening balances, interest and rewards require separate reviewed entries.',dependencies:c=>c.household.accounts,
 execute:(c,v)=>addAccount(c.household,{name:v.name!,kind:v.kind!,scope:c.view==='personal'?'personal':'shared',ownerMemberId:c.view==='personal'?c.memberId:'joint',...(v.details==='yes'?{
 institution:v.institution,last4:v.last4,creditLimit:v.creditLimit,aprPercent:v.aprPercent,cashbackPercent:v.cashbackPercent,groceryCashbackPercent:v.groceryCashbackPercent,
 statementDay:v.statementDay?Number(v.statementDay):undefined,dueDaysAfterStatement:v.dueDaysAfterStatement?Number(v.dueDaysAfterStatement):undefined,apyPercent:v.apyPercent,
 purpose:v.purpose as 'general'|'goals'|undefined,vehicle:v.vehicle as Parameters<typeof addAccount>[1]['vehicle'],}: {})})};
