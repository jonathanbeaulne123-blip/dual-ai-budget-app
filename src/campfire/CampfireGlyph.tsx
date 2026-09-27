/** The fire, drawn small: a ring of stones and a flame. It flickers only when motion is allowed; under reduced motion it stands still. */
export function CampfireGlyph() {
  return (
    <svg className="campfire-glyph" viewBox="0 0 48 48" width="40" height="40" aria-hidden="true" focusable="false">
      <path className="campfire-glyph__flame" d="M24 8c4 7 10 10 10 18a10 10 0 0 1-20 0c0-5 3-8 5-11 1 4 3 5 5 5-2-4-1-8 0-12z" />
      <path className="campfire-glyph__logs" d="M10 38l28-6M10 32l28 6" />
      <g className="campfire-glyph__stones">
        <ellipse cx="8" cy="41" rx="4" ry="2.4" />
        <ellipse cx="18" cy="43" rx="4" ry="2.4" />
        <ellipse cx="30" cy="43" rx="4" ry="2.4" />
        <ellipse cx="40" cy="41" rx="4" ry="2.4" />
      </g>
    </svg>
  );
}
