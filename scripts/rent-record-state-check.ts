import assert from "node:assert/strict";
import { properties } from "../src/data";
import {
  canConfirmRentRecord,
  canRecordRentTransfer,
  confirmRentRecord,
  createInitialRentRecordState,
  filterRentRecords,
  parseRentAmount,
  recordRentTransfer,
  rentRecordSummary,
  rentRecordsCsv,
  rentToday,
  requestRentCorrection,
  validateRentTransfer,
  visibleRentRecords,
  type RentRecordFilters,
  type RentTransferDraft,
} from "../src/components/rentRecordState";

const now = new Date(2026, 9, 2, 12, 30);
const later = new Date(2026, 9, 2, 13, 30);
assert.equal(rentToday(now), "2026-10-02");
for (const [input, expected] of [
  ["1850", 185000],
  ["1850.99", 185099],
  ["1850,99", 185099],
  [" 1.1 ", 110],
  ["0.01", 1],
  ["1000000", 100000000],
] as const)
  assert.equal(parseRentAmount(input), expected, input);
for (const input of [
  "",
  "0",
  "0.00",
  "-1",
  "+1",
  "Infinity",
  "NaN",
  "1e3",
  "1,000.00",
  "€2",
  "1.001",
  "1000000.01",
  "9007199254740991",
  ".50",
])
  assert.equal(parseRentAmount(input), null, input);

const draft: RentTransferDraft = {
  amount: "1850.00",
  transferredOn: "2026-10-01",
  reference: "  EXAMPLE-OCT-RENT  ",
  note: "  Example transfer description.  ",
};
assert.deepEqual(validateRentTransfer(draft, now), {});
assert.deepEqual(
  validateRentTransfer({ ...draft, transferredOn: "2026-10-02" }, now),
  {},
);
assert.deepEqual(
  validateRentTransfer({ ...draft, transferredOn: "2024-02-29" }, now),
  {},
);
for (const transferredOn of [
  "",
  "yesterday",
  "2026-10-03",
  "2026-02-29",
  "2026-02-30",
  "2026-13-01",
  "2026-10-2",
])
  assert.ok(
    validateRentTransfer({ ...draft, transferredOn }, now).transferredOn,
    transferredOn,
  );
for (const reference of ["", " ", "x".repeat(101), "two\nlines"])
  assert.ok(validateRentTransfer({ ...draft, reference }, now).reference);
assert.ok(validateRentTransfer({ ...draft, note: "x".repeat(1001) }, now).note);

const initial = createInitialRentRecordState();
const originalJson = JSON.stringify(initial);
const tenantRecords = visibleRentRecords(initial, "tenant");
assert.equal(tenantRecords.length, 3);
assert.ok(tenantRecords.every((record) => record.tenant === "Inês Duarte"));
assert.equal(visibleRentRecords(initial, "landlord").length, 3);
assert.ok(
  visibleRentRecords(initial, "landlord").every(
    (record) => record.owner === "Olivia Martín",
  ),
);
for (const record of initial.records) {
  const property = properties.find((item) => item.id === record.propertyId)!;
  assert.equal(record.owner, property.landlord);
  assert.equal(record.amountDueCents, Math.round(property.price * 100));
  assert.equal(record.property, property.title);
}
for (const role of ["provider", "spaceOperator", "admin"] as const)
  assert.deepEqual(visibleRentRecords(initial, role), []);
