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

console.log(
  "Operations localization checks passed: all six dictionaries, plural forms, interpolation, bilingual labels, canonical filter values, structured errors and language-independent document state.",
);
