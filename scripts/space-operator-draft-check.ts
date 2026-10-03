import assert from "node:assert/strict";
import {
  createInitialNotificationState,
  markNotificationRead,
} from "../src/components/notificationState";
import { reconcileSpaceBookingNotifications } from "../src/components/spaceBookingNotifications";
import {
  actOnSpaceBooking,
  createInitialSpaceBookingsState,
  createSpaceBookingRequest,
  discardSpaceBookingOperatorDraft,
  filterSpaceBookings,
  hasSpaceBookingOperatorDraft,
  saveSpaceBookingProposal,
  spaceBookingActionDraft,
  spaceBookingActionIssue,
  updateSpaceBookingActionDraft,
  updateSpaceBookingDraft,
  updateSpaceOperatorInboxView,
  updateSpaceTimeBlockDraft,
  type SpaceBookingActionDraft,
  type SpaceBookingCustomerRole,
  type SpaceBookingsState,
} from "../src/components/spaceBookingsState";
import type { Role } from "../src/types";

const now = new Date(2032, 4, 10, 12);
const at = (minute: number) => new Date(now.getTime() + minute * 60_000);
const initial = createInitialSpaceBookingsState(now);
const initialJson = JSON.stringify(initial);
const blank: SpaceBookingActionDraft = {
  date: "",
  start: "",
  end: "",
  price: "",
  cleaningFee: "",
  deposit: "",
  note: "",
};
const raw: SpaceBookingActionDraft = {
  date: "unfinished date",
  start: " ",
  end: "25:90",
  price: " 1.005 ",
  cleaningFee: "-5",
  deposit: "unfinished",
  note: " PRIVATE unsent operator proposal\nwith a second line. ",
};
const validProposal: SpaceBookingActionDraft = {
  date: "2032-05-12",
  start: "10:00",
  end: "11:30",
  price: " 35,50 ",
  cleaningFee: "2",
  deposit: "10",
  note: "  I propose this alternative time and complete price.  ",
};
function request(
  state: SpaceBookingsState,
  role: SpaceBookingCustomerRole,
  date: string,
) {
  const result = createSpaceBookingRequest(
    updateSpaceBookingDraft(state, role, 1, 11, {
      date,
      start: "08:00",
      end: "09:30",
      participants: "2",
      notes: "Private customer request context",
    }),
    role,
    1,
    11,
    now,
  );
  assert.ok(result.bookingId);
  return { state: result.state, id: result.bookingId };
}
const first = request(initial, "tenant", "2032-05-11");
const second = request(first.state, "landlord", "2032-05-13");
const id = first.id;
const otherId = second.id;
function booking(state: SpaceBookingsState, target = id) {
  const found = state.bookings.find((item) => item.id === target);
  assert.ok(found);
  return found;
}
const draft = (state: SpaceBookingsState, target = id) =>
  spaceBookingActionDraft(state, "spaceOperator", target);

// Defaults never create a private entry; both defaults and stored reads are detached.
const defaults = draft(second.state);
assert.equal(
  hasSpaceBookingOperatorDraft(second.state, "spaceOperator", id),
  false,
);
assert.equal(
  discardSpaceBookingOperatorDraft(second.state, "spaceOperator", id),
  second.state,
);
assert.notEqual(defaults, draft(second.state));
defaults.note = "A read must not retain private work";
assert.equal(draft(second.state).note, "");
const blankState = updateSpaceBookingActionDraft(
  second.state,
  "spaceOperator",
  id,
  blank,
);
assert.equal(
  hasSpaceBookingOperatorDraft(blankState, "spaceOperator", id),
  true,
);
assert.deepEqual(draft(blankState), blank);
assert.equal(
  updateSpaceBookingActionDraft(blankState, "spaceOperator", id, blank),
  blankState,
);
assert.equal(
  discardSpaceBookingOperatorDraft(blankState, "spaceOperator", id).bookings,
  blankState.bookings,
);

