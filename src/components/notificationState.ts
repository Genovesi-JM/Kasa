import type { Role, View } from "../types";

export interface WorkNotificationEvent {
  kind:
    "application-submitted" | "application-withdrawn" | "application-reviewed";
  applicationId: string;
  opportunityTitle: string;
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
  serviceMode?: "jobs" | "hire";
  workEvent?: WorkNotificationEvent;
  read: boolean;
}

export interface NotificationState {
  items: KasaNotification[];
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
