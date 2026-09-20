import { useState } from "react";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import { DEFAULT_QUEEN_STYLE, QUEEN_STYLE_OPTIONS, type QueenStyle } from "./queenStyle.ts";
import type { BloomEvidence } from "./world/bloom.ts";

export function QueenDressing({onPreview,onView,evidence}: {onPreview:(style:QueenStyle|null)=>void;onView:(view:"front"|"back"|"roots"|"detail")=>void;evidence:BloomEvidence[]}){
  const appearance=useAppearance();const [draft,setDraft]=useState<QueenStyle>(appearance.saved.queen??DEFAULT_QUEEN_STYLE);const [message,setMessage]=useState("");
  return <section className="house-queen-dressing"><p className="kicker">Living Presence · Bloom V2</p><h2 id="house-queen-title" tabIndex={-1}>The Queen’s dressing table</h2><p>Her garden holds the history you have chosen to make. Dress her for this room.</p>
    <nav aria-label="Inspect the Queen">{(["front","back","roots","detail"] as const).map(view=><button key={view} onClick={()=>onView(view)}>{view[0]!.toUpperCase()+view.slice(1)}</button>)}</nav>
    <div className="house-queen-options">{Object.entries(QUEEN_STYLE_OPTIONS).map(([key,options])=><label key={key}>{key[0]!.toUpperCase()+key.slice(1)}<select value={draft[key as keyof QueenStyle]} onChange={e=>{const next={...draft,[key]:e.target.value};setDraft(next);onPreview(next);setMessage("Previewing — your saved look is unchanged.");}}>{options.map(value=><option key={value} value={value}>{value.replaceAll("-"," ")}</option>)}</select></label>)}</div>
    <div className="house-actions"><button onClick={()=>{appearance.store?.setQueen(draft);onPreview(null);setMessage("Look saved. Account saving follows the appearance status below.");}}>Save this look</button><button onClick={()=>{setDraft(appearance.saved.queen??DEFAULT_QUEEN_STYLE);onPreview(null);setMessage("Preview cancelled.");}}>Cancel preview</button><button onClick={()=>{setDraft(DEFAULT_QUEEN_STYLE);onPreview(DEFAULT_QUEEN_STYLE);setMessage("Original look previewed. Save to keep it.");}}>Reset preview</button></div>
    <p role="status">{message} {appearance.status==="saved"?"Saved to your account.":appearance.status==="pending"?"Waiting for account acknowledgement.":"Appearance available on this device."}</p>
    <details><summary>Read her growth</summary><p>Roots hold chosen intentions. Buds are possibilities; red flowers require an explicitly lived experience. White care flowers require recorded care. Revisions branch, and kept memories remain authored recollections. Spending alone never creates a flower.</p>{evidence.length?<ul>{evidence.map(row=><li key={`${row.id}:${row.kind}`}><strong>{row.title}</strong> · {row.kind} · revision {row.revision}{row.date?` · ${row.date}`:" · no lived date"}</li>)}</ul>:<p>No supported growth events yet. There is no penalty for a quiet garden.</p>}</details>
  </section>;
}
