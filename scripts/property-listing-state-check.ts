import assert from "node:assert/strict";
import {
  addPropertyListingPhotos,
  createInitialPropertyListingState,
  createPropertyListingDraft,
  listingDateValue,
  listingDecimal,
  listingPhotoProblem,
  listingPriceCents,
  markPropertyListingReady,
  MAX_LISTING_DRAFT_BYTES,
  MAX_LISTING_PHOTOS,
  MAX_LISTING_PHOTO_BYTES,
  MAX_LISTING_WORKSPACE_BYTES,
  movePropertyListingStep,
  propertyListingPhotoBytes,
  propertyListingRestoreIssue,
  removePropertyListingDraft,
  removePropertyListingPhoto,
  restorePropertyListingDraft,
  setPropertyListingCover,
  updatePropertyListingDraft,
  validatePropertyListingDraft,
  visiblePropertyListingDrafts,
  type PropertyListingDraft,
  type PropertyListingFields,
  type PropertyListingState,
} from "../src/components/propertyListingState";
import { workspaceLandlordName } from "../src/propertyScope";
import type { Role } from "../src/types";

const now = new Date(2026, 9, 3, 12);
const later = new Date(2026, 9, 3, 13);
const nextDay = new Date(2026, 9, 4, 12);
const landlord: Role = "landlord";
const otherRoles: Role[] = ["tenant", "provider", "spaceOperator", "admin"];
const initial = createInitialPropertyListingState();
assert.deepEqual(initial, { drafts: [], removed: null, nextId: 1 });
assert.notEqual(createInitialPropertyListingState(), initial);

const created = createPropertyListingDraft(initial, landlord, "Rent", now);
assert.equal(created.draftId, "property-draft-1");
const id = created.draftId!;
const record = (state: PropertyListingState, target = id) =>
  state.drafts.find((draft) => draft.id === target)!;
const blank = record(created.state);
assert.equal(initial.drafts.length, 0, "Creation does not mutate the input");
assert.equal(blank.owner, workspaceLandlordName);
assert.equal(blank.status, "Draft");
assert.equal(blank.fields.title, "");
assert.equal(blank.fields.rentPrice, "");
assert.equal(blank.fields.address, "");
assert.equal(blank.step, 1);
assert.equal(blank.coverPhotoId, null);
assert.equal(blank.createdAt, now.toISOString());
assert.ok(
  Object.keys(validatePropertyListingDraft(blank, "all", now)).length > 0,
);
assert.equal(
  movePropertyListingStep(created.state, landlord, id, 2, now),
  created.state,
);
assert.equal(
  markPropertyListingReady(created.state, landlord, id, now),
  created.state,
);
assert.equal(
  createPropertyListingDraft(initial, landlord, "Hotel" as "Rent", now).state,
  initial,
);

