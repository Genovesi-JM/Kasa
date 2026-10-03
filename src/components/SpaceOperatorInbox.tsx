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
import { ArrowLeft, ArrowRight, CalendarDays, Search, X } from "lucide-react";
import type { Role } from "../types";
import { matchesSearch } from "../search";
import { useDialogFocus } from "./useDialogFocus";
import {
  actOnSpaceBooking,
  bookingTermsTotalCents,
  discardSpaceBookingOperatorDraft,
  hasSpaceBookingOperatorDraft,
  operatorSpaceVenues,
  revealSpaceOperatorBooking,
  saveSpaceBookingProposal,
  scopedSpaceBookings,
  spaceBookingActionDraft,
  spaceBookingActionIssue,
  spaceBookingCounts,
  spaceBookingDateValue,
  spaceBookingEndTimestamp,
  spaceOperatorInboxView,
  updateSpaceBookingActionDraft,
  updateSpaceOperatorInboxView,
  type ManagedSpaceBooking,
  type SpaceBookingsState,
} from "./spaceBookingsState";
import {
  spaceBookingDate,
  spaceBookingMoney,
  useSpaceBookingCopy,
} from "./spaceBookingCopy";
import "./spaceOperatorInbox.css";
import { SpaceOperatorSchedule } from "./SpaceOperatorSchedule";

interface SpaceOperatorInboxProps {
  role: Role;
  state: SpaceBookingsState;
  setState: Dispatch<SetStateAction<SpaceBookingsState>>;
  onBrowseSpaces?: () => void;
}

type Copy = (en: string, pt: string) => string;
type OperatorFilter = "pending" | "agreed" | "history" | "all";
type ActionDraft = ReturnType<typeof spaceBookingActionDraft>;
type Terms = ManagedSpaceBooking["requestedTerms"];
type FormErrors = Partial<Record<keyof ActionDraft, string>>;
type DialogMode = "proposal" | "decline";
type ActionDialog = { bookingId: string; mode: DialogMode };

function phaseText(phase: ManagedSpaceBooking["phase"], copy: Copy) {
  return {
    Requested: copy("Awaiting operator", "Aguarda operador"),
    Proposed: copy("Awaiting customer", "Aguarda cliente"),
    Agreed: copy("Agreed locally", "Acordado localmente"),
    Declined: copy("Declined", "Recusado"),
    Cancelled: copy("Cancelled", "Cancelado"),
    Completed: copy("Completed", "Concluído"),
  }[phase];
}

function proposalText(status: string, copy: Copy) {
  const labels: Record<string, string> = {
    pending: copy("Awaiting customer decision", "Aguarda decisão do cliente"),
    accepted: copy("Accepted by customer", "Aceite pelo cliente"),
    declined: copy("Declined by customer", "Recusada pelo cliente"),
    superseded: copy(
      "Replaced by a newer proposal",
      "Substituída por uma proposta mais recente",
    ),
    withdrawn: copy("Withdrawn", "Retirada"),
  };
  return Object.hasOwn(labels, status) ? labels[status] : status;
}

function issueText(issue: string, copy: Copy) {
  const labels: Record<string, string> = {
    unavailable: copy(
      "This record is not available in this workspace.",
      "Este registo não está disponível nesta área de trabalho.",
    ),
    role: copy(
      "Only the venue operator can perform this action.",
      "Só o operador do espaço pode realizar esta ação.",
    ),
    venue: copy(
      "This venue is not managed by this operator workspace.",
      "Este espaço não é gerido nesta área de operador.",
    ),
    space: copy(
      "This space is no longer available in the local catalogue.",
      "Este espaço já não está disponível no catálogo local.",
    ),
    date: copy(
      "Choose a valid current or future date.",
      "Escolha uma data válida, de hoje ou futura.",
    ),
    start: copy(
      "Choose a valid future start time.",
      "Escolha uma hora de início válida e futura.",
    ),
    end: copy(
      "Choose a valid end time after the start.",
      "Escolha uma hora de fim válida, posterior ao início.",
    ),
    range: copy(
      "The end must be after the start, on the same day.",
      "O fim tem de ser posterior ao início, no mesmo dia.",
    ),
    openingHours: copy(
      "Choose a time within the venue's published opening hours.",
      "Escolha um horário dentro do período de funcionamento publicado do espaço.",
    ),
    participants: copy(
      "The number of people must fit the space capacity.",
      "O número de pessoas tem de respeitar a lotação do espaço.",
    ),
    notes: copy(
      "Keep request notes within 3,000 characters.",
      "Escreva notas do pedido com até 3.000 caracteres.",
    ),
    price: copy(
      "Enter a positive price up to €1 million, with at most two decimal places and no thousands separators.",
      "Indique um preço positivo até um milhão de euros, com até duas casas decimais e sem separadores de milhares.",
    ),
    cleaningFee: copy(
      "Enter a cleaning fee from €0 to €1 million, with at most two decimal places and no thousands separators.",
      "Indique uma taxa de limpeza entre zero e um milhão de euros, com até duas casas decimais e sem separadores de milhares.",
    ),
    deposit: copy(
      "Enter a deposit from €0 to €1 million, with at most two decimal places and no thousands separators.",
      "Indique uma caução entre zero e um milhão de euros, com até duas casas decimais e sem separadores de milhares.",
    ),
    note: copy(
      "Add a note between 3 and 2,000 characters.",
      "Adicione uma nota entre 3 e 2.000 caracteres.",
    ),
    conflict: copy(
      "This space already has an agreed local reservation at that time. Choose another time.",
      "Este espaço já tem uma reserva local acordada nesse horário. Escolha outro horário.",
    ),
    blocked: copy(
      "This time is marked unavailable in the local schedule. Choose another time or review the block.",
      "Este horário está marcado como indisponível no calendário local. Escolha outro horário ou reveja o bloqueio.",
    ),
    completionTime: copy(
      "The agreed end time must be valid and reached before completion can be recorded.",
      "A hora de fim acordada tem de ser válida e já ter sido atingida para registar a conclusão.",
    ),
    status: copy(
      "This action is no longer available. Review the current record.",
      "Esta ação já não está disponível. Reveja o registo atual.",
    ),
    staleProposal: copy(
      "The proposal has changed. Review the latest version before continuing.",
      "A proposta mudou. Reveja a versão mais recente antes de continuar.",
    ),
    priceRequired: copy(
      "This request has no agreed price. Propose complete terms, including a price, for the customer to review.",
      "Este pedido não tem um preço acordado. Proponha condições completas, incluindo um preço, para o cliente analisar.",
    ),
    noChange: copy(
      "Change at least one term before saving a revised proposal.",
      "Altere pelo menos uma condição antes de guardar uma proposta revista.",
    ),
  };
  return Object.hasOwn(labels, issue)
    ? labels[issue]
    : copy(
        "This action could not be saved. Review the current details and try again.",
        "Não foi possível guardar esta ação. Reveja os dados atuais e tente novamente.",
      );
}

