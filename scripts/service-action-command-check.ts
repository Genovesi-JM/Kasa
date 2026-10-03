import assert from "node:assert/strict";
import {
  createInitialNotificationState,
  markNotificationRead,
} from "../src/components/notificationState";
import { reconcileServiceNotifications } from "../src/components/serviceNotifications";
import {
  actOnServiceRequest,
  applyServiceActionCommand,
  createInitialServiceRequestState,
  latestServiceQuote,
  saveServiceQuote,
  serviceRequestActionIssue,
  updateServiceActionNoteDraft,
  updateServiceQuoteDraft,
  updateServiceRequestDraft,
  updateServiceRequestView,
  workspaceServiceProvider,
  type ServiceActionCommand,
  type ServiceIssue,
  type ServiceRequestAction,
  type ServiceRequestState,
} from "../src/components/serviceRequestState";
import type { Role } from "../src/types";

const createdAt = new Date(2032, 4, 10, 9);
const initial = createInitialServiceRequestState(createdAt);
const initialJson = JSON.stringify(initial);
const id = initial.records.find(
  (item) =>
    item.customerRole === "tenant" &&
    item.providerName === workspaceServiceProvider,
)!.id;
const otherId = initial.records.find(
  (item) => item.customerRole === "landlord",
)!.id;
const privateNote = "PRIVATE_COMMAND_NOTE: the complete action explanation";
const privateScope =
  "PRIVATE_QUOTE_SCOPE: inspect the outlet and replace the agreed parts.";
