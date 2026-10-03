import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  applicationEvidenceDraft,
  applicationPropertyOptions,
  applicationView,
  createInitialApplicationState,
  discardRentalApplicationDraft,
  rentalApplicationDraft,
  resetApplicationView,
  revealApplication,
  submitApplicationEvidence,
  submitRentalApplicationDraft,
  updateApplication,
  updateApplicationEvidenceNote,
  updateApplicationView,
  updateRentalApplicationDraft,
  visibleApplicationRecords,
  type ApplicationState,
  type ApplicationView,
} from "../src/components/applicationState";

const now = new Date(2032, 4, 10, 12);
const initial = createInitialApplicationState();
const defaults: ApplicationView = {
  query: "",
  status: "All",
  property: "All properties",
  completeness: "Any completeness",
  sort: "Newest submitted",
};
const workspaceRoles = ["tenant", "landlord"] as const;
const unsupportedRoles: Role[] = ["provider", "spaceOperator", "admin"];
const own = visibleApplicationRecords(initial, "tenant")[0];
const ownerOnly = visibleApplicationRecords(initial, "landlord").find(
  (record) => record.id !== own.id,
)!;
assert.ok(own && ownerOnly);

// Factories and legacy record-only states expose independent scalar copies without storing read defaults.
const fresh = createInitialApplicationState();
const legacy: ApplicationState = { records: initial.records };
for (const role of workspaceRoles) {
  assert.deepEqual(applicationView(initial, role), defaults);
  assert.deepEqual(applicationView(legacy, role), defaults);
  assert.notEqual(initial.views?.[role], fresh.views?.[role]);
  const detached = applicationView(initial, role);
  detached.query = "External mutation";
  detached.status = "Draft";
  assert.deepEqual(applicationView(initial, role), defaults);
  assert.equal(updateApplicationView(initial, role, defaults), initial);
  assert.equal(updateApplicationView(initial, role, {}), initial);
  assert.equal(resetApplicationView(initial, role), initial);
}
assert.notEqual(initial.views?.tenant, initial.views?.landlord);
assert.equal(legacy.views, undefined);
assert.equal(updateApplicationView(legacy, "tenant", defaults), legacy);
const legacyChanged = updateApplicationView(legacy, "tenant", {
  query: "Legacy retained",
});
assert.equal(applicationView(legacyChanged, "tenant").query, "Legacy retained");
assert.deepEqual(applicationView(legacyChanged, "landlord"), defaults);
assert.equal(legacyChanged.records, legacy.records);

// All supported choices are validated independently, and raw query whitespace is kept within its bound.
const patch: Partial<ApplicationView> = {
  query: "  Inês · Eixample  ",
  status: "Approved",
  property: "1",
  completeness: "80",
  sort: "Oldest submitted",
};
const tenantChanged = updateApplicationView(initial, "tenant", patch);
patch.query = "Caller mutation";
assert.deepEqual(applicationView(tenantChanged, "tenant"), {
  query: "  Inês · Eixample  ",
  status: "Approved",
  property: "1",
  completeness: "80",
  sort: "Oldest submitted",
});
assert.equal(tenantChanged.records, initial.records);
assert.equal(tenantChanged.rentalDrafts, initial.rentalDrafts);
assert.equal(tenantChanged.evidenceDrafts, initial.evidenceDrafts);
assert.equal(tenantChanged.views?.landlord, initial.views?.landlord);
const both = updateApplicationView(tenantChanged, "landlord", {
  query: "Owner private filters",
  status: "Review",
  property: "1",
  completeness: "100",
  sort: "Action required first",
});
assert.deepEqual(
  applicationView(both, "tenant"),
  applicationView(tenantChanged, "tenant"),
);
assert.equal(
  updateApplicationView(both, "tenant", applicationView(both, "tenant")),
  both,
);
for (const status of [
  "All",
  "Review",
  "Documents",
  "Approved",
  "Draft",
] as const)
  assert.equal(
    applicationView(updateApplicationView(both, "tenant", { status }), "tenant")
      .status,
    status,
  );
for (const completeness of ["Any completeness", "80", "100"] as const)
  assert.equal(
    applicationView(
      updateApplicationView(both, "tenant", { completeness }),
      "tenant",
    ).completeness,
    completeness,
  );
for (const sort of [
  "Newest submitted",
  "Oldest submitted",
  "Most complete",
  "Action required first",
] as const)
  assert.equal(
    applicationView(updateApplicationView(both, "tenant", { sort }), "tenant")
      .sort,
    sort,
  );
for (const invalid of [
  { query: 5 },
  { query: null },
  { status: "approved" },
  { status: "Declined" },
  { completeness: 80 },
  { completeness: "90" },
  { sort: "Newest" },
  { property: "01" },
  { property: "1.0" },
  { property: "1e0" },
  { property: " 1 " },
  { property: 1 },
  { property: "2" },
  { property: "999" },
  { property: "__proto__" },
  { unknown: "ignored" },
] as unknown as Array<Partial<ApplicationView>>)
  assert.equal(updateApplicationView(both, "tenant", invalid), both);
