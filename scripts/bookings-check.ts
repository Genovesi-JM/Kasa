import assert from "node:assert/strict";
import {
  acceptSpaceBookingProposal,
  actOnSpaceBooking,
  bookingTermsTotalCents,
  cancelSpaceBooking,
  createSpaceBookingRequest,
  createInitialSpaceBookingsState,
  discardSpaceBookingDraft,
  filterSpaceBookings,
  keepOriginalSpaceBookingRequest,
  operatorSpaceVenues,
  saveSpaceBookingProposal,
  scopedSpaceBookings,
  selectedSpaceBooking,
  selectSpaceBooking,
  spaceBookingActionDraft,
  spaceBookingActionIssue,
  spaceBookingConflicts,
  spaceBookingCounts,
  spaceBookingDateValue,
  spaceBookingDraft,
  spaceBookingDrafts,
  spaceBookingRequestTerms,
  spaceBookingUnit,
  spaceBookingVenue,
  spaceBookingView,
  updateSpaceBookingActionDraft,
  updateSpaceBookingDraft,
  validateSpaceBookingProposal,
  validateSpaceBookingRequest,
  visibleSpaceBookings,
  type SpaceBookingsState,
  type SpaceBookingActionDraft,
  type SpaceBookingRequestDraft,
} from "../src/components/spaceBookingsState";
import type { Role } from "../src/types";

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

const now = new Date(2026, 9, 3, 12, 0, 30);
const later = new Date(2026, 9, 3, 13);
const base = createInitialSpaceBookingsState(now);
const blank: SpaceBookingsState = {
  ...base,
  bookings: [],
  selectedId: null,
  views: { ...base.views, tenant: { filter: "Upcoming", selectedId: null } },
};
const customerRoles = ["tenant", "landlord"] as const;
const roles: Role[] = [
  "tenant",
  "landlord",
  "spaceOperator",
  "provider",
  "admin",
];
assert.equal(scopedSpaceBookings(base, "tenant").length, 3);
assert.equal(scopedSpaceBookings(base, "landlord").length, 0);
assert.deepEqual(
  scopedSpaceBookings(base, "spaceOperator").map((booking) => booking.venueId),
  [1],
);
assert.deepEqual(scopedSpaceBookings(base, "provider"), []);
assert.deepEqual(scopedSpaceBookings(base, "admin"), []);
assert.deepEqual(
  operatorSpaceVenues("spaceOperator").map((venue) => venue.id),
  [1],
);
assert.deepEqual(
  operatorSpaceVenues("landlord"),
  [],
  "Property owner status does not grant venue authority",
);
assert.equal(spaceBookingVenue(4)?.name, "The Garden Hall");
assert.equal(spaceBookingUnit(1, 41), undefined);
assert.equal(spaceBookingDateValue(now), "2026-10-03");
assert.equal(
  base.bookings.find((booking) => booking.status === "Upcoming")?.date,
  "2026-10-05",
);
assert.equal(
  base.bookings.find((booking) => booking.status === "Completed")?.date,
  "2026-09-26",
);
assert.equal(
  base.bookings.find((booking) => booking.status === "Requested")?.proposal
    ?.proposedTerms.end,
  "23:00",
  "Seed proposal stays within its venue closing time",
);
assert.ok(base.bookings.every((booking) => booking.source === "sample"));
assert.equal(spaceBookingCounts(base, "spaceOperator").agreed, 1);
assert.equal(
  spaceBookingCounts(base, "spaceOperator").proposed,
  0,
  "Garden Hall's proposal is outside the Poblenou workspace",
);

