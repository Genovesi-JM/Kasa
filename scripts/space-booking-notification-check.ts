import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  type KasaNotification,
  type NotificationState,
} from "../src/components/notificationState";
import {
  openSpaceBookingNotification,
  reconcileSpaceBookingNotifications,
} from "../src/components/spaceBookingNotifications";
import {
  actOnSpaceBooking,
  createInitialSpaceBookingsState,
  createSpaceBookingRequest,
  createSpaceTimeBlock,
  filterSpaceBookings,
  saveSpaceBookingProposal,
  revealSpaceOperatorBooking,
  selectedSpaceBooking,
  spaceBookingView,
  spaceOperatorInboxView,
  updateSpaceBookingActionDraft,
  updateSpaceBookingDraft,
  updateSpaceOperatorInboxView,
  updateSpaceTimeBlockDraft,
  type ManagedSpaceBooking,
  type SpaceBookingsState,
  type SpaceBookingAction,
  type SpaceOperatorInboxView,
} from "../src/components/spaceBookingsState";
import { reconcileWorkNotifications } from "../src/components/workNotifications";
import {
  createInitialWorkState,
  submitWorkApplication,
  updateWorkApplicationDraft,
} from "../src/components/workState";
import { reconcileServiceNotifications } from "../src/components/serviceNotifications";
import {
  createInitialServiceRequestState,
  saveServiceRequest,
  updateServiceRequestDraft,
  workspaceServiceProvider,
} from "../src/components/serviceRequestState";

const time = (minute: number) =>
  new Date(`2032-05-10T12:${String(minute).padStart(2, "0")}:00.000Z`);
const initial = createInitialSpaceBookingsState(time(0));
const seeds = createInitialNotificationState();
const privateNote = "PRIVATE_DETAILS: access, attendees and personal plans";
const roles: Role[] = [
  "tenant",
  "landlord",
  "spaceOperator",
  "provider",
  "admin",
];
type SpaceKind = NonNullable<KasaNotification["spaceBookingEvent"]>["kind"];
const activity = (state: NotificationState) =>
  state.items.filter((item) => item.spaceBookingEvent);
function booking(state: SpaceBookingsState, id: string) {
  const result = state.bookings.find((item) => item.id === id);
  assert.ok(result);
  return result;
}
function eventOf(
  state: NotificationState,
  id: string,
  kind: SpaceKind,
  minute?: number,
) {
  const result = activity(state).find(
    (item) =>
      item.spaceBookingEvent!.bookingId === id &&
      item.spaceBookingEvent!.kind === kind &&
      (minute === undefined ||
        item.spaceBookingEvent!.occurredAt === time(minute).toISOString()),
  );
  assert.ok(result, `Expected ${kind} for ${id}`);
  return result;
}
function request(
  state: SpaceBookingsState,
  role: "tenant" | "landlord",
  minute: number,
  venueId = 1,
  spaceId = 11,
) {
  const result = createSpaceBookingRequest(
    updateSpaceBookingDraft(state, role, venueId, spaceId, {
      date: "2032-05-15",
      start: "08:00",
      end: "09:30",
      participants: "4",
      notes: privateNote,
    }),
    role,
    venueId,
    spaceId,
    time(minute),
  );
  assert.deepEqual(result.errors, {});
  assert.equal(result.issue, undefined);
  assert.ok(result.bookingId);
  return { state: result.state, id: result.bookingId };
}
function propose(
  state: SpaceBookingsState,
  id: string,
  minute: number,
  start: string,
) {
  const result = saveSpaceBookingProposal(
    updateSpaceBookingActionDraft(state, "spaceOperator", id, {
      date: "2032-05-16",
      start,
      end: "16:00",
      price: "123.45",
      cleaningFee: "0",
      deposit: "0",
      note: privateNote,
    }),
    "spaceOperator",
    id,
    time(minute),
  );
  assert.deepEqual(result.errors, {});
  assert.equal(result.issue, undefined);
  assert.notEqual(result.state, state);
  return {
    state: result.state,
    proposalId: booking(result.state, id).proposal!.id,
  };
}
function act(
  state: SpaceBookingsState,
  role: Role,
  id: string,
  action: SpaceBookingAction,
  minute: number,
) {
  const result = actOnSpaceBooking(state, role, id, action, time(minute));
  assert.notEqual(result, state, `Expected ${action.type} to succeed`);
  return result;
}
function only(record: ManagedSpaceBooking): SpaceBookingsState {
  return { ...initial, bookings: [record] };
}