let prepared = updateSpaceBookingActionDraft(
  second.state,
  "spaceOperator",
  otherId,
  {
    note: "PRIVATE another booking's operator draft",
  },
);
prepared = updateSpaceBookingActionDraft(prepared, "tenant", id, {
  note: "PRIVATE customer cancellation draft",
});
prepared = updateSpaceBookingActionDraft(prepared, "landlord", otherId, {
  note: "PRIVATE other customer draft",
});
prepared = updateSpaceBookingDraft(prepared, "tenant", 1, 11, {
  notes: "PRIVATE unfinished future request",
});
prepared = updateSpaceTimeBlockDraft(prepared, "spaceOperator", 1, 11, {
  note: "PRIVATE unfinished unavailable range",
});
prepared = filterSpaceBookings(prepared, "Cancelled", "tenant");
prepared = updateSpaceOperatorInboxView(prepared, "spaceOperator", {
  query: " retained operator query ",
  filter: "history",
  selectedId: otherId,
});
const pending = updateSpaceBookingActionDraft(
  prepared,
  "spaceOperator",
  id,
  raw,
);
const pendingJson = JSON.stringify(pending);
assert.deepEqual(draft(pending), raw);
assert.equal(pending.bookings, prepared.bookings);
const detached = draft(pending);
detached.date = "2032-12-01";
detached.note = "Do not mutate the stored draft";
assert.deepEqual(draft(pending), raw);
const customerDetached = spaceBookingActionDraft(pending, "tenant", id);
customerDetached.note = "Do not mutate customer work either";
assert.equal(
  spaceBookingActionDraft(pending, "tenant", id).note,
  "PRIVATE customer cancellation draft",
);
const failed = saveSpaceBookingProposal(pending, "spaceOperator", id, now);
assert.equal(failed.state, pending);
assert.equal(failed.issue, undefined);
for (const field of [
  "date",
  "start",
  "end",
  "price",
  "cleaningFee",
  "deposit",
] as const)
  assert.ok(
    failed.errors[field],
    `Invalid raw ${field} remains private and blocks submission`,
  );
assert.deepEqual(draft(failed.state), raw);

// Accepting the original request does not submit or erase a private proposal/note.
assert.equal(
  spaceBookingActionIssue(
    pending,
    "spaceOperator",
    id,
    { type: "accept-request" },
    now,
  ),
  null,
);
const agreed = actOnSpaceBooking(
  pending,
  "spaceOperator",
  id,
  { type: "accept-request" },
  at(1),
);
assert.equal(booking(agreed).phase, "Agreed");
assert.deepEqual(booking(agreed).agreedTerms, booking(pending).requestedTerms);
assert.equal(agreed.actionDrafts, pending.actionDrafts);
assert.deepEqual(draft(agreed), raw);
assert.equal(booking(agreed).history.at(-1)!.action, "accepted");
assert.equal(booking(agreed).history.at(-1)!.note, undefined);

// Only successful publication consumes the exact operator draft.
const proposalDraft = updateSpaceBookingActionDraft(
  agreed,
  "spaceOperator",
  id,
  validProposal,
);
const proposalSaved = saveSpaceBookingProposal(
  proposalDraft,
  "spaceOperator",
  id,
  at(2),
);
assert.deepEqual(proposalSaved.errors, {});
assert.equal(proposalSaved.issue, undefined);
const proposed = proposalSaved.state;
assert.equal(
  hasSpaceBookingOperatorDraft(proposed, "spaceOperator", id),
  false,
);
assert.equal(
  proposed.actionDrafts.spaceOperator[otherId],
  proposalDraft.actionDrafts.spaceOperator[otherId],
);
for (const role of ["tenant", "landlord", "provider", "admin"] as const)
  assert.equal(proposed.actionDrafts[role], proposalDraft.actionDrafts[role]);
assert.equal(proposed.views, proposalDraft.views);
assert.equal(proposed.operatorInboxView, proposalDraft.operatorInboxView);
assert.equal(proposed.requestDrafts, proposalDraft.requestDrafts);
assert.equal(proposed.timeBlockDrafts, proposalDraft.timeBlockDrafts);
assert.equal(proposed.scheduleView, proposalDraft.scheduleView);
assert.equal(booking(proposed).phase, "Proposed");
assert.deepEqual(booking(proposed).agreedTerms, booking(agreed).agreedTerms);
const proposal1 = booking(proposed).proposal!;
assert.equal(proposal1.status, "pending");
assert.equal(proposal1.note, validProposal.note.trim());
assert.deepEqual(proposal1.proposedTerms, {
  date: validProposal.date,
  start: validProposal.start,
  end: validProposal.end,
  priceCents: 3550,
  cleaningFeeCents: 200,
  depositCents: 1000,
});
for (const previous of proposalDraft.bookings) {
  if (previous.id !== id)
    assert.equal(booking(proposed, previous.id), previous);
}

