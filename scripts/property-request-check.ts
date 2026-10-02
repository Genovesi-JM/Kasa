import assert from "node:assert/strict";
import {
  cancelViewingRequest,
  createInitialPropertyRequestState,
  futureLocalDate,
  isCurrentOrFutureDate,
  localDateValue,
  saveViewingRequest,
  validateRentalApplication,
  validateViewingRequest,
  viewingForProperty,
  type ViewingRequestDraft,
  actOnViewingRequest,
  createViewingRequest,
  discardViewingDraft,
  pendingViewingProposal,
  saveViewingProposal,
  scopedViewingRequests,
  selectedViewingRequest,
  selectViewingRequest,
  setViewingFilter,
  upcomingAgreedViewings,
  updateViewingActionDraft,
  updateViewingDraft,
  validateViewingProposal,
  viewingActionDraft,
  viewingActionIssue,
  viewingCounts,
  viewingDraft,
  viewingDraftErrors,
  viewingDrafts,
  viewingView,
  visibleViewingRequests,
  type PropertyRequestState,
} from "../src/components/propertyRequestState";

const now = new Date(2026, 9, 2, 12, 30);
assert.equal(localDateValue(now), "2026-10-02");
assert.equal(futureLocalDate(1, new Date(2026, 11, 31, 23, 59)), "2027-01-01");
assert.equal(futureLocalDate(1, new Date(2028, 1, 28)), "2028-02-29");
assert.ok(isCurrentOrFutureDate("2026-10-02", now));
for (const date of [
  "",
  "tomorrow",
  "2026-10-01",
  "2026-02-30",
  "2026-13-01",
  "2026-10-2",
  "2026-10-32",
])
  assert.equal(isCurrentOrFutureDate(date, now), false, date);

const draft: ViewingRequestDraft = {
  date: "2026-10-03",
  time: "14:30",
  note: "  Saturday works best.  ",
};
assert.deepEqual(validateViewingRequest(draft, now), {});
assert.deepEqual(
  validateViewingRequest({ ...draft, date: "2026-10-02", time: "13:30" }, now),
  {},
);
assert.ok(
  validateViewingRequest({ ...draft, date: "2026-10-02", time: "12:00" }, now)
    .time,
);
for (const time of ["", "25:00", "12:60", "noon", "2:30"])
  assert.ok(validateViewingRequest({ ...draft, time }, now).time);
assert.ok(
  validateViewingRequest({ ...draft, note: "x".repeat(1001) }, now).note,
);
assert.deepEqual(
  validateRentalApplication(
    {
      moveInDate: "2026-10-02",
      householdSize: 1,
      introduction: "",
    },
    now,
  ),
  {},
);

