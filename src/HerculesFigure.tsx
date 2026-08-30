import { useId, type CSSProperties, type ReactNode } from "react";
import type { RigSnapshot } from "./herculesRig/types.ts";
import { rigRootClassName, snapshotToDomStyles } from "./herculesRig/dom.ts";

/**
 * HerculesFigure — the rigged ink-on-paper Maine Coon.
 *
 * One drawing, independently controllable parts (head, tail, each leg, …).
 * Default: CSS pose classes. When `rigSnapshot` is passed, the JS rig engine
 * drives per-part transforms — the path AI agents use.
 *
 * Coat: mostly white with faint warm dapples, per the real Hercules.
 * Line: --herc-ink, which defaults to the house --ink so he sits on the paper.
 *
 * Paint order is load-bearing (later SVG nodes sit on top):
 *   tail → body → ruff → head → legs → ground
 */

export type HerculesFigurePose =
  | "loaf" | "walk" | "jump" | "stretch" | "wash" | "sleep" | "hide"
  | "pace" | "celebrate" | "pounce" | "perch" | "lick" | "bump" | "attack"
  | "sit" | "beg" | "bag";

export type HerculesFigureMood = "glowing" | "content" | "restless" | "hiding";

function part(group: keyof ReturnType<typeof snapshotToDomStyles>, styles: ReturnType<typeof snapshotToDomStyles>): CSSProperties {
  return styles[group] as CSSProperties;
}

