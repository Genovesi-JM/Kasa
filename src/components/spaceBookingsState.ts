import { spaceBookings, spaceVenues } from "../data";
import type { Role, SpaceBooking } from "../types";

export type SpaceBookingCustomerRole = "tenant" | "landlord";
export type SpaceBookingPhase =
  "Requested" | "Proposed" | "Agreed" | "Declined" | "Cancelled" | "Completed";
export type SpaceBookingFilter = "All" | SpaceBooking["status"] | "Declined";
export interface SpaceBookingTerms {
  date: string;
  start: string;
  end: string;
  priceCents: number | null;
  cleaningFeeCents: number;
  depositCents: number;
}
export interface PricedSpaceBookingTerms extends SpaceBookingTerms {
  priceCents: number;
}
export interface SpaceBookingProposal {
  id: string;
  version: number;
  originalTerms: SpaceBookingTerms;
  proposedTerms: PricedSpaceBookingTerms;
  originalTime: string;
  proposedTime: string;
  status: "pending" | "accepted" | "declined" | "superseded" | "withdrawn";
  createdAt: string;
  decidedAt?: string;
  note: string;
}
export interface SpaceBookingHistory {
  id: string;
  source: "sample" | "local";
  at: string;
  actor: string;
  action:
    | "requested"
    | "accepted"
    | "declined"
    | "proposed"
    | "proposal-accepted"
    | "proposal-declined"
    | "cancelled"
    | "completed";
  note?: string;
  proposalId?: string;
}
export interface ManagedSpaceBooking extends SpaceBooking {
  source: "sample" | "local";
  customerRole: SpaceBookingCustomerRole;
  customerName: string;
  venueId: number;
  spaceId: number;
  participants: number;
  notes: string;
  requestedTerms: SpaceBookingTerms;
  agreedTerms?: PricedSpaceBookingTerms;
  phase: SpaceBookingPhase;
  proposals: SpaceBookingProposal[];
  proposal?: SpaceBookingProposal;
  history: SpaceBookingHistory[];
  createdAt: string;
  updatedAt: string;
  cancellationReason?: string;
  declineReason?: string;
}
export interface SpaceBookingRequestDraft {
  date: string;
  start: string;
  end: string;
  participants: string;
  notes: string;
}
export interface SpaceBookingActionDraft {
  date: string;
  start: string;
  end: string;
  price: string;
  cleaningFee: string;
  deposit: string;
  note: string;
}
export interface SpaceBookingView {
  filter: SpaceBookingFilter;
  selectedId: string | null;
}
export interface SpaceOperatorInboxView {
  query: string;
  filter: "pending" | "agreed" | "history" | "all";
  selectedId: string | null;
}
export interface SpaceTimeBlockDraft {
  date: string;
  start: string;
  end: string;
  note: string;
}
export interface SpaceTimeBlock extends SpaceTimeBlockDraft {
  id: string;
  venueId: number;
  spaceId: number;
  createdAt: string;
  updatedAt: string;
  removedAt?: string;
  history: Array<{
    action: "created" | "removed" | "restored";
    at: string;
  }>;
}
export interface SpaceScheduleView {
  venueId: number | null;
  spaceId: number | null;
  date: string;
}
type SpaceBookingRangeIssue =
  "date" | "start" | "end" | "range" | "openingHours";
export type SpaceTimeBlockIssue =
  | SpaceBookingRangeIssue
  | "unavailable"
  | "note"
  | "blockConflict"
  | "bookingConflict"
  | "status";
export type SpaceTimeBlockErrors = Partial<
  Record<keyof SpaceTimeBlockDraft, SpaceTimeBlockIssue>
>;
export type SpaceScheduleEntry =
  | { kind: "block"; block: SpaceTimeBlock }
  | {
      kind: "booking";
      booking: ManagedSpaceBooking;
      terms: PricedSpaceBookingTerms;
    };
export interface SpaceBookingsState {
  bookings: ManagedSpaceBooking[];
  /** Legacy tenant view; new callers use spaceBookingView with an explicit role. */
  filter: SpaceBookingFilter;
  selectedId: string | null;
  views: Record<Role, SpaceBookingView>;
  operatorInboxView: SpaceOperatorInboxView;
  requestDrafts: Record<
    SpaceBookingCustomerRole,
    Record<string, SpaceBookingRequestDraft>
  >;
  actionDrafts: Record<Role, Record<string, SpaceBookingActionDraft>>;
  nextId: number;
  timeBlocks: SpaceTimeBlock[];
  timeBlockDrafts: Record<string, SpaceTimeBlockDraft>;
  scheduleView: SpaceScheduleView;
  removedTimeBlockId: string | null;
  nextTimeBlockId: number;
}
export type SpaceBookingIssue =
  | "unavailable"
  | "role"
  | "venue"
  | "space"
  | "date"
  | "start"
  | "end"
  | "range"
  | "openingHours"
  | "participants"
  | "notes"
  | "price"
  | "cleaningFee"
  | "deposit"
  | "note"
  | "conflict"
  | "blocked"
  | "duplicate"
  | "status"
  | "staleProposal"
  | "priceRequired"
  | "noChange";
export type SpaceBookingRequestErrors = Partial<
  Record<keyof SpaceBookingRequestDraft, SpaceBookingIssue>
>;
export type SpaceBookingProposalErrors = Partial<
  Record<keyof SpaceBookingActionDraft, SpaceBookingIssue>
>;
export type SpaceBookingAction =
  | { type: "accept-request" }
  | { type: "decline-request"; note: string }
  | { type: "accept-proposal"; proposalId: string }
  | { type: "keep-original"; proposalId: string }
  | { type: "cancel"; note?: string };

