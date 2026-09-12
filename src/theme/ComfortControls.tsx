import { useComfort } from "./comfort.ts";
import { AtmosphereControl } from "./AppearancePicker.tsx";

/**
 * Appearance and comfort (Status Centre group): Quiet expression, celebration
 * intensity, motion, haptics, sound. Independent of theme; per device; never
 * shared truth. Coaching intensity lives with the Plan because it is a
 * per-member preference saved in the household document.
 */
export function ComfortControls({ environment }: { environment: string }) {
  const [comfort, update] = useComfort(environment);
  return (
    <section className="card comfort-panel" aria-labelledby="comfort-heading">
      <header><div><p className="kicker">Appearance and comfort</p><h2 id="comfort-heading">Comfort</h2></div><AtmosphereControl /></header>
      <p className="muted">Each of you can quiet this device without changing what is true for the household. Theme is a separate choice.</p>
      <div className="comfort-grid">
        <label className="comfort-row">
          <span><strong>Quiet expression</strong><small>Less artwork, sentiment, and ornament. Same world, same meaning.</small></span>
          <input id="comfort-quiet" type="checkbox" role="switch" checked={comfort.quiet} onChange={(event) => update({ quiet: event.target.checked })} />
        </label>
        <label className="comfort-row">
          <span><strong>Celebration</strong><small>How warmly a Win is marked. Never a score; never for routine entry.</small></span>
          <select id="comfort-celebration" value={comfort.celebration} onChange={(event) => update({ celebration: event.target.value as "full" | "soft" | "off" })}>
            <option value="full">Full — Firsts get a moment</option>
            <option value="soft">Soft — a sentence and a settle</option>
            <option value="off">Off — words only</option>
          </select>
        </label>
        <label className="comfort-row">
          <span><strong>Motion</strong><small>Reduced replaces movement with spacing and emphasis.</small></span>
          <select id="comfort-motion" value={comfort.motion} onChange={(event) => update({ motion: event.target.value as "system" | "reduced" })}>
            <option value="system">Follow this device</option>
            <option value="reduced">Reduced</option>
          </select>
        </label>
        <label className="comfort-row">
          <span><strong>Haptics</strong><small>A light tap on a snap, an accepted selection, or a real completion.</small></span>
          <input id="comfort-haptics" type="checkbox" role="switch" checked={comfort.haptics} onChange={(event) => update({ haptics: event.target.checked })} />
        </label>
        <label className="comfort-row">
          <span><strong>Sound</strong><small>Rare and quiet. Off by default.</small></span>
          <input id="comfort-sound" type="checkbox" role="switch" checked={comfort.sound} onChange={(event) => update({ sound: event.target.checked })} />
        </label>
      </div>
      <p className="muted">Coaching pace for Hercules is set in the Plan, because it is saved privately for you in the household.</p>
    </section>
  );
}
