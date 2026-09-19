import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { newKittyPiece } from '../../src/core/kittyStudio.ts';
import { DesignExportSurface } from '../../src/hearthside/DesignExportSurface.tsx';
import { NativeSceneSurface, type NativeFundingIntent, type NativeReceiptUpdate } from '../../src/hearthside/NativeSceneSurface.tsx';
import type { DesignSurfaceSelection, DesignSurfaceTheme } from '../../src/hearthside/designSurfaceContracts.ts';
import type { NativeBacking, NativeEvent, NativePlugin, NativeScene } from '../../src/hearthside/native.ts';

type ProofState = { surface: 'export' | 'native' | null; theme: DesignSurfaceTheme; enabled: boolean; householdId: string; revision: number; native: boolean; backing: NativeBacking; receipt?: NativeReceiptUpdate };
type Proof = { patch: (patch: Partial<ProofState>) => void; emit: (kind: NativeEvent['kind'], overrides?: Partial<NativeEvent>) => void; intents: NativeFundingIntent[]; opened: { sessionId: string; scene: NativeScene }[]; updates: unknown[]; closed: string[]; resumed: string[]; urls: string[]; revoked: string[]; listeners: Set<(event: NativeEvent) => void>; removeCount: number; denyCamera: boolean };
declare global { interface Window { hearthsideSurfaceProof: Proof } }
const proof: Proof = { patch: () => {}, emit: () => {}, intents: [], opened: [], updates: [], closed: [], resumed: [], urls: [], revoked: [], listeners: new Set(), removeCount: 0, denyCamera: false }; window.hearthsideSurfaceProof = proof;
const noop = async () => {};
const plugin: NativePlugin = {
  available: async () => ({ supported: true, platform: 'synthetic-ios-contract' }),
  presentAR: async input => { proof.opened.push(input); if (proof.denyCamera) throw Error('CAMERA_DENIED'); },
  resumeAR: async input => { proof.resumed.push(input.sessionId); },
  closeAR: async input => { proof.closed.push(input.sessionId); },
  updateAccepted: async input => { proof.updates.push(input); },
  addListener: async (_name, listener) => { proof.listeners.add(listener); return { remove: async () => { proof.listeners.delete(listener); ++proof.removeCount; } }; },
  authenticate: async () => { throw Error('No authentication in this synthetic surface proof'); }, consumeAuthCallback: async () => ({ callbackUrl: null }), cancelAuthentication: noop,
  secureGet: async () => ({ value: null }), secureSet: noop, secureRemove: noop,
};
proof.emit = (kind, overrides = {}) => { const opened = proof.opened.at(-1); if (!opened) throw Error('No synthetic AR scene'); for (const listener of proof.listeners) listener({ version: 1, kind, sessionId: opened.sessionId, identity: opened.scene.identity, eventId: crypto.randomUUID(), ...overrides }); };
const createURL = (blob: Blob) => { const url = URL.createObjectURL(blob); proof.urls.push(url); return url; }, revokeURL = (url: string) => { proof.revoked.push(url); URL.revokeObjectURL(url); };
function Fixture() {
  const [state, setState] = useState<ProofState>({ surface: null, theme: 'classic', enabled: true, householdId: 'synthetic-house', revision: 12, native: false, backing: { status: 'unavailable' } });
  proof.patch = patch => setState(previous => ({ ...previous, ...patch }));
  const piece = newKittyPiece('synthetic-cat', '2026-09-12T12:00:00Z'); piece.firedAt = '2026-09-12T12:00:00Z';
  piece.paint.strokes.push({ part: 'body', tool: 'brush', color: '#ee7868', size: 36, opacity: 1, mirror: true, pts: [.35, .5, .5, .6, .65, .5] });
  const selection: DesignSurfaceSelection = { identity: { environment: 'development', householdId: state.householdId, memberId: 'synthetic-member', designId: 'synthetic-design', pieceId: piece.id, revision: state.revision }, piece };
  return <main><nav aria-label="Synthetic surface proof"><button onClick={() => proof.patch({ surface: 'export' })}>Open export</button><button onClick={() => proof.patch({ surface: 'native' })}>Open AR</button><span>Local synthetic proof · no household connection</span></nav>
    {state.surface === 'export' && <DesignExportSurface enabled={state.enabled} selection={selection} theme={state.theme} onClose={() => proof.patch({ surface: null })} dependencies={{ createURL, revokeURL }}/>}
    {state.surface === 'native' && <NativeSceneSurface enabled={state.enabled} selection={selection} theme={state.theme} backing={state.backing} returnPath="/hearthside/studio/synthetic-cat" acceptedReceipt={state.receipt} onFundingIntent={intent => { proof.intents.push(intent); }} onClose={() => proof.patch({ surface: null })} dependencies={{ plugin: () => state.native ? plugin : null, createURL, revokeURL }}/>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture/></StrictMode>);
