import assert from "node:assert/strict";
import type { Role } from "../src/types";
import { spaceVenues } from "../src/data";
import {
  addSpaceListingPhotos,
  addSpaceListingUnit,
  createInitialSpaceListingState,
  createSpaceListingDraft,
  markSpaceListingReady,
  MAX_SPACE_LISTING_DRAFT_BYTES,
  MAX_SPACE_LISTING_PHOTOS,
  MAX_SPACE_LISTING_PHOTO_BYTES,
  MAX_SPACE_LISTING_UNITS,
  MAX_SPACE_LISTING_WORKSPACE_BYTES,
  moveSpaceListingStep,
  removeSpaceListingDraft,
  removeSpaceListingPhoto,
  removeSpaceListingUnit,
  removedSpaceListingDraft,
  restoreSpaceListingDraft,
  setSpaceListingAmenities,
  setSpaceListingCover,
  spaceListingDraft,
  spaceListingHasErrors,
  spaceListingPhotoBytes,
  spaceListingPhotoProblem,
  spaceListingPriceCents,
  spaceListingView,
  updateSpaceListingDraft,
  updateSpaceListingUnit,
  updateSpaceListingView,
  validateSpaceListingDraft,
  visibleSpaceListingDrafts,
  workspaceSpaceListingOperatorId,
  type SpaceListingCategory,
  type SpaceListingDraft,
  type SpaceListingFields,
  type SpaceListingState,
  type SpaceListingUnitFields,
} from "../src/components/spaceListingState";

const operator: Role = "spaceOperator";
const others: Role[] = ["tenant", "landlord", "provider", "admin"];
const now = new Date("2026-10-03T11:00:00.000Z");
const later = new Date("2026-10-03T12:00:00.000Z");
const catalogueBefore = JSON.stringify(spaceVenues);
const initial = createInitialSpaceListingState();
assert.deepEqual(initial, {
  drafts: [],
  removed: null,
  nextId: 1,
  view: { filter: "All", query: "", selectedDraftId: null },
});
assert.notEqual(createInitialSpaceListingState(), initial);
const created = createSpaceListingDraft(initial, operator, "Events", now);
const id = created.draftId!;
assert.equal(created.issue, null);
const record = (state: SpaceListingState, target = id) =>
  state.drafts.find((draft) => draft.id === target)!;
const blank = record(created.state);
const unitId = blank.units[0].id;
assert.equal(id, "space-draft-1");
assert.equal(blank.operatorId, workspaceSpaceListingOperatorId);
assert.equal(blank.fields.category, "Events");
assert.equal(blank.fields.name, "");
assert.equal(blank.fields.relationship, "");
assert.equal(blank.fields.openingStart, "");
assert.equal(blank.units[0].price, "");
assert.equal(blank.units[0].capacity, "");
assert.equal(blank.units.length, 1);
assert.equal(blank.photos.length, 0);
assert.equal(blank.readySnapshot, null);
assert.equal(created.state.view.selectedDraftId, id);
assert.equal(initial.drafts.length, 0);
assert.equal(spaceListingDraft(created.state, operator, "missing"), undefined);
assert.ok(spaceListingHasErrors(validateSpaceListingDraft(blank)));
assert.equal(
  moveSpaceListingStep(created.state, operator, id, 2),
  created.state,
);
assert.equal(
  moveSpaceListingStep(created.state, operator, id, 4),
  created.state,
);
assert.equal(
  markSpaceListingReady(created.state, operator, id, 0, now).issue,
  "notReviewed",
);
assert.ok(
  spaceListingHasErrors(
    markSpaceListingReady(
      { ...created.state, drafts: [{ ...blank, step: 4 }] },
      operator,
      id,
      0,
      now,
    ).errors,
  ),
);
assert.equal(
  createSpaceListingDraft(initial, operator, "Hotel" as SpaceListingCategory)
    .issue,
  "invalidCategory",
);