const initial = createInitialPropertyRequestState();
const saved = saveViewingRequest(initial, "tenant", { id: 2 }, draft, now);
const request = viewingForProperty(saved, "tenant", 2)!;
assert.equal(initial.viewings.length, 0);
assert.equal(request.date, draft.date);
assert.equal(request.time, draft.time);
assert.equal(request.note, "Saturday works best.");
assert.equal(request.status, "Pending");
assert.equal(request.propertyId, 2);
assert.equal(viewingForProperty(saved, "tenant", 3), undefined);
assert.equal(viewingForProperty(saved, "landlord", 2), undefined);
for (const role of [
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
] as const) {
  assert.equal(
    saveViewingRequest(initial, role, { id: 2 }, draft, now),
    initial,
  );
  assert.equal(cancelViewingRequest(saved, role, 2, now), saved);
}
assert.equal(
  saveViewingRequest(
    initial,
    "tenant",
    { id: 2 },
    { ...draft, date: "2026-10-01" },
    now,
  ),
  initial,
);
const edited = saveViewingRequest(
  saved,
  "tenant",
  { id: 2 },
  { ...draft, time: "15:30", note: "Updated note." },
  new Date(2026, 9, 2, 13),
);
assert.equal(
  edited.viewings.length,
  1,
  "Compatibility save never duplicates an active request",
);
assert.equal(edited.viewings[0].id, request.id);
assert.equal(edited.viewings[0].createdAt, request.createdAt);
assert.equal(
  edited,
  saved,
  "Submitted original terms are not silently overwritten",
);
assert.equal(edited.viewings[0].time, "14:30");
assert.equal(saved.viewings[0].time, "14:30");
const otherProperty = saveViewingRequest(
  edited,
  "tenant",
  { id: 3 },
  draft,
  now,
);
const cancelled = cancelViewingRequest(otherProperty, "tenant", 2, now);
assert.equal(viewingForProperty(cancelled, "tenant", 2)?.status, "Cancelled");
assert.equal(viewingForProperty(cancelled, "tenant", 3)?.status, "Pending");
assert.equal(cancelViewingRequest(cancelled, "tenant", 2, now), cancelled);
assert.equal(cancelViewingRequest(cancelled, "tenant", 999, now), cancelled);
const reopened = saveViewingRequest(
  cancelled,
  "tenant",
  { id: 2 },
  { ...draft, date: "2026-10-04" },
  now,
);
assert.equal(reopened.viewings.length, 3);
assert.notEqual(
  viewingForProperty(reopened, "tenant", 2)?.id,
  request.id,
  "A later request gets a new id while cancellation remains history",
);
assert.equal(viewingForProperty(reopened, "tenant", 2)?.status, "Pending");
assert.equal(viewingForProperty(reopened, "tenant", 2)?.date, "2026-10-04");
assert.equal(
  saveViewingRequest(initial, "tenant", { id: 999 }, draft, now),
  initial,
);
assert.equal(viewingDraft(initial, "tenant", 999), null);
assert.equal(
  createViewingRequest(initial, "tenant", 999, now).issue?.code,
  "invalidProperty",
);
assert.equal(viewingDraft(initial, "landlord", 1), null);
assert.deepEqual(viewingDraft(initial, "tenant", 1), {
  date: "",
  time: "",
  note: "",
});
const blankRetained = updateViewingDraft(initial, "tenant", 1, {
  date: "",
  time: "",
  note: "Keep this unsent note.",
});
assert.equal(
  blankRetained.viewings,
  initial.viewings,
  "Unsent draft never becomes an owner-visible request",
);
assert.equal(
  viewingDraft(blankRetained, "tenant", 1)?.note,
  "Keep this unsent note.",
);
assert.equal(viewingDrafts(blankRetained, "landlord").length, 0);
assert.equal(viewingDrafts(blankRetained, "tenant").length, 1);
assert.equal(scopedViewingRequests(blankRetained, "landlord").length, 0);
assert.deepEqual(createViewingRequest(blankRetained, "tenant", 1, now).errors, {
  date: "invalidDate",
  time: "invalidTime",
});
assert.equal(
  createViewingRequest(blankRetained, "tenant", 1, now).state,
  blankRetained,
);
assert.equal(discardViewingDraft(blankRetained, "landlord", 1), blankRetained);
assert.equal(
  discardViewingDraft(blankRetained, "tenant", 1).drafts?.[1],
  undefined,
);
const retained = updateViewingDraft(
  updateViewingDraft(blankRetained, "tenant", 1, draft),
  "tenant",
  2,
  { ...draft, note: "Another property's draft." },
);
const created = createViewingRequest(retained, "tenant", 1, now);
assert.equal(created.issue, null);
assert.deepEqual(created.errors, {});
assert.ok(created.requestId);
const id = created.requestId!;
const record = (state: PropertyRequestState, target = id) =>
  state.viewings.find((item) => item.id === target)!;
