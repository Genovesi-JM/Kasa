import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Plus,
  Search,
  Wrench,
  X,
} from "lucide-react";
import type { Role } from "../types";
import {
  addMaintenanceReport,
  changeMaintenanceStatus,
  createMaintenanceFilters,
  filterMaintenanceRecords,
  maintenanceCategories,
  maintenanceDateValue,
  maintenanceHomesForRole,
  maintenancePriorities,
  maintenanceStatuses,
  scheduleMaintenanceVisit,
  maintenanceReportIssues,
  maintenanceScheduleIssues,
  maintenanceNoteIssue,
  visibleMaintenanceRecords,
  type MaintenanceAction,
  type MaintenanceFilters,
  type MaintenanceRecord,
  type MaintenanceReportDraft,
  type MaintenanceScheduleDraft,
  type MaintenanceState,
  type ReportIssues,
  type ScheduleIssues,
  type MaintenanceIssueCode,
} from "./maintenanceState";
import { useDialogFocus } from "./useDialogFocus";
import { useOperationsI18n } from "./useOperationsI18n";
import type { OperationsKey } from "../locales/operations/types";
import {
  maintenanceCategoryKeys,
  maintenanceFormatters,
  maintenanceIssueKeys,
  maintenancePriorityKeys,
  maintenanceSortKeys,
  maintenanceStatusKeys,
  maintenanceViewKeys,
} from "../locales/operations/maintenanceLabels";
import "./maintenance.css";

const priorityTone = (priority: MaintenanceRecord["priority"]) =>
  priority === "Urgent" ? "red" : priority === "Medium" ? "amber" : "neutral";

function MaintenanceDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { tr } = useOperationsI18n();
  const titleId = useId();
  const ref = useDialogFocus<HTMLDivElement>(onClose);
  return (
    <div
      className="modal-layer maintenance-dialog-layer"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="modal-card maintenance-dialog-card">
        <header>
          <div>
            <span className="eyebrow">{tr("maintenance_title")}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={tr("maintenance_closeDialog")}
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body maintenance-dialog-body">{children}</div>
      </section>
    </div>
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: MaintenanceIssueCode | null;
}) {
  const { tr } = useOperationsI18n();
  return message ? (
    <span className="maintenance-field-error" id={id}>
      {tr(maintenanceIssueKeys[message])}
    </span>
  ) : null;
}

