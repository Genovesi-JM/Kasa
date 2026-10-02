import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { documentCategoryKeys } from "../locales/operations";
import type { OperationsKey } from "../locales/operations/types";
import {
  documentBytes,
  type DocumentCategory,
  type DocumentContent,
} from "./documentState";
import { useDialogFocus } from "./useDialogFocus";
import { useOperationsI18n } from "./useOperationsI18n";
import "./documents.css";

export type DocumentPreviewRecord = DocumentContent & {
  id: string;
  name: string;
  category?: DocumentCategory;
};

interface DocumentPreviewProps {
  record: DocumentPreviewRecord;
  onClose: () => void;
}

const TEXT_PREVIEW_BYTES = 100_000;
const formatBytes = (bytes: number, locale: string) => {
  const unit =
    bytes < 1024 ? "byte" : bytes < 1024 * 1024 ? "kilobyte" : "megabyte";
  const value =
    unit === "byte"
      ? bytes
      : unit === "kilobyte"
        ? Math.ceil(bytes / 1024)
        : bytes / (1024 * 1024);
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: unit === "megabyte" ? 1 : 0,
  }).format(value);
};

function DocumentPreviewContent({ record, onClose }: DocumentPreviewProps) {
  const { tr, locale } = useOperationsI18n();
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const id = useId();
  const download = useRef<HTMLAnchorElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const pdf = useRef<HTMLIFrameElement>(null);
  const [text, setText] = useState<string | null>(
    record.source === "sample" ? record.content : null,
  );
  const [error, setError] = useState<OperationsKey | null>(null);

  useLayoutEffect(() => {
    const blob =
      record.source === "sample"
        ? new Blob([record.content], { type: "text/plain;charset=utf-8" })
        : new Blob([record.file], { type: record.mimeType });
    const url = URL.createObjectURL(blob);
    if (download.current) download.current.href = url;
    if (image.current) image.current.src = url;
    if (pdf.current) pdf.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [record]);

  useEffect(() => {
    if (record.source !== "local" || record.kind !== "text") return;
    let active = true;
    void record.file
      .slice(0, TEXT_PREVIEW_BYTES)
      .text()
      .then((value) => {
        if (active) setText(value);
      })
      .catch(() => {
        if (active) setError("documents_textReadError");
      });
    return () => {
      active = false;
    };
  }, [record]);

  return createPortal(
    <div
      className="modal-layer document-preview-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-scope`}
      ref={dialogRef}
      tabIndex={-1}
    >
      <button
        type="button"
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="modal-card document-preview-card">
        <header>
          <div>
            <span className="eyebrow">
              {tr(
                record.source === "sample"
                  ? "documents_samplePreview"
                  : "documents_localFile",
              )}
            </span>
            <h2 id={`${id}-title`}>{record.name}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={tr("documents_closePreview")}
            data-dialog-initial-focus
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="modal-body document-preview-body">
          <p id={`${id}-scope`} className="document-library-note">
            {tr(
              record.source === "sample"
                ? "documents_sampleScope"
                : "documents_localScope",
            )}
          </p>
          <div className="document-preview-meta">
            <span>
              {record.category && (
                <>{tr(documentCategoryKeys[record.category])} · </>
              )}
              {formatBytes(documentBytes(record), locale)}
            </span>
            <a
              ref={download}
              className="button button-secondary"
              download={
                record.source === "sample"
                  ? `${record.name}.txt`
                  : record.file.name
              }
            >
              <Download size={16} />
              {tr(
                record.source === "sample"
                  ? "documents_downloadSample"
                  : "documents_downloadFile",
              )}
            </a>
          </div>
          {error && (
            <p className="document-library-error" role="alert">
              {tr(error)}
            </p>
          )}
          {record.kind === "text" && (
            <>
              {text === null && !error ? (
                <p role="status">{tr("documents_readingText")}</p>
              ) : (
                <pre
                  className="document-text-preview"
                  aria-label={tr("documents_documentText")}
                >
                  {text}
                </pre>
              )}
              {record.source === "local" &&
                record.file.size > TEXT_PREVIEW_BYTES && (
                  <p className="document-library-note">
                    {tr("documents_truncatedText")}
                  </p>
                )}
            </>
          )}
          {record.kind === "image" && (
            <img
              ref={image}
              className="document-image-preview"
              alt={tr("documents_previewName", { name: record.name })}
              onError={() => setError("documents_imageReadError")}
            />
          )}
          {record.kind === "pdf" && (
            <>
              <iframe
                ref={pdf}
                className="document-pdf-preview"
                title={tr("documents_pdfPreview", { name: record.name })}
              />
              <p className="document-library-note">
                {tr("documents_pdfFallback")}
              </p>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function DocumentPreview(props: DocumentPreviewProps) {
  return <DocumentPreviewContent key={props.record.id} {...props} />;
}
