package app.hearth.hearthside;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** The real Capacitor Activity and packaged React entry, with no account or camera activation. */
@RunWith(AndroidJUnit4.class)
public class CompanionBootTest {
    @Test public void opensSharedReactAppAndRegistersSecurePluginWithoutCamera() throws Exception {
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            activity.onActivity(host -> {
                assertNotNull(host.getBridge());
                assertNotNull(host.getBridge().getPlugin("HearthsideNative"));
            });
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
            AtomicReference<String> result = new AtomicReference<>("");
            while (System.nanoTime() < deadline) {
                CountDownLatch response = new CountDownLatch(1);
                activity.onActivity(host -> host.getBridge().getWebView().evaluateJavascript(
                    "Boolean(location.protocol === 'https:' && location.hostname === 'localhost' && document.getElementById('root')?.childElementCount > 0)",
                    value -> { result.set(value); response.countDown(); }));
                assertTrue("The local WebView did not answer", response.await(5, TimeUnit.SECONDS));
                if ("true".equals(result.get())) return;
                Thread.sleep(200);
            }
            fail("The packaged React entry did not mount after secure native hydration: " + result.get());
        }
    }
}