const customers: Record<SpaceBookingCustomerRole, string> = {
  tenant: "Inês Duarte",
  landlord: "Olivia Martín",
};
const workspaceOperatorVenueIds = new Set([1]);
export function isSpaceBookingCustomer(
  role: Role,
): role is SpaceBookingCustomerRole {
  return role === "tenant" || role === "landlord";
}
export function spaceBookingVenue(venueId: number) {
  return spaceVenues.find((venue) => venue.id === venueId);
}
export function spaceBookingUnit(venueId: number, spaceId: number) {
  return spaceBookingVenue(venueId)?.spaces.find(
    (space) => space.id === spaceId,
  );
}
export function operatorSpaceVenues(role: Role) {
  return role === "spaceOperator"
    ? spaceVenues.filter((venue) => workspaceOperatorVenueIds.has(venue.id))
    : [];
}
function operatorOwns(booking: ManagedSpaceBooking, role: Role) {
  return operatorOwnsUnit(role, booking.venueId, booking.spaceId);
}
function operatorOwnsUnit(role: Role, venueId: number, spaceId: number) {
  return (
    role === "spaceOperator" &&
    workspaceOperatorVenueIds.has(venueId) &&
    Boolean(spaceBookingUnit(venueId, spaceId))
  );
}
function customerOwns(booking: ManagedSpaceBooking, role: Role) {
  return (
    isSpaceBookingCustomer(role) &&
    booking.customerRole === role &&
    booking.customerName === customers[role] &&
    Boolean(spaceBookingUnit(booking.venueId, booking.spaceId))
  );
}
function canRead(booking: ManagedSpaceBooking, role: Role) {
  return customerOwns(booking, role) || operatorOwns(booking, role);
}
export function spaceBookingDateValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return spaceBookingDateValue(new Date(year, month - 1, day)) === value;
}
function minute(value: string): number | null {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
    : null;
}
function validDateTime(date: string, time: string, now: Date): boolean {
  if (!validDate(date) || minute(time) === null) return false;
  const parsed = new Date(`${date}T${time}:00`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.getHours() === Number(time.slice(0, 2)) &&
    parsed.getMinutes() === Number(time.slice(3)) &&
    parsed.getTime() >= Math.floor(now.getTime() / 60000) * 60000
  );
}
function timeText(terms: Pick<SpaceBookingTerms, "start" | "end">) {
  return `${terms.start}–${terms.end}`;
}
function moneyCents(value: string, allowZero = false): number | null {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) &&
    amount >= (allowZero ? 0 : 1) &&
    amount <= 100_000_000
    ? amount
    : null;
}
const centsValid = (value: number, allowZero = false) =>
  Number.isSafeInteger(value) &&
  value >= (allowZero ? 0 : 1) &&
  value <= 100_000_000;
