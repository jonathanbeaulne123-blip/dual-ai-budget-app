package app.hearth.hearthside

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.view.ViewGroup
import androidx.browser.customtabs.CustomTabsIntent
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.ar.core.ArCoreApk
import org.json.JSONObject
import java.util.UUID

@CapacitorPlugin(name = "HearthsideNative", permissions = [Permission(alias = "camera", strings = [Manifest.permission.CAMERA])])
class HearthsideNativePlugin : Plugin() {
    private var ar: HearthsideARView? = null
    private var authCall: PluginCall? = null
    @Volatile private var pendingSessionId: String? = null
    private val secure by lazy { HearthsideSecureStore(context) }
    override fun load() { super.load(); handleOnNewIntent(activity.intent) }
    @PluginMethod fun available(call: PluginCall) {
        val availability = ArCoreApk.getInstance().checkAvailability(context)
        call.resolve(JSObject().put("supported", availability.isSupported).put("platform", "android").put("reason", if (availability.isSupported) "" else "Interactive AR is unavailable or still checking this device."))
    }
    @PluginMethod fun presentAR(call: PluginCall) {
        pendingSessionId = call.getString("sessionId")
        if (getPermissionState("camera") != PermissionState.GRANTED) { requestPermissionForAlias("camera", call, "cameraPermission"); return }
        show(call)
    }
    @PermissionCallback private fun cameraPermission(call: PluginCall) { if (getPermissionState("camera") == PermissionState.GRANTED) show(call) else call.reject("Camera access was declined. The room remains available in Hearth.", "CAMERA_DENIED") }
    private fun show(call: PluginCall) { activity.runOnUiThread {
        val sessionId = call.getString("sessionId")
        if (sessionId == null || pendingSessionId != sessionId) { call.reject("This camera request belongs to an earlier room", "STALE_SCOPE"); return@runOnUiThread }
        try {
            val scene = call.getObject("scene") ?: error("Missing scene")
            require(sessionId.length in 1..128); closeScene()
            val view = HearthsideARView(activity, sessionId, JSONObject(scene.toString()), { kind, state ->
                val event = JSObject().put("version", 1).put("sessionId", sessionId).put("identity", scene.getJSONObject("identity")).put("eventId", UUID.randomUUID().toString()).put("kind", kind)
                if (state != null) event.put("state", state); notifyListeners("hearthside", event)
            }, {
                notifyListeners("hearthside", JSObject().put("version", 1).put("sessionId", sessionId).put("identity", scene.getJSONObject("identity")).put("eventId", UUID.randomUUID().toString()).put("kind", "closed")); closeScene()
            })
            ar = view; activity.addContentView(view, ViewGroup.LayoutParams(-1, -1)); view.resumeScene(); call.resolve()
        } catch (_: Exception) { closeScene(); call.reject("This design or AR session could not be opened.", "INVALID_SCENE") }
    } }
    @PluginMethod fun resumeAR(call: PluginCall) { activity.runOnUiThread { if (ar?.sessionId == call.getString("sessionId")) { ar?.resumeScene(); call.resolve() } else call.reject("This AR room is no longer open", "STALE_SCOPE") } }
    @PluginMethod fun updateAccepted(call: PluginCall) { activity.runOnUiThread { try { val view = ar ?: error("No AR session"); view.accepted(call.data); call.resolve() } catch (_: Exception) { call.reject("This receipt belongs to another native review", "STALE_SCOPE") } } }
    @PluginMethod fun closeAR(call: PluginCall) { activity.runOnUiThread { if (pendingSessionId == call.getString("sessionId")) pendingSessionId = null; if (ar?.sessionId == call.getString("sessionId")) closeScene(); call.resolve() } }
    private fun closeScene() { ar?.let { it.destroyScene(); (it.parent as? ViewGroup)?.removeView(it) }; ar = null }
    override fun handleOnPause() { ar?.pauseScene() }
    override fun handleOnResume() { if (ar?.visibility == android.view.View.VISIBLE) ar?.resumeScene() }
    override fun handleOnDestroy() { closeScene(); authCall = null }

