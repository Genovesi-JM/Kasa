import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronRight, Plus, ShieldCheck, X } from "lucide-react";
import type { Role } from "../types";
import { useDialogFocus } from "./useDialogFocus";
import { SpaceBookingRequest } from "./SpaceBookingRequest";
import {
  actOnSpaceBooking,
  bookingTermsTotalCents,
  discardSpaceBookingDraft,
  filterSpaceBookings,
  isSpaceBookingCustomer,
  scopedSpaceBookings,
  selectedSpaceBooking,
  selectSpaceBooking,
  spaceBookingActionIssue,
  spaceBookingDrafts,
  spaceBookingUnit,
  spaceBookingVenue,
  spaceBookingView,
  visibleSpaceBookings,
  type ManagedSpaceBooking,
  type SpaceBookingAction,
  type SpaceBookingFilter,
  type SpaceBookingsState,
} from "./spaceBookingsState";
import {
  spaceBookingDate,
  spaceBookingHistoryText,
  spaceBookingIssueText,
  spaceBookingMoney,
  spaceBookingStatusText,
  useSpaceBookingCopy,
  type SpaceBookingCopy,
} from "./spaceBookingCopy";
import "./spaceBookings.css";

const filters: SpaceBookingFilter[] = [
  "All",
  "Requested",
  "Upcoming",
  "Declined",
  "Cancelled",
  "Completed",
];

function BookingStatus({
  booking,
  copy,
}: {
  booking: ManagedSpaceBooking;
  copy: SpaceBookingCopy;
}) {
  const tone =
    booking.phase === "Agreed"
      ? "mint"
      : ["Requested", "Proposed"].includes(booking.phase)
        ? "amber"
        : "neutral";
  return (
    <span className={`pill pill-${tone}`}>
      {spaceBookingStatusText(booking.phase, copy)}
    </span>
  );
}

function BookingTerms({
  terms,
  locale,
  copy,
}: {
  terms: ManagedSpaceBooking["requestedTerms"];
  locale: string;
  copy: SpaceBookingCopy;
}) {
  const total = bookingTermsTotalCents(terms);
  return (
    <dl className="space-booking-terms">
      <div>
        <dt>{copy.date}</dt>
        <dd>
          <time dateTime={terms.date}>
            {spaceBookingDate(terms.date, locale)}
          </time>
        </dd>
      </div>
      <div>
        <dt>{copy.time}</dt>
        <dd>
          {terms.start}–{terms.end}
        </dd>
      </div>
      <div>
        <dt>{copy.price}</dt>
        <dd>{spaceBookingMoney(terms.priceCents, locale, copy)}</dd>
      </div>
      <div>
        <dt>{copy.cleaningFee}</dt>
        <dd>{spaceBookingMoney(terms.cleaningFeeCents, locale, copy)}</dd>
      </div>
      <div>
        <dt>{copy.total}</dt>
        <dd>
          {spaceBookingMoney(
            total === null ? null : total - terms.depositCents,
            locale,
            copy,
          )}
        </dd>
      </div>
      <div>
        <dt>{copy.deposit}</dt>
        <dd>{spaceBookingMoney(terms.depositCents, locale, copy)}</dd>
      </div>
    </dl>
  );
}