const requestDraft: SpaceBookingRequestDraft = {
  date: "2026-10-06",
  start: "08:00",
  end: "09:30",
  participants: "4",
  notes: "  A friendly game with four players.  ",
};
assert.equal(spaceBookingRequestTerms(999, 11, requestDraft), null);
assert.equal(spaceBookingRequestTerms(1, 41, requestDraft), null);
assert.equal(spaceBookingRequestTerms(1, 11, requestDraft)?.priceCents, 2800);
assert.equal(
  spaceBookingRequestTerms(1, 11, { ...requestDraft, start: "08:15" })
    ?.priceCents,
  null,
);
assert.deepEqual(spaceBookingDraft(blank, "tenant", 1, 11), {
  date: "",
  start: "",
  end: "",
  participants: "",
  notes: "",
});
const drafted = updateSpaceBookingDraft(blank, "tenant", 1, 11, requestDraft);
assert.equal(spaceBookingDraft(blank, "tenant", 1, 11).date, "");
assert.equal(
  spaceBookingDraft(drafted, "tenant", 1, 11).notes,
  requestDraft.notes,
);
assert.equal(
  updateSpaceBookingDraft(drafted, "tenant", 1, 11, requestDraft),
  drafted,
);
assert.deepEqual(spaceBookingDrafts(drafted, "landlord"), []);
assert.deepEqual(
  spaceBookingDrafts(drafted, "tenant").map((entry) => [
    entry.venueId,
    entry.spaceId,
  ]),
  [[1, 11]],
);
const parallelDrafts = updateSpaceBookingDraft(
  updateSpaceBookingDraft(drafted, "landlord", 1, 11, { notes: "Owner draft" }),
  "tenant",
  1,
  12,
  { notes: "Another court" },
);
assert.equal(
  spaceBookingDraft(parallelDrafts, "tenant", 1, 11).notes,
  requestDraft.notes,
);
assert.equal(
  spaceBookingDraft(parallelDrafts, "landlord", 1, 11).notes,
  "Owner draft",
);
assert.equal(
  spaceBookingDraft(parallelDrafts, "tenant", 1, 12).notes,
  "Another court",
);
const discarded = discardSpaceBookingDraft(parallelDrafts, "tenant", 1, 11);
assert.equal(spaceBookingDraft(discarded, "tenant", 1, 11).date, "");
assert.equal(
  spaceBookingDraft(discarded, "landlord", 1, 11).notes,
  "Owner draft",
);
assert.equal(spaceBookingDrafts(discarded, "tenant").length, 1);
assert.equal(discardSpaceBookingDraft(discarded, "tenant", 1, 11), discarded);
assert.equal(
  updateSpaceBookingDraft(drafted, "tenant", 1, 41, requestDraft),
  drafted,
);
assert.equal(
  updateSpaceBookingDraft(drafted, "tenant", 999, 11, requestDraft),
  drafted,
);
assert.equal(
  updateSpaceBookingDraft(drafted, "tenant", 1, 11, {
    customerRole: "landlord",
    phase: "Agreed",
  } as Partial<SpaceBookingRequestDraft>),
  drafted,
);
for (const role of ["spaceOperator", "provider", "admin"] as Role[]) {
  assert.equal(
    updateSpaceBookingDraft(drafted, role, 1, 11, requestDraft),
    drafted,
  );
  assert.equal(discardSpaceBookingDraft(drafted, role, 1, 11), drafted);
  assert.equal(
    createSpaceBookingRequest(drafted, role, 1, 11, now).state,
    drafted,
  );
}
assert.equal(
  validateSpaceBookingRequest(blank, "tenant", 999, 11, requestDraft, now)
    .issue,
  "venue",
);
assert.equal(
  validateSpaceBookingRequest(blank, "tenant", 1, 41, requestDraft, now).issue,
  "space",
);
const invalidRequestFields: Array<[keyof SpaceBookingRequestDraft, string]> = [
  ["date", "2026-10-02"],
  ["date", "2026-02-30"],
  ["date", "2026-13-01"],
  ["start", "25:00"],
  ["start", "05:59"],
  ["start", "08:99"],
  ["end", "24:00"],
  ["end", "23:01"],
  ["end", "08:00"],
  ["end", "07:00"],
  ["participants", "0"],
  ["participants", "5"],
  ["participants", "1.5"],
  ["participants", "NaN"],
  ["participants", "1e1"],
  ["notes", "x".repeat(3001)],
];
for (const [field, value] of invalidRequestFields) {
  assert.ok(
    validateSpaceBookingRequest(
      blank,
      "tenant",
      1,
      11,
      { ...requestDraft, [field]: value },
      now,
    ).errors[field],
    `Reject invalid request ${field}: ${value.slice(0, 20)}`,
  );
  const invalid = updateSpaceBookingDraft(drafted, "tenant", 1, 11, {
    [field]: value,
  });
  assert.equal(
    createSpaceBookingRequest(invalid, "tenant", 1, 11, now).state,
    invalid,
  );
}
assert.equal(
  validateSpaceBookingRequest(
    blank,
    "tenant",
    1,
    11,
    { ...requestDraft, date: "2026-10-03", start: "11:59", end: "13:00" },
    now,
  ).errors.start,
  "start",
);
assert.deepEqual(
  validateSpaceBookingRequest(
    blank,
    "tenant",
    1,
    11,
    { ...requestDraft, date: "2026-10-03", start: "12:00", end: "13:00" },
    now,
  ).errors,
  {},
  "Current minute is valid without dropping users for elapsed seconds",
);

