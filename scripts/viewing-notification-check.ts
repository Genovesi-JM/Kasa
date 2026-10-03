import assert from "node:assert/strict";
import { properties } from "../src/data";
import type { Role } from "../src/types";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  type KasaNotification,
  type NotificationState,
} from "../src/components/notificationState";
import {
  actOnViewingRequest,
  createInitialPropertyRequestState,
  createViewingRequest,
  pendingViewingProposal,
  saveViewingProposal,
  selectedViewingRequest,
  selectViewingRequest,
  setViewingFilter,
  updateViewingActionDraft,
  updateViewingDraft,
  viewingView,
  type PropertyRequestState,
  type ViewingAction,
  type ViewingHistoryEvent,
  type ViewingRequest,
} from "../src/components/propertyRequestState";
import {
  openViewingNotification,
  reconcileViewingNotifications,
} from "../src/components/viewingNotifications";
import {
  createInitialWorkState,
  submitWorkApplication,
  updateWorkApplicationDraft,
} from "../src/components/workState";
import { reconcileWorkNotifications } from "../src/components/workNotifications";

const time = (minute: number) =>
  new Date(`2032-05-10T12:${String(minute).padStart(2, "0")}:00.000Z`);
const initial = createInitialPropertyRequestState();
const seeds = createInitialNotificationState();
const privateNote = "PRIVATE_VIEWING_NOTE: access and personal arrangements";
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
type Kind = NonNullable<KasaNotification["viewingEvent"]>["kind"];
const activity = (feed: NotificationState) =>
  feed.items.filter((item) => item.viewingEvent);
function record(state: PropertyRequestState, id: string) {
  const value = state.viewings.find((item) => item.id === id);
  assert.ok(value);
  return value;
}
function only(value: ViewingRequest): PropertyRequestState {
  return { ...initial, viewings: [value] };
}
function notice(
  feed: NotificationState,
  id: string,
  kind: Kind,
  minute?: number,
) {
  const value = activity(feed).find(
    (item) =>
      item.viewingEvent!.requestId === id &&
      item.viewingEvent!.kind === kind &&
      (minute === undefined ||
        item.viewingEvent!.occurredAt === time(minute).toISOString()),
  );
  assert.ok(value, `${kind} for ${id} at ${minute}`);
  return value;
}
function request(state: PropertyRequestState, minute: number, propertyId = 1) {
  const result = createViewingRequest(
    updateViewingDraft(state, "tenant", propertyId, {
      date: "2032-05-15",
      time: "10:00",
      note: privateNote,
    }),
    "tenant",
    propertyId,
    time(minute),
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.requestId);
  return { state: result.state, id: result.requestId };
}
function act(
  state: PropertyRequestState,
  id: string,
  role: Role,
  action: ViewingAction,
  minute: number,
) {
  const next = actOnViewingRequest(state, role, id, action, time(minute));
  assert.notEqual(next, state, `Expected ${action.type} to succeed`);
  return next;
}
function propose(
  state: PropertyRequestState,
  id: string,
  minute: number,
  clock: string,
) {
  const result = saveViewingProposal(
    updateViewingActionDraft(state, "landlord", id, {
      date: "2032-05-16",
      time: clock,
      note: privateNote,
    }),
    "landlord",
    id,
    time(minute),
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.proposalId);
  return { state: result.state, proposalId: result.proposalId };
}

// No initial, private-draft, failed-action or unchanged-state activity becomes an alert.
assert.equal(reconcileViewingNotifications(seeds, initial), seeds);
const privateDraft = updateViewingDraft(initial, "tenant", 1, {
  note: privateNote,
});
assert.equal(reconcileViewingNotifications(seeds, privateDraft), seeds);
assert.equal(
  createViewingRequest(privateDraft, "tenant", 1, time(0)).state,
  privateDraft,
);
const first = request(initial, 0);
const id = first.id;
const submissionFeed = reconcileViewingNotifications(seeds, first.state);
assert.equal(activity(submissionFeed).length, 1);
const submission = notice(submissionFeed, id, "request-submitted", 0);
assert.equal(submission.role, "landlord");
const drafted = updateViewingActionDraft(first.state, "landlord", id, {
  note: privateNote,
});
assert.equal(
  reconcileViewingNotifications(submissionFeed, drafted),
  submissionFeed,
);
assert.equal(
  saveViewingProposal(drafted, "landlord", id, time(1)).state,
  drafted,
);
assert.equal(
  actOnViewingRequest(
    drafted,
    "tenant",
    id,
    { type: "accept-request" },
    time(1),
  ),
  drafted,
);

