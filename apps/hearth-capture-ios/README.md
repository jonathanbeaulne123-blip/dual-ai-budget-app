# Hearth Capture for iPhone

Local Development scaffold for a SwiftUI app, Share Extension, and App Intent. It accepts one user-selected item at a time, uses security-scoped file access, short-lived account-bound upload capabilities, nonce replay checks, and background `URLSession` upload. It has no Photos, Contacts, Mail, notification-reading, or broad device entitlement.

Generating the Xcode project, signing, TestFlight distribution, pairing a real account, and all hosted activation remain separate gates. Build with `xcodegen generate`, then run the `HearthCaptureTests` scheme on macOS CI.