const basics: Partial<PropertyListingFields> = {
  title: "  Terrace apartment  ",
  propertyType: "Apartment",
  country: "Portugal",
  city: "Lisboa",
  neighbourhood: "Estrela",
  address: "Rua da Amostra, 12",
  relationship: "Owner",
};
const details: Partial<PropertyListingFields> = {
  bedrooms: "0",
  bathrooms: "1,5",
  area: "64.25",
  rentPrice: "1250,50",
  salePrice: "345000",
  availability: "date",
  availableFrom: "2026-10-03",
  furnishing: "Furnished",
  description:
    "  A bright apartment with a private terrace and a separate kitchen.  ",
};
const basicState = updatePropertyListingDraft(
  created.state,
  landlord,
  id,
  basics,
  later,
);
assert.equal(blank.fields.title, "");
assert.equal(record(basicState).fields.title, basics.title);
assert.notEqual(record(basicState).fields, blank.fields);
assert.equal(
  updatePropertyListingDraft(basicState, landlord, id, basics, later),
  basicState,
);
assert.equal(
  updatePropertyListingDraft(basicState, landlord, "missing", basics, later),
  basicState,
);
const ignoredProtectedFields = updatePropertyListingDraft(
  basicState,
  landlord,
  id,
  {
    owner: "Someone else",
    status: "Ready",
    id: "forged",
    listingType: "Hotel",
  } as unknown as Partial<PropertyListingFields>,
  later,
);
assert.equal(
  ignoredProtectedFields,
  basicState,
  "Draft identity, owner, status and unknown use cannot be patched",
);
const stepTwo = movePropertyListingStep(basicState, landlord, id, 2, later);
assert.equal(record(stepTwo).step, 2);
assert.equal(movePropertyListingStep(stepTwo, landlord, id, 3, later), stepTwo);
const complete = updatePropertyListingDraft(
  stepTwo,
  landlord,
  id,
  details,
  later,
);
assert.deepEqual(
  validatePropertyListingDraft(record(complete), "all", now),
  {},
);
assert.equal(
  record(movePropertyListingStep(complete, landlord, id, 3, now)).step,
  3,
);
assert.equal(
  movePropertyListingStep(complete, landlord, id, 4 as 3, now),
  complete,
);
assert.equal(
  record(movePropertyListingStep(complete, landlord, id, 1, now)).step,
  1,
);
assert.equal(listingDateValue(now), "2026-10-03");
assert.equal(
  validatePropertyListingDraft(record(complete), "all", nextDay).availableFrom,
  "availableFrom",
  "A date valid yesterday cannot be marked ready today",
);

for (const [value, expected] of [
  ["1250,50", 125050],
  ["1250.50", 125050],
  ["0.01", 1],
  [" 001.20 ", 120],
  ["1000000000", 100_000_000_000],
] as const)
  assert.equal(listingPriceCents(value), expected);
for (const value of [
  "",
  " ",
  "0",
  "0,00",
  "-2",
  "+20",
  "Infinity",
  "NaN",
  "1e3",
  "1.250,00",
  "1,250.00",
  "12.345",
  ".50",
  "1.",
  "1000000000.01",
  "9007199254740991",
])
  assert.equal(
    listingPriceCents(value),
    null,
    `Reject ambiguous or invalid price ${value}`,
  );
assert.equal(listingDecimal(" 0,5 "), 0.5);
assert.equal(listingDecimal("1e3"), null);
const invalidFields: Array<[keyof PropertyListingFields, string]> = [
  ["title", "ab"],
  ["propertyType", "Hotel"],
  ["country", "P"],
  ["city", "L"],
  ["neighbourhood", "n".repeat(101)],
  ["address", "x"],
  ["relationship", "Stranger"],
  ["bedrooms", "0.5"],
  ["bedrooms", "31"],
  ["bathrooms", "0"],
  ["bathrooms", "1.25"],
  ["area", "0"],
  ["area", "100001"],
  ["rentPrice", "-10"],
  ["availability", "overnight"],
  ["availableFrom", "2026-10-02"],
  ["availableFrom", "2026-02-30"],
  ["availableFrom", "not-a-date"],
  ["furnishing", "Other"],
  ["description", "Too short"],
];
for (const [name, value] of invalidFields) {
  const candidate = {
    ...record(complete),
    fields: { ...record(complete).fields, [name]: value },
  };
  assert.ok(
    validatePropertyListingDraft(candidate, "all", now)[name],
    `Reject invalid ${name}: ${value}`,
  );
  const state = { ...complete, drafts: [candidate] };
  assert.equal(markPropertyListingReady(state, landlord, id, now), state);
}
const invalidIntent = {
  ...record(complete),
  fields: { ...record(complete).fields, listingType: "Hotel" },
} as unknown as PropertyListingDraft;
assert.equal(
  validatePropertyListingDraft(invalidIntent, "all", now).listingType,
  "listingType",
);
const sale = updatePropertyListingDraft(
  complete,
  landlord,
  id,
  {
    listingType: "Buy",
    furnishing: "",
    availableFrom: "past",
    rentPrice: "bad",
  },
  later,
);
assert.deepEqual(
  validatePropertyListingDraft(record(sale), "all", nextDay),
  {},
  "Sale validates its price and ignores inactive rental availability and rent amount",
);
assert.equal(record(sale).fields.salePrice, "345000");
const returnToRent = updatePropertyListingDraft(
  sale,
  landlord,
  id,
  { listingType: "Rent" },
  later,
);
assert.equal(
  record(returnToRent).fields.rentPrice,
  "bad",
  "Switching use retains the separate branch's values",
);
assert.equal(record(returnToRent).fields.salePrice, "345000");
assert.ok(
  validatePropertyListingDraft(record(returnToRent), "all", now).rentPrice,
);
assert.ok(
  validatePropertyListingDraft(
    { ...record(sale), fields: { ...record(sale).fields, salePrice: "0" } },
    "all",
    now,
  ).salePrice,
);

