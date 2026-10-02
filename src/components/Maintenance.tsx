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
  validateMaintenanceReport,
  validateMaintenanceSchedule,
  visibleMaintenanceRecords,
  type MaintenanceAction,
  type MaintenanceFilters,
  type MaintenanceRecord,
  type MaintenanceReportDraft,
  type MaintenanceScheduleDraft,
  type MaintenanceState,
  type ReportErrors,
  type ScheduleErrors,
} from "./maintenanceState";
import { useDialogFocus } from "./useDialogFocus";
import "./maintenance.css";

const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const timeLabel = (date: string) =>
  new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
            <span className="eyebrow">MAINTENANCE</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close maintenance dialog"
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

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span className="maintenance-field-error" id={id}>
      {message}
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
  const homes = maintenanceHomesForRole(role);
  const [draft, setDraft] = useState<MaintenanceReportDraft>({
    propertyId: homes.length === 1 ? String(homes[0].id) : "",
    title: "",
    description: "",
    category: "General repair",
    priority: "Medium",
    accessNotes: "",
  });
  const [errors, setErrors] = useState<ReportErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const update = (key: keyof MaintenanceReportDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  return (
    <MaintenanceDialog
      title={role === "tenant" ? "Report an issue" : "Add maintenance request"}
      onClose={onClose}
    >
      <p className="maintenance-local-note">
        This creates a local record for this session. No repair booking, message
        or file is sent.
      </p>
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
          const nextErrors = validateMaintenanceReport(submitted, role);
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
            Check the highlighted fields before saving.
          </p>
        )}
        <label>
          Property
          <select
            name="propertyId"
            aria-label="Property"
            value={draft.propertyId}
            onChange={(event) => update("propertyId", event.target.value)}
            required
            aria-invalid={Boolean(errors.propertyId)}
            aria-describedby={
              errors.propertyId ? "maintenance-property-error" : undefined
            }
          >
            <option value="">Choose a property</option>
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
          Issue title
          <input
            name="title"
            aria-label="Issue title"
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="For example, kitchen tap leaking"
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
          What happened?
          <textarea
            name="description"
            aria-label="What happened?"
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Describe the problem, where it is and when it started."
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
            Category
            <select
              name="category"
              aria-label="Category"
              value={draft.category}
              onChange={(event) => update("category", event.target.value)}
              aria-invalid={Boolean(errors.category)}
              aria-describedby={
                errors.category ? "maintenance-category-error" : undefined
              }
            >
              {maintenanceCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <FieldError
              id="maintenance-category-error"
              message={errors.category}
            />
          </label>
          <label>
            Priority
            <select
              name="priority"
              aria-label="Priority"
              value={draft.priority}
              onChange={(event) => update("priority", event.target.value)}
              aria-invalid={Boolean(errors.priority)}
              aria-describedby={
                errors.priority ? "maintenance-priority-error" : undefined
              }
            >
              {maintenancePriorities.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
            <FieldError
              id="maintenance-priority-error"
              message={errors.priority}
            />
          </label>
        </div>
        <label>
          Access notes <span className="maintenance-optional">(optional)</span>
          <textarea
            name="accessNotes"
            aria-label="Access notes"
            value={draft.accessNotes}
            onChange={(event) => update("accessNotes", event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Preferred access arrangements or useful details."
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
            Cancel
          </button>
          <button type="submit" className="button">
            <Plus size={16} />
            Save request
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
  const [errors, setErrors] = useState<ScheduleErrors>({});
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
        const nextErrors = validateMaintenanceSchedule(submitted);
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
      <h4>{record.visit ? "Update visit" : "Schedule a visit"}</h4>
      <p>
        Record arrangements you choose. The provider is not contacted by this
        action.
      </p>
      {Object.values(errors).some(Boolean) && (
        <p className="maintenance-error-summary" role="alert">
          Check the visit details before saving.
        </p>
      )}
      <label>
        Provider name
        <input
          name="provider"
          aria-label="Provider name"
          value={draft.provider}
          onChange={(event) => update("provider", event.target.value)}
          placeholder="Name of your chosen service provider"
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
          Visit date
          <input
            type="date"
            name="date"
            aria-label="Visit date"
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
          Visit time
          <input
            type="time"
            name="time"
            aria-label="Visit time"
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
          Cancel
        </button>
        <button type="submit" className="button">
          Save visit
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
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
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
        if (
          submittedNote.trim().length < 8 ||
          submittedNote.trim().length > 1000
        ) {
          setError("Add a note between 8 and 1,000 characters.");
          noteRef.current?.focus();
          return;
        }
        onSave(submittedNote);
      }}
    >
      <h4>
        {mode === "resolve" ? "Resolve this request" : "Reopen this request"}
      </h4>
      <label>
        {mode === "resolve"
          ? "What was repaired?"
          : "Why does this need more work?"}
        <textarea
          ref={noteRef}
          name="note"
          aria-label={
            mode === "resolve"
              ? "What was repaired?"
              : "Why does this need more work?"
          }
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setError("");
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
          Cancel
        </button>
        <button type="submit" className="button">
          {mode === "resolve" ? "Mark resolved" : "Reopen request"}
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
  const [panel, setPanel] = useState<"schedule" | "resolve" | "reopen" | null>(
    null,
  );
  const [feedback, setFeedback] = useState("");
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
  const act = (action: MaintenanceAction, message: string) => {
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
          {record.status}
        </span>
        <span className={`pill pill-${priorityTone(record.priority)}`}>
          {record.priority} priority
        </span>
        <small>Request #{record.id}</small>
      </div>
      <p className="maintenance-local-note">
        Local session record. Updates do not contact tenants or providers.
      </p>
      <dl className="maintenance-detail-facts">
        <div>
          <dt>Property</dt>
          <dd>{record.property}</dd>
        </div>
        <div>
          <dt>Occupant / context</dt>
          <dd>{record.tenant}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{record.category}</dd>
        </div>
        <div>
          <dt>Reported</dt>
          <dd>{timeLabel(record.reportedAt)}</dd>
        </div>
      </dl>
      <section className="maintenance-detail-section">
        <h3>Issue details</h3>
        <p>{record.description}</p>
        {record.accessNotes && (
          <>
            <h4>Access notes</h4>
            <p>{record.accessNotes}</p>
          </>
        )}
      </section>
      {record.visit && (
        <section className="maintenance-visit-summary">
          <CalendarDays size={22} aria-hidden="true" />
          <div>
            <h3>
              {record.status === "Resolved"
                ? "Recorded visit"
                : "Visit arrangements"}
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
            <h3>Resolution</h3>
            <p>{record.resolution}</p>
          </div>
        </section>
      )}
      {owner && (
        <section className="maintenance-detail-section">
          <h3>Manage request</h3>
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
                {record.visit ? "Update visit" : "Schedule visit"}
              </button>
            )}
            {(record.status === "New" || record.status === "Scheduled") && (
              <button
                ref={primaryActionRef}
                type="button"
                className="button"
                onClick={() =>
                  act({ type: "start" }, "Work marked in progress locally.")
                }
              >
                <Wrench size={16} />
                Start work
              </button>
            )}
            {record.status === "Scheduled" && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  act(
                    { type: "cancel-visit" },
                    "Visit removed. The request is back in New.",
                  )
                }
              >
                Remove visit
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
                Resolve request
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
                Reopen request
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
                setFeedback(
                  "Visit saved locally. The provider has not been contacted.",
                );
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
                    ? "Request marked resolved locally."
                    : "Request reopened locally.",
                )
              }
            />
          )}
        </section>
      )}
      <p className="maintenance-feedback" role="status">
        {feedback}
      </p>
      <section className="maintenance-detail-section">
        <h3>Request history</h3>
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
  const [view, setView] = useState<"Board" | "List">("Board");
  const [filters, setFilters] = useState<MaintenanceFilters>(
    createMaintenanceFilters,
  );
  const [reporting, setReporting] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const base = visibleMaintenanceRecords(state, role);
  const visible = filterMaintenanceRecords(base, filters);
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
      aria-label={`Open ${record.title} at ${record.property}`}
    >
      <span className="maintenance-work-ticket-top">
        <span className={`pill pill-${priorityTone(record.priority)}`}>
          {record.priority}
        </span>
        <span>{record.category}</span>
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
          {record.visit.provider} · {record.visit.date}
        </span>
      )}
    </button>
  );

  return (
    <div className="page-stack maintenance-workspace">
      <div className="page-actions">
        <div className="segment compact" aria-label="Maintenance layout">
          {(["Board", "List"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              className={view === mode ? "active" : ""}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode}
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
            {role === "tenant" ? "Report an issue" : "Add request"}
          </button>
        )}
      </div>
      <p className="maintenance-local-note">
        Sample workspace · Requests and updates stay available as you navigate
        this session.
      </p>
      <div className="maintenance-summary-grid">
        <div>
          <Wrench size={19} aria-hidden="true" />
          <span>
            <strong>{openCount}</strong>Open requests
          </span>
        </div>
        <div>
          <Clock3 size={19} aria-hidden="true" />
          <span>
            <strong>
              {base.filter((record) => record.status === "Scheduled").length}
            </strong>
            Scheduled visits
          </span>
        </div>
        <div>
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>
            <strong>{base.length - openCount}</strong>Resolved
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
              aria-label="Search maintenance"
              placeholder="Search requests"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
            />
          </label>
          <select
            aria-label="Maintenance status"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option>All statuses</option>
            {maintenanceStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select
            aria-label="Maintenance priority"
            value={filters.priority}
            onChange={(event) => updateFilter("priority", event.target.value)}
          >
            <option>All priorities</option>
            {maintenancePriorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
          <select
            aria-label="Maintenance category"
            value={filters.category}
            onChange={(event) => updateFilter("category", event.target.value)}
          >
            <option>All categories</option>
            {maintenanceCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          {role === "landlord" && (
            <select
              aria-label="Maintenance property"
              value={filters.property}
              onChange={(event) => updateFilter("property", event.target.value)}
            >
              <option value="All properties">All properties</option>
              {homes.map((home) => (
                <option key={home.id} value={home.id}>
                  {home.title}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Sort maintenance"
            value={filters.sort}
            onChange={(event) => updateFilter("sort", event.target.value)}
          >
            {[
              "Urgent first",
              "Newest reported",
              "Oldest unresolved",
              "Scheduled visit",
            ].map((sort) => (
              <option key={sort}>{sort}</option>
            ))}
          </select>
        </div>
        {activeFilters > 0 && (
          <button
            type="button"
            className="text-button"
            onClick={() => setFilters(createMaintenanceFilters())}
          >
            Reset ({activeFilters})
          </button>
        )}
      </div>
      <div className="maintenance-results-line">
        <p role="status">
          {visible.length} {visible.length === 1 ? "request" : "requests"}
          {filters.sort === "Oldest unresolved"
            ? " · resolved requests hidden"
            : ""}
        </p>
        <p className="maintenance-feedback" role="status">
          {feedback}
        </p>
      </div>
      {view === "Board" ? (
        <section
          className="maintenance-work-board"
          aria-label="Maintenance request board"
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
                  aria-label={status}
                >
                  <header>
                    <h3>{status}</h3>
                    <span>{records.length}</span>
                  </header>
                  {records.map(renderTicket)}
                  {!records.length && (
                    <p className="maintenance-column-empty">No requests</p>
                  )}
                </section>
              );
            })}
        </section>
      ) : (
        <section
          className="card maintenance-work-list"
          aria-label="Maintenance requests"
        >
          {visible.map((record) => (
            <button
              type="button"
              key={record.id}
              onClick={() => setSelectedId(record.id)}
              aria-label={`Open ${record.title} at ${record.property}`}
            >
              <Wrench size={20} aria-hidden="true" />
              <span className="maintenance-work-list-title">
                <strong>{record.title}</strong>
                <small>
                  {record.property} · {record.category}
                </small>
              </span>
              <span className={`pill pill-${priorityTone(record.priority)}`}>
                {record.priority}
              </span>
              <span
                className={`pill pill-${record.status === "Resolved" ? "mint" : "blue"}`}
              >
                {record.status}
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
            {homes.length
              ? "No requests match these filters"
              : "No maintenance records in this workspace"}
          </h3>
          {activeFilters > 0 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setFilters(createMaintenanceFilters())}
            >
              Reset filters
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
            setFeedback("Maintenance request recorded locally.");
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
