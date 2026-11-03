import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Check,
  FileText,
  RefreshCw,
  Wrench,
  WalletCards,
} from "lucide-react";
import { languages, type LanguageCode } from "../i18n";
import {
  AccountClientError,
  type PrivateAccount,
} from "../platform/accountClient";
import { workspaceRequest } from "../platform/workspaceClient";
import {
  savedNotificationsSchema,
  savedNotificationResponseSchema,
  readAllNotificationsSchema,
  type SavedNotification,
  type WorkspaceNotificationTarget,
  type NotificationOpenOutcome,
} from "../platform/documentNotificationContracts";
import { privateRecordsCopy } from "./privateRecordsCopy";
import "./privateRecords.css";

type CopyKey = keyof ReturnType<typeof privateRecordsCopy>;

export default function NotificationInbox({
  account,
  csrfToken,
  active,
  onUnreadChange,
  onBusyChange,
  onSessionExpired,
  onSessionRefresh,
  onOpen,
}: {
  account: PrivateAccount;
  csrfToken: string;
  active: boolean;
  onUnreadChange: (count: number) => void;
  onBusyChange?: (busy: boolean) => void;
  onSessionExpired: () => void;
  onSessionRefresh: () => void;
  onOpen: (
    target: WorkspaceNotificationTarget,
  ) => Promise<NotificationOpenOutcome>;
}) {
  const { i18n } = useTranslation();
  const language = (
    languages.some((item) => item.code === i18n.language) ? i18n.language : "pt"
  ) as LanguageCode;
  const copy = privateRecordsCopy(language);
  const [notifications, setNotifications] = useState<SavedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<CopyKey | null>(null);
  const [success, setSuccess] = useState<CopyKey | null>(null);
  const auth = useRef({ accountId: account.id, csrfToken });
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onBusyChange?.(pending || opening);
    return () => onBusyChange?.(false);
  }, [pending, opening, onBusyChange]);
  useEffect(() => {
    auth.current = { accountId: account.id, csrfToken };
  }, [account.id, csrfToken]);

  const report = useCallback(
    (cause: unknown) => {
      if (cause instanceof AccountClientError && cause.status === 401) {
        setNotifications([]);
        setUnreadCount(0);
        setNextCursor(null);
        onUnreadChange(0);
        onSessionExpired();
        return;
      }
      if (cause instanceof AccountClientError && cause.code === "CSRF_DENIED") {
        setError("sessionChanged");
        onSessionRefresh();
        return;
      }
      setError(
        cause instanceof AccountClientError && cause.status === 429
          ? "rate"
          : "error",
      );
    },
    [onSessionExpired, onSessionRefresh, onUnreadChange],
  );
  const read = useCallback(
    async (signal: AbortSignal, cursor?: string) => {
      const result = await workspaceRequest(
        `notifications${cursor ? `?before=${encodeURIComponent(cursor)}` : ""}`,
        savedNotificationsSchema,
        { ...auth.current, signal },
      );
      if (signal.aborted) return;
      setNotifications((previous) =>
        cursor
          ? [
              ...new Map(
                [...previous, ...result.notifications].map((item) => [
                  item.id,
                  item,
                ]),
              ).values(),
            ]
          : result.notifications,
      );
      setNextCursor(result.nextCursor);
      setUnreadCount(result.unreadCount);
      onUnreadChange(result.unreadCount);
    },
    [onUnreadChange],
  );
  const refresh = useCallback(
    async (cursor?: string) => {
      if (busy.current) return;
      controller.current?.abort();
      const task = new AbortController();
      controller.current = task;
      busy.current = true;
      setPending(true);
      setError(null);
      try {
        await read(task.signal, cursor);
      } catch (cause) {
        if (!task.signal.aborted) report(cause);
      } finally {
        if (!task.signal.aborted) {
          busy.current = false;
          setPending(false);
          setLoading(false);
        }
      }
    },
    [read, report],
  );
  useEffect(() => {
    const start = window.setTimeout(() => void refresh(), 0);
    const focus = () => {
      if (activeRef.current && document.visibilityState === "visible")
        void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.clearTimeout(start);
      controller.current?.abort();
      busy.current = false;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!active) return;
    const start = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(start);
  }, [active, refresh]);

  async function markRead(record?: SavedNotification) {
    if (busy.current) return;
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      if (record) {
        const result = await workspaceRequest(
          `notifications/${record.id}`,
          savedNotificationResponseSchema,
          {
            ...auth.current,
            signal: task.signal,
            method: "PATCH",
            body: { read: true },
          },
        );
        if (task.signal.aborted) return;
        setNotifications((items) =>
          items.map((item) =>
            item.id === record.id ? result.notification : item,
          ),
        );
      } else {
        await workspaceRequest(
          "notifications/read-all",
          readAllNotificationsSchema,
          { ...auth.current, signal: task.signal, method: "POST", body: {} },
        );
        if (task.signal.aborted) return;
        setSuccess("allRead");
      }
      await read(task.signal);
    } catch (cause) {
      if (!task.signal.aborted) {
        if (cause instanceof AccountClientError && cause.status === 404) {
          if (record)
            setNotifications((items) =>
              items.filter((item) => item.id !== record.id),
            );
          setError("targetUnavailable");
          try {
            await read(task.signal);
          } catch (refreshError) {
            if (!task.signal.aborted) report(refreshError);
          }
        } else report(cause);
      }
    } finally {
      if (!task.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  async function open(record: SavedNotification) {
    if (busy.current) return;
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    busy.current = true;
    setPending(true);
    setOpening(true);
    setError(null);
    setSuccess(null);
    try {
      const outcome = await onOpen({
        notificationId: record.id,
        propertyId: record.propertyId,
        resourceId: record.resourceId,
        kind: record.kind,
      });
      if (task.signal.aborted) return;
      if (outcome === "unavailable") {
        setNotifications((items) =>
          items.filter((item) => item.id !== record.id),
        );
        setError("targetUnavailable");
      } else if (outcome === "failed") setError("error");
      else if (outcome === "opened" && !record.readAt) {
        const result = await workspaceRequest(
          `notifications/${record.id}`,
          savedNotificationResponseSchema,
          {
            ...auth.current,
            signal: task.signal,
            method: "PATCH",
            body: { read: true },
          },
        );
        if (task.signal.aborted) return;
        setNotifications((items) =>
          items.map((item) =>
            item.id === record.id ? result.notification : item,
          ),
        );
      }
      if (outcome !== "cancelled") await read(task.signal);
    } catch (cause) {
      if (!task.signal.aborted) report(cause);
    } finally {
      if (!task.signal.aborted) {
        busy.current = false;
        setPending(false);
        setOpening(false);
      }
    }
  }
  const visible = notifications.filter(
    (item) => filter === "all" || item.readAt === null,
  );
  return (
    <section className="saved-notifications" aria-busy={pending}>
      <header>
        <div>
          <h1>{copy.notifications}</h1>
          <p>{copy.notificationsNote}</p>
        </div>
        <Bell aria-hidden="true" size={28} />
      </header>
      <div className="private-record-actions">
        <button
          type="button"
          className="pw-secondary"
          disabled={pending}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
        <button
          type="button"
          className="pw-secondary"
          disabled={pending || unreadCount === 0}
          onClick={() => void markRead()}
        >
          <Check size={16} aria-hidden="true" />
          {copy.markAllRead}
        </button>
      </div>
      <div className="private-record-filters">
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          {copy.all}
        </button>
        <button
          type="button"
          aria-pressed={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          {copy.unread} · {unreadCount}
        </button>
      </div>
      {error && (
        <p className="pw-feedback is-error" role="alert">
          {copy[error]}
        </p>
      )}
      {success && (
        <p className="pw-feedback is-success" role="status">
          {copy[success]}
        </p>
      )}
      {opening && <p role="status">{copy.opening}</p>}
      {loading ? (
        <p role="status">{copy.loading}</p>
      ) : visible.length === 0 ? (
        <p className="pw-empty-inline">
          {filter === "unread"
            ? nextCursor && unreadCount > 0
              ? copy.loadMore
              : copy.noUnread
            : copy.emptyNotifications}
        </p>
      ) : (
        <div className="saved-notification-list">
          {visible.map((record) => (
            <article
              key={record.id}
              className={`saved-notification${record.readAt ? "" : " is-unread"}`}
            >
              {record.kind === "document_shared" ? (
                <FileText aria-hidden="true" size={21} />
              ) : record.kind.startsWith("rent_") ? (
                <WalletCards aria-hidden="true" size={21} />
              ) : (
                <Wrench aria-hidden="true" size={21} />
              )}
              <div>
                <h2>{copy[record.kind]}</h2>
                <p>
                  {copy.by} {record.actorName}
                </p>
                <time dateTime={record.createdAt}>
                  {new Intl.DateTimeFormat(language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(record.createdAt))}
                </time>
                <div className="private-record-actions">
                  <button
                    className="pw-primary"
                    type="button"
                    disabled={pending}
                    onClick={() => void open(record)}
                  >
                    {copy.open}
                  </button>
                  {!record.readAt && (
                    <button
                      className="pw-secondary"
                      type="button"
                      disabled={pending}
                      onClick={() => void markRead(record)}
                    >
                      {copy.markRead}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {nextCursor && (
        <div className="private-record-actions">
          <button
            className="pw-secondary"
            type="button"
            disabled={pending}
            onClick={() => void refresh(nextCursor)}
          >
            {pending ? copy.loading : copy.loadMore}
          </button>
        </div>
      )}
    </section>
  );
}
