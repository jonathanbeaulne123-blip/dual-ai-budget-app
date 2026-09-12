import { NestProp } from "./NestProp.tsx";
import { useMemo, useState } from "react";
import { formatCad, type Goal, type Household, type LedgerView } from "../core/index.ts";
import { type KittyStudioV1 } from "../core/types.ts";
import { defaultGoalEnvelope, KITTY_GLAZES } from "../core/goalEnvelopes.ts";
import { displayedKittyPiece } from "../core/kittyStudio.ts";
import { projectKittyNest, NEST_CATEGORY_LABELS, NEST_CATEGORY_MEANINGS, type NestBank } from "../core/kittyNest.ts";
import { NEST_CATEGORIES, nestDesignId, saveKittyNestDesign, type NestCategory } from "../core/kittyNestDesigns.ts";
import { KittyFlat } from "./studio/flat.tsx";
import { KittyStage } from "./KittyStage.tsx";
import { StudioBench, useKittyStudio, type StudioRun } from "./studio/KittyStudio.tsx";
import { nestDefaultPiece, nestMotif, nestOrnament } from "./nestAppearance.ts";
import "./kitty-nest.css";

export function NestPortrait({ bank, theme }: { bank: NestBank; theme: string }) {
  const piece = bank.goal ? displayedKittyPiece(bank.goal.envelope?.studio) : displayedKittyPiece(bank.design?.studio) ?? nestDefaultPiece(bank);
  const step = bank.targetCents > 0 ? Math.max(0, Math.min(10, Math.floor(bank.amountCents / bank.targetCents * 10))) : 0;
  return <span className={`nest-portrait nest-portrait--${bank.tier}${bank.state === "broken" ? " is-broken" : ""}`} aria-hidden="true">
    <KittyFlat piece={piece} glaze={bank.design?.glaze ?? bank.goal?.envelope?.glaze ?? "cream"} step={step} />
    <NestProp ornament={nestOrnament(bank, theme)} />
    {bank.state === "broken" && <svg className="nest-crack" viewBox="0 0 100 100"><path d="M51 15L43 38L62 48L39 66L54 88" fill="none" stroke="currentColor" strokeWidth="4"/></svg>}
  </span>;
}
function NestButton({ bank, theme, onSelect }: { bank: NestBank; theme: string; onSelect: (bank: NestBank) => void }) {
  const detail = bank.tier === "bill" ? bank.state === "broken" ? "Paid · a promise kept" : `${bank.date ?? "Coming up"} · ${formatCad(bank.targetCents)} needed` : bank.tier === "goal" ? `Goal · ${formatCad(bank.targetCents)}` : null;
  const accessibleName = [`Open ${bank.name} in the 3D gallery`, formatCad(bank.amountCents), detail, bank.state === "archived" ? "Archived" : null].filter(Boolean).join(". ");
  return <button type="button" className={`nest-bank nest-bank--${bank.tier}`} data-bank-id={bank.id} data-category={bank.category ?? undefined} onClick={() => onSelect(bank)} aria-label={accessibleName}>
    <NestPortrait bank={bank} theme={theme}/><span className="nest-bank__name">{bank.name}</span>
    <strong className="nest-bank__amount">{formatCad(bank.amountCents)}</strong>
    {detail && <small>{detail}</small>}
  </button>;
}
export function KittyNest({ household, memberId, view, today, onSelect, compact = false }: { household: Household; memberId: string; view: LedgerView; today: string; onSelect: (bank: NestBank) => void; compact?: boolean }) {
  const nest = useMemo(() => projectKittyNest(household, memberId, view, today), [household, memberId, view, today]);
  const theme = typeof document === "undefined" ? "classic" : document.documentElement.dataset.theme ?? "classic";
  return <section className={`kitty-nest${compact ? " kitty-nest--compact" : ""}`} data-world={theme} data-view={view} aria-label={view === "household" ? "Our nesting banks" : "My nesting banks"}>
    <div className="nest-king-place"><div className="nest-introduction"><p className="kicker">One nest. Four purposes.</p><h3>{view === "household" ? "What we are building towards" : "What I am building towards"}</h3><p>{nest.sourceLabel}</p>{!nest.king.design?.setupCompletedAt && <button type="button" className="nest-primary" onClick={() => onSelect(nest.king)}>{nest.king.design?.studio ? "Continue building your King" : "Build your King"}</button>}</div><NestButton bank={nest.king} theme={theme} onSelect={onSelect}/></div>
    <div className="nest-category-grid">{nest.categories.map(category => <section key={category.id} className="nest-category" data-category={category.category} aria-label={`${category.name} banks`}>
      <NestButton bank={category} theme={theme} onSelect={onSelect}/><p className="nest-category__meaning">{NEST_CATEGORY_MEANINGS[category.category!]}</p>
      {!compact && <div className="nest-children">{category.children.map(bank => <NestButton key={bank.id} bank={bank} theme={theme} onSelect={onSelect}/>)}{!category.children.length && <p className="nest-empty">Room for what comes next.</p>}</div>}
    </section>)}</div>
    {nest.totalCents < 0 && <p className="nest-debt-note">Everyday includes the net amount still owed.</p>}
    {!compact && nest.history.length > 0 && <details className="nest-history"><summary>Broken pots &amp; archived banks · {nest.history.length}</summary><div className="nest-history__shelf">{nest.history.map(bank=><NestButton key={bank.id} bank={bank} theme={theme} onSelect={onSelect}/>)}</div></details>}
  </section>;
}

