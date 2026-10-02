import type { Role } from "../types";

export const workspaceSpaceListingOperatorId = "space-operator-poblenou";
export const spaceListingCategories = ["Sports", "Events"] as const;
export const spaceListingRelationships = [
  "Owner",
  "Operator",
  "Facility manager",
  "Authorised representative",
] as const;
export const spaceListingBillingUnits = [
  "hour",
  "session",
  "half-day",
  "event",
] as const;
export const spaceListingAmenities = [
  "Parking",
  "Wi-Fi",
  "Toilets",
  "Changing rooms",
  "Showers",
  "Step-free access",
  "Lighting",
  "Air conditioning",
  "Seating",
  "Sound system",
] as const;
export type SpaceListingCategory = (typeof spaceListingCategories)[number];
export type SpaceListingBillingUnit = (typeof spaceListingBillingUnits)[number];
export type SpaceListingStep = 1 | 2 | 3 | 4;
export const MAX_SPACE_LISTING_UNITS = 20;
export const SPACE_LISTING_PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp";
export const MAX_SPACE_LISTING_PHOTOS = 20;
export const MAX_SPACE_LISTING_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_SPACE_LISTING_DRAFT_BYTES = 50 * 1024 * 1024;
export const MAX_SPACE_LISTING_WORKSPACE_BYTES = 100 * 1024 * 1024;

export interface SpaceListingFields {
  category: SpaceListingCategory;
  name: string;
  country: string;
  city: string;
  neighbourhood: string;
  address: string;
  relationship: string;
  description: string;
  openingStart: string;
  openingEnd: string;
  hoursNote: string;
  cancellationPolicy: string;
}
export interface SpaceListingUnitFields {
  name: string;
  activity: string;
  capacity: string;
  price: string;
  billingUnit: string;
}
export interface SpaceListingUnit extends SpaceListingUnitFields {
  id: string;
}
export interface SpaceListingPhoto {
  id: string;
  file: File;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}
export interface SpaceListingSnapshotUnit {
  id: string;
  name: string;
  activity: string;
  capacity: number;
  priceCents: number | null;
  billingUnit: SpaceListingBillingUnit | null;
}
export interface SpaceListingSnapshot {
  readonly draftId: string;
  readonly operatorId: string;
  readonly revision: number;
  readonly readyAt: string;
  readonly fields: Readonly<SpaceListingFields>;
  readonly units: readonly Readonly<SpaceListingSnapshotUnit>[];
  readonly amenities: readonly string[];
  readonly photos: readonly Readonly<SpaceListingPhoto>[];
  readonly coverPhotoId: string | null;
  readonly bookingMode: "Request to Reserve";
}
export interface SpaceListingDraft {
  id: string;
  operatorId: string;
  fields: SpaceListingFields;
  units: SpaceListingUnit[];
  amenities: string[];
  photos: SpaceListingPhoto[];
  coverPhotoId: string | null;
  nextUnitId: number;
  nextPhotoId: number;
  step: SpaceListingStep;
  status: "Draft" | "Ready";
  revision: number;
  readySnapshot: SpaceListingSnapshot | null;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}
export interface SpaceListingView {
  filter: "All" | "Draft" | "Ready";
  query: string;
  selectedDraftId: string | null;
}
export interface SpaceListingState {
  drafts: SpaceListingDraft[];
  removed: SpaceListingDraft | null;
  nextId: number;
  view: SpaceListingView;
}
export type SpaceListingIssue =
  | "required"
  | "tooShort"
  | "tooLong"
  | "invalidCategory"
  | "invalidRelationship"
  | "invalidCapacity"
  | "invalidPrice"
  | "invalidBillingUnit"
  | "invalidTime"
  | "timeOrder"
  | "unitLimit"
  | "invalidAmenities"
  | "invalidPhotos"
  | "unavailable"
  | "staleDraft"
  | "notReviewed"
  | "duplicate"
  | "workspaceLimit";
export interface SpaceListingErrors {
  fields: Partial<Record<keyof SpaceListingFields, SpaceListingIssue>>;
  units: Record<
    string,
    Partial<Record<keyof SpaceListingUnitFields, SpaceListingIssue>>
  >;
  form: Partial<Record<"units" | "amenities" | "photos", SpaceListingIssue>>;
}
export type SpaceListingPhotoIssue =
  | "empty"
  | "large"
  | "format"
  | "count"
  | "draftLimit"
  | "workspaceLimit"
  | "duplicate"
  | "unavailable";
