import type { Role } from "../types";
import {
  sortNotificationActivity,
  type KasaNotification,
  type NotificationState,
  type ServiceNotificationEvent,
} from "./notificationState";
import {
  isServiceCustomer,
  selectServiceRequest,
  visibleServiceRequests,
  type ServiceCustomerRole,
  type ServiceRequestHistory,
  type ServiceRequestRecord,
  type ServiceRequestState,
} from "./serviceRequestState";

type RecordedServiceNotification = KasaNotification & {
  role: ServiceCustomerRole | "provider";
  serviceEvent: ServiceNotificationEvent;
};

function validTimestamp(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function recordedEvent(
  record: ServiceRequestRecord,
  event: ServiceRequestHistory,
): {
  role: ServiceCustomerRole | "provider";
  kind: ServiceNotificationEvent["kind"];
} | null {
  if (
    typeof event.id !== "string" ||
    !event.id.trim() ||
    !validTimestamp(event.at)
  )
    return null;
  const customer = event.actor === record.customerName;
  const provider = event.actor === record.providerName;
  if (
    event.action === "requested" &&
    record.source === "local" &&
    customer &&
    event.at === record.createdAt
  )
    return { role: "provider", kind: "request-submitted" };

  if (event.action === "quoted") {
    const quote = record.quotes.find((item) => item.id === event.quoteId);
    return provider && quote?.recordedAt === event.at
      ? { role: record.customerRole, kind: "quote-recorded" }
      : null;
  }
  if (event.action === "accepted" || event.action === "declined") {
    const quote = record.quotes.find((item) => item.id === event.quoteId);
    if (
      !customer ||
      !quote ||
      quote.decidedAt !== event.at ||
      quote.decision !== (event.action === "accepted" ? "Accepted" : "Declined")
    )
      return null;
    return {
      role: "provider",
      kind: event.action === "accepted" ? "quote-accepted" : "quote-declined",
    };
  }
  if (
    event.action === "provider-declined" &&
    provider &&
    record.status === "Provider declined" &&
    record.updatedAt === event.at
  )
    return { role: record.customerRole, kind: "request-declined" };
  if (
    event.action === "cancelled" &&
    customer &&
    record.status === "Cancelled" &&
    record.updatedAt === event.at
  )
    return { role: "provider", kind: "request-cancelled" };
  return null;
}

/** Both parties must match the canonical workspaces before history can produce activity. */
function projectServiceNotifications(
  services: ServiceRequestState,
): RecordedServiceNotification[] {
  const customers = {
    tenant: new Set(visibleServiceRequests(services, "tenant")),
    landlord: new Set(visibleServiceRequests(services, "landlord")),
  };
  const projected = new Map<string, RecordedServiceNotification>();
  for (const record of visibleServiceRequests(services, "provider")) {
    if (
      !isServiceCustomer(record.customerRole) ||
      !customers[record.customerRole].has(record) ||
      (record.source !== "local" && record.source !== "sample")
    )
      continue;
    for (const event of record.history) {
      const target = recordedEvent(record, event);
      if (!target) continue;
      const id = `service:${JSON.stringify([target.role, record.id, event.id])}`;
      if (projected.has(id)) continue;
      projected.set(id, {
        id,
        role: target.role,
        icon: "repair",
        destination: target.role === "provider" ? "provider" : "services",
        ...(target.role !== "provider"
          ? { serviceMode: "tasks" as const }
          : {}),
        // Service-aware UI supplies its own heading and the actual history timestamp.
        titleKey: "shell.newServiceRequest",
        noteKey: "nav.jobs",
        timeKey: "universalHome.yourUpdates",
        read: false,
        serviceEvent: {
          kind: target.kind,
          requestId: record.id,
          requestTitle: record.title,
          occurredAt: event.at,
        },
      });
    }
  }
  return [...projected.values()];
}

function isServiceProjection(item: KasaNotification): boolean {
  return Boolean(item.serviceEvent) || item.id.startsWith("service:");
}

function sameProjection(
  existing: KasaNotification,
  next: RecordedServiceNotification,
): boolean {
  if (!existing.serviceEvent) return false;
  return (
    Object.keys(existing).length === Object.keys(next).length &&
    Object.keys(existing.serviceEvent).length ===
      Object.keys(next.serviceEvent).length &&
    existing.id === next.id &&
    existing.role === next.role &&
    existing.icon === next.icon &&
    existing.destination === next.destination &&
    existing.serviceMode === next.serviceMode &&
    existing.titleKey === next.titleKey &&
    existing.noteKey === next.noteKey &&
    existing.timeKey === next.timeKey &&
    existing.read === next.read &&
    existing.serviceEvent.kind === next.serviceEvent.kind &&
    existing.serviceEvent.requestId === next.serviceEvent.requestId &&
    existing.serviceEvent.requestTitle === next.serviceEvent.requestTitle &&
    existing.serviceEvent.occurredAt === next.serviceEvent.occurredAt
  );
}

/** Rebuild only Services activity, preserving receipts and other notification sources. */
export function reconcileServiceNotifications(
  notificationState: NotificationState,
  services: ServiceRequestState,
): NotificationState {
  const previous = new Map<string, KasaNotification>();
  for (const item of notificationState.items) {
    if (!isServiceProjection(item)) continue;
    const receiptKey = JSON.stringify([item.role, item.id]);
    const stored = previous.get(receiptKey);
    if (!stored || (!stored.read && item.read)) previous.set(receiptKey, item);
  }
  const projected: KasaNotification[] = projectServiceNotifications(
    services,
  ).map((item) => {
    const stored = previous.get(JSON.stringify([item.role, item.id]));
    const next = {
      ...item,
      read: stored?.role === item.role && stored.read === true,
    };
    return stored && sameProjection(stored, next) ? stored : next;
  });
  const sorted = sortNotificationActivity({
    ...notificationState,
    items: [
      ...projected,
      ...notificationState.items.filter((item) => !isServiceProjection(item)),
    ],
  });
  return sorted.items.length === notificationState.items.length &&
    sorted.items.every((item, index) => item === notificationState.items[index])
    ? notificationState
    : sorted;
}

/** A feed payload cannot redirect the target: resolve its live source event again. */
export function openServiceNotification(
  services: ServiceRequestState,
  role: Role,
  notification: KasaNotification,
): {
  state: ServiceRequestState;
  destination: "provider" | "services";
  serviceMode?: "tasks";
} | null {
  if (!notification.serviceEvent || notification.role !== role) return null;
  const current = projectServiceNotifications(services).find(
    (item) => item.id === notification.id && item.role === role,
  );
  if (!current) return null;
  const state = selectServiceRequest(
    services,
    role,
    current.serviceEvent.requestId,
  );
  return role === "provider"
    ? { state, destination: "provider" }
    : { state, destination: "services", serviceMode: "tasks" };
}
