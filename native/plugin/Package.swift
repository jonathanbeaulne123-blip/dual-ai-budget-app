// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "HearthHearthsideNative", platforms: [.iOS(.v15)],
    products: [.library(name: "HearthHearthsideNative", targets: ["HearthsideNative"])],
    dependencies: [.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.2")],
    targets: [.target(name: "HearthsideNative", dependencies: [.product(name: "Capacitor", package: "capacitor-swift-pm"), .product(name: "Cordova", package: "capacitor-swift-pm")], path: "ios/Sources/HearthsideNative"), .testTarget(name: "HearthsideNativeTests", dependencies: ["HearthsideNative"], path: "ios/Tests")]
)
