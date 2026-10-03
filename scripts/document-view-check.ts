import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  addLocalDocuments,
  categoriesForRole,
  createInitialDocumentState,
  documentCategories,
  documentView,
  removeDocument,
  resetDocumentFilters,
  restoreDocument,
  updateDocumentView,
  workspaceDocuments,
  type DocumentState,
  type DocumentView,
} from "../src/components/documentState";

const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const defaults: DocumentView = {
  query: "",
  category: "All categories",
  source: "All documents",
  sort: "Recently added",
  addCategory: "Other",
};
const initial = createInitialDocumentState();
const fresh = createInitialDocumentState();
const legacy: DocumentState = {
  records: initial.records,
  removed: {},
  nextId: initial.nextId,
};
assert.equal(
  new Set(roles.map((role) => initial.views?.[role])).size,
  roles.length,
);
for (const role of roles) {
  assert.deepEqual(documentView(initial, role), defaults);
  assert.deepEqual(documentView(legacy, role), defaults);
  assert.notEqual(initial.views?.[role], fresh.views?.[role]);
  const detached: DocumentView = documentView(initial, role);
  assert.notEqual(detached, initial.views?.[role]);
  assert.notEqual(detached, documentView(initial, role));
  detached.query = "Editing the returned view";
  detached.addCategory = categoriesForRole(role)[0];
  assert.deepEqual(documentView(initial, role), defaults);
  assert.deepEqual(documentView(fresh, role), defaults);
  assert.equal(updateDocumentView(initial, role, {}), initial);
  assert.equal(updateDocumentView(initial, role, defaults), initial);
  assert.equal(resetDocumentFilters(initial, role), initial);
  assert.equal(resetDocumentFilters(legacy, role), legacy);
  const retained = updateDocumentView(legacy, role, { query: "  My files  " });
  assert.deepEqual(Object.keys(retained.views!), [role]);
  assert.equal(documentView(retained, role).query, "  My files  ");
  assert.equal(retained.records, legacy.records);
  assert.equal(retained.removed, legacy.removed);
}
assert.equal(
  legacy.views,
  undefined,
  "Reading or resetting legacy defaults never stores an eager view",
);

for (const role of roles) {
  for (const category of documentCategories) {
    const changed = updateDocumentView(initial, role, {
      category,
      addCategory: category,
    });
    if (categoriesForRole(role).includes(category)) {
      assert.equal(documentView(changed, role).category, category);
      assert.equal(documentView(changed, role).addCategory, category);
      assert.equal(
        updateDocumentView(changed, role, { category, addCategory: category }),
        changed,
      );
    } else {
      assert.equal(
        changed,
        initial,
        `${role}: foreign categories are unavailable for both filtering and adding`,
      );
    }
  }
  for (const source of [
    "All documents",
    "Local files",
    "Sample previews",
  ] as const) {
    const changed = updateDocumentView(initial, role, { source });
    assert.equal(documentView(changed, role).source, source);
  }
  for (const sort of [
    "Recently added",
    "Document name",
    "Largest first",
  ] as const) {
    const changed = updateDocumentView(initial, role, { sort });
    assert.equal(documentView(changed, role).sort, sort);
  }
  const raw = `  ${"x".repeat(195)}  trailing text`;
  const bounded = updateDocumentView(initial, role, { query: raw });
  assert.equal(documentView(bounded, role).query, raw.slice(0, 200));
  assert.equal(documentView(bounded, role).query.length, 200);
  assert.equal(
    updateDocumentView(bounded, role, {
      query: `${raw.slice(0, 200)}different suffix`,
    }),
    bounded,
  );
  assert.equal(
    documentView(updateDocumentView(initial, role, { query: "   " }), role)
      .query,
    "   ",
  );

  for (const field of Object.keys(defaults) as Array<keyof DocumentView>) {
    for (const value of [null, undefined, 1, true, {}, []]) {
      const patch = { [field]: value } as Partial<DocumentView>;
      assert.equal(
        updateDocumentView(initial, role, patch),
        initial,
        `${role} ${field}: reject non-string input`,
      );
    }
  }
  for (const patch of [
    { category: "Other " },
    { addCategory: "All categories" },
    { source: "local" },
    { sort: "largest first" },
    { unknown: "ignored" },
    null,
    undefined,
    "not a patch",
  ]) {
    assert.equal(
      updateDocumentView(initial, role, patch as Partial<DocumentView>),
      initial,
    );
  }
  const ownCategory = categoriesForRole(role)[0];
  const foreignCategory = documentCategories.find(
    (category) => !categoriesForRole(role).includes(category),
  )!;
  const mixedPatch = {
    query: `  ${role} notes  `,
    category: foreignCategory,
    addCategory: ownCategory,
    source: "Local files",
    sort: "invalid-sort",
  } as unknown as Partial<DocumentView>;
  const mixed = updateDocumentView(initial, role, mixedPatch);
  assert.deepEqual(
    documentView(mixed, role),
    {
      ...defaults,
      query: `  ${role} notes  `,
      source: "Local files",
      addCategory: ownCategory,
    },
    "Invalid fields never prevent valid sibling updates",
  );
  mixedPatch.query = "Mutated caller patch";
  assert.equal(documentView(mixed, role).query, `  ${role} notes  `);
}

