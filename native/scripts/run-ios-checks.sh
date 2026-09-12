#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${HEARTH_XCODEGEN:?Set HEARTH_XCODEGEN to the verified XcodeGen 2.44.1 binary.}"
xcodebuild -version
xcrun --sdk iphonesimulator --show-sdk-version
node scripts/check-packaged-web.mjs ios
"$HEARTH_XCODEGEN" generate --spec ci/project.yml
mkdir -p ci/HearthsideNativeChecks.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
cp ci/Package.resolved ci/HearthsideNativeChecks.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
hearth_simulator=$(node scripts/select-ios-simulator.mjs)
xcrun simctl boot "$hearth_simulator" || xcrun simctl bootstatus "$hearth_simulator" -b
xcrun simctl bootstatus "$hearth_simulator" -b
xcodebuild build -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "platform=iOS Simulator,id=$hearth_simulator" -derivedDataPath ci/DerivedData/App \
  -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
xcodebuild test -project ci/HearthsideNativeChecks.xcodeproj -scheme HearthsideNativeChecks \
  -destination "platform=iOS Simulator,id=$hearth_simulator" -derivedDataPath ci/DerivedData/Tests \
  -parallel-testing-enabled NO -disableAutomaticPackageResolution \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
# Compile the optional source without an app group, embedding, provisioning, or distribution.
"$HEARTH_XCODEGEN" generate --spec ci/widget.yml
xcodebuild build -project ci/HearthSculptureWidget.xcodeproj -scheme HearthSculptureWidget \
  -destination "platform=iOS Simulator,id=$hearth_simulator" -derivedDataPath ci/DerivedData/Widget \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
