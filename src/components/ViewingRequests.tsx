import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronRight, Download, Plus } from "lucide-react";
import { properties } from "../data";
import type { Role } from "../types";
import type { OperationsKey } from "../locales/operations/types";
import {
  actOnViewingRequest,
  discardViewingDraft,
  discardViewingActionDraft,
  hasViewingActionDraft,
  isActiveViewing,
  pendingViewingProposal,
  scopedViewingRequests,
  selectVisibleViewingRequest,
  selectViewingRequest,
  selectedViewingRequest,
  setViewingFilter,
  viewingActionIssue,
  viewingActionDraft,
  viewingCounts,
  viewingDrafts,
  viewingView,
  visibleViewingRequests,
  type PropertyRequestState,
  type ViewingAction,
  type ViewingFilter,
  type ViewingIssue,
  type ViewingRequest,
  type ViewingTerms,
} from "./propertyRequestState";
import {
  ViewingActionDialog,
  type ViewingActionMode,
} from "./ViewingActionDialog";
import { ViewingRequestDialog } from "./ViewingRequestDialog";
import { useViewingCopy } from "./viewingCopy";
import { viewingCalendarFile } from "./viewingCalendar";
import { useDialogFocus } from "./useDialogFocus";
import "./viewings.css";

type ViewingNotice = Extract<OperationsKey, `viewings_notice${string}`>;

export interface ViewingOpenRequest {
  role: Role;
  requestId: string;
  revision: number;
}

interface ViewingRequestsProps {
  role: Role;
  state: PropertyRequestState;
  setState: Dispatch<SetStateAction<PropertyRequestState>>;
  onOpenProperty: (propertyId: number) => void;
  onBrowseHomes?: () => void;
  openRequest?: ViewingOpenRequest | null;
  onOpenHandled?: (revision: number) => void;
}

function ViewingTermsDisplay({
  terms,
  label,
}: {
  terms: ViewingTerms;
  label: string;
}) {
  const { date } = useViewingCopy();
  return (
    <div className="viewing-terms">
      <span>{label}</span>
      <strong>
        <CalendarDays size={17} aria-hidden="true" />
        <time dateTime={`${terms.date}T${terms.time}`}>
          {date(terms.date)} · {terms.time}
        </time>
      </strong>
    </div>
  );
}

function ViewingStatus({ request }: { request: ViewingRequest }) {
  const { status } = useViewingCopy();
  const tone =
    request.status === "Agreed"
      ? "mint"
      : ["Pending", "Proposed"].includes(request.status)
        ? "amber"
        : "neutral";
  return <span className={`pill pill-${tone}`}>{status(request.status)}</span>;
}