// Every factory event is sample data; typing or recording private schedule blocks creates no alerts.
assert.ok(
  initial.bookings.every((item) =>
    item.history.every((event) => event.source === "sample"),
  ),
);
assert.equal(reconcileSpaceBookingNotifications(seeds, initial), seeds);
const sample = initial.bookings.find((item) => item.venueId === 1)!;
const drafted = updateSpaceBookingActionDraft(
  updateSpaceBookingDraft(initial, "tenant", 1, 11, { notes: privateNote }),
  "spaceOperator",
  sample.id,
  { note: privateNote },
);
const blocked = createSpaceTimeBlock(
  updateSpaceTimeBlockDraft(drafted, "spaceOperator", 1, 11, {
    date: "2032-05-20",
    start: "08:00",
    end: "09:00",
    note: privateNote,
  }),
  "spaceOperator",
  1,
  11,
  time(0),
);
assert.ok(blocked.blockId);
assert.equal(reconcileSpaceBookingNotifications(seeds, blocked.state), seeds);
assert.equal(
  createSpaceBookingRequest(drafted, "tenant", 1, 11, time(0)).state,
  drafted,
);

// A real submission, historical proposal revisions and explicit decisions yield exactly seven event kinds.
const tenant = request(initial, "tenant", 0);
const submission = eventOf(
  reconcileSpaceBookingNotifications(seeds, tenant.state),
  tenant.id,
  "request-submitted",
  0,
);
assert.equal(submission.role, "spaceOperator");
assert.equal(submission.destination, "spaceOperator");
const first = propose(tenant.state, tenant.id, 1, "13:00");
const second = propose(first.state, tenant.id, 2, "14:00");
const oldProposalRead = markNotificationRead(
  reconcileSpaceBookingNotifications(seeds, first.state),
  "tenant",
  eventOf(
    reconcileSpaceBookingNotifications(seeds, first.state),
    tenant.id,
    "proposal-recorded",
    1,
  ).id,
);
const revisedFeed = reconcileSpaceBookingNotifications(
  oldProposalRead,
  second.state,
);
assert.equal(
  eventOf(revisedFeed, tenant.id, "proposal-recorded", 1).read,
  true,
);
assert.equal(
  eventOf(revisedFeed, tenant.id, "proposal-recorded", 2).read,
  false,
);
assert.equal(
  booking(second.state, tenant.id).proposals[0].status,
  "superseded",
);
assert.equal(
  actOnSpaceBooking(
    second.state,
    "tenant",
    tenant.id,
    { type: "accept-proposal", proposalId: first.proposalId },
    time(3),
  ),
  second.state,
);
const kept = act(
  second.state,
  "tenant",
  tenant.id,
  { type: "keep-original", proposalId: second.proposalId },
  3,
);
const accepted = act(
  kept,
  "spaceOperator",
  tenant.id,
  { type: "accept-request" },
  4,
);
const third = propose(accepted, tenant.id, 5, "12:00");
const changed = act(
  third.state,
  "tenant",
  tenant.id,
  { type: "accept-proposal", proposalId: third.proposalId },
  6,
);
const cancelled = act(
  changed,
  "tenant",
  tenant.id,
  { type: "cancel", note: privateNote },
  7,
);
const owner = request(cancelled, "landlord", 8);
const declined = act(
  owner.state,
  "spaceOperator",
  owner.id,
  { type: "decline-request", note: privateNote },
  9,
);
const foreign = request(declined, "tenant", 10, 2, 21);
const finalState = act(
  foreign.state,
  "tenant",
  sample.id,
  { type: "cancel", note: privateNote },
  11,
);
const feed = reconcileSpaceBookingNotifications(revisedFeed, finalState);
assert.deepEqual(
  [
    ...new Set(activity(feed).map((item) => item.spaceBookingEvent!.kind)),
  ].sort(),
  [
    "request-submitted",
    "request-accepted",
    "request-declined",
    "proposal-recorded",
    "proposal-accepted",
    "proposal-declined",
    "request-cancelled",
  ].sort(),
);
assert.equal(activity(feed).length, 11);
assert.equal(
  activity(feed).filter(
    (item) => item.spaceBookingEvent!.bookingId === sample.id,
  ).length,
  1,
);
assert.equal(
  activity(feed).some(
    (item) => item.spaceBookingEvent!.bookingId === foreign.id,
  ),
  false,
);
assert.equal(eventOf(feed, tenant.id, "request-accepted", 4).role, "tenant");
assert.equal(eventOf(feed, owner.id, "request-declined", 9).role, "landlord");
for (const kind of [
  "proposal-accepted",
  "proposal-declined",
  "request-cancelled",
] as const)
  assert.equal(eventOf(feed, tenant.id, kind).role, "spaceOperator");
