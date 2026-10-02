import assert from "node:assert/strict";
import {
  applicationCompleteness,
  createInitialApplicationState,
  submitRentalApplication,
  tenantApplicationForProperty,
  updateApplication,
  visibleApplicationRecords,
} from "../src/components/applicationState";
import { properties } from "../src/data";
import type { RentalApplicationDraft } from "../src/components/propertyRequestState";

const initial = createInitialApplicationState();
const fixedTime = new Date("2026-10-02T12:00:00Z");
assert.deepEqual(
  visibleApplicationRecords(initial, "tenant").map(
    (record) => record.applicant,
  ),
  ["Inês Duarte"],
);
assert.equal(visibleApplicationRecords(initial, "provider").length, 0);
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
  visibleApplicationRecords(submitted, "landlord").some(
    (record) => record.id === newRecord.id,
  ),
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
console.log(
  "Application state checks passed: explicit owner actions, tenant visibility, immutable records, document requests, local history, validated tenant submissions and duplicate prevention.",
);
