import type { Role, View } from "../types";

export interface WorkNotificationEvent {
  kind:
    "application-submitted" | "application-withdrawn" | "application-reviewed";
  applicationId: string;
  opportunityTitle: string;
  occurredAt: string;
}

export interface ServiceNotificationEvent {
  kind:
    | "request-submitted"
    | "quote-recorded"
    | "request-declined"
    | "quote-accepted"
    | "quote-declined"
    | "request-cancelled"
    | "service-started"
    | "service-completed";
  requestId: string;
  requestTitle: string;
  occurredAt: string;
}

export interface SpaceBookingNotificationEvent {
  kind:
    | "request-submitted"
    | "request-accepted"
    | "request-declined"
    | "proposal-recorded"
    | "proposal-accepted"
    | "proposal-declined"
    | "request-cancelled"
    | "booking-completed";
  bookingId: string;
  venueName: string;
  spaceName: string;
  occurredAt: string;
}

export interface KasaNotification {
  id: string;
  role: Role;
  titleKey: string;
  noteKey: string;
  timeKey: string;
  icon:
    | "work"
    | "message"
    | "repair"
    | "calendar"
    | "document"
    | "payment"
    | "shield";
  destination: View;
  serviceMode?: "jobs" | "hire" | "tasks";
  workEvent?: WorkNotificationEvent;
  serviceEvent?: ServiceNotificationEvent;
  spaceBookingEvent?: SpaceBookingNotificationEvent;
  read: boolean;
}

export interface NotificationState {
  items: KasaNotification[];
}

/** Sort recorded activity together without inventing timestamps for sample entries. */
export function sortNotificationActivity(
  state: NotificationState,
): NotificationState {
  const ordered = state.items
    .map((item, index) => {
      const value =
        item.spaceBookingEvent?.occurredAt ??
        item.serviceEvent?.occurredAt ??
        item.workEvent?.occurredAt;
      const date = typeof value === "string" ? new Date(value) : null;
      const at =
        date && Number.isFinite(date.getTime()) && date.toISOString() === value
          ? date.getTime()
          : null;
      return { item, index, at };
    })
    .sort((left, right) => {
      if (left.at === null)
        return right.at === null ? left.index - right.index : 1;
      if (right.at === null) return -1;
      return (
        right.at - left.at ||
        (left.item.id < right.item.id
          ? -1
          : left.item.id > right.item.id
            ? 1
            : 0) ||
        left.index - right.index
      );
    })
    .map(({ item }) => item);
  return ordered.every((item, index) => item === state.items[index])
    ? state
    : { ...state, items: ordered };
}

export function createInitialNotificationState(): NotificationState {
  const item = (
    role: Role,
    id: string,
    titleKey: string,
    noteKey: string,
    icon: KasaNotification["icon"],
    destination: View,
    read = false,
  ): KasaNotification => ({
    id: `${role}-${id}`,
    role,
    titleKey,
    noteKey,
    icon,
    destination,
    read,
    timeKey: read ? "shell.yesterday" : "shell.minutesAgo",
  });

  return {
    items: [
      {
        ...item(
          "tenant",
          "job",
          "universalHome.jobMatch",
          "universalHome.jobMatchNote",
          "work",
          "services",
        ),
        serviceMode: "jobs",
      },
      item(
        "tenant",
        "message",
        "universalHome.newMessage",
        "universalHome.newMessageNote",
        "message",
        "messages",
      ),
      item(
        "tenant",
        "repair",
        "universalHome.repairUpdate",
        "universalHome.repairNote",
        "repair",
        "maintenance",
        true,
      ),
      item(
        "tenant",
        "booking",
        "universalHome.spaceReminder",
        "universalHome.spaceReminderNote",
        "calendar",
        "spaceBookings",
        true,
      ),
      item(
        "landlord",
        "transfer",
        "shell.transferConfirmed",
        "nav.rentRecords",
        "payment",
        "rent",
      ),
      item(
        "landlord",
        "document",
        "shell.documentUpdated",
        "common.documents",
        "document",
        "documents",
        true,
      ),
      item(
        "provider",
        "request",
        "shell.newServiceRequest",
        "nav.jobs",
        "work",
        "provider",
      ),
      item(
        "provider",
        "message",
        "common.messages",
        "shell.workspaceReady",
        "message",
        "messages",
        true,
      ),
      item(
        "spaceOperator",
        "booking",
        "shell.newCourtBooking",
        "nav.venueDashboard",
        "calendar",
        "spaceOperator",
      ),
      item(
        "spaceOperator",
        "waitlist",
        "shell.waitlistJoined",
        "nav.venueDashboard",
        "calendar",
        "spaceOperator",
        true,
      ),
      item(
        "admin",
        "listing",
        "shell.listingFlagged",
        "nav.moderation",
        "shield",
        "admin",
      ),
      item(
        "admin",
        "document",
        "shell.documentUpdated",
        "nav.moderation",
        "document",
        "admin",
        true,
      ),
    ],
  };
}

export function notificationsForRole(state: NotificationState, role: Role) {
  return state.items.filter((item) => item.role === role);
}

export function unreadNotificationCount(state: NotificationState, role: Role) {
  return notificationsForRole(state, role).filter((item) => !item.read).length;
}

export function markNotificationRead(
  state: NotificationState,
  role: Role,
  id: string,
): NotificationState {
  if (
    !state.items.some(
      (item) => item.role === role && item.id === id && !item.read,
    )
  )
    return state;
  return {
    ...state,
    items: state.items.map((item) =>
      item.role === role && item.id === id ? { ...item, read: true } : item,
    ),
  };
}

export function markAllNotificationsRead(
  state: NotificationState,
  role: Role,
): NotificationState {
  if (unreadNotificationCount(state, role) === 0) return state;
  return {
    ...state,
    items: state.items.map((item) =>
      item.role === role && !item.read ? { ...item, read: true } : item,
    ),
  };
}
