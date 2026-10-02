import assert from "node:assert/strict";
import {
  applicationCompleteness,
  canReviewApplication,
  createInitialApplicationState,
  submitRentalApplication,
  tenantApplicationForProperty,
  updateApplication,
  visibleApplicationRecords,
} from "../src/components/applicationState";
import { properties } from "../src/data";
import {
  ownedProperties,
  ownsProperty,
  workspaceLandlordName,
} from "../src/propertyScope";
import type { RentalApplicationDraft } from "../src/components/propertyRequestState";

const initial = createInitialApplicationState();
const fixedTime = new Date("2026-10-02T12:00:00Z");
assert.equal(workspaceLandlordName, "Olivia Martín");
assert.deepEqual(
  ownedProperties("landlord").map((property) => property.id),
  [1],
);
assert.equal(ownsProperty("landlord", 1), true);
assert.equal(ownsProperty("landlord", 2), false);
assert.equal(ownsProperty("landlord", 999), false);
for (const role of ["tenant", "provider", "spaceOperator", "admin"] as const) {
  assert.deepEqual(ownedProperties(role), []);
  assert.equal(ownsProperty(role, 1), false);
}
assert.deepEqual(
  visibleApplicationRecords(initial, "landlord").map((record) => record.id),
  [1, 3],
  "Owner sees applications only for their actual property",
);
assert.ok(
  initial.records.every((record) => record.propertyId !== undefined),
  "Known legacy seed property names are normalized to stable ids at creation",
);
assert.deepEqual(
  visibleApplicationRecords(initial, "tenant").map(
    (record) => record.applicant,
  ),
  ["Inês Duarte"],
);
assert.equal(visibleApplicationRecords(initial, "provider").length, 0);
assert.equal(canReviewApplication(initial.records[0], "landlord"), true);
assert.equal(canReviewApplication(initial.records[0], "tenant"), false);
assert.equal(canReviewApplication(initial.records[1], "landlord"), false);
for (const propertyId of [2, 3, 999]) {
  const foreign = { ...initial.records[0], propertyId, reviewed: true };
  const foreignState = { records: [foreign] };
  assert.deepEqual(visibleApplicationRecords(foreignState, "landlord"), []);
  assert.equal(canReviewApplication(foreign, "landlord"), false);
  for (const action of [
    { type: "mark-reviewed" as const },
    { type: "approve" as const },
    {
      type: "request-documents" as const,
      documentIds: ["income"],
      note: "Please update this file.",
    },
  ]) {
    const actionableForeignState = {
      records: [{ ...foreign, reviewed: action.type === "approve" }],
    };
    assert.equal(
      updateApplication(
        actionableForeignState,
        foreign.id,
        "landlord",
        action,
        fixedTime,
      ),
      actionableForeignState,
      "Foreign or unknown property ids block every owner action even when the title matches an owned property",
    );
  }
}
assert.equal(applicationCompleteness(initial.records[0]), 100);
assert.equal(applicationCompleteness(initial.records[3]), 60);
assert.equal(
  applicationCompleteness({ ...initial.records[0], profileFields: [] }),
  0,
);

assert.equal(
  updateApplication(initial, 1, "tenant", { type: "mark-reviewed" }, fixedTime),
  initial,
  "Tenant cannot change owner review state",
);
assert.equal(
  updateApplication(initial, 1, "landlord", { type: "approve" }, fixedTime),
  initial,
  "Approval needs a preceding explicit review",
);
assert.equal(
  updateApplication(
    initial,
    4,
    "landlord",
    { type: "mark-reviewed" },
    fixedTime,
  ),
  initial,
  "Unsubmitted drafts cannot be reviewed",
);
assert.equal(
  updateApplication(
    initial,
    3,
    "landlord",
    { type: "request-documents", documentIds: ["income"], note: "" },
    fixedTime,
  ),
  initial,
  "Approved applications are not silently reopened",
);
assert.equal(
  updateApplication(
    initial,
    999,
    "landlord",
    { type: "mark-reviewed" },
    fixedTime,
  ),
  initial,
);
assert.equal(
  updateApplication(
    initial,
    1,
    "landlord",
    { type: "request-documents", documentIds: ["invented"], note: "" },
    fixedTime,
  ),
  initial,
  "Unrecognized documents cannot trigger a request",
);

