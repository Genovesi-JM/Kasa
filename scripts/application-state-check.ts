import assert from "node:assert/strict";
import {
  applicationCompleteness,
  createInitialApplicationState,
  updateApplication,
  visibleApplicationRecords,
} from "../src/components/applicationState";

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
console.log(
  "Application state checks passed: explicit owner actions, tenant visibility, immutable records, document requests and local history.",
);
