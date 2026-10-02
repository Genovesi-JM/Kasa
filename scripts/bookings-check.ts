import assert from "node:assert/strict";
import {
  acceptSpaceBookingProposal,
  cancelSpaceBooking,
  createInitialSpaceBookingsState,
  filterSpaceBookings,
  keepOriginalSpaceBookingRequest,
  selectedSpaceBooking,
  selectSpaceBooking,
  visibleSpaceBookings,
  type SpaceBookingsState,
} from "../src/components/spaceBookingsState";

const initial = createInitialSpaceBookingsState();
const requested = initial.bookings.find(
  (booking) => booking.status === "Requested",
)!;
const completed = initial.bookings.find(
  (booking) => booking.status === "Completed",
)!;
const upcoming = initial.bookings.find(
  (booking) => booking.status === "Upcoming",
)!;
assert.equal(selectedSpaceBooking(initial)?.id, upcoming.id);
assert.equal(visibleSpaceBookings(initial).length, 1);

const requestedState = filterSpaceBookings(initial, "Requested");
assert.equal(requestedState.selectedId, requested.id);
assert.equal(selectedSpaceBooking(requestedState)?.status, "Requested");
const empty = filterSpaceBookings(requestedState, "Cancelled");
assert.equal(empty.selectedId, null);
assert.equal(
  selectedSpaceBooking(empty),
  undefined,
  "Empty filters cannot retain unrelated booking details",
);
assert.deepEqual(visibleSpaceBookings(empty), []);
assert.equal(
  selectSpaceBooking(empty, upcoming.id),
  empty,
  "Hidden rows cannot become the selection",
);

const accepted = acceptSpaceBookingProposal(requestedState, requested.id);
const acceptedBooking = accepted.bookings.find(
  (booking) => booking.id === requested.id,
)!;
assert.equal(accepted.filter, "Upcoming");
assert.equal(accepted.selectedId, requested.id);
assert.equal(selectedSpaceBooking(accepted)?.id, requested.id);
assert.equal(acceptedBooking.status, "Upcoming");
assert.equal(acceptedBooking.time, requested.proposal!.proposedTime);
assert.equal(acceptedBooking.price, requested.price);
assert.equal(acceptedBooking.proposal?.status, "accepted");
assert.equal(
  requested.status,
  "Requested",
  "Accepting a proposal does not mutate the input state",
);
assert.equal(
  acceptSpaceBookingProposal(accepted, requested.id),
  accepted,
  "Accepted proposals cannot be accepted twice",
);
const revisited = filterSpaceBookings(
  filterSpaceBookings(accepted, "Completed"),
  "Upcoming",
);
assert.equal(
  revisited.bookings.find((booking) => booking.id === requested.id)?.proposal
    ?.status,
  "accepted",
);

const kept = keepOriginalSpaceBookingRequest(requestedState, requested.id);
assert.equal(selectedSpaceBooking(kept)?.status, "Requested");
assert.equal(selectedSpaceBooking(kept)?.time, requested.time);
assert.equal(selectedSpaceBooking(kept)?.proposal?.status, "declined");
assert.equal(
  acceptSpaceBookingProposal(kept, requested.id),
  kept,
  "A declined proposal cannot later be silently accepted",
);

const cancelled = cancelSpaceBooking(
  accepted,
  requested.id,
  "  Plans changed  ",
);
assert.equal(cancelled.filter, "Cancelled");
assert.equal(selectedSpaceBooking(cancelled)?.id, requested.id);
assert.equal(selectedSpaceBooking(cancelled)?.status, "Cancelled");
assert.equal(
  selectedSpaceBooking(cancelled)?.cancellationReason,
  "Plans changed",
);
assert.equal(
  visibleSpaceBookings(filterSpaceBookings(cancelled, "Upcoming")).some(
    (booking) => booking.id === requested.id,
  ),
  false,
);
assert.equal(cancelSpaceBooking(cancelled, requested.id, "again"), cancelled);
assert.equal(
  cancelSpaceBooking(initial, completed.id, "not valid"),
  initial,
  "Completed records cannot be cancelled",
);
assert.equal(cancelSpaceBooking(initial, "missing", "not valid"), initial);
assert.equal(acceptSpaceBookingProposal(initial, completed.id), initial);
assert.equal(acceptSpaceBookingProposal(initial, "missing"), initial);
assert.equal(
  selectedSpaceBooking(cancelSpaceBooking(requestedState, requested.id, ""))
    ?.status,
  "Cancelled",
  "Requests can be withdrawn without a reason",
);
assert.equal(
  selectedSpaceBooking(
    cancelSpaceBooking(requestedState, requested.id, "x".repeat(700)),
  )?.cancellationReason?.length,
  500,
);

const multipleRequests: SpaceBookingsState = {
  ...filterSpaceBookings(initial, "All"),
  bookings: [
    ...initial.bookings,
    {
      ...requested,
      id: "second-request",
      proposal: { ...requested.proposal! },
    },
  ],
};
const oneAccepted = acceptSpaceBookingProposal(multipleRequests, requested.id);
assert.equal(oneAccepted.filter, "All");
assert.equal(
  oneAccepted.bookings.find((booking) => booking.id === "second-request")
    ?.proposal?.status,
  "pending",
);
assert.equal(
  oneAccepted.bookings.find((booking) => booking.id === "second-request")
    ?.status,
  "Requested",
);
assert.equal(cancelSpaceBooking(oneAccepted, requested.id, "").filter, "All");
assert.equal(
  createInitialSpaceBookingsState().bookings.find(
    (booking) => booking.id === requested.id,
  )?.proposal?.status,
  "pending",
  "A fresh session receives unmodified seeds",
);

console.log(
  "Space booking checks passed: filter and detail consistency, per-record proposal lifecycle, cancellation and withdrawal, immutable updates, transition guards and retained state across navigation filters.",
);
