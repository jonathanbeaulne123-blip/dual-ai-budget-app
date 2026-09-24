/**
 * The Desk's one door onto the engraved-money rule: an unknown amount reads
 * "—", never "$0". The rule lives in `flat/CourtFlat.tsx` today; the Desk
 * re-exports it rather than duplicating it, so when S6 retires `CourtFlat`
 * there is exactly one import to repoint.
 */
export { engravedCents, sundialAngle } from "../flat/CourtFlat.tsx";
