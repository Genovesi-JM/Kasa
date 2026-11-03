import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCheck,
  CalendarDays,
  ChevronLeft,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldBan,
} from "lucide-react";
import { languages, type LanguageCode } from "../i18n";
import {
  AccountClientError,
  type PrivateAccount,
} from "../platform/accountClient";
import { workspaceRequest } from "../platform/workspaceClient";
import {
  privateConversationPageSchema,
  privateMessagesPageSchema,
  privateMessageMutationSchema,
  privateConversationMutationSchema,
  privateConversationReadSchema,
  type PrivateConversation,
  type PrivateMessage,
} from "../platform/localMarketplaceContracts";
import { privateMessagesCopy } from "./privateMessagesCopy";
import "./privateMessages.css";

const ConversationViewings = lazy(() => import("./ConversationViewings"));

interface Props {
  account: PrivateAccount;
  csrfToken: string;
  active: boolean;
  openConversationId?: string;
  onConversationOpened?: () => void;
  onSessionExpired: () => void;
  onSessionRefresh?: () => void;
  onWorkflowStateChange?: (busy: boolean, dirty: boolean) => void;
}
type CopyKey = keyof ReturnType<typeof privateMessagesCopy>;
type Thread = {
  conversation: PrivateConversation;
  messages: PrivateMessage[];
  nextBefore: number | null;
};
type Action =
  | {
      kind: "send";
      conversationId: string;
      body: { mutationId: string; body: string };
    }
  | {
      kind: "block";
      conversationId: string;
      body: { mutationId: string; version: number; blocked: boolean };
    };
type FocusTarget =
  | "thread"
  | "composer"
  | "feedback"
  | "retry"
  | "blockPrompt"
  | "blockControl"
  | "viewings"
  | "inbox";