const requested = updateApplication(
  initial,
  1,
  "landlord",
  {
    type: "request-documents",
    documentIds: ["income", "income"],
    note: "  Please add a current document.  ",
  },
  fixedTime,
);
assert.equal(requested.records[0].status, "Documents");
assert.equal(
  requested.records[0].documents.find((document) => document.id === "income")
    ?.status,
  "Requested",
);
assert.equal(
  requested.records[0].documentRequest,
  "Please add a current document.",
);
assert.equal(requested.records[0].reviewed, false);
assert.match(requested.records[0].activity.at(-1)!.label, /1 document in/);
assert.equal(
  requested.records[1],
  initial.records[1],
  "Unrelated applications are untouched",
);
assert.equal(
  initial.records[0].status,
  "Review",
  "Updates do not mutate the original state",
);
assert.equal(
  applicationCompleteness(requested.records[0]),
  100,
  "Document requests do not invent a suitability score",
);

const reviewed = updateApplication(
  requested,
  1,
  "landlord",
  { type: "mark-reviewed" },
  fixedTime,
);
assert.equal(reviewed.records[0].reviewed, true);
assert.equal(
  reviewed.records[0].status,
  "Documents",
  "Review does not automatically approve an applicant",
);
const approved = updateApplication(
  reviewed,
  1,
  "landlord",
  { type: "approve" },
  fixedTime,
);
assert.equal(approved.records[0].status, "Approved");
assert.equal(
  approved.records[0].activity.length,
  initial.records[0].activity.length + 3,
);
assert.equal(
  new Set(approved.records[0].activity.map((event) => event.id)).size,
  approved.records[0].activity.length,
);
assert.equal(
  updateApplication(approved, 1, "landlord", { type: "approve" }, fixedTime),
  approved,
  "Repeated approval is a no-op",
);
assert.equal(
  createInitialApplicationState().records[0].status,
  "Review",
  "A fresh session has independent sample state",
);
const rental = properties.find((property) => property.id === 2)!;
const submission: RentalApplicationDraft = {
  moveInDate: "2026-10-20",
  householdSize: 2,
  introduction: "  Move-in date is flexible.  ",
};
const submitted = submitRentalApplication(
  initial,
  "tenant",
  rental,
  submission,
  fixedTime,
);
const newRecord = tenantApplicationForProperty(submitted, rental)!;
assert.equal(submitted.records.length, initial.records.length + 1);
assert.equal(newRecord.propertyId, rental.id);
assert.equal(newRecord.tenantId, "tenant-ines");
assert.equal(newRecord.applicant, "Inês Duarte");
assert.equal(newRecord.status, "Review");
assert.equal(
  newRecord.reviewed,
  false,
  "A local submission must not review or approve itself",
);
assert.deepEqual(newRecord.submission, {
  moveInDate: "2026-10-20",
  householdSize: 2,
  introduction: "Move-in date is flexible.",
});
assert.ok(
  newRecord.documents.every((document) => document.status === "Missing"),
  "Creation must not invent supplied or verified documents",
);
assert.match(newRecord.activity[0].label, /not sent/);
assert.ok(
  visibleApplicationRecords(submitted, "tenant").some(
    (record) => record.id === newRecord.id,
  ),
);
assert.ok(
  !visibleApplicationRecords(submitted, "landlord").some(
    (record) => record.id === newRecord.id,
  ),
  "An application to Nuno's listing is not exposed to Olivia",
);
assert.equal(
  updateApplication(
    submitted,
    newRecord.id,
    "landlord",
    { type: "mark-reviewed" },
    fixedTime,
  ),
  submitted,
);
assert.equal(
  initial.records.length,
  4,
  "Submission leaves the previous state unchanged",
);
assert.equal(
  submitRentalApplication(submitted, "tenant", rental, submission, fixedTime),
  submitted,
  "The same tenant cannot create duplicate applications for one property",
);
assert.equal(
  submitRentalApplication(
    submitted,
    "tenant",
    { ...rental, title: "Renamed property" },
    submission,
    fixedTime,
  ),
  submitted,
  "Duplicate detection uses stable property identity",
);
assert.equal(
  submitRentalApplication(
    initial,
    "tenant",
    properties[0],
    submission,
    fixedTime,
  ),
  initial,
  "Existing seed applications are reused, never overwritten",
);
for (const role of [
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
] as const) {
  assert.equal(
    submitRentalApplication(initial, role, rental, submission, fixedTime),
    initial,
    "Non-tenants cannot submit as the sample tenant",
  );
}
assert.equal(
  submitRentalApplication(
    initial,
    "tenant",
    properties.find((property) => property.listingType === "Buy")!,
    submission,
    fixedTime,
  ),
  initial,
  "Sale properties do not create rental applications",
);
for (const invalid of [
  { ...submission, moveInDate: "2026-09-01" },
  { ...submission, moveInDate: "2026-02-30" },
  { ...submission, householdSize: 0 },
  { ...submission, householdSize: 1.5 },
  { ...submission, householdSize: Number.NaN },
  { ...submission, introduction: "x".repeat(1001) },
])
  assert.equal(
    submitRentalApplication(initial, "tenant", rental, invalid, fixedTime),
    initial,
    "Invalid submissions must not create records",
  );
