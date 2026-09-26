import { useEffect, useState } from "react";
import { CampCard, type CampCardProps } from "./CampCard.tsx";
import { StripBand, type StripBandProps } from "./StripBand.tsx";
import "../desk/desk.css";
import "./glass.css";

export type DockProps = {
  strip: StripBandProps;
  card: CampCardProps;
  /** The scene is at night: the card's tint lifts (.82 Classic / Taylor, .84 Newfoundland). */
  night?: boolean;
  /** The Quiet (calm) comfort setting: solid, no blur, nothing moves. */
  calm?: boolean;
  /** The lite quality tier, Save-Data, or a missed frame budget: solid, no blur. */
  lite?: boolean;
  /** The camera is moving: the blur is skipped, and restored 120 ms after it stops (§4.3 blur budget). */
  cameraMoving?: boolean;
};

/** How long after the camera stops the dock's blur comes back (the bubbles' own `BLUR_RESTORE_MS`). */
const DOCK_BLUR_RESTORE_MS = 120;

/**
 * The dock (Tool Atlas §4.1 "Where they sit", §4.3, §4.4, §6): the strip band
 * above the three-line camp card, on Hearth's glass, fixed to the bottom of
 * the phone (216 px collapsed, including the 12 px gutter), a 300 px right
 * column on a landscape phone, and a 360 px column bottom-left on desktop.
 *
 * It is a camera dead zone by *origin*: `data-camera-deadzone` marks it for
 * the orbit controller's `pointerdown` check. Nothing here captures a
 * pointer or calls `preventDefault`, and `touch-action: manipulation` keeps
 * the browser's zoom working over it. The glass turns solid under every
 * fallback — reduced transparency, reduced motion, more contrast, forced
 * colours (in `glass.css`), and the `calm` and `lite` props here.
 */
export function Dock({ strip, card, night = false, calm = false, lite = false, cameraMoving = false }: DockProps) {
  const [blurOff, setBlurOff] = useState(cameraMoving);
  useEffect(() => {
    if (cameraMoving) { setBlurOff(true); return; }
    const timer = window.setTimeout(() => setBlurOff(false), DOCK_BLUR_RESTORE_MS);
    return () => window.clearTimeout(timer);
  }, [cameraMoving]);
  return <div className="glass-dock" data-camera-deadzone="" data-night={night || undefined} data-calm={calm || undefined} data-lite={lite || undefined} data-camera-moving={blurOff || undefined}
    data-expanded={card.expanded || undefined} style={{ touchAction: "manipulation" }}>
    <div className="glass-dock__glass">
      <StripBand {...strip} />
      <CampCard {...card} variant="dock" />
    </div>
  </div>;
}
