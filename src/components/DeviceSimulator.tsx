import { useEffect, useState } from "react";
import { Columns2, Smartphone, X } from "lucide-react";
import type { Role, View } from "../types";

type SimulatorMode = "compare" | "ios" | "android";

const deviceProfiles = {
  ios: { name: "iPhone 15", viewport: "393 × 852" },
  android: { name: "Pixel 8", viewport: "412 × 915" },
} as const;

interface DeviceSimulatorProps {
  role: Role;
  view: View;
  onClose: () => void;
  labels: {
    title: string;
    subtitle: string;
    compare: string;
    ios: string;
    android: string;
    close: string;
  };
}

function DeviceFrame({
  platform,
  role,
  view,
}: {
  platform: "ios" | "android";
  role: Role;
  view: View;
}) {
  const profile = deviceProfiles[platform];
  const source = `/?device=${platform}&role=${role}&view=${view}`;
  return (
    <article className={`device-preview ${platform}`}>
      <header>
        <span>
          {platform === "ios" ? "iOS" : "Android"} · {profile.name}
        </span>
        <i>{profile.viewport}</i>
      </header>
      <div className="device-hardware">
        {platform === "ios" ? (
          <div className="dynamic-island" />
        ) : (
          <div className="android-camera" />
        )}
        <iframe title={`Kasa ${platform} simulator`} src={source} />
        {platform === "ios" ? (
          <div className="ios-home-indicator" />
        ) : (
          <div className="android-system-nav">
            <i /> <b /> <span />
          </div>
        )}
      </div>
    </article>
  );
}

export function DeviceSimulator({
  role,
  view,
  onClose,
  labels,
}: DeviceSimulatorProps) {
  const [mode, setMode] = useState<SimulatorMode>("compare");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="device-simulator-layer"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
    >
      <div className="device-simulator-panel">
        <header className="device-simulator-header">
          <div>
            <span className="eyebrow">KASA DEVICE LAB</span>
            <h2>{labels.title}</h2>
            <p>{labels.subtitle}</p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={labels.close}
          >
            <X />
          </button>
        </header>
        <nav className="device-mode-switcher" aria-label={labels.title}>
          <button
            className={mode === "compare" ? "active" : ""}
            onClick={() => setMode("compare")}
            aria-pressed={mode === "compare"}
          >
            <Columns2 size={16} /> {labels.compare}
          </button>
          <button
            className={mode === "ios" ? "active" : ""}
            onClick={() => setMode("ios")}
            aria-pressed={mode === "ios"}
          >
            <Smartphone size={16} /> {labels.ios}
          </button>
          <button
            className={mode === "android" ? "active" : ""}
            onClick={() => setMode("android")}
            aria-pressed={mode === "android"}
          >
            <Smartphone size={16} /> {labels.android}
          </button>
        </nav>
        <section className={`device-stage ${mode}`}>
          {(mode === "compare" || mode === "ios") && (
            <DeviceFrame platform="ios" role={role} view={view} />
          )}
          {(mode === "compare" || mode === "android") && (
            <DeviceFrame platform="android" role={role} view={view} />
          )}
        </section>
      </div>
    </div>
  );
}
