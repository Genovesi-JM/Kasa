import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppEntry from "./AppEntry";
import { ErrorBoundary } from "./ErrorBoundary";
import "./i18n";
import "leaflet/dist/leaflet.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppEntry />
    </ErrorBoundary>
  </StrictMode>,
);
