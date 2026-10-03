import {
  ownedProperties,
  ownsProperty,
  workspaceLandlordName,
} from "../propertyScope";
import { matchesSearch } from "../search";
import type { Role } from "../types";

export const expenseCategories = [
  "repairs",
  "utilities",
  "insurance",
  "supplies",
  "other",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
export const expenseSorts = [
  "Newest date",
  "Oldest date",
  "Amount: high to low",
  "Recently updated",
] as const;
export type ExpenseSort = (typeof expenseSorts)[number];

export interface ExpenseDraft {
  propertyId: string;
  date: string;
  category: string;
  amount: string;
  payee: string;
  reference: string;
  note: string;
}

export interface ExpenseSnapshot {
  readonly propertyId: number;
  readonly propertyTitle: string;
  readonly date: string;
  readonly category: ExpenseCategory;
  readonly amountCents: number;
  readonly payee: string;
  readonly reference: string;
  readonly note: string;
  readonly removedAt: string | null;
}

export interface ExpenseHistoryEvent {
  readonly id: string;
  readonly at: string;
  readonly actor: "landlord";
  readonly action: "created" | "updated" | "removed" | "restored";
  readonly before: ExpenseSnapshot | null;
  readonly after: ExpenseSnapshot;
}

export interface ExpenseRecord extends ExpenseSnapshot {
  readonly id: string;
  readonly owner: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly ExpenseHistoryEvent[];
}

export interface ExpenseEditDraftEntry {
  values: ExpenseDraft;
  recordRevision: number;
}

export interface ExpenseEditDraft extends ExpenseEditDraftEntry {
  stale: boolean;
}

export interface ExpenseView {
  query: string;
  property: string;
  category: "All categories" | ExpenseCategory;
  sort: ExpenseSort;
}

export interface ExpenseUndo {
  recordId: string;
  recordRevision: number;
}

export interface ExpenseState {
  records: ExpenseRecord[];
  nextId: number;
  createDraft: ExpenseDraft | null;
  editDrafts: Record<string, ExpenseEditDraftEntry>;
  view: ExpenseView;
  lastUndo: ExpenseUndo | null;
}

export type ExpenseFieldIssue =
  | "property"
  | "date"
  | "dateFuture"
  | "category"
  | "amount"
  | "payee"
  | "reference"
  | "note";
export type ExpenseErrors = Partial<
  Record<keyof ExpenseDraft, ExpenseFieldIssue>
>;
export type ExpenseIssue = "unavailable" | "noDraft" | "stale";
export interface ExpenseSubmitResult {
  state: ExpenseState;
  recordId: string | null;
  errors: ExpenseErrors;
  issue: ExpenseIssue | null;
}

const draftFields: readonly (keyof ExpenseDraft)[] = [
  "propertyId",
  "date",
  "category",
  "amount",
  "payee",
  "reference",
  "note",
];
const defaultView = (): ExpenseView => ({
  query: "",
  property: "All properties",
  category: "All categories",
  sort: "Newest date",
});

export function createInitialExpenseState(): ExpenseState {
  return {
    records: [],
    nextId: 1,
    createDraft: null,
    editDrafts: {},
    view: defaultView(),
    lastUndo: null,
  };
}

export function expenseProperties(
  role: Role,
): Array<{ id: number; title: string }> {
  return ownedProperties(role).map(({ id, title }) => ({ id, title }));
}

function ownerRole(role: Role): boolean {
  return role === "landlord";
}

function scopedRecord(
  state: ExpenseState,
  role: Role,
  id: string,
): ExpenseRecord | null {
  if (!ownerRole(role)) return null;
  const record = state.records.find((item) => item.id === id);
  return record &&
    record.owner === workspaceLandlordName &&
    ownsProperty(role, record.propertyId)
    ? record
    : null;
}

export function scopedExpenseRecords(
  state: ExpenseState,
  role: Role,
  includeRemoved = false,
): ExpenseRecord[] {
  if (!ownerRole(role)) return [];
  return state.records.filter(
    (record) =>
      record.owner === workspaceLandlordName &&
      ownsProperty(role, record.propertyId) &&
      (includeRemoved || record.removedAt === null),
  );
}

function validClock(now: Date): boolean {
  return (
    now instanceof Date &&
    Number.isFinite(now.getTime()) &&
    now.getFullYear() >= 1 &&
    now.getFullYear() <= 9999
  );
}

export function expenseToday(now = new Date()): string {
  if (!validClock(now)) return "";
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function realDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  );
}