export interface SpaceListingPhotoError {
  name: string;
  issue: SpaceListingPhotoIssue;
}

const emptyErrors = (): SpaceListingErrors => ({
  fields: {},
  units: {},
  form: {},
});
const emptyView = (): SpaceListingView => ({
  filter: "All",
  query: "",
  selectedDraftId: null,
});
const blankUnit = (id: string): SpaceListingUnit => ({
  id,
  name: "",
  activity: "",
  capacity: "",
  price: "",
  billingUnit: "",
});
export function createInitialSpaceListingState(): SpaceListingState {
  return { drafts: [], removed: null, nextId: 1, view: emptyView() };
}
function owns(
  draft: SpaceListingDraft | null | undefined,
  role: Role,
): draft is SpaceListingDraft {
  return (
    role === "spaceOperator" &&
    draft?.operatorId === workspaceSpaceListingOperatorId
  );
}
export function visibleSpaceListingDrafts(
  state: SpaceListingState,
  role: Role,
): SpaceListingDraft[] {
  return state.drafts.filter((draft) => owns(draft, role));
}
export function spaceListingDraft(
  state: SpaceListingState,
  role: Role,
  id: string,
): SpaceListingDraft | undefined {
  return visibleSpaceListingDrafts(state, role).find(
    (draft) => draft.id === id,
  );
}
export function removedSpaceListingDraft(
  state: SpaceListingState,
  role: Role,
): SpaceListingDraft | null {
  return owns(state.removed, role) ? state.removed : null;
}
export function spaceListingView(
  state: SpaceListingState,
  role: Role,
): SpaceListingView {
  return role === "spaceOperator" ? state.view : emptyView();
}
export function updateSpaceListingView(
  state: SpaceListingState,
  role: Role,
  patch: Partial<SpaceListingView>,
): SpaceListingState {
  if (role !== "spaceOperator") return state;
  const view = { ...state.view };
  if (patch.filter && ["All", "Draft", "Ready"].includes(patch.filter))
    view.filter = patch.filter;
  if (typeof patch.query === "string") view.query = patch.query.slice(0, 200);
  if (
    patch.selectedDraftId === null ||
    (patch.selectedDraftId &&
      spaceListingDraft(state, role, patch.selectedDraftId))
  )
    view.selectedDraftId = patch.selectedDraftId;
  return Object.keys(view).some(
    (key) =>
      view[key as keyof SpaceListingView] !==
      state.view[key as keyof SpaceListingView],
  )
    ? { ...state, view }
    : state;
}
export function createSpaceListingDraft(
  state: SpaceListingState,
  role: Role,
  category: SpaceListingCategory,
  now = new Date(),
): {
  state: SpaceListingState;
  draftId: string | null;
  issue: SpaceListingIssue | null;
} {
  if (role !== "spaceOperator")
    return { state, draftId: null, issue: "unavailable" };
  if (!spaceListingCategories.includes(category))
    return { state, draftId: null, issue: "invalidCategory" };
  let nextId = state.nextId;
  while (
    state.drafts.some((draft) => draft.id === `space-draft-${nextId}`) ||
    state.removed?.id === `space-draft-${nextId}`
  )
    nextId++;
  const id = `space-draft-${nextId}`;
  const at = now.toISOString();
  const draft: SpaceListingDraft = {
    id,
    operatorId: workspaceSpaceListingOperatorId,
    fields: {
      category,
      name: "",
      country: "",
      city: "",
      neighbourhood: "",
      address: "",
      relationship: "",
      description: "",
      openingStart: "",
      openingEnd: "",
      hoursNote: "",
      cancellationPolicy: "",
    },
    units: [blankUnit(`${id}-unit-1`)],
    amenities: [],
    photos: [],
    coverPhotoId: null,
    nextUnitId: 2,
    nextPhotoId: 1,
    step: 1,
    status: "Draft",
    revision: 0,
    readySnapshot: null,
    createdAt: at,
    updatedAt: at,
  };
  return {
    state: {
      ...state,
      drafts: [draft, ...state.drafts],
      nextId: nextId + 1,
      view: { ...state.view, filter: "All", query: "", selectedDraftId: id },
    },
    draftId: id,
    issue: null,
  };
}
function replace(
  state: SpaceListingState,
  draft: SpaceListingDraft,
): SpaceListingState {
  return {
    ...state,
    drafts: state.drafts.map((item) => (item.id === draft.id ? draft : item)),
  };
}
function edited(draft: SpaceListingDraft, now: Date): SpaceListingDraft {
  return {
    ...draft,
    revision: draft.revision + 1,
    status: "Draft",
    readyAt: undefined,
    readySnapshot: null,
    updatedAt: now.toISOString(),
  };
}
export function updateSpaceListingDraft(
  state: SpaceListingState,
  role: Role,
  id: string,
  patch: Partial<SpaceListingFields>,
  now = new Date(),
): SpaceListingState {
  const draft = spaceListingDraft(state, role, id);
  if (!draft) return state;
  const fields = { ...draft.fields };
  let changed = false;
  for (const key of Object.keys(fields) as (keyof SpaceListingFields)[]) {
    const value = patch[key];
    if (typeof value !== "string" || value === fields[key]) continue;
    if (key === "category") {
      if (!spaceListingCategories.includes(value as SpaceListingCategory))
        continue;
      fields.category = value as SpaceListingCategory;
    } else fields[key] = value;
    changed = true;
  }
  return changed ? replace(state, { ...edited(draft, now), fields }) : state;
}
export function addSpaceListingUnit(
  state: SpaceListingState,
  role: Role,
  id: string,
  now = new Date(),
): {
  state: SpaceListingState;
  unitId: string | null;
  issue: SpaceListingIssue | null;
} {
  const draft = spaceListingDraft(state, role, id);
  if (!draft) return { state, unitId: null, issue: "unavailable" };
  if (draft.units.length >= MAX_SPACE_LISTING_UNITS)
    return { state, unitId: null, issue: "unitLimit" };
  let nextId = draft.nextUnitId;
  while (draft.units.some((unit) => unit.id === `${id}-unit-${nextId}`))
    nextId++;
  const unit = blankUnit(`${id}-unit-${nextId}`);
  return {
    state: replace(state, {
      ...edited(draft, now),
      units: [...draft.units, unit],
      nextUnitId: nextId + 1,
    }),
    unitId: unit.id,
    issue: null,
  };
}
export function updateSpaceListingUnit(
  state: SpaceListingState,
  role: Role,
  id: string,
  unitId: string,
  patch: Partial<SpaceListingUnitFields>,
  now = new Date(),
): SpaceListingState {
  const draft = spaceListingDraft(state, role, id);
  const unit = draft?.units.find((item) => item.id === unitId);
  if (!draft || !unit) return state;
  const next = { ...unit };
  let changed = false;
  for (const key of [
    "name",
    "activity",
    "capacity",
    "price",
    "billingUnit",
  ] as const) {
    const value = patch[key];
    if (typeof value !== "string" || value === unit[key]) continue;
    next[key] = value;
    changed = true;
  }
  return changed
    ? replace(state, {
        ...edited(draft, now),
        units: draft.units.map((item) => (item.id === unitId ? next : item)),
      })
    : state;
}
export function removeSpaceListingUnit(
  state: SpaceListingState,
  role: Role,
  id: string,
  unitId: string,
  now = new Date(),
): SpaceListingState {
  const draft = spaceListingDraft(state, role, id);
  return draft?.units.some((unit) => unit.id === unitId)
    ? replace(state, {
        ...edited(draft, now),
        units: draft.units.filter((unit) => unit.id !== unitId),
      })
    : state;
}
export function setSpaceListingAmenities(
  state: SpaceListingState,
  role: Role,
  id: string,
  values: readonly string[],
  now = new Date(),
): SpaceListingState {
  const draft = spaceListingDraft(state, role, id);
  if (
    !draft ||
    values.some(
      (value) =>
        !spaceListingAmenities.includes(
          value as (typeof spaceListingAmenities)[number],
        ),
    )
  )
    return state;
  const amenities = [...new Set(values)];
  if (
    amenities.length === draft.amenities.length &&
    amenities.every((value, index) => value === draft.amenities[index])
  )
    return state;
  return replace(state, { ...edited(draft, now), amenities });
}
export function spaceListingPriceCents(value: string): number | null {
  const amount = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 100_000_000
    ? cents
    : null;
}
function capacity(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number >= 1 && number <= 100_000
    ? number
    : null;
}
function lengthIssue(
  value: string,
  min: number,
  max: number,
): SpaceListingIssue | null {
  const length = value.trim().length;
  return !length && min
    ? "required"
    : length < min
      ? "tooShort"
      : length > max
        ? "tooLong"
        : null;
}
function validTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function spaceListingPhotoProblem(
  file: Pick<File, "name" | "size" | "type">,
): SpaceListingPhotoIssue | null {
  if (!Number.isFinite(file.size) || file.size <= 0) return "empty";
  if (file.size > MAX_SPACE_LISTING_PHOTO_BYTES) return "large";
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const expected =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : null;
  const type = file.type.toLowerCase().split(";")[0].trim();
  return !expected || (type && type !== expected) ? "format" : null;
}
function photoMime(file: File): SpaceListingPhoto["mimeType"] {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  return extension === "png"
    ? "image/png"
    : extension === "webp"
      ? "image/webp"
      : "image/jpeg";
}
function uniqueFileBytes(photos: readonly Pick<SpaceListingPhoto, "file">[]) {
  return [...new Set(photos.map((photo) => photo.file))].reduce(
    (sum, file) => sum + file.size,
    0,
  );
}
export function validateSpaceListingDraft(
  draft: SpaceListingDraft,
  scope: "basics" | "details" | "media" | "all" = "all",
): SpaceListingErrors {
  const errors = emptyErrors();
  const fields = draft.fields;
  if (scope === "basics" || scope === "all") {
    if (!spaceListingCategories.includes(fields.category))
      errors.fields.category = "invalidCategory";
    for (const [key, min, max] of [
      ["name", 3, 120],
      ["country", 2, 80],
      ["city", 2, 100],
      ["neighbourhood", 0, 100],
      ["address", 5, 240],
      ["description", 20, 4000],
    ] as const) {
      const issue = lengthIssue(fields[key], min, max);
      if (issue) errors.fields[key] = issue;
    }
    if (
      !spaceListingRelationships.includes(
        fields.relationship as (typeof spaceListingRelationships)[number],
      )
    )
      errors.fields.relationship = fields.relationship
        ? "invalidRelationship"
        : "required";
  }
  if (scope === "details" || scope === "all") {
    if (!draft.units.length) errors.form.units = "required";
    else if (draft.units.length > MAX_SPACE_LISTING_UNITS)
      errors.form.units = "unitLimit";
    if (new Set(draft.units.map((unit) => unit.id)).size !== draft.units.length)
      errors.form.units = "duplicate";
    for (const unit of draft.units) {
      const issues: Partial<
        Record<keyof SpaceListingUnitFields, SpaceListingIssue>
      > = {};
      for (const key of ["name", "activity"] as const) {
        const issue = lengthIssue(unit[key], 2, 100);
        if (issue) issues[key] = issue;
      }
      if (capacity(unit.capacity) === null)
        issues.capacity = unit.capacity.trim() ? "invalidCapacity" : "required";
      const price = unit.price.trim();
      const billing = unit.billingUnit.trim();
      if (price && spaceListingPriceCents(price) === null)
        issues.price = "invalidPrice";
      if (!price && billing) issues.price = "required";
      if (price && !billing) issues.billingUnit = "required";
      if (
        billing &&
        !spaceListingBillingUnits.includes(billing as SpaceListingBillingUnit)
      )
        issues.billingUnit = "invalidBillingUnit";
      if (Object.keys(issues).length) errors.units[unit.id] = issues;
    }
    if (fields.openingStart || fields.openingEnd) {
      if (!validTime(fields.openingStart))
        errors.fields.openingStart = fields.openingStart
          ? "invalidTime"
          : "required";
      if (!validTime(fields.openingEnd))
        errors.fields.openingEnd = fields.openingEnd
          ? "invalidTime"
          : "required";
      if (
        validTime(fields.openingStart) &&
        validTime(fields.openingEnd) &&
        fields.openingEnd <= fields.openingStart
      )
        errors.fields.openingEnd = "timeOrder";
    }
    for (const [key, max] of [
      ["hoursNote", 1000],
      ["cancellationPolicy", 2000],
    ] as const) {
      const issue = lengthIssue(fields[key], 0, max);
      if (issue) errors.fields[key] = issue;
    }
  }
  if (scope === "media" || scope === "all") {
    if (
      draft.amenities.some(
        (value) =>
          !spaceListingAmenities.includes(
            value as (typeof spaceListingAmenities)[number],
          ),
      ) ||
      new Set(draft.amenities).size !== draft.amenities.length
    )
      errors.form.amenities = "invalidAmenities";
    if (
      draft.photos.length > MAX_SPACE_LISTING_PHOTOS ||
      uniqueFileBytes(draft.photos) > MAX_SPACE_LISTING_DRAFT_BYTES ||
      new Set(draft.photos.map((photo) => photo.id)).size !==
        draft.photos.length ||
      new Set(draft.photos.map((photo) => photo.file)).size !==
        draft.photos.length ||
      draft.photos.some(
        (photo) =>
          spaceListingPhotoProblem(photo.file) ||
          photo.mimeType !== photoMime(photo.file),
      ) ||
      (draft.photos.length
        ? !draft.photos.some((photo) => photo.id === draft.coverPhotoId)
        : draft.coverPhotoId !== null)
    )
      errors.form.photos = "invalidPhotos";
  }
  return errors;
}
export function spaceListingHasErrors(errors: SpaceListingErrors): boolean {
  return (
    Object.keys(errors.fields).length > 0 ||
    Object.values(errors.units).some(
      (issues) => Object.keys(issues).length > 0,
    ) ||
    Object.keys(errors.form).length > 0
  );
}
export function moveSpaceListingStep(
  state: SpaceListingState,
  role: Role,
  id: string,
  step: SpaceListingStep,
): SpaceListingState {
  const draft = spaceListingDraft(state, role, id);
  if (!draft || ![1, 2, 3, 4].includes(step) || step === draft.step)
    return state;
  if (
    step > draft.step &&
    (spaceListingHasErrors(validateSpaceListingDraft(draft, "basics")) ||
      (step >= 3 &&
        spaceListingHasErrors(validateSpaceListingDraft(draft, "details"))) ||
      (step === 4 &&
        spaceListingHasErrors(validateSpaceListingDraft(draft, "media"))))
  )
    return state;
  return replace(state, { ...draft, step });
}
export function markSpaceListingReady(
  state: SpaceListingState,
  role: Role,
  id: string,
  expectedRevision: number,
  now = new Date(),
): {
  state: SpaceListingState;
  errors: SpaceListingErrors;
  issue: SpaceListingIssue | null;
} {
  const draft = spaceListingDraft(state, role, id);
  if (!draft) return { state, errors: emptyErrors(), issue: "unavailable" };
  if (expectedRevision !== draft.revision)
    return { state, errors: emptyErrors(), issue: "staleDraft" };
  if (draft.step !== 4)
    return { state, errors: emptyErrors(), issue: "notReviewed" };
  const errors = validateSpaceListingDraft(draft);
  if (spaceListingHasErrors(errors)) return { state, errors, issue: null };
  if (draft.status === "Ready") return { state, errors, issue: null };
  const readyAt = now.toISOString();
  const fields = { ...draft.fields };
  for (const key of Object.keys(fields) as (keyof SpaceListingFields)[])
    if (key !== "category") fields[key] = fields[key].trim();
  const snapshot: SpaceListingSnapshot = Object.freeze({
    draftId: id,
    operatorId: draft.operatorId,
    revision: draft.revision,
    readyAt,
    fields: Object.freeze(fields),
    units: Object.freeze(
      draft.units.map((unit) =>
        Object.freeze({
          id: unit.id,
          name: unit.name.trim(),
          activity: unit.activity.trim(),
          capacity: capacity(unit.capacity)!,
          priceCents: unit.price.trim()
            ? spaceListingPriceCents(unit.price)
            : null,
          billingUnit: unit.price.trim()
            ? (unit.billingUnit.trim() as SpaceListingBillingUnit)
            : null,
        }),
      ),
    ),
    amenities: Object.freeze([...draft.amenities]),
    photos: Object.freeze(
      draft.photos.map((photo) => Object.freeze({ ...photo })),
    ),
    coverPhotoId: draft.coverPhotoId,
    bookingMode: "Request to Reserve",
  });
  return {
    state: replace(state, {
      ...draft,
      status: "Ready",
      readyAt,
      updatedAt: readyAt,
      readySnapshot: snapshot,
    }),
    errors,
    issue: null,
  };
}
export function spaceListingPhotoBytes(
  state: SpaceListingState,
  role: Role,
): number {
  if (role !== "spaceOperator") return 0;
  const drafts = [...visibleSpaceListingDrafts(state, role)];
  const removed = removedSpaceListingDraft(state, role);
  if (removed) drafts.push(removed);
  return uniqueFileBytes(drafts.flatMap((draft) => draft.photos));
}
export function addSpaceListingPhotos(
  state: SpaceListingState,
  role: Role,
  id: string,
  files: readonly File[],
  now = new Date(),
): {
  state: SpaceListingState;
  added: number;
  errors: SpaceListingPhotoError[];
} {
  const draft = spaceListingDraft(state, role, id);
  if (!draft)
    return { state, added: 0, errors: [{ name: "", issue: "unavailable" }] };
  const photos = [...draft.photos];
  const errors: SpaceListingPhotoError[] = [];
  let draftBytes = uniqueFileBytes(photos);
  let workspaceBytes = spaceListingPhotoBytes(state, role);
  const retainedFiles = new Set(
    [
      ...visibleSpaceListingDrafts(state, role),
      ...(removedSpaceListingDraft(state, role)
        ? [removedSpaceListingDraft(state, role)!]
        : []),
    ].flatMap((item) => item.photos.map((photo) => photo.file)),
  );
  let nextPhotoId = draft.nextPhotoId;
  for (const file of files) {
    let issue = spaceListingPhotoProblem(file);
    if (!issue && photos.some((photo) => photo.file === file))
      issue = "duplicate";
    if (!issue && photos.length >= MAX_SPACE_LISTING_PHOTOS) issue = "count";
    if (!issue && draftBytes + file.size > MAX_SPACE_LISTING_DRAFT_BYTES)
      issue = "draftLimit";
    const extraBytes = retainedFiles.has(file) ? 0 : file.size;
    if (
      !issue &&
      workspaceBytes + extraBytes > MAX_SPACE_LISTING_WORKSPACE_BYTES
    )
      issue = "workspaceLimit";
    if (issue) {
      errors.push({ name: file.name, issue });
      continue;
    }
    while (photos.some((photo) => photo.id === `${id}-photo-${nextPhotoId}`))
      nextPhotoId++;
    photos.push({
      id: `${id}-photo-${nextPhotoId++}`,
      file,
      mimeType: photoMime(file),
    });
    draftBytes += file.size;
    workspaceBytes += extraBytes;
    retainedFiles.add(file);
  }
  const added = photos.length - draft.photos.length;
  return {
    state: added
      ? replace(state, {
          ...edited(draft, now),
          photos,
          nextPhotoId,
          coverPhotoId: draft.coverPhotoId ?? photos[0].id,
        })
      : state,
    added,
    errors,
  };
}
export function removeSpaceListingPhoto(
  state: SpaceListingState,
  role: Role,
  id: string,
  photoId: string,
  now = new Date(),
): SpaceListingState {
  const draft = spaceListingDraft(state, role, id);
  if (!draft || !draft.photos.some((photo) => photo.id === photoId))
    return state;
  const photos = draft.photos.filter((photo) => photo.id !== photoId);
  return replace(state, {
    ...edited(draft, now),
    photos,
    coverPhotoId:
      draft.coverPhotoId === photoId
        ? (photos[0]?.id ?? null)
        : draft.coverPhotoId,
  });
}
export function setSpaceListingCover(
  state: SpaceListingState,
  role: Role,
  id: string,
  photoId: string,
  now = new Date(),
): SpaceListingState {
  const draft = spaceListingDraft(state, role, id);
  return draft &&
    draft.coverPhotoId !== photoId &&
    draft.photos.some((photo) => photo.id === photoId)
    ? replace(state, { ...edited(draft, now), coverPhotoId: photoId })
    : state;
}
export function removeSpaceListingDraft(
  state: SpaceListingState,
  role: Role,
  id: string,
): SpaceListingState {
  const draft = spaceListingDraft(state, role, id);
  return draft
    ? {
        ...state,
        drafts: state.drafts.filter((item) => item.id !== id),
        removed: draft,
        view: {
          ...state.view,
          selectedDraftId:
            state.view.selectedDraftId === id
              ? null
              : state.view.selectedDraftId,
        },
      }
    : state;
}
export function restoreSpaceListingDraft(
  state: SpaceListingState,
  role: Role,
): { state: SpaceListingState; issue: SpaceListingIssue | null } {
  const draft = removedSpaceListingDraft(state, role);
  if (!draft) return { state, issue: "unavailable" };
  if (state.drafts.some((item) => item.id === draft.id))
    return { state, issue: "duplicate" };
  if (spaceListingPhotoBytes(state, role) > MAX_SPACE_LISTING_WORKSPACE_BYTES)
    return { state, issue: "workspaceLimit" };
  return {
    state: {
      ...state,
      drafts: [draft, ...state.drafts],
      removed: null,
      view: {
        ...state.view,
        filter: "All",
        query: "",
        selectedDraftId: draft.id,
      },
    },
    issue: null,
  };
}