const created = createSpaceBookingRequest(parallelDrafts, "tenant", 1, 11, now);
assert.ok(created.bookingId);
assert.deepEqual(created.errors, {});
const id = created.bookingId!;
const item = (state: SpaceBookingsState, target = id) =>
  state.bookings.find((booking) => booking.id === target)!;
assert.equal(item(created.state).phase, "Requested");
assert.equal(
  item(created.state).agreedTerms,
  undefined,
  "Even an Instant Book catalogue venue creates a local request, not payment/confirmation",
);
assert.equal(item(created.state).notes, requestDraft.notes.trim());
assert.equal(item(created.state).customerName, "Inês Duarte");
assert.equal(item(created.state).source, "local");
assert.equal(item(created.state).requestedTerms.priceCents, 2800);
assert.equal(item(created.state).date, requestDraft.date);
assert.equal(item(created.state).createdAt, now.toISOString());
assert.equal(selectedSpaceBooking(created.state, "tenant")?.id, id);
assert.equal(spaceBookingView(created.state, "tenant").filter, "Requested");
assert.equal(spaceBookingDraft(created.state, "tenant", 1, 11).date, "");
assert.equal(
  spaceBookingDraft(created.state, "tenant", 1, 12).notes,
  "Another court",
);
assert.equal(
  spaceBookingDraft(created.state, "landlord", 1, 11).notes,
  "Owner draft",
);
assert.equal(
  createSpaceBookingRequest(created.state, "tenant", 1, 11, now).state,
  created.state,
  "Retrying cleared form values cannot append a duplicate",
);
const duplicateDraft = updateSpaceBookingDraft(
  created.state,
  "tenant",
  1,
  11,
  requestDraft,
);
assert.equal(
  createSpaceBookingRequest(duplicateDraft, "tenant", 1, 11, now).issue,
  "duplicate",
);
assert.equal(
  createSpaceBookingRequest(duplicateDraft, "tenant", 1, 11, now).state,
  duplicateDraft,
);
assert.equal(item(created.state).history.length, 1);
assert.equal(scopedSpaceBookings(created.state, "landlord").length, 0);
assert.equal(scopedSpaceBookings(created.state, "spaceOperator").length, 1);

const tenantView = spaceBookingView(created.state, "tenant");
const changedOperatorView = filterSpaceBookings(
  created.state,
  "Upcoming",
  "spaceOperator",
);
assert.deepEqual(spaceBookingView(changedOperatorView, "tenant"), tenantView);
assert.equal(
  selectedSpaceBooking(changedOperatorView, "spaceOperator"),
  undefined,
);
assert.equal(
  selectSpaceBooking(changedOperatorView, id, "spaceOperator"),
  changedOperatorView,
  "A hidden record cannot be selected",
);
assert.equal(
  filterSpaceBookings(created.state, "invalid" as "All", "tenant"),
  created.state,
);
assert.deepEqual(
  visibleSpaceBookings(
    filterSpaceBookings(created.state, "All", "landlord"),
    "landlord",
  ),
  [],
);

