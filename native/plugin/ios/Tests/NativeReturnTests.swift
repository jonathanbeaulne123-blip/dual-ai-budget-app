import XCTest
@testable import HearthsideNative

final class NativeReturnTests: XCTestCase {
    func testHouseholdScopedReturnKeepsRoomAndFocus() {
        XCTAssertTrue(validNativeReturn("/hearthside/experiences/weekend?household=a&room=studio&mode=focus&design=cat&focus=bank", householdId: "a"))
        XCTAssertFalse(validNativeReturn("/hearthside?household=b&room=studio", householdId: "a"))
        XCTAssertFalse(validNativeReturn("/hearthside?household=a&household=b", householdId: "a"))
        XCTAssertFalse(validNativeReturn("https://example.invalid/hearthside", householdId: "a"))
        XCTAssertFalse(validNativeReturn("/hearthside/%2e%2e/private", householdId: "a"))
        XCTAssertFalse(validNativeReturn("/hearthside?household=a&access_token=secret", householdId: "a"))
    }
    func testNestedReturnCannotCrossHousehold() {
        XCTAssertTrue(validNativeReturn("/hearthside?household=a&from=%2Fhearthside%2Frooms%2Fstudio%3Fhousehold%3Da", householdId: "a"))
        XCTAssertFalse(validNativeReturn("/hearthside?household=a&from=%2Fhearthside%3Fhousehold%3Db", householdId: "a"))
    }
    func testMalformedGeometryIsRejectedBeforeRealityKit() {
        let triangle = NativeMesh(name: "body", positions: [0,0,0, 1,0,0, 0,1,0], normals: [0,0,1, 0,0,1, 0,0,1], uvs: [0,0, 1,0, 0,1], indices: [0,1,2], texturePng: "", color: [1,1,1,1])
        XCTAssertNoThrow(try triangle.validate())
        let invalid = NativeMesh(name: "body", positions: triangle.positions, normals: triangle.normals, uvs: triangle.uvs, indices: [0,1,3], texturePng: "", color: triangle.color)
        XCTAssertThrowsError(try invalid.validate())
    }
}
