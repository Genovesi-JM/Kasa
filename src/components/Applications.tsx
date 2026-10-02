import { useState, type Dispatch, type SetStateAction } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Role } from "../types";
import {
  applicationCompleteness,
  canReviewApplication,
  updateApplication,
  visibleApplicationRecords,
  type ApplicationAction,
  type ApplicationRecord,
  type ApplicationState,
} from "./applicationState";
import { useDialogFocus } from "./useDialogFocus";
import "./applications.css";

const statuses = ["All", "Review", "Documents", "Approved", "Draft"] as const;
const displayStatus = (status: ApplicationRecord["status"]) =>
  status === "Review"
    ? "Under review"
    : status === "Documents"
      ? "Documents requested"
      : status;
const displayDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function ApplicationStatus({
  status,
}: {
  status: ApplicationRecord["status"];
}) {
  return (
    <span
      className={`pill pill-${status === "Approved" ? "mint" : status === "Documents" ? "amber" : status === "Draft" ? "neutral" : "blue"}`}
    >
      {displayStatus(status)}
    </span>
  );
}

function ApplicationDetail({
  record,
  role,
  onAction,
  onClose,
}: {
  record: ApplicationRecord;
  role: Role;
  onAction: (action: ApplicationAction) => void;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const [requesting, setRequesting] = useState(false);
  const [requestedDocuments, setRequestedDocuments] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [confirmApproval, setConfirmApproval] = useState(false);
  const [feedback, setFeedback] = useState("");
  const ownerCanAct = canReviewApplication(record, role);
  const completeness = applicationCompleteness(record);
  const applyAction = (action: ApplicationAction, message: string) => {
    onAction(action);
    setFeedback(message);
  };

  return (
    <div
      className="modal-layer application-detail-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="application-detail-title"
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
      <section className="modal-card application-detail-card">
        <header>
          <div>
            <span className="eyebrow">APPLICATION #{100 + record.id}</span>
            <h2 id="application-detail-title">{record.applicant}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close application"
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body application-detail-body">
          <div className="application-detail-property">
            <div>
              <h3>{record.property}</h3>
              <p>
                {record.submission
                  ? "Recorded locally"
                  : record.status === "Draft"
                    ? "Draft created"
                    : "Submitted"}{" "}
                {displayDate(record.submittedAt)}
              </p>
            </div>
            <ApplicationStatus status={record.status} />
          </div>
          <p className="application-local-note">
            {record.submission ? "Local application" : "Sample record"} ·
            Changes stay in this browser session. No documents or notifications
            are sent.
          </p>

          {record.submission && (
            <section
              className="application-detail-section"
              aria-labelledby="application-submission-title"
            >
              <h3 id="application-submission-title">Application details</h3>
              <dl className="application-submission-details">
                <div>
                  <dt>Preferred move-in date</dt>
                  <dd>
                    {displayDate(`${record.submission.moveInDate}T12:00:00`)}
                  </dd>
                </div>
                <div>
                  <dt>Number of people</dt>
                  <dd>{record.submission.householdSize}</dd>
                </div>
                <div>
                  <dt>Introduction</dt>
                  <dd>
                    {record.submission.introduction || "Not added (optional)"}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <section
            className="application-detail-section"
            aria-labelledby="application-profile-title"
          >
            <div className="application-section-heading">
              <h3 id="application-profile-title">Profile completeness</h3>
              <strong>{completeness}%</strong>
            </div>
            <progress
              max={100}
              value={completeness}
              aria-label="Profile completeness"
            />
            <ul className="application-profile-checklist">
              {record.profileFields.map((field) => (
                <li key={field.label}>
                  <span
                    className={
                      field.present ? "field-present" : "field-missing"
                    }
                  >
                    {field.present ? (
                      <Check size={15} aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true">—</span>
                    )}
                  </span>
                  <span>{field.label}</span>
                  <small>{field.present ? "Present" : "Not added"}</small>
                </li>
              ))}
            </ul>
            <p className="application-explanation">
              Completeness counts supplied fields. It does not rank applicants
              or determine approval.
            </p>
          </section>

          <section
            className="application-detail-section"
            aria-labelledby="application-documents-title"
          >
            <div className="application-section-heading">
              <h3 id="application-documents-title">Document summaries</h3>
              <span>
                {
                  record.documents.filter(
                    (document) => document.status === "Supplied",
                  ).length
                }{" "}
                / {record.documents.length} supplied
              </span>
            </div>
            <div className="application-document-list">
              {record.documents.map((document) => (
                <details key={document.id}>
                  <summary>
                    <FileText size={18} aria-hidden="true" />
                    <strong>{document.name}</strong>
                    <span
                      className={`application-document-status ${document.status.toLowerCase()}`}
                    >
                      {document.status}
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </summary>
                  <p>{document.summary}</p>
                </details>
              ))}
            </div>
            {record.documentRequest && (
              <div className="application-request-note">
                <strong>Document request</strong>
                <p>{record.documentRequest}</p>
              </div>
            )}
          </section>

          {ownerCanAct && (
            <section
              className="application-detail-section application-owner-actions"
              aria-labelledby="application-review-title"
            >
              <h3 id="application-review-title">Owner review</h3>
              <p className="application-explanation">
                Review the record and choose the next step yourself.
              </p>
              <div className="application-review-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setRequesting((value) => !value);
                    setConfirmApproval(false);
                  }}
                  aria-expanded={requesting}
                >
                  Request documents
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={record.reviewed}
                  onClick={() =>
                    applyAction(
                      { type: "mark-reviewed" },
                      "Marked as reviewed in this workspace.",
                    )
                  }
                >
                  <ClipboardCheck size={16} />
                  {record.reviewed ? "Reviewed" : "Mark as reviewed"}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={!record.reviewed}
                  aria-describedby={
                    !record.reviewed ? "application-review-hint" : undefined
                  }
                  onClick={() => {
                    setConfirmApproval(true);
                    setRequesting(false);
                  }}
                >
                  Approve application
                </button>
              </div>
              {!record.reviewed && (
                <p
                  id="application-review-hint"
                  className="application-explanation"
                >
                  Mark the record as reviewed before choosing approval.
                </p>
              )}
              {requesting && (
                <form
                  className="application-request-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!requestedDocuments.length) return;
                    applyAction(
                      {
                        type: "request-documents",
                        documentIds: requestedDocuments,
                        note,
                      },
                      "Document request saved locally. Nothing has been sent to the applicant.",
                    );
                    setRequesting(false);
                    setRequestedDocuments([]);
                    setNote("");
                  }}
                >
                  <fieldset>
                    <legend>Which documents do you need?</legend>
                    {record.documents.map((document) => (
                      <label key={document.id}>
                        <input
                          type="checkbox"
                          checked={requestedDocuments.includes(document.id)}
                          onChange={(event) =>
                            setRequestedDocuments((current) =>
                              event.target.checked
                                ? [...current, document.id]
                                : current.filter((id) => id !== document.id),
                            )
                          }
                        />
                        {document.name}
                      </label>
                    ))}
                  </fieldset>
                  <label>
                    Note to include in the record
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Describe what is missing or needs updating"
                    />
                  </label>
                  <div className="application-review-actions">
                    <button
                      type="submit"
                      className="button"
                      disabled={!requestedDocuments.length}
                    >
                      Save document request
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setRequesting(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {confirmApproval && (
                <div className="application-approval-confirm">
                  <strong>Mark this sample application approved?</strong>
                  <p>
                    This records your decision locally. It does not create a
                    tenancy or notify the applicant.
                  </p>
                  <div className="application-review-actions">
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        applyAction(
                          { type: "approve" },
                          "Application marked approved in this workspace.",
                        );
                        setConfirmApproval(false);
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Confirm local approval
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setConfirmApproval(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          {record.status === "Approved" && (
            <div className="application-approved-note">
              <CheckCircle2 size={20} />
              <span>
                Approval is recorded in this sample workspace. No tenancy has
                been created.
              </span>
            </div>
          )}
          {record.status === "Draft" && (
            <p className="application-explanation">
              This draft has not been submitted for owner review.
            </p>
          )}
          <p className="application-action-feedback" role="status">
            {feedback}
          </p>

          <section
            className="application-detail-section"
            aria-labelledby="application-activity-title"
          >
            <h3 id="application-activity-title">Record history</h3>
            <ol className="application-record-history">
              {[...record.activity].reverse().map((event) => (
                <li key={event.id}>
                  <span>{event.label}</span>
                  <time dateTime={event.at}>{displayDate(event.at)}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </section>
    </div>
  );
}

export function Applications({
  role,
  state,
  setState,
  onNewApplication,
}: {
  role: Role;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
  onNewApplication: () => void;
}) {
  const [tab, setTab] = useState<(typeof statuses)[number]>("All");
  const [propertyFilter, setPropertyFilter] = useState("All properties");
  const [completeness, setCompleteness] = useState("Any completeness");
  const [applicationSort, setApplicationSort] = useState("Newest submitted");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const baseApplications = visibleApplicationRecords(state, role);
  const selected = baseApplications.find((record) => record.id === selectedId);
  const visible = baseApplications
    .filter(
      (record) =>
        (tab === "All" || record.status === tab) &&
        (propertyFilter === "All properties" ||
          record.property === propertyFilter) &&
        (completeness === "Any completeness" ||
          applicationCompleteness(record) >= Number(completeness)) &&
        `${record.applicant} ${record.property} ${100 + record.id}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      applicationSort === "Oldest submitted"
        ? a.submittedAt.localeCompare(b.submittedAt)
        : applicationSort === "Most complete"
          ? applicationCompleteness(b) - applicationCompleteness(a)
          : applicationSort === "Action required first"
            ? Number(!["Review", "Documents"].includes(a.status)) -
                Number(!["Review", "Documents"].includes(b.status)) ||
              b.submittedAt.localeCompare(a.submittedAt)
            : b.submittedAt.localeCompare(a.submittedAt),
    );
  const resetFilters = () => {
    setTab("All");
    setPropertyFilter("All properties");
    setCompleteness("Any completeness");
    setApplicationSort("Newest submitted");
    setQuery("");
  };
  const activeFilters =
    Number(tab !== "All") +
    Number(propertyFilter !== "All properties") +
    Number(completeness !== "Any completeness") +
    Number(Boolean(query.trim()));

  return (
    <div className="page-stack applications-workspace">
      <div className="page-actions">
        <div className="segment compact" aria-label="Application status">
          {statuses.map((status) => (
            <button
              type="button"
              key={status}
              className={tab === status ? "active" : ""}
              onClick={() => setTab(status)}
              aria-pressed={tab === status}
            >
              {status}
              <span>
                {
                  baseApplications.filter(
                    (record) => status === "All" || record.status === status,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        {role === "tenant" && (
          <button type="button" className="button" onClick={onNewApplication}>
            <Plus size={17} />
            New rental application
          </button>
        )}
      </div>
      <p className="application-local-note">
        Sample workspace · Application changes stay available while you navigate
        this session.
      </p>
      <div className="filter-toolbar">
        <span className="filter-toolbar-icon">
          <Filter size={16} />
        </span>
        <div className="filter-toolbar-fields application-filters">
          <label className="filter-search">
            <Search size={15} />
            <input
              aria-label="Search applications"
              placeholder="Search applicant or property"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            aria-label="Filter applications by property"
            value={propertyFilter}
            onChange={(event) => setPropertyFilter(event.target.value)}
          >
            <option>All properties</option>
            {[
              ...new Set(baseApplications.map((record) => record.property)),
            ].map((property) => (
              <option key={property}>{property}</option>
            ))}
          </select>
          <select
            aria-label="Filter by profile completeness"
            value={completeness}
            onChange={(event) => setCompleteness(event.target.value)}
          >
            <option>Any completeness</option>
            <option value="80">80%+ complete</option>
            <option value="100">100% complete</option>
          </select>
          <select
            aria-label="Sort applications"
            value={applicationSort}
            onChange={(event) => setApplicationSort(event.target.value)}
          >
            <option>Newest submitted</option>
            <option>Oldest submitted</option>
            <option>Most complete</option>
            <option>Action required first</option>
          </select>
        </div>
        {activeFilters > 0 && (
          <button type="button" className="text-button" onClick={resetFilters}>
            Reset ({activeFilters})
          </button>
        )}
      </div>
      <p className="application-results-count" role="status">
        {visible.length} {visible.length === 1 ? "application" : "applications"}
      </p>
      <section
        className="card application-record-list"
        aria-label="Rental applications"
      >
        <div className="application-record-head" aria-hidden="true">
          <span>{role === "landlord" ? "Applicant" : "Application"}</span>
          <span>Property</span>
          <span>Submitted</span>
          <span>Profile</span>
          <span>Status</span>
          <span />
        </div>
        {visible.map((record) => (
          <button
            type="button"
            className="application-record-row"
            key={record.id}
            onClick={() => setSelectedId(record.id)}
            aria-label={`Open ${role === "tenant" ? `application ${100 + record.id}` : record.applicant} · ${record.property}`}
          >
            <span className="applicant-cell">
              <span className="avatar">{record.avatar}</span>
              <span>
                <strong>
                  {role === "landlord"
                    ? record.applicant
                    : `Application #${100 + record.id}`}
                </strong>
                {record.reviewed && (
                  <small>
                    <Check size={12} />
                    Reviewed
                  </small>
                )}
              </span>
            </span>
            <span className="application-row-property">{record.property}</span>
            <span className="application-row-date">
              {displayDate(record.submittedAt)}
            </span>
            <span className="application-row-completeness">
              <b>{applicationCompleteness(record)}%</b> complete
            </span>
            <span className="application-row-status">
              <ApplicationStatus status={record.status} />
            </span>
            <ChevronRight className="application-row-arrow" size={18} />
          </button>
        ))}
        {!visible.length && (
          <div className="table-empty">
            <Search size={24} />
            <span>No rental applications match these filters.</span>
            {activeFilters > 0 && (
              <button
                type="button"
                className="button button-secondary"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </section>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          Kasa organizes rental applications and documents. Completeness only
          counts supplied profile fields; the property owner makes every review
          and approval decision.
        </span>
      </div>
      {selected && (
        <ApplicationDetail
          key={selected.id}
          record={selected}
          role={role}
          onClose={() => setSelectedId(null)}
          onAction={(action) =>
            setState((current) =>
              updateApplication(current, selected.id, role, action),
            )
          }
        />
      )}
    </div>
  );
}
