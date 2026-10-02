import assert from "node:assert/strict";
import {
  addLocalDocuments,
  categoriesForRole,
  createInitialDocumentState,
  documentBytes,
  MAX_DOCUMENT_BYTES,
  MAX_WORKSPACE_DOCUMENT_BYTES,
  removeDocument,
  restoreDocument,
  restoreDocumentError,
  validateDocumentFile,
  workspaceDocuments,
  workspaceLocalBytes,
} from "../src/components/documentState";
import type { Role } from "../src/types";

const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const initial = createInitialDocumentState();
assert.equal(
  new Set(initial.records.map((record) => record.id)).size,
  initial.records.length,
);
for (const role of roles) {
  assert.ok(workspaceDocuments(initial, role).length > 0);
  assert.ok(
    workspaceDocuments(initial, role).every(
      (record) => record.role === role && record.source === "sample",
    ),
  );
  assert.equal(workspaceLocalBytes(initial, role), 0);
  assert.equal(restoreDocument(initial, role), initial);
}
assert.match(
  initial.records[0].source === "sample" ? initial.records[0].content : "",
  /SAMPLE PREVIEW/,
);
assert.ok(documentBytes(initial.records[0]) > 0);

const note = new File(["These are my local notes."], "notes.txt", {
  type: "text/plain",
  lastModified: 42,
});
const image = new File([new Uint8Array([137, 80, 78, 71])], "photo.PNG", {
  type: "image/png",
  lastModified: 43,
});
const pdf = new File(["%PDF-1.7 sample"], "record.pdf", {
  type: "application/pdf",
  lastModified: 44,
});
const noMime = new File(["%PDF-1.7 sample"], "local.PDF", { lastModified: 45 });
for (const file of [note, image, pdf, noMime])
  assert.equal(validateDocumentFile(file), null);
for (const file of [
  new File([], "empty.txt", { type: "text/plain" }),
  new File(["<svg></svg>"], "drawing.svg", { type: "image/svg+xml" }),
  new File(["<script>alert(1)</script>"], "page.html", { type: "text/html" }),
  new File(["html"], "fake.pdf", { type: "text/html" }),
  new File(["code"], "script.js", { type: "text/javascript" }),
  new File(["data"], "constructor"),
  new File(["data"], "__proto__"),
])
  assert.ok(validateDocumentFile(file), `Must reject ${file.name}`);
assert.ok(
  validateDocumentFile({
    name: "huge.pdf",
    type: "application/pdf",
    size: MAX_DOCUMENT_BYTES + 1,
  }),
);

const added = addLocalDocuments(
  initial,
  "tenant",
  [note, image, pdf, noMime],
  "Personal records",
  new Date("2026-10-02T12:00:00Z"),
);
assert.equal(added.added, 4);
assert.deepEqual(added.errors, []);
assert.equal(
  workspaceDocuments(initial, "tenant").length,
  3,
  "Adding leaves the original state untouched",
);
const locals = workspaceDocuments(added.state, "tenant").filter(
  (record) => record.source === "local",
);
assert.deepEqual(
  locals.map((record) => record.kind),
  ["text", "image", "pdf", "pdf"],
);
assert.equal(
  locals[0].source === "local" ? locals[0].file : null,
  note,
  "Retain the actual selected File in memory",
);
assert.equal(
  workspaceLocalBytes(added.state, "tenant"),
  note.size + image.size + pdf.size + noMime.size,
);
for (const role of roles.filter((role) => role !== "tenant"))
  assert.deepEqual(
    workspaceDocuments(added.state, role),
    workspaceDocuments(initial, role),
  );
