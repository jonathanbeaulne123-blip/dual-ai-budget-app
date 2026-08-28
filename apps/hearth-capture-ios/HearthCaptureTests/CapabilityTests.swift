import XCTest
@testable import HearthCapture

final class CapabilityTests: XCTestCase {
    func testRejectsExpiredAndChangedAccount() {
        let expired = UploadCapability(value: String(repeating: "a", count: 32), expiresAt: .distantPast, nonce: String(repeating: "n", count: 16), accountSubject: "google-a")
        XCTAssertThrowsError(try expired.validate(now: Date(), accountSubject: "google-a"))
        let live = UploadCapability(value: String(repeating: "a", count: 32), expiresAt: .distantFuture, nonce: String(repeating: "n", count: 16), accountSubject: "google-a")
        XCTAssertThrowsError(try live.validate(now: Date(), accountSubject: "google-b"))
    }
}
