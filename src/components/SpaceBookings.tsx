import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  ShieldCheck,
  X,
} from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";
import {
  acceptSpaceBookingProposal,
  cancelSpaceBooking,
  filterSpaceBookings,
  keepOriginalSpaceBookingRequest,
  selectedSpaceBooking,
  selectSpaceBooking,
  visibleSpaceBookings,
  type ManagedSpaceBooking,
  type SpaceBookingFilter,
  type SpaceBookingsState,
} from "./spaceBookingsState";
import "./spaceBookings.css";

const filters: SpaceBookingFilter[] = [
  "All",
  "Upcoming",
  "Requested",
  "Completed",
  "Cancelled",
];
const currency = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function BookingStatus({ booking }: { booking: ManagedSpaceBooking }) {
  const tone =
    booking.status === "Upcoming"
      ? "mint"
      : booking.status === "Requested"
        ? "amber"
        : "neutral";
  return <span className={`pill pill-${tone}`}>{booking.status}</span>;
}

function CancelBookingDialog({
  booking,
  onClose,
  onConfirm,
}: {
  booking: ManagedSpaceBooking;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const isRequest = booking.status === "Requested";
  return (
    <div
      className="modal-layer"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-cancel-title"
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
            <span className="eyebrow">RESERVATION</span>
            <h2 id="booking-cancel-title">
              {isRequest ? "Withdraw this request?" : "Cancel this booking?"}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close cancellation"
          >
            <X size={20} />
          </button>
        </header>
        <form
          className="modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(reason);
          }}
        >
          <p>
            <strong>{booking.venue}</strong>
            <br />
            {booking.space} · {booking.date} · {booking.time}
          </p>
          <p>
            This updates the sample record in this tab. No venue is contacted
            and no payment or refund is processed.
          </p>
          <label className="booking-cancel-reason">
            Reason (optional)
            <textarea
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why are you cancelling?"
            />
          </label>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              type="button"
              data-dialog-initial-focus
              onClick={onClose}
            >
              {isRequest ? "Keep request" : "Keep booking"}
            </button>
            <button className="button" type="submit">
              {isRequest ? "Withdraw request" : "Confirm cancellation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function SpaceBookingsView({
  state,
  setState,
}: {
  state: SpaceBookingsState;
  setState: Dispatch<SetStateAction<SpaceBookingsState>>;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const visible = visibleSpaceBookings(state);
  const selected = selectedSpaceBooking(state);
  const cancelling = state.bookings.find(
    (booking) => booking.id === cancellingId,
  );

  function focusDetails() {
    requestAnimationFrame(() => heading.current?.focus());
  }

  return (
    <div className="page-stack space-bookings-page">
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          Sample bookings. Changes stay in this tab until you reload. No venue
          is contacted and no payment or refund is processed.
        </span>
      </div>
      <div className="page-actions">
        <div className="segment" aria-label="Filter bookings">
          {filters.map((filter) => {
            const count = state.bookings.filter(
              (booking) => filter === "All" || booking.status === filter,
            ).length;
            return (
              <button
                key={filter}
                className={state.filter === filter ? "active" : ""}
                aria-pressed={state.filter === filter}
                onClick={() => {
                  setState((current) => filterSpaceBookings(current, filter));
                  setStatus("");
                }}
              >
                {filter} <span className="booking-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      {status && (
        <div className="scope-note booking-action-status" role="status">
          <ShieldCheck size={17} />
          <span>{status}</span>
        </div>
      )}
      <div className="space-bookings-layout">
        <section
          className="card space-booking-list"
          aria-label={`${state.filter} bookings`}
        >
          {visible.map((booking) => (
            <button
              className={selected?.id === booking.id ? "active" : ""}
              key={booking.id}
              aria-current={selected?.id === booking.id ? "true" : undefined}
              onClick={() => {
                setState((current) => selectSpaceBooking(current, booking.id));
                setStatus("");
                focusDetails();
              }}
            >
              <img src={booking.image} alt="" />
              <span>
                <BookingStatus booking={booking} />
                <strong>{booking.venue}</strong>
                <small>
                  {booking.space} · {booking.date} · {booking.time}
                </small>
              </span>
              <ChevronRight />
            </button>
          ))}
          {visible.length === 0 && (
            <div className="empty-state">
              <CalendarDays />
              <h3>
                No {state.filter === "All" ? "" : state.filter.toLowerCase()}{" "}
                bookings
              </h3>
              <p>Choose another status to see your records.</p>
            </div>
          )}
        </section>
        {selected ? (
          <aside
            className="card padded booking-detail-panel"
            aria-label="Booking details"
          >
            <img src={selected.image} alt="" />
            <div>
              <BookingStatus booking={selected} />
              <h2 ref={heading} tabIndex={-1}>
                {selected.venue}
              </h2>
              <p>{selected.space}</p>
            </div>
            <div className="booking-facts">
              <span>
                <small>Date</small>
                <strong>{selected.date}</strong>
              </span>
              <span>
                <small>Time</small>
                <strong>{selected.time}</strong>
              </span>
              <span>
                <small>Price</small>
                <strong>{currency.format(selected.price)}</strong>
              </span>
            </div>
            {selected.status === "Requested" &&
              selected.proposal?.status === "pending" && (
                <div className="time-proposal-card">
                  <span className="eyebrow">OPERATOR PROPOSED A CHANGE</span>
                  <h3>{selected.proposal.proposedTime}</h3>
                  <p>
                    Your original request is {selected.proposal.originalTime}.
                    Accept the suggested time or keep your original request
                    pending. The price stays {currency.format(selected.price)}.
                  </p>
                  <div>
                    <button
                      className="button"
                      onClick={() => {
                        setState((current) =>
                          acceptSpaceBookingProposal(current, selected.id),
                        );
                        setStatus(
                          "New time accepted in this tab. The booking moved to Upcoming.",
                        );
                        focusDetails();
                      }}
                    >
                      Accept new time
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        setState((current) =>
                          keepOriginalSpaceBookingRequest(current, selected.id),
                        );
                        setStatus(
                          "Original time kept in this tab. The request remains pending; no message was sent to the venue.",
                        );
                        focusDetails();
                      }}
                    >
                      Keep original request
                    </button>
                  </div>
                </div>
              )}
            {selected.status === "Requested" &&
              selected.proposal?.status === "declined" && (
                <div className="scope-note">
                  <Clock3 size={17} />
                  <span>
                    Original time retained: {selected.time}. This request is
                    still awaiting the venue's confirmation.
                  </span>
                </div>
              )}
            {selected.status === "Upcoming" &&
              selected.proposal?.status === "accepted" && (
                <div className="scope-note">
                  <CalendarDays size={17} />
                  <span>
                    New time accepted: {selected.time}. Original request:{" "}
                    {selected.proposal.originalTime}.
                  </span>
                </div>
              )}
            {selected.status === "Upcoming" && (
              <div className="qr-card">
                <CalendarDays size={28} />
                <span>
                  <small>Sample booking reference</small>
                  <strong>{selected.code}</strong>
                </span>
              </div>
            )}
            {selected.status === "Cancelled" && (
              <div className="booking-cancellation-note">
                <strong>Cancellation saved in this tab</strong>
                <p>{selected.cancellationReason || "No reason provided."}</p>
                <small>No refund or payment change has been processed.</small>
              </div>
            )}
            {selected.status === "Completed" && (
              <div className="scope-note">
                <CalendarDays size={17} />
                <span>This booking is completed and cannot be cancelled.</span>
              </div>
            )}
            {(selected.status === "Upcoming" ||
              selected.status === "Requested") && (
              <button
                className="soft-button"
                onClick={() => setCancellingId(selected.id)}
              >
                {selected.status === "Requested"
                  ? "Withdraw request"
                  : "Cancel booking"}
              </button>
            )}
          </aside>
        ) : (
          <aside className="card padded booking-detail-panel booking-detail-empty">
            <CalendarDays size={28} />
            <h2>No booking selected</h2>
            <p>
              There are no records in this filter. No booking details are shown.
            </p>
          </aside>
        )}
      </div>
      {cancelling && (
        <CancelBookingDialog
          booking={cancelling}
          onClose={() => setCancellingId(null)}
          onConfirm={(reason) => {
            setState((current) =>
              cancelSpaceBooking(current, cancelling.id, reason),
            );
            setCancellingId(null);
            setStatus(
              `${cancelling.status === "Requested" ? "Request withdrawn" : "Booking cancelled"} in this tab. The record is now in Cancelled.`,
            );
            focusDetails();
          }}
        />
      )}
    </div>
  );
}
