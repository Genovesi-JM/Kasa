import assert from "node:assert/strict";
import {
  createInitialExpenseState,
  discardExpenseCreateDraft,
  discardExpenseEditDraft,
  expenseCreateDraft,
  expenseEditDraft,
  expenseEditDrafts,
  expenseProperties,
  expenseSummary,
  expenseUndo,
  expenseView,
  hasExpenseCreateDraft,
  hasExpenseEditDraft,
  parseExpenseAmount,
  removeExpenseRecord,
  resetExpenseFilters,
  restoreExpenseRecord,
  scopedExpenseRecords,
  submitExpenseCreateDraft,
  submitExpenseEditDraft,
  updateExpenseCreateDraft,
  updateExpenseEditDraft,
  updateExpenseView,
  visibleExpenseRecords,
  type ExpenseDraft,
  type ExpenseState,
} from "../src/components/expenseState";
import { ownedProperties, workspaceLandlordName } from "../src/propertyScope";
import type { Role } from "../src/types";

const now = new Date(2032, 4, 10, 12);
const initial = createInitialExpenseState();
const initialJson = JSON.stringify(initial);
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
  "unknown" as Role,
];
const unavailableRoles = roles.filter((role) => role !== "landlord");
const property = expenseProperties("landlord")[0];
assert.ok(property);
const values: ExpenseDraft = {
  propertyId: String(property.id),
  date: "2032-05-09",
  category: "repairs",
  amount: " 125,50 ",
  payee: "  Example repair shop  ",
  reference: "  EXAMPLE-125  ",
  note: "  Private recorded context\nwith a second line.  ",
};
function createDraft(state: ExpenseState) {
  const value = expenseCreateDraft(state, "landlord", now);
  assert.ok(value);
  return value;
}
function record(state: ExpenseState, id: string) {
  const value = scopedExpenseRecords(state, "landlord", true).find(
    (item) => item.id === id,
  );
  assert.ok(value);
  return value;
}
function editDraft(state: ExpenseState, id: string) {
  const value = expenseEditDraft(state, "landlord", id);
  assert.ok(value);
  return value;
}
function create(state: ExpenseState, patch: Partial<ExpenseDraft> = {}) {
  const retained = updateExpenseCreateDraft(
    state,
    "landlord",
    { ...values, ...patch },
    now,
  );
  const result = submitExpenseCreateDraft(retained, "landlord", now);
  assert.ok(result.recordId);
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  return { state: result.state, id: result.recordId };
}
function updateEdit(
  state: ExpenseState,
  id: string,
  patch: Partial<ExpenseDraft>,
) {
  return updateExpenseEditDraft(
    state,
    "landlord",
    id,
    patch,
    editDraft(state, id).recordRevision,
  );
}
const defaultView = {
  query: "",
  property: "All properties",
  category: "All categories",
  sort: "Newest date",
};

// An empty ledger and detached defaults do not invent expenses or private work.
assert.deepEqual(scopedExpenseRecords(initial, "landlord"), []);
assert.deepEqual(visibleExpenseRecords(initial, "landlord"), []);
assert.deepEqual(expenseSummary(initial, "landlord"), {
  count: 0,
  totalCents: 0,
});
assert.deepEqual(
  expenseProperties("landlord"),
  ownedProperties("landlord").map(({ id, title }) => ({ id, title })),
);
assert.deepEqual(expenseView(initial, "landlord"), defaultView);
assert.deepEqual(createDraft(initial), {
  propertyId: String(property.id),
  date: "2032-05-10",
  category: "other",
  amount: "",
  payee: "",
  reference: "",
  note: "",
});
const detachedCreate = createDraft(initial);
detachedCreate.note = "Do not retain a read";
assert.equal(createDraft(initial).note, "");
const detachedView = expenseView(initial, "landlord");
detachedView.query = "Do not change the stored view";
assert.deepEqual(expenseView(initial, "landlord"), defaultView);
assert.equal(hasExpenseCreateDraft(initial, "landlord"), false);
assert.deepEqual(expenseEditDrafts(initial, "landlord"), []);
assert.equal(expenseUndo(initial, "landlord"), null);
assert.equal(discardExpenseCreateDraft(initial, "landlord"), initial);
assert.equal(resetExpenseFilters(initial, "landlord"), initial);
assert.equal(
  submitExpenseCreateDraft(initial, "landlord", now).issue,
  "noDraft",
);
assert.equal(JSON.stringify(initial), initialJson);
const explicitDefaults = updateExpenseCreateDraft(
  initial,
  "landlord",
  createDraft(initial),
  now,
);
assert.equal(hasExpenseCreateDraft(explicitDefaults, "landlord"), true);
assert.equal(
  updateExpenseCreateDraft(
    explicitDefaults,
    "landlord",
    createDraft(explicitDefaults),
    now,
  ),
  explicitDefaults,
);
assert.equal(
  hasExpenseCreateDraft(createInitialExpenseState(), "landlord"),
  false,
);
for (const patch of [
  {},
  { unexpected: "ignore" },
  { amount: 1 },
  { note: null },
  null,
  undefined,
  [],
])
  assert.equal(
    updateExpenseCreateDraft(
      initial,
      "landlord",
      patch as Partial<ExpenseDraft>,
      now,
    ),
    initial,
  );

