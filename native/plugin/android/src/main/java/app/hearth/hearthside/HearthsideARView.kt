package app.hearth.hearthside

import android.app.Activity
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import com.google.ar.core.Config
import com.google.ar.core.Plane
import com.google.ar.core.TrackingState
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.node.ModelNode
import io.github.sceneview.math.Rotation
import io.github.sceneview.math.Scale
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs

/** Camera frames and placement anchors never leave this native view. */
internal class HearthsideARView(
    private val host: Activity, val sessionId: String, val scene: JSONObject,
    private val emit: (String, String?) -> Unit,
    private val close: () -> Unit
) : FrameLayout(host), LifecycleOwner {
    private val registry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = registry
    private val label = TextView(host)
    private val coin = Button(host)
    private val receipts = mutableSetOf<String>()
    private val identity = scene.getJSONObject("identity")
    private val ar: ARSceneView
    private var anchor: AnchorNode? = null
    private var model: ModelNode
    private var angle = 0f
    private var downX = 0f
    private var downY = 0f
    private var tracking = false
    private var stopped = false

    init {
        require(scene.getInt("version") == 1 && scene.toString().length <= 24 * 1024 * 1024)
        require(listOf("development", "production").contains(identity.getString("environment")))
        require(validReturn(scene.getString("returnPath"), identity.getString("householdId")))
        registry.currentState = Lifecycle.State.CREATED
        ar = ARSceneView(context = host, sharedActivity = host as ComponentActivity, sharedLifecycle = lifecycle)
        ar.sessionConfiguration = { _, config ->
            config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
            config.instantPlacementMode = Config.InstantPlacementMode.DISABLED
            config.cloudAnchorMode = Config.CloudAnchorMode.DISABLED
            config.geospatialMode = Config.GeospatialMode.DISABLED
        }
        ar.onSessionFailed = { label.text = "The camera could not start. Return to Hearth and try again."; emit("error", "ar-session-failed") }
        ar.onTrackingFailureChanged = { reason -> emit("tracking", reason?.name ?: "tracking") }
        ar.onSessionUpdated = { _, frame -> tracking = frame.camera.trackingState == TrackingState.TRACKING }
        val bytes = android.util.Base64.decode(scene.getString("glbBase64"), android.util.Base64.DEFAULT)
        require(bytes.size <= 9 * 1024 * 1024 && bytes.size >= 20)
        val header = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        require(header.int == 0x46546c67 && header.int == 2 && header.int == bytes.size)
        val instance = ar.modelLoader.createModelInstance(ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes).apply { flip() })
        model = ModelNode(instance, autoAnimate = false) // Authored metre coordinates; no model-normalization or financial geometry.
        applyBacking(scene.getJSONObject("backing"))
        ar.onTouchEvent = { event, _ -> touch(event) }
        addView(ar, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        label.text = "Move slowly, then tap a clear surface to place your cat."
        label.setTextColor(0xff292621.toInt()); label.textSize = 17f; label.setPadding(16, 12, 16, 12)
        val controls = LinearLayout(host).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(0xfff8f0e4.toInt()); setPadding(16, 8, 16, 16) }
        controls.addView(label)
        val turns = LinearLayout(host)
        turns.addView(button("Rotate left") { rotate(-15f) }, LinearLayout.LayoutParams(0, -2, 1f))
        turns.addView(button("Rotate right") { rotate(15f) }, LinearLayout.LayoutParams(0, -2, 1f)); controls.addView(turns)
        coin.text = "Review a contribution"; coin.contentDescription = coin.text; coin.minHeight = dp(48)
        coin.setOnClickListener { if (!scene.optBoolean("fundingEnabled", true)) return@setOnClickListener; coin.isEnabled = false; hideForReview(); emit("funding-intent", null) }
        coin.visibility = if (scene.optBoolean("fundingEnabled", true)) View.VISIBLE else View.GONE
        controls.addView(coin); controls.addView(button("Return to Hearth", close))
        addView(controls, LayoutParams(-1, -2, android.view.Gravity.BOTTOM))
        setOnApplyWindowInsetsListener { _, insets -> controls.setPadding(dp(12), dp(8), dp(12), insets.systemWindowInsetBottom + dp(12)); insets }
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun button(title: String, action: () -> Unit) = Button(host).apply { text = title; contentDescription = title; minHeight = dp(48); setOnClickListener { action() } }
    private fun rotate(by: Float) { angle += by; model.rotation = Rotation(0f, angle, 0f) }
    private fun touch(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> { downX = event.x; downY = event.y }
            MotionEvent.ACTION_MOVE -> if (anchor != null && event.pointerCount == 2) rotate((event.x - downX) * 0.3f).also { downX = event.x }
            MotionEvent.ACTION_UP -> if (tracking && abs(event.x - downX) < dp(20) && abs(event.y - downY) < dp(20)) {
                val hit = ar.frame?.hitTest(event.x, event.y)?.firstOrNull { val plane = it.trackable as? Plane; plane != null && plane.isPoseInPolygon(it.hitPose) && plane.trackingState == TrackingState.TRACKING }
                if (hit != null) {
                    anchor?.let { it.removeChildNode(model); ar.removeChildNode(it); it.destroy() }
                    anchor = AnchorNode(ar.engine, hit.createAnchor()).also { it.addChildNode(model); ar.addChildNode(it) }
                    label.text = "Your cat is here. Turn it, move it, or review a contribution."
                } else { label.text = "Point at a clear surface and move slowly." }
            }
        }
        return true
    }
    fun resumeScene() { if (!stopped) { visibility = View.VISIBLE; coin.isEnabled = true; registry.currentState = Lifecycle.State.RESUMED; emit("resumed", null) } }
    fun pauseScene() { if (!stopped) { registry.currentState = Lifecycle.State.CREATED; emit("background", null) } }
    private fun hideForReview() { pauseScene(); visibility = View.GONE }
    fun accepted(input: JSONObject) {
        require(input.getString("sessionId") == sessionId && sameIdentity(identity, input.getJSONObject("identity")))
        val receipt = input.getString("receiptId"); require(receipt.length in 1..128)
        val backing = input.getJSONObject("backing"); validateBacking(backing)
        if (!receipts.add(receipt)) return
        scene.put("backing", backing); applyBacking(backing)
        if (input.optBoolean("animate") && !android.provider.Settings.Global.getString(host.contentResolver, "animator_duration_scale").orEmpty().equals("0.0")) performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM)
    }
    private fun validateBacking(value: JSONObject) { require(value.getString("status") == "unavailable" && !value.has("step") || value.getString("status") == "available" && value.getInt("step") in 0..10) }
    private fun applyBacking(value: JSONObject) { validateBacking(value); model.scale = Scale(if (value.getString("status") == "available") 0.72f + value.getInt("step") * 0.028f else 1f) }
    fun destroyScene() { if (!stopped) { stopped = true; registry.currentState = Lifecycle.State.DESTROYED; ar.destroy(); anchor = null; removeAllViews() } }
    companion object { fun sameIdentity(a: JSONObject, b: JSONObject) = listOf("environment", "householdId", "memberId", "designId", "pieceId", "revision").all { a.opt(it) == b.opt(it) } }
}

private fun validReturn(path: String, householdId: String, depth: Int = 0): Boolean = try {
    val uri = java.net.URI(path)
    val raw = uri.rawPath ?: ""
    val items = (uri.rawQuery ?: "").split('&').filter { it.isNotEmpty() }.map { row ->
        val pair = row.split('=', limit = 2)
        java.net.URLDecoder.decode(pair[0], "UTF-8") to java.net.URLDecoder.decode(pair.getOrElse(1) { "" }, "UTF-8")
    }
    depth <= 1 && path.length <= 3000 && uri.scheme == null && uri.host == null && uri.fragment == null && !path.contains('\\') &&
        (raw == "/hearthside" || raw.startsWith("/hearthside/")) && !Regex("%2f|%5c|%2e", RegexOption.IGNORE_CASE).containsMatchIn(raw) &&
        !uri.path.split('/').contains("..") && items.map { it.first }.toSet().size == items.size &&
        items.all { it.first in setOf("household", "room", "mode", "design", "from", "focus", "surface") } &&
        (items.isEmpty() || items.firstOrNull { it.first == "household" }?.second == householdId) &&
        items.filter { it.first == "from" }.all { validReturn(it.second, householdId, depth + 1) }
} catch (_: Exception) { false }
