import { useDialog } from "../useDialog.ts";
import { useEffect, useState } from "react";
import { PaperBars, PaperTile, StoryStrip, WaxSeal, NotebookBody } from "./PaperTheme.tsx";
import { THEMES, type SceneRoute, type ThemeId } from "./scenes.ts";
import { useAppearance, useSceneBinding } from "./ThemeProvider.tsx";
import { AppearancePicker } from "./AppearancePicker.tsx";
import { ThemeSceneHeading } from "./SceneArtwork.tsx";
import { HerculesFigure } from "../HerculesFigure.tsx";
import { HerculesDress } from "../HerculesDress.tsx";
import type { LedgerView } from "../core/types.ts";
import "./theme-reference.css";

/** Development-only specimen uses production primitives and synthetic facts. No ledger or auth calls. */
export default function ThemeStudio() {
  const params = new URLSearchParams(window.location.search);
  const [route, setRoute] = useState<SceneRoute>((["home", "calendar", "plan", "ledger", "more", "till", "shift"] as SceneRoute[]).find(r => r === params.get("route")) ?? "home");
  const [view, setView] = useState<LedgerView>(params.get("scope") === "personal" ? "personal" : "household");
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState("Groceries for the weekend");
  const [confirm, setConfirm] = useState(false);
  const dialog = useDialog(confirm, () => setConfirm(false));
  const { store, scene } = useAppearance();
  useSceneBinding(route, view, confirm);
  useEffect(() => {
    const theme = THEMES.find(t => t.id === params.get("theme"))?.id;
    if (theme) store?.preview(theme);
    // URL seeds this local specimen once; subsequent controls are interactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);
  return <main className="theme-studio" data-theme-studio="true">
    <div className="studio-toolbar"><strong>Hearth · design specimens</strong><label>World<select value={scene.theme} onChange={e => store?.preview(e.target.value as ThemeId)}>{THEMES.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label><label>Ledger<select value={view} onChange={e => setView(e.target.value as LedgerView)}><option value="household">Shared</option><option value="personal">Personal</option></select></label><label>Page<select value={route} onChange={e => setRoute(e.target.value as SceneRoute)}>{["home", "calendar", "plan", "ledger", "more", view === "personal" ? "shift" : "till"].map(r => <option key={r} value={r}>{r}</option>)}</select></label></div>
    <div className="studio-page"><header className="studio-brand"><span>Hearth<span className="studio-brand-dot">.</span></span><span className="studio-scope">{view === "household" ? "Jonathan & Bianca · Shared" : "Your Personal ledger"}</span></header>
      <ThemeSceneHeading home={route === "home"} books={route === "ledger"} />
      <div className="studio-layout"><section className="studio-main"><section className="card studio-overview"><p className="studio-eyebrow">September, at a glance</p><h1>{route === "home" ? "A little room to breathe." : route === "plan" ? "Good things take a little planning." : route === "calendar" ? "Make room for the days ahead." : route === "ledger" ? "Every little detail, together." : route === "more" ? "Settle in. Make it yours." : "One little thing at a time."}</h1><p className="muted">A welcoming place for the everyday, and everything you’re looking forward to.</p>
        <div className="studio-balance"><span>Available this month</span><strong>$1,284<span>.50</span></strong><span className="muted">After your planned commitments</span></div>
        <PaperBars caption="Plan and actual" rows={[{ label: "Income", cents: 420000, tone: "pine" }, { label: "Planned", cents: 300000, tone: "ink" }, { label: "Spent", cents: 171550, tone: "copper" }]} />
      </section>
      <StoryStrip heading="The little things, all in one place"><PaperTile name="Next bill" value="$84.00" kind="September 16" /><PaperTile name="Put aside" value="$620.00" kind="Your goals" /><PaperTile name="This week" value="3 shifts" kind="On the calendar" /><PaperTile name="Needs a look" value="2 items" kind="Review" warn /></StoryStrip>
      <section className="card studio-register"><header><h2>Recent activity</h2><button className="ghost" type="button">View all</button></header><table><thead><tr><th>Date</th><th>Details</th><th>Amount</th></tr></thead><tbody>{[["Sep 08", "Groceries", "−$76.40"], ["Sep 07", "Pay received", "+$425.00"], ["Sep 06", "Coffee together", "−$12.50"]].map(row => <tr key={row[1]}>{row.map((cell, i) => <td key={cell} className={i === 2 ? "amount" : undefined}>{cell}</td>)}</tr>)}</tbody></table></section>
      <NotebookBody title="A note for later" panelId="studio-note" open={open} onClose={() => setOpen(false)}><label htmlFor="studio-draft">Note</label><input id="studio-draft" value={note} onChange={e => setNote(e.target.value)} /><p className="muted">This draft stays in place when you change the theme.</p><div className="studio-actions"><button type="button" className="primary" onClick={() => setConfirm(true)}>Review entry</button><button className="ghost" type="button" disabled>Saved</button></div></NotebookBody>
      {!open && <button className="ghost" type="button" onClick={() => setOpen(true)}>Open notebook</button>}
      </section><aside className="studio-aside"><div className="hearth-wax-seals"><WaxSeal label="Post" value="+" sub="Something new" onClick={() => setConfirm(true)} tone="post" /><WaxSeal label="Due" value="2" sub="Coming up" onClick={() => setOpen(true)} tone="due" /><WaxSeal label="Close" value="Sep" sub="Your month" onClick={() => setOpen(true)} /></div><section className="card studio-keepsake"><p className="studio-eyebrow">A moment for yourself</p><h2>Welcome back.</h2><HerculesFigure pose="loaf" size={180}><HerculesDress hat={null} chain={null} collar={null} house={null} /></HerculesFigure><p className="muted">Hercules is keeping your spot warm.</p></section><div className="preview warn" role="status">Two entries are ready for your review.</div><div className="preview"><span className="pill">Saved</span><p>Your last entry is in the books.</p></div></aside></div>
      <AppearancePicker /><footer className="studio-footer">Synthetic design specimen · No household is loaded. No money can be posted.</footer>
    </div>
    {confirm && <div className="sheet guard" ref={dialog}><section className="sheet-inner" role="dialog" aria-modal="true" aria-labelledby="studio-confirm"><h2 id="studio-confirm">Review your entry</h2><p>{note}</p><strong>$76.40 CAD</strong><p className="muted">Design specimen. This action only closes this preview.</p><div className="studio-actions"><button className="primary" type="button" onClick={() => setConfirm(false)}>Confirm preview</button><button className="ghost" type="button" onClick={() => setConfirm(false)}>Cancel</button></div></section></div>}
  </main>;
}
