import assert from "node:assert/strict";
import { properties } from "../src/data";
import type { Role } from "../src/types";
import {
  addApplicationEvidenceFiles,
  applicationEvidenceDraft,
  applicationEvidenceSummary,
  createInitialApplicationState,
  discardApplicationEvidenceDraft,
  discardRentalApplicationDraft,
  hasRentalApplicationDraft,
  removeApplicationEvidenceFile,
  rentalApplicationDraft,
  submitApplicationEvidence,
  submitRentalApplication,
  submitRentalApplicationDraft,
  tenantApplicationForProperty,
  updateApplication,
  updateApplicationEvidenceNote,
  updateRentalApplicationDraft,
  visibleApplicationRecords,
  type ApplicationState,
  type RentalApplicationComposerDraft,
} from "../src/components/applicationState";

const now = new Date(2032, 4, 10, 12, 30);
const later = new Date(2032, 4, 11, 12, 30);
const initial = createInitialApplicationState();
const rental = properties.find((property) => property.id === 2)!;
const otherRental = properties.find((property) => property.id === 3)!;
const ownedRental = properties.find((property) => property.id === 1)!;
const sale = properties.find((property) => property.listingType === "Buy")!;
const privateText =
  "  PRIVATE INTRODUCTION: I would like to move in during May.  ";
const valid: RentalApplicationComposerDraft = {
  moveInDate: "2032-05-20",
  householdSize: "2",
  introduction: privateText,
};
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
function read(state: ApplicationState, propertyId = rental.id) {
  const draft = rentalApplicationDraft(state, "tenant", propertyId, now);
  assert.ok(draft);
  return draft;
}
function retain(
  state: ApplicationState,
  propertyId: number,
  patch: Partial<RentalApplicationComposerDraft> = valid,
) {
  return updateRentalApplicationDraft(state, "tenant", propertyId, patch, now);
}
function unchangedFailure(
  state: ApplicationState,
  role: Role,
  propertyId: number,
  issue: "unavailable" | "duplicate" | "noDraft" | null,
) {
  const result = submitRentalApplicationDraft(state, role, propertyId, now);
  assert.equal(result.state, state);
  assert.equal(result.applicationId, null);
  assert.equal(result.issue, issue);
  return result;
}

// Reading sensible local-date defaults creates no stored draft or new application.
const initialSnapshot = JSON.stringify(initial);
const defaults = read(initial);
assert.deepEqual(defaults, {
  moveInDate: "2032-05-24",
  householdSize: "1",
  introduction: "",
});
assert.equal(hasRentalApplicationDraft(initial, "tenant", rental.id), false);
assert.notEqual(read(initial), defaults);
defaults.moveInDate = "2040-01-01";
defaults.householdSize = "99";
assert.equal(read(initial).moveInDate, "2032-05-24");
assert.equal(read(initial).householdSize, "1");
assert.equal(
  rentalApplicationDraft(initial, "tenant", rental.id, later)!.moveInDate,
  "2032-05-25",
);
assert.equal(JSON.stringify(initial), initialSnapshot);
assert.equal(retain(initial, rental.id, {}), initial);
assert.equal(
  retain(initial, rental.id, {
    householdSize: 2,
    unexpected: "ignored",
  } as unknown as Partial<RentalApplicationComposerDraft>),
  initial,
);
assert.equal(
  discardRentalApplicationDraft(initial, "tenant", rental.id),
  initial,
);
unchangedFailure(initial, "tenant", rental.id, "noDraft");
const explicitDefaults = retain(initial, rental.id, read(initial));
assert.equal(
  hasRentalApplicationDraft(explicitDefaults, "tenant", rental.id),
  true,
);
assert.equal(explicitDefaults.records, initial.records);
assert.equal(
  retain(explicitDefaults, rental.id, read(explicitDefaults)),
  explicitDefaults,
);
const defaultSubmission = submitRentalApplicationDraft(
  explicitDefaults,
  "tenant",
  rental.id,
  now,
);
assert.ok(defaultSubmission.applicationId);
assert.equal(defaultSubmission.issue, null);
assert.deepEqual(defaultSubmission.errors, {});
assert.deepEqual(defaultSubmission.state.records.at(-1)?.submission, {
  moveInDate: "2032-05-24",
  householdSize: 1,
  introduction: "",
});
assert.equal(
  hasRentalApplicationDraft(defaultSubmission.state, "tenant", rental.id),
  false,
);

