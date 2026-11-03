import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  FileText,
  Plus,
  RefreshCw,
  WalletCards,
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
  type PrivateDocument,
  type NotificationOpenOutcome,
} from "../platform/documentNotificationContracts";
import {
  persistedRentListSchema,
  persistedRentDetailSchema,
  persistedRentMutationSchema,
  parsePersistedRentAmount,
  persistedRentAmountInput,
  rentTodayInLuanda,
  validRentDueDate,
  validRentTransferDate,
  validRentReference,
  type PersistedRentRecord,
  type PersistedRentSummary,
  type PersistedRentSnapshot,
  type PersistedRentStatus,
} from "../platform/persistedRentContracts";
import { propertyRentCopy } from "./propertyRentCopy";
import "./propertyRentRecords.css";

type Copy = ReturnType<typeof propertyRentCopy>;
type CopyKey = keyof Copy;
type EditorMode = "transfer" | "terms" | "review" | "void";
type Draft = {
  record: PersistedRentRecord;
  mode: EditorMode;
  amount: string;
  date: string;
  reference: string;
  note: string;
  evidence: string;
  reason: string;
  checked: boolean;
};
type Mutation = {
  path: string;
  method: "POST" | "PATCH";
  body: Record<string, unknown>;
  message: CopyKey;
  creation: boolean;
};
const statusKeys: Record<PersistedRentStatus, CopyKey> = {
  awaiting_transfer: "awaitingTransfer",
  awaiting_confirmation: "awaitingConfirmation",
  needs_correction: "needsCorrection",
  confirmed: "confirmed",
  voided: "cancelled",
};
const historyKeys: Record<
  PersistedRentRecord["history"][number]["kind"],
  CopyKey
> = {
  created: "eventCreated",
  terms_updated: "eventUpdated",
  transfer_reported: "eventTransfer",
  correction_requested: "eventCorrection",
  confirmed: "eventConfirmed",
  voided: "eventCancelled",
};
function newDraft(record: PersistedRentRecord, mode: EditorMode): Draft {
  return {
    record,
    mode,
    amount:
      mode === "terms"
        ? persistedRentAmountInput(record.amountDueMinor)
        : record.transfer
          ? persistedRentAmountInput(record.transfer.amountMinor)
          : "",
    date:
      mode === "terms" ? record.dueOn : (record.transfer?.transferredOn ?? ""),
    reference: record.transfer?.reference ?? "",
    note: record.transfer?.note ?? "",
    evidence: record.transfer?.evidenceDocumentId ?? "",
    reason: "",
    checked: false,
  };
}
function hasEdits(draft: Draft | null): boolean {
  if (!draft) return false;
  const original = newDraft(draft.record, draft.mode);
  return (
    [
      "amount",
      "date",
      "reference",
      "note",
      "evidence",
      "reason",
      "checked",
    ] as const
  ).some((key) => draft[key] !== original[key]);
}
function errorKey(cause: unknown): CopyKey {
  if (!(cause instanceof AccountClientError)) return "error";
  if (cause.code === "DUPLICATE_PERIOD") return "duplicate";
  if (cause.code === "LIMIT_REACHED") return "limit";
  if (cause.code === "INVALID_EVIDENCE") return "evidenceInvalid";
  if (cause.code === "AMOUNT_MISMATCH") return "mismatch";
  if (["INVALID_STATE", "IDEMPOTENCY_CONFLICT"].includes(cause.code))
    return "invalidState";
  if (cause.status === 422) return "validation";
  if (cause.status === 429) return "rate";
  if (cause.status === 404 || cause.code === "FORBIDDEN") return "removed";
  if (cause.status === 0 || cause.status >= 500) return "unavailable";
  return "error";
}
function Snapshot({
  snapshot,
  copy,
  money,
  date,
}: {
  snapshot: PersistedRentSnapshot;
  copy: Copy;
  money: (value: number) => string;
  date: (value: string) => string;
}) {
  return (
    <dl className="rent-record-facts">
      <div>
        <dt>{copy.expected}</dt>
        <dd>{money(snapshot.amountDueMinor)}</dd>
      </div>
      <div>
        <dt>{copy.dueOn}</dt>
        <dd>{date(snapshot.dueOn)}</dd>
      </div>
      <div className="is-wide">
        <dt>{copy.details}</dt>
        <dd>{copy[statusKeys[snapshot.status]]}</dd>
      </div>
      {snapshot.transfer && (
        <>
          <div>
            <dt>{copy.transferredAmount}</dt>
            <dd>{money(snapshot.transfer.amountMinor)}</dd>
          </div>
          <div>
            <dt>{copy.transferDate}</dt>
            <dd>{date(snapshot.transfer.transferredOn)}</dd>
          </div>
          <div className="is-wide">
            <dt>{copy.reference}</dt>
            <dd>{snapshot.transfer.reference}</dd>
          </div>
          {snapshot.transfer.note && (
            <div className="is-wide">
              <dt>{copy.transferNote}</dt>
              <dd>{snapshot.transfer.note}</dd>
            </div>
          )}
        </>
      )}
      {snapshot.correctionReason && (
        <div className="is-wide">
          <dt>{copy.correctionReason}</dt>
          <dd>{snapshot.correctionReason}</dd>
        </div>
      )}
      {snapshot.voidReason && (
        <div className="is-wide">
          <dt>{copy.voidReason}</dt>
          <dd>{snapshot.voidReason}</dd>
        </div>
      )}
    </dl>
  );
}