assert.equal(
  addLocalDocuments(added.state, "tenant", [note], "Other").state,
  added.state,
  "Adding the same File object does not duplicate it",
);
const repeatedBatch = addLocalDocuments(
  initial,
  "tenant",
  [note, note],
  "Other",
);
assert.equal(repeatedBatch.added, 1);
assert.equal(repeatedBatch.errors.length, 1);
const matchingMetadataFiles = ["tenant A", "tenant B"].map(
  (content) =>
    new File([content], "same-name.txt", {
      type: "text/plain",
      lastModified: 42,
    }),
);
const matchingMetadata = addLocalDocuments(
  initial,
  "tenant",
  matchingMetadataFiles,
  "Other",
);
assert.equal(
  matchingMetadata.added,
  2,
  "Distinct files with matching metadata must both be preserved",
);
assert.deepEqual(matchingMetadata.errors, []);
const matchingRecords = workspaceDocuments(
  matchingMetadata.state,
  "tenant",
).filter((record) => record.source === "local");
assert.notEqual(matchingRecords[0].id, matchingRecords[1].id);
assert.equal(matchingRecords[0].file, matchingMetadataFiles[0]);
assert.equal(matchingRecords[1].file, matchingMetadataFiles[1]);
assert.deepEqual(
  await Promise.all(matchingRecords.map((record) => record.file.text())),
  ["tenant A", "tenant B"],
);
assert.equal(
  workspaceLocalBytes(matchingMetadata.state, "tenant"),
  matchingMetadataFiles[0].size + matchingMetadataFiles[1].size,
);
const removedMatching = removeDocument(
  matchingMetadata.state,
  "tenant",
  matchingRecords[0].id,
);
assert.equal(restoreDocumentError(removedMatching, "tenant"), null);
assert.equal(
  workspaceDocuments(
    restoreDocument(removedMatching, "tenant"),
    "tenant",
  ).filter((record) => record.source === "local").length,
  2,
  "Undo is not blocked by a different file with matching metadata",
);
assert.equal(
  addLocalDocuments(initial, "tenant", [note], "Platform records").state,
  initial,
);
assert.ok(!categoriesForRole("provider").includes("Personal records"));
const mixed = addLocalDocuments(
  initial,
  "tenant",
  [note, new File(["x"], "script.html", { type: "text/html" })],
  "Other",
);
assert.equal(mixed.added, 1);
assert.equal(mixed.errors.length, 1);
const separateRole = addLocalDocuments(
  added.state,
  "landlord",
  [note],
  "Other",
);
assert.equal(
  separateRole.added,
  1,
  "A separate workspace can hold its own selected copy",
);

const id = locals[0].id;
assert.equal(
  removeDocument(added.state, "landlord", id),
  added.state,
  "Another workspace cannot remove a tenant document",
);
assert.equal(removeDocument(added.state, "tenant", "missing"), added.state);
const removed = removeDocument(added.state, "tenant", id);
assert.equal(removed.removed.tenant, locals[0]);
assert.equal(
  workspaceDocuments(removed, "tenant").some((record) => record.id === id),
  false,
);
assert.equal(restoreDocument(removed, "landlord"), removed);
const restored = restoreDocument(removed, "tenant");
assert.equal(
  workspaceDocuments(restored, "tenant").find((record) => record.id === id),
  locals[0],
  "Undo restores the same file and metadata",
);
assert.equal(restored.removed.tenant, undefined);
assert.equal(restoreDocument(restored, "tenant"), restored);
const readded = addLocalDocuments(removed, "tenant", [note], "Other");
assert.ok(restoreDocumentError(readded.state, "tenant"));
assert.equal(
  restoreDocument(readded.state, "tenant"),
  readded.state,
  "Undo cannot duplicate a re-added file",
);

// Metadata-only File fixtures exercise limits without allocating large buffers.
const largeFiles = Array.from(
  { length: 5 },
  (_, index) =>
    ({
      name: `large-${index}.pdf`,
      type: "application/pdf",
      size: MAX_DOCUMENT_BYTES,
      lastModified: index,
    }) as File,
);
const full = addLocalDocuments(initial, "tenant", largeFiles, "Other");
assert.equal(full.added, 5);
assert.equal(
  workspaceLocalBytes(full.state, "tenant"),
  MAX_WORKSPACE_DOCUMENT_BYTES,
);
assert.equal(
  addLocalDocuments(full.state, "tenant", [note], "Other").state,
  full.state,
);
const sameMetadataAtLimit = addLocalDocuments(
  full.state,
  "tenant",
  [{ ...largeFiles[0] } as File],
  "Other",
);
assert.equal(sameMetadataAtLimit.state, full.state);
assert.match(sameMetadataAtLimit.errors[0], /50 MB/);
const firstLarge = workspaceDocuments(full.state, "tenant").find(
  (record) => record.source === "local",
)!;
const withSpace = removeDocument(full.state, "tenant", firstLarge.id);
const refilled = addLocalDocuments(withSpace, "tenant", [note], "Other");
assert.equal(refilled.added, 1);
assert.ok(restoreDocumentError(refilled.state, "tenant"));
assert.equal(
  restoreDocument(refilled.state, "tenant"),
  refilled.state,
  "Undo respects the current workspace size limit",
);
assert.equal(
  workspaceDocuments(createInitialDocumentState(), "tenant").length,
  3,
  "A new app instance starts without selected local files",
);
console.log(
  "Document state checks passed: labelled samples, supported MIME/types, size limits, real File retention, workspace isolation, mixed batches, object-identity deduplication, matching-metadata preservation and safe remove/undo.",
);
