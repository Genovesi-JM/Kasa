import assert from "node:assert/strict";
import {
  actOnServiceRequest,
  canQuoteServiceRequest,
  createInitialServiceRequestState,
  isServiceCustomer,
  latestServiceQuote,
  saveServiceQuote,
  saveServiceRequest,
  serviceAmountCents,
  serviceAppointmentIsCurrent,
  serviceDateValue,
  serviceProperties,
  serviceProvidersForCategory,
  serviceQuoteDraft,
  serviceRequestActionIssue,
  serviceRequestCounts,
  serviceRequestDraft,
  serviceRequestDraftKey,
  updateServiceActionNote,
  updateServiceQuoteDraft,
  updateServiceRequestDraft,
  validateServiceQuote,
  validateServiceRequest,
  visibleServiceRequests,
  workspaceServiceProvider,
  type ServiceQuoteDraft,
  type ServiceRequestDraft,
  type ServiceRequestState,
} from "../src/components/serviceRequestState";
import type { Role } from "../src/types";

const now = new Date(2026, 9, 3, 12, 0, 30);
const later = new Date(2026, 9, 3, 13);
const tomorrow = new Date(2026, 9, 4, 12);
const initial = createInitialServiceRequestState(now);
const empty: ServiceRequestState = { ...initial, records: [], nextId: 1 };
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
assert.equal(initial.records.length, 3);
assert.ok(
  initial.records.every(
    (record) =>
      record.source === "sample" &&
      record.status === "Requested" &&
      record.quotes.length === 0,
  ),
);
assert.equal(visibleServiceRequests(initial, "tenant").length, 2);
assert.equal(visibleServiceRequests(initial, "landlord").length, 1);
assert.equal(visibleServiceRequests(initial, "provider").length, 2);
assert.ok(
  visibleServiceRequests(initial, "provider").every(
    (record) =>
      record.providerName === workspaceServiceProvider &&
      record.category === "Electrical",
  ),
);
assert.deepEqual(visibleServiceRequests(initial, "admin"), []);
assert.deepEqual(visibleServiceRequests(initial, "spaceOperator"), []);
assert.ok(
  initial.records.every((record) => record.preferredDate === "2026-10-06"),
);
assert.equal(isServiceCustomer("tenant"), true);
assert.equal(isServiceCustomer("provider"), false);
assert.deepEqual(
  serviceProperties("tenant").map((property) => property.id),
  [1],
);
assert.deepEqual(
  serviceProperties("landlord").map((property) => property.id),
  [1],
);
assert.deepEqual(serviceProperties("admin"), []);
assert.deepEqual(
  serviceProvidersForCategory("Electrical").map((provider) => provider.name),
  [workspaceServiceProvider],
);
assert.equal(serviceRequestCounts(initial, "provider").requested, 2);
assert.equal(serviceRequestCounts(initial, "tenant").active, 2);

const tenantDraft = serviceRequestDraft(
  empty,
  "tenant",
  workspaceServiceProvider,
);
assert.equal(tenantDraft.providerName, workspaceServiceProvider);
assert.equal(tenantDraft.category, "Electrical");
assert.equal(tenantDraft.propertyId, "1");
assert.equal(tenantDraft.title, "");
assert.equal(tenantDraft.preferredDate, "");
assert.equal(tenantDraft.preferredTime, "");
assert.equal(serviceRequestDraft(empty, "tenant").category, "");
assert.equal(serviceRequestDraft(empty, "tenant").providerName, "");
assert.ok(
  Object.keys(validateServiceRequest(tenantDraft, "tenant", now)).length > 0,
);
assert.equal(
  saveServiceRequest(empty, "tenant", workspaceServiceProvider, now).state,
  empty,
);
assert.equal(
  serviceRequestDraftKey(workspaceServiceProvider),
  `provider:${workspaceServiceProvider}`,
);
assert.equal(serviceRequestDraftKey("Unknown"), "general");

