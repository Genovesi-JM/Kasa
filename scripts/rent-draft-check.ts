import assert from "node:assert/strict";
import {
  confirmRentRecord,
  createInitialRentRecordState,
  discardRentCorrectionDraft,
  discardRentTransferDraft,
  hasRentCorrectionDraft,
  hasRentTransferDraft,
  recordRentTransfer,
  rentCorrectionDraft,
  rentRecordSummary,
  rentRecordsCsv,
  rentTransferDraft,
  requestRentCorrection,
  submitRentCorrectionDraft,
  submitRentTransferDraft,
  updateRentCorrectionDraft,
  updateRentTransferDraft,
  type RentCorrectionDraft,
  type RentRecordState,
  type RentTransferDraft,
} from "../src/components/rentRecordState";
import type { Role } from "../src/types";

const now = new Date(2026, 9, 3, 12);
const october = "rent-2026-10-tenant-ines";
const september = "rent-2026-09-tenant-ines";
const august = "rent-2026-08-tenant-ines";
const initial = createInitialRentRecordState();
const initialJson = JSON.stringify(initial);
const record = (state: RentRecordState, id = october) => {
  const found = state.records.find((item) => item.id === id);
  assert.ok(found);
  return found;
};
const transfer = (state: RentRecordState, id = october) => {
  const found = rentTransferDraft(state, "tenant", id, now);
  assert.ok(found);
  return found;
};
const correction = (state: RentRecordState, id = september) => {
  const found = rentCorrectionDraft(state, "landlord", id);
  assert.ok(found);
  return found;
};
const putTransfer = (
  state: RentRecordState,
  id: string,
  values: Partial<RentTransferDraft>,
) =>
  updateRentTransferDraft(
    state,
    "tenant",
    id,
    values,
    transfer(state, id).recordVersion,
    now,
  );
const putCorrection = (
  state: RentRecordState,
  id: string,
  values: Partial<RentCorrectionDraft>,
) =>
  updateRentCorrectionDraft(
    state,
    "landlord",
    id,
    values,
    correction(state, id).recordVersion,
  );
const recordedOutput = (state: RentRecordState) => ({
  records: JSON.stringify(state.records),
  summaries: state.records.map((item) => rentRecordSummary(item)),
  csv: rentRecordsCsv(state.records),
});
const validTransfer: RentTransferDraft = {
  amount: (record(initial).amountDueCents / 100).toFixed(2),
  transferredOn: "2026-10-02",
  reference: "  PRIVATE-OCT-REFERENCE  ",
  note: "  Private transfer draft\nwith a second line.  ",
};

