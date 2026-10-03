import assert from "node:assert/strict";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  type KasaNotification,
  type NotificationState,
} from "../src/components/notificationState";
import {
  openServiceNotification,
  reconcileServiceNotifications,
} from "../src/components/serviceNotifications";
import {
  actOnServiceRequest,
  createInitialServiceRequestState,
  latestServiceQuote,
  saveServiceQuote,
  saveServiceRequest,
  serviceRequestView,
  updateServiceActionNote,
  updateServiceQuoteDraft,
  updateServiceRequestDraft,
  updateServiceRequestView,
  workspaceServiceProvider,
  type ServiceRequestRecord,
  type ServiceRequestState,
} from "../src/components/serviceRequestState";
import { reconcileWorkNotifications } from "../src/components/workNotifications";
import {
  createInitialWorkState,
  markWorkApplicationReviewed,
  submitWorkApplication,
  updateWorkApplicationDraft,
} from "../src/components/workState";
import type { Role } from "../src/types";

const time = (minute: number) =>
  new Date(`2032-05-10T12:${String(minute).padStart(2, "0")}:00.000Z`);
const initial = createInitialServiceRequestState(time(0));
const seeds = createInitialNotificationState();
const sampleTenant = initial.records.find(
  (item) =>
    item.customerRole === "tenant" &&
    item.providerName === workspaceServiceProvider,
)!;
const sampleOwner = initial.records.find(
  (item) => item.customerRole === "landlord",
)!;
const privateDescription =
  "PRIVATE_DESCRIPTION: the access details and full repair requirements stay inside this request.";
const privateScope =
  "PRIVATE_SCOPE: inspect and replace the outlet, including the specified materials and visit arrangements.";
const privateReason =
  "PRIVATE_REASON: detailed customer or provider explanation";
const activity = (state: NotificationState) =>
  state.items.filter((item) => item.serviceEvent);
function record(state: ServiceRequestState, id: string) {
  const value = state.records.find((item) => item.id === id);
  assert.ok(value);
  return value;
}
type ServiceKind = NonNullable<KasaNotification["serviceEvent"]>["kind"];
function eventOf(
  state: NotificationState,
  id: string,
  kind: ServiceKind,
  at?: Date,
) {
  const item = activity(state).find(
    (notification) =>
      notification.serviceEvent!.requestId === id &&
      notification.serviceEvent!.kind === kind &&
      (!at || notification.serviceEvent!.occurredAt === at.toISOString()),
  );
  assert.ok(item, `Expected ${kind} for ${id}`);
  return item;
}
function submit(
  state: ServiceRequestState,
  role: "tenant" | "landlord",
  minute: number,
  provider = workspaceServiceProvider,
) {
  const retained = updateServiceRequestDraft(
    state,
    role,
    {
      propertyId: "1",
      category:
        provider === workspaceServiceProvider ? "Electrical" : "Cleaning",
      providerName: provider,
      title: `${role} local repair request`,
      description: privateDescription,
      preferredDate: "2032-05-15",
      preferredTime: "10:30",
    },
    provider,
  );
  const result = saveServiceRequest(retained, role, provider, time(minute));
  assert.deepEqual(result.errors, {});
  assert.ok(result.requestId);
  return { state: result.state, id: result.requestId };
}
function quote(state: ServiceRequestState, id: string, minute: number) {
  const result = saveServiceQuote(
    updateServiceQuoteDraft(state, "provider", id, {
      amount: `${100 + minute}.50`,
      scope: privateScope,
      date: "2032-05-16",
      time: "11:00",
      validUntil: "2032-05-15",
    }),
    "provider",
    id,
    time(minute),
  );
  assert.deepEqual(result.errors, {});
  assert.equal(result.issue, undefined);
  return {
    state: result.state,
    id: latestServiceQuote(record(result.state, id))!.id,
  };
}

