import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  House,
  Languages,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { z } from "zod";
import { languages, setLanguage, type LanguageCode } from "../i18n";
import {
  AccountClientError,
  accountRequest,
  type AccountSession,
  type PrivateAccount,
} from "../platform/accountClient";
import { accountWorkspaceCopy } from "./accountWorkspaceCopy";
import PropertyWorkspace from "./PropertyWorkspace";
import NotificationInbox from "./NotificationInbox";
import { privateRecordsCopy } from "./privateRecordsCopy";
import type {
  NotificationNavigation,
  NotificationOpenOutcome,
  WorkspaceNotificationTarget,
} from "../platform/documentNotificationContracts";
import type {
  ConnectedAccountState,
  ConnectedSection,
} from "../platform/connectedNavigation";
import "./accountWorkspace.css";
import { connectedShellCopy } from "./connectedShellCopy";

const LocalListings = lazy(() => import("./LocalListings"));
const PrivateMessages = lazy(() => import("./PrivateMessages"));

type MessageKey = keyof ReturnType<typeof accountWorkspaceCopy>;
type ProfileDraft = { displayName: string; locale: LanguageCode };
const anonymous: AccountSession = { account: null, csrfToken: null };
const nameSchema = z.string().trim().min(1).max(100);

function failureMessage(error: unknown, editing: boolean): MessageKey {
  if (!(error instanceof AccountClientError)) return "errorGeneric";
  if (error.status === 401)
    return editing ? "errorExpired" : "errorCredentials";
  if (error.code === "VERSION_CONFLICT") return "conflict";
  if (error.status === 409) return editing ? "conflict" : "errorDuplicate";
  if (error.status === 403) return "errorSecurity";
  if (error.status === 422) return editing ? "errorProfile" : "errorValidation";
  if (error.status === 429) return "errorRate";
  if (error.status === 503 || error.code === "accounts_disabled")
    return "errorDisabled";
  if (error.status === 0) return "errorNetwork";
  return "errorGeneric";
}

