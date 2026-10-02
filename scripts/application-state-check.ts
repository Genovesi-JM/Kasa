import assert from "node:assert/strict";
import {
  applicationCompleteness,
  canReviewApplication,
  createInitialApplicationState,
  submitRentalApplication,
  tenantApplicationForProperty,
  updateApplication,
  visibleApplicationRecords,
  addApplicationEvidenceFiles,
  applicationEvidenceBytes,
  applicationEvidenceDraft,
  applicationEvidenceSummary,
  canRequestApplicationEvidence,
  canRespondApplicationEvidence,
  discardApplicationEvidenceDraft,
  MAX_APPLICATION_EVIDENCE_BYTES,
  MAX_APPLICATION_EVIDENCE_FILES,
  MAX_APPLICATION_EVIDENCE_NOTE,
  removeApplicationEvidenceFile,
  submitApplicationEvidence,
  updateApplicationEvidenceNote,
  type ApplicationState,
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
const approvedFollowup = updateApplication(
  initial,
  3,
  "landlord",
  { type: "request-documents", documentIds: ["income"], note: "" },
  fixedTime,
);
assert.equal(
  approvedFollowup.records[2].status,
  "Approved",
  "Evidence follow-up does not reopen approval",
);
assert.equal(approvedFollowup.records[2].reviewed, true);
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
const evidenceRecord = (state: ApplicationState, id = 3) =>
  state.records.find((record) => record.id === id)!;
const submitDraft = (state: ApplicationState, id = 3) => {
  const draft = applicationEvidenceDraft(state, "tenant", id)!;
  return submitApplicationEvidence(
    state,
    "tenant",
    id,
    draft.revision,
    draft.requestId,
    fixedTime,
  );
};
const incomeFile = new File(
  ["Example local evidence, not a real financial record."],
  "evidence.txt",
  {
    type: "text/plain",
    lastModified: 123,
  },
);
const identityFile = new File(["%PDF-1.7 local fixture"], "identity.pdf", {
  type: "application/pdf",
  lastModified: 123,
});
assert.equal(
  canRespondApplicationEvidence(initial.records[2], "tenant"),
  false,
);
assert.equal(
  canRequestApplicationEvidence(initial.records[2], "landlord"),
  true,
);
assert.equal(
  addApplicationEvidenceFiles(
    initial,
    "tenant",
    3,
    "income",
    [incomeFile],
    fixedTime,
  ).state,
  initial,
);
assert.equal(applicationEvidenceSummary(initial.records[2]).phase, "none");
assert.equal(
  applicationEvidenceSummary(initial.records[1]).phase,
  "requested",
  "Existing sample requests receive stable revision metadata",
);

const sharedRequest = updateApplication(
  initial,
  3,
  "landlord",
  {
    type: "request-documents",
    documentIds: ["income", "identity"],
    note: "Please add updated local evidence.",
  },
  fixedTime,
);
const requestSummary = applicationEvidenceSummary(
  evidenceRecord(sharedRequest),
);
const requestId = requestSummary.latestRequest!.id;
assert.equal(requestSummary.requestOpen, true);
assert.equal(requestSummary.phase, "requested");
assert.deepEqual(requestSummary.outstandingDocumentIds, ["income", "identity"]);
assert.equal(evidenceRecord(sharedRequest).status, "Approved");
assert.equal(evidenceRecord(sharedRequest).reviewed, true);
assert.equal(
  canRespondApplicationEvidence(evidenceRecord(sharedRequest), "tenant"),
  true,
);
assert.equal(
  canReviewApplication(evidenceRecord(sharedRequest), "landlord"),
  false,
);
assert.equal(
  updateApplication(
    sharedRequest,
    3,
    "landlord",
    {
      type: "request-documents",
      documentIds: ["identity", "income"],
      note: "Please add updated local evidence.",
    },
    fixedTime,
  ),
  sharedRequest,
  "Repeated identical request with no response is idempotent",
);

for (const role of [
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
] as const) {
  assert.equal(applicationEvidenceDraft(sharedRequest, role, 3), null);
  assert.equal(
    canRespondApplicationEvidence(evidenceRecord(sharedRequest), role),
    false,
  );
  assert.equal(
    updateApplicationEvidenceNote(sharedRequest, role, 3, "Private draft"),
    sharedRequest,
  );
  assert.equal(
    addApplicationEvidenceFiles(sharedRequest, role, 3, "income", [incomeFile])
      .state,
    sharedRequest,
  );
  assert.equal(
    submitApplicationEvidence(sharedRequest, role, 3, 0, requestId).state,
    sharedRequest,
  );
  assert.equal(
    discardApplicationEvidenceDraft(sharedRequest, role, 3),
    sharedRequest,
  );
}
for (const id of [1, 2, 4, 999]) {
  assert.equal(
    applicationEvidenceDraft(sharedRequest, "tenant", id),
    null,
    "Another applicant's draft is not exposed",
  );
  assert.equal(
    addApplicationEvidenceFiles(sharedRequest, "tenant", id, "income", [
      incomeFile,
    ]).state,
    sharedRequest,
  );
}
assert.equal(
  canRespondApplicationEvidence(conflictingIdentity, "tenant"),
  false,
  "Explicit tenant id overrides matching display name",
);
assert.equal(
  canRequestApplicationEvidence(
    { ...initial.records[2], propertyId: 2 },
    "landlord",
  ),
  false,
);
assert.equal(
  canRequestApplicationEvidence(
    { ...initial.records[2], propertyId: undefined },
    "landlord",
  ),
  false,
);
assert.equal(
  canRequestApplicationEvidence(initial.records[2], "spaceOperator"),
  false,
);
assert.equal(
  canRespondApplicationEvidence(
    { ...evidenceRecord(sharedRequest), status: "Draft" },
    "tenant",
  ),
  false,
);

const emptyDraft = applicationEvidenceDraft(sharedRequest, "tenant", 3)!;
assert.equal(submitDraft(sharedRequest).issue?.code, "emptyResponse");
assert.equal(
  submitApplicationEvidence(
    sharedRequest,
    "tenant",
    3,
    emptyDraft.revision + 1,
    requestId,
  ).issue?.code,
  "staleRequest",
);
const noteDraft = updateApplicationEvidenceNote(
  sharedRequest,
  "tenant",
  3,
  "  The replacement will be available tomorrow.  ",
);
assert.equal(
  noteDraft.records,
  sharedRequest.records,
  "Draft edits do not modify owner-visible records",
);
assert.equal(applicationEvidenceDraft(noteDraft, "landlord", 3), null);
assert.equal(evidenceRecord(noteDraft).evidenceResponses, undefined);
assert.equal(
  applicationEvidenceSummary(evidenceRecord(noteDraft)).phase,
  "requested",
);
assert.equal(
  submitApplicationEvidence(
    noteDraft,
    "tenant",
    3,
    emptyDraft.revision,
    requestId,
  ).issue?.code,
  "staleRequest",
  "Old draft versions cannot submit newer edits",
);
const oversizedNote = updateApplicationEvidenceNote(
  sharedRequest,
  "tenant",
  3,
  "x".repeat(MAX_APPLICATION_EVIDENCE_NOTE + 1),
);
assert.equal(submitDraft(oversizedNote).issue?.code, "noteTooLong");
assert.equal(
  submitDraft(updateApplicationEvidenceNote(sharedRequest, "tenant", 3, "  x "))
    .issue?.code,
  "emptyResponse",
);
const noteSubmitted = submitDraft(noteDraft);
assert.equal(noteSubmitted.issue, null);
const firstResponse = evidenceRecord(noteSubmitted.state).evidenceResponses![0];
assert.equal(firstResponse.note, "The replacement will be available tomorrow.");
assert.equal(firstResponse.requestId, requestId);
assert.equal(firstResponse.files.length, 0);
assert.equal(evidenceRecord(noteSubmitted.state).status, "Approved");
assert.equal(evidenceRecord(noteSubmitted.state).reviewed, true);
assert.equal(
  evidenceRecord(noteSubmitted.state).documents.find(
    (document) => document.id === "income",
  )!.status,
  "Requested",
  "Note-only responses do not fabricate supplied documents",
);
assert.deepEqual(
  applicationEvidenceSummary(evidenceRecord(noteSubmitted.state))
    .outstandingDocumentIds,
  ["income", "identity"],
);
assert.equal(
  applicationEvidenceSummary(evidenceRecord(noteSubmitted.state)).phase,
  "submitted",
);
assert.equal(noteSubmitted.state.evidenceDrafts?.[3], undefined);
assert.equal(
  submitApplicationEvidence(
    noteSubmitted.state,
    "tenant",
    3,
    applicationEvidenceDraft(noteDraft, "tenant", 3)!.revision,
    requestId,
  ).issue?.code,
  "staleRequest",
  "Double submit cannot reuse consumed draft revision",
);
for (const role of ["tenant", "provider", "spaceOperator", "admin"] as const) {
  assert.equal(
    updateApplication(noteSubmitted.state, 3, role, {
      type: "acknowledge-evidence",
      responseId: firstResponse.id,
    }),
    noteSubmitted.state,
  );
  assert.equal(
    updateApplication(noteSubmitted.state, 3, role, {
      type: "close-evidence-request",
      requestId,
    }),
    noteSubmitted.state,
  );
}
assert.equal(
  updateApplication(noteSubmitted.state, 1, "landlord", {
    type: "acknowledge-evidence",
    responseId: firstResponse.id,
  }),
  noteSubmitted.state,
  "Response ids are application-scoped",
);
assert.equal(
  updateApplication(noteSubmitted.state, 3, "landlord", {
    type: "acknowledge-evidence",
    responseId: "invented",
  }),
  noteSubmitted.state,
);
const acknowledged = updateApplication(
  noteSubmitted.state,
  3,
  "landlord",
  { type: "acknowledge-evidence", responseId: firstResponse.id },
  fixedTime,
);
assert.equal(
  applicationEvidenceSummary(evidenceRecord(acknowledged)).phase,
  "reviewed",
);
assert.equal(
  applicationEvidenceSummary(evidenceRecord(acknowledged)).requestOpen,
  true,
  "Acknowledgment alone does not close a request or claim files were supplied",
);
assert.deepEqual(
  applicationEvidenceSummary(evidenceRecord(acknowledged))
    .outstandingDocumentIds,
  ["income", "identity"],
);
assert.equal(
  evidenceRecord(acknowledged).evidenceResponses![0],
  firstResponse,
  "Acknowledgment does not mutate the submitted response",
);
assert.equal(evidenceRecord(acknowledged).status, "Approved");
assert.equal(evidenceRecord(acknowledged).reviewed, true);
assert.equal(
  updateApplication(acknowledged, 3, "landlord", {
    type: "acknowledge-evidence",
    responseId: firstResponse.id,
  }),
  acknowledged,
);

const withFile = addApplicationEvidenceFiles(
  acknowledged,
  "tenant",
  3,
  "income",
  [incomeFile],
  fixedTime,
);
assert.equal(withFile.added, 1);
assert.deepEqual(withFile.issues, []);
assert.equal(applicationEvidenceBytes(withFile.state), incomeFile.size);
const attachedDraft = applicationEvidenceDraft(withFile.state, "tenant", 3)!;
assert.equal(
  attachedDraft.files[0].file,
  incomeFile,
  "Actual selected File is retained",
);
assert.equal(attachedDraft.files[0].kind, "text");
assert.equal(attachedDraft.files[0].mimeType, "text/plain");
assert.equal(
  addApplicationEvidenceFiles(withFile.state, "tenant", 3, "income", [
    incomeFile,
  ]).issues[0].code,
  "alreadyAdded",
);
assert.equal(
  addApplicationEvidenceFiles(withFile.state, "tenant", 3, "invented", [
    incomeFile,
  ]).issues[0].code,
  "unknownDocument",
);
assert.equal(
  removeApplicationEvidenceFile(
    withFile.state,
    "landlord",
    3,
    attachedDraft.files[0].id,
  ),
  withFile.state,
);
assert.equal(
  removeApplicationEvidenceFile(
    withFile.state,
    "tenant",
    1,
    attachedDraft.files[0].id,
  ),
  withFile.state,
);
const removedAttachment = removeApplicationEvidenceFile(
  withFile.state,
  "tenant",
  3,
  attachedDraft.files[0].id,
);
assert.equal(
  applicationEvidenceDraft(removedAttachment, "tenant", 3)!.files.length,
  0,
);
assert.equal(applicationEvidenceBytes(removedAttachment), 0);
assert.equal(
  attachedDraft.files.length,
  1,
  "Removing from a new state does not mutate an earlier draft",
);
const secondSubmitted = submitDraft(withFile.state);
assert.equal(secondSubmitted.issue, null);
const secondResponse = evidenceRecord(secondSubmitted.state)
  .evidenceResponses![1];
assert.equal(secondResponse.version, 2);
assert.equal(secondResponse.files[0].file, incomeFile);
assert.notEqual(
  secondResponse.files,
  attachedDraft.files,
  "Submission snapshots attachment array",
);
assert.notEqual(
  secondResponse.files[0],
  attachedDraft.files[0],
  "Submission snapshots attachment metadata",
);
assert.equal(secondResponse.files[0].kind, "text");
assert.equal(
  evidenceRecord(secondSubmitted.state).evidenceResponses![0],
  firstResponse,
);
assert.equal(
  applicationEvidenceBytes(secondSubmitted.state),
  incomeFile.size,
  "Clearing draft retains submitted File memory",
);
assert.deepEqual(
  applicationEvidenceSummary(evidenceRecord(secondSubmitted.state))
    .outstandingDocumentIds,
  ["identity"],
);
assert.deepEqual(
  applicationEvidenceSummary(evidenceRecord(secondSubmitted.state))
    .unreviewedResponseIds,
  [secondResponse.id],
);
assert.equal(
  applicationEvidenceSummary(evidenceRecord(secondSubmitted.state)).phase,
  "submitted",
);
assert.equal(
  evidenceRecord(secondSubmitted.state).documents.find(
    (document) => document.id === "income",
  )!.status,
  "Supplied",
);
assert.match(
  evidenceRecord(secondSubmitted.state).documents.find(
    (document) => document.id === "income",
  )!.summary,
  /not been verified/,
);
assert.equal(
  visibleApplicationRecords(secondSubmitted.state, "landlord").find(
    (record) => record.id === 3,
  )!.evidenceResponses![1].files[0].file,
  incomeFile,
  "Actual owner sees explicit submitted File",
);

const reusedFile = addApplicationEvidenceFiles(
  secondSubmitted.state,
  "tenant",
  3,
  "identity",
  [incomeFile],
  fixedTime,
);
assert.equal(
  reusedFile.added,
  1,
  "One document may be associated explicitly with another evidence category",
);
assert.equal(
  applicationEvidenceBytes(reusedFile.state),
  incomeFile.size,
  "Repeated File references are counted once across history and drafts",
);
const metadataFiles = ["one", "two"].map(
  (content) =>
    new File([content], "same-name.txt", {
      type: "text/plain",
      lastModified: 123,
    }),
);
const metadataAdded = addApplicationEvidenceFiles(
  reusedFile.state,
  "tenant",
  3,
  "identity",
  metadataFiles,
  fixedTime,
);
assert.equal(
  metadataAdded.added,
  2,
  "Equal metadata does not imply duplicate contents",
);
assert.equal(
  applicationEvidenceBytes(metadataAdded.state),
  incomeFile.size + 6,
);
assert.equal(
  applicationEvidenceDraft(metadataAdded.state, "tenant", 3)!.files[1].file,
  metadataFiles[0],
);
assert.equal(
  applicationEvidenceDraft(metadataAdded.state, "tenant", 3)!.files[2].file,
  metadataFiles[1],
);
assert.equal(
  evidenceRecord(metadataAdded.state).evidenceResponses![1],
  secondResponse,
);

const updatedRequest = updateApplication(
  metadataAdded.state,
  3,
  "landlord",
  {
    type: "request-documents",
    documentIds: ["reference"],
    note: "Please provide a local reference instead.",
  },
  fixedTime,
);
const newerRequest = applicationEvidenceSummary(
  evidenceRecord(updatedRequest),
).latestRequest!;
assert.equal(newerRequest.version, 2);
assert.notEqual(newerRequest.id, requestId);
assert.equal(
  evidenceRecord(updatedRequest).evidenceRequests![0],
  requestSummary.latestRequest,
  "New requests preserve previous immutable request metadata",
);
assert.equal(
  applicationEvidenceDraft(updatedRequest, "tenant", 3)!.requestId,
  requestId,
  "An existing draft is not silently retargeted",
);
assert.equal(submitDraft(updatedRequest).issue?.code, "staleRequest");
assert.equal(
  addApplicationEvidenceFiles(updatedRequest, "tenant", 3, "reference", [
    identityFile,
  ]).issues[0].code,
  "staleRequest",
);
assert.equal(
  updateApplicationEvidenceNote(
    updatedRequest,
    "tenant",
    3,
    "Overwrite stale note",
  ),
  updatedRequest,
);
assert.equal(
  updateApplication(updatedRequest, 3, "landlord", {
    type: "close-evidence-request",
    requestId,
  }),
  updatedRequest,
  "Old request id cannot close newer request",
);
const staleFileRemoved = removeApplicationEvidenceFile(
  updatedRequest,
  "tenant",
  3,
  applicationEvidenceDraft(updatedRequest, "tenant", 3)!.files[0].id,
);
assert.equal(
  applicationEvidenceDraft(staleFileRemoved, "tenant", 3)!.files.length,
  2,
  "Stale drafts remain removable",
);
const restarted = discardApplicationEvidenceDraft(
  staleFileRemoved,
  "tenant",
  3,
);
assert.equal(
  applicationEvidenceDraft(restarted, "tenant", 3)!.requestId,
  newerRequest.id,
);
assert.equal(applicationEvidenceDraft(restarted, "tenant", 3)!.files.length, 0);
assert.equal(
  applicationEvidenceBytes(restarted),
  incomeFile.size,
  "Discard releases only draft references, never submitted history",
);
assert.equal(evidenceRecord(restarted).evidenceResponses![1], secondResponse);
const closureDraft = addApplicationEvidenceFiles(
  restarted,
  "tenant",
  3,
  "reference",
  [identityFile],
  fixedTime,
).state;
const closed = updateApplication(
  closureDraft,
  3,
  "landlord",
  { type: "close-evidence-request", requestId: newerRequest.id },
  fixedTime,
);
assert.equal(evidenceRecord(closed).status, "Approved");
assert.equal(evidenceRecord(closed).reviewed, true);
assert.equal(
  applicationEvidenceSummary(evidenceRecord(closed)).requestOpen,
  false,
);
assert.equal(
  canRespondApplicationEvidence(evidenceRecord(closed), "tenant"),
  false,
);
assert.equal(submitDraft(closed).issue?.code, "unavailable");
assert.equal(
  applicationEvidenceDraft(closed, "tenant", 3)!.files[0].file,
  identityFile,
  "Closing does not silently discard an applicant draft",
);
assert.equal(
  discardApplicationEvidenceDraft(closed, "tenant", 3).evidenceDrafts?.[3],
  undefined,
);
assert.equal(
  updateApplication(closed, 3, "landlord", {
    type: "close-evidence-request",
    requestId: newerRequest.id,
  }),
  closed,
);

const pendingId = legitimateRecord.id;
const pendingFiles = addApplicationEvidenceFiles(
  legitimateReviewed,
  "tenant",
  pendingId,
  "income",
  [incomeFile],
  fixedTime,
);
assert.equal(
  pendingFiles.added,
  1,
  "Pending own applications can supply missing evidence before an owner request",
);
const pendingSubmitted = submitDraft(pendingFiles.state, pendingId);
assert.equal(pendingSubmitted.issue, null);
assert.equal(
  evidenceRecord(pendingSubmitted.state, pendingId).status,
  "Review",
);
assert.equal(
  evidenceRecord(pendingSubmitted.state, pendingId).reviewed,
  true,
  "Evidence submission never changes the existing owner decision/review flag",
);
assert.equal(
  evidenceRecord(pendingSubmitted.state, pendingId).evidenceResponses![0]
    .requestId,
  null,
);
const foreignPendingFiles = addApplicationEvidenceFiles(
  submitted,
  "tenant",
  newRecord.id,
  "income",
  [incomeFile],
  fixedTime,
);
const foreignPendingSubmitted = submitDraft(
  foreignPendingFiles.state,
  newRecord.id,
);
assert.equal(foreignPendingSubmitted.issue, null);
assert.ok(
  !visibleApplicationRecords(foreignPendingSubmitted.state, "landlord").some(
    (record) => record.id === newRecord.id,
  ),
);
assert.equal(
  updateApplication(foreignPendingSubmitted.state, newRecord.id, "landlord", {
    type: "acknowledge-evidence",
    responseId: foreignPendingSubmitted.responseId!,
  }),
  foreignPendingSubmitted.state,
  "Olivia cannot inspect/review evidence for another owner's property",
);

const bothApplications = updateApplication(
  submitted,
  3,
  "landlord",
  {
    type: "request-documents",
    documentIds: ["income"],
    note: "Add local evidence.",
  },
  fixedTime,
);
const firstPrivateDraft = updateApplicationEvidenceNote(
  bothApplications,
  "tenant",
  3,
  "A response for Olivia only.",
);
const separatePrivateDraft = addApplicationEvidenceFiles(
  updateApplicationEvidenceNote(
    firstPrivateDraft,
    "tenant",
    newRecord.id,
    "A separate response for Nuno.",
  ),
  "tenant",
  newRecord.id,
  "income",
  [identityFile],
  fixedTime,
).state;
const unrelatedDraft = applicationEvidenceDraft(
  separatePrivateDraft,
  "tenant",
  newRecord.id,
)!;
const oneSubmitted = submitDraft(separatePrivateDraft);
assert.equal(oneSubmitted.issue, null);
assert.equal(
  applicationEvidenceDraft(oneSubmitted.state, "tenant", newRecord.id),
  unrelatedDraft,
  "Submitting one application keeps another application's private files and note",
);
assert.equal(
  evidenceRecord(oneSubmitted.state, newRecord.id).evidenceResponses,
  undefined,
);
assert.equal(
  applicationEvidenceDraft(oneSubmitted.state, "landlord", newRecord.id),
  null,
);
assert.equal(
  discardApplicationEvidenceDraft(separatePrivateDraft, "tenant", 3)
    .evidenceDrafts![newRecord.id],
  unrelatedDraft,
);

const invalidFiles = [
  new File([], "empty.txt", { type: "text/plain" }),
  new File(["<svg></svg>"], "image.svg", { type: "image/svg+xml" }),
  new File(["<script>alert(1)</script>"], "file.html", { type: "text/html" }),
  new File(["html"], "renamed.pdf", { type: "text/html" }),
  {
    name: "too-large.pdf",
    type: "application/pdf",
    size: 10 * 1024 * 1024 + 1,
  } as File,
];
const invalidBatch = addApplicationEvidenceFiles(
  sharedRequest,
  "tenant",
  3,
  "income",
  invalidFiles,
  fixedTime,
);
assert.equal(invalidBatch.state, sharedRequest);
assert.deepEqual(
  invalidBatch.issues.map((issue) => issue.code),
  [
    "empty",
    "unsupportedFormat",
    "unsupportedFormat",
    "unsupportedFormat",
    "fileTooLarge",
  ],
);
const mixedBatch = addApplicationEvidenceFiles(
  sharedRequest,
  "tenant",
  3,
  "income",
  [invalidFiles[1], incomeFile],
  fixedTime,
);
assert.equal(mixedBatch.added, 1);
assert.equal(mixedBatch.issues.length, 1);
const noMimeFile = new File(["%PDF-1.7"], "blank-type.PDF");
assert.equal(
  applicationEvidenceDraft(
    addApplicationEvidenceFiles(
      sharedRequest,
      "tenant",
      3,
      "identity",
      [noMimeFile],
      fixedTime,
    ).state,
    "tenant",
    3,
  )!.files[0].mimeType,
  "application/pdf",
);
const manyFiles = Array.from(
  { length: MAX_APPLICATION_EVIDENCE_FILES + 1 },
  (_, index) =>
    new File([String(index)], `note-${index}.txt`, { type: "text/plain" }),
);
const capped = addApplicationEvidenceFiles(
  sharedRequest,
  "tenant",
  3,
  "income",
  manyFiles,
  fixedTime,
);
assert.equal(capped.added, MAX_APPLICATION_EVIDENCE_FILES);
assert.equal(capped.issues[0].code, "tooManyFiles");
const largeEvidence = Array.from(
  { length: 6 },
  (_, index) =>
    ({
      name: `evidence-${index}.pdf`,
      type: "application/pdf",
      size: 10 * 1024 * 1024,
    }) as File,
);
const fullEvidence = addApplicationEvidenceFiles(
  sharedRequest,
  "tenant",
  3,
  "income",
  largeEvidence,
  fixedTime,
);
assert.equal(fullEvidence.added, 5);
assert.equal(fullEvidence.issues[0].code, "evidenceFull");
assert.equal(
  applicationEvidenceBytes(fullEvidence.state),
  MAX_APPLICATION_EVIDENCE_BYTES,
);
const fullSubmitted = submitDraft(fullEvidence.state);
assert.equal(fullSubmitted.issue, null);
assert.equal(
  addApplicationEvidenceFiles(fullSubmitted.state, "tenant", 3, "income", [
    incomeFile,
  ]).issues[0].code,
  "evidenceFull",
  "Submitted evidence remains included in the retention budget",
);
const sameRetained = addApplicationEvidenceFiles(
  fullSubmitted.state,
  "tenant",
  3,
  "income",
  [largeEvidence[0]],
  fixedTime,
);
assert.equal(sameRetained.added, 1);
assert.equal(
  applicationEvidenceBytes(sameRetained.state),
  MAX_APPLICATION_EVIDENCE_BYTES,
);

// Freeze previous nested metadata to catch accidental mutation during transitions.
Object.freeze(attachedDraft.files[0]);
Object.freeze(attachedDraft.files);
Object.freeze(attachedDraft);
Object.freeze(firstResponse.files);
Object.freeze(firstResponse);
Object.freeze(requestSummary.latestRequest!.documentIds);
Object.freeze(requestSummary.latestRequest!);
assert.equal(submitDraft(withFile.state).issue, null);
assert.equal(
  removeApplicationEvidenceFile(
    withFile.state,
    "tenant",
    3,
    attachedDraft.files[0].id,
  ).evidenceDrafts![3].files.length,
  0,
);
assert.equal(
  updateApplication(
    sharedRequest,
    3,
    "landlord",
    {
      type: "request-documents",
      documentIds: ["reference"],
      note: "Another request",
    },
    fixedTime,
  ).records[2].evidenceRequests!.length,
  2,
);
assert.equal(initial.records[2].documents[1].status, "Supplied");
assert.equal(initial.records[2].evidenceRequests!.length, 0);
assert.equal(initial.evidenceDrafts, undefined);
console.log(
  "Application state checks passed: role/property scope, explicit owner decisions, private retained File drafts, versioned requests/responses, note-only/partial evidence, stale recovery, acknowledgment/closure, immutable history, canonical formats, identity deduplication and shared retention limits.",
);
