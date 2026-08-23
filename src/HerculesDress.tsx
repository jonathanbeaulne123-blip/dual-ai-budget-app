/**
 * Wardrobe overlays for the 200×200 left-facing figure.
 * The figure already has a mane — equipped "ruff" is a no-op so we do not
 * draw a second napkin. This file does not import core and cannot post money.
 */
export function HerculesDress({
  hat,
  chain,
  house,
  collar,
}: {
  hat: string | null;
  chain: string | null;
  house: string | null;
  collar: string | null;
}) {
  return (
    <g className="herc-dress" fill="none" stroke="var(--herc-ink, #1b1712)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {house === "patio" && (
        <g>
          <ellipse cx="78" cy="18" rx="26" ry="7" fill="#c45c26" opacity="0.85" />
          <path d="M78 18 L78 42" />
        </g>
      )}
      {house === "cottage" && (
        <path d="M118 28 L132 18 L146 28 L146 42 L118 42 Z" fill="var(--card, #fffaf2)" />
      )}
      {house === "townhouse" && (
        <g>
          <rect x="118" y="22" width="26" height="22" fill="var(--card, #fffaf2)" />
          <path d="M116 22 L131 12 L148 22" />
        </g>
      )}
      {hat === "toque" && (
        <path d="M42 48 Q73 12 104 48 Q73 36 42 48 Z" fill="#fffaf2" />
      )}
      {hat === "visor" && (
        <g>
          <rect x="38" y="44" width="58" height="11" rx="4" fill="#1b1712" stroke="none" />
          <rect x="78" y="46" width="28" height="7" rx="3" fill="#c45c26" stroke="none" />
        </g>
      )}
      {hat === "chef" && (
        <g>
          <ellipse cx="72" cy="28" rx="24" ry="14" fill="#fffaf2" />
          <rect x="60" y="36" width="24" height="10" fill="#fffaf2" />
        </g>
      )}
      {hat === "specs" && (
        <g className="hercules-specs">
          <circle cx="52" cy="63" r="9" fill="#9fd4c8" fillOpacity="0.35" />
          <path d="M43 63 H34" />
        </g>
      )}
      {chain === "copper" && <ellipse cx="72" cy="132" rx="16" ry="7" stroke="#c45c26" strokeWidth="3" />}
      {chain === "gold" && <ellipse cx="72" cy="132" rx="16" ry="7" stroke="#c9a227" strokeWidth="4" />}
      {collar === "bell" && (
        <g>
          <path d="M52 118 H90" stroke="#c9a227" strokeWidth="4" />
          <circle cx="70" cy="128" r="6" fill="#c9a227" />
        </g>
      )}
      {collar === "yarn" && <path d="M50 116 Q70 132 92 116" stroke="#c45c26" strokeWidth="5" />}
      {collar === "fish" && <ellipse cx="118" cy="108" rx="11" ry="5" fill="#2c6a4e" stroke="none" />}
      {collar === "clip" && <rect x="64" y="118" width="14" height="8" rx="2" fill="#c9a227" />}
      {collar === "tooth" && <path d="M68 122 L72 134 L76 122 Z" fill="#fffaf2" />}
      {collar === "ink" && (
        <g>
          <circle cx="118" cy="128" r="10" fill="#2c6a4e" />
          <path d="M113 128 L117 132 L124 122" stroke="#f3eee4" strokeWidth="2" />
        </g>
      )}
    </g>
  );
}
