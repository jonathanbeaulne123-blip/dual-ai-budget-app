/**
 * The household piece (T3): four ORIGINAL Hearth tokens (P4, device-local look), low-poly, each on the same round
 * token base so they read as "a playing piece" without borrowing anyone's peg or car:
 *
 * - lantern — the hearth lantern: a glazed box with a peaked cap and a carry handle;
 * - cat — a seated house cat (Hercules's household, not Hercules himself), tail curled up its side;
 * - boat — a little dory with a mast and a triangle sail;
 * - kettle — the kitchen kettle: round body, lid knob, spout and bail handle.
 *
 * The piece stands on TODAY's space (the household's current place), never on a selection or the camera target.
 * It moves only when today's chapter changes or on Back to now (a ≤ 600 ms settle; a cut under reduced motion).
 */
import type { PieceLookId } from "../contracts.ts";
import type { FullBoardDressing } from "./dressing.ts";
import { box, merge, plate, prism, pyramid, transform, type Shape } from "./shapes.ts";

/** Design units; the piece is ≈ 36 px tall at the reference zoom. */
export const PIECE_HEIGHT = 36;

function tokenBase(accent: string, body: string): Shape {
  return merge(
    prism({ sides: 10, r0: 11.5, r1: 11, y0: 0, y1: 2.2, side: { color: body, shade: 0.7 }, top: { color: accent } }),
    prism({ sides: 10, r0: 9.5, r1: 9, y0: 2.2, y1: 3.4, side: { color: body, shade: 0.85 }, top: { color: body } }),
  );
}

function lantern(body: string, accent: string): Shape {
  // The glass is the lantern: a big warm pane on every side, a slim dark frame at the corners.
  const posts = ([[-5.2, -5.2], [5.2, -5.2], [5.2, 5.2], [-5.2, 5.2]] as const).map(([x, z]) => box({ w: 1.4, d: 1.4, y0: 5.4, y1: 20.6, at: [x, z], paint: { color: body } }));
  return merge(
    tokenBase(accent, body),
    box({ w: 13, d: 13, y0: 3.4, y1: 5.4, paint: { color: body } }),
    prism({ sides: 4, r0: 7, y0: 5.4, y1: 20.6, phase: Math.PI / 4, side: { color: accent, shade: 1.12 }, top: { color: accent } }),
    ...posts,
    // A slim cap leaves the lit glass top showing round it from the board's high view.
    pyramid({ half: 4.6, y0: 20.6, y1: 26, paint: { color: body } }),
    box({ w: 1.3, d: 1.3, y0: 25, y1: 30.5, at: [-2.4, 0], paint: { color: body } }),
    box({ w: 1.3, d: 1.3, y0: 25, y1: 30.5, at: [2.4, 0], paint: { color: body } }),
    box({ w: 6.1, d: 1.3, y0: 30.5, y1: 31.9, paint: { color: body } }),
  );
}

function cat(body: string, accent: string): Shape {
  const ear = () => prism({ sides: 3, r0: 2.2, r1: 0, y0: 25.5, y1: 30.5, phase: Math.PI / 2, side: { color: body }, top: null });
  return merge(
    tokenBase(accent, body),
    prism({ sides: 6, r0: 7.8, r1: 5.2, y0: 3.4, y1: 17, side: { color: body }, top: { color: body } }),
    // Chest bib.
    transform(plate([[-3, 7], [3, 7], [2.2, 15], [-2.2, 15]], 0.6, { color: accent }), { at: [0, 0, 5.9] }),
    transform(prism({ sides: 6, r0: 5.4, r1: 4.6, y0: 17, y1: 26, side: { color: body }, top: { color: body } }), { at: [0, 0, 1.2] }),
    transform(ear(), { at: [-3, 0, 1] }),
    transform(ear(), { at: [3, 0, 1] }),
    box({ w: 1.2, d: 0.6, y0: 21.5, y1: 23, at: [-1.9, 6.4], paint: { color: accent } }),
    box({ w: 1.2, d: 0.6, y0: 21.5, y1: 23, at: [1.9, 6.4], paint: { color: accent } }),
    // Tail curled up the right side.
    transform(box({ w: 2.2, d: 2.2, y0: 0, y1: 12, paint: { color: body, shade: 0.9 } }), { at: [7.6, 4, -2], tilt: -0.35 }),
    transform(box({ w: 2.2, d: 2.2, y0: 0, y1: 4.5, paint: { color: accent } }), { at: [4.2, 15, -2], tilt: 0.9 }),
  );
}

function boat(body: string, accent: string): Shape {
  const hull = transform(prism({ sides: 6, r0: 6, r1: 10, y0: 3.4, y1: 10, phase: 0, side: { color: body }, top: { color: accent, shade: 0.8 } }), { scale: [1.35, 1, 0.62] });
  return merge(
    tokenBase(accent, body),
    hull,
    box({ w: 3, d: 5, y0: 10, y1: 11.5, at: [-6, 0], paint: { color: accent, shade: 0.9 } }),
    box({ w: 1.5, d: 1.5, y0: 10, y1: 33, at: [-1, 0], paint: { color: body, shade: 0.8 } }),
    plate([[0, 12], [0, 32], [11.5, 13]], 0.8, { color: accent }),
    plate([[-1.5, 12.5], [-1.5, 26], [-8, 12.5]], 0.8, { color: accent, shade: 0.92 }),
    plate([[-0.2, 31], [5, 32.2], [-0.2, 33.4]], 0.6, { color: body }),
  );
}

function kettle(body: string, accent: string): Shape {
  return merge(
    tokenBase(accent, body),
    prism({ sides: 8, r0: 8.2, r1: 9.4, y0: 3.4, y1: 9, side: { color: body }, top: null }),
    prism({ sides: 8, r0: 9.4, r1: 6.4, y0: 9, y1: 17, side: { color: body }, top: null }),
    prism({ sides: 8, r0: 6.4, r1: 3.6, y0: 17, y1: 19.4, side: { color: body, shade: 0.95 }, top: { color: accent } }),
    prism({ sides: 6, r0: 1.6, r1: 1.2, y0: 19.4, y1: 22.4, side: { color: accent }, top: { color: accent } }),
    // Spout, angled up and out to the east.
    transform(prism({ sides: 4, r0: 1.8, r1: 1.2, y0: 0, y1: 9, phase: Math.PI / 4, side: { color: body }, top: { color: body } }), { at: [7.5, 8, 0], tilt: -0.85 }),
    // Bail handle.
    box({ w: 1.5, d: 1.5, y0: 16, y1: 27, at: [-5.5, 0], paint: { color: accent } }),
    box({ w: 1.5, d: 1.5, y0: 16, y1: 27, at: [5.5, 0], paint: { color: accent } }),
    box({ w: 12.5, d: 1.5, y0: 27, y1: 28.6, paint: { color: accent } }),
  );
}

export function pieceShape(look: PieceLookId, dressing: FullBoardDressing): Shape {
  const { body, accent } = dressing.piece[look] ?? dressing.piece.lantern;
  switch (look) {
    case "cat": return cat(body, accent);
    case "boat": return boat(body, accent);
    case "kettle": return kettle(body, accent);
    default: return lantern(body, accent);
  }
}
