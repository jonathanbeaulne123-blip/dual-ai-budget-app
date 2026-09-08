import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { accountName, categoryName, formatCad, formatDateLabel, transactionTypeLabel, type Household, type Transaction } from "./core/index.ts";
import "./duplicate-prise.css";

type Drag = { id:number; x:number; before:number };
/** Parting reveals differences. The source score and transaction flags never follow the hand. */
export function DuplicatePrise({ household, left, right, confidence, reasons, busy, onReview }: {
  household:Household; left:Transaction; right:Transaction; confidence:number; reasons:readonly string[];
  busy:boolean; onReview:(target:Transaction)=>void;
}) {
  const [parting,setParting]=useState(0),[dragging,setDragging]=useState(false),drag=useRef<Drag|null>(null),handle=useRef<HTMLDivElement>(null),id=useId();
  const signal=Math.max(0,Math.min(100,confidence));
  const finish=(event?:PointerEvent,cancel=false)=>{const current=drag.current;if(!current||(event&&current.id!==event.pointerId))return;drag.current=null;setDragging(false);if(cancel)setParting(current.before);if(handle.current?.hasPointerCapture(current.id))handle.current.releasePointerCapture(current.id);};
  useEffect(()=>{if(busy)finish(undefined,true);},[busy]);
  const fields=(tx:Transaction)=>[
    ["Amount",formatCad(tx.amountCents)],["Date",formatDateLabel(tx.date)],["Entry",tx.note||transactionTypeLabel(tx.type)],
    ["Place",tx.place||"—"],["Category",categoryName(household,tx.subcategoryId)],["Account",accountName(household,tx.accountId)],
    ["Source",tx.source],["ID",tx.id],
  ] as const;
  const a=fields(left),b=fields(right),differences=a.filter((row,i)=>row[1]!==b[i]![1]).map(row=>row[0]);
  const face=(rows:ReturnType<typeof fields>,side:string)=><><span className="prise-kicker prise-card-heading">{side}</span>{rows.map(([label,value],i)=><span key={label} className={`prise-field ${label==="Amount"?"prise-amount":""} ${parting>0&&a[i]![1]!==b[i]![1]?"prise-difference":""}`}><span className="prise-kicker">{label}</span><span>{value}</span></span>)}</>;
  return <article className="duplicate-prise" aria-label="Compare possible repeats">
    <p className="prise-signal">Similarity signal <strong>{signal}/100</strong></p>
    <p className="prise-help" id={`${id}-help`}>Pull the right card apart to compare. This signal is a match heuristic.</p>
    <div className="prise-cards" style={{"--prise-overlap":`${signal*.48*(1-parting/100)}px`} as CSSProperties}>
      <div className="prise-card">{face(a,"Left entry")}</div>
      <div ref={handle} className="prise-card prise-drag-card"
        onPointerDown={event=>{if(drag.current){finish(undefined,true);return;}if(!event.isPrimary||event.button!==0||busy)return;event.preventDefault();event.currentTarget.querySelector<HTMLElement>("[role=slider]")?.focus({preventScroll:true});drag.current={id:event.pointerId,x:event.clientX,before:parting};setDragging(true);event.currentTarget.setPointerCapture(event.pointerId);}}
        onPointerMove={event=>{const active=drag.current;if(!active||active.id!==event.pointerId)return;setParting(Math.max(0,Math.min(100,Math.round(active.before+(event.clientX-active.x)/96*100))));}}
        onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}
>
        <div className="prise-part-handle" role="slider" tabIndex={busy?-1:0} aria-disabled={busy||undefined} aria-label="Part comparison cards" aria-describedby={`${id}-help`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={parting} aria-valuetext={`${parting===0?"Together":parting===100?"Apart":`${parting}% apart`}. Similarity signal stays ${signal} out of 100.`}
        onKeyDown={event=>{if(event.key==="Escape"&&drag.current){event.preventDefault();event.stopPropagation();finish(undefined,true);return;}if(busy||drag.current)return;const delta=event.key==="ArrowRight"?10:event.key==="ArrowLeft"?-10:0;if(delta||event.key==="Home"||event.key==="End"){event.preventDefault();setParting(value=>event.key==="Home"?0:event.key==="End"?100:Math.max(0,Math.min(100,value+delta)));}}}>↔</div>
        {face(b,"Right entry")}
      </div>
    </div>
    <div className="prise-stops" aria-label="Card positions"><button type="button" disabled={busy||dragging} aria-pressed={parting===0} onClick={()=>setParting(0)}>Together</button><button type="button" disabled={busy||dragging} aria-pressed={parting===100} onClick={()=>setParting(100)}>Apart</button></div>
    <p className="prise-help" aria-live="polite">{parting>0?`Different: ${differences.join(", ")||"none"}.`:reasons.join(" · ")}</p>
    <div className="prise-actions"><button type="button" disabled={busy||dragging} onClick={()=>onReview(left)}>Review {left.isDuplicate?"inclusion":"exclusion"} · left</button><button type="button" disabled={busy||dragging} onClick={()=>onReview(right)}>Review {right.isDuplicate?"inclusion":"exclusion"} · right</button></div>
  </article>;
}
