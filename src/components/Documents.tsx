import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { Role } from "../types";
import { matchesSearch } from "../search";
import {
  addLocalDocuments,
  categoriesForRole,
  DOCUMENT_ACCEPT,
  documentBytes,
  removeDocument,
  restoreDocument,
  restoreDocumentError,
  workspaceDocuments,
  workspaceLocalBytes,
  type DocumentCategory,
  type DocumentState,
  type WorkspaceDocument,
} from "./documentState";
import { useDialogFocus } from "./useDialogFocus";
import "./documents.css";

const TEXT_PREVIEW_BYTES = 100_000;
const formatBytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.ceil(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function DocumentPreview({
  record,
  onClose,
}: {
  record: WorkspaceDocument;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const id = useId();
  const download = useRef<HTMLAnchorElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const pdf = useRef<HTMLIFrameElement>(null);
  const [text, setText] = useState<string | null>(
    record.source === "sample" ? record.content : null,
  );
  const [error, setError] = useState("");

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
        if (active)
          setError(
            "This text file could not be previewed. You can still download your original file.",
          );
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
              {record.source === "sample" ? "SAMPLE PREVIEW" : "LOCAL FILE"}
            </span>
            <h2 id={`${id}-title`}>{record.name}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close document preview"
            data-dialog-initial-focus
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="modal-body document-preview-body">
          <p id={`${id}-scope`} className="document-library-note">
            {record.source === "sample"
              ? "An explanatory example, not a signed or verified document."
              : "Previewing your selected file in this tab. Nothing has been uploaded or verified."}
          </p>
          <div className="document-preview-meta">
            <span>
              {record.category} · {formatBytes(documentBytes(record))}
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
              {record.source === "sample"
                ? "Download sample text"
                : "Download file"}
            </a>
          </div>
          {error && (
            <p className="document-library-error" role="alert">
              {error}
            </p>
          )}
          {record.kind === "text" && (
            <>
              {text === null && !error ? (
                <p role="status">Reading local text…</p>
              ) : (
                <pre
                  className="document-text-preview"
                  aria-label="Document text"
                >
                  {text}
                </pre>
              )}
              {record.source === "local" &&
                record.file.size > TEXT_PREVIEW_BYTES && (
                  <p className="document-library-note">
                    Preview shows the first 100 KB. Download the file to read
                    the full document.
                  </p>
                )}
            </>
          )}
          {record.kind === "image" && (
            <img
              ref={image}
              className="document-image-preview"
              alt={`Preview of ${record.name}`}
              onError={() =>
                setError(
                  "This image could not be previewed. You can still download your original file.",
                )
              }
            />
          )}
          {record.kind === "pdf" && (
            <>
              <iframe
                ref={pdf}
                className="document-pdf-preview"
                title={`PDF preview: ${record.name}`}
              />
              <p className="document-library-note">
                If your browser cannot display this PDF, use Download file to
                open it in your PDF reader.
              </p>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

interface DocumentsProps {
  role: Role;
  state: DocumentState;
  setState: Dispatch<SetStateAction<DocumentState>>;
}

function WorkspaceDocuments({ role, state, setState }: DocumentsProps) {
  const records = workspaceDocuments(state, role);
  const categories = categoriesForRole(role);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [source, setSource] = useState("All documents");
  const [sort, setSort] = useState("Recently added");
  const [addCategory, setAddCategory] = useState<DocumentCategory>("Other");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const previewButtons = useRef(new Map<string, HTMLButtonElement>());
  const selected = records.find((record) => record.id === selectedId);
  const removed = state.removed[role];
  const restoreError = removed ? restoreDocumentError(state, role) : null;
  const localCount = records.filter(
    (record) => record.source === "local",
  ).length;
  const visible = records
    .filter(
      (record) =>
        matchesSearch(query, record.name, record.category) &&
        (category === "All categories" || record.category === category) &&
        (source === "All documents" ||
          record.source === (source === "Local files" ? "local" : "sample")),
    )
    .sort((left, right) =>
      sort === "Document name"
        ? left.name.localeCompare(right.name)
        : sort === "Largest first"
          ? documentBytes(right) - documentBytes(left)
          : right.addedAt.localeCompare(left.addedAt) ||
            right.id.localeCompare(left.id, undefined, { numeric: true }),
    );
  const resetFilters = () => {
    setQuery("");
    setCategory("All categories");
    setSource("All documents");
    setSort("Recently added");
  };
  const filtered = Boolean(
    query || category !== "All categories" || source !== "All documents",
  );

  return (
    <div className="page-stack document-library">
      <div className="document-library-header">
        <div className="document-library-counts" aria-label="Document totals">
          <div>
            <FolderOpen size={20} />
            <span>
              <strong>{records.length} documents</strong>
              <small>{records.length - localCount} sample previews</small>
            </span>
          </div>
          <div>
            <HardDrive size={20} />
            <span>
              <strong>
                {localCount} local {localCount === 1 ? "file" : "files"}
              </strong>
              <small>
                {formatBytes(workspaceLocalBytes(state, role))} of 50 MB
              </small>
            </span>
          </div>
        </div>
        <div className="document-add-controls">
          <label>
            Category for new files
            <select
              value={addCategory}
              onChange={(event) =>
                setAddCategory(event.target.value as DocumentCategory)
              }
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            ref={addButton}
            onClick={() => input.current?.click()}
          >
            <Plus size={17} />
            Add local files
          </button>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={DOCUMENT_ACCEPT}
          aria-label="Choose local documents"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            if (files.length) {
              const result = addLocalDocuments(state, role, files, addCategory);
              setState(result.state);
              setErrors(result.errors);
              setFeedback(
                result.added
                  ? `${result.added} ${result.added === 1 ? "file added" : "files added"} in this tab. Nothing was uploaded.`
                  : "No files were added.",
              );
              if (result.added) resetFilters();
            }
            event.currentTarget.value = "";
            addButton.current?.focus();
          }}
        />
      </div>
      <p className="document-library-note">
        Choose PDF, PNG, JPEG, GIF, WebP or text files (TXT, MD, CSV), up to 10
        MB each. Local files stay in memory in this tab; reloading clears them.
        No upload, signing or verification takes place.
      </p>
      <p className="document-library-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
      {errors.length > 0 && (
        <div className="document-library-error" role="alert">
          <strong>Some files could not be added</strong>
          <ul>
            {errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {removed && (
        <div className="document-undo">
          <span>
            Removed from this tab: <strong>{removed.name}</strong>
            {restoreError && <small>{restoreError}</small>}
          </span>
          <button
            type="button"
            className="button button-secondary"
            ref={undoButton}
            disabled={Boolean(restoreError)}
            onClick={() => {
              setState((current) => restoreDocument(current, role));
              setFeedback(`${removed.name} restored in this tab.`);
              requestAnimationFrame(() =>
                (
                  previewButtons.current.get(removed.id) ?? addButton.current
                )?.focus(),
              );
            }}
          >
            <Undo2 size={16} />
            Undo remove
          </button>
        </div>
      )}
      <div className="document-library-filters">
        <label className="document-library-search">
          <Search size={17} />
          <input
            type="search"
            aria-label="Search documents"
            placeholder="Search name or category"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filter document category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option>All categories</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Filter document source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option>All documents</option>
          <option>Local files</option>
          <option>Sample previews</option>
        </select>
        <select
          aria-label="Sort documents"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option>Recently added</option>
          <option>Document name</option>
          <option>Largest first</option>
        </select>
        <button
          type="button"
          className="text-button"
          onClick={resetFilters}
          disabled={!filtered && sort === "Recently added"}
        >
          Reset filters
        </button>
      </div>
      <p
        className="document-library-result-count"
        role="status"
        aria-live="polite"
      >
        {visible.length} of {records.length} documents
      </p>
      <section
        className="card document-library-list"
        aria-label="Workspace documents"
      >
        {visible.map((record) => (
          <article className="document-library-row" key={record.id}>
            <button
              type="button"
              className="document-library-open"
              ref={(element) => {
                if (element) previewButtons.current.set(record.id, element);
                else previewButtons.current.delete(record.id);
              }}
              onClick={() => setSelectedId(record.id)}
              aria-label={`Preview ${record.name}`}
            >
              <span className="document-icon">
                <FileText size={20} />
              </span>
              <span>
                <strong>{record.name}</strong>
                <small>
                  {record.category} · {formatBytes(documentBytes(record))}
                </small>
                <small>
                  {record.source === "sample" ? "Sample preview" : "Local file"}{" "}
                  · {dateLabel(record.addedAt)}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="document-remove-button"
              onClick={() => {
                setState((current) => removeDocument(current, role, record.id));
                setErrors([]);
                setFeedback(
                  `${record.name} removed from this tab. The original file on your device is unchanged.`,
                );
                requestAnimationFrame(() => undoButton.current?.focus());
              }}
              aria-label={`Remove ${record.name} from this tab`}
              title="Remove from this tab"
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
        {!visible.length && (
          <div className="document-library-empty">
            <FileText size={30} />
            <h2>
              {records.length
                ? "No documents match"
                : "No documents in this workspace"}
            </h2>
            <p>
              {records.length
                ? "Change the filters or try another name."
                : "Add a local file to start your library."}
            </p>
            {filtered && (
              <button
                type="button"
                className="button button-secondary"
                onClick={resetFilters}
              >
                Show all documents
              </button>
            )}
          </div>
        )}
      </section>
      {selected && (
        <DocumentPreview
          key={selected.id}
          record={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

export function Documents(props: DocumentsProps) {
  return <WorkspaceDocuments key={props.role} {...props} />;
}
