import Foundation

struct NativeIdentity: Codable, Equatable {
    let environment: String; let householdId: String; let memberId: String
    let designId: String; let pieceId: String; let revision: Int
    func validate() throws {
        guard ["development", "production"].contains(environment), revision >= 0,
              [householdId, memberId, designId, pieceId].allSatisfy({ !$0.isEmpty && $0.count <= 128 }) else { throw NativeFailure.invalid }
    }
}
struct NativeBacking: Codable {
    let status: String; let step: Int?
    func validate() throws {
        guard status == "unavailable" && step == nil || status == "available" && step != nil && (0...10).contains(step!) else { throw NativeFailure.invalid }
    }
    var scale: Float { status == "available" ? 0.72 + Float(step ?? 0) * 0.028 : 1 }
}
struct NativeMesh: Codable {
    let name: String; let positions: [Float]; let normals: [Float]; let uvs: [Float]
    let indices: [UInt32]; let texturePng: String; let color: [Float]
    func validate() throws {
        let n = positions.count / 3
        guard !name.isEmpty, name.count <= 128, n > 0, n <= 50000, positions.count % 3 == 0,
              normals.count == positions.count, uvs.count == n * 2,
              !indices.isEmpty, indices.count <= 300000, indices.count % 3 == 0, indices.allSatisfy({ $0 < n }),
              positions.allSatisfy({ $0.isFinite && abs($0) <= 5 }), normals.allSatisfy({ $0.isFinite }), uvs.allSatisfy({ $0.isFinite }),
              color.count == 4, color.allSatisfy({ $0.isFinite && (0...1).contains($0) }), texturePng.count <= 4 * 1024 * 1024,
              texturePng.isEmpty || Data(base64Encoded: texturePng) != nil else { throw NativeFailure.invalid }
    }
}
struct NativeScene: Codable {
    let version: Int; let identity: NativeIdentity; let meshes: [NativeMesh]
    let glbBase64: String; var backing: NativeBacking; let returnPath: String; var fundingEnabled: Bool? = nil
    func validate() throws {
        try identity.validate(); try backing.validate()
        guard version == 1, !meshes.isEmpty, meshes.count <= 64,
              meshes.reduce(0, { $0 + $1.positions.count / 3 }) <= 100000,
              glbBase64.count <= 12 * 1024 * 1024, Data(base64Encoded: glbBase64) != nil,
              validNativeReturn(returnPath, householdId: identity.householdId) else { throw NativeFailure.invalid }
        try meshes.forEach { try $0.validate() }
    }
}
func validNativeReturn(_ path: String, householdId: String, depth: Int = 0) -> Bool {
    guard depth <= 1, path.count <= 3000, path.hasPrefix("/hearthside"), !path.contains("\\"), !path.contains("#"),
          let url = URLComponents(string: path), url.scheme == nil, url.host == nil,
          !url.percentEncodedPath.lowercased().contains("%2f"), !url.percentEncodedPath.lowercased().contains("%5c"),
          !url.path.split(separator: "/").contains(".."), url.path == "/hearthside" || url.path.hasPrefix("/hearthside/") else { return false }
    let items = url.queryItems ?? []
    if items.isEmpty { return true }
    let allowed = Set(["household", "room", "mode", "design", "from", "focus", "surface"])
    guard items.allSatisfy({ allowed.contains($0.name) }), Set(items.map(\.name)).count == items.count,
          items.first(where: { $0.name == "household" })?.value == householdId else { return false }
    if let back = items.first(where: { $0.name == "from" })?.value { return validNativeReturn(back, householdId: householdId, depth: depth + 1) }
    return true
}
enum NativeFailure: Error { case invalid, stale, denied, unsupported }
struct NativeReceiptGate {
    let sessionId: String; let identity: NativeIdentity
    private(set) var receipts = Set<String>()
    mutating func accept(sessionId: String, identity: NativeIdentity, receiptId: String) throws -> Bool {
        guard self.sessionId == sessionId, self.identity == identity, !receiptId.isEmpty, receiptId.count <= 128 else { throw NativeFailure.stale }
        return receipts.insert(receiptId).inserted
    }
}
