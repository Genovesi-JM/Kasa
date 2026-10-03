import assert from "node:assert/strict";
import {
  actOnServiceRequest,
  createInitialServiceRequestState,
  latestServiceQuote,
  saveServiceQuote,
  saveServiceRequest,
  selectServiceRequest,
  serviceRequestView,
  updateServiceActionNote,
  updateServiceQuoteDraft,
  updateServiceRequestDraft,
  updateServiceRequestView,
  visibleServiceRequests,
  workspaceServiceProvider,
  type ServiceRequestAction,
  type ServiceRequestDraft,
  type ServiceRequestState,
  type ServiceRequestStatus,
  type ServiceRequestView,
} from "../src/components/serviceRequestState";
import type { Role } from "../src/types";

const now = new Date("2032-05-10T12:00:00");
const later = new Date("2032-05-10T13:00:00");
const defaultView: ServiceRequestView = {
  query: "",
  filter: "active",
  selectedId: null,
};
const initial = createInitialServiceRequestState(now);
const scopedRoles = ["tenant", "landlord", "provider"] as const;
const own = initial.records.find(
  (item) =>
    item.customerRole === "tenant" &&
    item.providerName === workspaceServiceProvider,
)!;
const owner = initial.records.find((item) => item.customerRole === "landlord")!;
const foreign = initial.records.find(
  (item) => item.providerName !== workspaceServiceProvider,
)!;
assert.ok(own && owner && foreign);
const getRecord = (state: ServiceRequestState, id: string) => {
  const record = state.records.find((item) => item.id === id);
  assert.ok(record);
  return record;
};

// Sample creation must not leak its internal save selections into any initial workspace.
for (const role of scopedRoles) {
  assert.deepEqual(serviceRequestView(initial, role), defaultView);
  assert.notEqual(serviceRequestView(initial, role), initial.views[role]);
}
assert.notEqual(initial.views.tenant, initial.views.landlord);
assert.notEqual(initial.views.tenant, initial.views.provider);
const fresh = createInitialServiceRequestState(now);
for (const role of scopedRoles) {
  assert.deepEqual(serviceRequestView(fresh, role), defaultView);
  assert.notEqual(fresh.views[role], initial.views[role]);
}
const detached = serviceRequestView(initial, "tenant");
detached.query = "Cannot change retained state";
detached.filter = "history";
detached.selectedId = own.id;
assert.deepEqual(serviceRequestView(initial, "tenant"), defaultView);