function ReportForm({
  role,
  onClose,
  onCreate,
}: {
  role: Role;
  onClose: () => void;
  onCreate: (draft: MaintenanceReportDraft) => void;
}) {
  const { tr } = useOperationsI18n();
  const homes = maintenanceHomesForRole(role);
  const [draft, setDraft] = useState<MaintenanceReportDraft>({
    propertyId: homes.length === 1 ? String(homes[0].id) : "",
    title: "",
    description: "",
    category: "General repair",
    priority: "Medium",
    accessNotes: "",
  });
  const [errors, setErrors] = useState<ReportIssues>({});
  const formRef = useRef<HTMLFormElement>(null);
  const update = (key: keyof MaintenanceReportDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  return (
    <MaintenanceDialog
      title={tr(
        role === "tenant"
          ? "maintenance_reportIssue"
          : "maintenance_addMaintenance",
      )}
      onClose={onClose}
    >
      <p className="maintenance-local-note">{tr("maintenance_reportScope")}</p>
      <form
        ref={formRef}
        className="maintenance-report-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const submitted: MaintenanceReportDraft = {
            propertyId: String(fields.get("propertyId") ?? ""),
            title: String(fields.get("title") ?? ""),
            description: String(fields.get("description") ?? ""),
            category: String(fields.get("category") ?? ""),
            priority: String(fields.get("priority") ?? ""),
            accessNotes: String(fields.get("accessNotes") ?? ""),
          };
          setDraft(submitted);
          const nextErrors = maintenanceReportIssues(submitted, role);
          setErrors(nextErrors);
          if (Object.keys(nextErrors).length) {
            requestAnimationFrame(() =>
              formRef.current
                ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                ?.focus(),
            );
            return;
          }
          onCreate(submitted);
        }}
      >
        {Object.values(errors).some(Boolean) && (
          <p className="maintenance-error-summary" role="alert">
            {tr("maintenance_checkFields")}
          </p>
        )}
        <label>
          {tr("maintenance_property")}
          <select
            name="propertyId"
            aria-label={tr("maintenance_property")}
            value={draft.propertyId}
            onChange={(event) => update("propertyId", event.target.value)}
            required
            aria-invalid={Boolean(errors.propertyId)}
            aria-describedby={
              errors.propertyId ? "maintenance-property-error" : undefined
            }
          >
            <option value="">{tr("maintenance_chooseProperty")}</option>
            {homes.map((home) => (
              <option key={home.id} value={home.id}>
                {home.title}
              </option>
            ))}
          </select>
          <FieldError
            id="maintenance-property-error"
            message={errors.propertyId}
          />
        </label>
        <label>
          {tr("maintenance_issueTitle")}
          <input
            name="title"
            aria-label={tr("maintenance_issueTitle")}
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder={tr("maintenance_titlePlaceholder")}
            maxLength={120}
            required
            aria-invalid={Boolean(errors.title)}
            aria-describedby={
              errors.title ? "maintenance-title-error" : undefined
            }
          />
          <FieldError id="maintenance-title-error" message={errors.title} />
        </label>
        <label>
          {tr("maintenance_description")}
          <textarea
            name="description"
            aria-label={tr("maintenance_description")}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={tr("maintenance_descriptionPlaceholder")}
            required
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? "maintenance-description-error" : undefined
            }
          />
          <FieldError
            id="maintenance-description-error"
            message={errors.description}
          />
        </label>
        <div className="maintenance-form-columns">
          <label>
            {tr("maintenance_category")}
            <select
              name="category"
              aria-label={tr("maintenance_category")}
              value={draft.category}
              onChange={(event) => update("category", event.target.value)}
              aria-invalid={Boolean(errors.category)}
              aria-describedby={
                errors.category ? "maintenance-category-error" : undefined
              }
            >
              {maintenanceCategories.map((category) => (
                <option key={category} value={category}>
                  {tr(maintenanceCategoryKeys[category])}
                </option>
              ))}
            </select>
            <FieldError
              id="maintenance-category-error"
              message={errors.category}
            />
          </label>
          <label>
            {tr("maintenance_priority")}
            <select
              name="priority"
              aria-label={tr("maintenance_priority")}
              value={draft.priority}
              onChange={(event) => update("priority", event.target.value)}
              aria-invalid={Boolean(errors.priority)}
              aria-describedby={
                errors.priority ? "maintenance-priority-error" : undefined
              }
            >
              {maintenancePriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {tr(maintenancePriorityKeys[priority])}
                </option>
              ))}
            </select>
            <FieldError
              id="maintenance-priority-error"
              message={errors.priority}
            />
          </label>
        </div>
        <label>
          {tr("maintenance_accessNotes")}{" "}
          <span className="maintenance-optional">
            {tr("maintenance_optional")}
          </span>
          <textarea
            name="accessNotes"
            aria-label={tr("maintenance_accessNotes")}
            value={draft.accessNotes}
            onChange={(event) => update("accessNotes", event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={tr("maintenance_accessPlaceholder")}
            aria-invalid={Boolean(errors.accessNotes)}
            aria-describedby={
              errors.accessNotes ? "maintenance-access-error" : undefined
            }
          />
          <FieldError
            id="maintenance-access-error"
            message={errors.accessNotes}
          />
        </label>
        <div className="maintenance-form-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            {tr("maintenance_cancel")}
          </button>
          <button type="submit" className="button">
            <Plus size={16} />
            {tr("maintenance_saveRequest")}
          </button>
        </div>
      </form>
    </MaintenanceDialog>
  );
}

