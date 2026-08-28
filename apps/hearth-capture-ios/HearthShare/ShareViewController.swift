import Social
import UniformTypeIdentifiers

final class ShareViewController: SLComposeServiceViewController {
    private let allowed = [UTType.image, .pdf, .json, .commaSeparatedText, .calendarEvent, .plainText, .html, .url]

    override func isContentValid() -> Bool {
        extensionContext?.inputItems.count == 1
    }

    override func didSelectPost() {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let provider = item.attachments?.first,
              allowed.contains(where: { provider.hasItemConformingToTypeIdentifier($0.identifier) }) else {
            extensionContext?.cancelRequest(withError: UploadError.unsupportedFile)
            return
        }
        // The extension copies only this selected provider into the shared App Group.
        // The containing app performs authenticated background URLSession upload.
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    override func configurationItems() -> [Any]! { [] }
}
