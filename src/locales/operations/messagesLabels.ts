import type {
  ConversationCategory,
  MessageView,
} from "../../components/messageState";
import type { Role } from "../../types";
import type { OperationsKey } from "./types";

export const messageCategoryKeys = {
  Property: "messages_categoryProperty",
  Maintenance: "messages_categoryMaintenance",
  Services: "messages_categoryServices",
  Spaces: "messages_categorySpaces",
  Platform: "messages_categoryPlatform",
} as const satisfies Record<ConversationCategory, OperationsKey>;

export const messageContextKeys = {
  "All conversations": "messages_allConversations",
  Unread: "messages_unread",
  ...messageCategoryKeys,
} as const satisfies Record<MessageView["context"], OperationsKey>;

export const messageSortKeys = {
  "Most recent": "messages_mostRecent",
  "Unread first": "messages_unreadFirst",
} as const satisfies Record<MessageView["sort"], OperationsKey>;

export const messageWorkspaceKeys = {
  tenant: "messages_workspaceTenant",
  landlord: "messages_workspaceLandlord",
  provider: "messages_workspaceProvider",
  spaceOperator: "messages_workspaceOperator",
  admin: "messages_workspaceAdmin",
} as const satisfies Record<Role, OperationsKey>;

export function messageTimeLabel(
  value: string,
  tr: (key: OperationsKey) => string,
): string {
  if (value === "New") return tr("messages_new");
  if (value === "Yesterday") return tr("messages_yesterday");
  return value;
}
