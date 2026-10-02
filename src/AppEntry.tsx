import { lazy, Suspense } from "react";
import App from "./App";
import { isPresentationEntry } from "./entry";

const Presentation = lazy(() => import("./presentation/Presentation"));

export default function AppEntry() {
  return isPresentationEntry(window.location.search) ? (
    <Suspense
      fallback={
        <main className="app-loading" role="status">
          Kasa…
        </main>
      }
    >
      <Presentation />
    </Suspense>
  ) : (
    <App />
  );
}
