import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";
import type { Role } from "../types";
import {
  bookingTermsTotalCents,
  createSpaceBookingRequest,
  isSpaceBookingCustomer,
  spaceBookingDateValue,
  spaceBookingDraft,
  spaceBookingDrafts,
  spaceBookingRequestTerms,
  spaceBookingUnit,
  spaceBookingVenue,
  updateSpaceBookingDraft,
  type SpaceBookingsState,
} from "./spaceBookingsState";
import {
  spaceBookingMoney,
  spaceBookingIssueText,
  useSpaceBookingCopy,
} from "./spaceBookingCopy";
import { useDialogFocus } from "./useDialogFocus";
import "./spaceBookingRequest.css";

interface SpaceBookingRequestProps {
  role: Role;
  state: SpaceBookingsState;
  setState: Dispatch<SetStateAction<SpaceBookingsState>>;
  venueId: number;
  spaceId: number;
  initialDate?: string;
  initialStart?: string;
  initialEnd?: string;
  onClose: () => void;
  onSaved: (bookingId: string) => void;
}

type Draft = ReturnType<typeof spaceBookingDraft>;
type Field = keyof Draft;

function readDraft(form: HTMLFormElement): Draft {
  const data = new FormData(form);
  return {
    date: String(data.get("date") ?? ""),
    start: String(data.get("start") ?? ""),
    end: String(data.get("end") ?? ""),
    participants: String(data.get("participants") ?? ""),
    notes: String(data.get("notes") ?? ""),
  };
}