const mixed = updateApplicationView(both, "tenant", {
  query: "  Valid raw text ",
  status: "Wrong",
  property: "999",
  completeness: "100",
  sort: "Most complete",
} as unknown as Partial<ApplicationView>);
assert.deepEqual(applicationView(mixed, "tenant"), {
  query: "  Valid raw text ",
  status: "Approved",
  property: "1",
  completeness: "100",
  sort: "Most complete",
});
const capped = updateApplicationView(both, "tenant", {
  query: "x".repeat(220),
});
assert.equal(applicationView(capped, "tenant").query, "x".repeat(200));
assert.equal(
  updateApplicationView(capped, "tenant", { query: "x".repeat(250) }),
  capped,
);
assert.equal(
  applicationView(
    updateApplicationView(capped, "tenant", { query: "" }),
    "tenant",
  ).query,
  "",
);
assert.equal(
  applicationView(
    updateApplicationView(capped, "tenant", { query: "one " }),
    "tenant",
  ).query,
  "one ",
);

// Unsupported workspaces never read or mutate another role's view or reveal their records.
for (const role of unsupportedRoles) {
  const detached = applicationView(both, role);
  assert.deepEqual(detached, defaults);
  detached.query = "No retained access";
  assert.deepEqual(applicationView(both, role), defaults);
  assert.deepEqual(applicationPropertyOptions(both, role), []);
  assert.equal(
    updateApplicationView(both, role, { query: "Foreign", property: "1" }),
    both,
  );
  assert.equal(resetApplicationView(both, role), both);
  assert.equal(revealApplication(both, role, own.id), both);
}
for (const role of workspaceRoles) {
  const options = applicationPropertyOptions(initial, role);
  assert.deepEqual(
    options.map((property) => property.id),
    [1],
  );
  options[0].title = "Cannot mutate source labels";
  options.push({ id: 999, title: "Cannot add a scoped option" });
  assert.deepEqual(
    applicationPropertyOptions(initial, role).map((property) => property.id),
    [1],
  );
  assert.notEqual(
    applicationPropertyOptions(initial, role)[0].title,
    "Cannot mutate source labels",
  );
}
assert.deepEqual(applicationPropertyOptions({ records: [] }, "tenant"), []);
for (const propertyId of [999, null as unknown as number]) {
  const invalidProperty = { records: [{ ...own, propertyId }] };
  assert.deepEqual(applicationPropertyOptions(invalidProperty, "tenant"), []);
  assert.equal(
    updateApplicationView(invalidProperty, "tenant", { property: "1" }),
    invalidProperty,
  );
}
const legacyProperty = { records: [{ ...own, propertyId: undefined }] };
assert.deepEqual(
  applicationPropertyOptions(legacyProperty, "tenant").map(
    (property) => property.id,
  ),
  [1],
);
assert.deepEqual(applicationPropertyOptions(legacyProperty, "landlord"), []);
const conflictingProperty = { records: [{ ...own, propertyId: 2 }] };
assert.deepEqual(
  applicationPropertyOptions(conflictingProperty, "tenant").map(
    (property) => property.id,
  ),
  [2],
);
assert.equal(
  updateApplicationView(conflictingProperty, "tenant", { property: "1" }),
  conflictingProperty,
);
assert.deepEqual(
  applicationPropertyOptions(conflictingProperty, "landlord"),
  [],
);
const foreignTenant = { records: [{ ...own, tenantId: "other-tenant" }] };
assert.deepEqual(applicationPropertyOptions(foreignTenant, "tenant"), []);
assert.equal(revealApplication(foreignTenant, "tenant", own.id), foreignTenant);

// Reset restores all five defaults only for its actor; reveal clears constraints while preserving chosen sort.
const reset = resetApplicationView(both, "tenant");
assert.deepEqual(applicationView(reset, "tenant"), defaults);
assert.equal(reset.views?.landlord, both.views?.landlord);
assert.equal(reset.records, both.records);
assert.equal(resetApplicationView(reset, "tenant"), reset);
for (const role of workspaceRoles) {
  const revealed = revealApplication(both, role, own.id);
  assert.deepEqual(applicationView(revealed, role), {
    ...defaults,
    sort: applicationView(both, role).sort,
  });
  assert.equal(revealed.records, both.records);
  const other = role === "tenant" ? "landlord" : "tenant";
  assert.equal(revealed.views?.[other], both.views?.[other]);
  assert.equal(revealApplication(revealed, role, own.id), revealed);
  assert.equal(revealApplication(both, role, 999), both);
  assert.equal(
    revealApplication(both, role, String(own.id) as unknown as number),
    both,
  );
}
assert.equal(revealApplication(both, "tenant", ownerOnly.id), both);

