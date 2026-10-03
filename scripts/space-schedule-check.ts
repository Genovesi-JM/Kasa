import assert from "node:assert/strict";
import {
  actOnSpaceBooking,
  createInitialSpaceBookingsState,
  createSpaceBookingRequest,
  createSpaceTimeBlock,
  discardSpaceTimeBlockDraft,
  removeSpaceTimeBlock,
  removedSpaceTimeBlock,
  restoreSpaceTimeBlock,
  saveSpaceBookingProposal,
  spaceBookingActionIssue,
  spaceBookingUnavailablePeriods,
  spaceScheduleEntries,
  spaceScheduleView,
  spaceTimeBlockConflicts,
  spaceTimeBlockDraft,
  updateSpaceBookingActionDraft,
  updateSpaceBookingDraft,
  updateSpaceScheduleView,
  updateSpaceTimeBlockDraft,
  validateSpaceBookingProposal,
  validateSpaceBookingRequest,
  validateSpaceTimeBlock,
  type SpaceBookingsState,
  type SpaceTimeBlockDraft,
} from "../src/components/spaceBookingsState";
import type { Role } from "../src/types";

const now = new Date("2032-05-10T09:00:30");
const date = "2032-05-11";
const role = "spaceOperator";
const initial = createInitialSpaceBookingsState(now);
const draft: SpaceTimeBlockDraft = {
  date,
  start: "10:00",
  end: "11:00",
  note: "  Private maintenance arrangement  ",
};
const request = {
  date,
  start: "08:00",
  end: "09:30",
  participants: "2",
  notes: "Customer's request",
};
function block(
  state: SpaceBookingsState,
  patch: Partial<SpaceTimeBlockDraft> = {},
  spaceId = 11,
) {
  return createSpaceTimeBlock(
    updateSpaceTimeBlockDraft(state, role, 1, spaceId, { ...draft, ...patch }),
    role,
    1,
    spaceId,
    now,
  );
}
function booking(state: SpaceBookingsState) {
  const result = createSpaceBookingRequest(
    updateSpaceBookingDraft(state, "tenant", 1, 11, request),
    "tenant",
    1,
    11,
    now,
  );
  assert.deepEqual(result.errors, {});
  assert.equal(result.issue, undefined);
  assert.ok(result.bookingId);
  return { state: result.state, id: result.bookingId };
}