export function parseExpenseAmount(value: string): number | null {
  if (typeof value !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
    return null;
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 100000000
    ? cents
    : null;
}

function propertyForDraft(role: Role, value: string) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value)
    ? expenseProperties(role).find((property) => String(property.id) === value)
    : undefined;
}

export function expenseDraftErrors(
  draft: ExpenseDraft,
  role: Role,
  now = new Date(),
): ExpenseErrors {
  const errors: ExpenseErrors = {};
  if (!propertyForDraft(role, draft.propertyId)) errors.propertyId = "property";
  if (
    typeof draft.date !== "string" ||
    !realDate(draft.date) ||
    !validClock(now)
  )
    errors.date = "date";
  else if (draft.date > expenseToday(now)) errors.date = "dateFuture";
  if (!(expenseCategories as readonly string[]).includes(draft.category))
    errors.category = "category";
  if (parseExpenseAmount(draft.amount) === null) errors.amount = "amount";
  if (
    typeof draft.payee !== "string" ||
    draft.payee.trim().length > 120 ||
    /[\r\n]/.test(draft.payee)
  )
    errors.payee = "payee";
  if (
    typeof draft.reference !== "string" ||
    draft.reference.trim().length > 160 ||
    /[\r\n]/.test(draft.reference)
  )
    errors.reference = "reference";
  if (typeof draft.note !== "string" || draft.note.trim().length > 2000)
    errors.note = "note";
  return errors;
}

export function expenseView(state: ExpenseState, role: Role): ExpenseView {
  return ownerRole(role) ? { ...state.view } : defaultView();
}

export function updateExpenseView(
  state: ExpenseState,
  role: Role,
  patch: Partial<ExpenseView>,
): ExpenseState {
  if (!ownerRole(role) || !patch || typeof patch !== "object") return state;
  const view = expenseView(state, role);
  if (typeof patch.query === "string") view.query = patch.query.slice(0, 200);
  if (
    patch.property === "All properties" ||
    (typeof patch.property === "string" &&
      propertyForDraft(role, patch.property))
  )
    view.property = patch.property;
  if (
    patch.category === "All categories" ||
    (typeof patch.category === "string" &&
      (expenseCategories as readonly string[]).includes(patch.category))
  )
    view.category = patch.category;
  if (
    typeof patch.sort === "string" &&
    (expenseSorts as readonly string[]).includes(patch.sort)
  )
    view.sort = patch.sort;
  return (Object.keys(view) as Array<keyof ExpenseView>).every(
    (key) => view[key] === state.view[key],
  )
    ? state
    : { ...state, view };
}

/** Explicit filter reset also resets sorting; saving/revealing only clears hiding constraints. */
export function resetExpenseFilters(
  state: ExpenseState,
  role: Role,
): ExpenseState {
  return updateExpenseView(state, role, defaultView());
}

function revealExpense(state: ExpenseState, role: Role): ExpenseState {
  return updateExpenseView(state, role, {
    query: "",
    property: "All properties",
    category: "All categories",
  });
}

export function visibleExpenseRecords(
  state: ExpenseState,
  role: Role,
  categoryLabel?: (category: ExpenseCategory) => string,
): ExpenseRecord[] {
  const view = expenseView(state, role);
  return scopedExpenseRecords(state, role)
    .filter(
      (record) =>
        (view.property === "All properties" ||
          String(record.propertyId) === view.property) &&
        (view.category === "All categories" ||
          record.category === view.category) &&
        matchesSearch(
          view.query,
          record.propertyTitle,
          record.category,
          categoryLabel?.(record.category) ?? "",
          record.payee,
          record.reference,
          record.note,
          record.date,
          (record.amountCents / 100).toFixed(2),
        ),
    )
    .sort((a, b) => {
      const difference =
        view.sort === "Oldest date"
          ? a.date.localeCompare(b.date)
          : view.sort === "Amount: high to low"
            ? b.amountCents - a.amountCents
            : view.sort === "Recently updated"
              ? b.updatedAt.localeCompare(a.updatedAt)
              : b.date.localeCompare(a.date);
      return difference || a.id.localeCompare(b.id);
    });
}