// Role-specific view changes retain only validated scalar data and never touch request content.
const tenantPatch: Partial<ServiceRequestView> = {
  query: "  cozinha elétrica  ",
  filter: "all",
  selectedId: own.id,
};
const tenantView = updateServiceRequestView(initial, "tenant", tenantPatch);
tenantPatch.query = "Changed caller object";
assert.deepEqual(serviceRequestView(tenantView, "tenant"), {
  query: "  cozinha elétrica  ",
  filter: "all",
  selectedId: own.id,
});
assert.equal(tenantView.records, initial.records);
assert.equal(tenantView.drafts, initial.drafts);
assert.equal(tenantView.quoteDrafts, initial.quoteDrafts);
assert.equal(tenantView.actionNotes, initial.actionNotes);
assert.equal(tenantView.views.provider, initial.views.provider);
assert.equal(tenantView.views.landlord, initial.views.landlord);
assert.deepEqual(serviceRequestView(initial, "tenant"), defaultView);
assert.equal(
  updateServiceRequestView(
    tenantView,
    "tenant",
    serviceRequestView(tenantView, "tenant"),
  ),
  tenantView,
);
assert.equal(updateServiceRequestView(tenantView, "tenant", {}), tenantView);
const allViews = updateServiceRequestView(
  updateServiceRequestView(tenantView, "provider", {
    query: "provider retained",
    filter: "history",
    selectedId: owner.id,
  }),
  "landlord",
  { query: "owner retained", filter: "active", selectedId: owner.id },
);
assert.deepEqual(
  serviceRequestView(allViews, "tenant"),
  serviceRequestView(tenantView, "tenant"),
);
assert.deepEqual(serviceRequestView(allViews, "provider"), {
  query: "provider retained",
  filter: "history",
  selectedId: owner.id,
});
assert.deepEqual(serviceRequestView(allViews, "landlord"), {
  query: "owner retained",
  filter: "active",
  selectedId: owner.id,
});
const capped = updateServiceRequestView(allViews, "tenant", {
  query: "a".repeat(250),
});
assert.equal(serviceRequestView(capped, "tenant").query, "a".repeat(200));
assert.equal(
  serviceRequestView(
    updateServiceRequestView(capped, "tenant", { query: "" }),
    "tenant",
  ).query,
  "",
);
assert.equal(
  serviceRequestView(
    updateServiceRequestView(capped, "tenant", { query: "one " }),
    "tenant",
  ).query,
  "one ",
);
for (const patch of [
  { query: 123 },
  { query: null },
  { query: ["cozinha"] },
  { filter: "Requested" },
  { filter: "ACTIVE" },
  { filter: "__proto__" },
  { selectedId: 123 },
  { selectedId: "missing" },
  { selectedId: "__proto__" },
  { selectedId: owner.id },
] as unknown as Array<Partial<ServiceRequestView>>)
  assert.equal(updateServiceRequestView(allViews, "tenant", patch), allViews);
const partiallyValid = updateServiceRequestView(allViews, "tenant", {
  query: 123,
  filter: "history",
  selectedId: owner.id,
} as unknown as Partial<ServiceRequestView>);
assert.deepEqual(serviceRequestView(partiallyValid, "tenant"), {
  query: "  cozinha elétrica  ",
  filter: "history",
  selectedId: own.id,
});
const clearedSelection = updateServiceRequestView(partiallyValid, "tenant", {
  selectedId: null,
});
assert.deepEqual(serviceRequestView(clearedSelection, "tenant"), {
  query: "  cozinha elétrica  ",
  filter: "history",
  selectedId: null,
});
assert.equal(
  updateServiceRequestView(allViews, "provider", { selectedId: foreign.id }),
  allViews,
);
assert.equal(
  updateServiceRequestView(allViews, "landlord", { selectedId: own.id }),
  allViews,
);
for (const role of [
  "admin",
  "spaceOperator",
  "guest",
  "__proto__",
] as unknown as Role[]) {
  assert.deepEqual(serviceRequestView(allViews, role), defaultView);
  assert.equal(
    updateServiceRequestView(allViews, role, {
      query: "leak",
      filter: "all",
      selectedId: own.id,
    }),
    allViews,
  );
  assert.equal(selectServiceRequest(allViews, role, own.id), allViews);
}

// Direct row selection preserves context. Deliberate reveal clears search and chooses the matching list.
const statuses: ServiceRequestStatus[] = [
  "Requested",
  "Quoted",
  "Accepted",
  "Declined",
  "In progress",
  "Cancelled",
  "Completed",
  "Provider declined",
];
const mixed: ServiceRequestState = {
  ...allViews,
  records: statuses.map((status, index) => ({
    ...own,
    id: `view-record-${index}`,
    status,
  })),
};
for (const target of mixed.records) {
  const terminal = ["Cancelled", "Completed", "Provider declined"].includes(
    target.status,
  );
  for (const filter of ["active", "history", "all"] as const) {
    const filtered = updateServiceRequestView(mixed, "tenant", {
      query: "does not match",
      filter,
      selectedId: null,
    });
    const rowSelected = updateServiceRequestView(filtered, "tenant", {
      selectedId: target.id,
    });
    assert.deepEqual(serviceRequestView(rowSelected, "tenant"), {
      query: "does not match",
      filter,
      selectedId: target.id,
    });
    const revealed = selectServiceRequest(filtered, "tenant", target.id);
    assert.deepEqual(serviceRequestView(revealed, "tenant"), {
      query: "",
      filter: filter === "all" ? "all" : terminal ? "history" : "active",
      selectedId: target.id,
    });
    assert.equal(revealed.views.provider, filtered.views.provider);
    assert.equal(revealed.views.landlord, filtered.views.landlord);
    assert.equal(revealed.records, filtered.records);
    assert.equal(selectServiceRequest(revealed, "tenant", target.id), revealed);
  }
}
assert.equal(selectServiceRequest(allViews, "tenant", owner.id), allViews);
assert.equal(selectServiceRequest(allViews, "provider", foreign.id), allViews);
assert.equal(selectServiceRequest(allViews, "tenant", "missing"), allViews);