// Reading a form, including legacy state, must not create work or share objects.
for (const state of [initial, { records: initial.records }]) {
  const before = JSON.stringify(state);
  const first = transfer(state);
  const second = transfer(state);
  assert.notEqual(first, second);
  assert.notEqual(first.values, second.values);
  assert.equal(first.stale, false);
  assert.deepEqual(first.values, {
    amount: validTransfer.amount,
    transferredOn: "2026-10-03",
    reference: "",
    note: "",
  });
  first.values.reference = "Do not retain a read";
  first.recordVersion = "Do not alter another descriptor";
  assert.deepEqual(transfer(state), second);
  const owner = correction(state);
  owner.values.note = "Do not retain an owner read";
  assert.deepEqual(correction(state).values, { note: "" });
  assert.equal(hasRentTransferDraft(state, "tenant", october), false);
  assert.equal(hasRentCorrectionDraft(state, "landlord", september), false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(discardRentTransferDraft(state, "tenant", october), state);
  assert.equal(discardRentCorrectionDraft(state, "landlord", september), state);
  const edited = putTransfer(state, october, {
    reference: "Legacy-compatible edit",
  });
  assert.equal(hasRentTransferDraft(edited, "tenant", october), true);
  assert.equal(edited.records, state.records);
  assert.equal(JSON.stringify(state), before);
}
assert.notEqual(initial.formDrafts, createInitialRentRecordState().formDrafts);
assert.deepEqual(transfer(initial, september).values, {
  amount: (record(initial, september).transfer!.amountCents / 100).toFixed(2),
  transferredOn: "2026-09-02",
  reference: "EXAMPLE-SEP-INES",
  note: "Sample transfer awaiting owner review.",
});
assert.equal(rentTransferDraft(initial, "tenant", august, now), null);
assert.equal(rentCorrectionDraft(initial, "landlord", august), null);
assert.equal(rentCorrectionDraft(initial, "landlord", october), null);
assert.equal(
  submitRentTransferDraft(
    initial,
    "tenant",
    october,
    transfer(initial).recordVersion,
    now,
  ).issue,
  "noDraft",
);
assert.equal(
  submitRentCorrectionDraft(
    initial,
    "landlord",
    september,
    correction(initial).recordVersion,
    now,
  ).issue,
  "noDraft",
);

// Recognized string writes explicitly retain defaults; bad patches never erase data.
for (const patch of [
  {},
  { unknown: "ignored" },
  { reference: 123 },
  { note: 123 },
  null,
  undefined,
  [],
]) {
  assert.equal(
    putTransfer(initial, october, patch as Partial<RentTransferDraft>),
    initial,
  );
  assert.equal(
    putCorrection(initial, september, patch as Partial<RentCorrectionDraft>),
    initial,
  );
}
const defaultsSaved = putTransfer(initial, october, transfer(initial).values);
assert.equal(hasRentTransferDraft(defaultsSaved, "tenant", october), true);
assert.equal(
  putTransfer(defaultsSaved, october, transfer(defaultsSaved).values),
  defaultsSaved,
);
const correctionDefaultSaved = putCorrection(initial, september, { note: "" });
assert.equal(
  hasRentCorrectionDraft(correctionDefaultSaved, "landlord", september),
  true,
);
assert.equal(
  putCorrection(correctionDefaultSaved, september, { note: "" }),
  correctionDefaultSaved,
);
const wrongToken = "not-the-current-record-version";
assert.equal(
  updateRentTransferDraft(
    initial,
    "tenant",
    october,
    validTransfer,
    wrongToken,
    now,
  ),
  initial,
);
assert.equal(
  updateRentCorrectionDraft(
    initial,
    "landlord",
    september,
    { note: "Private reason" },
    wrongToken,
  ),
  initial,
);

const raw: RentTransferDraft = {
  amount: " 1.005 ",
  transferredOn: "2026-02-30",
  reference: "unfinished\nreference",
  note: `\n${"n".repeat(1001)}\n`,
};
const rawState = putTransfer(initial, october, raw);
assert.deepEqual(transfer(rawState).values, raw);
raw.reference = "Mutation of caller input";
assert.equal(transfer(rawState).values.reference, "unfinished\nreference");
const readRaw = transfer(rawState);
readRaw.values.note = "Mutation of detached getter";
assert.notEqual(transfer(rawState).values.note, readRaw.values.note);
const mixed = putTransfer(rawState, october, {
  reference: "  New private reference  ",
  amount: 4,
  unknown: "ignored",
} as unknown as Partial<RentTransferDraft>);
assert.equal(transfer(mixed).values.amount, " 1.005 ");
assert.equal(transfer(mixed).values.reference, "  New private reference  ");
assert.equal("unknown" in transfer(mixed).values, false);
const invalid = submitRentTransferDraft(
  rawState,
  "tenant",
  october,
  transfer(rawState).recordVersion,
  now,
);
assert.equal(invalid.state, rawState);
assert.equal(invalid.recordId, null);
assert.equal(invalid.issue, null);
assert.deepEqual(invalid.issues, {
  amount: "amount",
  transferredOn: "transferredOn",
  reference: "reference",
  note: "note",
});
for (const note of ["   ", "x".repeat(501)]) {
  const state = putCorrection(initial, september, { note });
  const result = submitRentCorrectionDraft(
    state,
    "landlord",
    september,
    correction(state).recordVersion,
    now,
  );
  assert.equal(result.state, state);
  assert.equal(result.recordId, null);
  assert.equal(result.issue, null);
  assert.deepEqual(result.issues, { note: "note" });
  assert.equal(correction(state).values.note, note);
}
for (const state of [defaultsSaved, correctionDefaultSaved, rawState, mixed]) {
  assert.equal(state.records, initial.records);
  assert.deepEqual(recordedOutput(state), recordedOutput(initial));
}

// Draft privacy follows stable identities and canonical owner scope, not names.
const foreignId = "foreign-unconfirmed-record";
const ownerSpoofId = "foreign-property-owner-name-spoof";
const foreignState: RentRecordState = {
  ...initial,
  records: [
    ...initial.records,
    {
      ...record(initial, september),
      id: foreignId,
      tenantId: "tenant-someone-else",
      owner: "Another owner",
    },
    {
      ...record(initial, september),
      id: ownerSpoofId,
      tenantId: "tenant-someone-else",
      propertyId: 2,
    },
  ],
  formDrafts: {
    tenant: {
      [foreignId]: { values: validTransfer, recordVersion: "private" },
    },
    landlord: {
      [ownerSpoofId]: {
        values: { note: "Private foreign reason" },
        recordVersion: "private",
      },
    },
  },
};
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
  "unknown" as Role,
];
for (const role of roles) {
  for (const id of ["missing", foreignId, ownerSpoofId]) {
    assert.equal(rentTransferDraft(foreignState, role, id, now), null);
    assert.equal(rentCorrectionDraft(foreignState, role, id), null);
    assert.equal(hasRentTransferDraft(foreignState, role, id), false);
    assert.equal(hasRentCorrectionDraft(foreignState, role, id), false);
    assert.equal(
      updateRentTransferDraft(
        foreignState,
        role,
        id,
        validTransfer,
        "private",
        now,
      ),
      foreignState,
    );
    assert.equal(
      updateRentCorrectionDraft(
        foreignState,
        role,
        id,
        { note: "Changed" },
        "private",
      ),
      foreignState,
    );
    assert.equal(
      discardRentTransferDraft(foreignState, role, id),
      foreignState,
    );
    assert.equal(
      discardRentCorrectionDraft(foreignState, role, id),
      foreignState,
    );
    for (const result of [
      submitRentTransferDraft(foreignState, role, id, "private", now),
      submitRentCorrectionDraft(foreignState, role, id, "private", now),
    ]) {
      assert.equal(result.state, foreignState);
      assert.equal(result.recordId, null);
      assert.equal(result.issue, "unavailable");
    }
  }
  if (role !== "tenant") {
    assert.equal(rentTransferDraft(defaultsSaved, role, october, now), null);
    assert.equal(hasRentTransferDraft(defaultsSaved, role, october), false);
    assert.equal(
      updateRentTransferDraft(
        defaultsSaved,
        role,
        october,
        validTransfer,
        transfer(defaultsSaved).recordVersion,
        now,
      ),
      defaultsSaved,
    );
    assert.equal(
      discardRentTransferDraft(defaultsSaved, role, october),
      defaultsSaved,
    );
    const result = submitRentTransferDraft(
      defaultsSaved,
      role,
      october,
      transfer(defaultsSaved).recordVersion,
      now,
    );
    assert.equal(result.state, defaultsSaved);
    assert.equal(result.issue, "unavailable");
    assert.equal(result.recordId, null);
  }
  if (role !== "landlord") {
    assert.equal(
      rentCorrectionDraft(correctionDefaultSaved, role, september),
      null,
    );
    assert.equal(
      hasRentCorrectionDraft(correctionDefaultSaved, role, september),
      false,
    );
    assert.equal(
      updateRentCorrectionDraft(
        correctionDefaultSaved,
        role,
        september,
        { note: "Changed" },
        correction(correctionDefaultSaved).recordVersion,
      ),
      correctionDefaultSaved,
    );
    assert.equal(
      discardRentCorrectionDraft(correctionDefaultSaved, role, september),
      correctionDefaultSaved,
    );
    const result = submitRentCorrectionDraft(
      correctionDefaultSaved,
      role,
      september,
      correction(correctionDefaultSaved).recordVersion,
      now,
    );
    assert.equal(result.state, correctionDefaultSaved);
    assert.equal(result.issue, "unavailable");
    assert.equal(result.recordId, null);
  }
}

