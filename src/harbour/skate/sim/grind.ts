/**
 * SIM · which grind/slide an approach becomes.
 *
 * The sim never names tricks; it measures the approach and picks the nearest
 * catalog `GrindDef` by (contact, deckYaw, deckPitch).
 *
 * Measured approach, in the RIDER's frame: "nose" below means the end under
 * the rider's front foot (the physical tail when riding with swapped feet),
 * so switch/fakie grinds name the same way regular ones do:
 *  - `axis`  0..π/2 — unsigned angle between the deck and the grindable.
 *  - `over`  +1 when the NOSE is on the far side of the grindable (the side
 *            away from where the rider came from), −1 when the nose is on the
 *            near side (so the tail went over).
 *  - `lean`  −1 tail weight … +1 nose weight.
 *
 * Signed deckYaw convention (what the catalog should use):
 *   deckYaw > 0  nose on the far side:  boardslide (+π/2), feeble (~+.4),
 *                crooked (~+.3), tailslide (+π/2)
 *   deckYaw < 0  nose on the near side: lipslide (−π/2), smith (~−.4),
 *                overcrook (~−.3), noseslide (−π/2)
 *   deckYaw ≈ 0 truck grinds (50-50, 5-0, nosegrind).
 * If a catalog uses only non-negative deckYaw values, ids containing
 * 'lip', 'smith' or 'overcrook' are read as the negative side so the pairs
 * still separate.
 */
import type { GrindDef, GrindableKind } from '../contract.ts';

export type GrindApproach = { axis: number; over: 1 | -1; lean: number; kind: GrindableKind };
type Contact = GrindDef['contact'];

/** The contact an approach asks for: trucks when the deck is within ~40° of the line, deck/nose/tail slides beyond. */
export function wantedContact(a: GrindApproach): Contact {
  const truck = a.axis < 0.7;
  if (a.lean < -0.35) return truck ? 'back-truck' : 'tail';
  if (a.lean > 0.35) return truck ? 'front-truck' : 'nose';
  return truck ? 'both-trucks' : 'deck';
}

const FAMILY: Record<Contact, 'truck' | 'slide'> = {
  'both-trucks': 'truck', 'back-truck': 'truck', 'front-truck': 'truck', deck: 'slide', nose: 'slide', tail: 'slide',
};
const END: Record<Contact, -1 | 0 | 1> = { 'both-trucks': 0, deck: 0, 'back-truck': -1, tail: -1, 'front-truck': 1, nose: 1 };

function contactCost(want: Contact, have: Contact): number {
  if (want === have) return 0;
  const fam = FAMILY[want] === FAMILY[have] ? 0 : 0.9;
  const end = Math.abs(END[want] - END[have]) * 0.7;
  return fam + end;
}

const NEGATIVE_NAMES = /lip|smith|overcrook|over-crook|noseslide|nose-slide/i;

/** Pick the nearest def; null only when the catalog is empty. */
export function selectGrind(defs: ReadonlyMap<string, GrindDef> | Iterable<GrindDef>, a: GrindApproach): GrindDef | null {
  const list: GrindDef[] = [];
  for (const d of (defs instanceof Map ? defs.values() : defs) as Iterable<GrindDef>) list.push(d);
  if (!list.length) return null;
  const signed = list.some((d) => d.deckYaw < -1e-6);
  const want = wantedContact(a);
  const desired = a.axis * a.over;
  const wantPitch = Math.max(-1, Math.min(1, a.lean)) * 0.3;
  let best: GrindDef | null = null, bestCost = Infinity;
  for (const d of list) {
    const eff = signed ? d.deckYaw : (NEGATIVE_NAMES.test(d.id) ? -Math.abs(d.deckYaw) : Math.abs(d.deckYaw));
    // Near-parallel approaches carry no reliable side: compare magnitudes only.
    const yawCost = a.axis < 0.15 ? Math.abs(Math.abs(eff) - a.axis) : Math.abs(eff - desired);
    const cost = 1.5 * contactCost(want, d.contact) + 1.2 * yawCost + 0.8 * Math.abs((d.deckPitch || 0) - wantPitch);
    if (cost < bestCost - 1e-9) { best = d; bestCost = cost; }
  }
  return best;
}

/** True for defs that ride on the deck/nose/tail (more friction than truck grinds). */
export const isSlide = (d: GrindDef): boolean => FAMILY[d.contact] === 'slide';