// Initial sample requests and retained private work do not fabricate new local activity.
assert.equal(reconcileServiceNotifications(seeds, initial), seeds);
const draftsOnly = updateServiceActionNote(
  updateServiceQuoteDraft(initial, "provider", sampleTenant.id, {
    scope: privateScope,
  }),
  "provider",
  sampleTenant.id,
  privateReason,
);
assert.equal(reconcileServiceNotifications(seeds, draftsOnly), seeds);
const customerDraft = updateServiceRequestDraft(
  initial,
  "tenant",
  { title: "Unsubmitted", description: privateDescription },
  workspaceServiceProvider,
);
assert.equal(reconcileServiceNotifications(seeds, customerDraft), seeds);

// Genuine local submissions target their provider; another business produces no cross-workspace event.
const tenant = submit(initial, "tenant", 0);
const landlord = submit(tenant.state, "landlord", 1);
const foreign = submit(landlord.state, "tenant", 2, "Casa Clara");
const submissions = reconcileServiceNotifications(seeds, foreign.state);
assert.equal(activity(submissions).length, 2);
const tenantSubmission = eventOf(submissions, tenant.id, "request-submitted");
const ownerSubmission = eventOf(submissions, landlord.id, "request-submitted");
assert.equal(tenantSubmission.role, "provider");
assert.equal(tenantSubmission.destination, "provider");
assert.equal(tenantSubmission.serviceEvent!.occurredAt, time(0).toISOString());
assert.equal(ownerSubmission.serviceEvent!.occurredAt, time(1).toISOString());
assert.equal(tenantSubmission.read, false);
assert.ok(tenantSubmission.id.startsWith("service:"));
assert.equal(
  reconcileServiceNotifications(submissions, foreign.state),
  submissions,
);
assert.equal(
  eventOf(
    reconcileServiceNotifications(seeds, foreign.state),
    tenant.id,
    "request-submitted",
  ).id,
  tenantSubmission.id,
);

// Later real actions on labelled samples are eligible; only their seed submission is suppressed.
const sampleQuoted = quote(foreign.state, sampleTenant.id, 3);
const withSampleAction = reconcileServiceNotifications(
  submissions,
  sampleQuoted.state,
);
assert.equal(
  activity(withSampleAction).filter(
    (item) => item.serviceEvent!.requestId === sampleTenant.id,
  ).length,
  1,
);
const sampleQuoteNotice = eventOf(
  withSampleAction,
  sampleTenant.id,
  "quote-recorded",
);
assert.equal(sampleQuoteNotice.role, "tenant");
assert.equal(sampleQuoteNotice.destination, "services");
assert.equal(sampleQuoteNotice.serviceMode, "tasks");

