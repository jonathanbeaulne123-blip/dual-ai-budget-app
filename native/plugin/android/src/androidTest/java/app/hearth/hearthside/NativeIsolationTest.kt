package app.hearth.hearthside

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONObject

@RunWith(AndroidJUnit4::class)
class NativeIsolationTest {
    @Test fun keystoreSessionRoundTripAndRemoval() {
        val store = HearthsideSecureStore(InstrumentationRegistry.getInstrumentation().targetContext)
        val key = "synthetic-native-test"
        try { store.set(key, "synthetic-session"); assertEquals("synthetic-session", store.get(key)); store.remove(key); assertNull(store.get(key)) }
        finally { store.remove(key) }
    }
    @Test fun acceptedReceiptCannotCrossHouseholdOrRevision() {
        val original = JSONObject("""{"environment":"development","householdId":"a","memberId":"alice","designId":"d","pieceId":"p","revision":2}""")
        assertTrue(HearthsideARView.sameIdentity(original, JSONObject(original.toString())))
        assertFalse(HearthsideARView.sameIdentity(original, JSONObject(original.toString()).put("householdId", "b")))
        assertFalse(HearthsideARView.sameIdentity(original, JSONObject(original.toString()).put("revision", 3)))
    }
}