const basics: Partial<SpaceListingFields> = {
  name: "  Neighbourhood event hall  ",
  country: "Portugal",
  city: "Porto",
  neighbourhood: "Bonfim",
  address: "Rua do Exemplo, 42",
  relationship: "Operator",
  description:
    "  Flexible event hall with seating and an accessible entrance.  ",
};
const unit: SpaceListingUnitFields = {
  name: "  Main hall  ",
  activity: "Celebrations",
  capacity: "120",
  price: "95,50",
  billingUnit: "event",
};
const basicState = updateSpaceListingDraft(
  created.state,
  operator,
  id,
  basics,
  later,
);
assert.equal(record(basicState).revision, 1);
assert.equal(record(basicState).createdAt, now.toISOString());
assert.equal(record(basicState).updatedAt, later.toISOString());
assert.equal(blank.fields.name, "");
assert.notEqual(record(basicState).fields, blank.fields);
assert.equal(
  updateSpaceListingDraft(basicState, operator, id, basics),
  basicState,
  "Identical FormData does not invalidate a revision",
);
assert.equal(
  updateSpaceListingDraft(basicState, operator, "missing", basics),
  basicState,
);
assert.equal(
  updateSpaceListingDraft(basicState, operator, id, {
    operatorId: "foreign",
    status: "Ready",
    id: "forged",
    category: "Hotel",
  } as unknown as Partial<SpaceListingFields>),
  basicState,
);
assert.equal(record(moveSpaceListingStep(basicState, operator, id, 2)).step, 2);
assert.equal(moveSpaceListingStep(basicState, operator, id, 3), basicState);
let complete = updateSpaceListingUnit(
  basicState,
  operator,
  id,
  unitId,
  unit,
  later,
);
complete = updateSpaceListingDraft(
  complete,
  operator,
  id,
  {
    openingStart: "09:00",
    openingEnd: "22:30",
    hoursNote: "Other times by request.",
    cancellationPolicy: "Contact the operator to discuss changes.",
  },
  later,
);
complete = setSpaceListingAmenities(
  complete,
  operator,
  id,
  ["Toilets", "Step-free access"],
  later,
);
assert.deepEqual(validateSpaceListingDraft(record(complete)), {
  fields: {},
  units: {},
  form: {},
});
assert.equal(record(complete).units[0].id, unitId);
assert.equal(
  updateSpaceListingUnit(complete, operator, id, unitId, unit),
  complete,
);
assert.equal(
  updateSpaceListingUnit(complete, operator, id, "missing", unit),
  complete,
);
assert.equal(
  updateSpaceListingUnit(complete, operator, id, unitId, {
    id: "forged",
  } as unknown as Partial<SpaceListingUnitFields>),
  complete,
);
assert.equal(
  setSpaceListingAmenities(complete, operator, id, [
    "Toilets",
    "Step-free access",
  ]),
  complete,
);
assert.equal(
  setSpaceListingAmenities(complete, operator, id, ["Guaranteed insurance"]),
  complete,
);
assert.deepEqual(
  record(
    setSpaceListingAmenities(complete, operator, id, ["Toilets", "Toilets"]),
  ).amenities,
  ["Toilets"],
);
assert.equal(moveSpaceListingStep(complete, operator, id, 5 as 4), complete);
const preview = moveSpaceListingStep(complete, operator, id, 4);
assert.equal(record(preview).step, 4);
assert.equal(record(preview).status, "Draft");
assert.equal(record(preview).revision, record(complete).revision);
assert.equal(
  markSpaceListingReady(preview, operator, id, record(preview).revision - 1)
    .issue,
  "staleDraft",
);
const readyResult = markSpaceListingReady(
  preview,
  operator,
  id,
  record(preview).revision,
  later,
);
assert.equal(readyResult.issue, null);
const ready = readyResult.state;
const snapshot = record(ready).readySnapshot!;
assert.equal(record(ready).status, "Ready");
assert.equal(record(ready).readyAt, later.toISOString());
assert.equal(snapshot.fields.name, "Neighbourhood event hall");
assert.equal(snapshot.fields.description, basics.description!.trim());
assert.equal(snapshot.units[0].name, "Main hall");
assert.equal(snapshot.units[0].capacity, 120);
assert.equal(snapshot.units[0].priceCents, 9550);
assert.equal(snapshot.units[0].billingUnit, "event");
assert.equal(snapshot.bookingMode, "Request to Reserve");
assert.notEqual(snapshot.fields, record(ready).fields);
assert.notEqual(snapshot.units, record(ready).units);
assert.notEqual(snapshot.amenities, record(ready).amenities);
assert.ok(Object.isFrozen(snapshot));
assert.ok(Object.isFrozen(snapshot.fields));
assert.ok(Object.isFrozen(snapshot.units));
assert.ok(Object.isFrozen(snapshot.units[0]));
assert.equal(
  markSpaceListingReady(ready, operator, id, record(ready).revision, later)
    .state,
  ready,
);
assert.equal(
  record(moveSpaceListingStep(ready, operator, id, 1)).status,
  "Ready",
  "Navigation alone is not a content edit",
);
const changed = updateSpaceListingDraft(
  ready,
  operator,
  id,
  { name: "A different hall" },
  later,
);
assert.equal(record(changed).status, "Draft");
assert.equal(record(changed).readyAt, undefined);
assert.equal(record(changed).readySnapshot, null);
assert.equal(snapshot.fields.name, "Neighbourhood event hall");
const changedUnit = updateSpaceListingUnit(ready, operator, id, unitId, {
  capacity: "240",
});
assert.equal(record(changedUnit).readySnapshot, null);
assert.equal(snapshot.units[0].capacity, 120);
assert.equal(
  record(setSpaceListingAmenities(ready, operator, id, ["Parking"])).status,
  "Draft",
);
assert.equal(snapshot.amenities[0], "Toilets");