function CancelBookingDialog({
  booking,
  onClose,
  onConfirm,
}: {
  booking: ManagedSpaceBooking;
  onClose: () => void;
  onConfirm: (reason: string) => string | undefined;
}) {
  const { copy, locale } = useSpaceBookingCopy();
  const id = useId();
  const [error, setError] = useState("");
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const terms = booking.agreedTerms ?? booking.requestedTerms;
  return createPortal(
    <div
      className="modal-layer"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-scope`}
      tabIndex={-1}
    >
      <button
        className="modal-scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <section className="modal-card">
        <header>
          <div>
            <span className="eyebrow">KASA SPACES</span>
            <h2 id={`${id}-title`}>{copy.cancelTitle}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={copy.close}
          >
            <X size={20} />
          </button>
        </header>
        <form
          className="modal-body space-booking-cancel-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const reason = String(
              new FormData(event.currentTarget).get("reason") ?? "",
            );
            setError(onConfirm(reason) ?? "");
          }}
        >
          <p>
            <strong>{booking.venue}</strong>
            <br />
            {booking.space} · {spaceBookingDate(terms.date, locale)} ·{" "}
            {terms.start}–{terms.end}
          </p>
          <p id={`${id}-scope`}>{copy.scope}</p>
          <label className="booking-cancel-reason" htmlFor={`${id}-reason`}>
            {copy.cancelReason}
            <textarea
              id={`${id}-reason`}
              name="reason"
              maxLength={500}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </label>
          {error && (
            <p className="space-booking-error" id={`${id}-error`} role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button button-secondary"
              type="button"
              data-dialog-initial-focus
              onClick={onClose}
            >
              {copy.keep}
            </button>
            <button className="button" type="submit">
              {copy.confirmCancel}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

export function SpaceBookingsView({
  role,
  state,
  setState,
  onBrowseSpaces,
}: {
  role: Role;
  state: SpaceBookingsState;
  setState: Dispatch<SetStateAction<SpaceBookingsState>>;
  onBrowseSpaces?: () => void;
}) {
  const { copy, locale } = useSpaceBookingCopy();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState<{
    venueId: number;
    spaceId: number;
  } | null>(null);
  const [status, setStatus] = useState<keyof SpaceBookingCopy | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const draftsHeading = useRef<HTMLHeadingElement>(null);
  const all = scopedSpaceBookings(state, role);
  const visible = visibleSpaceBookings(state, role);
  const selected = selectedSpaceBooking(state, role);
  const view = spaceBookingView(state, role);
  const selectedId = view.selectedId;
  const drafts = spaceBookingDrafts(state, role);
  const cancelling = all.find((booking) => booking.id === cancellingId);
  const allowed = isSpaceBookingCustomer(role);

  useEffect(() => {
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => {
      const target = heading.current;
      if (target?.dataset.bookingId === selectedId) target.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [role, selectedId]);

  function focusDetails() {
    requestAnimationFrame(() => heading.current?.focus());
  }
  function act(
    id: string,
    action: SpaceBookingAction,
    success: keyof SpaceBookingCopy,
  ) {
    const issue = spaceBookingActionIssue(state, role, id, action);
    if (issue) {
      setActionError(issue);
      return issue;
    }
    const next = actOnSpaceBooking(state, role, id, action);
    if (next === state) {
      setActionError("status");
      return "status";
    }
    setState(next);
    setActionError(null);
    setStatus(success);
    if (spaceBookingView(next, role).selectedId === selectedId) focusDetails();
    return undefined;
  }

  if (!allowed)
    return (
      <div className="empty-state">
        <CalendarDays size={28} />
        <h2>{copy.noAccess}</h2>
      </div>
    );

  return (
    <div className="page-stack space-bookings-page">
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>{copy.scope}</span>
      </div>
      <div className="page-actions">
        <div className="segment" role="group" aria-label={copy.filter}>
          {filters.map((filter) => {
            const count = all.filter((booking) =>
              filter === "All"
                ? true
                : filter === "Declined"
                  ? booking.phase === "Declined"
                  : filter === "Cancelled"
                    ? booking.phase === "Cancelled"
                    : booking.status === filter && booking.phase !== "Declined",
            ).length;
            return (
              <button
                key={filter}
                className={view.filter === filter ? "active" : ""}
                aria-pressed={view.filter === filter}
                onClick={() => {
                  setState((current) =>
                    filterSpaceBookings(current, filter, role),
                  );
                  setStatus(null);
                  setActionError(null);
                }}
              >
                {spaceBookingStatusText(filter, copy)}{" "}
                <span className="booking-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
        {onBrowseSpaces && (
          <button className="button button-secondary" onClick={onBrowseSpaces}>
            <Plus size={16} />
            {copy.newRequest}
          </button>
        )}
      </div>
      {status && (
        <div className="scope-note booking-action-status" role="status">
          <ShieldCheck size={17} />
          <span>{copy[status]}</span>
        </div>
      )}
      {actionError && (
        <div className="space-booking-error" role="alert">
          {spaceBookingIssueText(actionError, copy)}
        </div>
      )}
      {drafts.length > 0 && (
        <section
          className="card padded space-booking-drafts"
          aria-labelledby="space-booking-drafts-title"
        >
          <h2 id="space-booking-drafts-title" ref={draftsHeading} tabIndex={-1}>
            {copy.drafts}
          </h2>
          <p className="muted">{copy.draftsNote}</p>
          {drafts.map((entry) => (
            <article key={`${entry.venueId}-${entry.spaceId}`}>
              <div>
                <strong>
                  {spaceBookingVenue(entry.venueId)?.name} ·{" "}
                  {spaceBookingUnit(entry.venueId, entry.spaceId)?.name}
                </strong>
                <small>
                  {entry.draft.date
                    ? spaceBookingDate(entry.draft.date, locale)
                    : copy.none}{" "}
                  · {entry.draft.start || "—"}–{entry.draft.end || "—"}
                </small>
              </div>
              <div>
                <button
                  className="soft-button"
                  onClick={() =>
                    setDraftTarget({
                      venueId: entry.venueId,
                      spaceId: entry.spaceId,
                    })
                  }
                >
                  {copy.continueDraft}
                </button>
                <button
                  className="soft-button"
                  onClick={() => {
                    setState((current) =>
                      discardSpaceBookingDraft(
                        current,
                        role,
                        entry.venueId,
                        entry.spaceId,
                      ),
                    );
                    requestAnimationFrame(() =>
                      (draftsHeading.current ?? heading.current)?.focus(),
                    );
                  }}
                >
                  {copy.discardDraft}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      <div className="space-bookings-layout">
        <section className="card space-booking-list" aria-label={copy.records}>
          {visible.map((booking) => {
            const terms = booking.agreedTerms ?? booking.requestedTerms;
            return (
              <button
                className={selected?.id === booking.id ? "active" : ""}
                key={booking.id}
                aria-current={selected?.id === booking.id ? "true" : undefined}
                onClick={() => {
                  setState((current) =>
                    selectSpaceBooking(current, booking.id, role),
                  );
                  setStatus(null);
                  setActionError(null);
                  if (selectedId === booking.id) focusDetails();
                }}
              >
                <img src={booking.image} alt="" />
                <span>
                  <BookingStatus booking={booking} copy={copy} />
                  <strong>{booking.venue}</strong>
                  <small>
                    {booking.space} · {spaceBookingDate(terms.date, locale)} ·{" "}
                    {terms.start}–{terms.end}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            );
          })}
          {visible.length === 0 && (
            <div className="empty-state">
              <CalendarDays />
              <h3>{copy.noRecords}</h3>
              <p>{copy.noRecordsNote}</p>
            </div>
          )}
        </section>
        {selected ? (
          <aside
            className="card padded booking-detail-panel"
            aria-label={copy.details}
          >
            <img src={selected.image} alt="" />
            <div>
              <BookingStatus booking={selected} copy={copy} />
              <h2 ref={heading} tabIndex={-1} data-booking-id={selected.id}>
                {selected.venue}
              </h2>
              <p>{selected.space}</p>
            </div>
            <BookingTerms
              terms={selected.agreedTerms ?? selected.requestedTerms}
              locale={locale}
              copy={copy}
            />
            <p>
              <strong>{copy.guests}:</strong> {selected.participants}
            </p>
            {selected.notes && (
              <div>
                <strong>{copy.notes}</strong>
                <p className="space-booking-note">{selected.notes}</p>
              </div>
            )}
            <p className="muted">
              <strong>{copy.reference}:</strong> {selected.code}
            </p>
            {selected.agreedTerms && (
              <details className="space-booking-original">
                <summary>{copy.originalRequest}</summary>
                <BookingTerms
                  terms={selected.requestedTerms}
                  locale={locale}
                  copy={copy}
                />
              </details>
            )}
            {selected.phase === "Proposed" &&
              selected.proposal?.status === "pending" && (
                <section
                  className="time-proposal-card"
                  aria-label={copy.pendingProposal}
                >
                  <h3>{copy.pendingProposal}</h3>
                  <p>{copy.proposalNote}</p>
                  <BookingTerms
                    terms={selected.proposal.proposedTerms}
                    locale={locale}
                    copy={copy}
                  />
                  {selected.proposal.note && (
                    <p className="space-booking-note">
                      {selected.proposal.note}
                    </p>
                  )}
                  <div>
                    <button
                      className="button"
                      onClick={() =>
                        act(
                          selected.id,
                          {
                            type: "accept-proposal",
                            proposalId: selected.proposal!.id,
                          },
                          "proposalAccepted",
                        )
                      }
                    >
                      {copy.acceptProposal}
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={() =>
                        act(
                          selected.id,
                          {
                            type: "keep-original",
                            proposalId: selected.proposal!.id,
                          },
                          selected.agreedTerms
                            ? "proposalDeclinedAgreement"
                            : "proposalDeclined",
                        )
                      }
                    >
                      {selected.agreedTerms
                        ? copy.keepAgreement
                        : copy.keepOriginal}
                    </button>
                  </div>
                </section>
              )}
            {selected.phase === "Cancelled" && (
              <section className="booking-cancellation-note">
                <strong>{copy.cancellationSaved}</strong>
                <p className="space-booking-note">
                  {selected.cancellationReason || copy.noReason}
                </p>
              </section>
            )}
            {selected.phase === "Declined" && (
              <section className="booking-cancellation-note">
                <strong>{copy.declinedReason}</strong>
                <p className="space-booking-note">
                  {selected.history
                    .filter((entry) => entry.action === "declined")
                    .at(-1)?.note || copy.noReason}
                </p>
              </section>
            )}
            {["Requested", "Proposed", "Agreed"].includes(selected.phase) && (
              <button
                className="soft-button"
                onClick={() => setCancellingId(selected.id)}
              >
                {selected.phase === "Agreed"
                  ? copy.cancelBooking
                  : copy.withdraw}
              </button>
            )}
            <section
              className="space-booking-original"
              aria-label={copy.history}
            >
              <h3>{copy.history}</h3>
              <ol className="space-booking-history">
                {selected.history.map((entry) => {
                  const proposal =
                    entry.action === "proposed"
                      ? selected.proposals.find(
                          (item) => item.id === entry.proposalId,
                        )
                      : undefined;
                  return (
                    <li key={entry.id}>
                      <strong>
                        {spaceBookingHistoryText(entry.action, copy)}
                      </strong>
                      <small>
                        {entry.actor} ·{" "}
                        {spaceBookingDate(entry.at, locale, true)}
                      </small>
                      {entry.note && (
                        <p className="space-booking-note">{entry.note}</p>
                      )}
                      {proposal && (
                        <details>
                          <summary>
                            {copy.proposal} {proposal.version} ·{" "}
                            {spaceBookingStatusText(proposal.status, copy)}
                          </summary>
                          <BookingTerms
                            terms={proposal.proposedTerms}
                            locale={locale}
                            copy={copy}
                          />
                        </details>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          </aside>
        ) : (
          <aside className="card padded booking-detail-panel booking-detail-empty">
            <CalendarDays size={28} />
            <h2 ref={heading} tabIndex={-1}>
              {copy.noSelected}
            </h2>
            <p>{copy.noRecordsNote}</p>
          </aside>
        )}
      </div>
      {cancelling && (
        <CancelBookingDialog
          booking={cancelling}
          onClose={() => setCancellingId(null)}
          onConfirm={(reason) => {
            const issue = act(
              cancelling.id,
              { type: "cancel", note: reason },
              "cancellationSaved",
            );
            if (issue) return spaceBookingIssueText(issue, copy);
            setCancellingId(null);
            return undefined;
          }}
        />
      )}
      {draftTarget && (
        <SpaceBookingRequest
          role={role}
          state={state}
          setState={setState}
          {...draftTarget}
          onClose={() => setDraftTarget(null)}
          onSaved={() => {
            setDraftTarget(null);
            setStatus("requestCreated");
          }}
        />
      )}
    </div>
  );
}
