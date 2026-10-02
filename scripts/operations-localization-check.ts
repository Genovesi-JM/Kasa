import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInstance } from "i18next";
import ts from "typescript";
import {
  documentCategoryKeys,
  documentIssueKeys,
  documentIssueText,
  documentSortKeys,
  documentSourceKeys,
  operationsLanguage,
  operationsLocales,
  operationsResources,
  operationText,
} from "../src/locales/operations";
import type {
  OperationsKey,
  OperationsMessage,
} from "../src/locales/operations/types";
import {
  addLocalDocuments,
  categoriesForRole,
  createInitialDocumentState,
  documentCategories,
  documentFileIssue,
  documentIssueMessages,
  MAX_DOCUMENT_BYTES,
  restoreDocumentError,
  restoreDocumentIssue,
  validateDocumentFile,
} from "../src/components/documentState";
import type { Role } from "../src/types";
import {
  createInitialRentRecordState,
  filterRentRecords,
  rentRecordSummary,
  rentRecordsCsv,
  rentStatuses,
  rentTransferIssues,
  rentTransferIssueMessages,
  validateRentTransfer,
  visibleRentRecords,
} from "../src/components/rentRecordState";
import {
  localizedRentCsvLabels,
  localizedRentSummaryLabels,
  rentFormatters,
  rentIssueKeys,
  rentSortKeys,
  rentStatusKeys,
} from "../src/locales/operations/rentLabels";
import type { OperationsValues } from "../src/locales/operations/types";
import {
  createInitialMaintenanceState,
  createMaintenanceFilters,
  filterMaintenanceRecords,
  maintenanceCategories,
  maintenancePriorities,
  maintenanceStatuses,
  maintenanceIssueMessages,
  maintenanceReportIssues,
  maintenanceScheduleIssues,
  validateMaintenanceReport,
  validateMaintenanceSchedule,
} from "../src/components/maintenanceState";
import {
  maintenanceCategoryKeys,
  maintenancePriorityKeys,
  maintenanceStatusKeys,
  maintenanceSortKeys,
  maintenanceViewKeys,
  maintenanceIssueKeys,
  maintenanceFormatters,
} from "../src/locales/operations/maintenanceLabels";

const languages = ["pt", "en", "es", "fr", "ar", "zh"] as const;
const instance = createInstance();
await instance.init({
  resources: Object.fromEntries(
    languages.map((language) => [
      language,
      { operations: operationsResources[language] },
    ]),
  ),
  lng: "pt",
  fallbackLng: "en",
  defaultNS: "operations",
  interpolation: { escapeValue: false },
});

const english = operationsResources.en;
const englishKeys = Object.keys(english) as Array<keyof typeof english>;
const pluralBases = englishKeys
  .filter((key) => key.endsWith("_one"))
  .map((key) => key.slice(0, -4));
