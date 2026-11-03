import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Clock3, History, RefreshCw } from "lucide-react";
import { languages, type LanguageCode } from "../i18n";
import {
  AccountClientError,
  type PrivateAccount,
} from "../platform/accountClient";
import { workspaceRequest } from "../platform/workspaceClient";
import type { PrivateConversation } from "../platform/localMarketplaceContracts";
import {
  savedViewingPageSchema,
  savedViewingDetailSchema,
  savedViewingMutationSchema,
  savedViewingCreateInputSchema,
  savedViewingActionInputSchema,
  viewingDurationSchema,
  viewingLocalToUtc,
  viewingUtcToLocal,
  viewingTimeZone,
  maxViewingAdvanceDays,
  isActiveSavedViewing,
  type SavedViewing,
  type SavedViewingDetail,
  type SavedViewingCreateInput,
  type SavedViewingActionInput,
  type SavedViewingEvent,
} from "../platform/persistedViewingContracts";
import { conversationViewingsCopy } from "./conversationViewingsCopy";
import "./conversationViewings.css";

interface Props {
  account: PrivateAccount;
  csrfToken: string;
  active: boolean;
  conversation: PrivateConversation;
  onSessionExpired: () => void;
  onSessionRefresh?: () => void;
  onWorkflowStateChange?: (busy: boolean, dirty: boolean) => void;
}
type Copy = ReturnType<typeof conversationViewingsCopy>;
type CopyKey = keyof Copy;
type Mode = "create" | SavedViewingActionInput["action"];
type Fields = { startsLocal: string; duration: string; note: string };
type Editor = {
  mode: Mode;
  base: SavedViewing | null;
  fields: Fields;
  original: string;
  open: boolean;
  conflict: boolean;
};
type Page = {
  viewings: SavedViewing[];
  total: number;
  nextOffset: number | null;
};
type Write = {
  conversationId: string;
  listingTitle: string;
  viewingId: string | null;
  path: string;
  body: SavedViewingCreateInput | SavedViewingActionInput;
};
type ReplaceDraft =
  | { conversationId: string; kind: "editor"; editor: Editor }
  | { conversationId: string; kind: "reload"; viewingId: string };
type Feedback = { conversationId: string; key: CopyKey } | null;
type FocusTarget = "editor" | "feedback" | "retry" | "replace" | "records";
const minute = 60_000;
const advance = maxViewingAdvanceDays * 24 * 60 * minute;
const headings: Record<Mode, CopyKey> = {
  create: "newHeading",
  propose: "proposeHeading",
  confirm: "confirmHeading",
  accept: "acceptHeading",
  decline: "declineHeading",
  cancel: "cancelHeading",
};
const submitLabels: Record<Mode, CopyKey> = {
  create: "saveRequest",
  propose: "saveProposal",
  confirm: "saveConfirm",
  accept: "saveAccept",
  decline: "saveDecline",
  cancel: "saveCancel",
};
const eventLabels: Record<SavedViewingEvent["action"], CopyKey> = {
  request: "created",
  propose: "proposed",
  confirm: "confirmed",
  accept: "accepted",
  decline: "declined",
  cancel: "cancelled",
};
function createEditor(mode: Mode, base: SavedViewing | null): Editor {
  const fields = {
    startsLocal: base ? viewingUtcToLocal(base.startsAt) : "",
    duration: String(base?.durationMinutes ?? 60),
    note: "",
  };
  return {
    mode,
    base,
    fields,
    original: JSON.stringify(fields),
    open: true,
    conflict: false,
  };
}
function isDirty(editor: Editor | undefined) {
  return !!editor && JSON.stringify(editor.fields) !== editor.original;
}
function errorKey(cause: unknown): CopyKey {
  if (!(cause instanceof AccountClientError)) return "failed";
  if (cause.status === 401 || cause.code === "CSRF_DENIED") return "session";
  if (cause.status === 404 || cause.code === "FORBIDDEN") return "unavailable";
  if (cause.code === "VERSION_CONFLICT") return "conflict";
  if (cause.code === "LIMIT_REACHED") return "limit";
  if (cause.code === "SLOT_CONFLICT") return "slotConflict";
  if (cause.code === "ACTIVE_VIEWING_EXISTS") return "activeExists";
  if (cause.code === "CONVERSATION_BLOCKED") return "blocked";
  if (
    cause.code === "LISTING_UNAVAILABLE" ||
    cause.code === "LISTING_NOT_VISIBLE"
  )
    return "closed";
  if (cause.code === "INVALID_TRANSITION" || cause.code === "INVALID_STATE")
    return "invalidState";
  if (
    cause.code === "MUTATION_CONFLICT" ||
    cause.code === "IDEMPOTENCY_CONFLICT"
  )
    return "mutationConflict";
  if (cause.status === 422) return "validation";
  if (cause.status === 429) return "rate";
  return "failed";
}
function eligibleActions(
  viewing: SavedViewing,
  blocked: boolean,
  now: number,
): Mode[] {
  const actions: Mode[] = [];
  const pending =
    viewing.status === "requested" || viewing.status === "proposed";
  const future = Date.parse(viewing.startsAt) > now;
  if (viewing.isListingOwner && pending) {
    if (!blocked) {
      if (viewing.status === "requested" && future) actions.push("confirm");
      actions.push("propose");
    }
    actions.push("decline");
  }
  if (
    !viewing.isListingOwner &&
    viewing.status === "proposed" &&
    !blocked &&
    future
  )
    actions.push("accept");
  if (pending || viewing.status === "confirmed") actions.push("cancel");
  return actions;
}
function assertDetail(
  detail: SavedViewingDetail,
  conversationId: string,
  viewingId?: string,
) {
  if (
    detail.viewing.conversationId !== conversationId ||
    (viewingId && detail.viewing.id !== viewingId)
  )
    throw new AccountClientError(502, "invalid_response");
}

