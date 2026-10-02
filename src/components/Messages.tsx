import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowLeft,
  LockKeyhole,
  MessageCircle,
  Paperclip,
  Search,
  Send,
} from "lucide-react";
import { matchesSearch } from "../search";
import {
  appendLocalMessage,
  messageWorkspaceLabels,
  updateConversation,
  type ChatConversation,
  type MessageState,
} from "./messageState";
import "./messages.css";
import { useMediaQuery } from "./useMediaQuery";

interface MessagesProps {
  state: MessageState;
  setState: Dispatch<SetStateAction<MessageState>>;
  notify: (message: string) => void;
}

export function Messages({ state, setState, notify }: MessagesProps) {
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversationContext, setConversationContext] =
    useState("All conversations");
  const [conversationSort, setConversationSort] = useState("Most recent");
  const [status, setStatus] = useState("");
  const composer = useRef<HTMLInputElement>(null);
  const inboxSearch = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const conversationHeading = useRef<HTMLElement>(null);
  const conversationButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedConversation = state.conversations.find(
    (item) => item.id === state.selectedId,
  );
  const isMobileInbox = useMediaQuery("(max-width: 720px)");
  const selectedUnread = selectedConversation?.unread ?? 0;
  useEffect(() => {
    if (!selectedUnread || (isMobileInbox && !state.conversationOpen)) return;
    setState((current) =>
      updateConversation(current, current.selectedId, (conversation) => ({
        ...conversation,
        unread: 0,
      })),
    );
  }, [
    isMobileInbox,
    state.conversationOpen,
    state.selectedId,
    selectedUnread,
    setState,
  ]);
  const messageCount = selectedConversation?.messages.length ?? 0;
  const categories = [
    ...new Set(
      state.conversations.map((conversation) => conversation.category),
    ),
  ];
  const preview = (conversation: ChatConversation) => {
    if (conversation.draft) return `Draft: ${conversation.draft}`;
    const lastMessage = conversation.messages.at(-1);
    return lastMessage
      ? `${lastMessage.direction === "sent" ? "You: " : ""}${lastMessage.text}`
      : "No messages yet";
  };
  const visibleConversations = state.conversations
    .filter((conversation) => {
      const matchesQuery = matchesSearch(
        conversationQuery,
        conversation.name,
        conversation.property,
        ...conversation.messages.map((message) => message.text),
      );
      const matchesContext =
        conversationContext === "All conversations" ||
        (conversationContext === "Unread"
          ? conversation.unread > 0
          : conversation.category === conversationContext);
      return matchesQuery && matchesContext;
    })
    .sort((a, b) =>
      conversationSort === "Unread first"
        ? b.unread - a.unread || b.lastActivity - a.lastActivity
        : b.lastActivity - a.lastActivity,
    );

  useEffect(() => {
    if (transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [state.selectedId, messageCount, state.conversationOpen]);

  function openConversation(id: string) {
    setState((current) => ({
      ...updateConversation(current, id, (conversation) => ({
        ...conversation,
        unread: 0,
      })),
      selectedId: id,
      conversationOpen: true,
    }));
    setStatus("");
    requestAnimationFrame(() =>
      conversationHeading.current?.focus({ preventScroll: true }),
    );
  }

  function send() {
    if (!selectedConversation?.draft.trim() || selectedConversation.blocked)
      return;
    setState((current) => appendLocalMessage(current, selectedConversation.id));
    setStatus(
      "Message added in this tab. It has not been delivered to anyone.",
    );
    composer.current?.focus({ preventScroll: true });
  }

  function returnToInbox() {
    setState((current) => ({ ...current, conversationOpen: false }));
    requestAnimationFrame(() =>
      (
        conversationButtons.current.get(state.selectedId) ?? inboxSearch.current
      )?.focus({ preventScroll: true }),
    );
  }

  return (
    <section
      className={`messages-layout card ${state.conversationOpen ? "chat-open" : ""}`}
      aria-label="Messages"
    >
      <aside className="conversation-list" aria-label="Conversations">
        <div className="conversation-search">
          <Search size={17} />
          <input
            ref={inboxSearch}
            placeholder="Search messages"
            aria-label="Search messages"
            value={conversationQuery}
            onChange={(event) => setConversationQuery(event.target.value)}
          />
        </div>
        <div className="conversation-filters">
          <select
            aria-label="Conversation type"
            value={conversationContext}
            onChange={(event) => setConversationContext(event.target.value)}
          >
            <option>All conversations</option>
            <option>Unread</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <select
            aria-label="Sort messages"
            value={conversationSort}
            onChange={(event) => setConversationSort(event.target.value)}
          >
            <option>Most recent</option>
            <option>Unread first</option>
          </select>
        </div>
        {visibleConversations.map((conversation) => (
          <button
            key={conversation.id}
            className={state.selectedId === conversation.id ? "active" : ""}
            aria-current={
              state.selectedId === conversation.id ? "true" : undefined
            }
            ref={(button) => {
              if (button)
                conversationButtons.current.set(conversation.id, button);
              else conversationButtons.current.delete(conversation.id);
            }}
            onClick={() => openConversation(conversation.id)}
          >
            <span className="avatar" aria-hidden="true">
              {conversation.initials}
            </span>
            <span>
              <strong>{conversation.name}</strong>
              <small>{conversation.property}</small>
              <p>{preview(conversation)}</p>
            </span>
            <time>{conversation.time}</time>
            {conversation.unread > 0 && (
              <i aria-label={`${conversation.unread} unread messages`}>
                {conversation.unread}
              </i>
            )}
          </button>
        ))}
        {visibleConversations.length === 0 && (
          <div className="conversation-empty">No conversations match.</div>
        )}
      </aside>
      {selectedConversation ? (
        <div className="chat-panel">
          <header>
            <button
              className="mobile-chat-back"
              onClick={returnToInbox}
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="avatar" aria-hidden="true">
              {selectedConversation.initials}
            </span>
            <div>
              <strong ref={conversationHeading} tabIndex={-1}>
                {selectedConversation.name}
              </strong>
              <small>{selectedConversation.property}</small>
            </div>
            <div className="chat-safety-actions">
              <button
                onClick={() =>
                  notify(
                    "Reporting is not connected in this prototype. No report has been submitted.",
                  )
                }
              >
                Report
              </button>
              <button
                aria-pressed={selectedConversation.blocked}
                onClick={() => {
                  setState((current) =>
                    updateConversation(
                      current,
                      selectedConversation.id,
                      (conversation) => ({
                        ...conversation,
                        blocked: !conversation.blocked,
                      }),
                    ),
                  );
                  setStatus(
                    selectedConversation.blocked
                      ? "Conversation unblocked in this tab."
                      : "Conversation blocked in this tab. Messages to real people are not affected.",
                  );
                }}
              >
                {selectedConversation.blocked ? "Unblock" : "Block"}
              </button>
            </div>
          </header>
          <div
            className="chat-body"
            ref={transcript}
            role="log"
            aria-label={`Conversation with ${selectedConversation.name}`}
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="chat-privacy-banner" id="message-local-note">
              <LockKeyhole size={16} />
              <span>
                <strong>
                  Sample inbox · {messageWorkspaceLabels[state.role]}
                </strong>
                <small>
                  Messages are not delivered to anyone. Your messages and drafts
                  are cleared when you reload this page.
                </small>
              </span>
            </div>
            {selectedConversation.messages.length === 0 ? (
              <div className="new-conversation-note">
                <MessageCircle size={25} />
                <strong>
                  Start a conversation with {selectedConversation.name}
                </strong>
                <p>
                  About {selectedConversation.property}. Write your first
                  message below.
                </p>
              </div>
            ) : (
              <span className="date-divider">
                {selectedConversation.messages.some(
                  (message) => !message.localOnly,
                )
                  ? "Sample history"
                  : "Messages in this tab"}
              </span>
            )}
            {selectedConversation.messages.map((message) => (
              <div className={`message ${message.direction}`} key={message.id}>
                <p>{message.text}</p>
                <time>
                  {message.time}
                  {message.localOnly ? " · Not delivered" : " · Example"}
                </time>
              </div>
            ))}
          </div>
          <form
            className="message-compose"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <button
              type="button"
              className="icon-button"
              disabled
              title="File sharing is not connected"
              aria-label="Attach a document (unavailable)"
            >
              <Paperclip size={20} />
            </button>
            <input
              ref={composer}
              placeholder={
                selectedConversation.blocked
                  ? "Unblock this conversation to write"
                  : "Write a message…"
              }
              aria-label={`Message ${selectedConversation.name}`}
              aria-describedby="message-local-note"
              disabled={selectedConversation.blocked}
              value={selectedConversation.draft}
              onChange={(event) => {
                const draft = event.target.value;
                setState((current) =>
                  updateConversation(
                    current,
                    selectedConversation.id,
                    (conversation) => ({ ...conversation, draft }),
                  ),
                );
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing)
                  event.preventDefault();
              }}
            />
            <button
              className="send-button"
              type="submit"
              disabled={
                !selectedConversation.draft.trim() ||
                selectedConversation.blocked
              }
              aria-label="Send message in this tab"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <div className="chat-empty">
          <MessageCircle size={27} />
          <strong>No conversation selected</strong>
          <span>Select a conversation to see messages.</span>
        </div>
      )}
      <span className="messages-status" role="status">
        {status}
      </span>
    </section>
  );
}
