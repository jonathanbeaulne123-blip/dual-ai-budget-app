import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";
import "./office.css";
import "./office-room.css";
import "./hearth-theme.css";
import "./hercules.css";

if (typeof window !== "undefined") {
  const phone = window.matchMedia("(max-width: 719px)");
  const syncTouchAction = () => {
    document.documentElement.style.touchAction = phone.matches ? "manipulation" : "";
  };
  syncTouchAction();
  phone.addEventListener("change", syncTouchAction);
  document.addEventListener("gesturestart", (event) => event.preventDefault());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