function ScheduleForm({
  record,
  onSave,
  onCancel,
}: {
  record: MaintenanceRecord;
  onSave: (draft: MaintenanceScheduleDraft) => void;
  onCancel: () => void;
}) {
  const { tr } = useOperationsI18n();
  const [draft, setDraft] = useState<MaintenanceScheduleDraft>(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureVisit =
      record.visit &&
      new Date(`${record.visit.date}T${record.visit.time}:00`).getTime() >
        now.getTime()
        ? record.visit
        : undefined;
    return {
      provider: record.visit?.provider || "",
      date: futureVisit?.date || maintenanceDateValue(tomorrow),
      time: futureVisit?.time || "10:00",
    };
  });
  const [errors, setErrors] = useState<ScheduleIssues>({});
  const formRef = useRef<HTMLFormElement>(null);
  const update = (key: keyof MaintenanceScheduleDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  return (
    <form
      ref={formRef}
      className="maintenance-schedule-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const submitted: MaintenanceScheduleDraft = {
          provider: String(fields.get("provider") ?? ""),
          date: String(fields.get("date") ?? ""),
          time: String(fields.get("time") ?? ""),
        };
        setDraft(submitted);
        const nextErrors = maintenanceScheduleIssues(submitted);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) {
          requestAnimationFrame(() =>
            formRef.current
              ?.querySelector<HTMLElement>('[aria-invalid="true"]')
              ?.focus(),
          );
          return;
        }
        onSave(submitted);
      }}
    >
      <h4>
        {tr(
          record.visit
            ? "maintenance_updateVisit"
            : "maintenance_scheduleVisit",
        )}
      </h4>
      <p>{tr("maintenance_scheduleScope")}</p>
      {Object.values(errors).some(Boolean) && (
        <p className="maintenance-error-summary" role="alert">
          {tr("maintenance_checkVisit")}
        </p>
      )}
      <label>
        {tr("maintenance_provider")}
        <input
          name="provider"
          aria-label={tr("maintenance_provider")}
          value={draft.provider}
          onChange={(event) => update("provider", event.target.value)}
          placeholder={tr("maintenance_providerPlaceholder")}
          maxLength={100}
          required
          aria-invalid={Boolean(errors.provider)}
          aria-describedby={
            errors.provider ? "maintenance-provider-error" : undefined
          }
        />
        <FieldError id="maintenance-provider-error" message={errors.provider} />
      </label>
      <div className="maintenance-form-columns">
        <label>
          {tr("maintenance_visitDate")}
          <input
            type="date"
            name="date"
            aria-label={tr("maintenance_visitDate")}
            value={draft.date}
            min={maintenanceDateValue()}
            onInput={(event) => update("date", event.currentTarget.value)}
            onChange={(event) => update("date", event.target.value)}
            required
            aria-invalid={Boolean(errors.date)}
            aria-describedby={
              errors.date ? "maintenance-date-error" : undefined
            }
          />
          <FieldError id="maintenance-date-error" message={errors.date} />
        </label>
        <label>
          {tr("maintenance_visitTime")}
          <input
            type="time"
            name="time"
            aria-label={tr("maintenance_visitTime")}
            value={draft.time}
            onInput={(event) => update("time", event.currentTarget.value)}
            onChange={(event) => update("time", event.target.value)}
            required
            aria-invalid={Boolean(errors.time)}
            aria-describedby={
              errors.time ? "maintenance-time-error" : undefined
            }
          />
          <FieldError id="maintenance-time-error" message={errors.time} />
        </label>
      </div>
      <div className="maintenance-form-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
        >
          {tr("maintenance_cancel")}
        </button>
        <button type="submit" className="button">
          {tr("maintenance_saveVisit")}
        </button>
      </div>
    </form>
  );
}

function ResolutionForm({
  mode,
  onSave,
  onCancel,
}: {
  mode: "resolve" | "reopen";
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const { tr } = useOperationsI18n();
  const [note, setNote] = useState("");
  const [error, setError] = useState<MaintenanceIssueCode | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  return (
    <form
      className="maintenance-schedule-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const submittedNote = String(
          new FormData(event.currentTarget).get("note") ?? "",
        );
        setNote(submittedNote);
        const issue = maintenanceNoteIssue(submittedNote);
        if (issue) {
          setError(issue);
          noteRef.current?.focus();
          return;
        }
        onSave(submittedNote);
      }}
    >
      <h4>
        {tr(
          mode === "resolve"
            ? "maintenance_resolveTitle"
            : "maintenance_reopenTitle",
        )}
      </h4>
      <label>
        {tr(
          mode === "resolve"
            ? "maintenance_repairedQuestion"
            : "maintenance_reopenQuestion",
        )}
        <textarea
          ref={noteRef}
          name="note"
          aria-label={tr(
            mode === "resolve"
              ? "maintenance_repairedQuestion"
              : "maintenance_reopenQuestion",
          )}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setError(null);
          }}
          rows={3}
          maxLength={1000}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "maintenance-resolution-error" : undefined}
        />
        <FieldError id="maintenance-resolution-error" message={error} />
      </label>
      <div className="maintenance-form-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
        >
          {tr("maintenance_cancel")}
        </button>
        <button type="submit" className="button">
          {tr(
            mode === "resolve"
              ? "maintenance_markResolved"
              : "maintenance_reopenRequest",
          )}
        </button>
      </div>
    </form>
  );
}

