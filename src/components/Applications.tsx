import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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
  applicationEvidenceSummary,
  applicationPropertyOptions,
  applicationView,
  canReviewApplication,
  resetApplicationView,
  updateApplication,
  updateApplicationView,
  visibleApplicationRecords,
  type ApplicationAction,
  type ApplicationRecord,
  type ApplicationState,
  type ApplicationView,
} from "./applicationState";
import { useDialogFocus } from "./useDialogFocus";
import { ApplicationEvidence } from "./ApplicationEvidence";
import { useApplicationCopy } from "./applicationEvidenceCopy";
import "./applications.css";

const statuses = ["All", "Review", "Documents", "Approved", "Draft"] as const;
function applicationDisplayStatus(record: ApplicationRecord) {
  return record.status === "Documents" &&
    record.evidenceRequests?.length &&
    !applicationEvidenceSummary(record).requestOpen
    ? "Review"
    : record.status;
}
function ApplicationStatus({ record }: { record: ApplicationRecord }) {
  const { text } = useApplicationCopy();
  const status = applicationDisplayStatus(record);
  const label =
    status === "Review"
      ? text("Under review", "Em análise")
      : status === "Documents"
        ? text("Documents requested", "Documentos pedidos")
        : status === "Approved"
          ? text("Approved", "Aprovada")
          : text("Draft", "Rascunho");
  return (
    <span
      className={`pill pill-${status === "Approved" ? "mint" : status === "Documents" ? "amber" : status === "Draft" ? "neutral" : "blue"}`}
    >
      {label}
    </span>
  );
}