// Only the tenant and canonical rental catalogue entries can access or change these drafts.
for (const role of roles.filter((value) => value !== "tenant")) {
  assert.equal(rentalApplicationDraft(initial, role, rental.id, now), null);
  assert.equal(hasRentalApplicationDraft(initial, role, rental.id), false);
  assert.equal(
    updateRentalApplicationDraft(initial, role, rental.id, valid, now),
    initial,
  );
  assert.equal(
    discardRentalApplicationDraft(initial, role, rental.id),
    initial,
  );
  unchangedFailure(initial, role, rental.id, "unavailable");
}
for (const propertyId of [sale.id, 999, Number.NaN, "2" as unknown as number]) {
  assert.equal(
    rentalApplicationDraft(initial, "tenant", propertyId, now),
    null,
  );
  assert.equal(hasRentalApplicationDraft(initial, "tenant", propertyId), false);
  assert.equal(retain(initial, propertyId), initial);
  assert.equal(
    discardRentalApplicationDraft(initial, "tenant", propertyId),
    initial,
  );
  unchangedFailure(initial, "tenant", propertyId, "unavailable");
}

// Incomplete text remains exactly as typed, independently per property and invisible to record readers.
const raw = retain(initial, rental.id, {
  moveInDate: "",
  householdSize: "",
  introduction: "  ",
});
assert.deepEqual(read(raw), {
  moveInDate: "",
  householdSize: "",
  introduction: "  ",
});
assert.equal(hasRentalApplicationDraft(raw, "tenant", rental.id), true);
assert.equal(raw.records, initial.records);
assert.equal(retain(raw, rental.id, read(raw)), raw);
assert.equal(
  retain(raw, rental.id, {
    moveInDate: 4,
    householdSize: null,
    introduction: undefined,
    unexpected: "ignored",
  } as unknown as Partial<RentalApplicationComposerDraft>),
  raw,
);
const partial = retain(raw, rental.id, {
  moveInDate: "2032-",
  householdSize: " 2. ",
  introduction: privateText,
});
assert.deepEqual(read(partial), {
  moveInDate: "2032-",
  householdSize: " 2. ",
  introduction: privateText,
});
const partialRead = read(partial);
partialRead.introduction = "External mutation";
assert.equal(read(partial).introduction, privateText);
const inputPatch = { introduction: "Another private note" };
const patched = retain(partial, rental.id, inputPatch);
inputPatch.introduction = "Mutated after update";
assert.equal(read(patched).introduction, "Another private note");
const independent = retain(partial, otherRental.id, {
  moveInDate: "",
  householdSize: "3",
  introduction: "A different incomplete draft",
});
assert.deepEqual(read(independent), read(partial));
assert.equal(read(independent, otherRental.id).householdSize, "3");
assert.equal(
  rentalApplicationDraft(independent, "tenant", rental.id, later)!.moveInDate,
  "2032-",
);
for (const role of roles) {
  assert.deepEqual(
    visibleApplicationRecords(independent, role),
    visibleApplicationRecords(initial, role),
  );
  if (role !== "tenant") {
    assert.equal(
      rentalApplicationDraft(independent, role, rental.id, now),
      null,
    );
    assert.equal(
      discardRentalApplicationDraft(independent, role, rental.id),
      independent,
    );
  }
}
assert.equal(
  JSON.stringify(independent.records).includes("PRIVATE INTRODUCTION"),
  false,
);
const discarded = discardRentalApplicationDraft(
  independent,
  "tenant",
  rental.id,
);
assert.equal(hasRentalApplicationDraft(discarded, "tenant", rental.id), false);
assert.deepEqual(
  read(discarded, otherRental.id),
  read(independent, otherRental.id),
);
assert.equal(discarded.records, independent.records);
assert.equal(
  discardRentalApplicationDraft(discarded, "tenant", rental.id),
  discarded,
);

// Invalid submits preserve raw values and history; valid defaults without an actual draft are not consent to submit.
const invalidValues: Array<
  [
    Partial<RentalApplicationComposerDraft>,
    "date" | "householdSize" | "introduction",
  ]