// A new private revision cannot change which published proposal the customer decides.
const pendingRevision = updateSpaceBookingActionDraft(
  proposed,
  "spaceOperator",
  id,
  raw,
);
const notices = reconcileSpaceBookingNotifications(
  createInitialNotificationState(),
  proposed,
);
assert.equal(
  reconcileSpaceBookingNotifications(notices, pendingRevision),
  notices,
);
for (const type of ["accept-proposal", "keep-original"] as const) {
  const staleAction = { type, proposalId: "not-the-current-proposal" };
  assert.equal(
    spaceBookingActionIssue(pendingRevision, "tenant", id, staleAction, at(3)),
    "staleProposal",
  );
  assert.equal(
    actOnSpaceBooking(pendingRevision, "tenant", id, staleAction, at(3)),
    pendingRevision,
  );
  const action = { type, proposalId: proposal1.id };
  const decided = actOnSpaceBooking(
    pendingRevision,
    "tenant",
    id,
    action,
    at(3),
  );
  assert.equal(decided.actionDrafts, pendingRevision.actionDrafts);
  assert.deepEqual(draft(decided), raw);
  assert.equal(
    spaceBookingActionDraft(decided, "tenant", id).note,
    "PRIVATE customer cancellation draft",
  );
  assert.deepEqual(
    booking(decided).agreedTerms,
    type === "accept-proposal"
      ? proposal1.proposedTerms
      : booking(agreed).agreedTerms,
  );
  assert.equal(booking(decided).history.at(-1)!.proposalId, proposal1.id);
  assert.equal(booking(decided).history.at(-1)!.note, undefined);
  assert.equal(
    actOnSpaceBooking(decided, "tenant", id, action, at(4)),
    decided,
  );
}
const noChangeDraft = updateSpaceBookingActionDraft(
  proposed,
  "spaceOperator",
  id,
  validProposal,
);
const noChange = saveSpaceBookingProposal(
  noChangeDraft,
  "spaceOperator",
  id,
  at(3),
);
assert.equal(noChange.issue, "noChange");
assert.equal(noChange.state, noChangeDraft);
assert.equal(
  hasSpaceBookingOperatorDraft(noChange.state, "spaceOperator", id),
  true,
);

// Reasons clear only a matching submitted note, preserving all six terms and other actors.
for (const submitted of [
  raw.note.trim(),
  "A different explicit refusal reason",
]) {
  const refused = actOnSpaceBooking(
    pending,
    "spaceOperator",
    id,
    { type: "decline-request", note: submitted },
    at(1),
  );
  assert.equal(booking(refused).phase, "Declined");
  assert.deepEqual(draft(refused), {
    ...raw,
    note: submitted === raw.note.trim() ? "" : raw.note,
  });
  assert.equal(
    hasSpaceBookingOperatorDraft(refused, "spaceOperator", id),
    true,
  );
  assert.equal(refused.actionDrafts.tenant, pending.actionDrafts.tenant);
  assert.equal(
    refused.actionDrafts.spaceOperator[otherId],
    pending.actionDrafts.spaceOperator[otherId],
  );
  assert.equal(booking(refused).declineReason, submitted);
  assert.equal(booking(refused).history.at(-1)!.note, submitted);
}
const invalidReason = actOnSpaceBooking(
  pending,
  "spaceOperator",
  id,
  { type: "decline-request", note: " " },
  at(1),
);
assert.equal(invalidReason, pending);
const customerNote = spaceBookingActionDraft(pendingRevision, "tenant", id);
for (const submitted of [
  undefined,
  "",
  `  ${customerNote.note}  `,
  "A different explicit cancellation reason",
]) {
  const cancelled = actOnSpaceBooking(
    pendingRevision,
    "tenant",
    id,
    { type: "cancel", ...(submitted !== undefined ? { note: submitted } : {}) },
    at(3),
  );
  assert.equal(booking(cancelled).phase, "Cancelled");
  assert.deepEqual(spaceBookingActionDraft(cancelled, "tenant", id), {
    ...customerNote,
    note:
      submitted?.trim() === customerNote.note.trim() ? "" : customerNote.note,
  });
  assert.equal(
    cancelled.actionDrafts.spaceOperator,
    pendingRevision.actionDrafts.spaceOperator,
  );
  assert.deepEqual(draft(cancelled), raw);
  assert.equal(booking(cancelled).proposal!.status, "withdrawn");
  assert.deepEqual(booking(cancelled).agreedTerms, booking(agreed).agreedTerms);
  assert.equal(booking(cancelled).cancellationReason, submitted?.trim() ?? "");
}