function ApplicationDetail({
  record,
  role,
  onAction,
  onClose,
  state,
  setState,
}: {
  record: ApplicationRecord;
  role: Role;
  onAction: (action: ApplicationAction) => boolean;
  onClose: () => void;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
}) {
  const { text, date: displayDate, documentName } = useApplicationCopy();
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const [confirmApproval, setConfirmApproval] = useState(false);
  const [feedback, setFeedback] = useState<"reviewed" | "approved" | null>(
    null,
  );
  const ownerCanAct = canReviewApplication(record, role);
  const completeness = applicationCompleteness(record);
  const evidenceSummary = applicationEvidenceSummary(record);
  const applyAction = (
    action: ApplicationAction,
    message: "reviewed" | "approved",
  ) => {
    if (!onAction(action)) return;
    setFeedback(message);
    requestAnimationFrame(() => closeButton.current?.focus());
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
            <span className="eyebrow">
              {text("APPLICATION", "CANDIDATURA")} #{100 + record.id}
            </span>
            <h2 id="application-detail-title">{record.applicant}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            ref={closeButton}
            aria-label={text("Close application", "Fechar candidatura")}
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
                  ? text("Recorded locally", "Registada localmente")
                  : record.status === "Draft"
                    ? text("Draft created", "Rascunho criado")
                    : text("Submitted", "Submetida")}{" "}
                {displayDate(record.submittedAt)}
              </p>
            </div>
            <ApplicationStatus record={record} />
          </div>
          <p className="application-local-note">
            {record.submission
              ? text("Local application", "Candidatura local")
              : text("Sample record", "Registo de exemplo")}{" "}
            ·{" "}
            {text(
              "Changes stay in this tab until reload. No documents or notifications are sent.",
              "As alterações ficam neste separador até recarregar. Nenhum documento ou notificação é enviado.",
            )}
          </p>

          {record.submission && (
            <section
              className="application-detail-section"
              aria-labelledby="application-submission-title"
            >
              <h3 id="application-submission-title">
                {text("Application details", "Detalhes da candidatura")}
              </h3>
              <dl className="application-submission-details">
                <div>
                  <dt>
                    {text(
                      "Preferred move-in date",
                      "Data de entrada preferida",
                    )}
                  </dt>
                  <dd>
                    {displayDate(`${record.submission.moveInDate}T12:00:00`)}
                  </dd>
                </div>
                <div>
                  <dt>{text("Number of people", "Número de pessoas")}</dt>
                  <dd>{record.submission.householdSize}</dd>
                </div>
                <div>
                  <dt>{text("Introduction", "Apresentação")}</dt>
                  <dd>
                    {record.submission.introduction ||
                      text("Not added (optional)", "Não adicionada (opcional)")}
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
              <h3 id="application-profile-title">
                {text("Profile completeness", "Preenchimento do perfil")}
              </h3>
              <strong>{completeness}%</strong>
            </div>
            <progress
              max={100}
              value={completeness}
              aria-label={text(
                "Profile completeness",
                "Preenchimento do perfil",
              )}
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
                  <small>
                    {field.present
                      ? text("Present", "Preenchido")
                      : text("Not added", "Não preenchido")}
                  </small>
                </li>
              ))}
            </ul>
            <p className="application-explanation">
              {text(
                "Completeness counts supplied fields. It does not rank applicants or determine approval.",
                "O preenchimento conta os campos fornecidos. Não classifica candidatos nem determina a aprovação.",
              )}
            </p>
          </section>

          <section
            className="application-detail-section"
            aria-labelledby="application-documents-title"
          >
            <div className="application-section-heading">
              <h3 id="application-documents-title">
                {text("Document summaries", "Resumos dos documentos")}
              </h3>
              <span>
                {
                  record.documents.filter(
                    (document) => document.status === "Supplied",
                  ).length
                }{" "}
                / {record.documents.length}{" "}
                {text("recorded as supplied", "registados como fornecidos")}
              </span>
            </div>
            <div className="application-document-list">
              {record.documents.map((document) => (
                <details key={document.id}>
                  <summary>
                    <FileText size={18} aria-hidden="true" />
                    <strong>{documentName(document.id, document.name)}</strong>
                    <span
                      className={`application-document-status ${document.status.toLowerCase()}`}
                    >
                      {document.status === "Supplied"
                        ? text("Supplied", "Fornecido")
                        : document.status === "Requested"
                          ? evidenceSummary.latestRequest &&
                            !evidenceSummary.requestOpen
                            ? text(
                                "Previously requested",
                                "Pedido anteriormente",
                              )
                            : text("Requested", "Pedido")
                          : text("Missing", "Em falta")}
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </summary>
                  <p>{document.summary}</p>
                </details>
              ))}
            </div>
          </section>

          <ApplicationEvidence
            key={`${role}-${record.id}`}
            role={role}
            record={record}
            state={state}
            setState={setState}
          />

          {ownerCanAct && (
            <section
              className="application-detail-section application-owner-actions"
              aria-labelledby="application-review-title"
            >
              <h3 id="application-review-title">
                {text("Owner review", "Análise do proprietário")}
              </h3>
              <p className="application-explanation">
                {text(
                  "Review the record and choose the next step yourself.",
                  "Analise o registo e escolha o próximo passo.",
                )}
              </p>
              <div className="application-review-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={record.reviewed}
                  onClick={() =>
                    applyAction({ type: "mark-reviewed" }, "reviewed")
                  }
                >
                  <ClipboardCheck size={16} />
                  {record.reviewed
                    ? text("Reviewed", "Analisada")
                    : text("Mark as reviewed", "Marcar como analisada")}
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
                  }}
                >
                  {text("Approve application", "Aprovar candidatura")}
                </button>
              </div>
              {!record.reviewed && (
                <p
                  id="application-review-hint"
                  className="application-explanation"
                >
                  {text(
                    "Mark the record as reviewed before choosing approval.",
                    "Marque o registo como analisado antes de escolher a aprovação.",
                  )}
                </p>
              )}
              {confirmApproval && (
                <div className="application-approval-confirm">
                  <strong>
                    {text(
                      "Mark this application approved locally?",
                      "Marcar esta candidatura como aprovada localmente?",
                    )}
                  </strong>
                  <p>
                    {text(
                      "This records your decision locally. It does not create a tenancy or notify the applicant.",
                      "A sua decisão é registada localmente. Não é criado um arrendamento nem enviada uma notificação ao candidato.",
                    )}
                  </p>
                  <div className="application-review-actions">
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        applyAction({ type: "approve" }, "approved");
                        setConfirmApproval(false);
                      }}
                    >
                      <CheckCircle2 size={16} />
                      {text(
                        "Confirm local approval",
                        "Confirmar aprovação local",
                      )}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setConfirmApproval(false)}
                    >
                      {text("Cancel", "Cancelar")}
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
                {text(
                  "Approval is recorded in this workspace. No tenancy has been created.",
                  "A aprovação está registada nesta área de trabalho. Nenhum arrendamento foi criado.",
                )}
              </span>
            </div>
          )}
          {record.status === "Draft" && (
            <p className="application-explanation">
              {text(
                "This draft has not been submitted for owner review.",
                "Este rascunho ainda não foi submetido à análise do proprietário.",
              )}
            </p>
          )}
          <p className="application-action-feedback" role="status">
            {feedback === "reviewed"
              ? text(
                  "Marked as reviewed in this workspace.",
                  "Análise registada nesta área de trabalho.",
                )
              : feedback === "approved"
                ? text(
                    "Application marked approved in this workspace.",
                    "Candidatura marcada como aprovada nesta área de trabalho.",
                  )
                : null}
          </p>

          <section
            className="application-detail-section"
            aria-labelledby="application-activity-title"
          >
            <h3 id="application-activity-title">
              {text("Record history", "Histórico do registo")}
            </h3>
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