const original = record(created.state);
assert.equal(original.tenantId, "tenant-ines");
assert.equal(original.tenantName, "Inês Duarte");
assert.deepEqual(original.requestedTerms, {
  date: draft.date,
  time: draft.time,
});
assert.equal(original.agreedTerms, undefined);
assert.equal(original.status, "Pending");
assert.equal(original.history[0].action, "requested");
assert.equal(original.history[0].actor, "tenant");
assert.equal(created.state.drafts?.[1], undefined);
assert.equal(
  created.state.drafts?.[2],
  retained.drafts?.[2],
  "Submitting one property does not erase another draft",
);
assert.deepEqual(viewingView(created.state, "tenant"), {
  filter: "Pending",
  selectedId: id,
});
assert.equal(selectedViewingRequest(created.state, "tenant", now)?.id, id);
assert.equal(scopedViewingRequests(created.state, "landlord")[0], original);
assert.equal(viewingForProperty(created.state, "landlord", 1, now), original);
assert.equal(viewingCounts(created.state, "landlord", now).pending, 1);
assert.equal(viewingCounts(created.state, "tenant", now).drafts, 1);
assert.equal(
  upcomingAgreedViewings(created.state, "tenant", now).length,
  0,
  "Pending is not an agreed viewing",
);
const duplicateDraft = updateViewingDraft(created.state, "tenant", 1, {
  ...draft,
  time: "16:00",
});
const duplicate = createViewingRequest(duplicateDraft, "tenant", 1, now);
assert.equal(duplicate.issue?.code, "duplicate");
assert.equal(duplicate.issue?.requestId, id);
assert.equal(duplicate.state, duplicateDraft);
assert.equal(
  duplicateDraft.drafts![1].time,
  "16:00",
  "Rejected duplicate keeps the unsent draft",
);
const otherCreated = createViewingRequest(created.state, "tenant", 2, now);
assert.ok(
  otherCreated.requestId,
  "Different properties may be requested at the same time without invented exclusivity rules",
);
assert.equal(scopedViewingRequests(otherCreated.state, "tenant").length, 2);
assert.equal(
  scopedViewingRequests(otherCreated.state, "landlord").length,
  1,
  "Olivia sees only her property",
);
assert.equal(
  viewingActionDraft(otherCreated.state, "landlord", otherCreated.requestId!),
  null,
);
assert.equal(
  actOnViewingRequest(
    otherCreated.state,
    "landlord",
    otherCreated.requestId!,
    { type: "accept-request" },
    now,
  ),
  otherCreated.state,
);
assert.equal(
  saveViewingProposal(
    otherCreated.state,
    "landlord",
    otherCreated.requestId!,
    now,
  ).issue?.code,
  "unavailable",
);
for (const role of ["provider", "spaceOperator", "admin"] as const) {
  assert.deepEqual(scopedViewingRequests(created.state, role), []);
  assert.deepEqual(visibleViewingRequests(created.state, role), []);
  assert.equal(selectedViewingRequest(created.state, role), undefined);
  assert.equal(viewingDraft(created.state, role, 1), null);
  assert.equal(
    updateViewingDraft(created.state, role, 1, draft),
    created.state,
  );
  assert.equal(
    updateViewingActionDraft(created.state, role, id, draft),
    created.state,
  );
  assert.equal(
    createViewingRequest(created.state, role, 1, now).state,
    created.state,
  );
  assert.equal(selectViewingRequest(created.state, role, id), created.state);
  assert.equal(setViewingFilter(created.state, role, "All"), created.state);
  assert.equal(
    actOnViewingRequest(created.state, role, id, { type: "cancel" }, now),
    created.state,
  );
}
assert.equal(
  actOnViewingRequest(
    created.state,
    "tenant",
    id,
    { type: "accept-request" },
    now,
  ),
  created.state,
);
assert.equal(
  actOnViewingRequest(
    created.state,
    "tenant",
    id,
    { type: "decline-request" },
    now,
  ),
  created.state,
);
assert.equal(
  saveViewingProposal(created.state, "tenant", id, now).issue?.code,
  "unavailable",
);
const mismatchedTenant = {
  ...original,
  tenantId: "another-tenant",
  tenantName: "Inês Duarte",
};
assert.deepEqual(
  scopedViewingRequests({ viewings: [mismatchedTenant] }, "tenant"),
  [],
  "Display name never overrides tenant identity",
);
assert.equal(
  actOnViewingRequest(
    { viewings: [mismatchedTenant] },
    "tenant",
    id,
    { type: "cancel" },
    now,
  ).viewings[0],
  mismatchedTenant,
);
assert.deepEqual(
  scopedViewingRequests(
    { viewings: [{ ...original, propertyId: 999 }] },
    "landlord",
  ),
  [],
);
assert.deepEqual(
  scopedViewingRequests(
    { viewings: [{ ...original, role: "admin" }] },
    "tenant",
  ),
  [],
);
assert.equal(
  viewingActionIssue(
    created.state,
    "landlord",
    id,
    { type: "decline-request" },
    now,
  )?.code,
  "noteRequired",
);
assert.equal(
  viewingActionIssue(created.state, "landlord", id, { type: "cancel" }, now)
    ?.code,
  "noteRequired",
);
const ownerNote = updateViewingActionDraft(created.state, "landlord", id, {
  note: "Accepted in this tab.",
});
const accepted = actOnViewingRequest(
  ownerNote,
  "landlord",
  id,
  { type: "accept-request" },
  now,
);
assert.equal(record(accepted).status, "Agreed");
assert.deepEqual(record(accepted).agreedTerms, original.requestedTerms);
assert.notEqual(record(accepted).agreedTerms, original.requestedTerms);
assert.equal(record(accepted).requestedTerms, original.requestedTerms);
assert.equal(
  record(accepted).history.at(-1)!.note,
  undefined,
  "Immediate acceptance never publishes a private unsent proposal note",
);
assert.equal(
  ownerNote.actionDrafts?.landlord?.[id]?.note,
  "Accepted in this tab.",
);
assert.equal(
  accepted.actionDrafts?.landlord?.[id],
  ownerNote.actionDrafts?.landlord?.[id],
  "Unrelated immediate actions preserve the private draft",
);
assert.equal(
  actOnViewingRequest(
    accepted,
    "landlord",
    id,
    { type: "accept-request" },
    now,
  ),
  accepted,
);
assert.equal(upcomingAgreedViewings(accepted, "tenant", now)[0].id, id);
assert.equal(upcomingAgreedViewings(accepted, "landlord", now)[0].id, id);
assert.equal(viewingCounts(accepted, "tenant", now).agreed, 1);
assert.equal(
  record(created.state).status,
  "Pending",
  "Accepting leaves previous state unchanged",
);

