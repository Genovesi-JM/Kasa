import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  Download,
  FileText,
  LockKeyhole,
  RefreshCw,
  Upload,
  UsersRound,
} from "lucide-react";
import { languages, type LanguageCode } from "../i18n";
import {
  AccountClientError,
  type PrivateAccount,
} from "../platform/accountClient";
import {
  workspaceRequest,
  type PropertyAccess,
} from "../platform/workspaceClient";
import {
  privateDocumentListSchema,
  privateDocumentResponseSchema,
  type PrivateDocument,
  type NotificationOpenOutcome,
} from "../platform/documentNotificationContracts";
import {
  fetchPrivateDocument,
  privateFileLimit,
  privateFileTypes,
  readPrivateFile,
} from "../platform/privateDocumentClient";
import { privateRecordsCopy } from "./privateRecordsCopy";
import "./privateRecords.css";

type CopyKey = keyof ReturnType<typeof privateRecordsCopy>;
type Editor = {
  record: PrivateDocument;
  title: string;
  sharing: "private" | "shared";
  recipient: string;
};
const editorDirty = (editor: Editor | null) =>
  !!editor &&
  (editor.title !== editor.record.title ||
    editor.sharing !== editor.record.sharing ||
    (editor.sharing === "shared" &&
      editor.recipient !== (editor.record.recipientAccountId ?? "")));
const editorFor = (record: PrivateDocument): Editor => ({
  record,
  title: record.title,
  sharing: record.sharing,
  recipient: record.recipientAccountId ?? "",
});
function failure(cause: unknown): CopyKey {
  if (!(cause instanceof AccountClientError)) return "error";
  if (cause.code === "INVALID_FILE") return "invalidFile";
  if (cause.code === "INVALID_RECIPIENT") return "invalidRecipient";
  if (cause.code === "LIMIT_REACHED") return "limit";
  if (cause.status === 422) return "validation";
  if (cause.status === 429) return "rate";
  if (cause.status === 404 || cause.code === "FORBIDDEN") return "removed";
  if (cause.status === 0 || cause.status >= 500) return "unavailable";
  return "error";
}