assert.equal(eventOf(feed, tenant.id, "proposal-recorded", 1).read, true);
assert.equal(booking(finalState, tenant.id).proposals[2].status, "accepted");
assert.equal(booking(finalState, tenant.id).phase, "Cancelled");
const realSampleProposal = propose(initial, sample.id, 12, "13:00");
assert.equal(
  activity(reconcileSpaceBookingNotifications(seeds, realSampleProposal.state))
    .length,
  1,
);
assert.equal(
  eventOf(
    reconcileSpaceBookingNotifications(seeds, realSampleProposal.state),
    sample.id,
    "proposal-recorded",
    12,
  ).role,
  "tenant",
);

// Exact payload allow-list: notes, customer identity, participants, terms and unsent drafts stay out of the feed.
for (const item of activity(feed)) {
  assert.deepEqual(
    Object.keys(item.spaceBookingEvent!).sort(),
    ["kind", "bookingId", "venueName", "spaceName", "occurredAt"].sort(),
  );
  assert.equal(item.spaceBookingEvent!.venueName, "Poblenou MultiSport Club");
  assert.equal(
    item.destination,
    item.role === "spaceOperator" ? "spaceOperator" : "spaceBookings",
  );
  assert.ok(item.id.startsWith("space-booking:"));
}
const serialized = JSON.stringify(activity(feed));
for (const secret of [
  privateNote,
  "Inês Duarte",
  "Olivia Martín",
  "12345",
  "participants",
  "actionDrafts",
  "requestedTerms",
])
  assert.equal(
    serialized.includes(secret),
    false,
    `Feed must exclude ${secret}`,
  );

// Canonical source identity and both workspace scopes are required, regardless of labels in the record.
const original = booking(tenant.state, tenant.id);
const canonicalLabels = activity(
  reconcileSpaceBookingNotifications(
    seeds,
    only({ ...original, venue: privateNote, space: privateNote }),
  ),
)[0].spaceBookingEvent!;
assert.equal(canonicalLabels.venueName, "Poblenou MultiSport Club");
assert.equal(canonicalLabels.spaceName, "Court 1");
for (const patch of [
  { venueId: 2, spaceId: 21 },
  { venueId: 1, spaceId: 21 },
  { venueId: 999 },
  { spaceId: 999 },
  { customerName: "Other customer" },
  { customerRole: "landlord" as const },
  { customerRole: "provider" as ManagedSpaceBooking["customerRole"] },
  { source: "unknown" as ManagedSpaceBooking["source"] },
] as Partial<ManagedSpaceBooking>[])
  assert.equal(
    activity(
      reconcileSpaceBookingNotifications(
        seeds,
        only({ ...original, ...patch }),
      ),
    ).length,
    0,
  );