const pending = tenantRecords.find(
  (record) => record.status === "Awaiting transfer details",
)!;
const confirmedSeed = tenantRecords.find(
  (record) => record.status === "Confirmed",
)!;
const otherTenant = initial.records.find(
  (record) => record.tenantId === "tenant-leo",
)!;
assert.ok(canRecordRentTransfer(pending, "tenant"));
assert.equal(canRecordRentTransfer(otherTenant, "tenant"), false);
assert.equal(canRecordRentTransfer(confirmedSeed, "tenant"), false);
const foreignPending = {
  ...otherTenant,
  status: "Awaiting owner confirmation" as const,
};
const foreignState = { records: [foreignPending] };
assert.equal(canConfirmRentRecord(foreignPending, "landlord"), false);
assert.equal(
  confirmRentRecord(foreignState, "landlord", otherTenant.id, now),
  foreignState,
);
assert.equal(
  requestRentCorrection(
    foreignState,
    "landlord",
    otherTenant.id,
    "Change reference",
    now,
  ),
  foreignState,
);

for (const role of ["landlord", "provider", "spaceOperator", "admin"] as const)
  assert.equal(
    recordRentTransfer(initial, role, pending.id, draft, now),
    initial,
  );
assert.equal(
  recordRentTransfer(initial, "tenant", otherTenant.id, draft, now),
  initial,
);
assert.equal(
  recordRentTransfer(initial, "tenant", confirmedSeed.id, draft, now),
  initial,
);
assert.equal(
  recordRentTransfer(initial, "tenant", "missing", draft, now),
  initial,
);
assert.equal(
  recordRentTransfer(
    initial,
    "tenant",
    pending.id,
    { ...draft, amount: "bad" },
    now,
  ),
  initial,
);

const saved = recordRentTransfer(initial, "tenant", pending.id, draft, now);
const savedRecord = saved.records.find((record) => record.id === pending.id)!;
assert.equal(saved.records.length, initial.records.length);
assert.equal(savedRecord.status, "Awaiting owner confirmation");
assert.equal(savedRecord.transfer?.amountCents, 185000);
assert.equal(savedRecord.transfer?.reference, "EXAMPLE-OCT-RENT");
assert.equal(savedRecord.transfer?.note, "Example transfer description.");
assert.equal(savedRecord.activity.length, pending.activity.length + 1);
assert.equal(
  saved.records.find((record) => record.id === otherTenant.id),
  otherTenant,
);
assert.equal(JSON.stringify(initial), originalJson);
draft.reference = "changed after submit";
assert.equal(savedRecord.transfer?.reference, "EXAMPLE-OCT-RENT");

for (const role of ["tenant", "provider", "spaceOperator", "admin"] as const) {
  assert.equal(confirmRentRecord(saved, role, pending.id, later), saved);
  assert.equal(
    requestRentCorrection(saved, role, pending.id, "Clarify reference", later),
    saved,
  );
}
assert.equal(
  confirmRentRecord(initial, "landlord", pending.id, later),
  initial,
);
assert.equal(confirmRentRecord(saved, "landlord", "missing", later), saved);
assert.equal(
  requestRentCorrection(saved, "landlord", pending.id, "  ", later),
  saved,
);
assert.equal(
  requestRentCorrection(saved, "landlord", pending.id, "x".repeat(501), later),
  saved,
);
const needsCorrection = requestRentCorrection(
  saved,
  "landlord",
  pending.id,
  "  Please check the transfer reference.  ",
  later,
);
assert.equal(
  needsCorrection.records.find((record) => record.id === pending.id)?.status,
  "Needs correction",
);
assert.equal(
  needsCorrection.records.find((record) => record.id === pending.id)
    ?.correctionNote,
  "Please check the transfer reference.",
);
assert.equal(
  confirmRentRecord(needsCorrection, "landlord", pending.id, later),
  needsCorrection,
);
assert.equal(
  requestRentCorrection(
    needsCorrection,
    "landlord",
    pending.id,
    "Again",
    later,
  ),
  needsCorrection,
);

