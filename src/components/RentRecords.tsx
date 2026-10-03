import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Download,
  FileText,
  Pencil,
  Search,
  X,
} from "lucide-react";
import type { Role } from "../types";
import { useDialogFocus } from "./useDialogFocus";
import { useOperationsI18n } from "./useOperationsI18n";
import type { OperationsMessage } from "../locales/operations/types";
import {
  localizedRentCsvLabels,
  localizedRentSummaryLabels,
  rentFormatters,
  rentIssueKeys,
  rentSortKeys,
  rentStatusKeys,
} from "../locales/operations/rentLabels";
import {
  canConfirmRentRecord,
  canRecordRentTransfer,
  canReviewRentRecord,
  confirmRentRecord,
  createRentRecordFilters,
  discardRentCorrectionDraft,
  discardRentTransferDraft,
  filterRentRecords,
  hasRentCorrectionDraft,
  hasRentTransferDraft,
  rentCorrectionDraft,
  rentRecordSummary,
  rentRecordsCsv,
  rentStatuses,
  rentToday,
  rentTransferDraft,
  rentTransferIssues,
  submitRentCorrectionDraft,
  submitRentTransferDraft,
  updateRentCorrectionDraft,
  updateRentTransferDraft,
  visibleRentRecords,
  type RentRecord,
  type RentRecordFilters,
  type RentRecordSnapshot,
  type RentRecordState,
  type RentTransferDraft,
  type RentTransferIssues,
} from "./rentRecordState";
import "./rentRecords.css";

const defaultFilters = createRentRecordFilters;

function RentStatus({ record }: { record: RentRecord }) {
  const { tr } = useOperationsI18n();
  const tone =
    record.status === "Confirmed"
      ? "mint"
      : record.status === "Needs correction"
        ? "amber"
        : record.status === "Awaiting owner confirmation"
          ? "blue"
          : "neutral";
  return (
    <span className={`pill pill-${tone} rent-managed-status`}>
      {record.status === "Confirmed" && (
        <CheckCircle2 size={13} aria-hidden="true" />
      )}
      {tr(rentStatusKeys[record.status])}
    </span>
  );
}

