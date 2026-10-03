import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  createInitialExpenseState,
  expenseProperties,
  expenseRecordsCsv,
  expenseSorts,
  removeExpenseRecord,
  submitExpenseCreateDraft,
  submitExpenseEditDraft,
  updateExpenseCreateDraft,
  updateExpenseEditDraft,
  updateExpenseView,
  visibleExpenseRecords,
  type ExpenseCategory,
  type ExpenseCsvLabels,
  type ExpenseDraft,
  type ExpenseState,
} from "../src/components/expenseState";

// Parse quoted CSV fields rather than splitting lines: embedded CR/LF and commas are data.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    assert.equal(text[offset++], '"', "Every exported cell must be quoted");
    let cell = "";
    let closed = false;
    while (offset < text.length) {
      const character = text[offset++];
      if (character !== '"') cell += character;
      else if (text[offset] === '"') {
        cell += '"';
        offset++;
      } else {
        closed = true;
        break;
      }
    }
    assert.ok(closed, "Quoted cells must close");
    row.push(cell);
    if (text[offset] === ",") offset++;
    else {
      assert.equal(
        text.slice(offset, offset + 2),
        "\r\n",
        "Rows end with CRLF, including the final row",
      );
      offset += 2;
      rows.push(row);
      row = [];
    }
  }
  assert.deepEqual(row, []);
  return rows;
}
assert.deepEqual(
  parseCsv('"a,b","He said ""yes""","line 1\r\nline 2","中文",""\r\n'),
  [["a,b", 'He said "yes"', "line 1\r\nline 2", "中文", ""]],
);
assert.throws(() => parseCsv('"unclosed'));
assert.throws(() => parseCsv("unquoted\r\n"));
assert.throws(() => parseCsv('"no final line break"'));

const headers = [
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
] as const;
const property = expenseProperties("landlord")[0];
assert.ok(property);
const initial = createInitialExpenseState();
const now = new Date(2032, 4, 10, 12);
function at(hour: number) {
  return new Date(2032, 4, 10, hour);
}
function create(
  state: ExpenseState,
  patch: Partial<ExpenseDraft>,
  clock = now,
) {
  const result = submitExpenseCreateDraft(
    updateExpenseCreateDraft(
      state,
      "landlord",
      {
        propertyId: String(property.id),
        date: "2032-05-09",
        category: "repairs",
        amount: " 125,50 ",
        payee: 'Oficina "Luz", Lda. — 北',
        reference: 'FAT,"2032",é',
        note: "HISTORY_ONLY_PREVIOUS_NOTE",
        ...patch,
      },
      clock,
    ),
    "landlord",
    clock,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.recordId);
  return { state: result.state, id: result.recordId };
}
function record(state: ExpenseState, id: string) {
  const found = state.records.find((item) => item.id === id);
  assert.ok(found);
  return found;
}
const a = create(initial, {}, at(10));
const b = create(
  a.state,
  {
    date: "2032-05-08",
    amount: "0,01",
    category: "utilities",
    note: "Utility record",
    payee: "Water",
    reference: "WATER-1",
  },
  at(11),
);
const c = create(
  b.state,
  {
    date: "2032-05-10",
    amount: "1000000",
    category: "insurance",
    note: "Insurance record",
    payee: "Insurance",
    reference: "POLICY-1",
  },
  at(12),
);
const d = create(
  c.state,
  {
    date: "2032-05-07",
    amount: "250",
    category: "supplies",
    note: "REMOVED_RECORD_SECRET",
    payee: "Removed supplier",
    reference: "REMOVED_REF",
  },
  at(13),
);
const e = create(
  d.state,
  {
    date: "2032-05-06",
    amount: "42.1",
    category: "other",
    note: "Other record",
    payee: "Other",
    reference: "OTHER-1",
  },
  at(14),
);
const multiline =
  'Current café expense, "recorded"\r\n第二行\nسطر ثالث\rLast line';
