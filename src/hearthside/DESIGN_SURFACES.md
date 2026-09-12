# Selected design production and AR surfaces

These are local, user-facing P13/P14 surfaces. The caller owns authenticated
household selection, design authority, the existing financial review, flags and
the focused-tool return route. Neither surface posts financial or creative writes.

## Connect the Studio

```tsx
import { snapshotKittyDesignRevision } from './design.ts';
import { DesignExportSurface } from './DesignExportSurface.tsx';
import { NativeSceneSurface } from './NativeSceneSurface.tsx';

// document is the accepted document loaded for the currently authenticated scope.
// requestedRevision is the deliberate historical/fired/current revision selected
// by the member, never a backing revision or optimistic preview.
const snapshot = snapshotKittyDesignRevision(document, pieceId, requestedRevision);
const selection = {
  identity: { environment, householdId, memberId, designId: document.id,
    pieceId, revision: requestedRevision },
  piece: snapshot.piece,
};

<DesignExportSurface enabled={flags.exports} selection={selection} theme={theme}
  onClose={returnToOriginatingStudioObject} />

<NativeSceneSurface enabled={flags.nativeAR} selection={selection} theme={theme}
  backing={canonicalBacking} returnPath={resolvedObjectPath}
  onFundingIntent={openExistingExactContributionReview}
  acceptedReceipt={recoveredCanonicalReceipt}
  onClose={returnToOriginatingStudioObject} />
```

`DesignSurfaceSelection` and `DesignSurfaceTheme` are exported by
`designSurfaceContracts.ts`. Themes are `classic`, `taylor`, `newfoundland`.
The identity uses lowercase `development` / `production`. Resolve membership and
document scope before rendering; receiving a piece object is not authorization.
Root's export normalizer must include its explicit legacy-revision-zero patch.
This branch inherits the earlier export toolkit, whose selection validator still
requires revision one or later; the surface itself preserves the exact revision.

Keying includes household, environment, member, design, piece and exact revision.
A scope/revision change unmounts the old session, cancels workers and compression,
revokes local download URLs, and closes the native scene. Theme changes retain
the current export choices and exact review. Disable flags cancel their activity;
native re-enablement creates a fresh controller, including in React StrictMode.
The caller's `onClose` restores its stable room route and originating object focus.
The surface also restores its directly focused opener where it still exists.
Its host retains the actual app's Fund pull-tab, navigation and keyboard clearance.

## Production files

`DesignExportJob` is an injectable, independently tested session used by
`DesignExportSurface`. Capture uses the actual authored Kitty sculpture and its
paint canvases. A dedicated `exportWorker.ts` prepares geometry and an exact
repair proposal. The original design and financial projection are never changed.
Height is chosen in millimetres, independently of money and display animation.
Solid source copies remain available despite honest geometry limitations.
Manufacturing derivatives require approval of the exact repair digest; hollow
construction also requires that approval and explicit opening dimensions.

Each worker stage has a 120-second deadline. Cancel, scope departure or changing
dimensions terminates the job. Cancel also terminates asynchronous ZIP compression.
Prepared selections must match the captured selection. Completions must match the
selected revision, dimensions, construction, source digest and approved repair;
every file is checked against its SHA-256 entry, and the embedded manifest must
match the reviewed manifest. Duplicate completion replies produce one package.
Only the resulting explicit download link initiates a user download.

The ZIP contains STL, textured 3MF, textured GLB, source design and paint references,
embedded paint PNGs, a geometry report, PDF geometry sheet and immutable manifest.
A repaired copy also includes the unchanged authored GLB. Review and completion
show open edges, separate parts, self-intersection coverage, sampled wall thickness
and unverified maker tolerances. No output is represented as certified printer-ready.

## Native review continuity

`nativeBridge.ts` registers the actual Capacitor `HearthsideNative` plugin only on
a native host that exposes it. `nativeSceneFromDesign` captures the same immutable
authored geometry at 160 mm, groups compatible material meshes, computes normals,
preserves UVs/paint PNGs, and produces the self-contained GLB used by Android.
iOS receives the corresponding metre mesh and texture payload for RealityKit.
No camera or scan input is uploaded. Canonical accepted backing may separately
control native presentation scale; it never changes the authored mesh or export.
Unavailable backing remains its distinct state and does not become step zero.

Keep `NativeSceneSurface` mounted while the existing financial review overlays it
if the user should resume the same local AR placement. Its `onFundingIntent` only
opens that review. The callback receives `{id, identity, returnPath}`; route to the
existing exact review / Final Confirm flow with that return context. Do not turn
the event into a money command. Supply `acceptedReceipt` only after authoritative
acceptance/recovery, with the selected scene identity, stable receipt ID, canonical
backing, operation kind and `status: 'accepted'`. Target changes/earmarks/reversals
do not perform contribution theatre. Duplicate accepted receipts are suppressed
by the existing native controller.

The inherited `native.ts` return-path validator currently permits a strict
`/hearthside/...` path without query parameters. Root's stable routes can contain
`household`, `room`, `mode`, `design`, `from`, `focus`; validate and support those
explicitly in the native contract before passing such a route. Do not silently
strip a household scope query or weaken the check to arbitrary URLs. Until that
follow-up, pass an already scoped object path accepted by that contract.

On ordinary browsers and unsupported devices the surface provides the same
illustrated selected design and an explicit GLB download, labelled as a model
file. It never claims that a downloaded model is an interactive native AR scene.

## Evidence and remaining gates

`hearthside-design-surfaces.test.ts` exercises revision/dimension privacy, exact
repair approval, cancellation, changed source replies, checksum/manifest/path
corruption, duplicate completions, deadlines and canonical native capture parity.
`hearthside-design-surfaces-browser.test.ts` runs the real React surfaces under
StrictMode, actual authored capture, the actual Worker and explicit ZIP download,
all three themes at 320/390/719/720/1100/1440/1920 px, enlarged text, dark controls,
focus return, scope cancellation, browser fallback, and actual native controller
state transitions using a clearly synthetic native plugin. Its proof fixture
contains no authenticated household connection or real financial command.

Local screenshots are written under `$HEARTH_ARTIFACTS_DIR`, falling back to
`/tmp/hearthside-surfaces-proof`. Those are isolated component proofs. Full Studio
navigation, authenticated cross-device continuity, app-chrome clearance, cold
capture frame budget, native compilation/instrumented suites, physical iPhone /
Android acceptance, material/texture parity on hardware, signing, distribution,
and Development/Production activation remain separate integration/release gates.

No dependency changes beyond the already integrated export and native packages
are needed. Add both focused surface suites to the root risk/focus map alongside
the existing export/native suites when integrating these new files.
