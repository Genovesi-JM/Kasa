import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Clock3,
  FileText,
  Plus,
  Search,
  Wrench,
  X,
} from "lucide-react";
import type { Role } from "../types";
import { matchesSearch } from "../search";
import { useDialogFocus } from "./useDialogFocus";
import {
  applyServiceActionCommand,
  canQuoteServiceRequest,
  discardServiceQuoteDraft,
  hasServiceQuoteDraft,
  isServiceCustomer,
  isTerminalServiceRequest,
  latestServiceQuote,
  saveServiceQuote,
  saveServiceRequest,
  serviceCategories,
  serviceDateValue,
  serviceProperties,
  serviceProvidersForCategory,
  serviceQuoteDraft,
  serviceRequestActionIssue,
  serviceRequestCounts,
  serviceRequestDraft,
  serviceRequestView,
  serviceActionNoteDraft,
  serviceActionNoteDrafts,
  hasServiceActionNoteDraft,
  updateServiceActionNoteDraft,
  discardServiceActionNoteDraft,
  updateServiceQuoteDraft,
  updateServiceRequestDraft,
  updateServiceRequestView,
  visibleServiceRequests,
  workspaceServiceProvider,
  type ServiceIssue,
  type ServiceActionCommand,
  type ServiceNoteTarget,
  type ServiceQuote,
  type ServiceQuoteDraft,
  type ServiceQuoteErrors,
  type ServiceRequestAction,
  type ServiceRequestDraft,
  type ServiceRequestErrors,
  type ServiceRequestRecord,
  type ServiceRequestState,
  type ServiceRequestStatus,
} from "./serviceRequestState";
import "./serviceRequests.css";

interface ServiceRecordProps {
  role: Role;
  state: ServiceRequestState;
  setState: Dispatch<SetStateAction<ServiceRequestState>>;
}
interface ServiceRequestComposerProps extends ServiceRecordProps {
  providerName?: string;
  onClose: () => void;
  onSaved: (requestId: string) => void;
}
interface PendingServiceAction {
  command: ServiceActionCommand;
  trigger: HTMLButtonElement;
}
type ServiceFeedback =
  "noteDiscarded" | "quoteDiscarded" | "requestSaved" | "quoteSaved";
