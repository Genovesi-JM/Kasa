import {
  useEffect,
  useId,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleDollarSign,
  FileText,
  MessageCircle,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { displayTranslation, type LanguageCode } from "../i18n";
import type { Role } from "../types";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationsForRole,
  unreadNotificationCount,
  type KasaNotification,
  type NotificationState,
} from "./notificationState";
import "./notifications.css";

const controls = {
  en: {
    unread: "unread",
    read: "Read",
    markRead: "Mark as read",
    sample: "Sample updates. Read status is kept while you navigate.",
  },
  pt: {
    unread: "por ler",
    read: "Lida",
    markRead: "Marcar como lida",
    sample:
      "Atualizações de exemplo. O estado de leitura mantém-se durante a navegação.",
  },
  es: {
    unread: "sin leer",
    read: "Leída",
    markRead: "Marcar como leída",
    sample:
      "Actualizaciones de ejemplo. El estado de lectura se conserva mientras navegas.",
  },
  fr: {
    unread: "non lues",
    read: "Lue",
    markRead: "Marquer comme lue",
    sample:
      "Exemples de notifications. L’état de lecture est conservé pendant la navigation.",
  },
  ar: {
    unread: "غير مقروءة",
    read: "مقروءة",
    markRead: "تحديد كمقروءة",
    sample: "تحديثات تجريبية. تُحفظ حالة القراءة أثناء التنقل.",
  },
  zh: {
    unread: "未读",
    read: "已读",
    markRead: "标为已读",
    sample: "示例通知。浏览时会保留已读状态。",
  },
};

function useNotificationLabels() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ||
    i18n.language ||
    "en") as LanguageCode;
  const english = i18n.getFixedT("en");
  const localized = controls[language] ?? controls.en;
  return {
    tr: (key: string) => displayTranslation(t(key), english(key), language),
    labels: Object.fromEntries(
      Object.entries(localized).map(([key, value]) => [
        key,
        displayTranslation(
          value,
          controls.en[key as keyof typeof controls.en],
          language,
        ),
      ]),
    ) as typeof controls.en,
  };
}

const icons = {
  work: BriefcaseBusiness,
  message: MessageCircle,
  repair: Wrench,
  calendar: CalendarDays,
  document: FileText,
  payment: CircleDollarSign,
  shield: ShieldCheck,
};

interface NotificationsProps {
  state: NotificationState;
  setState: Dispatch<SetStateAction<NotificationState>>;
  role: Role;
  onNavigate: (notification: KasaNotification) => void;
  notify: (message: string) => void;
}

function NotificationList({
  state,
  setState,
  role,
  onNavigate,
}: Omit<NotificationsProps, "notify">) {
  const { tr, labels } = useNotificationLabels();
  const items = notificationsForRole(state, role);
  return (
    <div className="kasa-notification-list">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const title = tr(item.titleKey);
        return (
          <article
            className={`kasa-notification-entry ${item.read ? "is-read" : "is-unread"}`}
            key={item.id}
          >
            <button
              className="kasa-notification-open"
              onClick={() => {
                setState((current) =>
                  markNotificationRead(current, role, item.id),
                );
                onNavigate(item);
              }}
              aria-label={`${title} · ${item.read ? labels.read : labels.unread}`}
            >
              <span className="notification-feed-icon">
                <Icon size={19} />
              </span>
              <span className="kasa-notification-copy">
                <strong>{title}</strong>
                <small>{tr(item.noteKey)}</small>
                <small>{tr(item.timeKey)}</small>
              </span>
              {!item.read && (
                <span className="notification-dot" aria-hidden="true" />
              )}
            </button>
            <div className="kasa-notification-read-action">
              <button
                className="text-button"
                disabled={item.read}
                onClick={() =>
                  setState((current) =>
                    markNotificationRead(current, role, item.id),
                  )
                }
                aria-label={`${item.read ? labels.read : labels.markRead}: ${title}`}
              >
                <Check size={15} />
                <span>{item.read ? labels.read : labels.markRead}</span>
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function NotificationsView(props: NotificationsProps) {
  const { tr, labels } = useNotificationLabels();
  const unread = unreadNotificationCount(props.state, props.role);
  return (
    <div className="simple-mobile-page notification-page">
      <header>
        <div>
          <span className="eyebrow">{tr("universalHome.yourUpdates")}</span>
          <h2>{tr("common.notifications")}</h2>
        </div>
        <button
          className="text-button"
          disabled={unread === 0}
          onClick={() => {
            props.setState((current) =>
              markAllNotificationsRead(current, props.role),
            );
            props.notify(tr("shell.notificationsRead"));
          }}
        >
          {tr("shell.markAllRead")}
        </button>
      </header>
      <p className="kasa-notification-count" role="status" aria-live="polite">
        {unread} {labels.unread}
      </p>
      <section
        className="notification-feed"
        aria-label={tr("common.notifications")}
      >
        <NotificationList {...props} />
      </section>
      <p className="kasa-notification-scope">{labels.sample}</p>
    </div>
  );
}

export function NotificationsPopover(
  props: NotificationsProps & {
    open: boolean;
    setOpen: (open: boolean) => void;
    onViewAll: () => void;
  },
) {
  const { tr, labels } = useNotificationLabels();
  const unread = unreadNotificationCount(props.state, props.role);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { open, setOpen } = props;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !wrapper.current?.contains(event.target)
      )
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  return (
    <div
      className="notification-wrap"
      ref={wrapper}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        className="notification-button"
        ref={trigger}
        onClick={() => setOpen(!open)}
        aria-label={`${tr("common.notifications")}, ${unread} ${labels.unread}`}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="kasa-notification-badge" aria-hidden="true">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <section
          className="notification-panel kasa-notification-panel"
          id={panelId}
          aria-label={tr("common.notifications")}
        >
          <header>
            <strong>
              {tr("common.notifications")}{" "}
              <span role="status" aria-live="polite">
                ({unread} {labels.unread})
              </span>
            </strong>
            <button
              className="text-button"
              disabled={unread === 0}
              onClick={() => {
                props.setState((current) =>
                  markAllNotificationsRead(current, props.role),
                );
                props.notify(tr("shell.notificationsRead"));
              }}
            >
              {tr("shell.markAllRead")}
            </button>
          </header>
          <NotificationList
            {...props}
            onNavigate={(item) => {
              setOpen(false);
              props.onNavigate(item);
            }}
          />
          <footer>
            <button
              className="text-button"
              onClick={() => {
                setOpen(false);
                props.onViewAll();
              }}
            >
              {tr("common.viewAll")}
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