const quoteDraft = {
  amount: "120.50",
  scope:
    "Inspect and replace the defective outlet with all agreed materials included.",
  date: "2032-05-14",
  time: "10:00",
  validUntil: "2032-05-13",
};
const withPrivateDrafts = updateServiceActionNote(
  updateServiceQuoteDraft(allViews, "provider", own.id, quoteDraft),
  "provider",
  own.id,
  "Private provider note",
);
const navigationOnly = selectServiceRequest(
  updateServiceRequestView(withPrivateDrafts, "provider", {
    query: "another search",
    filter: "all",
    selectedId: owner.id,
  }),
  "tenant",
  own.id,
);
assert.equal(navigationOnly.quoteDrafts, withPrivateDrafts.quoteDrafts);
assert.equal(navigationOnly.actionNotes, withPrivateDrafts.actionNotes);
assert.equal(navigationOnly.drafts, withPrivateDrafts.drafts);
assert.equal(navigationOnly.quoteDrafts[own.id].amount, quoteDraft.amount);
assert.equal(
  navigationOnly.actionNotes.provider[own.id],
  "Private provider note",
);

// Only a successful terminal action hands the acting workspace to that exact History record.
function assertTerminalView(
  before: ServiceRequestState,
  role: "tenant" | "provider",
  action: ServiceRequestAction,
) {
  const result = actOnServiceRequest(before, role, own.id, action, later);
  assert.notEqual(result, before);
  assert.deepEqual(serviceRequestView(result, role), {
    query: "",
    filter: "history",
    selectedId: own.id,
  });
  for (const otherRole of scopedRoles.filter((candidate) => candidate !== role))
    assert.equal(result.views[otherRole], before.views[otherRole]);
  assert.equal(result.quoteDrafts, before.quoteDrafts);
  assert.equal(result.drafts, before.drafts);
  assert.equal(
    visibleServiceRequests(result, role).some((item) => item.id === own.id),
    true,
  );
  assert.equal(
    actOnServiceRequest(result, role, own.id, action, later),
    result,
  );
  return result;
}
const refused = assertTerminalView(withPrivateDrafts, "provider", {
  type: "decline-request",
  note: "Cannot provide this work",
});
assert.equal(getRecord(refused, own.id).status, "Provider declined");
assert.deepEqual(
  serviceRequestView(refused, "tenant"),
  serviceRequestView(withPrivateDrafts, "tenant"),
);
const cancelled = assertTerminalView(withPrivateDrafts, "tenant", {
  type: "cancel",
  note: "The work is no longer needed",
});
assert.equal(getRecord(cancelled, own.id).status, "Cancelled");
const quotedResult = saveServiceQuote(
  withPrivateDrafts,
  "provider",
  own.id,
  now,
);
assert.deepEqual(quotedResult.errors, {});
assert.equal(quotedResult.issue, undefined);
const quoted = quotedResult.state;
assert.equal(quoted.views, withPrivateDrafts.views);
const quoteId = latestServiceQuote(getRecord(quoted, own.id))!.id;
const accepted = actOnServiceRequest(
  quoted,
  "tenant",
  own.id,
  { type: "accept", quoteId },
  now,
);
assert.equal(accepted.views, quoted.views);
const started = actOnServiceRequest(
  accepted,
  "provider",
  own.id,
  { type: "start" },
  now,
);
assert.equal(started.views, accepted.views);
const completed = assertTerminalView(started, "provider", {
  type: "complete",
  note: "Repair completed with the customer",
});
assert.equal(getRecord(completed, own.id).status, "Completed");
const quoteDeclined = actOnServiceRequest(
  quoted,
  "tenant",
  own.id,
  { type: "decline", quoteId, note: "Please offer a later time" },
  later,
);
assert.equal(getRecord(quoteDeclined, own.id).status, "Declined");
assert.equal(
  quoteDeclined.views,
  quoted.views,
  "Declining a quote is still active negotiation and must not force History",
);
for (const [state, role, action] of [
  [withPrivateDrafts, "provider", { type: "decline-request", note: "x" }],
  [
    withPrivateDrafts,
    "tenant",
    { type: "decline-request", note: "Not my provider action" },
  ],
  [
    quoted,
    "provider",
    { type: "decline-request", note: "Request was already quoted" },
  ],
  [quoted, "tenant", { type: "accept", quoteId: "outdated" }],
  [
    withPrivateDrafts,
    "provider",
    { type: "complete", note: "Has not started" },
  ],
  [completed, "provider", { type: "start" }],
] as Array<[ServiceRequestState, Role, ServiceRequestAction]>)
  assert.equal(actOnServiceRequest(state, role, own.id, action, later), state);
