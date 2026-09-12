# Hearthside native companions

Local P13 implementation candidate, based on `429db8ef0447dac6347e89e945dd04aad05e84fb`. The React application remains the product UI and financial authority. The native module owns camera placement, rendering, local interaction, the system-browser sign-in return, and secure session storage. No native method posts money or uploads camera images or spatial maps.

## Build and integrate

The native workspace is separate so its lockfile and platform dependencies do not change the web application's dependency graph. From `native`, install the pinned dependencies with `pnpm install --frozen-lockfile`. Build the actual shared React app in the repository root, then run `pnpm prepare:platforms` and `pnpm sync`. The preparation script refuses to substitute a placeholder web app. Generated public web assets are ignored by Git.

Required toolchain: Node 22+, Xcode 26+ with the iOS SDK, JDK 21+, Android SDK 36 and Android Studio Otter or newer. These follow the [Capacitor 8 upgrade requirements](https://capacitorjs.com/docs/updating/8-0).

For root integration, add `@capacitor/core@8.5.2` to the React package, then register the bridge:

```ts
import { registerPlugin } from '@capacitor/core';
import { HearthsideNativeController, type NativePlugin } from './hearthside/native';
const bridge = registerPlugin<NativePlugin>('HearthsideNative');
const controller = new HearthsideNativeController(bridge, openExistingFundingReview);
```

The native shell embeds `@hearth/hearthside-native` automatically through its own workspace package. The public native API is `src/hearthside/native.ts`; no root package, lockfile, App, Worker, or financial command was modified by this package.

The root integrator must supply:

- The same immutable design revision's authored-metre triangle meshes, normals, UVs and PNG textures, plus self-contained GLB bytes. Root export/render generation is the producer; both native adapters consume these selected-revision assets. Exclude scene poses, squash and financial geometry scale. This package does not infer mesh data from a bank balance.
- Exact lowercase environment, household, member, design, piece and revision identities, and the internal Hearthside return route.
- The existing funding review opener. A native coin button emits one `funding-intent`; it contains no amount and has no command dispatch. The review retains the existing editable review and Final Confirm. Pass only recovered accepted receipts to `controller.accepted`; target changes, earmarks, releases and reversals do not receive contribution feedback. `controller.resume` returns to the retained local placement after review or cancellation.
- The canonical readable/unavailable backing projection. Unavailable is a separate state, not a zero balance. Geometry bytes remain unchanged by presentation scale.
- `controller.leaveScope` on household/member/environment changes and `dispose` on teardown. Both platforms cancel pending camera openings by session identity, so a late permission callback cannot show the previous household.
- Native-aware HTTPS service origins for existing relative API routes and the corresponding reviewed Worker origin allowlist. The Capacitor web origin is local (`capacitor://localhost` on iOS; `https://localhost` on Android). Those hosted origin/activation changes are outside this source package and are required before authenticated continuity can pass.

## Authentication

The application uses a custom Supabase session store, not an SDK. The current integration is documented in [NATIVE_AUTH.md](../docs/hearthside/NATIVE_AUTH.md). `hydrateNativeAuthentication()` installs a fail-closed synchronous memory projection before mounting **any** entry (including the Street), then loads versioned environment records from Keychain/Keystore. Saves, refreshes, sign-out and account switches await durable secure writes. The web store retains its synchronous side effects and compatible call contract.

`NativeAuthController` owns the actual Supabase PKCE verifier and S256 challenge, nonce, issuer/environment, local return path, callback, exchanged session and cancellation tombstone. Native callbacks are peeked and acknowledged only after session durability. Cold/background recovery is supported; a lost response from a consumed one-time code may require fresh sign-in and never claims success. The older `beginNativePkce` / `recoverNativePkce` helpers are not used by the application and must not be wired as its Auth path.

Native session and provider credentials never use localStorage. Old native-origin plaintext Auth/direct-Google token keys are removed at startup. Separately gated direct Google-suite credentials use a non-persistent memory store in native builds; enabling those connectors requires their own native provider review. This package makes no provider calls or hosted redirect changes during implementation.

The plugin advertises `authStorageVersion: 2` independently of AR hardware support. Older binaries fail the secure startup check. System sign-in uses ASWebAuthenticationSession on iOS and Custom Tabs on Android. Neither path uploads camera data or chooses a household.

## Interactive AR implementation

iOS builds textured RealityKit `MeshResource` objects through [MeshDescriptor](https://developer.apple.com/documentation/realitykit/meshdescriptor). It does not attempt to load GLB in RealityKit. Real ARKit raycasts place an anchor on detected surfaces; taps and two-finger rotation interact with the selected cat. Accessible rotate/return/review controls are also available. Session interruption, tracking loss, camera denial, background/resume and explicit release are handled in the controller.

Android uses ARCore with Filament through the pinned [SceneView 2.3.0 source API](https://github.com/sceneview/sceneview/tree/v2.3.0). `ARSceneView`, `AnchorNode`, and `ModelNode` provide the camera feed, tracked anchoring and Filament GLB scene. Cloud anchors and geospatial mode are disabled. Taps reposition on tracked planes; two-finger movement and accessible rotation buttons turn the cat. A separate local lifecycle pauses the camera while the ordinary React review is visible, and releases AR/Filament resources on close. The narrower 2.3.0 imperative API was checked from source; current SceneView 4.x changes the API/build-tool requirements. Its native ABI/16-KiB-page compatibility must be checked in the Android build/device gate before release. This source pin is not a claim of distribution readiness.

Both platforms retain receipt identities to avoid repeated feedback. Pending, rejected or uncertain money actions must never be passed as accepted updates. Native events do not carry camera frames, coordinates, scans, tokens or balances.

## Evidence and open gates

Local evidence is recorded in the package handoff. The JavaScript contract suite covers valid mesh bounds, malformed/native scope rejection, contribution intent versus accepted state, receipt deduplication, stale callbacks, unsupported-device and camera-denial responses, secure-storage failure, PKCE state, and expired recovery. Swift XCTest and Android instrumentation sources are included for platform execution.

This machine has Node 24.19.0 and Apple command-line Swift 6.0.3, but no Xcode/iPhone SDK, Java 8 only, and no Android SDK. `node scripts/doctor.mjs` reports those prerequisites explicitly. Swift syntax parsing can run with `-frontend -parse -parse-stdlib`; normal Swift invocation encounters the installed command-line toolchain's duplicate `SwiftBridging` module map. Syntax parsing is not iOS compilation. No Xcode, Android instrumented, signed, distributed or physical-device result is claimed.

Capacitor generated both real platform projects and recognizes the native plugin on both platforms. Android plugin dependency metadata is generated; iOS SPM resolves the local plugin product. Full `cap sync` remains dependent on the actual shared React `dist` build. Native launcher and splash assets now derive reproducibly from the existing public/hercules-mark.svg Hearth artwork. Run `node native/scripts/prepare-brand-assets.mjs` from the repository root to regenerate them. The source SVGs and dimensions are recorded in `native/assets`; physical launcher/crop/launch appearance remains part of device acceptance.

Before closing P13, run the completed shared-app journeys through native origin/auth configuration, exact review and receipt recovery, background/process death, account switching, camera denial, tracking loss, unsupported phones, accessibility and reduced motion. Validate physical iPhone and Android hardware, frame rates and resource retention. Then perform native signing/distribution review separately. Android widget source is included; optional iOS WidgetKit extension source and XcodeGen target settings are included under `widgets/ios`. Widget publishing stays explicit and unavailable until its host configuration exists. See the native Auth handoff for the remaining integration and physical-device gates.

Budget delta: native play can propose a funding intention while the existing review and receipt boundary remain authoritative. Engagement delta: couples can interact with the same authored cat on a real surface and return to their shared room. Risk: High implementation, Release for hosted/native activation. Codex owns integration and the remaining program gates.


### Private browser placement

The selected accepted GLB also opens in a lazily loaded browser viewer. Quick Look can generate its USDZ on the device, and supported Android browsers can use WebXR while retaining the model in the browser. External Scene Viewer fetches a model URL again; it is excluded from this private Blob source. No public asset or bearer URL is created. The component empties its model cache on surface removal, and the source URL is revoked on scope change. The viewer package owns its supported Three0.183.2 dependency; the Studio stays on its existing Three0.185.1 engine with the immutable GLB as their boundary. See [Google's browser AR documentation](https://modelviewer.dev/examples/augmentedreality/) and [material continuity across AR modes](https://modelviewer.dev/examples/scenegraph/).

Local Chromium proof loads and rotates the actual authored textured GLB, confirms private Blob input and the selected viewer modes, and verifies model URL revocation when the activation flag closes. Browser UI proof does not certify Quick Look/WebXR on physical phones or replace the native interactive-scene requirement.