for (const patch of [
  { source: "sample" as const },
  { actor: "Forged actor" },
  { id: "" },
  { id: " " },
  { at: "not-a-date" },
  { at: "2032-05-10T12:00:00Z" },
  { at: time(30).toISOString() },
]) {
  const invalid = {
    ...original,
    history: original.history.map((event) => ({ ...event, ...patch })),
  };
  assert.equal(
    activity(reconcileSpaceBookingNotifications(seeds, only(invalid))).length,
    0,
  );
}
assert.equal(
  activity(
    reconcileSpaceBookingNotifications(
      seeds,
      only({ ...original, history: [] }),
    ),
  ).length,
  0,
);
const proposalRecord = booking(first.state, tenant.id);
const decisionRecord = booking(changed, tenant.id);
for (const [record, action, kind] of [
  [proposalRecord, "proposed", "proposal-recorded"],
  [decisionRecord, "proposal-accepted", "proposal-accepted"],
  [booking(kept, tenant.id), "proposal-declined", "proposal-declined"],
] as const) {
  for (const patch of [
    { proposalId: "missing" },
    { actor: "Forged actor" },
    { at: time(35).toISOString() },
    { source: "sample" as const },
  ]) {
    const invalid = {
      ...record,
      history: record.history.map((event) =>
        event.action === action ? { ...event, ...patch } : event,
      ),
    };
    assert.equal(
      activity(reconcileSpaceBookingNotifications(seeds, only(invalid))).some(
        (item) => item.spaceBookingEvent!.kind === kind,
      ),
      false,
    );
  }
}
for (const [record, kind, status] of [
  [decisionRecord, "proposal-accepted", "declined"],
  [booking(kept, tenant.id), "proposal-declined", "accepted"],
] as const) {
  const invalid = {
    ...record,
    proposals: record.proposals.map((proposal) =>
      proposal.id === record.proposal!.id ? { ...proposal, status } : proposal,
    ),
  };
  assert.equal(
    activity(reconcileSpaceBookingNotifications(seeds, only(invalid))).some(
      (item) => item.spaceBookingEvent!.kind === kind,
    ),
    false,
  );
}
// An unlinked or reordered proposal decision cannot impersonate an actual recorded agreement.
for (const history of [
  decisionRecord.history.filter(
    (event) =>
      event.proposalId !== third.proposalId || event.action !== "proposed",
  ),
  [decisionRecord.history.at(-1)!, ...decisionRecord.history.slice(0, -1)],
])
  assert.equal(
    activity(
      reconcileSpaceBookingNotifications(
        seeds,
        only({ ...decisionRecord, history }),
      ),
    ).some((item) => item.spaceBookingEvent!.kind === "proposal-accepted"),
    false,
  );
for (const patch of [
  { agreedTerms: undefined },
  { requestedTerms: { ...decisionRecord.requestedTerms, priceCents: null } },
  {
    history: decisionRecord.history.map((event) =>
      event.action === "accepted"
        ? { ...event, actor: decisionRecord.customerName }
        : event,
    ),
  },
] as Partial<ManagedSpaceBooking>[])
  assert.equal(
    activity(
      reconcileSpaceBookingNotifications(
        seeds,
        only({ ...decisionRecord, ...patch }),
      ),
    ).some((item) => item.spaceBookingEvent!.kind === "request-accepted"),
    false,
  );
for (const [record, action, kind] of [
  [booking(finalState, tenant.id), "cancelled", "request-cancelled"],
  [booking(finalState, owner.id), "declined", "request-declined"],
] as const) {
  for (const patch of [
    { phase: "Requested" as const },
    { updatedAt: time(40).toISOString() },
    {
      history: record.history.map((event) =>
        event.action === action ? { ...event, actor: "Forged actor" } : event,
      ),
    },
  ] as Partial<ManagedSpaceBooking>[])
    assert.equal(
      activity(
        reconcileSpaceBookingNotifications(
          seeds,
          only({ ...record, ...patch }),
        ),
      ).some((item) => item.spaceBookingEvent!.kind === kind),
      false,
    );
}
const ambiguous = {
  ...original,
  history: [
    ...original.history,
    { ...original.history[0], actor: "Conflicting actor" },
  ],
};
assert.equal(
  activity(reconcileSpaceBookingNotifications(seeds, only(ambiguous))).length,
  0,
);
// A status flag and unlinked history alone are not a genuine completed agreement.
const unlinkedCompletion = {
  ...original,
  phase: "Completed" as const,
  history: [
    ...original.history,
    {
      id: "unlinked-completion",
      source: "local" as const,
      at: time(25).toISOString(),
      actor: "Poblenou MultiSport Club",
      action: "completed" as const,
    },
  ],
};
assert.equal(
  activity(reconcileSpaceBookingNotifications(seeds, only(unlinkedCompletion)))
    .length,
  1,
);