type Copy = (en: string, pt: string) => string;
function useServiceCopy() {
  const { i18n } = useTranslation();
  const portuguese = (
    i18n.resolvedLanguage ||
    i18n.language ||
    "pt"
  ).startsWith("pt");
  const copy: Copy = (en, pt) => (portuguese ? pt : en);
  return { copy, locale: portuguese ? "pt-PT" : "en-GB" };
}
function issueText(issue: ServiceIssue, copy: Copy): string {
  return {
    unavailable: copy(
      "This record is not available in this workspace.",
      "Este registo não está disponível neste espaço.",
    ),
    property: copy(
      "Choose a property available in your workspace.",
      "Escolha um imóvel disponível no seu espaço.",
    ),
    category: copy(
      "Choose a supported home-service category.",
      "Escolha uma categoria de serviços para o lar.",
    ),
    provider: copy(
      "Choose a provider for the selected category.",
      "Escolha um prestador da categoria selecionada.",
    ),
    title: copy(
      "Use a title between 3 and 120 characters.",
      "Use um título entre 3 e 120 caracteres.",
    ),
    description: copy(
      "Describe the request in 20 to 3,000 characters.",
      "Descreva o pedido entre 20 e 3 000 caracteres.",
    ),
    date: copy(
      "Choose a valid date from today onwards.",
      "Escolha uma data válida a partir de hoje.",
    ),
    time: copy(
      "Choose a valid time that has not passed.",
      "Escolha uma hora válida que ainda não tenha passado.",
    ),
    amount: copy(
      "Enter a positive total up to €1 million, with up to two decimals and no thousands separators.",
      "Indique um total positivo até um milhão de euros, com até duas casas decimais e sem separadores de milhares.",
    ),
    scope: copy(
      "Describe the included work and terms in 20 to 3,000 characters.",
      "Descreva o trabalho incluído e as condições entre 20 e 3 000 caracteres.",
    ),
    validUntil: copy(
      "Choose a validity date from today up to the proposed visit date.",
      "Escolha uma data de validade entre hoje e a data da visita proposta.",
    ),
    note: copy(
      "Add a note between 3 and 2,000 characters.",
      "Adicione uma nota entre 3 e 2 000 caracteres.",
    ),
    status: copy(
      "This action is not available at the current stage.",
      "Esta ação não está disponível na fase atual.",
    ),
    staleQuote: copy(
      "This quote has changed. Review the latest version before deciding.",
      "Este orçamento foi alterado. Reveja a versão mais recente antes de decidir.",
    ),
    expired: copy(
      "This quote has expired. A new quote is needed before acceptance.",
      "Este orçamento expirou. É necessário um novo orçamento antes de aceitar.",
    ),
    visitPast: copy(
      "The proposed visit time has passed. A new quote with another time is needed.",
      "A hora da visita proposta já passou. É necessário um novo orçamento com outro horário.",
    ),
  }[issue];
}
function categoryText(category: string, copy: Copy): string {
  const labels: Record<string, string> = {
    Cleaning: copy("Cleaning", "Limpeza"),
    Plumbing: copy("Plumbing", "Canalização"),
    Electrical: copy("Electrical", "Eletricidade"),
    "AC & climate": copy("AC & climate", "Ar condicionado e climatização"),
    Handyman: copy("Handyman", "Pequenas reparações"),
  };
  return Object.hasOwn(labels, category) ? labels[category] : category;
}
function statusText(status: ServiceRequestStatus, copy: Copy): string {
  return {
    Requested: copy("Request recorded", "Pedido registado"),
    Quoted: copy("Quote recorded", "Orçamento registado"),
    Accepted: copy("Quote accepted", "Orçamento aceite"),
    Declined: copy("Quote declined", "Orçamento recusado"),
    "Provider declined": copy(
      "Request declined by provider",
      "Pedido recusado pelo prestador",
    ),
    Cancelled: copy("Cancelled", "Cancelado"),
    "In progress": copy("In progress", "Em curso"),
    Completed: copy("Completed", "Concluído"),
  }[status];
}
function localNotice(copy: Copy) {
  return copy(
    "Records stay in this tab while you navigate. Reloading clears your changes. No request, quote, message or payment is sent to anyone.",
    "Os registos ficam neste separador enquanto navega. Recarregar apaga as suas alterações. Nenhum pedido, orçamento, mensagem ou pagamento é enviado a outras pessoas.",
  );
}
function formatDate(value: string, locale: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(locale, { dateStyle: "medium" })
    : value;
}
function formatTimestamp(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
function formatMoney(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
function quoteDraftLabels(copy: Copy): Record<keyof ServiceQuoteDraft, string> {
  return {
    amount: copy("Total quote (€)", "Total do orçamento (€)"),
    scope: copy("Included work and terms", "Trabalho incluído e condições"),
    date: copy("Proposed visit date", "Data proposta para a visita"),
    time: copy("Proposed visit time", "Hora proposta para a visita"),
    validUntil: copy("Quote valid through", "Orçamento válido até"),
  };
}

function ServiceModal({
  title,
  onClose,
  children,
  copy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  copy: Copy;
}) {
  const ref = useDialogFocus<HTMLDivElement>(onClose);
  const id = useId();
  return createPortal(
    <div
      className="modal-layer service-record-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      ref={ref}
    >
      <button
        type="button"
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="modal-card service-record-modal">
        <header>
          <h2 id={`${id}-title`}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={copy(
              "Close and keep draft",
              "Fechar e manter rascunho",
            )}
            onClick={onClose}
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
function ErrorSummary({
  errors,
  id,
  copy,
  summaryRef,
}: {
  errors: Record<string, ServiceIssue | undefined>;
  id: string;
  copy: Copy;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const entries = Object.entries(errors).filter(([, issue]) => Boolean(issue));
  if (!entries.length) return null;
  return (
    <div
      className="service-record-errors"
      role="alert"
      tabIndex={-1}
      ref={summaryRef}
    >
      <strong>{copy("Check these details", "Verifique estes dados")}</strong>
      <ul>
        {entries.map(([name, issue]) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => document.getElementById(`${id}-${name}`)?.focus()}
            >
              {issueText(issue!, copy)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
function fieldValues<T extends object>(
  form: HTMLFormElement | null,
  draft: T,
): Partial<T> {
  if (!form) return {};
  const data = new FormData(form);
  const patch: Partial<T> = {};
  for (const key of Object.keys(draft) as Array<keyof T>) {
    const value = data.get(String(key));
    if (typeof value === "string") patch[key] = value as T[keyof T];
  }
  return patch;
}

function RequestComposer({
  role,
  state,
  setState,
  providerName,
  onClose,
  onSaved,
}: ServiceRequestComposerProps) {
  const { copy } = useServiceCopy();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<ServiceRequestErrors>({});
  const [failedSubmit, setFailedSubmit] = useState(0);
  useEffect(() => {
    if (failedSubmit) summary.current?.focus();
  }, [failedSubmit]);
  const draft = serviceRequestDraft(state, role, providerName);
  const change = (name: keyof ServiceRequestDraft, value: string) => {
    const patch = {
      [name]: value,
      ...(name === "category" ? { providerName: "" } : {}),
    };
    setState((current) =>
      updateServiceRequestDraft(current, role, patch, providerName),
    );
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      if (name === "category") delete next.providerName;
      return next;
    });
  };
  const close = () => {
    const patch = fieldValues(form.current, draft);
    setState((current) =>
      updateServiceRequestDraft(current, role, patch, providerName),
    );
    onClose();
  };
  const labels: Record<keyof ServiceRequestDraft, string> = {
    propertyId: copy("Property", "Imóvel"),
    category: copy("Service category", "Categoria do serviço"),
    providerName: copy("Provider", "Prestador"),
    title: copy("Request title", "Título do pedido"),
    description: copy("What needs to be done?", "O que precisa de ser feito?"),
    preferredDate: copy("Preferred date", "Data preferida"),
    preferredTime: copy("Preferred time", "Hora preferida"),
  };
  const field = (
    name: keyof ServiceRequestDraft,
    options: {
      choices?: Array<{ value: string; label: string }>;
      type?: "date" | "time";
      wide?: boolean;
      maxLength?: number;
    } = {},
  ) => (
    <label
      className={options.wide ? "service-field-wide" : ""}
      htmlFor={`${id}-${name}`}
      key={name}
    >
      {labels[name]}
      {options.choices ? (
        <select
          id={`${id}-${name}`}
          name={name}
          aria-label={labels[name]}
          value={draft[name]}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
          required
        >
          {options.choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : name === "description" ? (
        <textarea
          id={`${id}-${name}`}
          name={name}
          aria-label={labels[name]}
          value={draft[name]}
          rows={5}
          maxLength={3000}
          onInput={(event) => change(name, event.currentTarget.value)}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
          required
        />
      ) : (
        <input
          id={`${id}-${name}`}
          name={name}
          aria-label={labels[name]}
          type={options.type ?? "text"}
          min={options.type === "date" ? serviceDateValue() : undefined}
          value={draft[name]}
          maxLength={options.maxLength}
          onInput={(event) => change(name, event.currentTarget.value)}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
          required
        />
      )}
      {errors[name] && (
        <small className="service-field-error" id={`${id}-${name}-error`}>
          {issueText(errors[name]!, copy)}
        </small>
      )}
    </label>
  );
  if (!isServiceCustomer(role)) return null;
  return (
    <ServiceModal
      title={copy("Record a service request", "Registar um pedido de serviço")}
      onClose={close}
      copy={copy}
    >
      <form
        ref={form}
        className="modal-body service-record-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const updated = updateServiceRequestDraft(
            state,
            role,
            fieldValues(event.currentTarget, draft),
            providerName,
          );
          const result = saveServiceRequest(updated, role, providerName);
          setState(result.state);
          setErrors(result.errors);
          if (result.requestId) onSaved(result.requestId);
          else setFailedSubmit((current) => current + 1);
        }}
      >
        <p className="service-record-local">{localNotice(copy)}</p>
        <ErrorSummary
          errors={errors}
          id={id}
          copy={copy}
          summaryRef={summary}
        />
        <div className="service-record-form-grid">
          {field("propertyId", {
            wide: true,
            choices: [
              {
                value: "",
                label: copy("Choose a property", "Escolha um imóvel"),
              },
              ...serviceProperties(role).map((property) => ({
                value: String(property.id),
                label: property.title,
              })),
            ],
          })}
          {field("category", {
            choices: [
              {
                value: "",
                label: copy("Choose a category", "Escolha uma categoria"),
              },
              ...serviceCategories.map((category) => ({
                value: category,
                label: categoryText(category, copy),
              })),
            ],
          })}
          {field("providerName", {
            choices: [
              {
                value: "",
                label: copy("Choose a provider", "Escolha um prestador"),
              },
              ...serviceProvidersForCategory(draft.category).map(
                (provider) => ({ value: provider.name, label: provider.name }),
              ),
            ],
          })}
          {field("title", { wide: true, maxLength: 120 })}
          {field("preferredDate", { type: "date" })}
          {field("preferredTime", { type: "time" })}
          {field("description", { wide: true })}
        </div>
        <p className="service-record-hint">
          {copy(
            "The preferred time is a request. A provider can propose another date and price; you decide whether to accept that quote.",
            "O horário preferido é um pedido. O prestador pode propor outra data e preço; cabe-lhe decidir se aceita esse orçamento.",
          )}
        </p>
        <div className="service-record-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            {copy("Keep draft and close", "Manter rascunho e fechar")}
          </button>
          <button type="submit" className="button">
            {copy("Save request in this tab", "Guardar pedido neste separador")}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </form>
    </ServiceModal>
  );
}
export function ServiceRequestComposer(props: ServiceRequestComposerProps) {
  return (
    <RequestComposer
      key={`${props.role}-${props.providerName ?? "general"}`}
      {...props}
    />
  );
}

function QuoteEditor({
  record,
  role,
  state,
  setState,
  onClose,
  onSaved,
}: ServiceRecordProps & {
  record: ServiceRequestRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useServiceCopy();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<ServiceQuoteErrors>({});
  const [issue, setIssue] = useState<ServiceIssue | null>(null);
  const [failedSubmit, setFailedSubmit] = useState(0);
  useEffect(() => {
    if (failedSubmit) summary.current?.focus();
  }, [failedSubmit]);
  const draft = serviceQuoteDraft(state, role, record.id);
  const change = (name: keyof ServiceQuoteDraft, value: string) => {
    setState((current) =>
      updateServiceQuoteDraft(current, role, record.id, { [name]: value }),
    );
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setIssue(null);
  };
  const close = () => {
    const patch = fieldValues(form.current, draft);
    setState((current) =>
      updateServiceQuoteDraft(current, role, record.id, patch),
    );
    onClose();
  };
  const labels = quoteDraftLabels(copy);
  const field = (name: keyof ServiceQuoteDraft) => (
    <label
      className={name === "scope" ? "service-field-wide" : ""}
      htmlFor={`${id}-${name}`}
      key={name}
    >
      {labels[name]}
      {name === "scope" ? (
        <textarea
          id={`${id}-${name}`}
          name={name}
          aria-label={labels[name]}
          value={draft[name]}
          rows={5}
          maxLength={3000}
          onInput={(event) => change(name, event.currentTarget.value)}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
          required
        />
      ) : (
        <input
          id={`${id}-${name}`}
          name={name}
          aria-label={labels[name]}
          type={
            name === "time"
              ? "time"
              : name === "date" || name === "validUntil"
                ? "date"
                : "text"
          }
          inputMode={name === "amount" ? "decimal" : undefined}
          min={
            name === "date" || name === "validUntil"
              ? serviceDateValue()
              : undefined
          }
          max={name === "validUntil" ? draft.date || undefined : undefined}
          maxLength={name === "amount" ? 12 : undefined}
          value={draft[name]}
          onInput={(event) => change(name, event.currentTarget.value)}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
          required
        />
      )}
      {errors[name] && (
        <small className="service-field-error" id={`${id}-${name}-error`}>
          {issueText(errors[name]!, copy)}
        </small>
      )}
    </label>
  );
  return (
    <ServiceModal
      title={copy("Record a quote", "Registar um orçamento")}
      onClose={close}
      copy={copy}
    >
      <form
        ref={form}
        className="modal-body service-record-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const updated = updateServiceQuoteDraft(
            state,
            role,
            record.id,
            fieldValues(event.currentTarget, draft),
          );
          const result = saveServiceQuote(updated, role, record.id);
          setState(result.state);
          setErrors(result.errors);
          setIssue(result.issue ?? null);
          if (Object.keys(result.errors).length || result.issue)
            setFailedSubmit((current) => current + 1);
          else onSaved();
        }}
      >
        <p className="service-record-context">
          <strong>{record.title}</strong>
          <span>
            {record.customerName} · {record.providerName}
          </span>
        </p>
        <p className="service-record-local">{localNotice(copy)}</p>
        <ErrorSummary
          errors={errors}
          id={id}
          copy={copy}
          summaryRef={summary}
        />
        {issue && (
          <p className="service-field-error" role="alert">
            {issueText(issue, copy)}
          </p>
        )}
        <div className="service-record-form-grid">
          {field("amount")}
          {field("validUntil")}
          {field("date")}
          {field("time")}
          {field("scope")}
        </div>
        <p className="service-record-hint">
          {copy(
            "Enter the complete agreed-price proposal, including any materials, taxes or charges. Recording it does not accept it for the customer. A revised quote keeps the previous version in the history.",
            "Indique a proposta de preço total, incluindo materiais, impostos ou encargos. Registar o orçamento não significa aceitá-lo pelo cliente. Uma revisão mantém a versão anterior no histórico.",
          )}
        </p>
        <div className="service-record-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            {copy("Keep draft and close", "Manter rascunho e fechar")}
          </button>
          <button type="submit" className="button">
            {copy(
              "Save quote in this tab",
              "Guardar orçamento neste separador",
            )}
          </button>
        </div>
      </form>
    </ServiceModal>
  );
}

function QuoteCard({
  quote,
  copy,
  locale,
  cancelled = false,
}: {
  quote: ServiceQuote;
  copy: Copy;
  locale: string;
  cancelled?: boolean;
}) {
  const decisions = {
    Pending: cancelled
      ? copy("Request cancelled", "Pedido cancelado")
      : copy("Awaiting customer decision", "Aguarda decisão do cliente"),
    Accepted: copy("Accepted by customer", "Aceite pelo cliente"),
    Declined: copy("Declined by customer", "Recusado pelo cliente"),
    Superseded: copy(
      "Replaced by a newer quote",
      "Substituído por um orçamento mais recente",
    ),
  };
  return (
    <div className="service-quote-card">
      <header>
        <div>
          <span className="eyebrow">
            {copy("QUOTE", "ORÇAMENTO")} · {copy("version", "versão")}{" "}
            {quote.version}
          </span>
          <strong>{formatMoney(quote.amountCents, locale)}</strong>
        </div>
        <span className="pill pill-neutral">{decisions[quote.decision]}</span>
      </header>
      <dl>
        <div>
          <dt>{copy("Proposed visit", "Visita proposta")}</dt>
          <dd>
            {formatDate(quote.date, locale)} · {quote.time}
          </dd>
        </div>
        <div>
          <dt>{copy("Valid through", "Válido até")}</dt>
          <dd>{formatDate(quote.validUntil, locale)}</dd>
        </div>
      </dl>
      <p className="service-record-description">{quote.scope}</p>
      {quote.decisionNote && (
        <p className="service-quote-decision-note">
          <strong>{copy("Customer note", "Nota do cliente")}</strong>{" "}
          {quote.decisionNote}
        </p>
      )}
    </div>
  );
}
function historyText(
  action: ServiceRequestRecord["history"][number]["action"],
  copy: Copy,
) {
  return {
    requested: copy("Request recorded", "Pedido registado"),
    quoted: copy("Quote recorded", "Orçamento registado"),
    accepted: copy("Quote accepted", "Orçamento aceite"),
    declined: copy("Quote declined", "Orçamento recusado"),
    "provider-declined": copy(
      "Request declined by provider",
      "Pedido recusado pelo prestador",
    ),
    cancelled: copy("Request cancelled", "Pedido cancelado"),
    started: copy("Work marked in progress", "Trabalho marcado como em curso"),
    completed: copy("Completion recorded", "Conclusão registada"),
  }[action];
}

function noteTargetKey(target: ServiceNoteTarget | null): string {
  return target?.type === "decline"
    ? `decline:${target.quoteId}`
    : (target?.type ?? "unassigned");
}
function captureServiceActionCommand(
  role: Role,
  requestId: string,
  action: ServiceRequestAction,
): ServiceActionCommand {
  return Object.freeze({
    token: crypto.randomUUID(),
    role,
    requestId,
    action: Object.freeze({ ...action }),
    at: Date.now(),
  });
}
function noteTargetForAction(
  action: ServiceRequestAction,
): ServiceNoteTarget | null {
  if (action.type === "accept" || action.type === "start") return null;
  return action.type === "decline"
    ? { type: "decline", quoteId: action.quoteId }
    : { type: action.type };
}
function noteTargetLabel(
  target: ServiceNoteTarget | null,
  record: ServiceRequestRecord,
  copy: Copy,
) {
  if (!target)
    return copy(
      "Unassigned private note",
      "Nota privada sem finalidade definida",
    );
  if (target.type === "decline") {
    const version = record.quotes.find(
      (quote) => quote.id === target.quoteId,
    )?.version;
    return `${copy("Reason for declining quote", "Motivo da recusa do orçamento")} ${version ?? target.quoteId}`;
  }
  return {
    cancel: copy(
      "Reason for cancelling the request",
      "Motivo do cancelamento do pedido",
    ),
    "decline-request": copy(
      "Reason for declining the request",
      "Motivo da recusa do pedido",
    ),
    complete: copy("Completion note", "Nota de conclusão"),
  }[target.type];
}

function ServiceRecordBoard({ role, state, setState }: ServiceRecordProps) {
  const { copy, locale } = useServiceCopy();
  const id = useId();
  const { query, filter, selectedId } = serviceRequestView(state, role);
  const [composerOpen, setComposerOpen] = useState(false);
  const [quoteRequestId, setQuoteRequestId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ServiceFeedback | null>(null);
  const [pendingAction, setPendingAction] =
    useState<PendingServiceAction | null>(null);
  const pendingActionRef = useRef<PendingServiceAction | null>(null);
  const focusedReceipt = useRef<string | null>(null);
  const clearPendingAction = () => {
    pendingActionRef.current = null;
    setPendingAction(null);
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const noteInputs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const discardFocusFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (discardFocusFrame.current !== null)
        cancelAnimationFrame(discardFocusFrame.current);
    },
    [],
  );
  useEffect(() => {
    if (
      !selectedId ||
      pendingActionRef.current?.command.requestId === selectedId
    )
      return;
    const frame = requestAnimationFrame(() => {
      const target = detailHeading.current;
      if (target?.dataset.requestId === selectedId) target.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [role, selectedId]);
  const provider = role === "provider";
  const records = visibleServiceRequests(state, role);
  const counts = serviceRequestCounts(state, role);
  const visible = records
    .filter(
      (record) =>
        (filter === "all" ||
          (isTerminalServiceRequest(record.status)
            ? filter === "history"
            : filter === "active")) &&
        matchesSearch(
          query,
          record.title,
          record.description,
          record.customerName,
          record.providerName,
          categoryText(record.category, copy),
          ...serviceProperties(record.customerRole)
            .filter((property) => property.id === record.propertyId)
            .map((property) => property.title),
        ),
    )
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) ||
        b.id.localeCompare(a.id, undefined, { numeric: true }),
    );
  const selected =
    visible.find((record) => record.id === selectedId) ?? visible[0];
  useEffect(() => {
    const pending = pendingActionRef.current;
    if (
      pending &&
      (pending.command.role !== role ||
        pending.command.requestId !== selected?.id ||
        composerOpen ||
        quoteRequestId)
    ) {
      pendingActionRef.current = null;
      setPendingAction(null);
    }
  }, [role, selected?.id, composerOpen, quoteRequestId]);
  const receipt = state.actionReceipt;
  const committedReceipt =
    pendingAction &&
    !composerOpen &&
    !quoteRequestId &&
    pendingAction.command.role === role &&
    pendingAction.command.requestId === selected?.id &&
    receipt?.token === pendingAction.command.token &&
    receipt.role === role &&
    receipt.requestId === selected.id &&
    receipt.actionType === pendingAction.command.action.type
      ? receipt
      : null;
  const actionError = committedReceipt?.issue ?? null;
  const actionSucceeded = Boolean(
    committedReceipt &&
    !committedReceipt.issue &&
    committedReceipt.eventId &&
    selected?.history.some((event) => event.id === committedReceipt.eventId),
  );
  useEffect(() => {
    if (
      !committedReceipt ||
      !pendingAction ||
      focusedReceipt.current === committedReceipt.token
    )
      return;
    const frame = requestAnimationFrame(() => {
      focusedReceipt.current = committedReceipt.token;
      const heading = detailHeading.current;
      if (
        heading?.dataset.requestId !== committedReceipt.requestId ||
        document.querySelector('[role="dialog"], dialog[open]')
      )
        return;
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        active !== document.documentElement &&
        active !== pendingAction.trigger
      )
        return;
      const noteTarget = noteTargetForAction(pendingAction.command.action);
      const noteInput = noteTarget
        ? noteInputs.current[
            `${committedReceipt.requestId}/${noteTargetKey(noteTarget)}`
          ]
        : null;
      const target = committedReceipt.issue === "note" ? noteInput : heading;
      if (
        target?.isConnected &&
        !target.closest('[hidden], [inert], [aria-hidden="true"]') &&
        target.getClientRects().length > 0 &&
        getComputedStyle(target).visibility === "visible"
      )
        target.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [committedReceipt, pendingAction]);
  const quoteRecord = records.find(
    (record) =>
      record.id === quoteRequestId && canQuoteServiceRequest(record, role),
  );
  const quote = selected ? latestServiceQuote(selected) : undefined;
  const retainedQuoteDraft =
    selected && hasServiceQuoteDraft(state, role, selected.id)
      ? serviceQuoteDraft(state, role, selected.id)
      : null;
  const acceptIssue =
    selected && quote && selected.status === "Quoted" && !provider
      ? serviceRequestActionIssue(state, role, selected.id, {
          type: "accept",
          quoteId: quote.id,
        })
      : null;
  const canCancel =
    selected &&
    !provider &&
    ["Requested", "Quoted", "Accepted", "Declined"].includes(selected.status);
  const canDeclineRequest =
    provider &&
    selected?.status === "Requested" &&
    canQuoteServiceRequest(selected, role);
  const providerDecline =
    selected?.status === "Provider declined"
      ? [...selected.history]
          .reverse()
          .find((event) => event.action === "provider-declined")
      : undefined;
  const activeNoteTargets: ServiceNoteTarget[] = [
    ...(canDeclineRequest ? [{ type: "decline-request" as const }] : []),
    ...(!provider && selected?.status === "Quoted" && quote
      ? [{ type: "decline" as const, quoteId: quote.id }]
      : []),
    ...(canCancel ? [{ type: "cancel" as const }] : []),
    ...(provider && selected?.status === "In progress"
      ? [{ type: "complete" as const }]
      : []),
  ];
  const inactiveNoteDrafts = selected
    ? serviceActionNoteDrafts(state, role, selected.id).filter(
        (draft) => !draft.editable,
      )
    : [];
  const focusAfterDiscard = (requestId: string, trigger: HTMLButtonElement) => {
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
        active !== trigger
      )
        return;
      if (
        target?.isConnected &&
        target.dataset.requestId === requestId &&
        !target.closest('[hidden], [inert], [aria-hidden="true"]') &&
        target.getClientRects().length > 0 &&
        getComputedStyle(target).visibility === "visible" &&
        !document.querySelector('[role="dialog"], dialog[open]')
      )
        target.focus();
    });
  };
  const discardNoteDraft = (
    target: ServiceNoteTarget | null,
    trigger: HTMLButtonElement,
  ) => {
    if (
      !selected ||
      !hasServiceActionNoteDraft(state, role, selected.id, target)
    )
      return;
    const requestId = selected.id;
    clearPendingAction();
    setState((current) =>
      discardServiceActionNoteDraft(current, role, requestId, target),
    );
    setFeedback("noteDiscarded");
    focusAfterDiscard(requestId, trigger);
  };
  const discardQuoteDraft = (trigger: HTMLButtonElement) => {
    if (!selected || !retainedQuoteDraft) return;
    clearPendingAction();
    const requestId = selected.id;
    setState((current) => discardServiceQuoteDraft(current, role, requestId));
    setFeedback("quoteDiscarded");
    focusAfterDiscard(requestId, trigger);
  };
  const perform = (
    action: ServiceRequestAction,
    trigger: HTMLButtonElement,
  ) => {
    if (!selected) return;
    const command = captureServiceActionCommand(role, selected.id, action);
    const pending = { command, trigger };
    pendingActionRef.current = pending;
    setPendingAction(pending);
    setFeedback(null);
    setState((current) => applyServiceActionCommand(current, command));
  };
  const completed: Record<ServiceRequestAction["type"], string> = {
    accept: copy(
      "Quote acceptance recorded in this tab.",
      "Aceitação do orçamento registada neste separador.",
    ),
    decline: copy(
      "Quote declined in this tab. The provider can record a revised quote.",
      "Orçamento recusado neste separador. O prestador pode registar uma revisão.",
    ),
    "decline-request": copy(
      "Request declined in this tab. History is open with the recorded reason.",
      "Pedido recusado neste separador. O histórico está aberto com o motivo registado.",
    ),
    cancel: copy(
      "Request cancelled in this tab. History is open with the recorded reason.",
      "Pedido cancelado neste separador. O histórico está aberto com o motivo registado.",
    ),
    start: copy(
      "Work marked in progress in this tab.",
      "Trabalho marcado como em curso neste separador.",
    ),
    complete: copy(
      "Completion and your note recorded in this tab. History is open with this request.",
      "Conclusão e nota registadas neste separador. O histórico está aberto com este pedido.",
    ),
  };
  const feedbackText: Record<ServiceFeedback, string> = {
    noteDiscarded: copy(
      "Private note draft discarded. The service record is unchanged.",
      "Rascunho privado da nota descartado. O registo do serviço permanece inalterado.",
    ),
    quoteDiscarded: copy(
      "Private quote draft discarded. Recorded quotes are unchanged.",
      "Rascunho privado do orçamento descartado. Os orçamentos registados permanecem inalterados.",
    ),
    requestSaved: copy(
      "Service request recorded in this tab.",
      "Pedido de serviço registado neste separador.",
    ),
    quoteSaved: copy(
      "Quote recorded in this tab. The customer must explicitly accept it.",
      "Orçamento registado neste separador. O cliente tem de o aceitar explicitamente.",
    ),
  };
  if (!isServiceCustomer(role) && !provider)
    return (
      <section className="card service-record-unavailable">
        <Wrench size={24} aria-hidden="true" />
        <h2>{copy("Service records", "Registos de serviços")}</h2>
        <p>
          {copy(
            "Customer requests belong to the tenant or property-owner workspace. Provider records belong to the provider workspace.",
            "Os pedidos de clientes pertencem ao espaço de inquilino ou proprietário. Os registos dos prestadores pertencem ao espaço de prestador.",
          )}
        </p>
      </section>
    );
  return (
    <section
      className="service-record-workspace"
      aria-labelledby={`${id}-title`}
    >
      <header className="service-record-heading">
        <div>
          <span className="eyebrow">
            {provider
              ? workspaceServiceProvider
              : copy("KASA SERVICES", "SERVIÇOS KASA")}
          </span>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>
            {provider
              ? copy("Service job inbox", "Caixa de pedidos de serviço")
              : copy("My service requests", "Os meus pedidos de serviço")}
          </h2>
          <p>
            {copy(
              `${counts.active} active · ${counts.completed} completed · ${counts.cancelled} cancelled · ${counts.providerDeclined} declined by provider`,
              `${counts.active} em aberto · ${counts.completed} ${counts.completed === 1 ? "concluído" : "concluídos"} · ${counts.cancelled} ${counts.cancelled === 1 ? "cancelado" : "cancelados"} · ${counts.providerDeclined} ${counts.providerDeclined === 1 ? "recusado pelo prestador" : "recusados pelo prestador"}`,
            )}
          </p>
        </div>
        {!provider && (
          <button
            type="button"
            className="button"
            onClick={() => {
              clearPendingAction();
              setComposerOpen(true);
            }}
          >
            <Plus size={17} aria-hidden="true" />
            {copy("New service request", "Novo pedido de serviço")}
          </button>
        )}
      </header>
      {provider && (
        <dl className="service-provider-counts">
          <div>
            <dt>{copy("Awaiting quote", "Aguardam orçamento")}</dt>
            <dd>{counts.requested}</dd>
          </div>
          <div>
            <dt>{copy("Awaiting decision", "Aguardam decisão")}</dt>
            <dd>{counts.quoted}</dd>
          </div>
          <div>
            <dt>{copy("Accepted", "Aceites")}</dt>
            <dd>{counts.accepted}</dd>
          </div>
          <div>
            <dt>{copy("In progress", "Em curso")}</dt>
            <dd>{counts.inProgress}</dd>
          </div>
        </dl>
      )}
      <p className="service-record-local">{localNotice(copy)}</p>
      <div className="service-record-toolbar">
        <label className="service-record-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label={copy(
              "Search service records",
              "Pesquisar registos de serviços",
            )}
            placeholder={copy(
              "Search requests or people",
              "Pesquisar pedidos ou pessoas",
            )}
            maxLength={200}
            value={query}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setState((current) =>
                updateServiceRequestView(current, role, { query: value }),
              );
              clearPendingAction();
            }}
          />
        </label>
        <div
          className="service-record-tabs"
          aria-label={copy(
            "Service request filter",
            "Filtro dos pedidos de serviço",
          )}
        >
          {(["active", "history", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => {
                setState((current) =>
                  updateServiceRequestView(current, role, { filter: value }),
                );
                clearPendingAction();
              }}
            >
              {value === "active"
                ? copy(
                    `Active (${counts.active})`,
                    `Em aberto (${counts.active})`,
                  )
                : value === "history"
                  ? copy(
                      `History (${counts.total - counts.active})`,
                      `Histórico (${counts.total - counts.active})`,
                    )
                  : copy(`All (${counts.total})`, `Todos (${counts.total})`)}
            </button>
          ))}
        </div>
      </div>
      <p className="service-record-feedback" role="status">
        {actionSucceeded && committedReceipt
          ? completed[committedReceipt.actionType]
          : feedback
            ? feedbackText[feedback]
            : ""}
      </p>
      {visible.length === 0 ? (
        <div className="card service-record-empty">
          <ClipboardList size={30} aria-hidden="true" />
          <h3>
            {records.length
              ? copy("No matching requests", "Nenhum pedido encontrado")
              : copy(
                  "No service requests yet",
                  "Ainda não há pedidos de serviço",
                )}
          </h3>
          <p>
            {records.length
              ? copy(
                  "Try another search or filter.",
                  "Experimente outra pesquisa ou filtro.",
                )
              : provider
                ? copy(
                    "Only requests addressed to Volt & Co. appear in this workspace.",
                    "Neste espaço aparecem apenas pedidos dirigidos à Volt & Co.",
                  )
                : copy(
                    "Create a request to keep its details and provider quote together.",
                    "Crie um pedido para guardar os detalhes e o orçamento do prestador.",
                  )}
          </p>
        </div>
      ) : (
        <div className="service-record-layout">
          <div
            className="service-record-list"
            aria-label={copy("Service requests", "Pedidos de serviço")}
          >
            {visible.map((record) => (
              <button
                key={record.id}
                type="button"
                className={`card service-record-row ${selected?.id === record.id ? "selected" : ""}`}
                aria-pressed={selected?.id === record.id}
                onClick={() => {
                  setState((current) =>
                    updateServiceRequestView(current, role, {
                      selectedId: record.id,
                    }),
                  );
                  clearPendingAction();
                  setFeedback(null);
                  if (selectedId === record.id)
                    requestAnimationFrame(() => detailHeading.current?.focus());
                }}
              >
                <span className="service-record-row-top">
                  <span
                    className={`pill ${record.status === "Completed" || record.status === "Accepted" ? "pill-mint" : "pill-neutral"}`}
                  >
                    {statusText(record.status, copy)}
                  </span>
                  {record.source === "sample" && (
                    <small>{copy("Sample", "Exemplo")}</small>
                  )}
                </span>
                <strong>{record.title}</strong>
                <span>
                  {provider ? record.customerName : record.providerName} ·{" "}
                  {categoryText(record.category, copy)}
                </span>
                <small>
                  {formatDate(record.preferredDate, locale)} ·{" "}
                  {record.preferredTime}
                </small>
              </button>
            ))}
          </div>
          {selected && (
            <article className="card service-record-detail">
              <header>
                <div>
                  <span className="eyebrow">{selected.id}</span>
                  <h3
                    ref={detailHeading}
                    tabIndex={-1}
                    data-request-id={selected.id}
                  >
                    {selected.title}
                  </h3>
                </div>
                <span className="pill pill-neutral">
                  {statusText(selected.status, copy)}
                </span>
              </header>
              <dl className="service-record-facts">
                <div>
                  <dt>{copy("Customer", "Cliente")}</dt>
                  <dd>{selected.customerName}</dd>
                </div>
                <div>
                  <dt>{copy("Provider", "Prestador")}</dt>
                  <dd>{selected.providerName}</dd>
                </div>
                <div>
                  <dt>{copy("Property", "Imóvel")}</dt>
                  <dd>
                    {
                      serviceProperties(selected.customerRole).find(
                        (property) => property.id === selected.propertyId,
                      )?.title
                    }
                  </dd>
                </div>
                <div>
                  <dt>{copy("Requested time", "Horário pedido")}</dt>
                  <dd>
                    {formatDate(selected.preferredDate, locale)} ·{" "}
                    {selected.preferredTime}
                  </dd>
                </div>
              </dl>
              <p className="service-record-description">
                {selected.description}
              </p>
              {providerDecline ? (
                <p className="service-quote-decision-note">
                  <strong>
                    {copy(
                      "Reason from provider",
                      "Motivo indicado pelo prestador",
                    )}
                  </strong>
                  {providerDecline.note}
                  <br />
                  <time dateTime={providerDecline.at}>
                    {formatTimestamp(providerDecline.at, locale)}
                  </time>
                </p>
              ) : quote ? (
                <QuoteCard
                  quote={quote}
                  copy={copy}
                  locale={locale}
                  cancelled={selected.status === "Cancelled"}
                />
              ) : (
                <p className="service-record-waiting">
                  <Clock3 size={17} aria-hidden="true" />
                  {copy(
                    "No quote recorded for this request.",
                    "Ainda não há orçamento registado para este pedido.",
                  )}
                </p>
              )}
              {selected.status === "Accepted" && (
                <p className="service-record-acceptance">
                  <Check size={18} aria-hidden="true" />
                  {copy(
                    "The customer explicitly accepted the latest quote in this tab. No payment has been processed.",
                    "O cliente aceitou explicitamente o orçamento mais recente neste separador. Nenhum pagamento foi processado.",
                  )}
                </p>
              )}
              {provider &&
                retainedQuoteDraft &&
                quoteRecord?.id !== selected.id && (
                  <section
                    className="service-private-quote"
                    aria-labelledby={`${id}-private-quote-title`}
                  >
                    <h4 id={`${id}-private-quote-title`}>
                      {copy(
                        "Private quote draft",
                        "Rascunho privado do orçamento",
                      )}
                    </h4>
                    <p>
                      {copy(
                        "Unfinished details stay private in your provider workspace in this tab. Reloading clears them.",
                        "Os dados por concluir permanecem privados no seu espaço de prestador neste separador. Recarregar a página apaga-os.",
                      )}
                    </p>
                    {!canQuoteServiceRequest(selected, role) && (
                      <p>
                        {copy(
                          "This request no longer allows a quote revision. You can inspect, copy or discard these unfinished values. They cannot replace a recorded or accepted quote.",
                          "Este pedido já não permite rever o orçamento. Pode consultar, copiar ou descartar estes valores por concluir. Não podem substituir um orçamento registado ou aceite.",
                        )}
                      </p>
                    )}
                    <details>
                      <summary>
                        {copy(
                          "View unfinished quote draft",
                          "Ver rascunho do orçamento por concluir",
                        )}
                      </summary>
                      <dl className="service-record-facts">
                        {(
                          [
                            "amount",
                            "date",
                            "time",
                            "validUntil",
                            "scope",
                          ] as const
                        ).map((field) => (
                          <div
                            key={field}
                            className={
                              field === "scope"
                                ? "service-private-quote-wide"
                                : undefined
                            }
                          >
                            <dt>{quoteDraftLabels(copy)[field]}</dt>
                            <dd dir="auto">
                              {retainedQuoteDraft[field] === ""
                                ? copy("Not entered", "Por preencher")
                                : retainedQuoteDraft[field]}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                    <button
                      type="button"
                      className="text-button"
                      onClick={(event) =>
                        discardQuoteDraft(event.currentTarget)
                      }
                    >
                      {copy(
                        "Discard quote draft",
                        "Descartar rascunho do orçamento",
                      )}
                    </button>
                  </section>
                )}
              {provider && canQuoteServiceRequest(selected, role) && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    clearPendingAction();
                    setQuoteRequestId(selected.id);
                  }}
                >
                  <FileText size={17} aria-hidden="true" />
                  {retainedQuoteDraft
                    ? copy(
                        "Resume quote draft",
                        "Retomar rascunho do orçamento",
                      )
                    : quote
                      ? copy("Revise quote", "Rever orçamento")
                      : copy("Build quote", "Criar orçamento")}
                </button>
              )}
              {acceptIssue && (
                <p className="service-field-error">
                  {issueText(acceptIssue, copy)}
                </p>
              )}
              {actionError && (
                <p
                  id={`${id}-action-error`}
                  className="service-field-error"
                  role="alert"
                >
                  {issueText(actionError, copy)}
                </p>
              )}
              <div className="service-record-actions">
                {!provider && selected.status === "Quoted" && quote && (
                  <button
                    type="button"
                    className="button"
                    disabled={Boolean(acceptIssue)}
                    onClick={(event) =>
                      perform(
                        { type: "accept", quoteId: quote.id },
                        event.currentTarget,
                      )
                    }
                  >
                    <Check size={16} aria-hidden="true" />
                    {copy("Accept this quote", "Aceitar este orçamento")}
                  </button>
                )}
                {provider && selected.status === "Accepted" && (
                  <button
                    type="button"
                    className="button"
                    onClick={(event) =>
                      perform({ type: "start" }, event.currentTarget)
                    }
                  >
                    {copy("Record work started", "Registar início do trabalho")}
                  </button>
                )}
              </div>
              {activeNoteTargets.map((target) => {
                const draft = serviceActionNoteDraft(
                  state,
                  role,
                  selected.id,
                  target,
                );
                if (!draft?.editable) return null;
                const key = noteTargetKey(target);
                const inputKey = `${selected.id}/${key}`;
                const inputId = `${id}-${selected.id}-${key}-note`;
                const hasDraft = hasServiceActionNoteDraft(
                  state,
                  role,
                  selected.id,
                  target,
                );
                const invalid =
                  actionError === "note" &&
                  pendingAction &&
                  noteTargetKey(
                    noteTargetForAction(pendingAction.command.action),
                  ) === key;
                const saveLabel = {
                  "decline-request": copy("Decline request", "Recusar pedido"),
                  decline: copy("Decline quote", "Recusar orçamento"),
                  cancel: copy("Cancel request", "Cancelar pedido"),
                  complete: copy("Record completion", "Registar conclusão"),
                }[target.type];
                const update = (value: string) => {
                  setState((current) =>
                    updateServiceActionNoteDraft(
                      current,
                      role,
                      selected.id,
                      target,
                      value,
                    ),
                  );
                  clearPendingAction();
                };
                return (
                  <section
                    className="service-purpose-note"
                    key={inputKey}
                    aria-labelledby={`${inputId}-label`}
                  >
                    <label
                      className="service-record-action-note"
                      htmlFor={inputId}
                    >
                      <span id={`${inputId}-label`}>
                        {noteTargetLabel(target, selected, copy)}
                      </span>
                      <textarea
                        id={inputId}
                        name={`note-${key}`}
                        data-note-purpose={key}
                        data-request-id={selected.id}
                        dir="auto"
                        ref={(node) => {
                          if (node) noteInputs.current[inputKey] = node;
                          else delete noteInputs.current[inputKey];
                        }}
                        rows={3}
                        maxLength={2000}
                        value={draft.note}
                        aria-required="true"
                        aria-invalid={Boolean(invalid)}
                        aria-describedby={`${inputId}-help${invalid ? ` ${id}-action-error` : ""}`}
                        onInput={(event) => update(event.currentTarget.value)}
                        onChange={(event) => update(event.currentTarget.value)}
                      />
                      <small id={`${inputId}-help`}>
                        {copy(
                          "Private until you use the action below. Use 3–2,000 characters. Leaving this page keeps the draft; reloading clears it.",
                          "Privada até usar a ação abaixo. Use entre 3 e 2 000 caracteres. Sair desta página mantém o rascunho; recarregar apaga-o.",
                        )}
                      </small>
                    </label>
                    <div className="service-record-actions">
                      <button
                        type="button"
                        className={
                          target.type === "complete"
                            ? "button"
                            : "button button-secondary"
                        }
                        onClick={(event) =>
                          perform(
                            {
                              ...target,
                              note:
                                noteInputs.current[inputKey]?.value ??
                                draft.note,
                            },
                            event.currentTarget,
                          )
                        }
                      >
                        {saveLabel}
                      </button>
                      {hasDraft && (
                        <button
                          type="button"
                          className="text-button"
                          aria-describedby={`${inputId}-label`}
                          onClick={(event) =>
                            discardNoteDraft(target, event.currentTarget)
                          }
                        >
                          {copy(
                            "Discard note draft",
                            "Descartar rascunho da nota",
                          )}
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
              {inactiveNoteDrafts.length > 0 && (
                <section
                  className="service-private-quote service-private-notes"
                  aria-labelledby={`${id}-private-notes`}
                >
                  <h4 id={`${id}-private-notes`}>
                    {copy(
                      "Unfinished private notes",
                      "Notas privadas por concluir",
                    )}
                  </h4>
                  <p>
                    {copy(
                      "These notes are kept for you to inspect, copy or discard. They cannot be submitted at the current stage and will not be used for another action. Reloading clears them.",
                      "Estas notas ficam disponíveis para consultar, copiar ou descartar. Não podem ser enviadas na fase atual nem serão usadas para outra ação. Recarregar a página apaga-as.",
                    )}
                  </p>
                  {inactiveNoteDrafts.map((draft) => {
                    const key = noteTargetKey(draft.target);
                    const labelId = `${id}-${selected.id}-${key}-private-label`;
                    return (
                      <article key={key}>
                        <details>
                          <summary id={labelId}>
                            {noteTargetLabel(draft.target, selected, copy)}
                          </summary>
                          <p className="service-private-note-text" dir="auto">
                            {draft.note === ""
                              ? copy("Not entered", "Por preencher")
                              : draft.note}
                          </p>
                        </details>
                        <button
                          type="button"
                          className="text-button"
                          aria-describedby={labelId}
                          onClick={(event) =>
                            discardNoteDraft(draft.target, event.currentTarget)
                          }
                        >
                          {copy(
                            "Discard note draft",
                            "Descartar rascunho da nota",
                          )}
                        </button>
                      </article>
                    );
                  })}
                </section>
              )}
              {selected.quotes.length > 1 && (
                <details className="service-record-older-quotes">
                  <summary>
                    {copy(
                      "Previous quote versions",
                      "Versões anteriores do orçamento",
                    )}{" "}
                    ({selected.quotes.length - 1})
                  </summary>
                  {selected.quotes
                    .slice(0, -1)
                    .reverse()
                    .map((previous) => (
                      <QuoteCard
                        key={previous.id}
                        quote={previous}
                        copy={copy}
                        locale={locale}
                      />
                    ))}
                </details>
              )}
              <section className="service-record-history">
                <h4>{copy("Record history", "Histórico do registo")}</h4>
                <ol>
                  {[...selected.history].reverse().map((event) => (
                    <li key={event.id}>
                      <strong>{historyText(event.action, copy)}</strong>
                      <span>
                        {event.actor} ·{" "}
                        <time dateTime={event.at}>
                          {formatTimestamp(event.at, locale)}
                        </time>
                      </span>
                      {event.quoteId && (
                        <small>
                          {copy("Quote", "Orçamento")}{" "}
                          {
                            selected.quotes.find(
                              (item) => item.id === event.quoteId,
                            )?.version
                          }
                        </small>
                      )}
                      {event.note && <p>{event.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </article>
          )}
        </div>
      )}
      {composerOpen && (
        <ServiceRequestComposer
          role={role}
          state={state}
          setState={setState}
          onClose={() => setComposerOpen(false)}
          onSaved={() => {
            setComposerOpen(false);
            setFeedback("requestSaved");
          }}
        />
      )}
      {quoteRecord && (
        <QuoteEditor
          key={quoteRecord.id}
          record={quoteRecord}
          role={role}
          state={state}
          setState={setState}
          onClose={() => setQuoteRequestId(null)}
          onSaved={() => {
            setQuoteRequestId(null);
            setFeedback("quoteSaved");
            requestAnimationFrame(() => detailHeading.current?.focus());
          }}
        />
      )}
    </section>
  );
}
export function ServiceRequests(props: ServiceRecordProps) {
  return <ServiceRecordBoard key={props.role} {...props} />;
}
export function ServiceProviderInbox(props: ServiceRecordProps) {
  return <ServiceRecordBoard key={props.role} {...props} />;
}