// Operator scope, independently retained unit drafts, and canonical selected view.
assert.deepEqual(spaceScheduleView(initial, role), {
  venueId: 1,
  spaceId: 11,
  date: "2032-05-10",
});
const viewed = updateSpaceScheduleView(initial, role, { spaceId: 12, date });
assert.deepEqual(spaceScheduleView(viewed, role), {
  venueId: 1,
  spaceId: 12,
  date,
});
assert.equal(
  updateSpaceScheduleView(viewed, role, { spaceId: 12, date }),
  viewed,
);
assert.equal(updateSpaceScheduleView(viewed, role, { spaceId: 21 }), viewed);
assert.equal(updateSpaceScheduleView(viewed, role, { venueId: 2 }), viewed);
assert.equal(
  updateSpaceScheduleView(viewed, role, { date: "2032-02-30" }),
  viewed,
);
assert.equal(
  updateSpaceScheduleView(viewed, role, { date: "2032-5-11" }),
  viewed,
);
assert.deepEqual(spaceTimeBlockDraft(viewed, role, 1, 12), {
  date,
  start: "",
  end: "",
  note: "",
});
const retained = updateSpaceTimeBlockDraft(
  updateSpaceTimeBlockDraft(viewed, role, 1, 11, draft),
  role,
  1,
  12,
  { start: "17:00", end: "18:00", note: "Other unit" },
);
assert.deepEqual(spaceTimeBlockDraft(retained, role, 1, 11), draft);
assert.equal(spaceTimeBlockDraft(retained, role, 1, 12)?.note, "Other unit");
const readDraft = spaceTimeBlockDraft(retained, role, 1, 11)!;
readDraft.note = "Cannot mutate retained state";
assert.equal(spaceTimeBlockDraft(retained, role, 1, 11)?.note, draft.note);
assert.equal(
  spaceTimeBlockDraft(
    updateSpaceScheduleView(retained, role, { date: "2032-05-12" }),
    role,
    1,
    11,
  )?.date,
  date,
);
assert.equal(
  spaceTimeBlockDraft(
    discardSpaceTimeBlockDraft(retained, role, 1, 11),
    role,
    1,
    11,
  )?.note,
  "",
);
assert.equal(
  spaceTimeBlockDraft(
    discardSpaceTimeBlockDraft(retained, role, 1, 11),
    role,
    1,
    12,
  )?.note,
  "Other unit",
);
for (const foreignRole of [
  "tenant",
  "landlord",
  "provider",
  "admin",
  "guest",
] as unknown as Role[]) {
  assert.equal(spaceTimeBlockDraft(retained, foreignRole, 1, 11), null);
  assert.equal(
    updateSpaceTimeBlockDraft(retained, foreignRole, 1, 11, { note: "leak" }),
    retained,
  );
  assert.equal(
    discardSpaceTimeBlockDraft(retained, foreignRole, 1, 11),
    retained,
  );
  assert.equal(
    updateSpaceScheduleView(retained, foreignRole, { date }),
    retained,
  );
  assert.deepEqual(spaceScheduleView(retained, foreignRole), {
    venueId: null,
    spaceId: null,
    date: "",
  });
  assert.equal(
    createSpaceTimeBlock(retained, foreignRole, 1, 11, now).issue,
    "unavailable",
  );
  assert.deepEqual(
    spaceScheduleEntries(retained, foreignRole, 1, 11, date),
    [],
  );
}
for (const [venueId, spaceId] of [
  [1, 21],
  [2, 21],
  [999, 11],
  [1, 11.5],
]) {
  assert.equal(spaceTimeBlockDraft(retained, role, venueId, spaceId), null);
  assert.equal(
    updateSpaceTimeBlockDraft(retained, role, venueId, spaceId, draft),
    retained,
  );
  assert.equal(
    createSpaceTimeBlock(retained, role, venueId, spaceId, now).issue,
    "unavailable",
  );
  assert.deepEqual(
    spaceScheduleEntries(retained, role, venueId, spaceId, date),
    [],
  );
}

// Actual canonical date/time and optional reason validation, including same-day boundaries.
for (const [patch, field, issue] of [
  [{ date: "2032-02-30" }, "date", "date"],
  [{ date: "2032-05-09" }, "date", "date"],
  [{ date: "2032-05-10", start: "08:59" }, "start", "start"],
  [{ start: "9:00" }, "start", "start"],
  [{ end: "24:00" }, "end", "end"],
  [{ end: "10:00" }, "end", "range"],
  [{ end: "09:59" }, "end", "range"],
  [{ start: "05:59" }, "start", "openingHours"],
  [{ end: "23:01" }, "end", "openingHours"],
  [{ note: "x".repeat(501) }, "note", "note"],
] as const) {
  const candidate = { ...draft, ...patch };
  assert.equal(
    validateSpaceTimeBlock(initial, role, 1, 11, candidate, now).errors[field],
    issue,
  );
  const invalid = updateSpaceTimeBlockDraft(initial, role, 1, 11, candidate);
  assert.equal(createSpaceTimeBlock(invalid, role, 1, 11, now).state, invalid);
}
assert.deepEqual(
  validateSpaceTimeBlock(
    initial,
    role,
    1,
    11,
    { ...draft, date: "2032-05-10", start: "09:00", note: "" },
    now,
  ),
  { errors: {} },
);
assert.deepEqual(
  validateSpaceTimeBlock(
    initial,
    role,
    1,
    11,
    { ...draft, start: "06:00", end: "23:00", note: "x".repeat(500) },
    now,
  ),
  { errors: {} },
);

