import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { BriefcaseBusiness, ChevronRight } from "lucide-react";
import type { Role, WorkArrangement } from "../types";
import { matchesSearch } from "../search";
import {
  activeWorkApplication,
  updateWorkApplicantView,
  updateWorkMarketplaceView,
  visibleWorkApplications,
  workApplicationDrafts,
  workArrangements,
  workMarketplaceView,
  type WorkState,
} from "./workState";
import { WorkApplicationDialog } from "./WorkApplicationDialog";
import { WorkApplications } from "./WorkApplications";
import { WorkOpportunityContent } from "./WorkOpportunityContent";
import { useWorkCopy } from "./workCopy";
import "./workFlow.css";

interface WorkMarketplaceProps {
  role: Role;
  state: WorkState;
  setState: Dispatch<SetStateAction<WorkState>>;
  query?: string;
  onQueryChange?: (query: string) => void;
  onOpenHiring?: () => void;
}

function WorkDiscovery({
  role,
  state,
  setState,
  query,
  onQueryChange,
  onOpenHiring,
}: WorkMarketplaceProps) {
  const { copy, date, arrangement, scope } = useWorkCopy();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const entryQueryPending = useRef(query !== undefined);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const view = workMarketplaceView(state, role);
  const applications =
    role === "tenant" ? visibleWorkApplications(state, role) : [];
  const drafts = workApplicationDrafts(state, role);
  const visible = state.opportunities.filter(
    (opportunity) =>
      (view.type === "All" || opportunity.type === view.type) &&
      (view.status === "All" || opportunity.status === "Open") &&
      matchesSearch(
        view.query,
        opportunity.title,
        opportunity.business,
        opportunity.location,
        opportunity.description,
        opportunity.type,
        arrangement(opportunity.type),
        ...opportunity.skills,
      ),
  );
  const selected =
    visible.find(
      (opportunity) => opportunity.id === view.selectedOpportunityId,
    ) ?? visible[0];
  const applying = state.opportunities.find(
    (opportunity) => opportunity.id === applyingId,
  );
  const activeApplication = selected
    ? activeWorkApplication(state, role, selected.id)
    : undefined;
  const hasDraft = drafts.some((draft) => draft.opportunityId === selected?.id);
  const showingApplications =
    role === "tenant" && view.section === "applications";
  useEffect(() => {
    const suppliedEntry = entryQueryPending.current;
    entryQueryPending.current = false;
    if (query !== undefined && (suppliedEntry || query !== view.query)) {
      setState((current) =>
        updateWorkMarketplaceView(current, role, {
          query,
          section: "opportunities",
        }),
      );
    } else if (query === undefined) {
      onQueryChange?.(view.query);
    }
  }, [query, view.query, role, setState, onQueryChange]);
  function changeQuery(next: string) {
    setState((current) =>
      updateWorkMarketplaceView(current, role, { query: next }),
    );
    onQueryChange?.(next);
  }
  function section(next: "opportunities" | "applications") {
    setState((current) =>
      updateWorkMarketplaceView(current, role, { section: next }),
    );
    setFeedback("");
  }
  function openApplication(applicationId: string) {
    setState((current) =>
      updateWorkMarketplaceView(
        updateWorkApplicantView(current, role, {
          filter: "All",
          selectedApplicationId: applicationId,
        }),
        role,
        { section: "applications" },
      ),
    );
    requestAnimationFrame(() => heading.current?.focus());
  }
  function openOpportunity(opportunityId: string) {
    setState((current) =>
      updateWorkMarketplaceView(current, role, {
        section: "opportunities",
        selectedOpportunityId: opportunityId,
        query: "",
        type: "All",
        status: "All",
      }),
    );
    onQueryChange?.("");
    setFeedback("");
    requestAnimationFrame(() => detailHeading.current?.focus());
  }
  return (
    <section className="work-ui" aria-labelledby={`${id}-title`}>
      <header className="work-ui-header">
        <div>
          <span className="eyebrow">
            {copy("DIRECT OPPORTUNITIES", "OPORTUNIDADES DIRETAS")}
          </span>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>
            Kasa Work
          </h2>
          <p>
            {copy(
              "Read the work, schedule and requirements before choosing what to share with a business.",
              "Leia o trabalho, o horário e os requisitos antes de escolher o que partilhar com uma empresa.",
            )}
          </p>
        </div>
        {role === "provider" && onOpenHiring && (
          <button
            className="button button-secondary"
            type="button"
            onClick={onOpenHiring}
          >
            {copy("Hiring workspace", "Área de contratação")}
          </button>
        )}
      </header>
      <p className="work-ui-scope">{scope}</p>
      {role !== "tenant" && (
        <p className="work-ui-scope">
          {copy(
            "You can browse opportunities in this workspace. Candidate applications are available in the tenant workspace, chosen from the workspace selector.",
            "Pode explorar oportunidades nesta área. As candidaturas estão disponíveis na área do inquilino, escolhida no seletor de área de trabalho.",
          )}
        </p>
      )}
      {role === "tenant" && (
        <div
          className="work-ui-tabs"
          role="group"
          aria-label={copy("Work area", "Área de trabalho")}
        >
          <button
            type="button"
            className={!showingApplications ? "active" : ""}
            aria-pressed={!showingApplications}
            onClick={() => section("opportunities")}
          >
            {copy("Opportunities", "Oportunidades")}
          </button>
          <button
            type="button"
            className={showingApplications ? "active" : ""}
            aria-pressed={showingApplications}
            onClick={() => section("applications")}
          >
            {copy("My applications", "As minhas candidaturas")} (
            {applications.length})
            {drafts.length > 0
              ? ` · ${drafts.length} ${drafts.length === 1 ? copy("draft", "rascunho") : copy("drafts", "rascunhos")}`
              : ""}
          </button>
        </div>
      )}
      <div className="work-ui-feedback" role="status">
        {feedback}
      </div>
      {showingApplications ? (
        <WorkApplications
          role={role}
          state={state}
          setState={setState}
          onBrowseOpportunities={() => {
            section("opportunities");
            requestAnimationFrame(() => heading.current?.focus());
          }}
          onOpenOpportunity={openOpportunity}
        />
      ) : (
        <>
          <div className="panel work-ui-search">
            <label htmlFor={`${id}-query`}>
              {copy("Search opportunities", "Pesquisar oportunidades")}
              <input
                id={`${id}-query`}
                type="search"
                maxLength={200}
                value={view.query}
                onChange={(event) => changeQuery(event.currentTarget.value)}
                placeholder={copy(
                  "Role, skill or business",
                  "Função, competência ou empresa",
                )}
              />
            </label>
            <label htmlFor={`${id}-type`}>
              {copy("Work arrangement", "Regime de trabalho")}
              <select
                id={`${id}-type`}
                value={view.type}
                onChange={(event) => {
                  const type = event.currentTarget.value as
                    "All" | WorkArrangement;
                  setState((current) =>
                    updateWorkMarketplaceView(current, role, { type }),
                  );
                }}
              >
                <option value="All">{arrangement("All")}</option>
                {workArrangements.map((type) => (
                  <option key={type} value={type}>
                    {arrangement(type)}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-status`}>
              {copy("Opportunity status", "Estado da oportunidade")}
              <select
                id={`${id}-status`}
                value={view.status}
                onChange={(event) => {
                  const status = event.currentTarget.value as "Open" | "All";
                  setState((current) =>
                    updateWorkMarketplaceView(current, role, { status }),
                  );
                }}
              >
                <option value="Open">
                  {copy("Open opportunities", "Oportunidades abertas")}
                </option>
                <option value="All">
                  {copy(
                    "Include closed opportunities",
                    "Incluir oportunidades encerradas",
                  )}
                </option>
              </select>
            </label>
          </div>
          <p className="work-ui-results" role="status">
            {visible.length}{" "}
            {visible.length === 1
              ? copy("opportunity shown", "oportunidade apresentada")
              : copy("opportunities shown", "oportunidades apresentadas")}
          </p>
          {!visible.length ? (
            <section className="panel work-ui-empty">
              <BriefcaseBusiness size={28} aria-hidden="true" />
              <h3>
                {copy(
                  "No matching opportunities",
                  "Sem oportunidades correspondentes",
                )}
              </h3>
              <p>
                {copy(
                  "Try another role, business or work arrangement.",
                  "Experimente outra função, empresa ou regime de trabalho.",
                )}
              </p>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setState((current) =>
                    updateWorkMarketplaceView(current, role, {
                      query: "",
                      type: "All",
                      status: "Open",
                    }),
                  );
                  onQueryChange?.("");
                }}
              >
                {copy("Clear filters", "Limpar filtros")}
              </button>
            </section>
          ) : (
            <div className="work-ui-layout">
              <section
                className="panel work-ui-list"
                aria-label={copy(
                  "Work opportunities",
                  "Oportunidades de trabalho",
                )}
              >
                <ul>
                  {visible.map((opportunity) => (
                    <li key={opportunity.id}>
                      <button
                        type="button"
                        className={
                          selected?.id === opportunity.id ? "selected" : ""
                        }
                        aria-pressed={selected?.id === opportunity.id}
                        onClick={() => {
                          setState((current) =>
                            updateWorkMarketplaceView(current, role, {
                              selectedOpportunityId: opportunity.id,
                            }),
                          );
                          setFeedback("");
                          requestAnimationFrame(() =>
                            detailHeading.current?.focus(),
                          );
                        }}
                      >
                        <div>
                          <strong>{opportunity.title}</strong>
                          <span>
                            {opportunity.business} · {opportunity.location}
                          </span>
                          <small>{arrangement(opportunity.type)}</small>
                          <span>{opportunity.pay}</span>
                          <small>
                            {opportunity.source === "sample"
                              ? copy(
                                  "Sample opportunity",
                                  "Oportunidade de exemplo",
                                )
                              : copy(
                                  "Posted in this tab",
                                  "Publicada neste separador",
                                )}
                            {opportunity.status === "Closed"
                              ? ` · ${copy("Closed", "Encerrada")}`
                              : ""}
                          </small>
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
                  aria-labelledby={`${id}-opportunity`}
                >
                  <header>
                    <span className="eyebrow">
                      {selected.source === "sample"
                        ? copy("SAMPLE OPPORTUNITY", "OPORTUNIDADE DE EXEMPLO")
                        : copy("LOCAL OPPORTUNITY", "OPORTUNIDADE LOCAL")}
                    </span>
                    <h2
                      id={`${id}-opportunity`}
                      ref={detailHeading}
                      tabIndex={-1}
                    >
                      {selected.title}
                    </h2>
                    <span
                      className={`pill work-ui-status pill-${selected.status === "Open" ? "mint" : "neutral"}`}
                    >
                      {selected.status === "Open"
                        ? copy(
                            "Open for local applications",
                            "Aberta a candidaturas locais",
                          )
                        : copy(
                            "Closed to new applications",
                            "Encerrada a novas candidaturas",
                          )}
                    </span>
                    {selected.source === "local" && (
                      <p className="work-ui-scope">
                        {copy("Posted", "Publicada")}:{" "}
                        <time dateTime={selected.createdAt}>
                          {date(selected.createdAt, true)}
                        </time>
                      </p>
                    )}
                  </header>
                  <WorkOpportunityContent opportunity={selected} />
                  {selected.status === "Closed" && (
                    <p className="work-ui-scope">
                      {copy(
                        "This opportunity no longer accepts new applications. Existing applications and private drafts remain available.",
                        "Esta oportunidade já não aceita novas candidaturas. As candidaturas existentes e os rascunhos privados mantêm-se disponíveis.",
                      )}
                    </p>
                  )}
                  {role === "tenant" && (
                    <div className="work-ui-buttons">
                      {activeApplication ? (
                        <button
                          className="button"
                          type="button"
                          onClick={() => openApplication(activeApplication.id)}
                        >
                          {copy(
                            "Open my application",
                            "Abrir a minha candidatura",
                          )}
                        </button>
                      ) : selected.status === "Open" ? (
                        <button
                          className="button"
                          type="button"
                          onClick={() => setApplyingId(selected.id)}
                        >
                          {hasDraft
                            ? copy(
                                "Continue application draft",
                                "Continuar rascunho de candidatura",
                              )
                            : copy("Start application", "Iniciar candidatura")}
                        </button>
                      ) : (
                        hasDraft && (
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => setApplyingId(selected.id)}
                          >
                            {copy(
                              "Inspect retained draft",
                              "Consultar rascunho guardado",
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
                  <p className="work-ui-scope">
                    {copy(
                      "The business and candidate make their own decisions. Kasa provides the opportunity and application records.",
                      "A empresa e o candidato tomam as suas próprias decisões. A Kasa disponibiliza os registos da oportunidade e da candidatura.",
                    )}
                  </p>
                </section>
              )}
            </div>
          )}
        </>
      )}
      {applying && (
        <WorkApplicationDialog
          key={`${role}-${applying.id}`}
          role={role}
          state={state}
          setState={setState}
          opportunity={applying}
          onClose={() => setApplyingId(null)}
          onSaved={(applicationId) => {
            setApplyingId(null);
            setFeedback(
              copy(
                "Application submitted in this tab. Its details are retained below.",
                "Candidatura submetida neste separador. Os dados mantêm-se abaixo.",
              ),
            );
            openApplication(applicationId);
          }}
        />
      )}
    </section>
  );
}

export function WorkMarketplace(props: WorkMarketplaceProps) {
  return <WorkDiscovery key={props.role} {...props} />;
}