for (const [value, expected] of [
  ["0", 0],
  ["0,00", 0],
  ["0.01", 1],
  ["95,50", 9550],
  [" 001.20 ", 120],
  ["1000000", 100_000_000],
] as const)
  assert.equal(spaceListingPriceCents(value), expected);
for (const value of [
  "",
  " ",
  "-1",
  "+2",
  "1e2",
  "1.000,00",
  "1,000.00",
  "1.234",
  ".50",
  "1.",
  "Infinity",
  "NaN",
  "1000000.01",
  "9007199254740991",
])
  assert.equal(spaceListingPriceCents(value), null, `Invalid price: ${value}`);
const badFields: Array<[keyof SpaceListingFields, string]> = [
  ["name", "ab"],
  ["name", "x".repeat(121)],
  ["country", "x"],
  ["country", "x".repeat(81)],
  ["city", "x"],
  ["city", "x".repeat(101)],
  ["neighbourhood", "x".repeat(101)],
  ["address", "1234"],
  ["address", "x".repeat(241)],
  ["relationship", "Stranger"],
  ["description", "Too short"],
  ["description", "x".repeat(4001)],
  ["category", "Hotel"],
  ["openingStart", "9:00"],
  ["openingStart", "24:00"],
  ["openingStart", ""],
  ["openingEnd", "09:00"],
  ["openingEnd", "08:00"],
  ["openingEnd", "22:60"],
  ["hoursNote", "x".repeat(1001)],
  ["cancellationPolicy", "x".repeat(2001)],
];
for (const [key, value] of badFields) {
  const draft = {
    ...record(preview),
    fields: { ...record(preview).fields, [key]: value },
  } as SpaceListingDraft;
  assert.ok(
    validateSpaceListingDraft(draft).fields[key],
    `Invalid field ${key}: ${value.slice(0, 20)}`,
  );
  const candidate = { ...preview, drafts: [draft] };
  assert.equal(
    markSpaceListingReady(candidate, operator, id, draft.revision).state,
    candidate,
  );
}
for (const [key, value] of [
  ["name", "x"],
  ["name", "x".repeat(101)],
  ["activity", ""],
  ["activity", "x".repeat(101)],
  ["capacity", "0"],
  ["capacity", "100001"],
  ["capacity", "1.5"],
  ["capacity", "1e2"],
  ["capacity", "-2"],
  ["price", "-20"],
  ["price", ""],
  ["price", "1000000.01"],
  ["billingUnit", ""],
  ["billingUnit", "night"],
] as Array<[keyof SpaceListingUnitFields, string]>) {
  const draft = {
    ...record(preview),
    units: [{ ...record(preview).units[0], [key]: value }],
  };
  assert.ok(
    validateSpaceListingDraft(draft).units[unitId]?.[key],
    `Invalid unit ${key}: ${value}`,
  );
}
const flexible = updateSpaceListingUnit(
  updateSpaceListingDraft(complete, operator, id, {
    openingStart: "",
    openingEnd: "",
  }),
  operator,
  id,
  unitId,
  { price: "", billingUnit: "" },
);
assert.ok(
  !spaceListingHasErrors(validateSpaceListingDraft(record(flexible))),
  "No invented fixed hours or price are required",
);
const flexibleReady = markSpaceListingReady(
  moveSpaceListingStep(flexible, operator, id, 4),
  operator,
  id,
  record(flexible).revision,
).state;
assert.equal(record(flexibleReady).readySnapshot!.units[0].priceCents, null);
assert.equal(record(flexibleReady).readySnapshot!.units[0].billingUnit, null);
const free = updateSpaceListingUnit(preview, operator, id, unitId, {
  price: "0",
});
assert.equal(
  record(markSpaceListingReady(free, operator, id, record(free).revision).state)
    .readySnapshot!.units[0].priceCents,
  0,
);
const sports = updateSpaceListingDraft(ready, operator, id, {
  category: "Sports",
});
assert.equal(record(sports).status, "Draft");
assert.equal(record(sports).fields.category, "Sports");
assert.equal(
  record(sports).units[0].activity,
  unit.activity,
  "Changing category does not silently discard entered units",
);