const proposalDraft = updateViewingActionDraft(accepted, "landlord", id, {
  date: "2026-10-04",
  time: "15:30",
  note: "Could you visit the following afternoon?",
});
const proposed = saveViewingProposal(proposalDraft, "landlord", id, now);
assert.equal(proposed.issue, null);
assert.ok(proposed.proposalId);
const proposal1 = pendingViewingProposal(record(proposed.state))!;
assert.equal(proposal1.id, proposed.proposalId);
assert.equal(proposal1.version, 1);
assert.equal(record(proposed.state).status, "Proposed");
assert.equal(
  record(proposed.state).agreedTerms,
  record(accepted).agreedTerms,
  "Proposal does not replace the existing agreement",
);
assert.equal(record(proposed.state).date, original.date);
assert.equal(record(proposed.state).time, original.time);
assert.equal(
  upcomingAgreedViewings(proposed.state, "tenant", now)[0].agreedTerms!.time,
  original.time,
);
assert.equal(viewingCounts(proposed.state, "tenant", now).proposed, 1);
assert.equal(viewingCounts(proposed.state, "tenant", now).agreed, 1);
assert.equal(
  actOnViewingRequest(
    proposed.state,
    "landlord",
    id,
    { type: "accept-proposal", proposalId: proposal1.id },
    now,
  ),
  proposed.state,
  "Owner cannot accept their own changed time for the tenant",
);
assert.equal(
  viewingActionIssue(
    proposed.state,
    "tenant",
    id,
    { type: "accept-proposal", proposalId: "stale-id" },
    now,
  )?.code,
  "staleProposal",
);
const kept = actOnViewingRequest(
  proposed.state,
  "tenant",
  id,
  { type: "decline-proposal", proposalId: proposal1.id },
  now,
);
assert.equal(record(kept).status, "Agreed");
assert.equal(record(kept).agreedTerms, record(accepted).agreedTerms);
assert.equal(record(kept).proposals[0].status, "Declined");
assert.equal(record(proposed.state).proposals[0].status, "Pending");
assert.equal(pendingViewingProposal(record(kept)), null);
assert.equal(
  actOnViewingRequest(
    kept,
    "tenant",
    id,
    { type: "accept-proposal", proposalId: proposal1.id },
    now,
  ),
  kept,
);
const secondProposalDraft = updateViewingActionDraft(kept, "landlord", id, {
  date: "2026-10-05",
  time: "16:30",
  note: "Here is another option.",
});
const proposedAgain = saveViewingProposal(
  secondProposalDraft,
  "landlord",
  id,
  now,
);
assert.equal(pendingViewingProposal(record(proposedAgain.state))!.version, 2);
const supersedingDraft = updateViewingActionDraft(
  proposedAgain.state,
  "landlord",
  id,
  {
    date: "2026-10-06",
    time: "17:30",
    note: "This replaces the pending suggestion.",
  },
);
const superseded = saveViewingProposal(supersedingDraft, "landlord", id, now);
assert.equal(record(superseded.state).proposals[1].status, "Superseded");
assert.equal(record(proposedAgain.state).proposals[1].status, "Pending");
assert.equal(pendingViewingProposal(record(superseded.state))!.version, 3);
assert.equal(
  actOnViewingRequest(
    superseded.state,
    "tenant",
    id,
    { type: "accept-proposal", proposalId: proposedAgain.proposalId! },
    now,
  ),
  superseded.state,
);
const changed = actOnViewingRequest(
  superseded.state,
  "tenant",
  id,
  { type: "accept-proposal", proposalId: superseded.proposalId! },
  now,
);
assert.equal(record(changed).status, "Agreed");
assert.deepEqual(record(changed).agreedTerms, {
  date: "2026-10-06",
  time: "17:30",
});
assert.equal(record(changed).date, "2026-10-06");
assert.equal(record(changed).time, "17:30");
assert.equal(
  record(changed).requestedTerms,
  original.requestedTerms,
  "Original request remains available after multiple proposals",
);
assert.equal(record(changed).proposals[2].status, "Accepted");
assert.equal(record(changed).history.at(-1)!.proposalId, superseded.proposalId);
assert.equal(
  record(changed).history[1].terms!.time,
  original.time,
  "The original agreement remains in history",
);
assert.equal(
  actOnViewingRequest(
    changed,
    "tenant",
    id,
    { type: "accept-proposal", proposalId: superseded.proposalId! },
    now,
  ),
  changed,
);

