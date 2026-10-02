import type { Property, Role } from "../types";

export type ConversationCategory =
  "Property" | "Maintenance" | "Services" | "Spaces" | "Platform";

export interface ChatMessage {
  id: string;
  direction: "received" | "sent";
  text: string;
  time: string;
  localOnly?: boolean;
}

export interface ChatConversation {
  id: string;
  name: string;
  property: string;
  category: ConversationCategory;
  initials: string;
  unread: number;
  time: string;
  lastActivity: number;
  messages: ChatMessage[];
  draft: string;
  blocked: boolean;
  propertyContext?: { propertyId: number; landlord: string };
}

export interface MessageState {
  role: Role;
  conversations: ChatConversation[];
  selectedId: string;
  conversationOpen: boolean;
}

export type WorkspaceMessageState = Record<Role, MessageState>;
export type MessageStateUpdate =
  MessageState | ((current: MessageState) => MessageState);

export const messageWorkspaceLabels: Record<Role, string> = {
  tenant: "Personal",
  landlord: "Properties",
  provider: "Services business",
  spaceOperator: "Venue operations",
  admin: "Platform operations",
};

type SeedMessage = [ChatMessage["direction"], string, string];
interface ConversationSeed {
  name: string;
  property: string;
  category: ConversationCategory;
  initials: string;
  unread: number;
  messages: SeedMessage[];
}

