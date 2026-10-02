import assert from "node:assert/strict";
import { buildPropertyInsights } from "../src/components/propertyInsightsSummary";
import {
  buildPropertyOperationsSummary,
  type PropertyOperationsInput,
} from "../src/components/propertyOperationsSummary";
import { createInitialApplicationState } from "../src/components/applicationState";
import { createInitialMaintenanceState } from "../src/components/maintenanceState";
import {
  createInitialRentRecordState,
  recordRentTransfer,
  confirmRentRecord,
} from "../src/components/rentRecordState";

const now = new Date(2026, 9, 3, 12);
const input: PropertyOperationsInput = {
  role: "landlord",
  now,
  rentState: createInitialRentRecordState(),
  applicationState: createInitialApplicationState(),
  maintenanceState: createInitialMaintenanceState(),
};
const summary = buildPropertyOperationsSummary(input);
const original = JSON.stringify(summary);
const current = buildPropertyInsights(summary);
assert.deepEqual(current.periods, ["2026-10", "2026-09", "2026-08"]);
assert.equal(current.period, "2026-10");
assert.equal(current.totals.count, 1);
assert.equal(current.totals.dueCents, 185000);
assert.equal(current.totals.confirmedCents, 0);
assert.equal(current.totals.unconfirmedCents, 185000);
assert.equal(current.totals.needsDetails, 1);
assert.equal(current.totals.needsReview, 0);
assert.deepEqual(
  current.properties.map((row) => row.property.id),
  [1],
);
assert.equal(current.properties[0].openApplications, 1);
assert.equal(current.properties[0].openMaintenance, 1);
assert.deepEqual(
  current.history.map((row) => row.period),
  ["2026-08", "2026-09", "2026-10"],
);
assert.equal(current.history[0].confirmedCents, 185000);
assert.equal(buildPropertyInsights(summary, "2026-09").totals.needsReview, 1);
assert.equal(
  buildPropertyInsights(summary, "2026-08").totals.unconfirmedCents,
  0,
);
assert.equal(buildPropertyInsights(summary, "missing").period, "2026-10");
assert.equal(
  JSON.stringify(summary),
  original,
  "Summaries and sorting remain immutable",
);

const id = summary.currentRent[0].id;
const transferred = recordRentTransfer(
  input.rentState,
  "tenant",
  id,
  {
    amount: "1850",
    transferredOn: "2026-10-02",
    reference: "INSIGHT-CHECK",
    note: "Synthetic test",
  },
  now,
);
const awaiting = buildPropertyInsights(
  buildPropertyOperationsSummary({ ...input, rentState: transferred }),
);
assert.equal(awaiting.totals.needsReview, 1);
assert.equal(
  awaiting.totals.confirmedCents,
  0,
  "Recording a transfer is not owner confirmation",
);
const confirmed = confirmRentRecord(transferred, "landlord", id, now);
const updated = buildPropertyInsights(
  buildPropertyOperationsSummary({ ...input, rentState: confirmed }),
);
assert.equal(updated.totals.confirmedCents, 185000);
assert.equal(updated.totals.unconfirmedCents, 0);
assert.equal(updated.properties[0].confirmedCents, 185000);
assert.equal(
  updated.history.find((row) => row.period === "2026-10")?.confirmedCents,
  185000,
);
assert.equal(updated.totals.needsReview, 0);

const nextMonth = buildPropertyInsights(
  buildPropertyOperationsSummary({ ...input, now: new Date(2026, 10, 1) }),
);
assert.equal(nextMonth.period, "2026-11");
assert.equal(nextMonth.totals.count, 0);
assert.equal(
  nextMonth.totals.dueCents,
  0,
  "A listing price must not fabricate rent in an unrecorded month",
);
assert.equal(nextMonth.properties[0].count, 0);
assert.equal(nextMonth.properties[0].dueCents, 0);
assert.equal(
  buildPropertyInsights({ ...summary, rentRecords: [] }).totals.count,
  0,
);
const foreign = input.rentState.records.find(
  (record) => record.propertyId !== 1,
)!;
const polluted = buildPropertyInsights({
  ...summary,
  rentRecords: [...summary.rentRecords, { ...foreign, period: "2026-10" }],
});
assert.deepEqual(
  polluted,
  current,
  "Foreign property records cannot enter insights even if supplied in a summary",
);
console.log(
  "Property insights passed: owner scope, recorded periods, exact totals, live transfer/confirmation changes, immutable summaries and missing-period semantics.",
);