const mismatch = recordRentTransfer(
  needsCorrection,
  "tenant",
  pending.id,
  { ...draft, amount: "1800", reference: "EXAMPLE-REVISION" },
  later,
);
const mismatchRecord = mismatch.records.find(
  (record) => record.id === pending.id,
)!;
assert.equal(mismatchRecord.status, "Awaiting owner confirmation");
assert.equal(mismatchRecord.correctionNote, "");
assert.equal(canConfirmRentRecord(mismatchRecord, "landlord"), false);
assert.equal(
  confirmRentRecord(mismatch, "landlord", pending.id, later),
  mismatch,
);
const corrected = recordRentTransfer(
  mismatch,
  "tenant",
  pending.id,
  { ...draft, reference: "EXAMPLE-REVISED" },
  later,
);
assert.ok(
  canConfirmRentRecord(
    corrected.records.find((record) => record.id === pending.id)!,
    "landlord",
  ),
);
const confirmed = confirmRentRecord(corrected, "landlord", pending.id, later);
const finalRecord = confirmed.records.find(
  (record) => record.id === pending.id,
)!;
assert.equal(finalRecord.status, "Confirmed");
assert.equal(finalRecord.confirmedAt, later.toISOString());
assert.equal(
  confirmRentRecord(confirmed, "landlord", pending.id, later),
  confirmed,
);
assert.equal(
  recordRentTransfer(confirmed, "tenant", pending.id, draft, later),
  confirmed,
);
assert.equal(
  requestRentCorrection(confirmed, "landlord", pending.id, "Correction", later),
  confirmed,
);
assert.equal(savedRecord.status, "Awaiting owner confirmation");

const filters: RentRecordFilters = {
  status: "All statuses",
  property: "All properties",
  period: "All periods",
  sort: "Most recently updated",
};
assert.equal(filterRentRecords(saved.records, filters)[0].id, pending.id);
assert.ok(
  filterRentRecords(initial.records, { ...filters, status: "Confirmed" }).every(
    (record) => record.status === "Confirmed",
  ),
);
assert.ok(
  filterRentRecords(initial.records, {
    ...filters,
    property: pending.property,
    period: "2026-09",
  }).every(
    (record) =>
      record.property === pending.property && record.period === "2026-09",
  ),
);
assert.equal(
  filterRentRecords(initial.records, {
    ...filters,
    sort: "Amount: high to low",
  })[0].amountDueCents,
  210000,
);
const names = filterRentRecords(initial.records, {
  ...filters,
  sort: "Property name",
}).map((record) => record.property);
assert.deepEqual(
  names,
  [...names].sort((a, b) => a.localeCompare(b)),
);
assert.equal(
  JSON.stringify(initial),
  originalJson,
  "Filtering never mutates seed records",
);

const exported = rentRecordsCsv([finalRecord]);
assert.ok(exported.includes(finalRecord.id));
assert.ok(
  !exported.includes(otherTenant.id),
  "Export receives only visible records",
);
assert.ok(exported.includes('"1850.00"'));
assert.ok(exported.includes("Sample session record; not bank confirmation"));
assert.equal(rentRecordsCsv([]).split("\r\n").length, 2);
const escaped = rentRecordsCsv([
  {
    ...finalRecord,
    transfer: {
      ...finalRecord.transfer!,
      reference: '=HYPERLINK("bad")',
      note: '  @formula\nComma, and "quote"',
    },
    correctionNote: "\t=SUM(1,1)",
  },
]);
assert.ok(escaped.includes('"\'=HYPERLINK(""bad"")"'));
assert.ok(escaped.includes('"\'  @formula\nComma, and ""quote"""'));
assert.ok(escaped.includes('"\'\t=SUM(1,1)"'));
const summary = rentRecordSummary(finalRecord);
assert.ok(summary.includes("not payment instructions or a bank receipt"));
assert.ok(summary.includes("No bank account is provided"));
assert.ok(summary.includes(finalRecord.transfer!.reference));
assert.notEqual(createInitialRentRecordState().records[0], initial.records[0]);
console.log(
  "Rent-record checks passed: amount/date validation, role visibility, immutable transfers, correction/review guards, matching-amount confirmation, retained history, filtering, scoped CSV and spreadsheet formula escaping.",
);
