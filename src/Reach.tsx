import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { addDays } from "./core/calendar.ts";
import { formatCad } from "./core/money.ts";
import { householdAsk } from "./core/ask.ts";
import { askBelongsOnDesk } from "./core/askView.ts";
import { ceilingVerdictCopy } from "./core/askRoutes.ts";
import { reviewScenarioSources, type ScenarioSourceReview } from "./core/scenarioSources.ts";
import { reviewForecastRoutes, resolveForecastAvailability, type ForecastRouteReview } from "./core/forecastAvailability.ts";
import { resolveCashAvailability } from "./core/cashAvailability.ts";
import { reviewFundScenario, projectFundScenario, type FundScenarioResult, type FundScenarioReview, type ScenarioSourceAssumptions } from "./core/scenarioProjection.ts";
import type { ContributionElection, FundScenarioRequest } from "./core/fundScenario.ts";
import type { EarningsAvailability } from "./core/earningsAvailability.ts";
import type { Household } from "./core/types.ts";
import type { ScenarioSourceContext } from "./scenarioSourceContext.ts";
import { ReachLevel, SharedReachLevel } from "./ReachLevel.tsx";
import "./reach.css";

type Sources = Extract<ScenarioSourceReview, {kind: "source-review"}>;
type Projection = Extract<FundScenarioResult, {kind: "scenario"}>;
type Available = Extract<EarningsAvailability, {kind: "available"}>;
type Review = {source: ScenarioSourceContext; cash: Sources; forecast: ForecastRouteReview; choices: Extract<FundScenarioReview, {kind: "scenario-review"}>; baseline: Projection};
const emptyAssumptions = (): ScenarioSourceAssumptions => ({cash: [], forecast: []});
const dollars = (text: string): number | null => {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text.trim())) return null;
  const [whole, fraction = ''] = text.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(cents) ? cents : null;
};
const band = (low: number, expected: number) => low === expected ? formatCad(low) : `${formatCad(low)}–${formatCad(expected)}`;
const namedDate = (date: string) => new Intl.DateTimeFormat('en-CA', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'}).format(new Date(date+'T12:00:00Z'));

export function Reach({ household, memberId, today, source, children }: {household: Household; memberId: string; today: string; source?: ScenarioSourceContext | null; children?: ReactNode}) {
  if (!askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId)) return null;
  const scope = source?.accepted.scope;
  const usable = !!source && source.isCurrent() && source.accepted.ownBooks === 'ready'
    && source.household === household && scope?.memberId === memberId && scope.householdId === household.householdId
    && askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId);
  const ask = householdAsk(household, today);
  const sharedDrawing=<SharedReachLevel household={household} today={today} through={addDays(today,30)} />;
  return <div className="reach" data-reach="">
    <p className="reach-kicker">Current Shared Ask</p><p className="reach-figure" data-ask-figure="">{formatCad(ask.askCents)}</p>
    {usable ? <ReachSession key={JSON.stringify([source!.accepted.acceptedStateId, scope, today])} source={source!} today={today} sharedDrawing={sharedDrawing} />
      : <><p className="reach-line">Your accepted Personal books are not available for this scenario yet.</p>{sharedDrawing}<label className="reach-kicker">Shifts you'd pick up<input aria-label="Shifts you'd pick up" type="range" min="0" max="4" value="0" disabled readOnly /></label></>}
    {children}
  </div>;
}