// Save one transfer atomically without consuming another month or actor's work.
let multiple = putTransfer(initial, october, validTransfer);
multiple = putTransfer(multiple, september, {
  reference: "Private unfinished September edit",
});
multiple = putCorrection(multiple, september, {
  note: "  Private owner reason\nkept until submitted.  ",
});
const beforeMultiple = JSON.stringify(multiple);
assert.deepEqual(recordedOutput(multiple), recordedOutput(initial));
for (const result of [
  submitRentTransferDraft(
    multiple,
    "tenant",
    october,
    transfer(multiple).recordVersion,
    new Date(NaN),
  ),
  submitRentCorrectionDraft(
    multiple,
    "landlord",
    september,
    correction(multiple).recordVersion,
    new Date(NaN),
  ),
]) {
  assert.equal(result.state, multiple);
  assert.equal(result.recordId, null);
  assert.equal(result.issue, "unavailable");
}
const saved = submitRentTransferDraft(
  multiple,
  "tenant",
  october,
  transfer(multiple).recordVersion,
  now,
);
assert.equal(saved.recordId, october);
assert.equal(saved.issue, null);
assert.deepEqual(saved.issues, {});
assert.equal(hasRentTransferDraft(saved.state, "tenant", october), false);
assert.deepEqual(
  transfer(saved.state, september),
  transfer(multiple, september),
);
assert.deepEqual(correction(saved.state), correction(multiple));
assert.equal(saved.state.formDrafts?.landlord, multiple.formDrafts?.landlord);
assert.equal(saved.state.records.length, multiple.records.length);
for (const item of multiple.records) {
  if (item.id !== october) assert.equal(record(saved.state, item.id), item);
}
assert.equal(record(saved.state).status, "Awaiting owner confirmation");
assert.deepEqual(record(saved.state).transfer, {
  amountCents: record(initial).amountDueCents,
  transferredOn: validTransfer.transferredOn,
  reference: validTransfer.reference.trim(),
  note: validTransfer.note.trim(),
});
assert.equal(
  record(saved.state).activity.length,
  record(initial).activity.length + 1,
);
assert.equal(JSON.stringify(multiple), beforeMultiple);
const retry = submitRentTransferDraft(
  saved.state,
  "tenant",
  october,
  transfer(saved.state).recordVersion,
  now,
);
assert.equal(retry.state, saved.state);
assert.equal(retry.recordId, null);
assert.equal(retry.issue, "noDraft");
assert.equal(
  submitRentTransferDraft(multiple, "tenant", october, wrongToken, now).issue,
  "stale",
);
assert.equal(
  submitRentCorrectionDraft(multiple, "landlord", september, wrongToken, now)
    .issue,
  "stale",
);

