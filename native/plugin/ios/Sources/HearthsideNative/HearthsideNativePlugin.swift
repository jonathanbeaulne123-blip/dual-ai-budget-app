import Foundation
import Capacitor
import ARKit
import AVFoundation
import AuthenticationServices
import Security

@objc(HearthsideNativePlugin)
public final class HearthsideNativePlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "HearthsideNativePlugin"
    public let jsName = "HearthsideNative"
    public let pluginMethods: [CAPPluginMethod] = ["available", "authStorageVersion", "widgetAvailability", "setWidget", "clearWidget", "presentAR", "resumeAR", "updateAccepted", "closeAR", "authenticate", "consumeAuthCallback", "peekAuthCallback", "acknowledgeAuthCallback", "cancelAuthentication", "secureGet", "secureSet", "secureRemove"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var controller: HearthsideARController?
    private var authentication: ASWebAuthenticationSession?
    private var authenticationState: String?
    private var pendingSessionId: String?
    private let keychain = HearthsideKeychain()

    @objc func available(_ call: CAPPluginCall) { call.resolve(["supported": ARWorldTrackingConfiguration.isSupported, "platform": "ios", "reason": ARWorldTrackingConfiguration.isSupported ? "" : "This iPhone does not support interactive AR."]) }
    @objc func presentAR(_ call: CAPPluginCall) {
        guard let id = call.getString("sessionId"), id.count <= 128, let raw = call.getObject("scene") else { call.reject("Invalid scene"); return }
        do {
            let data = try JSONSerialization.data(withJSONObject: raw); guard data.count <= 24 * 1024 * 1024 else { throw NativeFailure.invalid }
            let scene = try JSONDecoder().decode(NativeScene.self, from: data); try scene.validate()
            guard ARWorldTrackingConfiguration.isSupported else { call.reject("Interactive AR is unsupported", "UNSUPPORTED_DEVICE"); return }
            pendingSessionId = id
            let open = { [weak self] in DispatchQueue.main.async {
                guard let self, let host = self.bridge?.viewController else { call.reject("Hearth is not visible"); return }
                guard self.pendingSessionId == id else { call.reject("The household changed while opening the camera", "STALE_SCOPE"); return }
                self.controller?.stop(); self.controller?.dismiss(animated: false)
                let controller = HearthsideARController(sessionId: id, scene: scene)
                controller.emit = { [weak self] kind, state in self?.emit(id: id, identity: scene.identity, kind: kind, state: state) }
                self.controller = controller; host.present(controller, animated: true) { call.resolve() }
            } }
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized: open()
            case .notDetermined: AVCaptureDevice.requestAccess(for: .video) { allowed in if allowed { open() } else { call.reject("Camera access was declined. The room remains available in Hearth.", "CAMERA_DENIED") } }
            default: call.reject("Camera access is unavailable. You can enable it in iPhone Settings.", "CAMERA_DENIED")
            }
        } catch { call.reject("The selected design could not be opened", "INVALID_SCENE") }
    }
    private func emit(id: String, identity: NativeIdentity, kind: String, state: String?) {
        guard let data = try? JSONEncoder().encode(identity),
              let raw = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let value = JSTypes.coerceDictionaryToJSObject(raw) else { return }
        var event: JSObject = ["version": 1, "sessionId": id, "identity": value, "eventId": UUID().uuidString, "kind": kind]
        if let state { event["state"] = state }; notifyListeners("hearthside", data: event)
    }
    @objc func updateAccepted(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            do {
                guard let self, let controller = self.controller, call.getString("sessionId") == controller.sessionId,
                      let identity = call.getObject("identity"), let backing = call.getObject("backing"), let receipt = call.getString("receiptId") else { throw NativeFailure.stale }
                let decodedIdentity = try JSONDecoder().decode(NativeIdentity.self, from: JSONSerialization.data(withJSONObject: identity))
                let decodedBacking = try JSONDecoder().decode(NativeBacking.self, from: JSONSerialization.data(withJSONObject: backing))
                try controller.accepted(identity: decodedIdentity, receiptId: receipt, backing: decodedBacking, animate: call.getBool("animate") ?? false); call.resolve()
            } catch { call.reject("This receipt belongs to another native review", "STALE_SCOPE") }
        }
    }
    @objc func closeAR(_ call: CAPPluginCall) { DispatchQueue.main.async { [weak self] in
        guard let self else { call.resolve(); return }
        if self.pendingSessionId == call.getString("sessionId") { self.pendingSessionId = nil }
        if self.controller?.sessionId == call.getString("sessionId") { self.controller?.stop(); self.controller?.dismiss(animated: false); self.controller = nil }; call.resolve()
    } }
    @objc func resumeAR(_ call: CAPPluginCall) { DispatchQueue.main.async { [weak self] in
        guard let self, let controller = self.controller, controller.sessionId == call.getString("sessionId"), let host = self.bridge?.viewController else { call.reject("This AR room is no longer open", "STALE_SCOPE"); return }
        host.present(controller, animated: true) { controller.returnFromReview(); call.resolve() }
    } }
    @objc func authenticate(_ call: CAPPluginCall) {
        guard let text = call.getString("url"), let url = URL(string: text), url.scheme == "https", url.user == nil, url.password == nil,
              let state = call.getString("state"), state.count >= 32, state.count <= 128 else { call.reject("Invalid system-browser sign-in"); return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }; self.authenticationState = state; self.authentication?.cancel()
            do { try self.keychain.set("pending-auth-state", String(data: JSONSerialization.data(withJSONObject: ["state": state, "deadline": Date().timeIntervalSince1970 + 600]), encoding: .utf8)!) }
            catch { call.reject("Secure sign-in recovery is unavailable", "SECURE_STORAGE_UNAVAILABLE"); return }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "hearthside") { [weak self] callback, error in
                guard let self else { return }
                guard self.authenticationState == state else { call.reject("Sign-in was replaced", "AUTH_CANCELLED"); return }
                self.authentication = nil; self.authenticationState = nil
                guard error == nil, let callback, let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                      parts.host == "auth", parts.path == "/callback", parts.fragment == nil,
                      parts.queryItems?.filter({ $0.name == "state" }).count == 1,
                      parts.queryItems?.first(where: { $0.name == "state" })?.value == state,
                      HearthsideAuthReturn.capture(callback) else { call.reject("Sign-in cancelled or returned to another session", "AUTH_CANCELLED"); return }
                call.resolve(["callbackUrl": callback.absoluteString])
            }
            session.presentationContextProvider = self; session.prefersEphemeralWebBrowserSession = false; self.authentication = session
            if !session.start() { self.authentication = nil; call.reject("The system browser could not begin sign-in", "AUTH_UNAVAILABLE") }
        }
    }
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { bridge?.viewController?.view.window ?? ASPresentationAnchor() }
    @objc func consumeAuthCallback(_ call: CAPPluginCall) {
        do { let value = try keychain.get("pending-auth-callback"); try keychain.remove("pending-auth-callback"); call.resolve(["callbackUrl": value as Any? ?? NSNull()]) }
        catch { call.reject("Secure sign-in recovery is unavailable") }
    }
    @objc func authStorageVersion(_ call: CAPPluginCall) { call.resolve(["version": 2]) }
    @objc func widgetAvailability(_ call: CAPPluginCall) { let available = HearthsideWidgetStore.container() != nil; call.resolve(["supported": available, "reason": available ? "After saving, add the Hearth sculpture widget from your home screen." : "The optional widget app group is not configured in this build."]) }
    @objc func setWidget(_ call: CAPPluginCall) {
        do { guard let id = call.getString("selectionId"), let scope = call.getString("scopeDigest"), let image = call.getString("pngBase64") else { throw NativeFailure.invalid }; try HearthsideWidgetStore.save(selectionId: id, scopeDigest: scope, encoded: image); call.resolve() }
        catch { call.reject("The widget image could not be saved", "WIDGET_UNAVAILABLE") }
    }
    @objc func clearWidget(_ call: CAPPluginCall) { do { try HearthsideWidgetStore.clear(); call.resolve() } catch { call.reject("The widget image could not be cleared", "WIDGET_UNAVAILABLE") } }
    @objc func peekAuthCallback(_ call: CAPPluginCall) {
        do { call.resolve(["callbackUrl": try keychain.get("pending-auth-callback") as Any? ?? NSNull()]) }
        catch { call.reject("Secure sign-in recovery is unavailable", "SECURE_STORAGE_UNAVAILABLE") }
    }
    @objc func acknowledgeAuthCallback(_ call: CAPPluginCall) {
        do {
            guard let expected = call.getString("callbackUrl") else { throw NativeFailure.invalid }
            let saved = try keychain.get("pending-auth-callback")
            guard saved == nil || saved == expected else { throw NativeFailure.stale }
            try keychain.remove("pending-auth-callback"); call.resolve()
        } catch { call.reject("The sign-in return changed or could not be acknowledged", "AUTH_CALLBACK_CHANGED") }
    }
    @objc func cancelAuthentication(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.reject("Native sign-in is unavailable"); return }
            self.authenticationState = nil; self.authentication?.cancel(); self.authentication = nil
            do { try self.keychain.remove("pending-auth-state"); try self.keychain.remove("pending-auth-callback"); call.resolve() }
            catch { call.reject("Secure sign-in cancellation could not be saved", "SECURE_STORAGE_UNAVAILABLE") }
        }
    }
    @objc func secureGet(_ call: CAPPluginCall) { storage(call) { key in ["value": try self.keychain.get(key) as JSValue? ?? NSNull()] } }
    @objc func secureSet(_ call: CAPPluginCall) { storage(call) { key in guard let value = call.getString("value"), value.utf8.count <= 32768 else { throw NativeFailure.invalid }; try self.keychain.set(key, value); return [:] } }
    @objc func secureRemove(_ call: CAPPluginCall) { storage(call) { key in try self.keychain.remove(key); return [:] } }
    private func storage(_ call: CAPPluginCall, perform: (String) throws -> JSObject) {
        do { guard let key = call.getString("key"), key.range(of: "^[A-Za-z0-9:._-]{1,180}$", options: .regularExpression) != nil else { throw NativeFailure.invalid }; call.resolve(try perform(key)) }
        catch { call.reject("Secure session storage is unavailable", "SECURE_STORAGE_UNAVAILABLE") }
    }
}
/** SceneDelegate calls this for a cold-start OAuth return before the web SDK resumes. */
public enum HearthsideAuthReturn {
    @discardableResult public static func capture(_ url: URL) -> Bool {
        do {
            let storage = HearthsideKeychain()
            if try storage.get("pending-auth-callback") == url.absoluteString { return true }
            guard let pending = try storage.get("pending-auth-state"), let data = pending.data(using: .utf8),
                  let saved = try JSONSerialization.jsonObject(with: data) as? [String: Any], let state = saved["state"] as? String,
                  let deadline = saved["deadline"] as? Double, deadline >= Date().timeIntervalSince1970,
                  let parts = URLComponents(url: url, resolvingAgainstBaseURL: false), parts.scheme == "hearthside", parts.host == "auth", parts.path == "/callback", parts.fragment == nil,
                  parts.queryItems?.filter({ $0.name == "state" }).count == 1, parts.queryItems?.first(where: { $0.name == "state" })?.value == state,
                  parts.queryItems?.filter({ $0.name == "code" }).count == 1, parts.queryItems?.contains(where: { $0.name == "access_token" }) == false else { return false }
            try storage.set("pending-auth-callback", url.absoluteString); try storage.remove("pending-auth-state"); return true
        } catch { return false }
    }
}
private final class HearthsideKeychain {
    private let service = "app.hearth.hearthside.sessions"
    private func query(_ key: String) -> [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key] }
    func get(_ key: String) throws -> String? {
        var input = query(key); input[kSecReturnData as String] = true; input[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?; let status = SecItemCopyMatching(input as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }; guard status == errSecSuccess, let data = value as? Data else { throw NativeFailure.denied }
        guard let text = String(data: data, encoding: .utf8) else { throw NativeFailure.invalid }; return text
    }
    func set(_ key: String, _ value: String) throws {
        let update: [String: Any] = [kSecValueData as String: Data(value.utf8), kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let status = SecItemUpdate(query(key) as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound { var add = query(key); update.forEach { add[$0.key] = $0.value }; guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw NativeFailure.denied } }
        else if status != errSecSuccess { throw NativeFailure.denied }
    }
    func remove(_ key: String) throws { let status = SecItemDelete(query(key) as CFDictionary); guard status == errSecSuccess || status == errSecItemNotFound else { throw NativeFailure.denied } }
}
