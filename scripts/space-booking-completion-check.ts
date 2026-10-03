import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  actOnSpaceBooking,
  createInitialSpaceBookingsState,
  createSpaceBookingRequest,
  createSpaceTimeBlock,
  filterSpaceBookings,
  saveSpaceBookingProposal,
  selectedSpaceBooking,
  spaceBookingActionIssue,
  spaceBookingCounts,
  spaceBookingEndTimestamp,
  spaceBookingView,
  spaceOperatorInboxView,
  updateSpaceBookingActionDraft,
  updateSpaceBookingDraft,
  updateSpaceOperatorInboxView,
  updateSpaceTimeBlockDraft,
  visibleSpaceBookings,
  type ManagedSpaceBooking,
  type SpaceBookingIssue,
  type SpaceBookingsState,
} from "../src/components/spaceBookingsState";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
  type NotificationState,
} from "../src/components/notificationState";
import {
  openSpaceBookingNotification,
  reconcileSpaceBookingNotifications,
} from "../src/components/spaceBookingNotifications";

const before = new Date(2032, 4, 10, 12);
const end = new Date(2032, 4, 11, 9, 30);
const initial = createInitialSpaceBookingsState(before);
const seeds = createInitialNotificationState();
const privateNote = "PRIVATE: retained access and scheduling notes";
const roles: Role[] = [
  "tenant",
  "landlord",
  "spaceOperator",
  "provider",
  "admin",
];
function booking(state: SpaceBookingsState, id: string) {
  const record = state.bookings.find((item) => item.id === id);
  assert.ok(record);
  return record;
}
function fixture(role: "tenant" | "landlord") {
  const result = createSpaceBookingRequest(
    updateSpaceBookingDraft(initial, role, 1, 11, {
      date: "2032-05-11",
      start: "08:00",
      end: "09:30",
      participants: "2",
      notes: privateNote,
    }),
    role,
    1,
    11,
    before,
  );
  assert.ok(result.bookingId);
  const state = actOnSpaceBooking(
    result.state,
    "spaceOperator",
    result.bookingId,
    { type: "accept-request" },
    before,
  );
  assert.notEqual(state, result.state);
  return { state, requested: result.state, id: result.bookingId };
}
function refused(
  state: SpaceBookingsState,
  id: string,
  at: Date,
  issue: SpaceBookingIssue,
  role: Role = "spaceOperator",
) {
  assert.equal(
    spaceBookingActionIssue(state, role, id, { type: "complete" }, at),
    issue,
  );
  assert.equal(
    actOnSpaceBooking(state, role, id, { type: "complete" }, at),
    state,
  );
}
function patchRecord(
  state: SpaceBookingsState,
  id: string,
  patch: Partial<ManagedSpaceBooking>,
) {
  return {
    ...state,
    bookings: state.bookings.map((record) =>
      record.id === id ? { ...record, ...patch } : record,
    ),
  };
}
function notices(state: NotificationState, id?: string) {
  return state.items.filter(
    (item) =>
      item.spaceBookingEvent?.kind === "booking-completed" &&
      (id === undefined || item.spaceBookingEvent.bookingId === id),
  );
}

// An ended booking remains agreed until an explicit, scoped operator action at or after its local end.
const tenant = fixture("tenant");
const original = booking(tenant.state, tenant.id);
assert.equal(spaceBookingEndTimestamp(original.agreedTerms!), end.getTime());
refused(tenant.state, tenant.id, new Date(end.getTime() - 1), "completionTime");
refused(tenant.state, tenant.id, before, "completionTime");
refused(tenant.state, tenant.id, new Date(Number.NaN), "completionTime");
refused(tenant.requested, tenant.id, end, "status");
for (const phase of ["Declined", "Cancelled", "Completed"] as const)
  refused(
    patchRecord(tenant.state, tenant.id, { phase }),
    tenant.id,
    end,
    "status",
  );