const completeDraft: ServiceRequestDraft = {
  propertyId: "1",
  category: "Electrical",
  providerName: workspaceServiceProvider,
  title: "  Inspect a loose socket  ",
  description:
    "  The kitchen socket is loose. Please inspect it and quote for the complete repair before starting.  ",
  preferredDate: "2026-10-06",
  preferredTime: "10:30",
};
const withDraft = updateServiceRequestDraft(
  empty,
  "tenant",
  completeDraft,
  workspaceServiceProvider,
);
assert.equal(
  serviceRequestDraft(empty, "tenant", workspaceServiceProvider).title,
  "",
  "Draft updates do not mutate prior state",
);
assert.equal(
  serviceRequestDraft(withDraft, "tenant", workspaceServiceProvider).title,
  completeDraft.title,
);
assert.equal(
  updateServiceRequestDraft(
    withDraft,
    "tenant",
    completeDraft,
    workspaceServiceProvider,
  ),
  withDraft,
);
assert.equal(
  serviceRequestDraft(withDraft, "landlord", workspaceServiceProvider).title,
  "",
  "Owner and tenant drafts remain separate even for the same property/provider",
);
assert.equal(
  serviceRequestDraft(withDraft, "tenant", "Casa Clara").title,
  "",
  "Provider-specific drafts do not overwrite one another",
);
const generalDraft = updateServiceRequestDraft(withDraft, "tenant", {
  title: "General draft retained",
});
const otherDraft = updateServiceRequestDraft(
  generalDraft,
  "landlord",
  { title: "Owner draft retained" },
  workspaceServiceProvider,
);
for (const role of ["provider", "spaceOperator", "admin"] as Role[]) {
  assert.equal(
    updateServiceRequestDraft(otherDraft, role, completeDraft),
    otherDraft,
  );
  assert.equal(
    saveServiceRequest(otherDraft, role, undefined, now).state,
    otherDraft,
  );
}
assert.equal(
  updateServiceRequestDraft(otherDraft, "tenant", completeDraft, "Unknown"),
  otherDraft,
);
assert.equal(
  saveServiceRequest(otherDraft, "tenant", "Unknown", now).state,
  otherDraft,
);
const protectedPatch = updateServiceRequestDraft(
  withDraft,
  "tenant",
  {
    customerName: "Someone",
    status: "Completed",
  } as Partial<ServiceRequestDraft>,
  workspaceServiceProvider,
);
assert.equal(protectedPatch, withDraft);

const invalidRequestFields: Array<[keyof ServiceRequestDraft, string]> = [
  ["propertyId", "2"],
  ["propertyId", "1.0"],
  ["propertyId", "-1"],
  ["propertyId", "NaN"],
  ["category", "Tourism"],
  ["providerName", "Casa Clara"],
  ["providerName", "Unknown"],
  ["title", "x"],
  ["title", "x".repeat(121)],
  ["description", "short"],
  ["description", "x".repeat(3001)],
  ["preferredDate", "2026-10-02"],
  ["preferredDate", "2026-02-30"],
  ["preferredDate", "2026-13-01"],
  ["preferredTime", "24:00"],
  ["preferredTime", "12:60"],
  ["preferredTime", ""],
];
for (const [name, value] of invalidRequestFields) {
  const draft = { ...completeDraft, [name]: value };
  assert.ok(
    validateServiceRequest(draft, "tenant", now)[name],
    `Reject invalid ${name}: ${value}`,
  );
  const state = updateServiceRequestDraft(empty, "tenant", draft);
  assert.equal(
    saveServiceRequest(state, "tenant", undefined, now).state,
    state,
  );
}
assert.equal(
  validateServiceRequest(
    { ...completeDraft, preferredDate: "2026-10-03", preferredTime: "11:59" },
    "tenant",
    now,
  ).preferredTime,
  "time",
);
assert.deepEqual(
  validateServiceRequest(
    { ...completeDraft, preferredDate: "2026-10-03", preferredTime: "12:00" },
    "tenant",
    now,
  ),
  {},
  "The current minute is valid despite nonzero seconds",
);
assert.equal(serviceDateValue(now), "2026-10-03");
assert.equal(serviceAppointmentIsCurrent("2026-10-03", "12:00", now), true);
assert.equal(serviceAppointmentIsCurrent("2026-10-03", "11:59", now), false);
assert.equal(serviceAppointmentIsCurrent("2026-02-30", "12:00", now), false);
assert.equal(serviceAppointmentIsCurrent("2026-10-06", "99:00", now), false);
assert.ok(
  validateServiceRequest(
    { ...completeDraft, preferredDate: "2026-10-03" },
    "tenant",
    tomorrow,
  ).preferredDate,
);