const placeholders = (text: string) =>
  [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort();
assert.deepEqual(
  Object.keys(operationsResources).sort(),
  [...languages].sort(),
);
assert.equal(operationsLanguage(undefined), "pt");
assert.equal(operationsLanguage("en-GB"), "en");
assert.equal(operationsLanguage("constructor"), "pt");
for (const [count, expected] of [
  [0, "0 ficheiros locais"],
  [1, "1 ficheiro local"],
  [2, "2 ficheiros locais"],
] as const) {
  assert.equal(
    operationText(instance, "pt", "documents_localCount", { count }),
    expected,
  );
}
assert.equal(
  instance.getFixedT("pt", "operations")("documents_localCount", { count: 0 }),
  "0 ficheiro local",
  "Operations formatting must not change global i18next plural semantics",
);

for (const language of languages) {
  const dictionary: Record<string, string> = operationsResources[language];
  for (const key of englishKeys) {
    assert.ok(Object.hasOwn(dictionary, key), `${language} missing ${key}`);
    assert.ok(dictionary[key].trim(), `${language} has an empty ${key}`);
    assert.deepEqual(
      placeholders(dictionary[key]),
      placeholders(english[key]),
      `${language}: ${key} interpolation`,
    );
  }
  for (const key of Object.keys(dictionary)) {
    if (Object.hasOwn(english, key)) continue;
    const base = key.replace(/_(zero|two|few|many)$/, "");
    assert.ok(pluralBases.includes(base), `${language}: unexpected key ${key}`);
    assert.deepEqual(placeholders(dictionary[key]), ["count"]);
  }
  for (const base of pluralBases) {
    for (const plural of new Intl.PluralRules(
      operationsLocales[language],
    ).resolvedOptions().pluralCategories) {
      assert.ok(
        dictionary[`${base}_${plural}`],
        `${language}: missing ${base}_${plural}`,
      );
    }
    for (const count of [0, 1, 2, 3, 11, 100, 1_000_000]) {
      const key = base as OperationsKey;
      const text = operationText(instance, language, key, { count });
      assert.ok(
        !text.includes("documents_"),
        `${language}: unresolved plural ${key}`,
      );
      assert.ok(!text.includes("{{"), `${language}: unresolved count ${key}`);
      assert.ok(
        text.includes(String(count)),
        `${language}: count lost in ${key}`,
      );
      if (language === "ar" || language === "zh") {
        const englishText = operationText(instance, "en", key, { count });
        assert.ok(
          text.endsWith(`(${englishText})`),
          `${language}: bilingual plural ${key}`,
        );
      }
    }
  }
  const addLabel = operationText(instance, language, "documents_addFiles");
  assert.ok(addLabel.includes(dictionary.documents_addFiles));
  if (language === "ar" || language === "zh")
    assert.ok(addLabel.endsWith(`(${english.documents_addFiles})`));
  else assert.equal(addLabel, dictionary.documents_addFiles);
}

// Enum/filter values remain independent of the translated option labels.
assert.deepEqual(Object.keys(documentCategoryKeys), [...documentCategories]);
assert.deepEqual(Object.keys(documentSourceKeys), [
  "All documents",
  "Local files",
  "Sample previews",
]);
assert.deepEqual(Object.keys(documentSortKeys), [
  "Recently added",
  "Document name",
  "Largest first",
]);
assert.deepEqual(
  Object.keys(documentIssueKeys).sort(),
  Object.keys(documentIssueMessages).sort(),
);
for (const role of [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
] as Role[]) {
  for (const category of categoriesForRole(role))
    assert.ok(documentCategoryKeys[category]);
}

// Check the actual JSX: translating option text must never translate submitted values.
const component = ts.createSourceFile(
  "Documents.tsx",
  readFileSync(
    new URL("../src/components/Documents.tsx", import.meta.url),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let optionCount = 0;
function visit(node: ts.Node) {
  if (
    ts.isJsxOpeningElement(node) &&
    node.tagName.getText(component) === "option"
  ) {
    optionCount += 1;
    const value = node.attributes.properties.find(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(component) === "value",
    );
    assert.ok(
      value && ts.isJsxAttribute(value) && value.initializer,
      "Every document option needs an explicit canonical value",
    );
    if (ts.isStringLiteral(value.initializer))
      assert.equal(value.initializer.text, "All categories");
    else {
      assert.ok(
        ts.isJsxExpression(value.initializer) && value.initializer.expression,
      );
      assert.ok(
        ["item", "value"].includes(
          value.initializer.expression.getText(component),
        ),
        "Option values must come from canonical category/filter maps",
      );
    }
  }
  ts.forEachChild(node, visit);
}
visit(component);
assert.equal(
  optionCount,
  5,
  "Cover new-file category, category filter, source and sort options",
);

const initial = createInitialDocumentState();
const original = JSON.stringify(initial);
const empty = new File([], "empty.txt", { type: "text/plain" });
assert.deepEqual(documentFileIssue(empty), { code: "empty" });
assert.equal(validateDocumentFile(empty), "The file is empty.");
assert.deepEqual(
  documentFileIssue({
    name: "large.pdf",
    type: "application/pdf",
    size: MAX_DOCUMENT_BYTES + 1,
  }),
  { code: "fileTooLarge" },
);
assert.deepEqual(restoreDocumentIssue(initial, "tenant"), {
  code: "nothingToRestore",
});
assert.equal(
  restoreDocumentError(initial, "tenant"),
  "There is no document to restore.",
);
const rejected = addLocalDocuments(initial, "tenant", [empty], "Other");
assert.equal(rejected.state, initial);
assert.deepEqual(rejected.issues, [{ code: "empty", fileName: "empty.txt" }]);
assert.deepEqual(rejected.errors, ["empty.txt: The file is empty."]);
const invalidCategory = addLocalDocuments(
  initial,
  "tenant",
  [],
  "Platform records",
);
assert.deepEqual(invalidCategory.issues, [{ code: "unavailableCategory" }]);
assert.deepEqual(invalidCategory.errors, [
  "Choose a category available in this workspace.",
]);

// Retained feedback/errors are rendered in the current language, never saved as translations.
const feedback: OperationsMessage = {
  key: "documents_restored",
  values: { name: "original-name.txt" },
};
for (const language of languages) {
  await instance.changeLanguage(language);
  const resolved = operationsLanguage(
    instance.resolvedLanguage || instance.language,
  );
  assert.equal(resolved, language);
  for (const code of Object.keys(documentIssueMessages) as Array<
    keyof typeof documentIssueMessages
  >) {
    const text = documentIssueText(instance, resolved, {
      code,
      fileName: "original-name.txt",
    });
    assert.ok(text.includes("original-name.txt"));
    assert.ok(
      text.includes(operationsResources[language][documentIssueKeys[code]]),
    );
    assert.ok(!text.includes("{{"));
  }
  assert.ok(
    operationText(instance, resolved, feedback.key, feedback.values).includes(
      "original-name.txt",
    ),
  );
  assert.equal(
    JSON.stringify(initial),
    original,
    "Changing language must preserve stored names/categories/sample contents",
  );
}

assert.deepEqual(Object.keys(rentStatusKeys), [...rentStatuses]);
assert.deepEqual(
  Object.keys(rentIssueKeys).sort(),
  Object.keys(rentTransferIssueMessages).sort(),
);
assert.deepEqual(Object.keys(rentSortKeys), [
  "Most recently updated",
  "Amount: high to low",
  "Property name",
]);
const rentComponent = ts.createSourceFile(
  "RentRecords.tsx",
  readFileSync(
    new URL("../src/components/RentRecords.tsx", import.meta.url),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let rentOptions = 0;
function visitRent(node: ts.Node) {
  if (
    ts.isJsxOpeningElement(node) &&
    node.tagName.getText(rentComponent) === "option"
  ) {
    rentOptions += 1;
    const value = node.attributes.properties.find(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(rentComponent) === "value",
    );
    assert.ok(
      value && ts.isJsxAttribute(value) && value.initializer,
      "Rent filters need canonical option values",
    );
    if (ts.isStringLiteral(value.initializer)) {
      assert.ok(
        ["All periods", "All statuses", "All properties"].includes(
          value.initializer.text,
        ),
      );
    } else {
      assert.ok(
        ts.isJsxExpression(value.initializer) && value.initializer.expression,
      );
      assert.ok(
        ["period", "status", "property", "value"].includes(
          value.initializer.expression.getText(rentComponent),
        ),
      );
    }
  }
  if (ts.isJsxText(node))
    assert.equal(
      node.text.trim(),
      "",
      "Rent UI copy must use translation resources",
    );
  if (
    ts.isJsxAttribute(node) &&
    ["aria-label", "title", "placeholder"].includes(
      node.name.getText(rentComponent),
    )
  ) {
    assert.ok(
      node.initializer && ts.isJsxExpression(node.initializer),
      "Accessible rent labels must be localized",
    );
  }
  ts.forEachChild(node, visitRent);
}
visitRent(rentComponent);
assert.equal(rentOptions, 7);

const invalidRentDraft = {
  amount: "1.001",
  transferredOn: "2099-02-30",
  reference: "",
  note: "x".repeat(1001),
};
assert.deepEqual(rentTransferIssues(invalidRentDraft), {
  amount: "amount",
  transferredOn: "transferredOn",
  reference: "reference",
  note: "note",
});
assert.deepEqual(
  validateRentTransfer(invalidRentDraft),
  rentTransferIssueMessages,
  "Existing English validator contract remains unchanged",
);
const rentState = createInitialRentRecordState();
const originalRentState = JSON.stringify(rentState);
const tenantRentRecords = visibleRentRecords(rentState, "tenant");
const rentRecord = tenantRentRecords.find((record) => record.transfer)!;
const exportRecord = {
  ...rentRecord,
  transfer: {
    ...rentRecord.transfer!,
    reference: '=HYPERLINK("unsafe")',
    note: "Original note, unchanged.",
  },
};
const defaultSummary = rentRecordSummary(exportRecord);
const defaultCsv = rentRecordsCsv([exportRecord]);
const defaultCsvRow = defaultCsv.split("\r\n")[1];
const stableCsvData = defaultCsvRow.slice(defaultCsvRow.indexOf('","') + 2);
const rentFeedback: OperationsMessage = { key: "rent_transferSaved" };
for (const language of languages) {
  await instance.changeLanguage(language);
  const tr = (key: OperationsKey, values?: OperationsValues) =>
    operationText(instance, language, key, values);
  const locale = operationsLocales[language];
  const formats = rentFormatters(locale);
  const labels = localizedRentSummaryLabels(tr, locale);
  const summary = rentRecordSummary(exportRecord, labels);
  assert.ok(summary.includes(operationsResources[language].rent_summaryScope));
  assert.ok(
    summary.includes(operationsResources[language].rent_summaryBankNotice),
  );
  assert.ok(summary.includes(tr(rentStatusKeys[exportRecord.status])));
  assert.ok(summary.includes(formats.money(exportRecord.amountDueCents)));
  assert.ok(
    summary.includes(exportRecord.transfer.reference),
    "User reference is never translated",
  );
  assert.ok(summary.includes(exportRecord.tenant));
  assert.ok(summary.includes(exportRecord.property));
  assert.ok(!summary.includes("{{"));
  assert.equal(
    formats.dateLabel("2026-10-03"),
    new Date("2026-10-03T12:00:00").toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  );
  assert.equal(
    formats.periodLabel("2026-10"),
    new Date("2026-10-01T12:00:00").toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    }),
  );
  for (const [code, key] of Object.entries(rentIssueKeys)) {
    assert.ok(
      tr(key).includes(operationsResources[language][key]),
      `${language} error ${code}`,
    );
  }
  for (const count of [0, 1, 2]) {
    for (const key of [
      "rent_matchingCount",
      "rent_allPeriodsCount",
      "rent_csvStarted",
    ] as const) {
      assert.ok(tr(key, { count }).includes(String(count)));
      assert.ok(!tr(key, { count }).includes("{{"));
    }
  }
  assert.ok(
    tr(rentFeedback.key).includes(
      operationsResources[language].rent_transferSaved,
    ),
  );
  for (const status of rentStatuses) {
    assert.ok(
      tr(rentStatusKeys[status]).includes(
        operationsResources[language][rentStatusKeys[status]],
      ),
    );
    const filtered = filterRentRecords(tenantRentRecords, {
      status,
      property: "All properties",
      period: "All periods",
      sort: "Most recently updated",
    });
    assert.ok(
      filtered.every((record) => record.status === status),
      "Localized labels cannot change domain filtering",
    );
  }
  const csv = rentRecordsCsv([exportRecord], localizedRentCsvLabels(tr));
  assert.ok(
    csv
      .split("\r\n")[0]
      .includes(operationsResources[language].rent_csvAmountDue),
  );
  assert.ok(
    csv.split("\r\n")[1].endsWith(stableCsvData),
    "CSV amounts, dates, statuses and user text stay canonical",
  );
  assert.ok(
    csv.includes(`"'=HYPERLINK(""unsafe"")"`),
    "Localized CSV retains spreadsheet formula neutralization",
  );
  assert.equal(
    rentRecordSummary(exportRecord),
    defaultSummary,
    "Default summary helper output stays English",
  );
  assert.equal(
    rentRecordsCsv([exportRecord]),
    defaultCsv,
    "Default CSV helper output stays English",
  );
  assert.equal(
    JSON.stringify(rentState),
    originalRentState,
    "Locale changes never rewrite rent data or history",
  );
}

assert.deepEqual(Object.keys(maintenanceStatusKeys), [...maintenanceStatuses]);
assert.deepEqual(Object.keys(maintenanceCategoryKeys), [
  ...maintenanceCategories,
]);
assert.deepEqual(Object.keys(maintenancePriorityKeys), [
  ...maintenancePriorities,
]);
assert.deepEqual(Object.keys(maintenanceViewKeys), ["Board", "List"]);
assert.deepEqual(Object.keys(maintenanceSortKeys), [
  "Urgent first",
  "Newest reported",
  "Oldest unresolved",
  "Scheduled visit",
]);
assert.deepEqual(
  Object.keys(maintenanceIssueKeys).sort(),
  Object.keys(maintenanceIssueMessages).sort(),
);
const maintenanceComponent = ts.createSourceFile(
  "Maintenance.tsx",
  readFileSync(
    new URL("../src/components/Maintenance.tsx", import.meta.url),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let maintenanceOptions = 0;
function visitMaintenance(node: ts.Node) {
  if (
    ts.isJsxOpeningElement(node) &&
    node.tagName.getText(maintenanceComponent) === "option"
  ) {
    maintenanceOptions += 1;
    const value = node.attributes.properties.find(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(maintenanceComponent) === "value",
    );
    assert.ok(
      value && ts.isJsxAttribute(value) && value.initializer,
      "Maintenance options need canonical values",
    );
    if (ts.isStringLiteral(value.initializer)) {
      assert.ok(
        [
          "",
          "All statuses",
          "All priorities",
          "All categories",
          "All properties",
        ].includes(value.initializer.text),
      );
    } else {
      assert.ok(
        ts.isJsxExpression(value.initializer) && value.initializer.expression,
      );
      assert.ok(
        ["home.id", "category", "priority", "status", "sort"].includes(
          value.initializer.expression.getText(maintenanceComponent),
        ),
      );
    }
  }
  if (ts.isJsxText(node))
    assert.ok(
      !/[\p{L}\p{N}]/u.test(node.text),
      "Maintenance UI copy belongs in translation resources",
    );
  if (
    ts.isJsxAttribute(node) &&
    ["aria-label", "title", "placeholder"].includes(
      node.name.getText(maintenanceComponent),
    )
  ) {
    assert.ok(
      node.initializer && ts.isJsxExpression(node.initializer),
      "Maintenance accessible labels must be localized",
    );
  }
  ts.forEachChild(node, visitMaintenance);
}
visitMaintenance(maintenanceComponent);
assert.equal(maintenanceOptions, 13);

const maintenanceState = createInitialMaintenanceState();
const originalMaintenanceState = JSON.stringify(maintenanceState);
const reportDraft = {
  propertyId: "",
  title: "",
  description: "",
  category: "",
  priority: "",
  accessNotes: "x".repeat(1001),
};
const reportIssues = maintenanceReportIssues(reportDraft, "tenant");
const reportErrors = validateMaintenanceReport(reportDraft, "tenant");
assert.equal(Object.keys(reportIssues).length, 6);
for (const [field, code] of Object.entries(reportIssues))
  assert.equal(
    reportErrors[field as keyof typeof reportErrors],
    maintenanceIssueMessages[code],
  );
const checkNow = new Date(2026, 9, 3, 12);
const invalidVisit = { date: "2026-02-30", time: "24:00", provider: "" };
const visitIssues = maintenanceScheduleIssues(invalidVisit, checkNow);
const visitErrors = validateMaintenanceSchedule(invalidVisit, checkNow);
assert.deepEqual(visitIssues, {
  date: "invalidDate",
  time: "invalidTime",
  provider: "provider",
});
for (const [field, code] of Object.entries(visitIssues))
  assert.equal(
    visitErrors[field as keyof typeof visitErrors],
    maintenanceIssueMessages[code],
  );
assert.equal(
  maintenanceScheduleIssues(
    { date: "2026-10-03", time: "10:00", provider: "Original provider" },
    checkNow,
  ).date,
  "futureVisit",
);
for (const language of languages) {
  const tr = (key: OperationsKey, values?: OperationsValues) =>
    operationText(instance, language, key, values);
  const labels = (record: (typeof maintenanceState.records)[number]) =>
    [
      tr(maintenanceCategoryKeys[record.category]),
      tr(maintenancePriorityKeys[record.priority]),
      tr(maintenanceStatusKeys[record.status]),
    ].join(" ");
  for (const code of Object.keys(maintenanceIssueMessages) as Array<
    keyof typeof maintenanceIssueMessages
  >) {
    assert.ok(
      tr(maintenanceIssueKeys[code]).includes(
        operationsResources[language][maintenanceIssueKeys[code]],
      ),
    );
  }
  for (const status of maintenanceStatuses) {
    const result = filterMaintenanceRecords(
      maintenanceState.records,
      { ...createMaintenanceFilters(), status },
      labels,
    );
    assert.ok(result.every((record) => record.status === status));
  }
  const plumbing = filterMaintenanceRecords(
    maintenanceState.records,
    {
      ...createMaintenanceFilters(),
      query: operationsResources[language].maintenance_categoryPlumbing,
    },
    labels,
  );
  assert.ok(plumbing.length > 0);
  assert.ok(
    plumbing.every((record) => record.category === "Plumbing"),
    "Search accepts displayed category names without rewriting enums",
  );
  for (const count of [0, 1, 2])
    assert.ok(tr("maintenance_results", { count }).includes(String(count)));
  const formats = maintenanceFormatters(operationsLocales[language]);
  assert.equal(
    formats.dateLabel("2026-10-03"),
    new Date("2026-10-03T12:00:00").toLocaleDateString(
      operationsLocales[language],
      { day: "numeric", month: "short", year: "numeric" },
    ),
  );
  assert.ok(
    tr("maintenance_openRequest", {
      title: "Original issue title",
      property: "Original property name",
    }).includes("Original issue title"),
  );
  assert.ok(
    tr("maintenance_visitSaved").includes(
      operationsResources[language].maintenance_visitSaved,
    ),
  );
  assert.equal(
    JSON.stringify(maintenanceState),
    originalMaintenanceState,
    "Translations must preserve original issue text, providers and history",
  );
}

console.log(
  "Operations localization checks passed: all six dictionaries, plurals, interpolation, bilingual labels, canonical document/rent/maintenance filters, structured errors, localized exports/search and unchanged domain state.",
);