// New local submissions remain private until saved and can then be deliberately revealed despite stale constraints.
let retained = updateRentalApplicationDraft(
  both,
  "tenant",
  2,
  {
    moveInDate: "2032-05-20",
    householdSize: "2",
    introduction: "A local application with retained view preferences.",
  },
  now,
);
retained = updateRentalApplicationDraft(
  retained,
  "tenant",
  3,
  { moveInDate: "", householdSize: "", introduction: "Other unsent draft" },
  now,
);
assert.equal(retained.views, both.views);
const evidenceRequested = updateApplication(
  retained,
  own.id,
  "landlord",
  {
    type: "request-documents",
    documentIds: ["income"],
    note: "Please provide an explanatory response.",
  },
  now,
);
retained = updateApplicationEvidenceNote(
  evidenceRequested,
  "tenant",
  own.id,
  "Retained explanatory evidence note.",
);
assert.equal(retained.views, both.views);
assert.equal(
  discardRentalApplicationDraft(retained, "tenant", 3).views,
  both.views,
);
const invalidSubmit = submitRentalApplicationDraft(retained, "tenant", 3, now);
assert.equal(invalidSubmit.state, retained);
assert.equal(invalidSubmit.applicationId, null);
const saved = submitRentalApplicationDraft(retained, "tenant", 2, now);
assert.ok(saved.applicationId);
assert.equal(saved.state.views, retained.views);
assert.deepEqual(
  applicationPropertyOptions(saved.state, "tenant")
    .map((property) => property.id)
    .sort(),
  [1, 2],
);
assert.deepEqual(
  applicationPropertyOptions(saved.state, "landlord").map(
    (property) => property.id,
  ),
  [1],
);
const filteredNew = updateApplicationView(saved.state, "tenant", {
  query: "No match",
  status: "Draft",
  property: "1",
  completeness: "100",
  sort: "Most complete",
});
const viewWithNewProperty = updateApplicationView(filteredNew, "tenant", {
  property: "2",
});
assert.equal(applicationView(viewWithNewProperty, "tenant").property, "2");
assert.equal(
  updateApplicationView(filteredNew, "landlord", { property: "2" }),
  filteredNew,
);
const newRevealed = revealApplication(
  filteredNew,
  "tenant",
  saved.applicationId,
);
assert.deepEqual(applicationView(newRevealed, "tenant"), {
  ...defaults,
  sort: "Most complete",
});
assert.ok(
  visibleApplicationRecords(newRevealed, "tenant").some(
    (record) => record.id === saved.applicationId,
  ),
);
assert.equal(
  revealApplication(filteredNew, "landlord", saved.applicationId),
  filteredNew,
);
assert.equal(newRevealed.records, filteredNew.records);
assert.equal(newRevealed.evidenceDrafts, filteredNew.evidenceDrafts);
assert.equal(newRevealed.rentalDrafts, filteredNew.rentalDrafts);
assert.equal(newRevealed.views?.landlord, filteredNew.views?.landlord);
assert.deepEqual(
  rentalApplicationDraft(newRevealed, "tenant", 3, now),
  rentalApplicationDraft(filteredNew, "tenant", 3, now),
);

// Record decisions, evidence updates and form submission never silently replace retained views.
const reviewed = updateApplication(
  newRevealed,
  ownerOnly.id,
  "landlord",
  { type: "mark-reviewed" },
  now,
);
assert.notEqual(reviewed, newRevealed);
assert.equal(reviewed.views, newRevealed.views);
const approved = updateApplication(
  reviewed,
  ownerOnly.id,
  "landlord",
  { type: "approve" },
  now,
);
assert.equal(approved.views, reviewed.views);
const draft = applicationEvidenceDraft(approved, "tenant", own.id)!;
const responded = submitApplicationEvidence(
  approved,
  "tenant",
  own.id,
  draft.revision,
  draft.requestId,
  now,
);
assert.ok(responded.responseId);
assert.equal(responded.state.views, approved.views);
const acknowledged = updateApplication(
  responded.state,
  own.id,
  "landlord",
  { type: "acknowledge-evidence", responseId: responded.responseId },
  now,
);
assert.equal(acknowledged.views, responded.state.views);
const resetWithDrafts = resetApplicationView(acknowledged, "tenant");
assert.equal(resetWithDrafts.rentalDrafts, acknowledged.rentalDrafts);
assert.equal(resetWithDrafts.evidenceDrafts, acknowledged.evidenceDrafts);
assert.equal(resetWithDrafts.records, acknowledged.records);
assert.equal(resetWithDrafts.views?.landlord, acknowledged.views?.landlord);
assert.deepEqual(
  applicationView(createInitialApplicationState(), "tenant"),
  defaults,
);
assert.deepEqual(applicationView(initial, "tenant"), defaults);

console.log(
  "Application view checks passed: detached scoped preferences, validated raw filters, independent reset/reveal, canonical property options and draft/record preservation.",
);