const addedUnit = addSpaceListingUnit(ready, operator, id, later);
assert.equal(record(addedUnit.state).status, "Draft");
assert.equal(addedUnit.unitId, `${id}-unit-2`);
const removedUnit = removeSpaceListingUnit(
  addedUnit.state,
  operator,
  id,
  unitId,
);
assert.equal(record(removedUnit).units[0].id, addedUnit.unitId);
const anotherUnit = addSpaceListingUnit(removedUnit, operator, id, later);
assert.equal(anotherUnit.unitId, `${id}-unit-3`);
assert.equal(removeSpaceListingUnit(ready, operator, id, "missing"), ready);
const noUnits = removeSpaceListingUnit(ready, operator, id, unitId);
assert.equal(validateSpaceListingDraft(record(noUnits)).form.units, "required");
assert.equal(
  markSpaceListingReady(noUnits, operator, id, record(noUnits).revision).state,
  noUnits,
);
let maxUnits = created.state;
for (let index = 1; index < MAX_SPACE_LISTING_UNITS; index++)
  maxUnits = addSpaceListingUnit(maxUnits, operator, id).state;
assert.equal(record(maxUnits).units.length, MAX_SPACE_LISTING_UNITS);
assert.equal(addSpaceListingUnit(maxUnits, operator, id).issue, "unitLimit");
assert.equal(addSpaceListingUnit(maxUnits, operator, id).state, maxUnits);
assert.equal(
  validateSpaceListingDraft({
    ...record(ready),
    units: [record(ready).units[0], record(ready).units[0]],
  }).form.units,
  "duplicate",
);

const photo = (
  name = "hall.png",
  contents: BlobPart[] = ["photo"],
  type = "image/png",
) => new File(contents, name, { type, lastModified: 1 });
const image = photo();
const identicalMetadata = photo("hall.png", ["other"]);
assert.equal(image.size, identicalMetadata.size);
assert.equal(spaceListingPhotoProblem(image), null);
assert.equal(spaceListingPhotoProblem(photo("hall.JPG", ["photo"], "")), null);
for (const file of [
  photo("hall.svg", ["svg"], "image/svg+xml"),
  photo("hall.png", ["html"], "text/html"),
  photo("hall.pdf", ["pdf"], "application/pdf"),
  photo("hall", ["png"], "image/png"),
])
  assert.equal(spaceListingPhotoProblem(file), "format");