export default function PropertyRentRecords({
  account,
  csrfToken,
  propertyId,
  owner,
  access,
  focusRecordId,
  focusRequestId,
  onSessionExpired,
  onSessionRefresh,
  onAccessLost,
  onDirtyChange,
  onBusyChange,
  onOpenDocument,
  propertyBusy = false,
  active = true,
  openSection = false,
  onFocusResolved,
  onSelectedRecordChange,
}: {
  account: PrivateAccount;
  csrfToken: string;
  propertyId: string;
  owner: boolean;
  access: PropertyAccess;
  focusRecordId?: string | null;
  focusRequestId?: string;
  onSessionExpired: () => void;
  onSessionRefresh: () => void;
  onAccessLost: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onOpenDocument: (documentId: string) => void;
  propertyBusy?: boolean;
  active?: boolean;
  openSection?: boolean;
  onFocusResolved?: (
    requestId: string,
    outcome: NotificationOpenOutcome,
  ) => void;
  onSelectedRecordChange?: (recordId: string | null) => void;
}) {
  const { i18n } = useTranslation();
  const language = (
    languages.some((item) => item.code === i18n.language) ? i18n.language : "pt"
  ) as LanguageCode;
  const copy = propertyRentCopy(language);
  const [records, setRecords] = useState<PersistedRentSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [record, setRecord] = useState<PersistedRentRecord | null>(null);
  const [documents, setDocuments] = useState<PrivateDocument[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<CopyKey | null>(null);
  const [success, setSuccess] = useState<CopyKey | null>(null);
  const [status, setStatus] = useState<"all" | PersistedRentStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [period, setPeriod] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [expected, setExpected] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmationVersion, setConfirmationVersion] = useState<number | null>(
    null,
  );
  const [focusRevision, setFocusRevision] = useState(0);
  const auth = useRef({ accountId: account.id, csrfToken });
  const draftRef = useRef(draft);
  const recordRef = useRef(record);
  const pendingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const activeRef = useRef(active);
  const focusController = useRef<AbortController | null>(null);
  const retryMutation = useRef<Mutation | null>(null);
  const handledFocus = useRef<string | null>(null);
  const detailElement = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    if (!active || !focusRequestId) focusController.current?.abort();
  }, [active, focusRequestId]);
  useEffect(() => {
    onSelectedRecordChange?.(record?.id ?? null);
    return () => onSelectedRecordChange?.(null);
  }, [record?.id, onSelectedRecordChange]);
  const createDirty = !!(tenantId || period || dueOn || expected);
  const dirty = createDirty || hasEdits(draft) || uncertain;
  const blocked = pending || uncertain || propertyBusy;
  const money = (value: number) =>
    new Intl.NumberFormat(language, {
      style: "currency",
      currency: "AOA",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  const date = (value: string) =>
    new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${value}T12:00:00Z`));
  const month = (value: string) =>
    new Intl.DateTimeFormat(language, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}-01T12:00:00Z`));
  useEffect(() => {
    auth.current = { accountId: account.id, csrfToken };
  }, [account.id, csrfToken]);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(pending || uncertain);
    return () => onBusyChange(false);
  }, [pending, uncertain, onBusyChange]);
  const updateDraft = useCallback((value: Draft | null) => {
    draftRef.current = value;
    setDraft(value);
    setConfirmationVersion(null);
  }, []);
  const updateRecord = useCallback((value: PersistedRentRecord | null) => {
    recordRef.current = value;
    setRecord(value);
  }, []);
  const clearPrivate = useCallback(() => {
    setRecords([]);
    setNextCursor(null);
    setDocuments([]);
    updateRecord(null);
    updateDraft(null);
    setTenantId("");
    setPeriod("");
    setDueOn("");
    setExpected("");
    setUncertain(false);
    retryMutation.current = null;
  }, [updateRecord, updateDraft]);
  const report = useCallback(
    (cause: unknown, propertyRequest = false) => {
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
        propertyRequest &&
        cause instanceof AccountClientError &&
        (cause.status === 404 || cause.code === "FORBIDDEN")
      ) {
        clearPrivate();
        onAccessLost();
      }
      setError(errorKey(cause));
    },
    [clearPrivate, onAccessLost, onSessionExpired, onSessionRefresh],
  );
  const readDetail = useCallback(
    async (signal: AbortSignal, recordId: string, resetDraft = false) => {
      const payload = await workspaceRequest(
        `rent-records/${recordId}`,
        persistedRentDetailSchema,
        { ...auth.current, signal },
      );
      if (signal.aborted) return;
      if (payload.record.propertyId !== propertyId)
        throw new AccountClientError(502, "invalid_response");
      updateRecord(payload.record);
      const previous = draftRef.current;
      if (previous && previous.record.id === recordId) {
        if (resetDraft) {
          updateDraft(null);
          setConflict(false);
        } else if (hasEdits(previous) || retryMutation.current) {
          if (
            previous.record.version !== payload.record.version ||
            previous.record.tenantAccessActive !==
              payload.record.tenantAccessActive
          )
            setConflict(true);
        } else {
          updateDraft(newDraft(payload.record, previous.mode));
          setConflict(false);
        }
      }
      return payload.record;
    },
    [propertyId, updateRecord, updateDraft],
  );
  const readPage = useCallback(
    async (signal: AbortSignal, cursor?: string) => {
      const result = await workspaceRequest(
        `properties/${propertyId}/rent-records${cursor ? `?before=${encodeURIComponent(cursor)}` : ""}`,
        persistedRentListSchema,
        { ...auth.current, signal },
      );
      if (signal.aborted) return;
      if (result.records.some((item) => item.propertyId !== propertyId))
        throw new AccountClientError(502, "invalid_response");
      setRecords((previous) =>
        cursor
          ? [
              ...new Map(
                [...previous, ...result.records].map((item) => [item.id, item]),
              ).values(),
            ]
          : result.records,
      );
      setNextCursor(result.nextCursor);
    },
    [propertyId],
  );
  const readEvidence = useCallback(
    async (signal: AbortSignal) => {
      const result = await workspaceRequest(
        `properties/${propertyId}/documents`,
        privateDocumentListSchema,
        { ...auth.current, signal },
      );
      if (!signal.aborted) setDocuments(result.documents);
    },
    [propertyId],
  );
  const refresh = useCallback(
    async (resetDraft = false, cursor?: string) => {
      if (pendingRef.current) return;
      controller.current?.abort();
      const task = new AbortController();
      controller.current = task;
      pendingRef.current = true;
      setPending(true);
      setError(null);
      try {
        await readPage(task.signal, cursor);
        if (task.signal.aborted) return;
        if (!cursor) {
          await readEvidence(task.signal);
          if (task.signal.aborted) return;
          if (recordRef.current) {
            try {
              await readDetail(task.signal, recordRef.current.id, resetDraft);
            } catch (cause) {
              if (task.signal.aborted) return;
              if (
                cause instanceof AccountClientError &&
                (cause.status === 404 || cause.code === "FORBIDDEN")
              ) {
                updateRecord(null);
                updateDraft(null);
              }
              report(cause);
              return;
            }
          }
        }
      } catch (cause) {
        if (!task.signal.aborted) report(cause, true);
      } finally {
        if (!task.signal.aborted) {
          pendingRef.current = false;
          setPending(false);
          setLoading(false);
        }
      }
    },
    [readPage, readEvidence, readDetail, updateRecord, updateDraft, report],
  );
  useEffect(() => {
    const focus = () => {
      if (activeRef.current && document.visibilityState === "visible")
        void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      controller.current?.abort();
      pendingRef.current = false;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!active) return;
    const start = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(start);
  }, [active, refresh]);
  const selectRecord = useCallback(
    async (
      recordId: string,
      fromNotification = false,
    ): Promise<NotificationOpenOutcome> => {
      if (pendingRef.current || retryMutation.current) return "cancelled";
      if (
        !fromNotification &&
        draftRef.current?.record.id !== recordId &&
        hasEdits(draftRef.current) &&
        !window.confirm(copy.discard)
      )
        return "cancelled";
      controller.current?.abort();
      const task = new AbortController();
      controller.current = task;
      if (fromNotification) focusController.current = task;
      pendingRef.current = true;
      setPending(true);
      setError(null);
      setSuccess(null);
      try {
        if (draftRef.current?.record.id !== recordId) {
          updateDraft(null);
          setConflict(false);
        }
        await readDetail(task.signal, recordId);
        if (task.signal.aborted) return "cancelled";
        if (fromNotification) {
          setExpanded(true);
          setStatus("all");
        }
        setFocusRevision((value) => value + 1);
        return "opened";
      } catch (cause) {
        if (!task.signal.aborted) {
          if (
            cause instanceof AccountClientError &&
            (cause.status === 404 || cause.code === "FORBIDDEN")
          ) {
            setRecords((items) => items.filter((item) => item.id !== recordId));
            updateRecord(null);
            updateDraft(null);
            try {
              await readPage(task.signal);
            } catch (listError) {
              if (!task.signal.aborted) report(listError, true);
            }
          }
          report(cause);
        }
        return task.signal.aborted
          ? "cancelled"
          : cause instanceof AccountClientError &&
              (cause.status === 404 || cause.code === "FORBIDDEN")
            ? "unavailable"
            : "failed";
      } finally {
        if (controller.current === task) {
          pendingRef.current = false;
          setPending(false);
        }
        if (focusController.current === task) focusController.current = null;
      }
    },
    [copy.discard, readDetail, readPage, updateDraft, updateRecord, report],
  );
  useEffect(() => {
    if (!active || !focusRecordId || pending || loading) return;
    const request = focusRequestId ?? focusRecordId;
    if (handledFocus.current === request) return;
    const start = window.setTimeout(() => {
      if (pendingRef.current) return;
      handledFocus.current = request;
      void selectRecord(focusRecordId, true).then((outcome) => {
        window.requestAnimationFrame(() => onFocusResolved?.(request, outcome));
      });
    }, 0);
    return () => window.clearTimeout(start);
  }, [
    active,
    focusRecordId,
    focusRequestId,
    pending,
    loading,
    selectRecord,
    onFocusResolved,
  ]);
  useEffect(() => {
    if (!active || (!expanded && !openSection) || focusRevision === 0) return;
    const frame = window.requestAnimationFrame(() =>
      detailElement.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [active, expanded, openSection, focusRevision]);

  async function submitMutation(action: Mutation) {
    if (pendingRef.current || propertyBusy) return;
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    retryMutation.current = action;
    let committed = false;
    try {
      const payload = await workspaceRequest(
        action.path,
        persistedRentMutationSchema,
        {
          ...auth.current,
          signal: task.signal,
          method: action.method,
          body: action.body,
        },
      );
      if (task.signal.aborted) return;
      if (payload.record.propertyId !== propertyId)
        throw new AccountClientError(502, "invalid_response");
      committed = true;
      retryMutation.current = null;
      setUncertain(false);
      setConflict(false);
      updateRecord(payload.record);
      updateDraft(null);
      setRecords((items) =>
        items.map((item) =>
          item.id === payload.record.id ? payload.record : item,
        ),
      );
      setSuccess(action.message);
      setStatus("all");
      if (action.creation) {
        setTenantId("");
        setPeriod("");
        setDueOn("");
        setExpected("");
        setCreateOpen(false);
      }
      setFocusRevision((value) => value + 1);
      await readPage(task.signal);
    } catch (cause) {
      if (!task.signal.aborted) {
        if (
          !committed &&
          cause instanceof AccountClientError &&
          (cause.status === 0 || cause.status >= 500)
        )
          setUncertain(true);
        else {
          retryMutation.current = null;
          setUncertain(false);
        }
        if (
          cause instanceof AccountClientError &&
          cause.code === "VERSION_CONFLICT"
        ) {
          setConflict(true);
          setError(null);
        } else {
          if (
            !action.creation &&
            cause instanceof AccountClientError &&
            (cause.status === 404 || cause.code === "FORBIDDEN")
          ) {
            const targetId = action.path.split("/")[1];
            setRecords((items) => items.filter((item) => item.id !== targetId));
            if (recordRef.current?.id === targetId) updateRecord(null);
            if (draftRef.current?.record.id === targetId) updateDraft(null);
            try {
              await readPage(task.signal);
            } catch (listError) {
              if (!task.signal.aborted) report(listError, true);
            }
          }
          if (!task.signal.aborted) report(cause, action.creation);
        }
      }
    } finally {
      if (!task.signal.aborted) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  }
  function createRecord(event: FormEvent) {
    event.preventDefault();
    if (blocked) return;
    const amountDueMinor = parsePersistedRentAmount(expected);
    if (
      !amountDueMinor ||
      !validRentDueDate(period, dueOn) ||
      !access.tenants.some((item) => item.accountId === tenantId)
    ) {
      setError("validation");
      return;
    }
    if (hasEdits(draft) && !window.confirm(copy.discard)) return;
    void submitMutation({
      path: `properties/${propertyId}/rent-records`,
      method: "POST",
      body: {
        mutationId: crypto.randomUUID(),
        tenantAccountId: tenantId,
        period,
        currency: "AOA",
        amountDueMinor,
        dueOn,
      },
      message: "created",
      creation: true,
    });
  }
  async function startEditor(mode: EditorMode) {
    if (
      !record ||
      blocked ||
      (hasEdits(draft) && !window.confirm(copy.discard))
    )
      return;
    updateDraft(newDraft(record, mode));
    setConflict(false);
    setError(null);
    setSuccess(null);
    if (mode === "transfer") {
      controller.current?.abort();
      const task = new AbortController();
      controller.current = task;
      pendingRef.current = true;
      setPending(true);
      try {
        await readEvidence(task.signal);
      } catch (cause) {
        if (!task.signal.aborted) report(cause, true);
      } finally {
        if (!task.signal.aborted) {
          pendingRef.current = false;
          setPending(false);
        }
      }
    }
  }
  function saveEditor(event: FormEvent) {
    event.preventDefault();
    if (
      !draft ||
      blocked ||
      conflict ||
      (draft.mode !== "void" && !record?.tenantAccessActive)
    )
      return;
    const current = draft.record;
    const common = {
      mutationId: crypto.randomUUID(),
      version: current.version,
    };
    let action: Mutation;
    if (draft.mode === "transfer") {
      const amountMinor = parsePersistedRentAmount(draft.amount);
      if (
        !amountMinor ||
        !validRentTransferDate(draft.date) ||
        !validRentReference(draft.reference) ||
        draft.note.trim().length > 1000
      ) {
        setError("validation");
        return;
      }
      if (
        draft.evidence &&
        !documents.some(
          (item) =>
            item.id === draft.evidence &&
            item.propertyId === propertyId &&
            item.uploadedBy === account.id &&
            item.sharing === "shared" &&
            !item.archived,
        )
      ) {
        setError("evidenceInvalid");
        return;
      }
      action = {
        path: `rent-records/${current.id}/transfer`,
        method: "POST",
        body: {
          ...common,
          amountMinor,
          transferredOn: draft.date,
          reference: draft.reference.trim(),
          note: draft.note.trim(),
          evidenceDocumentId: draft.evidence || null,
        },
        message: "transferSaved",
        creation: false,
      };
    } else if (draft.mode === "terms") {
      const amountDueMinor = parsePersistedRentAmount(draft.amount);
      if (!amountDueMinor || !validRentDueDate(current.period, draft.date)) {
        setError("validation");
        return;
      }
      action = {
        path: `rent-records/${current.id}`,
        method: "PATCH",
        body: { ...common, amountDueMinor, dueOn: draft.date },
        message: "expectedSaved",
        creation: false,
      };
    } else {
      if (!draft.reason.trim() || draft.reason.trim().length > 500) {
        setError("validation");
        return;
      }
      if (draft.mode === "void" && !window.confirm(copy.cancelPrompt)) return;
      action = {
        path: `rent-records/${current.id}/${draft.mode === "void" ? "void" : "review"}`,
        method: "POST",
        body: {
          ...common,
          ...(draft.mode === "review"
            ? { decision: "request_correction" }
            : {}),
          reason: draft.reason.trim(),
        },
        message: draft.mode === "void" ? "cancelledSaved" : "correctionSaved",
        creation: false,
      };
    }
    void submitMutation(action);
  }
  function confirmRecord() {
    if (
      !draft ||
      !draft.checked ||
      blocked ||
      conflict ||
      draft.record.status !== "awaiting_confirmation" ||
      draft.record.transfer?.amountMinor !== draft.record.amountDueMinor ||
      !draft.record.tenantAccessActive ||
      !record?.tenantAccessActive ||
      confirmationVersion !== draft.record.version
    )
      return;
    void submitMutation({
      path: `rent-records/${draft.record.id}/review`,
      method: "POST",
      body: {
        mutationId: crypto.randomUUID(),
        version: draft.record.version,
        decision: "confirm",
      },
      message: "confirmedSaved",
      creation: false,
    });
  }
  const visible = records.filter(
    (item) => status === "all" || item.status === status,
  );
  const editable =
    record && record.status !== "confirmed" && record.status !== "voided";
  const evidenceOptions = documents.filter(
    (item) =>
      item.uploadedBy === account.id &&
      item.propertyId === propertyId &&
      item.sharing === "shared" &&
      !item.archived,
  );
  const linkedDocument = documents.find(
    (item) =>
      item.id === record?.transfer?.evidenceDocumentId && !item.archived,
  );
  const canTransfer =
    !owner &&
    record?.tenantAccountId === account.id &&
    record.tenantAccessActive &&
    editable;
  const mismatch =
    record?.transfer && record.transfer.amountMinor !== record.amountDueMinor;
  return (
    <details
      className="pw-card property-rent"
      open={expanded || openSection}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <WalletCards size={20} aria-hidden="true" />
        {copy.title}
        <span className="pw-badge">
          {records.length}
          {nextCursor ? "+" : ""}
        </span>
      </summary>
      <p className="pw-muted">{copy.note}</p>
      <p className="private-files-warning">{copy.local}</p>
      <div className="rent-record-toolbar">
        <div className="private-record-actions">
          <button
            type="button"
            className="pw-secondary"
            disabled={pending || propertyBusy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {copy.refresh}
          </button>
          {owner && (
            <button
              type="button"
              className="pw-primary"
              disabled={blocked || access.tenants.length === 0}
              aria-expanded={createOpen}
              onClick={() => setCreateOpen((value) => !value)}
            >
              <Plus size={16} aria-hidden="true" />
              {copy.create}
            </button>
          )}
        </div>
        <label>
          {copy.all}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="all">{copy.all}</option>
            {Object.entries(statusKeys).map(([value, key]) => (
              <option key={value} value={value}>
                {copy[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {owner && access.tenants.length === 0 && (
        <p className="pw-muted">{copy.noTenants}</p>
      )}
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
        <div className="pw-feedback is-warning" role="alert">
          <p>{copy.unknown}</p>
          <p>{copy.retryNote}</p>
          <button
            type="button"
            className="pw-secondary"
            disabled={pending || propertyBusy}
            onClick={() => {
              if (retryMutation.current)
                void submitMutation(retryMutation.current);
            }}
          >
            {copy.retryExact}
          </button>
        </div>
      )}
      {owner && (
        <form
          hidden={!createOpen}
          className="pw-form rent-record-create"
          noValidate
          onSubmit={createRecord}
        >
          <label>
            {copy.tenant}
            <select
              value={tenantId}
              disabled={blocked}
              required
              onChange={(event) => setTenantId(event.target.value)}
            >
              <option value="">{copy.chooseTenant}</option>
              {access.tenants.map((item) => (
                <option key={item.accountId} value={item.accountId}>
                  {item.displayName} · {item.accountId.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.period}
            <input
              type="month"
              value={period}
              disabled={blocked}
              onChange={(event) => setPeriod(event.target.value)}
              required
            />
          </label>
          <label>
            {copy.dueOn}
            <input
              type="date"
              value={dueOn}
              disabled={blocked}
              onChange={(event) => setDueOn(event.target.value)}
              required
            />
          </label>
          <label>
            {copy.expected} · AOA
            <input
              inputMode="decimal"
              maxLength={20}
              value={expected}
              disabled={blocked}
              onChange={(event) => setExpected(event.target.value)}
              required
            />
          </label>
          <p className="pw-muted">{copy.amountHint}</p>
          <button type="submit" className="pw-primary" disabled={blocked}>
            {pending ? copy.working : copy.createSubmit}
          </button>
        </form>
      )}
      {nextCursor && <p className="pw-muted">{copy.loadedOnly}</p>}
      {loading ? (
        <p role="status">{copy.loading}</p>
      ) : (
        <div className="rent-record-grid">
          <div>
            <div className="rent-record-list">
              {visible.length === 0 ? (
                <p className="pw-empty-inline">{copy.empty}</p>
              ) : (
                visible.map((item) => (
                  <button
                    className="rent-record-card"
                    type="button"
                    key={item.id}
                    aria-pressed={record?.id === item.id}
                    disabled={blocked}
                    onClick={() => void selectRecord(item.id)}
                  >
                    <strong>{money(item.amountDueMinor)}</strong>
                    <small>
                      {month(item.period)} · {item.tenantName}
                    </small>
                    <span className={`rent-record-status is-${item.status}`}>
                      {copy[statusKeys[item.status]]}
                    </span>
                    <small>
                      {copy.dueOn}: {date(item.dueOn)}
                    </small>
                    <small>{copy.open}</small>
                  </button>
                ))
              )}
            </div>
            {nextCursor && (
              <div className="private-record-actions">
                <button
                  className="pw-secondary"
                  type="button"
                  disabled={pending || propertyBusy}
                  onClick={() => void refresh(false, nextCursor)}
                >
                  {copy.loadMore}
                </button>
              </div>
            )}
          </div>
          {record ? (
            <div
              className="rent-record-detail"
              ref={detailElement}
              data-rent-record-id={record.id}
            >
              <h3>
                {month(record.period)} · {record.tenantName}
              </h3>
              <span className={`rent-record-status is-${record.status}`}>
                {copy[statusKeys[record.status]]}
              </span>
              <Snapshot
                snapshot={record}
                copy={copy}
                money={money}
                date={date}
              />
              {!record.transfer && (
                <p className="pw-muted">{copy.noTransfer}</p>
              )}
              {!record.tenantAccessActive && (
                <p className="pw-feedback is-warning">{copy.inactiveTenant}</p>
              )}
              {mismatch && (
                <p className="pw-feedback is-warning">{copy.mismatch}</p>
              )}
              {record.transfer?.evidenceDocumentId && (
                <div className="private-record-actions">
                  {linkedDocument ? (
                    <button
                      type="button"
                      className="pw-secondary"
                      disabled={pending || propertyBusy}
                      onClick={() => onOpenDocument(linkedDocument.id)}
                    >
                      <FileText size={16} aria-hidden="true" />
                      {copy.viewEvidence}: {linkedDocument.title}
                    </button>
                  ) : (
                    <p className="pw-muted">{copy.evidenceUnavailable}</p>
                  )}
                </div>
              )}
              <div className="private-record-actions">
                {canTransfer && (
                  <button
                    type="button"
                    className="pw-primary"
                    disabled={blocked}
                    onClick={() => startEditor("transfer")}
                  >
                    {record.transfer ? copy.editTransfer : copy.recordTransfer}
                  </button>
                )}
                {owner &&
                  editable &&
                  record.tenantAccessActive &&
                  !record.transfer && (
                    <button
                      type="button"
                      className="pw-secondary"
                      disabled={blocked}
                      onClick={() => startEditor("terms")}
                    >
                      {copy.editExpected}
                    </button>
                  )}
                {owner &&
                  editable &&
                  record.tenantAccessActive &&
                  record.status === "awaiting_confirmation" && (
                    <button
                      type="button"
                      className="pw-primary"
                      disabled={blocked}
                      onClick={() => startEditor("review")}
                    >
                      {copy.review}
                    </button>
                  )}
                {owner && editable && (
                  <button
                    type="button"
                    className="pw-danger"
                    disabled={blocked}
                    onClick={() => startEditor("void")}
                  >
                    {copy.cancelRecord}
                  </button>
                )}
              </div>
              {!editable && <p className="pw-muted">{copy.locked}</p>}
              {conflict && (
                <div className="pw-feedback is-warning" role="alert">
                  <p>{copy.conflict}</p>
                  <button
                    type="button"
                    className="pw-secondary"
                    disabled={pending || uncertain || propertyBusy}
                    onClick={() => {
                      if (window.confirm(copy.discard)) void refresh(true);
                    }}
                  >
                    {copy.reload}
                  </button>
                </div>
              )}
              {draft && draft.record.id === record.id && (
                <form
                  className="pw-form rent-record-editor"
                  noValidate
                  onSubmit={saveEditor}
                >
                  <h4>
                    {draft.mode === "transfer"
                      ? copy.recordTransfer
                      : draft.mode === "terms"
                        ? copy.editExpected
                        : draft.mode === "void"
                          ? copy.cancelRecord
                          : copy.review}
                  </h4>
                  {(draft.mode === "transfer" || draft.mode === "terms") && (
                    <>
                      <label>
                        {draft.mode === "transfer"
                          ? copy.transferredAmount
                          : copy.expected}{" "}
                        · AOA
                        <input
                          inputMode="decimal"
                          maxLength={20}
                          value={draft.amount}
                          disabled={blocked}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              amount: event.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      <p className="pw-muted">{copy.amountHint}</p>
                      <label>
                        {draft.mode === "transfer"
                          ? copy.transferDate
                          : copy.dueOn}
                        <input
                          type="date"
                          value={draft.date}
                          max={
                            draft.mode === "transfer"
                              ? rentTodayInLuanda()
                              : undefined
                          }
                          disabled={blocked}
                          onChange={(event) =>
                            updateDraft({ ...draft, date: event.target.value })
                          }
                          required
                        />
                      </label>
                    </>
                  )}
                  {draft.mode === "transfer" && (
                    <>
                      <label>
                        {copy.reference}
                        <input
                          maxLength={100}
                          value={draft.reference}
                          disabled={blocked}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              reference: event.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      <label>
                        {copy.transferNote}
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={draft.note}
                          disabled={blocked}
                          onChange={(event) =>
                            updateDraft({ ...draft, note: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        {copy.evidence}
                        <select
                          value={draft.evidence}
                          disabled={blocked}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              evidence: event.target.value,
                            })
                          }
                        >
                          <option value="">{copy.noEvidence}</option>
                          {draft.evidence &&
                            !evidenceOptions.some(
                              (item) => item.id === draft.evidence,
                            ) && (
                              <option value={draft.evidence} disabled>
                                {copy.evidenceUnavailable}
                              </option>
                            )}
                          {evidenceOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="pw-muted">{copy.evidenceNote}</p>
                    </>
                  )}
                  {(draft.mode === "review" || draft.mode === "void") && (
                    <label>
                      {draft.mode === "void"
                        ? copy.cancellationReason
                        : copy.correction}
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={draft.reason}
                        disabled={blocked}
                        onChange={(event) =>
                          updateDraft({ ...draft, reason: event.target.value })
                        }
                        required
                      />
                    </label>
                  )}
                  {draft.mode === "review" &&
                    record.status === "awaiting_confirmation" &&
                    !mismatch &&
                    record.tenantAccessActive && (
                      <>
                        <label className="rent-record-check">
                          <input
                            type="checkbox"
                            checked={draft.checked}
                            disabled={blocked || conflict}
                            onChange={(event) =>
                              updateDraft({
                                ...draft,
                                checked: event.target.checked,
                              })
                            }
                          />
                          <span>{copy.confirmationCheck}</span>
                        </label>
                        <button
                          className="pw-primary"
                          type="button"
                          disabled={blocked || conflict || !draft.checked}
                          aria-expanded={
                            confirmationVersion === draft.record.version
                          }
                          aria-controls={`rent-confirm-${record.id}`}
                          onClick={() =>
                            setConfirmationVersion(draft.record.version)
                          }
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          {copy.confirm}
                        </button>
                        {confirmationVersion === draft.record.version &&
                          draft.checked &&
                          !conflict && (
                            <div
                              className="rent-inline-confirmation"
                              id={`rent-confirm-${record.id}`}
                              role="group"
                              aria-label={copy.confirm}
                            >
                              <p role="status">{copy.confirmPrompt}</p>
                              <strong>
                                {money(draft.record.amountDueMinor)}
                              </strong>
                              <div className="private-record-actions">
                                <button
                                  className="pw-secondary"
                                  type="button"
                                  disabled={pending}
                                  onClick={() => setConfirmationVersion(null)}
                                >
                                  {copy.cancelConfirmation}
                                </button>
                                <button
                                  className="pw-primary"
                                  type="button"
                                  disabled={
                                    blocked || conflict || !draft.checked
                                  }
                                  onClick={confirmRecord}
                                >
                                  {pending ? copy.working : copy.finalConfirm}
                                </button>
                              </div>
                            </div>
                          )}
                      </>
                    )}
                  <div className="private-record-actions">
                    <button
                      type="submit"
                      className="pw-primary"
                      disabled={
                        blocked ||
                        conflict ||
                        (draft.mode !== "void" && !record.tenantAccessActive) ||
                        (draft.mode === "terms" && !hasEdits(draft))
                      }
                    >
                      {pending
                        ? copy.working
                        : draft.mode === "transfer"
                          ? copy.saveTransfer
                          : draft.mode === "terms"
                            ? copy.saveExpected
                            : draft.mode === "void"
                              ? copy.cancelRecord
                              : copy.requestCorrection}
                    </button>
                    <button
                      type="button"
                      className="pw-secondary"
                      disabled={blocked}
                      onClick={() => {
                        if (!hasEdits(draft) || window.confirm(copy.discard)) {
                          updateDraft(null);
                          setConflict(false);
                        }
                      }}
                    >
                      {copy.cancel}
                    </button>
                  </div>
                </form>
              )}
              <details className="rent-record-history">
                <summary>
                  {copy.history} · {record.history.length}
                </summary>
                <p className="pw-muted">{copy.historyNote}</p>
                <ol>
                  {record.history.map((event) => (
                    <li key={event.id}>
                      <h5>{copy[historyKeys[event.kind]]}</h5>
                      <p>
                        {copy.by} {event.actorName}
                      </p>
                      <time dateTime={event.createdAt}>
                        {new Intl.DateTimeFormat(language, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(event.createdAt))}
                      </time>
                      {event.before && (
                        <details>
                          <summary>{copy.historyPrevious}</summary>
                          <Snapshot
                            snapshot={event.before}
                            copy={copy}
                            money={money}
                            date={date}
                          />
                        </details>
                      )}
                      <details>
                        <summary>{copy.historyAfter}</summary>
                        <Snapshot
                          snapshot={event.after}
                          copy={copy}
                          money={money}
                          date={date}
                        />
                      </details>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          ) : (
            <p className="pw-empty-inline">{copy.chooseRecord}</p>
          )}
        </div>
      )}
    </details>
  );
}