const ready = markPropertyListingReady(complete, landlord, id, now);
assert.equal(record(ready).status, "Ready");
assert.equal(record(ready).step, 3);
assert.equal(record(ready).fields.title, "Terrace apartment");
assert.equal(record(ready).readyAt, now.toISOString());
assert.equal(
  record(complete).status,
  "Draft",
  "Readiness leaves the previous snapshot unchanged",
);
assert.equal(markPropertyListingReady(ready, landlord, id, now), ready);
const changed = updatePropertyListingDraft(
  ready,
  landlord,
  id,
  { title: "New title" },
  later,
);
assert.equal(record(changed).status, "Draft");
assert.equal(record(changed).readyAt, undefined);
assert.equal(record(changed).updatedAt, later.toISOString());
assert.equal("publishedAt" in record(ready), false);
assert.equal("verified" in record(ready), false);

const photoA = new File([new Uint8Array([137, 80, 78, 71])], "terrace.PNG", {
  type: "image/png",
  lastModified: 42,
});
const photoB = new File([new Uint8Array([255, 216, 255, 224])], "room.jpeg", {
  type: "image/jpeg",
  lastModified: 43,
});
const noMime = new File(["webp data"], "bedroom.WEBP");
for (const file of [photoA, photoB, noMime])
  assert.equal(listingPhotoProblem(file), null);
for (const file of [
  new File([], "empty.png", { type: "image/png" }),
  new File(["<svg/>"], "photo.svg", { type: "image/svg+xml" }),
  new File(["<script/>"], "photo.html", { type: "text/html" }),
  new File(["text"], "photo.jpg", { type: "text/html" }),
  new File(["png"], "photo.png", { type: "image/jpeg" }),
  new File(["data"], "__proto__"),
])
  assert.ok(listingPhotoProblem(file));
