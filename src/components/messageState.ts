import { conversations } from "../data";
import type { Property } from "../types";

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
  conversations: ChatConversation[];
  selectedId: string;
  conversationOpen: boolean;
}

export function createInitialMessageState(): MessageState {
  const transcripts: Array<Array<[ChatMessage["direction"], string, string]>> =
    [
      [
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
      [
        [
          "sent",
          "Would Thursday afternoon work for a viewing of the Gràcia loft?",
          "14:10",
        ],
        ["received", "Thursday afternoon works for me.", "14:18"],
      ],
      [
        [
          "sent",
          "The air conditioning is still leaking. Could you confirm the maintenance visit for request #1028?",
          "10:05",
        ],
        [
          "received",
          "Your visit is confirmed. Our technician will check the air-conditioning unit and contact you before arriving.",
          "10:20",
        ],
      ],
    ];

  return {
    selectedId: "conversation-1",
    conversationOpen: false,
    conversations: conversations.map((conversation, index) => ({
      ...conversation,
      id: `conversation-${index + 1}`,
      lastActivity: conversations.length - index,
      draft: "",
      blocked: false,
      messages: transcripts[index].map(
        ([direction, text, time], messageIndex) => ({
          id: `sample-${index}-${messageIndex}`,
          direction,
          text,
          time,
        }),
      ),
    })),
  };
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
  const id = `property:${property.id}:${encodeURIComponent(property.landlord)}`;
  const conversation: ChatConversation = {
    id,
    name: property.landlord,
    property: property.title,
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
