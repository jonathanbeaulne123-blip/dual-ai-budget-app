import { KITTY_GLAZES } from "../core/goalEnvelopes.ts";
import { queenFormHandles, type QueenPortraitV1 } from "../core/queenForm.ts";
import { formatDateLabel } from "../core/calendar.ts";
import { QueenCharmGlyphs } from "./QueenCharmGlyph.tsx";
import { queenFlatVessel, queenFlatRings, QUEEN_VIEW } from "./QueenFigure.tsx";
import type { QueenForm } from "./world/queenCharmSurface.ts";

/**
 * Our Story's shelf: one portrait of her per sealed year. A portrait is a
 * stored still — her form, her clay and part colours, her charms and how
 * many rings she carried at that year's close — drawn flat in both paths.
 * Not a live sculpture: a shelf of ten costs ten small SVGs and no WebGL,
 * so it cannot melt a phone. Immutable; nothing here can change one.
 */
export function QueenPortraitFigure({ portrait }: { portrait: QueenPortraitV1 }) {
  const form: QueenForm = { handles: queenFormHandles(portrait.profile), rings: portrait.rings };
  const clay = (KITTY_GLAZES as Record<string, string>)[portrait.base] ?? (/^#[0-9a-f]{6}$/i.test(portrait.base) ? portrait.base : undefined);
  return (
    <svg className="queen-svg queen-portrait__svg" viewBox={`0 0 ${QUEEN_VIEW.w} ${QUEEN_VIEW.h}`} aria-hidden="true" focusable="false" style={clay ? { "--queen-clay": clay } as React.CSSProperties : undefined}>
      <ellipse className="queen-foot" cx="120" cy="306" rx="92" ry="11" />
      <g className="queen-belly" style={portrait.parts.body ? { "--queen-clay": portrait.parts.body } as React.CSSProperties : undefined}>
        <path className="queen-vessel" d={queenFlatVessel(form)} />
        {queenFlatRings(form).map((ring) => <path key={ring.key} className="queen-ring" d={ring.d} />)}
        <QueenCharmGlyphs charms={portrait.charms} part="body" form={form} />
      </g>
      <path className="queen-vessel" d="M80 182 C80 146 96 126 120 126 C144 126 160 146 160 182 Z" style={{ transform: `scaleX(${form.handles.neck})`, transformOrigin: "120px 182px" }} />
      <g style={portrait.parts.head ? { "--queen-clay": portrait.parts.head } as React.CSSProperties : undefined}>
        <ellipse className="queen-vessel" cx="120" cy="112" rx="40" ry="39" />
        <path className="queen-eye" d="M98 114 q8 6 16 0" />
        <path className="queen-eye" d="M126 114 q8 6 16 0" />
        <path className="queen-mouth" d="M111 132 q9 6 18 0" />
        <QueenCharmGlyphs charms={portrait.charms} part="head" form={form} />
      </g>
      <path className="queen-crown" d="M90 78 L97 60 L109 72 L120 52 L131 72 L143 60 L150 78" />
    </svg>
  );
}

export function QueenPortraits({ portraits, members, label = "Our Story" }: { portraits: readonly QueenPortraitV1[]; members: readonly { id: string; name: string }[]; label?: string }) {
  const nameOf = (id: string) => members.find((row) => row.id === id)?.name ?? "one of you";
  return (
    <section className="queen-story" aria-label={label}>
      <p className="queen-eyebrow">{label}</p>
      {portraits.length === 0 ? (
        <p className="queen-panel__muted">Her first portrait is taken when a year closes. The shelf keeps one for every year since, as she was.</p>
      ) : (
        <ul className="queen-shelf-portraits" data-portraits={portraits.length}>
          {portraits.map((portrait) => (
            <li key={portrait.year} className="queen-portrait">
              <figure>
                <QueenPortraitFigure portrait={portrait} />
                <figcaption>
                  <b>{portrait.year}</b>
                  <span className="sr-only">: as she was at that year's close — {portrait.rings} {portrait.rings === 1 ? "ring" : "rings"}, {portrait.charms.length} {portrait.charms.length === 1 ? "charm" : "charms"}; sealed by {nameOf(portrait.by)} on {formatDateLabel(portrait.at.slice(0, 10))}. A kept still; it cannot change.</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