export function bookingTermsTotalCents(
  terms: SpaceBookingTerms,
): number | null {
  return terms.priceCents !== null &&
    centsValid(terms.priceCents) &&
    centsValid(terms.cleaningFeeCents, true) &&
    centsValid(terms.depositCents, true)
    ? terms.priceCents + terms.cleaningFeeCents + terms.depositCents
    : null;
}
function sameTerms(a: SpaceBookingTerms, b: SpaceBookingTerms) {
  return (
    a.date === b.date &&
    a.start === b.start &&
    a.end === b.end &&
    a.priceCents === b.priceCents &&
    a.cleaningFeeCents === b.cleaningFeeCents &&
    a.depositCents === b.depositCents
  );
}
function rangeErrors(
  venueId: number,
  terms: Pick<SpaceBookingTerms, "date" | "start" | "end">,
  now: Date,
): Partial<Record<"date" | "start" | "end", SpaceBookingRangeIssue>> {
  const errors: Partial<
    Record<"date" | "start" | "end", SpaceBookingRangeIssue>
  > = {};
  if (!validDate(terms.date) || terms.date < spaceBookingDateValue(now))
    errors.date = "date";
  const start = minute(terms.start);
  const end = minute(terms.end);
  if (
    start === null ||
    (!errors.date && !validDateTime(terms.date, terms.start, now))
  )
    errors.start = "start";
  if (end === null) errors.end = "end";
  if (start !== null && end !== null && end <= start) errors.end = "range";
  const opening = spaceBookingVenue(venueId)?.openingHours.match(
    /^(\d{2}:\d{2})[–-](\d{2}:\d{2})$/,
  );
  if (opening && start !== null && end !== null) {
    const open = minute(opening[1]);
    const close = minute(opening[2]);
    if (open !== null && close !== null && open < close) {
      if (start < open) errors.start = "openingHours";
      if (end > close) errors.end = "openingHours";
    }
  }
  return errors;
}
export function spaceBookingConflicts(
  state: SpaceBookingsState,
  venueId: number,
  spaceId: number,
  terms: Pick<SpaceBookingTerms, "date" | "start" | "end">,
  excludeId?: string,
): boolean {
  const start = minute(terms.start);
  const end = minute(terms.end);
  if (start === null || end === null) return false;
  return state.bookings.some((booking) => {
    const occupied = booking.agreedTerms;
    if (
      booking.id === excludeId ||
      booking.venueId !== venueId ||
      booking.spaceId !== spaceId ||
      !occupied ||
      ["Cancelled", "Declined"].includes(booking.phase) ||
      occupied.date !== terms.date
    )
      return false;
    const otherStart = minute(occupied.start);
    const otherEnd = minute(occupied.end);
    return (
      otherStart !== null &&
      otherEnd !== null &&
      start < otherEnd &&
      end > otherStart
    );
  });
}
function draftKey(venueId: number, spaceId: number) {
  return `${venueId}:${spaceId}`;
}
function copyTimeBlock(block: SpaceTimeBlock): SpaceTimeBlock {
  return { ...block, history: block.history.map((event) => ({ ...event })) };
}
export function spaceScheduleView(
  state: SpaceBookingsState,
  role: Role,
): SpaceScheduleView {
  return role === "spaceOperator"
    ? { ...state.scheduleView }
    : { venueId: null, spaceId: null, date: "" };
}
export function updateSpaceScheduleView(
  state: SpaceBookingsState,
  role: Role,
  patch: Partial<SpaceScheduleView>,
): SpaceBookingsState {
  if (role !== "spaceOperator") return state;
  const next = { ...state.scheduleView };
  if (patch.venueId !== undefined) {
    const venue = operatorSpaceVenues(role).find(
      (item) => item.id === patch.venueId,
    );
    if (!venue) return state;
    if (venue.id !== next.venueId) {
      next.venueId = venue.id;
      next.spaceId = venue.spaces[0]?.id ?? null;
    }
  }
  if (patch.spaceId !== undefined) {
    if (
      next.venueId === null ||
      patch.spaceId === null ||
      !operatorOwnsUnit(role, next.venueId, patch.spaceId)
    )
      return state;
    next.spaceId = patch.spaceId;
  }
  if (patch.date !== undefined) {
    if (typeof patch.date !== "string" || !validDate(patch.date)) return state;
    next.date = patch.date;
  }
  return next.venueId === state.scheduleView.venueId &&
    next.spaceId === state.scheduleView.spaceId &&
    next.date === state.scheduleView.date
    ? state
    : { ...state, scheduleView: next };
}
export function spaceTimeBlockDraft(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
): SpaceTimeBlockDraft | null {
  if (!operatorOwnsUnit(role, venueId, spaceId)) return null;
  return {
    ...(state.timeBlockDrafts[draftKey(venueId, spaceId)] ?? {
      date: state.scheduleView.date,
      start: "",
      end: "",
      note: "",
    }),
  };
}
export function updateSpaceTimeBlockDraft(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
  patch: Partial<SpaceTimeBlockDraft>,
): SpaceBookingsState {
  const draft = spaceTimeBlockDraft(state, role, venueId, spaceId);
  if (!draft) return state;
  const next = { ...draft };
  let changed = false;
  for (const field of Object.keys(draft) as Array<keyof SpaceTimeBlockDraft>) {
    const value = patch[field];
    if (typeof value === "string" && value !== draft[field]) {
      next[field] = value;
      changed = true;
    }
  }
  return changed
    ? {
        ...state,
        timeBlockDrafts: {
          ...state.timeBlockDrafts,
          [draftKey(venueId, spaceId)]: next,
        },
      }
    : state;
}
export function discardSpaceTimeBlockDraft(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
): SpaceBookingsState {
  if (
    !operatorOwnsUnit(role, venueId, spaceId) ||
    !Object.hasOwn(state.timeBlockDrafts, draftKey(venueId, spaceId))
  )
    return state;
  const drafts = { ...state.timeBlockDrafts };
  delete drafts[draftKey(venueId, spaceId)];
  return { ...state, timeBlockDrafts: drafts };
}
/** Public projection: private notes, history and operator metadata never leave this selector. */
export function spaceBookingUnavailablePeriods(
  state: SpaceBookingsState,
  venueId: number,
  spaceId: number,
  date: string,
): Array<{ id: string; start: string; end: string }> {
  if (!operatorOwnsUnit("spaceOperator", venueId, spaceId) || !validDate(date))
    return [];
  return state.timeBlocks
    .filter(
      (block) =>
        !block.removedAt &&
        block.venueId === venueId &&
        block.spaceId === spaceId &&
        block.date === date,
    )
    .map(({ id, start, end }) => ({ id, start, end }))
    .sort(
      (left, right) =>
        left.start.localeCompare(right.start) ||
        left.id.localeCompare(right.id),
    );
}
export function spaceTimeBlockConflicts(
  state: SpaceBookingsState,
  venueId: number,
  spaceId: number,
  terms: Pick<SpaceBookingTerms, "date" | "start" | "end">,
  excludeId?: string,
): boolean {
  const start = minute(terms.start);
  const end = minute(terms.end);
  if (start === null || end === null || end <= start) return false;
  return spaceBookingUnavailablePeriods(
    state,
    venueId,
    spaceId,
    terms.date,
  ).some((block) => {
    const otherStart = minute(block.start);
    const otherEnd = minute(block.end);
    return (
      block.id !== excludeId &&
      otherStart !== null &&
      otherEnd !== null &&
      start < otherEnd &&
      end > otherStart
    );
  });
}
export function validateSpaceTimeBlock(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
  draft: SpaceTimeBlockDraft,
  now = new Date(),
): { errors: SpaceTimeBlockErrors; issue?: SpaceTimeBlockIssue } {
  if (!operatorOwnsUnit(role, venueId, spaceId))
    return { errors: {}, issue: "unavailable" };
  const errors: SpaceTimeBlockErrors = rangeErrors(venueId, draft, now);
  if (draft.note.trim().length > 500) errors.note = "note";
  if (Object.keys(errors).length) return { errors };
  if (spaceTimeBlockConflicts(state, venueId, spaceId, draft))
    return { errors, issue: "blockConflict" };
  if (spaceBookingConflicts(state, venueId, spaceId, draft))
    return { errors, issue: "bookingConflict" };
  return { errors };
}
export function createSpaceTimeBlock(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
  now = new Date(),
): {
  state: SpaceBookingsState;
  blockId: string | null;
  errors: SpaceTimeBlockErrors;
  issue?: SpaceTimeBlockIssue;
} {
  const draft = spaceTimeBlockDraft(state, role, venueId, spaceId);
  if (!draft) return { state, blockId: null, errors: {}, issue: "unavailable" };
  const validation = validateSpaceTimeBlock(
    state,
    role,
    venueId,
    spaceId,
    draft,
    now,
  );
  if (validation.issue || Object.keys(validation.errors).length)
    return { state, blockId: null, ...validation };
  const at = now.toISOString();
  const block: SpaceTimeBlock = {
    ...draft,
    note: draft.note.trim(),
    id: `space-block-${state.nextTimeBlockId}`,
    venueId,
    spaceId,
    createdAt: at,
    updatedAt: at,
    history: [{ action: "created", at }],
  };
  const next = discardSpaceTimeBlockDraft(state, role, venueId, spaceId);
  return {
    state: {
      ...next,
      timeBlocks: [...state.timeBlocks, block],
      nextTimeBlockId: state.nextTimeBlockId + 1,
      scheduleView: { venueId, spaceId, date: draft.date },
    },
    blockId: block.id,
    errors: {},
  };
}
export function removedSpaceTimeBlock(
  state: SpaceBookingsState,
  role: Role,
): SpaceTimeBlock | null {
  const block = state.timeBlocks.find(
    (item) => item.id === state.removedTimeBlockId,
  );
  return block?.removedAt &&
    operatorOwnsUnit(role, block.venueId, block.spaceId)
    ? copyTimeBlock(block)
    : null;
}
export function removeSpaceTimeBlock(
  state: SpaceBookingsState,
  role: Role,
  id: string,
  now = new Date(),
): { state: SpaceBookingsState; issue?: SpaceTimeBlockIssue } {
  const block = state.timeBlocks.find((item) => item.id === id);
  if (!block || !operatorOwnsUnit(role, block.venueId, block.spaceId))
    return { state, issue: "unavailable" };
  if (block.removedAt) return { state, issue: "status" };
  const at = now.toISOString();
  return {
    state: {
      ...state,
      removedTimeBlockId: id,
      timeBlocks: state.timeBlocks.map((item) =>
        item.id === id
          ? {
              ...item,
              removedAt: at,
              updatedAt: at,
              history: [...item.history, { action: "removed", at }],
            }
          : item,
      ),
    },
  };
}
export function restoreSpaceTimeBlock(
  state: SpaceBookingsState,
  role: Role,
  id: string,
  now = new Date(),
): { state: SpaceBookingsState; issue?: SpaceTimeBlockIssue } {
  const block = state.timeBlocks.find((item) => item.id === id);
  if (!block || !operatorOwnsUnit(role, block.venueId, block.spaceId))
    return { state, issue: "unavailable" };
  if (!block.removedAt) return { state, issue: "status" };
  const validation = validateSpaceTimeBlock(
    state,
    role,
    block.venueId,
    block.spaceId,
    block,
    now,
  );
  const issue = validation.issue ?? Object.values(validation.errors)[0];
  if (issue) return { state, issue };
  const at = now.toISOString();
  return {
    state: {
      ...state,
      removedTimeBlockId:
        state.removedTimeBlockId === id ? null : state.removedTimeBlockId,
      timeBlocks: state.timeBlocks.map((item) => {
        if (item.id !== id) return item;
        const restored = { ...item };
        delete restored.removedAt;
        return {
          ...restored,
          updatedAt: at,
          history: [...item.history, { action: "restored" as const, at }],
        };
      }),
    },
  };
}
export function spaceScheduleEntries(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
  date: string,
): SpaceScheduleEntry[] {
  if (!operatorOwnsUnit(role, venueId, spaceId) || !validDate(date)) return [];
  const entries: SpaceScheduleEntry[] = state.timeBlocks
    .filter(
      (block) =>
        !block.removedAt &&
        block.venueId === venueId &&
        block.spaceId === spaceId &&
        block.date === date,
    )
    .map((block) => ({ kind: "block", block: copyTimeBlock(block) }));
  for (const booking of scopedSpaceBookings(state, role)) {
    if (
      booking.venueId === venueId &&
      booking.spaceId === spaceId &&
      booking.agreedTerms?.date === date &&
      !["Cancelled", "Declined"].includes(booking.phase)
    )
      entries.push({
        kind: "booking",
        booking,
        terms: { ...booking.agreedTerms },
      });
  }
  const start = (entry: SpaceScheduleEntry) =>
    entry.kind === "block" ? entry.block.start : entry.terms.start;
  return entries.sort((left, right) => start(left).localeCompare(start(right)));
}
export function spaceBookingDraft(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
): SpaceBookingRequestDraft {
  return isSpaceBookingCustomer(role)
    ? (state.requestDrafts[role][draftKey(venueId, spaceId)] ?? {
        date: "",
        start: "",
        end: "",
        participants: "",
        notes: "",
      })
    : { date: "", start: "", end: "", participants: "", notes: "" };
}
export function spaceBookingDrafts(state: SpaceBookingsState, role: Role) {
  return isSpaceBookingCustomer(role)
    ? Object.entries(state.requestDrafts[role]).flatMap(([key, draft]) => {
        const [venueId, spaceId] = key.split(":").map(Number);
        return spaceBookingUnit(venueId, spaceId)
          ? [{ venueId, spaceId, draft }]
          : [];
      })
    : [];
}
export function updateSpaceBookingDraft(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
  patch: Partial<SpaceBookingRequestDraft>,
): SpaceBookingsState {
  if (!isSpaceBookingCustomer(role) || !spaceBookingUnit(venueId, spaceId))
    return state;
  const draft = spaceBookingDraft(state, role, venueId, spaceId);
  const next = { ...draft };
  let changed = false;
  for (const name of Object.keys(draft) as Array<
    keyof SpaceBookingRequestDraft
  >) {
    const value = patch[name];
    if (typeof value === "string" && value !== draft[name]) {
      next[name] = value;
      changed = true;
    }
  }
  return changed
    ? {
        ...state,
        requestDrafts: {
          ...state.requestDrafts,
          [role]: {
            ...state.requestDrafts[role],
            [draftKey(venueId, spaceId)]: next,
          },
        },
      }
    : state;
}
export function discardSpaceBookingDraft(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
): SpaceBookingsState {
  if (
    !isSpaceBookingCustomer(role) ||
    !Object.hasOwn(state.requestDrafts[role], draftKey(venueId, spaceId))
  )
    return state;
  const drafts = { ...state.requestDrafts[role] };
  delete drafts[draftKey(venueId, spaceId)];
  return {
    ...state,
    requestDrafts: { ...state.requestDrafts, [role]: drafts },
  };
}
export function validateSpaceBookingRequest(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
  draft: SpaceBookingRequestDraft,
  now = new Date(),
): { errors: SpaceBookingRequestErrors; issue?: SpaceBookingIssue } {
  if (!isSpaceBookingCustomer(role)) return { errors: {}, issue: "role" };
  if (!spaceBookingVenue(venueId)) return { errors: {}, issue: "venue" };
  const space = spaceBookingUnit(venueId, spaceId);
  if (!space) return { errors: {}, issue: "space" };
  const errors: SpaceBookingRequestErrors = rangeErrors(venueId, draft, now);
  if (
    !/^\d+$/.test(draft.participants.trim()) ||
    Number(draft.participants) < 1 ||
    Number(draft.participants) > space.capacity
  )
    errors.participants = "participants";
  if (draft.notes.trim().length > 3000) errors.notes = "notes";
  const sameRange = (terms: SpaceBookingTerms) =>
    terms.date === draft.date &&
    terms.start === draft.start &&
    terms.end === draft.end;
  if (
    !Object.keys(errors).length &&
    state.bookings.some(
      (booking) =>
        customerOwns(booking, role) &&
        booking.venueId === venueId &&
        booking.spaceId === spaceId &&
        ["Requested", "Proposed", "Agreed"].includes(booking.phase) &&
        (sameRange(booking.requestedTerms) ||
          (booking.agreedTerms && sameRange(booking.agreedTerms))),
    )
  )
    return { errors, issue: "duplicate" };
  if (
    !Object.keys(errors).length &&
    spaceTimeBlockConflicts(state, venueId, spaceId, draft)
  )
    return { errors, issue: "blocked" };
  if (
    !Object.keys(errors).length &&
    spaceBookingConflicts(state, venueId, spaceId, draft)
  )
    return { errors, issue: "conflict" };
  return { errors };
}
export function spaceBookingRequestTerms(
  venueId: number,
  spaceId: number,
  draft: SpaceBookingRequestDraft,
): SpaceBookingTerms | null {
  const venue = spaceBookingVenue(venueId);
  const space = spaceBookingUnit(venueId, spaceId);
  if (!venue || !space) return null;
  // Catalogue prices are examples, not live date-specific availability. Custom ranges need an operator quote.
  const suggested = space.slots.find(
    (slot) => slot.time === timeText(draft) && slot.status !== "Booked",
  );
  return {
    date: draft.date,
    start: draft.start,
    end: draft.end,
    priceCents: suggested ? Math.round(suggested.price * 100) : null,
    cleaningFeeCents: Math.round((venue.cleaningFee ?? 0) * 100),
    depositCents: Math.round((venue.deposit ?? 0) * 100),
  };
}
function projection(booking: ManagedSpaceBooking): ManagedSpaceBooking {
  const terms = booking.agreedTerms ?? booking.requestedTerms;
  const status: SpaceBooking["status"] =
    booking.phase === "Completed"
      ? "Completed"
      : booking.phase === "Cancelled" || booking.phase === "Declined"
        ? "Cancelled"
        : booking.agreedTerms
          ? "Upcoming"
          : "Requested";
  return {
    ...booking,
    status,
    date: terms.date,
    time: timeText(terms),
    price: (terms.priceCents ?? 0) / 100,
    proposal: booking.proposals.at(-1),
  };
}
function replaceBooking(
  state: SpaceBookingsState,
  booking: ManagedSpaceBooking,
): SpaceBookingsState {
  return {
    ...state,
    bookings: state.bookings.map((current) =>
      current.id === booking.id ? projection(booking) : current,
    ),
  };
}
function addHistory(
  booking: ManagedSpaceBooking,
  action: SpaceBookingHistory["action"],
  actor: string,
  now: Date,
  note?: string,
  proposalId?: string,
): ManagedSpaceBooking {
  return {
    ...booking,
    updatedAt: now.toISOString(),
    history: [
      ...booking.history,
      {
        id: `${booking.id}-event-${booking.history.length + 1}`,
        source: "local",
        at: now.toISOString(),
        actor,
        action,
        ...(note?.trim() ? { note: note.trim() } : {}),
        ...(proposalId ? { proposalId } : {}),
      },
    ],
  };
}
export function createSpaceBookingRequest(
  state: SpaceBookingsState,
  role: Role,
  venueId: number,
  spaceId: number,
  now = new Date(),
): {
  state: SpaceBookingsState;
  bookingId: string | null;
  errors: SpaceBookingRequestErrors;
  issue?: SpaceBookingIssue;
} {
  const draft = spaceBookingDraft(state, role, venueId, spaceId);
  const validation = validateSpaceBookingRequest(
    state,
    role,
    venueId,
    spaceId,
    draft,
    now,
  );
  if (
    validation.issue ||
    Object.keys(validation.errors).length ||
    !isSpaceBookingCustomer(role)
  )
    return { state, bookingId: null, ...validation };
  const venue = spaceBookingVenue(venueId)!;
  const space = spaceBookingUnit(venueId, spaceId)!;
  const id = `KSR-${state.nextId}`;
  const at = now.toISOString();
  const terms = spaceBookingRequestTerms(venueId, spaceId, draft)!;
  const booking: ManagedSpaceBooking = {
    id,
    code: id,
    source: "local",
    customerRole: role,
    customerName: customers[role],
    venueId,
    spaceId,
    venue: venue.name,
    space: `${space.name} — ${space.activity}`,
    image: space.image,
    date: terms.date,
    time: timeText(terms),
    price: (terms.priceCents ?? 0) / 100,
    participants: Number(draft.participants),
    notes: draft.notes.trim(),
    status: "Requested",
    phase: "Requested",
    requestedTerms: terms,
    proposals: [],
    history: [
      {
        id: `${id}-event-1`,
        source: "local",
        at,
        actor: customers[role],
        action: "requested",
      },
    ],
    createdAt: at,
    updatedAt: at,
  };
  const cleared = discardSpaceBookingDraft(state, role, venueId, spaceId);
  const next = {
    ...cleared,
    bookings: [booking, ...state.bookings],
    nextId: state.nextId + 1,
  };
  return {
    state: setView(next, role, { filter: "Requested", selectedId: id }),
    bookingId: id,
    errors: {},
  };
}
export function scopedSpaceBookings(
  state: SpaceBookingsState,
  role: Role,
): ManagedSpaceBooking[] {
  return state.bookings.filter((booking) => canRead(booking, role));
}
function defaultSpaceOperatorInboxView(): SpaceOperatorInboxView {
  return { query: "", filter: "pending", selectedId: null };
}