assert.equal(
  listingPhotoProblem({
    name: "large.png",
    type: "image/png",
    size: MAX_LISTING_PHOTO_BYTES + 1,
  }),
  "large",
);
assert.equal(
  listingPhotoProblem({ name: "nan.png", type: "image/png", size: NaN }),
  "empty",
);
const selected = addPropertyListingPhotos(
  ready,
  landlord,
  id,
  [photoA, photoB, noMime],
  later,
);
assert.equal(selected.added, 3);
assert.deepEqual(selected.errors, []);
assert.equal(record(selected.state).status, "Draft");
assert.equal(record(ready).photos.length, 0);
assert.equal(
  record(selected.state).photos[0].file,
  photoA,
  "Keep the actual selected File",
);
assert.equal(record(selected.state).photos[2].mimeType, "image/webp");
const firstPhotoId = record(selected.state).photos[0].id;
const secondPhotoId = record(selected.state).photos[1].id;
assert.equal(record(selected.state).coverPhotoId, firstPhotoId);
assert.equal(
  propertyListingPhotoBytes(selected.state, landlord),
  photoA.size + photoB.size + noMime.size,
);
assert.equal(
  addPropertyListingPhotos(selected.state, landlord, id, [photoA]).errors[0]
    .issue,
  "duplicate",
);
assert.equal(
  addPropertyListingPhotos(selected.state, landlord, id, [photoA]).state,
  selected.state,
);
assert.equal(
  addPropertyListingPhotos(created.state, landlord, id, [photoA, photoA]).added,
  1,
);
const matchingMetadata = ["data a", "data b"].map(
  (data) =>
    new File([data], "same.png", { type: "image/png", lastModified: 42 }),
);
const distinct = addPropertyListingPhotos(
  created.state,
  landlord,
  id,
  matchingMetadata,
  now,
);
assert.equal(
  distinct.added,
  2,
  "Different File objects with matching metadata are not discarded",
);
assert.deepEqual(
  await Promise.all(
    record(distinct.state).photos.map((photo) => photo.file.text()),
  ),
  ["data a", "data b"],
);
const mixed = addPropertyListingPhotos(
  created.state,
  landlord,
  id,
  [photoA, new File(["html"], "bad.html", { type: "text/html" })],
  now,
);
assert.equal(mixed.added, 1);
assert.equal(mixed.errors.length, 1);
const covered = setPropertyListingCover(
  selected.state,
  landlord,
  id,
  secondPhotoId,
  later,
);
assert.equal(record(covered).coverPhotoId, secondPhotoId);
assert.equal(
  setPropertyListingCover(covered, landlord, id, "missing"),
  covered,
);
assert.equal(
  setPropertyListingCover(covered, landlord, id, secondPhotoId),
  covered,
);
const removedCover = removePropertyListingPhoto(
  covered,
  landlord,
  id,
  secondPhotoId,
  later,
);
assert.equal(record(removedCover).coverPhotoId, firstPhotoId);
assert.equal(
  removePropertyListingPhoto(covered, landlord, id, "missing"),
  covered,
);
let noPhotos = removedCover;
for (const photo of record(noPhotos).photos)
  noPhotos = removePropertyListingPhoto(
    noPhotos,
    landlord,
    id,
    photo.id,
    later,
  );
assert.equal(record(noPhotos).photos.length, 0);
assert.equal(record(noPhotos).coverPhotoId, null);
const newPhoto = addPropertyListingPhotos(
  noPhotos,
  landlord,
  id,
  [photoA],
  later,
);
assert.notEqual(
  record(newPhoto.state).photos[0].id,
  firstPhotoId,
  "Removed photo identities are never reused",
);
assert.equal(
  validatePropertyListingDraft(
    { ...record(complete), coverPhotoId: "nonexistent" },
    "all",
    now,
  ).photos,
  "photos",
);

const deleted = removePropertyListingDraft(selected.state, landlord, id);
assert.equal(deleted.removed, record(selected.state));
assert.equal(deleted.drafts.length, 0);
assert.equal(propertyListingRestoreIssue(deleted, landlord), null);
const restored = restorePropertyListingDraft(deleted, landlord);
assert.equal(
  record(restored),
  record(selected.state),
  "Undo restores the exact retained fields and photos",
);
assert.equal(restored.removed, null);
assert.equal(restorePropertyListingDraft(restored, landlord), restored);
const nextDraft = createPropertyListingDraft(deleted, landlord, "Buy", later);
assert.notEqual(
  nextDraft.draftId,
  id,
  "Deleted listing identities are never reused",
);
assert.equal(
  record(restorePropertyListingDraft(nextDraft.state, landlord)).photos[0].file,
  photoA,
);