/** A new account identity must never inherit another account's cached appointments or drafts. */
export default function ConversationViewings(props: Props) {
  return <ViewingsForAccount key={props.account.id} {...props} />;
}

function ViewingsForAccount({
  account,
  csrfToken,
  active,
  conversation,
  onSessionExpired,
  onSessionRefresh,
  onWorkflowStateChange,
}: Props) {
  const { i18n } = useTranslation();
  const language = (
    languages.some((item) => item.code === i18n.language) ? i18n.language : "pt"
  ) as LanguageCode;
  const copy = conversationViewingsCopy(language);
  const id = useId();
  const [pages, setPages] = useState<Record<string, Page>>({});
  const [details, setDetails] = useState<Record<string, SavedViewingDetail>>(
    {},
  );
  const [editors, setEditors] = useState<Record<string, Editor>>({});
  const [historyOpen, setHistoryOpen] = useState<Record<string, string | null>>(
    {},
  );
  const expandedHistory = useRef(historyOpen);
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<Write | null>(null);
  const [replaceDraft, setReplaceDraft] = useState<ReplaceDraft | null>(null);
  const [error, setError] = useState<Feedback>(null);
  const [success, setSuccess] = useState<Feedback>(null);
  const [now, setNow] = useState(Date.now);
  const [focusRequest, setFocusRequest] = useState<{
    target: FocusTarget;
    conversationId: string;
    sequence: number;
  } | null>(null);
  const focusSequence = useRef(0);
  const handledFocus = useRef(0);
  const editorElement = useRef<HTMLFormElement>(null);
  const errorElement = useRef<HTMLParagraphElement>(null);
  const successElement = useRef<HTMLParagraphElement>(null);
  const retryElement = useRef<HTMLDivElement>(null);
  const replaceElement = useRef<HTMLDivElement>(null);
  const recordsElement = useRef<HTMLDivElement>(null);
  const auth = useRef({ accountId: account.id, csrfToken });
  const context = useRef({ active, conversation });
  const drafts = useRef(editors);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const retryRef = useRef<Write | null>(null);
  const lastActivation = useRef<string | null>(null);
  const page = pages[conversation.id];
  const editor = editors[conversation.id];
  const blockedConversation =
    conversation.blockedByMe || conversation.blockedByOther;
  const blocked = pending || retry !== null || replaceDraft !== null;
  const dirty = Object.values(editors).some(isDirty) || retry !== null;
  const hasActive =
    page?.viewings.some((viewing) => isActiveSavedViewing(viewing, now)) ??
    false;
  const canCreate =
    !conversation.isListingOwner &&
    conversation.listingStatus === "visible" &&
    !blockedConversation &&
    !hasActive;
  const currentRecord = editor?.base
    ? (page?.viewings.find((viewing) => viewing.id === editor.base?.id) ??
      editor.base)
    : null;
  const allowedEditor =
    editor?.mode === "create"
      ? canCreate
      : !!editor &&
        !!currentRecord &&
        eligibleActions(currentRecord, blockedConversation, now).includes(
          editor.mode,
        );
  const timeFormatter = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: viewingTimeZone,
  });
  const formatTime = (value: string) => timeFormatter.format(new Date(value));
  const updateEditors = useCallback(
    (updater: (previous: Record<string, Editor>) => Record<string, Editor>) => {
      setEditors((previous) => {
        const next = updater(previous);
        drafts.current = next;
        return next;
      });
    },
    [],
  );
  const updatePages = useCallback(
    (updater: (previous: Record<string, Page>) => Record<string, Page>) => {
      setPages(updater);
    },
    [],
  );
  useEffect(() => {
    auth.current = { accountId: account.id, csrfToken };
  }, [account.id, csrfToken]);
  useEffect(() => {
    context.current = { active, conversation };
  }, [active, conversation]);
  useEffect(() => {
    expandedHistory.current = historyOpen;
  }, [historyOpen]);
  useEffect(() => {
    if (
      !replaceDraft ||
      (active && replaceDraft.conversationId === conversation.id)
    )
      return;
    const timer = window.setTimeout(() => setReplaceDraft(null), 0);
    return () => window.clearTimeout(timer);
  }, [active, conversation.id, replaceDraft]);
  useEffect(() => {
    onWorkflowStateChange?.(
      pending || retry !== null || replaceDraft !== null,
      dirty,
    );
    return () => onWorkflowStateChange?.(false, false);
  }, [pending, retry, replaceDraft, dirty, onWorkflowStateChange]);
  useEffect(() => {
    if (!dirty && !pending) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, pending]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), minute);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(
    () => () => {
      controller.current?.abort();
      busy.current = false;
    },
    [],
  );
  const requestFocus = useCallback(
    (target: FocusTarget, conversationId: string) => {
      if (
        !context.current.active ||
        context.current.conversation.id !== conversationId
      )
        return;
      setFocusRequest({
        target,
        conversationId,
        sequence: ++focusSequence.current,
      });
    },
    [],
  );
  useEffect(() => {
    if (!focusRequest || focusRequest.sequence === handledFocus.current) return;
    if (!active || conversation.id !== focusRequest.conversationId) {
      handledFocus.current = focusRequest.sequence;
      return;
    }
    if (pending) return;
    handledFocus.current = focusRequest.sequence;
    const targets = {
      editor: editorElement.current,
      feedback: errorElement.current ?? successElement.current,
      retry: retryElement.current,
      replace: replaceElement.current,
      records: recordsElement.current,
    };
    const element = targets[focusRequest.target];
    if (!element?.getClientRects().length || element.closest("[hidden]"))
      return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [active, conversation.id, focusRequest, pending]);
  const rememberRetry = useCallback((action: Write | null) => {
    retryRef.current = action;
    setRetry(action);
  }, []);
  const clearScope = useCallback(
    (conversationId?: string, viewingId?: string) => {
      updatePages((previous) => {
        if (!conversationId) return {};
        const next = { ...previous };
        if (!viewingId) delete next[conversationId];
        else if (next[conversationId])
          next[conversationId] = {
            ...next[conversationId],
            viewings: next[conversationId].viewings.filter(
              (item) => item.id !== viewingId,
            ),
          };
        return next;
      });
      updateEditors((previous) => {
        if (!conversationId) return {};
        const next = { ...previous };
        if (!viewingId || next[conversationId]?.base?.id === viewingId)
          delete next[conversationId];
        return next;
      });
      setDetails((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([, detail]) =>
              conversationId &&
              (detail.viewing.conversationId !== conversationId ||
                (viewingId && detail.viewing.id !== viewingId)),
          ),
        ),
      );
      setReplaceDraft(null);
    },
    [updateEditors, updatePages],
  );
  const report = useCallback(
    (
      cause: unknown,
      conversationId: string,
      viewingId?: string,
      attention = false,
    ) => {
      if (cause instanceof AccountClientError && cause.status === 401) {
        clearScope();
        rememberRetry(null);
        onSessionExpired();
        return;
      }
      if (cause instanceof AccountClientError && cause.code === "CSRF_DENIED")
        onSessionRefresh?.();
      if (
        cause instanceof AccountClientError &&
        (cause.status === 404 || cause.code === "FORBIDDEN")
      )
        clearScope(conversationId, viewingId);
      setError({ conversationId, key: errorKey(cause) });
      if (attention) requestFocus("feedback", conversationId);
    },
    [
      clearScope,
      rememberRetry,
      onSessionExpired,
      onSessionRefresh,
      requestFocus,
    ],
  );
  const mergeDetail = useCallback(
    (detail: SavedViewingDetail) => {
      const record = detail.viewing;
      setDetails((previous) => ({ ...previous, [record.id]: detail }));
      updatePages((previous) => {
        const existing = previous[record.conversationId];
        if (!existing) return previous;
        return {
          ...previous,
          [record.conversationId]: {
            ...existing,
            viewings: existing.viewings.map((item) =>
              item.id === record.id ? record : item,
            ),
          },
        };
      });
      updateEditors((previous) => {
        const draft = previous[record.conversationId];
        if (
          !draft?.base ||
          draft.base.id !== record.id ||
          draft.base.version === record.version
        )
          return previous;
        return {
          ...previous,
          [record.conversationId]: { ...draft, conflict: true },
        };
      });
    },
    [updateEditors, updatePages],
  );

  const readPage = useCallback(
    async (conversationId: string, offset = 0) => {
      if (busy.current || retryRef.current) return;
      const task = new AbortController();
      controller.current?.abort();
      controller.current = task;
      busy.current = true;
      setPending(true);
      setError(null);
      try {
        const result = await workspaceRequest(
          `market/conversations/${conversationId}/viewings?offset=${offset}&limit=20`,
          savedViewingPageSchema,
          { ...auth.current, signal: task.signal },
        );
        if (task.signal.aborted) return;
        if (
          result.viewings.some(
            (record) => record.conversationId !== conversationId,
          )
        )
          throw new AccountClientError(502, "invalid_response");
        updatePages((previous) => ({
          ...previous,
          [conversationId]: {
            ...result,
            viewings: offset
              ? [
                  ...new Map(
                    [
                      ...(previous[conversationId]?.viewings ?? []),
                      ...result.viewings,
                    ].map((record) => [record.id, record]),
                  ).values(),
                ]
              : result.viewings,
          },
        }));
        const draft = drafts.current[conversationId];
        if (draft?.base) {
          const latest = result.viewings.find(
            (record) => record.id === draft.base?.id,
          );
          if (latest && latest.version !== draft.base.version)
            updateEditors((previous) =>
              previous[conversationId]
                ? {
                    ...previous,
                    [conversationId]: {
                      ...previous[conversationId],
                      conflict: true,
                    },
                  }
                : previous,
            );
        }
        setNow(Date.now());
        // Only one history is expanded per conversation. Refresh that detail as
        // part of the same read, without a request burst or a focus change.
        const expandedId = expandedHistory.current[conversationId];
        if (
          expandedId &&
          result.viewings.some((record) => record.id === expandedId)
        ) {
          try {
            const detail = await workspaceRequest(
              `market/viewings/${expandedId}`,
              savedViewingDetailSchema,
              { ...auth.current, signal: task.signal },
            );
            if (task.signal.aborted) return;
            assertDetail(detail, conversationId, expandedId);
            mergeDetail(detail);
          } catch (cause) {
            if (!task.signal.aborted) report(cause, conversationId, expandedId);
          }
        }
      } catch (cause) {
        if (!task.signal.aborted) report(cause, conversationId);
      } finally {
        if (controller.current === task) {
          busy.current = false;
          setPending(false);
        }
      }
    },
    [mergeDetail, report, updateEditors, updatePages],
  );
  useEffect(() => {
    if (!active) {
      lastActivation.current = null;
      return;
    }
    if (pending || retry || lastActivation.current === conversation.id) return;
    const timer = window.setTimeout(() => {
      lastActivation.current = conversation.id;
      void readPage(conversation.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, conversation.id, pending, readPage, retry]);
  useEffect(() => {
    const refresh = () => {
      if (context.current.active && document.visibilityState === "visible")
        void readPage(context.current.conversation.id);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [readPage]);
  async function readDetail(
    conversationId: string,
    viewingId: string,
    discard = false,
  ) {
    if (busy.current || retryRef.current) return;
    const task = new AbortController();
    controller.current?.abort();
    controller.current = task;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await workspaceRequest(
        `market/viewings/${viewingId}`,
        savedViewingDetailSchema,
        { ...auth.current, signal: task.signal },
      );
      if (task.signal.aborted) return;
      assertDetail(result, conversationId, viewingId);
      mergeDetail(result);
      if (discard) {
        updateEditors((previous) => {
          const next = { ...previous };
          delete next[conversationId];
          return next;
        });
        requestFocus("records", conversationId);
      }
    } catch (cause) {
      if (!task.signal.aborted) report(cause, conversationId, viewingId, true);
    } finally {
      if (controller.current === task) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  function beginEditor(mode: Mode, base: SavedViewing | null) {
    if (blocked) return;
    if (editor?.mode === mode && editor.base?.id === base?.id) {
      updateEditors((previous) => ({
        ...previous,
        [conversation.id]: { ...previous[conversation.id], open: true },
      }));
      requestFocus("editor", conversation.id);
      return;
    }
    const next = createEditor(mode, base);
    if (isDirty(editor)) {
      setReplaceDraft({
        kind: "editor",
        conversationId: conversation.id,
        editor: next,
      });
      requestFocus("replace", conversation.id);
    } else {
      updateEditors((previous) => ({ ...previous, [conversation.id]: next }));
      setError(null);
      setSuccess(null);
      requestFocus("editor", conversation.id);
    }
  }
  async function write(action: Write) {
    if (busy.current) return;
    const task = new AbortController();
    controller.current?.abort();
    controller.current = task;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    rememberRetry(action);
    try {
      const result = await workspaceRequest(
        action.path,
        savedViewingMutationSchema,
        {
          ...auth.current,
          signal: task.signal,
          method: "POST",
          body: action.body,
        },
      );
      if (task.signal.aborted) return;
      assertDetail(
        result,
        action.conversationId,
        action.viewingId ?? undefined,
      );
      mergeDetail(result);
      updatePages((previous) => {
        const old = previous[action.conversationId] ?? {
          viewings: [],
          total: 0,
          nextOffset: null,
        };
        const known = old.viewings.some(
          (item) => item.id === result.viewing.id,
        );
        return {
          ...previous,
          [action.conversationId]: {
            ...old,
            viewings: known
              ? old.viewings.map((item) =>
                  item.id === result.viewing.id ? result.viewing : item,
                )
              : [result.viewing, ...old.viewings],
            total: old.total + (!known && !action.viewingId ? 1 : 0),
            nextOffset:
              old.nextOffset === null
                ? null
                : old.nextOffset + (!known && !action.viewingId ? 1 : 0),
          },
        };
      });
      updateEditors((previous) => {
        const next = { ...previous };
        delete next[action.conversationId];
        return next;
      });
      rememberRetry(null);
      setSuccess({ conversationId: action.conversationId, key: "saved" });
      requestFocus("feedback", action.conversationId);
    } catch (cause) {
      if (task.signal.aborted) return;
      if (
        cause instanceof AccountClientError &&
        (cause.status === 0 || cause.status >= 500)
      ) {
        requestFocus("retry", context.current.conversation.id);
      } else {
        rememberRetry(null);
        if (
          cause instanceof AccountClientError &&
          action.viewingId &&
          ["VERSION_CONFLICT", "INVALID_TRANSITION", "INVALID_STATE"].includes(
            cause.code,
          )
        ) {
          updateEditors((previous) =>
            previous[action.conversationId]
              ? {
                  ...previous,
                  [action.conversationId]: {
                    ...previous[action.conversationId],
                    conflict: true,
                    open: true,
                  },
                }
              : previous,
          );
        }
        report(
          cause,
          action.conversationId,
          action.viewingId ?? undefined,
          true,
        );
      }
    } finally {
      if (controller.current === task) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editor || blocked || editor.conflict || !allowedEditor) return;
    const startsAt = viewingLocalToUtc(editor.fields.startsLocal);
    const timed = editor.mode === "create" || editor.mode === "propose";
    const currentNow = Date.now();
    if (
      timed &&
      (!startsAt ||
        Date.parse(startsAt) <= currentNow ||
        Date.parse(startsAt) > currentNow + advance)
    ) {
      setError({ conversationId: conversation.id, key: "invalidTime" });
      requestFocus("feedback", conversation.id);
      return;
    }
    const body = {
      mutationId: crypto.randomUUID(),
      note: editor.fields.note,
      ...(timed
        ? { startsAt, durationMinutes: Number(editor.fields.duration) }
        : {}),
      ...(editor.mode === "create"
        ? {}
        : { version: editor.base?.version, action: editor.mode }),
    };
    const parsed =
      editor.mode === "create"
        ? savedViewingCreateInputSchema.safeParse(body)
        : savedViewingActionInputSchema.safeParse(body);
    if (
      !parsed.success ||
      !viewingDurationSchema.safeParse(Number(editor.fields.duration)).success
    ) {
      setError({ conversationId: conversation.id, key: "validation" });
      requestFocus("feedback", conversation.id);
      return;
    }
    void write({
      conversationId: conversation.id,
      listingTitle: conversation.listingTitle,
      viewingId: editor.base?.id ?? null,
      path: editor.base
        ? `market/viewings/${editor.base.id}/actions`
        : `market/conversations/${conversation.id}/viewings`,
      body: parsed.data,
    });
  }
  function patchFields(update: Partial<Fields>) {
    if (blocked || !editor) return;
    updateEditors((previous) => ({
      ...previous,
      [conversation.id]: {
        ...previous[conversation.id],
        fields: { ...previous[conversation.id].fields, ...update },
      },
    }));
    setSuccess(null);
  }

  return (
    <section
      className="conversation-viewings"
      hidden={!active}
      dir={language === "ar" ? "rtl" : "ltr"}
      aria-labelledby={`${id}-title`}
      aria-busy={pending}
    >
      <header className="cv-heading">
        <div>
          <span className="cv-eyebrow">
            <CalendarClock size={17} aria-hidden="true" />
            Kasa
          </span>
          <h3 id={`${id}-title`}>{copy.title}</h3>
          <p>{copy.intro}</p>
        </div>
        <button
          type="button"
          className="cv-secondary"
          disabled={blocked}
          onClick={() => void readPage(conversation.id)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
      </header>
      <p className="cv-zone">
        <Clock3 size={16} aria-hidden="true" />
        {copy.timeZone}
      </p>
      <p className="cv-muted">{copy.privacy}</p>
      {error?.conversationId === conversation.id && (
        <p
          ref={errorElement}
          className="cv-feedback is-error"
          role="alert"
          tabIndex={-1}
        >
          {copy[error.key]}
          {(error.key === "blocked" || error.key === "closed") && (
            <span className="cv-error-guidance">{copy.metadataRefresh}</span>
          )}
        </p>
      )}
      {success?.conversationId === conversation.id && (
        <p
          ref={successElement}
          className="cv-feedback"
          role="status"
          tabIndex={-1}
        >
          {copy[success.key]}
        </p>
      )}
      {retry && !pending && (
        <div
          ref={retryElement}
          className="cv-feedback is-warning"
          role="alert"
          tabIndex={-1}
        >
          <strong>{retry.listingTitle}</strong>
          <p>{copy.unknown}</p>
          <button
            type="button"
            className="cv-primary"
            onClick={() => void write(retry)}
          >
            {copy.retry}
          </button>
        </div>
      )}
      {replaceDraft && (
        <div
          ref={replaceElement}
          className="cv-confirmation"
          role="alert"
          tabIndex={-1}
        >
          <p>
            {replaceDraft.kind === "reload"
              ? copy.reloadPrompt
              : copy.discardPrompt}
          </p>
          <div className="cv-actions">
            <button
              type="button"
              className="cv-secondary"
              onClick={() => {
                setReplaceDraft(null);
                requestFocus("editor", conversation.id);
              }}
            >
              {copy.keep}
            </button>
            <button
              type="button"
              className="cv-danger"
              onClick={() => {
                const replacement = replaceDraft;
                setReplaceDraft(null);
                if (replacement.kind === "reload")
                  void readDetail(
                    replacement.conversationId,
                    replacement.viewingId,
                    true,
                  );
                else {
                  updateEditors((previous) => ({
                    ...previous,
                    [replacement.conversationId]: replacement.editor,
                  }));
                  requestFocus("editor", replacement.conversationId);
                }
              }}
            >
              {copy.discard}
            </button>
          </div>
        </div>
      )}
      {blockedConversation && (
        <p className="cv-feedback is-warning">{copy.blocked}</p>
      )}
      {conversation.listingStatus !== "visible" && (
        <p className="cv-muted">{copy.closed}</p>
      )}
      {conversation.isListingOwner ? (
        <p className="cv-muted">{copy.ownerNote}</p>
      ) : (
        <div className="cv-new">
          <button
            type="button"
            className="cv-primary"
            disabled={blocked || !page || !canCreate}
            onClick={() => beginEditor("create", null)}
          >
            {copy.newRequest}
          </button>
          {hasActive && <p className="cv-muted">{copy.oneActive}</p>}
        </div>
      )}
      {editor && !editor.open && (
        <button
          type="button"
          className="cv-secondary"
          disabled={blocked}
          onClick={() => {
            updateEditors((previous) => ({
              ...previous,
              [conversation.id]: { ...previous[conversation.id], open: true },
            }));
            requestFocus("editor", conversation.id);
          }}
        >
          {copy.resume}
        </button>
      )}
      {editor && (
        <form
          ref={editorElement}
          hidden={!editor.open}
          className="cv-editor"
          onSubmit={submit}
          noValidate
          tabIndex={-1}
          aria-labelledby={`${id}-editor-title`}
        >
          <h4 id={`${id}-editor-title`}>{copy[headings[editor.mode]]}</h4>
          {editor.base && (
            <div className="cv-slot">
              <strong>{formatTime(editor.base.startsAt)}</strong>
              <span>
                {editor.base.durationMinutes} {copy.minutes} ·{" "}
                {copy[editor.base.status]}
              </span>
            </div>
          )}
          {(editor.mode === "create" || editor.mode === "propose") && (
            <>
              <div className="cv-fields">
                <label>
                  {copy.startsAt}
                  <input
                    type="datetime-local"
                    value={editor.fields.startsLocal}
                    min={viewingUtcToLocal(
                      new Date(Math.ceil(now / minute) * minute).toISOString(),
                    )}
                    max={viewingUtcToLocal(
                      new Date(now + advance).toISOString(),
                    )}
                    step={60}
                    disabled={blocked}
                    onChange={(event) =>
                      patchFields({ startsLocal: event.target.value })
                    }
                    required
                    aria-describedby={`${id}-time-hint`}
                  />
                </label>
                <label>
                  {copy.duration}
                  <select
                    value={editor.fields.duration}
                    disabled={blocked}
                    onChange={(event) =>
                      patchFields({ duration: event.target.value })
                    }
                  >
                    {Array.from(
                      { length: 12 },
                      (_, index) => (index + 1) * 15,
                    ).map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} {copy.minutes}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p id={`${id}-time-hint`} className="cv-muted">
                {copy.timeHint}
              </p>
            </>
          )}
          <label>
            {copy.note}
            <textarea
              rows={3}
              maxLength={1000}
              value={editor.fields.note}
              disabled={blocked}
              onChange={(event) => patchFields({ note: event.target.value })}
              aria-describedby={`${id}-note-hint`}
            />
          </label>
          <p id={`${id}-note-hint`} className="cv-muted">
            {copy.noteHint}
          </p>
          {(editor.mode === "confirm" || editor.mode === "accept") && (
            <p className="cv-confirmation">{copy.confirmNotice}</p>
          )}
          {editor.mode === "decline" && (
            <p className="cv-confirmation">{copy.declineNotice}</p>
          )}
          {editor.mode === "cancel" && (
            <p className="cv-confirmation">{copy.cancelNotice}</p>
          )}
          {(editor.conflict || !allowedEditor) && (
            <div className="cv-feedback is-warning" role="alert">
              <p>{editor.conflict ? copy.conflict : copy.invalidState}</p>
              {editor.base && (
                <button
                  type="button"
                  className="cv-secondary"
                  disabled={blocked}
                  onClick={() => {
                    setReplaceDraft({
                      kind: "reload",
                      conversationId: conversation.id,
                      viewingId: editor.base!.id,
                    });
                    requestFocus("replace", conversation.id);
                  }}
                >
                  {copy.reload}
                </button>
              )}
            </div>
          )}
          {isDirty(editor) && <span className="cv-muted">{copy.draft}</span>}
          <div className="cv-actions">
            <button
              type="submit"
              className={
                editor.mode === "cancel" || editor.mode === "decline"
                  ? "cv-danger"
                  : "cv-primary"
              }
              disabled={blocked || editor.conflict || !allowedEditor}
            >
              {pending ? copy.working : copy[submitLabels[editor.mode]]}
            </button>
            <button
              type="button"
              className="cv-secondary"
              disabled={blocked}
              onClick={() => {
                updateEditors((previous) => ({
                  ...previous,
                  [conversation.id]: {
                    ...previous[conversation.id],
                    open: false,
                  },
                }));
                requestFocus("records", conversation.id);
              }}
            >
              {copy.closeEditor}
            </button>
          </div>
        </form>
      )}
      <div
        ref={recordsElement}
        className="cv-records"
        tabIndex={-1}
        aria-label={copy.title}
      >
        {!page ? (
          <p className="cv-empty" role="status">
            {!pending && error?.conversationId === conversation.id
              ? copy.loadFailed
              : copy.loading}
          </p>
        ) : (
          <>
            <p className="cv-muted">
              {copy.loaded}: {page.viewings.length} / {page.total}
            </p>
            {page.viewings.length === 0 && (
              <p className="cv-empty">{copy.empty}</p>
            )}
            {page.viewings.map((viewing) => (
              <article
                className="cv-card"
                key={viewing.id}
                aria-labelledby={`${id}-${viewing.id}`}
              >
                <div className="cv-card-heading">
                  <h4 id={`${id}-${viewing.id}`}>
                    {formatTime(viewing.startsAt)}
                  </h4>
                  <span className={`cv-status is-${viewing.status}`}>
                    {copy[viewing.status]}
                  </span>
                </div>
                <p className="cv-duration">
                  <Clock3 size={15} aria-hidden="true" />
                  {viewing.durationMinutes} {copy.minutes}
                </p>
                {viewing.note && <p className="cv-note">{viewing.note}</p>}
                {Date.parse(viewing.startsAt) <= now && (
                  <p className="cv-muted">{copy.elapsed}</p>
                )}
                {viewing.status === "confirmed" && (
                  <p className="cv-muted">{copy.confirmedNote}</p>
                )}
                <div className="cv-actions">
                  {eligibleActions(viewing, blockedConversation, now).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={
                          mode === "confirm" || mode === "accept"
                            ? "cv-primary"
                            : "cv-secondary"
                        }
                        disabled={blocked}
                        onClick={() => beginEditor(mode, viewing)}
                      >
                        {copy[mode === "create" ? "newRequest" : mode]}
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  className="cv-history-control"
                  aria-expanded={historyOpen[conversation.id] === viewing.id}
                  aria-controls={`${id}-history-${viewing.id}`}
                  disabled={blocked}
                  onClick={() => {
                    setHistoryOpen((previous) => ({
                      ...previous,
                      [conversation.id]:
                        previous[conversation.id] === viewing.id
                          ? null
                          : viewing.id,
                    }));
                    if (historyOpen[conversation.id] !== viewing.id)
                      void readDetail(conversation.id, viewing.id);
                  }}
                >
                  <History size={16} aria-hidden="true" />
                  {copy.history}
                </button>
                <div
                  id={`${id}-history-${viewing.id}`}
                  hidden={historyOpen[conversation.id] !== viewing.id}
                  className="cv-history"
                >
                  {details[viewing.id]?.viewing.version !== viewing.version ? (
                    <div>
                      <p className="cv-muted" role="status">
                        {pending ? copy.loading : copy.historyUnavailable}
                      </p>
                      {!pending && (
                        <button
                          type="button"
                          className="cv-secondary"
                          disabled={blocked}
                          onClick={() =>
                            void readDetail(conversation.id, viewing.id)
                          }
                        >
                          {copy.refreshHistory}
                        </button>
                      )}
                    </div>
                  ) : (
                    <ol>
                      {details[viewing.id].history.map((entry) => (
                        <li key={entry.id}>
                          <strong>{copy[eventLabels[entry.action]]}</strong>
                          <span className="cv-history-actor">
                            {entry.mine ? copy.you : copy[entry.actorRole]}
                          </span>
                          <time dateTime={entry.createdAt}>
                            {formatTime(entry.createdAt)}
                          </time>
                          <p className="cv-history-slot">
                            {entry.before && (
                              <span>
                                {copy.before}:{" "}
                                {formatTime(entry.before.startsAt)} ·{" "}
                                {entry.before.durationMinutes} {copy.minutes} ·{" "}
                                {copy[entry.before.status]}
                              </span>
                            )}
                            <span>
                              {copy.after}: {formatTime(entry.after.startsAt)} ·{" "}
                              {entry.after.durationMinutes} {copy.minutes} ·{" "}
                              {copy[entry.after.status]}
                            </span>
                          </p>
                          {entry.note && (
                            <p className="cv-note">{entry.note}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </article>
            ))}
            {page.nextOffset !== null && (
              <button
                type="button"
                className="cv-secondary"
                disabled={blocked}
                onClick={() => void readPage(conversation.id, page.nextOffset!)}
              >
                {copy.older}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
