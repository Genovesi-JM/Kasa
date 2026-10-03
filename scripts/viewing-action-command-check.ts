import assert from "node:assert/strict";
import { properties } from "../src/data";
import type { Role } from "../src/types";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
} from "../src/components/notificationState";
import {
  actOnViewingRequest,
  applyViewingActionCommand,
  createInitialPropertyRequestState,
  createViewingRequest,
  saveViewingProposal,
  selectViewingRequest,
  setViewingFilter,
  updateViewingActionDraft,
  updateViewingDraft,
  viewingActionIssue,
  viewingView,
  type PropertyRequestState,
  type ViewingActionCommand,
  type ViewingImmediateAction,
  type ViewingIssue,
  type ViewingRequest,
} from "../src/components/propertyRequestState";
import { reconcileViewingNotifications } from "../src/components/viewingNotifications";

const createdAt = new Date(2032, 4, 10, 12);
const capturedAt = new Date(2032, 4, 10, 12, 30, 59, 999);
const later = new Date(2032, 4, 10, 12, 31);
const privateRequest = "PRIVATE original access requirements";
const privateOwner = "PRIVATE unfinished owner refusal or reschedule";
const privateTenant = "PRIVATE unfinished tenant cancellation";
const privateProposal = "PRIVATE proposed arrangements";
let passed = 0;

function record(state: PropertyRequestState, id: string) {
  const value = state.viewings.find((item) => item.id === id);
  assert.ok(value);
  return value;
}
function request(state: PropertyRequestState, propertyId = 1) {
  const result = createViewingRequest(
    updateViewingDraft(state, "tenant", propertyId, {
      date: "2032-05-15",
      time: "14:01",
      note: privateRequest,
    }),
    "tenant",
    propertyId,
    createdAt,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.requestId);
  return { state: result.state, id: result.requestId };
}
function proposal(state: PropertyRequestState, id: string, time = "15:01") {
  const result = saveViewingProposal(
    updateViewingActionDraft(state, "landlord", id, {
      date: "2032-05-16",
      time,
      note: privateProposal,
    }),
    "landlord",
    id,
    new Date(2032, 4, 10, 12, 10),
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.proposalId);
  return { state: result.state, id: result.proposalId };
}

// Genuine historical, current and foreign-owner records give the command
// unrelated state to preserve, as well as a different visible row to select.
const historical = request(createInitialPropertyRequestState());
const cancelledHistorical = actOnViewingRequest(
  historical.state,
  "tenant",
  historical.id,
  { type: "cancel" },
  createdAt,
);
assert.equal(record(cancelledHistorical, historical.id).status, "Cancelled");
const current = request(cancelledHistorical);
const foreign = request(current.state, 2);
const id = current.id;
let base = updateViewingDraft(foreign.state, "tenant", 3, {
  date: "unfinished date",
  time: "unfinished time",
  note: "PRIVATE another property's request draft",
});
base = updateViewingActionDraft(base, "landlord", id, {
  date: "unfinished owner date",
  time: "unfinished owner time",
  note: privateOwner,
});
base = updateViewingActionDraft(base, "tenant", id, { note: privateTenant });
base = setViewingFilter(
  selectViewingRequest(base, "landlord", id),
  "landlord",
  "Pending",
);
base = setViewingFilter(
  selectViewingRequest(base, "tenant", foreign.id),
  "tenant",
  "Pending",
);