export function spaceOperatorInboxView(
  state: SpaceBookingsState,
  role: Role,
): SpaceOperatorInboxView {
  return role === "spaceOperator"
    ? { ...state.operatorInboxView }
    : defaultSpaceOperatorInboxView();
}

export function updateSpaceOperatorInboxView(
  state: SpaceBookingsState,
  role: Role,
  patch: Partial<SpaceOperatorInboxView>,
): SpaceBookingsState {
  if (role !== "spaceOperator" || !patch || typeof patch !== "object")
    return state;
  const current = state.operatorInboxView;
  const next = { ...current };
  if (typeof patch.query === "string") next.query = patch.query.slice(0, 200);
  if (
    patch.filter === "pending" ||
    patch.filter === "agreed" ||
    patch.filter === "history" ||
    patch.filter === "all"
  )
    next.filter = patch.filter;
  if (
    patch.selectedId === null ||
    (typeof patch.selectedId === "string" &&
      scopedSpaceBookings(state, role).some(
        (booking) => booking.id === patch.selectedId,
      ))
  )
    next.selectedId = patch.selectedId;
  return current.query === next.query &&
    current.filter === next.filter &&
    current.selectedId === next.selectedId
    ? state
    : { ...state, operatorInboxView: next };
}

/** Deliberate navigation reveals one owned record without changing booking data or drafts. */
export function revealSpaceOperatorBooking(
  state: SpaceBookingsState,
  role: Role,
  id: string,
): SpaceBookingsState {
  if (
    role !== "spaceOperator" ||
    !scopedSpaceBookings(state, role).some((booking) => booking.id === id)
  )
    return state;
  return updateSpaceOperatorInboxView(state, role, {
    query: "",
    filter: "all",
    selectedId: id,
  });
}