assert.equal(
  spaceBookingActionIssue(
    tenant.state,
    "spaceOperator",
    tenant.id,
    { type: "complete" },
    end,
  ),
  null,
);
assert.equal(
  spaceBookingCounts(tenant.state, "tenant").completed,
  spaceBookingCounts(tenant.requested, "tenant").completed,
);
assert.equal(
  notices(reconcileSpaceBookingNotifications(seeds, tenant.state)).length,
  0,
);
assert.equal(booking(tenant.state, tenant.id).phase, "Agreed");
for (const role of roles.filter((value) => value !== "spaceOperator"))
  refused(tenant.state, tenant.id, end, "unavailable", role);
refused(tenant.state, "missing", end, "unavailable");
for (const patch of [
  { venueId: 2, spaceId: 21 },
  { spaceId: 21 },
  { venueId: 999 },
  { spaceId: 999 },
])
  refused(
    patchRecord(tenant.state, tenant.id, patch),
    tenant.id,
    end,
    "unavailable",
  );

// Real calendar values, ordered same-day times and priced integer-cent agreements are mandatory.
for (const patch of [
  { date: "2032-02-30" },
  { date: "2032-5-11" },
  { date: "2032-13-01" },
  { date: "2032-05-12" },
  { start: "24:00" },
  { start: "8:00" },
  { end: "24:00" },
  { end: "09:60" },
  { end: "09:30:00" },
  { end: "08:00" },
  { end: "07:59" },
  { start: "23:00", end: "00:00" },
]) {
  const terms = { ...original.agreedTerms!, ...patch };
  refused(
    patchRecord(tenant.state, tenant.id, { agreedTerms: terms }),
    tenant.id,
    end,
    "completionTime",
  );
  if (patch.date !== "2032-05-12")
    assert.ok(Number.isNaN(spaceBookingEndTimestamp(terms)));
}
for (const patch of [
  { priceCents: null },
  { priceCents: 0 },
  { priceCents: -1 },
  { priceCents: 0.5 },
  { priceCents: Number.NaN },
  { cleaningFeeCents: -1 },
  { depositCents: 0.5 },
  { depositCents: Number.POSITIVE_INFINITY },
  { priceCents: Number.MAX_SAFE_INTEGER, depositCents: 1 },
])
  refused(
    patchRecord(tenant.state, tenant.id, {
      agreedTerms: {
        ...original.agreedTerms!,
        ...patch,
      } as ManagedSpaceBooking["agreedTerms"],
    }),
    tenant.id,
    end,
    "priceRequired",
  );
refused(
  patchRecord(tenant.state, tenant.id, { agreedTerms: undefined }),
  tenant.id,
  end,
  "status",
);
const midnight = new Date(2032, 4, 12, 0, 0);
assert.equal(
  spaceBookingActionIssue(
    tenant.state,
    "spaceOperator",
    tenant.id,
    { type: "complete" },
    midnight,
  ),
  null,
);
assert.equal(
  spaceBookingActionIssue(
    tenant.state,
    "spaceOperator",
    tenant.id,
    { type: "complete" },
    new Date(2032, 4, 11, 0, 0),
  ),
  "completionTime",
);
const originalZone = process.env.TZ;
try {
  process.env.TZ = "Europe/Madrid";
  const nonexistent = {
    ...original.agreedTerms!,
    date: "2032-03-28",
    start: "01:30",
    end: "02:30",
  };
  assert.equal(new Date("2032-03-28T02:30:00").getHours(), 3);
  assert.ok(
    Number.isNaN(spaceBookingEndTimestamp(nonexistent)),
    "A spring-forward wall-clock time must not silently normalize",
  );
  refused(
    patchRecord(tenant.state, tenant.id, { agreedTerms: nonexistent }),
    tenant.id,
    new Date("2032-03-29T12:00:00"),
    "completionTime",
  );
} finally {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
}