// Amount parsing never rounds fractional cents or accepts ambiguous numeric syntax.
for (const [input, expected] of [
  ["0.01", 1],
  ["0,01", 1],
  ["1", 100],
  ["001,20", 120],
  [" 125.50 ", 12550],
  ["1000000", 100000000],
  ["1000000.00", 100000000],
] as const)
  assert.equal(parseExpenseAmount(input), expected);
for (const input of [
  "",
  " ",
  "0",
  "-1",
  "+1",
  "1.005",
  "0.001",
  "1.999",
  "1000000.01",
  "1e3",
  "0x10",
  "1,000.00",
  "1.000,00",
  ".50",
  "1.",
  "NaN",
  "Infinity",
])
  assert.equal(
    parseExpenseAmount(input),
    null,
    `Reject amount ${JSON.stringify(input)}`,
  );

const raw: ExpenseDraft = {
  propertyId: "not a property",
  date: "unfinished",
  category: "unfinished",
  amount: " 1.005 ",
  payee: "\nUnfinished payee\n",
  reference: "unfinished\nreference",
  note: ` \n${"n".repeat(2001)}\n `,
};
const rawState = updateExpenseCreateDraft(initial, "landlord", raw, now);
assert.deepEqual(createDraft(rawState), raw);
raw.amount = "Caller mutation";
assert.equal(createDraft(rawState).amount, " 1.005 ");
const mixed = updateExpenseCreateDraft(
  rawState,
  "landlord",
  {
    note: " raw replacement ",
    amount: 123,
    owner: "Forged owner",
  } as unknown as Partial<ExpenseDraft>,
  now,
);
assert.equal(createDraft(mixed).amount, " 1.005 ");
assert.equal(createDraft(mixed).note, " raw replacement ");
assert.equal("owner" in createDraft(mixed), false);
assert.deepEqual(expenseSummary(mixed, "landlord"), {
  count: 0,
  totalCents: 0,
});
const invalidRaw = submitExpenseCreateDraft(rawState, "landlord", now);
assert.equal(invalidRaw.state, rawState);
assert.equal(invalidRaw.recordId, null);
assert.equal(invalidRaw.issue, null);
for (const field of [
  "propertyId",
  "date",
  "category",
  "amount",
  "payee",
  "reference",
  "note",
] as const)
  assert.ok(invalidRaw.errors[field], `Invalid ${field} retains the raw draft`);
