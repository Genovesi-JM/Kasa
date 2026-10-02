import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  FileText,
  FolderOpen,
  HardDrive,
  Plus,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Role } from "../types";
import { matchesSearch } from "../search";
import {
  documentCategoryKeys,
  documentSortKeys,
  documentSourceKeys,
} from "../locales/operations";
import type { OperationsMessage } from "../locales/operations/types";
import {
  addLocalDocuments,
  categoriesForRole,
  DOCUMENT_ACCEPT,
  documentBytes,
  removeDocument,
  restoreDocument,
  restoreDocumentIssue,
  workspaceDocuments,
  workspaceLocalBytes,
  type DocumentCategory,
  type DocumentIssue,
  type DocumentState,
} from "./documentState";
import { DocumentPreview } from "./DocumentPreview";
import { useOperationsI18n } from "./useOperationsI18n";
import "./documents.css";

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
const dateLabel = (value: string, locale: string) =>
  new Date(value).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

interface DocumentsProps {
  role: Role;
  state: DocumentState;
  setState: Dispatch<SetStateAction<DocumentState>>;
}

function WorkspaceDocuments({ role, state, setState }: DocumentsProps) {
  const { tr, locale, issueText } = useOperationsI18n();
  const records = workspaceDocuments(state, role);
  const categories = categoriesForRole(role);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [source, setSource] = useState("All documents");
  const [sort, setSort] = useState("Recently added");
  const [addCategory, setAddCategory] = useState<DocumentCategory>("Other");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<OperationsMessage | null>(null);
  const [errors, setErrors] = useState<DocumentIssue[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const previewButtons = useRef(new Map<string, HTMLButtonElement>());
  const selected = records.find((record) => record.id === selectedId);
  const removed = state.removed[role];
  const restoreError = removed ? restoreDocumentIssue(state, role) : null;
  const localCount = records.filter(
    (record) => record.source === "local",
  ).length;
  const visible = records
    .filter(
      (record) =>
        matchesSearch(
          query,
          record.name,
          record.category,
          tr(documentCategoryKeys[record.category]),
        ) &&
        (category === "All categories" || record.category === category) &&
        (source === "All documents" ||
          record.source === (source === "Local files" ? "local" : "sample")),
    )
    .sort((left, right) =>
      sort === "Document name"
        ? left.name.localeCompare(right.name, locale)
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
        <div
          className="document-library-counts"
          aria-label={tr("documents_totalsLabel")}
        >
          <div>
            <FolderOpen size={20} />
            <span>
              <strong>
                {tr("documents_documentCount", { count: records.length })}
              </strong>
              <small>
                {tr("documents_sampleCount", {
                  count: records.length - localCount,
                })}
              </small>
            </span>
          </div>
          <div>
            <HardDrive size={20} />
            <span>
              <strong>
                {tr("documents_localCount", { count: localCount })}
              </strong>
              <small>
                {tr("documents_storageUse", {
                  used: formatBytes(workspaceLocalBytes(state, role), locale),
                })}
              </small>
            </span>
          </div>
        </div>
        <div className="document-add-controls">
          <label>
            {tr("documents_newCategory")}
            <select
              value={addCategory}
              onChange={(event) =>
                setAddCategory(event.target.value as DocumentCategory)
              }
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {tr(documentCategoryKeys[item])}
                </option>
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
            {tr("documents_addFiles")}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={DOCUMENT_ACCEPT}
          aria-label={tr("documents_chooseFiles")}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            if (files.length) {
              const result = addLocalDocuments(state, role, files, addCategory);
              setState(result.state);
              setErrors(result.issues);
              setFeedback(
                result.added
                  ? {
                      key: "documents_filesAdded",
                      values: { count: result.added },
                    }
                  : { key: "documents_noFilesAdded" },
              );
              if (result.added) resetFilters();
            }
            event.currentTarget.value = "";
            addButton.current?.focus();
          }}
        />
      </div>
      <p className="document-library-note">{tr("documents_libraryScope")}</p>
      <p className="document-library-feedback" role="status" aria-live="polite">
        {feedback && tr(feedback.key, feedback.values)}
      </p>
      {errors.length > 0 && (
        <div className="document-library-error" role="alert">
          <strong>{tr("documents_addErrors")}</strong>
          <ul>
            {errors.map((error, index) => (
              <li key={`${index}-${error.code}`}>{issueText(error)}</li>
            ))}
          </ul>
        </div>
      )}
      {removed && (
        <div className="document-undo">
          <span>
            {tr("documents_removedFromTab")} <strong>{removed.name}</strong>
            {restoreError && <small>{issueText(restoreError)}</small>}
          </span>
          <button
            type="button"
            className="button button-secondary"
            ref={undoButton}
            disabled={Boolean(restoreError)}
            onClick={() => {
              setState((current) => restoreDocument(current, role));
              setFeedback({
                key: "documents_restored",
                values: { name: removed.name },
              });
              requestAnimationFrame(() =>
                (
                  previewButtons.current.get(removed.id) ?? addButton.current
                )?.focus(),
              );
            }}
          >
            <Undo2 size={16} />
            {tr("documents_undoRemove")}
          </button>
        </div>
      )}
      <div className="document-library-filters">
        <label className="document-library-search">
          <Search size={17} />
          <input
            type="search"
            aria-label={tr("documents_search")}
            placeholder={tr("documents_searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label={tr("documents_filterCategory")}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="All categories">
            {tr("documents_allCategories")}
          </option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {tr(documentCategoryKeys[item])}
            </option>
          ))}
        </select>
        <select
          aria-label={tr("documents_filterSource")}
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          {Object.entries(documentSourceKeys).map(([value, key]) => (
            <option key={value} value={value}>
              {tr(key)}
            </option>
          ))}
        </select>
        <select
          aria-label={tr("documents_sort")}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          {Object.entries(documentSortKeys).map(([value, key]) => (
            <option key={value} value={value}>
              {tr(key)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="text-button"
          onClick={resetFilters}
          disabled={!filtered && sort === "Recently added"}
        >
          {tr("documents_resetFilters")}
        </button>
      </div>
      <p
        className="document-library-result-count"
        role="status"
        aria-live="polite"
      >
        {tr("documents_resultCount", {
          visible: visible.length,
          total: records.length,
        })}
      </p>
      <section
        className="card document-library-list"
        aria-label={tr("documents_workspaceDocuments")}
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
              aria-label={tr("documents_previewName", { name: record.name })}
            >
              <span className="document-icon">
                <FileText size={20} />
              </span>
              <span>
                <strong>{record.name}</strong>
                <small>
                  {tr(documentCategoryKeys[record.category])} ·{" "}
                  {formatBytes(documentBytes(record), locale)}
                </small>
                <small>
                  {tr(
                    record.source === "sample"
                      ? "documents_samplePreview"
                      : "documents_localFile",
                  )}{" "}
                  · {dateLabel(record.addedAt, locale)}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="document-remove-button"
              onClick={() => {
                setState((current) => removeDocument(current, role, record.id));
                setErrors([]);
                setFeedback({
                  key: "documents_removedFeedback",
                  values: { name: record.name },
                });
                requestAnimationFrame(() => undoButton.current?.focus());
              }}
              aria-label={tr("documents_removeName", { name: record.name })}
              title={tr("documents_removeTitle")}
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
        {!visible.length && (
          <div className="document-library-empty">
            <FileText size={30} />
            <h2>
              {tr(
                records.length
                  ? "documents_noMatches"
                  : "documents_emptyLibrary",
              )}
            </h2>
            <p>
              {tr(
                records.length
                  ? "documents_noMatchesHint"
                  : "documents_emptyLibraryHint",
              )}
            </p>
            {filtered && (
              <button
                type="button"
                className="button button-secondary"
                onClick={resetFilters}
              >
                {tr("documents_showAll")}
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
