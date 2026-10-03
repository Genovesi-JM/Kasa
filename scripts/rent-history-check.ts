import assert from "node:assert/strict";
import { createInitialMaintenanceState } from "../src/components/maintenanceState";
import { buildPropertyOperationsSummary } from "../src/components/propertyOperationsSummary";
import {
  confirmRentRecord,
  createInitialRentRecordState,
  recordRentTransfer,
  rentRecordSummary,
  rentRecordsCsv,
  requestRentCorrection,
  type RentRecord,
  type RentRecordChange,
  type RentRecordSnapshot,
  type RentRecordState,
  type RentTransfer,
  type RentTransferDraft,
} from "../src/components/rentRecordState";

const initial = createInitialRentRecordState();
const initialJson = JSON.stringify(initial);
const id = "rent-2026-10-tenant-ines";
const record = (state: RentRecordState, recordId = id) => {
  const result = state.records.find((item) => item.id === recordId);
  assert.ok(result);
  return result;
};
const at = (hour: number) => new Date(2026, 9, 3, hour);
const transfer1: RentTransfer = {
  amountCents: record(initial).amountDueCents - 25000,
  transferredOn: "2026-10-01",
  reference: "PRIVATE-FIRST-REFERENCE",
  note: "Private first transfer explanation.",
};
const transfer2: RentTransfer = {
  amountCents: record(initial).amountDueCents - 10000,
  transferredOn: "2026-10-02",
  reference: "PRIVATE-SECOND-REFERENCE",
  note: "Private revised transfer explanation.",
};
const transfer3: RentTransfer = {
  amountCents: record(initial).amountDueCents,
  transferredOn: "2026-10-03",
  reference: "PRIVATE-FINAL-REFERENCE",
  note: "Private final transfer explanation.",
};
const reason1 = "Private correction: check the amount and reference.";
const reason2 = "Private second correction: the amount still differs.";
const draft = (transfer: RentTransfer): RentTransferDraft => ({
  amount: (transfer.amountCents / 100).toFixed(2).replace(".", ","),
  transferredOn: transfer.transferredOn,
  reference: `  ${transfer.reference}  `,
  note: `  ${transfer.note}  `,
});
const snapshot = (
  status: RentRecord["status"],
  transfer?: RentTransfer,
  correctionNote = "",
): RentRecordSnapshot => ({
  status,
  ...(transfer ? { transfer } : {}),
  correctionNote,
});

const recorded = recordRentTransfer(
  initial,
  "tenant",
  id,
  draft(transfer1),
  at(9),
);
const correction1 = requestRentCorrection(
  recorded,
  "landlord",
  id,
  `  ${reason1}  `,
  at(10),
);
const revised1 = recordRentTransfer(
  correction1,
  "tenant",
  id,
  draft(transfer2),
  at(11),
);
const correction2 = requestRentCorrection(
  revised1,
  "landlord",
  id,
  reason2,
  at(12),
);
const revised2 = recordRentTransfer(
  correction2,
  "tenant",
  id,
  draft(transfer3),
  at(13),
);
const confirmed = confirmRentRecord(revised2, "landlord", id, at(14));
const awaiting = "Awaiting owner confirmation";
const expectations: Array<{
  state: RentRecordState;
  actor: RentRecordChange["actor"];
  action: RentRecordChange["action"];
  after: RentRecordSnapshot;
}> = [
  {
    state: recorded,
    actor: "tenant",
    action: "transfer-recorded",
    after: snapshot(awaiting, transfer1),
  },
  {
    state: correction1,
    actor: "landlord",
    action: "correction-requested",
    after: snapshot("Needs correction", transfer1, reason1),
  },
  {
    state: revised1,
    actor: "tenant",
    action: "transfer-updated",
    after: snapshot(awaiting, transfer2),
  },
  {
    state: correction2,
    actor: "landlord",
    action: "correction-requested",
    after: snapshot("Needs correction", transfer2, reason2),
  },
  {
    state: revised2,
    actor: "tenant",
    action: "transfer-updated",
    after: snapshot(awaiting, transfer3),
  },
  {
    state: confirmed,
    actor: "landlord",
    action: "confirmed",
    after: snapshot("Confirmed", transfer3),
  },
];
let previousState = initial;
let previousSnapshot = snapshot("Awaiting transfer details");
const snapshotTransfers: Readonly<RentTransfer>[] = [];
for (const [index, expected] of expectations.entries()) {
  const before = record(previousState);
  const current = record(expected.state);
  const event = current.activity.at(-1)!;
  assert.equal(expected.state.records.length, initial.records.length);
  assert.equal(current.activity.length, before.activity.length + 1);
  assert.equal(event.at, at(9 + index).toISOString());
  assert.equal(current.updatedAt, event.at);
  assert.deepEqual(event.change, {
    source: "local",
    actor: expected.actor,
    action: expected.action,
    before: previousSnapshot,
    after: expected.after,
  });
  assert.notEqual(event.change!.before, event.change!.after);
  assert.equal(current.status, expected.after.status);
  assert.deepEqual(current.transfer, expected.after.transfer);
  assert.equal(current.correctionNote, expected.after.correctionNote);
  for (const [oldIndex, oldEvent] of before.activity.entries()) {
    assert.equal(
      current.activity[oldIndex],
      oldEvent,
      "Previous history entries stay unchanged",
    );
  }
  for (const item of previousState.records) {
    if (item.id !== id) assert.equal(record(expected.state, item.id), item);
  }
  for (const savedSnapshot of [event.change!.before, event.change!.after]) {
    if (savedSnapshot.transfer) {
      assert.notEqual(savedSnapshot.transfer, before.transfer);
      assert.notEqual(savedSnapshot.transfer, current.transfer);
      snapshotTransfers.push(savedSnapshot.transfer);
    }
  }
  previousState = expected.state;
  previousSnapshot = expected.after;
}
assert.equal(
  new Set(snapshotTransfers).size,
  snapshotTransfers.length,
  "Each historical transfer is detached from every other snapshot",
);
assert.equal(record(confirmed).confirmedAt, at(14).toISOString());
assert.equal(
  new Set(record(confirmed).activity.map((event) => event.id)).size,
  record(confirmed).activity.length,
);
assert.equal(
  JSON.stringify(initial),
  initialJson,
  "Neither seeds nor their original history are changed retroactively",
);
assert.ok(
  initial.records.every((item) =>
    item.activity.every((event) => !event.change),
  ),
);

