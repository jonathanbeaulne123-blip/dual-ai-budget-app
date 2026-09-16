import { useEffect, useRef, useState } from "react";
import type { LedgerView } from "../core/types.ts";
import { HerculesPortrait } from "../Hercules.tsx";
import type { ToolBadge } from "./model.ts";
import { DrawerFiller, ToolArt } from "./ToolArt.tsx";
import { TOOLS, type ToolId } from "./tools.ts";

const HINT_KEY = "hearth.planV3.drawerHint";
function readHintSeen(): boolean { try { return window.localStorage.getItem(HINT_KEY) === "1"; } catch { return true; } }
function writeHintSeen() { try { window.localStorage.setItem(HINT_KEY, "1"); } catch { /* a per-device nicety only */ } }

/**
 * The cute tool drawer (Round 1D): a wooden drawer of seven objects under the
 * plan on a phone, a side rail at 720px and wider. Closed, it is a shelf of
 * small objects; open, each object wears a tag that says what it is for.
 * At most one badge shows at a time.
 */
export function ToolDrawer({ view, badge, onOpen, lifted }: { view: LedgerView; badge: ToolBadge; onOpen: (tool: ToolId, from: HTMLElement) => void; lifted: ToolId | null }) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [whisper, setWhisper] = useState<{ tool: ToolId } | null>(null);
  const knob = useRef<HTMLButtonElement | null>(null);
  const hold = useRef<{ timer: number; held: boolean }>({ timer: 0, held: false });
  const tools = TOOLS.filter(tool => view === "household" || !tool.householdOnly);
  useEffect(() => () => window.clearTimeout(hold.current.timer), []);
  const toggle = () => {
    const next = !open;
    setOpen(next); setWhisper(null);
    if (next && !readHintSeen()) setHint(true);
  };
  const badgeFor = (id: ToolId) => badge && badge.tool === id ? badge.text : null;
  const whisperTool = whisper ? tools.find(tool => tool.id === whisper.tool) : null;
  return (
    <aside className="pv3-dock" data-open={open} aria-label="Plan tools" onKeyDown={event => { if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); knob.current?.focus(); } }}>
      <span className="pv3-dock__rope" aria-hidden="true" />
      <svg className="pv3-dock__lights" viewBox="0 0 400 22" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 3Q50 18 100 4T200 4T300 4T400 3" fill="none" stroke="#9b557c" /><circle cx="25" cy="11" r="3" fill="#ffe38a" /><circle cx="75" cy="11" r="3" fill="#f6a5c0" /><circle cx="125" cy="10" r="3" fill="#a9d3ec" /><circle cx="275" cy="10" r="3" fill="#a9d3ec" /><circle cx="325" cy="11" r="3" fill="#ffe38a" /><circle cx="375" cy="11" r="3" fill="#f6a5c0" /></svg>
      <button ref={knob} type="button" className="pv3-dock__knob" aria-expanded={open} aria-controls="pv3-dock-inner" onClick={toggle}>
        Tools <svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 7l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {whisperTool && !open && <p className="pv3-dock__whisper" aria-hidden="true"><b>{whisperTool.name}</b> — {whisperTool.purpose}{badgeFor(whisperTool.id) ? ` · ${badgeFor(whisperTool.id)}` : ""}</p>}
      <div className="pv3-dock__inner" id="pv3-dock-inner">
        {hint && open && (
          <div className="pv3-dock__hint" role="note">
            <HerculesPortrait pose="sit" size={44} mood="content" hat={null} chain={null} house={null} collar={null} />
            <p><b>Hercules:</b> Our plan tools. Each tag says what it's for. Drawer closed? Press and hold a tool.</p>
            <button type="button" onClick={() => { writeHintSeen(); setHint(false); setOpen(false); knob.current?.focus(); }}>Got it</button>
          </div>
        )}
        <ul className="pv3-shelf" aria-label="Plan tools">
          {tools.map(tool => {
            const flag = badgeFor(tool.id);
            return (
              <li key={tool.id} data-tool={tool.id} data-badge={flag ? "on" : undefined}>
                <button type="button" className={`pv3-obj${lifted === tool.id ? " is-lifted" : ""}`} aria-haspopup="dialog"
                  aria-label={`${tool.name}, ${tool.purpose.replace(" · ", " and ")}${flag ? `, ${flag}` : ""}`}
                  onMouseEnter={() => setWhisper({ tool: tool.id })} onMouseLeave={() => setWhisper(null)}
                  onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setWhisper({ tool: tool.id }); }} onBlur={() => setWhisper(null)}
                  onPointerDown={event => {
                    if (event.pointerType === "mouse") return;
                    hold.current.held = false;
                    window.clearTimeout(hold.current.timer);
                    hold.current.timer = window.setTimeout(() => { hold.current.held = true; setWhisper({ tool: tool.id }); window.setTimeout(() => setWhisper(null), 2500); }, 450);
                  }}
                  onPointerUp={() => window.clearTimeout(hold.current.timer)} onPointerCancel={() => window.clearTimeout(hold.current.timer)} onPointerLeave={() => window.clearTimeout(hold.current.timer)}
                  onContextMenu={event => event.preventDefault()}
                  onClick={event => { if (hold.current.held) { hold.current.held = false; event.preventDefault(); return; } setWhisper(null); onOpen(tool.id, event.currentTarget); }}>
                  <span className="pv3-obj__art"><ToolArt tool={tool.id} />{flag && <span className="pv3-obj__seal" aria-hidden="true">{flag.match(/^\d+/)?.[0] ?? "•"}</span>}</span>
                  <span className="pv3-obj__tag"><span className="pv3-obj__name">{tool.name}</span><span className="pv3-obj__purpose">{tool.purpose}</span></span>
                  {flag && <span className="pv3-obj__flag" aria-hidden="true">{flag}</span>}
                </button>
              </li>
            );
          })}
          <li className="pv3-shelf__filler" aria-hidden="true"><DrawerFiller /></li>
        </ul>
      </div>
    </aside>
  );
}