const pendingProposal = saveViewingProposal(
  updateViewingActionDraft(created.state, "landlord", id, {
    date: "2026-10-04",
    time: "10:00",
    note: "Morning is available locally.",
  }),
  "landlord",
  id,
  now,
);
const declinedTime = actOnViewingRequest(
  pendingProposal.state,
  "tenant",
  id,
  { type: "decline-proposal", proposalId: pendingProposal.proposalId! },
  now,
);
assert.equal(record(declinedTime).status, "Pending");
assert.equal(
  record(declinedTime).agreedTerms,
  undefined,
  "Declining an alternative does not accept the original request",
);
assert.equal(upcomingAgreedViewings(declinedTime, "tenant", now).length, 0);
assert.equal(
  record(
    actOnViewingRequest(
      declinedTime,
      "landlord",
      id,
      { type: "accept-request" },
      now,
    ),
  ).status,
  "Agreed",
);
const declinedRequest = actOnViewingRequest(
  updateViewingActionDraft(pendingProposal.state, "landlord", id, {
    note: "The home is unavailable.",
  }),
  "landlord",
  id,
  { type: "decline-request" },
  now,
);
assert.equal(record(declinedRequest).status, "Declined");
assert.equal(record(declinedRequest).proposals[0].status, "Withdrawn");
assert.equal(
  record(declinedRequest).history.at(-1)!.note,
  "The home is unavailable.",
);
assert.equal(
  saveViewingProposal(declinedRequest, "landlord", id, now).issue?.code,
  "unavailable",
);
assert.equal(
  actOnViewingRequest(declinedRequest, "tenant", id, { type: "cancel" }, now),
  declinedRequest,
);
const newAfterDecline = createViewingRequest(
  updateViewingDraft(declinedRequest, "tenant", 1, draft),
  "tenant",
  1,
  now,
);
assert.ok(newAfterDecline.requestId);
assert.notEqual(newAfterDecline.requestId, id);
assert.equal(newAfterDecline.state.viewings.length, 2);
assert.equal(record(newAfterDecline.state), record(declinedRequest));
const cancellationDraft = updateViewingActionDraft(
  proposed.state,
  "tenant",
  id,
  { note: "My plans changed." },
);
const cancelledAgreement = actOnViewingRequest(
  cancellationDraft,
  "tenant",
  id,
  { type: "cancel" },
  now,
);
assert.equal(record(cancelledAgreement).status, "Cancelled");
assert.equal(
  record(cancelledAgreement).agreedTerms,
  record(accepted).agreedTerms,
  "Cancellation retains the last agreement as historical data",
);
assert.equal(record(cancelledAgreement).proposals[0].status, "Withdrawn");
assert.equal(
  upcomingAgreedViewings(cancelledAgreement, "tenant", now).length,
  0,
);
assert.equal(
  record(cancelledAgreement).history.at(-1)!.note,
  "My plans changed.",
);
assert.equal(viewingCounts(cancelledAgreement, "tenant", now).history, 1);
const ownerCancelled = actOnViewingRequest(
  updateViewingActionDraft(accepted, "landlord", id, {
    note: "I cannot attend this appointment.",
  }),
  "landlord",
  id,
  { type: "cancel" },
  now,
);
assert.equal(record(ownerCancelled).status, "Cancelled");
assert.equal(record(ownerCancelled).history.at(-1)!.actor, "landlord");
assert.equal(
  viewingActionIssue(accepted, "landlord", id, { type: "decline-request" }, now)
    ?.code,
  "unavailable",
  "An agreement uses explicit cancellation, never decline-original",
);

