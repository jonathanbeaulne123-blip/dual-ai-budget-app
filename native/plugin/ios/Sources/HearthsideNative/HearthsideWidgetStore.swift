import Foundation
import UIKit
import WidgetKit

/** Only an explicitly reviewed PNG enters the app group. Keychain credentials never do. */
enum HearthsideWidgetStore {
    static var group: String? { Bundle.main.object(forInfoDictionaryKey: "HearthsideWidgetAppGroup") as? String }
    static func container() -> URL? { guard let group, !group.isEmpty else { return nil }; return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) }
    static func save(selectionId: String, scopeDigest: String, encoded: String) throws {
        guard UUID(uuidString: selectionId) != nil, scopeDigest.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              encoded.count <= 700000, let bytes = Data(base64Encoded: encoded), bytes.count <= 524288,
              bytes.starts(with: [137,80,78,71,13,10,26,10]), let source = UIImage(data: bytes), source.size.width <= 1024, source.size.height <= 1024,
              let root = container() else { throw NativeFailure.invalid }
        // Re-encode pixels: strip embedded PNG metadata and any supplied ancillary content.
        guard let image = source.pngData(), image.count <= 524288 else { throw NativeFailure.invalid }
        let manifest: [String: Any] = ["version": 1, "selectionId": selectionId, "scopeDigest": scopeDigest, "png": image.base64EncodedString()]
        try JSONSerialization.data(withJSONObject: manifest).write(to: root.appendingPathComponent("hearth-widget.json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        WidgetCenter.shared.reloadTimelines(ofKind: "HearthSculpture")
    }
    static func clear() throws {
        if let root = container() { let file = root.appendingPathComponent("hearth-widget.json"); if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) } }
        WidgetCenter.shared.reloadTimelines(ofKind: "HearthSculpture")
    }
}