// Stable IDs, duplicate-safe receipts, new unread events and pruning apply only to this namespace.
assert.equal(reconcileSpaceBookingNotifications(feed, finalState), feed);
assert.deepEqual(
  activity(reconcileSpaceBookingNotifications(seeds, finalState)).map(
    (item) => item.id,
  ),
  activity(feed).map((item) => item.id),
);
let allRead = feed;
for (const role of roles) allRead = markAllNotificationsRead(allRead, role);
assert.ok(activity(allRead).every((item) => item.read));
const nextRequest = request(finalState, "landlord", 13, 1, 12);
const laterFeed = reconcileSpaceBookingNotifications(
  allRead,
  nextRequest.state,
);
assert.equal(activity(laterFeed).filter((item) => !item.read).length, 1);
const receipt = eventOf(allRead, tenant.id, "request-submitted");
const duplicateFeed = reconcileSpaceBookingNotifications(
  {
    items: [
      ...allRead.items,
      { ...receipt, role: "tenant", read: false },
      { ...receipt, read: false },
    ],
  },
  finalState,
);
assert.equal(eventOf(duplicateFeed, tenant.id, "request-submitted").read, true);
assert.equal(activity(duplicateFeed).length, activity(feed).length);
const repeatedHistory = {
  ...finalState,
  bookings: finalState.bookings.map((item) => ({
    ...item,
    history: [...item.history, ...item.history.map((event) => ({ ...event }))],
  })),
};
assert.equal(
  activity(reconcileSpaceBookingNotifications(feed, repeatedHistory)).length,
  activity(feed).length,
);
const pruned = reconcileSpaceBookingNotifications(feed, {
  ...initial,
  bookings: [],
});
assert.deepEqual(
  pruned.items,
  feed.items.filter((item) => !item.spaceBookingEvent),
);
assert.equal(
  reconcileSpaceBookingNotifications(feed, {
    ...finalState,
    bookings: finalState.bookings.map((item) => ({ ...item, history: [] })),
  }).items.some((item) => item.spaceBookingEvent),
  false,
);

// Operator list preferences are detached, scoped and retained; only deliberate reveal clears constraints.
const defaultOperatorView = { query: "", filter: "pending", selectedId: null };
assert.deepEqual(
  spaceOperatorInboxView(initial, "spaceOperator"),
  defaultOperatorView,
);
const detached = spaceOperatorInboxView(initial, "spaceOperator");
detached.query = "Mutating a read must not change retained state";
assert.deepEqual(
  spaceOperatorInboxView(initial, "spaceOperator"),
  defaultOperatorView,
);
assert.notEqual(
  initial.operatorInboxView,
  createInitialSpaceBookingsState(time(0)).operatorInboxView,
);
const patch: Partial<SpaceOperatorInboxView> = {
  query: "  Missing search  ",
  filter: "history",
  selectedId: owner.id,
};
const retainedView = updateSpaceOperatorInboxView(
  finalState,
  "spaceOperator",
  patch,
);
patch.query = "External mutation";
assert.deepEqual(spaceOperatorInboxView(retainedView, "spaceOperator"), {
  query: "  Missing search  ",
  filter: "history",
  selectedId: owner.id,
});
assert.equal(
  updateSpaceOperatorInboxView(
    retainedView,
    "spaceOperator",
    spaceOperatorInboxView(retainedView, "spaceOperator"),
  ),
  retainedView,
);
assert.equal(
  updateSpaceOperatorInboxView(retainedView, "spaceOperator", {
    query: 5,
    filter: "History",
    selectedId: foreign.id,
  } as unknown as Partial<SpaceOperatorInboxView>),
  retainedView,
);
const mixedPatch = updateSpaceOperatorInboxView(retainedView, "spaceOperator", {
  query: "  Kept whitespace ",
  filter: "invalid",
  selectedId: "unavailable",
} as unknown as Partial<SpaceOperatorInboxView>);
assert.deepEqual(spaceOperatorInboxView(mixedPatch, "spaceOperator"), {
  query: "  Kept whitespace ",
  filter: "history",
  selectedId: owner.id,
});
assert.equal(
  spaceOperatorInboxView(
    updateSpaceOperatorInboxView(retainedView, "spaceOperator", {
      query: "x".repeat(230),
    }),
    "spaceOperator",
  ).query.length,
  200,
);
assert.equal(
  spaceOperatorInboxView(
    updateSpaceOperatorInboxView(retainedView, "spaceOperator", {
      selectedId: null,
    }),
    "spaceOperator",
  ).selectedId,
  null,
);
for (const filter of ["pending", "agreed", "history", "all"] as const)
  assert.equal(
    spaceOperatorInboxView(
      updateSpaceOperatorInboxView(retainedView, "spaceOperator", { filter }),
      "spaceOperator",
    ).filter,
    filter,
  );
