package app.hearth.hearthside

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.AtomicFile
import android.util.Base64
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID

class HearthSculptureWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { HearthWidgetStore.render(context, manager, ids) }
}
internal object HearthWidgetStore {
    private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "hearth-widget.json"))
    @Synchronized fun save(context: Context, selectionId: String, scopeDigest: String, encoded: String) {
        UUID.fromString(selectionId); require(Regex("^[a-f0-9]{64}$").matches(scopeDigest) && encoded.length <= 700000)
        val bytes = Base64.decode(encoded, Base64.NO_WRAP); require(bytes.size <= 524288 && bytes.take(8) == listOf(137,80,78,71,13,10,26,10).map { it.toByte() })
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        require(bounds.outWidth in 1..1024 && bounds.outHeight in 1..1024)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: error("Invalid PNG")
        val output = ByteArrayOutputStream(); require(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)); bitmap.recycle(); require(output.size() <= 524288)
        val manifest = JSONObject().put("version", 1).put("selectionId", selectionId).put("scopeDigest", scopeDigest).put("png", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)).toString().toByteArray()
        val atomic = file(context); val stream = atomic.startWrite(); try { stream.write(manifest); atomic.finishWrite(stream) } catch (error: Exception) { atomic.failWrite(stream); throw error }
        update(context)
    }
    @Synchronized fun clear(context: Context) { file(context).delete(); check(!file(context).baseFile.exists()); update(context) }
    private fun update(context: Context) { val manager = AppWidgetManager.getInstance(context); render(context, manager, manager.getAppWidgetIds(ComponentName(context, HearthSculptureWidget::class.java))) }
    fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val image = try { val bytes = file(context).readFully(); require(bytes.size <= 710000); val data = Base64.decode(JSONObject(String(bytes)).getString("png"), Base64.NO_WRAP); BitmapFactory.decodeByteArray(data, 0, data.size) } catch (_: Exception) { null }
        val views = RemoteViews(context.packageName, R.layout.hearth_sculpture_widget)
        views.setViewVisibility(R.id.hearth_widget_image, if (image == null) View.GONE else View.VISIBLE)
        views.setViewVisibility(R.id.hearth_widget_default, if (image == null) View.VISIBLE else View.GONE)
        if (image != null) views.setImageViewBitmap(R.id.hearth_widget_image, image)
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { intent ->
            intent.action = Intent.ACTION_VIEW; intent.data = Uri.parse("hearthside://open/widget"); intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            views.setOnClickPendingIntent(R.id.hearth_widget_root, PendingIntent.getActivity(context, 7321, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        manager.updateAppWidget(ids, views)
    }
}
