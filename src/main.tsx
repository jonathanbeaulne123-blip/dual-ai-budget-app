import { StrictMode, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { hydrateNativeAuthentication } from "./hearthside/nativeBootstrap.ts";
import { NativeAuthNotice } from "./hearthside/NativeAuthNotice.tsx";
import { KitchenErrorBoundary } from "./KitchenErrorBoundary.tsx";
import { ThemeProvider } from "./theme/ThemeProvider.tsx";
import "./styles.css";
import "./office.css";
import "./office-phone.css";
import "./office-wide.css";
import "./ledger-story.css";
import "./month-spread.css";
import "./desk-plates.css";
import "./charter-founding.css";
import "./charter.css";
import "./hearth-theme.css";
import "./hercules.css";
import "./theme/worlds.css";
import "./theme/kinds.css";
import "./theme/whisper.css";
import "./theme/status-fold.css";
import "./mobile-canon.css";
import "./theme/mobile-worlds.css";
import "./theme/mobile-worlds-refinement.css";
import "./theme/page-worlds.css";
import "./theme/page-calendar.css";
import "./theme/page-plan.css";
import "./theme/page-more.css";
import "./theme/page-books.css";
import "./entry-restoration.css";
import "./entry-restoration-integration.css";
import "./entry-restoration-corrections.css";
import "./entry-restoration-extension.css";
import "./cashpad-ux.css";

if (typeof window !== "undefined") {
  const phone = window.matchMedia("(max-width: 719px)");
  const syncTouchAction = () => {
    document.documentElement.style.touchAction = phone.matches ? "manipulation" : "";
  };
  syncTouchAction();
  phone.addEventListener("change", syncTouchAction);
}

const root = createRoot(document.getElementById("root")!);
const renderKitchen = (content: ReactNode) => root.render(
  <StrictMode>
    <ThemeProvider>
    <KitchenErrorBoundary>
      {content}
    </KitchenErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("themeStudio")) {
  void import("./theme/ThemeStudio.tsx").then(({ default: Studio }) => renderKitchen(<Studio />));
} else {
  const start = async () => {
    renderKitchen(<main className="welcome"><section className="welcome-card"><h1>Opening Hearth…</h1><p role="status">Loading your secure sign-in on this device.</p></section></main>);
    try {
      await hydrateNativeAuthentication();
      const { HearthsideEntry } = await import("./hearthside/StreetEntry.tsx");
      const App = lazy(() => import("./App.tsx").then(module => ({default: module.App})));
      renderKitchen(<><NativeAuthNotice /><HearthsideEntry><Suspense fallback={<p role="status">Opening your home…</p>}><App /></Suspense></HearthsideEntry></>);
    } catch {
      renderKitchen(<main className="welcome"><section className="welcome-card"><h1>Unlock secure storage</h1><p role="alert">Hearth could not load this device’s secure sign-in. Unlock your device and retry.</p><button type="button" onClick={() => void start()}>Retry secure startup</button></section></main>);
    }
  };
  void start();
}