const saved = saveServiceRequest(
  otherDraft,
  "tenant",
  workspaceServiceProvider,
  now,
);
assert.ok(saved.requestId);
assert.deepEqual(saved.errors, {});
const id = saved.requestId!;
const record = (state: ServiceRequestState, target = id) =>
  state.records.find((item) => item.id === target)!;
assert.equal(record(saved.state).title, completeDraft.title.trim());
assert.equal(record(saved.state).description, completeDraft.description.trim());
assert.equal(record(saved.state).source, "local");
assert.equal(record(saved.state).customerName, "Inês Duarte");
assert.equal(record(saved.state).status, "Requested");
assert.equal(record(saved.state).history.length, 1);
assert.equal(record(saved.state).createdAt, now.toISOString());
assert.equal(empty.records.length, 0);
assert.equal(
  serviceRequestDraft(saved.state, "tenant", workspaceServiceProvider).title,
  "",
  "Saving clears only the submitted draft",
);
assert.equal(
  serviceRequestDraft(saved.state, "tenant").title,
  "General draft retained",
);
assert.equal(
  serviceRequestDraft(saved.state, "landlord", workspaceServiceProvider).title,
  "Owner draft retained",
);
assert.equal(
  saveServiceRequest(saved.state, "tenant", workspaceServiceProvider, now)
    .state,
  saved.state,
  "A second submit cannot reuse cleared request fields",
);
assert.equal(visibleServiceRequests(saved.state, "landlord").length, 0);
assert.equal(visibleServiceRequests(saved.state, "provider").length, 1);
assert.equal(canQuoteServiceRequest(record(saved.state), "provider"), true);
assert.equal(canQuoteServiceRequest(record(saved.state), "tenant"), false);
const fakeCustomer = {
  ...saved.state,
  records: [{ ...record(saved.state), customerName: "Another tenant" }],
};
assert.deepEqual(visibleServiceRequests(fakeCustomer, "tenant"), []);

const quoteDraft: ServiceQuoteDraft = {
  amount: "125,50",
  scope:
    "Inspect and replace one outlet, including labour, materials and applicable charges. No extra work without agreement.",
  date: "2026-10-07",
  time: "14:30",
  validUntil: "2026-10-06",
};
assert.equal(
  serviceQuoteDraft(saved.state, "provider", id).date,
  completeDraft.preferredDate,
);
assert.equal(serviceQuoteDraft(saved.state, "provider", id).amount, "");
assert.equal(serviceQuoteDraft(saved.state, "tenant", id).date, "");
const quoting = updateServiceQuoteDraft(
  saved.state,
  "provider",
  id,
  quoteDraft,
);
assert.equal(
  serviceQuoteDraft(quoting, "provider", id).amount,
  quoteDraft.amount,
);
assert.equal(serviceQuoteDraft(saved.state, "provider", id).amount, "");
assert.equal(
  updateServiceQuoteDraft(quoting, "provider", id, quoteDraft),
  quoting,
);
assert.equal(
  updateServiceQuoteDraft(quoting, "provider", "missing", quoteDraft),
  quoting,
);
for (const role of roles.filter((value) => value !== "provider")) {
  assert.equal(
    updateServiceQuoteDraft(quoting, role, id, { amount: "2" }),
    quoting,
  );
  assert.equal(saveServiceQuote(quoting, role, id, now).state, quoting);
}
const foreignProviderRecord = initial.records.find(
  (item) => item.providerName === "Casa Clara",
)!;
assert.equal(
  updateServiceQuoteDraft(
    initial,
    "provider",
    foreignProviderRecord.id,
    quoteDraft,
  ),
  initial,
);
assert.equal(
  saveServiceQuote(initial, "provider", foreignProviderRecord.id, now).state,
  initial,
);
for (const [amount, expected] of [
  ["125,50", 12550],
  ["125.50", 12550],
  ["0.01", 1],
  [" 001.20 ", 120],
  ["1000000", 100000000],
] as const)
  assert.equal(serviceAmountCents(amount), expected);
