import AppIntents

struct OpenHearthCaptureIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture in Hearth"
    static var description = IntentDescription("Opens Hearth Capture for an item you explicitly choose.")
    static var openAppWhenRun = true
    func perform() async throws -> some IntentResult { .result() }
}

struct HearthCaptureShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: OpenHearthCaptureIntent(), phrases: ["Capture in ${applicationName}"], shortTitle: "Capture evidence", systemImageName: "doc.badge.plus")
    }
}