const invalidFields: Array<[keyof ExpenseDraft, string]> = [
  ["propertyId", "2"],
  ["propertyId", "999"],
  ["propertyId", "01"],
  ["propertyId", "1.0"],
  ["propertyId", "+1"],
  ["date", "2032-02-30"],
  ["date", "2031-02-29"],
  ["date", "2032-5-09"],
  ["date", "2032-13-01"],
  ["date", "2032-05-11"],
  ["category", "tax-deductible"],
  ["amount", "1.005"],
  ["amount", "1000000.01"],
  ["payee", "p".repeat(121)],
  ["payee", "first\nsecond"],
  ["reference", "r".repeat(161)],
  ["reference", "first\rsecond"],
  ["note", "n".repeat(2001)],
];
for (const [field, value] of invalidFields) {
  const state = updateExpenseCreateDraft(
    initial,
    "landlord",
    { ...values, [field]: value },
    now,
  );
  const result = submitExpenseCreateDraft(state, "landlord", now);
  assert.equal(result.state, state);
  assert.equal(result.recordId, null);
  assert.ok(result.errors[field], `${field} rejects ${JSON.stringify(value)}`);
  assert.equal(createDraft(result.state)[field], value);
}
for (const patch of [
  { amount: "0.01", date: "2032-02-29", category: "utilities" },
  {
    amount: "1000000.00",
    date: "2032-05-10",
    category: "insurance",
    payee: "p".repeat(120),
    reference: "r".repeat(160),
    note: "n".repeat(2000),
  },
  { category: "supplies", payee: "", reference: "", note: "" },
  { category: "other" },
])
  assert.equal(
    scopedExpenseRecords(create(initial, patch).state, "landlord").length,
    1,
  );

// Successful creation reveals its record, preserves sorting and consumes only that form.
let filtered = updateExpenseView(initial, "landlord", {
  query: " does not match ",
  property: String(property.id),
  category: "insurance",
  sort: "Amount: high to low",
});
const first = create(filtered);
const firstRecord = record(first.state, first.id);
assert.equal(firstRecord.amountCents, 12550);
assert.equal(firstRecord.propertyId, property.id);
assert.equal(firstRecord.propertyTitle, property.title);
assert.equal(firstRecord.owner, workspaceLandlordName);
assert.equal(firstRecord.payee, values.payee.trim());
assert.equal(firstRecord.reference, values.reference.trim());
assert.equal(firstRecord.note, values.note.trim());
assert.equal(firstRecord.revision, 1);
assert.equal(firstRecord.removedAt, null);
assert.equal(firstRecord.createdAt, now.toISOString());
assert.equal(firstRecord.updatedAt, now.toISOString());
assert.equal(firstRecord.history.length, 1);
assert.equal(firstRecord.history[0].action, "created");
assert.equal(firstRecord.history[0].before, null);
assert.equal(firstRecord.history[0].after.amountCents, 12550);
assert.equal(hasExpenseCreateDraft(first.state, "landlord"), false);
assert.deepEqual(expenseView(first.state, "landlord"), {
  ...defaultView,
  sort: "Amount: high to low",
});
assert.deepEqual(expenseSummary(first.state, "landlord"), {
  count: 1,
  totalCents: 12550,
});
assert.equal(
  submitExpenseCreateDraft(first.state, "landlord", now).issue,
  "noDraft",
);
for (const key of [
  "paid",
  "paymentStatus",
  "paidAt",
  "receiptVerified",
  "bankAccount",
  "transactionId",
])
  assert.equal(
    key in firstRecord,
    false,
    "An expense record does not imply payment or receipt verification",
  );

const second = create(first.state, {
  amount: "20",
  date: "2032-04-01",
  category: "supplies",
  payee: "Second expense",
});
assert.notEqual(second.id, first.id);
assert.equal(record(second.state, first.id), firstRecord);
assert.deepEqual(expenseSummary(second.state, "landlord"), {
  count: 2,
  totalCents: 14550,
});
assert.equal(expenseEditDraft(second.state, "landlord", "missing"), null);
assert.equal(
  submitExpenseEditDraft(
    second.state,
    "landlord",
    first.id,
    firstRecord.revision,
    now,
  ).issue,
  "noDraft",
);
const editDefaults = editDraft(second.state, first.id);
assert.equal(editDefaults.recordRevision, firstRecord.revision);
assert.equal(editDefaults.stale, false);
assert.equal(editDefaults.values.amount, "125.50");
editDefaults.values.note = "Do not retain detached edit defaults";
assert.equal(editDraft(second.state, first.id).values.note, values.note.trim());
assert.equal(hasExpenseEditDraft(second.state, "landlord", first.id), false);