assert.equal(spaceListingPhotoProblem(photo("hall.png", [])), "empty");
assert.equal(
  spaceListingPhotoProblem({
    name: "hall.png",
    type: "image/png",
    size: MAX_SPACE_LISTING_PHOTO_BYTES + 1,
  }),
  "large",
);
const photosResult = addSpaceListingPhotos(
  ready,
  operator,
  id,
  [image, image, identicalMetadata, photo("bad.svg", ["svg"], "image/svg+xml")],
  later,
);
assert.equal(photosResult.added, 2);
assert.deepEqual(
  photosResult.errors.map((error) => error.issue),
  ["duplicate", "format"],
);
const withPhotos = photosResult.state;
const photos = record(withPhotos).photos;
assert.equal(record(withPhotos).status, "Draft");
assert.equal(record(withPhotos).readySnapshot, null);
assert.equal(photos[0].file, image);
assert.equal(photos[1].file, identicalMetadata);
assert.notEqual(photos[0].id, photos[1].id);
assert.equal(record(withPhotos).coverPhotoId, photos[0].id);
assert.equal(
  spaceListingPhotoBytes(withPhotos, operator),
  image.size + identicalMetadata.size,
);
assert.equal(
  setSpaceListingCover(withPhotos, operator, id, "missing"),
  withPhotos,
);
assert.equal(
  setSpaceListingCover(withPhotos, operator, id, photos[0].id),
  withPhotos,
);
const cover = setSpaceListingCover(
  withPhotos,
  operator,
  id,
  photos[1].id,
  later,
);
assert.equal(record(cover).coverPhotoId, photos[1].id);
const photoReady = markSpaceListingReady(
  cover,
  operator,
  id,
  record(cover).revision,
  later,
).state;
const photoSnapshot = record(photoReady).readySnapshot!;
assert.equal(photoSnapshot.photos[0].file, image);
assert.notEqual(photoSnapshot.photos[0], record(photoReady).photos[0]);
assert.equal(photoSnapshot.coverPhotoId, photos[1].id);
assert.ok(Object.isFrozen(photoSnapshot.photos[0]));
const removedCover = removeSpaceListingPhoto(
  photoReady,
  operator,
  id,
  photos[1].id,
);
assert.equal(record(removedCover).status, "Draft");
assert.equal(record(removedCover).coverPhotoId, photos[0].id);
assert.equal(photoSnapshot.photos.length, 2);
assert.equal(photoSnapshot.coverPhotoId, photos[1].id);
const noPhotos = removeSpaceListingPhoto(
  removedCover,
  operator,
  id,
  photos[0].id,
);
assert.equal(record(noPhotos).coverPhotoId, null);
assert.ok(!spaceListingHasErrors(validateSpaceListingDraft(record(noPhotos))));
const readded = addSpaceListingPhotos(noPhotos, operator, id, [image]);
assert.equal(record(readded.state).photos[0].id, `${id}-photo-3`);
assert.equal(
  removeSpaceListingPhoto(noPhotos, operator, id, "missing"),
  noPhotos,
);
for (const candidate of [
  { ...record(withPhotos), coverPhotoId: "missing" },
  {
    ...record(withPhotos),
    photos: [{ ...photos[0], mimeType: "image/jpeg" as const }],
  },
  { ...record(withPhotos), photos: [photos[0], photos[0]] },
  { ...record(noPhotos), coverPhotoId: "missing" },
])
  assert.equal(
    validateSpaceListingDraft(candidate).form.photos,
    "invalidPhotos",
  );
const manyPhotos = addSpaceListingPhotos(
  created.state,
  operator,
  id,
  Array.from({ length: MAX_SPACE_LISTING_PHOTOS + 1 }, (_, index) =>
    photo(`photo-${index}.png`),
  ),
);
assert.equal(manyPhotos.added, MAX_SPACE_LISTING_PHOTOS);
assert.equal(manyPhotos.errors[0].issue, "count");
const blankMime = addSpaceListingPhotos(created.state, operator, id, [
  photo("Hall.JPEG", ["jpg"], ""),
]);
assert.equal(record(blankMime.state).photos[0].mimeType, "image/jpeg");

