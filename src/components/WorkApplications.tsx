import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { BriefcaseBusiness, ChevronRight } from "lucide-react";
import type { Role } from "../types";
import {
  discardWorkApplicationDraft,
  updateWorkApplicantView,
  visibleWorkApplications,
  withdrawWorkApplication,
  workApplicantView,
  workApplicationDrafts,
  type WorkState,
} from "./workState";
import { WorkApplicationDialog } from "./WorkApplicationDialog";
import { WorkOpportunityContent } from "./WorkOpportunityContent";
import { useWorkCopy } from "./workCopy";
import "./workFlow.css";

interface WorkApplicationsProps {
  role: Role;
  state: WorkState;
  setState: Dispatch<SetStateAction<WorkState>>;
  onBrowseOpportunities?: () => void;
  onOpenOpportunity?: (opportunityId: string) => void;
}

function CandidateApplications({
  role,
  state,
  setState,
  onBrowseOpportunities,
  onOpenOpportunity,
}: WorkApplicationsProps) {
  const { copy, date, availability, applicationStatus, history, issueText } =
    useWorkCopy();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const draftHeading = useRef<HTMLHeadingElement>(null);
  const [feedback, setFeedback] = useState("");
  const [issue, setIssue] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const view = workApplicantView(state, role);
  const records = visibleWorkApplications(state, role);
  const drafts = workApplicationDrafts(state, role);
  const filtered = records.filter(
    (record) =>
      view.filter === "All" ||
      (view.filter === "Reviewed"
        ? record.status === "Submitted" && Boolean(record.reviewedAt)
        : record.status === view.filter),
  );
  const selected =
    filtered.find((record) => record.id === view.selectedApplicationId) ??
    filtered[0];
  const liveOpportunity = state.opportunities.find(
    (opportunity) => opportunity.id === selected?.opportunityId,
  );
  const draftOpportunity = state.opportunities.find(
    (opportunity) => opportunity.id === draftId,
  );
  const filters = ["All", "Submitted", "Reviewed", "Withdrawn"] as const;
  const filterLabel = (filter: (typeof filters)[number]) =>
    ({
      All: copy("All", "Todas"),
      Submitted: copy("Active", "Ativas"),
      Reviewed: copy("Review recorded", "Com análise registada"),
      Withdrawn: copy("Withdrawn", "Retiradas"),
    })[filter];
  function select(applicationId: string) {
    setState((current) =>
      updateWorkApplicantView(current, role, {
        filter: "All",
        selectedApplicationId: applicationId,
      }),
    );
    setIssue("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  if (role !== "tenant")
    return (
      <section className="panel work-ui-empty">
        <h3>{copy("Candidate applications", "Candidaturas do candidato")}</h3>
        <p>
          {copy(
            "Private candidate drafts and applications are available in the tenant workspace.",
            "Os rascunhos e as candidaturas privadas estão disponíveis na área do inquilino.",
          )}
        </p>
      </section>
    );
  return (
    <div className="work-ui">
      <div className="work-ui-header">
        <div>
          <h2>{copy("My applications", "As minhas candidaturas")}</h2>
          <p>
            {copy(
              "Your submitted details and their local review history remain available here.",
              "Os dados submetidos e o respetivo histórico de análise local mantêm-se disponíveis aqui.",
            )}
          </p>
        </div>
        {onBrowseOpportunities && (
          <button
            className="button button-secondary"
            type="button"
            onClick={onBrowseOpportunities}
          >
            {copy("Browse opportunities", "Explorar oportunidades")}
          </button>
        )}
      </div>
      <div className="work-ui-feedback" role="status">
        {feedback}
      </div>
      {issue && (
        <p className="work-ui-error" role="alert">
          {issue}
        </p>
      )}
      <section
        className="panel work-ui-drafts"
        aria-labelledby={`${id}-drafts`}
      >
        <h3 id={`${id}-drafts`} ref={draftHeading} tabIndex={-1}>
          {copy("Unsent drafts", "Rascunhos por enviar")} ({drafts.length})
        </h3>
        {drafts.length ? (
          <ul>
            {drafts.map(({ opportunityId, draft }) => {
              const opportunity = state.opportunities.find(
                (record) => record.id === opportunityId,
              );
              if (!opportunity) return null;
              return (
                <li key={opportunityId}>
                  <div>
                    <strong>{opportunity.title}</strong>
                    <small>
                      {opportunity.business} ·{" "}
                      {draft.availability
                        ? availability(draft.availability)
                        : copy(
                            "Availability not chosen",
                            "Disponibilidade por escolher",
                          )}
                      {draft.availability === "Choose a date" &&
                      draft.customDate
                        ? ` · ${date(draft.customDate)}`
                        : ""}
                    </small>
                    {opportunity.status === "Closed" && (
                      <small>
                        {copy(
                          "Opportunity closed · draft retained",
                          "Oportunidade encerrada · rascunho mantido",
                        )}
                      </small>
                    )}
                  </div>
                  <div className="work-ui-buttons">
                    <button
                      className="button button-secondary"
                      type="button"
                      aria-label={`${copy("Open draft", "Abrir rascunho")} · ${opportunity.title}`}
                      onClick={() => setDraftId(opportunityId)}
                    >
                      {opportunity.status === "Open"
                        ? copy("Continue", "Continuar")
                        : copy("Inspect draft", "Consultar rascunho")}
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      aria-label={`${copy("Discard draft", "Eliminar rascunho")} · ${opportunity.title}`}
                      onClick={() => {
                        setState((current) =>
                          discardWorkApplicationDraft(
                            current,
                            role,
                            opportunityId,
                          ),
                        );
                        setFeedback(
                          copy(
                            "Unsent draft discarded.",
                            "Rascunho por enviar eliminado.",
                          ),
                        );
                        requestAnimationFrame(() =>
                          draftHeading.current?.focus(),
                        );
                      }}
                    >
                      {copy("Discard", "Eliminar")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="work-ui-scope">
            {copy(
              "Close an application form to keep its draft here. Drafts are not visible to businesses.",
              "Feche um formulário de candidatura para guardar aqui o rascunho. Os rascunhos não são visíveis às empresas.",
            )}
          </p>
        )}
      </section>
      <div
        className="work-ui-tabs"
        role="group"
        aria-label={copy(
          "Filter work applications",
          "Filtrar candidaturas de trabalho",
        )}
      >
        {filters.map((filter) => (
          <button
            type="button"
            key={filter}
            className={view.filter === filter ? "active" : ""}
            aria-pressed={view.filter === filter}
            onClick={() => {
              setState((current) =>
                updateWorkApplicantView(current, role, { filter }),
              );
              setIssue("");
              setFeedback("");
            }}
          >
            {filterLabel(filter)} (
            {
              records.filter(
                (record) =>
                  filter === "All" ||
                  (filter === "Reviewed"
                    ? record.status === "Submitted" &&
                      Boolean(record.reviewedAt)
                    : record.status === filter),
              ).length
            }
            )
          </button>
        ))}
      </div>
      <p className="work-ui-results" role="status">
        {filtered.length}{" "}
        {filtered.length === 1
          ? copy("application shown", "candidatura apresentada")
          : copy("applications shown", "candidaturas apresentadas")}
      </p>
      {!filtered.length ? (
        <section className="panel work-ui-empty">
          <BriefcaseBusiness size={26} aria-hidden="true" />
          <h3>
            {records.length
              ? copy(
                  "No applications in this filter",
                  "Sem candidaturas neste filtro",
                )
              : copy(
                  "No submitted applications yet",
                  "Ainda não há candidaturas submetidas",
                )}
          </h3>
          <p>
            {copy(
              "Open an opportunity to inspect its details and start a local application.",
              "Abra uma oportunidade para consultar os detalhes e iniciar uma candidatura local.",
            )}
          </p>
          {records.length > 0 && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() =>
                setState((current) =>
                  updateWorkApplicantView(current, role, { filter: "All" }),
                )
              }
            >
              {copy("Show all applications", "Ver todas as candidaturas")}
            </button>
          )}
        </section>
      ) : (
        <div className="work-ui-layout">
          <section
            className="panel work-ui-list"
            aria-label={copy(
              "Your work applications",
              "As suas candidaturas de trabalho",
            )}
          >
            <ul>
              {filtered.map((application) => (
                <li key={application.id}>
                  <button
                    className={
                      selected?.id === application.id ? "selected" : ""
                    }
                    type="button"
                    aria-pressed={selected?.id === application.id}
                    onClick={() => {
                      setFeedback("");
                      select(application.id);
                    }}
                  >
                    <div>
                      <strong>{application.opportunity.title}</strong>
                      <span>{application.opportunity.business}</span>
                      <small>{date(application.submittedAt)}</small>
                      <span
                        className={`pill pill-${application.status === "Withdrawn" ? "neutral" : application.reviewedAt ? "mint" : "amber"}`}
                      >
                        {applicationStatus(
                          application.status,
                          application.reviewedAt,
                        )}
                      </span>
                    </div>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {selected && (
            <section
              className="panel work-ui-detail"
              aria-labelledby={`${id}-detail`}
            >
              <header>
                <span className="eyebrow">{selected.id}</span>
                <h2 id={`${id}-detail`} ref={heading} tabIndex={-1}>
                  {selected.opportunity.title}
                </h2>
                <span
                  className={`pill work-ui-status pill-${selected.status === "Withdrawn" ? "neutral" : selected.reviewedAt ? "mint" : "amber"}`}
                >
                  {applicationStatus(selected.status, selected.reviewedAt)}
                </span>
                <p>{selected.opportunity.business}</p>
              </header>
              {liveOpportunity?.status === "Closed" && (
                <p className="work-ui-scope">
                  {copy(
                    "The opportunity is now closed. Your application and history remain available.",
                    "A oportunidade está agora encerrada. A candidatura e o histórico mantêm-se disponíveis.",
                  )}
                </p>
              )}
              <dl className="work-ui-facts">
                <div>
                  <dt>{copy("Candidate", "Candidato")}</dt>
                  <dd>{selected.applicantName}</dd>
                </div>
                <div>
                  <dt>{copy("Submitted locally", "Submetida localmente")}</dt>
                  <dd>
                    <time dateTime={selected.submittedAt}>
                      {date(selected.submittedAt, true)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>
                    {copy("Availability selected", "Disponibilidade escolhida")}
                  </dt>
                  <dd>{availability(selected.submission.availability)}</dd>
                </div>
                <div>
                  <dt>
                    {copy(
                      "Availability date recorded",
                      "Data de disponibilidade registada",
                    )}
                  </dt>
                  <dd>
                    <time dateTime={selected.submission.availableFrom}>
                      {date(selected.submission.availableFrom)}
                    </time>
                  </dd>
                </div>
              </dl>
              <section>
                <h3>
                  {copy("Submitted introduction", "Apresentação submetida")}
                </h3>
                <p className="work-ui-user-text">
                  {selected.submission.introduction}
                </p>
              </section>
              <p className="work-ui-scope">
                {copy(
                  "These are the details saved at submission. A recorded review is not a hiring decision.",
                  "Estes são os dados guardados na submissão. Uma análise registada não é uma decisão de contratação.",
                )}
              </p>
              <div className="work-ui-buttons">
                {selected.status === "Submitted" && (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      const updated = withdrawWorkApplication(
                        state,
                        role,
                        selected.id,
                      );
                      if (updated === state) {
                        setIssue(issueText("unavailable"));
                        return;
                      }
                      setState(
                        updateWorkApplicantView(updated, role, {
                          filter: "All",
                          selectedApplicationId: selected.id,
                        }),
                      );
                      setIssue("");
                      setFeedback(
                        copy(
                          "Application withdrawn locally. Its submitted details and history are retained.",
                          "Candidatura retirada localmente. Os dados submetidos e o histórico mantêm-se.",
                        ),
                      );
                      requestAnimationFrame(() => heading.current?.focus());
                    }}
                  >
                    {copy("Withdraw application", "Retirar candidatura")}
                  </button>
                )}
                {onOpenOpportunity && liveOpportunity && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => onOpenOpportunity(selected.opportunityId)}
                  >
                    {copy("Open opportunity", "Abrir oportunidade")}
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
              {selected.status === "Withdrawn" &&
                liveOpportunity?.status === "Open" && (
                  <p className="work-ui-scope">
                    {copy(
                      "You can open the opportunity and start a new application. This withdrawn record will remain unchanged.",
                      "Pode abrir a oportunidade e iniciar uma nova candidatura. Este registo retirado mantém-se inalterado.",
                    )}
                  </p>
                )}
              <details className="work-ui-snapshot">
                <summary>
                  {copy(
                    "Opportunity details at submission",
                    "Detalhes da oportunidade na submissão",
                  )}
                </summary>
                <div>
                  <WorkOpportunityContent opportunity={selected.opportunity} />
                </div>
              </details>
              <section className="work-ui-history">
                <h3>
                  {copy("Application history", "Histórico da candidatura")}
                </h3>
                <ol>
                  {[...selected.history].reverse().map((event) => (
                    <li key={event.id}>
                      <strong>{history(event.action)}</strong>
                      <small>
                        {event.actor === "tenant"
                          ? copy("Candidate", "Candidato")
                          : copy("Business", "Empresa")}{" "}
                        ·{" "}
                        <time dateTime={event.at}>{date(event.at, true)}</time>
                      </small>
                    </li>
                  ))}
                </ol>
              </section>
            </section>
          )}
        </div>
      )}
      {draftOpportunity && (
        <WorkApplicationDialog
          key={`${role}-${draftOpportunity.id}`}
          role={role}
          state={state}
          setState={setState}
          opportunity={draftOpportunity}
          onClose={() => setDraftId(null)}
          onSaved={(applicationId) => {
            setDraftId(null);
            setFeedback(
              copy(
                "Application submitted in this tab.",
                "Candidatura submetida neste separador.",
              ),
            );
            select(applicationId);
          }}
        />
      )}
    </div>
  );
}

export function WorkApplications(props: WorkApplicationsProps) {
  return <CandidateApplications key={props.role} {...props} />;
}
