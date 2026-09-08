import { useEffect, type CSSProperties } from "react";
import { SceneArtwork } from "./SceneArtwork.tsx";
import { resolveThemeScene, sceneTokens, type ThemeId, THEMES } from "./scenes.ts";
import { useAppearance } from "./ThemeProvider.tsx";

export function AtmosphereControl() {
  const { store, saved } = useAppearance();
  return <button className="theme-atmosphere-toggle ghost" type="button" aria-pressed={!saved.atmosphere}
    onClick={() => store?.setAtmosphere(!saved.atmosphere)}>
    <span aria-hidden="true">{saved.atmosphere ? "◌" : "◦"}</span> {saved.atmosphere ? "Pause atmosphere" : "Resume atmosphere"}
  </button>;
}
function ThemeCardScene({ theme, personal }: { theme: ThemeId; personal: boolean }) {
  const scene = resolveThemeScene(theme, "home", personal ? "personal" : "household");
  return <span className={`appearance-miniature ${personal ? "is-personal" : "is-shared"}`} data-miniature-scene={scene.id}
    style={{ ...sceneTokens(scene), background: scene.palette.paper } as CSSProperties}>
    <SceneArtwork scene={scene} /><i /><i /><small>{personal ? "Personal" : "Shared"}</small>
  </span>;
}
export function AppearancePicker() {
  const { store, saved, preview, status, message } = useAppearance();
  const selected = preview ?? saved.theme;
  useEffect(() => () => store?.cancelPreview(), [store]);
  return <section className="appearance-panel card" aria-labelledby="appearance-heading">
    <header><div><p className="appearance-eyebrow">Make yourself at home</p><h2 id="appearance-heading">Appearance</h2></div><AtmosphereControl /></header>
    <p className="muted">Choose a world for your Shared and Personal pages. Your choice follows your account.</p>
    <div className="appearance-options" role="group" aria-label="Theme preview">
      {THEMES.map(theme => <button key={theme.id} type="button" className="appearance-option" data-preview-theme={theme.id}
        data-preview-pending={preview === theme.id || undefined} aria-pressed={selected === theme.id} onClick={() => store?.preview(theme.id)}>
        <span className="appearance-miniatures" aria-hidden="true"><ThemeCardScene theme={theme.id} personal={false} /><ThemeCardScene theme={theme.id} personal /></span>
        <span className="appearance-option-name">{theme.name}</span><span className="appearance-option-description">{theme.description}</span>
      </button>)}
    </div>
    <div className="appearance-actions">
      <button className="primary" type="button" aria-disabled={preview === null} onClick={() => { if (preview !== null) store?.apply(selected); }}>Use theme</button>
      {preview !== null && <button className="ghost" type="button" onClick={() => store?.cancelPreview()}>Cancel preview</button>}
      {status === "error" && <button className="ghost" type="button" onClick={() => void store?.refresh()}>Retry account save</button>}
    </div>
    <p className="appearance-status muted" data-status={status} role="status">{preview !== null ? "Previewing this look. Use theme to keep it." : message || (status === "pending" ? "Saved on this device. Waiting to save to your account." : status === "loading" ? "Checking your account’s appearance…" : status === "local" ? "Saved on this device. Sign in to carry your look across devices." : "Appearance saved to your account.")}</p>
  </section>;
}