assert.equal(
  actOnServiceRequest(
    withPrivateDrafts,
    "provider",
    "missing",
    { type: "decline-request", note: "No target" },
    later,
  ),
  withPrivateDrafts,
);

// Explicit customer submission reveals only its newly created request; invalid saves never jump views.
const requestDraft: ServiceRequestDraft = {
  propertyId: "1",
  category: "Electrical",
  providerName: workspaceServiceProvider,
  title: "Inspect a loose socket",
  description:
    "Please inspect the loose socket and provide a quote before starting work.",
  preferredDate: "2032-05-15",
  preferredTime: "11:00",
};
for (const role of ["tenant", "landlord"] as const) {
  const pending = updateServiceRequestDraft(
    withPrivateDrafts,
    role,
    requestDraft,
    workspaceServiceProvider,
  );
  assert.equal(pending.views, withPrivateDrafts.views);
  const result = saveServiceRequest(
    pending,
    role,
    workspaceServiceProvider,
    later,
  );
  assert.ok(result.requestId);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(serviceRequestView(result.state, role), {
    query: "",
    filter: "active",
    selectedId: result.requestId,
  });
  for (const otherRole of scopedRoles.filter((candidate) => candidate !== role))
    assert.equal(result.state.views[otherRole], pending.views[otherRole]);
  assert.equal(result.state.quoteDrafts, pending.quoteDrafts);
  assert.equal(result.state.actionNotes, pending.actionNotes);
  assert.equal(getRecord(result.state, result.requestId).customerRole, role);
  assert.equal(
    saveServiceRequest(result.state, role, workspaceServiceProvider, later)
      .state,
    result.state,
  );
}
assert.equal(
  saveServiceRequest(
    withPrivateDrafts,
    "tenant",
    workspaceServiceProvider,
    later,
  ).state,
  withPrivateDrafts,
);
const freshAgain = createInitialServiceRequestState(now);
for (const role of scopedRoles)
  assert.deepEqual(serviceRequestView(freshAgain, role), defaultView);

console.log(
  "Service request view checks passed: fresh default views, role isolation, detached reads, guarded retained query/filter/selection, deliberate record reveal, independent drafts and actor-only creation/terminal history handoff.",
);