function record(state: ServiceRequestState, target = id) {
  const found = state.records.find((item) => item.id === target);
  assert.ok(found);
  return found;
}
function fixture(date: string, validUntil: string) {
  let state = updateServiceRequestDraft(initial, "tenant", {
    title: "PRIVATE unfinished customer request",
  });
  state = updateServiceRequestDraft(state, "landlord", {
    title: "PRIVATE unfinished owner request",
  });
  state = updateServiceActionNoteDraft(
    state,
    "tenant",
    id,
    { type: "cancel" },
    privateNote,
  );
  state = updateServiceActionNoteDraft(
    state,
    "provider",
    otherId,
    { type: "decline-request" },
    "PRIVATE unrelated provider note",
  );
  state = updateServiceQuoteDraft(state, "provider", otherId, {
    scope: "PRIVATE unrelated quote draft",
  });
  state = updateServiceRequestView(state, "tenant", {
    query: " retained customer query ",
    filter: "all",
    selectedId: id,
  });
  state = updateServiceRequestView(state, "provider", {
    query: " retained provider query ",
    filter: "history",
    selectedId: otherId,
  });
  const result = saveServiceQuote(
    updateServiceQuoteDraft(state, "provider", id, {
      amount: "125.50",
      scope: privateScope,
      date,
      time: "14:00",
      validUntil,
    }),
    "provider",
    id,
    new Date(2032, 4, 10, 9, 1),
  );
  assert.deepEqual(result.errors, {});
  assert.equal(result.issue, undefined);
  return updateServiceQuoteDraft(result.state, "provider", id, {
    scope: "PRIVATE unsent revision that must survive the customer decision",
    amount: "unfinished",
  });
}
function command(
  token: string,
  role: Role,
  action: ServiceRequestAction,
  at: Date | number,
  requestId = id,
): ServiceActionCommand {
  return {
    token,
    role,
    requestId,
    action,
    at: typeof at === "number" ? at : at.getTime(),
  };
}
function assertReceipt(
  state: ServiceRequestState,
  cmd: ServiceActionCommand,
  issue: ServiceIssue | null,
  eventId: string | null,
) {
  assert.deepEqual(state.actionReceipt, {
    token: cmd.token,
    role: cmd.role,
    requestId: cmd.requestId,
    actionType: cmd.action.type,
    issue,
    eventId,
  });
  const text = JSON.stringify(state.actionReceipt);
  assert.equal(text.includes(privateNote), false);
  assert.equal(text.includes(privateScope), false);
  assert.equal(text.includes("125.50"), false);
  assert.equal(text.includes("12550"), false);
}
function assertRejected(
  state: ServiceRequestState,
  cmd: ServiceActionCommand,
  issue: ServiceIssue,
) {
  const before = JSON.stringify(state);
  let feed = reconcileServiceNotifications(
    createInitialNotificationState(),
    state,
  );
  const activity = feed.items.find((item) => item.serviceEvent);
  if (activity) feed = markNotificationRead(feed, activity.role, activity.id);
  const result = applyServiceActionCommand(state, cmd);
  assertReceipt(result, cmd, issue, null);
  for (const key of [
    "records",
    "drafts",
    "quoteDrafts",
    "actionNoteDrafts",
    "views",
  ] as const)
    assert.equal(
      result[key],
      state[key],
      `Rejected ${issue} leaves ${key} untouched`,
    );
  assert.equal(result.nextId, state.nextId);
  assert.equal(reconcileServiceNotifications(feed, result), feed);
  assert.equal(JSON.stringify(state), before);
  assert.equal(applyServiceActionCommand(result, cmd), result);
  return result;
}
function assertSuccess(
  state: ServiceRequestState,
  cmd: ServiceActionCommand,
  status: string,
) {
  const before = JSON.stringify(state);
  const commandBefore = JSON.stringify(cmd);
  const result = applyServiceActionCommand(state, cmd);
  const original = record(state, cmd.requestId);
  const current = record(result, cmd.requestId);
  const event = current.history.at(-1)!;
  assert.equal(current.status, status);
  assert.equal(current.history.length, original.history.length + 1);
  assert.equal(event.at, new Date(cmd.at).toISOString());
  assert.equal(current.updatedAt, event.at);
  assertReceipt(result, cmd, null, event.id);
  for (const [index, previous] of original.history.entries())
    assert.equal(current.history[index], previous);
  for (const previous of state.records)
    if (previous.id !== cmd.requestId)
      assert.equal(record(result, previous.id), previous);
  assert.equal(result.drafts, state.drafts);
  assert.equal(result.quoteDrafts, state.quoteDrafts);
  assert.equal(result.nextId, state.nextId);
  for (const role of [
    "tenant",
    "landlord",
    "provider",
    "spaceOperator",
    "admin",
  ] as const)
    if (role !== cmd.role)
      assert.equal(
        result.actionNoteDrafts?.[role],
        state.actionNoteDrafts?.[role],
      );
  assert.equal(JSON.stringify(state), before);
  assert.equal(JSON.stringify(cmd), commandBefore);
  assert.deepEqual(
    applyServiceActionCommand(state, cmd),
    result,
    "Replaying a pure updater against the same input is deterministic",
  );
  assert.equal(
    applyServiceActionCommand(result, cmd),
    result,
    "Reapplying the latest command cannot duplicate its action",
  );
  return result;
}

// A click in the appointment's last eligible minute uses that same instant at commit.
const visitState = fixture("2032-05-10", "2032-05-10");
const q1 = latestServiceQuote(record(visitState))!;
const acceptQ1 = { type: "accept", quoteId: q1.id } as const;
const lastVisitInstant = new Date(2032, 4, 10, 14, 0, 59, 999);
const visitDeadline = new Date(2032, 4, 10, 14, 1);
assert.equal(
  serviceRequestActionIssue(
    visitState,
    "tenant",
    id,
    acceptQ1,
    lastVisitInstant,
  ),
  null,
);
assert.equal(
  serviceRequestActionIssue(visitState, "tenant", id, acceptQ1, visitDeadline),
  "visitPast",
);
assert.equal(
  actOnServiceRequest(visitState, "tenant", id, acceptQ1, visitDeadline),
  visitState,
);
const visitCommand = command(
  "accept-at-visit-boundary",
  "tenant",
  acceptQ1,
  lastVisitInstant,
);
const accepted = assertSuccess(visitState, visitCommand, "Accepted");
assert.equal(
  latestServiceQuote(record(accepted))!.decidedAt,
  lastVisitInstant.toISOString(),
);
assert.equal(accepted.views, visitState.views);
assert.equal(
  accepted.actionNoteDrafts?.tenant?.[otherId],
  visitState.actionNoteDrafts?.tenant?.[otherId],
);
for (const time of [visitDeadline, new Date(visitDeadline.getTime() + 1)])
  assertRejected(
    visitState,
    command(`visit-expired-${time.getTime()}`, "tenant", acceptQ1, time),
    "visitPast",
  );