function command(
  state: PropertyRequestState,
  token: string,
  action: ViewingImmediateAction = { type: "accept-request" },
  role: Role = "landlord",
  requestId = id,
  at = capturedAt.getTime(),
): ViewingActionCommand {
  return {
    token,
    role,
    requestId,
    action,
    at,
    view: { ...viewingView(state, role) },
  };
}
function assertReceipt(
  state: PropertyRequestState,
  cmd: ViewingActionCommand,
  issue: ViewingIssue["code"] | null,
  eventId: string | null,
) {
  assert.deepEqual(state.actionReceipt, {
    token: cmd.token,
    role: cmd.role,
    requestId: cmd.requestId,
    actionType: cmd.action.type,
    proposalId: "proposalId" in cmd.action ? cmd.action.proposalId : null,
    issue,
    eventId,
  });
  assert.ok(
    Object.values(state.actionReceipt!).every(
      (value) => value === null || typeof value === "string",
    ),
    "A receipt contains only non-private scalar outcome metadata",
  );
  for (const privateValue of [
    privateRequest,
    privateOwner,
    privateTenant,
    privateProposal,
    "2032-05-15",
    "14:01",
  ])
    assert.equal(
      JSON.stringify(state.actionReceipt).includes(privateValue),
      false,
    );
}
function unrelatedReferences(
  before: PropertyRequestState,
  after: PropertyRequestState,
  success: boolean,
  reveal = false,
) {
  for (const key of Object.keys(before) as (keyof PropertyRequestState)[])
    if (
      key !== "actionReceipt" &&
      !(success && key === "viewings") &&
      !(reveal && key === "views")
    )
      assert.equal(after[key], before[key], `${key} must remain unchanged`);
}
function rejected(
  state: PropertyRequestState,
  cmd: ViewingActionCommand,
  issue: ViewingIssue["code"] = "unavailable",
) {
  const before = JSON.stringify(state);
  let feed = reconcileViewingNotifications(
    createInitialNotificationState(),
    state,
  );
  feed = markAllNotificationsRead(
    markAllNotificationsRead(feed, "tenant"),
    "landlord",
  );
  const next = applyViewingActionCommand(state, cmd);
  assertReceipt(next, cmd, issue, null);
  unrelatedReferences(state, next, false);
  assert.equal(reconcileViewingNotifications(feed, next), feed);
  assert.equal(JSON.stringify(state), before);
  assert.equal(applyViewingActionCommand(next, cmd), next);
  assert.deepEqual(applyViewingActionCommand(state, cmd), next);
  passed++;
  return next;
}
function accepted(
  state: PropertyRequestState,
  cmd: ViewingActionCommand,
  reveal = true,
) {
  const before = JSON.stringify(state);
  const old = record(state, cmd.requestId);
  const feed = reconcileViewingNotifications(
    createInitialNotificationState(),
    state,
  );
  const next = applyViewingActionCommand(state, cmd);
  const item = record(next, cmd.requestId);
  assert.equal(item.history.length, old.history.length + 1);
  const event = item.history.at(-1)!;
  const action =
    cmd.action.type === "accept-request"
      ? "accepted"
      : cmd.action.type === "accept-proposal"
        ? "proposal-accepted"
        : "proposal-declined";
  const oldProposal =
    "proposalId" in cmd.action
      ? old.proposals.find((entry) => entry.id === cmd.action.proposalId)
      : undefined;
  const terms = oldProposal?.terms ?? old.requestedTerms;
  assertReceipt(next, cmd, null, event.id);
  assert.ok(event.id);
  assert.equal(
    old.history.some((entry) => entry.id === event.id),
    false,
  );
  assert.equal(event.source, "local");
  assert.equal(event.actor, cmd.role);
  assert.equal(event.action, action);
  assert.equal(event.at, new Date(cmd.at).toISOString());
  assert.equal(item.updatedAt, event.at);
  assert.equal(
    event.note,
    undefined,
    "Private unsent notes never become event notes",
  );
  assert.equal(event.proposalId, oldProposal?.id);
  assert.deepEqual(event.terms, terms);
  for (const [index, entry] of old.history.entries())
    assert.equal(item.history[index], entry);
  assert.equal(item.requestedTerms, old.requestedTerms);
  assert.equal(item.note, old.note);
  if (cmd.action.type === "decline-proposal") {
    assert.equal(item.agreedTerms, old.agreedTerms);
    assert.equal(item.status, old.agreedTerms ? "Agreed" : "Pending");
  } else {
    assert.equal(item.status, "Agreed");
    assert.deepEqual(item.agreedTerms, terms);
    assert.equal(item.date, terms.date);
    assert.equal(item.time, terms.time);
  }
  if (oldProposal) {
    const decided = item.proposals.find(
      (entry) => entry.id === oldProposal.id,
    )!;
    assert.equal(
      decided.status,
      cmd.action.type === "accept-proposal" ? "Accepted" : "Declined",
    );
    assert.equal(decided.decidedAt, event.at);
  }
  for (const entry of state.viewings)
    if (entry.id !== cmd.requestId) assert.equal(record(next, entry.id), entry);
  unrelatedReferences(state, next, true, reveal);
  if (reveal) {
    assert.deepEqual(viewingView(next, cmd.role), {
      filter: "All",
      selectedId: cmd.requestId,
    });
    for (const role of [
      "tenant",
      "landlord",
      "provider",
      "spaceOperator",
      "admin",
    ] as const)
      if (role !== cmd.role)
        assert.equal(next.views?.[role], state.views?.[role]);
  }
  const nextFeed = reconcileViewingNotifications(feed, next);
  const added = nextFeed.items.filter(
    (entry) => !feed.items.some((oldEntry) => oldEntry.id === entry.id),
  );
  assert.equal(
    added.length,
    1,
    "Exactly the newly committed event creates an alert",
  );
  const recipient = cmd.role === "landlord" ? "tenant" : "landlord";
  assert.equal(added[0].role, recipient);
  assert.equal(
    added[0].id,
    `viewing:${JSON.stringify([recipient, cmd.requestId, event.id])}`,
  );
  assert.deepEqual(added[0].viewingEvent, {
    kind: cmd.action.type === "accept-request" ? "request-accepted" : action,
    requestId: cmd.requestId,
    propertyTitle: properties.find(
      (property) => property.id === old.propertyId,
    )!.title,
    occurredAt: event.at,
  });
  for (const privateValue of [
    privateRequest,
    privateOwner,
    privateTenant,
    privateProposal,
  ])
    assert.equal(JSON.stringify(added).includes(privateValue), false);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(applyViewingActionCommand(state, cmd), next);
  assert.equal(applyViewingActionCommand(next, cmd), next);
  passed++;
  return next;
}
function changedRecord(
  state: PropertyRequestState,
  patch: Partial<ViewingRequest>,
): PropertyRequestState {
  return {
    ...state,
    viewings: state.viewings.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
}

const acceptRequest = command(base, "accept-request");
const agreed = accepted(base, acceptRequest);
const p1 = proposal(agreed, id);
const proposalState = setViewingFilter(
  selectViewingRequest(p1.state, "tenant", id),
  "tenant",
  "Proposed",
);
const acceptP1 = command(
  proposalState,
  "accept-p1",
  { type: "accept-proposal", proposalId: p1.id },
  "tenant",
);
const declineP1 = command(
  proposalState,
  "decline-p1",
  { type: "decline-proposal", proposalId: p1.id },
  "tenant",
);
accepted(proposalState, acceptP1);
accepted(proposalState, declineP1);

// A queued updater rechecks the latest record, not the rendered preflight.
const cancelled = actOnViewingRequest(
  base,
  "tenant",
  id,
  { type: "cancel" },
  later,
);
rejected(cancelled, acceptRequest);
const p2 = proposal(proposalState, id, "16:01");
rejected(p2.state, acceptP1, "staleProposal");
rejected(p2.state, declineP1, "staleProposal");
const previouslyAccepted = actOnViewingRequest(
  proposalState,
  "tenant",
  id,
  acceptP1.action,
  later,
);
rejected(previouslyAccepted, acceptP1, "staleProposal");
rejected(previouslyAccepted, declineP1, "staleProposal");
rejected(agreed, command(agreed, "already-agreed"));
rejected(
  actOnViewingRequest(proposalState, "landlord", id, { type: "cancel" }, later),
  acceptP1,
);

// New private input queued before an otherwise valid action survives exactly.
const newerDrafts = updateViewingActionDraft(
  updateViewingDraft(base, "tenant", 3, {
    note: "PRIVATE newer creation draft",
  }),
  "landlord",
  id,
  { note: "PRIVATE newer action input", time: "raw newer time" },
);
accepted(newerDrafts, command(base, "preserve-newer-drafts"));
const newerTenantDraft = updateViewingActionDraft(proposalState, "tenant", id, {
  note: "PRIVATE newer tenant input",
});
accepted(
  newerTenantDraft,
  command(proposalState, "preserve-tenant-draft", acceptP1.action, "tenant"),
);

// Only the captured actor view may be revealed; newer navigation wins.
const newerRow = selectViewingRequest(base, "landlord", historical.id);
accepted(newerRow, command(base, "newer-row-wins"), false);
const newerFilter = setViewingFilter(base, "landlord", "History");
accepted(newerFilter, command(base, "newer-filter-wins"), false);
const otherRoleView = setViewingFilter(base, "tenant", "History");
accepted(otherRoleView, command(base, "other-role-navigation"));
const equalNewObject = setViewingFilter(base, "landlord", "Pending");
assert.notEqual(equalNewObject.views, base.views);
accepted(equalNewObject, command(base, "same-values-reveal"));

// The single captured instant avoids a validation/commit boundary split.
const boundary = new Date(2032, 4, 15, 14, 1).getTime();
const beforeBoundary = command(
  base,
  "before-start",
  undefined,
  "landlord",
  id,
  boundary - 1,
);
assert.equal(
  viewingActionIssue(
    base,
    "landlord",
    id,
    beforeBoundary.action,
    new Date(boundary - 1),
  ),
  null,
);
assert.equal(
  viewingActionIssue(
    base,
    "landlord",
    id,
    beforeBoundary.action,
    new Date(boundary),
  )?.code,
  "pastTime",
);
accepted(base, beforeBoundary);
rejected(
  base,
  command(base, "at-start", undefined, "landlord", id, boundary),
  "pastTime",
);
rejected(
  base,
  command(base, "after-start", undefined, "landlord", id, boundary + 1),
  "pastTime",
);
const proposalBoundary = new Date(2032, 4, 16, 15, 1).getTime();
accepted(proposalState, {
  ...acceptP1,
  token: "proposal-before-start",
  at: proposalBoundary - 1,
});
rejected(
  proposalState,
  { ...acceptP1, token: "proposal-at-start", at: proposalBoundary },
  "pastTime",
);
rejected(
  proposalState,
  {
    ...acceptP1,
    token: "proposal-next-day",
    at: new Date(2032, 4, 17).getTime(),
  },
  "invalidDate",
);
accepted(proposalState, {
  ...declineP1,
  token: "decline-expired-proposal",
  at: new Date(2032, 4, 17).getTime(),
});
const noAgreementProposal = proposal(base, id);
accepted(
  noAgreementProposal.state,
  command(
    noAgreementProposal.state,
    "decline-without-agreement",
    { type: "decline-proposal", proposalId: noAgreementProposal.id },
    "tenant",
    id,
    new Date(2032, 4, 17).getTime(),
  ),
);

// The latest token is idempotent even after navigation and with changed inputs.
const navigated = selectViewingRequest(
  setViewingFilter(agreed, "landlord", "History"),
  "landlord",
  historical.id,
);
assert.equal(applyViewingActionCommand(navigated, acceptRequest), navigated);
assert.equal(
  applyViewingActionCommand(navigated, {
    ...acceptRequest,
    requestId: foreign.id,
    role: "tenant",
    at: Number.NaN,
    action: acceptP1.action,
  }),
  navigated,
);
passed++;
const newerOutcome = rejected(
  agreed,
  command(agreed, "new-token-no-new-success"),
);
assert.equal(newerOutcome.actionReceipt!.eventId, null);
assert.notEqual(newerOutcome.actionReceipt!.token, agreed.actionReceipt!.token);
rejected(newerOutcome, acceptRequest);
const p1AfterFailure = proposal(newerOutcome, id);
accepted(
  p1AfterFailure.state,
  command(
    p1AfterFailure.state,
    "success-after-failure",
    { type: "accept-proposal", proposalId: p1AfterFailure.id },
    "tenant",
  ),
);

for (const role of ["tenant", "provider", "spaceOperator", "admin"] as const)
  rejected(base, command(base, `wrong-request-role-${role}`, undefined, role));
for (const role of ["landlord", "provider", "spaceOperator", "admin"] as const)
  for (const action of [acceptP1.action, declineP1.action])
    rejected(
      proposalState,
      command(
        proposalState,
        `wrong-proposal-role-${role}-${action.type}`,
        action,
        role,
      ),
    );
rejected(
  base,
  command(base, "foreign-owner-property", undefined, "landlord", foreign.id),
);
rejected(
  base,
  command(base, "missing-request", undefined, "landlord", "missing-viewing"),
);
rejected(
  changedRecord(base, { propertyId: 999 }),
  command(base, "unknown-property"),
);
rejected(
  changedRecord(base, { role: "landlord" }),
  command(base, "wrong-record-role"),
);
rejected(
  changedRecord(proposalState, { tenantId: "another-tenant" }),
  acceptP1,
);
rejected(
  proposalState,
  {
    ...acceptP1,
    token: "unknown-proposal",
    action: { type: "accept-proposal", proposalId: "missing-proposal" },
  },
  "staleProposal",
);

for (const at of [
  Number.NaN,
  Infinity,
  -Infinity,
  capturedAt.getTime() + 0.5,
  -0.5,
  Number.MAX_SAFE_INTEGER + 1,
  Number.MIN_SAFE_INTEGER - 1,
  8_640_000_000_000_001,
  -8_640_000_000_000_001,
  "2032-05-10" as unknown as number,
  null as unknown as number,
])
  rejected(
    base,
    command(base, `invalid-time-${String(at)}`, undefined, "landlord", id, at),
  );

// Ambiguous targets and colliding proof identifiers cannot produce success.
rejected(
  { ...base, viewings: [...base.viewings, record(base, id)] },
  command(base, "duplicate-identical-request"),
);
rejected(
  {
    ...base,
    viewings: [...base.viewings, { ...record(base, id), propertyId: 2 }],
  },
  command(base, "duplicate-conflicting-request"),
);
const duplicateProposal = changedRecord(proposalState, {
  proposals: [
    ...record(proposalState, id).proposals,
    record(proposalState, id).proposals[0],
  ],
});
rejected(duplicateProposal, acceptP1);
rejected(duplicateProposal, declineP1);
const target = record(base, id);
const collidingHistory = changedRecord(base, {
  history: target.history.map((event) => ({
    ...event,
    id: `${id}-event-${target.history.length + 1}`,
  })),
});
rejected(collidingHistory, command(base, "colliding-event-id"));
rejected(
  changedRecord(base, {
    requestedTerms: { date: "2032-02-30", time: "14:01" },
  }),
  command(base, "invalid-date"),
  "invalidDate",
);
rejected(
  changedRecord(base, {
    requestedTerms: { date: "2032-05-15", time: "25:00" },
  }),
  command(base, "invalid-time"),
  "invalidTime",
);

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
accepted(
  freeze(structuredClone(base)),
  freeze(command(base, "frozen-success")),
);
accepted(
  freeze(structuredClone(newerRow)),
  freeze(command(base, "frozen-newer-navigation")),
  false,
);
rejected(
  freeze(structuredClone(cancelled)),
  freeze(command(base, "frozen-rejection")),
);

console.log(`${passed} Viewing action command checks passed.`);
