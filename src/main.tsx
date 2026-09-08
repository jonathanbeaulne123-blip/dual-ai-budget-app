import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
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
import "./mobile-canon.css";

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
  renderKitchen(<App />);
}