// Editing one row keeps another row's private edit and the unfinished create form.
let editing = updateEdit(second.state, second.id, {
  note: "PRIVATE other row edit",
});
editing = updateExpenseCreateDraft(
  editing,
  "landlord",
  { note: "PRIVATE unfinished new expense" },
  now,
);
editing = updateEdit(editing, first.id, {
  amount: "150.25",
  reference: " Revised reference ",
  note: " Revised\nrecorded explanation ",
});
const editingSnapshot = JSON.stringify(editing);
const returnedEdit = editDraft(editing, first.id);
returnedEdit.values.amount = "999";
assert.equal(editDraft(editing, first.id).values.amount, "150.25");
const returnedList = expenseEditDrafts(editing, "landlord");
returnedList.find((item) => item.recordId === first.id)!.values.note =
  "Do not mutate through list";
assert.equal(
  editDraft(editing, first.id).values.note,
  " Revised\nrecorded explanation ",
);
assert.equal(
  updateEdit(editing, first.id, editDraft(editing, first.id).values),
  editing,
);
assert.equal(
  updateExpenseEditDraft(
    editing,
    "landlord",
    first.id,
    { note: "Wrong revision" },
    999,
  ),
  editing,
);
assert.deepEqual(expenseSummary(editing, "landlord"), {
  count: 2,
  totalCents: 14550,
});
assert.equal(record(editing, first.id), firstRecord);
const edited = submitExpenseEditDraft(
  editing,
  "landlord",
  first.id,
  firstRecord.revision,
  now,
);
assert.equal(edited.recordId, first.id);
assert.equal(edited.issue, null);
assert.deepEqual(edited.errors, {});
assert.equal(hasExpenseEditDraft(edited.state, "landlord", first.id), false);
assert.deepEqual(
  editDraft(edited.state, second.id),
  editDraft(editing, second.id),
);
assert.deepEqual(createDraft(edited.state), createDraft(editing));
assert.equal(record(edited.state, second.id), record(editing, second.id));
const revisedRecord = record(edited.state, first.id);
assert.equal(revisedRecord.revision, firstRecord.revision + 1);
assert.equal(
  revisedRecord.updatedAt,
  firstRecord.updatedAt,
  "Revision protects changes made in the same clock tick",
);
assert.equal(revisedRecord.amountCents, 15025);
assert.equal(revisedRecord.history.length, 2);
assert.equal(revisedRecord.history[0], firstRecord.history[0]);
assert.equal(revisedRecord.history[1].action, "updated");
assert.equal(revisedRecord.history[1].before!.amountCents, 12550);
assert.equal(revisedRecord.history[1].after.amountCents, 15025);
assert.equal(
  revisedRecord.history[1].after.note,
  "Revised\nrecorded explanation",
);
assert.notEqual(
  revisedRecord.history[1].before,
  revisedRecord.history[1].after,
);
assert.equal(JSON.stringify(editing), editingSnapshot);
const createdWhileEditing = create(editing, {
  category: "other",
  amount: "3.20",
});
assert.deepEqual(
  expenseEditDrafts(createdWhileEditing.state, "landlord"),
  expenseEditDrafts(editing, "landlord"),
);
assert.equal(
  record(createdWhileEditing.state, first.id),
  record(editing, first.id),
);
assert.equal(
  record(createdWhileEditing.state, second.id),
  record(editing, second.id),
);