    @PluginMethod fun authenticate(call: PluginCall) {
        try {
            val url = Uri.parse(call.getString("url")); val state = call.getString("state") ?: error("Missing state")
            require(url.scheme == "https" && url.host != null && url.userInfo == null && state.length in 32..128)
            authCall?.reject("Replaced by another sign-in", "AUTH_CANCELLED")
            secure.set("pending-auth-state", JSONObject().put("state", state).put("deadline", System.currentTimeMillis() + 600000).toString())
            authCall = call
            activity.runOnUiThread { try { CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(activity, url) } catch (_: Exception) { if (authCall == call) authCall = null; call.reject("The system browser could not begin sign-in", "AUTH_UNAVAILABLE") } }
        } catch (_: Exception) { call.reject("The system browser could not begin sign-in", "AUTH_UNAVAILABLE") }
    }
    override fun handleOnNewIntent(intent: Intent?) {
        val url = intent?.data ?: return
        if (url.scheme != "hearthside" || url.host != "auth" || url.path != "/callback") return
        try {
            val pending = secure.get("pending-auth-state")?.let(::JSONObject) ?: return
            require(pending.getLong("deadline") >= System.currentTimeMillis() && url.fragment == null &&
                url.getQueryParameters("state") == listOf(pending.getString("state")) && url.getQueryParameters("code").size == 1 && url.getQueryParameter("access_token") == null)
            secure.set("pending-auth-callback", url.toString()); secure.remove("pending-auth-state")
            authCall?.resolve(JSObject().put("callbackUrl", url.toString())); authCall = null
        } catch (_: Exception) { authCall?.reject("Sign-in returned to another session", "AUTH_MISMATCH"); authCall = null }
    }
    @PluginMethod fun authStorageVersion(call: PluginCall) { call.resolve(JSObject().put("version", 2)) }
    @PluginMethod fun widgetAvailability(call: PluginCall) { call.resolve(JSObject().put("supported", true).put("reason", "After saving, add the Hearth sculpture widget from your home screen.")) }
    @PluginMethod fun setWidget(call: PluginCall) { try { HearthWidgetStore.save(context, call.getString("selectionId") ?: error("Missing selection"), call.getString("scopeDigest") ?: error("Missing scope"), call.getString("pngBase64") ?: error("Missing image")); call.resolve() } catch (_: Exception) { call.reject("The widget image could not be saved", "WIDGET_UNAVAILABLE") } }
    @PluginMethod fun clearWidget(call: PluginCall) { try { HearthWidgetStore.clear(context); call.resolve() } catch (_: Exception) { call.reject("The widget image could not be cleared", "WIDGET_UNAVAILABLE") } }
    @PluginMethod fun peekAuthCallback(call: PluginCall) { try { call.resolve(JSObject().put("callbackUrl", secure.get("pending-auth-callback") ?: JSONObject.NULL)) } catch (_: Exception) { call.reject("Secure sign-in recovery is unavailable", "SECURE_STORAGE_UNAVAILABLE") } }
    @PluginMethod fun acknowledgeAuthCallback(call: PluginCall) {
        try { val expected = call.getString("callbackUrl") ?: error("Missing callback"); val saved = secure.get("pending-auth-callback"); require(saved == null || saved == expected); secure.remove("pending-auth-callback"); call.resolve() }
        catch (_: Exception) { call.reject("The sign-in return changed or could not be acknowledged", "AUTH_CALLBACK_CHANGED") }
    }
    @PluginMethod fun consumeAuthCallback(call: PluginCall) { try { val value = secure.get("pending-auth-callback"); secure.remove("pending-auth-callback"); call.resolve(JSObject().put("callbackUrl", value ?: JSONObject.NULL)) } catch (_: Exception) { call.reject("Secure sign-in recovery is unavailable") } }
    @PluginMethod fun cancelAuthentication(call: PluginCall) { authCall?.reject("Sign-in cancelled", "AUTH_CANCELLED"); authCall = null; try { secure.remove("pending-auth-state"); secure.remove("pending-auth-callback"); call.resolve() } catch (_: Exception) { call.reject("Secure sign-in cancellation could not be saved") } }
    @PluginMethod fun secureGet(call: PluginCall) { storage(call) { key -> JSObject().put("value", secure.get(key) ?: JSONObject.NULL) } }
    @PluginMethod fun secureSet(call: PluginCall) { storage(call) { key -> val value = call.getString("value") ?: error("Missing value"); require(value.toByteArray().size <= 32768); secure.set(key, value); JSObject() } }
    @PluginMethod fun secureRemove(call: PluginCall) { storage(call) { key -> secure.remove(key); JSObject() } }
    private fun storage(call: PluginCall, action: (String) -> JSObject) { try { val key = call.getString("key") ?: error("Missing key"); require(Regex("^[A-Za-z0-9:._-]{1,180}$").matches(key)); call.resolve(action(key)) } catch (_: Exception) { call.reject("Secure session storage is unavailable", "SECURE_STORAGE_UNAVAILABLE") } }
}