const quoteOne = quote(sampleQuoted.state, tenant.id, 4);
const firstAlerts = reconcileServiceNotifications(
  withSampleAction,
  quoteOne.state,
);
const firstQuoteNotice = eventOf(
  firstAlerts,
  tenant.id,
  "quote-recorded",
  time(4),
);
const firstRead = markNotificationRead(
  firstAlerts,
  "tenant",
  firstQuoteNotice.id,
);
assert.equal(
  reconcileServiceNotifications(firstRead, quoteOne.state),
  firstRead,
);
assert.equal(
  markNotificationRead(firstRead, "provider", firstQuoteNotice.id),
  firstRead,
);
const quoteTwo = quote(quoteOne.state, tenant.id, 5);
const revisedAlerts = reconcileServiceNotifications(firstRead, quoteTwo.state);
assert.equal(
  eventOf(revisedAlerts, tenant.id, "quote-recorded", time(4)).read,
  true,
);
assert.equal(
  eventOf(revisedAlerts, tenant.id, "quote-recorded", time(5)).read,
  false,
);
assert.equal(
  record(quoteTwo.state, tenant.id).quotes[0].decision,
  "Superseded",
);
assert.equal(
  activity(revisedAlerts).filter(
    (item) =>
      item.serviceEvent!.requestId === tenant.id &&
      item.serviceEvent!.kind === "quote-recorded",
  ).length,
  2,
);
const customerDeclined = actOnServiceRequest(
  quoteTwo.state,
  "tenant",
  tenant.id,
  { type: "decline", quoteId: quoteTwo.id, note: privateReason },
  time(6),
);
const quoteThree = quote(customerDeclined, tenant.id, 7);
const accepted = actOnServiceRequest(
  quoteThree.state,
  "tenant",
  tenant.id,
  { type: "accept", quoteId: quoteThree.id },
  time(8),
);
const cancelled = actOnServiceRequest(
  accepted,
  "tenant",
  tenant.id,
  { type: "cancel", note: privateReason },
  time(9),
);
const refused = actOnServiceRequest(
  cancelled,
  "provider",
  landlord.id,
  { type: "decline-request", note: privateReason },
  time(10),
);
const finalState = actOnServiceRequest(
  refused,
  "provider",
  sampleOwner.id,
  { type: "decline-request", note: privateReason },
  time(11),
);
const allEvents = reconcileServiceNotifications(revisedAlerts, finalState);
assert.equal(eventOf(allEvents, tenant.id, "quote-declined").role, "provider");
assert.equal(
  eventOf(allEvents, tenant.id, "quote-declined").serviceEvent!.occurredAt,
  time(6).toISOString(),
);
assert.equal(eventOf(allEvents, tenant.id, "quote-accepted").role, "provider");
assert.equal(
  eventOf(allEvents, tenant.id, "quote-accepted").serviceEvent!.occurredAt,
  time(8).toISOString(),
);
assert.equal(
  eventOf(allEvents, tenant.id, "request-cancelled").serviceEvent!.occurredAt,
  time(9).toISOString(),
);
assert.equal(
  eventOf(allEvents, landlord.id, "request-declined").role,
  "landlord",
);
assert.equal(
  eventOf(allEvents, sampleOwner.id, "request-declined").serviceEvent!
    .occurredAt,
  time(11).toISOString(),
);
assert.equal(
  activity(allEvents).some(
    (item) =>
      item.serviceEvent!.requestId === sampleOwner.id &&
      item.serviceEvent!.kind === "request-submitted",
  ),
  false,
);
assert.equal(
  activity(allEvents).some(
    (item) => item.serviceEvent!.requestId === foreign.id,
  ),
  false,
);
assert.equal(
  activity(allEvents).filter(
    (item) =>
      item.serviceEvent!.requestId === tenant.id &&
      item.serviceEvent!.kind === "quote-recorded",
  ).length,
  3,
  "Superseded and declined quote notices remain factual history",
);
assert.equal(reconcileServiceNotifications(allEvents, finalState), allEvents);

let allRead = allEvents;
for (const role of ["tenant", "landlord", "provider"] as const)
  allRead = markAllNotificationsRead(allRead, role);
assert.ok(activity(allRead).every((item) => item.read));
const newRequest = submit(finalState, "tenant", 12);
const afterAllRead = reconcileServiceNotifications(allRead, newRequest.state);
assert.equal(activity(afterAllRead).filter((item) => !item.read).length, 1);
assert.equal(
  eventOf(afterAllRead, newRequest.id, "request-submitted").read,
  false,
);
const repeatedHistory: ServiceRequestState = {
  ...finalState,
  records: finalState.records.map((item) => ({
    ...item,
    history: [...item.history, ...item.history.map((event) => ({ ...event }))],
  })),
};
const deduplicated = reconcileServiceNotifications(
  {
    items: [
      ...allRead.items,
      { ...tenantSubmission, read: false },
      { ...tenantSubmission, read: true },
    ],
  },
  repeatedHistory,
);
assert.equal(activity(deduplicated).length, activity(allEvents).length);
assert.equal(
  new Set(deduplicated.items.map((item) => item.id)).size,
  deduplicated.items.length,
);
assert.equal(eventOf(deduplicated, tenant.id, "request-submitted").read, true);