const inboxSeeds: Record<Role, ConversationSeed[]> = {
  tenant: [
    {
      name: "Olivia Martín",
      property: "Sunlit Eixample home",
      category: "Property",
      initials: "OM",
      unread: 1,
      messages: [
        [
          "sent",
          "I made the rent transfer and added the receipt to my rent record.",
          "09:36",
        ],
        [
          "received",
          "Thanks, Inês. I can see the receipt and will check the transfer against the rent record.",
          "09:42",
        ],
      ],
    },
    {
      name: "Nuno Silva",
      property: "Quiet Gràcia loft",
      category: "Property",
      initials: "NS",
      unread: 0,
      messages: [
        [
          "sent",
          "Would Thursday afternoon work for a viewing of your Gràcia loft?",
          "14:10",
        ],
        [
          "received",
          "Thursday afternoon works for me. Let me know which time you prefer.",
          "14:18",
        ],
      ],
    },
    {
      name: "Clima BCN",
      property: "Maintenance · #1028",
      category: "Maintenance",
      initials: "CB",
      unread: 0,
      messages: [
        [
          "sent",
          "The air conditioning in my home is still leaking. Could you confirm the maintenance visit?",
          "10:05",
        ],
        [
          "received",
          "Our technician will check the air-conditioning unit and contact you before arriving.",
          "10:20",
        ],
      ],
    },
  ],
  landlord: [
    {
      name: "Inês Duarte",
      property: "Sunlit Eixample home",
      category: "Property",
      initials: "ID",
      unread: 2,
      messages: [
        [
          "sent",
          "You can add the transfer receipt to the rent record so we can keep everything together.",
          "09:34",
        ],
        [
          "received",
          "I made the rent transfer directly to your account this morning.",
          "09:36",
        ],
        ["received", "I’ve uploaded the transfer receipt.", "09:42"],
      ],
    },
    {
      name: "Leo Bernard",
      property: "Sunlit Eixample home · Viewing",
      category: "Property",
      initials: "LB",
      unread: 0,
      messages: [
        [
          "sent",
          "Would Thursday afternoon work for a viewing of the Eixample home?",
          "14:10",
        ],
        ["received", "Thursday afternoon works for me.", "14:18"],
      ],
    },
    {
      name: "Clima BCN",
      property: "Maintenance · #1028",
      category: "Maintenance",
      initials: "CB",
      unread: 0,
      messages: [
        [
          "sent",
          "The tenant reported that the air conditioning is leaking. Please confirm the visit for request #1028.",
          "10:05",
        ],
        [
          "received",
          "We will inspect the unit and send an estimate before carrying out any repairs.",
          "10:20",
        ],
      ],
    },
  ],
  provider: [
    {
      name: "Olivia Martín",
      property: "Electrical inspection · Eixample",
      category: "Services",
      initials: "OM",
      unread: 1,
      messages: [
        [
          "received",
          "Could Volt & Co. inspect the lighting circuit at my Eixample property?",
          "09:15",
        ],
        [
          "sent",
          "We can inspect it and provide an estimate before any work begins.",
          "09:25",
        ],
        [
          "received",
          "Thank you, Adrián. Please suggest a time for the inspection.",
          "09:40",
        ],
      ],
    },
    {
      name: "Inês Duarte",
      property: "Maintenance · #EL1029",
      category: "Maintenance",
      initials: "ID",
      unread: 0,
      messages: [
        [
          "received",
          "The kitchen outlet has stopped working. What information do you need for the visit?",
          "11:10",
        ],
        [
          "sent",
          "Please leave the outlet unused. We will inspect it during the agreed visit.",
          "11:18",
        ],
      ],
    },
    {
      name: "Casa Clara",
      property: "Service referral · Electrical repair",
      category: "Services",
      initials: "CC",
      unread: 0,
      messages: [
        [
          "received",
          "A client needs an electrical repair estimate. Is your team taking new requests?",
          "15:10",
        ],
        [
          "sent",
          "Yes. Please ask the client to create a service request with the job details.",
          "15:20",
        ],
      ],
    },
  ],
  spaceOperator: [
    {
      name: "Leo Bernard",
      property: "Poblenou · Court 1 reservation",
      category: "Spaces",
      initials: "LB",
      unread: 1,
      messages: [
        [
          "received",
          "Could we move our Court 1 reservation thirty minutes later?",
          "09:10",
        ],
        [
          "sent",
          "I will check the court schedule before proposing a different time.",
          "09:20",
        ],
        ["received", "Thanks. We can keep the same session duration.", "09:35"],
      ],
    },
    {
      name: "Inês Duarte",
      property: "Poblenou · Equipment rental",
      category: "Spaces",
      initials: "ID",
      unread: 0,
      messages: [
        ["received", "Are rackets available for our padel session?", "13:05"],
        [
          "sent",
          "The club offers equipment rental. Please confirm how many rackets you need.",
          "13:15",
        ],
      ],
    },
    {
      name: "Kasa Spaces support",
      property: "Poblenou · Venue setup",
      category: "Platform",
      initials: "KS",
      unread: 0,
      messages: [
        [
          "sent",
          "Which information should I add to the venue profile?",
          "16:00",
        ],
        [
          "received",
          "Include opening hours, facilities, accessible entry information and the venue's booking terms.",
          "16:10",
        ],
      ],
    },
  ],
  admin: [
    {
      name: "Olivia Martín",
      property: "Listing review · #124",
      category: "Platform",
      initials: "OM",
      unread: 1,
      messages: [
        [
          "received",
          "Could you explain what is missing from the listing review?",
          "08:40",
        ],
        [
          "sent",
          "Please check the listing details against the requested information before resubmitting.",
          "08:50",
        ],
        [
          "received",
          "I have updated the information for another review.",
          "09:05",
        ],
      ],
    },
    {
      name: "Volt & Co.",
      property: "Provider review · #V208",
      category: "Platform",
      initials: "VC",
      unread: 0,
      messages: [
        [
          "received",
          "Where can I see which provider details need attention?",
          "12:10",
        ],
        [
          "sent",
          "The provider review record lists the outstanding information and its current status.",
          "12:20",
        ],
      ],
    },
    {
      name: "Nuno Silva",
      property: "Listing report · #R18",
      category: "Platform",
      initials: "NS",
      unread: 0,
      messages: [
        [
          "received",
          "I would like to add some context to the report about my listing.",
          "15:00",
        ],
        [
          "sent",
          "Add the relevant details to the report record so they can be considered with the review.",
          "15:15",
        ],
      ],
    },
  ],
};