// Memory limits include the undo slot; reusing a File shares its immutable bytes.
const tenMiB = new Uint8Array(MAX_SPACE_LISTING_PHOTO_BYTES);
const bigFiles = Array.from({ length: 11 }, (_, index) =>
  photo(`large-${index}.png`, [tenMiB]),
);
const firstBudget = addSpaceListingPhotos(
  created.state,
  operator,
  id,
  bigFiles.slice(0, 6),
);
assert.equal(firstBudget.added, 5);
assert.equal(firstBudget.errors[0].issue, "draftLimit");
assert.equal(
  spaceListingPhotoBytes(firstBudget.state, operator),
  MAX_SPACE_LISTING_DRAFT_BYTES,
);
const secondBudgetDraft = createSpaceListingDraft(
  firstBudget.state,
  operator,
  "Sports",
  now,
);
const secondId = secondBudgetDraft.draftId!;
const secondBudget = addSpaceListingPhotos(
  secondBudgetDraft.state,
  operator,
  secondId,
  bigFiles.slice(5, 10),
);
assert.equal(secondBudget.added, 5);
assert.equal(
  spaceListingPhotoBytes(secondBudget.state, operator),
  MAX_SPACE_LISTING_WORKSPACE_BYTES,
);
const deletedBudget = removeSpaceListingDraft(secondBudget.state, operator, id);
assert.equal(
  spaceListingPhotoBytes(deletedBudget, operator),
  MAX_SPACE_LISTING_WORKSPACE_BYTES,
  "Undo retains its real bytes",
);
const thirdBudgetDraft = createSpaceListingDraft(
  deletedBudget,
  operator,
  "Events",
  now,
);
const thirdId = thirdBudgetDraft.draftId!;
assert.equal(
  addSpaceListingPhotos(thirdBudgetDraft.state, operator, thirdId, [
    bigFiles[10],
  ]).errors[0].issue,
  "workspaceLimit",
);
const reused = addSpaceListingPhotos(
  thirdBudgetDraft.state,
  operator,
  thirdId,
  [bigFiles[0]],
);
assert.equal(reused.added, 1);
assert.equal(
  spaceListingPhotoBytes(reused.state, operator),
  MAX_SPACE_LISTING_WORKSPACE_BYTES,
);
const budgetRestored = restoreSpaceListingDraft(reused.state, operator);
assert.equal(budgetRestored.issue, null);
assert.equal(record(budgetRestored.state).photos[0].file, bigFiles[0]);
assert.equal(
  spaceListingPhotoBytes(budgetRestored.state, operator),
  MAX_SPACE_LISTING_WORKSPACE_BYTES,
);

const viewed = updateSpaceListingView(photoReady, operator, {
  filter: "Ready",
  query: "hall",
  selectedDraftId: id,
});
assert.equal(spaceListingView(viewed, operator).query, "hall");
assert.equal(
  updateSpaceListingView(viewed, operator, { selectedDraftId: "missing" }),
  viewed,
);
assert.equal(
  spaceListingView(
    updateSpaceListingView(viewed, operator, { query: "x".repeat(201) }),
    operator,
  ).query.length,
  200,
);
const removed = removeSpaceListingDraft(viewed, operator, id);
assert.equal(removed.drafts.length, 0);
assert.equal(removed.view.selectedDraftId, null);
assert.equal(removedSpaceListingDraft(removed, operator), record(viewed));
assert.equal(
  spaceListingPhotoBytes(removed, operator),
  image.size + identicalMetadata.size,
);
const restored = restoreSpaceListingDraft(removed, operator);
assert.equal(restored.issue, null);
assert.equal(record(restored.state), record(viewed));
assert.equal(record(restored.state).readySnapshot, photoSnapshot);
assert.equal(record(restored.state).photos[0].file, image);
assert.equal(restored.state.view.selectedDraftId, id);
assert.equal(restored.state.view.filter, "All");
assert.equal(restored.state.view.query, "");
assert.equal(restored.state.removed, null);
assert.equal(
  restoreSpaceListingDraft(restored.state, operator).issue,
  "unavailable",
);
assert.equal(
  restoreSpaceListingDraft(
    { ...restored.state, removed: record(restored.state) },
    operator,
  ).issue,
  "duplicate",
);

