import { useEffect, useId, useRef, useState } from 'react';
import { BrowserSculpture } from './BrowserSculpture.tsx';
import { KittyFlat } from '../kitty/studio/flat.tsx';
import { HearthsideNativeController, type NativeBacking, type NativeEvent, type NativeIdentity, type NativePlugin, type NativeScene } from './native.ts';
import { hearthsideNativePlugin, nativeSceneFromDesign, NATIVE_AUTHORED_HEIGHT_MM } from './nativeBridge.ts';
import { DESIGN_SURFACE_MATERIALS, designDownloadName, designSurfaceKey, type DesignSurfaceSelection, type DesignSurfaceTheme } from './designSurfaceContracts.ts';
import './designSurfaces.css';

export type NativeFundingIntent = { id: string; identity: NativeIdentity; returnPath: string };
export type NativeReceiptUpdate = Parameters<HearthsideNativeController['accepted']>[0];
export type NativeSurfaceDependencies = { plugin: () => NativePlugin | null; scene: (selection: DesignSurfaceSelection, backing: NativeBacking, returnPath: string) => NativeScene; createURL: (blob: Blob) => string; revokeURL: (url: string) => void };
const defaults: NativeSurfaceDependencies = { plugin: hearthsideNativePlugin, scene: nativeSceneFromDesign, createURL: blob => URL.createObjectURL(blob), revokeURL: url => URL.revokeObjectURL(url) };
export type NativeSceneSurfaceProps = { enabled: boolean; selection: DesignSurfaceSelection; theme: DesignSurfaceTheme; backing: NativeBacking; returnPath: string; onFundingIntent: (intent: NativeFundingIntent) => void; fundingEnabled?:boolean; acceptedReceipt?: NativeReceiptUpdate; onClose: () => void; dependencies?: Partial<NativeSurfaceDependencies> };
export function NativeSceneSurface(props: NativeSceneSurfaceProps) { return <NativeSurface key={`${designSurfaceKey(props.selection)}:${props.enabled}`} {...props}/>; }
function NativeSurface({ enabled, selection, theme, backing, returnPath, onFundingIntent, fundingEnabled=true, acceptedReceipt, onClose, dependencies }: NativeSceneSurfaceProps) {
  const [available, setAvailable] = useState<boolean | null>(null), [phase, setPhase] = useState<'idle' | 'preparing' | 'open' | 'review' | 'background'>('idle'), [message, setMessage] = useState(''), [model, setModel] = useState<string | null>(null);
  const controller = useRef<HearthsideNativeController | null>(null), alive = useRef(false), generation = useRef(0), modelURL = useRef<string | null>(null), title = useRef<HTMLHeadingElement>(null), heading = useId();
  const callbacks = useRef({ onFundingIntent, backing, returnPath }); callbacks.current = { onFundingIntent, backing, returnPath };
  const deps = useRef<NativeSurfaceDependencies>({ ...defaults, ...dependencies }), materials = DESIGN_SURFACE_MATERIALS[theme];
  useEffect(() => {
    alive.current = true; const token = ++generation.current, opener = document.activeElement as HTMLElement | null; title.current?.focus();
    const plugin = enabled ? deps.current.plugin() : null;
    const receive = (event: NativeEvent) => {
      if (!alive.current || generation.current !== token) return;
      if (event.kind === 'closed') { setPhase('idle'); setMessage('The camera is closed. Your chosen design is still here.'); }
      if (event.kind === 'funding-intent') setPhase('review');
      if (event.kind === 'background') setPhase('background');
      if (event.kind === 'resumed') setPhase('open');
      if (event.kind === 'tracking') setMessage(event.state === 'normal' || event.state === 'tracking' ? 'Surface tracking is ready.' : 'Move the phone gently while surface tracking recovers.');
      if (event.kind === 'error') setMessage('AR paused. Return to the room and try again when the camera is ready.');
    };
    if (plugin) {
      const current = new HearthsideNativeController(plugin, intent => { if (alive.current && generation.current === token) callbacks.current.onFundingIntent(intent); }, receive); controller.current = current;
      void plugin.available().then(value => { if (alive.current && generation.current === token) { setAvailable(value.supported); if (!value.supported) setMessage('Interactive AR is not supported on this device. The selected design remains available below.'); } }).catch(() => { if (alive.current && generation.current === token) { setAvailable(false); setMessage('The companion could not check AR support. You can keep the design or try again later.'); } });
    } else setAvailable(false);
    return () => {
      alive.current = false; ++generation.current; const current = controller.current; controller.current = null; void current?.dispose().catch(() => {});
      if (modelURL.current) deps.current.revokeURL(modelURL.current); modelURL.current = null;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => { if (acceptedReceipt && enabled) void controller.current?.accepted(acceptedReceipt).catch(() => { if (alive.current) setMessage('The accepted update could not reach AR. Return to your room to recover its current state.'); }); }, [acceptedReceipt, enabled]);
  const prepare = async (native: boolean) => {
    const token = generation.current; setPhase('preparing'); setMessage('');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (!alive.current || token !== generation.current) return;
    try {
      const scene = {...deps.current.scene(selection, callbacks.current.backing, callbacks.current.returnPath),fundingEnabled};
      if (native) { if (!controller.current) throw Error('NATIVE_UNAVAILABLE'); await controller.current.open(scene); if (alive.current && token === generation.current) setPhase('open'); }
      else {
        const bytes = Uint8Array.from(atob(scene.glbBase64), c => c.charCodeAt(0));
        if (modelURL.current) deps.current.revokeURL(modelURL.current);
        modelURL.current = deps.current.createURL(new Blob([bytes.buffer], { type: 'model/gltf-binary' })); setModel(modelURL.current); setPhase('idle');
      }
    } catch (error) {
      if (!alive.current || token !== generation.current) return;
      setPhase('idle'); const detail = error instanceof Error ? error.message : '';
      setMessage(/CAMERA_DENIED|declined/i.test(detail) ? 'Camera access was declined. You can enable it in device settings or keep enjoying the room here.' : 'This design could not be opened in AR. Its selected revision remains kept in the Studio.');
    }
  };
  const close = () => { ++generation.current; void controller.current?.leaveScope().catch(() => {}); onClose(); };
  return <section className="design-surface design-native" data-design-theme={theme} aria-labelledby={heading} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <header className="design-surface-heading"><div><p className="design-eyebrow">{materials.eyebrow}</p><h2 id={heading} ref={title} tabIndex={-1}>{materials.nativeTitle}</h2><p>A familiar little piece of your shared home, wherever you are.</p></div><button type="button" onClick={close}>Back to Studio</button></header>
    <div className="design-surface-spread"><figure className="design-source-preview"><div className="design-preview-paper"><KittyFlat piece={selection.piece} step={0} title="The selected design for your room"/><span className="design-measure" aria-hidden="true">{NATIVE_AUTHORED_HEIGHT_MM} mm</span></div><figcaption>Selected design · revision {selection.identity.revision}<br/>The same authored shape and paint as your production files.</figcaption><p className="design-surface-note">{materials.footer}</p></figure>
      <div className="design-surface-work"><section className="design-ar-instructions"><h3>A place beside you</h3><ol><li>Find a clear, well-lit surface.</li><li>Tap to place your cat, then turn it with two fingers or the rotation buttons.</li><li>{fundingEnabled?'Open a contribution review from the coin control, or come straight back here.':'Turn and enjoy the piece, then come straight back here.'}</li></ol><p>Camera images and room scans stay on your device.</p></section>
        {!enabled ? <p role="status">Interactive AR is not enabled for this household yet.</p> : available === null ? <p role="status">Checking this companion’s AR support…</p> : available ? <div className="design-ar-actions">
          {phase === 'idle' && <button type="button" onClick={() => void prepare(true)}>Place this cat in my room</button>}
          {phase === 'preparing' && <p role="status">Preparing your chosen design…</p>}
          {phase === 'open' && <p role="status">Your interactive AR room is open. Use its return control to come back.</p>}
          {(phase === 'review' || phase === 'background') && <><p>The selected cat and its local placement are kept while you review.</p><button type="button" onClick={() => void controller.current?.resume().then(() => { if (alive.current) setPhase('open'); }).catch(() => { if (alive.current) { setPhase('idle'); setMessage('The camera placement ended. Place the same cat again when you are ready.'); } })}>Return to AR</button></>}
        </div> : <div className="design-browser-fallback"><h3>Your design is still right here</h3><p>The Hearth companion adds live interactions with your shared room. You can also turn this selected sculpture here and place it beside you on supported phones.</p><button type="button" disabled={phase === 'preparing'} onClick={() => void prepare(false)}>{phase === 'preparing' ? 'Preparing model…' : 'Prepare a 3D model file'}</button>{model && <><BrowserSculpture url={model} piece={selection.piece} revision={selection.identity.revision}/><a className="design-primary" href={model} download={designDownloadName(selection, 'glb')}>Download the selected GLB model</a></>}<p>A downloaded model is a model file; it does not provide Hearth’s interactive contribution review.</p></div>}
        <p className="design-backing-state">{!fundingEnabled?'This piece is here for its own sake.':backing.status === 'unavailable' ? 'Current backing is unavailable. Your artwork is still here; AR will not show it as an empty bank.' : 'A coin gesture opens your existing review. Only an accepted receipt updates backing.'}</p>
        {message && <p role="status" className="design-status">{message}</p>}
      </div>
    </div>
  </section>;
}