// Notification payloads exclude private draft and submitted details, notes, amounts and visit dates.
for (const notification of activity(allEvents)) {
  assert.deepEqual(
    Object.keys(notification.serviceEvent!).sort(),
    ["kind", "requestId", "requestTitle", "occurredAt"].sort(),
  );
  assert.equal(
    notification.serviceEvent!.requestTitle,
    record(finalState, notification.serviceEvent!.requestId).title,
  );
  const payload = JSON.stringify(notification);
  for (const privateValue of [
    privateDescription,
    privateScope,
    privateReason,
    "2032-05-15",
    "2032-05-16",
    "preferredTime",
    "amountCents",
    "quoteId",
    "customerName",
    "description",
    "decisionNote",
  ])
    assert.equal(
      payload.includes(privateValue),
      false,
      `Unexpected notification field: ${privateValue}`,
    );
}

// Exact reveal resolves current terminal records, even for a historical quote alert and conflicting filters.
let obstructed = finalState;
for (const role of ["tenant", "landlord", "provider"] as const)
  obstructed = updateServiceRequestView(obstructed, role, {
    query: "unrelated search",
    filter: "active",
    selectedId: role === "landlord" ? sampleOwner.id : sampleTenant.id,
  });
for (const [notification, role, id, destination] of [
  [tenantSubmission, "provider", tenant.id, "provider"],
  [
    eventOf(allEvents, tenant.id, "quote-accepted"),
    "provider",
    tenant.id,
    "provider",
  ],
  [firstQuoteNotice, "tenant", tenant.id, "services"],
  [
    eventOf(allEvents, landlord.id, "request-declined"),
    "landlord",
    landlord.id,
    "services",
  ],
] as const) {
  const opened = openServiceNotification(obstructed, role, notification);
  assert.ok(opened);
  assert.equal(opened.destination, destination);
  assert.equal(opened.serviceMode, role === "provider" ? undefined : "tasks");
  assert.deepEqual(serviceRequestView(opened.state, role), {
    query: "",
    filter: "history",
    selectedId: id,
  });
  for (const other of ["tenant", "landlord", "provider"] as const)
    if (other !== role)
      assert.equal(opened.state.views[other], obstructed.views[other]);
  assert.equal(opened.state.records, obstructed.records);
  assert.equal(opened.state.quoteDrafts, obstructed.quoteDrafts);
  assert.equal(opened.state.actionNotes, obstructed.actionNotes);
  assert.equal(opened.state.drafts, obstructed.drafts);
}
assert.equal(
  serviceRequestView(obstructed, "tenant").query,
  "unrelated search",
);
for (const role of [
  "tenant",
  "landlord",
  "admin",
  "spaceOperator",
  "guest",
] as unknown as Role[])
  assert.equal(
    openServiceNotification(finalState, role, tenantSubmission),
    null,
  );
assert.equal(
  openServiceNotification(initial, "provider", tenantSubmission),
  null,
);
assert.equal(
  openServiceNotification(finalState, "tenant", seeds.items[0]),
  null,
);
assert.equal(
  openServiceNotification(finalState, "provider", {
    ...tenantSubmission,
    id: "service:forged",
  }),
  null,
);
assert.equal(
  openServiceNotification(finalState, "tenant", {
    ...tenantSubmission,
    role: "tenant",
  }),
  null,
);
const forgedPayload: KasaNotification = {
  ...tenantSubmission,
  destination: "admin",
  serviceMode: "jobs",
  serviceEvent: {
    ...tenantSubmission.serviceEvent!,
    requestId: foreign.id,
    requestTitle: "Foreign",
    kind: "request-declined",
    occurredAt: time(12).toISOString(),
  },
};
const canonicalOpen = openServiceNotification(
  obstructed,
  "provider",
  forgedPayload,
);
assert.ok(canonicalOpen);
assert.equal(canonicalOpen.destination, "provider");
assert.equal(
  serviceRequestView(canonicalOpen.state, "provider").selectedId,
  tenant.id,
);

