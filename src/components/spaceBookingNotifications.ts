import type { Role } from "../types";
import {
  sortNotificationActivity,
  type KasaNotification,
  type NotificationState,
  type SpaceBookingNotificationEvent,
} from "./notificationState";
import {
  bookingTermsTotalCents,
  filterSpaceBookings,
  isSpaceBookingCustomer,
  revealSpaceOperatorBooking,
  scopedSpaceBookings,
  selectSpaceBooking,
  spaceBookingEndTimestamp,
  spaceBookingUnit,
  spaceBookingVenue,
  type ManagedSpaceBooking,
  type SpaceBookingCustomerRole,
  type SpaceBookingHistory,
  type SpaceBookingTerms,
  type SpaceBookingsState,
} from "./spaceBookingsState";

type RecordedSpaceBookingNotification = KasaNotification & {
  role: SpaceBookingCustomerRole | "spaceOperator";
  spaceBookingEvent: SpaceBookingNotificationEvent;
};

function validHistoryEvent(event: SpaceBookingHistory): boolean {
  if (
    typeof event.id !== "string" ||
    !event.id.trim() ||
    typeof event.at !== "string" ||
    (event.source !== "local" && event.source !== "sample")
  )
    return false;
  const date = new Date(event.at);
  return Number.isFinite(date.getTime()) && date.toISOString() === event.at;
}

/** An identical repeated event is harmless; conflicting copies cannot identify one action. */
function distinctHistory(
  booking: ManagedSpaceBooking,
): SpaceBookingHistory[] | null {
  const events = new Map<string, SpaceBookingHistory>();
  for (const event of booking.history) {
    const previous = events.get(event.id);
    if (
      previous &&
      (previous.source !== event.source ||
        previous.action !== event.action ||
        previous.actor !== event.actor ||
        previous.at !== event.at ||
        previous.proposalId !== event.proposalId ||
        previous.note !== event.note)
    )
      return null;
    if (!previous) events.set(event.id, event);
  }
  return [...events.values()];
}

function sameTerms(left: SpaceBookingTerms, right: SpaceBookingTerms): boolean {
  return (
    left.date === right.date &&
    left.start === right.start &&
    left.end === right.end &&
    left.priceCents === right.priceCents &&
    left.cleaningFeeCents === right.cleaningFeeCents &&
    left.depositCents === right.depositCents
  );
}

function recordedCompletion(
  booking: ManagedSpaceBooking,
  event: SpaceBookingHistory,
  history: SpaceBookingHistory[],
  operatorName: string,
): boolean {
  const terms = booking.agreedTerms;
  if (
    booking.phase !== "Completed" ||
    !terms ||
    event.actor !== operatorName ||
    event.proposalId !== undefined ||
    event.at !== booking.updatedAt ||
    history.at(-1) !== event ||
    history.filter((source) => source.action === "completed").length !== 1 ||
    booking.proposals.some((proposal) => proposal.status === "pending") ||
    bookingTermsTotalCents(terms) === null ||
    !(spaceBookingEndTimestamp(terms) <= Date.parse(event.at))
  )
    return false;
  const agreement = history
    .filter(
      (source) =>
        source.action === "accepted" || source.action === "proposal-accepted",
    )
    .at(-1);
  const request = history.find(
    (source) =>
      validHistoryEvent(source) &&
      source.action === "requested" &&
      source.actor === booking.customerName &&
      source.at === booking.createdAt &&
      source.proposalId === undefined,
  );
  if (
    !agreement ||
    !request ||
    !validHistoryEvent(agreement) ||
    history.indexOf(request) >= history.indexOf(agreement) ||
    history.indexOf(agreement) >= history.indexOf(event)
  )
    return false;
  if (agreement.action === "accepted")
    return (
      agreement.actor === operatorName &&
      agreement.proposalId === undefined &&
      sameTerms(booking.requestedTerms, terms)
    );
  const proposals = booking.proposals.filter(
    (proposal) => proposal.id === agreement.proposalId,
  );
  if (proposals.length !== 1) return false;
  const [proposal] = proposals;
  return (
    agreement.actor === booking.customerName &&
    proposal.status === "accepted" &&
    proposal.decidedAt === agreement.at &&
    Number.isSafeInteger(proposal.version) &&
    proposal.version > 0 &&
    proposal.id === `${booking.id}-proposal-${proposal.version}` &&
    sameTerms(proposal.proposedTerms, terms) &&
    history.some(
      (source, index) =>
        validHistoryEvent(source) &&
        source.action === "proposed" &&
        source.actor === operatorName &&
        source.proposalId === proposal.id &&
        source.at === proposal.createdAt &&
        index < history.indexOf(agreement),
    )
  );
}