function RequestDetail({
  record,
  role,
  onClose,
  onAction,
  onSchedule,
}: {
  record: MaintenanceRecord;
  role: Role;
  onClose: () => void;
  onAction: (action: MaintenanceAction) => void;
  onSchedule: (draft: MaintenanceScheduleDraft) => void;
}) {
  const { tr, locale } = useOperationsI18n();
  const { timeLabel } = maintenanceFormatters(locale);
  const [panel, setPanel] = useState<"schedule" | "resolve" | "reopen" | null>(
    null,
  );
  const [feedback, setFeedback] = useState<OperationsKey | null>(null);
  const scheduleActionRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<"schedule" | "primary" | null>(null);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const target =
      pendingFocus.current === "schedule"
        ? scheduleActionRef.current
        : primaryActionRef.current;
    pendingFocus.current = null;
    target?.focus();
  });
  const owner = role === "landlord";
  const closePanel = () => {
    pendingFocus.current = panel === "schedule" ? "schedule" : "primary";
    setPanel(null);
  };
  const act = (action: MaintenanceAction, message: OperationsKey) => {
    pendingFocus.current =
      action.type === "cancel-visit" ? "schedule" : "primary";
    onAction(action);
    setPanel(null);
    setFeedback(message);
  };
  return (
    <MaintenanceDialog title={record.title} onClose={onClose}>
      <div className="maintenance-detail-heading">
        <span
          className={`pill pill-${record.status === "Resolved" ? "mint" : "blue"}`}
        >
          {tr(maintenanceStatusKeys[record.status])}
        </span>
        <span className={`pill pill-${priorityTone(record.priority)}`}>
          {tr("maintenance_priority")}:{" "}
          {tr(maintenancePriorityKeys[record.priority])}
        </span>
        <small>{tr("maintenance_requestId", { id: record.id })}</small>
      </div>
      <p className="maintenance-local-note">{tr("maintenance_detailScope")}</p>
      <dl className="maintenance-detail-facts">
        <div>
          <dt>{tr("maintenance_property")}</dt>
          <dd>{record.property}</dd>
        </div>
        <div>
          <dt>{tr("maintenance_occupant")}</dt>
          <dd>{record.tenant}</dd>
        </div>
        <div>
          <dt>{tr("maintenance_category")}</dt>
          <dd>{tr(maintenanceCategoryKeys[record.category])}</dd>
        </div>
        <div>
          <dt>{tr("maintenance_reported")}</dt>
          <dd>{timeLabel(record.reportedAt)}</dd>
        </div>
      </dl>
      <section className="maintenance-detail-section">
        <h3>{tr("maintenance_issueDetails")}</h3>
        <p>{record.description}</p>
        {record.accessNotes && (
          <>
            <h4>{tr("maintenance_accessNotes")}</h4>
            <p>{record.accessNotes}</p>
          </>
        )}
      </section>
      {record.visit && (
        <section className="maintenance-visit-summary">
          <CalendarDays size={22} aria-hidden="true" />
          <div>
            <h3>
              {tr(
                record.status === "Resolved"
                  ? "maintenance_recordedVisit"
                  : "maintenance_visitArrangements",
              )}
            </h3>
            <strong>
              {timeLabel(`${record.visit.date}T${record.visit.time}`)}
            </strong>
            <p>{record.visit.provider}</p>
          </div>
        </section>
      )}
      {record.resolution && (
        <section className="maintenance-resolution-summary">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <h3>{tr("maintenance_resolution")}</h3>
            <p>{record.resolution}</p>
          </div>
        </section>
      )}
      {owner && (
        <section className="maintenance-detail-section">
          <h3>{tr("maintenance_manage")}</h3>
          <div className="maintenance-owner-actions">
            {record.status !== "Resolved" && (
              <button
                ref={scheduleActionRef}
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setPanel(panel === "schedule" ? null : "schedule")
                }
                aria-expanded={panel === "schedule"}
              >
                <CalendarDays size={16} />
                {tr(
                  record.visit
                    ? "maintenance_updateVisit"
                    : "maintenance_scheduleVisit",
                )}
              </button>
            )}
            {(record.status === "New" || record.status === "Scheduled") && (
              <button
                ref={primaryActionRef}
                type="button"
                className="button"
                onClick={() => act({ type: "start" }, "maintenance_started")}
              >
                <Wrench size={16} />
                {tr("maintenance_startWork")}
              </button>
            )}
            {record.status === "Scheduled" && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  act({ type: "cancel-visit" }, "maintenance_visitRemoved")
                }
              >
                {tr("maintenance_removeVisit")}
              </button>
            )}
            {record.status === "In progress" && (
              <button
                ref={primaryActionRef}
                type="button"
                className="button"
                onClick={() => setPanel("resolve")}
                aria-expanded={panel === "resolve"}
              >
                <CheckCircle2 size={16} />
                {tr("maintenance_resolveRequest")}
              </button>
            )}
            {record.status === "Resolved" && (
              <button
                ref={primaryActionRef}
                type="button"
                className="button button-secondary"
                onClick={() => setPanel("reopen")}
                aria-expanded={panel === "reopen"}
              >
                {tr("maintenance_reopenRequest")}
              </button>
            )}
          </div>
          {panel === "schedule" && record.status !== "Resolved" && (
            <ScheduleForm
              record={record}
              onCancel={closePanel}
              onSave={(draft) => {
                pendingFocus.current = "schedule";
                onSchedule(draft);
                setPanel(null);
                setFeedback("maintenance_visitSaved");
              }}
            />
          )}
          {(panel === "resolve" || panel === "reopen") && (
            <ResolutionForm
              key={panel}
              mode={panel}
              onCancel={closePanel}
              onSave={(note) =>
                act(
                  { type: panel, note },
                  panel === "resolve"
                    ? "maintenance_resolved"
                    : "maintenance_reopened",
                )
              }
            />
          )}
        </section>
      )}
      <p className="maintenance-feedback" role="status">
        {feedback && tr(feedback)}
      </p>
      <section className="maintenance-detail-section">
        <h3>{tr("maintenance_history")}</h3>
        <ol className="maintenance-history">
          {[...record.history].reverse().map((entry) => (
            <li key={entry.id}>
              <strong>{entry.actor}</strong>
              <span>{entry.description}</span>
              <time dateTime={entry.at}>{timeLabel(entry.at)}</time>
            </li>
          ))}
        </ol>
      </section>
    </MaintenanceDialog>
  );
}