function historyText(action: string, copy: Copy) {
  const labels: Record<string, string> = {
    requested: copy("Request recorded", "Pedido registado"),
    accepted: copy(
      "Operator agreed to the original request",
      "Operador aceitou o pedido original",
    ),
    declined: copy(
      "Operator declined the request",
      "Operador recusou o pedido",
    ),
    proposed: copy(
      "Operator recorded a proposal",
      "Operador registou uma proposta",
    ),
    "proposal-accepted": copy(
      "Customer accepted the proposal",
      "Cliente aceitou a proposta",
    ),
    "proposal-declined": copy(
      "Customer declined the proposal",
      "Cliente recusou a proposta",
    ),
    cancelled: copy("Record cancelled", "Registo cancelado"),
    completed: copy("Completion recorded", "Conclusão registada"),
  };
  return Object.hasOwn(labels, action) ? labels[action] : action;
}

function localNotice(copy: Copy) {
  return copy(
    "These records stay in this tab until you reload. No external messages are sent, no real reservation is confirmed and no payment or refund is processed.",
    "Estes registos ficam neste separador até recarregar. Não são enviadas mensagens externas, nenhuma reserva real é confirmada e nenhum pagamento ou reembolso é processado.",
  );
}

function BookingTerms({
  title,
  terms,
  copy,
  locale,
  children,
}: {
  title: string;
  terms: Terms;
  copy: Copy;
  locale: string;
  children?: ReactNode;
}) {
  const { copy: sharedCopy } = useSpaceBookingCopy();
  return (
    <section className="space-operator-terms">
      <h4>{title}</h4>
      <dl>
        <div>
          <dt>{copy("Date", "Data")}</dt>
          <dd>{spaceBookingDate(terms.date, locale)}</dd>
        </div>
        <div>
          <dt>{copy("Time", "Horário")}</dt>
          <dd>
            {terms.start}–{terms.end}
          </dd>
        </div>
        <div>
          <dt>{copy("Space price", "Preço do espaço")}</dt>
          <dd>{spaceBookingMoney(terms.priceCents, locale, sharedCopy)}</dd>
        </div>
        <div>
          <dt>{copy("Cleaning fee", "Taxa de limpeza")}</dt>
          <dd>
            {spaceBookingMoney(terms.cleaningFeeCents, locale, sharedCopy)}
          </dd>
        </div>
        <div>
          <dt>{copy("Refundable deposit", "Caução reembolsável")}</dt>
          <dd>{spaceBookingMoney(terms.depositCents, locale, sharedCopy)}</dd>
        </div>
        <div>
          <dt>{copy("Total including deposit", "Total com caução")}</dt>
          <dd>
            <strong>
              {spaceBookingMoney(
                bookingTermsTotalCents(terms),
                locale,
                sharedCopy,
              )}
            </strong>
          </dd>
        </div>
      </dl>
      {children}
    </section>
  );
}

function valuesFromForm(
  form: HTMLFormElement | null,
  draft: ActionDraft,
): Partial<ActionDraft> {
  if (!form) return {};
  const data = new FormData(form);
  const patch: Partial<ActionDraft> = {};
  for (const key of Object.keys(draft) as Array<keyof ActionDraft>) {
    const value = data.get(key);
    if (typeof value === "string") patch[key] = value;
  }
  return patch;
}

