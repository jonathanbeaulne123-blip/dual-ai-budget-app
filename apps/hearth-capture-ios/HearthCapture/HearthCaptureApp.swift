import SwiftUI

@main
struct HearthCaptureApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Share to Hearth",
                systemImage: "square.and.arrow.down",
                description: Text("Use Share from 7shifts, Photos, Files, Calendar, or Mail. Every item is selected explicitly and remains Development-only until its release gate.")
            )
            .navigationTitle("Hearth Capture")
        }
    }
}
