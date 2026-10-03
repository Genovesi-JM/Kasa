import {
  useCallback,
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
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import { matchesSearch } from "../search";
import {
  appendLocalMessage,
  messageView,
  resetMessageView,
  updateConversation,
  updateMessageView,
  type ChatConversation,
  type MessageState,
  type MessageView,
} from "./messageState";
import "./messages.css";
import { useMediaQuery } from "./useMediaQuery";
import { useOperationsI18n } from "./useOperationsI18n";
import type { OperationsMessage } from "../locales/operations/types";
import {
  messageCategoryKeys,
  messageContextKeys,
  messageSortKeys,
  messageTimeLabel,
  messageWorkspaceKeys,
} from "../locales/operations/messagesLabels";

interface MessagesProps {
  state: MessageState;
  setState: Dispatch<SetStateAction<MessageState>>;
  notify: (message: string) => void;
}

function isVisibleFocusTarget(
  target: HTMLElement | null,
): target is HTMLElement {
  return Boolean(
    target?.isConnected &&
    !target.matches(":disabled") &&
    !target.closest("[hidden], [inert], [aria-hidden='true']") &&
    target.getClientRects().length > 0 &&
    window.getComputedStyle(target).visibility === "visible",
  );
}

export function Messages({ state, setState, notify }: MessagesProps) {
  const { tr } = useOperationsI18n();
  const {
    query: conversationQuery,
    context: conversationContext,
    sort: conversationSort,
  } = messageView(state);
  const hasFilters =
    conversationQuery !== "" ||
    conversationContext !== "All conversations" ||
    conversationSort !== "Most recent";
  const [status, setStatus] = useState<OperationsMessage | null>(null);
  const messagesRoot = useRef<HTMLElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  const inboxSearch = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const conversationHeading = useRef<HTMLElement>(null);
  const conversationButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<number | null>(null);
  const selectedConversation = state.conversations.find(
    (item) => item.id === state.selectedId,
  );
  const isMobileInbox = useMediaQuery("(max-width: 720px)");
  const selectedConversationId = selectedConversation?.id;
  const scheduleFocus = useCallback(
    (
      target: "conversation" | "inbox",
      role: MessageState["role"],
      id: string,
    ) => {
      if (pendingFocus.current !== null)
        cancelAnimationFrame(pendingFocus.current);
      const previousFocus = document.activeElement;
      const frame = requestAnimationFrame(() => {
        if (pendingFocus.current !== frame) return;
        pendingFocus.current = null;
        const root = messagesRoot.current;
        if (
          !root?.isConnected ||
          root.dataset.messageRole !== role ||
          root.dataset.conversationId !== id ||
          root.dataset.conversationOpen !== String(target === "conversation")
        )
          return;
        const heading = conversationHeading.current;
        const row = conversationButtons.current.get(id) ?? null;
        const destination =
          target === "conversation"
            ? heading?.dataset.conversationId === id
              ? heading
              : null
            : isVisibleFocusTarget(row)
              ? row
              : inboxSearch.current;
        if (!isVisibleFocusTarget(destination)) return;
        const active = document.activeElement;
        if (
          active !== previousFocus &&
          active instanceof HTMLElement &&
          active !== document.body &&
          active !== document.documentElement &&
          isVisibleFocusTarget(active)
        )
          return;
        destination.focus({ preventScroll: true });
      });
      pendingFocus.current = frame;
      return frame;
    },
    [],
  );
  useEffect(() => {
    if (
      !state.conversationOpen ||
      !selectedConversationId ||
      document.activeElement === composer.current
    )
      return;
    const frame = scheduleFocus(
      "conversation",
      state.role,
      selectedConversationId,
    );
    // Cancel this handoff only; Back may already have scheduled a newer one.
    return () => cancelAnimationFrame(frame);
  }, [
    state.role,
    selectedConversationId,
    state.conversationOpen,
    scheduleFocus,
  ]);
  useEffect(
    () => () => {
      if (pendingFocus.current !== null)
        cancelAnimationFrame(pendingFocus.current);
    },
    [],
  );
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
    if (conversation.draft)
      return `${tr("messages_draftPrefix")} ${conversation.draft}`;
    const lastMessage = conversation.messages.at(-1);
    return lastMessage
      ? `${lastMessage.direction === "sent" ? `${tr("messages_youPrefix")} ` : ""}${lastMessage.text}`
      : tr("messages_noMessages");
  };
  const visibleConversations = state.conversations
    .filter((conversation) => {
      const matchesQuery = matchesSearch(
        conversationQuery,
        conversation.name,
        conversation.property,
        conversation.category,
        tr(messageCategoryKeys[conversation.category]),
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
    setStatus(null);
    scheduleFocus("conversation", state.role, id);
  }

  function send() {
    if (!selectedConversation?.draft.trim() || selectedConversation.blocked)
      return;
    setState((current) => appendLocalMessage(current, selectedConversation.id));
    setStatus({ key: "messages_savedFeedback" });
    composer.current?.focus({ preventScroll: true });
  }

  function returnToInbox() {
    setState((current) => ({ ...current, conversationOpen: false }));
    scheduleFocus("inbox", state.role, state.selectedId);
  }

  return (
    <section
      ref={messagesRoot}
      className={`messages-layout card ${state.conversationOpen ? "chat-open" : ""}`}
      aria-label={tr("messages_title")}
      data-message-role={state.role}
      data-conversation-id={state.selectedId}
      data-conversation-open={state.conversationOpen}
    >
      <aside
        className="conversation-list"
        aria-label={tr("messages_conversations")}
      >
        <div className="conversation-search">
          <Search size={17} />
          <input
            ref={inboxSearch}
            placeholder={tr("messages_search")}
            aria-label={tr("messages_search")}
            value={conversationQuery}
            maxLength={200}
            onChange={(event) => {
              const query = event.currentTarget.value;
              setState((current) => updateMessageView(current, { query }));
            }}
          />
        </div>
        <div className="conversation-filters">
          <select
            aria-label={tr("messages_filterContext")}
            value={conversationContext}
            onChange={(event) => {
              const context = event.currentTarget
                .value as MessageView["context"];
              setState((current) => updateMessageView(current, { context }));
            }}
          >
            <option value="All conversations">
              {tr(messageContextKeys["All conversations"])}
            </option>
            <option value="Unread">{tr(messageContextKeys.Unread)}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {tr(messageContextKeys[category])}
              </option>
            ))}
          </select>
          <select
            aria-label={tr("messages_sort")}
            value={conversationSort}
            onChange={(event) => {
              const sort = event.currentTarget.value as MessageView["sort"];
              setState((current) => updateMessageView(current, { sort }));
            }}
          >
            <option value="Most recent">
              {tr(messageSortKeys["Most recent"])}
            </option>
            <option value="Unread first">
              {tr(messageSortKeys["Unread first"])}
            </option>
          </select>
          <button
            type="button"
            className="conversation-reset"
            aria-label={tr("messages_resetFiltersLabel")}
            disabled={!hasFilters}
            onClick={() => {
              setState((current) => resetMessageView(current));
              inboxSearch.current?.focus({ preventScroll: true });
            }}
          >
            <RotateCcw size={13} aria-hidden="true" />
            {tr("messages_resetFilters")}
          </button>
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
              <strong dir="auto">{conversation.name}</strong>
              <small dir="auto">{conversation.property}</small>
              <p dir="auto">{preview(conversation)}</p>
            </span>
            <time>{messageTimeLabel(conversation.time, tr)}</time>
            {conversation.unread > 0 && (
              <i
                aria-label={tr("messages_unreadCount", {
                  count: conversation.unread,
                })}
              >
                {conversation.unread}
              </i>
            )}
          </button>
        ))}
        {visibleConversations.length === 0 && (
          <div className="conversation-empty">{tr("messages_noMatches")}</div>
        )}
      </aside>
      {selectedConversation ? (
        <div className="chat-panel">
          <header>
            <button
              className="mobile-chat-back"
              onClick={returnToInbox}
              aria-label={tr("messages_back")}
            >
              <ArrowLeft size={18} />
            </button>
            <span className="avatar" aria-hidden="true">
              {selectedConversation.initials}
            </span>
            <div>
              <strong
                ref={conversationHeading}
                tabIndex={-1}
                data-conversation-id={selectedConversation.id}
                dir="auto"
              >
                {selectedConversation.name}
              </strong>
              <small dir="auto">{selectedConversation.property}</small>
            </div>
            <div className="chat-safety-actions">
              <button onClick={() => notify(tr("messages_reportUnavailable"))}>
                {tr("messages_report")}
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
                  setStatus({
                    key: selectedConversation.blocked
                      ? "messages_unblockedFeedback"
                      : "messages_blockedFeedback",
                  });
                }}
              >
                {tr(
                  selectedConversation.blocked
                    ? "messages_unblock"
                    : "messages_block",
                )}
              </button>
            </div>
          </header>
          <div
            className="chat-body"
            ref={transcript}
            role="log"
            aria-label={tr("messages_conversationWith", {
              name: selectedConversation.name,
            })}
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="chat-privacy-banner" id="message-local-note">
              <LockKeyhole size={16} />
              <span>
                <strong>
                  {tr("messages_sampleInbox")} ·{" "}
                  {tr(messageWorkspaceKeys[state.role])}
                </strong>
                <small>{tr("messages_sessionScope")}</small>
              </span>
            </div>
            {selectedConversation.messages.length === 0 ? (
              <div className="new-conversation-note">
                <MessageCircle size={25} />
                <strong>
                  {tr("messages_startConversation", {
                    name: selectedConversation.name,
                  })}
                </strong>
                <p>
                  {tr("messages_startHint", {
                    property: selectedConversation.property,
                  })}
                </p>
              </div>
            ) : (
              <span className="date-divider">
                {selectedConversation.messages.some(
                  (message) => !message.localOnly,
                )
                  ? tr("messages_sampleHistory")
                  : tr("messages_localHistory")}
              </span>
            )}
            {selectedConversation.messages.map((message) => (
              <div className={`message ${message.direction}`} key={message.id}>
                <p dir="auto">{message.text}</p>
                <time>
                  {message.time}
                  {" · "}
                  {tr(
                    message.localOnly
                      ? "messages_notDelivered"
                      : "messages_example",
                  )}
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
              title={tr("messages_attachmentUnavailable")}
              aria-label={tr("messages_attachDocumentUnavailable")}
            >
              <Paperclip size={20} />
            </button>
            <input
              ref={composer}
              placeholder={
                selectedConversation.blocked
                  ? tr("messages_blockedPlaceholder")
                  : tr("messages_composePlaceholder")
              }
              aria-label={tr("messages_messageName", {
                name: selectedConversation.name,
              })}
              aria-describedby="message-local-note"
              disabled={selectedConversation.blocked}
              value={selectedConversation.draft}
              dir="auto"
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
              aria-label={tr("messages_sendLocal")}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <div className="chat-empty">
          <MessageCircle size={27} />
          <strong>{tr("messages_noSelection")}</strong>
          <span>{tr("messages_selectConversation")}</span>
        </div>
      )}
      <span className="messages-status" role="status">
        {status ? tr(status.key, status.values) : null}
      </span>
    </section>
  );
}