export function spaceBookingView(
  state: SpaceBookingsState,
  role: Role,
): SpaceBookingView {
  return role === "tenant"
    ? { filter: state.filter, selectedId: state.selectedId }
    : state.views[role];
}
function matchesFilter(
  booking: ManagedSpaceBooking,
  filter: SpaceBookingFilter,
) {
  return (
    filter === "All" ||
    (filter === "Declined"
      ? booking.phase === "Declined"
      : filter === "Cancelled"
        ? booking.phase === "Cancelled"
        : booking.status === filter && booking.phase !== "Declined")
  );
}
export function visibleSpaceBookings(
  state: SpaceBookingsState,
  role: Role = "tenant",
) {
  const view = spaceBookingView(state, role);
  return scopedSpaceBookings(state, role).filter((booking) =>
    matchesFilter(booking, view.filter),
  );
}
export function selectedSpaceBooking(
  state: SpaceBookingsState,
  role: Role = "tenant",
) {
  const visible = visibleSpaceBookings(state, role);
  return (
    visible.find(
      (booking) => booking.id === spaceBookingView(state, role).selectedId,
    ) ?? visible[0]
  );
}
function setView(
  state: SpaceBookingsState,
  role: Role,
  view: SpaceBookingView,
): SpaceBookingsState {
  return {
    ...state,
    ...(role === "tenant" ? view : {}),
    views: { ...state.views, [role]: view },
  };
}
export function filterSpaceBookings(
  state: SpaceBookingsState,
  filter: SpaceBookingFilter,
  role: Role = "tenant",
): SpaceBookingsState {
  if (
    ![
      "All",
      "Upcoming",
      "Requested",
      "Completed",
      "Cancelled",
      "Declined",
    ].includes(filter)
  )
    return state;
  const next = setView(state, role, {
    ...spaceBookingView(state, role),
    filter,
  });
  return setView(next, role, {
    filter,
    selectedId: selectedSpaceBooking(next, role)?.id ?? null,
  });
}
export function selectSpaceBooking(
  state: SpaceBookingsState,
  id: string,
  role: Role = "tenant",
): SpaceBookingsState {
  return visibleSpaceBookings(state, role).some((booking) => booking.id === id)
    ? setView(state, role, { ...spaceBookingView(state, role), selectedId: id })
    : state;
}
export function spaceBookingCounts(state: SpaceBookingsState, role: Role) {
  const bookings = scopedSpaceBookings(state, role);
  return {
    total: bookings.length,
    requested: bookings.filter((booking) => booking.phase === "Requested")
      .length,
    proposed: bookings.filter((booking) => booking.phase === "Proposed").length,
    agreed: bookings.filter(
      (booking) =>
        booking.agreedTerms &&
        !["Cancelled", "Declined", "Completed"].includes(booking.phase),
    ).length,
    completed: bookings.filter((booking) => booking.phase === "Completed")
      .length,
    cancelled: bookings.filter((booking) => booking.phase === "Cancelled")
      .length,
    declined: bookings.filter((booking) => booking.phase === "Declined").length,
  };
}
export function spaceBookingActionDraft(
  state: SpaceBookingsState,
  role: Role,
  id: string,
): SpaceBookingActionDraft {
  const blank = {
    date: "",
    start: "",
    end: "",
    price: "",
    cleaningFee: "",
    deposit: "",
    note: "",
  };
  const booking = scopedSpaceBookings(state, role).find(
    (item) => item.id === id,
  );
  if (!booking) return blank;
  const saved = state.actionDrafts[role][id];
  if (saved) return saved;
  const terms =
    booking.proposal?.proposedTerms ??
    booking.agreedTerms ??
    booking.requestedTerms;
  return {
    date: terms.date,
    start: terms.start,
    end: terms.end,
    price: terms.priceCents === null ? "" : (terms.priceCents / 100).toFixed(2),
    cleaningFee: (terms.cleaningFeeCents / 100).toFixed(2),
    deposit: (terms.depositCents / 100).toFixed(2),
    note: "",
  };
}
export function updateSpaceBookingActionDraft(
  state: SpaceBookingsState,
  role: Role,
  id: string,
  patch: Partial<SpaceBookingActionDraft>,
): SpaceBookingsState {
  const booking = scopedSpaceBookings(state, role).find(
    (item) => item.id === id,
  );
  if (
    !booking ||
    ["Cancelled", "Declined", "Completed"].includes(booking.phase)
  )
    return state;
  const draft = spaceBookingActionDraft(state, role, id);
  const next = { ...draft };
  let changed = false;
  for (const name of Object.keys(draft) as Array<
    keyof SpaceBookingActionDraft
  >) {
    if (name !== "note" && !operatorOwns(booking, role)) continue;
    const value = patch[name];
    if (typeof value === "string" && value !== draft[name]) {
      next[name] = value;
      changed = true;
    }
  }
  return changed
    ? {
        ...state,
        actionDrafts: {
          ...state.actionDrafts,
          [role]: { ...state.actionDrafts[role], [id]: next },
        },
      }
    : state;
}
export function validateSpaceBookingProposal(
  state: SpaceBookingsState,
  role: Role,
  id: string,
  draft: SpaceBookingActionDraft,
  now = new Date(),
): { errors: SpaceBookingProposalErrors; issue?: SpaceBookingIssue } {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking || !operatorOwns(booking, role))
    return { errors: {}, issue: "unavailable" };
  if (!["Requested", "Proposed", "Agreed"].includes(booking.phase))
    return { errors: {}, issue: "status" };
  const errors: SpaceBookingProposalErrors = rangeErrors(
    booking.venueId,
    draft,
    now,
  );
  if (moneyCents(draft.price) === null) errors.price = "price";
  if (moneyCents(draft.cleaningFee, true) === null)
    errors.cleaningFee = "cleaningFee";
  if (moneyCents(draft.deposit, true) === null) errors.deposit = "deposit";
  if (draft.note.trim().length < 3 || draft.note.trim().length > 2000)
    errors.note = "note";
  if (Object.keys(errors).length) return { errors };
  const terms = proposalTerms(draft);
  if (sameTerms(terms, booking.agreedTerms ?? booking.requestedTerms))
    return { errors, issue: "noChange" };
  if (
    booking.proposal?.status === "pending" &&
    sameTerms(terms, booking.proposal.proposedTerms)
  )
    return { errors, issue: "noChange" };
  if (spaceTimeBlockConflicts(state, booking.venueId, booking.spaceId, terms))
    return { errors, issue: "blocked" };
  if (spaceBookingConflicts(state, booking.venueId, booking.spaceId, terms, id))
    return { errors, issue: "conflict" };
  return { errors };
}
function proposalTerms(
  draft: SpaceBookingActionDraft,
): PricedSpaceBookingTerms {
  return {
    date: draft.date,
    start: draft.start,
    end: draft.end,
    priceCents: moneyCents(draft.price)!,
    cleaningFeeCents: moneyCents(draft.cleaningFee, true)!,
    depositCents: moneyCents(draft.deposit, true)!,
  };
}
export function saveSpaceBookingProposal(
  state: SpaceBookingsState,
  role: Role,
  id: string,
  now = new Date(),
): {
  state: SpaceBookingsState;
  errors: SpaceBookingProposalErrors;
  issue?: SpaceBookingIssue;
} {
  const draft = spaceBookingActionDraft(state, role, id);
  const validation = validateSpaceBookingProposal(state, role, id, draft, now);
  if (validation.issue || Object.keys(validation.errors).length)
    return { state, ...validation };
  const booking = state.bookings.find((item) => item.id === id)!;
  const version = booking.proposals.length + 1;
  const original = { ...(booking.agreedTerms ?? booking.requestedTerms) };
  const proposed = proposalTerms(draft);
  const proposal: SpaceBookingProposal = {
    id: `${id}-proposal-${version}`,
    version,
    originalTerms: original,
    proposedTerms: proposed,
    originalTime: timeText(original),
    proposedTime: timeText(proposed),
    status: "pending",
    createdAt: now.toISOString(),
    note: draft.note.trim(),
  };
  const proposals = booking.proposals.map((item) =>
    item.status === "pending"
      ? { ...item, status: "superseded" as const, decidedAt: now.toISOString() }
      : item,
  );
  const updated = {
    ...addHistory(
      booking,
      "proposed",
      spaceBookingVenue(booking.venueId)!.name,
      now,
      draft.note,
      proposal.id,
    ),
    phase: "Proposed" as const,
    proposals: [...proposals, proposal],
  };
  return { state: replaceBooking(state, updated), errors: {} };
}
function confirmedTermsIssue(
  state: SpaceBookingsState,
  booking: ManagedSpaceBooking,
  terms: SpaceBookingTerms,
  now: Date,
): SpaceBookingIssue | null {
  const ranges = rangeErrors(booking.venueId, terms, now);
  const first = Object.values(ranges)[0];
  if (first) return first;
  if (bookingTermsTotalCents(terms) === null) return "priceRequired";
  if (spaceTimeBlockConflicts(state, booking.venueId, booking.spaceId, terms))
    return "blocked";
  if (
    spaceBookingConflicts(
      state,
      booking.venueId,
      booking.spaceId,
      terms,
      booking.id,
    )
  )
    return "conflict";
  return null;
}
export function spaceBookingActionIssue(
  state: SpaceBookingsState,
  role: Role,
  id: string,
  action: SpaceBookingAction,
  now = new Date(),
): SpaceBookingIssue | null {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking) return "unavailable";
  if (action.type === "accept-request" || action.type === "decline-request") {
    if (!operatorOwns(booking, role)) return "unavailable";
    if (
      booking.agreedTerms ||
      !["Requested", "Proposed"].includes(booking.phase)
    )
      return "status";
    if (action.type === "decline-request")
      return action.note.trim().length >= 3 && action.note.trim().length <= 2000
        ? null
        : "note";
    if (booking.proposal?.status === "pending") return "status";
    return confirmedTermsIssue(state, booking, booking.requestedTerms, now);
  }
  if (!customerOwns(booking, role)) return "unavailable";
  if (action.type === "cancel")
    return ["Requested", "Proposed", "Agreed"].includes(booking.phase)
      ? action.note && action.note.trim().length > 500
        ? "note"
        : null
      : "status";
  const proposal = booking.proposals.at(-1);
  if (!["Requested", "Proposed", "Agreed"].includes(booking.phase))
    return "status";
  if (
    !proposal ||
    proposal.status !== "pending" ||
    proposal.id !== action.proposalId
  )
    return "staleProposal";
  if (action.type === "keep-original") return null;
  return confirmedTermsIssue(state, booking, proposal.proposedTerms, now);
}
function clearActionNote(
  state: SpaceBookingsState,
  role: Role,
  id: string,
): SpaceBookingsState {
  const draft = state.actionDrafts[role][id];
  return draft
    ? {
        ...state,
        actionDrafts: {
          ...state.actionDrafts,
          [role]: { ...state.actionDrafts[role], [id]: { ...draft, note: "" } },
        },
      }
    : state;
}
export function actOnSpaceBooking(
  state: SpaceBookingsState,
  role: Role,
  id: string,
  action: SpaceBookingAction,
  now = new Date(),
): SpaceBookingsState {
  if (spaceBookingActionIssue(state, role, id, action, now)) return state;
  const booking = state.bookings.find((item) => item.id === id)!;
  const actor =
    role === "spaceOperator"
      ? spaceBookingVenue(booking.venueId)!.name
      : customers[role as SpaceBookingCustomerRole];
  let updated: ManagedSpaceBooking;
  if (action.type === "accept-request")
    updated = {
      ...addHistory(booking, "accepted", actor, now),
      phase: "Agreed",
      agreedTerms: { ...booking.requestedTerms } as PricedSpaceBookingTerms,
    };
  else if (action.type === "decline-request" || action.type === "cancel") {
    updated = {
      ...addHistory(
        booking,
        action.type === "cancel" ? "cancelled" : "declined",
        actor,
        now,
        action.note,
      ),
      phase: action.type === "cancel" ? "Cancelled" : "Declined",
      ...(action.type === "cancel"
        ? { cancellationReason: action.note?.trim() ?? "" }
        : { declineReason: action.note.trim() }),
      proposals: booking.proposals.map((proposal) =>
        proposal.status === "pending"
          ? { ...proposal, status: "withdrawn", decidedAt: now.toISOString() }
          : proposal,
      ),
    };
  } else {
    const accepted = action.type === "accept-proposal";
    const proposal = booking.proposals.at(-1)!;
    updated = {
      ...addHistory(
        booking,
        accepted ? "proposal-accepted" : "proposal-declined",
        actor,
        now,
        undefined,
        proposal.id,
      ),
      phase: accepted || booking.agreedTerms ? "Agreed" : "Requested",
      ...(accepted ? { agreedTerms: { ...proposal.proposedTerms } } : {}),
      proposals: booking.proposals.map((item) =>
        item.id === proposal.id
          ? {
              ...item,
              status: accepted ? "accepted" : "declined",
              decidedAt: now.toISOString(),
            }
          : item,
      ),
    };
  }
  let next = clearActionNote(replaceBooking(state, updated), role, id);
  const currentView = spaceBookingView(next, role);
  const projected = next.bookings.find((item) => item.id === id)!;
  const filter: SpaceBookingFilter =
    currentView.filter === "All"
      ? "All"
      : projected.phase === "Declined"
        ? "Declined"
        : projected.status;
  next = setView(next, role, { filter, selectedId: id });
  return next;
}

