import {hearthsideFocusId,parseHearthsideRoute} from './routes.ts';
import {identifier} from './contracts.ts';
import {parseHouseRoute} from './houseRoutes.ts';
import type {LedgerView} from '../core/types.ts';
export type HearthsideToolReturn={scope:string;audience:LedgerView;path:string;focusId:string;label:string;tab:'planner'|'calendar'|'plan'|'hercules';taskId?:string;eventId?:string};
export function readHearthsideToolReturn(value:unknown,scope:string,householdId:string,audience:LedgerView='household'):HearthsideToolReturn|null {
  try{
    if(!value||typeof value!=='object')return null;const v=value as HearthsideToolReturn;
    const route = typeof v.path === 'string' && v.path.startsWith('/house/') ? parseHouseRoute(v.path, householdId) : null;
    const canonicalTogether = route?.room === 'together' && new URL(v.path, 'https://hearth.invalid').origin === 'https://hearth.invalid' && new URL(v.path, 'https://hearth.invalid').searchParams.get('household') === householdId;
    if(v.scope!==scope||typeof v.path!=='string'||v.path.length>3000||!(canonicalTogether||v.path.startsWith('/hearthside/')&&parseHearthsideRoute(v.path,householdId))||!['planner','calendar','plan','hercules'].includes(v.tab)||typeof v.label!=='string'||v.label.length>240)return null;
    // Older Hearthside records are Household-only. The path and record must
    // agree before a private task ID or return label can reach a working tool.
    const addressedAudience = route?.scope ?? 'household';
    if(addressedAudience!==audience||(v.audience!==undefined&&v.audience!==addressedAudience))return null;
    return {scope,audience:addressedAudience,path:v.path,focusId:hearthsideFocusId(v.focusId),label:v.label,tab:v.tab,...(v.taskId?{taskId:identifier(v.taskId)}:{}),...(v.eventId?{eventId:identifier(v.eventId)}:{})};
  }catch{return null;}
}