// Eligibility requires both canonical customer access and the provider's own category/record.
const original = record(finalState, tenant.id);
const only = (value: ServiceRequestRecord): ServiceRequestState => ({
  ...finalState,
  records: [value],
});
for (const invalidRecord of [
  { ...original, customerName: "Different tenant" },
  { ...original, customerRole: "landlord" as const },
  { ...original, propertyId: 999 },
  { ...original, providerName: "Casa Clara" },
  { ...original, category: "Plumbing" as const },
]) {
  const invalidState = only(invalidRecord);
  assert.equal(
    activity(reconcileServiceNotifications(seeds, invalidState)).length,
    0,
  );
  assert.equal(
    openServiceNotification(invalidState, "provider", tenantSubmission),
    null,
  );
  assert.equal(
    openServiceNotification(invalidState, "tenant", firstQuoteNotice),
    null,
  );
}
for (const history of [
  [],
  original.history.map((event) => ({ ...event, actor: "Forged actor" })),
  original.history.map((event) => ({ ...event, id: "" })),
  original.history.map((event) => ({ ...event, at: "not-a-date" })),
  original.history.map((event) => ({ ...event, at: time(30).toISOString() })),
  original.history.map((event) => ({
    ...event,
    at: event.at.replace(".000Z", "Z"),
  })),
]) {
  const invalidState = only({ ...original, history });
  assert.equal(
    activity(reconcileServiceNotifications(seeds, invalidState)).length,
    0,
  );
  assert.equal(
    openServiceNotification(invalidState, "provider", tenantSubmission),
    null,
  );
}
const withoutQuotes = only({ ...original, quotes: [] });
assert.equal(
  activity(reconcileServiceNotifications(seeds, withoutQuotes)).some((item) =>
    item.serviceEvent!.kind.startsWith("quote-"),
  ),
  false,
);
const badQuoteLinks = only({
  ...original,
  history: original.history.map((event) =>
    event.quoteId ? { ...event, quoteId: "missing-quote" } : event,
  ),
});
assert.equal(
  activity(reconcileServiceNotifications(seeds, badQuoteLinks)).some((item) =>
    item.serviceEvent!.kind.startsWith("quote-"),
  ),
  false,
);
const noQuoteDecisions = only({
  ...original,
  quotes: original.quotes.map((item) => ({
    ...item,
    decision: "Pending" as const,
    decidedAt: undefined,
  })),
});
const noDecisionEvents = activity(
  reconcileServiceNotifications(seeds, noQuoteDecisions),
);
assert.equal(
  noDecisionEvents.some((item) =>
    ["quote-accepted", "quote-declined"].includes(item.serviceEvent!.kind),
  ),
  false,
);
assert.equal(
  noDecisionEvents.filter(
    (item) => item.serviceEvent!.kind === "quote-recorded",
  ).length,
  3,
);
const fakeCancellation = only({ ...original, status: "Quoted" });
assert.equal(
  activity(reconcileServiceNotifications(seeds, fakeCancellation)).some(
    (item) => item.serviceEvent!.kind === "request-cancelled",
  ),
  false,
);
const refusalRecord = record(finalState, landlord.id);
assert.equal(
  activity(
    reconcileServiceNotifications(
      seeds,
      only({ ...refusalRecord, status: "Requested" }),
    ),
  ).some((item) => item.serviceEvent!.kind === "request-declined"),
  false,
);
const sampleSource = only({ ...original, source: "sample" });
const sampleEvents = activity(
  reconcileServiceNotifications(seeds, sampleSource),
);
assert.equal(
  sampleEvents.some((item) => item.serviceEvent!.kind === "request-submitted"),
  false,
);
assert.ok(
  sampleEvents.some((item) => item.serviceEvent!.kind === "quote-recorded"),
);