function recordedEvent(
  booking: ManagedSpaceBooking,
  event: SpaceBookingHistory,
  history: SpaceBookingHistory[],
  operatorName: string,
): {
  role: RecordedSpaceBookingNotification["role"];
  kind: SpaceBookingNotificationEvent["kind"];
} | null {
  if (!validHistoryEvent(event) || event.source !== "local") return null;
  const customer = event.actor === booking.customerName;
  const operator = event.actor === operatorName;
  if (
    event.action === "requested" &&
    booking.source === "local" &&
    customer &&
    event.at === booking.createdAt &&
    event.proposalId === undefined
  )
    return { role: "spaceOperator", kind: "request-submitted" };

  if (
    event.action === "proposed" ||
    event.action === "proposal-accepted" ||
    event.action === "proposal-declined"
  ) {
    const proposals = booking.proposals.filter(
      (proposal) => proposal.id === event.proposalId,
    );
    if (proposals.length !== 1) return null;
    const [proposal] = proposals;
    if (
      !Number.isSafeInteger(proposal.version) ||
      proposal.version < 1 ||
      proposal.id !== `${booking.id}-proposal-${proposal.version}`
    )
      return null;
    if (event.action === "proposed")
      return operator && event.at === proposal.createdAt
        ? { role: booking.customerRole, kind: "proposal-recorded" }
        : null;

    const recordedProposal = history.find(
      (source) =>
        validHistoryEvent(source) &&
        source.action === "proposed" &&
        source.actor === operatorName &&
        source.proposalId === proposal.id &&
        source.at === proposal.createdAt,
    );
    const accepted = event.action === "proposal-accepted";
    if (
      !customer ||
      !recordedProposal ||
      history.indexOf(recordedProposal) >= history.indexOf(event) ||
      proposal.status !== (accepted ? "accepted" : "declined") ||
      proposal.decidedAt !== event.at
    )
      return null;
    return {
      role: "spaceOperator",
      kind: accepted ? "proposal-accepted" : "proposal-declined",
    };
  }

  if (
    event.action === "accepted" &&
    operator &&
    event.proposalId === undefined &&
    booking.agreedTerms &&
    bookingTermsTotalCents(booking.requestedTerms) !== null
  )
    // The original acceptance remains historical after a later proposal changes agreed terms.
    return { role: booking.customerRole, kind: "request-accepted" };
  if (
    event.action === "declined" &&
    operator &&
    event.proposalId === undefined &&
    booking.phase === "Declined" &&
    booking.updatedAt === event.at
  )
    return { role: booking.customerRole, kind: "request-declined" };
  if (
    event.action === "cancelled" &&
    customer &&
    event.proposalId === undefined &&
    booking.phase === "Cancelled" &&
    booking.updatedAt === event.at
  )
    return { role: "spaceOperator", kind: "request-cancelled" };
  if (
    event.action === "completed" &&
    recordedCompletion(booking, event, history, operatorName)
  )
    return { role: booking.customerRole, kind: "booking-completed" };
  return null;
}

/** Only activity shared by the canonical customer and venue operator can enter the feed. */
function projectSpaceBookingNotifications(
  bookings: SpaceBookingsState,
): RecordedSpaceBookingNotification[] {
  const customers = {
    tenant: new Set(scopedSpaceBookings(bookings, "tenant")),
    landlord: new Set(scopedSpaceBookings(bookings, "landlord")),
  };
  const projected = new Map<string, RecordedSpaceBookingNotification>();
  for (const booking of scopedSpaceBookings(bookings, "spaceOperator")) {
    if (
      !isSpaceBookingCustomer(booking.customerRole) ||
      !customers[booking.customerRole].has(booking) ||
      (booking.source !== "local" && booking.source !== "sample")
    )
      continue;
    const venue = spaceBookingVenue(booking.venueId);
    const space = spaceBookingUnit(booking.venueId, booking.spaceId);
    const history = distinctHistory(booking);
    if (!venue || !space || !history) continue;
    for (const event of history) {
      const target = recordedEvent(booking, event, history, venue.name);
      if (!target) continue;
      const id = `space-booking:${JSON.stringify([target.role, booking.id, event.id])}`;
      if (projected.has(id)) continue;
      projected.set(id, {
        id,
        role: target.role,
        icon: "calendar",
        destination:
          target.role === "spaceOperator" ? "spaceOperator" : "spaceBookings",
        // Spaces-aware UI supplies its own event heading, canonical labels and actual timestamp.
        titleKey: "shell.newCourtBooking",
        noteKey: "nav.venueDashboard",
        timeKey: "universalHome.yourUpdates",
        read: false,
        spaceBookingEvent: {
          kind: target.kind,
          bookingId: booking.id,
          venueName: venue.name,
          spaceName: space.name,
          occurredAt: event.at,
        },
      });
    }
  }
  return [...projected.values()];
}