// Saving a correction keeps both the other owner's draft and a now-stale tenant draft.
const otherOwnerDraft = putCorrection(saved.state, october, {
  note: "Private October owner work",
});
const corrected = submitRentCorrectionDraft(
  otherOwnerDraft,
  "landlord",
  september,
  correction(otherOwnerDraft).recordVersion,
  now,
);
assert.equal(corrected.recordId, september);
assert.equal(corrected.issue, null);
assert.deepEqual(corrected.issues, {});
assert.equal(
  hasRentCorrectionDraft(corrected.state, "landlord", september),
  false,
);
assert.deepEqual(
  correction(corrected.state, october),
  correction(otherOwnerDraft, october),
);
assert.equal(
  corrected.state.formDrafts?.tenant,
  otherOwnerDraft.formDrafts?.tenant,
);
assert.equal(transfer(corrected.state, september).stale, true);
assert.equal(
  transfer(corrected.state, september).values.reference,
  "Private unfinished September edit",
);
assert.equal(record(corrected.state, september).status, "Needs correction");
assert.equal(
  record(corrected.state, september).correctionNote,
  "Private owner reason\nkept until submitted.",
);
assert.equal(
  record(corrected.state, september).activity.length,
  record(initial, september).activity.length + 1,
);
for (const item of otherOwnerDraft.records) {
  if (item.id !== september)
    assert.equal(record(corrected.state, item.id), item);
}
const correctionRetry = submitRentCorrectionDraft(
  corrected.state,
  "landlord",
  september,
  correction(otherOwnerDraft).recordVersion,
  now,
);
assert.equal(correctionRetry.state, corrected.state);
assert.equal(correctionRetry.recordId, null);
assert.equal(correctionRetry.issue, "unavailable");