// Mutating the current editable transfer object cannot rewrite saved evidence.
const detached = recordRentTransfer(
  initial,
  "tenant",
  id,
  draft(transfer1),
  at(9),
);
const historyJson = JSON.stringify(record(detached).activity);
record(detached).transfer!.reference = "Unrelated later object edit";
record(detached).transfer!.note = "Changed outside the history";
assert.equal(JSON.stringify(record(detached).activity), historyJson);

// First local updates capture known sample/legacy values without inventing history.
const september = record(initial, "rent-2026-09-tenant-ines");
assert.ok(september.transfer);
for (const oldRecord of [
  september,
  {
    ...september,
    status: "Needs correction" as const,
    correctionNote: "Existing legacy correction reason",
    activity: [
      ...september.activity,
      {
        id: "legacy-correction",
        label: "Previously requested correction",
        at: at(8).toISOString(),
      },
    ],
  },
]) {
  const oldState: RentRecordState = { records: [oldRecord] };
  const oldJson = JSON.stringify(oldState);
  const updated = recordRentTransfer(
    oldState,
    "tenant",
    oldRecord.id,
    draft(transfer3),
    at(9),
  );
  const current = record(updated, oldRecord.id);
  assert.equal(current.activity.length, oldRecord.activity.length + 1);
  const change = current.activity.at(-1)!.change!;
  assert.equal(change.action, "transfer-updated");
  assert.deepEqual(
    change.before,
    snapshot(oldRecord.status, oldRecord.transfer, oldRecord.correctionNote),
  );
  assert.deepEqual(change.after, snapshot(awaiting, transfer3));
  assert.notEqual(change.before.transfer, oldRecord.transfer);
  assert.notEqual(change.after.transfer, current.transfer);
  assert.equal(JSON.stringify(oldState), oldJson);
  for (const [index, event] of oldRecord.activity.entries()) {
    assert.equal(current.activity[index], event);
    assert.equal(event.change, undefined);
  }
}