/** Compatibility wrappers for the original tenant UI. New callers pass explicit roles and proposal IDs. */
export function acceptSpaceBookingProposal(
  state: SpaceBookingsState,
  id: string,
  role: Role = "tenant",
  proposalId?: string,
  now = new Date(),
): SpaceBookingsState {
  const proposal = state.bookings
    .find((item) => item.id === id)
    ?.proposals.at(-1);
  return proposal
    ? actOnSpaceBooking(
        state,
        role,
        id,
        { type: "accept-proposal", proposalId: proposalId ?? proposal.id },
        now,
      )
    : state;
}
export function keepOriginalSpaceBookingRequest(
  state: SpaceBookingsState,
  id: string,
  role: Role = "tenant",
  proposalId?: string,
  now = new Date(),
): SpaceBookingsState {
  const proposal = state.bookings
    .find((item) => item.id === id)
    ?.proposals.at(-1);
  return proposal
    ? actOnSpaceBooking(
        state,
        role,
        id,
        { type: "keep-original", proposalId: proposalId ?? proposal.id },
        now,
      )
    : state;
}
export function cancelSpaceBooking(
  state: SpaceBookingsState,
  id: string,
  reason: string,
  role: Role = "tenant",
  now = new Date(),
): SpaceBookingsState {
  return actOnSpaceBooking(
    state,
    role,
    id,
    { type: "cancel", note: reason.trim().slice(0, 500) },
    now,
  );
}