export function NestBankDetail({ bank, h, memberId, view, identity, busy, theme, run, readLatest, onSelect, onOpenCalendar }: { bank: NestBank; h: Household; memberId: string; view: LedgerView; identity: string; busy: boolean; theme: string; run: StudioRun; readLatest: () => Household; onSelect: (bank: NestBank) => void; onOpenCalendar?: () => void }) {
  const [editing, setEditing] = useState(bank.tier === "king" && !bank.design?.setupCompletedAt);
  const [name, setName] = useState(bank.name);
  const [glaze, setGlaze] = useState(bank.design?.glaze ?? "cream");
  const [category, setCategory] = useState<NestCategory>(bank.category ?? "everyday");
  const [pot, setPot] = useState(() => { const original = displayedKittyPiece(bank.design?.studio) ?? nestDefaultPiece(bank); return { ...original, firedAt: null, firedBy: null }; });
  const design = h.kittyNestDesigns?.find(row => row.id === nestDesignId(view,memberId,bank.designKey));
  const goal: Goal = { id: bank.id, name, targetCents: bank.targetCents, savedCents: 0, deadline: null, arrivalDate: null, shared: view === "household", ownerMemberId: view === "personal" ? memberId : null, subcategoryId: null, status: "open", funded: false, retiredAt: null, purchaseId: null, createdAt: design?.createdAt ?? "2026-09-12T00:00:00.000Z", updatedAt: design?.updatedAt ?? "2026-09-12T00:00:00.000Z", envelope: { ...defaultGoalEnvelope(), glaze, studio: design?.studio } };
  const save = (current: Household, next?: KittyStudioV1, fire = false, completeSetup = false, archived?: boolean) => saveKittyNestDesign(current, { memberId, view, bankKey: bank.designKey, expectedRevision: design?.revision ?? 0, name, glaze, studio: next ?? design?.studio, fire, completeSetup, category: bank.tier === "bill" ? category : null, ...(archived !== undefined ? { archived } : {}) });
  const studio = useKittyStudio({ goal, identity, memberId, envelope: goal.envelope!, active: editing && bank.tier === "king", run, readLatest, saveDesign: (current, next, fire) => save(current, next, fire) });
  const full = bank.tier === "king";
  const step = bank.targetCents ? Math.max(0, Math.min(10, Math.floor(bank.amountCents / bank.targetCents * 10))) : 0;
  const piece = full ? studio.stagePiece ?? nestDefaultPiece(bank) : editing ? { ...pot, paint: { ...pot.paint, base: KITTY_GLAZES[glaze] } } : displayedKittyPiece(bank.design?.studio) ?? nestDefaultPiece(bank);
  return <section className={`nest-detail nest-detail--${bank.tier}`} data-studio-mode={bank.tier}>
    <header><p className="kicker">{full ? "King · your foundation chapter" : bank.tier === "plan" ? `${NEST_CATEGORY_LABELS[bank.category!]} · category pottery` : "A little bank for a real expense"}</p><h2>{bank.name}</h2><strong className="nest-detail__amount">{formatCad(bank.amountCents)}</strong>{bank.tier === "bill" && <p>{bank.state === "broken" ? "Paid. This pot kept its promise." : `${formatCad(bank.targetCents)} needed${bank.date ? ` · ${bank.date}` : ""}`}</p>}</header>
    {full && !design?.setupCompletedAt && <div className="king-chapter-intro"><h3>Make the bank that holds your whole nest</h3><p>Shape it, paint it, add its little stories, then fire it. Protect, Everyday, Build and Prepare each have a place inside.</p><ol><li>Give your King a name.</li><li>Build and fire your own piece.</li><li>Meet the four banks inside.</li></ol></div>}
    <div className="nest-detail__workshop"><div className="nest-detail__object"><KittyStage broken={bank.state === "broken"} piece={piece} glaze={glaze} name={bank.name} open={false} step={step} ornament={nestOrnament(bank, theme)} mode={full && editing ? studio.mode : "view"} fired={full ? studio.stageFired : undefined} spin={full && editing ? studio.spin : false} brush={full ? studio.stageBrush : null} apiRef={studio.apiRef} onPaint={full ? (hit, phase) => studio.onPaintRef.current?.(hit, phase) : undefined} onThrow={full ? dy => studio.onThrowRef.current?.(dy) : undefined} onFlatChange={studio.setFlat}/></div>
    <div className="nest-detail__controls">
      {bank.state !== "broken" && <button type="button" onClick={() => setEditing(!editing)}>{editing ? "See the bank" : full ? "Build / repaint your King" : bank.tier === "plan" ? "Choose pot & glaze" : "Edit this little bank"}</button>}
      {editing && <><label>Bank name<input value={name} maxLength={120} onChange={event => setName(event.target.value)}/></label>
        {full ? <StudioBench state={studio} goal={goal} busy={busy} step={step}/> : <>
          {bank.tier === "plan" && <fieldset><legend>Choose its pot</legend>{(["round", "pear", "loaf", "bean"] as const).map(body=><button key={body} type="button" aria-pressed={pot.sculpt.body===body} onClick={()=>setPot({...pot,sculpt:{...pot.sculpt,body}})}>{body}</button>)}<p>Its {nestMotif(nestOrnament(bank,theme))} is baked into the clay.</p></fieldset>}
          <fieldset className="nest-glazes"><legend>Glaze</legend>{Object.entries(KITTY_GLAZES).map(([key,color])=><button key={key} type="button" aria-label={`${key} glaze`} aria-pressed={glaze===key} style={{backgroundColor:color}} onClick={()=>setGlaze(key as typeof glaze)}><span>{glaze===key ? "✓" : ""}</span></button>)}</fieldset>
          {bank.tier === "bill" && <><label>Inside<select value={category} onChange={event=>setCategory(event.target.value as NestCategory)}>{NEST_CATEGORIES.map(c=><option key={c} value={c}>{NEST_CATEGORY_LABELS[c]}</option>)}</select></label><fieldset><legend>A tiny prop</legend>{(["heart","star","leaf","shell"] as const).map(kind=><button key={kind} type="button" onClick={()=>setPot({...pot,paint:{...pot.paint,stamps:[{id:"tiny-prop",kind,anchor:"chest",color:"#b68a40",size:.16,rotation:0}]}})}>{kind}</button>)}</fieldset></>}
          <button type="button" className="nest-primary" disabled={busy || !name.trim()} onClick={()=>void run(current=>save(current,{version:1,draft:{...pot,paint:{...pot.paint,base:KITTY_GLAZES[glaze]}},fired:[]},true),"Your bank design is saved.")}>Save this design</button>
        </>}
      </>}
      {full && !design?.setupCompletedAt && <><button type="button" className="nest-primary" disabled={busy || !design?.studio?.fired.length} onClick={()=>void run(current=>save(current,design?.studio,false,true),"Your King chapter is complete.")}>Finish the King chapter</button><button type="button" onClick={()=>{ void studio.keep().then(saved=>{if(saved)setEditing(false);});}} disabled={busy}>Keep my progress for later</button></>}
      {bank.tier === "bill" && <>{bank.state !== "broken" && <button type="button" disabled={busy} onClick={()=>void run(current=>save(current,undefined,false,false,bank.state!=="archived"),bank.state==="archived"?"Bank restored.":"Bank archived. Its bill and history remain.")}>{bank.state==="archived"?"Restore bank":"Archive bank"}</button>}{onOpenCalendar && <button type="button" className="nest-primary" onClick={onOpenCalendar}>{bank.state==="broken"?"See payment in Calendar":"Review expense in Calendar"}</button>}<p className="nest-source-note">{bank.state==="broken"?"Its receipt keeps the history. A recurring bill gets a new pot automatically.":"This bank comes from your existing expense. Payment still goes through Review and Final Confirm."}</p></>}
    </div></div>
    {!!bank.children.length && <section className="nest-detail__children"><h3>Inside {bank.name}</h3><div>{bank.children.map(child=><NestButton key={child.id} bank={child} theme={theme} onSelect={onSelect}/>)}</div></section>}
  </section>;
}