for (const role of roles.filter((value) => value !== "spaceOperator")) {
  assert.deepEqual(
    spaceOperatorInboxView(retainedView, role),
    defaultOperatorView,
  );
  assert.equal(
    updateSpaceOperatorInboxView(retainedView, role, {
      query: "foreign",
      selectedId: tenant.id,
    }),
    retainedView,
  );
  assert.equal(
    revealSpaceOperatorBooking(retainedView, role, tenant.id),
    retainedView,
  );
}
assert.equal(
  revealSpaceOperatorBooking(retainedView, "spaceOperator", foreign.id),
  retainedView,
);
assert.equal(
  revealSpaceOperatorBooking(retainedView, "spaceOperator", "missing"),
  retainedView,
);
const revealed = revealSpaceOperatorBooking(
  retainedView,
  "spaceOperator",
  tenant.id,
);
assert.deepEqual(spaceOperatorInboxView(revealed, "spaceOperator"), {
  query: "",
  filter: "all",
  selectedId: tenant.id,
});
assert.equal(
  revealSpaceOperatorBooking(revealed, "spaceOperator", tenant.id),
  revealed,
);
assert.equal(revealed.bookings, retainedView.bookings);
assert.equal(revealed.requestDrafts, retainedView.requestDrafts);
assert.equal(revealed.actionDrafts, retainedView.actionDrafts);
assert.equal(revealed.views, retainedView.views);
assert.equal(
  updateSpaceBookingDraft(retainedView, "tenant", 1, 11, {
    notes: "Retained without affecting inbox",
  }).operatorInboxView,
  retainedView.operatorInboxView,
);
const viewDuringAction = updateSpaceOperatorInboxView(
  tenant.state,
  "spaceOperator",
  { query: "Retained", filter: "all", selectedId: tenant.id },
);
assert.equal(
  propose(viewDuringAction, tenant.id, 1, "13:00").state.operatorInboxView,
  viewDuringAction.operatorInboxView,
);
assert.equal(
  act(
    viewDuringAction,
    "spaceOperator",
    tenant.id,
    { type: "accept-request" },
    1,
  ).operatorInboxView,
  viewDuringAction.operatorInboxView,
);

// Openers re-resolve source identity and reveal current history without performing an action.
let obstructed = retainedView;
for (const role of ["tenant", "landlord", "spaceOperator"] as const)
  obstructed = filterSpaceBookings(obstructed, "Completed", role);
