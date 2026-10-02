import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Presentation from "./presentation/Presentation";
import { isPresentationEntry } from "./presentation/journeys";
import { ErrorBoundary } from "./ErrorBoundary";
import "./i18n";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const presentation = isPresentationEntry(window.location.search);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>{presentation ? <Presentation /> : <App />}</ErrorBoundary>
  </StrictMode>,
);
