import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Globe2, LifeBuoy, Settings, X } from "lucide-react";
import { languages, setLanguage, type LanguageCode } from "../i18n";
import type { Role, View } from "../types";
import { useDialogFocus } from "./useDialogFocus";
import { workspaceToolsCopy } from "./workspaceToolsCopy";
import "./workspaceTools.css";

export function WorkspaceTools({
  mode,
  role,
  workspace,
  reduceMotion,
  onReduceMotion,
  onClose,
  onNavigate,
}: {
  mode: "settings" | "help";
  role: Role;
  workspace: { name: string; label: string };
  reduceMotion: boolean;
  onReduceMotion: (value: boolean) => boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
}) {
  const { t, i18n } = useTranslation();
  const copy = workspaceToolsCopy(i18n.resolvedLanguage || "pt");
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const id = useId();
  const [feedback, setFeedback] = useState<"saved" | "session" | null>(null);
  const propertyWorkspace = role === "tenant" || role === "landlord";
  const links: { view: View; title: string; description: string }[] = [
    {
      view: "discover",
      title: copy.homes,
      description: copy.homesNote,
    },
    {
      view: "messages",
      title: copy.messages,
      description: copy.messagesNote,
    },
    ...(propertyWorkspace
      ? [
          {
            view: "maintenance" as const,
            title: copy.maintenance,
            description: copy.maintenanceNote,
          },
          {
            view: "rent" as const,
            title: copy.rent,
            description: copy.rentNote,
          },
        ]
      : []),
    {
      view: "documents",
      title: copy.documents,
      description: copy.documentsNote,
    },
  ];

  return createPortal(
    <div
      className="modal-layer workspace-tools-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      ref={dialogRef}
    >
      <button
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="modal-card workspace-tools-card">
        <header>
          <div>
            <span className="eyebrow">KASA</span>
            <h2 id={`${id}-title`}>
              {mode === "settings" ? (
                <Settings size={22} />
              ) : (
                <LifeBuoy size={22} />
              )}
              {t(mode === "settings" ? "common.settings" : "nav.help")}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("common.close")}
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body workspace-tools-body">
          {mode === "settings" ? (
            <>
              <section className="workspace-tools-identity">
                <span className="eyebrow">{copy.current}</span>
                <strong>{workspace.name}</strong>
                <span>{workspace.label}</span>
              </section>
              <label className="workspace-tools-language">
                <span>
                  <Globe2 size={18} /> {t("language.label")}
                </span>
                <select
                  aria-label={t("language.label")}
                  value={i18n.resolvedLanguage || "pt"}
                  onChange={(event) => {
                    void setLanguage(event.target.value as LanguageCode);
                  }}
                >
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-tools-toggle">
                <span>
                  <strong>{copy.motion}</strong>
                  <small>{copy.motionNote}</small>
                </span>
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(event) => {
                    const persisted = onReduceMotion(event.target.checked);
                    setFeedback(persisted ? "saved" : "session");
                  }}
                />
              </label>
              {feedback && (
                <p className="workspace-tools-feedback" role="status">
                  {copy[feedback]}
                </p>
              )}
              <p className="workspace-tools-note">{copy.storageNote}</p>
            </>
          ) : (
            <>
              <p>{copy.choose}</p>
              <div className="workspace-help-links">
                {links.map((link) => (
                  <button
                    key={link.view}
                    onClick={() => {
                      onClose();
                      onNavigate(link.view);
                    }}
                  >
                    <span>
                      <strong>{link.title}</strong>
                      <small>{link.description}</small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
              <details>
                <summary>{copy.savedQuestion}</summary>
                <p>{copy.savedAnswer}</p>
              </details>
              <details>
                <summary>{copy.paymentsQuestion}</summary>
                <p>{copy.paymentsAnswer}</p>
              </details>
              <details>
                <summary>{copy.workspaceQuestion}</summary>
                <p>{copy.workspaceAnswer}</p>
              </details>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