> = [
  [{ moveInDate: "" }, "date"],
  [{ moveInDate: "2032-05-09" }, "date"],
  [{ moveInDate: "2032-02-30" }, "date"],
  [{ moveInDate: "2032-5-20" }, "date"],
  [{ householdSize: "" }, "householdSize"],
  [{ householdSize: "  " }, "householdSize"],
  [{ householdSize: "0" }, "householdSize"],
  [{ householdSize: "-1" }, "householdSize"],
  [{ householdSize: "1.5" }, "householdSize"],
  [{ householdSize: "1e2" }, "householdSize"],
  [{ householdSize: "0x10" }, "householdSize"],
  [{ householdSize: "NaN" }, "householdSize"],
  [{ householdSize: "9007199254740992" }, "householdSize"],
  [{ introduction: "x".repeat(1001) }, "introduction"],
];
for (const [patch, field] of invalidValues) {
  const invalid = retain(independent, rental.id, { ...valid, ...patch });
  const result = unchangedFailure(invalid, "tenant", rental.id, null);
  assert.ok(result.errors[field], `Expected ${field} validation`);
  assert.deepEqual(read(result.state), { ...valid, ...patch });
  assert.equal(result.state.records, initial.records);
}
const validRetained = retain(independent, rental.id, valid);
const evidenceSeed = updateApplicationEvidenceNote(
  updateApplication(
    validRetained,
    3,
    "landlord",
    {
      type: "request-documents",
      documentIds: ["income"],
      note: "Please provide a local response.",
    },
    now,
  ),
  "tenant",
  3,
  "Retained evidence draft is independent of the rental composer.",
);
assert.ok(applicationEvidenceDraft(evidenceSeed, "tenant", 3));
const submitted = submitRentalApplicationDraft(
  evidenceSeed,
  "tenant",
  rental.id,
  now,
);
assert.equal(submitted.issue, null);
assert.deepEqual(submitted.errors, {});
assert.ok(submitted.applicationId);
assert.equal(submitted.state.records.length, evidenceSeed.records.length + 1);
const created = submitted.state.records.find(
  (record) => record.id === submitted.applicationId,
)!;
assert.equal(created.propertyId, rental.id);
assert.equal(created.property, rental.title);
assert.equal(created.tenantId, "tenant-ines");
assert.equal(created.status, "Review");
assert.equal(created.reviewed, false);
assert.equal(created.submittedAt, now.toISOString());
assert.deepEqual(created.submission, {
  moveInDate: valid.moveInDate,
  householdSize: 2,
  introduction: privateText.trim(),
});
assert.ok(created.documents.every((document) => document.status === "Missing"));
assert.equal(created.activity.length, 1);
assert.equal(created.activity[0].at, now.toISOString());
assert.equal(
  hasRentalApplicationDraft(submitted.state, "tenant", rental.id),
  false,
);
assert.deepEqual(
  read(submitted.state, otherRental.id),
  read(evidenceSeed, otherRental.id),
);
assert.equal(submitted.state.evidenceDrafts, evidenceSeed.evidenceDrafts);
assert.deepEqual(read(evidenceSeed), valid);
for (const record of evidenceSeed.records)
  assert.equal(
    submitted.state.records.find((item) => item.id === record.id),
    record,
  );
assert.ok(
  visibleApplicationRecords(submitted.state, "tenant").includes(created),
);
assert.equal(
  visibleApplicationRecords(submitted.state, "landlord").includes(created),
  false,
);
const snapshot = { ...created.submission! };
const resaved = retain(submitted.state, rental.id, {
  moveInDate: "2032-06-01",
  householdSize: "5",
  introduction: "New unsent text",
});
assert.deepEqual(created.submission, snapshot);
assert.equal(resaved.records, submitted.state.records);
unchangedFailure(resaved, "tenant", rental.id, "duplicate");
assert.equal(hasRentalApplicationDraft(resaved, "tenant", rental.id), true);
const retry = submitRentalApplicationDraft(
  submitted.state,
  "tenant",
  rental.id,
  now,
);
assert.equal(retry.state, submitted.state);
assert.equal(retry.applicationId, null);
assert.equal(retry.issue, "duplicate");
const today = submitRentalApplicationDraft(
  retain(initial, rental.id, {
    moveInDate: "2032-05-10",
    householdSize: "1",
    introduction: "",
  }),
  "tenant",
  rental.id,
  now,
);
assert.ok(today.applicationId);
assert.equal(today.state.records.at(-1)?.submission?.introduction, "");
const leadingZeros = submitRentalApplicationDraft(
  retain(initial, rental.id, { ...valid, householdSize: " 02 " }),
  "tenant",
  rental.id,
  now,
);
assert.ok(leadingZeros.applicationId);
assert.equal(leadingZeros.state.records.at(-1)?.submission?.householdSize, 2);

