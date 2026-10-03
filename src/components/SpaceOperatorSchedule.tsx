import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { CalendarDays, Clock3, Plus, Trash2, Undo2 } from "lucide-react";
import type { Role } from "../types";
import { spaceBookingDate, useSpaceBookingCopy } from "./spaceBookingCopy";
import {
  createSpaceTimeBlock,
  discardSpaceTimeBlockDraft,
  operatorSpaceVenues,
  removedSpaceTimeBlock,
  removeSpaceTimeBlock,
  restoreSpaceTimeBlock,
  spaceBookingDateValue,
  spaceBookingUnit,
  spaceScheduleEntries,
  spaceScheduleView,
  spaceTimeBlockDraft,
  updateSpaceScheduleView,
  updateSpaceTimeBlockDraft,
  type SpaceBookingsState,
  type SpaceTimeBlockDraft,
} from "./spaceBookingsState";
import "./spaceOperatorSchedule.css";

interface SpaceOperatorScheduleProps {
  role: Role;
  state: SpaceBookingsState;
  setState: Dispatch<SetStateAction<SpaceBookingsState>>;
}

type Copy = (en: string, pt: string) => string;
type BlockErrors = ReturnType<typeof createSpaceTimeBlock>["errors"];

function issueText(issue: string | undefined, copy: Copy): string {
  const messages: Record<string, string> = {
    unavailable: copy(
      "This space or record is not available in this operator workspace.",
      "Este espaço ou registo não está disponível nesta área de operador.",
    ),
    date: copy(
      "Choose a valid date that is today or later.",
      "Escolha uma data válida, de hoje ou futura.",
    ),
    start: copy(
      "Choose a valid start time in the future.",
      "Escolha uma hora de início válida e futura.",
    ),
    end: copy("Choose a valid end time.", "Escolha uma hora de fim válida."),
    range: copy(
      "The end must be after the start, on the same day.",
      "O fim tem de ser posterior ao início, no mesmo dia.",
    ),
    openingHours: copy(
      "Choose a time within the venue’s published opening hours.",
      "Escolha um horário dentro do período de funcionamento publicado do local.",
    ),
    note: copy(
      "Keep the private reason within 500 characters.",
      "Escreva o motivo privado com até 500 caracteres.",
    ),
    blockConflict: copy(
      "An active local block already overlaps this time. Choose another range or remove that block first.",
      "Já existe um bloqueio local ativo que se sobrepõe a este horário. Escolha outro período ou remova primeiro esse bloqueio.",
    ),
    bookingConflict: copy(
      "An agreed reservation overlaps this time. Its existing agreement must remain unchanged.",
      "Existe uma reserva acordada que se sobrepõe a este horário. O acordo existente tem de se manter.",
    ),
    status: copy(
      "This block has changed or is no longer available for this action. Review the current schedule.",
      "Este bloqueio foi alterado ou já não permite esta ação. Reveja o horário atual.",
    ),
  };
  return issue
    ? (messages[issue] ??
        copy(
          "This change could not be saved. Review the current schedule and try again.",
          "Não foi possível guardar esta alteração. Reveja o horário atual e tente novamente.",
        ))
    : "";
}

function readDraft(form: HTMLFormElement): SpaceTimeBlockDraft {
  const data = new FormData(form);
  return {
    date: String(data.get("date") ?? ""),
    start: String(data.get("start") ?? ""),
    end: String(data.get("end") ?? ""),
    note: String(data.get("note") ?? ""),
  };
}