// Expiry is inclusive through its local date and rejects the next local midnight.
const expiryState = fixture("2032-05-12", "2032-05-10");
const expiryAction = {
  type: "accept",
  quoteId: latestServiceQuote(record(expiryState))!.id,
} as const;
const lastExpiryInstant = new Date(2032, 4, 10, 23, 59, 59, 999);
const expiryDeadline = new Date(2032, 4, 11);
assert.equal(
  serviceRequestActionIssue(
    expiryState,
    "tenant",
    id,
    expiryAction,
    lastExpiryInstant,
  ),
  null,
);
assert.equal(
  serviceRequestActionIssue(
    expiryState,
    "tenant",
    id,
    expiryAction,
    expiryDeadline,
  ),
  "expired",
);
assert.equal(
  actOnServiceRequest(expiryState, "tenant", id, expiryAction, expiryDeadline),
  expiryState,
);
const expiryAccepted = assertSuccess(
  expiryState,
  command("accept-before-midnight", "tenant", expiryAction, lastExpiryInstant),
  "Accepted",
);
assert.equal(
  latestServiceQuote(record(expiryAccepted))!.decidedAt,
  lastExpiryInstant.toISOString(),
);
for (const time of [expiryDeadline, new Date(expiryDeadline.getTime() + 1)])
  assertRejected(
    expiryState,
    command(`expired-${time.getTime()}`, "tenant", expiryAction, time),
    "expired",
  );

// Capturing time does not authorize an obsolete quote or override a queued cancellation.
const revised = saveServiceQuote(
  updateServiceQuoteDraft(visitState, "provider", id, {
    amount: "140",
    scope: "A different published quote with a complete scope and exact terms.",
    date: "2032-05-11",
    time: "15:00",
    validUntil: "2032-05-10",
  }),
  "provider",
  id,
  new Date(2032, 4, 10, 13, 55),
);
assert.equal(revised.issue, undefined);
assert.deepEqual(revised.errors, {});
assert.notEqual(latestServiceQuote(record(revised.state))!.id, q1.id);
assertRejected(revised.state, visitCommand, "staleQuote");
const cancelled = actOnServiceRequest(
  visitState,
  "tenant",
  id,
  { type: "cancel", note: "A cancellation already committed" },
  new Date(2032, 4, 10, 13, 56),
);
assert.equal(record(cancelled).status, "Cancelled");
assertRejected(cancelled, visitCommand, "status");

// Bad times, missing records, and the wrong workspace never commit any action.
for (const time of [
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  8_640_000_000_000_001,
  -8_640_000_000_000_001,
])
  assertRejected(
    visitState,
    command(`invalid-time-${String(time)}`, "tenant", acceptQ1, time),
    "unavailable",
  );
for (const role of [
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
  "unknown" as Role,
] as const)
  assertRejected(
    visitState,
    command(`wrong-role-${role}`, role, acceptQ1, lastVisitInstant),
    "unavailable",
  );
assertRejected(
  visitState,
  command("missing-request", "tenant", acceptQ1, lastVisitInstant, "missing"),
  "unavailable",
);
assertRejected(
  visitState,
  command(
    "wrong-quote",
    "tenant",
    { type: "accept", quoteId: "missing" },
    lastVisitInstant,
  ),
  "staleQuote",
);