for (const role of roles.filter((value) => value !== "spaceOperator")) {
  assert.equal(
    actOnSpaceBooking(created.state, role, id, { type: "accept-request" }, now),
    created.state,
  );
  assert.equal(
    actOnSpaceBooking(
      created.state,
      role,
      id,
      { type: "decline-request", note: "Unavailable" },
      now,
    ),
    created.state,
  );
  assert.equal(
    saveSpaceBookingProposal(created.state, role, id, now).state,
    created.state,
  );
}
const acceptedOriginal = actOnSpaceBooking(
  created.state,
  "spaceOperator",
  id,
  { type: "accept-request" },
  later,
);
assert.equal(item(acceptedOriginal).phase, "Agreed");
assert.deepEqual(
  item(acceptedOriginal).agreedTerms,
  item(created.state).requestedTerms,
);
assert.notEqual(
  item(acceptedOriginal).agreedTerms,
  item(created.state).requestedTerms,
);
assert.equal(item(created.state).agreedTerms, undefined);
assert.equal(
  item(acceptedOriginal).history.at(-1)?.actor,
  "Poblenou MultiSport Club",
);
assert.equal(item(acceptedOriginal).status, "Upcoming");
assert.equal(spaceBookingCounts(acceptedOriginal, "spaceOperator").agreed, 1);
assert.equal(
  actOnSpaceBooking(
    acceptedOriginal,
    "spaceOperator",
    id,
    { type: "accept-request" },
    later,
  ),
  acceptedOriginal,
);
assert.equal(
  actOnSpaceBooking(
    acceptedOriginal,
    "spaceOperator",
    id,
    { type: "decline-request", note: "Changed plans" },
    later,
  ),
  acceptedOriginal,
  "An agreed booking is not silently declined by the operator",
);
assert.equal(
  createSpaceBookingRequest(
    updateSpaceBookingDraft(acceptedOriginal, "tenant", 1, 11, requestDraft),
    "tenant",
    1,
    11,
    now,
  ).issue,
  "duplicate",
);
const foreignVenueDraft = updateSpaceBookingDraft(
  blank,
  "tenant",
  2,
  21,
  requestDraft,
);
const foreignVenue = createSpaceBookingRequest(
  foreignVenueDraft,
  "tenant",
  2,
  21,
  now,
);
assert.ok(foreignVenue.bookingId);
assert.equal(
  scopedSpaceBookings(foreignVenue.state, "spaceOperator").length,
  0,
);
assert.equal(
  actOnSpaceBooking(
    foreignVenue.state,
    "spaceOperator",
    foreignVenue.bookingId!,
    { type: "accept-request" },
    now,
  ),
  foreignVenue.state,
);
assert.equal(
  updateSpaceBookingActionDraft(
    foreignVenue.state,
    "spaceOperator",
    foreignVenue.bookingId!,
    { price: "1" },
  ),
  foreignVenue.state,
);

const customRange = { ...requestDraft, start: "09:30", end: "11:00" };
const customCreated = createSpaceBookingRequest(
  updateSpaceBookingDraft(blank, "tenant", 1, 11, customRange),
  "tenant",
  1,
  11,
  now,
);
assert.ok(
  customCreated.bookingId,
  "Dateless Booked seed slots do not permanently block future dates",
);
const customId = customCreated.bookingId!;
assert.equal(
  item(customCreated.state, customId).requestedTerms.priceCents,
  null,
);
assert.equal(
  bookingTermsTotalCents(item(customCreated.state, customId).requestedTerms),
  null,
  "An unknown custom-range price is never displayed as free",
);
assert.equal(
  spaceBookingActionIssue(
    customCreated.state,
    "spaceOperator",
    customId,
    { type: "accept-request" },
    now,
  ),
  "priceRequired",
);
assert.equal(
  actOnSpaceBooking(
    customCreated.state,
    "spaceOperator",
    customId,
    { type: "accept-request" },
    now,
  ),
  customCreated.state,
);

