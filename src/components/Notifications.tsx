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
    sample: "Sample entry",
    local: "Local activity",
    scope:
      "Sample entries and local activity. Changes are retained in this tab until reload.",
    applicationSubmitted: "Application recorded",
    applicationWithdrawn: "Application withdrawn",
    applicationReviewed: "Application review recorded",
    serviceRequestSubmitted: "Service request recorded",
    serviceQuoteRecorded: "Service quote recorded",
    serviceRequestDeclined: "Service request declined by provider",
    serviceQuoteAccepted: "Service quote accepted",
    serviceQuoteDeclined: "Service quote declined",
    serviceRequestCancelled: "Service request cancelled",
    serviceStarted: "Service work started",
    serviceCompleted: "Service completion recorded",
  },
  pt: {
    unread: "por ler",
    read: "Lida",
    markRead: "Marcar como lida",
    sample: "Registo de exemplo",
    local: "Atividade local",
    scope:
      "Registos de exemplo e atividade local. As alterações mantêm-se neste separador até recarregar.",
    applicationSubmitted: "Candidatura registada",
    applicationWithdrawn: "Candidatura retirada",
    applicationReviewed: "Análise da candidatura registada",
    serviceRequestSubmitted: "Pedido de serviço registado",
    serviceQuoteRecorded: "Orçamento de serviço registado",
    serviceRequestDeclined: "Pedido de serviço recusado pelo prestador",
    serviceQuoteAccepted: "Orçamento de serviço aceite",
    serviceQuoteDeclined: "Orçamento de serviço recusado",
    serviceRequestCancelled: "Pedido de serviço cancelado",
    serviceStarted: "Serviço iniciado",
    serviceCompleted: "Conclusão do serviço registada",
  },
  es: {
    unread: "sin leer",
    read: "Leída",
    markRead: "Marcar como leída",
    sample: "Registro de ejemplo",
    local: "Actividad local",
    scope:
      "Registros de ejemplo y actividad local. Los cambios se conservan en esta pestaña hasta recargarla.",
    applicationSubmitted: "Candidatura registrada",
    applicationWithdrawn: "Candidatura retirada",
    applicationReviewed: "Revisión de la candidatura registrada",
    serviceRequestSubmitted: "Solicitud de servicio registrada",
    serviceQuoteRecorded: "Presupuesto de servicio registrado",
    serviceRequestDeclined: "Solicitud de servicio rechazada por el proveedor",
    serviceQuoteAccepted: "Presupuesto de servicio aceptado",
    serviceQuoteDeclined: "Presupuesto de servicio rechazado",
    serviceRequestCancelled: "Solicitud de servicio cancelada",
    serviceStarted: "Servicio iniciado",
    serviceCompleted: "Finalización del servicio registrada",
  },
  fr: {
    unread: "non lues",
    read: "Lue",
    markRead: "Marquer comme lue",
    sample: "Exemple de notification",
    local: "Activité locale",
    scope:
      "Exemples de notifications et activité locale. Les modifications sont conservées dans cet onglet jusqu’au rechargement.",
    applicationSubmitted: "Candidature enregistrée",
    applicationWithdrawn: "Candidature retirée",
    applicationReviewed: "Examen de la candidature enregistré",
    serviceRequestSubmitted: "Demande de service enregistrée",
    serviceQuoteRecorded: "Devis de service enregistré",
    serviceRequestDeclined: "Demande de service refusée par le prestataire",
    serviceQuoteAccepted: "Devis de service accepté",
    serviceQuoteDeclined: "Devis de service refusé",
    serviceRequestCancelled: "Demande de service annulée",
    serviceStarted: "Prestation commencée",
    serviceCompleted: "Fin de prestation enregistrée",
  },
  ar: {
    unread: "غير مقروءة",
    read: "مقروءة",
    markRead: "تحديد كمقروءة",
    sample: "إشعار تجريبي",
    local: "نشاط محلي",
    scope:
      "إشعارات تجريبية ونشاط محلي. تُحفظ التغييرات في علامة التبويب هذه حتى إعادة تحميلها.",
    applicationSubmitted: "تم تسجيل طلب العمل",
    applicationWithdrawn: "تم سحب طلب العمل",
    applicationReviewed: "تم تسجيل مراجعة طلب العمل",
    serviceRequestSubmitted: "تم تسجيل طلب الخدمة",
    serviceQuoteRecorded: "تم تسجيل عرض سعر الخدمة",
    serviceRequestDeclined: "رفض مقدم الخدمة طلب الخدمة",
    serviceQuoteAccepted: "تم قبول عرض سعر الخدمة",
    serviceQuoteDeclined: "تم رفض عرض سعر الخدمة",
    serviceRequestCancelled: "تم إلغاء طلب الخدمة",
    serviceStarted: "بدأ تنفيذ الخدمة",
    serviceCompleted: "تم تسجيل اكتمال الخدمة",
  },
  zh: {
    unread: "未读",
    read: "已读",
    markRead: "标为已读",
    sample: "示例通知",
    local: "本地活动",
    scope: "示例通知和本地活动。更改会保留在此标签页中，直到重新加载。",
    applicationSubmitted: "已记录工作申请",
    applicationWithdrawn: "工作申请已撤回",
    applicationReviewed: "已记录申请审阅",
    serviceRequestSubmitted: "已记录服务请求",
    serviceQuoteRecorded: "已记录服务报价",
    serviceRequestDeclined: "服务商已拒绝服务请求",
    serviceQuoteAccepted: "服务报价已接受",
    serviceQuoteDeclined: "服务报价已拒绝",
    serviceRequestCancelled: "服务请求已取消",
    serviceStarted: "服务工作已开始",
    serviceCompleted: "已记录服务完成",
  },
};

