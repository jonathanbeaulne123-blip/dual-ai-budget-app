import XCTest
@testable import HearthsideNative
final class NativeContractsTests: XCTestCase {
    func testReceiptIsScopedAndDuplicateSafe() throws {
        let identity = NativeIdentity(environment: "development", householdId: "a", memberId: "alice", designId: "d", pieceId: "p", revision: 4)
        var gate = NativeReceiptGate(sessionId: "session-a", identity: identity)
        XCTAssertTrue(try gate.accept(sessionId: "session-a", identity: identity, receiptId: "receipt-a"))
        XCTAssertFalse(try gate.accept(sessionId: "session-a", identity: identity, receiptId: "receipt-a"))
        XCTAssertThrowsError(try gate.accept(sessionId: "session-b", identity: identity, receiptId: "receipt-b"))
    }
    func testUnavailableBackingIsDistinctFromEmpty() throws {
        let unavailable = NativeBacking(status: "unavailable", step: nil), empty = NativeBacking(status: "available", step: 0)
        try unavailable.validate(); try empty.validate(); XCTAssertNotEqual(unavailable.scale, empty.scale)
        XCTAssertThrowsError(try NativeBacking(status: "available", step: 11).validate())
    }
}
