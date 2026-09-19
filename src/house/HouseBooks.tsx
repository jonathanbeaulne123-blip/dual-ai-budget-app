import { useMemo, useState, type ReactNode } from "react";
import type { Household, LedgerView } from "../core/types.ts";
import { monthKeyFromDateKey, todayKey } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { projectKittyNest } from "../core/kittyNest.ts";
import { projectHouseholdFund } from "../core/householdFund.ts";
import { contributionRegister } from "../core/contributionRegister.ts";
import { booksPresentationFloor, householdWallet } from "../core/index.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import "./houseBooks.css";

export const BOOK_DIVISIONS=["Today","Accounts","Spending","Bills","Goals","Contributions","Record"] as const;
export type BookDivision=typeof BOOK_DIVISIONS[number];
export function HouseBooks({household,memberId,view,children,onOpenBank}:{household:Household;memberId:string;view:LedgerView;children:(division:BookDivision)=>ReactNode;onOpenBank?:(id:string)=>void}){
  const appearance=useAppearance(),identity=`${household.environment}:${household.householdId}:${memberId}:${view}`;
  const [division,setDivision]=useState<BookDivision>(()=>{try{const saved=localStorage.getItem(`hearth:book:${identity}`);return BOOK_DIVISIONS.includes(saved as BookDivision)?saved as BookDivision:"Today";}catch{return "Today";}}),[flat,setFlat]=useState(false);
  const today=todayKey(),nest=useMemo(()=>projectKittyNest(household,memberId,view,today),[household,memberId,view,today]);
  const fund=useMemo(()=>view==="household"?projectHouseholdFund(household,today):null,[household,view,today]);
  const register=useMemo(()=>view==="household"?contributionRegister(household,monthKeyFromDateKey(today),today):null,[household,view,today]);
  const sharedOperatingCents=useMemo(()=>view==="household"?householdWallet(booksPresentationFloor(household,memberId,view),today).tiles.filter(tile=>tile.kind==="chequing"||tile.kind==="other").reduce((sum,tile)=>sum+tile.balanceCents,0):0,[household,memberId,view,today]);
  const banks=nest.categories.flatMap(category=>category.children).filter(bank=>bank.state==="open"),next=banks.filter(bank=>bank.date).sort((a,b)=>a.date!.localeCompare(b.date!))[0];
  function turn(next:BookDivision){setDivision(next);try{localStorage.setItem(`hearth:book:${identity}`,next);}catch{/* The book stays readable. */}}
  return <section className="house-book" data-book-theme={appearance.scene.theme} data-book-division={division}>
    <header className="house-book__cover"><div><p className="kicker">{view==="personal"?"My books":"Our household ledger"}</p><h2>The Standing Book</h2><p>Open on {today}. {view==="personal"?"Your books include shared household entries and your own Personal entries. Your partner’s private entries stay private.":"Figures stay in the books; the room gives them a place."}</p></div><span className="house-book__clasp" aria-hidden="true">H</span></header>
    <nav className="house-book__ribbons" aria-label="Book divisions">{BOOK_DIVISIONS.map((name,index)=><button key={name} aria-current={division===name?"page":undefined} onClick={()=>turn(name)}><small aria-hidden="true">{String(index+1).padStart(2,"0")}</small>{name}</button>)}</nav>
    <div className="house-book__spread"><header className="house-book__page-title"><h3>{division}</h3><button aria-pressed={flat} onClick={()=>setFlat(!flat)}>{flat?"Return to the illustrated page":"Read exact figures"}</button></header>
      {division==="Today"&&<section className={`book-waterline ${flat?"is-flat":""}`} aria-label="Dated waterline"><div className="book-waterline__vessel" aria-hidden="true"><span className="book-waterline__water"/><i/><i/><i/><em>{today}</em></div><dl><div><dt>{fund?.configured?"Confirmed Fund operating balance":view==="household"?"Accepted shared operating cash · Fund not set up":nest.sourceLabel}</dt><dd>{formatCad(fund?.configured?fund.operatingBalanceCents:view==="household"?sharedOperatingCents:nest.totalCents)}</dd></div>{fund?.configured&&<><div><dt>Reserved for upcoming obligations</dt><dd>{formatCad(fund.upcomingReserveCents)}</dd></div><div><dt>Free to spend under the existing projection</dt><dd>{formatCad(fund.freeToSpendCents)}</dd></div><div><dt>Last reconciliation</dt><dd>{fund.lastReconciledAt??"Not yet reconciled"}</dd></div></>}<div><dt>Next dated commitment</dt><dd>{next?`${next.name} · ${next.date} · ${formatCad(next.targetCents)}`:"No dated commitment in this nest"}</dd></div></dl><p className="book-waterline__caption">The dated figures are exact. The illustrated vessel is an ornament, not a second balance or a health score.</p></section>}
      {division==="Goals"&&<section className={`book-glasshouse ${flat?"is-flat":""}`} aria-label="Goals Glasshouse"><div className="book-glasshouse__roof" aria-hidden="true"/><div className="book-glasshouse__shelf">{banks.filter(bank=>bank.tier==="goal").map(bank=><article key={bank.id}><span className="book-glasshouse__pot" aria-hidden="true"><i/><b/></span><h4>{bank.name}</h4><p>{bank.amountCents===null?"Backing unavailable":formatCad(bank.amountCents)} <small>of {formatCad(bank.targetCents)}</small></p>{bank.date&&<time>{bank.date}</time>}<small>Your original ceramic bank</small>{onOpenBank&&<button className="book-glasshouse__open" onClick={()=>onOpenBank(bank.id)}>Open {bank.name}</button>}</article>)}</div>{!banks.some(bank=>bank.tier==="goal")&&<p>The glasshouse has room for your next goal. Open a bank below when you are ready.</p>}</section>}
      {division==="Contributions"&&register&&<section className="book-contributions"><h4>Confirmed sources · {register.monthKey}</h4><table><thead><tr><th>Date</th><th>Source</th><th>Amount</th></tr></thead><tbody>{register.sources.map((source,i)=><tr key={source.eventId??`carried-${i}`}><td>{source.date}</td><td>{source.kind==="carried"?"Carried into this month":household.members.find(member=>member.id===source.memberId)?.name??"Confirmed contribution"}{source.purpose?` · ${source.purpose}`:""}</td><td>{formatCad(source.amountCents)}</td></tr>)}</tbody></table><p>These are the original confirmed sources used by the contribution register. A purpose label does not partition the money.</p></section>}
      <div className="house-book__working-page">{children(division)}</div>
    </div>
  </section>;
}