// Blocks use actual date/unit, keep private reasons, and do not touch booking records.
const saved = createSpaceTimeBlock(retained, role, 1, 11, now);
assert.deepEqual(saved.errors, {});
assert.equal(saved.issue, undefined);
assert.ok(saved.blockId);
const savedBlock = saved.state.timeBlocks.find(
  (item) => item.id === saved.blockId,
)!;
assert.equal(savedBlock.note, draft.note.trim());
assert.equal(savedBlock.createdAt, now.toISOString());
assert.deepEqual(savedBlock.history, [
  { action: "created", at: now.toISOString() },
]);
assert.equal(saved.state.bookings, retained.bookings);
assert.equal(retained.timeBlocks.length, 0);
assert.deepEqual(spaceScheduleView(saved.state, role), {
  venueId: 1,
  spaceId: 11,
  date,
});
assert.deepEqual(spaceTimeBlockDraft(saved.state, role, 1, 11), {
  date,
  start: "",
  end: "",
  note: "",
});
assert.equal(spaceTimeBlockDraft(saved.state, role, 1, 12)?.note, "Other unit");
const publicPeriods = spaceBookingUnavailablePeriods(saved.state, 1, 11, date);
assert.deepEqual(publicPeriods, [
  { id: saved.blockId, start: "10:00", end: "11:00" },
]);
publicPeriods[0].start = "00:00";
assert.equal(savedBlock.start, "10:00");
assert.deepEqual(spaceBookingUnavailablePeriods(saved.state, 1, 12, date), []);
assert.deepEqual(
  spaceBookingUnavailablePeriods(saved.state, 1, 11, "2032-05-12"),
  [],
);
assert.deepEqual(spaceBookingUnavailablePeriods(saved.state, 2, 21, date), []);
assert.deepEqual(spaceBookingUnavailablePeriods(saved.state, 1, 11, "bad"), []);
const entries = spaceScheduleEntries(saved.state, role, 1, 11, date);
assert.equal(entries.length, 1);
assert.equal(entries[0].kind, "block");
if (entries[0].kind === "block") {
  entries[0].block.note = "Mutated projection";
  entries[0].block.history[0].action = "removed";
}
assert.equal(savedBlock.note, draft.note.trim());
assert.equal(savedBlock.history[0].action, "created");
assert.equal(spaceTimeBlockConflicts(saved.state, 1, 11, draft), true);
assert.equal(
  spaceTimeBlockConflicts(saved.state, 1, 11, {
    ...draft,
    start: "09:00",
    end: "10:00",
  }),
  false,
);
assert.equal(
  spaceTimeBlockConflicts(saved.state, 1, 11, {
    ...draft,
    start: "11:00",
    end: "12:00",
  }),
  false,
);
assert.equal(
  spaceTimeBlockConflicts(saved.state, 1, 11, {
    ...draft,
    start: "09:59",
    end: "10:01",
  }),
  true,
);
assert.equal(
  spaceTimeBlockConflicts(saved.state, 1, 11, {
    ...draft,
    start: "10:30",
    end: "10:45",
  }),
  true,
);
assert.equal(
  spaceTimeBlockConflicts(saved.state, 1, 11, { ...draft, start: "bad" }),
  false,
);
assert.equal(
  spaceTimeBlockConflicts(saved.state, 1, 11, { ...draft, end: "09:00" }),
  false,
);
assert.equal(block(saved.state).issue, "blockConflict");
assert.equal(block(saved.state, {}, 12).issue, undefined);
const adjacent = block(saved.state, { start: "09:00", end: "10:00" });
assert.equal(adjacent.issue, undefined);
assert.notEqual(adjacent.blockId, saved.blockId);
assert.deepEqual(
  spaceBookingUnavailablePeriods(adjacent.state, 1, 11, date).map(
    (item) => item.start,
  ),
  ["09:00", "10:00"],
);

