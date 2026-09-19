import SwiftUI
import WidgetKit

private struct SculptureEntry: TimelineEntry { let date: Date; let image: UIImage? }
private struct SculptureProvider: TimelineProvider {
    func placeholder(in context: Context) -> SculptureEntry { SculptureEntry(date: Date(), image: nil) }
    func getSnapshot(in context: Context, completion: @escaping (SculptureEntry) -> Void) { completion(context.isPreview ? placeholder(in: context) : read()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SculptureEntry>) -> Void) { completion(Timeline(entries: [read()], policy: .after(Date().addingTimeInterval(900)))) }
    private func read() -> SculptureEntry {
        var image: UIImage?
        if let group = Bundle.main.object(forInfoDictionaryKey: "HearthsideWidgetAppGroup") as? String,
           let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group),
           let data = try? Data(contentsOf: root.appendingPathComponent("hearth-widget.json")), data.count <= 710000,
           let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let encoded = manifest["png"] as? String,
           let pixels = Data(base64Encoded: encoded) { image = UIImage(data: pixels) }
        return SculptureEntry(date: Date(), image: image)
    }
}
private struct SculptureView: View {
    var entry: SculptureEntry
    var content: some View {
        Group { if let image = entry.image { Image(uiImage: image).resizable().scaledToFit().padding(12).accessibilityLabel("Your chosen Hearth sculpture") }
          else { VStack { Image(systemName: "house.fill").font(.largeTitle); Text("Hearth").font(.headline) }.foregroundStyle(Color(red: 0.25, green: 0.20, blue: 0.16)).accessibilityLabel("Hearth. Open the app to choose a sculpture.") } }
        .widgetURL(URL(string: "hearthside://open/widget"))
    }
    var body: some View { if #available(iOSApplicationExtension 17.0, *) { content.containerBackground(Color(red: 0.98, green: 0.95, blue: 0.89), for: .widget) } else { content.frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(red: 0.98, green: 0.95, blue: 0.89)) } }
}
@main struct HearthSculptureWidget: Widget {
    var body: some WidgetConfiguration { StaticConfiguration(kind: "HearthSculpture", provider: SculptureProvider()) { SculptureView(entry: $0) }.configurationDisplayName("Hearth sculpture").description("An image you deliberately keep close. No balance or household label.").supportedFamilies([.systemSmall]) }
}