export function HerculesFigure({
  pose = "loaf",
  mood = "content",
  flip = false,
  size = 96,
  title,
  children,
  rigSnapshot,
  rigTransitionMs,
}: {
  pose?: HerculesFigurePose;
  mood?: HerculesFigureMood;
  /** true = facing right. The drawing is authored facing left. */
  flip?: boolean;
  size?: number;
  /** Only pass when the figure is the sole carrier of meaning; otherwise he stays aria-hidden. */
  title?: string;
  children?: ReactNode;
  /** When set, per-part transforms come from the rig engine instead of CSS pose classes. */
  rigSnapshot?: RigSnapshot;
  /** Browser interpolation window between engine-issued snapshots. */
  rigTransitionMs?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const bodyClip = `hercBodyClip-${uid}`;
  const headClip = `hercHeadClip-${uid}`;
  const rigDriven = Boolean(rigSnapshot);
  const styles = rigSnapshot ? snapshotToDomStyles(rigSnapshot) : null;
  const rootClass = rigDriven
    ? rigRootClassName(mood, true)
    : `herc herc-pose-${pose} herc-mood-${mood}`;
  const rootStyle = rigDriven && styles ? part("root", styles) : undefined;
  const rigStyle = rootStyle
    ? ({ ...rootStyle, ["--herc-rig-transition-ms" as string]: `${rigTransitionMs ?? 48}ms` } as CSSProperties)
    : undefined;
  const bagOpacity = rigDriven && rigSnapshot?.bag.opacity != null ? rigSnapshot.bag.opacity : undefined;

  return (
    <div
      className={flip ? "herc-flip-wrap" : "herc-root"}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        className={rootClass}
        style={rigStyle}
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
          <g className="herc-tail" data-herc-part="tail" style={styles ? part("tail", styles) : undefined}>
            <path
              d="M138 158 C176 170 198 142 193 106 C189 80 172 66 158 72
                 C174 84 182 110 174 132 C166 152 150 158 136 156 Z"
              fill="var(--herc-coat, #fdfbf6)"
            />
            <path d="M170 88 C180 104 182 126 172 144" strokeWidth="1.2" opacity="0.38" />
            <path d="M182 96 C190 112 189 132 181 146" strokeWidth="1" opacity="0.22" />
          </g>

          <g className="herc-body" data-herc-part="body" style={styles ? part("body", styles) : undefined}>
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

          <g className="herc-ruff" data-herc-part="ruff" style={styles ? part("ruff", styles) : undefined}>
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

          <g className="herc-head" data-herc-part="head" style={styles ? part("head", styles) : undefined}>
            <path
              d="M38 25 L58 47 C66 41 77 39 87 43 L98 23 L108 51
                 C120 64 122 84 108 96 C92 110 58 110 42 96 C28 84 30 60 38 25 Z"
              fill="var(--herc-coat, #fdfbf6)"
            />
            <g clipPath={`url(#${headClip})`} stroke="none">
              <ellipse cx="88" cy="56" rx="10" ry="6" fill="var(--herc-spot, #c9a884)" opacity="0.26" transform="rotate(-18 88 56)" />
              <ellipse cx="60" cy="92" rx="12" ry="5" fill="var(--herc-spot, #c9a884)" opacity="0.14" />
            </g>

            <g className="herc-ears" data-herc-part="ears" style={styles ? part("ears", styles) : undefined}>
              <path d="M40 34 C45 40 50 44 55 46" strokeWidth="1.4" opacity="0.5" />
              <path d="M96 32 C93 39 90 43 87 46" strokeWidth="1.4" opacity="0.5" />
              <path d="M38 26 C36 22 35 20 34 17" strokeWidth="2" />
              <path d="M98 24 C100 20 101 18 102 15" strokeWidth="2" />
            </g>

            <g className="herc-face">
              <g
                className="herc-eye"
                data-herc-part="eye"
                style={styles ? part("eye", styles) : undefined}
              >
                <path d="M40 63 C46 56 59 56 64 63 C58 70 46 70 40 63 Z" fill="#ffffff" strokeWidth="2" />
                <circle cx="52" cy="63" r="3.8" fill="var(--herc-ink, #1b1712)" stroke="none" />
                <circle cx="50.4" cy="61.4" r="1.1" fill="#ffffff" stroke="none" />
              </g>
              <path
                className="herc-eye-shut"
                data-herc-part="eyeShut"
                style={styles ? part("eyeShut", styles) : undefined}
                d="M41 64 C47 69 58 69 63 64"
                strokeWidth="2"
              />
              <path d="M28 83 C33 87 41 87 45 83" strokeWidth="1.4" opacity="0.5" />
              <path d="M26 79 l7 -2 l-3 5 Z" fill="var(--herc-ink, #1b1712)" strokeWidth="1" />
              <path d="M30 85 c3 3 8 2 9 -1" strokeWidth="1.4" />
              <path d="M36 51 l-8 -6 M33 59 l-9 -4" strokeWidth="1.3" opacity="0.55" />
              <path
                className="herc-whiskers"
                data-herc-part="whiskers"
                style={styles ? part("whiskers", styles) : undefined}
                d="M30 81 l-18 -8 M30 85 l-19 -1 M32 89 l-16 8"
                strokeWidth="1"
                opacity="0.45"
              />
            </g>
          </g>

          <g className="herc-legs" data-herc-part="legs" style={styles ? part("legs", styles) : undefined}>
            <g className="herc-leg herc-leg-front" data-herc-part="legFront" style={styles ? part("legFront", styles) : undefined}>
              <path d="M63 140 C58 152 56 166 58 175 C59 180 70 181 73 177 C75 165 76 150 74 140 Z" fill="var(--herc-coat, #fdfbf6)" />
              <path d="M58 174 c4 4 10 4 14 1" strokeWidth="1.3" opacity="0.65" />
            </g>
            <g className="herc-leg herc-leg-back" data-herc-part="legBack" style={styles ? part("legBack", styles) : undefined}>
              <path d="M80 142 C77 154 76 166 78 175 C79 180 89 181 92 177 C94 165 94 152 92 142 Z" fill="var(--herc-coat, #fdfbf6)" />
              <path d="M78 175 c4 4 10 4 13 1" strokeWidth="1.3" opacity="0.65" />
            </g>
          </g>

          <g
            className="herc-bag"
            data-herc-part="bag"
            opacity={bagOpacity ?? 0}
            style={styles ? part("bag", styles) : undefined}
          >
            <path
              d="M118 128 L168 118 L174 168 L122 176 Z"
              fill="#c4a574"
              stroke="var(--herc-ink, #1b1712)"
              strokeWidth="2"
            />
            <path d="M128 126 L134 98 L158 94 L162 120" fill="none" stroke="var(--herc-ink, #1b1712)" strokeWidth="1.6" />
            <path d="M140 130 L148 162" strokeWidth="1.2" opacity="0.45" />
          </g>

          <path className="herc-ground" d="M28 184 L178 184" strokeWidth="1.3" opacity="0.18" />
        </g>
        {children}
      </svg>
    </div>
  );
}
