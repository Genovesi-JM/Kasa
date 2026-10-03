import { properties } from "../data";
import type { Role } from "../types";
import {
  revealApplication,
  visibleApplicationRecords,
  type ApplicationActivityEvent,
  type ApplicationEvidenceRequest,
  type ApplicationEvidenceResponse,
  type ApplicationRecord,
  type ApplicationState,
} from "./applicationState";
import {
  sortNotificationActivity,
  type KasaNotification,
  type NotificationState,
  type RentalApplicationNotificationEvent,
} from "./notificationState";

type RecordedApplicationNotification = KasaNotification & {
  role: "tenant" | "landlord";
  rentalApplicationEvent: RentalApplicationNotificationEvent;
};

function validTimestamp(value: string): boolean {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

/** Legacy labels are display copy, never evidence that a local action occurred. */
function distinctActivity(
  record: ApplicationRecord,
): ApplicationActivityEvent[] | null {
  const events = new Map<string, ApplicationActivityEvent>();
  for (const event of record.activity) {
    const previous = events.get(event.id);
    if (
      previous &&
      (previous.source !== event.source ||
        previous.actor !== event.actor ||
        previous.action !== event.action ||
        previous.at !== event.at ||
        previous.requestId !== event.requestId ||
        previous.responseId !== event.responseId)
    )
      return null;
    if (!previous) events.set(event.id, event);
  }
  return [...events.values()];
}

function evidenceRequest(
  record: ApplicationRecord,
  id: string,
): ApplicationEvidenceRequest | null {
  const requests = record.evidenceRequests ?? [];
  const matches = requests.filter((request) => request.id === id);
  if (matches.length !== 1) return null;
  const [request] = matches;
  if (
    !validTimestamp(request.createdAt) ||
    !Number.isSafeInteger(request.version) ||
    request.version < 1 ||
    request.id !== `evidence-request-${record.id}-${request.version}` ||
    requests.filter((item) => item.version === request.version).length !== 1 ||
    !request.documentIds.length ||
    new Set(request.documentIds).size !== request.documentIds.length ||
    request.documentIds.some(
      (documentId) =>
        !record.documents.some((document) => document.id === documentId),
    )
  )
    return null;
  return request;
}

function evidenceResponse(
  record: ApplicationRecord,
  id: string,
): ApplicationEvidenceResponse | null {
  const responses = record.evidenceResponses ?? [];
  const matches = responses.filter((response) => response.id === id);
  if (matches.length !== 1) return null;
  const [response] = matches;
  if (
    !Number.isSafeInteger(response.version) ||
    response.version < 1 ||
    response.id !==
      `application-evidence-response-${record.id}-${response.version}` ||
    responses.filter((item) => item.version === response.version).length !==
      1 ||
    (!response.files.length && response.note.trim().length < 3) ||
    (response.requestId !== null &&
      !evidenceRequest(record, response.requestId))
  )
    return null;
  return response;
}

function recordedEvent(
  record: ApplicationRecord,
  event: ApplicationActivityEvent,
  activity: ApplicationActivityEvent[],
): {
  role: RecordedApplicationNotification["role"];
  kind: RentalApplicationNotificationEvent["kind"];
} | null {
  if (
    event.source !== "local" ||
    typeof event.id !== "string" ||
    !event.id.trim() ||
    typeof event.at !== "string" ||
    !validTimestamp(event.at)
  )
    return null;
  if (
    event.action === "evidence-requested" &&
    event.actor === "landlord" &&
    typeof event.requestId === "string" &&
    event.responseId === undefined
  ) {
    const request = evidenceRequest(record, event.requestId);
    if (
      request &&
      request.createdAt === event.at &&
      activity.filter(
        (item) =>
          item.source === "local" &&
          item.action === "evidence-requested" &&
          item.requestId === request.id,
      ).length === 1
    )
      return { role: "tenant", kind: "evidence-requested" };
  }
  if (
    event.action === "evidence-response-saved" &&
    event.actor === "tenant" &&
    typeof event.responseId === "string"
  ) {
    const response = evidenceResponse(record, event.responseId);
    if (
      response &&
      event.id === response.id &&
      response.submittedAt === event.at &&
      response.requestId === event.requestId &&
      activity.filter(
        (item) =>
          item.source === "local" &&
          item.action === "evidence-response-saved" &&
          item.responseId === response.id,
      ).length === 1
    )
      return { role: "landlord", kind: "evidence-response-saved" };
  }
  return null;
}

/** Only activity visible to both the actual applicant and property owner is shared. */
function projectApplicationNotifications(
  state: ApplicationState,
): RecordedApplicationNotification[] {
  const tenantRecords = new Set(visibleApplicationRecords(state, "tenant"));
  const projected = new Map<string, RecordedApplicationNotification>();
  for (const record of visibleApplicationRecords(state, "landlord")) {
    if (
      !tenantRecords.has(record) ||
      !Number.isSafeInteger(record.id) ||
      record.id < 1 ||
      state.records.filter((item) => item.id === record.id).length !== 1
    )
      continue;
    const property = properties.find(
      (item) => item.id === record.propertyId && item.listingType === "Rent",
    );
    const activity = distinctActivity(record);
    if (!property || !activity) continue;
    for (const event of activity) {
      const target = recordedEvent(record, event, activity);
      if (!target) continue;
      const id = `rental-application:${JSON.stringify([target.role, record.id, event.id])}`;
      if (projected.has(id)) continue;
      projected.set(id, {
        id,
        role: target.role,
        icon: "document",
        destination: "applications",
        // Event-aware UI supplies its own local-activity heading and timestamp.
        titleKey: "common.applications",
        noteKey: "common.documents",
        timeKey: "universalHome.yourUpdates",
        read: false,
        rentalApplicationEvent: {
          kind: target.kind,
          applicationId: record.id,
          propertyTitle: property.title,
          occurredAt: event.at,
        },
      });
    }
  }
  return [...projected.values()];
}

function isApplicationProjection(item: KasaNotification): boolean {
  return (
    Boolean(item.rentalApplicationEvent) ||
    item.id.startsWith("rental-application:")
  );
}

function sameProjection(
  existing: KasaNotification,
  next: RecordedApplicationNotification,
): boolean {
  if (!existing.rentalApplicationEvent) return false;
  return (
    Object.keys(existing).length === Object.keys(next).length &&
    Object.keys(existing.rentalApplicationEvent).length ===
      Object.keys(next.rentalApplicationEvent).length &&
    existing.id === next.id &&
    existing.role === next.role &&
    existing.icon === next.icon &&
    existing.destination === next.destination &&
    existing.titleKey === next.titleKey &&
    existing.noteKey === next.noteKey &&
    existing.timeKey === next.timeKey &&
    existing.read === next.read &&
    existing.rentalApplicationEvent.kind === next.rentalApplicationEvent.kind &&
    existing.rentalApplicationEvent.applicationId ===
      next.rentalApplicationEvent.applicationId &&
    existing.rentalApplicationEvent.propertyTitle ===
      next.rentalApplicationEvent.propertyTitle &&
    existing.rentalApplicationEvent.occurredAt ===
      next.rentalApplicationEvent.occurredAt
  );
}

/** Rebuild only evidence activity, retaining read receipts and unrelated feeds. */
export function reconcileRentalApplicationNotifications(
  notifications: NotificationState,
  state: ApplicationState,
): NotificationState {
  const previous = new Map<string, KasaNotification>();
  for (const item of notifications.items) {
    if (!isApplicationProjection(item)) continue;
    const key = JSON.stringify([item.role, item.id]);
    const stored = previous.get(key);
    if (!stored || (!stored.read && item.read)) previous.set(key, item);
  }
  const projected = projectApplicationNotifications(state).map((item) => {
    const stored = previous.get(JSON.stringify([item.role, item.id]));
    const next = { ...item, read: stored?.read === true };
    return stored && sameProjection(stored, next) ? stored : next;
  });
  const sorted = sortNotificationActivity({
    ...notifications,
    items: [
      ...projected,
      ...notifications.items.filter((item) => !isApplicationProjection(item)),
    ],
  });
  return sorted.items.length === notifications.items.length &&
    sorted.items.every((item, index) => item === notifications.items[index])
    ? notifications
    : sorted;
}

/** Revalidate the source; opening an alert only reveals its exact scoped record. */
export function openRentalApplicationNotification(
  state: ApplicationState,
  role: Role,
  notification: KasaNotification,
): { state: ApplicationState; applicationId: number } | null {
  if (!notification.rentalApplicationEvent || notification.role !== role)
    return null;
  const source = projectApplicationNotifications(state).find(
    (item) => item.id === notification.id && item.role === role,
  );
  if (!source) return null;
  const applicationId = source.rentalApplicationEvent.applicationId;
  return {
    state: revealApplication(state, role, applicationId),
    applicationId,
  };
}