function isSpaceBookingProjection(item: KasaNotification): boolean {
  return (
    Boolean(item.spaceBookingEvent) || item.id.startsWith("space-booking:")
  );
}

function sameProjection(
  existing: KasaNotification,
  next: RecordedSpaceBookingNotification,
): boolean {
  if (!existing.spaceBookingEvent) return false;
  return (
    Object.keys(existing).length === Object.keys(next).length &&
    Object.keys(existing.spaceBookingEvent).length ===
      Object.keys(next.spaceBookingEvent).length &&
    existing.id === next.id &&
    existing.role === next.role &&
    existing.icon === next.icon &&
    existing.destination === next.destination &&
    existing.titleKey === next.titleKey &&
    existing.noteKey === next.noteKey &&
    existing.timeKey === next.timeKey &&
    existing.read === next.read &&
    existing.spaceBookingEvent.kind === next.spaceBookingEvent.kind &&
    existing.spaceBookingEvent.bookingId === next.spaceBookingEvent.bookingId &&
    existing.spaceBookingEvent.venueName === next.spaceBookingEvent.venueName &&
    existing.spaceBookingEvent.spaceName === next.spaceBookingEvent.spaceName &&
    existing.spaceBookingEvent.occurredAt === next.spaceBookingEvent.occurredAt
  );
}

/** Preserve receipts and other activity while rebuilding only genuine Spaces events. */
export function reconcileSpaceBookingNotifications(
  notifications: NotificationState,
  bookings: SpaceBookingsState,
): NotificationState {
  const previous = new Map<string, KasaNotification>();
  for (const item of notifications.items) {
    if (!isSpaceBookingProjection(item)) continue;
    const key = JSON.stringify([item.role, item.id]);
    const stored = previous.get(key);
    if (!stored || (!stored.read && item.read)) previous.set(key, item);
  }
  const projected = projectSpaceBookingNotifications(bookings).map((item) => {
    const stored = previous.get(JSON.stringify([item.role, item.id]));
    const next = { ...item, read: stored?.read === true };
    return stored && sameProjection(stored, next) ? stored : next;
  });
  const sorted = sortNotificationActivity({
    ...notifications,
    items: [
      ...projected,
      ...notifications.items.filter((item) => !isSpaceBookingProjection(item)),
    ],
  });
  return sorted.items.length === notifications.items.length &&
    sorted.items.every((item, index) => item === notifications.items[index])
    ? notifications
    : sorted;
}

/** Resolve the source again; a feed payload cannot choose another booking or perform an action. */
export function openSpaceBookingNotification(
  bookings: SpaceBookingsState,
  role: Role,
  notification: KasaNotification,
): {
  state: SpaceBookingsState;
  destination: "spaceOperator" | "spaceBookings";
} | null {
  if (!notification.spaceBookingEvent || notification.role !== role)
    return null;
  const source = projectSpaceBookingNotifications(bookings).find(
    (item) => item.id === notification.id && item.role === role,
  );
  if (!source) return null;
  const id = source.spaceBookingEvent.bookingId;
  if (role === "spaceOperator")
    return {
      state: revealSpaceOperatorBooking(bookings, role, id),
      destination: "spaceOperator",
    };
  if (!isSpaceBookingCustomer(role)) return null;
  return {
    state: selectSpaceBooking(
      filterSpaceBookings(bookings, "All", role),
      id,
      role,
    ),
    destination: "spaceBookings",
  };
}
