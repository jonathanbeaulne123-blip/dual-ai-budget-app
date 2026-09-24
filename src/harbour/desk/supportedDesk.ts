import {useLayoutEffect,useMemo,useRef} from 'react';
import type {Household,LedgerView} from '../../core/types.ts';
import type {DateKey} from '../../core/calendar.ts';
import type {InterpretationGate} from '../../house/supportedInterpretation.ts';
import {supportedAtFor} from '../../house/supportedInterpretation.ts';
import type {HarbourReading} from '../data/reading.ts';

export type DeskSource={household:Household;memberId:string;scope:LedgerView;today:DateKey;reading:HarbourReading|null};
export type DeskCapture={identity:string;source:DeskSource;asOf:string};
export const deskIdentity=(source:DeskSource)=>JSON.stringify([source.household.environment,source.household.householdId,source.memberId,source.scope]);
/** One mounted, scope-bound view snapshot. Never persisted or sent to another device. */
export function chooseDeskCapture(identity:string,current:DeskCapture|null,previous:DeskCapture|null):DeskCapture|null{
  return current?.identity===identity?current:previous?.identity===identity?previous:null;
}
export function useSupportedDesk(source:DeskSource,ready:boolean,gate?:InterpretationGate){
  const identity=deskIdentity(source),supported=ready&&(gate?.current??(source.reading?.freshness!=='stale'&&source.reading?.freshness!=='offline'));
  const held=useRef<DeskCapture|null>(null);
  // Clone only on accepted household changes; pages cannot observe later mutation
  // of a caller's object while they are showing held evidence.
  const household=useMemo(()=>supported?structuredClone(source.household):null,[source.household,source.household.revision,supported]);
  const current=useMemo<DeskCapture|null>(()=>household?{identity,source:{...source,household},asOf:supportedAtFor(household,source.today)}:null,
    [identity,household,source.memberId,source.scope,source.today,source.reading]);
  const capture=chooseDeskCapture(identity,current,held.current);
  useLayoutEffect(()=>{held.current=capture;},[capture]);
  return {source:capture?.source??null,held:!supported,status:supported?null:capture?`Supported as of ${capture.asOf}. ${gate?.detail??'Waiting for current books.'}`:`Checking the books. ${gate?.detail??'No supported reading yet.'}`};
}
