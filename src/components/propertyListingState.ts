import { workspaceLandlordName } from "../propertyScope";
import type { Role } from "../types";

export type PropertyListingIntent = "Rent" | "Buy";
export type PropertyListingStep = 1 | 2 | 3;
export const listingPropertyTypes = [
  "Apartment",
  "House",
  "Studio",
  "Loft",
] as const;
export const listingFurnishing = [
  "Furnished",
  "Unfurnished",
  "Part furnished",
] as const;
export const LISTING_PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp";
export const MAX_LISTING_PHOTOS = 20;
export const MAX_LISTING_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_LISTING_DRAFT_BYTES = 50 * 1024 * 1024;
export const MAX_LISTING_WORKSPACE_BYTES = 100 * 1024 * 1024;

export interface PropertyListingFields {
  listingType: PropertyListingIntent;
  title: string;
  propertyType: string;
  country: string;
  city: string;
  neighbourhood: string;
  address: string;
  relationship: string;
  bedrooms: string;
  bathrooms: string;
  area: string;
  rentPrice: string;
  salePrice: string;
  availability: string;
  availableFrom: string;
  furnishing: string;
  description: string;
}

export interface PropertyListingPhoto {
  id: string;
  file: File;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface PropertyListingDraft {
  id: string;
  owner: string;
  fields: PropertyListingFields;
  photos: PropertyListingPhoto[];
  coverPhotoId: string | null;
  nextPhotoId: number;
  step: PropertyListingStep;
  status: "Draft" | "Ready";
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export interface PropertyListingState {
  drafts: PropertyListingDraft[];
  removed: PropertyListingDraft | null;
  nextId: number;
}

export type ListingIssue =
  | "listingType"
  | "title"
  | "propertyType"
  | "country"
  | "city"
  | "neighbourhood"
  | "address"
  | "relationship"
  | "bedrooms"
  | "bathrooms"
  | "area"
  | "price"
  | "availability"
  | "availableFrom"
  | "furnishing"
  | "description"
  | "photos";
export type PropertyListingErrors = Partial<
  Record<keyof PropertyListingFields | "photos", ListingIssue>
>;
export type ListingPhotoIssue =
  | "empty"
  | "large"
  | "format"
  | "count"
  | "draftLimit"
  | "workspaceLimit"
  | "duplicate"
  | "unavailable";
export interface ListingPhotoError {
  name: string;
  issue: ListingPhotoIssue;
}

const emptyFields = (
  listingType: PropertyListingIntent,
): PropertyListingFields => ({
  listingType,
  title: "",
  propertyType: "Apartment",
  country: "",
  city: "",
  neighbourhood: "",
  address: "",
  relationship: "Owner",
  bedrooms: "",
  bathrooms: "",
  area: "",
  rentPrice: "",
  salePrice: "",
  availability: "now",
  availableFrom: "",
  furnishing: "",
  description: "",
});

export function createInitialPropertyListingState(): PropertyListingState {
  return { drafts: [], removed: null, nextId: 1 };
}

function allowedDraft(
  state: PropertyListingState,
  role: Role,
  id: string,
): PropertyListingDraft | undefined {
  return role === "landlord"
    ? state.drafts.find(
        (draft) => draft.id === id && draft.owner === workspaceLandlordName,
      )
    : undefined;
}

export function visiblePropertyListingDrafts(
  state: PropertyListingState,
  role: Role,
): PropertyListingDraft[] {
  return role === "landlord"
    ? state.drafts.filter((draft) => draft.owner === workspaceLandlordName)
    : [];
}

export function createPropertyListingDraft(
  state: PropertyListingState,
  role: Role,
  listingType: PropertyListingIntent,
  now = new Date(),
): { state: PropertyListingState; draftId: string | null } {
  if (role !== "landlord" || !["Rent", "Buy"].includes(listingType))
    return { state, draftId: null };
  const draft: PropertyListingDraft = {
    id: `property-draft-${state.nextId}`,
    owner: workspaceLandlordName,
    fields: emptyFields(listingType),
    photos: [],
    coverPhotoId: null,
    nextPhotoId: 1,
    step: 1,
    status: "Draft",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return {
    state: {
      ...state,
      drafts: [draft, ...state.drafts],
      nextId: state.nextId + 1,
    },
    draftId: draft.id,
  };
}

function replaceDraft(
  state: PropertyListingState,
  draft: PropertyListingDraft,
): PropertyListingState {
  return {
    ...state,
    drafts: state.drafts.map((item) => (item.id === draft.id ? draft : item)),
  };
}

function changedDraft(
  draft: PropertyListingDraft,
  now: Date,
): PropertyListingDraft {
  return {
    ...draft,
    status: "Draft",
    readyAt: undefined,
    updatedAt: now.toISOString(),
  };
}

export function updatePropertyListingDraft(
  state: PropertyListingState,
  role: Role,
  id: string,
  patch: Partial<PropertyListingFields>,
  now = new Date(),
): PropertyListingState {
  const draft = allowedDraft(state, role, id);
  if (!draft) return state;
  const fields = { ...draft.fields };
  let changed = false;
  for (const key of Object.keys(draft.fields) as Array<
    keyof PropertyListingFields
  >) {
    const value = patch[key];
    if (typeof value !== "string" || value === fields[key]) continue;
    if (key === "listingType") {
      if (value !== "Rent" && value !== "Buy") continue;
      fields.listingType = value;
    } else fields[key] = value;
    changed = true;
  }
  return changed
    ? replaceDraft(state, { ...changedDraft(draft, now), fields })
    : state;
}

export function listingDateValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function listingDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed)) return null;
  const number = Number(trimmed.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function listingPriceCents(value: string): number | null {
  const amount = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000_000
    ? cents
    : null;
}

function futureOrCurrentDate(value: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return (
    listingDateValue(new Date(year, month - 1, day)) === value &&
    value >= listingDateValue(now)
  );
}

export function listingPhotoProblem(
  file: Pick<File, "name" | "type" | "size">,
): ListingPhotoIssue | null {
  if (!Number.isFinite(file.size) || file.size <= 0) return "empty";
  if (file.size > MAX_LISTING_PHOTO_BYTES) return "large";
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

export function validatePropertyListingDraft(
  draft: PropertyListingDraft,
  scope: "basics" | "details" | "all" = "all",
  now = new Date(),
): PropertyListingErrors {
  const fields = draft.fields;
  const errors: PropertyListingErrors = {};
  const validLength = (value: string, min: number, max: number) =>
    value.trim().length >= min && value.trim().length <= max;
  if (!["Rent", "Buy"].includes(fields.listingType))
    errors.listingType = "listingType";
  if (scope !== "details") {
    if (!validLength(fields.title, 3, 120)) errors.title = "title";
    if (
      !listingPropertyTypes.includes(
        fields.propertyType as (typeof listingPropertyTypes)[number],
      )
    )
      errors.propertyType = "propertyType";
    if (!validLength(fields.country, 2, 80)) errors.country = "country";
    if (!validLength(fields.city, 2, 100)) errors.city = "city";
    if (fields.neighbourhood.trim().length > 100)
      errors.neighbourhood = "neighbourhood";
    if (!validLength(fields.address, 5, 240)) errors.address = "address";
    if (!["Owner", "Authorised representative"].includes(fields.relationship))
      errors.relationship = "relationship";
  }
  if (scope !== "basics") {
    const beds = listingDecimal(fields.bedrooms);
    const baths = listingDecimal(fields.bathrooms);
    const area = listingDecimal(fields.area);
    if (beds === null || !Number.isInteger(beds) || beds < 0 || beds > 30)
      errors.bedrooms = "bedrooms";
    if (
      baths === null ||
      baths < 0.5 ||
      baths > 30 ||
      !Number.isInteger(baths * 2)
    )
      errors.bathrooms = "bathrooms";
    if (area === null || area <= 0 || area > 100_000) errors.area = "area";
    if (fields.listingType === "Rent") {
      if (listingPriceCents(fields.rentPrice) === null)
        errors.rentPrice = "price";
      if (!["now", "date"].includes(fields.availability))
        errors.availability = "availability";
      if (
        fields.availability === "date" &&
        !futureOrCurrentDate(fields.availableFrom, now)
      )
        errors.availableFrom = "availableFrom";
      if (
        !listingFurnishing.includes(
          fields.furnishing as (typeof listingFurnishing)[number],
        )
      )
        errors.furnishing = "furnishing";
    } else if (fields.listingType === "Buy") {
      if (listingPriceCents(fields.salePrice) === null)
        errors.salePrice = "price";
      if (
        fields.furnishing &&
        !listingFurnishing.includes(
          fields.furnishing as (typeof listingFurnishing)[number],
        )
      )
        errors.furnishing = "furnishing";
    }
    if (!validLength(fields.description, 20, 4000))
      errors.description = "description";
    const photoBytes = draft.photos.reduce(
      (sum, photo) => sum + photo.file.size,
      0,
    );
    if (
      draft.photos.length > MAX_LISTING_PHOTOS ||
      photoBytes > MAX_LISTING_DRAFT_BYTES ||
      draft.photos.some((photo) => listingPhotoProblem(photo.file)) ||
      (draft.photos.length > 0
        ? !draft.photos.some((photo) => photo.id === draft.coverPhotoId)
        : draft.coverPhotoId !== null)
    )
      errors.photos = "photos";
  }
  return errors;
}

export function movePropertyListingStep(
  state: PropertyListingState,
  role: Role,
  id: string,
  step: PropertyListingStep,
  now = new Date(),
): PropertyListingState {
  const draft = allowedDraft(state, role, id);
  if (!draft || ![1, 2, 3].includes(step) || step === draft.step) return state;
  if (
    step > draft.step &&
    Object.keys(
      validatePropertyListingDraft(draft, step === 2 ? "basics" : "all", now),
    ).length
  )
    return state;
  return replaceDraft(state, { ...draft, step });
}

export function markPropertyListingReady(
  state: PropertyListingState,
  role: Role,
  id: string,
  now = new Date(),
): PropertyListingState {
  const draft = allowedDraft(state, role, id);
  if (
    !draft ||
    draft.status === "Ready" ||
    Object.keys(validatePropertyListingDraft(draft, "all", now)).length
  )
    return state;
  const fields = { ...draft.fields };
  for (const key of Object.keys(fields) as Array<keyof PropertyListingFields>) {
    if (key !== "listingType") fields[key] = fields[key].trim();
  }
  return replaceDraft(state, {
    ...draft,
    fields,
    status: "Ready",
    step: 3,
    readyAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

export function propertyListingPhotoBytes(
  state: PropertyListingState,
  role: Role,
): number {
  return visiblePropertyListingDrafts(state, role).reduce(
    (total, draft) =>
      total + draft.photos.reduce((sum, photo) => sum + photo.file.size, 0),
    0,
  );
}

export function addPropertyListingPhotos(
  state: PropertyListingState,
  role: Role,
  id: string,
  files: readonly File[],
  now = new Date(),
): { state: PropertyListingState; added: number; errors: ListingPhotoError[] } {
  const draft = allowedDraft(state, role, id);
  if (!draft)
    return { state, added: 0, errors: [{ name: "", issue: "unavailable" }] };
  const photos = [...draft.photos];
  const errors: ListingPhotoError[] = [];
  let draftBytes = photos.reduce((sum, photo) => sum + photo.file.size, 0);
  let workspaceBytes = propertyListingPhotoBytes(state, role);
  let nextPhotoId = draft.nextPhotoId;
  for (const file of files) {
    let issue = listingPhotoProblem(file);
    if (!issue && photos.some((photo) => photo.file === file))
      issue = "duplicate";
    if (!issue && photos.length >= MAX_LISTING_PHOTOS) issue = "count";
    if (!issue && draftBytes + file.size > MAX_LISTING_DRAFT_BYTES)
      issue = "draftLimit";
    if (!issue && workspaceBytes + file.size > MAX_LISTING_WORKSPACE_BYTES)
      issue = "workspaceLimit";
    if (issue) {
      errors.push({ name: file.name, issue });
      continue;
    }
    const extension = file.name.split(".").at(-1)!.toLowerCase();
    const mimeType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";
    photos.push({ id: `${draft.id}-photo-${nextPhotoId}`, file, mimeType });
    nextPhotoId += 1;
    draftBytes += file.size;
    workspaceBytes += file.size;
  }
  const added = photos.length - draft.photos.length;
  return {
    state: added
      ? replaceDraft(state, {
          ...changedDraft(draft, now),
          photos,
          nextPhotoId,
          coverPhotoId: draft.coverPhotoId ?? photos[0].id,
        })
      : state,
    added,
    errors,
  };
}

export function removePropertyListingPhoto(
  state: PropertyListingState,
  role: Role,
  id: string,
  photoId: string,
  now = new Date(),
): PropertyListingState {
  const draft = allowedDraft(state, role, id);
  if (!draft || !draft.photos.some((photo) => photo.id === photoId))
    return state;
  const photos = draft.photos.filter((photo) => photo.id !== photoId);
  return replaceDraft(state, {
    ...changedDraft(draft, now),
    photos,
    coverPhotoId:
      draft.coverPhotoId === photoId
        ? (photos[0]?.id ?? null)
        : draft.coverPhotoId,
  });
}

export function setPropertyListingCover(
  state: PropertyListingState,
  role: Role,
  id: string,
  photoId: string,
  now = new Date(),
): PropertyListingState {
  const draft = allowedDraft(state, role, id);
  if (
    !draft ||
    draft.coverPhotoId === photoId ||
    !draft.photos.some((photo) => photo.id === photoId)
  )
    return state;
  return replaceDraft(state, {
    ...changedDraft(draft, now),
    coverPhotoId: photoId,
  });
}

export function removePropertyListingDraft(
  state: PropertyListingState,
  role: Role,
  id: string,
): PropertyListingState {
  const draft = allowedDraft(state, role, id);
  return draft
    ? {
        ...state,
        drafts: state.drafts.filter((item) => item.id !== id),
        removed: draft,
      }
    : state;
}

export function propertyListingRestoreIssue(
  state: PropertyListingState,
  role: Role,
): "unavailable" | "duplicate" | "workspaceLimit" | null {
  const draft = state.removed;
  if (role !== "landlord" || !draft || draft.owner !== workspaceLandlordName)
    return "unavailable";
  if (state.drafts.some((item) => item.id === draft.id)) return "duplicate";
  if (
    propertyListingPhotoBytes(state, role) +
      draft.photos.reduce((sum, photo) => sum + photo.file.size, 0) >
    MAX_LISTING_WORKSPACE_BYTES
  )
    return "workspaceLimit";
  return null;
}

export function restorePropertyListingDraft(
  state: PropertyListingState,
  role: Role,
): PropertyListingState {
  if (propertyListingRestoreIssue(state, role)) return state;
  return { ...state, drafts: [state.removed!, ...state.drafts], removed: null };
}