for (const amount of [
  "",
  "0",
  "-1",
  "+10",
  "1e3",
  "NaN",
  "Infinity",
  "1000000.01",
  "12.345",
  "1,250.00",
  ".5",
  "1.",
])
  assert.equal(
    serviceAmountCents(amount),
    null,
    `Reject invalid quote amount ${amount}`,
  );
assert.deepEqual(validateServiceQuote(quoteDraft, now), {});
const invalidQuoteFields: Array<[keyof ServiceQuoteDraft, string]> = [
  ["amount", "0"],
  ["scope", "short"],
  ["scope", "x".repeat(3001)],
  ["date", "2026-10-02"],
  ["date", "2026-02-30"],
  ["time", "25:00"],
  ["time", "12:60"],
  ["validUntil", "2026-10-02"],
  ["validUntil", "2026-10-08"],
  ["validUntil", "2026-02-30"],
];
for (const [name, value] of invalidQuoteFields) {
  assert.ok(
    validateServiceQuote({ ...quoteDraft, [name]: value }, now)[name],
    `Reject invalid quote ${name}: ${value}`,
  );
  const invalid = updateServiceQuoteDraft(quoting, "provider", id, {
    [name]: value,
  });
  assert.equal(saveServiceQuote(invalid, "provider", id, now).state, invalid);
}
const quotedResult = saveServiceQuote(quoting, "provider", id, now);
assert.deepEqual(quotedResult.errors, {});
const quoted = quotedResult.state;
const quote = latestServiceQuote(record(quoted))!;
assert.equal(record(quoted).status, "Quoted");
assert.equal(quote.amountCents, 12550);
assert.equal(quote.decision, "Pending");
assert.equal(quote.date, quoteDraft.date);
assert.equal(
  record(quoted).preferredDate,
  completeDraft.preferredDate,
  "A quote's proposal never rewrites the customer's requested date",
);
assert.equal(record(quoted).history.at(-1)?.actor, workspaceServiceProvider);
assert.equal(record(quoted).history.at(-1)?.quoteId, quote.id);
assert.equal(
  record(saved.state).quotes.length,
  0,
  "Quoting leaves prior state intact",
);
assert.equal(serviceRequestCounts(quoted, "tenant").quoted, 1);
assert.equal(serviceRequestCounts(quoted, "provider").requested, 0);