// Existing applications cannot be overwritten by retained drafts, including a concurrent legacy submission.
const duplicateSeed = retain(independent, ownedRental.id, valid);
unchangedFailure(duplicateSeed, "tenant", ownedRental.id, "duplicate");
assert.equal(duplicateSeed.records, independent.records);
const legacyDraft = {
  moveInDate: valid.moveInDate,
  householdSize: 2,
  introduction: privateText,
};
const concurrentlySubmitted = submitRentalApplication(
  validRetained,
  "tenant",
  rental,
  legacyDraft,
  now,
);
assert.deepEqual(read(concurrentlySubmitted), read(validRetained));
unchangedFailure(concurrentlySubmitted, "tenant", rental.id, "duplicate");
const forgedLabel = submitRentalApplication(
  initial,
  "tenant",
  { ...rental, title: "Forged property label", listingType: "Buy" },
  legacyDraft,
  now,
);
assert.equal(forgedLabel.records.at(-1)?.property, rental.title);
assert.equal(forgedLabel.records.at(-1)?.propertyId, rental.id);
for (const property of [
  { ...sale, listingType: "Rent" as const },
  { ...rental, id: 999 },
  { ...rental, id: "2" as unknown as number },
])
  assert.equal(
    submitRentalApplication(initial, "tenant", property, legacyDraft, now),
    initial,
  );

// Owner decisions and the separate evidence loop preserve every other unsent property draft.
const withoutExistingTenant = {
  ...independent,
  records: independent.records.filter((record) => record.id !== 3),
};
const ownResult = submitRentalApplicationDraft(
  retain(withoutExistingTenant, ownedRental.id, valid),
  "tenant",
  ownedRental.id,
  now,
);
assert.ok(ownResult.applicationId);
const ownId = ownResult.applicationId;
const expectedDrafts = [
  read(independent, rental.id),
  read(independent, otherRental.id),
];
function keepsDrafts(state: ApplicationState) {
  assert.deepEqual(
    [read(state, rental.id), read(state, otherRental.id)],
    expectedDrafts,
  );
  return state;
}
let current = keepsDrafts(
  updateApplication(
    ownResult.state,
    ownId,
    "landlord",
    { type: "mark-reviewed" },
    now,
  ),
);
current = keepsDrafts(
  updateApplication(current, ownId, "landlord", { type: "approve" }, now),
);
current = keepsDrafts(
  updateApplication(
    current,
    ownId,
    "landlord",
    {
      type: "request-documents",
      documentIds: ["income"],
      note: "Please provide a local evidence response.",
    },
    now,
  ),
);
current = keepsDrafts(
  updateApplicationEvidenceNote(
    current,
    "tenant",
    ownId,
    "Evidence note stays separate from composer drafts.",
  ),
);
const localFile = new File(
  ["A synthetic local evidence fixture."],
  "fixture.txt",
  { type: "text/plain" },
);
const attached = addApplicationEvidenceFiles(
  current,
  "tenant",
  ownId,
  "income",
  [localFile],
  now,
);
assert.equal(attached.added, 1);
current = keepsDrafts(attached.state);
const evidence = applicationEvidenceDraft(current, "tenant", ownId)!;
keepsDrafts(
  removeApplicationEvidenceFile(current, "tenant", ownId, evidence.files[0].id),
);
keepsDrafts(discardApplicationEvidenceDraft(current, "tenant", ownId));
const response = submitApplicationEvidence(
  current,
  "tenant",
  ownId,
  evidence.revision,
  evidence.requestId,
  now,
);
assert.ok(response.responseId);
current = keepsDrafts(response.state);
current = keepsDrafts(
  updateApplication(
    current,
    ownId,
    "landlord",
    { type: "acknowledge-evidence", responseId: response.responseId },
    now,
  ),
);
const requestId = applicationEvidenceSummary(
  current.records.find((record) => record.id === ownId)!,
).latestRequest!.id;
current = keepsDrafts(
  updateApplication(
    current,
    ownId,
    "landlord",
    { type: "close-evidence-request", requestId },
    now,
  ),
);
assert.equal(
  current.records.find((record) => record.id === ownId)!.status,
  "Approved",
);
assert.deepEqual(
  tenantApplicationForProperty(current, ownedRental)!.submission,
  snapshot,
);
assert.equal(JSON.stringify(initial), initialSnapshot);

console.log(
  "Rental composer draft checks passed: canonical tenant scope, detached raw drafts, private retention, validated atomic submission, duplicate guards, canonical legacy metadata and evidence-loop preservation.",
);
