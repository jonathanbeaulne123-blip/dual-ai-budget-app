import CryptoKit
import Foundation
import Security

struct UploadCapability: Codable, Equatable {
    let value: String
    let expiresAt: Date
    let nonce: String
    let accountSubject: String

    func validate(now: Date, accountSubject currentSubject: String) throws {
        guard now < expiresAt else { throw UploadError.expiredCapability }
        guard currentSubject == accountSubject else { throw UploadError.changedAccount }
        guard value.count >= 32, nonce.count >= 16 else { throw UploadError.invalidCapability }
    }
}

enum UploadError: Error { case expiredCapability, changedAccount, invalidCapability, unsupportedFile, oversizedFile }

actor EvidenceUploader {
    static let maximumBytes = 10 * 1024 * 1024
    static let appID = "com.hearth.capture.dev"
    private var usedNonces = Set<String>()

    func upload(
        selectedFile: URL,
        contentType: String,
        captureKind: String = "ios-share",
        capability: UploadCapability,
        accountSubject: String,
        endpoint: URL
    ) async throws {
        try capability.validate(now: Date(), accountSubject: accountSubject)
        guard !usedNonces.contains(capability.nonce) else { throw UploadError.invalidCapability }
        let access = selectedFile.startAccessingSecurityScopedResource()
        defer { if access { selectedFile.stopAccessingSecurityScopedResource() } }
        let values = try selectedFile.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true else { throw UploadError.unsupportedFile }
        guard let size = values.fileSize, size > 0, size <= Self.maximumBytes else { throw UploadError.oversizedFile }
        usedNonces.insert(capability.nonce)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("Evidence \(capability.value)", forHTTPHeaderField: "Authorization")
        request.setValue(capability.nonce, forHTTPHeaderField: "X-Evidence-Nonce")
        request.setValue(Self.appID, forHTTPHeaderField: "X-Hearth-App-ID")
        request.setValue(captureKind, forHTTPHeaderField: "X-Evidence-Capture-Kind")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await URLSession.shared.upload(for: request, fromFile: selectedFile)
        guard (response as? HTTPURLResponse)?.statusCode == 201 else { throw URLError(.badServerResponse) }
    }
}

enum CapabilityKeychain {
    static let service = "com.hearth.capture.dev.capability"
    static func erase() {
        SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary)
    }
}