// Work-then-Service reconciliation produces one chronological activity list and preserves each namespace's reads.
const workSubmission = submitWorkApplication(
  updateWorkApplicationDraft(
    createInitialWorkState(),
    "tenant",
    "work-volt-electrical",
    {
      introduction:
        "Private work introduction excluded from every activity payload.",
      availability: "Immediately",
      customDate: "",
    },
  ),
  "tenant",
  "work-volt-electrical",
  time(5),
);
assert.ok(workSubmission.applicationId);
const work = markWorkApplicationReviewed(
  workSubmission.state,
  "provider",
  workSubmission.applicationId,
  time(8),
);
const workProjected = reconcileWorkNotifications(allRead, work);
const workItem = workProjected.items.find(
  (item) => item.workEvent?.kind === "application-submitted",
)!;
const mixed = reconcileServiceNotifications(
  markNotificationRead(workProjected, "provider", workItem.id),
  finalState,
);
const timestamp = (item: KasaNotification) =>
  item.workEvent?.occurredAt ?? item.serviceEvent?.occurredAt;
const actualActivity = mixed.items.filter((item) => timestamp(item));
const expectedActivity = [...actualActivity].sort(
  (left, right) =>
    Date.parse(timestamp(right)!) - Date.parse(timestamp(left)!) ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
);
assert.deepEqual(
  actualActivity.map((item) => item.id),
  expectedActivity.map((item) => item.id),
);
assert.deepEqual(mixed.items.slice(0, actualActivity.length), actualActivity);
assert.equal(mixed.items.find((item) => item.id === workItem.id)!.read, true);
assert.ok(activity(mixed).every((item) => item.read));
assert.equal(mixed.items.filter((item) => item.workEvent).length, 2);
const mixedAgain = reconcileServiceNotifications(
  reconcileWorkNotifications(mixed, work),
  finalState,
);
assert.deepEqual(mixedAgain.items, mixed.items);
assert.equal(reconcileServiceNotifications(mixed, finalState), mixed);
const retainedOtherItems = mixed.items.filter((item) => !item.serviceEvent);
const pruned = reconcileServiceNotifications(mixed, initial);
assert.deepEqual(pruned.items, retainedOtherItems);
assert.ok(pruned.items.every((item) => retainedOtherItems.includes(item)));
assert.equal(
  openServiceNotification(initial, "tenant", firstQuoteNotice),
  null,
);
const removedOldQuote = only({
  ...original,
  quotes: original.quotes.filter((item) => item.id !== quoteOne.id),
});
assert.equal(
  openServiceNotification(removedOldQuote, "tenant", firstQuoteNotice),
  null,
);
assert.equal(
  activity(reconcileServiceNotifications(allEvents, removedOldQuote)).some(
    (item) => item.id === firstQuoteNotice.id,
  ),
  false,
);

// Recorded work progress targets only the canonical customer and never exposes the completion note.
const progressKinds = ["service-started", "service-completed"];
const progressEvents = (state: NotificationState) =>
  activity(state).filter((item) =>
    progressKinds.includes(item.serviceEvent!.kind),
  );