// Soft removal and retained undo remain scoped; restoration revalidates expiry and new conflicts.
for (const foreignRole of [
  "tenant",
  "landlord",
  "provider",
  "admin",
] as Role[]) {
  assert.equal(
    removeSpaceTimeBlock(saved.state, foreignRole, saved.blockId, now).state,
    saved.state,
  );
  assert.equal(removedSpaceTimeBlock(saved.state, foreignRole), null);
}
assert.equal(
  removeSpaceTimeBlock(saved.state, role, "unknown", now).issue,
  "unavailable",
);
const removed = removeSpaceTimeBlock(
  saved.state,
  role,
  saved.blockId,
  now,
).state;
assert.equal(removed.bookings, saved.state.bookings);
assert.equal(removedSpaceTimeBlock(removed, role)?.id, saved.blockId);
assert.deepEqual(spaceBookingUnavailablePeriods(removed, 1, 11, date), []);
assert.deepEqual(spaceScheduleEntries(removed, role, 1, 11, date), []);
assert.equal(
  removeSpaceTimeBlock(removed, role, saved.blockId, now).issue,
  "status",
);
const restored = restoreSpaceTimeBlock(removed, role, saved.blockId, now);
assert.equal(restored.issue, undefined);
assert.equal(removedSpaceTimeBlock(restored.state, role), null);
assert.deepEqual(
  restored.state.timeBlocks[0].history.map((event) => event.action),
  ["created", "removed", "restored"],
);
assert.equal(restored.state.timeBlocks[0].removedAt, undefined);
assert.equal(
  restoreSpaceTimeBlock(restored.state, role, saved.blockId, now).issue,
  "status",
);
assert.equal(
  restoreSpaceTimeBlock(removed, "tenant", saved.blockId, now).issue,
  "unavailable",
);
assert.equal(
  restoreSpaceTimeBlock(
    removed,
    role,
    saved.blockId,
    new Date("2032-05-11T10:01:00"),
  ).issue,
  "start",
);
assert.equal(
  restoreSpaceTimeBlock(
    removed,
    role,
    saved.blockId,
    new Date("2032-05-12T09:00:00"),
  ).issue,
  "date",
);
const replacement = block(removed);
const staleUndo = restoreSpaceTimeBlock(
  replacement.state,
  role,
  saved.blockId,
  now,
);
assert.equal(staleUndo.issue, "blockConflict");
assert.equal(staleUndo.state, replacement.state);
assert.equal(removedSpaceTimeBlock(staleUndo.state, role)?.id, saved.blockId);

// A pending request does not hold time, but adding a block prevents agreement and future requests.
const pending = booking(initial);
const pendingHistory = pending.state.bookings.find(
  (item) => item.id === pending.id,
)!.history;
const overPending = block(pending.state, {
  start: request.start,
  end: request.end,
});
assert.equal(overPending.issue, undefined);
assert.equal(overPending.state.bookings, pending.state.bookings);
assert.equal(
  spaceBookingActionIssue(
    overPending.state,
    role,
    pending.id,
    { type: "accept-request" },
    now,
  ),
  "blocked",
);
assert.equal(
  actOnSpaceBooking(
    overPending.state,
    role,
    pending.id,
    { type: "accept-request" },
    now,
  ),
  overPending.state,
);
assert.equal(
  overPending.state.bookings.find((item) => item.id === pending.id)!.history,
  pendingHistory,
);
assert.equal(
  validateSpaceBookingRequest(
    overPending.state,
    "landlord",
    1,
    11,
    request,
    now,
  ).issue,
  "blocked",
);
const blockedDraft = updateSpaceBookingDraft(
  overPending.state,
  "landlord",
  1,
  11,
  request,
);
assert.equal(
  createSpaceBookingRequest(blockedDraft, "landlord", 1, 11, now).state,
  blockedDraft,
);
assert.equal(
  validateSpaceBookingRequest(
    overPending.state,
    "landlord",
    1,
    12,
    request,
    now,
  ).issue,
  undefined,
);
assert.equal(
  validateSpaceBookingRequest(
    overPending.state,
    "landlord",
    1,
    11,
    { ...request, date: "2032-05-13" },
    now,
  ).issue,
  undefined,
);
const proposalDraft = {
  date,
  start: "08:30",
  end: "09:00",
  price: "30",
  cleaningFee: "0",
  deposit: "0",
  note: "Operator proposes a shorter session",
};
assert.equal(
  validateSpaceBookingProposal(
    overPending.state,
    role,
    pending.id,
    proposalDraft,
    now,
  ).issue,
  "blocked",
);
const blockedProposalDraft = updateSpaceBookingActionDraft(
  overPending.state,
  role,
  pending.id,
  proposalDraft,
);
assert.equal(
  saveSpaceBookingProposal(blockedProposalDraft, role, pending.id, now).issue,
  "blocked",
);
assert.equal(
  saveSpaceBookingProposal(blockedProposalDraft, role, pending.id, now).state,
  blockedProposalDraft,
);