for (const role of otherRoles) {
  assert.equal(
    createPropertyListingDraft(initial, role, "Rent", now).state,
    initial,
  );
  assert.deepEqual(visiblePropertyListingDrafts(selected.state, role), []);
  assert.equal(
    updatePropertyListingDraft(complete, role, id, { title: "Changed" }),
    complete,
  );
  assert.equal(movePropertyListingStep(complete, role, id, 3, now), complete);
  assert.equal(markPropertyListingReady(complete, role, id, now), complete);
  assert.equal(
    addPropertyListingPhotos(selected.state, role, id, [photoA]).state,
    selected.state,
  );
  assert.equal(
    removePropertyListingPhoto(selected.state, role, id, firstPhotoId),
    selected.state,
  );
  assert.equal(
    setPropertyListingCover(selected.state, role, id, secondPhotoId),
    selected.state,
  );
  assert.equal(
    removePropertyListingDraft(selected.state, role, id),
    selected.state,
  );
  assert.equal(propertyListingPhotoBytes(selected.state, role), 0);
  assert.equal(restorePropertyListingDraft(deleted, role), deleted);
}
const foreignDraft = { ...record(complete), owner: "Another owner" };
const foreignState = {
  ...complete,
  drafts: [foreignDraft],
  removed: foreignDraft,
};
assert.deepEqual(visiblePropertyListingDrafts(foreignState, landlord), []);
assert.equal(
  updatePropertyListingDraft(foreignState, landlord, id, { title: "Changed" }),
  foreignState,
);
assert.equal(
  markPropertyListingReady(foreignState, landlord, id, now),
  foreignState,
);
assert.equal(
  removePropertyListingDraft(foreignState, landlord, id),
  foreignState,
);
assert.equal(
  addPropertyListingPhotos(foreignState, landlord, id, [photoA]).state,
  foreignState,
);
assert.equal(restorePropertyListingDraft(foreignState, landlord), foreignState);

// Metadata-only File fixtures exercise byte limits without allocating large buffers.
const sizedFile = (index: number, bytes = MAX_LISTING_PHOTO_BYTES) =>
  ({
    name: `large-${index}.png`,
    type: "image/png",
    size: bytes,
    lastModified: index,
  }) as File;
const countFull = addPropertyListingPhotos(
  created.state,
  landlord,
  id,
  Array.from({ length: MAX_LISTING_PHOTOS + 1 }, (_, index) =>
    sizedFile(index, 1),
  ),
  now,
);
assert.equal(countFull.added, MAX_LISTING_PHOTOS);
assert.equal(countFull.errors[0].issue, "count");
const oneFull = addPropertyListingPhotos(
  created.state,
  landlord,
  id,
  Array.from({ length: 6 }, (_, index) => sizedFile(index)),
  now,
);
assert.equal(oneFull.added, 5);
assert.equal(oneFull.errors[0].issue, "draftLimit");
assert.equal(
  propertyListingPhotoBytes(oneFull.state, landlord),
  MAX_LISTING_DRAFT_BYTES,
);
const second = createPropertyListingDraft(oneFull.state, landlord, "Buy", now);
const twoFull = addPropertyListingPhotos(
  second.state,
  landlord,
  second.draftId!,
  Array.from({ length: 5 }, (_, index) => sizedFile(index + 10)),
  now,
);
assert.equal(twoFull.added, 5);
assert.equal(
  propertyListingPhotoBytes(twoFull.state, landlord),
  MAX_LISTING_WORKSPACE_BYTES,
);
const third = createPropertyListingDraft(twoFull.state, landlord, "Rent", now);
assert.equal(
  addPropertyListingPhotos(third.state, landlord, third.draftId!, [photoA], now)
    .errors[0].issue,
  "workspaceLimit",
);
const removedForSpace = removePropertyListingDraft(third.state, landlord, id);
const refilled = addPropertyListingPhotos(
  removedForSpace,
  landlord,
  third.draftId!,
  [photoA],
  now,
);
assert.equal(refilled.added, 1);
assert.equal(
  propertyListingRestoreIssue(refilled.state, landlord),
  "workspaceLimit",
);
assert.equal(
  restorePropertyListingDraft(refilled.state, landlord),
  refilled.state,
);
assert.equal(
  propertyListingRestoreIssue(
    { ...selected.state, removed: record(selected.state) },
    landlord,
  ),
  "duplicate",
);

console.log(
  "Property listing state checks passed: owner isolation, retained blank drafts, validation/steps, exact pricing, rental/sale branches, date rollover, local readiness, actual File retention, safe formats/limits, cover changes and delete/undo.",
);