// The latest receipt survives unrelated edits and consumes no extra action on replay.
const unrelated = updateServiceActionNoteDraft(
  accepted,
  "provider",
  otherId,
  { type: "decline-request" },
  "Later unrelated work",
);
assert.notEqual(unrelated, accepted);
assert.equal(unrelated.actionReceipt, accepted.actionReceipt);
assert.equal(applyServiceActionCommand(unrelated, visitCommand), unrelated);
assert.equal(
  applyServiceActionCommand(unrelated, {
    ...visitCommand,
    at: visitDeadline.getTime(),
    action: {
      type: "cancel",
      note: "A replay token cannot execute another action",
    },
  }),
  unrelated,
);
const failure = assertRejected(
  visitState,
  command("failed-retained-command", "tenant", acceptQ1, visitDeadline),
  "visitPast",
);
const changedAfterFailure = updateServiceRequestView(failure, "provider", {
  query: "changed after a failed command",
});
assert.equal(
  applyServiceActionCommand(
    changedAfterFailure,
    command("failed-retained-command", "tenant", acceptQ1, visitDeadline),
  ),
  changedAfterFailure,
);

// Receipt metadata contains no action note; history and notifications reflect only real successes.
const declined = assertSuccess(
  expiryState,
  command(
    "decline-quote",
    "tenant",
    { type: "decline", quoteId: expiryAction.quoteId, note: privateNote },
    new Date(2032, 4, 10, 13),
  ),
  "Declined",
);
assert.equal(record(declined).history.at(-1)!.note, privateNote);
assert.equal(latestServiceQuote(record(declined))!.decisionNote, privateNote);
const refused = assertSuccess(
  initial,
  command(
    "provider-refusal",
    "provider",
    { type: "decline-request", note: privateNote },
    new Date(2032, 4, 10, 10),
  ),
  "Provider declined",
);
assert.equal(record(refused).history.at(-1)!.note, privateNote);
const cancellation = assertSuccess(
  expiryState,
  command(
    "customer-cancellation",
    "tenant",
    { type: "cancel", note: privateNote },
    new Date(2032, 4, 10, 13),
  ),
  "Cancelled",
);
assert.equal(record(cancellation).history.at(-1)!.note, privateNote);
const started = assertSuccess(
  accepted,
  command(
    "provider-start",
    "provider",
    { type: "start" },
    new Date(2032, 4, 10, 14, 2),
  ),
  "In progress",
);
const completed = assertSuccess(
  started,
  command(
    "provider-complete",
    "provider",
    { type: "complete", note: privateNote },
    new Date(2032, 4, 10, 15),
  ),
  "Completed",
);
assert.equal(record(completed).history.at(-1)!.note, privateNote);
assertRejected(
  completed,
  command(
    "repeat-completion-new-token",
    "provider",
    { type: "complete", note: privateNote },
    new Date(2032, 4, 10, 15, 1),
  ),
  "status",
);
const eventKinds = [
  [accepted, "quote-accepted"],
  [declined, "quote-declined"],
  [refused, "request-declined"],
  [cancellation, "request-cancelled"],
  [started, "service-started"],
  [completed, "service-completed"],
] as const;
for (const [state, kind] of eventKinds) {
  const feed = reconcileServiceNotifications(
    createInitialNotificationState(),
    state,
  );
  const matches = feed.items.filter(
    (item) =>
      item.serviceEvent?.requestId === id && item.serviceEvent.kind === kind,
  );
  assert.equal(matches.length, 1);
  assert.equal(
    matches[0].serviceEvent!.occurredAt,
    record(state).history.at(-1)!.at,
  );
  assert.equal(state.actionReceipt!.eventId, record(state).history.at(-1)!.id);
  assert.equal(JSON.stringify(matches).includes(privateNote), false);
  assert.equal(JSON.stringify(matches).includes(privateScope), false);
}
assert.equal(JSON.stringify(initial), initialJson);

console.log("Service action command checks passed.");