export function createInitialSpaceBookingsState(
  now = new Date(),
): SpaceBookingsState {
  const future = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return spaceBookingDateValue(date);
  };
  const metadata: Record<
    string,
    { venueId: number; spaceId: number; date: string; participants: number }
  > = {
    "KS-7M52X": { venueId: 1, spaceId: 11, date: future(2), participants: 4 },
    "KS-2P18A": { venueId: 2, spaceId: 21, date: future(-7), participants: 4 },
    "KS-9H31C": { venueId: 4, spaceId: 41, date: future(7), participants: 80 },
  };
  const bookings: ManagedSpaceBooking[] = spaceBookings.flatMap((seed) => {
    const meta = metadata[seed.id];
    if (!meta) return [];
    const venue = spaceBookingVenue(meta.venueId)!;
    const [start, end] = seed.time.split("–");
    const at = now.toISOString();
    const requestedTerms: PricedSpaceBookingTerms = {
      date: meta.date,
      start,
      end,
      priceCents: Math.round(seed.price * 100),
      cleaningFeeCents: Math.round((venue.cleaningFee ?? 0) * 100),
      depositCents: Math.round((venue.deposit ?? 0) * 100),
    };
    let booking: ManagedSpaceBooking = {
      ...seed,
      ...meta,
      source: "sample",
      customerRole: "tenant",
      customerName: customers.tenant,
      notes: "",
      requestedTerms,
      ...(seed.status !== "Requested"
        ? { agreedTerms: { ...requestedTerms } }
        : {}),
      phase:
        seed.status === "Requested"
          ? "Requested"
          : seed.status === "Completed"
            ? "Completed"
            : "Agreed",
      proposals: [],
      history: [
        {
          id: `${seed.id}-event-1`,
          source: "sample",
          at,
          actor: customers.tenant,
          action: "requested",
        },
      ],
      createdAt: at,
      updatedAt: at,
    };
    if (seed.status === "Upcoming" || seed.status === "Completed")
      booking = addHistory(booking, "accepted", venue.name, now);
    if (seed.status === "Completed")
      booking = addHistory(booking, "completed", venue.name, now);
    if (seed.id === "KS-9H31C") {
      const proposedTerms = { ...requestedTerms, start: "18:30" };
      const proposal: SpaceBookingProposal = {
        id: `${seed.id}-proposal-1`,
        version: 1,
        originalTerms: { ...requestedTerms },
        proposedTerms,
        originalTime: seed.time,
        proposedTime: timeText(proposedTerms),
        status: "pending",
        createdAt: at,
        note: "The operator proposes a later start, within its closing time.",
      };
      booking = {
        ...addHistory(
          booking,
          "proposed",
          venue.name,
          now,
          proposal.note,
          proposal.id,
        ),
        phase: "Proposed",
        proposals: [proposal],
      };
    }
    return [
      projection({
        ...booking,
        history: booking.history.map((event) => ({
          ...event,
          source: "sample",
        })),
      }),
    ];
  });
  const selectedId =
    bookings.find((booking) => booking.status === "Upcoming")?.id ?? null;
  return {
    bookings,
    filter: "Upcoming",
    selectedId,
    views: {
      tenant: { filter: "Upcoming", selectedId },
      landlord: { filter: "All", selectedId: null },
      spaceOperator: { filter: "All", selectedId: null },
      provider: { filter: "All", selectedId: null },
      admin: { filter: "All", selectedId: null },
    },
    operatorInboxView: defaultSpaceOperatorInboxView(),
    requestDrafts: { tenant: {}, landlord: {} },
    actionDrafts: {
      tenant: {},
      landlord: {},
      spaceOperator: {},
      provider: {},
      admin: {},
    },
    nextId: 1,
    timeBlocks: [],
    timeBlockDrafts: {},
    scheduleView: {
      venueId: 1,
      spaceId: 11,
      date: spaceBookingDateValue(now),
    },
    removedTimeBlockId: null,
    nextTimeBlockId: 1,
  };
}