function TransferForm({
  record,
  draft,
  onChange,
  onSave,
  onCancel,
  onDiscard,
}: {
  record: RentRecord;
  draft: RentTransferDraft;
  onChange: (patch: Partial<RentTransferDraft>) => void;
  onSave: (draft: RentTransferDraft) => void;
  onCancel: () => void;
  onDiscard?: () => void;
}) {
  const { tr } = useOperationsI18n();
  const id = useId();
  const [errors, setErrors] = useState<RentTransferIssues>({});
  const amountRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    amountRef.current?.focus();
  }, []);
  useEffect(() => {
    if (Object.keys(errors).length) errorRef.current?.focus();
  }, [errors]);
  const change = (field: keyof RentTransferDraft, value: string) =>
    onChange({ [field]: value });
  const errorProps = (field: keyof RentTransferDraft) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
  });
  const errorText = (field: keyof RentTransferDraft) =>
    errors[field] && (
      <small id={`${id}-${field}-error`} className="rent-field-error">
        {tr(rentIssueKeys[errors[field]])}
      </small>
    );
  return (
    <form
      className="rent-transfer-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const submitted: RentTransferDraft = {
          amount: String(values.get("amount") ?? ""),
          transferredOn: String(values.get("transferredOn") ?? ""),
          reference: String(values.get("reference") ?? ""),
          note: String(values.get("note") ?? ""),
        };
        onChange(submitted);
        const nextErrors = rentTransferIssues(submitted);
        setErrors(nextErrors);
        if (!Object.keys(nextErrors).length) onSave(submitted);
      }}
    >
      <h3>
        {tr(record.transfer ? "rent_editTransfer" : "rent_recordTransfer")}
      </h3>
      <p className="rent-muted">{tr("rent_formScope")}</p>
      <p className="rent-muted">{tr("rent_transferDraftScope")}</p>
      {Object.keys(errors).length > 0 && (
        <div
          className="rent-form-errors"
          role="alert"
          tabIndex={-1}
          ref={errorRef}
        >
          <strong>{tr("rent_checkDetails")}</strong>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <button
                  type="button"
                  className="rent-error-link"
                  onClick={() =>
                    document.getElementById(`${id}-${field}`)?.focus()
                  }
                >
                  {tr(rentIssueKeys[message])}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rent-form-grid">
        <label htmlFor={`${id}-amount`}>
          {tr("rent_transferredAmount")}
          <input
            id={`${id}-amount`}
            ref={amountRef}
            name="amount"
            aria-label={tr("rent_transferredAmount")}
            inputMode="decimal"
            value={draft.amount}
            maxLength={15}
            required
            onChange={(event) => change("amount", event.target.value)}
            {...errorProps("amount")}
          />
          <small className="rent-muted">{tr("rent_decimalHint")}</small>
          {errorText("amount")}
        </label>
        <label htmlFor={`${id}-transferredOn`}>
          {tr("rent_transferDate")}
          <input
            id={`${id}-transferredOn`}
            name="transferredOn"
            aria-label={tr("rent_transferDate")}
            type="date"
            value={draft.transferredOn}
            max={rentToday()}
            required
            onInput={(event) =>
              change("transferredOn", event.currentTarget.value)
            }
            onChange={(event) => change("transferredOn", event.target.value)}
            {...errorProps("transferredOn")}
          />
          {errorText("transferredOn")}
        </label>
        <label className="rent-form-wide" htmlFor={`${id}-reference`}>
          {tr("rent_transferReference")}
          <input
            id={`${id}-reference`}
            name="reference"
            aria-label={tr("rent_transferReference")}
            value={draft.reference}
            maxLength={100}
            required
            placeholder={tr("rent_referencePlaceholder")}
            onChange={(event) => change("reference", event.target.value)}
            {...errorProps("reference")}
          />
          {errorText("reference")}
        </label>
        <label className="rent-form-wide" htmlFor={`${id}-note`}>
          {tr("rent_optionalNote")}
          <textarea
            id={`${id}-note`}
            name="note"
            aria-label={tr("rent_transferNote")}
            value={draft.note}
            maxLength={1000}
            rows={3}
            onChange={(event) => change("note", event.target.value)}
            {...errorProps("note")}
          />
          {errorText("note")}
        </label>
      </div>
      <div className="rent-dialog-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
        >
          {tr("rent_backToRecord")}
        </button>
        {onDiscard && (
          <button type="button" className="text-button" onClick={onDiscard}>
            {tr("rent_discardDraft")}
          </button>
        )}
        <button type="submit" className="button">
          {tr("rent_saveTransfer")}
        </button>
      </div>
    </form>
  );
}