const revisedDraft = updateServiceQuoteDraft(quoted, "provider", id, {
  amount: "110",
  time: "15:00",
});
const revised = saveServiceQuote(revisedDraft, "provider", id, later).state;
const latest = latestServiceQuote(record(revised))!;
assert.equal(record(revised).quotes.length, 2);
assert.equal(latest.version, 2);
assert.equal(record(revised).quotes[0].decision, "Superseded");
assert.equal(record(revised).quotes[0].amountCents, quote.amountCents);
assert.equal(record(quoted).quotes[0].decision, "Pending");
assert.equal(
  serviceRequestActionIssue(
    revised,
    "tenant",
    id,
    { type: "accept", quoteId: quote.id },
    now,
  ),
  "staleQuote",
);
assert.equal(
  actOnServiceRequest(
    revised,
    "tenant",
    id,
    { type: "accept", quoteId: quote.id },
    now,
  ),
  revised,
);
for (const role of roles.filter((value) => value !== "tenant")) {
  assert.equal(
    actOnServiceRequest(
      revised,
      role,
      id,
      { type: "accept", quoteId: latest.id },
      now,
    ),
    revised,
  );
  assert.equal(
    actOnServiceRequest(
      revised,
      role,
      id,
      { type: "decline", quoteId: latest.id, note: "Different time needed" },
      now,
    ),
    revised,
  );
  assert.equal(
    actOnServiceRequest(
      revised,
      role,
      id,
      { type: "cancel", note: "No longer needed" },
      now,
    ),
    revised,
  );
}
assert.equal(
  serviceRequestActionIssue(
    revised,
    "tenant",
    id,
    { type: "decline", quoteId: latest.id, note: " " },
    now,
  ),
  "note",
);
assert.equal(
  serviceRequestActionIssue(
    revised,
    "tenant",
    id,
    { type: "cancel", note: "x" },
    now,
  ),
  "note",
);
const expiredAt = new Date(2026, 9, 7, 9);
assert.equal(
  serviceRequestActionIssue(
    revised,
    "tenant",
    id,
    { type: "accept", quoteId: latest.id },
    expiredAt,
  ),
  "expired",
);
assert.equal(
  actOnServiceRequest(
    revised,
    "tenant",
    id,
    { type: "accept", quoteId: latest.id },
    expiredAt,
  ),
  revised,
);
const shortVisitDraft = updateServiceQuoteDraft(quoted, "provider", id, {
  date: "2026-10-03",
  time: "14:00",
  validUntil: "2026-10-03",
});
const shortVisit = saveServiceQuote(shortVisitDraft, "provider", id, now).state;
assert.equal(
  serviceRequestActionIssue(
    shortVisit,
    "tenant",
    id,
    { type: "accept", quoteId: latestServiceQuote(record(shortVisit))!.id },
    new Date(2026, 9, 3, 14, 1),
  ),
  "visitPast",
);
assert.equal(
  actOnServiceRequest(revised, "provider", id, { type: "start" }, now),
  revised,
  "Work cannot start before explicit acceptance",
);
assert.equal(
  actOnServiceRequest(
    revised,
    "provider",
    id,
    { type: "complete", note: "All done" },
    now,
  ),
  revised,
);
const declined = actOnServiceRequest(
  revised,
  "tenant",
  id,
  {
    type: "decline",
    quoteId: latest.id,
    note: "  Please offer a morning appointment  ",
  },
  later,
);
assert.equal(record(declined).status, "Declined");
assert.equal(latestServiceQuote(record(declined))!.decision, "Declined");
assert.equal(
  latestServiceQuote(record(declined))!.decisionNote,
  "Please offer a morning appointment",
);
assert.equal(canQuoteServiceRequest(record(declined), "provider"), true);
assert.equal(
  actOnServiceRequest(
    declined,
    "tenant",
    id,
    { type: "accept", quoteId: latest.id },
    now,
  ),
  declined,
);
const afterDecline = saveServiceQuote(
  updateServiceQuoteDraft(declined, "provider", id, { time: "09:00" }),
  "provider",
  id,
  later,
).state;
assert.equal(latestServiceQuote(record(afterDecline))!.version, 3);
assert.equal(record(afterDecline).quotes[1].decision, "Declined");