// An unchanged explicit save consumes only the draft and does not invent a revision/event.
let unchanged = updateExpenseView(edited.state, "landlord", {
  query: " hidden ",
  category: "utilities",
  sort: "Oldest date",
});
unchanged = updateEdit(
  unchanged,
  first.id,
  editDraft(unchanged, first.id).values,
);
assert.equal(hasExpenseEditDraft(unchanged, "landlord", first.id), true);
const noChange = submitExpenseEditDraft(
  unchanged,
  "landlord",
  first.id,
  revisedRecord.revision,
  now,
);
assert.equal(noChange.recordId, first.id);
assert.equal(noChange.issue, null);
assert.equal(record(noChange.state, first.id), revisedRecord);
assert.equal(hasExpenseEditDraft(noChange.state, "landlord", first.id), false);
assert.deepEqual(expenseView(noChange.state, "landlord"), {
  ...defaultView,
  sort: "Oldest date",
});
assert.deepEqual(createDraft(noChange.state), createDraft(unchanged));
assert.deepEqual(
  editDraft(noChange.state, second.id),
  editDraft(unchanged, second.id),
);
const invalidEdit = updateEdit(noChange.state, first.id, {
  amount: "1.005",
  date: "unfinished",
});
const failedEdit = submitExpenseEditDraft(
  invalidEdit,
  "landlord",
  first.id,
  revisedRecord.revision,
  now,
);
assert.equal(failedEdit.state, invalidEdit);
assert.equal(failedEdit.recordId, null);
assert.ok(failedEdit.errors.amount);
assert.ok(failedEdit.errors.date);
assert.equal(editDraft(failedEdit.state, first.id).values.date, "unfinished");
assert.equal(record(failedEdit.state, first.id), revisedRecord);