for (const role of [
  "",
  "unknown",
  "constructor",
  "__proto__",
  null,
  1,
] as unknown as Role[]) {
  const view = documentView(initial, role);
  assert.deepEqual(view, defaults);
  view.query = "Unsupported workspace";
  assert.deepEqual(documentView(initial, role), defaults);
  assert.equal(
    updateDocumentView(initial, role, {
      query: "ignored",
      source: "Local files",
    }),
    initial,
  );
  assert.equal(resetDocumentFilters(initial, role), initial);
}

let configured = initial;
for (const role of roles) {
  const before = configured;
  const sample = workspaceDocuments(configured, role)[0];
  configured = removeDocument(configured, role, sample.id);
  configured = updateDocumentView(configured, role, {
    query: `  private ${role} search  `,
    category: categoriesForRole(role)[0],
    source: "Sample previews",
    sort: "Largest first",
    addCategory: categoriesForRole(role)[0],
  });
  for (const other of roles.filter((item) => item !== role)) {
    assert.equal(configured.views?.[other], before.views?.[other]);
  }
}
const configuredJson = JSON.stringify(configured);
for (const role of roles) {
  const reset = resetDocumentFilters(configured, role);
  assert.deepEqual(documentView(reset, role), {
    ...defaults,
    addCategory: categoriesForRole(role)[0],
  });
  assert.equal(resetDocumentFilters(reset, role), reset);
  assert.equal(reset.records, configured.records);
  assert.equal(reset.removed, configured.removed);
  assert.equal(reset.nextId, configured.nextId);
  for (const other of roles.filter((item) => item !== role)) {
    assert.equal(reset.views?.[other], configured.views?.[other]);
  }
}

const now = new Date("2026-10-03T12:00:00.000Z");
const invalidFile = new File(
  ["<p>Active content is unsupported</p>"],
  "rejected.html",
  { type: "text/html" },
);
const emptyFile = new File([], "empty.txt", { type: "text/plain" });
for (const role of roles) {
  const category = documentView(configured, role).addCategory;
  const firstFile = new File(
    [`${role} selected local file`],
    `${role}-notes.txt`,
    { type: "text/plain" },
  );
  const secondFile = new File(
    ["%PDF-1.7 local example"],
    `${role}-record.pdf`,
    { type: "application/pdf" },
  );
  for (const files of [[], [invalidFile, emptyFile]]) {
    const failed = addLocalDocuments(configured, role, files, category, now);
    assert.equal(failed.added, 0);
    assert.equal(
      failed.state,
      configured,
      "Empty/failed batches preserve filters, undo and every workspace reference",
    );
  }
  const foreignCategory = documentCategories.find(
    (item) => !categoriesForRole(role).includes(item),
  )!;
  const wrongCategory = addLocalDocuments(
    configured,
    role,
    [firstFile],
    foreignCategory,
    now,
  );
  assert.equal(wrongCategory.added, 0);
  assert.equal(wrongCategory.state, configured);

  const added = addLocalDocuments(
    configured,
    role,
    [invalidFile, firstFile, firstFile, secondFile],
    category,
    now,
  );
  assert.equal(added.added, 2);
  assert.deepEqual(
    added.issues.map((issue) => issue.code),
    ["unsupportedFormat", "alreadyAdded"],
  );
  assert.deepEqual(documentView(added.state, role), {
    ...defaults,
    addCategory: category,
  });
  assert.equal(
    added.state.removed,
    configured.removed,
    "A successful add preserves all undo slots",
  );
  assert.equal(added.state.nextId, configured.nextId + 2);
  for (const oldRecord of configured.records)
    assert.ok(added.state.records.includes(oldRecord));
  for (const other of roles.filter((item) => item !== role)) {
    assert.equal(added.state.views?.[other], configured.views?.[other]);
    assert.deepEqual(
      workspaceDocuments(added.state, other),
      workspaceDocuments(configured, other),
    );
  }
  const local = workspaceDocuments(added.state, role).filter(
    (item) => item.source === "local",
  );
  assert.equal(local.length, 2);
  assert.equal(local[0].file, firstFile);
  assert.equal(local[1].file, secondFile);
  assert.ok(
    local.every(
      (item) =>
        item.category === category && item.addedAt === now.toISOString(),
    ),
  );

  const retained = updateDocumentView(added.state, role, {
    query: "  selected file  ",
    source: "Local files",
    sort: "Document name",
  });
  const duplicate = addLocalDocuments(
    retained,
    role,
    [firstFile],
    category,
    now,
  );
  assert.equal(duplicate.added, 0);
  assert.equal(
    duplicate.state,
    retained,
    "A duplicate-only batch cannot reset the retained view",
  );
  const removed = removeDocument(retained, role, local[0].id);
  assert.equal(removed.views, retained.views);
  assert.equal(removed.removed[role], local[0]);
  for (const other of roles.filter((item) => item !== role)) {
    assert.equal(removed.removed[other], retained.removed[other]);
    assert.equal(removeDocument(retained, other, local[0].id), retained);
  }
  const restored = restoreDocument(removed, role);
  assert.notEqual(restored, removed);
  assert.equal(restored.views, retained.views);
  assert.ok(
    restored.records.includes(local[0]),
    "Undo restores the exact retained File record",
  );
  assert.equal(restored.removed[role], undefined);
  assert.equal(restoreDocument(restored, role), restored);
  assert.equal(removeDocument(restored, role, "missing"), restored);
}
assert.equal(
  JSON.stringify(configured),
  configuredJson,
  "Updates, adds, removal and undo never mutate the input views",
);
assert.ok(roles.every((role) => documentView(fresh, role).query === ""));

console.log(
  "Document view checks passed: five-workspace isolation, detached defaults, validated preferences, atomic add resets, and retained undo.",
);