const accepted = actOnServiceRequest(
  revised,
  "tenant",
  id,
  { type: "accept", quoteId: latest.id },
  later,
);
assert.equal(record(accepted).status, "Accepted");
assert.equal(latestServiceQuote(record(accepted))!.decision, "Accepted");
assert.equal(
  latestServiceQuote(record(accepted))!.decidedAt,
  later.toISOString(),
);
assert.equal(serviceRequestCounts(accepted, "provider").accepted, 1);
assert.equal(serviceRequestCounts(accepted, "tenant").active, 1);
assert.equal(canQuoteServiceRequest(record(accepted), "provider"), false);
assert.equal(
  updateServiceQuoteDraft(accepted, "provider", id, { amount: "999" }),
  accepted,
);
assert.equal(
  saveServiceQuote(accepted, "provider", id, later).state,
  accepted,
  "A provider cannot alter an accepted quote",
);
assert.equal(
  actOnServiceRequest(
    accepted,
    "tenant",
    id,
    { type: "accept", quoteId: latest.id },
    later,
  ),
  accepted,
);
assert.equal(
  actOnServiceRequest(accepted, "tenant", id, { type: "start" }, later),
  accepted,
);
const inProgress = actOnServiceRequest(
  accepted,
  "provider",
  id,
  { type: "start" },
  later,
);
assert.equal(record(inProgress).status, "In progress");
assert.equal(serviceRequestCounts(inProgress, "provider").inProgress, 1);
assert.equal(
  actOnServiceRequest(
    inProgress,
    "tenant",
    id,
    { type: "cancel", note: "Changed my mind" },
    later,
  ),
  inProgress,
);
assert.equal(
  actOnServiceRequest(
    inProgress,
    "provider",
    id,
    { type: "complete", note: "" },
    later,
  ),
  inProgress,
);
const completed = actOnServiceRequest(
  inProgress,
  "provider",
  id,
  {
    type: "complete",
    note: "  Outlet replaced and checked with the customer.  ",
  },
  later,
);
assert.equal(record(completed).status, "Completed");
assert.equal(
  record(completed).history.at(-1)?.note,
  "Outlet replaced and checked with the customer.",
);
assert.equal(serviceRequestCounts(completed, "tenant").active, 0);
assert.equal(serviceRequestCounts(completed, "provider").completed, 1);
assert.equal(
  actOnServiceRequest(completed, "provider", id, { type: "start" }, later),
  completed,
);
assert.equal(
  saveServiceQuote(completed, "provider", id, later).state,
  completed,
);
for (const state of [saved.state, quoted, declined, accepted]) {
  const cancelled = actOnServiceRequest(
    state,
    "tenant",
    id,
    { type: "cancel", note: "Work no longer needed" },
    later,
  );
  assert.equal(record(cancelled).status, "Cancelled");
  assert.equal(serviceRequestCounts(cancelled, "tenant").cancelled, 1);
  assert.equal(serviceRequestCounts(cancelled, "tenant").active, 0);
  assert.equal(
    saveServiceQuote(cancelled, "provider", id, later).state,
    cancelled,
  );
  assert.equal(
    actOnServiceRequest(cancelled, "provider", id, { type: "start" }, later),
    cancelled,
  );
  assert.equal(
    record(cancelled).quotes.length,
    record(state).quotes.length,
    "Cancellation retains the quote history",
  );
}
const noted = updateServiceActionNote(
  quoted,
  "tenant",
  id,
  "Need a different day",
);
assert.equal(noted.actionNotes.tenant[id], "Need a different day");
assert.equal(noted.actionNotes.provider[id], undefined);
assert.equal(quoted.actionNotes.tenant[id], undefined);
assert.equal(
  updateServiceActionNote(noted, "landlord", id, "Foreign note"),
  noted,
);
assert.equal(
  updateServiceActionNote(noted, "tenant", id, "x".repeat(2001)),
  noted,
);
assert.equal(
  actOnServiceRequest(
    noted,
    "tenant",
    id,
    { type: "decline", quoteId: quote.id, note: "Need a different day" },
    later,
  ).actionNotes.tenant[id],
  "",
);
const ownerCreate = saveServiceRequest(
  updateServiceRequestDraft(saved.state, "landlord", completeDraft),
  "landlord",
  undefined,
  now,
);
assert.notEqual(ownerCreate.requestId, id);
assert.equal(visibleServiceRequests(ownerCreate.state, "landlord").length, 1);
assert.equal(visibleServiceRequests(ownerCreate.state, "tenant").length, 1);
assert.equal(
  visibleServiceRequests(ownerCreate.state, "provider").length,
  2,
  "A relevant provider sees both counterpart requests while customers see only their own",
);
assert.equal(
  serviceQuoteDraft(ownerCreate.state, "provider", ownerCreate.requestId!)
    .amount,
  "",
  "Quote drafts remain per request",
);
assert.ok(
  record(completed).history.every(
    (event, index, events) =>
      events.findIndex((other) => other.id === event.id) === index,
  ),
);
assert.equal("paymentStatus" in record(completed), false);
assert.equal("sentAt" in record(completed), false);
assert.equal(
  createInitialServiceRequestState(now).records.length,
  3,
  "Reload factory contains only labelled examples, not session changes",
);

console.log(
  "Service request state checks passed: scoped customer/provider records, retained independent drafts, property/category/provider validation, exact quote totals, local dates/times, quote revisions and expiry, explicit decisions, cancellation, guarded work completion and immutable history.",
);