// Removal and Undo cannot revive stale forms or silently overwrite another version.
const staleToken = revisedRecord.revision;
const removed = removeExpenseRecord(
  invalidEdit,
  "landlord",
  first.id,
  staleToken,
  now,
);
const removedRecord = record(removed, first.id);
assert.equal(removedRecord.revision, staleToken + 1);
assert.equal(removedRecord.removedAt, now.toISOString());
assert.equal(removedRecord.history.at(-1)!.action, "removed");
assert.equal(removedRecord.history.at(-1)!.before!.removedAt, null);
assert.equal(removedRecord.history.at(-1)!.after.removedAt, now.toISOString());
assert.deepEqual(
  scopedExpenseRecords(removed, "landlord").map((item) => item.id),
  [second.id],
);
assert.deepEqual(expenseSummary(removed, "landlord"), {
  count: 1,
  totalCents: 2000,
});
assert.equal(editDraft(removed, first.id).stale, true);
assert.equal(editDraft(removed, first.id).values.amount, "1.005");
assert.ok(
  expenseEditDrafts(removed, "landlord").some(
    (item) => item.recordId === first.id && item.stale,
  ),
);
assert.equal(
  updateExpenseEditDraft(
    removed,
    "landlord",
    first.id,
    { amount: "1" },
    staleToken,
  ),
  removed,
);
const staleSubmit = submitExpenseEditDraft(
  removed,
  "landlord",
  first.id,
  staleToken,
  now,
);
assert.equal(staleSubmit.state, removed);
assert.equal(staleSubmit.issue, "stale");
assert.equal(staleSubmit.recordId, null);
assert.equal(
  removeExpenseRecord(
    removed,
    "landlord",
    first.id,
    removedRecord.revision,
    now,
  ),
  removed,
);
assert.deepEqual(expenseUndo(removed, "landlord"), {
  recordId: first.id,
  recordRevision: removedRecord.revision,
});
const detachedUndo = expenseUndo(removed, "landlord")!;
detachedUndo.recordId = "cannot redirect actual Undo";
assert.equal(expenseUndo(removed, "landlord")!.recordId, first.id);
assert.equal(
  restoreExpenseRecord(removed, "landlord", first.id, staleToken, now),
  removed,
);
assert.equal(
  restoreExpenseRecord(
    removed,
    "landlord",
    second.id,
    record(removed, second.id).revision,
    now,
  ),
  removed,
);
const restored = restoreExpenseRecord(
  removed,
  "landlord",
  first.id,
  removedRecord.revision,
  now,
);
const restoredRecord = record(restored, first.id);
assert.equal(restoredRecord.revision, removedRecord.revision + 1);
assert.equal(restoredRecord.removedAt, null);
assert.equal(restoredRecord.amountCents, 15025);
assert.equal(restoredRecord.history.at(-1)!.action, "restored");
assert.equal(expenseUndo(restored, "landlord"), null);
assert.deepEqual(expenseSummary(restored, "landlord"), {
  count: 2,
  totalCents: 17025,
});
assert.equal(editDraft(restored, first.id).stale, true);
assert.equal(
  submitExpenseEditDraft(restored, "landlord", first.id, staleToken, now).issue,
  "stale",
);
assert.equal(
  restoreExpenseRecord(
    restored,
    "landlord",
    first.id,
    removedRecord.revision,
    now,
  ),
  restored,
);
assert.equal(
  removeExpenseRecord(restored, "landlord", first.id, staleToken, now),
  restored,
);
assert.deepEqual(
  restoredRecord.history.map((event) => event.action),
  ["created", "updated", "removed", "restored"],
);
assert.equal(new Set(restoredRecord.history.map((event) => event.id)).size, 4);
for (const [index, event] of restoredRecord.history.entries()) {
  assert.equal(event.at, now.toISOString());
  assert.equal(event.actor, "landlord");
  if (index)
    assert.deepEqual(event.before, restoredRecord.history[index - 1].after);
  if (event.before) assert.notEqual(event.before, event.after);
}
const removedWithoutDraft = discardExpenseEditDraft(
  removed,
  "landlord",
  first.id,
);
assert.equal(expenseEditDraft(removedWithoutDraft, "landlord", first.id), null);
assert.equal(
  submitExpenseEditDraft(
    removedWithoutDraft,
    "landlord",
    first.id,
    removedRecord.revision,
    now,
  ).issue,
  "unavailable",
);
assert.deepEqual(createDraft(removedWithoutDraft), createDraft(removed));
assert.deepEqual(
  editDraft(removedWithoutDraft, second.id),
  editDraft(removed, second.id),
);
const invalidClock = new Date(Number.NaN);
for (const result of [
  submitExpenseCreateDraft(
    updateExpenseCreateDraft(initial, "landlord", values, now),
    "landlord",
    invalidClock,
  ),
  submitExpenseEditDraft(
    editing,
    "landlord",
    first.id,
    firstRecord.revision,
    invalidClock,
  ),
]) {
  assert.equal(result.recordId, null);
  assert.equal(result.issue, "unavailable");
}
assert.equal(
  removeExpenseRecord(
    restored,
    "landlord",
    first.id,
    restoredRecord.revision,
    invalidClock,
  ),
  restored,
);
assert.equal(
  restoreExpenseRecord(
    removed,
    "landlord",
    first.id,
    removedRecord.revision,
    invalidClock,
  ),
  removed,
);
const discarded = discardExpenseEditDraft(restored, "landlord", first.id);
assert.equal(hasExpenseEditDraft(discarded, "landlord", first.id), false);
assert.equal(editDraft(discarded, first.id).stale, false);
assert.equal(
  editDraft(discarded, first.id).recordRevision,
  restoredRecord.revision,
);
assert.equal(record(discarded, first.id), restoredRecord);
assert.deepEqual(createDraft(discarded), createDraft(restored));
assert.deepEqual(
  editDraft(discarded, second.id),
  editDraft(restored, second.id),
);
assert.equal(
  discardExpenseEditDraft(discarded, "landlord", first.id),
  discarded,
);
const noCreate = discardExpenseCreateDraft(discarded, "landlord");
assert.equal(hasExpenseCreateDraft(noCreate, "landlord"), false);
assert.deepEqual(
  editDraft(noCreate, second.id),
  editDraft(discarded, second.id),
);
assert.equal(record(noCreate, first.id), restoredRecord);
const removedSecond = removeExpenseRecord(
  removed,
  "landlord",
  second.id,
  record(removed, second.id).revision,
  now,
);
assert.equal(expenseUndo(removedSecond, "landlord")!.recordId, second.id);
assert.equal(
  restoreExpenseRecord(
    removedSecond,
    "landlord",
    first.id,
    removedRecord.revision,
    now,
  ),
  removedSecond,
);
assert.equal(scopedExpenseRecords(removedSecond, "landlord").length, 0);
assert.equal(scopedExpenseRecords(removedSecond, "landlord", true).length, 2);
assert.deepEqual(expenseSummary(removedSecond, "landlord"), {
  count: 0,
  totalCents: 0,
});