// Real immutable histories cover all seven kinds, both cancellation actors and revised proposals.
const accepted = act(drafted, id, "landlord", { type: "accept-request" }, 1);
const p1 = propose(accepted, id, 2, "11:00");
const p1Feed = reconcileViewingNotifications(submissionFeed, p1.state);
const readP1 = markNotificationRead(
  p1Feed,
  "tenant",
  notice(p1Feed, id, "proposal-recorded", 2).id,
);
const p2 = propose(p1.state, id, 3, "12:00");
const declinedProposal = act(
  p2.state,
  id,
  "tenant",
  { type: "decline-proposal", proposalId: p2.proposalId },
  4,
);
const p3 = propose(declinedProposal, id, 5, "13:00");
const acceptedProposal = act(
  p3.state,
  id,
  "tenant",
  { type: "accept-proposal", proposalId: p3.proposalId },
  6,
);
const p4 = propose(acceptedProposal, id, 7, "14:00");
const cancelled = act(
  updateViewingActionDraft(p4.state, "tenant", id, { note: privateNote }),
  id,
  "tenant",
  { type: "cancel" },
  8,
);
const second = request(cancelled, 9);
const declined = act(
  updateViewingActionDraft(second.state, "landlord", second.id, {
    note: privateNote,
  }),
  second.id,
  "landlord",
  { type: "decline-request" },
  10,
);
const third = request(declined, 11);
const final = act(
  updateViewingActionDraft(third.state, "landlord", third.id, {
    note: privateNote,
  }),
  third.id,
  "landlord",
  { type: "cancel" },
  12,
);
const beforeFinal = JSON.stringify(final);
const feed = reconcileViewingNotifications(readP1, final);
assert.equal(activity(feed).length, 13);
assert.deepEqual(
  [...new Set(activity(feed).map((item) => item.viewingEvent!.kind))].sort(),
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
for (const [requestId, kind, minute, role] of [
  [id, "request-submitted", 0, "landlord"],
  [id, "request-accepted", 1, "tenant"],
  [id, "proposal-recorded", 2, "tenant"],
  [id, "proposal-recorded", 3, "tenant"],
  [id, "proposal-declined", 4, "landlord"],
  [id, "proposal-recorded", 5, "tenant"],
  [id, "proposal-accepted", 6, "landlord"],
  [id, "proposal-recorded", 7, "tenant"],
  [id, "request-cancelled", 8, "landlord"],
  [second.id, "request-submitted", 9, "landlord"],
  [second.id, "request-declined", 10, "tenant"],
  [third.id, "request-submitted", 11, "landlord"],
  [third.id, "request-cancelled", 12, "tenant"],
] as const) {
  const item = notice(feed, requestId, kind, minute);
  assert.equal(item.role, role);
  assert.equal(item.destination, "viewings");
  assert.equal(item.icon, "calendar");
  assert.equal(item.serviceMode, undefined);
  assert.deepEqual(
    Object.keys(item.viewingEvent!).sort(),
    ["kind", "requestId", "propertyTitle", "occurredAt"].sort(),
  );
  assert.equal(
    item.viewingEvent!.propertyTitle,
    properties.find((property) => property.id === 1)!.title,
  );
  const sourceEvent = record(final, requestId).history.find(
    (event) => event.at === time(minute).toISOString(),
  )!;
  assert.equal(sourceEvent.source, "local");
  assert.equal(
    item.id,
    `viewing:${JSON.stringify([role, requestId, sourceEvent.id])}`,
  );
}
assert.equal(notice(feed, id, "proposal-recorded", 2).read, true);
assert.equal(notice(feed, id, "proposal-recorded", 3).read, false);
const payloads = JSON.stringify(activity(feed));
for (const secret of [
  privateNote,
  "tenant-ines",
  "Inês Duarte",
  "Olivia Martín",
  "2032-05-15",
  "2032-05-16",
  p1.proposalId,
])
  assert.equal(
    payloads.includes(secret),
    false,
    `Private source content: ${secret}`,
  );
assert.equal(JSON.stringify(final), beforeFinal);
assert.equal(reconcileViewingNotifications(feed, final), feed);

// Legacy/sample histories may anchor later real actions, but never emit their own alerts.
const original = record(first.state, id);
for (const source of [undefined, "sample"] as const) {
  const anchor = {
    ...original,
    history: original.history.map((event) => ({ ...event, source })),
  };
  assert.equal(reconcileViewingNotifications(seeds, only(anchor)), seeds);
  const later = act(
    only(anchor),
    id,
    "landlord",
    { type: "accept-request" },
    1,
  );
  const laterFeed = reconcileViewingNotifications(seeds, later);
  assert.equal(activity(laterFeed).length, 1);
  assert.equal(notice(laterFeed, id, "request-accepted", 1).role, "tenant");
}
const historical = {
  ...final,
  viewings: final.viewings.map((item) => ({
    ...item,
    history: item.history.map((event) => ({ ...event, source: undefined })),
  })),
};
assert.equal(reconcileViewingNotifications(seeds, historical), seeds);
const pastTime = new Date("2020-05-10T12:00:00.000Z");
const pastRequest = createViewingRequest(
  updateViewingDraft(initial, "tenant", 1, {
    date: "2020-05-15",
    time: "10:00",
    note: privateNote,
  }),
  "tenant",
  1,
  pastTime,
);
assert.ok(pastRequest.requestId);
const pastAccepted = actOnViewingRequest(
  pastRequest.state,
  "landlord",
  pastRequest.requestId,
  { type: "accept-request" },
  pastTime,
);
assert.equal(record(pastAccepted, pastRequest.requestId).status, "Agreed");
assert.equal(
  activity(reconcileViewingNotifications(seeds, pastAccepted)).length,
  2,
  "An elapsed appointment does not erase recorded activity",
);

// Actual actions may record a device clock rollback; history order, not wall time, links them.
const rollbackRequest = request(initial, 10);
const rollbackAccepted = act(
  rollbackRequest.state,
  rollbackRequest.id,
  "landlord",
  { type: "accept-request" },
  9,
);
const rollbackProposal = propose(
  rollbackAccepted,
  rollbackRequest.id,
  8,
  "11:30",
);
const rollbackDecision = act(
  rollbackProposal.state,
  rollbackRequest.id,
  "tenant",
  { type: "accept-proposal", proposalId: rollbackProposal.proposalId },
  7,
);
const rollbackCancelled = act(
  updateViewingActionDraft(rollbackDecision, "tenant", rollbackRequest.id, {
    note: privateNote,
  }),
  rollbackRequest.id,
  "tenant",
  { type: "cancel" },
  6,
);
const rollbackFeed = reconcileViewingNotifications(seeds, rollbackCancelled);
assert.equal(activity(rollbackFeed).length, 5);
assert.equal(
  notice(rollbackFeed, rollbackRequest.id, "request-cancelled", 6).role,
  "landlord",
);
assert.equal(
  notice(rollbackFeed, rollbackRequest.id, "proposal-accepted", 7).role,
  "landlord",
);
assert.equal(
  record(rollbackCancelled, rollbackRequest.id).updatedAt,
  time(6).toISOString(),
);

// Both sides must belong to the canonical owner/tenant intersection.
const foreign = request(final, 13, 2);
assert.equal(reconcileViewingNotifications(feed, foreign.state), feed);
const renamedTenant = reconcileViewingNotifications(
  seeds,
  only({ ...original, tenantName: privateNote }),
);
assert.deepEqual(activity(renamedTenant), activity(submissionFeed));
assert.equal(JSON.stringify(renamedTenant).includes(privateNote), false);
for (const patch of [
  { propertyId: 2 },
  { propertyId: 999 },
  { tenantId: "other-tenant" },
  { role: "landlord" as Role },
  { createdAt: "invalid" },
  { updatedAt: "invalid" },
  { note: "Conflicts with the immutable requested event" },
] as Partial<ViewingRequest>[]) {
  const invalid = only({ ...original, ...patch });
  assert.equal(
    activity(reconcileViewingNotifications(seeds, invalid)).length,
    0,
  );
  assert.equal(openViewingNotification(invalid, "landlord", submission), null);
}

// Invalid event metadata and broken source links cannot impersonate recorded decisions.
for (const patch of [
  { id: "" },
  { id: " " },
  { actor: "provider" as Role },
  { at: "bad date" },
  { at: "2032-05-10T12:00:00Z" },
  { at: time(30).toISOString() },
  { source: "sample" as const },
  { source: undefined },
  { source: "remote" as ViewingHistoryEvent["source"] },
  { terms: { ...original.requestedTerms, time: "11:59" } },
] as Partial<ViewingHistoryEvent>[]) {
  const invalid = only({
    ...original,
    history: original.history.map((event) => ({ ...event, ...patch })),
  });
  assert.equal(
    activity(reconcileViewingNotifications(seeds, invalid)).length,
    0,
  );
  assert.equal(openViewingNotification(invalid, "landlord", submission), null);
}
for (const [source, action, kind, minute] of [
  [record(accepted, id), "accepted", "request-accepted", 1],
  [record(p1.state, id), "proposed", "proposal-recorded", 2],
  [record(declinedProposal, id), "proposal-declined", "proposal-declined", 4],
  [record(acceptedProposal, id), "proposal-accepted", "proposal-accepted", 6],
  [record(cancelled, id), "cancelled", "request-cancelled", 8],
  [record(declined, second.id), "declined", "request-declined", 10],
] as const) {
  for (const patch of [
    { actor: "admin" as Role },
    { at: time(40).toISOString() },
    { source: "sample" as const },
    { source: undefined },
    ...(action === "proposed" || action.startsWith("proposal-")
      ? [{ proposalId: "missing-proposal" }]
      : []),
    ...(action === "accepted" ||
    action === "proposed" ||
    action.startsWith("proposal-")
      ? [{ terms: { date: "2032-05-31", time: "23:59" } }]
      : []),
  ] as Partial<ViewingHistoryEvent>[]) {
    const invalid = only({
      ...source,
      history: source.history.map((event) =>
        event.action === action && event.at === time(minute).toISOString()
          ? { ...event, ...patch }
          : event,
      ),
    });
    const invalidFeed = reconcileViewingNotifications(seeds, invalid);
    assert.equal(
      activity(invalidFeed).some(
        (item) =>
          item.viewingEvent!.kind === kind &&
          item.viewingEvent!.occurredAt === time(minute).toISOString(),
      ),
      false,
      `${action}/${JSON.stringify(patch)}`,
    );
    const target = notice(feed, source.id, kind, minute);
    assert.equal(openViewingNotification(invalid, target.role, target), null);
  }
}
for (const status of ["Pending", "Declined"] as const) {
  const badDecision = record(acceptedProposal, id);
  const invalid = only({
    ...badDecision,
    proposals: badDecision.proposals.map((proposal) =>
      proposal.id === p3.proposalId ? { ...proposal, status } : proposal,
    ),
  });
  assert.equal(
    activity(reconcileViewingNotifications(seeds, invalid)).some(
      (item) => item.viewingEvent!.kind === "proposal-accepted",
    ),
    false,
  );
}
const decisionRecord = record(acceptedProposal, id);
for (const history of [
  decisionRecord.history.filter(
    (event) =>
      !(event.action === "proposed" && event.proposalId === p3.proposalId),
  ),
  [decisionRecord.history.at(-1)!, ...decisionRecord.history.slice(0, -1)],
]) {
  const invalid = only({ ...decisionRecord, history });
  assert.equal(
    activity(reconcileViewingNotifications(seeds, invalid)).some(
      (item) => item.viewingEvent!.kind === "proposal-accepted",
    ),
    false,
  );
}
const ambiguousEvent = only({
  ...original,
  history: [...original.history, { ...original.history[0], actor: "landlord" }],
});
assert.equal(
  activity(reconcileViewingNotifications(seeds, ambiguousEvent)).length,
  0,
);
const duplicateRequests = {
  ...first.state,
  viewings: [original, { ...original, propertyId: 2 }],
};
assert.equal(
  activity(reconcileViewingNotifications(seeds, duplicateRequests)).length,
  0,
);
assert.equal(
  openViewingNotification(duplicateRequests, "landlord", submission),
  null,
);

const proposedRecord = record(p1.state, id);
for (const extra of [
  { ...proposedRecord.proposals[0] },
  { ...proposedRecord.proposals[0], id: `${id}-proposal-999` },
]) {
  const invalid = only({
    ...proposedRecord,
    proposals: [...proposedRecord.proposals, extra],
  });
  assert.equal(
    activity(reconcileViewingNotifications(seeds, invalid)).some(
      (item) => item.viewingEvent!.kind === "proposal-recorded",
    ),
    false,
  );
  assert.equal(
    openViewingNotification(
      invalid,
      "tenant",
      notice(feed, id, "proposal-recorded", 2),
    ),
    null,
  );
}

// Reconciliation preserves valid read receipts, normalizes payloads, deduplicates and prunes locally.
let allRead = feed;
for (const role of roles) allRead = markAllNotificationsRead(allRead, role);
const receipt = notice(allRead, id, "request-submitted", 0);
const dirtyFeed = {
  items: [
    ...allRead.items,
    { ...receipt, read: false },
    { ...receipt, role: "tenant" as Role, read: false },
  ],
};
const deduped = reconcileViewingNotifications(dirtyFeed, final);
assert.equal(activity(deduped).length, 13);
assert.equal(notice(deduped, id, "request-submitted", 0).read, true);
const forgedReceipt = reconcileViewingNotifications(
  { items: [{ ...submission, role: "tenant", read: true }] },
  first.state,
);
assert.equal(
  notice(forgedReceipt, id, "request-submitted", 0).read,
  false,
  "A read receipt from another role cannot mark the owner activity read",
);
const nextRequest = request(final, 14);
const laterFeed = reconcileViewingNotifications(allRead, nextRequest.state);
assert.equal(activity(laterFeed).filter((item) => !item.read).length, 1);
assert.equal(
  notice(laterFeed, nextRequest.id, "request-submitted", 14).read,
  false,
);
const repeatedHistory = {
  ...final,
  viewings: final.viewings.map((item) => ({
    ...item,
    history: [...item.history, ...item.history.map((event) => ({ ...event }))],
  })),
};
assert.equal(
  activity(reconcileViewingNotifications(feed, repeatedHistory)).length,
  13,
);
assert.deepEqual(
  reconcileViewingNotifications(feed, initial).items,
  feed.items.filter((item) => !item.viewingEvent),
);
assert.equal(
  activity(
    reconcileViewingNotifications(feed, {
      ...final,
      viewings: final.viewings.map((item) => ({ ...item, history: [] })),
    }),
  ).length,
  0,
);

// Historical alerts reveal the exact current request, never a decision or private draft mutation.
let obstructed = updateViewingDraft(nextRequest.state, "tenant", 3, {
  note: "UNSENT_NEW_REQUEST",
});
for (const role of ["tenant", "landlord"] as const) {
  obstructed = updateViewingActionDraft(obstructed, role, nextRequest.id, {
    note: `UNSENT_ACTION_${role}`,
  });
  obstructed = setViewingFilter(
    selectViewingRequest(obstructed, role, nextRequest.id),
    role,
    "Pending",
  );
}
for (const item of activity(feed)) {
  const requestId = item.viewingEvent!.requestId;
  const originalJson = JSON.stringify(obstructed);
  const target = openViewingNotification(obstructed, item.role, item);
  assert.ok(target);
  assert.equal(target.requestId, requestId);
  assert.equal(
    selectedViewingRequest(target.state, item.role, time(20))?.id,
    requestId,
  );
  assert.deepEqual(viewingView(target.state, item.role), {
    filter: "All",
    selectedId: requestId,
  });
  assert.equal(target.state.viewings, obstructed.viewings);
  assert.equal(target.state.drafts, obstructed.drafts);
  assert.equal(target.state.actionDrafts, obstructed.actionDrafts);
  assert.equal(target.state.nextId, obstructed.nextId);
  for (const other of roles) {
    if (other === item.role) continue;
    assert.equal(target.state.views?.[other], obstructed.views?.[other]);
    assert.equal(openViewingNotification(obstructed, other, item), null);
  }
  assert.equal(JSON.stringify(obstructed), originalJson);
}
const currentNotice = notice(
  laterFeed,
  nextRequest.id,
  "request-submitted",
  14,
);
const historyFiltered = setViewingFilter(obstructed, "landlord", "History");
assert.equal(
  selectedViewingRequest(
    openViewingNotification(historyFiltered, "landlord", currentNotice)!.state,
    "landlord",
    time(20),
  )?.id,
  nextRequest.id,
);
assert.equal(
  openViewingNotification(obstructed, "landlord", {
    ...submission,
    id: "viewing:forged",
  }),
  null,
);
assert.equal(openViewingNotification(initial, "landlord", submission), null);
assert.equal(
  openViewingNotification(obstructed, "landlord", seeds.items[0]),
  null,
);
const forgedPayload: KasaNotification = {
  ...submission,
  destination: "admin",
  viewingEvent: {
    ...submission.viewingEvent!,
    requestId: foreign.id,
    kind: "request-cancelled",
    propertyTitle: "FORGED_PRIVATE_TITLE",
    occurredAt: time(59).toISOString(),
  },
};
const canonicalOpen = openViewingNotification(
  obstructed,
  "landlord",
  forgedPayload,
);
assert.ok(canonicalOpen);
assert.equal(canonicalOpen.requestId, id);
assert.equal(
  selectedViewingRequest(canonicalOpen.state, "landlord", time(20))?.id,
  id,
);
const privatePayload = {
  ...forgedPayload,
  viewingEvent: { ...forgedPayload.viewingEvent!, note: privateNote },
};
const normalizedFeed = reconcileViewingNotifications(
  { items: [privatePayload] },
  final,
);
assert.equal(
  notice(normalizedFeed, id, "request-submitted", 0).viewingEvent!
    .propertyTitle,
  submission.viewingEvent!.propertyTitle,
);
assert.equal(
  JSON.stringify(normalizedFeed).includes("FORGED_PRIVATE_TITLE"),
  false,
);
assert.equal(JSON.stringify(normalizedFeed).includes(privateNote), false);

// Recorded viewing activity participates in existing cross-module chronology.
const work = submitWorkApplication(
  updateWorkApplicationDraft(
    createInitialWorkState(),
    "tenant",
    "work-volt-electrical",
    {
      introduction: "A genuine local application for the mixed activity check.",
      availability: "Immediately",
    },
  ),
  "tenant",
  "work-volt-electrical",
  time(7),
);
assert.ok(work.applicationId);
const mixed = reconcileViewingNotifications(
  reconcileWorkNotifications(allRead, work.state),
  nextRequest.state,
);
const stamp = (item: KasaNotification) =>
  item.viewingEvent?.occurredAt ?? item.workEvent?.occurredAt;
const mixedEvents = mixed.items.filter((item) => stamp(item));
assert.deepEqual(
  mixedEvents,
  [...mixedEvents].sort(
    (left, right) =>
      stamp(right)!.localeCompare(stamp(left)!) ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  ),
);
assert.ok(mixedEvents.some((item) => item.workEvent));
assert.equal(notice(mixed, id, "proposal-recorded", 2).read, true);
assert.deepEqual(
  mixed.items.filter((item) => !stamp(item)),
  allRead.items.filter((item) => !stamp(item)),
);
assert.equal(reconcileViewingNotifications(mixed, nextRequest.state), mixed);
assert.equal(pendingViewingProposal(record(final, id)), null);
assert.equal(initial.viewings.length, 0);
console.log("Viewing notification checks passed.");