// A pending reschedule blocks completion, and accepted revised terms determine the real end boundary.
const owner = fixture("landlord");
const proposed = saveSpaceBookingProposal(
  updateSpaceBookingActionDraft(owner.state, "spaceOperator", owner.id, {
    date: "2032-05-11",
    start: "11:00",
    end: "12:30",
    price: "42.50",
    cleaningFee: "3",
    deposit: "10",
    note: "Please review the revised session.",
  }),
  "spaceOperator",
  owner.id,
  before,
);
assert.equal(proposed.issue, undefined);
assert.deepEqual(proposed.errors, {});
const proposal = booking(proposed.state, owner.id).proposal!;
refused(proposed.state, owner.id, new Date(2032, 4, 12), "status");
refused(
  patchRecord(proposed.state, owner.id, { phase: "Agreed" }),
  owner.id,
  new Date(2032, 4, 12),
  "status",
);
const revised = actOnSpaceBooking(
  proposed.state,
  "landlord",
  owner.id,
  { type: "accept-proposal", proposalId: proposal.id },
  before,
);
assert.notEqual(revised, proposed.state);
refused(revised, owner.id, end, "completionTime");
const revisedEnd = new Date(2032, 4, 11, 12, 30);
assert.equal(
  spaceBookingActionIssue(
    revised,
    "spaceOperator",
    owner.id,
    { type: "complete" },
    revisedEnd,
  ),
  null,
);