assert.equal(
  viewingDraftErrors({ ...draft, date: "2026-10-02", time: "12:30" }, now).time,
  "pastTime",
);
assert.equal(
  viewingDraftErrors({ ...draft, date: "2026-02-30" }, now).date,
  "invalidDate",
);
assert.equal(
  viewingDraftErrors({ ...draft, time: "24:00" }, now).time,
  "invalidTime",
);
assert.equal(
  viewingDraftErrors({ ...draft, note: "x".repeat(1001) }, now).note,
  "noteTooLong",
);
for (const patch of [
  { date: "2026-02-30", time: "10:00", note: "A valid explanation." },
  { date: "2026-10-02", time: "12:00", note: "A valid explanation." },
  { date: "2026-10-05", time: "25:00", note: "A valid explanation." },
  { date: "2026-10-05", time: "10:00", note: " x " },
  { date: "2026-10-05", time: "10:00", note: "x".repeat(1001) },
  { ...draft, note: "The existing time is unchanged." },
]) {
  const invalid = updateViewingActionDraft(
    created.state,
    "landlord",
    id,
    patch,
  );
  assert.ok(
    Object.keys(validateViewingProposal(invalid, "landlord", id, now)).length,
  );
  assert.equal(
    saveViewingProposal(invalid, "landlord", id, now).state,
    invalid,
  );
}
const repeatedPending = updateViewingActionDraft(
  proposed.state,
  "landlord",
  id,
  { ...proposal1.terms, note: "The same pending time." },
);
assert.equal(
  validateViewingProposal(repeatedPending, "landlord", id, now).time,
  "noChanges",
);
const elapsedOriginal = new Date(2026, 9, 3, 14, 31);
assert.equal(
  viewingActionIssue(
    created.state,
    "landlord",
    id,
    { type: "accept-request" },
    elapsedOriginal,
  )?.code,
  "pastTime",
);
assert.equal(
  actOnViewingRequest(
    created.state,
    "landlord",
    id,
    { type: "accept-request" },
    elapsedOriginal,
  ),
  created.state,
);
const elapsedProposal = new Date(2026, 9, 4, 15, 31);
assert.equal(
  viewingActionIssue(
    proposed.state,
    "tenant",
    id,
    { type: "accept-proposal", proposalId: proposal1.id },
    elapsedProposal,
  )?.code,
  "pastTime",
);
assert.equal(
  actOnViewingRequest(
    proposed.state,
    "tenant",
    id,
    { type: "accept-proposal", proposalId: proposal1.id },
    elapsedProposal,
  ),
  proposed.state,
);
assert.equal(
  record(
    actOnViewingRequest(
      proposed.state,
      "tenant",
      id,
      { type: "decline-proposal", proposalId: proposal1.id },
      elapsedProposal,
    ),
  ).status,
  "Agreed",
  "An elapsed suggestion can still be declined without inventing attendance",
);
assert.equal(
  upcomingAgreedViewings(accepted, "tenant", elapsedOriginal).length,
  0,
);
assert.equal(viewingCounts(accepted, "tenant", elapsedOriginal).history, 1);
const laterDraft = updateViewingDraft(accepted, "tenant", 1, {
  date: "2026-10-07",
  time: "18:00",
  note: "Another visit after the past agreement.",
});
assert.ok(
  createViewingRequest(laterDraft, "tenant", 1, elapsedOriginal).requestId,
  "A past agreement is retained while permitting a later request",
);
const newerActive = createViewingRequest(
  laterDraft,
  "tenant",
  1,
  elapsedOriginal,
);
const oldRescheduleDraft = updateViewingActionDraft(
  newerActive.state,
  "landlord",
  id,
  {
    date: "2026-10-08",
    time: "11:00",
    note: "Try to revive the historical appointment.",
  },
);
assert.equal(
  validateViewingProposal(oldRescheduleDraft, "landlord", id, elapsedOriginal)
    .note,
  "duplicate",
);
const blockedRevival = saveViewingProposal(
  oldRescheduleDraft,
  "landlord",
  id,
  elapsedOriginal,
);
assert.equal(blockedRevival.issue?.code, "duplicate");
assert.equal(blockedRevival.issue?.requestId, newerActive.requestId);
assert.equal(
  blockedRevival.state,
  oldRescheduleDraft,
  "An old agreed record cannot become a second active request for the same applicant/property",
);
assert.equal(
  record(blockedRevival.state).history.length,
  record(accepted).history.length,
);
assert.equal(
  record(blockedRevival.state, newerActive.requestId!).status,
  "Pending",
);
const distinctApplicantState: PropertyRequestState = {
  ...oldRescheduleDraft,
  viewings: oldRescheduleDraft.viewings.map((item) =>
    item.id === newerActive.requestId
      ? {
          ...item,
          tenantId: "another-applicant",
          tenantName: "Another applicant",
        }
      : item,
  ),
};
assert.ok(
  saveViewingProposal(distinctApplicantState, "landlord", id, elapsedOriginal)
    .proposalId,
  "Different applicants are not subjected to an invented property availability restriction",
);
const syntheticDuplicate: PropertyRequestState = {
  ...proposed.state,
  viewings: [
    ...proposed.state.viewings,
    {
      ...record(newerActive.state, newerActive.requestId!),
      id: "viewing-competing",
    },
  ],
};
assert.equal(
  viewingActionIssue(
    syntheticDuplicate,
    "tenant",
    id,
    { type: "accept-proposal", proposalId: proposal1.id },
    now,
  )?.code,
  "duplicate",
  "Acceptance also guards imported or stale duplicate active state",
);

