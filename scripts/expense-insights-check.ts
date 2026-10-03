import assert from "node:assert/strict";
import { properties } from "../src/data";
import { ownedProperties } from "../src/propertyScope";
import { createInitialApplicationState } from "../src/components/applicationState";
import { createInitialMaintenanceState } from "../src/components/maintenanceState";
import { createInitialRentRecordState } from "../src/components/rentRecordState";
import {
  buildPropertyOperationsSummary,
  type PropertyOperationsSummary,
} from "../src/components/propertyOperationsSummary";
import { buildPropertyInsights } from "../src/components/propertyInsightsSummary";
import {
  createInitialExpenseState,
  expenseCategories,
  expenseEditDraft,
  expenseUndo,
  removeExpenseRecord,
  restoreExpenseRecord,
  submitExpenseCreateDraft,
  submitExpenseEditDraft,
  updateExpenseCreateDraft,
  updateExpenseEditDraft,
  updateExpenseView,
  visibleExpenseRecords,
  type ExpenseDraft,
  type ExpenseState,
} from "../src/components/expenseState";

const now = new Date(2032, 4, 10, 12);
const summary = buildPropertyOperationsSummary({
  role: "landlord",
  now,
  applicationState: createInitialApplicationState(),
  maintenanceState: createInitialMaintenanceState(),
  rentState: createInitialRentRecordState(),
});
const property = ownedProperties("landlord")[0];
assert.ok(property);
const empty = createInitialExpenseState();
const baseline = buildPropertyInsights(summary);
const zeroCategories = expenseCategories.map((category) => ({
  category,
  count: 0,
  totalCents: 0,
}));
const zeroProperties = summary.properties.map(({ id: propertyId }) => ({
  propertyId,
  count: 0,
  totalCents: 0,
}));

function create(
  state: ExpenseState,
  patch: Pick<ExpenseDraft, "date" | "category" | "amount">,
) {
  const retained = updateExpenseCreateDraft(
    state,
    "landlord",
    {
      propertyId: String(property.id),
      payee: "Private payee",
      reference: "Private reference",
      note: "Private ledger note",
      ...patch,
    },
    now,
  );
  const result = submitExpenseCreateDraft(retained, "landlord", now);
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.recordId);
  return { state: result.state, id: result.recordId };
}

function record(state: ExpenseState, id: string) {
  const value = state.records.find((item) => item.id === id);
  assert.ok(value);
  return value;
}