export function createInitialMessageState(
  role: Role = "landlord",
): MessageState {
  const seeds = inboxSeeds[role];
  return {
    role,
    selectedId: `${role}:conversation-1`,
    conversationOpen: false,
    conversations: seeds.map((conversation, index) => ({
      ...conversation,
      id: `${role}:conversation-${index + 1}`,
      time: index === 0 ? conversation.messages.at(-1)![2] : "Yesterday",
      lastActivity: seeds.length - index,
      draft: "",
      blocked: false,
      messages: conversation.messages.map(
        ([direction, text, time], messageIndex) => ({
          id: `${role}:sample-${index}-${messageIndex}`,
          direction,
          text,
          time,
        }),
      ),
    })),
  };
}

export function createInitialWorkspaceMessageState(): WorkspaceMessageState {
  return {
    tenant: createInitialMessageState("tenant"),
    landlord: createInitialMessageState("landlord"),
    provider: createInitialMessageState("provider"),
    spaceOperator: createInitialMessageState("spaceOperator"),
    admin: createInitialMessageState("admin"),
  };
}

export function updateWorkspaceMessageState(
  state: WorkspaceMessageState,
  role: Role,
  update: MessageStateUpdate,
): WorkspaceMessageState {
  const next = typeof update === "function" ? update(state[role]) : update;
  if (next.role !== role || next === state[role]) return state;
  return { ...state, [role]: next };
}

export function openPropertyConversation(
  state: MessageState,
  property: Pick<Property, "id" | "title" | "landlord">,
  now = new Date(),
): MessageState {
  const existing = state.conversations.find(
    (conversation) =>
      conversation.propertyContext?.propertyId === property.id &&
      conversation.propertyContext.landlord === property.landlord,
  );
  if (existing) {
    return {
      ...updateConversation(state, existing.id, (conversation) => ({
        ...conversation,
        property: property.title,
        unread: 0,
      })),
      selectedId: existing.id,
      conversationOpen: true,
    };
  }
  const id = `${state.role}:property:${property.id}:${encodeURIComponent(property.landlord)}`;
  const conversation: ChatConversation = {
    id,
    name: property.landlord,
    property: property.title,
    category: "Property",
    initials:
      property.landlord
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toLocaleUpperCase() || "K",
    unread: 0,
    time: "New",
    lastActivity: now.getTime(),
    messages: [],
    draft: "",
    blocked: false,
    propertyContext: { propertyId: property.id, landlord: property.landlord },
  };
  return {
    ...state,
    conversations: [...state.conversations, conversation],
    selectedId: id,
    conversationOpen: true,
  };
}

export function unreadMessageCount(state: MessageState) {
  return state.conversations.reduce(
    (total, conversation) => total + conversation.unread,
    0,
  );
}

export function updateConversation(
  state: MessageState,
  id: string,
  update: (conversation: ChatConversation) => ChatConversation,
): MessageState {
  return {
    ...state,
    conversations: state.conversations.map((conversation) =>
      conversation.id === id ? update(conversation) : conversation,
    ),
  };
}

export function appendLocalMessage(
  state: MessageState,
  conversationId: string,
  now = new Date(),
): MessageState {
  return updateConversation(state, conversationId, (conversation) => {
    const text = conversation.draft.trim();
    if (!text || conversation.blocked) return conversation;
    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      ...conversation,
      draft: "",
      unread: 0,
      time,
      lastActivity: now.getTime(),
      messages: [
        ...conversation.messages,
        {
          id: `${conversation.id}-${now.getTime()}-${conversation.messages.length}`,
          direction: "sent",
          text,
          time,
          localOnly: true,
        },
      ],
    };
  });
}
