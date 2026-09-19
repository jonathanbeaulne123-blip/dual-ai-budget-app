# Unsigned native build and test lane

This lane packages the actual root React build, then compiles the real Capacitor apps and native plugin. It does not activate an auth redirect, hosted service, AR rollout flag, signing team, app group, calendar/provider integration, upload, distribution, or Production release. Only pull requests matching native/shared app inputs trigger the checked-in workflow; no workflow was dispatched during implementation.

## What runs

The iOS job uses `macos-15`, explicitly selects `/Applications/Xcode_26.3.app`, and verifies XcodeGen 2.44.1 against its published SHA-256. It builds the checked-in `App.xcodeproj` through the explicit shared `App` scheme with signing disabled. The generated `HearthsideNativeChecks` framework compiles the **production plugin source directory** and executes every XCTest in `plugin/ios/Tests`. The tests currently cover accepted receipt isolation/idempotency, unavailable backing, scoped/nested returns and rejected geometry. A separate unsigned target compiles the actual optional WidgetKit source without embedding it or configuring an app group.

The Android job uses Ubuntu 24.04, Temurin 21.0.8+9, compile SDK 36, build tools 35.0.0, and the checksum-verified Gradle 8.14.3 wrapper. It assembles the unsigned release app plus debug test applications. API 36 instrumentation executes the existing plugin Keystore/identity/widget suites and a new actual `MainActivity` test that requires plugin registration and the packaged React root to mount after secure hydration. Test APKs necessarily use Android's disposable debug signing; no release key is configured. Emulator cameras are disabled. These checks do not claim plane placement, physical AR tracking, system-browser account continuity or real-device performance.

Both jobs run root `pnpm install --frozen-lockfile` and `pnpm build`, including root workspace packages such as `@hearth/browser-ar`, then separately install the native workspace with its frozen lock. Native assets retain `prepare:assets` and the existing authored Hercules mark. `prepare:platforms` performs normal Capacitor sync. `check-packaged-web.mjs` verifies every built source asset byte in its native copy and prints an aggregate SHA-256; missing, stale or unreviewed extra files fail before native compilation. The simulator selector fails when no usable iOS 26+ iPhone exists; it never silently skips tests.

The workflow uses commit-pinned actions with read-only repository permission, no persisted checkout credentials, no dependency-submission action, no uploaded artifacts and no release command. Native npm and Swift dependencies are frozen; the exact Swift revision is checked in for app and test projects. Android direct dependency versions are pinned, including SceneView 2.3.0, ARCore 1.48.0 and Filament 1.56.0 through SceneView's published metadata. A complete transitive Gradle lock/verification metadata set still needs a successful SDK resolution/build; it is not invented from an unrun dependency graph.

## Local commands

After installing the declared SDKs and building the current root app:

```sh
cd native
pnpm install --frozen-lockfile
pnpm prepare:assets
pnpm prepare:platforms
node --test ci/verification.test.mjs
node scripts/check-packaged-web.mjs ios
node scripts/check-packaged-web.mjs android
HEARTH_XCODEGEN=/absolute/path/to/verified/xcodegen bash scripts/run-ios-checks.sh
cd android
./gradlew --no-daemon --max-workers=2 :app:assembleRelease :app:assembleDebugAndroidTest :hearth-hearthside-native:assembleDebugAndroidTest
./gradlew --no-daemon --max-workers=2 :app:connectedDebugAndroidTest :hearth-hearthside-native:connectedDebugAndroidTest
```

The connected tasks require an already running API 36 emulator or selected test device. The workflow supplies the emulator; local commands never provision, email or invite anyone.

## Implementation evidence and limits

On the local implementation source: eight Node boundary tests passed (under 150 ms); both XcodeGen projects generated with the checksum-verified 2.44.1 binary; generated PBX projects, workflow/project YAML, plist/XML/schemes and shell syntax validated; all current Swift app/plugin/widget/test sources parsed. Native frozen install completed using the host pnpm 11.19.0 (the workflow explicitly selects the repository's 10.14.0); lock contents did not change. Direct AndroidX coordinates were verified in Google's Maven repository. Actual plugin Android source API usage was inspected against SceneView's 2.3.0 tag and installed Capacitor 8.5.2 sources.

Concrete corrections: one Android application element now contains both AR metadata and the widget receiver; direct Activity/Lifecycle imports and the ActivityScenario test have explicit compile dependencies; a stable shared app scheme points to its actual PBX native target; Gradle and Swift downloads have fixed checksums/revisions.

The local doctor still reports Node 24.19.0 available, Xcode/iPhone SDK absent, Java 8 only and Android SDK absent. **No Xcode build, XCTest execution, Android compile/instrumentation, CI run, physical device, signing/distribution, or Production acceptance is claimed.** The final root frozen React build→native-copy digest proof remains pending parent integration; synthetic packaging tests are not that proof. Native AR resource/performance and Android 16 KiB shared-library/device compatibility remain open acceptance gates. Missing SDKs are never converted into successful test results.

Budget delta: native compilation and startup tests exercise the existing authenticated app without another money writer. Engagement delta: the actual room/Studio companion and optional sculpture source are compiled, preserving local startup without camera access.

## Verified primary references

- [Capacitor 8 toolchain migration](https://capacitorjs.com/docs/updating/8-0)
- [GitHub macOS 15 installed Xcode versions](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md)
- [Apple xcodebuild testing](https://developer.apple.com/library/archive/technotes/tn2339/_index.html)
- [XcodeGen 2.44.1 release](https://github.com/yonaskolb/XcodeGen/releases/tag/2.44.1)
- [Android Gradle plugin 8.13 compatibility](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
- [Emulator action configuration](https://github.com/ReactiveCircus/android-emulator-runner/tree/v2.35.0)
- [SceneView 2.3.0 Android dependencies](https://github.com/SceneView/sceneview-android/blob/v2.3.0/sceneview/build.gradle)
- [Capacitor 8.5.2 Swift checksums](https://github.com/ionic-team/capacitor-swift-pm/blob/8.5.2/Package.swift)

## Root integration

Cherry-pick this commit's new files, then apply `native/ci/native-build-integration.patch` to the current native baseline. The patch changes only four existing Android config files; it excludes all root-owned brand assets, package scripts, AR backing/funding/return changes and application code. Native root `package.json` must retain `prepare:assets`. No root package/lock/App/main edits are part of this handoff. Run `node --test native/ci/verification.test.mjs` for its dedicated changed-state suite; the native SDK job itself is not a replacement for the application High gate.
