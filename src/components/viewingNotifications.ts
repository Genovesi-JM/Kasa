import { properties } from "../data";
import type { Role } from "../types";
import {
  sortNotificationActivity,
  type KasaNotification,
  type NotificationState,
  type ViewingNotificationEvent,
} from "./notificationState";
import {
  scopedViewingRequests,
  selectViewingRequest,
  type PropertyRequestState,
  type ViewingHistoryEvent,
  type ViewingProposal,
  type ViewingRequest,
  type ViewingTerms,
} from "./propertyRequestState";

type RecordedViewingNotification = KasaNotification & {
  role: "tenant" | "landlord";
  viewingEvent: ViewingNotificationEvent;
};

function validTimestamp(value: string): boolean {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

/** Historical terms are calendar values; an elapsed appointment remains evidence. */
function validTerms(terms: ViewingTerms | undefined): terms is ViewingTerms {
  if (
    !terms ||
    typeof terms.date !== "string" ||
    typeof terms.time !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(terms.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(terms.time)
  )
    return false;
  const [year, month, day] = terms.date.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  );
}

function sameTerms(
  left: ViewingTerms | undefined,
  right: ViewingTerms | undefined,
): boolean {
  return left === undefined || right === undefined
    ? left === right
    : validTerms(left) &&
        validTerms(right) &&
        left.date === right.date &&
        left.time === right.time;
}

function validHistoryEvent(event: ViewingHistoryEvent): boolean {
  return (
    typeof event.id === "string" &&
    Boolean(event.id.trim()) &&
    (event.source === undefined ||
      event.source === "local" ||
      event.source === "sample") &&
    validTimestamp(event.at)
  );
}

/** Identical copies identify one event; conflicting copies cannot prove an action. */
function distinctHistory(
  request: ViewingRequest,
): ViewingHistoryEvent[] | null {
  const events = new Map<string, ViewingHistoryEvent>();
  for (const event of request.history) {
    const previous = events.get(event.id);
    if (
      previous &&
      (previous.source !== event.source ||
        previous.action !== event.action ||
        previous.actor !== event.actor ||
        previous.at !== event.at ||
        previous.note !== event.note ||
        previous.proposalId !== event.proposalId ||
        !sameTerms(previous.terms, event.terms))
    )
      return null;
    if (!previous) events.set(event.id, event);
  }
  return [...events.values()];
}

function requestedEvent(
  request: ViewingRequest,
  history: ViewingHistoryEvent[],
): ViewingHistoryEvent | null {
  const events = history.filter((event) => event.action === "requested");
  if (events.length !== 1) return null;
  const [event] = events;
  return validHistoryEvent(event) &&
    history[0] === event &&
    event.actor === "tenant" &&
    event.at === request.createdAt &&
    event.proposalId === undefined &&
    event.note === request.note &&
    validTerms(request.requestedTerms) &&
    sameTerms(event.terms, request.requestedTerms)
    ? event
    : null;
}

function recordedProposal(
  request: ViewingRequest,
  proposalId: string | undefined,
  history: ViewingHistoryEvent[],
): { proposal: ViewingProposal; event: ViewingHistoryEvent } | null {
  if (typeof proposalId !== "string") return null;
  const matches = request.proposals.filter(
    (proposal) => proposal.id === proposalId,
  );
  if (matches.length !== 1) return null;
  const [proposal] = matches;
  if (
    !Number.isSafeInteger(proposal.version) ||
    proposal.version < 1 ||
    proposal.id !== `${request.id}-proposal-${proposal.version}` ||
    request.proposals.filter((item) => item.version === proposal.version)
      .length !== 1 ||
    !validTimestamp(proposal.createdAt) ||
    !validTerms(proposal.terms)
  )
    return null;
  const events = history.filter(
    (event) => event.action === "proposed" && event.proposalId === proposal.id,
  );
  if (events.length !== 1) return null;
  const [event] = events;
  return validHistoryEvent(event) &&
    history.indexOf(event) > 0 &&
    event.actor === "landlord" &&
    event.at === proposal.createdAt &&
    event.note === proposal.note &&
    sameTerms(event.terms, proposal.terms)
    ? { proposal, event }
    : null;
}

function recordedEvent(
  request: ViewingRequest,
  event: ViewingHistoryEvent,
  history: ViewingHistoryEvent[],
  original: ViewingHistoryEvent,
): {
  role: RecordedViewingNotification["role"];
  kind: ViewingNotificationEvent["kind"];
} | null {
  if (!validHistoryEvent(event) || event.source !== "local") return null;
  if (event === original)
    return { role: "landlord", kind: "request-submitted" };
  if (history.indexOf(event) <= history.indexOf(original)) return null;

  if (
    event.action === "proposed" ||
    event.action === "proposal-accepted" ||
    event.action === "proposal-declined"
  ) {
    const source = recordedProposal(request, event.proposalId, history);
    if (!source) return null;
    if (event.action === "proposed")
      return source.event === event
        ? { role: "tenant", kind: "proposal-recorded" }
        : null;
    const accepted = event.action === "proposal-accepted";
    if (
      event.actor !== "tenant" ||
      history.indexOf(source.event) >= history.indexOf(event) ||
      source.proposal.status !== (accepted ? "Accepted" : "Declined") ||
      source.proposal.decidedAt !== event.at ||
      !sameTerms(event.terms, source.proposal.terms) ||
      history.filter(
        (item) =>
          (item.action === "proposal-accepted" ||
            item.action === "proposal-declined") &&
          item.proposalId === source.proposal.id,
      ).length !== 1
    )
      return null;
    return {
      role: "landlord",
      kind: accepted ? "proposal-accepted" : "proposal-declined",
    };
  }

  if (
    event.action === "accepted" &&
    event.actor === "landlord" &&
    event.proposalId === undefined &&
    sameTerms(event.terms, request.requestedTerms) &&
    validTerms(request.agreedTerms) &&
    ["Agreed", "Proposed", "Cancelled"].includes(request.status) &&
    history.filter((item) => item.action === "accepted").length === 1 &&
    !history
      .slice(0, history.indexOf(event))
      .some((item) => item.action === "proposal-accepted")
  )
    // A later agreement can change current terms without undoing this original acceptance.
    return { role: "tenant", kind: "request-accepted" };

  if (
    (event.action === "declined" || event.action === "cancelled") &&
    event.proposalId === undefined &&
    event.terms === undefined &&
    history.at(-1) === event &&
    request.updatedAt === event.at &&
    history.filter(
      (item) => item.action === "declined" || item.action === "cancelled",
    ).length === 1
  ) {
    if (
      event.action === "declined" &&
      event.actor === "landlord" &&
      request.status === "Declined" &&
      !request.agreedTerms &&
      !history.some(
        (item) =>
          item.action === "accepted" || item.action === "proposal-accepted",
      )
    )
      return { role: "tenant", kind: "request-declined" };
    if (
      event.action === "cancelled" &&
      request.status === "Cancelled" &&
      (event.actor === "tenant" || event.actor === "landlord")
    )
      return {
        role: event.actor === "tenant" ? "landlord" : "tenant",
        kind: "request-cancelled",
      };
  }
  return null;
}

/** Only activity shared by the canonical tenant and property owner enters this feed. */
function projectViewingNotifications(
  state: PropertyRequestState,
): RecordedViewingNotification[] {
  const tenantRecords = new Set(scopedViewingRequests(state, "tenant"));
  const projected = new Map<string, RecordedViewingNotification>();
  for (const request of scopedViewingRequests(state, "landlord")) {
    if (
      !tenantRecords.has(request) ||
      typeof request.id !== "string" ||
      !request.id.trim() ||
      !validTimestamp(request.createdAt) ||
      !validTimestamp(request.updatedAt) ||
      state.viewings.filter((record) => record.id === request.id).length !== 1
    )
      continue;
    const property = properties.find((item) => item.id === request.propertyId);
    const history = distinctHistory(request);
    const original = history && requestedEvent(request, history);
    if (
      !property ||
      !history ||
      !original ||
      history.at(-1)?.at !== request.updatedAt
    )
      continue;
    for (const event of history) {
      const target = recordedEvent(request, event, history, original);
      if (!target) continue;
      const id = `viewing:${JSON.stringify([target.role, request.id, event.id])}`;
      projected.set(id, {
        id,
        role: target.role,
        icon: "calendar",
        destination: "viewings",
        // Viewing-aware UI supplies the event heading and the recorded timestamp.
        titleKey: "nav.viewings",
        noteKey: "common.properties",
        timeKey: "universalHome.yourUpdates",
        read: false,
        viewingEvent: {
          kind: target.kind,
          requestId: request.id,
          propertyTitle: property.title,
          occurredAt: event.at,
        },
      });
    }
  }
  return [...projected.values()];
}

function isViewingProjection(item: KasaNotification): boolean {
  return Boolean(item.viewingEvent) || item.id.startsWith("viewing:");
}

function sameProjection(
  existing: KasaNotification,
  next: RecordedViewingNotification,
): boolean {
  if (!existing.viewingEvent) return false;
  return (
    Object.keys(existing).length === Object.keys(next).length &&
    Object.keys(existing.viewingEvent).length ===
      Object.keys(next.viewingEvent).length &&
    existing.id === next.id &&
    existing.role === next.role &&
    existing.icon === next.icon &&
    existing.destination === next.destination &&
    existing.titleKey === next.titleKey &&
    existing.noteKey === next.noteKey &&
    existing.timeKey === next.timeKey &&
    existing.read === next.read &&
    existing.viewingEvent.kind === next.viewingEvent.kind &&
    existing.viewingEvent.requestId === next.viewingEvent.requestId &&
    existing.viewingEvent.propertyTitle === next.viewingEvent.propertyTitle &&
    existing.viewingEvent.occurredAt === next.viewingEvent.occurredAt
  );
}

/** Rebuild only viewing activity, preserving read receipts and other notification sources. */
export function reconcileViewingNotifications(
  notifications: NotificationState,
  viewingState: PropertyRequestState,
): NotificationState {
  const previous = new Map<string, KasaNotification>();
  for (const item of notifications.items) {
    if (!isViewingProjection(item)) continue;
    const key = JSON.stringify([item.role, item.id]);
    const stored = previous.get(key);
    if (!stored || (!stored.read && item.read)) previous.set(key, item);
  }
  const projected = projectViewingNotifications(viewingState).map((item) => {
    const stored = previous.get(JSON.stringify([item.role, item.id]));
    const next = { ...item, read: stored?.read === true };
    return stored && sameProjection(stored, next) ? stored : next;
  });
  const sorted = sortNotificationActivity({
    ...notifications,
    items: [
      ...projected,
      ...notifications.items.filter((item) => !isViewingProjection(item)),
    ],
  });
  return sorted.items.length === notifications.items.length &&
    sorted.items.every((item, index) => item === notifications.items[index])
    ? notifications
    : sorted;
}

/** Resolve the source again; a notification opens its current record without applying an action. */
export function openViewingNotification(
  viewingState: PropertyRequestState,
  role: Role,
  notification: KasaNotification,
): { state: PropertyRequestState; requestId: string } | null {
  if (!notification.viewingEvent || notification.role !== role) return null;
  const source = projectViewingNotifications(viewingState).find(
    (item) => item.id === notification.id && item.role === role,
  );
  if (!source) return null;
  const requestId = source.viewingEvent.requestId;
  return {
    state: selectViewingRequest(viewingState, role, requestId),
    requestId,
  };
}
