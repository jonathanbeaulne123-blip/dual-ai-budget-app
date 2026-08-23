import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";
import "./office.css";
import "./office-phone.css";
import "./hercules.css";

if (typeof window !== "undefined") {
  document.documentElement.style.touchAction = "manipulation";
  document.addEventListener("gesturestart", (event) => event.preventDefault());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
