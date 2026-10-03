import assert from "node:assert/strict";
import {
  createInitialNotificationState,
  markNotificationRead,
} from "../src/components/notificationState";
import { reconcileServiceNotifications } from "../src/components/serviceNotifications";
import {
  actOnServiceRequest,
  canQuoteServiceRequest,
  createInitialServiceRequestState,
  discardServiceQuoteDraft,
  hasServiceQuoteDraft,
  latestServiceQuote,
  saveServiceQuote,
  serviceQuoteDraft,
  updateServiceActionNote,
  updateServiceQuoteDraft,
  updateServiceRequestDraft,
  updateServiceRequestView,
  visibleServiceRequests,
  workspaceServiceProvider,
  type ServiceQuoteDraft,
  type ServiceRequestState,
} from "../src/components/serviceRequestState";
import type { Role } from "../src/types";

const now = new Date(2026, 9, 3, 12);
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const initial = createInitialServiceRequestState(now);
const initialJson = JSON.stringify(initial);
const owned = visibleServiceRequests(initial, "provider");
const id = owned.find((item) => item.customerRole === "tenant")!.id;
const otherId = owned.find((item) => item.customerRole === "landlord")!.id;
const foreignId = initial.records.find(
  (item) => item.providerName !== workspaceServiceProvider,
)!.id;
const record = (state: ServiceRequestState, target = id) => {
  const found = state.records.find((item) => item.id === target);
  assert.ok(found);
  return found;
};
const draft = (state: ServiceRequestState, target = id) =>
  serviceQuoteDraft(state, "provider", target);
const emptyDraft: ServiceQuoteDraft = {
  amount: "",
  scope: "",
  date: "",
  time: "",
  validUntil: "",
};
const quote1: ServiceQuoteDraft = {
  amount: " 125,50 ",
  scope: "  Inspect and repair the outlet, including labour and materials.  ",
  date: "2026-10-06",
  time: "10:30",
  validUntil: "2026-10-05",
};
const privateQuote2: ServiceQuoteDraft = {
  amount: "  1.005  ",
  scope: "PRIVATE unfinished revision\nwith more detail still to add.",
  date: "2026-02-30",
  time: "",
  validUntil: "unfinished",
};

// Opening a form does not retain it, and its defaults are detached.
const defaults = draft(initial);
assert.equal(hasServiceQuoteDraft(initial, "provider", id), false);
assert.equal(discardServiceQuoteDraft(initial, "provider", id), initial);
assert.notEqual(defaults, draft(initial));
defaults.scope = "A read must not become a draft";
assert.equal(draft(initial).scope, "");
assert.equal(JSON.stringify(initial), initialJson);

// Keep unrelated provider/customer work and inbox controls through a quote save.
let prepared = updateServiceQuoteDraft(initial, "provider", otherId, {
  scope: "PRIVATE unfinished quote for another request",
});
prepared = updateServiceRequestDraft(prepared, "tenant", {
  title: "PRIVATE tenant request draft",
});
prepared = updateServiceRequestDraft(prepared, "landlord", {
  title: "PRIVATE owner request draft",
});
prepared = updateServiceActionNote(
  prepared,
  "provider",
  id,
  "PRIVATE action note",
);
prepared = updateServiceActionNote(
  prepared,
  "tenant",
  id,
  "PRIVATE customer note",
);
prepared = updateServiceRequestView(prepared, "provider", {
  query: " retained provider search ",
  filter: "all",
  selectedId: otherId,
});
prepared = updateServiceRequestView(prepared, "tenant", {
  query: " retained tenant search ",
  filter: "history",
  selectedId: id,
});
const editing1 = updateServiceQuoteDraft(prepared, "provider", id, quote1);
assert.equal(hasServiceQuoteDraft(editing1, "provider", id), true);
assert.deepEqual(draft(editing1), quote1);
const detached = draft(editing1);
detached.amount = "999";
detached.scope = "Mutating a returned draft cannot alter stored private text";
assert.deepEqual(draft(editing1), quote1);
assert.equal(editing1.records, prepared.records);
assert.equal(
  updateServiceQuoteDraft(editing1, "provider", id, quote1),
  editing1,
);
const editingJson = JSON.stringify(editing1);
const saved1 = saveServiceQuote(editing1, "provider", id, at(1));
assert.deepEqual(saved1.errors, {});
assert.equal(saved1.issue, undefined);
assert.notEqual(saved1.state, editing1);
assert.equal(hasServiceQuoteDraft(saved1.state, "provider", id), false);
assert.equal(saved1.state.quoteDrafts[otherId], editing1.quoteDrafts[otherId]);
assert.equal(saved1.state.views, editing1.views);
assert.equal(saved1.state.actionNotes, editing1.actionNotes);
assert.equal(saved1.state.drafts, editing1.drafts);
assert.equal(saved1.state.nextId, editing1.nextId);
assert.equal(record(saved1.state).status, "Quoted");
assert.equal(record(saved1.state).quotes.length, 1);
assert.equal(
  record(saved1.state).history.length,
  record(editing1).history.length + 1,
);
assert.equal(latestServiceQuote(record(saved1.state))!.amountCents, 12550);
assert.equal(
  latestServiceQuote(record(saved1.state))!.scope,
  quote1.scope.trim(),
);
assert.equal(draft(saved1.state).amount, "125.50");
assert.equal(draft(saved1.state).scope, quote1.scope.trim());
assert.equal(
  discardServiceQuoteDraft(saved1.state, "provider", id),
  saved1.state,
);
assert.equal(JSON.stringify(editing1), editingJson);
for (const previous of editing1.records) {
  if (previous.id !== id)
    assert.equal(record(saved1.state, previous.id), previous);
}

