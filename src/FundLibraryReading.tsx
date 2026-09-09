import type { Ref } from 'react';
import { formatCad, formatDateLabel, type Household } from './core/index.ts';
import { fundMinuteBook, fundRecordReading, recentFundMovement } from './core/fundLibraryReadings.ts';
import type { FundDestination } from './FundStage.tsx';

export function FundLibraryReading({id,household,today,headingRef,onOpen}: {id:'seven-days'|'record'|'minutes';household:Household;today:string;headingRef?:Ref<HTMLHeadingElement>;onOpen:(destination:FundDestination)=>void}) {
  const record=fundRecordReading(household,today);
  const recent=recentFundMovement(household,today);
  const minutes=fundMinuteBook(household);
  return <section className="fund-plate-stage fund-library-reading" data-fund-stage={id}>
    <h2 ref={headingRef} tabIndex={-1} className="fund-stage-heading">{id==='seven-days'?'Last seven days':id==='record'?'The record':'The minute book'}</h2>
    {id==='seven-days' ? <>
      <p>Accepted Fund cash movement · {formatDateLabel(recent.start)}–{formatDateLabel(recent.end)}</p>
      <p className="muted">Cash settlement timing can differ from expense dates. Proposals and estimates are excluded.</p>
      <dl><div className="row"><dt>Opening Fund balance</dt><dd>{formatCad(recent.openingCents)}</dd></div>
        {recent.days.map(d=><div className="row" key={d.date}><dt>{formatDateLabel(d.date)}</dt><dd>{formatCad(d.cents)}</dd></div>)}
        <div className="row"><dt>Closing Fund balance</dt><dd>{formatCad(recent.closingCents)}</dd></div></dl>
    </> : id==='record' ? <>
      <p>{record.latest?`Latest accepted Fund activity: ${formatDateLabel(record.latest.date)} · ${record.latest.kind.replaceAll('-',' ')}`:'No accepted Fund activity yet.'}</p>
      <p>Reconciliation: <strong>{record.reconciliation}</strong></p>
      <p className="muted">{record.coveredDate?`Covers ${formatDateLabel(record.coveredDate)}.`:'No reconciliation date has been recorded.'} A recent sync is not a reconciliation.</p>
    </> : <>
      <p className="muted">Weekly acknowledgements, sit-downs and agreement records. An acknowledgement is not a signature or spending approval.</p>
      {minutes.length ? <ul>{minutes.slice(0,12).map(row=><li key={row.id}>{row.label} · {household.members.find(m=>m.id===row.memberId)?.name??'A member'}</li>)}</ul>:<p>No review records yet. Open the household review when you are ready.</p>}
    </>}
    <button type="button" className="desk-plate-handle" onClick={()=>onOpen(id)}>Open {id==='minutes'?'More':id==='record'?'the Fund register':'activity'}</button>
  </section>;
}