function useNotificationLabels() {
  const { t, i18n } = useTranslation();
  const requestedLanguage = (
    i18n.resolvedLanguage ||
    i18n.language ||
    "en"
  ).split("-")[0];
  const language = (
    Object.hasOwn(controls, requestedLanguage) ? requestedLanguage : "en"
  ) as LanguageCode;
  const english = i18n.getFixedT("en");
  const localized = controls[language] ?? controls.en;
  const locale: Record<LanguageCode, string> = {
    en: "en-GB",
    pt: "pt-PT",
    es: "es-ES",
    fr: "fr-FR",
    ar: "ar",
    zh: "zh-CN",
  };
  const dateTime = new Intl.DateTimeFormat(locale[language], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    tr: (key: string) => displayTranslation(t(key), english(key), language),
    formatTime: (value: string) => dateTime.format(new Date(value)),
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

const workTitleKeys = {
  "application-submitted": "applicationSubmitted",
  "application-withdrawn": "applicationWithdrawn",
  "application-reviewed": "applicationReviewed",
} as const;

const serviceTitleKeys = {
  "request-submitted": "serviceRequestSubmitted",
  "quote-recorded": "serviceQuoteRecorded",
  "request-declined": "serviceRequestDeclined",
  "quote-accepted": "serviceQuoteAccepted",
  "quote-declined": "serviceQuoteDeclined",
  "request-cancelled": "serviceRequestCancelled",
  "service-started": "serviceStarted",
  "service-completed": "serviceCompleted",
} as const satisfies Record<
  NonNullable<KasaNotification["serviceEvent"]>["kind"],
  keyof typeof controls.en
>;

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
  const { tr, labels, formatTime } = useNotificationLabels();
  const items = notificationsForRole(state, role);
  return (
    <div className="kasa-notification-list">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const workEvent = item.workEvent;
        const serviceEvent = item.serviceEvent;
        const event = serviceEvent ?? workEvent;
        const title = serviceEvent
          ? labels[serviceTitleKeys[serviceEvent.kind]]
          : workEvent
            ? labels[workTitleKeys[workEvent.kind]]
            : tr(item.titleKey);
        const note =
          serviceEvent?.requestTitle ??
          workEvent?.opportunityTitle ??
          tr(item.noteKey);
        const source = event ? labels.local : labels.sample;
        const timestamp = event
          ? formatTime(event.occurredAt)
          : tr(item.timeKey);
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
              aria-label={`${title}${event ? ` · ${note}` : ""} · ${source} · ${timestamp} · ${item.read ? labels.read : labels.unread}`}
            >
              <span className="notification-feed-icon">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="kasa-notification-copy">
                <strong>{title}</strong>
                <small dir={event ? "auto" : undefined}>{note}</small>
                <small>
                  {source} ·{" "}
                  {event ? (
                    <time dateTime={event.occurredAt}>{timestamp}</time>
                  ) : (
                    timestamp
                  )}
                </small>
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
                aria-label={`${item.read ? labels.read : labels.markRead}: ${title}${event ? ` · ${note} · ${timestamp}` : ""}`}
              >
                <Check size={15} aria-hidden="true" />
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
      <p className="kasa-notification-scope">{labels.scope}</p>
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