export interface ApplicationOpenRequest {
  role: Role;
  applicationId: number;
  revision: number;
}

export function Applications({
  role,
  state,
  setState,
  onNewApplication,
  openRequest,
  onOpenRequestHandled,
}: {
  role: Role;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
  onNewApplication: () => void;
  openRequest?: ApplicationOpenRequest | null;
  onOpenRequestHandled?: (revision: number) => void;
}) {
  const { text, date: displayDate, phase } = useApplicationCopy();
  const {
    status: tab,
    property: propertyFilter,
    completeness,
    sort: applicationSort,
    query,
  } = applicationView(state, role);
  const searchInput = useRef<HTMLInputElement>(null);
  const applicationRows = useRef<HTMLElement>(null);
  const baseApplications = visibleApplicationRecords(state, role);
  const propertyOptions = applicationPropertyOptions(state, role);
  const selectedProperty = propertyOptions.find(
    (property) => String(property.id) === propertyFilter,
  );
  const visible = baseApplications
    .filter(
      (record) =>
        (tab === "All" || applicationDisplayStatus(record) === tab) &&
        (propertyFilter === "All properties" ||
          (record.propertyId !== undefined
            ? String(record.propertyId) === propertyFilter
            : selectedProperty?.title === record.property)) &&
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
  const [selectedId, setSelectedId] = useState<number | null>(() =>
    openRequest?.role === role &&
    visible.some((record) => record.id === openRequest.applicationId)
      ? openRequest.applicationId
      : null,
  );
  const selected = baseApplications.find((record) => record.id === selectedId);
  const handledRevision = useRef<number | null>(null);
  useEffect(() => {
    if (
      !openRequest ||
      openRequest.role !== role ||
      handledRevision.current === openRequest.revision
    )
      return;
    handledRevision.current = openRequest.revision;
    onOpenRequestHandled?.(openRequest.revision);
  }, [onOpenRequestHandled, openRequest, role]);
  const updateView = (patch: Partial<ApplicationView>) =>
    setState((current) => updateApplicationView(current, role, patch));
  const closeDetails = () => {
    setSelectedId(null);
    requestAnimationFrame(() => {
      const row = applicationRows.current?.querySelector<HTMLButtonElement>(
        `[data-application-id="${selectedId}"]`,
      );
      (row ?? searchInput.current)?.focus();
    });
  };
  const resetFilters = () => {
    setState((current) => resetApplicationView(current, role));
    requestAnimationFrame(() => searchInput.current?.focus());
  };
  const changedControls =
    Number(tab !== "All") +
    Number(propertyFilter !== "All properties") +
    Number(completeness !== "Any completeness") +
    Number(Boolean(query)) +
    Number(applicationSort !== "Newest submitted");

  return (
    <div className="page-stack applications-workspace">
      <div className="page-actions">
        <div
          className="segment compact"
          aria-label={text("Application status", "Estado da candidatura")}
        >
          {statuses.map((status) => (
            <button
              type="button"
              key={status}
              className={tab === status ? "active" : ""}
              onClick={() => updateView({ status })}
              aria-pressed={tab === status}
            >
              {status === "All"
                ? text("All", "Todas")
                : status === "Review"
                  ? text("Review", "Em análise")
                  : status === "Documents"
                    ? text("Documents", "Documentos")
                    : status === "Approved"
                      ? text("Approved", "Aprovadas")
                      : text("Draft", "Rascunhos")}
              <span>
                {
                  baseApplications.filter(
                    (record) =>
                      status === "All" ||
                      applicationDisplayStatus(record) === status,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        {role === "tenant" && (
          <button type="button" className="button" onClick={onNewApplication}>
            <Plus size={17} />
            {text("New rental application", "Nova candidatura a arrendamento")}
          </button>
        )}
      </div>
      <p className="application-local-note">
        {text(
          "Application changes stay available in this tab while you navigate. Reloading clears local responses and files.",
          "As alterações às candidaturas mantêm-se neste separador ao mudar de página. Recarregar elimina as respostas e os ficheiros locais.",
        )}
      </p>
      <div className="filter-toolbar">
        <span className="filter-toolbar-icon">
          <Filter size={16} />
        </span>
        <div className="filter-toolbar-fields application-filters">
          <label className="filter-search">
            <Search size={15} />
            <input
              ref={searchInput}
              aria-label={text("Search applications", "Pesquisar candidaturas")}
              placeholder={text(
                "Search applicant or property",
                "Pesquisar candidato ou imóvel",
              )}
              value={query}
              maxLength={200}
              onChange={(event) =>
                updateView({ query: event.currentTarget.value })
              }
            />
          </label>
          <select
            aria-label={text(
              "Filter applications by property",
              "Filtrar candidaturas por imóvel",
            )}
            value={propertyFilter}
            onChange={(event) =>
              updateView({ property: event.currentTarget.value })
            }
          >
            <option value="All properties">
              {text("All properties", "Todos os imóveis")}
            </option>
            {propertyOptions.map((property) => (
              <option key={property.id} value={property.id}>
                {property.title}
              </option>
            ))}
          </select>
          <select
            aria-label={text(
              "Filter by profile completeness",
              "Filtrar por preenchimento do perfil",
            )}
            value={completeness}
            onChange={(event) =>
              updateView({
                completeness: event.currentTarget
                  .value as ApplicationView["completeness"],
              })
            }
          >
            <option value="Any completeness">
              {text("Any completeness", "Qualquer preenchimento")}
            </option>
            <option value="80">80%+ {text("complete", "preenchido")}</option>
            <option value="100">100% {text("complete", "preenchido")}</option>
          </select>
          <select
            aria-label={text("Sort applications", "Ordenar candidaturas")}
            value={applicationSort}
            onChange={(event) =>
              updateView({
                sort: event.currentTarget.value as ApplicationView["sort"],
              })
            }
          >
            <option value="Newest submitted">
              {text("Newest submitted", "Mais recentes")}
            </option>
            <option value="Oldest submitted">
              {text("Oldest submitted", "Mais antigas")}
            </option>
            <option value="Most complete">
              {text("Most complete", "Mais preenchidas")}
            </option>
            <option value="Action required first">
              {text("Action required first", "Com ações pendentes primeiro")}
            </option>
          </select>
        </div>
        {changedControls > 0 && (
          <button
            type="button"
            className="text-button"
            aria-label={text(
              "Reset search, filters and sort",
              "Repor pesquisa, filtros e ordenação",
            )}
            onClick={resetFilters}
          >
            {text("Reset", "Limpar")} ({changedControls})
          </button>
        )}
      </div>
      <p className="application-results-count" role="status">
        {visible.length}{" "}
        {visible.length === 1
          ? text("application", "candidatura")
          : text("applications", "candidaturas")}
      </p>
      <section
        ref={applicationRows}
        className="card application-record-list"
        aria-label={text("Rental applications", "Candidaturas a arrendamento")}
      >
        <div className="application-record-head" aria-hidden="true">
          <span>
            {role === "landlord"
              ? text("Applicant", "Candidato")
              : text("Application", "Candidatura")}
          </span>
          <span>{text("Property", "Imóvel")}</span>
          <span>{text("Submitted", "Registada")}</span>
          <span>{text("Profile", "Perfil")}</span>
          <span>{text("Status", "Estado")}</span>
          <span />
        </div>
        {visible.map((record) => (
          <button
            type="button"
            className="application-record-row"
            key={record.id}
            data-application-id={record.id}
            onClick={() => setSelectedId(record.id)}
            aria-label={`${text("Open", "Abrir")} ${role === "tenant" ? `${text("application", "candidatura")} ${100 + record.id}` : record.applicant} · ${record.property}`}
          >
            <span className="applicant-cell">
              <span className="avatar">{record.avatar}</span>
              <span>
                <strong>
                  {role === "landlord"
                    ? record.applicant
                    : `${text("Application", "Candidatura")} #${100 + record.id}`}
                </strong>
                {record.reviewed && (
                  <small>
                    <Check size={12} />
                    {text("Reviewed", "Analisada")}
                  </small>
                )}
              </span>
            </span>
            <span className="application-row-property">{record.property}</span>
            <span className="application-row-date">
              {displayDate(record.submittedAt)}
            </span>
            <span className="application-row-completeness">
              <b>{applicationCompleteness(record)}%</b>{" "}
              {text("complete", "preenchido")}
            </span>
            <span className="application-row-status">
              <ApplicationStatus record={record} />
              {applicationEvidenceSummary(record).phase !== "none" && (
                <small>{phase(applicationEvidenceSummary(record).phase)}</small>
              )}
            </span>
            <ChevronRight className="application-row-arrow" size={18} />
          </button>
        ))}
        {!visible.length && (
          <div className="table-empty">
            <Search size={24} />
            <span>
              {text(
                "No rental applications match these filters.",
                "Nenhuma candidatura corresponde a estes filtros.",
              )}
            </span>
            {changedControls > 0 && (
              <button
                type="button"
                className="button button-secondary"
                onClick={resetFilters}
              >
                {text(
                  "Reset search, filters and sort",
                  "Repor pesquisa, filtros e ordenação",
                )}
              </button>
            )}
          </div>
        )}
      </section>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          {text(
            "Kasa organizes rental applications and documents. Completeness only counts supplied profile fields; the property owner makes every review and approval decision.",
            "A Kasa organiza candidaturas e documentos. O preenchimento conta apenas campos do perfil; cada decisão de análise e aprovação cabe ao proprietário.",
          )}
        </span>
      </div>
      {selected && (
        <ApplicationDetail
          key={`${role}-${selected.id}`}
          record={selected}
          state={state}
          setState={setState}
          role={role}
          onClose={closeDetails}
          onAction={(action) => {
            const next = updateApplication(state, selected.id, role, action);
            if (next === state) return false;
            setState(next);
            return true;
          }}
        />
      )}
    </div>
  );
}
