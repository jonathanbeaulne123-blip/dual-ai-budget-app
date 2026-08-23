import { useId, type ReactNode } from "react";

/**
 * HerculesFigure — the rigged ink-on-paper Maine Coon.
 *
 * One drawing, six moving parts, every pose driven by CSS on the root.
 * Nothing here knows about the ledger. It takes a pose and a mood and draws a cat.
 *
 * Coat: mostly white with faint warm dapples, per the real Hercules.
 * Line: --herc-ink, which defaults to the house --ink so he sits on the paper.
 *
 * Paint order is load-bearing (later SVG nodes sit on top):
 *   tail → body → ruff → head → legs → ground
 * The ruff sits UNDER the head. That hides the neck join so the head can tilt
 * without tearing the silhouette open, and the head's own jaw curve reads as
 * the cheek. Drawing the ruff over the head is what produced the napkin.
 *
 * Flip lives on an outer wrapper. Pose animations also set `transform` on `.herc`;
 * putting scaleX(-1) on the same node would clobber the hop / pounce / attack.
 */

export type HerculesFigurePose =
  | "loaf" | "walk" | "jump" | "stretch" | "wash" | "sleep" | "hide"
  | "pace" | "celebrate" | "pounce" | "perch" | "lick" | "bump" | "attack";

export type HerculesFigureMood = "glowing" | "content" | "restless" | "hiding";