function operatorDraftLabels(copy: Copy): Record<keyof ActionDraft, string> {
  return {
    date: copy("Proposed date", "Data proposta"),
    start: copy("Start time", "Hora de início"),
    end: copy("End time", "Hora de fim"),
    price: copy("Space price (€)", "Preço do espaço (€)"),
    cleaningFee: copy("Cleaning fee (€)", "Taxa de limpeza (€)"),
    deposit: copy("Deposit (€)", "Caução (€)"),
    note: copy("Note or refusal reason", "Nota ou motivo da recusa"),
  };
}

function UnavailableOperatorAction({
  onClose,
  copy,
}: {
  onClose: () => void;
  copy: Copy;
}) {
  const dialog = useDialogFocus<HTMLDivElement>(onClose);
  const id = useId();
  return createPortal(
    <div
      className="modal-layer space-operator-modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      ref={dialog}
    >
      <button
        type="button"
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="modal-card space-operator-modal">
        <header>
          <h2 id={`${id}-title`}>
            {copy("Review the current record", "Reveja o registo atual")}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={copy("Close", "Fechar")}
            onClick={onClose}
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">
          <p className="space-operator-callout">
            {copy(
              "This action is no longer available for the record you opened. No unfinished values have been submitted.",
              "Esta ação já não está disponível para o registo que abriu. Nenhum valor por concluir foi submetido.",
            )}
          </p>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function OperatorActionDialog({
  role,
  state,
  setState,
  record,
  mode,
  onClose,
  onSaved,
}: SpaceOperatorInboxProps & {
  record: ManagedSpaceBooking;
  mode: DialogMode;
  onClose: () => void;
  onSaved: (mode: DialogMode) => void;
}) {
  const { locale } = useSpaceBookingCopy();
  const copy: Copy = (en, pt) => (locale === "pt-PT" ? pt : en);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [issue, setIssue] = useState<string | null>(null);
  const [failedSubmit, setFailedSubmit] = useState(0);
  const draft = spaceBookingActionDraft(state, role, record.id);
  const close = () => {
    const patch = valuesFromForm(form.current, draft);
    setState((current) =>
      updateSpaceBookingActionDraft(current, role, record.id, patch),
    );
    onClose();
  };
  const dialog = useDialogFocus<HTMLDivElement>(close);
  useEffect(() => {
    if (failedSubmit) errorSummary.current?.focus();
  }, [failedSubmit]);
  const change = (field: keyof ActionDraft, value: string) => {
    setState((current) =>
      updateSpaceBookingActionDraft(current, role, record.id, {
        [field]: value,
      }),
    );
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setIssue(null);
  };
  const labels: Record<keyof ActionDraft, string> = {
    ...operatorDraftLabels(copy),
    note:
      mode === "decline"
        ? copy("Reason for declining", "Motivo da recusa")
        : copy("Explain the proposal", "Explique a proposta"),
  };
  const field = (name: keyof ActionDraft) => (
    <label
      key={name}
      htmlFor={`${id}-${name}`}
      className={
        name === "note" || name === "date"
          ? "space-operator-field-wide"
          : undefined
      }
    >
      {labels[name]}
      {name === "note" ? (
        <textarea
          id={`${id}-${name}`}
          name={name}
          aria-label={labels[name]}
          rows={4}
          maxLength={2000}
          required
          value={draft[name]}
          onInput={(event) => change(name, event.currentTarget.value)}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        />
      ) : (
        <input
          id={`${id}-${name}`}
          name={name}
          aria-label={labels[name]}
          type={
            name === "date"
              ? "date"
              : name === "start" || name === "end"
                ? "time"
                : "text"
          }
          inputMode={
            name === "price" || name === "cleaningFee" || name === "deposit"
              ? "decimal"
              : undefined
          }
          min={name === "date" ? spaceBookingDateValue() : undefined}
          maxLength={
            name === "price" || name === "cleaningFee" || name === "deposit"
              ? 12
              : undefined
          }
          value={draft[name]}
          onInput={(event) => change(name, event.currentTarget.value)}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
          required
        />
      )}
      {errors[name] && (
        <small
          className="space-operator-field-error"
          id={`${id}-${name}-error`}
        >
          {issueText(errors[name], copy)}
        </small>
      )}
    </label>
  );
  const errorEntries = Object.entries(errors).filter(([, value]) =>
    Boolean(value),
  );
  return createPortal(
    <div
      className="modal-layer space-operator-modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      ref={dialog}
    >
      <button
        type="button"
        className="modal-scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
      />
      <section className="modal-card space-operator-modal">
        <header>
          <h2 id={`${id}-title`}>
            {mode === "proposal"
              ? copy("Propose complete terms", "Propor condições completas")
              : copy("Decline this request", "Recusar este pedido")}
          </h2>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label={copy(
              "Close and keep draft",
              "Fechar e manter rascunho",
            )}
            data-dialog-initial-focus
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <form
          ref={form}
          className="modal-body"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const updated = updateSpaceBookingActionDraft(
              state,
              role,
              record.id,
              valuesFromForm(event.currentTarget, draft),
            );
            if (mode === "proposal") {
              const result = saveSpaceBookingProposal(updated, role, record.id);
              setState(result.state);
              setErrors(result.errors);
              setIssue(result.issue ?? null);
              if (Object.keys(result.errors).length || result.issue)
                setFailedSubmit((value) => value + 1);
              else onSaved(mode);
            } else {
              const action = {
                type: "decline-request" as const,
                note: spaceBookingActionDraft(updated, role, record.id).note,
              };
              const actionIssue = spaceBookingActionIssue(
                updated,
                role,
                record.id,
                action,
              );
              setIssue(actionIssue === "note" ? null : actionIssue);
              setErrors(actionIssue === "note" ? { note: actionIssue } : {});
              if (actionIssue) {
                setState(updated);
                setFailedSubmit((value) => value + 1);
              } else {
                setState(actOnSpaceBooking(updated, role, record.id, action));
                onSaved(mode);
              }
            }
          }}
        >
          <p className="space-operator-form-context">
            <strong>
              {record.customerName} · {record.space}
            </strong>
            <br />
            {mode === "proposal"
              ? copy(
                  "Enter the complete date, time and itemised price. The customer must explicitly accept this proposal; any current agreement stays unchanged until then.",
                  "Indique a data, o horário e o preço discriminado completos. O cliente tem de aceitar explicitamente esta proposta; qualquer acordo atual mantém-se até essa aceitação.",
                )
              : copy(
                  "Your reason will be retained with the original request and its history. This does not contact the customer.",
                  "O motivo fica guardado com o pedido original e o respetivo histórico. Esta ação não contacta o cliente.",
                )}
          </p>
          {(errorEntries.length > 0 || issue) && (
            <div
              className="space-operator-errors"
              role="alert"
              ref={errorSummary}
              tabIndex={-1}
            >
              <strong>
                {copy("Review these details", "Reveja estes dados")}
              </strong>
              {issue && <p>{issueText(issue, copy)}</p>}
              {errorEntries.length > 0 && (
                <ul>
                  {errorEntries.map(([name, value]) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById(`${id}-${name}`)?.focus()
                        }
                      >
                        {issueText(value!, copy)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="space-operator-form-grid">
            {mode === "proposal" && (
              <>
                {field("date")}
                {field("start")}
                {field("end")}
                {field("price")}
                {field("cleaningFee")}
                {field("deposit")}
              </>
            )}
            {field("note")}
          </div>
          <p className="space-operator-callout">
            {copy(
              "Your draft is kept when you close this form. Values are local records, with no payment collection or external messages.",
              "O rascunho é mantido quando fechar este formulário. Os valores são registos locais, sem cobrança nem mensagens externas.",
            )}
          </p>
          <div className="space-operator-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={close}
            >
              {copy("Keep draft and close", "Manter rascunho e fechar")}
            </button>
            <button type="submit" className="button">
              {mode === "proposal"
                ? copy("Save proposal", "Guardar proposta")
                : copy("Save refusal", "Guardar recusa")}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function OperatorInbox({
  role,
  state,
  setState,
  onBrowseSpaces,
}: SpaceOperatorInboxProps) {
  const { locale, copy: bookingCopy } = useSpaceBookingCopy();
  const copy: Copy = (en, pt) => (locale === "pt-PT" ? pt : en);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const lastRow = useRef<HTMLButtonElement | null>(null);
  const { query, filter, selectedId } = spaceOperatorInboxView(state, role);
  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const draftFocusFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (draftFocusFrame.current !== null)
        cancelAnimationFrame(draftFocusFrame.current);
    },
    [],
  );
  const [feedback, setFeedback] = useState("");
  const [actionIssue, setActionIssue] = useState<string | null>(null);
  const [, refreshCompletionEligibility] = useState(0);
  useEffect(() => {
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => {
      const target = detailHeading.current;
      if (target?.dataset.bookingId === selectedId) target.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [role, selectedId]);
  const venues = operatorSpaceVenues(role);
  const records = scopedSpaceBookings(state, role);
  const counts = spaceBookingCounts(state, role);
  const closed = (record: ManagedSpaceBooking) =>
    ["Completed", "Cancelled", "Declined"].includes(record.phase);
  const pending = (record: ManagedSpaceBooking) =>
    ["Requested", "Proposed"].includes(record.phase);
  const visible = records
    .filter(
      (record) =>
        (filter === "all" ||
          (filter === "pending"
            ? pending(record)
            : filter === "agreed"
              ? Boolean(record.agreedTerms) && !closed(record)
              : closed(record))) &&
        matchesSearch(
          query,
          record.id,
          record.customerName,
          record.venue,
          record.space,
          phaseText(record.phase, copy),
        ),
    )
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.id.localeCompare(left.id, undefined, { numeric: true }),
    );
  const selected = records.find((record) => record.id === selectedId);
  const dialogRecord = records.find(
    (record) => record.id === actionDialog?.bookingId,
  );
  const dialogAvailable =
    dialogRecord &&
    !closed(dialogRecord) &&
    (actionDialog?.mode === "proposal" ||
      !spaceBookingActionIssue(state, role, dialogRecord.id, {
        type: "decline-request",
        note: "Operator decision",
      }));
  const privateDraft =
    selected && hasSpaceBookingOperatorDraft(state, role, selected.id)
      ? spaceBookingActionDraft(state, role, selected.id)
      : null;
  const showCompletion = Boolean(selected?.agreedTerms && !closed(selected));
  const completionEndAt =
    showCompletion && selected?.agreedTerms
      ? spaceBookingEndTimestamp(selected.agreedTerms)
      : NaN;
  const completionIssue =
    showCompletion && selected
      ? spaceBookingActionIssue(state, role, selected.id, { type: "complete" })
      : null;
  useEffect(() => {
    if (!Number.isFinite(completionEndAt)) return;
    let timer: number | undefined;
    const schedule = () => {
      const remaining = completionEndAt - Date.now();
      if (remaining > 0)
        timer = window.setTimeout(
          refresh,
          Math.min(remaining + 1, 2_147_483_647),
        );
    };
    const refresh = () => {
      window.clearTimeout(timer);
      refreshCompletionEligibility((value) => value + 1);
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    schedule();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [completionEndAt, role, selectedId]);
  const latestProposal = selected?.proposals.at(-1);
  const acceptIssue =
    selected && selected.phase === "Requested"
      ? spaceBookingActionIssue(state, role, selected.id, {
          type: "accept-request",
        })
      : null;
  const declineIssue = selected
    ? spaceBookingActionIssue(state, role, selected.id, {
        type: "decline-request",
        note: "Operator decision",
      })
    : "unavailable";
  const canPropose =
    selected && ["Requested", "Proposed", "Agreed"].includes(selected.phase);
  const closeDetails = () => {
    setState((current) =>
      updateSpaceOperatorInboxView(current, role, { selectedId: null }),
    );
    setActionIssue(null);
    requestAnimationFrame(() =>
      lastRow.current?.isConnected
        ? lastRow.current.focus()
        : heading.current?.focus(),
    );
  };
  const focusDraftRecord = (
    bookingId: string,
    trigger: HTMLButtonElement | null,
  ) => {
    if (draftFocusFrame.current !== null)
      cancelAnimationFrame(draftFocusFrame.current);
    draftFocusFrame.current = requestAnimationFrame(() => {
      draftFocusFrame.current = null;
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        active !== document.documentElement &&
        active !== trigger
      )
        return;
      const target = detailHeading.current;
      if (
        target?.isConnected &&
        target.dataset.bookingId === bookingId &&
        !target.closest('[hidden], [inert], [aria-hidden="true"]') &&
        target.getClientRects().length > 0 &&
        getComputedStyle(target).visibility === "visible" &&
        !document.querySelector('[role="dialog"], dialog[open]')
      )
        target.focus();
    });
  };
  const discardDraft = (trigger: HTMLButtonElement) => {
    if (!selected || !privateDraft) return;
    const bookingId = selected.id;
    setState((current) =>
      discardSpaceBookingOperatorDraft(current, role, bookingId),
    );
    setFeedback(
      copy(
        "Private response draft discarded. Recorded proposals and agreements are unchanged.",
        "Rascunho privado da resposta descartado. As propostas e os acordos registados permanecem inalterados.",
      ),
    );
    focusDraftRecord(bookingId, trigger);
  };
  const showSaved = (mode: DialogMode, bookingId: string) => {
    setActionDialog(null);
    setState((current) =>
      spaceOperatorInboxView(current, role).selectedId === bookingId
        ? current
        : revealSpaceOperatorBooking(current, role, bookingId),
    );
    setActionIssue(null);
    setFeedback(
      mode === "proposal"
        ? copy(
            "Proposal recorded in this tab. The customer must explicitly accept it before any agreed terms change.",
            "Proposta registada neste separador. O cliente tem de a aceitar explicitamente antes de alterar quaisquer condições acordadas.",
          )
        : copy(
            "Refusal recorded in this tab. The original request and history remain available.",
            "Recusa registada neste separador. O pedido original e o histórico continuam disponíveis.",
          ),
    );
    focusDraftRecord(bookingId, dialogTrigger.current);
  };
  if (!venues.length)
    return (
      <section className="card space-operator-empty">
        <CalendarDays size={28} aria-hidden="true" />
        <h2>{copy("Venue operator inbox", "Caixa do operador de espaços")}</h2>
        <p>
          {copy(
            "This workspace has no venue operator records. Use the space-operator workspace to review its own requests.",
            "Esta área de trabalho não tem registos de operador de espaços. Utilize a área de operador de espaços para analisar os respetivos pedidos.",
          )}
        </p>
        {onBrowseSpaces && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onBrowseSpaces}
          >
            {copy("Browse spaces", "Explorar espaços")}
          </button>
        )}
      </section>
    );
  return (
    <section className="space-operator-inbox" aria-labelledby={`${id}-title`}>
      <header className="space-operator-heading">
        <div>
          <span className="eyebrow">
            {venues.map((venue) => venue.name).join(" · ")}
          </span>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>
            {copy("Reservation request inbox", "Caixa de pedidos de reserva")}
          </h2>
          <p>
            {copy(
              "Review requests, propose complete terms and keep each decision in the record.",
              "Analise pedidos, proponha condições completas e guarde cada decisão no registo.",
            )}
          </p>
        </div>
        {onBrowseSpaces && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onBrowseSpaces}
          >
            {copy("Browse spaces", "Explorar espaços")}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </header>
      <p className="space-operator-notice">{localNotice(copy)}</p>
      <dl className="space-operator-metrics">
        <div>
          <dt>{copy("Awaiting operator", "Aguarda operador")}</dt>
          <dd>{counts.requested}</dd>
        </div>
        <div>
          <dt>{copy("Awaiting customer", "Aguarda cliente")}</dt>
          <dd>{counts.proposed}</dd>
        </div>
        <div>
          <dt>{copy("Current local agreements", "Acordos locais atuais")}</dt>
          <dd>{counts.agreed}</dd>
        </div>
        <div>
          <dt>{copy("Closed records", "Registos encerrados")}</dt>
          <dd>{counts.completed + counts.cancelled + counts.declined}</dd>
        </div>
      </dl>
      <SpaceOperatorSchedule role={role} state={state} setState={setState} />
      <div className="space-operator-toolbar">
        <label className="space-operator-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label={copy(
              "Search venue requests",
              "Pesquisar pedidos do espaço",
            )}
            placeholder={copy(
              "Customer, space or reference",
              "Cliente, espaço ou referência",
            )}
            value={query}
            maxLength={200}
            onChange={(event) => {
              const query = event.currentTarget.value;
              setState((current) =>
                updateSpaceOperatorInboxView(current, role, {
                  query,
                  selectedId: null,
                }),
              );
              setActionIssue(null);
            }}
          />
        </label>
        <select
          aria-label={copy("Filter requests", "Filtrar pedidos")}
          value={filter}
          onChange={(event) => {
            const filter = event.currentTarget.value as OperatorFilter;
            setState((current) =>
              updateSpaceOperatorInboxView(current, role, {
                filter,
                selectedId: null,
              }),
            );
            setActionIssue(null);
          }}
        >
          <option value="pending">
            {copy("Pending decisions", "Decisões pendentes")}
          </option>
          <option value="agreed">
            {copy("Current local agreements", "Acordos locais atuais")}
          </option>
          <option value="history">{copy("History", "Histórico")}</option>
          <option value="all">
            {copy("All records", "Todos os registos")}
          </option>
        </select>
      </div>
      <p className="space-operator-feedback" role="status">
        {feedback}
      </p>
      <div
        className={`space-operator-layout ${selected ? "has-selection" : ""}`}
      >
        <div
          className="space-operator-list"
          aria-label={copy("Reservation requests", "Pedidos de reserva")}
        >
          {visible.length ? (
            visible.map((record) => (
              <button
                type="button"
                key={record.id}
                className="space-operator-row"
                aria-pressed={selected?.id === record.id}
                onClick={(event) => {
                  lastRow.current = event.currentTarget;
                  setState((current) =>
                    updateSpaceOperatorInboxView(current, role, {
                      selectedId: record.id,
                    }),
                  );
                  setActionIssue(null);
                  setFeedback("");
                  if (selectedId === record.id)
                    requestAnimationFrame(() => detailHeading.current?.focus());
                }}
              >
                <span className="space-operator-row-top">
                  <span
                    className={`pill ${record.phase === "Agreed" ? "pill-mint" : "pill-neutral"}`}
                  >
                    {phaseText(record.phase, copy)}
                  </span>
                  {record.source === "sample" && (
                    <small>{copy("Sample", "Exemplo")}</small>
                  )}
                </span>
                <strong>{record.customerName}</strong>
                <span>{record.space}</span>
                <small>
                  {spaceBookingDate(
                    (record.agreedTerms ?? record.requestedTerms).date,
                    locale,
                  )}{" "}
                  · {(record.agreedTerms ?? record.requestedTerms).start}–
                  {(record.agreedTerms ?? record.requestedTerms).end}
                </small>
                <small>{record.id}</small>
              </button>
            ))
          ) : (
            <div className="card space-operator-empty">
              <CalendarDays size={28} aria-hidden="true" />
              <h3>
                {copy("No matching requests", "Nenhum pedido encontrado")}
              </h3>
              <p>
                {copy(
                  "Try another search or filter. This inbox only contains requests for your own venue.",
                  "Experimente outra pesquisa ou filtro. Esta caixa contém apenas pedidos do seu espaço.",
                )}
              </p>
            </div>
          )}
        </div>
        {selected ? (
          <article className="card space-operator-detail">
            <button
              type="button"
              className="space-operator-back"
              onClick={closeDetails}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {copy("Back to requests", "Voltar aos pedidos")}
            </button>
            <header>
              <div>
                <span className="eyebrow">{selected.id}</span>
                <h3
                  tabIndex={-1}
                  ref={detailHeading}
                  data-booking-id={selected.id}
                >
                  {selected.customerName}
                </h3>
                <p>
                  {selected.venue} · {selected.space}
                </p>
                {selected.source === "sample" && (
                  <small>{bookingCopy.system}</small>
                )}
              </div>
              <span className="pill pill-neutral">
                {phaseText(selected.phase, copy)}
              </span>
            </header>
            <dl className="space-operator-facts">
              <div>
                <dt>{copy("People", "Pessoas")}</dt>
                <dd>{selected.participants}</dd>
              </div>
              <div>
                <dt>{copy("Recorded", "Registado")}</dt>
                <dd>{spaceBookingDate(selected.createdAt, locale, true)}</dd>
              </div>
            </dl>
            {selected.notes && (
              <p className="space-operator-note">{selected.notes}</p>
            )}
            <BookingTerms
              title={copy("Original request", "Pedido original")}
              terms={selected.requestedTerms}
              copy={copy}
              locale={locale}
            />
            {selected.agreedTerms && (
              <BookingTerms
                title={copy("Current local agreement", "Acordo local atual")}
                terms={selected.agreedTerms}
                copy={copy}
                locale={locale}
              >
                <p className="space-operator-callout">
                  {copy(
                    "This records agreed terms in this tab; it is not confirmation of a real reservation or payment.",
                    "Este registo guarda condições acordadas neste separador; não confirma uma reserva real nem um pagamento.",
                  )}
                </p>
              </BookingTerms>
            )}
            {latestProposal && (
              <BookingTerms
                title={`${copy("Latest proposal", "Proposta mais recente")} · ${copy("version", "versão")} ${latestProposal.version}`}
                terms={latestProposal.proposedTerms}
                copy={copy}
                locale={locale}
              >
                <p className="space-operator-callout">
                  {proposalText(latestProposal.status, copy)}
                  {latestProposal.status === "pending" &&
                    ` · ${copy("The original request and any current agreement remain unchanged until the customer accepts.", "O pedido original e qualquer acordo atual mantêm-se até à aceitação do cliente.")}`}
                </p>
                {latestProposal.note && (
                  <p className="space-operator-note">{latestProposal.note}</p>
                )}
              </BookingTerms>
            )}
            {privateDraft && actionDialog?.bookingId !== selected.id && (
              <section
                className="space-operator-private-draft"
                aria-labelledby={`${id}-private-draft-title`}
              >
                <h4 id={`${id}-private-draft-title`}>
                  {copy(
                    "Private response draft",
                    "Rascunho privado da resposta",
                  )}
                </h4>
                <p>
                  {copy(
                    "Unfinished terms and notes stay private in your operator workspace in this tab. Reloading clears them.",
                    "As condições e notas por concluir permanecem privadas na sua área de operador neste separador. Recarregar a página apaga-as.",
                  )}
                </p>
                {!canPropose && (
                  <p>
                    {copy(
                      "This record is closed. You can inspect, copy or discard these values. They cannot change recorded proposals or agreements.",
                      "Este registo está fechado. Pode consultar, copiar ou descartar estes valores. Não podem alterar as propostas ou os acordos registados.",
                    )}
                  </p>
                )}
                <details>
                  <summary>
                    {copy("View unfinished values", "Ver valores por concluir")}
                  </summary>
                  <dl className="space-operator-facts">
                    {(
                      [
                        "date",
                        "start",
                        "end",
                        "price",
                        "cleaningFee",
                        "deposit",
                        "note",
                      ] as const
                    ).map((field) => (
                      <div
                        key={field}
                        className={
                          field === "note"
                            ? "space-operator-field-wide"
                            : undefined
                        }
                      >
                        <dt>{operatorDraftLabels(copy)[field]}</dt>
                        <dd dir="auto">
                          {privateDraft[field] === ""
                            ? copy("Not entered", "Por preencher")
                            : privateDraft[field]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <button
                  type="button"
                  className="text-button"
                  onClick={(event) => discardDraft(event.currentTarget)}
                >
                  {copy(
                    "Discard response draft",
                    "Descartar rascunho da resposta",
                  )}
                </button>
              </section>
            )}
            {acceptIssue && (
              <p className="space-operator-callout" id={`${id}-accept-issue`}>
                {issueText(acceptIssue, copy)}
              </p>
            )}
            {actionIssue && (
              <p className="space-operator-field-error" role="alert">
                {issueText(actionIssue, copy)}
              </p>
            )}
            {showCompletion && (
              <p
                className="space-operator-callout"
                id={`${id}-completion-scope`}
              >
                {bookingCopy.completionScope}
                {Number.isFinite(completionEndAt) && (
                  <>
                    {" "}
                    {bookingCopy.agreedEnd}:{" "}
                    <time dateTime={new Date(completionEndAt).toISOString()}>
                      {spaceBookingDate(
                        new Date(completionEndAt).toISOString(),
                        locale,
                        true,
                      )}
                    </time>{" "}
                    · {bookingCopy.deviceTime}.
                  </>
                )}
              </p>
            )}
            <div className="space-operator-actions">
              {showCompletion && (
                <button
                  type="button"
                  className="button"
                  disabled={Boolean(completionIssue)}
                  aria-describedby={`${id}-completion-scope`}
                  onClick={() => {
                    const now = new Date();
                    const action = { type: "complete" } as const;
                    const issue = spaceBookingActionIssue(
                      state,
                      role,
                      selected.id,
                      action,
                      now,
                    );
                    setActionIssue(issue);
                    setFeedback("");
                    if (issue) return;
                    const next = actOnSpaceBooking(
                      state,
                      role,
                      selected.id,
                      action,
                      now,
                    );
                    if (next === state) {
                      setActionIssue("status");
                      return;
                    }
                    setState(next);
                    setFeedback(bookingCopy.completionSaved);
                    requestAnimationFrame(() => {
                      const target = detailHeading.current;
                      if (target?.dataset.bookingId === selected.id)
                        target.focus();
                    });
                  }}
                >
                  {bookingCopy.markCompleted}
                </button>
              )}
              {selected.phase === "Requested" && (
                <button
                  type="button"
                  className="button"
                  disabled={Boolean(acceptIssue)}
                  aria-describedby={
                    acceptIssue ? `${id}-accept-issue` : undefined
                  }
                  onClick={() => {
                    const issue = spaceBookingActionIssue(
                      state,
                      role,
                      selected.id,
                      { type: "accept-request" },
                    );
                    setActionIssue(issue);
                    if (issue) return;
                    setState((current) =>
                      actOnSpaceBooking(current, role, selected.id, {
                        type: "accept-request",
                      }),
                    );
                    setFeedback(
                      copy(
                        "The original request was agreed locally. No reservation or payment has been confirmed outside this tab.",
                        "O pedido original foi acordado localmente. Nenhuma reserva ou pagamento foi confirmado fora deste separador.",
                      ),
                    );
                    requestAnimationFrame(() => detailHeading.current?.focus());
                  }}
                >
                  {copy("Agree to original request", "Aceitar pedido original")}
                </button>
              )}
              {canPropose && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={(event) => {
                    setActionIssue(null);
                    dialogTrigger.current = event.currentTarget;
                    setActionDialog({
                      bookingId: selected.id,
                      mode: "proposal",
                    });
                  }}
                >
                  {privateDraft
                    ? copy(
                        "Resume proposal draft",
                        "Retomar rascunho da proposta",
                      )
                    : latestProposal?.status === "pending"
                      ? copy("Revise proposal", "Rever proposta")
                      : copy("Propose terms", "Propor condições")}
                </button>
              )}
              {!declineIssue && (
                <button
                  type="button"
                  className="text-button"
                  onClick={(event) => {
                    setActionIssue(null);
                    dialogTrigger.current = event.currentTarget;
                    setActionDialog({
                      bookingId: selected.id,
                      mode: "decline",
                    });
                  }}
                >
                  {copy("Decline request", "Recusar pedido")}
                </button>
              )}
            </div>
            {selected.proposals.length > 1 && (
              <details className="space-operator-history">
                <summary>
                  {copy("Previous proposals", "Propostas anteriores")} (
                  {selected.proposals.length - 1})
                </summary>
                {selected.proposals
                  .slice(0, -1)
                  .reverse()
                  .map((proposal) => (
                    <BookingTerms
                      key={proposal.id}
                      title={`${copy("Proposal version", "Versão da proposta")} ${proposal.version}`}
                      terms={proposal.proposedTerms}
                      copy={copy}
                      locale={locale}
                    >
                      <p className="space-operator-callout">
                        {proposalText(proposal.status, copy)}
                      </p>
                      {proposal.note && (
                        <p className="space-operator-note">{proposal.note}</p>
                      )}
                    </BookingTerms>
                  ))}
              </details>
            )}
            <section className="space-operator-history">
              <h4>{copy("Record history", "Histórico do registo")}</h4>
              <ol>
                {[...selected.history].reverse().map((entry) => (
                  <li key={entry.id}>
                    <strong>{historyText(entry.action, copy)}</strong>
                    {entry.source === "sample" && (
                      <small>{bookingCopy.system}</small>
                    )}
                    <span>
                      {entry.actor} · {spaceBookingDate(entry.at, locale, true)}
                    </span>
                    {entry.proposalId && (
                      <small>
                        {copy("Proposal", "Proposta")}{" "}
                        {
                          selected.proposals.find(
                            (proposal) => proposal.id === entry.proposalId,
                          )?.version
                        }
                      </small>
                    )}
                    {entry.note && <p>{entry.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          </article>
        ) : (
          <div className="card space-operator-empty">
            <CalendarDays size={30} aria-hidden="true" />
            <h3>{copy("Choose a request", "Escolha um pedido")}</h3>
            <p>
              {copy(
                "Review the original time and price before agreeing or proposing a change.",
                "Reveja o horário e o preço originais antes de aceitar ou propor uma alteração.",
              )}
            </p>
          </div>
        )}
      </div>
      {actionDialog && dialogRecord && dialogAvailable ? (
        <OperatorActionDialog
          key={`${role}-${actionDialog.bookingId}-${actionDialog.mode}`}
          role={role}
          state={state}
          setState={setState}
          record={dialogRecord}
          mode={actionDialog.mode}
          onClose={() => setActionDialog(null)}
          onSaved={(mode) => showSaved(mode, actionDialog.bookingId)}
        />
      ) : actionDialog ? (
        <UnavailableOperatorAction
          copy={copy}
          onClose={() => setActionDialog(null)}
        />
      ) : null}
    </section>
  );
}

export function SpaceOperatorInbox(props: SpaceOperatorInboxProps) {
  return <OperatorInbox key={props.role} {...props} />;
}