const proposalDraft: SpaceBookingActionDraft = {
  date: "2026-10-07",
  start: "12:00",
  end: "13:15",
  price: "35,50",
  cleaningFee: "2.25",
  deposit: "10",
  note: "  A quieter time is available with equipment included.  ",
};
const proposalState = updateSpaceBookingActionDraft(
  customCreated.state,
  "spaceOperator",
  customId,
  proposalDraft,
);
assert.equal(
  spaceBookingActionDraft(customCreated.state, "spaceOperator", customId).price,
  "",
);
assert.equal(
  spaceBookingActionDraft(proposalState, "spaceOperator", customId).price,
  "35,50",
);
assert.equal(
  updateSpaceBookingActionDraft(
    proposalState,
    "spaceOperator",
    customId,
    proposalDraft,
  ),
  proposalState,
);
assert.equal(
  updateSpaceBookingActionDraft(proposalState, "landlord", customId, {
    note: "Not mine",
  }),
  proposalState,
);
assert.equal(
  updateSpaceBookingActionDraft(proposalState, "tenant", customId, {
    price: "1",
  }),
  proposalState,
  "Customers cannot edit operator terms through action drafts",
);
assert.equal(
  spaceBookingActionDraft(proposalState, "tenant", customId).note,
  "",
);
const invalidProposalFields: Array<[keyof SpaceBookingActionDraft, string]> = [
  ["date", "2026-10-02"],
  ["date", "2026-02-30"],
  ["start", "03:00"],
  ["end", "12:00"],
  ["end", "23:30"],
  ["price", "0"],
  ["price", "-1"],
  ["price", "1e3"],
  ["price", "1,200.00"],
  ["price", "12.345"],
  ["price", "1000000.01"],
  ["price", "NaN"],
  ["cleaningFee", "-1"],
  ["cleaningFee", "2.333"],
  ["deposit", "-1"],
  ["deposit", "Infinity"],
  ["note", "x"],
  ["note", "x".repeat(2001)],
];
for (const [field, value] of invalidProposalFields) {
  assert.ok(
    validateSpaceBookingProposal(
      proposalState,
      "spaceOperator",
      customId,
      { ...proposalDraft, [field]: value },
      now,
    ).errors[field],
    `Reject invalid proposal ${field}: ${value.slice(0, 20)}`,
  );
  const invalid = updateSpaceBookingActionDraft(
    proposalState,
    "spaceOperator",
    customId,
    { [field]: value },
  );
  assert.equal(
    saveSpaceBookingProposal(invalid, "spaceOperator", customId, now).state,
    invalid,
  );
}
assert.deepEqual(
  validateSpaceBookingProposal(
    proposalState,
    "spaceOperator",
    customId,
    { ...proposalDraft, price: "0.01", cleaningFee: "0", deposit: "0" },
    now,
  ).errors,
  {},
);
const proposalResult = saveSpaceBookingProposal(
  proposalState,
  "spaceOperator",
  customId,
  now,
);
assert.deepEqual(proposalResult.errors, {});
assert.equal(proposalResult.issue, undefined);
const proposed = proposalResult.state;
const proposal = item(proposed, customId).proposal!;
assert.equal(item(proposed, customId).phase, "Proposed");
assert.equal(item(proposed, customId).date, customRange.date);
assert.equal(item(proposed, customId).time, "09:30–11:00");
assert.equal(item(proposed, customId).agreedTerms, undefined);
assert.equal(proposal.proposedTerms.priceCents, 3550);
assert.equal(proposal.proposedTerms.cleaningFeeCents, 225);
assert.equal(proposal.proposedTerms.depositCents, 1000);
assert.equal(
  bookingTermsTotalCents(proposal.proposedTerms),
  4775,
  "Full total includes separately displayed refundable deposit",
);
assert.equal(proposal.status, "pending");
assert.equal(proposal.note, proposalDraft.note.trim());
assert.equal(item(customCreated.state, customId).proposals.length, 0);
assert.equal(
  saveSpaceBookingProposal(proposed, "spaceOperator", customId, now).issue,
  "noChange",
);
assert.equal(
  spaceBookingActionIssue(
    proposed,
    "spaceOperator",
    customId,
    { type: "accept-request" },
    now,
  ),
  "status",
);
for (const role of roles.filter((value) => value !== "tenant")) {
  assert.equal(
    actOnSpaceBooking(
      proposed,
      role,
      customId,
      { type: "accept-proposal", proposalId: proposal.id },
      now,
    ),
    proposed,
  );
  assert.equal(
    actOnSpaceBooking(
      proposed,
      role,
      customId,
      { type: "keep-original", proposalId: proposal.id },
      now,
    ),
    proposed,
  );
  assert.equal(
    actOnSpaceBooking(
      proposed,
      role,
      customId,
      { type: "cancel", note: "Not mine" },
      now,
    ),
    proposed,
  );
}
const revisionDraft = updateSpaceBookingActionDraft(
  proposed,
  "spaceOperator",
  customId,
  {
    start: "13:00",
    end: "14:00",
    price: "30",
    note: "Another suitable option for you.",
  },
);
const revised = saveSpaceBookingProposal(
  revisionDraft,
  "spaceOperator",
  customId,
  later,
).state;
const currentProposal = item(revised, customId).proposal!;
assert.equal(currentProposal.version, 2);
assert.notEqual(currentProposal.id, proposal.id);
assert.equal(item(revised, customId).proposals[0].status, "superseded");
assert.equal(item(proposed, customId).proposals[0].status, "pending");
assert.equal(
  spaceBookingActionIssue(
    revised,
    "tenant",
    customId,
    { type: "accept-proposal", proposalId: proposal.id },
    now,
  ),
  "staleProposal",
);
assert.equal(
  actOnSpaceBooking(
    revised,
    "tenant",
    customId,
    { type: "keep-original", proposalId: proposal.id },
    now,
  ),
  revised,
);
const keptOriginal = actOnSpaceBooking(
  revised,
  "tenant",
  customId,
  { type: "keep-original", proposalId: currentProposal.id },
  later,
);
assert.equal(item(keptOriginal, customId).phase, "Requested");
assert.equal(item(keptOriginal, customId).time, "09:30–11:00");
assert.equal(item(keptOriginal, customId).proposal?.status, "declined");
assert.equal(
  actOnSpaceBooking(
    keptOriginal,
    "tenant",
    customId,
    { type: "accept-proposal", proposalId: currentProposal.id },
    later,
  ),
  keptOriginal,
);
const agreed = actOnSpaceBooking(
  revised,
  "tenant",
  customId,
  { type: "accept-proposal", proposalId: currentProposal.id },
  later,
);
assert.equal(item(agreed, customId).phase, "Agreed");
assert.equal(item(agreed, customId).time, "13:00–14:00");
assert.equal(item(agreed, customId).date, "2026-10-07");
assert.equal(item(agreed, customId).price, 30);
assert.equal(item(agreed, customId).requestedTerms.start, "09:30");
assert.notEqual(
  item(agreed, customId).agreedTerms,
  currentProposal.proposedTerms,
);
assert.equal(item(agreed, customId).proposal?.status, "accepted");
assert.equal(item(agreed, customId).history.at(-1)?.actor, "Inês Duarte");
assert.equal(
  item(agreed, customId).history.at(-1)?.proposalId,
  currentProposal.id,
);
assert.equal(
  actOnSpaceBooking(
    agreed,
    "tenant",
    customId,
    { type: "accept-proposal", proposalId: currentProposal.id },
    later,
  ),
  agreed,
);
assert.equal(
  spaceBookingActionIssue(
    revised,
    "tenant",
    customId,
    { type: "accept-proposal", proposalId: currentProposal.id },
    new Date(2026, 9, 8, 12),
  ),
  "date",
);
assert.equal(
  spaceBookingActionIssue(
    revised,
    "tenant",
    customId,
    { type: "accept-proposal", proposalId: currentProposal.id },
    new Date(2026, 9, 7, 13, 1),
  ),
  "start",
);