const separateActions = updateViewingActionDraft(
  updateViewingActionDraft(created.state, "landlord", id, {
    date: "2026-10-04",
    time: "09:00",
    note: "Owner's unsent proposal.",
  }),
  "tenant",
  id,
  { date: "2030-01-01", time: "00:00", note: "Tenant's cancellation note." },
);
assert.equal(
  viewingActionDraft(separateActions, "landlord", id)!.note,
  "Owner's unsent proposal.",
);
assert.equal(
  viewingActionDraft(separateActions, "tenant", id)!.note,
  "Tenant's cancellation note.",
);
assert.equal(
  viewingActionDraft(separateActions, "tenant", id)!.date,
  original.date,
  "Tenant cannot alter proposed dates through action-draft fields",
);
assert.equal(record(separateActions).date, original.date);
const ownFilter = setViewingFilter(otherCreated.state, "landlord", "History");
assert.equal(viewingView(ownFilter, "tenant").filter, "Pending");
assert.equal(viewingView(ownFilter, "landlord").filter, "History");
assert.equal(
  selectedViewingRequest(ownFilter, "landlord", now),
  undefined,
  "Details cannot remain outside a filtered list",
);
assert.equal(
  selectViewingRequest(ownFilter, "landlord", otherCreated.requestId!),
  ownFilter,
  "Selecting cannot cross property ownership",
);
const selectedOwned = selectViewingRequest(ownFilter, "landlord", id);
assert.equal(viewingView(selectedOwned, "landlord").filter, "All");
assert.equal(selectedViewingRequest(selectedOwned, "landlord", now)?.id, id);
assert.equal(
  viewingCounts(setViewingFilter(changed, "tenant", "Pending"), "tenant", now)
    .agreed,
  1,
  "Counts do not depend on the active list filter",
);
assert.equal(
  visibleViewingRequests(
    setViewingFilter(accepted, "tenant", "History"),
    "tenant",
    elapsedOriginal,
  ).length,
  1,
);