// A private Q2 never changes the shared Q1, its history, or notification activity.
const published = saved1.state;
const q1 = latestServiceQuote(record(published))!;
const editing2 = updateServiceQuoteDraft(
  published,
  "provider",
  id,
  privateQuote2,
);
const notifications = reconcileServiceNotifications(
  createInitialNotificationState(),
  published,
);
assert.ok(
  notifications.items.some(
    (item) => item.serviceEvent?.kind === "quote-recorded",
  ),
);
assert.equal(editing2.records, published.records);
assert.equal(latestServiceQuote(record(editing2)), q1);
assert.equal(
  reconcileServiceNotifications(notifications, editing2),
  notifications,
);
assert.deepEqual(draft(editing2), privateQuote2);
const invalid = saveServiceQuote(editing2, "provider", id, at(2));
assert.equal(invalid.state, editing2);
assert.equal(invalid.issue, undefined);
assert.deepEqual(invalid.errors, {
  amount: "amount",
  date: "date",
  time: "time",
  validUntil: "validUntil",
});
assert.deepEqual(draft(invalid.state), privateQuote2);
assert.equal(
  reconcileServiceNotifications(notifications, invalid.state),
  notifications,
);

// Terminal transitions retain private work for inspection; only explicit discard removes it.
const accepted = actOnServiceRequest(
  editing2,
  "tenant",
  id,
  { type: "accept", quoteId: q1.id },
  at(3),
);
const inProgress = actOnServiceRequest(
  accepted,
  "provider",
  id,
  { type: "start" },
  at(4),
);
const completed = actOnServiceRequest(
  inProgress,
  "provider",
  id,
  { type: "complete", note: "Work completion recorded locally" },
  at(5),
);
const cancelledQuoted = actOnServiceRequest(
  editing2,
  "tenant",
  id,
  { type: "cancel", note: "The visit is no longer needed" },
  at(3),
);
const cancelledAccepted = actOnServiceRequest(
  accepted,
  "tenant",
  id,
  { type: "cancel", note: "The agreed visit is no longer needed" },
  at(4),
);
// Provider refusal is only valid before a quote is published.
const beforeRefusal = updateServiceQuoteDraft(
  prepared,
  "provider",
  id,
  privateQuote2,
);
const providerDeclined = actOnServiceRequest(
  beforeRefusal,
  "provider",
  id,
  { type: "decline-request", note: "This request is outside my availability" },
  at(2),
);
const closedToQuotes = [
  [accepted, "Accepted"],
  [inProgress, "In progress"],
  [completed, "Completed"],
  [cancelledQuoted, "Cancelled"],
  [cancelledAccepted, "Cancelled"],
  [providerDeclined, "Provider declined"],
] as const;
for (const [state, status] of closedToQuotes) {
  assert.equal(record(state).status, status);
  assert.equal(canQuoteServiceRequest(record(state), "provider"), false);
  assert.equal(hasServiceQuoteDraft(state, "provider", id), true);
  assert.deepEqual(draft(state), privateQuote2);
  const read = draft(state);
  read.scope = "Do not mutate private retained values";
  assert.deepEqual(draft(state), privateQuote2);
  assert.equal(updateServiceQuoteDraft(state, "provider", id, quote1), state);
  const blockedSave = saveServiceQuote(state, "provider", id, at(6));
  assert.equal(blockedSave.state, state);
  assert.equal(blockedSave.issue, "unavailable");
  assert.deepEqual(blockedSave.errors, {});

  let feed = reconcileServiceNotifications(
    createInitialNotificationState(),
    state,
  );
  const activity = feed.items.find(
    (item) => item.serviceEvent?.requestId === id,
  );
  assert.ok(activity);
  feed = markNotificationRead(feed, activity.role, activity.id);
  const before = JSON.stringify(state);
  const discarded = discardServiceQuoteDraft(state, "provider", id);
  assert.notEqual(discarded, state);
  assert.equal(hasServiceQuoteDraft(discarded, "provider", id), false);
  assert.equal(discarded.records, state.records);
  assert.equal(discarded.drafts, state.drafts);
  assert.equal(discarded.actionNotes, state.actionNotes);
  assert.equal(discarded.views, state.views);
  assert.equal(discarded.nextId, state.nextId);
  assert.equal(discarded.quoteDrafts[otherId], state.quoteDrafts[otherId]);
  assert.equal(reconcileServiceNotifications(feed, discarded), feed);
  assert.equal(discardServiceQuoteDraft(discarded, "provider", id), discarded);
  assert.equal(JSON.stringify(state), before);
  if (status === "Provider declined") {
    assert.equal(record(discarded).quotes.length, 0);
  } else {
    assert.equal(latestServiceQuote(record(discarded))!.id, q1.id);
    assert.equal(draft(discarded).scope, q1.scope);
    assert.equal(draft(discarded).amount, "125.50");
  }
}