// Agreements are protected, including the original time while a reschedule awaits the customer.
const agreed = actOnSpaceBooking(
  pending.state,
  role,
  pending.id,
  { type: "accept-request" },
  now,
);
assert.equal(
  block(agreed, { start: "08:30", end: "09:00" }).issue,
  "bookingConflict",
);
assert.equal(block(agreed, { start: "07:00", end: "08:00" }).issue, undefined);
const scheduleAgreement = spaceScheduleEntries(agreed, role, 1, 11, date);
assert.equal(scheduleAgreement.length, 1);
assert.equal(scheduleAgreement[0].kind, "booking");
const reschedule = saveSpaceBookingProposal(
  updateSpaceBookingActionDraft(agreed, role, pending.id, {
    ...proposalDraft,
    start: "13:00",
    end: "14:00",
  }),
  role,
  pending.id,
  now,
);
assert.equal(reschedule.issue, undefined);
const rescheduledBooking = reschedule.state.bookings.find(
  (item) => item.id === pending.id,
)!;
const proposalId = rescheduledBooking.proposal!.id;
assert.equal(rescheduledBooking.phase, "Proposed");
assert.equal(
  block(reschedule.state, { start: "08:30", end: "09:00" }).issue,
  "bookingConflict",
);
const oldAgreementEntry = spaceScheduleEntries(
  reschedule.state,
  role,
  1,
  11,
  date,
)[0];
assert.equal(oldAgreementEntry.kind, "booking");
if (oldAgreementEntry.kind === "booking")
  assert.equal(oldAgreementEntry.terms.start, request.start);
const proposalBlock = block(reschedule.state, { start: "13:00", end: "14:00" });
assert.equal(
  proposalBlock.issue,
  undefined,
  "An unaccepted proposed time does not hold a second range",
);
assert.equal(
  spaceBookingActionIssue(
    proposalBlock.state,
    "tenant",
    pending.id,
    { type: "accept-proposal", proposalId },
    now,
  ),
  "blocked",
);
assert.equal(
  actOnSpaceBooking(
    proposalBlock.state,
    "tenant",
    pending.id,
    { type: "accept-proposal", proposalId },
    now,
  ),
  proposalBlock.state,
);
assert.deepEqual(
  proposalBlock.state.bookings.find((item) => item.id === pending.id)!
    .agreedTerms,
  rescheduledBooking.agreedTerms,
);
const kept = actOnSpaceBooking(
  proposalBlock.state,
  "tenant",
  pending.id,
  { type: "keep-original", proposalId },
  now,
);
assert.equal(
  kept.bookings.find((item) => item.id === pending.id)!.phase,
  "Agreed",
);
assert.equal(
  block(kept, { start: "08:30", end: "09:00" }).issue,
  "bookingConflict",
);
const unblocked = removeSpaceTimeBlock(
  proposalBlock.state,
  role,
  proposalBlock.blockId!,
  now,
).state;
const moved = actOnSpaceBooking(
  unblocked,
  "tenant",
  pending.id,
  { type: "accept-proposal", proposalId },
  now,
);
assert.equal(
  moved.bookings.find((item) => item.id === pending.id)!.agreedTerms?.start,
  "13:00",
);
assert.equal(block(moved, { start: "08:30", end: "09:00" }).issue, undefined);
const occupiedUndo = restoreSpaceTimeBlock(
  moved,
  role,
  proposalBlock.blockId!,
  now,
);
assert.equal(occupiedUndo.issue, "bookingConflict");
assert.equal(occupiedUndo.state, moved);
assert.equal(
  removedSpaceTimeBlock(occupiedUndo.state, role)?.id,
  proposalBlock.blockId,
);
const cancelled = actOnSpaceBooking(
  moved,
  "tenant",
  pending.id,
  { type: "cancel", note: "Plans changed" },
  now,
);
assert.equal(
  restoreSpaceTimeBlock(cancelled, role, proposalBlock.blockId!, now).issue,
  undefined,
);
assert.equal(
  spaceScheduleEntries(cancelled, role, 1, 11, date).some(
    (item) => item.kind === "booking",
  ),
  false,
);

console.log(
  "Space schedule checks passed: scoped retained drafts/view, private reasons, dates/hours, half-open overlaps, agreement protection, blocked request/proposal/acceptance, preserved reschedules, soft removal and guarded undo.",
);
