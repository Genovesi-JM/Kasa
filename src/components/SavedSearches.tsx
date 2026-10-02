import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import {
  deleteSavedSearch,
  findSavedSearch,
  renameSavedSearch,
  restoreSavedSearch,
  savedSearchSummary,
  saveSearch,
  type SavedSearch,
  type SavedSearchInput,
  type SavedSearchState,
} from "./savedSearchState";
import "./savedSearches.css";

interface SharedSearchProps {
  state: SavedSearchState;
  setState: Dispatch<SetStateAction<SavedSearchState>>;
}

export function SaveSearchButton({
  state,
  setState,
  search,
  label,
  onManage,
}: SharedSearchProps & {
  search: SavedSearchInput;
  label: string;
  onManage: () => void;
}) {
  const existing = findSavedSearch(state, search);
  return (
    <div className="save-search-control">
      <button
        type="button"
        className="soft-button"
        disabled={Boolean(existing)}
        onClick={() => setState((current) => saveSearch(current, search))}
      >
        {existing ? (
          <Check size={15} aria-hidden="true" />
        ) : (
          <Bookmark size={15} aria-hidden="true" />
        )}
        <span aria-live="polite">{existing ? "Search saved" : label}</span>
      </button>
      {existing && (
        <button type="button" className="text-button" onClick={onManage}>
          View saved searches <ArrowRight size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function SavedSearches({
  state,
  setState,
  onOpen,
  onDiscover,
}: SharedSearchProps & {
  onOpen: (search: SavedSearch) => void;
  onDiscover: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [nameError, setNameError] = useState("");
  const [status, setStatus] = useState("");
  const [lastDeleted, setLastDeleted] = useState<SavedSearch | null>(null);
  const renameButtons = useRef(new Map<string, HTMLButtonElement>());
  const sectionTitle = useRef<HTMLHeadingElement>(null);
  const finishEditing = (id: string) => {
    setEditingId(null);
    setNameError("");
    requestAnimationFrame(() => renameButtons.current.get(id)?.focus());
  };

  return (
    <section
      className="saved-search-workspace"
      aria-labelledby="saved-searches-title"
    >
      <header className="saved-searches-heading">
        <div>
          <span className="eyebrow">RETURN TO YOUR SEARCH</span>
          <h2 id="saved-searches-title" tabIndex={-1} ref={sectionTitle}>
            Saved searches <span>{state.records.length}</span>
          </h2>
        </div>
        <Bookmark size={23} aria-hidden="true" />
      </header>
      <p className="saved-search-session-note">
        Saved in this browser session. These searches do not send alerts or
        email notifications.
      </p>
      {state.records.length ? (
        <div className="saved-search-records">
          {state.records.map((record) => {
            const summary = savedSearchSummary(record);
            return (
              <article
                className="saved-search-record card"
                key={record.id}
                aria-label={record.label}
              >
                <div className="saved-search-record-icon">
                  <Search size={21} aria-hidden="true" />
                </div>
                <div className="saved-search-record-main">
                  <span className="saved-search-intent">
                    {record.intent === "Rent"
                      ? "RENTAL SEARCH"
                      : "PROPERTY PURCHASE"}
                  </span>
                  {editingId === record.id ? (
                    <form
                      className="saved-search-rename"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!draftName.trim()) {
                          setNameError("Enter a name for this search.");
                          return;
                        }
                        setState((current) =>
                          renameSavedSearch(current, record.id, draftName),
                        );
                        setStatus("Saved search renamed.");
                        finishEditing(record.id);
                      }}
                    >
                      <label htmlFor={`${record.id}-name`}>Search name</label>
                      <input
                        id={`${record.id}-name`}
                        value={draftName}
                        onChange={(event) => {
                          setDraftName(event.target.value);
                          setNameError("");
                        }}
                        maxLength={80}
                        required
                        autoFocus
                        aria-invalid={Boolean(nameError)}
                        aria-describedby={
                          nameError ? `${record.id}-error` : undefined
                        }
                      />
                      {nameError && (
                        <p id={`${record.id}-error`} role="alert">
                          {nameError}
                        </p>
                      )}
                      <div>
                        <button type="submit" className="button">
                          Save name
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => finishEditing(record.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <h3 id={`${record.id}-title`}>{record.label}</h3>
                  )}
                  <p className="saved-search-record-summary">
                    {summary.slice(0, 4).join(" · ")}
                  </p>
                  <details className="saved-search-filter-details">
                    <summary>View all saved filters</summary>
                    <ul>
                      {summary.map((item, index) => (
                        <li key={`${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </details>
                </div>
                <div className="saved-search-record-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => onOpen(record)}
                  >
                    Open search <ArrowRight size={15} aria-hidden="true" />
                  </button>
                  <div>
                    <button
                      type="button"
                      className="text-button"
                      ref={(node) => {
                        if (node) renameButtons.current.set(record.id, node);
                        else renameButtons.current.delete(record.id);
                      }}
                      aria-label={`Rename ${record.label}`}
                      onClick={() => {
                        setEditingId(record.id);
                        setDraftName(record.label);
                        setNameError("");
                      }}
                    >
                      <Pencil size={14} aria-hidden="true" />
                      Rename
                    </button>
                    <button
                      type="button"
                      className="text-button saved-search-delete"
                      aria-label={`Delete ${record.label}`}
                      onClick={() => {
                        setState((current) =>
                          deleteSavedSearch(current, record.id),
                        );
                        setLastDeleted(record);
                        setStatus(`“${record.label}” removed.`);
                        if (editingId === record.id) setEditingId(null);
                        requestAnimationFrame(() =>
                          sectionTitle.current?.focus(),
                        );
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="saved-searches-empty card">
          <Search size={26} aria-hidden="true" />
          <div>
            <h3>No saved searches yet</h3>
            <p>
              Choose your filters in Discover, then save the search to return to
              the same results.
            </p>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={onDiscover}
          >
            Discover homes <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="saved-search-feedback">
        <p role="status">{status}</p>
        {lastDeleted && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setState((current) => restoreSavedSearch(current, lastDeleted));
              setLastDeleted(null);
              setStatus("Saved search is available again.");
            }}
          >
            Undo delete
          </button>
        )}
      </div>
    </section>
  );
}