function RentHistorySnapshot({ snapshot }: { snapshot: RentRecordSnapshot }) {
  const { tr, locale } = useOperationsI18n();
  const { money, dateLabel } = rentFormatters(locale);
  const field = (label: string, value: ReactNode, wide = false) => (
    <div className={wide ? "rent-history-value-wide" : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <dl className="rent-history-values">
      {field(tr("rent_status"), tr(rentStatusKeys[snapshot.status]))}
      {snapshot.transfer ? (
        <>
          {field(
            tr("rent_recordedAmount"),
            money(snapshot.transfer.amountCents),
          )}
          {field(
            tr("rent_transferDate"),
            dateLabel(snapshot.transfer.transferredOn),
          )}
          {field(tr("rent_reference"), snapshot.transfer.reference, true)}
          {field(
            tr("rent_note"),
            snapshot.transfer.note || tr("rent_historyEmpty"),
            true,
          )}
        </>
      ) : (
        field(tr("rent_recordedTransfer"), tr("rent_noTransfer"))
      )}
      {field(
        tr("rent_correctionNote"),
        snapshot.correctionNote || tr("rent_historyEmpty"),
        true,
      )}
    </dl>
  );
}

function RentRecordDialog({
  record,
  role,
  state,
  initiallyEditing,
  setState,
  onClose,
}: {
  record: RentRecord;
  role: Role;
  state: RentRecordState;
  initiallyEditing: boolean;
  setState: Dispatch<SetStateAction<RentRecordState>>;
  onClose: () => void;
}) {
  const { tr, locale, language } = useOperationsI18n();
  const { money, dateLabel, periodLabel } = rentFormatters(locale);
  const summaryLabels = localizedRentSummaryLabels(tr, locale);
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const copyRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(initiallyEditing);
  const [correcting, setCorrecting] = useState(false);
  const correctionInputRef = useRef<HTMLTextAreaElement>(null);
  const [correctionError, setCorrectionError] = useState(false);
  const [feedback, setFeedback] = useState<OperationsMessage | null>(null);
  const [showCopyFallback, setShowCopyFallback] = useState(false);
  const [copyPendingFor, setCopyPendingFor] = useState<{
    record: RentRecord;
    role: Role;
    language: string;
  } | null>(null);
  const copySequence = useRef(0);
  const copying =
    copyPendingFor?.record === record &&
    copyPendingFor.role === role &&
    copyPendingFor.language === language;
  useLayoutEffect(
    () => () => {
      // Ignore results from a previous record version, workspace, or closed dialog.
      copySequence.current += 1;
    },
    [record, role, language],
  );
  const id = useId();
  const canEdit = canRecordRentTransfer(record, role);
  const canReview = canReviewRentRecord(record, role);
  const transferForm = rentTransferDraft(state, role, record.id);
  const correctionForm = rentCorrectionDraft(state, role, record.id);
  const transferRetained = hasRentTransferDraft(state, role, record.id);
  const correctionRetained = hasRentCorrectionDraft(state, role, record.id);
  const privateForm = transferRetained
    ? transferForm
    : correctionRetained
      ? correctionForm
      : null;
  const changeTransfer = (patch: Partial<RentTransferDraft>) => {
    if (!transferForm) return;
    setState((current) =>
      updateRentTransferDraft(
        current,
        role,
        record.id,
        patch,
        transferForm.recordVersion,
      ),
    );
  };
  useEffect(() => {
    if (correcting) correctionInputRef.current?.focus();
  }, [correcting]);
  const finishEdit = () => {
    setEditing(false);
    requestAnimationFrame(() => titleRef.current?.focus());
  };
  const discardPrivateDraft = () => {
    setState((current) =>
      transferRetained
        ? discardRentTransferDraft(current, role, record.id)
        : discardRentCorrectionDraft(current, role, record.id),
    );
    setEditing(false);
    setCorrecting(false);
    setCorrectionError(false);
    setFeedback({ key: "rent_draftDiscarded" });
    requestAnimationFrame(() => titleRef.current?.focus());
  };
  const field = (label: string, value: ReactNode) => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  const copy = async () => {
    const sequence = ++copySequence.current;
    const isCurrent = () => sequence === copySequence.current;
    const summary = rentRecordSummary(record, summaryLabels);
    setCopyPendingFor({ record, role, language });
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(summary);
      if (!isCurrent()) return;
      setShowCopyFallback(false);
      setFeedback({ key: "rent_summaryCopied" });
    } catch {
      if (!isCurrent()) return;
      setShowCopyFallback(true);
      setFeedback({ key: "rent_clipboardUnavailable" });
      requestAnimationFrame(() => {
        if (!isCurrent()) return;
        copyRef.current?.focus();
        copyRef.current?.select();
      });
    } finally {
      if (isCurrent()) setCopyPendingFor(null);
    }
  };
  return createPortal(
    <div
      className="modal-layer rent-record-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      ref={dialogRef}
    >
      <button
        type="button"
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="modal-card rent-record-dialog">
        <header>
          <div>
            <span className="eyebrow">{tr("rent_record")}</span>
            <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1}>
              {periodLabel(record.period)}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={tr("rent_closeRecord")}
            onClick={onClose}
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body rent-record-body">
          <div className="rent-detail-heading">
            <div>
              <h3>{record.property}</h3>
              <p>{record.tenant}</p>
            </div>
            <RentStatus record={record} />
          </div>
          <dl className="rent-detail-fields">
            {field(tr("rent_amountDue"), money(record.amountDueCents))}
            {field(tr("rent_dueDate"), dateLabel(record.dueOn))}
            {field(tr("rent_owner"), record.owner)}
            {field(tr("rent_recordId"), record.id)}
          </dl>
          {record.correctionNote && (
            <div className="rent-correction-note">
              <strong>{tr("rent_correctionRequested")}</strong>
              <p>{record.correctionNote}</p>
            </div>
          )}
          {privateForm &&
            (privateForm.stale ||
              (transferRetained ? !editing : !correcting)) && (
              <section className="rent-private-draft">
                <h3>{tr("rent_privateDraft")}</h3>
                <p>
                  {tr(
                    transferRetained
                      ? "rent_transferDraftScope"
                      : "rent_correctionDraftScope",
                  )}
                </p>
                {privateForm.stale && (
                  <div className="rent-draft-stale">
                    <strong>{tr("rent_staleDraft")}</strong>
                    <p>{tr("rent_staleDraftNote")}</p>
                    <details>
                      <summary>{tr("rent_inspectDraft")}</summary>
                      <dl className="rent-detail-fields">
                        {transferRetained && transferForm ? (
                          <>
                            {field(
                              tr("rent_transferredAmount"),
                              transferForm.values.amount,
                            )}
                            {field(
                              tr("rent_transferDate"),
                              transferForm.values.transferredOn,
                            )}
                            {field(
                              tr("rent_reference"),
                              <span dir="auto">
                                {transferForm.values.reference}
                              </span>,
                            )}
                            {field(
                              tr("rent_note"),
                              <span dir="auto">
                                {transferForm.values.note}
                              </span>,
                            )}
                          </>
                        ) : correctionForm ? (
                          field(
                            tr("rent_correctionQuestion"),
                            <span dir="auto">
                              {correctionForm.values.note}
                            </span>,
                          )
                        ) : null}
                      </dl>
                    </details>
                  </div>
                )}
                <div className="rent-dialog-actions">
                  {!privateForm.stale &&
                    (transferRetained ? !editing : !correcting) && (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => {
                          if (transferRetained) setEditing(true);
                          else setCorrecting(true);
                          setFeedback(null);
                        }}
                      >
                        {tr(
                          transferRetained
                            ? "rent_resumeTransferDraft"
                            : "rent_resumeCorrectionDraft",
                        )}
                      </button>
                    )}
                  <button
                    type="button"
                    className="text-button"
                    onClick={discardPrivateDraft}
                  >
                    {tr("rent_discardDraft")}
                  </button>
                </div>
              </section>
            )}
          {editing && canEdit && transferForm && !transferForm.stale ? (
            <TransferForm
              record={record}
              draft={transferForm.values}
              onChange={changeTransfer}
              onCancel={finishEdit}
              onDiscard={transferRetained ? discardPrivateDraft : undefined}
              onSave={(draft) => {
                const save = (current: RentRecordState) =>
                  submitRentTransferDraft(
                    updateRentTransferDraft(
                      current,
                      role,
                      record.id,
                      draft,
                      transferForm.recordVersion,
                    ),
                    role,
                    record.id,
                    transferForm.recordVersion,
                  );
                const result = save(state);
                if (!result.recordId) {
                  setFeedback({ key: "rent_draftUnavailable" });
                  return;
                }
                setState((current) => save(current).state);
                setFeedback({ key: "rent_transferSaved" });
                finishEdit();
              }}
            />
          ) : (
            <>
              <section
                className="rent-detail-section"
                aria-labelledby={`${id}-transfer-title`}
              >
                <h3 id={`${id}-transfer-title`}>
                  {tr("rent_recordedTransfer")}
                </h3>
                {record.transfer ? (
                  <>
                    <dl className="rent-detail-fields">
                      {field(
                        tr("rent_recordedAmount"),
                        money(record.transfer.amountCents),
                      )}
                      {field(
                        tr("rent_transferDate"),
                        dateLabel(record.transfer.transferredOn),
                      )}
                      {field(tr("rent_reference"), record.transfer.reference)}
                      {record.transfer.note &&
                        field(tr("rent_note"), record.transfer.note)}
                    </dl>
                    {record.transfer.amountCents !== record.amountDueCents && (
                      <p className="rent-amount-mismatch">
                        {tr("rent_amountMismatch")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="rent-muted">{tr("rent_noTransfer")}</p>
                )}
                {canEdit && !transferForm?.stale && !transferRetained && (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setEditing(true);
                      setFeedback(null);
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    {tr(
                      record.transfer
                        ? "rent_editTransfer"
                        : "rent_recordTransfer",
                    )}
                  </button>
                )}
              </section>
              {canReview && (
                <section
                  className="rent-owner-review"
                  aria-labelledby={`${id}-review-title`}
                >
                  <h3 id={`${id}-review-title`}>{tr("rent_ownerReview")}</h3>
                  <p className="rent-muted">{tr("rent_reviewScope")}</p>
                  <div className="rent-dialog-actions">
                    {!correctionRetained && (
                      <button
                        type="button"
                        className="button button-secondary"
                        aria-expanded={correcting}
                        onClick={() => setCorrecting((value) => !value)}
                      >
                        {tr("rent_requestCorrection")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="button"
                      disabled={!canConfirmRentRecord(record, role)}
                      onClick={() => {
                        setState((current) =>
                          confirmRentRecord(current, role, record.id),
                        );
                        setFeedback({ key: "rent_ownerConfirmed" });
                        requestAnimationFrame(() => titleRef.current?.focus());
                      }}
                    >
                      {tr("rent_confirmTransfer")}
                    </button>
                  </div>
                  {correcting && correctionForm && !correctionForm.stale && (
                    <form
                      className="rent-correction-form"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        const submittedNote = String(
                          new FormData(event.currentTarget).get(
                            "correctionNote",
                          ) ?? "",
                        );
                        const save = (current: RentRecordState) =>
                          submitRentCorrectionDraft(
                            updateRentCorrectionDraft(
                              current,
                              role,
                              record.id,
                              { note: submittedNote },
                              correctionForm.recordVersion,
                            ),
                            role,
                            record.id,
                            correctionForm.recordVersion,
                          );
                        const result = save(state);
                        if (!result.recordId) {
                          setState((current) =>
                            updateRentCorrectionDraft(
                              current,
                              role,
                              record.id,
                              { note: submittedNote },
                              correctionForm.recordVersion,
                            ),
                          );
                          if (result.issue)
                            setFeedback({ key: "rent_draftUnavailable" });
                          setCorrectionError(Boolean(result.issues.note));
                          document.getElementById(`${id}-correction`)?.focus();
                          return;
                        }
                        setState((current) => save(current).state);
                        setCorrecting(false);
                        setFeedback({ key: "rent_correctionSaved" });
                        requestAnimationFrame(() => titleRef.current?.focus());
                      }}
                    >
                      <p className="rent-muted">
                        {tr("rent_correctionDraftScope")}
                      </p>
                      <label htmlFor={`${id}-correction`}>
                        {tr("rent_correctionQuestion")}
                        <textarea
                          id={`${id}-correction`}
                          ref={correctionInputRef}
                          name="correctionNote"
                          aria-label={tr("rent_correctionQuestion")}
                          value={correctionForm.values.note}
                          maxLength={500}
                          rows={3}
                          required
                          onChange={(event) => {
                            const note = event.target.value;
                            setState((current) =>
                              updateRentCorrectionDraft(
                                current,
                                role,
                                record.id,
                                { note },
                                correctionForm.recordVersion,
                              ),
                            );
                            setCorrectionError(false);
                          }}
                          aria-invalid={Boolean(correctionError)}
                          aria-describedby={
                            correctionError
                              ? `${id}-correction-error`
                              : undefined
                          }
                        />
                      </label>
                      {correctionError && (
                        <p
                          id={`${id}-correction-error`}
                          className="rent-field-error"
                          role="alert"
                        >
                          {tr("rent_errorCorrection")}
                        </p>
                      )}
                      <div className="rent-dialog-actions">
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => {
                            setCorrecting(false);
                            requestAnimationFrame(() =>
                              titleRef.current?.focus(),
                            );
                          }}
                        >
                          {tr("rent_backToRecord")}
                        </button>
                        <button type="submit" className="button">
                          {tr("rent_saveCorrection")}
                        </button>
                        {correctionRetained && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={discardPrivateDraft}
                          >
                            {tr("rent_discardDraft")}
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </section>
              )}
              <section
                className="rent-detail-section"
                aria-labelledby={`${id}-history-title`}
              >
                <h3 id={`${id}-history-title`}>{tr("rent_history")}</h3>
                {record.activity.some((entry) => entry.change) && (
                  <p className="rent-muted">{tr("rent_historyScope")}</p>
                )}
                <ol className="rent-record-history">
                  {record.activity.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.label}</strong>
                      <time dateTime={entry.at}>
                        {new Date(entry.at).toLocaleString(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                      {entry.change && (
                        <div className="rent-history-change">
                          <h4>{tr("rent_historyAfter")}</h4>
                          <RentHistorySnapshot snapshot={entry.change.after} />
                          <details className="rent-history-before">
                            <summary>{tr("rent_historyBefore")}</summary>
                            <RentHistorySnapshot
                              snapshot={entry.change.before}
                            />
                          </details>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
              <button
                type="button"
                className="button button-secondary"
                disabled={copying}
                onClick={() => void copy()}
              >
                <Clipboard size={16} aria-hidden="true" />
                {tr(copying ? "rent_copying" : "rent_copySummary")}
              </button>
            </>
          )}
          <p className="rent-action-feedback" role="status">
            {feedback && tr(feedback.key, feedback.values)}
          </p>
          {showCopyFallback && (
            <label className="rent-copy-fallback">
              {tr("rent_sampleSummary")}
              <textarea
                ref={copyRef}
                value={rentRecordSummary(record, summaryLabels)}
                readOnly
                rows={7}
              />
            </label>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function RentRecords({
  role,
  state,
  setState,
  filters,
  setFilters,
}: {
  role: Role;
  state: RentRecordState;
  setState: Dispatch<SetStateAction<RentRecordState>>;
  filters: RentRecordFilters;
  setFilters: Dispatch<SetStateAction<RentRecordFilters>>;
}) {
  const { tr, locale } = useOperationsI18n();
  const { money, periodLabel } = rentFormatters(locale);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initiallyEditing, setInitiallyEditing] = useState(false);
  const [feedback, setFeedback] = useState<OperationsMessage | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listTitleRef = useRef<HTMLHeadingElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const closeFocusFrame = useRef<number | null>(null);
  const openedRecord = useRef<{
    id: string;
    role: Role;
    trigger: HTMLElement | null;
  } | null>(null);
  useLayoutEffect(
    () => () => {
      if (closeFocusFrame.current !== null)
        cancelAnimationFrame(closeFocusFrame.current);
      openedRecord.current = null;
    },
    [],
  );
  const records = visibleRentRecords(state, role);
  const visible = filterRentRecords(records, filters);
  const selected = records.find((record) => record.id === selectedId);
  const nextRecord = records
    .filter((record) => canRecordRentTransfer(record, role))
    .sort((a, b) => b.period.localeCompare(a.period))[0];
  const confirmed = records.filter((record) => record.status === "Confirmed");
  const activeFilters =
    Number(filters.status !== "All statuses") +
    Number(filters.property !== "All properties") +
    Number(filters.period !== "All periods");
  const open = (record: RentRecord, editing = false) => {
    if (closeFocusFrame.current !== null) {
      cancelAnimationFrame(closeFocusFrame.current);
      closeFocusFrame.current = null;
    }
    openedRecord.current = {
      id: record.id,
      role,
      trigger:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    };
    setSelectedId(record.id);
    setInitiallyEditing(editing);
  };
  const close = () => {
    const closed = openedRecord.current;
    openedRecord.current = null;
    setSelectedId(null);
    if (!closed) return;
    if (closeFocusFrame.current !== null)
      cancelAnimationFrame(closeFocusFrame.current);
    closeFocusFrame.current = requestAnimationFrame(() => {
      closeFocusFrame.current = null;
      const root = rootRef.current;
      if (
        !root?.isConnected ||
        root.dataset.rentWorkspace !== closed.role ||
        openedRecord.current ||
        document.querySelector('[role="dialog"], dialog[open]')
      )
        return;
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        active !== document.documentElement
      )
        return;
      const available = (
        element: HTMLElement | null | undefined,
      ): element is HTMLElement =>
        Boolean(
          element?.isConnected &&
          root.contains(element) &&
          !element.matches(":disabled") &&
          !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
          element.getClientRects().length &&
          getComputedStyle(element).visibility === "visible",
        );
      const row = rowRefs.current.get(closed.id);
      const target = available(closed.trigger)
        ? closed.trigger
        : available(row)
          ? row
          : listTitleRef.current;
      if (available(target)) target.focus({ preventScroll: true });
    });
  };
  const exportRecords = () => {
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(
        new Blob(
          ["\uFEFF", rentRecordsCsv(visible, localizedRentCsvLabels(tr))],
          {
            type: "text/csv;charset=utf-8",
          },
        ),
      );
      link = document.createElement("a");
      link.href = url;
      link.download = `kasa-sample-rent-${rentToday()}.csv`;
      document.body.append(link);
      link.click();
      setFeedback({
        key: "rent_csvStarted",
        values: { count: visible.length },
      });
    } catch {
      setFeedback({ key: "rent_csvFailed" });
    } finally {
      link?.remove();
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  };
  if (role !== "tenant" && role !== "landlord")
    return (
      <div className="empty-state">
        <FileText size={28} />
        <h3>{tr("rent_title")}</h3>
        <p>{tr("rent_workspaceScope")}</p>
      </div>
    );
  return (
    <div
      className="page-stack rent-records-page"
      ref={rootRef}
      data-rent-workspace={role}
    >
      <section className="rent-managed-banner">
        <div>
          <span className="eyebrow">{tr("rent_title")}</span>
          <h2>
            {tr(role === "tenant" ? "rent_tenantTitle" : "rent_ownerTitle")}
          </h2>
          <p>{tr("rent_sessionScope")}</p>
        </div>
        {nextRecord && (
          <button
            type="button"
            className="button"
            onClick={() => open(nextRecord, true)}
          >
            <Pencil size={16} aria-hidden="true" />
            {tr("rent_recordTransfer")}
          </button>
        )}
      </section>
      <section
        className="rent-managed-metrics"
        aria-label={tr("rent_metricsLabel")}
      >
        <div className="card">
          <span>{tr("rent_confirmedMetric")}</span>
          <strong>
            {money(
              confirmed.reduce((sum, record) => sum + record.amountDueCents, 0),
            )}
          </strong>
          <small>
            {tr("rent_allPeriodsCount", { count: confirmed.length })}
          </small>
        </div>
        <div className="card">
          <span>{tr("rent_awaitingReview")}</span>
          <strong>
            {
              records.filter(
                (record) => record.status === "Awaiting owner confirmation",
              ).length
            }
          </strong>
          <small>{tr("rent_recordedDetails")}</small>
        </div>
        <div className="card">
          <span>{tr("rent_missingDetails")}</span>
          <strong>
            {
              records.filter(
                (record) =>
                  record.status === "Awaiting transfer details" ||
                  record.status === "Needs correction",
              ).length
            }
          </strong>
          <small>{tr("rent_inspectHint")}</small>
        </div>
      </section>
      <div className="rent-managed-filters">
        <label>
          {tr("rent_period")}
          <select
            value={filters.period}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                period: event.target.value,
              }))
            }
          >
            <option value="All periods">{tr("rent_allPeriods")}</option>
            {[
              ...new Set([
                ...records.map((record) => record.period),
                ...(filters.period === "All periods" ? [] : [filters.period]),
              ]),
            ]
              .sort()
              .reverse()
              .map((period) => (
                <option key={period} value={period}>
                  {periodLabel(period)}
                </option>
              ))}
          </select>
        </label>
        <label>
          {tr("rent_status")}
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as RentRecordFilters["status"],
              }))
            }
          >
            <option value="All statuses">{tr("rent_allStatuses")}</option>
            {rentStatuses.map((status) => (
              <option key={status} value={status}>
                {tr(rentStatusKeys[status])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("rent_property")}
          <select
            value={filters.property}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                property: event.target.value,
              }))
            }
          >
            <option value="All properties">{tr("rent_allProperties")}</option>
            {[...new Set(records.map((record) => record.property))].map(
              (property) => (
                <option key={property} value={property}>
                  {property}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {tr("rent_sort")}
          <select
            value={filters.sort}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sort: event.target.value as RentRecordFilters["sort"],
              }))
            }
          >
            {Object.entries(rentSortKeys).map(([value, key]) => (
              <option key={value} value={value}>
                {tr(key)}
              </option>
            ))}
          </select>
        </label>
        {(activeFilters > 0 || filters.sort !== "Most recently updated") && (
          <button
            type="button"
            className="text-button"
            onClick={() => setFilters(defaultFilters())}
          >
            {activeFilters
              ? tr("rent_resetActive", { count: activeFilters })
              : tr("rent_resetSort")}
          </button>
        )}
      </div>
      <section
        className="card rent-managed-list"
        aria-labelledby="rent-managed-list-title"
      >
        <header>
          <div>
            <h2 id="rent-managed-list-title" ref={listTitleRef} tabIndex={-1}>
              {tr("rent_title")}
            </h2>
            <p role="status">
              {tr("rent_matchingCount", { count: visible.length })}
            </p>
          </div>
          <button
            type="button"
            className="soft-button"
            onClick={exportRecords}
            disabled={!visible.length}
          >
            <Download size={16} aria-hidden="true" />
            {tr("rent_exportCsv")}
          </button>
        </header>
        {visible.map((record) => (
          <button
            type="button"
            className="rent-managed-row"
            key={record.id}
            ref={(node) => {
              if (node) rowRefs.current.set(record.id, node);
              else rowRefs.current.delete(record.id);
            }}
            onClick={() => open(record)}
            aria-label={tr("rent_openRecord", {
              period: periodLabel(record.period),
              tenant: record.tenant,
              property: record.property,
            })}
            aria-describedby={
              hasRentTransferDraft(state, role, record.id) ||
              hasRentCorrectionDraft(state, role, record.id)
                ? `rent-draft-${role}-${record.id}`
                : undefined
            }
          >
            <span className="rent-managed-period">
              <strong>{periodLabel(record.period)}</strong>
              <small>{record.tenant}</small>
              {(hasRentTransferDraft(state, role, record.id) ||
                hasRentCorrectionDraft(state, role, record.id)) && (
                <small
                  className="rent-draft-indicator"
                  id={`rent-draft-${role}-${record.id}`}
                >
                  {tr("rent_privateDraft")}
                </small>
              )}
            </span>
            <span className="rent-managed-property">{record.property}</span>
            <span className="rent-managed-amount">
              <strong>{money(record.amountDueCents)}</strong>
              <small>{tr("rent_rentAmount")}</small>
            </span>
            <RentStatus record={record} />
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ))}
        {!visible.length && (
          <div className="empty-state">
            <Search size={26} />
            <h3>{tr("rent_noMatches")}</h3>
            <p>{tr("rent_noMatchesHint")}</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setFilters(defaultFilters())}
            >
              {tr("rent_resetFilters")}
            </button>
          </div>
        )}
      </section>
      <p className="rent-action-feedback" role="status">
        {feedback && tr(feedback.key, feedback.values)}
      </p>
      {selected && (
        <RentRecordDialog
          key={`${role}:${selected.id}`}
          record={selected}
          role={role}
          state={state}
          initiallyEditing={initiallyEditing}
          setState={setState}
          onClose={close}
        />
      )}
    </div>
  );
}
