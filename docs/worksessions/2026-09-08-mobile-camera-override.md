# Mobile C9 — flagged photo override

LOCALLY VERIFIED on codex/mobile-c9-camera-override, exact base67985a04d6d96a178ecb7efb1cb4838f0da0e475(C8,PR399). Medium-High; Budget(5)+1; Engagement(3)+2. One writer root.

Preserve Claude's camera review: all image-quality issues, two explicit rejected Capture attempts before Capture anyway, immutable issue metadata into existing scan review on both hosts. Passive frames and permission failures never unlock override. Choose-photo retains a corresponding explicit override after two rejected files. Missing OCR fields remain missing. Scope/capture lifetime checks, track cleanup, focus/Escape and original5px/3px/44px paper grammar.


## Implementation, review and proof

Capture counts only fresh-score refusals following user taps. All quality issues accompany an explicit override; failed scans display those warnings in the existing scan area without an old camera draft. Successful scans retain all warnings in the existing draft review, including those beyond four. Neither override nor photo scoring supplies monetary facts. Both hosts retire prior camera attribution on a new scan, and view/auth changes retire their source lifetime. Choosing camera invalidates unfinished file scoring.

Camera is a body portal and only the top registered dialog owns keyboard handling. Escape closes the camera and restores Add's focus; background becomes inert. Encoding/startup completion after closure is discarded and tracks stop. Five camera lifecycle cases plus three file/error-area cases pass; existing parsing/scan-scope/modal regressions also pass. Eighteen focused cases3.68s plus three photo cases1.59s, `/tmp/c9-focused2.log`, `/tmp/c9-photo1.log`.

Seven browser cases with Chromium's synthetic camera (no physical camera) pass at320/390/720/1100 plus200%bodyzoom, Escape and nested parent dialog. Two rejected attempts are required; capture metadata contains all actual synthetic-frame issues; no ledger writer exists in the fixture. `/tmp/hearth-mobile-c9-evidence`, `/tmp/c9-browser4.log`. Enlarged modal clipping was reproduced and repaired with bounded viewport scrolling. This is shared Add-dialog behavior, not an authenticated full-App camera run.

Independent UX/verifier clear after fixing nested traps/background, file→camera race, stale-draft warning attribution and failed-scan warning visibility. Final Medium-High quick gate127 selected tests plus TypeScript/AI/diff passed110.096s; fingerprint34d03e24af4648002d5f5e15382010cebdd22f498f7c59ec0155c88b601553ae, no five-minute breach. Exact command `/tmp/c9-gate1.log` uses base67985a0 and focus document-camera-override,shift-photo-quality-ui,shift-scan-scope,shift-report-draft,claude-ux-dialog,confirm-danger-ui,app-startup-p1,month-rehearsal-mainline.

Local fictional/synthetic proof with mocked camera/transport/OCR fixtures; no physical-device, hosted OCR, exhaustive, merge/deploy/schema/Production claim. HEAD is this commit; stacked draft PR then C10.
