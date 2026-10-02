import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, Copy, Share2, X } from "lucide-react";
import type { SpaceVenue } from "../types";
import { appRouteUrl, readAppRoute } from "../navigation";
import { useDialogFocus } from "./useDialogFocus";
import "./spaceVenueShare.css";

interface SpaceVenueShareButtonProps {
  venue: SpaceVenue;
  spaceId?: number;
  label?: string;
}

interface VenueLink {
  url: string | null;
  spaceName: string | null;
}

function useShareCopy() {
  const { i18n } = useTranslation();
  const portuguese = (
    i18n.resolvedLanguage ??
    i18n.language ??
    "pt"
  ).startsWith("pt");
  return (en: string, pt: string) => (portuguese ? pt : en);
}

function VenueShareDialog({
  venue,
  link,
  onClose,
}: {
  venue: SpaceVenue;
  link: VenueLink;
  onClose: () => void;
}) {
  const copy = useShareCopy();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const attempt = useRef(0);
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "manual"
  >("idle");
  const dialog = useDialogFocus<HTMLDivElement>(onClose);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      attempt.current += 1;
    };
  }, []);
  const copyLink = async () => {
    if (!link.url || status === "copying") return;
    const currentAttempt = ++attempt.current;
    setStatus("copying");
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link.url);
      if (active.current && attempt.current === currentAttempt)
        setStatus("copied");
    } catch {
      if (!active.current || attempt.current !== currentAttempt) return;
      setStatus("manual");
      input.current?.focus({ preventScroll: true });
      input.current?.select();
    }
  };
  return createPortal(
    <div
      className="modal-layer space-venue-share-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      ref={dialog}
      tabIndex={-1}
    >
      <button
        type="button"
        className="modal-scrim"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />
      <section className="modal-card space-venue-share-dialog">
        <header>
          <h2 id={`${id}-title`}>
            {copy("Share venue", "Partilhar espaço")} · {venue.name}
          </h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={copy("Close", "Fechar")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="space-venue-share-body">
          {link.url ? (
            <>
              <p id={`${id}-description`}>
                {copy(
                  "This link opens the venue and selected space in the browsing workspace.",
                  "Esta ligação abre o local e o espaço selecionado na área de consulta.",
                )}
              </p>
              {link.spaceName && (
                <p className="space-venue-share-unit">
                  <strong>
                    {copy("Selected space", "Espaço selecionado")}
                  </strong>
                  <span>{link.spaceName}</span>
                </p>
              )}
              <label htmlFor={`${id}-link`}>
                {copy("Venue link", "Ligação do espaço")}
              </label>
              <input
                id={`${id}-link`}
                ref={input}
                type="url"
                dir="ltr"
                value={link.url}
                readOnly
                data-dialog-initial-focus
                spellCheck={false}
                autoComplete="off"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className="button space-venue-share-copy"
                onClick={() => void copyLink()}
                aria-disabled={status === "copying"}
              >
                {status === "copied" ? (
                  <Check size={17} aria-hidden="true" />
                ) : (
                  <Copy size={17} aria-hidden="true" />
                )}
                {status === "copying"
                  ? copy("Copying…", "A copiar…")
                  : copy("Copy link", "Copiar ligação")}
              </button>
              <p
                className="space-venue-share-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {status === "copied"
                  ? copy("Link copied.", "Ligação copiada.")
                  : status === "manual"
                    ? copy(
                        "Clipboard access is unavailable. Select and copy the link above manually.",
                        "O acesso à área de transferência não está disponível. Selecione e copie manualmente a ligação acima.",
                      )
                    : ""}
              </p>
            </>
          ) : (
            <p id={`${id}-description`}>
              {copy(
                "This venue does not have a shareable catalogue link. Close this dialog and choose an available venue.",
                "Este local não tem uma ligação de catálogo que possa partilhar. Feche esta janela e escolha um local disponível.",
              )}
            </p>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function VenueShareControl({
  venue,
  spaceId,
  label,
}: SpaceVenueShareButtonProps) {
  const copy = useShareCopy();
  const [link, setLink] = useState<VenueLink | null>(null);
  const openShare = () => {
    const url = new URL(window.location.href);
    url.search = appRouteUrl(
      {
        ...readAppRoute(""),
        role: "tenant",
        view: "spaceVenue",
        venueId: venue.id,
        spaceId: spaceId ?? null,
        query: "",
      },
      "",
    );
    url.searchParams.delete("intent");
    url.hash = "";
    const route = readAppRoute(url.search);
    const available = route.view === "spaceVenue" && route.venueId === venue.id;
    setLink({
      url: available ? url.href : null,
      spaceName: available
        ? (venue.spaces.find((space) => space.id === route.spaceId)?.name ??
          null)
        : null,
    });
  };
  return (
    <>
      <button
        type="button"
        className="soft-button space-venue-share-trigger"
        onClick={openShare}
      >
        <Share2 size={16} aria-hidden="true" />
        {label ?? copy("Share", "Partilhar")}
      </button>
      {link && (
        <VenueShareDialog
          venue={venue}
          link={link}
          onClose={() => setLink(null)}
        />
      )}
    </>
  );
}

export function SpaceVenueShareButton(props: SpaceVenueShareButtonProps) {
  return (
    <VenueShareControl
      key={`${props.venue.id}:${props.spaceId ?? "default"}`}
      {...props}
    />
  );
}