export function expenseSummary(
  state: ExpenseState,
  role: Role,
  categoryLabel?: (category: ExpenseCategory) => string,
): { count: number; totalCents: number } {
  const records = visibleExpenseRecords(state, role, categoryLabel);
  return {
    count: records.length,
    totalCents: records.reduce(
      (total, record) => total + record.amountCents,
      0,
    ),
  };
}

export function expenseCreateDraft(
  state: ExpenseState,
  role: Role,
  now = new Date(),
): ExpenseDraft | null {
  if (!ownerRole(role)) return null;
  if (state.createDraft) return { ...state.createDraft };
  const available = expenseProperties(role);
  return {
    propertyId: available.length === 1 ? String(available[0].id) : "",
    date: expenseToday(now),
    category: "other",
    amount: "",
    payee: "",
    reference: "",
    note: "",
  };
}

export function hasExpenseCreateDraft(
  state: ExpenseState,
  role: Role,
): boolean {
  return ownerRole(role) && state.createDraft !== null;
}

function patchedDraft(
  draft: ExpenseDraft,
  patch: Partial<ExpenseDraft>,
): ExpenseDraft | null {
  if (!patch || typeof patch !== "object") return null;
  const next = { ...draft };
  let recognized = false;
  for (const key of draftFields) {
    if (Object.hasOwn(patch, key) && typeof patch[key] === "string") {
      next[key] = patch[key];
      recognized = true;
    }
  }
  return recognized ? next : null;
}

function sameDraft(left: ExpenseDraft, right: ExpenseDraft): boolean {
  return draftFields.every((key) => left[key] === right[key]);
}

export function updateExpenseCreateDraft(
  state: ExpenseState,
  role: Role,
  patch: Partial<ExpenseDraft>,
  now = new Date(),
): ExpenseState {
  const draft = expenseCreateDraft(state, role, now);
  if (!draft) return state;
  const next = patchedDraft(draft, patch);
  return !next || (state.createDraft && sameDraft(state.createDraft, next))
    ? state
    : { ...state, createDraft: next };
}

export function discardExpenseCreateDraft(
  state: ExpenseState,
  role: Role,
): ExpenseState {
  return hasExpenseCreateDraft(state, role)
    ? { ...state, createDraft: null }
    : state;
}

function recordDraft(record: ExpenseRecord): ExpenseDraft {
  return {
    propertyId: String(record.propertyId),
    date: record.date,
    category: record.category,
    amount: (record.amountCents / 100).toFixed(2),
    payee: record.payee,
    reference: record.reference,
    note: record.note,
  };
}

export function hasExpenseEditDraft(
  state: ExpenseState,
  role: Role,
  id: string,
): boolean {
  return Boolean(
    scopedRecord(state, role, id) && Object.hasOwn(state.editDrafts, id),
  );
}

export function expenseEditDraft(
  state: ExpenseState,
  role: Role,
  id: string,
): ExpenseEditDraft | null {
  const record = scopedRecord(state, role, id);
  if (!record) return null;
  const retained = Object.hasOwn(state.editDrafts, id)
    ? state.editDrafts[id]
    : null;
  if (retained)
    return {
      values: { ...retained.values },
      recordRevision: retained.recordRevision,
      stale:
        record.removedAt !== null ||
        retained.recordRevision !== record.revision,
    };
  return record.removedAt === null
    ? {
        values: recordDraft(record),
        recordRevision: record.revision,
        stale: false,
      }
    : null;
}

export function expenseEditDrafts(
  state: ExpenseState,
  role: Role,
): Array<ExpenseEditDraft & { recordId: string }> {
  if (!ownerRole(role)) return [];
  return Object.keys(state.editDrafts).flatMap((recordId) => {
    const draft = expenseEditDraft(state, role, recordId);
    return draft ? [{ recordId, ...draft }] : [];
  });
}

export function updateExpenseEditDraft(
  state: ExpenseState,
  role: Role,
  id: string,
  patch: Partial<ExpenseDraft>,
  expectedRevision: number,
): ExpenseState {
  const draft = expenseEditDraft(state, role, id);
  if (!draft || draft.stale || draft.recordRevision !== expectedRevision)
    return state;
  const next = patchedDraft(draft.values, patch);
  if (
    !next ||
    (hasExpenseEditDraft(state, role, id) && sameDraft(draft.values, next))
  )
    return state;
  return {
    ...state,
    editDrafts: {
      ...state.editDrafts,
      [id]: { values: next, recordRevision: draft.recordRevision },
    },
  };
}