export function HerculesFigure({
  pose = "loaf",
  mood = "content",
  flip = false,
  size = 96,
  title,
  children,
}: {
  pose?: HerculesFigurePose;
  mood?: HerculesFigureMood;
  /** true = facing right. The drawing is authored facing left. */
  flip?: boolean;
  size?: number;
  /** Only pass when the figure is the sole carrier of meaning; otherwise he stays aria-hidden. */
  title?: string;
  children?: ReactNode;
}) {
  const uid = useId().replace(/:/g, "");
  const bodyClip = `hercBodyClip-${uid}`;
  const headClip = `hercHeadClip-${uid}`;

  return (
    <div
      className={flip ? "herc-flip-wrap" : "herc-root"}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        className={`herc herc-pose-${pose} herc-mood-${mood}`}
        role={title ? "img" : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
      >
        <defs>
          <clipPath id={bodyClip}>
            <path d="M84 92 C112 74 148 92 165 122 C180 148 174 170 156 177 L104 179 C86 174 74 132 84 92 Z" />
          </clipPath>
          <clipPath id={headClip}>
            <path d="M38 25 L58 47 C66 41 77 39 87 43 L98 23 L108 51 C120 64 122 84 108 96 C92 110 58 110 42 96 C28 84 30 60 38 25 Z" />
          </clipPath>
        </defs>

        <g
          className="herc-ink"
          fill="none"
          stroke="var(--herc-ink, #1b1712)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g className="herc-tail">
            <path
              d="M138 158 C176 170 198 142 193 106 C189 80 172 66 158 72
                 C174 84 182 110 174 132 C166 152 150 158 136 156 Z"
              fill="var(--herc-coat, #fdfbf6)"
            />
            <path d="M170 88 C180 104 182 126 172 144" strokeWidth="1.2" opacity="0.38" />
            <path d="M182 96 C190 112 189 132 181 146" strokeWidth="1" opacity="0.22" />
          </g>

          <g className="herc-body">
            <path
              d="M84 92 C112 74 148 92 165 122 C180 148 174 170 156 177 L104 179 C86 174 74 132 84 92 Z"
              fill="var(--herc-coat, #fdfbf6)"
            />
            <g clipPath={`url(#${bodyClip})`} stroke="none">
              <ellipse cx="141" cy="110" rx="16" ry="10" fill="var(--herc-spot, #c9a884)" opacity="0.28" transform="rotate(-20 141 110)" />
              <ellipse cx="160" cy="148" rx="12" ry="7" fill="var(--herc-spot, #c9a884)" opacity="0.24" transform="rotate(26 160 148)" />
              <ellipse cx="116" cy="162" rx="11" ry="6" fill="var(--herc-spot, #c9a884)" opacity="0.17" />
            </g>
            <path d="M112 120 C126 142 131 162 127 179" strokeWidth="1.3" opacity="0.35" />
            <path d="M146 100 C160 114 168 134 167 156" strokeWidth="1.1" opacity="0.3" />
          </g>

          {/* Ruff UNDER the head — paint order, not comment order. */}
          <g className="herc-ruff">
            <path
              d="M46 62
                 C34 74 26 88 30 100
                 C24 106 25 116 31 120
                 C26 126 27 135 33 138
                 C29 144 32 152 38 153
                 C36 160 42 166 49 165
                 C56 171 66 170 72 164
                 C82 167 93 160 97 149
                 C102 132 102 100 98 74 Z"
              fill="var(--herc-coat, #fdfbf6)"
            />
            <path d="M48 104 C44 118 44 134 48 148" strokeWidth="1.3" opacity="0.3" />
            <path d="M62 106 C59 120 59 136 63 150" strokeWidth="1.2" opacity="0.26" />
            <path d="M76 108 C74 120 74 132 76 142" strokeWidth="1.1" opacity="0.22" />
          </g>

          <g className="herc-head">
            <path
              d="M38 25 L58 47 C66 41 77 39 87 43 L98 23 L108 51
                 C120 64 122 84 108 96 C92 110 58 110 42 96 C28 84 30 60 38 25 Z"
              fill="var(--herc-coat, #fdfbf6)"
            />
            <g clipPath={`url(#${headClip})`} stroke="none">
              <ellipse cx="88" cy="56" rx="10" ry="6" fill="var(--herc-spot, #c9a884)" opacity="0.26" transform="rotate(-18 88 56)" />
              <ellipse cx="60" cy="92" rx="12" ry="5" fill="var(--herc-spot, #c9a884)" opacity="0.14" />
            </g>

            <g className="herc-ears">
              <path d="M40 34 C45 40 50 44 55 46" strokeWidth="1.4" opacity="0.5" />
              <path d="M96 32 C93 39 90 43 87 46" strokeWidth="1.4" opacity="0.5" />
              <path d="M38 26 C36 22 35 20 34 17" strokeWidth="2" />
              <path d="M98 24 C100 20 101 18 102 15" strokeWidth="2" />
            </g>

            <g className="herc-face">
              <g className="herc-eye">
                <path d="M40 63 C46 56 59 56 64 63 C58 70 46 70 40 63 Z" fill="#ffffff" strokeWidth="2" />
                <circle cx="52" cy="63" r="3.8" fill="var(--herc-ink, #1b1712)" stroke="none" />
                <circle cx="50.4" cy="61.4" r="1.1" fill="#ffffff" stroke="none" />
              </g>
              <path className="herc-eye-shut" d="M41 64 C47 69 58 69 63 64" strokeWidth="2" />
              <path d="M28 83 C33 87 41 87 45 83" strokeWidth="1.4" opacity="0.5" />
              <path d="M26 79 l7 -2 l-3 5 Z" fill="var(--herc-ink, #1b1712)" strokeWidth="1" />
              <path d="M30 85 c3 3 8 2 9 -1" strokeWidth="1.4" />
              <path d="M36 51 l-8 -6 M33 59 l-9 -4" strokeWidth="1.3" opacity="0.55" />
              <path className="herc-whiskers" d="M30 81 l-18 -8 M30 85 l-19 -1 M32 89 l-16 8" strokeWidth="1" opacity="0.45" />
            </g>
          </g>

          <g className="herc-legs">
            <g className="herc-leg herc-leg-front">
              <path d="M63 140 C58 152 56 166 58 175 C59 180 70 181 73 177 C75 165 76 150 74 140 Z" fill="var(--herc-coat, #fdfbf6)" />
              <path d="M58 174 c4 4 10 4 14 1" strokeWidth="1.3" opacity="0.65" />
            </g>
            <g className="herc-leg herc-leg-back">
              <path d="M80 142 C77 154 76 166 78 175 C79 180 89 181 92 177 C94 165 94 152 92 142 Z" fill="var(--herc-coat, #fdfbf6)" />
              <path d="M78 175 c4 4 10 4 13 1" strokeWidth="1.3" opacity="0.65" />
            </g>
          </g>

          <path className="herc-ground" d="M28 184 L178 184" strokeWidth="1.3" opacity="0.18" />
        </g>
        {children}
      </svg>
    </div>
  );
}
