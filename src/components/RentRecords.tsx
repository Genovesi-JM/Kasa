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
import {
  canConfirmRentRecord,
  canRecordRentTransfer,
  canReviewRentRecord,
  confirmRentRecord,
  filterRentRecords,
  recordRentTransfer,
  rentRecordSummary,
  rentRecordsCsv,
  rentStatuses,
  rentToday,
  requestRentCorrection,
  validateRentTransfer,
  visibleRentRecords,
  type RentRecord,
  type RentRecordFilters,
  type RentRecordState,
  type RentTransferDraft,
  type RentTransferErrors,
} from "./rentRecordState";
import "./rentRecords.css";

const money = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const periodLabel = (value: string) =>
  new Date(`${value}-01T12:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
const defaultFilters = (): RentRecordFilters => ({
  status: "All statuses",
  property: "All properties",
  period: "All periods",
  sort: "Most recently updated",
});

function RentStatus({ record }: { record: RentRecord }) {
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
      {record.status}
    </span>
  );
}

function TransferForm({
  record,
  onSave,
  onCancel,
}: {
  record: RentRecord;
  onSave: (draft: RentTransferDraft) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<RentTransferDraft>(() => ({
    amount: (
      (record.transfer?.amountCents ?? record.amountDueCents) / 100
    ).toFixed(2),
    transferredOn: record.transfer?.transferredOn ?? rentToday(),
    reference: record.transfer?.reference ?? "",
    note: record.transfer?.note ?? "",
  }));
  const [errors, setErrors] = useState<RentTransferErrors>({});
  const amountRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    amountRef.current?.focus();
  }, []);
  useEffect(() => {
    if (Object.keys(errors).length) errorRef.current?.focus();
  }, [errors]);
  const change = (field: keyof RentTransferDraft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const errorProps = (field: keyof RentTransferDraft) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
  });
  const errorText = (field: keyof RentTransferDraft) =>
    errors[field] && (
      <small id={`${id}-${field}-error`} className="rent-field-error">
        {errors[field]}
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
        setDraft(submitted);
        const nextErrors = validateRentTransfer(submitted);
        setErrors(nextErrors);
        if (!Object.keys(nextErrors).length) onSave(submitted);
      }}
    >
      <h3>
        {record.transfer ? "Edit transfer details" : "Record transfer details"}
      </h3>
      <p className="rent-muted">
        Use example details. This form records a transfer description; it does
        not move money or upload proof.
      </p>
      {Object.keys(errors).length > 0 && (
        <div
          className="rent-form-errors"
          role="alert"
          tabIndex={-1}
          ref={errorRef}
        >
          <strong>Check these details</strong>
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
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rent-form-grid">
        <label htmlFor={`${id}-amount`}>
          Transferred amount (€)
          <input
            id={`${id}-amount`}
            ref={amountRef}
            name="amount"
            aria-label="Transferred amount (€)"
            inputMode="decimal"
            value={draft.amount}
            maxLength={15}
            required
            onChange={(event) => change("amount", event.target.value)}
            {...errorProps("amount")}
          />
          <small className="rent-muted">
            Use a decimal point or comma, without thousands separators.
          </small>
          {errorText("amount")}
        </label>
        <label htmlFor={`${id}-transferredOn`}>
          Transfer date
          <input
            id={`${id}-transferredOn`}
            name="transferredOn"
            aria-label="Transfer date"
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
          Transfer reference
          <input
            id={`${id}-reference`}
            name="reference"
            aria-label="Transfer reference"
            value={draft.reference}
            maxLength={100}
            required
            placeholder="For example, EXAMPLE-SEPTEMBER-RENT"
            onChange={(event) => change("reference", event.target.value)}
            {...errorProps("reference")}
          />
          {errorText("reference")}
        </label>
        <label className="rent-form-wide" htmlFor={`${id}-note`}>
          Note (optional)
          <textarea
            id={`${id}-note`}
            name="note"
            aria-label="Transfer note"
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
          Cancel edit
        </button>
        <button type="submit" className="button">
          Save transfer details
        </button>
      </div>
    </form>
  );
}

function RentRecordDialog({
  record,
  role,
  initiallyEditing,
  setState,
  onClose,
}: {
  record: RentRecord;
  role: Role;
  initiallyEditing: boolean;
  setState: Dispatch<SetStateAction<RentRecordState>>;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const copyRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(initiallyEditing);
  const [correcting, setCorrecting] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showCopyFallback, setShowCopyFallback] = useState(false);
  const [copyPendingFor, setCopyPendingFor] = useState<{
    record: RentRecord;
    role: Role;
  } | null>(null);
  const copySequence = useRef(0);
  const copying =
    copyPendingFor?.record === record && copyPendingFor.role === role;
  useLayoutEffect(
    () => () => {
      // Ignore results from a previous record version, workspace, or closed dialog.
      copySequence.current += 1;
    },
    [record, role],
  );
  const id = useId();
  const canEdit = canRecordRentTransfer(record, role);
  const canReview = canReviewRentRecord(record, role);
  const finishEdit = () => {
    setEditing(false);
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
    const summary = rentRecordSummary(record);
    setCopyPendingFor({ record, role });
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(summary);
      if (!isCurrent()) return;
      setShowCopyFallback(false);
      setFeedback("Sample record summary copied.");
    } catch {
      if (!isCurrent()) return;
      setShowCopyFallback(true);
      setFeedback(
        "Clipboard access is unavailable. Select and copy the summary below.",
      );
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
            <span className="eyebrow">RENT RECORD</span>
            <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1}>
              {periodLabel(record.period)}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close rent record"
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
            {field("Amount due", money(record.amountDueCents))}
            {field("Due date", dateLabel(record.dueOn))}
            {field("Listing owner", record.owner)}
            {field("Record ID", record.id)}
          </dl>
          {record.correctionNote && (
            <div className="rent-correction-note">
              <strong>Correction requested</strong>
              <p>{record.correctionNote}</p>
            </div>
          )}
          {editing && canEdit ? (
            <TransferForm
              record={record}
              onCancel={finishEdit}
              onSave={(draft) => {
                setState((current) =>
                  recordRentTransfer(current, role, record.id, draft),
                );
                setFeedback(
                  "Transfer details saved. Awaiting review in the owner workspace.",
                );
                finishEdit();
              }}
            />
          ) : (
            <>
              <section
                className="rent-detail-section"
                aria-labelledby={`${id}-transfer-title`}
              >
                <h3 id={`${id}-transfer-title`}>Recorded transfer</h3>
                {record.transfer ? (
                  <>
                    <dl className="rent-detail-fields">
                      {field(
                        "Recorded amount",
                        money(record.transfer.amountCents),
                      )}
                      {field(
                        "Transfer date",
                        dateLabel(record.transfer.transferredOn),
                      )}
                      {field("Reference", record.transfer.reference)}
                      {record.transfer.note &&
                        field("Note", record.transfer.note)}
                    </dl>
                    {record.transfer.amountCents !== record.amountDueCents && (
                      <p className="rent-amount-mismatch">
                        The recorded amount differs from the rent amount.
                        Correct the details before owner confirmation.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="rent-muted">
                    No transfer details have been recorded for this period.
                  </p>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setEditing(true);
                      setFeedback("");
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    {record.transfer
                      ? "Edit transfer details"
                      : "Record transfer details"}
                  </button>
                )}
              </section>
              {canReview && (
                <section
                  className="rent-owner-review"
                  aria-labelledby={`${id}-review-title`}
                >
                  <h3 id={`${id}-review-title`}>Owner review</h3>
                  <p className="rent-muted">
                    Confirming changes this sample record; it does not verify a
                    bank transaction.
                  </p>
                  <div className="rent-dialog-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      aria-expanded={correcting}
                      onClick={() => setCorrecting((value) => !value)}
                    >
                      Request correction
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={!canConfirmRentRecord(record, role)}
                      onClick={() => {
                        setState((current) =>
                          confirmRentRecord(current, role, record.id),
                        );
                        setFeedback("Owner confirmation recorded in this tab.");
                        requestAnimationFrame(() => titleRef.current?.focus());
                      }}
                    >
                      Confirm recorded transfer
                    </button>
                  </div>
                  {correcting && (
                    <form
                      className="rent-correction-form"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        const submittedNote = String(
                          new FormData(event.currentTarget).get(
                            "correctionNote",
                          ) ?? "",
                        ).trim();
                        if (!submittedNote || submittedNote.length > 500) {
                          setCorrectionError(
                            "Describe what needs correcting in 1–500 characters.",
                          );
                          document.getElementById(`${id}-correction`)?.focus();
                          return;
                        }
                        setState((current) =>
                          requestRentCorrection(
                            current,
                            role,
                            record.id,
                            submittedNote,
                          ),
                        );
                        setCorrecting(false);
                        setFeedback(
                          "Correction request saved in this tab. The tenant can edit the record.",
                        );
                        requestAnimationFrame(() => titleRef.current?.focus());
                      }}
                    >
                      <label htmlFor={`${id}-correction`}>
                        What needs correcting?
                        <textarea
                          id={`${id}-correction`}
                          name="correctionNote"
                          aria-label="What needs correcting?"
                          value={correctionNote}
                          maxLength={500}
                          rows={3}
                          required
                          onChange={(event) => {
                            setCorrectionNote(event.target.value);
                            setCorrectionError("");
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
                          {correctionError}
                        </p>
                      )}
                      <button type="submit" className="button">
                        Save correction request
                      </button>
                    </form>
                  )}
                </section>
              )}
              <section
                className="rent-detail-section"
                aria-labelledby={`${id}-history-title`}
              >
                <h3 id={`${id}-history-title`}>Record history</h3>
                <ol className="rent-record-history">
                  {record.activity.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.label}</strong>
                      <time dateTime={entry.at}>
                        {new Date(entry.at).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
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
                {copying ? "Copying…" : "Copy sample summary"}
              </button>
            </>
          )}
          <p className="rent-action-feedback" role="status">
            {feedback}
          </p>
          {showCopyFallback && (
            <label className="rent-copy-fallback">
              Sample summary
              <textarea
                ref={copyRef}
                value={rentRecordSummary(record)}
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
}: {
  role: Role;
  state: RentRecordState;
  setState: Dispatch<SetStateAction<RentRecordState>>;
}) {
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initiallyEditing, setInitiallyEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
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
    setSelectedId(record.id);
    setInitiallyEditing(editing);
  };
  const exportRecords = () => {
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(
        new Blob(["\uFEFF", rentRecordsCsv(visible)], {
          type: "text/csv;charset=utf-8",
        }),
      );
      link = document.createElement("a");
      link.href = url;
      link.download = `kasa-sample-rent-${rentToday()}.csv`;
      document.body.append(link);
      link.click();
      setFeedback(
        `CSV download started for ${visible.length} visible ${visible.length === 1 ? "record" : "records"}.`,
      );
    } catch {
      setFeedback(
        "The CSV could not be downloaded. Try again in a browser that supports file downloads.",
      );
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
        <h3>Rent records</h3>
        <p>Rent records are available in the tenant and landlord workspaces.</p>
      </div>
    );
  return (
    <div className="page-stack rent-records-page">
      <section className="rent-managed-banner">
        <div>
          <span className="eyebrow">RENT RECORDS</span>
          <h2>
            {role === "tenant"
              ? "Keep your transfer details together"
              : "Review recorded rent transfers"}
          </h2>
          <p>
            Sample records stay in this tab until reload. No money moves and no
            bank account is provided.
          </p>
        </div>
        {nextRecord && (
          <button
            type="button"
            className="button"
            onClick={() => open(nextRecord, true)}
          >
            <Pencil size={16} aria-hidden="true" />
            Record transfer details
          </button>
        )}
      </section>
      <section
        className="rent-managed-metrics"
        aria-label="Rent record summary, all periods"
      >
        <div className="card">
          <span>Confirmed in sample records</span>
          <strong>
            {money(
              confirmed.reduce((sum, record) => sum + record.amountDueCents, 0),
            )}
          </strong>
          <small>{confirmed.length} records · all periods</small>
        </div>
        <div className="card">
          <span>Awaiting owner review</span>
          <strong>
            {
              records.filter(
                (record) => record.status === "Awaiting owner confirmation",
              ).length
            }
          </strong>
          <small>Recorded transfer details</small>
        </div>
        <div className="card">
          <span>Details to add or correct</span>
          <strong>
            {
              records.filter(
                (record) =>
                  record.status === "Awaiting transfer details" ||
                  record.status === "Needs correction",
              ).length
            }
          </strong>
          <small>Open a record to inspect it</small>
        </div>
      </section>
      <div className="rent-managed-filters">
        <label>
          Period
          <select
            value={filters.period}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                period: event.target.value,
              }))
            }
          >
            <option>All periods</option>
            {[...new Set(records.map((record) => record.period))]
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
          Status
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as RentRecordFilters["status"],
              }))
            }
          >
            <option>All statuses</option>
            {rentStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Property
          <select
            value={filters.property}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                property: event.target.value,
              }))
            }
          >
            <option>All properties</option>
            {[...new Set(records.map((record) => record.property))].map(
              (property) => (
                <option key={property}>{property}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Sort
          <select
            value={filters.sort}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sort: event.target.value as RentRecordFilters["sort"],
              }))
            }
          >
            <option>Most recently updated</option>
            <option>Amount: high to low</option>
            <option>Property name</option>
          </select>
        </label>
        {(activeFilters > 0 || filters.sort !== "Most recently updated") && (
          <button
            type="button"
            className="text-button"
            onClick={() => setFilters(defaultFilters())}
          >
            Reset{activeFilters ? ` (${activeFilters})` : " sort"}
          </button>
        )}
      </div>
      <section
        className="card rent-managed-list"
        aria-labelledby="rent-managed-list-title"
      >
        <header>
          <div>
            <h2 id="rent-managed-list-title">Rent records</h2>
            <p role="status">
              {visible.length} {visible.length === 1 ? "record" : "records"}{" "}
              match
            </p>
          </div>
          <button
            type="button"
            className="soft-button"
            onClick={exportRecords}
            disabled={!visible.length}
          >
            <Download size={16} aria-hidden="true" />
            Export visible CSV
          </button>
        </header>
        {visible.map((record) => (
          <button
            type="button"
            className="rent-managed-row"
            key={record.id}
            onClick={() => open(record)}
            aria-label={`Open ${periodLabel(record.period)} rent record for ${record.tenant}, ${record.property}`}
          >
            <span className="rent-managed-period">
              <strong>{periodLabel(record.period)}</strong>
              <small>{record.tenant}</small>
            </span>
            <span className="rent-managed-property">{record.property}</span>
            <span className="rent-managed-amount">
              <strong>{money(record.amountDueCents)}</strong>
              <small>Rent amount</small>
            </span>
            <RentStatus record={record} />
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ))}
        {!visible.length && (
          <div className="empty-state">
            <Search size={26} />
            <h3>No records match</h3>
            <p>Change the period, status, or property filter.</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setFilters(defaultFilters())}
            >
              Reset filters
            </button>
          </div>
        )}
      </section>
      <p className="rent-action-feedback" role="status">
        {feedback}
      </p>
      {selected && (
        <RentRecordDialog
          key={selected.id}
          record={selected}
          role={role}
          initiallyEditing={initiallyEditing}
          setState={setState}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