function edit(state: ExpenseState, id: string, patch: Partial<ExpenseDraft>) {
  const draft = expenseEditDraft(state, "landlord", id);
  assert.ok(draft);
  const retained = updateExpenseEditDraft(
    state,
    "landlord",
    id,
    patch,
    draft.recordRevision,
  );
  const result = submitExpenseEditDraft(
    retained,
    "landlord",
    id,
    draft.recordRevision,
    now,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.equal(result.recordId, id);
  return result.state;
}

function assertTotals(
  state: ExpenseState,
  period: string,
  count: number,
  cents: number,
) {
  const result = buildPropertyInsights(summary, period, state);
  assert.equal(result.period, period);
  assert.equal(result.expenses.count, count);
  assert.equal(result.expenses.totalCents, cents);
  assert.equal(
    result.expenses.byCategory.reduce((sum, item) => sum + item.count, 0),
    count,
  );
  assert.equal(
    result.expenses.byCategory.reduce((sum, item) => sum + item.totalCents, 0),
    cents,
  );
  assert.deepEqual(result.expenses.byProperty, [
    { propertyId: property.id, count, totalCents: cents },
  ]);
  return result;
}

// An empty ledger does not turn listing prices into expenses or alter recorded rent.
const emptyInsights = buildPropertyInsights(summary, undefined, empty);
assert.deepEqual(emptyInsights.expenses, {
  count: 0,
  totalCents: 0,
  byCategory: zeroCategories,
  byProperty: zeroProperties,
});
assert.deepEqual(emptyInsights.periods, baseline.periods);
assert.deepEqual(emptyInsights.totals, baseline.totals);
assert.deepEqual(emptyInsights.properties, baseline.properties);
assert.deepEqual(emptyInsights.history, baseline.history);

const first = create(empty, {
  date: "2032-04-30",
  category: "repairs",
  amount: "0,10",
});
const second = create(first.state, {
  date: "2032-04-01",
  category: "utilities",
  amount: "0.20",
});
const third = create(second.state, {
  date: "2032-05-01",
  category: "insurance",
  amount: "1000000",
});
const fourth = create(third.state, {
  date: "2031-02-28",
  category: "supplies",
  amount: "12.34",
});
const ledger = fourth.state;
const april = assertTotals(ledger, "2032-04", 2, 30);
assert.deepEqual(april.expenses.byCategory, [
  { category: "repairs", count: 1, totalCents: 10 },
  { category: "utilities", count: 1, totalCents: 20 },
  { category: "insurance", count: 0, totalCents: 0 },
  { category: "supplies", count: 0, totalCents: 0 },
  { category: "other", count: 0, totalCents: 0 },
]);
assertTotals(ledger, "2032-05", 1, 100000000);
assertTotals(ledger, "2031-02", 1, 1234);
assert.deepEqual(april.periods, [
  "2032-05",
  "2032-04",
  "2031-02",
  "2026-10",
  "2026-09",
  "2026-08",
]);
assert.equal(record(ledger, first.id).createdAt, now.toISOString());
assert.equal(
  april.expenses.count,
  2,
  "Expense date, not the May creation timestamp, selects the accounting month",
);

// Insights are a ledger-wide summary, not an export of the current filtered list.
const hiddenLedger = updateExpenseView(ledger, "landlord", {
  query: "No matching visible rows",
  category: "other",
  property: String(property.id),
  sort: "Recently updated",
});
assert.equal(visibleExpenseRecords(hiddenLedger, "landlord").length, 0);
assert.deepEqual(
  buildPropertyInsights(summary, "2032-04", hiddenLedger),
  april,
);

// Unsaved create/edit values cannot change months, totals, categories or rent.
let privateLedger = updateExpenseCreateDraft(
  hiddenLedger,
  "landlord",
  {
    date: "2030-01-01",
    category: "other",
    amount: "999999.99",
    note: "PRIVATE DRAFT ONLY",
  },
  now,
);
privateLedger = updateExpenseEditDraft(
  privateLedger,
  "landlord",
  first.id,
  {
    date: "2029-06-01",
    category: "other",
    amount: "987654.32",
  },
  record(privateLedger, first.id).revision,
);
assert.deepEqual(
  buildPropertyInsights(summary, "2032-04", privateLedger),
  april,
);
assert.equal(JSON.stringify(april).includes("Private ledger note"), false);
assert.equal(JSON.stringify(april.expenses).includes("Private payee"), false);

// A committed edit moves the latest record once; historical values are never added.
const moved = edit(ledger, first.id, {
  date: "2032-03-31",
  category: "other",
  amount: "1.01",
});
assertTotals(moved, "2032-04", 1, 20);
const march = assertTotals(moved, "2032-03", 1, 101);
assert.deepEqual(
  march.expenses.byCategory,
  zeroCategories.map((item) =>
    item.category === "other" ? { ...item, count: 1, totalCents: 101 } : item,
  ),
);
assert.equal(record(moved, first.id).history.length, 2);
assert.equal(record(moved, first.id).history[0].after.amountCents, 10);
assert.equal(record(moved, first.id).history[0].after.date, "2032-04-30");

const removed = removeExpenseRecord(
  moved,
  "landlord",
  second.id,
  record(moved, second.id).revision,
  now,
);
const emptyApril = assertTotals(removed, "2032-04", 0, 0);
assert.ok(
  emptyApril.periods.includes("2032-04"),
  "A selected empty month remains selectable after removing its last expense",
);
assert.equal(
  buildPropertyInsights(summary, undefined, removed).periods.includes(
    "2032-04",
  ),
  false,
);
assert.deepEqual(emptyApril.expenses.byCategory, zeroCategories);
const undo = expenseUndo(removed, "landlord");
assert.ok(undo);
const restored = restoreExpenseRecord(
  removed,
  "landlord",
  undo.recordId,
  undo.recordRevision,
  now,
);
assertTotals(restored, "2032-04", 1, 20);
assert.equal(record(restored, second.id).history.length, 3);

// Empty historical selection is supported only for the owner with an expense ledger.
for (const value of ["2032-02", "0001-01", "2032-05"]) {
  const selected = buildPropertyInsights(summary, value, empty);
  assert.equal(selected.period, value);
  assert.ok(selected.periods.includes(value));
  assert.deepEqual(selected.expenses.byCategory, zeroCategories);
}
for (const value of [
  "2032-06",
  "9999-12",
  "2032-00",
  "2032-13",
  "0000-01",
  "2032-1",
  "32-01",
  " 2032-04",
  "2032-04 ",
  "2032-04-01",
  "missing",
  "",
]) {
  const selected = buildPropertyInsights(summary, value, empty);
  assert.equal(selected.period, summary.currentPeriod, value);
  assert.deepEqual(selected.periods, baseline.periods, value);
}
assert.equal(
  buildPropertyInsights(summary, "2032-02").period,
  summary.currentPeriod,
);
assert.equal(buildPropertyInsights(summary, "2026-09").period, "2026-09");

// Canonical ownership and summary property scope must both hold.
const foreignProperty = properties.find(
  (item) => !ownedProperties("landlord").some((owned) => owned.id === item.id),
);
assert.ok(foreignProperty);
const source = record(ledger, first.id);
const polluted: ExpenseState = {
  ...ledger,
  records: [
    ...ledger.records,
    {
      ...source,
      id: "foreign-property",
      propertyId: foreignProperty.id,
      propertyTitle: foreignProperty.title,
      date: "2025-01-01",
      amountCents: 888888,
    },
    {
      ...source,
      id: "foreign-owner",
      owner: "Another owner",
      date: "2024-02-01",
      amountCents: 777777,
    },
    {
      ...source,
      id: "missing-property",
      propertyId: 999999,
      date: "2023-03-01",
      amountCents: 666666,
    },
  ],
};
const pollutedSummary = {
  ...summary,
  properties: [...summary.properties, foreignProperty],
};
const scoped = buildPropertyInsights(pollutedSummary, "2032-04", polluted);
assert.deepEqual(scoped.expenses, april.expenses);
assert.deepEqual(scoped.periods, april.periods);
const noProperties = buildPropertyInsights(
  { ...summary, properties: [] },
  "2032-04",
  ledger,
);
assert.equal(noProperties.expenses.count, 0);
assert.equal(noProperties.expenses.totalCents, 0);
assert.deepEqual(noProperties.expenses.byProperty, []);
assert.deepEqual(noProperties.expenses.byCategory, zeroCategories);
assert.deepEqual(
  buildPropertyInsights({ ...summary, properties: [] }, undefined, ledger)
    .periods,
  [summary.currentPeriod],
);

// Even a polluted nonowner summary cannot expose expense amounts or their months.
for (const role of [
  "tenant",
  "provider",
  "spaceOperator",
  "admin",
  "unknown",
]) {
  const nonowner = { ...summary, role } as PropertyOperationsSummary;
  for (const selectedPeriod of [undefined, "2032-04", "2031-02", "2026-09"]) {
    const expected = buildPropertyInsights(nonowner, selectedPeriod);
    const result = buildPropertyInsights(nonowner, selectedPeriod, polluted);
    assert.deepEqual(
      result,
      expected,
      `${role}: expense state must not affect any output`,
    );
    assert.deepEqual(result.expenses, {
      count: 0,
      totalCents: 0,
      byCategory: zeroCategories,
      byProperty: [],
    });
  }
}

// Rent amounts, confirmation counts and property operations retain their original meaning.
for (const period of baseline.periods) {
  const expected = buildPropertyInsights(summary, period);
  const result = buildPropertyInsights(summary, period, ledger);
  assert.deepEqual(result.totals, expected.totals);
  assert.deepEqual(result.properties, expected.properties);
  assert.equal(result.evidenceAwaitingReview, expected.evidenceAwaitingReview);
  for (const row of expected.history) {
    assert.deepEqual(
      result.history.find((item) => item.period === row.period),
      row,
    );
  }
}
for (const period of ["2032-04", "2031-02"]) {
  const result = buildPropertyInsights(summary, period, ledger);
  assert.equal(result.totals.dueCents, 0);
  assert.equal(result.totals.confirmedCents, 0);
}

// Frozen inputs and detached aggregate rows catch accidental sorting or writes.
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
const frozenSummary = deepFreeze(structuredClone(summary));
const frozenLedger = deepFreeze(structuredClone(privateLedger));
const summaryBefore = JSON.stringify(frozenSummary);
const ledgerBefore = JSON.stringify(frozenLedger);
const detached = buildPropertyInsights(frozenSummary, "2032-04", frozenLedger);
detached.expenses.byCategory[0].totalCents = 999;
detached.expenses.byProperty[0].totalCents = 999;
assert.deepEqual(
  buildPropertyInsights(frozenSummary, "2032-04", frozenLedger),
  april,
);
assert.equal(JSON.stringify(frozenSummary), summaryBefore);
assert.equal(JSON.stringify(frozenLedger), ledgerBefore);

console.log(
  "Expense insights passed: canonical owner scope, exact saved cents, expense-date months, live lifecycle, private/filter isolation, empty selection, unchanged rent and immutable inputs.",
);