// Denied or invalid attempts cannot append even a label-only history event.
for (const role of [
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
] as const) {
  assert.equal(
    recordRentTransfer(initial, role, id, draft(transfer1), at(9)),
    initial,
  );
}
for (const role of ["tenant", "provider", "spaceOperator", "admin"] as const) {
  assert.equal(
    requestRentCorrection(revised2, role, id, reason1, at(14)),
    revised2,
  );
  assert.equal(confirmRentRecord(revised2, role, id, at(14)), revised2);
}
for (const invalid of [
  { amount: "1.001" },
  { transferredOn: "2026-10-04" },
  { reference: "" },
  { note: "x".repeat(1001) },
]) {
  assert.equal(
    recordRentTransfer(
      initial,
      "tenant",
      id,
      { ...draft(transfer1), ...invalid },
      at(9),
    ),
    initial,
  );
}
for (const note of ["  ", "x".repeat(501)]) {
  assert.equal(
    requestRentCorrection(recorded, "landlord", id, note, at(10)),
    recorded,
  );
}
assert.equal(
  confirmRentRecord(recorded, "landlord", id, at(10)),
  recorded,
  "An amount mismatch cannot produce a confirmation snapshot",
);
for (const state of [initial, correction1, confirmed]) {
  assert.equal(confirmRentRecord(state, "landlord", id, at(15)), state);
  assert.equal(
    requestRentCorrection(state, "landlord", id, reason1, at(15)),
    state,
  );
}
assert.equal(
  recordRentTransfer(confirmed, "tenant", id, draft(transfer1), at(15)),
  confirmed,
);
const foreign: RentRecord = {
  ...initial.records.find((item) => item.tenantId === "tenant-leo")!,
  status: awaiting,
};
for (const foreignRecord of [foreign, { ...foreign, owner: "Olivia Martín" }]) {
  const foreignState: RentRecordState = { records: [foreignRecord] };
  assert.equal(
    recordRentTransfer(
      foreignState,
      "tenant",
      foreignRecord.id,
      draft(transfer1),
      at(15),
    ),
    foreignState,
  );
  assert.equal(
    confirmRentRecord(foreignState, "landlord", foreignRecord.id, at(15)),
    foreignState,
  );
  assert.equal(
    requestRentCorrection(
      foreignState,
      "landlord",
      foreignRecord.id,
      reason1,
      at(15),
    ),
    foreignState,
  );
}
assert.equal(
  recordRentTransfer(initial, "tenant", "missing", draft(transfer1), at(9)),
  initial,
);
assert.equal(
  confirmRentRecord(revised2, "landlord", "missing", at(14)),
  revised2,
);
assert.equal(
  requestRentCorrection(revised2, "landlord", "missing", reason1, at(14)),
  revised2,
);

// Exports describe the current record, not a concatenation of its history.
const current = record(confirmed);
const summary = rentRecordSummary(current);
const csv = rentRecordsCsv([current]);
assert.ok(summary.includes(`Reference: ${transfer3.reference}`));
assert.ok(
  summary.includes(
    `Recorded transfer: EUR ${(transfer3.amountCents / 100).toFixed(2)} on ${transfer3.transferredOn}`,
  ),
);
assert.ok(summary.includes("Status: Confirmed"));
assert.ok(
  csv.includes(`"${transfer3.reference}","Confirmed","","${transfer3.note}"`),
);
assert.equal(csv.trimEnd().split("\r\n").length, 2);
for (const text of [
  transfer1.reference,
  transfer1.note,
  transfer2.reference,
  transfer2.note,
  reason1,
  reason2,
]) {
  assert.equal(summary.includes(text), false);
  assert.equal(csv.includes(text), false);
}
const correctionCsv = rentRecordsCsv([record(correction2)]);
assert.ok(correctionCsv.includes(`"Needs correction","${reason2}"`));
assert.equal(correctionCsv.includes(reason1), false);

for (const role of ["tenant", "landlord"] as const) {
  const dashboard = buildPropertyOperationsSummary({
    role,
    rentState: { records: [current] },
    applicationState: { records: [] },
    maintenanceState: { ...createInitialMaintenanceState(), records: [] },
    now: at(15),
  });
  assert.equal(dashboard.recentActivity.length, 6);
  for (const entry of dashboard.recentActivity) {
    assert.deepEqual(Object.keys(entry).sort(), [
      "at",
      "id",
      "label",
      "property",
      "recordId",
      "view",
    ]);
    assert.equal(entry.recordId, id);
    assert.equal(entry.view, "rent");
    assert.ok(
      current.activity.some(
        (event) => event.label === entry.label && event.at === entry.at,
      ),
    );
  }
  const feed = JSON.stringify(dashboard.recentActivity);
  for (const text of [
    transfer1.reference,
    transfer1.note,
    transfer2.reference,
    transfer2.note,
    transfer3.reference,
    transfer3.note,
    reason1,
    reason2,
  ]) {
    assert.equal(
      feed.includes(text),
      false,
      "Dashboard activity must not project private change payloads",
    );
  }
}

console.log(
  "Rent history checks passed: correction cycles, detached snapshots, legacy preservation, guarded actions, and latest-only exports.",
);