export function Maintenance({
  role,
  state,
  setState,
}: {
  role: Role;
  state: MaintenanceState;
  setState: Dispatch<SetStateAction<MaintenanceState>>;
}) {
  const { tr, locale } = useOperationsI18n();
  const { dateLabel } = maintenanceFormatters(locale);
  const [view, setView] = useState<"Board" | "List">("Board");
  const [filters, setFilters] = useState<MaintenanceFilters>(
    createMaintenanceFilters,
  );
  const [reporting, setReporting] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<OperationsKey | null>(null);
  const base = visibleMaintenanceRecords(state, role);
  const visible = filterMaintenanceRecords(base, filters, (record) =>
    [
      tr(maintenanceCategoryKeys[record.category]),
      tr(maintenancePriorityKeys[record.priority]),
      tr(maintenanceStatusKeys[record.status]),
    ].join(" "),
  );
  const homes = maintenanceHomesForRole(role);
  const selected = base.find((record) => record.id === selectedId);
  const updateFilter = (key: keyof MaintenanceFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const activeFilters =
    Number(Boolean(filters.query.trim())) +
    Number(filters.status !== "All statuses") +
    Number(filters.priority !== "All priorities") +
    Number(filters.category !== "All categories") +
    Number(filters.property !== "All properties");
  const openCount = base.filter(
    (record) => record.status !== "Resolved",
  ).length;
  const renderTicket = (record: MaintenanceRecord) => (
    <button
      type="button"
      key={record.id}
      className="maintenance-work-ticket"
      onClick={() => setSelectedId(record.id)}
      aria-label={tr("maintenance_openRequest", {
        title: record.title,
        property: record.property,
      })}
    >
      <span className="maintenance-work-ticket-top">
        <span className={`pill pill-${priorityTone(record.priority)}`}>
          {tr(maintenancePriorityKeys[record.priority])}
        </span>
        <span>{tr(maintenanceCategoryKeys[record.category])}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </span>
      <strong>{record.title}</strong>
      <span className="maintenance-work-ticket-property">
        {record.property}
      </span>
      <span className="maintenance-work-ticket-meta">
        <CalendarDays size={13} aria-hidden="true" />
        {dateLabel(record.reportedAt)}
      </span>
      <span className="maintenance-work-ticket-tenant">{record.tenant}</span>
      {record.visit && (
        <span className="maintenance-work-ticket-provider">
          <Wrench size={13} aria-hidden="true" />
          {record.visit.provider} · {dateLabel(record.visit.date)}
        </span>
      )}
    </button>
  );

  return (
    <div className="page-stack maintenance-workspace">
      <div className="page-actions">
        <div className="segment compact" aria-label={tr("maintenance_layout")}>
          {(["Board", "List"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              className={view === mode ? "active" : ""}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {tr(maintenanceViewKeys[mode])}
            </button>
          ))}
        </div>
        {homes.length > 0 && (
          <button
            type="button"
            className="button"
            onClick={() => setReporting(true)}
          >
            <Plus size={17} />
            {tr(
              role === "tenant"
                ? "maintenance_reportIssue"
                : "maintenance_addRequest",
            )}
          </button>
        )}
      </div>
      <p className="maintenance-local-note">{tr("maintenance_sessionScope")}</p>
      <div className="maintenance-summary-grid">
        <div>
          <Wrench size={19} aria-hidden="true" />
          <span>
            <strong>{openCount}</strong>
            {tr("maintenance_openRequests")}
          </span>
        </div>
        <div>
          <Clock3 size={19} aria-hidden="true" />
          <span>
            <strong>
              {base.filter((record) => record.status === "Scheduled").length}
            </strong>
            {tr("maintenance_scheduledVisits")}
          </span>
        </div>
        <div>
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>
            <strong>{base.length - openCount}</strong>
            {tr("maintenance_statusResolved")}
          </span>
        </div>
      </div>
      <div className="filter-toolbar maintenance-filter-toolbar">
        <span className="filter-toolbar-icon">
          <Filter size={16} aria-hidden="true" />
        </span>
        <div className="filter-toolbar-fields">
          <label className="filter-search">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label={tr("maintenance_search")}
              placeholder={tr("maintenance_searchPlaceholder")}
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
            />
          </label>
          <select
            aria-label={tr("maintenance_statusFilter")}
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="All statuses">
              {tr("maintenance_allStatuses")}
            </option>
            {maintenanceStatuses.map((status) => (
              <option key={status} value={status}>
                {tr(maintenanceStatusKeys[status])}
              </option>
            ))}
          </select>
          <select
            aria-label={tr("maintenance_priorityFilter")}
            value={filters.priority}
            onChange={(event) => updateFilter("priority", event.target.value)}
          >
            <option value="All priorities">
              {tr("maintenance_allPriorities")}
            </option>
            {maintenancePriorities.map((priority) => (
              <option key={priority} value={priority}>
                {tr(maintenancePriorityKeys[priority])}
              </option>
            ))}
          </select>
          <select
            aria-label={tr("maintenance_categoryFilter")}
            value={filters.category}
            onChange={(event) => updateFilter("category", event.target.value)}
          >
            <option value="All categories">
              {tr("maintenance_allCategories")}
            </option>
            {maintenanceCategories.map((category) => (
              <option key={category} value={category}>
                {tr(maintenanceCategoryKeys[category])}
              </option>
            ))}
          </select>
          {role === "landlord" && (
            <select
              aria-label={tr("maintenance_propertyFilter")}
              value={filters.property}
              onChange={(event) => updateFilter("property", event.target.value)}
            >
              <option value="All properties">
                {tr("maintenance_allProperties")}
              </option>
              {homes.map((home) => (
                <option key={home.id} value={home.id}>
                  {home.title}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label={tr("maintenance_sort")}
            value={filters.sort}
            onChange={(event) => updateFilter("sort", event.target.value)}
          >
            {Object.entries(maintenanceSortKeys).map(([sort, key]) => (
              <option key={sort} value={sort}>
                {tr(key)}
              </option>
            ))}
          </select>
        </div>
        {activeFilters > 0 && (
          <button
            type="button"
            className="text-button"
            onClick={() => setFilters(createMaintenanceFilters())}
          >
            {tr("maintenance_resetActive", { count: activeFilters })}
          </button>
        )}
      </div>
      <div className="maintenance-results-line">
        <p role="status">
          {tr("maintenance_results", { count: visible.length })}
          {filters.sort === "Oldest unresolved"
            ? ` · ${tr("maintenance_resolvedHidden")}`
            : ""}
        </p>
        <p className="maintenance-feedback" role="status">
          {feedback && tr(feedback)}
        </p>
      </div>
      {view === "Board" ? (
        <section
          className="maintenance-work-board"
          aria-label={tr("maintenance_boardLabel")}
        >
          {maintenanceStatuses
            .filter(
              (status) =>
                filters.status === "All statuses" || filters.status === status,
            )
            .map((status) => {
              const records = visible.filter(
                (record) => record.status === status,
              );
              return (
                <section
                  className="maintenance-work-column"
                  key={status}
                  aria-label={tr(maintenanceStatusKeys[status])}
                >
                  <header>
                    <h3>{tr(maintenanceStatusKeys[status])}</h3>
                    <span>{records.length}</span>
                  </header>
                  {records.map(renderTicket)}
                  {!records.length && (
                    <p className="maintenance-column-empty">
                      {tr("maintenance_noRequests")}
                    </p>
                  )}
                </section>
              );
            })}
        </section>
      ) : (
        <section
          className="card maintenance-work-list"
          aria-label={tr("maintenance_listLabel")}
        >
          {visible.map((record) => (
            <button
              type="button"
              key={record.id}
              onClick={() => setSelectedId(record.id)}
              aria-label={tr("maintenance_openRequest", {
                title: record.title,
                property: record.property,
              })}
            >
              <Wrench size={20} aria-hidden="true" />
              <span className="maintenance-work-list-title">
                <strong>{record.title}</strong>
                <small>
                  {record.property} ·{" "}
                  {tr(maintenanceCategoryKeys[record.category])}
                </small>
              </span>
              <span className={`pill pill-${priorityTone(record.priority)}`}>
                {tr(maintenancePriorityKeys[record.priority])}
              </span>
              <span
                className={`pill pill-${record.status === "Resolved" ? "mint" : "blue"}`}
              >
                {tr(maintenanceStatusKeys[record.status])}
              </span>
              <time dateTime={record.reportedAt}>
                {dateLabel(record.reportedAt)}
              </time>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          ))}
        </section>
      )}
      {!visible.length && (
        <div className="maintenance-work-empty">
          <Search size={25} aria-hidden="true" />
          <h3>
            {tr(
              homes.length ? "maintenance_noMatches" : "maintenance_noRecords",
            )}
          </h3>
          {activeFilters > 0 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setFilters(createMaintenanceFilters())}
            >
              {tr("maintenance_resetFilters")}
            </button>
          )}
        </div>
      )}
      {reporting && homes.length > 0 && (
        <ReportForm
          key={role}
          role={role}
          onClose={() => setReporting(false)}
          onCreate={(draft) => {
            setState((current) => addMaintenanceReport(current, role, draft));
            setReporting(false);
            setFilters(createMaintenanceFilters());
            setFeedback("maintenance_recorded");
          }}
        />
      )}
      {selected && (
        <RequestDetail
          key={`${role}-${selected.id}`}
          record={selected}
          role={role}
          onClose={() => setSelectedId(null)}
          onAction={(action) =>
            setState((current) =>
              changeMaintenanceStatus(current, role, selected.id, action),
            )
          }
          onSchedule={(draft) =>
            setState((current) =>
              scheduleMaintenanceVisit(current, role, selected.id, draft),
            )
          }
        />
      )}
    </div>
  );
}