assert.equal(
  submitRentalApplication(
    initial,
    "tenant",
    rental,
    { ...submission, introduction: "" },
    fixedTime,
  ).records.at(-1)?.submission?.introduction,
  "",
  "Introduction remains optional",
);

const conflictingIdentity = {
  ...initial.records[2],
  tenantId: "different-tenant-id",
};
const conflictingState = { records: [conflictingIdentity] };
assert.deepEqual(
  visibleApplicationRecords(conflictingState, "tenant"),
  [],
  "A matching display name must not override a conflicting tenant id",
);
assert.equal(
  tenantApplicationForProperty(conflictingState, properties[0]),
  undefined,
);
const afterNameCollision = submitRentalApplication(
  conflictingState,
  "tenant",
  properties[0],
  submission,
  fixedTime,
);
assert.equal(
  afterNameCollision.records.length,
  2,
  "Another person's matching display name does not block a legitimate application",
);
assert.equal(visibleApplicationRecords(afterNameCollision, "tenant").length, 1);
assert.equal(
  submitRentalApplication(
    afterNameCollision,
    "tenant",
    properties[0],
    submission,
    fixedTime,
  ),
  afterNameCollision,
  "Stable tenant identity still prevents duplicate applications",
);
assert.deepEqual(
  visibleApplicationRecords(
    { records: [{ ...conflictingIdentity, tenantId: "" }] },
    "tenant",
  ),
  [],
  "An explicitly empty tenant id is not treated as a legacy absence",
);

const renamedTenant = {
  ...initial.records[2],
  applicant: "Updated display name",
};
assert.deepEqual(
  visibleApplicationRecords({ records: [renamedTenant] }, "tenant"),
  [renamedTenant],
);
assert.equal(
  tenantApplicationForProperty({ records: [renamedTenant] }, properties[0]),
  renamedTenant,
);
const conflictingPropertyId = { ...renamedTenant, propertyId: 2 };
assert.equal(
  tenantApplicationForProperty(
    { records: [conflictingPropertyId] },
    properties[0],
  ),
  undefined,
  "A legacy property title cannot override a conflicting stable property id",
);
const legacy = {
  ...initial.records[2],
  tenantId: undefined,
  propertyId: undefined,
};
assert.deepEqual(visibleApplicationRecords({ records: [legacy] }, "tenant"), [
  legacy,
]);
assert.equal(
  tenantApplicationForProperty({ records: [legacy] }, properties[0]),
  legacy,
);
assert.deepEqual(
  visibleApplicationRecords({ records: [legacy] }, "landlord"),
  [],
  "Unknown property identity fails closed for owner access",
);

const withoutExistingTenantApplication = {
  records: initial.records.filter((record) => record.id !== 3),
};
const legitimateSubmission = submitRentalApplication(
  withoutExistingTenantApplication,
  "tenant",
  properties[0],
  submission,
  fixedTime,
);
const legitimateRecord = tenantApplicationForProperty(
  legitimateSubmission,
  properties[0],
)!;
assert(
  visibleApplicationRecords(legitimateSubmission, "landlord").some(
    (record) => record.id === legitimateRecord.id,
  ),
);
assert(canReviewApplication(legitimateRecord, "landlord"));
const legitimateReviewed = updateApplication(
  legitimateSubmission,
  legitimateRecord.id,
  "landlord",
  { type: "mark-reviewed" },
  fixedTime,
);
const legitimateApproved = updateApplication(
  legitimateReviewed,
  legitimateRecord.id,
  "landlord",
  { type: "approve" },
  fixedTime,
);
assert.equal(
  tenantApplicationForProperty(legitimateApproved, properties[0])?.status,
  "Approved",
  "The actual listing owner and applicant share the legitimate workflow",
);
console.log(
  "Application state checks passed: actual listing ownership, authoritative tenant/property ids, explicit owner actions, immutable records, legitimate submissions and duplicate prevention.",
);