// Real record transitions invalidate retained forms even in the same clock tick.
const ready = recordRentTransfer(
  initial,
  "tenant",
  october,
  validTransfer,
  now,
);
let retained = putTransfer(ready, october, {
  reference: "Private pending revision",
});
retained = putCorrection(retained, october, {
  note: "Private pending correction",
});
retained = putTransfer(retained, september, {
  reference: "Private other record",
});
const oldTransfer = transfer(retained);
const oldCorrection = correction(retained, october);
const actions = [
  recordRentTransfer(retained, "tenant", october, validTransfer, now),
  requestRentCorrection(
    retained,
    "landlord",
    october,
    "Actual saved correction",
    now,
  ),
  confirmRentRecord(retained, "landlord", october, now),
];
for (const changed of actions) {
  assert.notEqual(changed, retained);
  assert.equal(record(changed).updatedAt, record(retained).updatedAt);
  assert.equal(changed.formDrafts, retained.formDrafts);
  assert.equal(transfer(changed).stale, true);
  assert.equal(correction(changed, october).stale, true);
  assert.deepEqual(transfer(changed).values, oldTransfer.values);
  assert.deepEqual(correction(changed, october).values, oldCorrection.values);
  assert.equal(
    updateRentTransferDraft(
      changed,
      "tenant",
      october,
      { reference: "Do not overwrite" },
      oldTransfer.recordVersion,
      now,
    ),
    changed,
  );
  assert.equal(
    updateRentCorrectionDraft(
      changed,
      "landlord",
      october,
      { note: "Do not overwrite" },
      oldCorrection.recordVersion,
    ),
    changed,
  );
  for (const result of [
    submitRentTransferDraft(
      changed,
      "tenant",
      october,
      oldTransfer.recordVersion,
      now,
    ),
    submitRentCorrectionDraft(
      changed,
      "landlord",
      october,
      oldCorrection.recordVersion,
      now,
    ),
  ]) {
    assert.equal(result.state, changed);
    assert.equal(result.recordId, null);
    assert.equal(result.issue, "stale");
  }
  const withoutTenant = discardRentTransferDraft(changed, "tenant", october);
  assert.equal(hasRentTransferDraft(withoutTenant, "tenant", october), false);
  assert.equal(
    hasRentCorrectionDraft(withoutTenant, "landlord", october),
    true,
  );
  assert.equal(withoutTenant.records, changed.records);
  assert.deepEqual(
    transfer(withoutTenant, september),
    transfer(changed, september),
  );
  const withoutBoth = discardRentCorrectionDraft(
    withoutTenant,
    "landlord",
    october,
  );
  assert.equal(hasRentCorrectionDraft(withoutBoth, "landlord", october), false);
  assert.equal(withoutBoth.records, changed.records);
  if (record(changed).status === "Confirmed") {
    assert.equal(rentTransferDraft(withoutBoth, "tenant", october, now), null);
    assert.equal(rentCorrectionDraft(withoutBoth, "landlord", october), null);
    assert.equal(
      submitRentTransferDraft(
        withoutBoth,
        "tenant",
        october,
        oldTransfer.recordVersion,
        now,
      ).issue,
      "unavailable",
    );
    assert.equal(
      submitRentCorrectionDraft(
        withoutBoth,
        "landlord",
        october,
        oldCorrection.recordVersion,
        now,
      ).issue,
      "unavailable",
    );
  }
}

// Saving refreshed work after explicitly discarding stale values succeeds once.
const stale = actions[1];
const discarded = discardRentTransferDraft(stale, "tenant", october);
assert.equal(transfer(discarded).stale, false);
assert.notEqual(transfer(discarded).recordVersion, oldTransfer.recordVersion);
const refreshed = putTransfer(discarded, october, {
  ...validTransfer,
  reference: "Freshly reviewed details",
});
const freshSave = submitRentTransferDraft(
  refreshed,
  "tenant",
  october,
  transfer(refreshed).recordVersion,
  now,
);
assert.equal(freshSave.recordId, october);
assert.equal(
  record(freshSave.state).transfer!.reference,
  "Freshly reviewed details",
);
assert.equal(hasRentTransferDraft(freshSave.state, "tenant", october), false);
assert.equal(
  hasRentCorrectionDraft(freshSave.state, "landlord", october),
  true,
);
assert.equal(correction(freshSave.state, october).stale, true);
assert.equal(JSON.stringify(initial), initialJson);

console.log("Resumable rent draft checks passed.");
