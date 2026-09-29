/**
 * The milestone pavilion (T3): a small open pavilion on a hexagonal platform — the one major stop that gets a
 * building-like mark (never a new building on the island; it stands beside the route like any post). A milestone
 * "ready to record" (eligible, not yet saved in the HomeBook) is the frame only — no roof — so "earned" and "recorded"
 * never look the same.
 */
import { box, merge, prism, pyramid, type Shape } from "./shapes.ts";

export type PavilionState = "granted" | "ready-to-record";

export function pavilionShape(state: PavilionState, colors: { post: string; roof: string; platform: string }): Shape {
  const posts: Shape[] = [];
  for (const [x, z] of [[-6, -6], [6, -6], [6, 6], [-6, 6]] as const) {
    posts.push(box({ w: 1.6, d: 1.6, y0: 2.4, y1: 15, at: [x, z], paint: { color: colors.post } }));
  }
  const platform = merge(
    prism({ sides: 6, r0: 11, r1: 10.5, y0: 0, y1: 2.4, side: { color: colors.platform, shade: 0.75 }, top: { color: colors.platform } }),
  );
  const beam = box({ w: 14, d: 14, y0: 15, y1: 16.4, paint: { color: colors.post } });
  if (state === "ready-to-record") return merge(platform, ...posts);
  return merge(platform, ...posts, beam, pyramid({ half: 9.5, y0: 16.4, y1: 24, paint: { tint: 1 } }), box({ w: 1.2, d: 1.2, y0: 24, y1: 27, paint: { color: colors.post } }));
}
