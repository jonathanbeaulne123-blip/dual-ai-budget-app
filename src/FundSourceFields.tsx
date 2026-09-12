import { useId, useMemo } from 'react';
import { fundSourceMovement, fundSourceReservedCents, type FundSourceInput } from './core/fundContributionSources.ts';
import type { Household } from './core/types.ts';
import { formatCad } from './core/money.ts';
import { Whisper } from './theme/Whisper.tsx';

export const emptyFundSource = (): FundSourceInput => ({version:1,kind:'already-held',explanation:''});
export function FundSourceFields({household,memberId,date,value,onChange}: {
  household:Household; memberId:string; date:string; value:FundSourceInput; onChange:(value:FundSourceInput)=>void;
}) {
  const id=useId();
  const eligible=useMemo(()=>household.transactions.flatMap(tx=>{
    try { const reading=fundSourceMovement(household,memberId,tx.id,date);
      const remaining=reading.tx.amountCents-fundSourceReservedCents(household,memberId,tx.id);
      return remaining>0 ? [{tx,remaining}] : [];
    } catch {return [];}
  }),[household,memberId,date]);
  return <fieldset className="fund-source-fields">
    <legend>Where does this money come from?</legend>
    <label htmlFor={`${id}-kind`}>Source</label>
    <select id={`${id}-kind`} value={value.kind} onChange={e=>onChange({version:1,kind:e.target.value as FundSourceInput['kind'],explanation:value.explanation})}>
      <option value="already-held">Already held by the custodian</option>
      <option value="external-received">Received from outside tracked books</option>
      <option value="recorded-movement">A movement already in my books</option>
    </select>
    {value.kind==='recorded-movement' && <>
      <label htmlFor={`${id}-movement`}>Recorded incoming movement</label>
      <select id={`${id}-movement`} value={value.sourceTransactionId ?? ''} onChange={e=>onChange({...value,sourceTransactionId:e.target.value})}>
        <option value="">Choose a recorded movement</option>
        {eligible.map(({tx,remaining})=><option key={tx.id} value={tx.id}>{tx.date} · {tx.note || tx.type} · {formatCad(remaining)} available to link</option>)}
      </select>
      <Whisper mode="line">Linking records where the money came from. It does not move money again.</Whisper>
      <Whisper mode="aside" id="fund.source-link">The private account and transaction details stay Personal. Linking does not verify your bank balance.</Whisper>
    </>}
    <label htmlFor={`${id}-explanation`}>Explain the source</label>
    <textarea id={`${id}-explanation`} required maxLength={240} value={value.explanation} onChange={e=>onChange({...value,explanation:e.target.value})} placeholder="For example: money I sent from my separate savings." />
    <Whisper mode="line">Shared with your household — leave out account numbers.</Whisper>
    <Whisper mode="aside" id="fund.source-explanation">The custodian must separately confirm receipt.</Whisper>
  </fieldset>;
}