// Discard is also safe while a revision is still editable.
const droppedRevision = discardServiceQuoteDraft(editing2, "provider", id);
assert.equal(droppedRevision.records, published.records);
assert.deepEqual(draft(droppedRevision), draft(published));
assert.equal(
  reconcileServiceNotifications(notifications, droppedRevision),
  notifications,
);
assert.equal(hasServiceQuoteDraft(droppedRevision, "provider", otherId), true);

// Customer quote-decline remains revisable; it is different from provider refusal.
const customerDeclined = actOnServiceRequest(
  editing2,
  "tenant",
  id,
  {
    type: "decline",
    quoteId: q1.id,
    note: "Please revise the scope of the work",
  },
  at(3),
);
assert.equal(record(customerDeclined).status, "Declined");
assert.equal(
  canQuoteServiceRequest(record(customerDeclined), "provider"),
  true,
);
assert.deepEqual(draft(customerDeclined), privateQuote2);
const revision = updateServiceQuoteDraft(customerDeclined, "provider", id, {
  ...quote1,
  amount: "140",
  scope: "Revised work includes an additional outlet inspection and materials.",
});
const saved2 = saveServiceQuote(revision, "provider", id, at(4));
assert.equal(saved2.issue, undefined);
assert.deepEqual(saved2.errors, {});
assert.equal(record(saved2.state).quotes.length, 2);
assert.equal(
  record(saved2.state).quotes[0],
  record(customerDeclined).quotes[0],
);
assert.equal(latestServiceQuote(record(saved2.state))!.version, 2);
assert.equal(latestServiceQuote(record(saved2.state))!.amountCents, 14000);
assert.equal(hasServiceQuoteDraft(saved2.state, "provider", id), false);
assert.equal(saved2.state.quoteDrafts[otherId], revision.quoteDrafts[otherId]);
assert.equal(saved2.state.views, revision.views);
assert.equal(saved2.state.actionNotes, revision.actionNotes);
assert.equal(saved2.state.drafts, revision.drafts);

// Other roles cannot inspect or discard provider work, including terminal retained work.
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
  "unknown" as Role,
];
for (const role of roles.filter((value) => value !== "provider")) {
  for (const state of [editing2, accepted, completed, providerDeclined]) {
    assert.equal(hasServiceQuoteDraft(state, role, id), false);
    assert.deepEqual(serviceQuoteDraft(state, role, id), emptyDraft);
    assert.equal(discardServiceQuoteDraft(state, role, id), state);
    assert.equal(updateServiceQuoteDraft(state, role, id, quote1), state);
    assert.equal(saveServiceQuote(state, role, id, now).state, state);
  }
}
const invalidCategoryId = "foreign-provider-category";
const guarded: ServiceRequestState = {
  ...editing2,
  records: [
    ...editing2.records,
    { ...record(editing2), id: invalidCategoryId, category: "Cleaning" },
  ],
  quoteDrafts: {
    ...editing2.quoteDrafts,
    [foreignId]: { ...privateQuote2 },
    [invalidCategoryId]: { ...privateQuote2 },
    missing: { ...privateQuote2 },
  },
};
for (const role of roles) {
  for (const target of [foreignId, invalidCategoryId, "missing"]) {
    assert.equal(hasServiceQuoteDraft(guarded, role, target), false);
    assert.deepEqual(serviceQuoteDraft(guarded, role, target), emptyDraft);
    assert.equal(discardServiceQuoteDraft(guarded, role, target), guarded);
    assert.equal(
      updateServiceQuoteDraft(guarded, role, target, quote1),
      guarded,
    );
    assert.equal(saveServiceQuote(guarded, role, target, now).state, guarded);
  }
}
assert.equal(JSON.stringify(initial), initialJson);

console.log("Service quote draft lifecycle checks passed.");