const ownerQuoted = quote(landlord.state, landlord.id, 4);
const ownerAccepted = actOnServiceRequest(
  ownerQuoted.state,
  "landlord",
  landlord.id,
  { type: "accept", quoteId: ownerQuoted.id },
  time(8),
);
for (const [beforeStart, targetId, customerRole] of [
  [accepted, tenant.id, "tenant"],
  [ownerAccepted, landlord.id, "landlord"],
] as const) {
  assert.equal(
    progressEvents(reconcileServiceNotifications(seeds, beforeStart)).length,
    0,
  );
  const premature = actOnServiceRequest(
    beforeStart,
    "provider",
    targetId,
    { type: "complete", note: privateReason },
    time(12),
  );
  assert.equal(premature, beforeStart);
  assert.equal(
    progressEvents(reconcileServiceNotifications(seeds, premature)).length,
    0,
  );
  const wrongActor = actOnServiceRequest(
    beforeStart,
    customerRole,
    targetId,
    { type: "start" },
    time(13),
  );
  assert.equal(wrongActor, beforeStart);
  const started = actOnServiceRequest(
    beforeStart,
    "provider",
    targetId,
    { type: "start" },
    time(13),
  );
  const startAlerts = reconcileServiceNotifications(seeds, started);
  const startNotice = eventOf(startAlerts, targetId, "service-started");
  assert.equal(startNotice.role, customerRole);
  assert.equal(startNotice.destination, "services");
  assert.equal(startNotice.serviceMode, "tasks");
  assert.equal(startNotice.serviceEvent!.occurredAt, time(13).toISOString());
  assert.equal(progressEvents(startAlerts).length, 1);
  assert.equal(
    actOnServiceRequest(
      started,
      "provider",
      targetId,
      { type: "start" },
      time(14),
    ),
    started,
  );
  const progressRead = markAllNotificationsRead(startAlerts, customerRole);
  const privateCompletion =
    "PRIVATE_COMPLETION: specific access and inspection details remain in the service record.";
  const completed = actOnServiceRequest(
    started,
    "provider",
    targetId,
    { type: "complete", note: privateCompletion },
    time(14),
  );
  const completedAlerts = reconcileServiceNotifications(
    progressRead,
    completed,
  );
  const completionNotice = eventOf(
    completedAlerts,
    targetId,
    "service-completed",
  );
  assert.equal(completionNotice.role, customerRole);
  assert.equal(
    completionNotice.serviceEvent!.occurredAt,
    time(14).toISOString(),
  );
  assert.equal(completionNotice.read, false);
  assert.equal(
    eventOf(completedAlerts, targetId, "service-started").id,
    startNotice.id,
  );
  assert.equal(
    eventOf(completedAlerts, targetId, "service-started").read,
    true,
  );
  assert.equal(
    completedAlerts.items.filter(
      (item) => item.role === customerRole && !item.read,
    ).length,
    1,
  );
  assert.equal(progressEvents(completedAlerts).length, 2);
  assert.equal(
    reconcileServiceNotifications(completedAlerts, completed),
    completedAlerts,
  );
  assert.equal(
    actOnServiceRequest(
      completed,
      "provider",
      targetId,
      { type: "complete", note: "Repeated completion" },
      time(15),
    ),
    completed,
  );
  assert.equal(
    record(completed, targetId).quotes,
    record(beforeStart, targetId).quotes,
  );
  assert.equal(
    latestServiceQuote(record(completed, targetId))!.decision,
    "Accepted",
  );
  assert.equal(
    record(completed, targetId).history.at(-1)!.note,
    privateCompletion,
  );
  for (const notification of progressEvents(completedAlerts)) {
    assert.deepEqual(
      Object.keys(notification.serviceEvent!).sort(),
      ["kind", "requestId", "requestTitle", "occurredAt"].sort(),
    );
    assert.equal(
      JSON.stringify(notification).includes(privateCompletion),
      false,
    );
    assert.equal(JSON.stringify(notification).includes(privateScope), false);
    for (const role of [
      "tenant",
      "landlord",
      "provider",
      "spaceOperator",
      "admin",
    ] as const)
      if (role !== customerRole)
        assert.equal(
          openServiceNotification(completed, role, notification),
          null,
        );
  }
  const hidden = updateServiceRequestView(completed, customerRole, {
    query: "unrelated",
    filter: "active",
    selectedId: null,
  });
  for (const notification of [startNotice, completionNotice]) {
    const opened = openServiceNotification(hidden, customerRole, notification);
    assert.ok(opened);
    assert.deepEqual(serviceRequestView(opened.state, customerRole), {
      query: "",
      filter: "history",
      selectedId: targetId,
    });
    assert.equal(opened.state.records, hidden.records);
    assert.equal(
      record(opened.state, targetId).quotes,
      record(completed, targetId).quotes,
    );
    assert.equal(
      record(opened.state, targetId).history,
      record(completed, targetId).history,
    );
    assert.equal(opened.state.views.provider, hidden.views.provider);
  }
  const completedRecord = record(completed, targetId);
  const isolated = (candidate: ServiceRequestRecord): ServiceRequestState => ({
    ...completed,
    records: [candidate],
  });
  const repeatedProgress = isolated({
    ...completedRecord,
    history: [
      ...completedRecord.history,
      ...completedRecord.history.map((event) => ({ ...event })),
    ],
  });
  assert.equal(
    progressEvents(
      reconcileServiceNotifications(completedAlerts, repeatedProgress),
    ).length,
    2,
  );
  for (const invalid of [
    { ...completedRecord, customerName: "Different customer" },
    { ...completedRecord, propertyId: 999 },
    { ...completedRecord, providerName: "Casa Clara" },
    { ...completedRecord, quotes: [] },
    {
      ...completedRecord,
      quotes: [
        ...completedRecord.quotes,
        {
          ...latestServiceQuote(completedRecord)!,
          id: "another-accepted-quote",
        },
      ],
    },
    {
      ...completedRecord,
      quotes: [
        ...completedRecord.quotes,
        {
          ...latestServiceQuote(completedRecord)!,
          id: "later-pending-quote",
          decision: "Pending" as const,
        },
      ],
    },
    {
      ...completedRecord,
      quotes: completedRecord.quotes.map((item) => ({
        ...item,
        decision: "Pending" as const,
      })),
    },
    {
      ...completedRecord,
      history: completedRecord.history.filter(
        (event) => event.action !== "accepted",
      ),
    },
    {
      ...completedRecord,
      history: completedRecord.history.map((event) =>
        event.action === "started"
          ? { ...event, actor: "Forged provider" }
          : event,
      ),
    },
    {
      ...completedRecord,
      history: completedRecord.history.map((event) =>
        event.action === "started" ? { ...event, at: "not-a-date" } : event,
      ),
    },
    {
      ...completedRecord,
      history: [
        completedRecord.history.find((event) => event.action === "started")!,
        ...completedRecord.history.filter(
          (event) => event.action !== "started",
        ),
      ],
    },
    {
      ...completedRecord,
      history: completedRecord.history.filter(
        (event) => event.action !== "quoted",
      ),
    },
    {
      ...completedRecord,
      history: [
        ...completedRecord.history,
        {
          ...completedRecord.history.find(
            (event) => event.action === "started",
          )!,
          id: "ambiguous-second-start",
        },
      ],
    },
  ]) {
    const invalidState = isolated(invalid);
    assert.equal(
      progressEvents(reconcileServiceNotifications(seeds, invalidState)).length,
      0,
    );
    assert.equal(
      openServiceNotification(invalidState, customerRole, startNotice),
      null,
    );
    assert.equal(
      openServiceNotification(invalidState, customerRole, completionNotice),
      null,
    );
  }
  for (const invalid of [
    { ...completedRecord, status: "In progress" as const },
    { ...completedRecord, updatedAt: time(15).toISOString() },
    {
      ...completedRecord,
      history: completedRecord.history.filter(
        (event) => event.action !== "started",
      ),
    },
    {
      ...completedRecord,
      history: completedRecord.history.map((event) =>
        event.action === "completed"
          ? { ...event, actor: completedRecord.customerName }
          : event,
      ),
    },
    {
      ...completedRecord,
      history: completedRecord.history.map((event) =>
        event.action === "completed"
          ? { ...event, at: time(14).toISOString().replace(".000Z", "Z") }
          : event,
      ),
    },
    {
      ...completedRecord,
      history: completedRecord.history.map((event) =>
        event.action === "completed" ? { ...event, id: "" } : event,
      ),
    },
  ]) {
    const invalidState = isolated(invalid);
    assert.equal(
      activity(reconcileServiceNotifications(seeds, invalidState)).some(
        (item) => item.serviceEvent!.kind === "service-completed",
      ),
      false,
    );
    assert.equal(
      openServiceNotification(invalidState, customerRole, completionNotice),
      null,
    );
  }
}

console.log(
  "Service notification checks passed: dual scope, genuine historical and progress events, sample suppression, private payloads, read/dedup/pruning, mixed Work chronology and exact guarded historical request navigation.",
);
