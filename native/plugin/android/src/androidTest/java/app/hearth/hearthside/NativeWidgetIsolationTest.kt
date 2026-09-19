package app.hearth.hearthside
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import android.util.Base64
import android.graphics.Bitmap
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
@RunWith(AndroidJUnit4::class)
class NativeWidgetIsolationTest {
 @Test fun reviewedPixelsAndClearHaveNoCredentialsOrMoneyMetadata() {
  val context=InstrumentationRegistry.getInstrumentation().targetContext
  val image=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);val output=ByteArrayOutputStream();image.compress(Bitmap.CompressFormat.PNG,100,output);image.recycle()
  val path=File(context.noBackupFilesDir,"hearth-widget.json")
  try { HearthWidgetStore.save(context,UUID.randomUUID().toString(),"a".repeat(64),Base64.encodeToString(output.toByteArray(),Base64.NO_WRAP));val text=path.readText();assertFalse(text.contains("accessToken"));assertFalse(text.contains("backing"));assertFalse(text.contains("householdId"));HearthWidgetStore.clear(context);assertFalse(path.exists()) }
  finally { HearthWidgetStore.clear(context) }
 }
 @Test fun invalidOrUnboundedWidgetImageIsRejected() {
  val context=InstrumentationRegistry.getInstrumentation().targetContext
  try { HearthWidgetStore.save(context,UUID.randomUUID().toString(),"a".repeat(64),"not-an-image");fail("Invalid pixels accepted") } catch (_:IllegalArgumentException) { }
 }
}