// Rescheduling an agreement retains its old dated occupancy until explicit customer acceptance.
const reschedule = saveSpaceBookingProposal(
  updateSpaceBookingActionDraft(agreed, "spaceOperator", customId, {
    date: "2026-10-08",
    start: "17:00",
    end: "18:30",
    price: "36",
    note: "Can we move to the next afternoon?",
  }),
  "spaceOperator",
  customId,
  later,
).state;
assert.equal(item(reschedule, customId).phase, "Proposed");
assert.equal(item(reschedule, customId).status, "Upcoming");
assert.deepEqual(
  item(reschedule, customId).agreedTerms,
  item(agreed, customId).agreedTerms,
);
assert.equal(item(reschedule, customId).time, "13:00–14:00");
assert.equal(
  spaceBookingConflicts(reschedule, 1, 11, {
    date: "2026-10-07",
    start: "13:30",
    end: "14:30",
  }),
  true,
);
assert.equal(
  spaceBookingConflicts(reschedule, 1, 11, {
    date: "2026-10-08",
    start: "17:00",
    end: "18:30",
  }),
  false,
  "Pending proposals do not silently hold a second time",
);
const keepAgreement = actOnSpaceBooking(
  reschedule,
  "tenant",
  customId,
  {
    type: "keep-original",
    proposalId: item(reschedule, customId).proposal!.id,
  },
  later,
);
assert.equal(item(keepAgreement, customId).phase, "Agreed");
assert.equal(item(keepAgreement, customId).time, "13:00–14:00");
assert.equal(spaceBookingCounts(reschedule, "spaceOperator").agreed, 1);
assert.equal(spaceBookingCounts(reschedule, "spaceOperator").proposed, 1);
const rescheduled = actOnSpaceBooking(
  reschedule,
  "tenant",
  customId,
  {
    type: "accept-proposal",
    proposalId: item(reschedule, customId).proposal!.id,
  },
  later,
);
assert.equal(item(rescheduled, customId).date, "2026-10-08");
assert.equal(
  spaceBookingConflicts(rescheduled, 1, 11, {
    date: "2026-10-07",
    start: "13:00",
    end: "14:00",
  }),
  false,
);