Object.freeze(original.requestedTerms);
Object.freeze(original.history[0].terms);
Object.freeze(original.history[0]);
Object.freeze(original.history);
Object.freeze(original.proposals);
Object.freeze(original);
Object.freeze(proposal1.terms);
Object.freeze(proposal1);
assert.equal(
  record(
    actOnViewingRequest(
      created.state,
      "landlord",
      id,
      { type: "accept-request" },
      now,
    ),
  ).status,
  "Agreed",
);
assert.equal(
  record(
    actOnViewingRequest(
      proposed.state,
      "tenant",
      id,
      { type: "accept-proposal", proposalId: proposal1.id },
      now,
    ),
  ).status,
  "Agreed",
);
assert.equal(record(created.state), original);
assert.equal(proposal1.status, "Pending");
const longPrivateOwnerNote = updateViewingActionDraft(
  created.state,
  "landlord",
  id,
  {
    note: "private proposal draft ".repeat(100),
  },
);
assert.equal(
  viewingActionIssue(
    longPrivateOwnerNote,
    "landlord",
    id,
    { type: "accept-request" },
    now,
  ),
  null,
  "An unrelated private draft cannot block immediate acceptance",
);
const privateOwnerAccepted = actOnViewingRequest(
  longPrivateOwnerNote,
  "landlord",
  id,
  { type: "accept-request" },
  now,
);
assert.equal(record(privateOwnerAccepted).history.at(-1)!.note, undefined);
assert.equal(
  privateOwnerAccepted.actionDrafts?.landlord?.[id],
  longPrivateOwnerNote.actionDrafts?.landlord?.[id],
);
for (const type of ["accept-proposal", "decline-proposal"] as const) {
  const privateCancellation = updateViewingActionDraft(
    proposed.state,
    "tenant",
    id,
    { note: "private cancellation draft ".repeat(100) },
  );
  assert.equal(
    viewingActionIssue(
      privateCancellation,
      "tenant",
      id,
      { type, proposalId: proposal1.id },
      now,
    ),
    null,
  );
  const decided = actOnViewingRequest(
    privateCancellation,
    "tenant",
    id,
    { type, proposalId: proposal1.id },
    now,
  );
  assert.equal(
    record(decided).history.at(-1)!.note,
    undefined,
    "Immediate proposal decisions never publish an unsent cancellation reason",
  );
  assert.equal(
    decided.actionDrafts?.tenant?.[id],
    privateCancellation.actionDrafts?.tenant?.[id],
  );
  assert.ok(
    !JSON.stringify(record(decided).history).includes(
      "private cancellation draft",
    ),
  );
}
assert.equal(
  new Set(record(changed).history.map((event) => event.id)).size,
  record(changed).history.length,
);
assert.equal(initial.viewings.length, 0);
assert.equal(initial.drafts, undefined);
assert.deepEqual(
  validateRentalApplication(
    { moveInDate: "2026-10-02", householdSize: 1, introduction: "" },
    now,
  ),
  {},
  "Rental application validation remains unchanged",
);
console.log(
  "Property request checks passed: retained private drafts, canonical role/property scope, immutable originals, explicit agreements, versioned proposal decisions, future-time rechecks, cancellation/history, filters, and preserved rental validation.",
);
