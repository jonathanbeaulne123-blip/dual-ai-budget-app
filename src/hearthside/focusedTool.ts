import {hearthsideFocusId,parseHearthsideRoute} from './routes.ts';
import {identifier} from './contracts.ts';
import {parseHouseRoute} from './houseRoutes.ts';
export type HearthsideToolReturn={scope:string;path:string;focusId:string;label:string;tab:'planner'|'calendar'|'plan'|'hercules';taskId?:string;eventId?:string};
export function readHearthsideToolReturn(value:unknown,scope:string,householdId:string):HearthsideToolReturn|null {
  try{
    if(!value||typeof value!=='object')return null;const v=value as HearthsideToolReturn;
    const canonicalTogether = typeof v.path === 'string' && v.path.startsWith('/house/') && new URL(v.path, 'https://hearth.invalid').origin === 'https://hearth.invalid' && parseHouseRoute(v.path, householdId)?.room === 'together' && new URL(v.path, 'https://hearth.invalid').searchParams.get('household') === householdId;
    if(v.scope!==scope||typeof v.path!=='string'||v.path.length>3000||!(canonicalTogether||v.path.startsWith('/hearthside/')&&parseHearthsideRoute(v.path,householdId))||!['planner','calendar','plan','hercules'].includes(v.tab)||typeof v.label!=='string'||v.label.length>240)return null;
    return {scope,path:v.path,focusId:hearthsideFocusId(v.focusId),label:v.label,tab:v.tab,...(v.taskId?{taskId:identifier(v.taskId)}:{}),...(v.eventId?{eventId:identifier(v.eventId)}:{})};
  }catch{return null;}
}