// Views are detached, validated field by field, retained, and excluded from private values.
filtered = updateExpenseView(discarded, "landlord", {
  query: "  private recorded  ",
  property: String(property.id),
  category: "repairs",
  sort: "Amount: high to low",
});
assert.equal(expenseView(filtered, "landlord").query, "  private recorded  ");
assert.equal(
  visibleExpenseRecords(filtered, "landlord").length,
  0,
  "Search uses saved fields, not unfinished draft values",
);
const visible = updateExpenseView(filtered, "landlord", { query: "revised" });
assert.deepEqual(
  visibleExpenseRecords(visible, "landlord").map((item) => item.id),
  [first.id],
);
assert.deepEqual(expenseSummary(visible, "landlord"), {
  count: 1,
  totalCents: 15025,
});
const translated = updateExpenseView(discarded, "landlord", {
  query: "reparacoes",
});
const translatedCategory = (category: string) =>
  category === "repairs" ? "Reparações e manutenção" : category;
assert.deepEqual(
  visibleExpenseRecords(translated, "landlord", translatedCategory).map(
    (item) => item.id,
  ),
  [first.id],
);
assert.deepEqual(expenseSummary(translated, "landlord", translatedCategory), {
  count: 1,
  totalCents: 15025,
});
assert.equal(record(translated, first.id).category, "repairs");
for (const [sort, expected] of [
  ["Newest date", [first.id, second.id]],
  ["Oldest date", [second.id, first.id]],
  ["Amount: high to low", [first.id, second.id]],
] as const) {
  const state = updateExpenseView(
    resetExpenseFilters(discarded, "landlord"),
    "landlord",
    { sort },
  );
  assert.deepEqual(
    visibleExpenseRecords(state, "landlord").map((item) => item.id),
    expected,
  );
}
const recentEdit = updateEdit(discarded, second.id, {
  note: "Latest recorded change",
});
const recentlySaved = submitExpenseEditDraft(
  recentEdit,
  "landlord",
  second.id,
  editDraft(recentEdit, second.id).recordRevision,
  new Date(now.getTime() + 1000),
);
assert.equal(recentlySaved.recordId, second.id);
const recentlySorted = updateExpenseView(recentlySaved.state, "landlord", {
  sort: "Recently updated",
});
assert.deepEqual(
  visibleExpenseRecords(recentlySorted, "landlord").map((item) => item.id),
  [second.id, first.id],
);
const rawSpaceView = updateExpenseView(discarded, "landlord", {
  query: "   ",
  sort: "Recently updated",
});
assert.equal(expenseView(rawSpaceView, "landlord").query, "   ");
assert.deepEqual(
  expenseView(resetExpenseFilters(rawSpaceView, "landlord"), "landlord"),
  defaultView,
);
const badView = updateExpenseView(rawSpaceView, "landlord", {
  query: "q".repeat(205),
  property: "2",
  category: "bad",
  sort: "bad",
} as unknown as Parameters<typeof updateExpenseView>[2]);
assert.equal(expenseView(badView, "landlord").query, "q".repeat(200));
assert.equal(
  expenseView(badView, "landlord").property,
  expenseView(rawSpaceView, "landlord").property,
);
assert.equal(
  expenseView(badView, "landlord").category,
  expenseView(rawSpaceView, "landlord").category,
);
assert.equal(expenseView(badView, "landlord").sort, "Recently updated");
assert.equal(
  updateExpenseView(badView, "landlord", expenseView(badView, "landlord")),
  badView,
);
for (const patch of [
  {},
  { query: 4 },
  { property: "01" },
  { category: "constructor" },
  null,
  undefined,
  [],
])
  assert.equal(
    updateExpenseView(
      badView,
      "landlord",
      patch as Parameters<typeof updateExpenseView>[2],
    ),
    badView,
  );