// Two independent customers may request the same time; acceptance is the capacity decision.
const otherCustomer = createSpaceBookingRequest(
  updateSpaceBookingDraft(created.state, "landlord", 1, 11, requestDraft),
  "landlord",
  1,
  11,
  now,
);
assert.ok(otherCustomer.bookingId);
const otherId = otherCustomer.bookingId!;
assert.notEqual(otherId, id);
assert.equal(scopedSpaceBookings(otherCustomer.state, "tenant").length, 1);
assert.equal(scopedSpaceBookings(otherCustomer.state, "landlord").length, 1);
assert.equal(
  scopedSpaceBookings(otherCustomer.state, "spaceOperator").length,
  2,
);
const firstCapacity = actOnSpaceBooking(
  otherCustomer.state,
  "spaceOperator",
  id,
  { type: "accept-request" },
  now,
);
assert.equal(
  spaceBookingActionIssue(
    firstCapacity,
    "spaceOperator",
    otherId,
    { type: "accept-request" },
    now,
  ),
  "conflict",
);
assert.equal(
  actOnSpaceBooking(
    firstCapacity,
    "spaceOperator",
    otherId,
    { type: "accept-request" },
    now,
  ),
  firstCapacity,
);
assert.equal(
  spaceBookingConflicts(firstCapacity, 1, 11, {
    date: requestDraft.date,
    start: "09:30",
    end: "10:30",
  }),
  false,
  "Touching endpoints do not overlap",
);
assert.equal(
  spaceBookingConflicts(firstCapacity, 1, 12, requestDraft),
  false,
  "Different units have independent capacity",
);
assert.equal(
  spaceBookingConflicts(firstCapacity, 1, 11, {
    ...requestDraft,
    date: "2026-10-08",
  }),
  false,
);
const released = actOnSpaceBooking(
  firstCapacity,
  "tenant",
  id,
  { type: "cancel" },
  now,
);
assert.equal(
  spaceBookingActionIssue(
    released,
    "spaceOperator",
    otherId,
    { type: "accept-request" },
    now,
  ),
  null,
);
assert.equal(
  item(
    actOnSpaceBooking(
      released,
      "spaceOperator",
      otherId,
      { type: "accept-request" },
      now,
    ),
    otherId,
  ).phase,
  "Agreed",
);

// Revalidate proposal acceptance after another customer's request occupies the proposed range.
const occupyingDraft = {
  ...requestDraft,
  date: "2026-10-08",
  start: "17:00",
  end: "18:30",
};
const occupyingRequest = createSpaceBookingRequest(
  updateSpaceBookingDraft(reschedule, "landlord", 1, 11, occupyingDraft),
  "landlord",
  1,
  11,
  now,
);
const occupied = actOnSpaceBooking(
  occupyingRequest.state,
  "spaceOperator",
  occupyingRequest.bookingId!,
  { type: "accept-request" },
  now,
);
assert.equal(
  spaceBookingActionIssue(
    occupied,
    "tenant",
    customId,
    {
      type: "accept-proposal",
      proposalId: item(occupied, customId).proposal!.id,
    },
    now,
  ),
  "conflict",
);
assert.equal(
  actOnSpaceBooking(
    occupied,
    "tenant",
    customId,
    {
      type: "accept-proposal",
      proposalId: item(occupied, customId).proposal!.id,
    },
    now,
  ),
  occupied,
);
assert.equal(
  item(occupied, customId).time,
  "13:00–14:00",
  "Failed reacceptance preserves the existing agreement",
);