function SpaceBookingRequestForm({
  role,
  state,
  setState,
  venueId,
  spaceId,
  initialDate,
  initialStart,
  initialEnd,
  onClose,
  onSaved,
}: SpaceBookingRequestProps) {
  const { copy, locale } = useSpaceBookingCopy();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const venue = spaceBookingVenue(venueId);
  const space = spaceBookingUnit(venueId, spaceId);
  const allowed = isSpaceBookingCustomer(role);
  const [draft, setDraft] = useState<Draft>(() => {
    const retained = spaceBookingDrafts(state, role).some(
      (item) => item.venueId === venueId && item.spaceId === spaceId,
    );
    const base = spaceBookingDraft(state, role, venueId, spaceId);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return retained
      ? base
      : {
          ...base,
          date: initialDate ?? spaceBookingDateValue(tomorrow),
          start: initialStart ?? "10:00",
          end: initialEnd ?? "11:00",
          participants: "1",
        };
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [issue, setIssue] = useState<string>();

  function retain(next: Draft) {
    setDraft(next);
    setState((current) =>
      updateSpaceBookingDraft(current, role, venueId, spaceId, next),
    );
  }

  function close() {
    if (formRef.current && allowed && venue && space && !saving.current)
      retain(readDraft(formRef.current));
    onClose();
  }

  const dialogRef = useDialogFocus<HTMLDivElement>(close);
  function update(field: Field, value: string, form: HTMLFormElement | null) {
    // Read all current DOM fields so date-picker/autofill changes cannot be lost on rerender.
    const next = form ? readDraft(form) : draft;
    retain({ ...next, [field]: value });
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIssue(undefined);
  }

  const fieldProps = (field: Field) => ({
    id: `${id}-${field}`,
    name: field,
    value: draft[field],
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
    onInput: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(field, event.currentTarget.value, event.currentTarget.form),
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => update(field, event.currentTarget.value, event.currentTarget.form),
  });
  const fieldError = (field: Field) =>
    errors[field] && (
      <span className="space-request-error" id={`${id}-${field}-error`}>
        {spaceBookingIssueText(errors[field]!, copy)}
      </span>
    );
  const labels: Record<Field, string> = {
    date: copy.date,
    start: copy.start,
    end: copy.end,
    participants: copy.guests,
    notes: copy.notes,
  };

  const preview =
    venue && space ? spaceBookingRequestTerms(venueId, spaceId, draft) : null;

  return createPortal(
    <div
      className="modal-layer space-request-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-scope`}
      ref={dialogRef}
      tabIndex={-1}
    >
      <button
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={close}
      />
      <section className="modal-card space-request-card">
        <header>
          <div>
            <span className="eyebrow">KASA SPACES</span>
            <h2 id={`${id}-title`}>{copy.newRequest}</h2>
          </div>
          <button
            className="icon-button"
            aria-label={copy.close}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {!allowed || !venue || !space ? (
          <div className="modal-body">
            <p id={`${id}-scope`}>
              {!allowed ? copy.roleUnavailable : copy.unavailable}
            </p>
            <button className="button" onClick={close}>
              {copy.close}
            </button>
          </div>
        ) : (
          <form
            ref={formRef}
            className="modal-body space-request-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (saving.current) return;
              const submitted = readDraft(event.currentTarget);
              setDraft(submitted);
              const prepared = updateSpaceBookingDraft(
                state,
                role,
                venueId,
                spaceId,
                submitted,
              );
              const result = createSpaceBookingRequest(
                prepared,
                role,
                venueId,
                spaceId,
              );
              setState(result.state);
              setErrors(result.errors);
              setIssue(result.issue);
              if (result.bookingId) {
                saving.current = true;
                onSaved(result.bookingId);
              } else {
                requestAnimationFrame(() => errorRef.current?.focus());
              }
            }}
          >
            <div className="space-request-venue">
              <strong>{venue.name}</strong>
              <span>
                {space.name} · {copy.capacity}: {space.capacity} {copy.people}
              </span>
              <span>
                {copy.openingHours}: {venue.openingHours}
              </span>
            </div>
            <p className="space-request-notice" id={`${id}-scope`}>
              {copy.scope}
            </p>
            {(issue || Object.values(errors).some(Boolean)) && (
              <div
                className="space-request-errors space-request-error"
                role="alert"
                tabIndex={-1}
                ref={errorRef}
              >
                <strong>{copy.invalidForm}</strong>
                {issue && <p>{spaceBookingIssueText(issue, copy)}</p>}
                <ul>
                  {Object.entries(errors)
                    .filter(([, value]) => value)
                    .map(([field, value]) => (
                      <li key={field}>
                        <a
                          href={`#${id}-${field}`}
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById(`${id}-${field}`)?.focus();
                          }}
                        >
                          {labels[field as Field]}:{" "}
                          {spaceBookingIssueText(value!, copy)}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <div className="space-request-fields">
              <label htmlFor={`${id}-date`}>
                {copy.date}
                <input
                  {...fieldProps("date")}
                  type="date"
                  min={spaceBookingDateValue()}
                  required
                  data-dialog-initial-focus
                />
                {fieldError("date")}
              </label>
              <label htmlFor={`${id}-participants`}>
                {copy.guests}
                <input
                  {...fieldProps("participants")}
                  type="number"
                  min={1}
                  max={space.capacity}
                  step={1}
                  required
                />
                {fieldError("participants")}
              </label>
              <label htmlFor={`${id}-start`}>
                {copy.start}
                <input {...fieldProps("start")} type="time" required />
                {fieldError("start")}
              </label>
              <label htmlFor={`${id}-end`}>
                {copy.end}
                <input {...fieldProps("end")} type="time" required />
                {fieldError("end")}
              </label>
              <label className="space-request-wide" htmlFor={`${id}-notes`}>
                {copy.notes}
                <textarea {...fieldProps("notes")} rows={3} maxLength={3000} />
                {fieldError("notes")}
              </label>
            </div>
            <div className="space-request-price">
              <strong>{copy.estimate}</strong>
              {preview && (
                <dl>
                  <div>
                    <dt>{copy.price}</dt>
                    <dd>
                      {spaceBookingMoney(preview.priceCents, locale, copy)}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.cleaningFee}</dt>
                    <dd>
                      {spaceBookingMoney(
                        preview.cleaningFeeCents,
                        locale,
                        copy,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.deposit}</dt>
                    <dd>
                      {spaceBookingMoney(preview.depositCents, locale, copy)}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.totalWithDeposit}</dt>
                    <dd>
                      {spaceBookingMoney(
                        bookingTermsTotalCents(preview),
                        locale,
                        copy,
                      )}
                    </dd>
                  </div>
                </dl>
              )}
              <p className="space-request-notice">{copy.priceNote}</p>
            </div>
            <p className="space-request-notice">{copy.draftNotice}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={close}
              >
                {copy.close}
              </button>
              <button type="submit" className="button">
                <CalendarDays size={16} />
                {copy.save}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}

export function SpaceBookingRequest(props: SpaceBookingRequestProps) {
  return (
    <SpaceBookingRequestForm
      key={`${props.role}-${props.venueId}-${props.spaceId}`}
      {...props}
    />
  );
}