function assertDiscardPreservesSharedState(state: SpaceBookingsState) {
  const before = JSON.stringify(state);
  let feed = reconcileSpaceBookingNotifications(
    createInitialNotificationState(),
    state,
  );
  const event = feed.items.find(
    (item) => item.spaceBookingEvent?.bookingId === id,
  );
  assert.ok(event);
  feed = markNotificationRead(feed, event.role, event.id);
  const discarded = discardSpaceBookingOperatorDraft(
    state,
    "spaceOperator",
    id,
  );
  assert.notEqual(discarded, state);
  assert.equal(
    hasSpaceBookingOperatorDraft(discarded, "spaceOperator", id),
    false,
  );
  for (const key of [
    "bookings",
    "views",
    "operatorInboxView",
    "requestDrafts",
    "timeBlocks",
    "timeBlockDrafts",
    "scheduleView",
  ] as const)
    assert.equal(discarded[key], state[key]);
  assert.equal(discarded.filter, state.filter);
  assert.equal(discarded.selectedId, state.selectedId);
  assert.equal(discarded.nextId, state.nextId);
  assert.equal(discarded.removedTimeBlockId, state.removedTimeBlockId);
  assert.equal(discarded.nextTimeBlockId, state.nextTimeBlockId);
  assert.equal(
    discarded.actionDrafts.spaceOperator[otherId],
    state.actionDrafts.spaceOperator[otherId],
  );
  for (const role of ["tenant", "landlord", "provider", "admin"] as const)
    assert.equal(discarded.actionDrafts[role], state.actionDrafts[role]);
  assert.equal(reconcileSpaceBookingNotifications(feed, discarded), feed);
  assert.equal(
    discardSpaceBookingOperatorDraft(discarded, "spaceOperator", id),
    discarded,
  );
  assert.equal(JSON.stringify(state), before);
}
const cancelled = actOnSpaceBooking(
  pendingRevision,
  "tenant",
  id,
  { type: "cancel", note: "Plans changed" },
  at(3),
);
const declined = actOnSpaceBooking(
  pending,
  "spaceOperator",
  id,
  { type: "decline-request", note: "Another reason" },
  at(1),
);
const completed = actOnSpaceBooking(
  agreed,
  "spaceOperator",
  id,
  { type: "complete" },
  new Date(2032, 4, 11, 9, 30),
);
assert.equal(booking(completed).phase, "Completed");
assert.equal(completed.actionDrafts, agreed.actionDrafts);
for (const state of [cancelled, declined, completed]) {
  assert.equal(hasSpaceBookingOperatorDraft(state, "spaceOperator", id), true);
  assert.deepEqual(draft(state), raw);
  assert.equal(
    updateSpaceBookingActionDraft(state, "spaceOperator", id, validProposal),
    state,
  );
  assert.equal(
    saveSpaceBookingProposal(state, "spaceOperator", id, now).state,
    state,
  );
  assertDiscardPreservesSharedState(state);
}
assertDiscardPreservesSharedState(pendingRevision);

// Operator-only disposal must never touch a customer's notes or another venue's files.
const roles: Role[] = [
  "tenant",
  "landlord",
  "spaceOperator",
  "provider",
  "admin",
  "unknown" as Role,
];
for (const role of roles.filter((value) => value !== "spaceOperator")) {
  for (const state of [pendingRevision, cancelled, completed]) {
    assert.equal(hasSpaceBookingOperatorDraft(state, role, id), false);
    assert.equal(discardSpaceBookingOperatorDraft(state, role, id), state);
    assert.notEqual(spaceBookingActionDraft(state, role, id).note, raw.note);
    assert.equal(saveSpaceBookingProposal(state, role, id, now).state, state);
  }
}
for (const patch of [
  { venueId: 2, spaceId: 21 },
  { venueId: 1, spaceId: 21 },
  { venueId: 999 },
  { spaceId: 999 },
]) {
  const inaccessible: SpaceBookingsState = {
    ...pending,
    bookings: pending.bookings.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
  assert.equal(
    hasSpaceBookingOperatorDraft(inaccessible, "spaceOperator", id),
    false,
  );
  assert.equal(
    discardSpaceBookingOperatorDraft(inaccessible, "spaceOperator", id),
    inaccessible,
  );
  assert.deepEqual(draft(inaccessible), blank);
  assert.equal(
    updateSpaceBookingActionDraft(
      inaccessible,
      "spaceOperator",
      id,
      validProposal,
    ),
    inaccessible,
  );
  assert.equal(
    saveSpaceBookingProposal(inaccessible, "spaceOperator", id, now).state,
    inaccessible,
  );
}
const missing: SpaceBookingsState = {
  ...pending,
  actionDrafts: {
    ...pending.actionDrafts,
    spaceOperator: { ...pending.actionDrafts.spaceOperator, missing: raw },
  },
};
for (const role of roles) {
  assert.equal(hasSpaceBookingOperatorDraft(missing, role, "missing"), false);
  assert.equal(
    discardSpaceBookingOperatorDraft(missing, role, "missing"),
    missing,
  );
  assert.deepEqual(spaceBookingActionDraft(missing, role, "missing"), blank);
}
assert.equal(JSON.stringify(pending), pendingJson);
assert.equal(JSON.stringify(initial), initialJson);

console.log("Space operator draft lifecycle checks passed.");