export function discardExpenseEditDraft(
  state: ExpenseState,
  role: Role,
  id: string,
): ExpenseState {
  if (!hasExpenseEditDraft(state, role, id)) return state;
  const editDrafts = { ...state.editDrafts };
  delete editDrafts[id];
  return { ...state, editDrafts };
}

function snapshot(record: ExpenseSnapshot): ExpenseSnapshot {
  return {
    propertyId: record.propertyId,
    propertyTitle: record.propertyTitle,
    date: record.date,
    category: record.category,
    amountCents: record.amountCents,
    payee: record.payee,
    reference: record.reference,
    note: record.note,
    removedAt: record.removedAt,
  };
}

function savedValues(draft: ExpenseDraft, role: Role): ExpenseSnapshot {
  const property = propertyForDraft(role, draft.propertyId)!;
  return {
    propertyId: property.id,
    propertyTitle: property.title,
    date: draft.date,
    category: draft.category as ExpenseCategory,
    amountCents: parseExpenseAmount(draft.amount)!,
    payee: draft.payee.trim(),
    reference: draft.reference.trim(),
    note: draft.note.trim(),
    removedAt: null,
  };
}

function historyEvent(
  record: ExpenseRecord,
  before: ExpenseRecord | null,
  action: ExpenseHistoryEvent["action"],
  at: string,
): ExpenseHistoryEvent {
  return {
    id: `${record.id}:revision-${record.revision}`,
    at,
    actor: "landlord",
    action,
    before: before ? snapshot(before) : null,
    after: snapshot(record),
  };
}

function replaceRecord(
  state: ExpenseState,
  record: ExpenseRecord,
): ExpenseState {
  return {
    ...state,
    records: state.records.map((item) =>
      item.id === record.id ? record : item,
    ),
  };
}

function failed(
  state: ExpenseState,
  issue: ExpenseIssue | null,
  errors: ExpenseErrors = {},
): ExpenseSubmitResult {
  return { state, recordId: null, errors, issue };
}

export function submitExpenseCreateDraft(
  state: ExpenseState,
  role: Role,
  now = new Date(),
): ExpenseSubmitResult {
  if (!ownerRole(role) || !validClock(now)) return failed(state, "unavailable");
  if (!hasExpenseCreateDraft(state, role)) return failed(state, "noDraft");
  const draft = expenseCreateDraft(state, role, now)!;
  const errors = expenseDraftErrors(draft, role, now);
  if (Object.keys(errors).length) return failed(state, null, errors);
  const at = now.toISOString();
  let nextId = state.nextId;
  while (state.records.some((record) => record.id === `expense-${nextId}`))
    nextId++;
  const record: ExpenseRecord = {
    ...savedValues(draft, role),
    id: `expense-${nextId}`,
    owner: workspaceLandlordName,
    revision: 1,
    createdAt: at,
    updatedAt: at,
    history: [],
  };
  const created: ExpenseRecord = {
    ...record,
    history: [historyEvent(record, null, "created", at)],
  };
  return {
    state: revealExpense(
      {
        ...state,
        records: [...state.records, created],
        nextId: nextId + 1,
        createDraft: null,
      },
      role,
    ),
    recordId: created.id,
    errors: {},
    issue: null,
  };
}

export function submitExpenseEditDraft(
  state: ExpenseState,
  role: Role,
  id: string,
  expectedRevision: number,
  now = new Date(),
): ExpenseSubmitResult {
  const record = scopedRecord(state, role, id);
  if (!record || !validClock(now)) return failed(state, "unavailable");
  const draft = expenseEditDraft(state, role, id);
  if (draft && (draft.stale || draft.recordRevision !== expectedRevision))
    return failed(state, "stale");
  if (record.removedAt !== null) return failed(state, "unavailable");
  if (!hasExpenseEditDraft(state, role, id)) return failed(state, "noDraft");
  const errors = expenseDraftErrors(draft!.values, role, now);
  if (Object.keys(errors).length) return failed(state, null, errors);
  const values = savedValues(draft!.values, role);
  const current = snapshot(record);
  const unchanged = (Object.keys(values) as Array<keyof ExpenseSnapshot>).every(
    (key) => values[key] === current[key],
  );
  let next = state;
  if (!unchanged) {
    const at = now.toISOString();
    const updated: ExpenseRecord = {
      ...record,
      ...values,
      revision: record.revision + 1,
      updatedAt: at,
    };
    next = replaceRecord(state, {
      ...updated,
      history: [
        ...record.history,
        historyEvent(updated, record, "updated", at),
      ],
    });
  }
  return {
    state: revealExpense(discardExpenseEditDraft(next, role, id), role),
    recordId: id,
    errors: {},
    issue: null,
  };
}