const revision = record(e.state, a.id).revision;
const edited = submitExpenseEditDraft(
  updateExpenseEditDraft(
    e.state,
    "landlord",
    a.id,
    { note: multiline },
    revision,
  ),
  "landlord",
  a.id,
  revision,
  at(16),
);
assert.equal(edited.issue, null);
assert.equal(edited.recordId, a.id);
let state = removeExpenseRecord(
  edited.state,
  "landlord",
  d.id,
  record(edited.state, d.id).revision,
  at(17),
);
state = updateExpenseCreateDraft(
  state,
  "landlord",
  { amount: "9999", note: "PRIVATE_CREATE_DRAFT" },
  at(18),
);
state = updateExpenseEditDraft(
  state,
  "landlord",
  a.id,
  {
    amount: "8888",
    payee: "PRIVATE_EDIT_PAYEE",
    note: "PRIVATE_EDIT_DRAFT",
  },
  record(state, a.id).revision,
);
const savedRecord = record(state, a.id);
state = {
  ...state,
  records: [
    ...state.records,
    {
      ...savedRecord,
      id: "foreign-owner",
      owner: "Another owner",
      note: "FOREIGN_OWNER_SECRET",
    },
    {
      ...savedRecord,
      id: "foreign-property",
      propertyId: 2,
      note: "FOREIGN_PROPERTY_SECRET",
    },
    {
      ...savedRecord,
      id: "unknown-property",
      propertyId: 999,
      note: "UNKNOWN_PROPERTY_SECRET",
    },
  ],
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
deepFreeze(state);
const beforeJson = JSON.stringify(state);
const refs = {
  records: state.records,
  createDraft: state.createDraft,
  editDrafts: state.editDrafts,
  view: state.view,
  lastUndo: state.lastUndo,
};
const csv = expenseRecordsCsv(state, "landlord");
assert.equal(
  csv.startsWith("\uFEFF"),
  false,
  "The pure helper must not add a BOM",
);
const parsed = parseCsv(csv);
assert.deepEqual(parsed[0], headers);
assert.equal(parsed.length, 5);
assert.ok(parsed.every((row) => row.length === 12));
assert.deepEqual(
  parsed.slice(1).map((row) => row[1]),
  [c.id, a.id, b.id, e.id],
);
const exportedA = parsed.find((row) => row[1] === a.id)!;
assert.deepEqual(exportedA, [
  "Local session expense record; not payment confirmation",
  a.id,
  property.title,
  "2032-05-09",
  "Repairs",
  "125.50",
  'Oficina "Luz", Lda. — 北',
  'FAT,"2032",é',
  multiline,
  at(10).toISOString(),
  at(16).toISOString(),
  "2",
]);
assert.equal(parsed.find((row) => row[1] === b.id)![5], "0.01");
assert.equal(parsed.find((row) => row[1] === c.id)![5], "1000000.00");
assert.equal(parsed.find((row) => row[1] === e.id)![5], "42.10");
assert.ok(csv.includes('"Oficina ""Luz"", Lda. — 北"'));
for (const hidden of [
  "HISTORY_ONLY_PREVIOUS_NOTE",
  "PRIVATE_CREATE_DRAFT",
  "PRIVATE_EDIT_DRAFT",
  "PRIVATE_EDIT_PAYEE",
  "REMOVED_RECORD_SECRET",
  "REMOVED_REF",
  "FOREIGN_OWNER_SECRET",
  "FOREIGN_PROPERTY_SECRET",
  "UNKNOWN_PROPERTY_SECRET",
  "8888",
  "9999",
])
  assert.equal(csv.includes(hidden), false, hidden);

// Export selection follows visible filters/sort, including translated category searches.
const translated: Record<ExpenseCategory, string> = {
  repairs: "Reparações",
  utilities: "Serviços públicos",
  insurance: "Seguros",
  supplies: "Materiais",
  other: "Outras despesas",
};
const labels: ExpenseCsvLabels = {
  headers: [
    "Âmbito",
    "Registo",
    "Imóvel",
    "Data",
    "Categoria",
    "Valor EUR",
    "Destinatário",
    "Referência",
    "Nota",
    "Criado em",
    "Atualizado em",
    "Revisão",
  ],
  scope: 'Registo local, "nesta sessão"; sem confirmação de pagamento',
  category: (value) => translated[value],
};
deepFreeze(labels);
const expectedOrders = {
  "Newest date": [c.id, a.id, b.id, e.id],
  "Oldest date": [e.id, b.id, a.id, c.id],
  "Amount: high to low": [c.id, a.id, e.id, b.id],
  "Recently updated": [a.id, e.id, c.id, b.id],
};
for (const sort of expenseSorts) {
  const sorted = updateExpenseView(state, "landlord", { sort });
  const rows = parseCsv(expenseRecordsCsv(sorted, "landlord", labels));
  assert.deepEqual(rows[0], labels.headers);
  assert.deepEqual(
    rows.slice(1).map((row) => row[1]),
    expectedOrders[sort],
  );
  for (const row of rows.slice(1)) assert.equal(row[0], labels.scope);
  for (const filters of [
    { query: "", category: "All categories", property: "All properties" },
    { query: "", category: "utilities", property: String(property.id) },
    {
      query: "Reparações",
      category: "All categories",
      property: "All properties",
    },
    {
      query: "SEGUROS",
      category: "All categories",
      property: String(property.id),
    },
    { query: "cafE", category: "repairs", property: "All properties" },
    {
      query: "2032-05-08",
      category: "All categories",
      property: "All properties",
    },
    { query: "0.01", category: "All categories", property: "All properties" },
    {
      query: "absent exact text",
      category: "All categories",
      property: "All properties",
    },
    { query: "", category: "supplies", property: "All properties" },
  ] as const) {
    const filtered = updateExpenseView(sorted, "landlord", filters);
    const exportRows = parseCsv(
      expenseRecordsCsv(filtered, "landlord", labels),
    );
    const visible = visibleExpenseRecords(
      filtered,
      "landlord",
      labels.category,
    );
    assert.deepEqual(
      exportRows.slice(1).map((row) => row[1]),
      visible.map((item) => item.id),
    );
    assert.deepEqual(
      exportRows.slice(1).map((row) => row[4]),
      visible.map((item) => translated[item.category]),
    );
  }
}
const translatedQuery = updateExpenseView(state, "landlord", {
  query: "Reparações",
});
assert.deepEqual(
  parseCsv(expenseRecordsCsv(translatedQuery, "landlord", labels))
    .slice(1)
    .map((row) => row[1]),
  [a.id],
);
assert.deepEqual(parseCsv(expenseRecordsCsv(translatedQuery, "landlord")), [
  headers,
]);

// Absent results and all unauthorized roles produce only the requested headings.
assert.deepEqual(parseCsv(expenseRecordsCsv(initial, "landlord")), [headers]);
assert.deepEqual(parseCsv(expenseRecordsCsv(initial, "landlord", labels)), [
  labels.headers,
]);
for (const role of [
  "tenant",
  "provider",
  "spaceOperator",
  "admin",
  "unknown" as Role,
] as const) {
  assert.deepEqual(parseCsv(expenseRecordsCsv(state, role)), [headers]);
  assert.deepEqual(parseCsv(expenseRecordsCsv(state, role, labels)), [
    labels.headers,
  ]);
}
const onlyHidden = {
  ...state,
  records: state.records.filter(
    (item) =>
      item.removedAt !== null ||
      item.id.startsWith("foreign-") ||
      item.id === "unknown-property",
  ),
};
assert.deepEqual(parseCsv(expenseRecordsCsv(onlyHidden, "landlord")), [
  headers,
]);

// Exercise the export boundary directly so leading controls are not stripped by form trimming.
const dangerous = [
  '=HYPERLINK("https://invalid.example","click")',
  "+SUM(1,2)",
  "@SUM(1,2)",
  "-1+2",
  " =1+1",
  "  +1",
  "\tplain text",
  "\rplain text",
  "\nplain text",
  "\r\n=1",
  " \t@SUM(1,2)",
  "\u00a0-1",
];
const safe = [
  "Normal text",
  "",
  " already text",
  "'Already escaped",
  'comma, and "quote"',
  "First\n=second line",
  "123.45",
  "Repair - paint",
  "中文",
  "ملاحظة",
];
for (const [value, expected] of [
  ...dangerous.map((value) => [value, `'${value}`] as const),
  ...safe.map((value) => [value, value] as const),
]) {
  const guardedState = {
    ...state,
    records: [{ ...savedRecord, payee: value, reference: value, note: value }],
  };
  const row = parseCsv(expenseRecordsCsv(guardedState, "landlord"))[1];
  assert.deepEqual(row.slice(6, 9), [expected, expected, expected]);
}
const guardedLabels: ExpenseCsvLabels = {
  headers: [
    "=one",
    "+two",
    "@three",
    "-four",
    "\tfive",
    "\rsix",
    "\nseven",
    " =eight",
    " +nine",
    " @ten",
    " -eleven",
    "\u00a0=twelve",
  ],
  scope: " =LOCAL()",
  category: () => "\tCategory",
};
const guardedRows = parseCsv(
  expenseRecordsCsv(state, "landlord", guardedLabels),
);
assert.deepEqual(
  guardedRows[0],
  guardedLabels.headers.map((header) => `'${header}`),
);
for (const row of guardedRows.slice(1)) {
  assert.equal(row[0], "' =LOCAL()");
  assert.equal(row[4], "'\tCategory");
}
assert.equal(expenseRecordsCsv(state, "landlord"), csv);
assert.equal(JSON.stringify(state), beforeJson);
for (const field of [
  "records",
  "createDraft",
  "editDrafts",
  "view",
  "lastUndo",
] as const)
  assert.equal(state[field], refs[field]);
assert.equal(initial.records.length, 0);
assert.equal(initial.createDraft, null);
console.log("Expense CSV checks passed.");
