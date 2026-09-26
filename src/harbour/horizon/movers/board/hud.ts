/**
 * The pace bubble (RIDE §10.4): one glass bubble, four jobs, never two at once.
 *  - normally the pace and the surface under the wheels as words ("fast · paved", "slow · cobbles",
 *    "threshold · the square");
 *  - during a slide the charge arc fills around the icon (no words, no number);
 *  - in the release window the push glyph shows for its 0.5 s;
 *  - off the bed the wheels dig in: "off the line" with the offline glyph.
 * The park / pick-up offer is the runtime's (the registry's offer), so `glyph` is never 'park'
 * or 'pickup' here. Pure: no DOM, no clock.
 */
import type {MoverHud} from '../shared/mode.ts';
import type {ContactSample, GroundEvent, GroundState} from '../shared/ground/types.ts';

/** The surface as the rider reads it (MANIFEST surface ids, plus the pad and the park slab). */
export const SURFACE_WORDS: Readonly<Record<string, string>> = Object.freeze({
  paved: 'paved', packedEarth: 'packed earth', ochre: 'ochre', apron: 'apron', bankedTurf: 'banked turf',
  boardwalk: 'boardwalk', cobble: 'cobbles', gravel: 'gravel', sand: 'sand', plaza: 'the square',
  snow: 'snow', ice: 'ice', stone: 'the pad', grass: 'grass',
});
export const OFF_THE_LINE = 'off the line';
const SLIDE_GRIP = 0.7;

export const surfaceWord = (material: string): string => SURFACE_WORDS[material] ?? material;

/**
 * The bubble for this frame. `sample` (the ground under the board, when the caller has one)
 * overrides the kernel's last contact; airborne, the last contact still names the ground.
 */
export function hudFor(state: GroundState, sample: ContactSample | null, events: readonly GroundEvent[]): MoverHud {
  const legal = sample ? sample.legal : state.contact.legal;
  const word = sample ? (sample.legal ? sample.pace : 'offbed') : state.contact.pace;
  const material = sample ? sample.material : state.contact.material;
  const L = state.legs;
  const fading = events.some(e => e.kind === 'fadeBack');
  if ((!legal || word === 'offbed') && !fading) return {pace: OFF_THE_LINE, arc: 0, glyph: 'offline', label: OFF_THE_LINE};
  // `pace` always names the ground ("fast · paved": the stage picks the icon from its first word);
  // `label` is what the bubble says right now (null while the arc or the push glyph has the bubble).
  const pace = material ? `${word} · ${surfaceWord(material)}` : word;
  if (L.window > 0) return {pace, arc: L.charge, glyph: 'push', label: null};
  const sliding = state.contact.on && state.grip < SLIDE_GRIP;
  if (sliding || L.charge > 0) return {pace, arc: L.charge, glyph: null, label: null};
  return {pace, arc: 0, glyph: null, label: pace};
}