const foreign = { ...record(photoReady), operatorId: "a-different-operator" };
const foreignState = { ...photoReady, drafts: [foreign], removed: foreign };
assert.equal(spaceListingDraft(foreignState, operator, id), undefined);
assert.equal(visibleSpaceListingDrafts(foreignState, operator).length, 0);
assert.equal(removedSpaceListingDraft(foreignState, operator), null);
assert.equal(
  updateSpaceListingDraft(foreignState, operator, id, basics),
  foreignState,
);
assert.equal(
  updateSpaceListingUnit(foreignState, operator, id, unitId, unit),
  foreignState,
);
assert.equal(
  markSpaceListingReady(foreignState, operator, id, foreign.revision).issue,
  "unavailable",
);
assert.equal(
  restoreSpaceListingDraft(foreignState, operator).state,
  foreignState,
);
assert.equal(spaceListingPhotoBytes(foreignState, operator), 0);
for (const role of others) {
  assert.equal(createSpaceListingDraft(initial, role, "Sports").state, initial);
  assert.equal(spaceListingDraft(photoReady, role, id), undefined);
  assert.equal(visibleSpaceListingDrafts(photoReady, role).length, 0);
  assert.equal(removedSpaceListingDraft(removed, role), null);
  assert.deepEqual(spaceListingView(viewed, role), {
    filter: "All",
    query: "",
    selectedDraftId: null,
  });
  assert.equal(
    updateSpaceListingView(viewed, role, { query: "private" }),
    viewed,
  );
  assert.equal(
    updateSpaceListingDraft(photoReady, role, id, basics),
    photoReady,
  );
  assert.equal(
    updateSpaceListingUnit(photoReady, role, id, unitId, unit),
    photoReady,
  );
  assert.equal(addSpaceListingUnit(photoReady, role, id).state, photoReady);
  assert.equal(
    removeSpaceListingUnit(photoReady, role, id, unitId),
    photoReady,
  );
  assert.equal(
    setSpaceListingAmenities(photoReady, role, id, ["Parking"]),
    photoReady,
  );
  assert.equal(moveSpaceListingStep(photoReady, role, id, 1), photoReady);
  assert.equal(
    markSpaceListingReady(photoReady, role, id, record(photoReady).revision)
      .issue,
    "unavailable",
  );
  assert.equal(
    addSpaceListingPhotos(photoReady, role, id, [photo()]).state,
    photoReady,
  );
  assert.equal(
    removeSpaceListingPhoto(photoReady, role, id, photos[0].id),
    photoReady,
  );
  assert.equal(
    setSpaceListingCover(photoReady, role, id, photos[0].id),
    photoReady,
  );
  assert.equal(removeSpaceListingDraft(photoReady, role, id), photoReady);
  assert.equal(restoreSpaceListingDraft(removed, role).state, removed);
  assert.equal(spaceListingPhotoBytes(photoReady, role), 0);
}

Object.freeze(record(photoReady).fields);
Object.freeze(record(photoReady).units[0]);
Object.freeze(record(photoReady).units);
Object.freeze(record(photoReady).photos[0]);
Object.freeze(record(photoReady).photos);
Object.freeze(record(photoReady).amenities);
Object.freeze(record(photoReady));
assert.equal(
  record(
    updateSpaceListingDraft(photoReady, operator, id, { name: "New name" }),
  ).status,
  "Draft",
);
assert.equal(
  record(
    updateSpaceListingUnit(photoReady, operator, id, unitId, {
      capacity: "100",
    }),
  ).status,
  "Draft",
);
assert.equal(
  record(removeSpaceListingPhoto(photoReady, operator, id, photos[0].id)).photos
    .length,
  1,
);
assert.equal(snapshot.units[0].capacity, 120);
assert.equal(photoSnapshot.photos[0].file, image);
assert.equal(
  JSON.stringify(spaceVenues),
  catalogueBefore,
  "Ready drafts never become booking inventory",
);
console.log(
  "Space listing state checks passed: operator isolation, retained scoped views, validated stages, stable unit/photo IDs, immutable readiness snapshots, safe photo metadata/cover integrity, retained-file memory limits and delete/undo.",
);