function SchedulePanel({ role, state, setState }: SpaceOperatorScheduleProps) {
  const { copy: sharedCopy, locale } = useSpaceBookingCopy();
  const copy: Copy = (en, pt) => (locale.startsWith("pt") ? pt : en);
  const id = useId();
  const summary = useRef<HTMLDivElement>(null);
  const unitSelect = useRef<HTMLSelectElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [errors, setErrors] = useState<BlockErrors>({});
  const [issue, setIssue] = useState<string | undefined>();
  const [feedback, setFeedback] = useState("");
  const [failedSubmit, setFailedSubmit] = useState(0);
  useEffect(() => {
    if (failedSubmit) summary.current?.focus();
  }, [failedSubmit]);
  const venues = operatorSpaceVenues(role);
  const view = spaceScheduleView(state, role);
  const venue = venues.find((item) => item.id === view.venueId);
  const unit = venue?.spaces.find((item) => item.id === view.spaceId);
  const draft =
    venue && unit ? spaceTimeBlockDraft(state, role, venue.id, unit.id) : null;
  const removed = removedSpaceTimeBlock(state, role);
  if (role !== "spaceOperator" || !venue || !unit || !draft) return null;
  const entries = spaceScheduleEntries(
    state,
    role,
    venue.id,
    unit.id,
    view.date,
  );
  const blockCount = entries.filter((entry) => entry.kind === "block").length;
  const bookingCount = entries.filter(
    (entry) => entry.kind === "booking",
  ).length;
  const formatDate = (date: string) => spaceBookingDate(date, locale);
  const labels: Record<keyof SpaceTimeBlockDraft, string> = {
    date: copy("Block date", "Data do bloqueio"),
    start: sharedCopy.start,
    end: sharedCopy.end,
    note: copy("Private reason (optional)", "Motivo privado (opcional)"),
  };
  const clearFeedback = () => {
    setErrors({});
    setIssue(undefined);
    setFeedback("");
  };
  const change = (field: keyof SpaceTimeBlockDraft, value: string) => {
    setState((current) =>
      updateSpaceTimeBlockDraft(current, role, venue.id, unit.id, {
        [field]: value,
      }),
    );
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIssue(undefined);
    setFeedback("");
  };
  const report = (nextErrors: BlockErrors, nextIssue?: string) => {
    setErrors(nextErrors);
    setIssue(nextIssue);
    setFeedback("");
    setFailedSubmit((count) => count + 1);
  };
  const errorEntries = (
    Object.entries(errors) as [keyof SpaceTimeBlockDraft, string | undefined][]
  ).filter((entry) => entry[1]);
  const save = (form: HTMLFormElement) => {
    const values = readDraft(form);
    const updated = updateSpaceTimeBlockDraft(
      state,
      role,
      venue.id,
      unit.id,
      values,
    );
    const result = createSpaceTimeBlock(updated, role, venue.id, unit.id);
    setState(result.state);
    if (!result.blockId) {
      report(result.errors, result.issue);
      return;
    }
    setErrors({});
    setIssue(undefined);
    setFeedback(
      copy(
        `Unavailable time recorded for ${unit.name}, ${formatDate(values.date)}, ${values.start}–${values.end}.`,
        `Período indisponível registado para ${unit.name}, ${formatDate(values.date)}, ${values.start}–${values.end}.`,
      ),
    );
  };
  return (
    <section
      className="space-operator-schedule card"
      aria-labelledby={`${id}-title`}
    >
      <header className="space-schedule-heading">
        <div>
          <span className="eyebrow">
            {copy("OPERATOR SCHEDULE", "HORÁRIO DO OPERADOR")}
          </span>
          <h3 id={`${id}-title`} ref={heading} tabIndex={-1}>
            {copy(
              "Unavailable times and agreements",
              "Indisponibilidades e acordos",
            )}
          </h3>
          <p>
            {copy(
              "Record unavailable time in this tab. Existing agreements stay in place; this does not update an external calendar.",
              "Registe períodos indisponíveis neste separador. Os acordos existentes mantêm-se; o calendário externo não é alterado.",
            )}
          </p>
        </div>
        <CalendarDays size={27} aria-hidden="true" />
      </header>
      <div className="space-schedule-selection">
        <label htmlFor={`${id}-unit`}>
          {copy("Space", "Espaço")}
          <select
            id={`${id}-unit`}
            ref={unitSelect}
            value={`${venue.id}:${unit.id}`}
            onChange={(event) => {
              const value = event.currentTarget.value;
              const selected = venues
                .flatMap((item) =>
                  item.spaces.map((space) => ({
                    venueId: item.id,
                    spaceId: space.id,
                  })),
                )
                .find((item) => `${item.venueId}:${item.spaceId}` === value);
              if (selected)
                setState((current) =>
                  updateSpaceScheduleView(current, role, selected),
                );
              clearFeedback();
            }}
          >
            {venues.flatMap((item) =>
              item.spaces.map((space) => (
                <option
                  key={`${item.id}:${space.id}`}
                  value={`${item.id}:${space.id}`}
                >
                  {item.name} · {space.name}
                </option>
              )),
            )}
          </select>
        </label>
        <label htmlFor={`${id}-view-date`}>
          {copy("Schedule date", "Data a consultar")}
          <input
            id={`${id}-view-date`}
            type="date"
            value={view.date}
            onInput={(event) => {
              const date = event.currentTarget.value;
              setState((current) =>
                updateSpaceScheduleView(current, role, { date }),
              );
            }}
            onChange={(event) => {
              const date = event.currentTarget.value;
              setState((current) =>
                updateSpaceScheduleView(current, role, { date }),
              );
            }}
          />
        </label>
      </div>
      <div className="space-schedule-layout">
        <section
          className="space-schedule-day"
          aria-labelledby={`${id}-day-title`}
        >
          <h4 id={`${id}-day-title`}>
            {unit.name} ·{" "}
            <time dateTime={view.date}>{formatDate(view.date)}</time>
          </h4>
          <p className="space-schedule-summary">
            {bookingCount}{" "}
            {bookingCount === 1
              ? copy("agreement", "acordo")
              : copy("agreements", "acordos")}{" "}
            · {blockCount}{" "}
            {blockCount === 1
              ? copy("active block", "bloqueio ativo")
              : copy("active blocks", "bloqueios ativos")}
          </p>
          {entries.length ? (
            <ol className="space-schedule-entries">
              {entries.map((entry) => {
                const terms =
                  entry.kind === "block" ? entry.block : entry.terms;
                return (
                  <li
                    key={`${entry.kind}:${entry.kind === "block" ? entry.block.id : entry.booking.id}`}
                    className={`space-schedule-entry ${entry.kind}`}
                  >
                    <div className="space-schedule-time">
                      <Clock3 size={15} aria-hidden="true" />
                      <strong>
                        <time dateTime={`${terms.date}T${terms.start}`}>
                          {terms.start}
                        </time>
                        –
                        <time dateTime={`${terms.date}T${terms.end}`}>
                          {terms.end}
                        </time>
                      </strong>
                    </div>
                    <span className="space-schedule-badge">
                      {entry.kind === "block"
                        ? copy("Unavailable locally", "Indisponível localmente")
                        : copy("Agreed locally", "Acordado localmente")}
                    </span>
                    {entry.kind === "block" ? (
                      <>
                        {entry.block.note && (
                          <p className="space-schedule-private">
                            <strong>
                              {copy("Private reason:", "Motivo privado:")}
                            </strong>{" "}
                            {entry.block.note}
                          </p>
                        )}
                        <button
                          type="button"
                          className="text-button space-schedule-remove"
                          aria-label={`${copy("Remove block", "Remover bloqueio")} ${formatDate(terms.date)} ${terms.start}–${terms.end}`}
                          onClick={() => {
                            const result = removeSpaceTimeBlock(
                              state,
                              role,
                              entry.block.id,
                            );
                            if (result.issue) {
                              report({}, result.issue);
                              return;
                            }
                            unitSelect.current?.focus({ preventScroll: true });
                            setState(result.state);
                            setErrors({});
                            setIssue(undefined);
                            setFeedback(
                              copy(
                                "Block removed. Undo checks the current schedule before restoring it.",
                                "Bloqueio removido. A recuperação verifica o horário atual antes de o repor.",
                              ),
                            );
                          }}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          {copy("Remove block", "Remover bloqueio")}
                        </button>
                      </>
                    ) : (
                      <>
                        <p>
                          {entry.booking.customerName} · {entry.booking.code}
                        </p>
                        {entry.booking.phase === "Proposed" && (
                          <small>
                            {copy(
                              "A change is awaiting the customer’s decision; this agreement stays in place.",
                              "Uma alteração aguarda a decisão do cliente; este acordo mantém-se.",
                            )}
                          </small>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="space-schedule-empty">
              <CalendarDays size={23} aria-hidden="true" />
              <p>
                {copy(
                  "No agreed reservations or active local blocks for this date. This does not confirm external availability.",
                  "Sem reservas acordadas ou bloqueios locais ativos nesta data. Isto não confirma disponibilidade externa.",
                )}
              </p>
            </div>
          )}
          <p className="space-schedule-muted">
            {copy(
              "Times use this device’s local time.",
              "Os horários usam a hora local deste dispositivo.",
            )}
          </p>
        </section>
        <form
          className="space-schedule-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save(event.currentTarget);
          }}
          aria-labelledby={`${id}-form-title`}
        >
          <h4 id={`${id}-form-title`}>
            {copy("Add unavailable time", "Adicionar indisponibilidade")}
          </h4>
          <p className="space-schedule-muted">
            {sharedCopy.openingHours}: {venue.openingHours}
          </p>
          {(issue || errorEntries.length > 0) && (
            <div
              className="space-schedule-errors"
              role="alert"
              tabIndex={-1}
              ref={summary}
            >
              <strong>
                {copy("Review this change", "Reveja esta alteração")}
              </strong>
              {issue && <p>{issueText(issue, copy)}</p>}
              {errorEntries.length > 0 && (
                <ul>
                  {errorEntries.map(([field, error]) => (
                    <li key={field}>
                      {labels[field]}: {issueText(error, copy)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="space-schedule-fields">
            {(["date", "start", "end"] as const).map((field) => (
              <label
                key={field}
                htmlFor={`${id}-${field}`}
                className={field === "date" ? "space-schedule-full" : ""}
              >
                {labels[field]}
                <input
                  id={`${id}-${field}`}
                  name={field}
                  type={field === "date" ? "date" : "time"}
                  min={field === "date" ? spaceBookingDateValue() : undefined}
                  step={field === "date" ? undefined : 60}
                  value={draft[field]}
                  aria-label={labels[field]}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={
                    errors[field] ? `${id}-${field}-error` : undefined
                  }
                  onInput={(event) => change(field, event.currentTarget.value)}
                  onChange={(event) => change(field, event.currentTarget.value)}
                />
                {errors[field] && (
                  <span
                    id={`${id}-${field}-error`}
                    className="space-schedule-field-error"
                  >
                    {issueText(errors[field], copy)}
                  </span>
                )}
              </label>
            ))}
            {draft.date !== view.date && (
              <div className="space-schedule-date-hint space-schedule-full">
                <span>
                  {copy(
                    "The draft is for a different date from the schedule shown.",
                    "O rascunho é para uma data diferente da que está a consultar.",
                  )}
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => change("date", view.date)}
                >
                  {copy("Use schedule date", "Usar a data consultada")} ·{" "}
                  {formatDate(view.date)}
                </button>
              </div>
            )}
            <label className="space-schedule-full" htmlFor={`${id}-note`}>
              {labels.note}
              <textarea
                id={`${id}-note`}
                name="note"
                rows={3}
                maxLength={500}
                value={draft.note}
                aria-label={labels.note}
                aria-invalid={Boolean(errors.note)}
                aria-describedby={
                  errors.note ? `${id}-note-error` : `${id}-note-hint`
                }
                onInput={(event) => change("note", event.currentTarget.value)}
                onChange={(event) => change("note", event.currentTarget.value)}
              />
              {errors.note ? (
                <span
                  id={`${id}-note-error`}
                  className="space-schedule-field-error"
                >
                  {issueText(errors.note, copy)}
                </span>
              ) : (
                <small id={`${id}-note-hint`} className="space-schedule-muted">
                  {copy(
                    "Only shown in this operator workspace.",
                    "Visível apenas nesta área de operador.",
                  )}
                </small>
              )}
            </label>
          </div>
          <div className="space-schedule-form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setState((current) =>
                  discardSpaceTimeBlockDraft(current, role, venue.id, unit.id),
                );
                clearFeedback();
              }}
            >
              {copy("Clear draft", "Limpar rascunho")}
            </button>
            <button type="submit" className="button">
              <Plus size={16} aria-hidden="true" />
              {copy("Add local block", "Adicionar bloqueio local")}
            </button>
          </div>
        </form>
      </div>
      <p className="space-schedule-feedback" role="status">
        {feedback}
      </p>
      {removed && (
        <div className="space-schedule-undo">
          <div>
            <strong>{copy("Removed block", "Bloqueio removido")}</strong>
            <span>
              {spaceBookingUnit(removed.venueId, removed.spaceId)?.name} ·{" "}
              {formatDate(removed.date)} · {removed.start}–{removed.end}
            </span>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              const result = restoreSpaceTimeBlock(state, role, removed.id);
              if (result.issue) {
                report({}, result.issue);
                return;
              }
              heading.current?.focus({ preventScroll: true });
              setState(result.state);
              setErrors({});
              setIssue(undefined);
              setFeedback(
                copy(
                  "Block restored after checking the current schedule.",
                  "Bloqueio reposto após verificar o horário atual.",
                ),
              );
            }}
          >
            <Undo2 size={16} aria-hidden="true" />
            {copy("Undo removal", "Anular remoção")}
          </button>
        </div>
      )}
    </section>
  );
}

export function SpaceOperatorSchedule(props: SpaceOperatorScheduleProps) {
  return <SchedulePanel key={props.role} {...props} />;
}