// Neither name spoofing nor another active workspace exposes this owner's records or drafts.
for (const role of unavailableRoles) {
  for (const state of [initial, editing, removed, restored]) {
    assert.deepEqual(expenseProperties(role), []);
    assert.deepEqual(scopedExpenseRecords(state, role, true), []);
    assert.deepEqual(visibleExpenseRecords(state, role), []);
    assert.deepEqual(expenseSummary(state, role), { count: 0, totalCents: 0 });
    assert.equal(expenseCreateDraft(state, role, now), null);
    assert.equal(expenseEditDraft(state, role, first.id), null);
    assert.deepEqual(expenseEditDrafts(state, role), []);
    assert.equal(hasExpenseCreateDraft(state, role), false);
    assert.equal(hasExpenseEditDraft(state, role, first.id), false);
    assert.equal(expenseUndo(state, role), null);
    assert.equal(updateExpenseCreateDraft(state, role, values, now), state);
    assert.equal(
      updateExpenseEditDraft(state, role, first.id, values, 1),
      state,
    );
    assert.equal(discardExpenseCreateDraft(state, role), state);
    assert.equal(discardExpenseEditDraft(state, role, first.id), state);
    assert.equal(
      removeExpenseRecord(state, role, first.id, firstRecord.revision, now),
      state,
    );
    assert.equal(
      restoreExpenseRecord(state, role, first.id, firstRecord.revision, now),
      state,
    );
    assert.equal(
      updateExpenseView(state, role, {
        query: "cannot leak",
        category: "repairs",
      }),
      state,
    );
    assert.equal(resetExpenseFilters(state, role), state);
    assert.deepEqual(expenseView(state, role), defaultView);
    for (const result of [
      submitExpenseCreateDraft(state, role, now),
      submitExpenseEditDraft(state, role, first.id, 1, now),
    ]) {
      assert.equal(result.state, state);
      assert.equal(result.recordId, null);
      assert.equal(result.issue, "unavailable");
    }
  }
}
for (const target of ["missing", "", "__proto__", "constructor"]) {
  assert.equal(expenseEditDraft(editing, "landlord", target), null);
  assert.equal(hasExpenseEditDraft(editing, "landlord", target), false);
  assert.equal(
    updateExpenseEditDraft(editing, "landlord", target, values, 1),
    editing,
  );
  assert.equal(discardExpenseEditDraft(editing, "landlord", target), editing);
  assert.equal(
    removeExpenseRecord(editing, "landlord", target, 1, now),
    editing,
  );
  assert.equal(
    restoreExpenseRecord(editing, "landlord", target, 1, now),
    editing,
  );
  assert.equal(
    submitExpenseEditDraft(editing, "landlord", target, 1, now).issue,
    "unavailable",
  );
}
for (const patch of [
  { propertyId: 2 },
  { propertyId: 999 },
  { owner: "Another owner" },
]) {
  const foreign = {
    ...editing,
    records: editing.records.map((item) =>
      item.id === first.id ? { ...item, ...patch } : item,
    ),
  };
  assert.equal(
    scopedExpenseRecords(foreign, "landlord", true).some(
      (item) => item.id === first.id,
    ),
    false,
  );
  assert.equal(expenseEditDraft(foreign, "landlord", first.id), null);
  assert.equal(hasExpenseEditDraft(foreign, "landlord", first.id), false);
  assert.equal(discardExpenseEditDraft(foreign, "landlord", first.id), foreign);
  assert.equal(
    updateExpenseEditDraft(foreign, "landlord", first.id, values, 1),
    foreign,
  );
  assert.equal(
    removeExpenseRecord(foreign, "landlord", first.id, 1, now),
    foreign,
  );
  assert.equal(
    submitExpenseEditDraft(foreign, "landlord", first.id, 1, now).issue,
    "unavailable",
  );
}
const independent = create(initial);
const historical = JSON.stringify(
  record(independent.state, independent.id).history,
);
Object.assign(record(independent.state, independent.id), {
  note: "A later object change cannot rewrite prior recorded values",
});
assert.equal(
  JSON.stringify(record(independent.state, independent.id).history),
  historical,
);
assert.equal(JSON.stringify(initial), initialJson);

console.log("Expense ledger state checks passed.");