for (const [notice, role, id] of [
  [eventOf(feed, tenant.id, "proposal-recorded", 1), "tenant", tenant.id],
  [eventOf(feed, owner.id, "request-declined"), "landlord", owner.id],
  [submission, "spaceOperator", tenant.id],
] as const) {
  const opened = openSpaceBookingNotification(obstructed, role, notice);
  assert.ok(opened);
  assert.equal(
    opened.destination,
    role === "spaceOperator" ? "spaceOperator" : "spaceBookings",
  );
  assert.equal(opened.state.bookings, obstructed.bookings);
  assert.equal(opened.state.requestDrafts, obstructed.requestDrafts);
  assert.equal(opened.state.actionDrafts, obstructed.actionDrafts);
  if (role !== "spaceOperator") {
    assert.equal(selectedSpaceBooking(opened.state, role)?.id, id);
    assert.equal(opened.state.operatorInboxView, obstructed.operatorInboxView);
  } else
    assert.deepEqual(spaceOperatorInboxView(opened.state, role), {
      query: "",
      filter: "all",
      selectedId: id,
    });
  for (const other of roles.filter((value) => value !== role))
    assert.deepEqual(
      spaceBookingView(opened.state, other),
      spaceBookingView(obstructed, other),
    );
  for (const other of roles.filter((value) => value !== role))
    assert.equal(openSpaceBookingNotification(obstructed, other, notice), null);
  assert.equal(
    openSpaceBookingNotification({ ...obstructed, bookings: [] }, role, notice),
    null,
  );
}
assert.equal(
  openSpaceBookingNotification(finalState, "spaceOperator", {
    ...submission,
    id: "space-booking:forged",
  }),
  null,
);
const redirected = openSpaceBookingNotification(obstructed, "tenant", {
  ...eventOf(feed, tenant.id, "proposal-recorded", 1),
  destination: "provider",
  spaceBookingEvent: {
    ...eventOf(feed, tenant.id, "proposal-recorded", 1).spaceBookingEvent!,
    bookingId: foreign.id,
    kind: "request-cancelled",
    venueName: "Forged",
    occurredAt: time(59).toISOString(),
  },
});
assert.ok(redirected);
assert.equal(selectedSpaceBooking(redirected.state, "tenant")?.id, tenant.id);

// A real Work + Services + Spaces reconciliation chain shares chronology without losing reads or seeds.
const work = submitWorkApplication(
  updateWorkApplicationDraft(
    createInitialWorkState(),
    "tenant",
    "work-volt-electrical",
    {
      introduction: "A real local application used to check activity ordering.",
      availability: "Immediately",
    },
  ),
  "tenant",
  "work-volt-electrical",
  time(14),
);
assert.ok(work.applicationId);
const services = saveServiceRequest(
  updateServiceRequestDraft(
    createInitialServiceRequestState(time(0)),
    "tenant",
    {
      propertyId: "1",
      category: "Electrical",
      providerName: workspaceServiceProvider,
      title: "Local outlet repair",
      description: "Inspect the electrical outlet and explain the next steps.",
      preferredDate: "2032-05-15",
      preferredTime: "10:00",
    },
    workspaceServiceProvider,
  ),
  "tenant",
  workspaceServiceProvider,
  time(15),
);
assert.ok(services.requestId);
const otherFeed = reconcileServiceNotifications(
  reconcileWorkNotifications(allRead, work.state),
  services.state,
);
const mixed = reconcileSpaceBookingNotifications(otherFeed, nextRequest.state);
const at = (item: KasaNotification) =>
  item.spaceBookingEvent?.occurredAt ??
  item.serviceEvent?.occurredAt ??
  item.workEvent?.occurredAt;
const mixedActivity = mixed.items.filter((item) => at(item));
assert.deepEqual(
  mixedActivity,
  [...mixedActivity].sort(
    (a, b) =>
      at(b)!.localeCompare(at(a)!) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  ),
);
assert.ok(mixed.items.some((item) => item.workEvent));
assert.ok(mixed.items.some((item) => item.serviceEvent));
assert.equal(eventOf(mixed, tenant.id, "proposal-recorded", 1).read, true);
assert.deepEqual(
  mixed.items.filter((item) => !at(item)),
  otherFeed.items.filter((item) => !at(item)),
);

console.log(
  "Spaces notification checks passed: genuine scoped history, safe payloads, stable receipts and chronology, exact guarded current-record navigation.",
);
