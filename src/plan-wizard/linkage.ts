import { WIZARD_LINE_KEYS, WIZARD_LINE_LABELS, type WizardLineKey } from "./wizard.ts";

/**
 * The pop-up's mechanism, ported from K1's "One pull raises it".
 *
 * Five cut-paper ranks stand on the recipe card. Each is hinged to the card
 * and pushed by one rod from a single slotted bar, so **one parameter drives
 * the whole thing**. Each rod is a real slider-rocker: with the bar `d` away
 * from the hinge and the rod's peg `a` up the flat,
 *
 *     L² = d² + 2·a·d·cos θ + a²   ⟹   cos θ = (L² − d² − a²) / (2·a·d)
 *
 * Every rod is a little longer than the one in front of it (`SLACK`), which is
 * the lost motion in the bar's slot: the front rank tops out first and the back
 * one last. The paper stop at `TH_MAX` is where the rank meets its own tab —
 * it never goes past upright, and the whole assembly collapses flat again.
 *
 * Pure numbers only; the component turns these into transforms.
 */

/** Rod attachment height up each flat, in design units. */
export const A = 44;
/** Rank-to-rank step: fixed, receding. Depth is order only, never quantity. */
export const S = 34;
/** Bar-to-front-hinge distance with the card flat. */
export const D0 = 40;
/** Extra rod per rank — the lost motion that staggers the raise. */
export const SLACK = 5;
/** The paper stop, in degrees. */
export const TH_MAX = 86;
/** Total bar travel from flat to fully raised. */
export const TRAVEL = 57;
/** Page-y of the front rank's hinge on the card. */
export const HINGE0 = 250;
export const BAR_REST = HINGE0 + D0;

export type Rank = {
  key: WizardLineKey;
  label: string;
  index: number;
  /** Cut width and height of the flat, in design units. */
  w: number;
  h: number;
  /** Where the flat stands across the card. */
  x: number;
  hinge: number;
  dRest: number;
  /** This rod's fixed length. */
  L: number;
};

const CUTS: Readonly<Record<WizardLineKey, { w: number; h: number; x: number }>> = {
  what: { w: 210, h: 60, x: -120 },
  much: { w: 116, h: 170, x: 136 },
  when: { w: 104, h: 116, x: -154 },
  pot: { w: 118, h: 98, x: 46 },
  who: { w: 212, h: 130, x: -14 },
};

export const RANKS: readonly Rank[] = WIZARD_LINE_KEYS.map((key, index) => {
  const cut = CUTS[key];
  const dRest = D0 + S * index;
  return {
    key,
    label: WIZARD_LINE_LABELS[key],
    index,
    w: cut.w,
    h: cut.h,
    x: cut.x,
    hinge: HINGE0 - S * index,
    dRest,
    L: dRest + A + SLACK * index,
  };
});

const clamp = (value: number, low: number, high: number) => (value < low ? low : value > high ? high : value);

/** One rank's standing angle (degrees) and its bar distance, at this bar travel. */
export function rankAngle(rank: Rank, travel: number): { theta: number; d: number } {
  const d = rank.dRest + travel;
  const cos = clamp((rank.L * rank.L - d * d - A * A) / (2 * A * d), -1, 1);
  return { theta: Math.min((Math.acos(cos) * 180) / Math.PI, TH_MAX), d };
}

export type RankPose = {
  rank: Rank;
  /** Degrees off the card, 0 = flat, TH_MAX = on its stop. */
  theta: number;
  /** 0…1 of the way to the stop — what the jar's fill and the shadow follow. */
  rise: number;
  d: number;
  rankTransform: string;
  rodWidth: number;
  rodTransform: string;
  /** sin θ: the shadow the flat throws on the rank behind it. */
  shadowScaleY: number;
  shadowOpacity: number;
  shadowTransform: string;
  standing: boolean;
  topped: boolean;
};

/** Everything one rank needs at pull `t` (0 flat … 1 fully raised). */
export function rankPose(rank: Rank, t: number): RankPose {
  const travel = clamp(t, 0, 1) * TRAVEL;
  const { theta, d } = rankAngle(rank, travel);
  const radians = (theta * Math.PI) / 180;
  const pegX = A * Math.cos(radians);
  const pegY = A * Math.sin(radians);
  const dx = pegX + d;
  const rodLength = Math.hypot(dx, pegY);
  const phi = (Math.atan2(pegY, dx) * 180) / Math.PI;
  return {
    rank,
    theta,
    rise: theta / TH_MAX,
    d,
    rankTransform: `translate3d(${rank.x - rank.w / 2}px, ${rank.hinge - rank.h}px, 0) rotateX(${-theta}deg)`,
    rodWidth: rodLength,
    rodTransform: `translate3d(${rank.x}px, ${rank.hinge + d}px, 0) rotateX(${-phi}deg) rotateZ(-90deg)`,
    shadowScaleY: 0.1 + 0.85 * Math.sin(radians),
    shadowOpacity: 0.25 + 0.6 * (theta / TH_MAX),
    shadowTransform: `translate3d(${rank.x - rank.w / 2}px, ${rank.hinge}px, 0) scaleY(${(0.1 + 0.85 * Math.sin(radians)).toFixed(4)})`,
    standing: theta > 0.5,
    topped: theta >= TH_MAX - 0.2,
  };
}

export type LinkageReading = {
  t: number;
  travel: number;
  tilt: number;
  creaseOpacity: number;
  barY: number;
  poses: RankPose[];
  fitted: number;
  standing: number;
  topped: number;
};

/** The whole mechanism at one pull, for only the ranks that have been fitted. */
export function linkageReading(t: number, fitted: readonly WizardLineKey[]): LinkageReading {
  const pull = clamp(t, 0, 1);
  const present = RANKS.filter((rank) => fitted.includes(rank.key));
  const poses = present.map((rank) => rankPose(rank, pull));
  return {
    t: pull,
    travel: pull * TRAVEL,
    tilt: 58 - 10 * pull,
    creaseOpacity: 0.12 + 0.62 * pull,
    barY: BAR_REST + pull * TRAVEL,
    poses,
    fitted: present.length,
    standing: poses.filter((pose) => pose.standing).length,
    topped: poses.filter((pose) => pose.topped).length,
  };
}

/** The readout under the stage: exact, never rounded into a feeling. */
export function linkageWords(reading: LinkageReading): string {
  if (reading.fitted === 0) return "Nothing fitted yet — the card is flat and empty.";
  if (reading.topped === reading.fitted) return `Fully raised — all ${reading.fitted} ranks on their stops.`;
  if (reading.standing === 0) return `Flat on the card — ${reading.fitted} of 5 ranks fitted.`;
  return `${reading.standing} of ${reading.fitted} ranks rising, ${reading.topped} on the stop. The front rank tops out first.`;
}