function errorKey(cause: unknown): CopyKey {
  if (!(cause instanceof AccountClientError)) return "failed";
  if (cause.status === 404 || cause.code === "FORBIDDEN") return "unavailable";
  if (cause.code === "CONVERSATION_BLOCKED") return "blockedByOther";
  if (cause.code === "LIMIT_REACHED") return "limit";
  if (cause.code === "MUTATION_CONFLICT") return "conflict";
  if (cause.code === "VERSION_CONFLICT") return "refreshBeforeRetry";
  if (cause.status === 422) return "validation";
  if (cause.status === 429) return "rate";
  return "failed";
}
function mergeMessages(previous: PrivateMessage[], next: PrivateMessage[]) {
  return [
    ...new Map(
      [...previous, ...next].map((message) => [message.id, message]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);
}

/** A new identity gets a new in-memory cache; no drafts or messages enter browser storage. */
export default function PrivateMessages(props: Props) {
  return <MessagesForAccount key={props.account.id} {...props} />;
}

function MessagesForAccount({
  account,
  csrfToken,
  active,
  openConversationId,
  onConversationOpened,
  onSessionExpired,
  onSessionRefresh,
  onWorkflowStateChange,
}: Props) {
  const { i18n } = useTranslation();
  const language = (
    languages.some((item) => item.code === i18n.language) ? i18n.language : "pt"
  ) as LanguageCode;
  const copy = privateMessagesCopy(language);
  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<Action | null>(null);
  const [error, setError] = useState<CopyKey | null>(null);
  const [success, setSuccess] = useState<CopyKey | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);
  const [mustRefresh, setMustRefresh] = useState<string | null>(null);
  const [viewingTargetId, setViewingTargetId] = useState<string | null>(null);
  const [viewingsExpandedFor, setViewingsExpandedFor] = useState<string | null>(
    null,
  );
  const [viewingWorkflow, setViewingWorkflow] = useState({
    busy: false,
    dirty: false,
  });
  const viewingWorkflowRef = useRef({ busy: false, dirty: false });
  const onViewingWorkflow = useCallback((busy: boolean, dirty: boolean) => {
    viewingWorkflowRef.current = { busy, dirty };
    setViewingWorkflow((previous) =>
      previous.busy === busy && previous.dirty === dirty
        ? previous
        : { busy, dirty },
    );
  }, []);
  const [focusRequest, setFocusRequest] = useState<{
    target: FocusTarget;
    conversationId?: string;
    sequence: number;
  } | null>(null);
  const focusSequence = useRef(0);
  const focusedSequence = useRef(0);
  const threadHeading = useRef<HTMLHeadingElement | null>(null);
  const inboxHeading = useRef<HTMLHeadingElement | null>(null);
  const composer = useRef<HTMLTextAreaElement | null>(null);
  const errorFeedback = useRef<HTMLParagraphElement | null>(null);
  const successFeedback = useRef<HTMLParagraphElement | null>(null);
  const retryButton = useRef<HTMLButtonElement | null>(null);
  const blockPrompt = useRef<HTMLDivElement | null>(null);
  const blockControl = useRef<HTMLButtonElement | null>(null);
  const viewingPanel = useRef<HTMLElement | null>(null);
  const auth = useRef({ accountId: account.id, csrfToken });
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const retryRef = useRef<Action | null>(null);
  const selected = useRef<string | null>(null);
  const handledOpen = useRef<string | null>(null);
  const activeRef = useRef(active);
  const lastActivation = useRef(0);
  const workflowBusy = pending || retry !== null || viewingWorkflow.busy;
  const dirty =
    Object.values(drafts).some((value) => value.length > 0) ||
    retry !== null ||
    viewingWorkflow.dirty;
  const thread = selectedId ? threads[selectedId] : undefined;
  const conversation = thread?.conversation;
  const body = selectedId ? (drafts[selectedId] ?? "") : "";
  const readThrough = thread?.messages.at(-1)?.sequence ?? 0;
  const controlsDisabled = workflowBusy;
  const viewingConversation = viewingTargetId
    ? threads[viewingTargetId]?.conversation
    : undefined;
  const showViewings =
    !!conversation &&
    viewingsExpandedFor === conversation.id &&
    viewingTargetId === conversation.id;

  useEffect(() => {
    auth.current = { accountId: account.id, csrfToken };
  }, [account.id, csrfToken]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const requestFocus = useCallback(
    (target: FocusTarget, conversationId?: string) => {
      // A save completing in a hidden area must not steal focus now or on return.
      if (!activeRef.current) return;
      setFocusRequest({
        target,
        conversationId,
        sequence: ++focusSequence.current,
      });
    },
    [],
  );
  useEffect(() => {
    if (!focusRequest || focusedSequence.current === focusRequest.sequence)
      return;
    if (!active) {
      focusedSequence.current = focusRequest.sequence;
      return;
    }
    if (pending) return;
    const frame = window.requestAnimationFrame(() => {
      if (!activeRef.current) return;
      focusedSequence.current = focusRequest.sequence;
      const sameConversation =
        !focusRequest.conversationId ||
        selected.current === focusRequest.conversationId;
      const targets: Record<FocusTarget, HTMLElement | null> = {
        thread: threadHeading.current,
        composer: composer.current,
        feedback: errorFeedback.current ?? successFeedback.current,
        retry: retryButton.current,
        blockPrompt: blockPrompt.current,
        blockControl: blockControl.current,
        viewings: viewingPanel.current,
        inbox: inboxHeading.current,
      };
      const target = sameConversation
        ? targets[focusRequest.target]
        : targets.feedback;
      // getClientRects also rejects hidden ancestors and the mobile hidden pane.
      if (
        !target ||
        !target.isConnected ||
        !target.getClientRects().length ||
        target.matches(":disabled")
      )
        return;
      target.scrollIntoView({ block: "nearest", behavior: "instant" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, pending, focusRequest]);
  useEffect(() => {
    onWorkflowStateChange?.(workflowBusy, dirty);
    return () => onWorkflowStateChange?.(false, false);
  }, [workflowBusy, dirty, onWorkflowStateChange]);
  useEffect(() => {
    if (!dirty && !workflowBusy) return;
    const preventLoss = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty, workflowBusy]);
  useEffect(
    () => () => {
      controller.current?.abort();
      busy.current = false;
    },
    [],
  );

  const rememberRetry = useCallback((action: Action | null) => {
    retryRef.current = action;
    setRetry(action);
  }, []);
  const discardUnavailable = useCallback((id: string) => {
    setConversations((items) => items.filter((item) => item.id !== id));
    setThreads((items) => {
      const next = { ...items };
      delete next[id];
      return next;
    });
    // A removed conversation is not an authorised place to keep its draft visible.
    setDrafts((items) => {
      const next = { ...items };
      delete next[id];
      return next;
    });
    if (selected.current === id) {
      selected.current = null;
      setSelectedId(null);
    }
  }, []);
  const report = useCallback(
    (cause: unknown, id?: string) => {
      if (cause instanceof AccountClientError && cause.status === 401) {
        setConversations([]);
        setThreads({});
        setDrafts({});
        setNextOffset(null);
        selected.current = null;
        setSelectedId(null);
        rememberRetry(null);
        onSessionExpired();
        return;
      }
      if (cause instanceof AccountClientError && cause.code === "CSRF_DENIED") {
        setError("session");
        if (onSessionRefresh) onSessionRefresh();
        else onSessionExpired();
        return;
      }
      if (
        id &&
        cause instanceof AccountClientError &&
        (cause.status === 404 || cause.code === "FORBIDDEN")
      )
        discardUnavailable(id);
      setError(errorKey(cause));
    },
    [discardUnavailable, onSessionExpired, onSessionRefresh, rememberRetry],
  );
  const updateConversation = useCallback((value: PrivateConversation) => {
    setConversations((items) =>
      [value, ...items.filter((item) => item.id !== value.id)].sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
      ),
    );
    setThreads((items) =>
      items[value.id]
        ? { ...items, [value.id]: { ...items[value.id], conversation: value } }
        : items,
    );
  }, []);
  const fetchInbox = useCallback(
    async (signal: AbortSignal, offset?: number) => {
      const result = await workspaceRequest(
        `market/conversations${offset === undefined ? "" : `?offset=${offset}`}`,
        privateConversationPageSchema,
        { ...auth.current, signal },
      );
      if (signal.aborted) return;
      setConversations((previous) =>
        offset === undefined
          ? result.conversations
          : [
              ...new Map(
                [...previous, ...result.conversations].map((item) => [
                  item.id,
                  item,
                ]),
              ).values(),
            ],
      );
      setNextOffset(result.nextOffset);
      setLoaded(true);
    },
    [],
  );
  const fetchThread = useCallback(
    async (signal: AbortSignal, id: string, before?: number) => {
      const result = await workspaceRequest(
        `market/conversations/${encodeURIComponent(id)}/messages${before === undefined ? "" : `?before=${before}`}`,
        privateMessagesPageSchema,
        { ...auth.current, signal },
      );
      if (signal.aborted) return;
      if (result.conversation.id !== id)
        throw new AccountClientError(502, "invalid_response");
      updateConversation(result.conversation);
      setThreads((previous) => ({
        ...previous,
        [id]: {
          conversation: result.conversation,
          messages:
            before === undefined
              ? result.messages
              : mergeMessages(previous[id]?.messages ?? [], result.messages),
          nextBefore: result.nextBefore,
        },
      }));
      setMustRefresh((current) => (current === id ? null : current));
    },
    [updateConversation],
  );
  const read = useCallback(
    async (
      options: {
        id?: string;
        before?: number;
        offset?: number;
        select?: boolean;
        external?: boolean;
      } = {},
    ) => {
      if (busy.current || viewingWorkflowRef.current.busy) return;
      busy.current = true;
      setPending(true);
      setError(null);
      setSuccess(null);
      const task = new AbortController();
      controller.current = task;
      if (options.select && options.id) {
        selected.current = options.id;
        setSelectedId(options.id);
        setConfirmBlock(null);
      }
      let acknowledge = false;
      try {
        if (options.id)
          await fetchThread(task.signal, options.id, options.before);
        else await fetchInbox(task.signal, options.offset);
        if (!task.signal.aborted) {
          acknowledge = true;
          if (options.select && options.id) requestFocus("thread", options.id);
        }
      } catch (cause) {
        if (!task.signal.aborted) {
          report(cause, options.id);
          if (options.select) requestFocus("feedback");
          acknowledge =
            cause instanceof AccountClientError &&
            (cause.status === 404 || cause.status === 403);
        }
      } finally {
        if (controller.current === task) {
          busy.current = false;
          setPending(false);
        }
        if (options.external && acknowledge && !task.signal.aborted)
          onConversationOpened?.();
      }
    },
    [fetchInbox, fetchThread, report, onConversationOpened, requestFocus],
  );

  useEffect(() => {
    if (!active || busy.current || Date.now() - lastActivation.current < 20_000)
      return;
    const start = window.setTimeout(() => {
      if (busy.current) return;
      lastActivation.current = Date.now();
      void read();
    }, 0);
    return () => window.clearTimeout(start);
  }, [active, read]);
  useEffect(() => {
    if (
      !active ||
      !openConversationId ||
      pending ||
      viewingWorkflow.busy ||
      handledOpen.current === openConversationId
    )
      return;
    const start = window.setTimeout(() => {
      if (busy.current) return;
      handledOpen.current = openConversationId;
      void read({ id: openConversationId, select: true, external: true });
    }, 0);
    return () => window.clearTimeout(start);
  }, [active, openConversationId, pending, viewingWorkflow.busy, read]);
  useEffect(() => {
    if (!openConversationId) handledOpen.current = null;
  }, [openConversationId]);

  async function runAction(action: Action) {
    if (busy.current || viewingWorkflowRef.current.busy) return;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    const task = new AbortController();
    controller.current = task;
    // Save the complete immutable request before dispatch; never generate a new ID for a retry.
    rememberRetry(action);
    let committed = false;
    try {
      if (action.kind === "send") {
        const result = await workspaceRequest(
          `market/conversations/${action.conversationId}/messages`,
          privateMessageMutationSchema,
          {
            ...auth.current,
            signal: task.signal,
            method: "POST",
            body: action.body,
          },
        );
        if (task.signal.aborted) return;
        if (
          result.conversation.id !== action.conversationId ||
          !result.message.mine ||
          result.message.body !== action.body.body
        )
          throw new AccountClientError(502, "invalid_response");
        updateConversation(result.conversation);
        setThreads((previous) => ({
          ...previous,
          [action.conversationId]: {
            conversation: result.conversation,
            messages: mergeMessages(
              previous[action.conversationId]?.messages ?? [],
              [result.message],
            ),
            nextBefore: previous[action.conversationId]?.nextBefore ?? null,
          },
        }));
        setDrafts((previous) =>
          previous[action.conversationId]?.trim() === action.body.body
            ? { ...previous, [action.conversationId]: "" }
            : previous,
        );
        setSuccess("sent");
        committed = true;
        rememberRetry(null);
        // A newer own message can jump over incoming messages not yet loaded.
        // Re-read the actual page before allowing a read cursor to advance.
        setMustRefresh(action.conversationId);
        await fetchThread(task.signal, action.conversationId);
        requestFocus("composer", action.conversationId);
      } else {
        const result = await workspaceRequest(
          `market/conversations/${action.conversationId}/block`,
          privateConversationMutationSchema,
          {
            ...auth.current,
            signal: task.signal,
            method: "PATCH",
            body: action.body,
          },
        );
        if (task.signal.aborted) return;
        if (result.conversation.id !== action.conversationId)
          throw new AccountClientError(502, "invalid_response");
        updateConversation(result.conversation);
        setConfirmBlock(null);
        setSuccess("blockedSaved");
        requestFocus("blockControl", action.conversationId);
      }
      rememberRetry(null);
    } catch (cause) {
      if (!task.signal.aborted) {
        if (
          !committed &&
          cause instanceof AccountClientError &&
          (cause.status === 0 || cause.status >= 500)
        ) {
          setError("unknown");
          requestFocus("retry");
        } else if (
          cause instanceof AccountClientError &&
          cause.code === "CSRF_DENIED"
        ) {
          report(cause);
          requestFocus("retry");
        } else {
          rememberRetry(null);
          if (
            cause instanceof AccountClientError &&
            [
              "VERSION_CONFLICT",
              "MUTATION_CONFLICT",
              "CONVERSATION_BLOCKED",
            ].includes(cause.code)
          )
            setMustRefresh(action.conversationId);
          report(cause, action.conversationId);
          requestFocus("feedback");
        }
      }
    } finally {
      if (controller.current === task) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  function send(event: FormEvent) {
    event.preventDefault();
    if (
      !conversation ||
      controlsDisabled ||
      mustRefresh === conversation.id ||
      conversation.blockedByMe ||
      conversation.blockedByOther
    )
      return;
    const text = body.trim();
    if (!text || text.length > 2000) {
      setError("validation");
      requestFocus("feedback");
      return;
    }
    void runAction({
      kind: "send",
      conversationId: conversation.id,
      body: { mutationId: crypto.randomUUID(), body: text },
    });
  }
  function setBlock(blocked: boolean) {
    if (!conversation || controlsDisabled || mustRefresh === conversation.id)
      return;
    void runAction({
      kind: "block",
      conversationId: conversation.id,
      body: {
        mutationId: crypto.randomUUID(),
        version: conversation.version,
        blocked,
      },
    });
  }
  async function markReadThroughShown() {
    if (
      busy.current ||
      !conversation ||
      controlsDisabled ||
      mustRefresh === conversation.id ||
      !readThrough ||
      !activeRef.current
    )
      return;
    const id = conversation.id;
    // The monotonic cursor includes earlier history (possibly unloaded), but never
    // advances beyond the last rendered message to the server's unseen latestSequence.
    const throughSequence = readThrough;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    const task = new AbortController();
    controller.current = task;
    try {
      const result = await workspaceRequest(
        `market/conversations/${id}/read`,
        privateConversationReadSchema,
        {
          ...auth.current,
          signal: task.signal,
          method: "POST",
          body: { throughSequence },
        },
      );
      if (task.signal.aborted) return;
      if (result.conversation.id !== id)
        throw new AccountClientError(502, "invalid_response");
      updateConversation(result.conversation);
      setSuccess("readSaved");
    } catch (cause) {
      if (!task.signal.aborted) report(cause, id);
    } finally {
      if (controller.current === task) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  function timestamp(value: string) {
    return new Intl.DateTimeFormat(language, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  return (
    <section
      className="private-messages"
      hidden={!active}
      aria-busy={pending}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <header className="private-messages-heading">
        <div>
          <h1>
            <MessageCircle aria-hidden="true" />
            {copy.title}
          </h1>
          <p>{copy.note}</p>
        </div>
        <button
          type="button"
          className="pm-secondary"
          disabled={pending || viewingWorkflow.busy}
          onClick={() => void read()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
      </header>
      <p className="pm-privacy">
        <LockKeyhole size={16} aria-hidden="true" />
        {copy.privacy}
      </p>
      {error && (
        <p
          className="pm-feedback is-error"
          role="alert"
          ref={errorFeedback}
          tabIndex={-1}
        >
          {copy[error]}
        </p>
      )}
      {success && (
        <p
          className="pm-feedback"
          role="status"
          ref={successFeedback}
          tabIndex={-1}
        >
          {copy[success]}
        </p>
      )}
      {retry && !pending && (
        <div className="pm-retry" role="status">
          <p>{copy.unknown}</p>
          <button
            type="button"
            className="pm-primary"
            ref={retryButton}
            disabled={pending}
            onClick={() => {
              if (retryRef.current) void runAction(retryRef.current);
            }}
          >
            {pending ? copy.working : copy.retry}
          </button>
        </div>
      )}
      <div className={`pm-layout${selectedId ? " has-selection" : ""}`}>
        <aside className="pm-inbox" aria-label={copy.inbox}>
          <h2 ref={inboxHeading} tabIndex={-1}>
            {copy.inbox}
          </h2>
          {!loaded && pending ? (
            <p role="status">{copy.loading}</p>
          ) : conversations.length === 0 ? (
            <p className="pm-empty">{copy.empty}</p>
          ) : (
            <ul>
              {conversations.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={selectedId === item.id ? "is-selected" : ""}
                    aria-current={selectedId === item.id ? "true" : undefined}
                    disabled={pending || viewingWorkflow.busy}
                    onClick={() => void read({ id: item.id, select: true })}
                  >
                    <span className="pm-avatar" aria-hidden="true">
                      {item.counterpartName
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => [...part][0])
                        .join("")}
                    </span>
                    <span className="pm-inbox-text">
                      <strong>{item.counterpartName}</strong>
                      <span>{item.listingTitle}</span>
                      <small>
                        {drafts[item.id]
                          ? copy.draft
                          : item.lastMessage
                            ? `${item.lastMessage.mine ? `${copy.you}: ` : ""}${item.lastMessage.body}`
                            : copy.noMessages}
                      </small>
                    </span>
                    {item.unreadCount > 0 && (
                      <span
                        className="pm-unread"
                        aria-label={`${copy.unread}: ${item.unreadCount}`}
                      >
                        {item.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {nextOffset !== null && (
            <button
              type="button"
              className="pm-secondary pm-load"
              disabled={pending || viewingWorkflow.busy}
              onClick={() => void read({ offset: nextOffset })}
            >
              {copy.olderThreads}
            </button>
          )}
        </aside>
        <div className="pm-thread">
          {selectedId && (
            <button
              type="button"
              className="pm-back pm-secondary"
              disabled={pending || viewingWorkflow.busy}
              onClick={() => {
                selected.current = null;
                setSelectedId(null);
                setConfirmBlock(null);
                requestFocus("inbox");
              }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {copy.inbox}
            </button>
          )}
          {!conversation ? (
            <div className="pm-empty">
              <MessageCircle size={38} aria-hidden="true" />
              <h2>{pending && selectedId ? copy.loading : copy.choose}</h2>
              <p>{copy.chooseNote}</p>
            </div>
          ) : (
            <>
              <header className="pm-thread-heading">
                <div>
                  <h2 ref={threadHeading} tabIndex={-1}>
                    {conversation.counterpartName}
                  </h2>
                  <p>{conversation.listingTitle}</p>
                </div>
                <button
                  type="button"
                  className="pm-secondary"
                  disabled={pending || viewingWorkflow.busy}
                  onClick={() => void read({ id: conversation.id })}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  {copy.refreshThread}
                </button>
              </header>
              {conversation.listingStatus !== "visible" && (
                <p className="pm-feedback">{copy.closed}</p>
              )}
              {(conversation.blockedByMe || conversation.blockedByOther) && (
                <p className="pm-feedback is-warning">
                  {conversation.blockedByMe
                    ? copy.blockedByYou
                    : copy.blockedByOther}
                </p>
              )}
              <div className="pm-thread-actions">
                <button
                  type="button"
                  className="pm-secondary"
                  aria-expanded={showViewings}
                  aria-controls={`pm-viewings-${account.id}`}
                  disabled={controlsDisabled}
                  onClick={() => {
                    setConfirmBlock(null);
                    if (showViewings) {
                      setViewingsExpandedFor(null);
                      requestFocus("thread", conversation.id);
                    } else {
                      setViewingTargetId(conversation.id);
                      setViewingsExpandedFor(conversation.id);
                      requestFocus("viewings", conversation.id);
                    }
                  }}
                >
                  <CalendarDays size={15} aria-hidden="true" />
                  {copy.viewings}
                </button>
                <button
                  type="button"
                  className="pm-secondary"
                  ref={blockControl}
                  disabled={controlsDisabled || mustRefresh === conversation.id}
                  onClick={() => {
                    if (conversation.blockedByMe) setBlock(false);
                    else {
                      setConfirmBlock(conversation.id);
                      requestFocus("blockPrompt", conversation.id);
                    }
                  }}
                >
                  <ShieldBan size={15} aria-hidden="true" />
                  {conversation.blockedByMe ? copy.unblock : copy.block}
                </button>
                <button
                  type="button"
                  className="pm-secondary"
                  aria-describedby={`pm-read-note-${account.id}`}
                  hidden={showViewings}
                  disabled={
                    controlsDisabled ||
                    mustRefresh === conversation.id ||
                    !readThrough ||
                    conversation.unreadCount === 0
                  }
                  onClick={() => void markReadThroughShown()}
                >
                  <CheckCheck size={15} aria-hidden="true" />
                  {copy.markRead}
                </button>
              </div>
              <p
                hidden={showViewings}
                className="pm-read-note"
                id={`pm-read-note-${account.id}`}
              >
                {copy.readNote}
              </p>
              {confirmBlock === conversation.id && (
                <div
                  className="pm-confirm"
                  ref={blockPrompt}
                  tabIndex={-1}
                  role="group"
                  aria-label={copy.block}
                >
                  <p>{copy.blockPrompt}</p>
                  <button
                    type="button"
                    className="pm-secondary"
                    disabled={controlsDisabled}
                    onClick={() => {
                      setConfirmBlock(null);
                      requestFocus("blockControl", conversation.id);
                    }}
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    className="pm-primary"
                    disabled={controlsDisabled}
                    onClick={() => setBlock(true)}
                  >
                    {copy.confirmBlock}
                  </button>
                </div>
              )}
              <div hidden={showViewings}>
                {thread.nextBefore !== null && (
                  <button
                    type="button"
                    className="pm-secondary pm-load"
                    disabled={pending}
                    onClick={() =>
                      void read({
                        id: conversation.id,
                        before: thread.nextBefore!,
                      })
                    }
                  >
                    {copy.olderMessages}
                  </button>
                )}
                <ol className="pm-messages" aria-label={copy.title}>
                  {thread.messages.map((item) => (
                    <li key={item.id} className={item.mine ? "is-mine" : ""}>
                      <div className="pm-bubble">
                        <strong>
                          {item.mine ? copy.you : conversation.counterpartName}
                        </strong>
                        <p dir="auto">{item.body}</p>
                        <time dateTime={item.createdAt}>
                          {timestamp(item.createdAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
                {thread.messages.length === 0 && (
                  <p className="pm-empty">{copy.noMessages}</p>
                )}
                <form className="pm-composer" onSubmit={send}>
                  <label htmlFor={`pm-compose-${account.id}`}>
                    {copy.message}
                  </label>
                  <textarea
                    ref={composer}
                    id={`pm-compose-${account.id}`}
                    rows={3}
                    maxLength={2000}
                    value={body}
                    placeholder={copy.placeholder}
                    disabled={
                      controlsDisabled ||
                      conversation.blockedByMe ||
                      conversation.blockedByOther ||
                      mustRefresh === conversation.id
                    }
                    onChange={(event) =>
                      setDrafts((previous) => ({
                        ...previous,
                        [conversation.id]: event.target.value,
                      }))
                    }
                  />
                  <div>
                    <span>{body.length} / 2000</span>
                    <button
                      type="submit"
                      className="pm-primary"
                      disabled={
                        controlsDisabled ||
                        !body.trim() ||
                        conversation.blockedByMe ||
                        conversation.blockedByOther ||
                        mustRefresh === conversation.id
                      }
                    >
                      <Send size={16} aria-hidden="true" />
                      {pending ? copy.working : copy.send}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
          {viewingConversation && (
            <section
              id={`pm-viewings-${account.id}`}
              ref={viewingPanel}
              tabIndex={-1}
              className="pm-viewings-panel"
              hidden={!showViewings}
              aria-label={copy.viewings}
            >
              <button
                type="button"
                className="pm-secondary"
                disabled={viewingWorkflow.busy}
                onClick={() => {
                  setViewingsExpandedFor(null);
                  requestFocus("thread", selectedId ?? undefined);
                }}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                {copy.backToMessages}
              </button>
              <Suspense fallback={<p role="status">{copy.loadingViewings}</p>}>
                <ConversationViewings
                  account={account}
                  csrfToken={csrfToken}
                  conversation={viewingConversation}
                  active={active && showViewings}
                  onSessionExpired={onSessionExpired}
                  onSessionRefresh={onSessionRefresh}
                  onWorkflowStateChange={onViewingWorkflow}
                />
              </Suspense>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
