import type { ToolId } from "./tools.ts";

/**
 * The drawer's seven objects (Round 1D). Each draws a Classic, a Taylor and a
 * Newfoundland dressing; CSS shows the one for the page's theme. Pure decoration:
 * the button around it carries the name.
 */
export function ToolArt({ tool }: { tool: ToolId }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      {tool === "past" && <>
        <rect className="p" x="10" y="70" width="60" height="7" rx="1" /><rect className="p" x="12" y="64" width="58" height="7" rx="1" />
        <g className="tc"><path className="p" d="M12 64 20 46H72L68 64Z" /><path className="ln" d="M24 52H62M22 57H58" /><rect className="m" x="38" y="42" width="12" height="8" rx="1.5" /></g>
        <g className="tt"><path className="p" d="M12 64 20 48H72L68 64Z" /><g transform="rotate(-8 34 48)"><rect x="20" y="32" width="26" height="28" fill="#fff" stroke="#d9a3bb" /><rect x="23" y="35" width="20" height="16" fill="#a9d3ec" /></g><g transform="rotate(7 52 46)"><rect x="40" y="30" width="26" height="28" fill="#fff" stroke="#d9a3bb" /><rect x="43" y="33" width="20" height="16" fill="#f6a5c0" /></g></g>
        <g className="tn"><rect x="10" y="44" width="60" height="33" rx="5" fill="#2f5d73" stroke="#1f3336" strokeWidth="1.5" /><rect x="8" y="42" width="64" height="8" rx="3" fill="#3f7690" stroke="#1f3336" /><path d="M22 60h36M22 66h36" stroke="#e3b23c" strokeWidth="2" /><rect className="p" x="24" y="34" width="30" height="10" transform="rotate(-5 39 39)" /></g>
        <g className="cue"><g transform="rotate(10 58 22)"><rect x="42" y="6" width="30" height="28" fill="#ffe27a" stroke="#b58f1c" /><path d="M47 17h18M47 23h13" stroke="#8a6d10" strokeWidth="1.8" /></g><circle cx="55" cy="9" r="3.5" fill="#b8433a" stroke="#6e1f19" /></g>
      </>}
      {tool === "tracing" && <>
        <path d="M12 77 22 26H62L56 77Z" className="tp" />
        <path d="M20 66C30 50 38 60 46 44S56 36 58 32" fill="none" className="tl" />
        <g transform="rotate(32 58 50)"><rect className="a2" x="54" y="26" width="8" height="40" /><path d="M54 66 58 76 62 66Z" fill="#f1d9b0" className="edge" /><rect className="a" x="54" y="22" width="8" height="5" /></g>
      </>}
      {tool === "letter" && <>
        <g className="cue"><g transform="rotate(12 44 32)"><rect className="p" x="28" y="6" width="34" height="46" /><path className="ln" d="M28 6 45 20 62 6" /><circle className="a" cx="45" cy="21" r="4" /></g></g>
        <rect className="p" x="16" y="48" width="44" height="18" transform="rotate(-4 38 57)" /><rect className="p" x="22" y="52" width="42" height="16" />
        <path className="w" d="M6 58H74L68 77H12Z" /><path d="M10 62H70" className="edge" opacity=".5" />
      </>}
      {tool === "chairs" && <>
        <g className="tc">
          <path className="dk" d="M6 28V77M26 28V77M6 30H26M6 38H26M11 38V56M16 38V56M21 38V56M30 60V77" /><rect className="w" x="4" y="55" width="28" height="6" rx="2" />
          <g transform="translate(80 0) scale(-1 1)"><path className="dk" d="M6 28V77M26 28V77M6 30H26M6 38H26M11 38V56M16 38V56M21 38V56M30 60V77" /><rect className="w" x="4" y="55" width="28" height="6" rx="2" /></g>
          <path d="M40 40c-3-4-9-1-6 3l6 5 6-5c3-4-3-7-6-3Z" className="a" />
        </g>
        <g className="tt">
          {[0, 46].map(dx => <g key={dx} transform={`translate(${dx} 0)`}><path className="dk" d="M10 52 6 77M24 52 28 77M8 66H26" /><ellipse className="a" cx="17" cy="50" rx="13" ry="4.5" /><path d="M17 40l1.6 3.4 3.7.4-2.8 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.5 3.7-.4Z" className="g" /></g>)}
        </g>
        <g className="tn">
          {["", "translate(80 0) scale(-1 1)"].map(t => <g key={t} transform={t || undefined}><path d="M6 30V77M22 30V77M6 34H22M6 42H22M6 50H22M26 62V77" fill="none" stroke="#416f74" strokeWidth="3" strokeLinecap="round" /><rect x="4" y="57" width="24" height="6" rx="2" fill="#5e8f94" stroke="#273e41" /></g>)}
          <ellipse cx="40" cy="72" rx="7" ry="5.5" fill="#b8433a" stroke="#273e41" /><path d="M47 70l5-4" stroke="#273e41" strokeWidth="2" /><rect x="37" y="65" width="6" height="2.5" fill="#273e41" />
        </g>
      </>}
      {tool === "recipe" && <>
        <path className="w" d="M14 54 18 40H68L66 54Z" opacity=".85" />
        <g transform="rotate(-5 40 47)"><rect className="p" x="24" y="30" width="32" height="28" /><path d="M28 38H50" className="ac" /><path className="ln" d="M28 45H48M28 50H44" /></g>
        <rect className="w" x="12" y="54" width="56" height="23" rx="3" /><rect className="m" x="34" y="60" width="12" height="5" rx="1" />
      </>}
      {tool === "kitty" && <>
        <ellipse className="k" cx="40" cy="63" rx="22" ry="14" />
        <path className="k" d="M27 36 28 18 38 29ZM53 36 52 18 42 29Z" /><path d="M29.5 31 30 24 34 29ZM50.5 31 50 24 46 29Z" fill="#f6a5c0" /><circle className="k" cx="40" cy="40" r="14" />
        <rect className="d" x="34" y="26.5" width="12" height="2.5" rx="1" />
        <circle className="d" cx="34.5" cy="40" r="2" /><circle className="d" cx="45.5" cy="40" r="2" /><circle cx="31" cy="45" r="2.4" fill="#f6a5c0" opacity=".8" /><circle cx="49" cy="45" r="2.4" fill="#f6a5c0" opacity=".8" /><path d="M38 45q2 2 4 0" fill="none" className="edge" />
        <rect className="a" x="30" y="52" width="20" height="4" rx="2" /><circle className="a2" cx="40" cy="58" r="2.5" />
      </>}
      {tool === "lamp" && <>
        <g className="tc"><ellipse className="g" cx="54" cy="56" rx="17" ry="20" opacity=".45" /><ellipse className="m" cx="30" cy="74" rx="17" ry="4.5" /><path className="ms" d="M30 72 22 46 44 28" /><circle className="m" cx="22" cy="46" r="3" /><path className="m" d="M40 18 66 27 52 45Z" /><circle className="g" cx="58" cy="38" r="4.5" /></g>
        <g className="tt"><rect x="22" y="36" width="36" height="41" rx="8" fill="#ffffffaa" className="glass" /><rect className="m" x="25" y="30" width="30" height="7" rx="2" /><path d="M26 44q14 8 28 0M26 56q14 8 28 0M26 68q14 6 28 0" fill="none" stroke="#9b557c" /><circle cx="32" cy="47" r="2.6" fill="#ffe38a" /><circle cx="46" cy="47" r="2.6" fill="#f6a5c0" /><circle cx="30" cy="59" r="2.6" fill="#a9d3ec" /><circle cx="44" cy="60" r="2.6" fill="#ffe38a" /><circle cx="36" cy="71" r="2.6" fill="#f6a5c0" /><circle cx="50" cy="70" r="2.6" fill="#a9d3ec" /></g>
        <g className="tn"><path d="M20 22 6 16M60 22l14-6M20 28 6 30M60 28l14 2" stroke="#e3b23c" strokeWidth="2.4" /><path d="M30 77 34 36H46L50 77Z" fill="#fbfaf0" stroke="#273e41" strokeWidth="1.4" /><path d="M33 48H47L48 58H32ZM31 66H49L50 77H30Z" fill="#b8433a" /><rect x="31" y="32" width="18" height="4" fill="#273e41" /><rect x="34" y="20" width="12" height="12" fill="#ffe08a" stroke="#273e41" strokeWidth="1.4" /><path d="M32 20 40 12 48 20Z" fill="#b8433a" stroke="#273e41" /></g>
      </>}
    </svg>
  );
}

/** The plant (or its theme's twin) that fills the open drawer's last seat. */
export function DrawerFiller() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <g className="tc"><path d="M40 52C30 40 22 42 18 34 30 34 36 40 40 50 42 36 50 28 60 28 56 40 48 42 41 52" fill="#2c6a4e" /><path d="M26 54H54L50 77H30Z" fill="#c45c26" stroke="#7a3514" /><rect x="24" y="52" width="32" height="6" rx="1" fill="#d9713e" stroke="#7a3514" /></g>
      <g className="tt"><circle cx="40" cy="64" r="13" fill="#f6c8d8" stroke="#9b557c" /><circle cx="40" cy="64" r="5" fill="#fff" stroke="#9b557c" /><path d="M40 44c-4-6-12-2-8 4l8 7 8-7c4-6-4-10-8-4Z" fill="#b04a7c" /></g>
      <g className="tn"><path d="M40 20V36" stroke="#8a7a64" strokeWidth="2" /><ellipse cx="40" cy="58" rx="15" ry="20" fill="#fbfaf0" stroke="#273e41" strokeWidth="1.5" /><path d="M26 50H54V66H26Z" fill="#b8433a" /><rect x="36" y="34" width="8" height="5" fill="#273e41" /></g>
    </svg>
  );
}