export function removeExpenseRecord(
  state: ExpenseState,
  role: Role,
  id: string,
  expectedRevision: number,
  now = new Date(),
): ExpenseState {
  const record = scopedRecord(state, role, id);
  if (
    !record ||
    record.removedAt !== null ||
    record.revision !== expectedRevision ||
    !validClock(now)
  )
    return state;
  const at = now.toISOString();
  const removed: ExpenseRecord = {
    ...record,
    removedAt: at,
    updatedAt: at,
    revision: record.revision + 1,
  };
  const next = replaceRecord(state, {
    ...removed,
    history: [...record.history, historyEvent(removed, record, "removed", at)],
  });
  return {
    ...next,
    lastUndo: { recordId: id, recordRevision: removed.revision },
  };
}

export function expenseUndo(
  state: ExpenseState,
  role: Role,
): ExpenseUndo | null {
  if (!ownerRole(role) || !state.lastUndo) return null;
  const record = scopedRecord(state, role, state.lastUndo.recordId);
  return record &&
    record.removedAt !== null &&
    record.revision === state.lastUndo.recordRevision
    ? { ...state.lastUndo }
    : null;
}

export function restoreExpenseRecord(
  state: ExpenseState,
  role: Role,
  id: string,
  expectedRemovedRevision: number,
  now = new Date(),
): ExpenseState {
  const undo = expenseUndo(state, role);
  if (
    !undo ||
    undo.recordId !== id ||
    undo.recordRevision !== expectedRemovedRevision ||
    !validClock(now)
  )
    return state;
  const record = scopedRecord(state, role, id)!;
  const at = now.toISOString();
  const restored: ExpenseRecord = {
    ...record,
    removedAt: null,
    updatedAt: at,
    revision: record.revision + 1,
  };
  const next = replaceRecord(state, {
    ...restored,
    history: [
      ...record.history,
      historyEvent(restored, record, "restored", at),
    ],
  });
  return revealExpense({ ...next, lastUndo: null }, role);
}

export interface ExpenseCsvLabels {
  headers: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  scope: string;
  category: (value: ExpenseCategory) => string;
}

const defaultExpenseCsvLabels: ExpenseCsvLabels = {
  headers: [
    "Scope",
    "Record",
    "Property",
    "Date",
    "Category",
    "Amount EUR",
    "Payee",
    "Reference",
    "Note",
    "Created at",
    "Updated at",
    "Revision",
  ],
  scope: "Local session expense record; not payment confirmation",
  category: (value) =>
    ({
      repairs: "Repairs",
      utilities: "Utilities",
      insurance: "Insurance",
      supplies: "Supplies",
      other: "Other",
    })[value],
};

function expenseCsvCell(value: string): string {
  const safe =
    /^[\t\r\n]/.test(value) || /^\s*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Export only the owner's visible saved values, with the same translated search labels. */
export function expenseRecordsCsv(
  state: ExpenseState,
  role: Role,
  labels: ExpenseCsvLabels = defaultExpenseCsvLabels,
): string {
  const records = visibleExpenseRecords(state, role, labels.category);
  const rows = [
    labels.headers,
    ...records.map((record) => [
      labels.scope,
      record.id,
      record.propertyTitle,
      record.date,
      labels.category(record.category),
      (record.amountCents / 100).toFixed(2),
      record.payee,
      record.reference,
      record.note,
      record.createdAt,
      record.updatedAt,
      String(record.revision),
    ]),
  ];
  return (
    rows.map((row) => row.map(expenseCsvCell).join(",")).join("\r\n") + "\r\n"
  );
}