// Completion appends one real event and reveals History without consuming any private work or changing agreements.
for (const [state, id, role, at] of [
  [tenant.state, tenant.id, "tenant", end],
  [revised, owner.id, "landlord", revisedEnd],
] as const) {
  let retained = updateSpaceBookingDraft(state, role, 1, 12, {
    notes: privateNote,
  });
  retained = updateSpaceBookingActionDraft(retained, "spaceOperator", id, {
    note: privateNote,
  });
  retained = updateSpaceBookingActionDraft(retained, role, id, {
    note: privateNote,
  });
  retained = updateSpaceTimeBlockDraft(retained, "spaceOperator", 1, 12, {
    date: "2032-05-13",
    start: "10:00",
    end: "11:00",
    note: privateNote,
  });
  const blocked = createSpaceTimeBlock(
    retained,
    "spaceOperator",
    1,
    12,
    before,
  );
  assert.ok(blocked.blockId);
  retained = updateSpaceTimeBlockDraft(blocked.state, "spaceOperator", 1, 13, {
    note: privateNote,
  });
  retained = updateSpaceOperatorInboxView(retained, "spaceOperator", {
    query: "No matching row",
    filter: "pending",
    selectedId: null,
  });
  const prior = booking(retained, id);
  const priorJSON = JSON.stringify(retained);
  const readFeed = markAllNotificationsRead(
    reconcileSpaceBookingNotifications(seeds, retained),
    role,
  );
  const finished = actOnSpaceBooking(
    retained,
    "spaceOperator",
    id,
    { type: "complete" },
    at,
  );
  assert.notEqual(finished, retained);
  const record = booking(finished, id);
  assert.equal(record.phase, "Completed");
  assert.equal(record.status, "Completed");
  assert.equal(record.updatedAt, at.toISOString());
  assert.equal(record.requestedTerms, prior.requestedTerms);
  assert.equal(record.agreedTerms, prior.agreedTerms);
  assert.equal(record.proposals, prior.proposals);
  assert.equal(record.notes, prior.notes);
  assert.equal(record.participants, prior.participants);
  assert.equal(record.price, prior.price);
  assert.equal(record.history.length, prior.history.length + 1);
  assert.deepEqual(record.history.slice(0, -1), prior.history);
  assert.deepEqual(record.history.at(-1), {
    id: `${id}-event-${prior.history.length + 1}`,
    source: "local",
    action: "completed",
    actor: "Poblenou MultiSport Club",
    at: at.toISOString(),
  });
  for (const key of [
    "requestDrafts",
    "actionDrafts",
    "timeBlocks",
    "timeBlockDrafts",
    "scheduleView",
    "views",
  ] as const)
    assert.equal(finished[key], retained[key], `Completion preserves ${key}`);
  assert.equal(finished.filter, retained.filter);
  assert.equal(finished.selectedId, retained.selectedId);
  for (const other of retained.bookings.filter((item) => item.id !== id))
    assert.equal(booking(finished, other.id), other);
  assert.deepEqual(spaceOperatorInboxView(finished, "spaceOperator"), {
    query: "",
    filter: "history",
    selectedId: id,
  });
  assert.equal(JSON.stringify(retained), priorJSON);
  const counts = spaceBookingCounts(finished, role);
  const previousCounts = spaceBookingCounts(retained, role);
  assert.equal(counts.total, previousCounts.total);
  assert.equal(counts.completed, previousCounts.completed + 1);
  assert.equal(counts.agreed, previousCounts.agreed - 1);
  assert.ok(
    visibleSpaceBookings(
      filterSpaceBookings(finished, "Completed", role),
      role,
    ).some((item) => item.id === id),
  );
  assert.equal(
    visibleSpaceBookings(
      filterSpaceBookings(finished, "Upcoming", role),
      role,
    ).some((item) => item.id === id),
    false,
  );

  // A fresh local completion targets only the canonical customer and preserves prior receipts and timestamps.
  const feed = reconcileSpaceBookingNotifications(readFeed, finished);
  const [notice] = notices(feed, id);
  assert.ok(notice);
  assert.equal(notices(feed, id).length, 1);
  assert.equal(notice.role, role);
  assert.equal(notice.destination, "spaceBookings");
  assert.equal(notice.read, false);
  assert.equal(notice.spaceBookingEvent!.occurredAt, at.toISOString());
  assert.deepEqual(
    Object.keys(notice.spaceBookingEvent!).sort(),
    ["kind", "bookingId", "venueName", "spaceName", "occurredAt"].sort(),
  );
  assert.equal(JSON.stringify(notice).includes(privateNote), false);
  for (const item of readFeed.items)
    assert.equal(
      feed.items.find((entry) => entry.id === item.id)?.read,
      item.read,
    );
  assert.equal(reconcileSpaceBookingNotifications(feed, finished), feed);
  const readAgain = markAllNotificationsRead(feed, role);
  assert.equal(
    notices(reconcileSpaceBookingNotifications(readAgain, finished), id)[0]
      .read,
    true,
  );
  const opened = openSpaceBookingNotification(
    filterSpaceBookings(finished, "Requested", role),
    role,
    notice,
  );
  assert.ok(opened);
  assert.equal(selectedSpaceBooking(opened.state, role)?.id, id);
  assert.equal(booking(opened.state, id), record);
  assert.equal(opened.state.bookings, finished.bookings);
  for (const other of roles.filter((value) => value !== role)) {
    assert.equal(openSpaceBookingNotification(finished, other, notice), null);
    assert.deepEqual(
      spaceBookingView(opened.state, other),
      spaceBookingView(finished, other),
    );
  }

  // Terminal records and failed or repeated actions cannot create another completion or consume drafts.
  refused(finished, id, at, "status");
  assert.equal(
    actOnSpaceBooking(
      finished,
      role,
      id,
      { type: "cancel", note: "No longer valid" },
      at,
    ),
    finished,
  );
  assert.equal(
    actOnSpaceBooking(
      finished,
      "spaceOperator",
      id,
      { type: "accept-request" },
      at,
    ),
    finished,
  );
  assert.equal(
    actOnSpaceBooking(
      finished,
      "spaceOperator",
      id,
      { type: "decline-request", note: "No longer valid" },
      at,
    ),
    finished,
  );
  assert.equal(
    actOnSpaceBooking(
      finished,
      role,
      id,
      { type: "keep-original", proposalId: prior.proposal?.id ?? "missing" },
      at,
    ),
    finished,
  );
  assert.equal(
    actOnSpaceBooking(
      finished,
      role,
      id,
      { type: "accept-proposal", proposalId: prior.proposal?.id ?? "missing" },
      at,
    ),
    finished,
  );
  assert.equal(
    updateSpaceBookingActionDraft(finished, "spaceOperator", id, {
      note: "Cannot edit closed record",
    }),
    finished,
  );
  assert.equal(
    saveSpaceBookingProposal(finished, "spaceOperator", id, at).state,
    finished,
  );

  const completion = record.history.at(-1)!;
  for (const patch of [
    { phase: "Agreed" as const },
    { updatedAt: before.toISOString() },
    { agreedTerms: undefined },
    { agreedTerms: { ...record.agreedTerms!, priceCents: -1 } },
    {
      agreedTerms: {
        ...record.agreedTerms!,
        priceCents: record.agreedTerms!.priceCents + 1,
      },
    },
    { history: record.history.filter((event) => event.action !== "requested") },
    { history: [completion, ...record.history.slice(0, -1)] },
    {
      history: [
        ...record.history,
        { ...completion, id: "ambiguous-second-completion" },
      ],
    },
    {
      history: record.history.filter(
        (event) =>
          event.action !== "accepted" && event.action !== "proposal-accepted",
      ),
    },
    {
      history: record.history.map((event) =>
        event.id === completion.id
          ? { ...event, source: "sample" as const }
          : event,
      ),
    },
    {
      history: record.history.map((event) =>
        event.id === completion.id
          ? { ...event, actor: record.customerName }
          : event,
      ),
    },
    {
      history: record.history.map((event) =>
        event.id === completion.id ? { ...event, at: "invalid" } : event,
      ),
    },
    {
      history: record.history.map((event) =>
        event.id === completion.id ? { ...event, id: "" } : event,
      ),
    },
    {
      history: record.history.map((event) =>
        event.action === "accepted" || event.action === "proposal-accepted"
          ? { ...event, actor: "Forged agreement" }
          : event,
      ),
    },
    { venueId: 2, spaceId: 21 },
    { customerName: "Other customer" },
  ] as Partial<ManagedSpaceBooking>[]) {
    const invalid = patchRecord(finished, id, patch);
    assert.equal(
      notices(reconcileSpaceBookingNotifications(feed, invalid), id).length,
      0,
    );
    assert.equal(openSpaceBookingNotification(invalid, role, notice), null);
  }
  const premature = patchRecord(finished, id, {
    updatedAt: before.toISOString(),
    history: record.history.map((event) =>
      event.id === completion.id
        ? { ...event, at: before.toISOString() }
        : event,
    ),
  });
  assert.equal(
    notices(reconcileSpaceBookingNotifications(feed, premature), id).length,
    0,
  );
}

// Seed completion remains suppressed; a later explicit completion of an ended sample agreement is local activity.
assert.equal(
  notices(reconcileSpaceBookingNotifications(seeds, initial)).length,
  0,
);
const sample = initial.bookings.find((record) => record.venueId === 1)!;
const sampleEnd = new Date(spaceBookingEndTimestamp(sample.agreedTerms!));
const sampleFinished = actOnSpaceBooking(
  initial,
  "spaceOperator",
  sample.id,
  { type: "complete" },
  sampleEnd,
);
assert.notEqual(sampleFinished, initial);
const sampleFeed = reconcileSpaceBookingNotifications(seeds, sampleFinished);
assert.equal(notices(sampleFeed, sample.id).length, 1);
assert.equal(
  sampleFeed.items.filter((item) => item.spaceBookingEvent).length,
  1,
);
assert.equal(notices(sampleFeed, sample.id)[0].role, "tenant");

console.log(
  "Space booking completion checks passed: explicit ended-time transition, scope/terms/boundary guards, immutable retained state, exact History reveal and genuine private completion notifications.",
);