function UnavailableViewingAction({ onClose }: { onClose: () => void }) {
  const { text, issueText } = useViewingCopy();
  const id = useId();
  const dialog = useDialogFocus<HTMLDivElement>(onClose);
  return createPortal(
    <div
      className="modal-layer property-request-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      tabIndex={-1}
      ref={dialog}
    >
      <button
        type="button"
        className="modal-scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <section className="modal-card property-request-card">
        <div className="modal-body property-request-form">
          <h2 id={`${id}-title`}>
            {text("Request unavailable", "Pedido indisponível")}
          </h2>
          <p id={`${id}-message`} role="alert">
            {issueText("unavailable")}
          </p>
          <button
            type="button"
            className="button"
            onClick={onClose}
            data-dialog-initial-focus
          >
            {text("Close", "Fechar")}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function ViewingCalendarDownload({
  role,
  state,
  requestId,
}: {
  role: Role;
  state: PropertyRequestState;
  requestId: string;
}) {
  const { calendar } = useViewingCopy();
  const hintId = useId();
  const [feedback, setFeedback] = useState<
    "started" | "failed" | "unavailable" | null
  >(null);
  const labels = {
    summary: (propertyTitle: string) =>
      `${calendar.summary} · ${propertyTitle}`,
    description: calendar.description,
  };
  const available = viewingCalendarFile(
    state,
    role,
    requestId,
    labels,
    new Date(),
  );
  if (!available && !feedback) return null;
  function download() {
    const clickedAt = new Date();
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const file = viewingCalendarFile(
        state,
        role,
        requestId,
        labels,
        clickedAt,
      );
      if (!file) {
        setFeedback("unavailable");
        return;
      }
      url = URL.createObjectURL(
        new Blob([file.content], { type: "text/calendar;charset=utf-8" }),
      );
      link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      link.hidden = true;
      document.body.append(link);
      link.click();
      setFeedback("started");
    } catch {
      setFeedback("failed");
    } finally {
      link?.remove();
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  }
  return (
    <div className="viewing-note">
      <div className="viewing-buttons">
        <button
          type="button"
          className="button button-secondary"
          disabled={!available}
          aria-describedby={hintId}
          onClick={download}
        >
          <Download size={17} aria-hidden="true" />
          {calendar.download}
        </button>
      </div>
      <p className="viewing-explanation" id={hintId}>
        {calendar.hint}
      </p>
      <p className="viewing-feedback" role="status">
        {feedback && calendar[feedback]}
      </p>
    </div>
  );
}

function ViewingInbox({
  role,
  state,
  setState,
  onOpenProperty,
  onBrowseHomes,
  openRequest,
  onOpenHandled,
}: ViewingRequestsProps) {
  const {
    text,
    tr,
    number,
    date,
    status,
    proposalStatus,
    issueText,
    history,
    scope,
  } = useViewingCopy();
  const id = useId();
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const handledOpenRevision = useRef<number | null>(null);
  const draftsHeading = useRef<HTMLHeadingElement>(null);
  const [feedback, setFeedback] = useState<ViewingNotice | null>(null);
  const discardFocusFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (discardFocusFrame.current !== null)
        cancelAnimationFrame(discardFocusFrame.current);
    },
    [],
  );
  const [error, setError] = useState<ViewingIssue["code"] | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    mode: ViewingActionMode;
    requestId: string;
  } | null>(null);
  const actionTrigger = useRef<HTMLButtonElement | null>(null);
  function openAction(
    mode: ViewingActionMode,
    requestId: string,
    trigger: HTMLButtonElement,
  ) {
    actionTrigger.current = trigger;
    setActionDialog({ mode, requestId });
  }
  const [draftPropertyId, setDraftPropertyId] = useState<number | null>(null);
  const renderedAt = new Date();
  const view = viewingView(state, role);
  const requests = visibleViewingRequests(state, role, renderedAt);
  const selected = selectedViewingRequest(state, role, renderedAt);
  const openRole = openRequest?.role;
  const openId = openRequest?.requestId;
  const openRevision = openRequest?.revision;
  const selectedId = selected?.id;
  const hasDialog = actionDialog !== null || draftPropertyId !== null;
  useEffect(() => {
    if (
      openRevision === undefined ||
      handledOpenRevision.current === openRevision
    )
      return;
    const acknowledge = () => {
      handledOpenRevision.current = openRevision;
      onOpenHandled?.(openRevision);
    };
    if (
      openRole !== role ||
      !openId ||
      selectedId !== openId ||
      view.selectedId !== openId ||
      hasDialog
    ) {
      acknowledge();
      return;
    }
    const initialFocus = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const heading = detailHeading.current;
      const active = document.activeElement;
      if (
        heading?.isConnected &&
        heading.dataset.viewingId === openId &&
        heading.getClientRects().length &&
        !heading.closest('[hidden], [inert], [aria-hidden="true"]') &&
        getComputedStyle(heading).visibility === "visible" &&
        !document.querySelector('[role="dialog"], dialog[open]') &&
        (!active ||
          active === document.body ||
          active === document.documentElement ||
          active === initialFocus ||
          active === heading)
      )
        heading.focus();
      acknowledge();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    openRole,
    openId,
    openRevision,
    selectedId,
    view.selectedId,
    role,
    hasDialog,
    onOpenHandled,
  ]);
  const actionRequest = actionDialog
    ? scopedViewingRequests(state, role).find(
        (request) => request.id === actionDialog.requestId,
      )
    : undefined;
  const actionProperty = properties.find(
    (item) => item.id === actionRequest?.propertyId,
  );
  const counts = viewingCounts(state, role, renderedAt);
  const drafts = viewingDrafts(state, role);
  const property = properties.find((item) => item.id === selected?.propertyId);
  const draftProperty = properties.find((item) => item.id === draftPropertyId);
  const proposal = selected ? pendingViewingProposal(selected) : null;
  const closed =
    selected && ["Cancelled", "Declined"].includes(selected.status);
  const responseDraft =
    selected && hasViewingActionDraft(state, role, selected.id)
      ? viewingActionDraft(state, role, selected.id)
      : null;
  const pastAgreement =
    selected?.agreedTerms &&
    !isActiveViewing({ ...selected, status: "Agreed" }, renderedAt);
  const filters: [ViewingFilter, number][] = [
    ["All", counts.total],
    ["Pending", counts.pending],
    ["Proposed", counts.proposed],
    ["Agreed", counts.agreed],
    ["History", counts.history],
  ];
  function focusDetail(expectedId?: string) {
    requestAnimationFrame(() => {
      const heading = detailHeading.current;
      if (!expectedId || heading?.dataset.viewingId === expectedId)
        heading?.focus();
    });
  }
  function select(id: string) {
    const clickedAt = new Date();
    setState((current) =>
      selectVisibleViewingRequest(current, role, id, clickedAt),
    );
    setFeedback(null);
    setError(null);
    focusDetail(id);
  }
  function act(action: ViewingAction, message: ViewingNotice) {
    if (!selected) return;
    const issue = viewingActionIssue(state, role, selected.id, action);
    if (issue) {
      setError(issue.code);
      setFeedback(null);
      return;
    }
    const updated = actOnViewingRequest(state, role, selected.id, action);
    if (updated === state) {
      setError("unavailable");
      return;
    }
    setState(selectViewingRequest(updated, role, selected.id));
    setFeedback(message);
    setError(null);
    focusDetail();
  }
  function completedAction() {
    if (!actionDialog) return;
    setState((current) =>
      selectViewingRequest(current, role, actionDialog.requestId),
    );
    setFeedback(
      actionDialog.mode === "proposal"
        ? "viewings_noticeProposalSaved"
        : actionDialog.mode === "decline"
          ? "viewings_noticeDeclineSaved"
          : "viewings_noticeCancellationSaved",
    );
    setError(null);
    setActionDialog(null);
    focusDetail(actionDialog.requestId);
  }
  function responseDiscarded(
    requestId: string,
    trigger: HTMLElement | null,
    restoredTrigger?: HTMLElement | null,
  ) {
    setFeedback("viewings_noticeResponseDiscarded");
    setError(null);
    if (discardFocusFrame.current !== null)
      cancelAnimationFrame(discardFocusFrame.current);
    discardFocusFrame.current = requestAnimationFrame(() => {
      discardFocusFrame.current = null;
      const target = detailHeading.current;
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        active !== document.documentElement &&
        active !== trigger &&
        active !== restoredTrigger
      )
        return;
      if (
        target?.isConnected &&
        target.dataset.viewingId === requestId &&
        target.getClientRects().length &&
        !target.closest('[hidden], [inert], [aria-hidden="true"]') &&
        getComputedStyle(target).visibility === "visible" &&
        !document.querySelector('[role="dialog"], dialog[open]')
      )
        target.focus();
    });
  }
  if (!["tenant", "landlord"].includes(role))
    return (
      <section className="panel viewing-empty">
        <h2>{text("Viewings", "Visitas")}</h2>
        <p>
          {text(
            "Viewing requests are available in tenant and property owner workspaces.",
            "Os pedidos de visita estão disponíveis nas áreas do inquilino e do proprietário.",
          )}
        </p>
      </section>
    );
  return (
    <div className="viewing-page">
      <header className="viewing-page-header">
        <div>
          <span className="eyebrow">
            {text("PROPERTY VIEWINGS", "VISITAS A IMÓVEIS")}
          </span>
          <h1>{text("Viewings", "Visitas")}</h1>
          <p>
            {role === "landlord"
              ? text(
                  "Respond to requests for your properties and agree a time directly.",
                  "Responda aos pedidos dos seus imóveis e acorde um horário diretamente.",
                )
              : text(
                  "Keep your viewing requests, drafts and responses together.",
                  "Mantenha os seus pedidos de visita, rascunhos e respostas juntos.",
                )}
          </p>
        </div>
        {role === "tenant" && onBrowseHomes && (
          <button className="button" type="button" onClick={onBrowseHomes}>
            <Plus size={17} />
            {text("Find a home", "Procurar imóvel")}
          </button>
        )}
      </header>
      <p className="viewing-scope">{scope}</p>
      <div className="viewing-feedback" role="status">
        {feedback && tr(feedback)}
      </div>
      {error && (
        <p className="property-request-errors" role="alert">
          {issueText(error)}
        </p>
      )}
      {role === "tenant" && (
        <section
          className="panel viewing-drafts"
          aria-labelledby={`${id}-drafts`}
        >
          <h2 id={`${id}-drafts`} ref={draftsHeading} tabIndex={-1}>
            {text("Unsent drafts", "Rascunhos por enviar")}{" "}
            <span>({number(drafts.length)})</span>
          </h2>
          {drafts.length ? (
            <ul>
              {drafts.map(({ propertyId, draft }) => {
                const home = properties.find((item) => item.id === propertyId)!;
                return (
                  <li key={propertyId}>
                    <div>
                      <strong>{home.title}</strong>
                      <small>
                        {draft.date
                          ? date(draft.date)
                          : text("Date not chosen", "Data por escolher")}{" "}
                        ·{" "}
                        {draft.time ||
                          text("Time not chosen", "Hora por escolher")}
                      </small>
                    </div>
                    <div className="viewing-buttons">
                      <button
                        className="button button-secondary"
                        type="button"
                        aria-label={`${text("Continue draft", "Continuar rascunho")} · ${home.title}`}
                        onClick={() => setDraftPropertyId(propertyId)}
                      >
                        {text("Continue", "Continuar")}
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        aria-label={`${text("Discard draft", "Eliminar rascunho")} · ${home.title}`}
                        onClick={() => {
                          setState((current) =>
                            discardViewingDraft(current, role, propertyId),
                          );
                          setFeedback("viewings_noticeDraftDiscarded");
                          requestAnimationFrame(() =>
                            draftsHeading.current?.focus(),
                          );
                        }}
                      >
                        {text("Discard", "Eliminar")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>
              {text(
                "Unsent forms will appear here when you close them. Only the tenant workspace can see them.",
                "Os formulários por enviar aparecem aqui ao fechá-los. Só a área do inquilino os pode ver.",
              )}
            </p>
          )}
        </section>
      )}
      <div
        className="viewing-filters"
        role="group"
        aria-label={text(
          "Filter viewing requests",
          "Filtrar pedidos de visita",
        )}
      >
        {filters.map(([filter, count]) => (
          <button
            key={filter}
            type="button"
            aria-pressed={view.filter === filter}
            className={view.filter === filter ? "active" : ""}
            onClick={() => {
              setState((current) => setViewingFilter(current, role, filter));
              setFeedback(null);
              setError(null);
            }}
          >
            {filter === "Agreed"
              ? text("Upcoming accepted", "Aceites futuras")
              : status(filter)}{" "}
            <span>{number(count)}</span>
          </button>
        ))}
      </div>
      <p className="viewing-result-count" role="status">
        {tr("viewings_requestsShown", {
          count: requests.length,
          shownCount: number(requests.length),
        })}
      </p>
      {!requests.length ? (
        <section className="panel viewing-empty">
          <CalendarDays size={28} aria-hidden="true" />
          <h2>
            {counts.total
              ? text("No requests in this filter", "Sem pedidos neste filtro")
              : text(
                  "No viewing requests yet",
                  "Ainda não há pedidos de visita",
                )}
          </h2>
          <p>
            {counts.total
              ? text(
                  "Choose another filter to review the retained requests.",
                  "Escolha outro filtro para consultar os pedidos guardados.",
                )
              : role === "tenant"
                ? text(
                    "Open a home and choose Request viewing to start a local request.",
                    "Abra um imóvel e escolha Pedir visita para iniciar um pedido local.",
                  )
                : text(
                    "Tenant requests for your properties appear here after they are saved in this tab.",
                    "Os pedidos dos inquilinos para os seus imóveis aparecem aqui depois de guardados neste separador.",
                  )}
          </p>
          {counts.total > 0 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setState((current) => setViewingFilter(current, role, "All"))
              }
            >
              {text("Show all requests", "Ver todos os pedidos")}
            </button>
          )}
        </section>
      ) : (
        <div className="viewing-layout">
          <section
            className="panel viewing-list"
            aria-label={text("Viewing requests", "Pedidos de visita")}
          >
            <ul>
              {requests.map((request) => {
                const home = properties.find(
                  (item) => item.id === request.propertyId,
                )!;
                const terms = request.agreedTerms ?? request.requestedTerms;
                return (
                  <li key={request.id}>
                    <button
                      type="button"
                      aria-pressed={selected?.id === request.id}
                      onClick={() => select(request.id)}
                      className={selected?.id === request.id ? "selected" : ""}
                    >
                      <div>
                        <strong>{home.title}</strong>
                        <span>
                          {date(terms.date)} · {terms.time}
                        </span>
                        <small>
                          {role === "landlord"
                            ? request.tenantName
                            : home.landlord}
                        </small>
                        <ViewingStatus request={request} />
                      </div>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          {selected && property && (
            <section
              className="panel viewing-detail"
              aria-labelledby={`${id}-detail`}
            >
              <header>
                <div>
                  <span className="eyebrow">{selected.id}</span>
                  <h2
                    id={`${id}-detail`}
                    tabIndex={-1}
                    ref={detailHeading}
                    data-viewing-id={selected.id}
                  >
                    {property.title}
                  </h2>
                  <p>{property.address}</p>
                </div>
                <ViewingStatus request={selected} />
              </header>
              <dl className="viewing-people">
                <div>
                  <dt>{text("Tenant", "Inquilino")}</dt>
                  <dd>{selected.tenantName}</dd>
                </div>
                <div>
                  <dt>{text("Listing party", "Anunciante")}</dt>
                  <dd>{property.landlord}</dd>
                </div>
              </dl>
              <ViewingTermsDisplay
                terms={selected.agreedTerms ?? selected.requestedTerms}
                label={
                  selected.agreedTerms
                    ? text(
                        "Accepted time in this tab",
                        "Horário aceite neste separador",
                      )
                    : text(
                        "Requested time · awaiting agreement",
                        "Horário pedido · por acordar",
                      )
                }
              />
              <ViewingCalendarDownload
                key={JSON.stringify([
                  role,
                  selected.id,
                  selected.status,
                  selected.agreedTerms?.date,
                  selected.agreedTerms?.time,
                ])}
                role={role}
                state={state}
                requestId={selected.id}
              />
              {pastAgreement && (
                <p className="viewing-explanation">
                  {text(
                    "This accepted time has passed. This record does not confirm that the visit took place.",
                    "Este horário aceite já passou. Este registo não confirma que a visita tenha ocorrido.",
                  )}
                </p>
              )}
              {closed && (
                <p className="viewing-explanation">
                  {text(
                    "This request is closed. Earlier requested or accepted times are kept as history.",
                    "Este pedido está encerrado. Os horários anteriormente pedidos ou aceites mantêm-se no histórico.",
                  )}
                </p>
              )}
              {selected.note && (
                <div className="viewing-note">
                  <strong>
                    {text(
                      "Tenant’s original note",
                      "Nota original do inquilino",
                    )}
                  </strong>
                  <p>{selected.note}</p>
                </div>
              )}
              {proposal && (
                <section
                  className="viewing-proposal"
                  aria-labelledby={`${id}-proposal`}
                >
                  <h3 id={`${id}-proposal`}>
                    {text("Proposed change", "Alteração proposta")} ·{" "}
                    {text("version", "versão")} {number(proposal.version)}
                  </h3>
                  <ViewingTermsDisplay
                    terms={proposal.terms}
                    label={text(
                      "Awaiting the tenant’s decision",
                      "Aguarda decisão do inquilino",
                    )}
                  />
                  <p className="viewing-user-text">{proposal.note}</p>
                  <p className="viewing-explanation">
                    {selected.agreedTerms
                      ? text(
                          "Your existing accepted time remains unchanged until you accept this proposal.",
                          "O horário já aceite mantém-se até esta proposta ser aceite.",
                        )
                      : text(
                          "The original request has not been accepted. Declining this change leaves that request pending.",
                          "O pedido original ainda não foi aceite. Recusar esta alteração mantém esse pedido pendente.",
                        )}
                  </p>
                  {role === "tenant" && (
                    <div className="viewing-buttons">
                      <button
                        type="button"
                        className="button"
                        onClick={() =>
                          act(
                            {
                              type: "accept-proposal",
                              proposalId: proposal.id,
                            },
                            "viewings_noticeProposalAccepted",
                          )
                        }
                      >
                        {text(
                          "Accept proposed time",
                          "Aceitar horário proposto",
                        )}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() =>
                          act(
                            {
                              type: "decline-proposal",
                              proposalId: proposal.id,
                            },
                            selected.agreedTerms
                              ? "viewings_noticeProposalDeclinedKept"
                              : "viewings_noticeProposalDeclinedPending",
                          )
                        }
                      >
                        {selected.agreedTerms
                          ? text("Keep accepted time", "Manter horário aceite")
                          : text(
                              "Decline proposed change",
                              "Recusar alteração proposta",
                            )}
                      </button>
                    </div>
                  )}
                </section>
              )}
              {responseDraft && actionDialog?.requestId !== selected.id && (
                <section
                  className="viewing-private-response"
                  aria-labelledby={`${id}-private-response`}
                >
                  <h3 id={`${id}-private-response`}>
                    {text(
                      "Private response draft",
                      "Rascunho privado da resposta",
                    )}
                  </h3>
                  <p>
                    {closed
                      ? text(
                          "This request is closed. You can inspect, copy or discard your unfinished values; they cannot change the request.",
                          "Este pedido está encerrado. Pode consultar, copiar ou descartar os valores por concluir; não podem alterar o pedido.",
                        )
                      : text(
                          "Your unfinished response stays private to this workspace. Use an available response action below to continue. Reloading clears the draft.",
                          "A resposta por concluir fica privada nesta área de trabalho. Use uma das ações de resposta abaixo para continuar. Recarregar apaga o rascunho.",
                        )}
                  </p>
                  <details>
                    <summary>
                      {text(
                        "View unfinished response",
                        "Ver resposta por concluir",
                      )}
                    </summary>
                    <dl className="viewing-response-values">
                      {(["date", "time", "note"] as const).map((field) => (
                        <div key={field}>
                          <dt>
                            {field === "date"
                              ? text("Date", "Data")
                              : field === "time"
                                ? text("Time", "Hora")
                                : text("Note", "Nota")}
                          </dt>
                          <dd dir="auto">
                            {responseDraft[field] === ""
                              ? text("Not entered", "Por preencher")
                              : responseDraft[field]}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                  <button
                    type="button"
                    className="text-button"
                    onClick={(event) => {
                      const requestId = selected.id;
                      setState((current) =>
                        discardViewingActionDraft(current, role, requestId),
                      );
                      responseDiscarded(requestId, event.currentTarget);
                    }}
                  >
                    {text(
                      "Discard response draft",
                      "Descartar rascunho da resposta",
                    )}
                  </button>
                </section>
              )}
              {!closed && (
                <div className="viewing-buttons viewing-main-actions">
                  {role === "landlord" && (
                    <>
                      {selected.status === "Pending" &&
                        !selected.agreedTerms && (
                          <button
                            type="button"
                            className="button"
                            onClick={() =>
                              act(
                                { type: "accept-request" },
                                "viewings_noticeRequestAccepted",
                              )
                            }
                          >
                            {text(
                              "Accept requested time",
                              "Aceitar horário pedido",
                            )}
                          </button>
                        )}
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={(event) =>
                          openAction(
                            "proposal",
                            selected.id,
                            event.currentTarget,
                          )
                        }
                      >
                        {proposal
                          ? text(
                              "Replace proposed time",
                              "Substituir horário proposto",
                            )
                          : text(
                              "Propose another time",
                              "Propor outro horário",
                            )}
                      </button>
                      {!selected.agreedTerms && (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={(event) =>
                            openAction(
                              "decline",
                              selected.id,
                              event.currentTarget,
                            )
                          }
                        >
                          {text("Decline request", "Recusar pedido")}
                        </button>
                      )}
                    </>
                  )}
                  {(role === "tenant" || selected.agreedTerms) && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={(event) =>
                        openAction("cancel", selected.id, event.currentTarget)
                      }
                    >
                      {text("Cancel request", "Cancelar pedido")}
                    </button>
                  )}
                </div>
              )}
              <button
                className="text-button"
                type="button"
                onClick={() => onOpenProperty(property.id)}
              >
                {text("Open property", "Abrir imóvel")}
                <ChevronRight size={16} />
              </button>
              {selected.agreedTerms && (
                <ViewingTermsDisplay
                  terms={selected.requestedTerms}
                  label={text(
                    "Original requested time",
                    "Horário originalmente pedido",
                  )}
                />
              )}
              {selected.proposals.length > 0 && (
                <section className="viewing-proposal-history">
                  <h3>{text("Time proposals", "Propostas de horário")}</h3>
                  <ul>
                    {[...selected.proposals].reverse().map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>
                            {text("Version", "Versão")} {number(item.version)} ·{" "}
                            {date(item.terms.date)} · {item.terms.time}
                          </strong>
                          <span>{proposalStatus(item.status)}</span>
                        </div>
                        <p>{item.note}</p>
                        <small>{date(item.createdAt, true)}</small>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="viewing-history">
                <h3>{text("Request history", "Histórico do pedido")}</h3>
                <ol>
                  {[...selected.history].reverse().map((event) => (
                    <li key={event.id}>
                      <strong>{history(event.action)}</strong>
                      <small>
                        {event.actor === "tenant"
                          ? text("Tenant", "Inquilino")
                          : text("Property owner", "Proprietário")}{" "}
                        ·{" "}
                        <time dateTime={event.at}>{date(event.at, true)}</time>
                      </small>
                      {event.terms && (
                        <span>
                          {date(event.terms.date)} · {event.terms.time}
                        </span>
                      )}
                      {event.note && <p>{event.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </section>
          )}
        </div>
      )}
      {actionDialog &&
        (actionRequest && actionProperty ? (
          <ViewingActionDialog
            key={`${role}-${actionDialog.requestId}-${actionDialog.mode}`}
            role={role}
            state={state}
            setState={setState}
            request={actionRequest}
            propertyTitle={actionProperty.title}
            mode={actionDialog.mode}
            onClose={() => setActionDialog(null)}
            onSaved={completedAction}
            onDiscarded={() => {
              const requestId = actionDialog.requestId;
              setActionDialog(null);
              responseDiscarded(
                requestId,
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null,
                actionTrigger.current,
              );
            }}
          />
        ) : (
          <UnavailableViewingAction onClose={() => setActionDialog(null)} />
        ))}
      {draftProperty && (
        <ViewingRequestDialog
          role={role}
          state={state}
          setState={setState}
          property={draftProperty}
          onClose={() => setDraftPropertyId(null)}
          onSaved={(requestId) => {
            setDraftPropertyId(null);
            setState((current) =>
              selectViewingRequest(current, role, requestId),
            );
            setFeedback("viewings_noticeRequestSaved");
            focusDetail();
          }}
        />
      )}
    </div>
  );
}

export function ViewingRequests(props: ViewingRequestsProps) {
  return <ViewingInbox key={props.role} {...props} />;
}