export default function AccountWorkspace({
  onBack,
  embedded = false,
  active = true,
  section = "profile",
  onSectionChange,
  onConnectionChange,
}: {
  onBack: () => void;
  embedded?: boolean;
  active?: boolean;
  section?: ConnectedSection;
  onSectionChange?: (section: ConnectedSection) => void;
  onConnectionChange?: (state: ConnectedAccountState) => void;
}) {
  const { i18n } = useTranslation();
  const language = (
    languages.some((item) => item.code === i18n.language) ? i18n.language : "pt"
  ) as LanguageCode;
  const copy = accountWorkspaceCopy(language);
  const privateCopy = privateRecordsCopy(language);
  const connectedCopy = connectedShellCopy(language);
  const id = useId();
  const [phase, setPhase] = useState<"checking" | "ready" | "unavailable">(
    "checking",
  );
  const [account, setAccount] = useState<PrivateAccount | null>(null);
  const [workspaceCsrfToken, setWorkspaceCsrfToken] = useState<string | null>(
    null,
  );
  const [standaloneArea, setStandaloneArea] =
    useState<ConnectedSection>("profile");
  const area = embedded ? section : standaloneArea;
  const propertyArea = [
    "properties",
    "rent",
    "documents",
    "maintenance",
  ].includes(area);
  const [propertyActivated, setPropertyActivated] = useState(false);
  const [listingsActivated, setListingsActivated] = useState(false);
  const [messagesActivated, setMessagesActivated] = useState(false);
  const [openConversationId, setOpenConversationId] = useState<string>();
  const [listingWorkflow, setListingWorkflow] = useState({
    busy: false,
    dirty: false,
  });
  const [messageWorkflow, setMessageWorkflow] = useState({
    busy: false,
    dirty: false,
  });
  const onListingWorkflow = useCallback(
    (busy: boolean, dirty: boolean) => setListingWorkflow({ busy, dirty }),
    [],
  );
  const onMessageWorkflow = useCallback(
    (busy: boolean, dirty: boolean) => setMessageWorkflow({ busy, dirty }),
    [],
  );
  const onConversationOpened = useCallback(
    () => setOpenConversationId(undefined),
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationNavigation, setNotificationNavigation] =
    useState<NotificationNavigation | null>(null);
  const navigationResolver = useRef<{
    requestId: string;
    accountId: string;
    section: ConnectedSection;
    prepared: boolean;
    resolve: (outcome: NotificationOpenOutcome) => void;
  } | null>(null);
  const [propertyWorkflowDirty, setPropertyWorkflowDirty] = useState(false);
  const [propertyWorkflowBusy, setPropertyWorkflowBusy] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [navigationConfirmation, setNavigationConfirmation] = useState(false);
  const [leaveConfirmation, setLeaveConfirmation] = useState<
    "logout" | "back" | null
  >(null);
  const discardResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const confirmationElement = useRef<HTMLElement | null>(null);
  const leaveConfirmationElement = useRef<HTMLElement | null>(null);
  const leaveTrigger = useRef<HTMLButtonElement | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(
    () => window.matchMedia("(min-width: 761px)").matches,
  );
  const [draft, setDraft] = useState<ProfileDraft>({
    displayName: "",
    locale: language,
  });
  const [base, setBase] = useState<PrivateAccount | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [success, setSuccess] = useState<MessageKey | null>(null);
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const sessionRef = useRef<AccountSession>(anonymous);
  const baseRef = useRef<PrivateAccount | null>(null);
  const draftRef = useRef<ProfileDraft>({ displayName: "", locale: language });
  const pendingRef = useRef(false);
  const readController = useRef<AbortController | null>(null);
  const writeController = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const dirty =
    base !== null &&
    (draft.displayName !== base.displayName || draft.locale !== base.locale);
  const connectionBusy =
    phase === "checking" ||
    pending ||
    uncertain ||
    propertyWorkflowBusy ||
    listingWorkflow.busy ||
    messageWorkflow.busy ||
    notificationsBusy ||
    navigationConfirmation;
  const connectionDirty =
    dirty ||
    propertyWorkflowDirty ||
    listingWorkflow.dirty ||
    messageWorkflow.dirty ||
    (!account && !!(name || email || password));

  const changeArea = useCallback(
    (next: ConnectedSection) => {
      if (embedded) onSectionChange?.(next);
      else setStandaloneArea(next);
    },
    [embedded, onSectionChange],
  );
  const openConversation = useCallback(
    (conversationId: string) => {
      setOpenConversationId(conversationId);
      setMessagesActivated(true);
      changeArea("messages");
    },
    [changeArea],
  );
  useEffect(() => {
    if (!active || !account) return;
    const task = window.setTimeout(() => {
      if (area === "listings") setListingsActivated(true);
      if (area === "messages") setMessagesActivated(true);
    }, 0);
    return () => window.clearTimeout(task);
  }, [active, account, area]);
  useEffect(() => {
    const current = navigationResolver.current;
    if (
      !current ||
      (active &&
        (area === "notifications" ||
          (current.prepared && area === current.section)))
    )
      return;
    navigationResolver.current = null;
    discardResolver.current?.(false);
    discardResolver.current = null;
    window.setTimeout(() => {
      setNotificationNavigation((next) =>
        next?.requestId === current.requestId ? null : next,
      );
      setNavigationConfirmation(false);
    }, 0);
    current.resolve("cancelled");
  }, [active, area]);
  const confirmNavigationDiscard = useCallback((): Promise<boolean> => {
    discardResolver.current?.(false);
    setNavigationConfirmation(true);
    return new Promise((resolve) => {
      discardResolver.current = resolve;
    });
  }, []);
  const finishNavigationDiscard = (confirmed: boolean) => {
    const resolve = discardResolver.current;
    discardResolver.current = null;
    setNavigationConfirmation(false);
    resolve?.(confirmed);
  };
  useEffect(() => {
    if (!active || !propertyArea || !account) return;
    const activate = window.setTimeout(() => setPropertyActivated(true), 0);
    return () => window.clearTimeout(activate);
  }, [active, propertyArea, account]);
  useEffect(() => {
    if (!active || !navigationConfirmation) return;
    const frame = window.requestAnimationFrame(() => {
      confirmationElement.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
      confirmationElement.current
        ?.querySelector("button")
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, navigationConfirmation]);

  useEffect(() => {
    if (!active || !leaveConfirmation) return;
    const frame = window.requestAnimationFrame(() => {
      leaveConfirmationElement.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
      leaveConfirmationElement.current
        ?.querySelector("button")
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, leaveConfirmation]);

  useEffect(() => {
    onConnectionChange?.({
      account,
      phase,
      unreadCount,
      busy: connectionBusy,
      dirty: connectionDirty,
    });
  }, [
    account,
    phase,
    unreadCount,
    connectionBusy,
    connectionDirty,
    onConnectionChange,
  ]);

  const applySession = useCallback(
    (next: AccountSession, resetDraft: boolean) => {
      const previous = sessionRef.current.account;
      if (previous?.id !== next.account?.id) {
        setPropertyActivated(false);
        setListingsActivated(false);
        setMessagesActivated(false);
        setOpenConversationId(undefined);
        setListingWorkflow({ busy: false, dirty: false });
        setMessageWorkflow({ busy: false, dirty: false });
        setPropertyWorkflowDirty(false);
        setPropertyWorkflowBusy(false);
        setNotificationsBusy(false);
        discardResolver.current?.(false);
        discardResolver.current = null;
        setNavigationConfirmation(false);
        setLeaveConfirmation(null);
        leaveTrigger.current = null;
        navigationResolver.current?.resolve("cancelled");
        navigationResolver.current = null;
        setNotificationNavigation(null);
        setUnreadCount(0);
      }
      sessionRef.current = next;
      setAccount(next.account);
      setWorkspaceCsrfToken(next.csrfToken);
      setPhase("ready");
      if (!next.account) {
        setStandaloneArea("profile");
        setPropertyWorkflowDirty(false);
        setPropertyWorkflowBusy(false);
        setNotificationsBusy(false);
        baseRef.current = null;
        draftRef.current = { displayName: "", locale: "pt" };
        setBase(null);
        setDraft(draftRef.current);
        if (previous !== null || resetDraft) {
          setName("");
          setEmail("");
          setPassword("");
          setShowPassword(false);
        }
        setConflict(false);
        return;
      }
      const currentBase = baseRef.current;
      const hasEdits =
        currentBase &&
        (draftRef.current.displayName !== currentBase.displayName ||
          draftRef.current.locale !== currentBase.locale);
      if (resetDraft || previous?.id !== next.account.id || !hasEdits) {
        baseRef.current = next.account;
        draftRef.current = {
          displayName: next.account.displayName,
          locale: next.account.locale,
        };
        setBase(next.account);
        setDraft(draftRef.current);
        setConflict(false);
        if (resetDraft || previous?.id !== next.account.id)
          void setLanguage(next.account.locale);
      } else if (currentBase?.version !== next.account.version) {
        setConflict(true);
        setSuccess(null);
      }
      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
    },
    [],
  );

  const refreshSession = useCallback(
    async (resetDraft = false, foreground = false) => {
      if (pendingRef.current) return;
      readController.current?.abort();
      const controller = new AbortController();
      readController.current = controller;
      const requestEpoch = ++epoch.current;
      if (foreground) {
        pendingRef.current = true;
        setPending(true);
      }
      try {
        const next = await accountRequest("session", {
          signal: controller.signal,
        });
        if (controller.signal.aborted || requestEpoch !== epoch.current) return;
        const expired =
          sessionRef.current.account !== null && next.account === null;
        applySession(next, resetDraft);
        setUncertain(false);
        setError(expired ? "errorExpired" : null);
        if (expired) setSuccess(null);
      } catch (cause) {
        if (controller.signal.aborted || requestEpoch !== epoch.current) return;
        if (!sessionRef.current.account) setPhase("unavailable");
        setError(failureMessage(cause, !!sessionRef.current.account));
      } finally {
        if (foreground && requestEpoch === epoch.current) {
          pendingRef.current = false;
          setPending(false);
        }
      }
    },
    [applySession],
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(
      () => void refreshSession(true, true),
      0,
    );
    const onFocus = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearTimeout(initialLoad);
      readController.current?.abort();
      writeController.current?.abort();
      navigationResolver.current?.resolve("cancelled");
      navigationResolver.current = null;
      discardResolver.current?.(false);
      discardResolver.current = null;
      pendingRef.current = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!connectionDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [connectionDirty]);

  useEffect(() => {
    const viewport = window.matchMedia("(min-width: 761px)");
    const resize = (event: MediaQueryListEvent) =>
      setExplanationOpen(event.matches);
    viewport.addEventListener("change", resize);
    return () => viewport.removeEventListener("change", resize);
  }, []);

  const updateDraft = (update: Partial<ProfileDraft>) => {
    draftRef.current = { ...draftRef.current, ...update };
    setDraft(draftRef.current);
    setSuccess(null);
  };

  const handleWorkspaceExpired = useCallback(() => {
    applySession(anonymous, true);
    setError("errorExpired");
    void refreshSession(false, false);
  }, [applySession, refreshSession]);

  const handleWorkspaceRefresh = useCallback(() => {
    void refreshSession(false, true);
  }, [refreshSession]);

  const handleNotificationOpen = useCallback(
    (target: WorkspaceNotificationTarget): Promise<NotificationOpenOutcome> => {
      const identity = sessionRef.current.account;
      if (!identity || pendingRef.current || navigationResolver.current)
        return Promise.resolve("cancelled");
      const requestId = crypto.randomUUID();
      return new Promise((resolve) => {
        navigationResolver.current = {
          requestId,
          accountId: identity.id,
          section:
            target.kind === "document_shared"
              ? "documents"
              : target.kind.startsWith("rent_")
                ? "rent"
                : "maintenance",
          prepared: false,
          resolve,
        };
        setNotificationNavigation({
          requestId,
          accountId: identity.id,
          target,
        });
      });
    },
    [],
  );
  const handleNotificationPrepared = useCallback(
    (requestId: string) => {
      const current = navigationResolver.current;
      if (
        !current ||
        current.requestId !== requestId ||
        sessionRef.current.account?.id !== current.accountId
      )
        return;
      current.prepared = true;
      changeArea(current.section);
    },
    [changeArea],
  );
  const handleNotificationOpened = useCallback(
    (requestId: string, outcome: NotificationOpenOutcome) => {
      const current = navigationResolver.current;
      if (!current || current.requestId !== requestId) return;
      const sameAccount = sessionRef.current.account?.id === current.accountId;
      navigationResolver.current = null;
      setNotificationNavigation(null);
      if (sameAccount && outcome === "opened" && !current.prepared)
        changeArea(current.section);
      current.resolve(sameAccount ? outcome : "cancelled");
    },
    [changeArea],
  );

  async function mutate(
    action: "login" | "register" | "profile" | "logout",
    body: unknown,
  ) {
    if (pendingRef.current || uncertain) return;
    if (
      action === "logout" &&
      (propertyWorkflowBusy ||
        listingWorkflow.busy ||
        messageWorkflow.busy ||
        notificationsBusy ||
        navigationConfirmation)
    )
      return;
    const editing = action === "profile" || action === "logout";
    const token = sessionRef.current.csrfToken;
    if (editing && !token) {
      applySession(anonymous, true);
      setError("errorExpired");
      return;
    }
    readController.current?.abort();
    const requestEpoch = ++epoch.current;
    const controller = new AbortController();
    writeController.current = controller;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await accountRequest(action, {
        method: action === "profile" ? "PATCH" : "POST",
        body,
        csrfToken: editing ? (token ?? undefined) : undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestEpoch !== epoch.current) return;
      applySession(next, true);
      setSuccess(
        action === "register"
          ? "created"
          : action === "profile"
            ? "saved"
            : action === "logout"
              ? "signedOut"
              : null,
      );
      if (action === "logout") setMode("login");
    } catch (cause) {
      if (controller.signal.aborted || requestEpoch !== epoch.current) return;
      if (
        cause instanceof AccountClientError &&
        cause.status === 401 &&
        editing
      ) {
        applySession(anonymous, true);
      }
      if (
        cause instanceof AccountClientError &&
        editing &&
        (cause.status === 409 || cause.status === 403)
      )
        setConflict(true);
      if (
        cause instanceof AccountClientError &&
        (cause.status === 0 || cause.status >= 500) &&
        cause.status !== 503
      )
        setUncertain(true);
      setError(failureMessage(cause, editing));
    } finally {
      if (requestEpoch === epoch.current) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  }

  function authenticate(event: FormEvent) {
    event.preventDefault();
    const validEmail = z.email().max(254).safeParse(email.trim());
    const validPassword = password.length >= 12 && password.length <= 128;
    if (
      !validEmail.success ||
      !validPassword ||
      (mode === "register" && !nameSchema.safeParse(name).success)
    ) {
      setError("errorValidation");
      return;
    }
    void mutate(mode, {
      email: email.trim(),
      password,
      ...(mode === "register"
        ? { displayName: name.trim(), locale: language }
        : {}),
    });
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!base || conflict) return;
    if (!nameSchema.safeParse(draft.displayName).success) {
      setError("errorProfile");
      return;
    }
    void mutate("profile", {
      displayName: draft.displayName.trim(),
      locale: draft.locale,
      version: base.version,
    });
  }

  return (
    <section
      className={`account-workspace${embedded ? " is-embedded" : ""}`}
      hidden={!active}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {!embedded && (
        <header className="account-topbar">
          <button
            className="account-back"
            type="button"
            disabled={connectionBusy}
            onClick={(event) => {
              if (!connectionDirty) onBack();
              else {
                leaveTrigger.current = event.currentTarget;
                setLeaveConfirmation("back");
              }
            }}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            {copy.back}
          </button>
          <label className="account-language">
            <Languages size={18} aria-hidden="true" />
            <span className="account-sr-only">{copy.language}</span>
            <select
              value={language}
              onChange={(event) =>
                void setLanguage(event.target.value as LanguageCode)
              }
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </header>
      )}

      {account && !embedded && (
        <nav className="account-area-tabs" aria-label={copy.entryLabel}>
          <button
            type="button"
            aria-pressed={area === "profile"}
            onClick={() => changeArea("profile")}
          >
            {copy.profileArea}
          </button>
          <button
            type="button"
            aria-pressed={propertyArea}
            onClick={() => changeArea("properties")}
          >
            {copy.propertiesArea}
          </button>
          <button
            type="button"
            aria-pressed={area === "notifications"}
            onClick={() => changeArea("notifications")}
          >
            {privateCopy.notifications}
            {unreadCount > 0 && (
              <span className="account-unread-badge">{unreadCount}</span>
            )}
          </button>
          {(["listings", "messages"] as const).map((destination) => (
            <button
              key={destination}
              type="button"
              aria-pressed={area === destination}
              onClick={() => changeArea(destination)}
            >
              {connectedCopy[destination]}
            </button>
          ))}
        </nav>
      )}

      {navigationConfirmation && (
        <section
          className="account-navigation-confirmation"
          ref={confirmationElement}
          role="alertdialog"
          aria-labelledby={`${id}-navigation-confirm`}
        >
          <h2 id={`${id}-navigation-confirm`}>{copy.navigationConfirm}</h2>
          <p>{copy.navigationConfirmNote}</p>
          <div>
            <button
              type="button"
              className="account-secondary"
              onClick={() => finishNavigationDiscard(false)}
            >
              {copy.keepEditing}
            </button>
            <button
              type="button"
              className="account-primary"
              onClick={() => finishNavigationDiscard(true)}
            >
              {copy.discardAndOpen}
            </button>
          </div>
        </section>
      )}
      {leaveConfirmation && (
        <section
          className="account-navigation-confirmation"
          ref={leaveConfirmationElement}
          role="alertdialog"
          aria-labelledby={`${id}-leave-confirm`}
        >
          <h2 id={`${id}-leave-confirm`}>
            {leaveConfirmation === "logout"
              ? copy.logoutConfirm
              : copy.backConfirm}
          </h2>
          <div>
            <button
              type="button"
              className="account-secondary"
              onClick={() => {
                setLeaveConfirmation(null);
                const trigger = leaveTrigger.current;
                leaveTrigger.current = null;
                if (
                  active &&
                  trigger?.isConnected &&
                  !trigger.closest("[hidden]")
                )
                  trigger.focus();
              }}
            >
              {copy.keepEditing}
            </button>
            <button
              type="button"
              className="account-primary"
              disabled={connectionBusy}
              onClick={() => {
                const destination = leaveConfirmation;
                setLeaveConfirmation(null);
                leaveTrigger.current = null;
                if (destination === "logout") void mutate("logout", {});
                else onBack();
              }}
            >
              {leaveConfirmation === "logout" ? copy.logout : copy.back}
            </button>
          </div>
        </section>
      )}

      <div
        className={`account-layout${account ? " is-signed-in" : ""}`}
        hidden={!!account && area !== "profile"}
      >
        <section
          className="account-introduction"
          aria-labelledby={`${id}-title`}
        >
          <span className="account-brand">
            <span>
              <House size={26} aria-hidden="true" />
            </span>
            Kasa
          </span>
          <p className="account-eyebrow">{copy.eyebrow}</p>
          <h1 id={`${id}-title`}>{copy.title}</h1>
          <p className="account-intro-note">{copy.intro}</p>
          <details
            className="account-explanation"
            open={explanationOpen}
            onToggle={(event) => setExplanationOpen(event.currentTarget.open)}
          >
            <summary>
              <LockKeyhole size={20} aria-hidden="true" />
              <strong>{copy.localTitle}</strong>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="account-test-notice">
              <p>{copy.localNote}</p>
            </div>
            <section className="account-scope" aria-labelledby={`${id}-scope`}>
              <h2 id={`${id}-scope`}>{copy.scopeTitle}</h2>
              <p>
                <Check size={18} aria-hidden="true" />
                <span>{copy.profileScope}</span>
              </p>
              <p>{copy.separation}</p>
            </section>
          </details>
        </section>

        <section className="account-panel" aria-busy={pending}>
          {phase === "checking" ? (
            <div className="account-empty" role="status">
              <LoaderCircle
                className="account-spinner"
                size={28}
                aria-hidden="true"
              />
              <h2>{copy.checking}</h2>
            </div>
          ) : phase === "unavailable" ? (
            <div className="account-empty">
              <LockKeyhole size={32} aria-hidden="true" />
              <h2>{copy.unavailableTitle}</h2>
              <p>{copy.unavailableNote}</p>
              {error && (
                <p className="account-feedback is-error" role="alert">
                  {copy[error]}
                </p>
              )}
              <button
                className="account-primary"
                type="button"
                disabled={pending}
                onClick={() => void refreshSession(false, true)}
              >
                <RefreshCw size={18} aria-hidden="true" />
                {pending ? copy.working : copy.retry}
              </button>
            </div>
          ) : (
            <>
              {account ? (
                <div className="account-panel-heading">
                  <span className="account-avatar">
                    <UserRound size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>{copy.profileTitle}</h2>
                    <p>{copy.profileNote}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="account-tabs" aria-label={copy.entryLabel}>
                    {(["login", "register"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={mode === item}
                        disabled={pending}
                        onClick={() => {
                          setMode(item);
                          setError(null);
                          setSuccess(null);
                          setPassword("");
                          setShowPassword(false);
                        }}
                      >
                        {item === "login" ? copy.signIn : copy.create}
                      </button>
                    ))}
                  </div>
                  <div className="account-panel-heading">
                    <div>
                      <h2>
                        {mode === "login" ? copy.signInTitle : copy.createTitle}
                      </h2>
                      <p>
                        {mode === "login" ? copy.signInNote : copy.createNote}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {error &&
                !(
                  conflict &&
                  (error === "conflict" || error === "errorSecurity")
                ) && (
                  <p className="account-feedback is-error" role="alert">
                    {copy[error]}
                  </p>
                )}
              {success && (
                <p className="account-feedback is-success" role="status">
                  <Check size={18} aria-hidden="true" />
                  {copy[success]}
                </p>
              )}
              {uncertain && (
                <div className="account-feedback is-warning" role="status">
                  <p>{copy.uncertain}</p>
                  <button
                    type="button"
                    className="account-secondary"
                    disabled={pending}
                    onClick={() => void refreshSession(false, true)}
                  >
                    {copy.checkSession}
                  </button>
                </div>
              )}

              {!account ? (
                <form
                  onSubmit={authenticate}
                  className="account-form"
                  noValidate
                >
                  {mode === "register" && (
                    <label htmlFor={`${id}-name`}>
                      {copy.name}
                      <input
                        id={`${id}-name`}
                        name="displayName"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={100}
                        autoComplete="off"
                        disabled={pending}
                        required
                      />
                    </label>
                  )}
                  <label htmlFor={`${id}-email`}>
                    {copy.email}
                    <input
                      id={`${id}-email`}
                      type="email"
                      name="email"
                      dir="ltr"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      maxLength={254}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={pending}
                      required
                    />
                  </label>
                  <label htmlFor={`${id}-password`}>
                    {copy.password}
                    <span className="account-password-field">
                      <input
                        id={`${id}-password`}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        dir="ltr"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={12}
                        maxLength={128}
                        autoComplete={
                          mode === "register"
                            ? "new-password"
                            : "current-password"
                        }
                        aria-describedby={`${id}-password-help`}
                        disabled={pending}
                        required
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? copy.hidePassword : copy.showPassword
                        }
                        aria-pressed={showPassword}
                        disabled={pending}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? (
                          <EyeOff size={19} aria-hidden="true" />
                        ) : (
                          <Eye size={19} aria-hidden="true" />
                        )}
                      </button>
                    </span>
                  </label>
                  <p id={`${id}-password-help`} className="account-field-note">
                    {copy.passwordHint}
                  </p>
                  <button
                    className="account-primary"
                    type="submit"
                    disabled={pending || uncertain}
                  >
                    {pending ? (
                      <LoaderCircle
                        className="account-spinner"
                        size={18}
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowRight size={18} aria-hidden="true" />
                    )}
                    {pending
                      ? copy.working
                      : mode === "login"
                        ? copy.signIn
                        : copy.createSubmit}
                  </button>
                </form>
              ) : (
                <form
                  className="account-form"
                  onSubmit={saveProfile}
                  noValidate
                >
                  <label htmlFor={`${id}-profile-name`}>
                    {copy.name}
                    <input
                      id={`${id}-profile-name`}
                      name="displayName"
                      value={draft.displayName}
                      maxLength={100}
                      autoComplete="off"
                      onChange={(event) =>
                        updateDraft({ displayName: event.target.value })
                      }
                      disabled={pending}
                      required
                    />
                  </label>
                  <div className="account-private-email">
                    <strong>{copy.email}</strong>
                    <span dir="ltr">{account.email}</span>
                    <small>{copy.unverified}</small>
                    <p>{copy.emailNote}</p>
                  </div>
                  <label htmlFor={`${id}-profile-language`}>
                    {copy.preferredLanguage}
                    <select
                      id={`${id}-profile-language`}
                      value={draft.locale}
                      onChange={(event) =>
                        updateDraft({
                          locale: event.target.value as LanguageCode,
                        })
                      }
                      disabled={pending}
                    >
                      {languages.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="account-field-note">{copy.languageNote}</p>
                  {conflict && (
                    <div className="account-feedback is-warning" role="alert">
                      <p>
                        {error === "errorSecurity"
                          ? copy.errorSecurity
                          : copy.conflict}
                      </p>
                      <button
                        className="account-secondary"
                        type="button"
                        disabled={pending}
                        onClick={() => void refreshSession(true, true)}
                      >
                        {copy.reload}
                      </button>
                    </div>
                  )}
                  {dirty && (
                    <p className="account-unsaved" role="status">
                      {copy.unsaved}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="account-primary"
                    disabled={pending || !dirty || conflict || uncertain}
                  >
                    {pending ? (
                      <LoaderCircle
                        className="account-spinner"
                        size={18}
                        aria-hidden="true"
                      />
                    ) : (
                      <Check size={18} aria-hidden="true" />
                    )}
                    {pending ? copy.working : copy.save}
                  </button>
                  <button
                    type="button"
                    className="account-secondary account-logout"
                    disabled={connectionBusy}
                    onClick={(event) => {
                      if (!connectionDirty) void mutate("logout", {});
                      else {
                        leaveTrigger.current = event.currentTarget;
                        setLeaveConfirmation("logout");
                      }
                    }}
                  >
                    <LogOut size={17} aria-hidden="true" />
                    {copy.logout}
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      {account &&
        workspaceCsrfToken &&
        (propertyActivated ||
          (active && propertyArea) ||
          !!notificationNavigation) && (
          <div className="account-property-area" hidden={!propertyArea}>
            <PropertyWorkspace
              key={account.id}
              account={account}
              csrfToken={workspaceCsrfToken}
              onSessionExpired={handleWorkspaceExpired}
              onSessionRefresh={handleWorkspaceRefresh}
              onDirtyChange={setPropertyWorkflowDirty}
              onBusyChange={setPropertyWorkflowBusy}
              active={active && propertyArea}
              section={area}
              onSectionChange={changeArea}
              onConfirmDiscard={confirmNavigationDiscard}
              focusedSection={embedded || area !== "properties"}
              notificationNavigation={notificationNavigation}
              onNotificationOpened={handleNotificationOpened}
              onNotificationPrepared={handleNotificationPrepared}
            />
          </div>
        )}

      {account &&
        workspaceCsrfToken &&
        (listingsActivated || (active && area === "listings")) && (
          <div hidden={area !== "listings"}>
            <Suspense fallback={<p role="status">{connectedCopy.checking}</p>}>
              <LocalListings
                key={account.id}
                account={account}
                csrfToken={workspaceCsrfToken}
                active={active && area === "listings"}
                onSessionExpired={handleWorkspaceExpired}
                onSessionRefresh={handleWorkspaceRefresh}
                onWorkflowStateChange={onListingWorkflow}
                onOpenConversation={openConversation}
              />
            </Suspense>
          </div>
        )}
      {account &&
        workspaceCsrfToken &&
        (messagesActivated || (active && area === "messages")) && (
          <div hidden={area !== "messages"}>
            <Suspense fallback={<p role="status">{connectedCopy.checking}</p>}>
              <PrivateMessages
                key={account.id}
                account={account}
                csrfToken={workspaceCsrfToken}
                active={active && area === "messages"}
                openConversationId={openConversationId}
                onConversationOpened={onConversationOpened}
                onSessionExpired={handleWorkspaceExpired}
                onSessionRefresh={handleWorkspaceRefresh}
                onWorkflowStateChange={onMessageWorkflow}
              />
            </Suspense>
          </div>
        )}

      {account && workspaceCsrfToken && (
        <div
          className="account-notification-area"
          hidden={area !== "notifications"}
        >
          <NotificationInbox
            key={account.id}
            account={account}
            csrfToken={workspaceCsrfToken}
            active={active && area === "notifications"}
            onBusyChange={setNotificationsBusy}
            onUnreadChange={setUnreadCount}
            onSessionExpired={handleWorkspaceExpired}
            onSessionRefresh={handleWorkspaceRefresh}
            onOpen={handleNotificationOpen}
          />
        </div>
      )}

      {account && (
        <section
          className="account-roadmap"
          aria-labelledby={`${id}-roadmap`}
          hidden={area !== "profile"}
        >
          <h2 id={`${id}-roadmap`}>{copy.roadmapTitle}</h2>
          <div>
            <article>
              <UserRound size={22} aria-hidden="true" />
              <h3>{copy.personal}</h3>
              <p>{copy.personalNote}</p>
            </article>
            <article>
              <BriefcaseBusiness size={22} aria-hidden="true" />
              <h3>{copy.professional}</h3>
              <span>{copy.comingLater}</span>
              <p>{copy.professionalNote}</p>
            </article>
          </div>
        </section>
      )}
    </section>
  );
}
