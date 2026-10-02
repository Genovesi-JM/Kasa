import type { Property, Role } from "../types";

export interface ViewingRequestDraft {
  date: string;
  time: string;
  note: string;
}

export interface RentalApplicationDraft {
  moveInDate: string;
  householdSize: number;
  introduction: string;
}

export type RequestErrors = Partial<
  Record<"date" | "time" | "note" | "householdSize" | "introduction", string>
>;

export interface ViewingRequest {
  id: string;
  propertyId: number;
  role: Role;
  date: string;
  time: string;
  note: string;
  status: "Pending" | "Cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRequestState {
  viewings: ViewingRequest[];
}

export function createInitialPropertyRequestState(): PropertyRequestState {
  return { viewings: [] };
}

export function localDateValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function futureLocalDate(days: number, now = new Date()): string {
  return localDateValue(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days),
  );
}

export function isCurrentOrFutureDate(
  value: string,
  now = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return localDateValue(date) === value && value >= localDateValue(now);
}

export function validateViewingRequest(
  draft: ViewingRequestDraft,
  now = new Date(),
): RequestErrors {
  const errors: RequestErrors = {};
  if (!isCurrentOrFutureDate(draft.date, now))
    errors.date = "Choose today or a future date.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) {
    errors.time = "Choose a valid viewing time.";
  } else if (!errors.date) {
    const [year, month, day] = draft.date.split("-").map(Number);
    const [hour, minute] = draft.time.split(":").map(Number);
    const requested = new Date(year, month - 1, day, hour, minute);
    if (
      requested.getTime() <= now.getTime() ||
      requested.getHours() !== hour ||
      requested.getMinutes() !== minute
    ) {
      errors.time = "Choose a time that is still in the future.";
    }
  }
  if (draft.note.trim().length > 1000)
    errors.note = "Use 1,000 characters or fewer.";
  return errors;
}

export function validateRentalApplication(
  draft: RentalApplicationDraft,
  now = new Date(),
): RequestErrors {
  const errors: RequestErrors = {};
  if (!isCurrentOrFutureDate(draft.moveInDate, now))
    errors.date = "Choose today or a future move-in date.";
  if (!Number.isSafeInteger(draft.householdSize) || draft.householdSize < 1)
    errors.householdSize =
      "Enter the number of people as a whole number of 1 or more.";
  if (draft.introduction.trim().length > 1000)
    errors.introduction = "Use 1,000 characters or fewer.";
  return errors;
}

export function viewingForProperty(
  state: PropertyRequestState,
  role: Role,
  propertyId: number,
) {
  return state.viewings.find(
    (request) => request.role === role && request.propertyId === propertyId,
  );
}

export function saveViewingRequest(
  state: PropertyRequestState,
  role: Role,
  property: Pick<Property, "id">,
  draft: ViewingRequestDraft,
  now = new Date(),
): PropertyRequestState {
  if (
    role !== "tenant" ||
    Object.keys(validateViewingRequest(draft, now)).length
  )
    return state;
  const previous = viewingForProperty(state, role, property.id);
  const request: ViewingRequest = {
    id: previous?.id ?? `viewing-${role}-${property.id}`,
    propertyId: property.id,
    role,
    date: draft.date,
    time: draft.time,
    note: draft.note.trim(),
    status: "Pending",
    createdAt: previous?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return {
    ...state,
    viewings: previous
      ? state.viewings.map((item) => (item.id === previous.id ? request : item))
      : [...state.viewings, request],
  };
}

export function cancelViewingRequest(
  state: PropertyRequestState,
  role: Role,
  propertyId: number,
  now = new Date(),
): PropertyRequestState {
  if (role !== "tenant") return state;
  const request = viewingForProperty(state, role, propertyId);
  if (!request || request.status !== "Pending") return state;
  return {
    ...state,
    viewings: state.viewings.map((item) =>
      item.id === request.id
        ? { ...item, status: "Cancelled", updatedAt: now.toISOString() }
        : item,
    ),
  };
}