function SharingFields({
  value,
  selected,
  change,
  pending,
  owner,
  access,
  copy,
}: {
  value: "private" | "shared";
  selected: string;
  change: (value: "private" | "shared", recipient: string) => void;
  pending: boolean;
  owner: boolean;
  access: PropertyAccess;
  copy: ReturnType<typeof privateRecordsCopy>;
}) {
  return (
    <>
      <label>
        {copy.sharing}
        <select
          value={value}
          disabled={pending}
          onChange={(event) =>
            change(
              event.target.value as "private" | "shared",
              event.target.value === "private" ? "" : selected,
            )
          }
        >
          <option value="private">{copy.private}</option>
          <option
            value="shared"
            disabled={owner && access.tenants.length === 0}
          >
            {owner ? copy.shared : copy.owner}
          </option>
        </select>
      </label>
      {value === "shared" &&
        (owner ? (
          <label>
            {copy.recipient}
            <select
              value={selected}
              disabled={pending}
              required
              onChange={(event) => change(value, event.target.value)}
            >
              <option value="">{copy.chooseRecipient}</option>
              {access.tenants.map((item) => (
                <option value={item.accountId} key={item.accountId}>
                  {item.displayName} · {item.accountId.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="pw-muted">{copy.ownerNote}</p>
        ))}
      {owner && access.tenants.length === 0 && (
        <p className="pw-muted">{copy.noTenants}</p>
      )}
    </>
  );
}

export default function PropertyDocuments({
  account,
  csrfToken,
  propertyId,
  owner,
  access,
  focusDocumentId,
  focusRequestId,
  onSessionExpired,
  onSessionRefresh,
  onAccessLost,
  onDirtyChange,
  onBusyChange,
  active = true,
  openSection = false,
  onFocusResolved,
}: {
  account: PrivateAccount;
  csrfToken: string;
  propertyId: string;
  owner: boolean;
  access: PropertyAccess;
  focusDocumentId?: string | null;
  focusRequestId?: string;
  onSessionExpired: () => void;
  onSessionRefresh: () => void;
  onAccessLost: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  active?: boolean;
  openSection?: boolean;
  onFocusResolved?: (
    requestId: string,
    outcome: NotificationOpenOutcome,
  ) => void;
}) {
  const { i18n } = useTranslation();
  const language = (
    languages.some((item) => item.code === i18n.language) ? i18n.language : "pt"
  ) as LanguageCode;
  const copy = privateRecordsCopy(language);
  const id = useId();
  const [documents, setDocuments] = useState<PrivateDocument[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<CopyKey | null>(null);
  const [success, setSuccess] = useState<CopyKey | null>(null);
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sharing, setSharing] = useState<"private" | "shared">("private");
  const [recipient, setRecipient] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [conflict, setConflict] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [focusRevision, setFocusRevision] = useState(0);
  const handledFocus = useRef<string | null>(null);
  const authRef = useRef({ accountId: account.id, csrfToken });
  const editorRef = useRef(editor);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const activeRef = useRef(active);
  const focusController = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const section = useRef<HTMLDetailsElement | null>(null);
  const objectUrls = useRef(new Set<string>());
  const dirty =
    !!file || title.length > 0 || editorDirty(editor) || sharing !== "private";

  useEffect(() => {
    authRef.current = { accountId: account.id, csrfToken };
  }, [account.id, csrfToken]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    if (!active || !focusRequestId) focusController.current?.abort();
  }, [active, focusRequestId]);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(pending);
    return () => onBusyChange(false);
  }, [pending, onBusyChange]);
  const updateEditor = useCallback((next: Editor | null) => {
    editorRef.current = next;
    setEditor(next);
  }, []);
  const clearPrivate = useCallback(() => {
    setDocuments([]);
    updateEditor(null);
    setFile(null);
    setTitle("");
    setRecipient("");
    setSharing("private");
    setHighlight(null);
    if (fileInput.current) fileInput.current.value = "";
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, [updateEditor]);
  const report = useCallback(
    (cause: unknown, listRequest = false) => {
      if (cause instanceof AccountClientError && cause.status === 401) {
        clearPrivate();
        onSessionExpired();
        return;
      }
      if (cause instanceof AccountClientError && cause.code === "CSRF_DENIED") {
        setError("sessionChanged");
        onSessionRefresh();
        return;
      }
      if (
        cause instanceof AccountClientError &&
        (cause.status === 404 || cause.code === "FORBIDDEN")
      ) {
        if (listRequest) {
          clearPrivate();
          onAccessLost();
        }
      }
      setError(failure(cause));
    },
    [clearPrivate, onSessionExpired, onSessionRefresh, onAccessLost],
  );

  const readList = useCallback(
    async (
      signal: AbortSignal,
      resetEditor = false,
      target?: string | null,
    ) => {
      const result = await workspaceRequest(
        `properties/${propertyId}/documents`,
        privateDocumentListSchema,
        { ...authRef.current, signal },
      );
      if (signal.aborted) return;
      setDocuments(result.documents);
      const previous = editorRef.current;
      if (previous) {
        const latest = result.documents.find(
          (item) =>
            item.id === previous.record.id && item.uploadedBy === account.id,
        );
        if (!latest) updateEditor(null);
        else if (resetEditor || !editorDirty(previous)) {
          updateEditor(editorFor(latest));
          setConflict(false);
        } else if (latest.version !== previous.record.version)
          setConflict(true);
      }
      if (target) {
        const available = result.documents.find(
          (item) => item.id === target && !item.archived,
        );
        setHighlight(available?.id ?? null);
        if (available) setFocusRevision((value) => value + 1);
        setFilter("active");
        if (!available) setError("removed");
      }
      return result.documents;
    },
    [account.id, propertyId, updateEditor],
  );

  const refresh = useCallback(
    async (
      resetEditor = false,
      target?: string | null,
    ): Promise<NotificationOpenOutcome> => {
      if (busy.current) return "cancelled";
      controller.current?.abort();
      const task = new AbortController();
      controller.current = task;
      if (target) focusController.current = task;
      busy.current = true;
      setPending(true);
      setError(null);
      try {
        const records = await readList(task.signal, resetEditor, target);
        if (task.signal.aborted) return "cancelled";
        setUncertain(false);
        return !target ||
          records?.some((item) => item.id === target && !item.archived)
          ? "opened"
          : "unavailable";
      } catch (cause) {
        if (!task.signal.aborted) report(cause, true);
        return task.signal.aborted
          ? "cancelled"
          : cause instanceof AccountClientError &&
              (cause.status === 404 || cause.code === "FORBIDDEN")
            ? "unavailable"
            : "failed";
      } finally {
        if (controller.current === task) {
          busy.current = false;
          setPending(false);
          setLoading(false);
        }
        if (focusController.current === task) focusController.current = null;
      }
    },
    [readList, report],
  );
  useEffect(() => {
    const focus = () => {
      if (activeRef.current && document.visibilityState === "visible")
        void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const urls = objectUrls.current;
    return () => {
      controller.current?.abort();
      busy.current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!active) return;
    const start = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(start);
  }, [active, refresh]);
  useEffect(() => {
    if (!active || !focusDocumentId || loading || pending) return;
    const request = focusRequestId ?? focusDocumentId;
    if (handledFocus.current === request) return;
    const open = window.setTimeout(() => {
      if (busy.current) return;
      handledFocus.current = request;
      setExpanded(true);
      void refresh(false, focusDocumentId).then((outcome) => {
        window.requestAnimationFrame(() => onFocusResolved?.(request, outcome));
      });
    }, 0);
    return () => window.clearTimeout(open);
  }, [
    active,
    focusDocumentId,
    focusRequestId,
    refresh,
    loading,
    pending,
    onFocusResolved,
  ]);
  useEffect(() => {
    if (!active || !highlight || (!expanded && !openSection)) return;
    const frame = requestAnimationFrame(() =>
      section.current
        ?.querySelector(`[data-document-id="${highlight}"]`)
        ?.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [active, highlight, expanded, openSection, focusRevision]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (busy.current || uncertain) return;
    if (!title.trim() || title.trim().length > 140) {
      setError("validation");
      return;
    }
    if (!file) {
      setError("invalidFile");
      return;
    }
    if (
      sharing === "shared" &&
      owner &&
      !access.tenants.some((item) => item.accountId === recipient)
    ) {
      setError("invalidRecipient");
      return;
    }
    if (editorDirty(editor) && !window.confirm(copy.discard)) return;
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    let sent = false,
      committed = false;
    try {
      const contentBase64 = await readPrivateFile(file, task.signal);
      if (task.signal.aborted) return;
      sent = true;
      const result = await workspaceRequest(
        `properties/${propertyId}/documents`,
        privateDocumentResponseSchema,
        {
          ...authRef.current,
          signal: task.signal,
          method: "POST",
          body: {
            title: title.trim(),
            filename: file.name,
            mimeType: file.type,
            contentBase64,
            sharing,
            ...(sharing === "shared" && owner
              ? { recipientAccountId: recipient }
              : {}),
          },
        },
      );
      if (task.signal.aborted) return;
      committed = true;
      setDocuments((items) => [result.document, ...items]);
      setTitle("");
      setFile(null);
      setSharing("private");
      setRecipient("");
      setUploadOpen(false);
      setFilter("active");
      setHighlight(result.document.id);
      updateEditor(null);
      if (fileInput.current) fileInput.current.value = "";
      setSuccess("uploaded");
      await readList(task.signal);
    } catch (cause) {
      if (!task.signal.aborted) {
        report(cause, true);
        if (
          sent &&
          !committed &&
          cause instanceof AccountClientError &&
          (cause.status === 0 || cause.status >= 500)
        )
          setUncertain(true);
      }
    } finally {
      if (!task.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  }

  async function save(
    record: PrivateDocument,
    values: {
      title: string;
      sharing: "private" | "shared";
      recipient: string;
      archived: boolean;
    },
    message: CopyKey,
  ) {
    if (busy.current || uncertain) return;
    if (!values.title.trim() || values.title.trim().length > 140) {
      setError("validation");
      return;
    }
    if (
      values.sharing === "shared" &&
      owner &&
      !access.tenants.some((item) => item.accountId === values.recipient)
    ) {
      setError("invalidRecipient");
      return;
    }
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    let committed = false;
    try {
      const result = await workspaceRequest(
        `documents/${record.id}`,
        privateDocumentResponseSchema,
        {
          ...authRef.current,
          signal: task.signal,
          method: "PATCH",
          body: {
            version: record.version,
            title: values.title.trim(),
            sharing: values.sharing,
            archived: values.archived,
            ...(values.sharing === "shared" && owner
              ? { recipientAccountId: values.recipient }
              : {}),
          },
        },
      );
      if (task.signal.aborted) return;
      committed = true;
      setDocuments((items) =>
        items.map((item) => (item.id === record.id ? result.document : item)),
      );
      updateEditor(null);
      setConflict(false);
      setSuccess(message);
      setFilter(result.document.archived ? "archived" : "active");
      await readList(task.signal);
    } catch (cause) {
      if (!task.signal.aborted) {
        if (
          cause instanceof AccountClientError &&
          cause.code === "VERSION_CONFLICT"
        ) {
          if (!editorRef.current) updateEditor(editorFor(record));
          setConflict(true);
        } else {
          if (
            cause instanceof AccountClientError &&
            (cause.status === 404 || cause.code === "FORBIDDEN")
          ) {
            setDocuments((items) =>
              items.filter((item) => item.id !== record.id),
            );
            if (editorRef.current?.record.id === record.id) updateEditor(null);
            try {
              await readList(task.signal);
            } catch (listError) {
              if (!task.signal.aborted) report(listError, true);
            }
          }
          if (!task.signal.aborted) report(cause);
        }
        if (
          !committed &&
          cause instanceof AccountClientError &&
          (cause.status === 0 || cause.status >= 500)
        )
          setUncertain(true);
      }
    } finally {
      if (!task.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  }

  async function download(record: PrivateDocument) {
    if (busy.current || record.archived) return;
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const blob = await fetchPrivateDocument(record, account.id, task.signal);
      if (task.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      objectUrls.current.add(url);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = Array.from(record.filename.replace(/[\\/:*?"<>|]/g, "_"))
        .map((character) => (character.charCodeAt(0) < 32 ? "_" : character))
        .join("");
      link.rel = "noopener";
      window.document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        objectUrls.current.delete(url);
      }, 1000);
      setSuccess("downloaded");
    } catch (cause) {
      if (!task.signal.aborted) {
        if (
          cause instanceof AccountClientError &&
          (cause.status === 404 || cause.code === "FORBIDDEN")
        ) {
          setDocuments((current) =>
            current.filter((item) => item.id !== record.id),
          );
          if (editorRef.current?.record.id === record.id) updateEditor(null);
          try {
            await readList(task.signal);
          } catch (listError) {
            if (!task.signal.aborted) report(listError, true);
          }
        }
        if (!task.signal.aborted) report(cause);
      }
    } finally {
      if (!task.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  }

  const visible = documents.filter(
    (record) => record.archived === (filter === "archived"),
  );
  return (
    <details
      className="pw-card private-documents"
      ref={section}
      open={expanded || openSection}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <FileText size={20} aria-hidden="true" />
        {copy.documents}
        <span className="pw-badge">{documents.length}</span>
      </summary>
      <p className="pw-muted">{copy.documentsNote}</p>
      <p className="private-files-warning">{copy.localWarning}</p>
      <div className="private-record-actions">
        <button
          type="button"
          className="pw-secondary"
          disabled={pending}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
        <button
          type="button"
          className="pw-primary"
          disabled={pending}
          aria-expanded={uploadOpen}
          onClick={() => setUploadOpen((open) => !open)}
        >
          <Upload size={16} aria-hidden="true" />
          {copy.upload}
        </button>
      </div>
      {error && (
        <p className="pw-feedback is-error" role="alert">
          {copy[error]}
        </p>
      )}
      {success && (
        <p className="pw-feedback is-success" role="status">
          {copy[success]}
        </p>
      )}
      {uncertain && (
        <p className="pw-feedback is-warning" role="alert">
          {copy.unknown}
        </p>
      )}
      <form
        hidden={!uploadOpen}
        className="pw-form private-document-upload"
        onSubmit={upload}
        noValidate
      >
        <label>
          {copy.title}
          <input
            value={title}
            maxLength={140}
            disabled={pending}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label htmlFor={`${id}-file`}>
          {copy.file}
          <input
            ref={fileInput}
            id={`${id}-file`}
            type="file"
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            disabled={pending}
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              if (
                next &&
                (next.size < 1 ||
                  next.size > privateFileLimit ||
                  !privateFileTypes.some((type) => type === next.type))
              ) {
                setError("invalidFile");
                setFile(null);
                event.target.value = "";
                return;
              }
              setFile(next);
              setError(null);
            }}
            required
          />
        </label>
        <p className="pw-muted">{copy.fileHelp}</p>
        <SharingFields
          value={sharing}
          selected={recipient}
          owner={owner}
          pending={pending}
          access={access}
          copy={copy}
          change={(next, selected) => {
            setSharing(next);
            setRecipient(selected);
          }}
        />
        <button
          className="pw-primary"
          type="submit"
          disabled={pending || uncertain}
        >
          {pending
            ? copy.uploading
            : sharing === "private"
              ? copy.uploadSubmit
              : copy.uploadShared}
        </button>
      </form>
      <div className="private-record-filters">
        <button
          type="button"
          aria-pressed={filter === "active"}
          onClick={() => setFilter("active")}
        >
          {copy.active}
        </button>
        <button
          type="button"
          aria-pressed={filter === "archived"}
          onClick={() => setFilter("archived")}
        >
          {copy.archived}
        </button>
      </div>
      {loading ? (
        <p className="pw-muted" role="status">
          {copy.loading}
        </p>
      ) : visible.length === 0 ? (
        <p className="pw-empty-inline">{copy.emptyDocuments}</p>
      ) : (
        <div className="private-document-list">
          {visible.map((record) => (
            <article
              className={`private-document${highlight === record.id ? " is-highlighted" : ""}`}
              data-document-id={record.id}
              key={record.id}
            >
              <header>
                <FileText size={22} aria-hidden="true" />
                <div>
                  <h3>{record.title}</h3>
                  <p>
                    {record.filename} ·{" "}
                    {new Intl.NumberFormat(language, {
                      maximumFractionDigits: 1,
                    }).format(record.byteSize / 1024)}{" "}
                    KiB
                  </p>
                </div>
                <span className="pw-badge">
                  {record.sharing === "private" ? (
                    <LockKeyhole size={13} aria-hidden="true" />
                  ) : (
                    <UsersRound size={13} aria-hidden="true" />
                  )}
                  {copy[record.sharing]}
                </span>
              </header>
              <p className="pw-muted">
                {copy.uploadedBy}: {record.uploadedByName}
              </p>
              {record.archived ? (
                <p className="pw-muted">{copy.archivedNote}</p>
              ) : (
                record.uploadedBy !== account.id && (
                  <p className="pw-muted">{copy.recipientNote}</p>
                )
              )}
              <div className="private-record-actions">
                {!record.archived && (
                  <button
                    type="button"
                    className="pw-secondary"
                    disabled={pending}
                    onClick={() => void download(record)}
                  >
                    <Download size={16} aria-hidden="true" />
                    {copy.download}
                  </button>
                )}
                {record.uploadedBy === account.id && (
                  <>
                    {!record.archived && (
                      <button
                        type="button"
                        className="pw-secondary"
                        disabled={pending}
                        onClick={() => {
                          if (
                            editorDirty(editor) &&
                            !window.confirm(copy.discard)
                          )
                            return;
                          updateEditor(editorFor(record));
                          setConflict(false);
                        }}
                      >
                        {copy.edit}
                      </button>
                    )}
                    <button
                      type="button"
                      className="pw-secondary"
                      disabled={pending || uncertain}
                      onClick={() => {
                        if (
                          editorDirty(editor) &&
                          !window.confirm(copy.discard)
                        )
                          return;
                        if (
                          window.confirm(
                            record.archived
                              ? copy.restoreConfirm
                              : copy.archiveConfirm,
                          )
                        )
                          void save(
                            record,
                            {
                              title: record.title,
                              sharing: "private",
                              recipient: "",
                              archived: !record.archived,
                            },
                            record.archived ? "restored" : "archivedSuccess",
                          );
                      }}
                    >
                      <Archive size={16} aria-hidden="true" />
                      {record.archived ? copy.restore : copy.archive}
                    </button>
                  </>
                )}
              </div>
              {editor?.record.id === record.id && (
                <form
                  className="pw-form private-document-editor"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!conflict)
                      void save(
                        editor.record,
                        {
                          title: editor.title,
                          sharing: editor.sharing,
                          recipient: editor.recipient,
                          archived: editor.record.archived,
                        },
                        "saved",
                      );
                  }}
                >
                  <label>
                    {copy.title}
                    <input
                      maxLength={140}
                      value={editor.title}
                      disabled={pending}
                      onChange={(event) =>
                        updateEditor({ ...editor, title: event.target.value })
                      }
                      required
                    />
                  </label>
                  {!record.archived && (
                    <SharingFields
                      value={editor.sharing}
                      selected={editor.recipient}
                      owner={owner}
                      pending={pending}
                      access={access}
                      copy={copy}
                      change={(next, selected) =>
                        updateEditor({
                          ...editor,
                          sharing: next,
                          recipient: selected,
                        })
                      }
                    />
                  )}
                  {conflict && (
                    <div className="pw-feedback is-warning" role="alert">
                      <p>{copy.conflict}</p>
                      <button
                        type="button"
                        className="pw-secondary"
                        disabled={pending}
                        onClick={() => void refresh(true)}
                      >
                        {copy.reload}
                      </button>
                    </div>
                  )}
                  <div className="private-record-actions">
                    <button
                      type="submit"
                      className="pw-primary"
                      disabled={
                        pending || uncertain || conflict || !editorDirty(editor)
                      }
                    >
                      {pending ? copy.working : copy.save}
                    </button>
                    <button
                      type="button"
                      className="pw-secondary"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !editorDirty(editor) ||
                          window.confirm(copy.discard)
                        ) {
                          updateEditor(null);
                          setConflict(false);
                        }
                      }}
                    >
                      {copy.cancel}
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </details>
  );
}