assert.equal(
  actOnSpaceBooking(
    created.state,
    "spaceOperator",
    id,
    { type: "decline-request", note: "x" },
    now,
  ),
  created.state,
);
const declinedRequest = actOnSpaceBooking(
  created.state,
  "spaceOperator",
  id,
  { type: "decline-request", note: "  Facility unavailable that day  " },
  later,
);
assert.equal(item(declinedRequest).phase, "Declined");
assert.equal(
  item(declinedRequest).declineReason,
  "Facility unavailable that day",
);
assert.equal(spaceBookingCounts(declinedRequest, "tenant").declined, 1);
assert.equal(
  visibleSpaceBookings(
    filterSpaceBookings(declinedRequest, "Declined", "tenant"),
    "tenant",
  ).length,
  1,
);
assert.equal(
  visibleSpaceBookings(
    filterSpaceBookings(declinedRequest, "Cancelled", "tenant"),
    "tenant",
  ).length,
  0,
);
for (const terminal of [
  declinedRequest,
  actOnSpaceBooking(
    created.state,
    "tenant",
    id,
    { type: "cancel", note: "Plans changed" },
    later,
  ),
]) {
  assert.equal(
    actOnSpaceBooking(
      terminal,
      "spaceOperator",
      id,
      { type: "accept-request" },
      later,
    ),
    terminal,
  );
  assert.equal(
    saveSpaceBookingProposal(terminal, "spaceOperator", id, later).state,
    terminal,
  );
  assert.ok(
    createSpaceBookingRequest(
      updateSpaceBookingDraft(terminal, "tenant", 1, 11, requestDraft),
      "tenant",
      1,
      11,
      now,
    ).bookingId,
    "Closed request history permits a new request for the same time",
  );
}
const cancelledProposal = actOnSpaceBooking(
  proposed,
  "tenant",
  customId,
  { type: "cancel", note: "No longer needed" },
  later,
);
assert.equal(item(cancelledProposal, customId).proposal?.status, "withdrawn");
assert.equal(
  actOnSpaceBooking(
    cancelledProposal,
    "tenant",
    customId,
    { type: "accept-proposal", proposalId: proposal.id },
    later,
  ),
  cancelledProposal,
);
assert.equal(
  actOnSpaceBooking(
    proposed,
    "tenant",
    customId,
    { type: "cancel", note: "x".repeat(501) },
    later,
  ),
  proposed,
);
const customerNote = updateSpaceBookingActionDraft(
  proposed,
  "tenant",
  customId,
  { note: "I need to cancel" },
);
assert.equal(
  spaceBookingActionDraft(customerNote, "tenant", customId).note,
  "I need to cancel",
);
assert.equal(
  spaceBookingActionDraft(customerNote, "spaceOperator", customId).note,
  proposalDraft.note,
);
assert.equal(
  spaceBookingActionDraft(
    actOnSpaceBooking(
      customerNote,
      "tenant",
      customId,
      { type: "cancel", note: "I need to cancel" },
      later,
    ),
    "tenant",
    customId,
  ).note,
  "",
);
assert.equal(
  bookingTermsTotalCents({ ...proposal.proposedTerms, priceCents: -1 }),
  null,
);
assert.equal(
  bookingTermsTotalCents({ ...proposal.proposedTerms, depositCents: 0.5 }),
  null,
);
assert.equal("paid" in item(agreed, customId), false);
assert.equal("paymentStatus" in item(agreed, customId), false);
assert.equal("confirmedAt" in item(agreed, customId), false);
assert.equal(
  new Set(item(rescheduled, customId).history.map((event) => event.id)).size,
  item(rescheduled, customId).history.length,
);
assert.equal(createInitialSpaceBookingsState(now).bookings.length, 3);
for (const role of customerRoles)
  assert.equal(
    spaceBookingDrafts(createInitialSpaceBookingsState(now), role).length,
    0,
  );

console.log(
  "Space booking checks passed: legacy compatibility, role/venue scope, retained drafts/views, dates/hours/capacity, duplicate prevention, dated conflicts, exact cents, versioned proposals, explicit customer acceptance, agreement rescheduling, cancellation/decline and immutable history.",
);