function ReachSession({source, today, sharedDrawing}: {source: ScenarioSourceContext; today: string; sharedDrawing: ReactNode}) {
  const [review, setReview] = useState<Review | null>(null), [error, setError] = useState('');
  const [count, setCount] = useState(0), [routeId, setRouteId] = useState('');
  const [dragCount, setDragCount] = useState<number | null>(null);
  const [receiptKind, setReceiptKind] = useState('cash'), [accountId, setAccountId] = useState(''), [cashText, setCashText] = useState(''), [ack, setAck] = useState(false);
  const [available, setAvailable] = useState<Available | null>(null), [assumptions, setAssumptions] = useState<ScenarioSourceAssumptions>(emptyAssumptions);
  const [elections, setElections] = useState<readonly ContributionElection[]>([]), [result, setResult] = useState<Projection | null>(null);
  const [trancheId, setTrancheId] = useState(''), [amount, setAmount] = useState(''), [kind, setKind] = useState<'fixed'|'available-up-to'>('fixed'), [date, setDate] = useState(''), [replace, setReplace] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const live = useRef(true), current = useRef(source), sequence = useRef(0), choiceId = useRef(0), pointer = useRef<{id:number;start:number;target:HTMLInputElement;changed:boolean;x:number} | null>(null);
  current.current = source;
  const id = useId(), through = addDays(today,30);
  const valid = (captured = source, ticket = sequence.current) => live.current && current.current === captured && captured.isCurrent() && ticket === sequence.current;
  useEffect(() => {
    live.current = true; const ticket = ++sequence.current; setReview(null); setResult(null); setError('');
    setCount(0);setRouteId('');setDragCount(null);pointer.current=null;setAvailable(null);setAssumptions(emptyAssumptions());setElections([]);setAck(false);setPending(false);setTrancheId('');setAmount('');setDate('');setReplace([]);setCashText('');setAccountId('');
    async function load() {
      if (!valid(source,ticket)) return;
      try {
        const cash = await reviewScenarioSources(source.household, source.accepted, today, through);
        if (!valid(source,ticket)) return;
        if (cash.kind === 'unavailable') {setError(cash.reasons[0]!.message);return;}
        const [forecast, choices, baseline] = await Promise.all([
          reviewForecastRoutes(source.household, source.accepted, today, through),
          reviewFundScenario(source.household, source.accepted, today, through),
          projectFundScenario(source.household, source.accepted, {version:1,basis:cash.basis,elections:[]}, emptyAssumptions()),
        ]);
        if (!valid(source,ticket)) return;
        if (choices.kind === 'unavailable' || baseline.kind === 'unavailable') {setError((choices.kind === 'unavailable' ? choices : baseline as Extract<FundScenarioResult,{kind:'unavailable'}>).reasons[0]!.message);return;}
        setReview({source,cash,forecast,choices,baseline}); setResult(baseline);
      } catch {if(valid(source,ticket))setError('The scenario could not be reviewed. Open it again to retry.');}
    }
    void load(); return () => {live.current=false;sequence.current++;};
  }, [source,today,through]);
  // The identity comparison is a render guard, not an effect-delayed privacy cleanup.
  const shown = review?.source === source && source.isCurrent() ? review : null;
  const forecast = shown?.forecast.kind === 'forecast-review' ? shown.forecast : null;
  const previewCount = dragCount ?? count;
  const routes = forecast?.families.find(f => f.count === previewCount)?.routes ?? [];
  const named = routes.find(r=>r.id===routeId) ?? routes[0];
  const selected = forecast?.families.find(f=>f.count===count)?.routes.find(r=>r.id===routeId);
  const previewing = dragCount !== null && dragCount !== count && receiptKind === 'forecast';
  const activeResult = shown && !previewing ? result : null;
  const offered = forecast ? [...forecast.families].reverse().find(f=>f.routes.length)?.routes[0]?.route.shifts ?? [] : [];
  const rowKey = (s: {date:string;meal:string}) => `${s.date}:${s.meal}`;
  const selectedKeys = new Set(named?.route.shifts.map(rowKey)??[]);
  const roster = [...(named?.route.shifts??[]), ...offered.filter(s=>!selectedKeys.has(rowKey(s)))].slice(0,4);
  const chartCapacity = Math.max(shown?.cash.cashCapacityLimitCents??0, ...forecast?.families.flatMap(f=>f.routes.map(r=>r.route.expectedCents))??[]);
  const sourceName = (tranche: Available['tranches'][number]) => {
    if (receiptKind==='cash') return 'Assumed cash';
    const shift=selected?.route.shifts.find(s=>tranche.id===`forecast:${forecast?.jobId}:${forecast?.roleId}:${s.date}:${s.meal}`);
    return shift ? `${namedDate(shift.date)} ${shift.meal} net tips` : 'Named net tips';
  };
  const request = (rows: readonly ContributionElection[]): FundScenarioRequest => ({version:1,basis:shown!.cash.basis,elections:rows});
  function clearReceipt() {
    sequence.current++; setPending(false); setAvailable(null);setAssumptions(emptyAssumptions());setAck(false);setElections([]);setResult(shown?.baseline??null);setError('');setTrancheId('');setAmount('');setDate('');setReplace([]);
  }
  function selectCount(next:number) {
    if (!valid() || next===count)return;
    const nextRoute = forecast?.families.find(f=>f.count===next)?.routes[0];
    setCount(next);setRouteId(nextRoute?.id??'');
    if(receiptKind==='forecast')clearReceipt();
  }
  function selectRoute(next:string) {if(!valid() || next===routeId)return;setRouteId(next);if(receiptKind==='forecast')clearReceipt();}
  async function reviewReceipt() {
    if(!shown || !valid() || !ack)return;
    const ticket=++sequence.current;setPending(true);setError('');setAvailable(null);setElections([]);setResult(shown.baseline);
    try {
      let inputs: ScenarioSourceAssumptions;
      if(receiptKind==='cash') {
        const cash=shown.cash.cashAccounts.find(a=>a.accountId===accountId), cents=dollars(cashText);
        if(!cash || cents===null) {setError('Choose your account and enter exact CAD remaining after commitments.');setPending(false);return;}
        inputs={cash:[{accountId,availableCents:cents,reviewedFactsDigest:cash.factsDigest,chosenByMemberId:source.accepted.scope.memberId,acknowledgesUnattributedCommitments:true}],forecast:[]};
      } else {
        if(!forecast || !selected || selected.count===0){setError('Choose a named route first.');setPending(false);return;}
        inputs={cash:[],forecast:[{routeId:selected.id,reviewedRouteDigest:selected.factsDigest,reviewedPolicyDigest:forecast.policyDigest,chosenByMemberId:source.accepted.scope.memberId,policy:forecast.policy,acknowledgesForecastReceiptAssumption:true}]};
      }
      const resolved=receiptKind==='cash' ? await resolveCashAvailability(source.household,source.accepted,request([]),inputs.cash) : await resolveForecastAvailability(source.household,source.accepted,request([]),inputs.forecast);
      if(!valid(source,ticket))return;
      if(resolved.kind==='unavailable'){setError(resolved.reasons[0]!.message);setPending(false);return;}
      setAvailable(resolved);setAssumptions(inputs);setTrancheId('');setAmount('');setDate('');setReplace([]);setPending(false);
    } catch {if(valid(source,ticket)){setError('The receipt assumption could not be reviewed. Try again.');setPending(false);}}
  }
  async function project(rows: readonly ContributionElection[]) {
    if(!shown || !available || !valid())return;
    const ticket=++sequence.current;setPending(true);setResult(null);setError('');
    try {
      const next=await projectFundScenario(source.household,source.accepted,request(rows),assumptions);
      if(!valid(source,ticket))return;
      setPending(false);
      if(next.kind==='unavailable'){setError(next.reasons[0]!.message);return;}
      setElections(rows);setResult(next);setAmount('');setReplace([]);
    }catch {if(valid(source,ticket)){setPending(false);setError('The contribution scenario could not be reviewed. Try again.');}}
  }
  function addChoice() {
    if(!valid() || !shown || !available)return;
    const cents=dollars(amount), tranche=available.tranches.find(t=>t.id===trancheId);
    if(cents===null || !tranche || !date){setResult(null);setError('Choose a dated source, exact CAD amount and contribution date.');return;}
    const common={id:`reach-${++choiceId.current}`,chosenByMemberId:source.accepted.scope.memberId,contributionOn:date,replaces:shown.choices.replacements.filter(r=>replace.includes(r.id)).map(({id,factsDigest})=>({id,factsDigest}))};
    const choice: ContributionElection=kind==='fixed' ? {...common,kind,chosenCents:cents,allocations:[{trancheId,cents}]} : {...common,kind,maximumCents:cents,allocations:[{trancheId,maximumCents:cents}]};
    void project([...elections,choice]);
  }
  const receiptHint = forecast?.policy==='net-cash-on-shift-day' ? 'I assume these net cash tips arrive on each named shift day.' : 'I assume these net card tips arrive on the next recorded payout day after each shift. The schedule does not prove cutoff or payment.';
  const cancelDrag=()=>{const p=pointer.current;pointer.current=null;setDragCount(null);if(p?.target.hasPointerCapture(p.id))p.target.releasePointerCapture(p.id);};
  return <>
    <p className="reach-line">{previewCount ? 'These shifts would be extra work you choose. A Fund contribution is a separate choice.' : 'Nothing extra picked up. You can try a contribution below.'}</p>
    {shown ? <ReachLevel horizon={shown.cash.horizon} scenario={activeResult} capacityCents={chartCapacity} /> : sharedDrawing}
    <div className="reach-scrub"><label className="reach-kicker" htmlFor={`${id}-rail`}>Shifts you'd pick up</label>
      <input id={`${id}-rail`} type="range" min="0" max="4" step="1" value={previewCount} disabled={!forecast || pending}
        aria-valuetext={`${previewCount} shifts, ${named?.route.hours??0} hours${named ? ', '+band(named.route.safeCents,named.route.expectedCents)+' net tips; '+named.route.shifts.map(s=>namedDate(s.date)+' '+s.meal).join(', ') : ', no supported route'}. ${named ? (named.route.ceiling.kind==='within' ? 'Within '+named.route.ceiling.ceilingLabel+'.' : ceilingVerdictCopy(named.route.ceiling)??'No recorded work ceiling.') : ''} ${activeResult ? 'Model end deficit through '+through+': '+band(activeResult.expected.terminalDeficitCents,activeResult.lower.terminalDeficitCents)+'.' : 'No reviewed contribution scenario.'} Fund contribution chosen separately.`}
        data-dialog-escape-boundary={dragCount!==null || undefined}
        onPointerDown={e=>{if(!valid()||!e.isPrimary||e.button!==0||pointer.current)return;const box=e.currentTarget.getBoundingClientRect(), thumb=box.left+8+(box.width-16)*count/4;pointer.current={id:e.pointerId,start:count,target:e.currentTarget,changed:Math.abs(e.clientX-thumb)>9,x:e.clientX};e.currentTarget.setPointerCapture(e.pointerId);setDragCount(count);}}
        onPointerMove={e=>{if(pointer.current?.id===e.pointerId && Math.abs(e.clientX-pointer.current.x)>2)pointer.current.changed=true;}}
        onChange={e=>{const next=Number(e.target.value);if(pointer.current){if(pointer.current.changed)setDragCount(next);}else selectCount(next);}}
        onPointerUp={e=>{if(pointer.current?.id!==e.pointerId)return;const next=pointer.current.changed?Number(e.currentTarget.value):pointer.current.start;cancelDrag();selectCount(next);}}
        onPointerCancel={e=>{if(pointer.current?.id===e.pointerId)cancelDrag();}} onLostPointerCapture={e=>{if(pointer.current?.id===e.pointerId)cancelDrag();}}
        onKeyDown={e=>{if(e.key==='Escape' && pointer.current){e.preventDefault();e.stopPropagation();cancelDrag();}}}/>
      <div className="reach-ends"><span>NONE</span><span>{named?.route.hours??0} hrs</span><span>FOUR</span></div>
    </div>
    {shown?.forecast.kind==='unavailable' ? <p className="reach-line">{shown.forecast.reasons[0]!.message}</p> : null}
    {forecast && !routes.length ? <p className="reach-line">No supported {previewCount}-shift route in this horizon.</p> : null}
    {routes.length>1 ? <label className="reach-label">Named route<select aria-label="Named route" value={named?.id??''} disabled={pending||dragCount!==null} onChange={e=>selectRoute(e.target.value)}>{routes.map(r=><option key={r.id} value={r.id}>{r.route.shifts.map(s=>namedDate(s.date)).join(' · ')}</option>)}</select></label> : null}
    <div className="reach-list">{roster.map(s=><div className={`reach-row${selectedKeys.has(rowKey(s))?' on':''}`} key={rowKey(s)} aria-label={selectedKeys.has(rowKey(s))?'Selected shift':'Offered shift'}><time dateTime={s.date}>{namedDate(s.date)}</time><span>{s.meal} · {s.hours}h</span><strong>{band(s.safeCents,s.expectedCents)}</strong></div>)}</div>
    {named && named.route.ceiling.kind!=='none' ? <p className={`reach-line${named.route.ceiling.kind==='over'?' is-over':''}`}>{ceilingVerdictCopy(named.route.ceiling)}</p> : null}
    <div className={`reach-paperbox${named?.route.ceiling.kind==='over'?' is-over':''}`}>
      <span className="reach-pill">Projection · lower to expected</span>
      <dl className="reach-readings"><dt>Would earn · net tips</dt><dd>{named ? band(named.route.safeCents,named.route.expectedCents) : '—'}</dd>
        <dt>Model end deficit · through {namedDate(through)}</dt><dd data-reach-deficit="">{activeResult ? band(activeResult.expected.terminalDeficitCents,activeResult.lower.terminalDeficitCents) : '—'}</dd></dl>
      <p className="reach-line" role="status" aria-live="polite" aria-atomic="true">{pending ? 'Reviewing this choice…' : previewing ? 'Previewing other shifts. Review their receipt and contribution separately.' : error ? 'This choice needs review before drawing a scenario.' : activeResult?.contributions.length ? 'Your chosen hypothetical contributions are drawn above. Current Shared Ask is unchanged.' : 'No contribution chosen. The Fund follows its baseline.'}{activeResult ? <span className="sr-only"> Model end deficit through {namedDate(through)}: {band(activeResult.expected.terminalDeficitCents,activeResult.lower.terminalDeficitCents)}.</span> : null}</p>
      {error ? <p className="reach-line is-over" role="status">{error}</p> : !shown ? <p className="reach-line" role="status">Reviewing the accepted books…</p> : null}
      {shown ? <details><summary>Receipt and contribution</summary>
        <fieldset disabled={pending||dragCount!==null} className="reach-fields"><legend>Receipt assumption</legend>
          <label className="reach-label">Source<select aria-label="Receipt source" value={receiptKind} onChange={e=>{setReceiptKind(e.target.value);clearReceipt();}}><option value="cash">Your recorded cash</option><option value="forecast" disabled={!forecast}>Selected shift route</option></select></label>
          {receiptKind==='cash' ? <><label className="reach-label">Your account<select aria-label="Your cash account" value={accountId} onChange={e=>{setAccountId(e.target.value);clearReceipt();}}><option value="">Choose an account</option>{shown.cash.cashAccounts.map(a=><option key={a.accountId} value={a.accountId}>{a.name} · recorded {formatCad(a.recordedCapacityCents)}</option>)}</select></label>
            <label className="reach-label">Amount you assume remains · CAD<input aria-label="Assumed remaining CAD" inputMode="decimal" value={cashText} onChange={e=>{setCashText(e.target.value);clearReceipt();}} /></label>
            <p className="reach-line">Recorded cash is not verified availability. Known deferred tip-outs: {formatCad(shown.cash.outstandingDeferredTipOutCents)}. Total modeled cash cap: {formatCad(shown.cash.cashCapacityLimitCents)}.</p></> : <p className="reach-line">Net tips already include tip-outs; wages are separate.</p>}
          <label className="reach-check"><input type="checkbox" checked={ack} onChange={e=>{clearReceipt();setAck(e.target.checked);}} />{receiptKind==='cash' ? 'I assume this amount remains after earlier contributions, spending, goals and other commitments.' : receiptHint}</label>
          <button type="button" disabled={!ack || (receiptKind==='forecast'&&(!selected||selected.count===0||selected.route.ceiling.kind==='over'))} onClick={()=>void reviewReceipt()}>Review receipt assumption</button>
        </fieldset>
        {available ? <p className="reach-line">Receipt assumption reviewed. Choose a separate contribution below.</p> : null}
        {available ? <fieldset className="reach-fields" disabled={pending||dragCount!==null}><legend>Hypothetical Fund contribution</legend>
          <label className="reach-label">Dated source<select aria-label="Dated contribution source" value={trancheId} onChange={e=>{setTrancheId(e.target.value);setDate(available.tranches.find(t=>t.id===e.target.value)?.availableOn??'');}}><option value="">Choose a source</option>{available.tranches.map(t=><option key={t.id} value={t.id}>{sourceName(t)} · available {namedDate(t.availableOn)} · {band(t.lowerCents,t.expectedCents)}</option>)}</select></label>
          <label className="reach-label">Contribution rule<select aria-label="Contribution rule" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="fixed">Fixed CAD</option><option value="available-up-to">Available up to a CAD cap</option></select></label>
          <label className="reach-label">{kind==='fixed'?'Chosen amount':'Chosen maximum'} · CAD<input aria-label="Chosen contribution CAD" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} /></label>
          <label className="reach-label">Contribution date<input aria-label="Contribution date" type="date" min={today} max={through} value={date} onChange={e=>setDate(e.target.value)} /></label>
          {shown.choices.replacements.length ? <div><p className="reach-line">Replace an existing estimate only if this choice takes its place.</p>{shown.choices.replacements.map(r=><label className="reach-check" key={r.id}><input type="checkbox" checked={replace.includes(r.id)} onChange={e=>setReplace(prev=>e.target.checked?[...prev,r.id]:prev.filter(id=>id!==r.id))} />{r.label} · {namedDate(r.date)} · {formatCad(r.amountCents)}</label>)}</div> : null}
          <button type="button" onClick={addChoice}>Try this contribution</button>
        </fieldset> : null}
        {elections.length ? <ul className="reach-choices">{elections.map((e,i)=><li key={e.id}><span>{e.kind==='fixed'?'Fixed':'Up to'} {formatCad(e.kind==='fixed'?e.chosenCents:e.maximumCents)} · {namedDate(e.contributionOn)}</span><button type="button" disabled={pending||dragCount!==null} aria-label={`Remove contribution ${i+1}`} onClick={()=>void project(elections.filter(row=>row.id!==e.id))}>Remove</button></li>)}</ul> : null}
        {activeResult ? <details><summary>What the model assumes</summary>{[...new Set([...activeResult.assumptions,...available?.assumptions??[]])].map((line,i)=><p className="reach-line" key={i}>{line}</p>)}<p className="reach-line">Baseline end deficit: {formatCad(activeResult.baselineTerminalDeficitCents)}. Lower path ends below buffer on {activeResult.lower.underBufferDates.length} days; expected on {activeResult.expected.underBufferDates.length}.</p></details> : null}
        <button type="button" disabled={pending||dragCount!==null} onClick={()=>{if(!valid())return;setCount(0);setRouteId('');clearReceipt();}}>Reset scenario</button>
      </details> : null}
    </div>
  </>;
}
