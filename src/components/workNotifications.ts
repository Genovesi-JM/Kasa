import type { Role } from "../types";
import type {
  KasaNotification,
  NotificationState,
  WorkNotificationEvent,
} from "./notificationState";
import {
  updateWorkApplicantView,
  updateWorkHiringView,
  updateWorkMarketplaceView,
  visibleWorkApplications,
  workspaceWorkApplicant,
  type WorkApplication,
  type WorkState,
} from "./workState";

type RecordedWorkNotification = KasaNotification & {
  role: "tenant" | "provider";
  serviceMode: "jobs" | "hire";
  workEvent: WorkNotificationEvent;
};

function validTimestamp(value: string): boolean {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function recordedEvent(
  application: WorkApplication,
  event: WorkApplication["history"][number],
): { role: "tenant" | "provider"; kind: WorkNotificationEvent["kind"] } | null {
  if (!event.id || !validTimestamp(event.at)) return null;
  if (
    event.action === "submitted" &&
    event.actor === "tenant" &&
    event.at === application.submittedAt
  )
    return { role: "provider", kind: "application-submitted" };
  if (
    event.action === "withdrawn" &&
    event.actor === "tenant" &&
    application.status === "Withdrawn" &&
    event.at === application.withdrawnAt
  )
    return { role: "provider", kind: "application-withdrawn" };
  if (
    event.action === "reviewed" &&
    event.actor === "provider" &&
    application.applicantId === workspaceWorkApplicant.id &&
    event.at === application.reviewedAt
  )
    return { role: "tenant", kind: "application-reviewed" };
  return null;
}

/** Derive local activity only from records the current business can inspect. */
function projectWorkNotifications(work: WorkState): RecordedWorkNotification[] {
  const projected = new Map<string, RecordedWorkNotification>();
  for (const application of visibleWorkApplications(work, "provider")) {
    for (const event of application.history) {
      const target = recordedEvent(application, event);
      if (!target) continue;
      // Tuple encoding avoids ambiguous IDs without copying any application text.
      const id = `work:${JSON.stringify([target.role, application.id, event.id])}`;
      if (projected.has(id)) continue;
      projected.set(id, {
        id,
        role: target.role,
        icon: "work",
        destination: "services",
        serviceMode: target.role === "provider" ? "hire" : "jobs",
        // Work-aware UI renders its own event copy and the recorded timestamp.
        titleKey: "common.applications",
        noteKey: "universalHome.work",
        timeKey: "universalHome.yourUpdates",
        read: false,
        workEvent: {
          kind: target.kind,
          applicationId: application.id,
          opportunityTitle: application.opportunity.title,
          occurredAt: event.at,
        },
      });
    }
  }
  return [...projected.values()].sort((left, right) => {
    const difference =
      new Date(right.workEvent.occurredAt).getTime() -
      new Date(left.workEvent.occurredAt).getTime();
    return difference || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  });
}

function isWorkProjection(item: KasaNotification) {
  return Boolean(item.workEvent) || item.id.startsWith("work:");
}

function sameProjection(
  existing: KasaNotification,
  next: RecordedWorkNotification,
): boolean {
  if (!existing.workEvent) return false;
  return (
    Object.keys(existing).length === Object.keys(next).length &&
    Object.keys(existing.workEvent).length ===
      Object.keys(next.workEvent).length &&
    existing.id === next.id &&
    existing.role === next.role &&
    existing.icon === next.icon &&
    existing.destination === next.destination &&
    existing.serviceMode === next.serviceMode &&
    existing.titleKey === next.titleKey &&
    existing.noteKey === next.noteKey &&
    existing.timeKey === next.timeKey &&
    existing.read === next.read &&
    existing.workEvent.kind === next.workEvent.kind &&
    existing.workEvent.applicationId === next.workEvent.applicationId &&
    existing.workEvent.opportunityTitle === next.workEvent.opportunityTitle &&
    existing.workEvent.occurredAt === next.workEvent.occurredAt
  );
}

/** Pure projection: preserve read receipts by event ID without a synchronization effect. */
export function reconcileWorkNotifications(
  notificationState: NotificationState,
  workState: WorkState,
): NotificationState {
  const previous = new Map<string, KasaNotification>();
  for (const item of notificationState.items) {
    if (!isWorkProjection(item)) continue;
    const stored = previous.get(item.id);
    if (!stored || (!stored.read && item.read)) previous.set(item.id, item);
  }
  const items: KasaNotification[] = projectWorkNotifications(workState).map(
    (item) => {
      const stored = previous.get(item.id);
      const next = {
        ...item,
        read: stored?.role === item.role && stored.read === true,
      };
      return stored && sameProjection(stored, next) ? stored : next;
    },
  );
  items.push(
    ...notificationState.items.filter((item) => !isWorkProjection(item)),
  );
  return items.length === notificationState.items.length &&
    items.every((item, index) => item === notificationState.items[index])
    ? notificationState
    : { ...notificationState, items };
}

/** Resolve the current source event again; notification payloads cannot redirect scope or records. */
export function openWorkNotification(
  workState: WorkState,
  role: Role,
  notification: KasaNotification,
): { state: WorkState; serviceMode: "jobs" | "hire" } | null {
  if (!notification.workEvent || notification.role !== role) return null;
  const current = projectWorkNotifications(workState).find(
    (item) => item.id === notification.id && item.role === role,
  );
  if (!current) return null;
  const applicationId = current.workEvent.applicationId;
  if (role === "provider")
    return {
      state: updateWorkHiringView(workState, role, {
        section: "applications",
        filter: "All",
        applicationFilter: "All",
        query: "",
        selectedApplicationId: applicationId,
        selectedDraftId: null,
        selectedPostId: null,
      }),
      serviceMode: "hire",
    };
  if (role === "tenant")
    return {
      state: updateWorkMarketplaceView(
        updateWorkApplicantView(workState, role, {
          filter: "All",
          selectedApplicationId: applicationId,
        }),
        role,
        {
          section: "applications",
          query: "",
          type: "All",
          status: "All",
          selectedOpportunityId: null,
        },
      ),
      serviceMode: "jobs",
    };
  return null;
}
