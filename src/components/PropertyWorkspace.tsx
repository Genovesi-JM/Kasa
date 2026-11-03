import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  FileText,
  KeyRound,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wrench,
  WalletCards,
} from "lucide-react";
import { z } from "zod";
import { languages, type LanguageCode } from "../i18n";
import {
  AccountClientError,
  type PrivateAccount,
} from "../platform/accountClient";
import {
  acceptedInvitationSchema,
  createdWorkspaceSchema,
  issuedInvitationSchema,
  maintenanceListSchema,
  maintenanceResponseSchema,
  propertyAccessSchema,
  propertyResponseSchema,
  removedTenantSchema,
  revokedInvitationSchema,
  workspaceRequest,
  workspacesResponseSchema,
  type IssuedInvitation,
  type MaintenanceRequestRecord,
  type MaintenanceStatus,
  type PropertyAccess,
  type PropertyWorkspaceRecord,
  type WorkspaceProperty,
} from "../platform/workspaceClient";
import { propertyWorkspaceCopy } from "./propertyWorkspaceCopy";
import { privateRecordsCopy } from "./privateRecordsCopy";
import { propertyRentCopy } from "./propertyRentCopy";
import type { ConnectedSection } from "../platform/connectedNavigation";
import PropertyDocuments from "./PropertyDocuments";
import PropertyRentRecords from "./PropertyRentRecords";
import { persistedRentDetailSchema } from "../platform/persistedRentContracts";
import {
  privateDocumentListSchema,
  type NotificationNavigation,
  type NotificationOpenOutcome,
} from "../platform/documentNotificationContracts";
import "./propertyWorkspace.css";

type Selection = { workspaceId: string; propertyId: string };
type PropertyDraft = {
  id: string;
  version: number;
  name: string;
  address: string;
  originalName: string;
  originalAddress: string;
};
type TicketDraft = {
  id: string;
  version: number;
  status: MaintenanceStatus;
  originalStatus: MaintenanceStatus;
  message: string;
};
type Message = keyof ReturnType<typeof propertyWorkspaceCopy>;
type EditorReset = false | "property" | "ticket" | "all";
const noSelection: Selection = { workspaceId: "", propertyId: "" };
const emptyAccess: PropertyAccess = { tenants: [], invitations: [] };
const validText = (value: string, max: number) =>
  z.string().trim().min(1).max(max).safeParse(value).success;
const propertyDirty = (draft: PropertyDraft | null) =>
  !!draft &&
  (draft.name !== draft.originalName ||
    draft.address !== draft.originalAddress);
const ticketDirty = (draft: TicketDraft | null) =>
  !!draft &&
  (draft.message.length > 0 || draft.status !== draft.originalStatus);
const editProperty = (property: WorkspaceProperty): PropertyDraft => ({
  id: property.id,
  version: property.version,
  name: property.name,
  address: property.address,
  originalName: property.name,
  originalAddress: property.address,
});
const editTicket = (request: MaintenanceRequestRecord): TicketDraft => ({
  id: request.id,
  version: request.version,
  status: request.status,
  originalStatus: request.status,
  message: "",
});

function errorMessage(cause: unknown): Message {
  if (!(cause instanceof AccountClientError)) return "error";
  if (cause.code === "LIMIT_REACHED") return "limitReached";
  if (cause.code === "ACCOUNT_CHANGED" || cause.status === 401)
    return "sessionChanged";
  if (["INVITATION_UNAVAILABLE", "INVITATION_USED"].includes(cause.code))
    return "invitationUnavailable";
  if (cause.code === "VERSION_CONFLICT") return "updateConflict";
  if (cause.status === 404 || cause.code === "FORBIDDEN") return "forbidden";
  if (cause.status === 422) return "validation";
  if (cause.status === 429) return "tooMany";
  if (cause.status === 0 || cause.status >= 500) return "unavailable";
  return "error";
}

export default function PropertyWorkspace({
  account,
  csrfToken,
  onSessionExpired,
  onSessionRefresh,
  onDirtyChange,
  onBusyChange,
  active = true,
  section = "properties",
  focusedSection = false,
  onSectionChange,
  onConfirmDiscard,
  notificationNavigation,
  onNotificationOpened,
  onNotificationPrepared,
}: {
  account: PrivateAccount;
  csrfToken: string;
  onSessionExpired: () => void;
  onSessionRefresh: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  active?: boolean;
  section?: ConnectedSection;
  focusedSection?: boolean;
  onSectionChange?: (section: ConnectedSection) => void;
  onConfirmDiscard?: () => Promise<boolean>;
  notificationNavigation?: NotificationNavigation | null;
  onNotificationOpened?: (
    requestId: string,
    outcome: NotificationOpenOutcome,
  ) => void;
  onNotificationPrepared?: (requestId: string) => void;
}) {
  const { i18n } = useTranslation();
  const language = (
    languages.some((item) => item.code === i18n.language) ? i18n.language : "pt"
  ) as LanguageCode;
  const copy = propertyWorkspaceCopy(language);
  const privateCopy = privateRecordsCopy(language);
  const rentCopy = propertyRentCopy(language);
  const showManagement = !focusedSection || section === "properties";
  const showRent = !focusedSection || section === "rent";
  const showDocuments = !focusedSection || section === "documents";
  const showMaintenance = !focusedSection || section === "maintenance";
  const id = useId();
  const [workspaces, setWorkspaces] = useState<PropertyWorkspaceRecord[]>([]);
  const [selection, setSelection] = useState<Selection>(noSelection);
  const [requests, setRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [access, setAccess] = useState<PropertyAccess>(emptyAccess);
  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft | null>(
    null,
  );
  const [ticketDraft, setTicketDraft] = useState<TicketDraft | null>(null);
  const [propertyConflict, setPropertyConflict] = useState(false);
  const [ticketConflict, setTicketConflict] = useState(false);
  const [issued, setIssued] = useState<IssuedInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<Message | null>(null);
  const [success, setSuccess] = useState<Message | null>(null);
  const [clipboardMessage, setClipboardMessage] = useState<Message | null>(
    null,
  );
  const [portfolioName, setPortfolioName] = useState("");
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [inviteAccount, setInviteAccount] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [requestTitle, setRequestTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState<boolean | null>(null);
  const [documentsDirty, setDocumentsDirty] = useState(false);
  const [documentsBusy, setDocumentsBusy] = useState(false);
  const [rentDirty, setRentDirty] = useState(false);
  const [rentBusy, setRentBusy] = useState(false);
  const [rentActivated, setRentActivated] = useState(false);
  const [documentsActivated, setDocumentsActivated] = useState(false);
  const activeRef = useRef(active);
  const rentEditingId = useRef<string | null>(null);
  const rentBusyRef = useRef(false);
  const [focusedRent, setFocusedRent] = useState<{
    id: string;
    requestId: string;
  } | null>(null);
  const [focusedDocument, setFocusedDocument] = useState<{
    id: string;
    requestId: string;
  } | null>(null);
  const handledNavigation = useRef<string | null>(null);
  const notificationTask = useRef<AbortController | null>(null);
  const previousNotification = useRef<string | null>(null);
  const confirmingNavigation = useRef<string | null>(null);
  const [approvedNavigation, setApprovedNavigation] = useState<string | null>(
    null,
  );
  const [focusedTicket, setFocusedTicket] = useState<string | null>(null);
  const documentsBusyRef = useRef(false);
  const selectionRef = useRef(selection);
  const propertyDraftRef = useRef(propertyDraft);
  const ticketDraftRef = useRef(ticketDraft);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const epoch = useRef(0);
  const auth = { accountId: account.id, csrfToken };
  const workspace =
    workspaces.find((item) => item.id === selection.workspaceId) ?? null;
  const property =
    workspace?.properties.find((item) => item.id === selection.propertyId) ??
    null;
  const owner = workspace?.role === "owner";
  const selectedRequest =
    requests.find((item) => item.id === ticketDraft?.id) ?? null;
  const localEdits =
    rentDirty ||
    documentsDirty ||
    propertyDirty(propertyDraft) ||
    ticketDirty(ticketDraft) ||
    requestTitle.length > 0 ||
    description.length > 0 ||
    inviteAccount.length > 0;
  const navigationDirty =
    localEdits || newName.length > 0 || newAddress.length > 0;
  const dirty =
    localEdits ||
    portfolioName.length > 0 ||
    newName.length > 0 ||
    newAddress.length > 0 ||
    joinCode.length > 0;

  const setPropertyEditor = useCallback((next: PropertyDraft | null) => {
    propertyDraftRef.current = next;
    setPropertyDraft(next);
  }, []);
  const setTicketEditor = useCallback((next: TicketDraft | null) => {
    ticketDraftRef.current = next;
    setTicketDraft(next);
  }, []);
  const resetPropertyData = useCallback(() => {
    setRentActivated(false);
    setDocumentsActivated(false);
    setRequests([]);
    setAccess(emptyAccess);
    setPropertyEditor(null);
    setTicketEditor(null);
    setPropertyConflict(false);
    setTicketConflict(false);
    setInviteAccount("");
    setRequestTitle("");
    setDescription("");
    setPriority("normal");
    setRequestFormOpen(false);
    setNewName("");
    setNewAddress("");
    setFocusedDocument(null);
    setFocusedRent(null);
  }, [setPropertyEditor, setTicketEditor]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    if (!active || !property) return;
    const activate = window.setTimeout(() => {
      if (showRent) setRentActivated(true);
      if (showDocuments) setDocumentsActivated(true);
    }, 0);
    return () => window.clearTimeout(activate);
  }, [active, property, showRent, showDocuments]);
  const handleRentSelection = useCallback((recordId: string | null) => {
    rentEditingId.current = recordId;
  }, []);

  const clearPrivateRecords = useCallback(() => {
    setWorkspaces([]);
    selectionRef.current = noSelection;
    setSelection(noSelection);
    setIssued([]);
    resetPropertyData();
  }, [resetPropertyData]);
  const handleDocumentAccessLost = useCallback(() => {
    clearPrivateRecords();
    setError("forbidden");
  }, [clearPrivateRecords]);
  const handleDocumentsBusy = useCallback((value: boolean) => {
    documentsBusyRef.current = value;
    setDocumentsBusy(value);
  }, []);
  const handleRentBusy = useCallback((value: boolean) => {
    rentBusyRef.current = value;
    setRentBusy(value);
  }, []);
  const handleRentDocument = useCallback(
    (documentId: string) => {
      setFocusedDocument({ id: documentId, requestId: crypto.randomUUID() });
      onSectionChange?.("documents");
    },
    [onSectionChange],
  );

  const reportFailure = useCallback(
    (cause: unknown) => {
      if (cause instanceof AccountClientError && cause.status === 401) {
        clearPrivateRecords();
        onSessionExpired();
        return;
      }
      if (cause instanceof AccountClientError && cause.code === "CSRF_DENIED") {
        setError("sessionChanged");
        onSessionRefresh();
        return;
      }
      if (
        cause instanceof AccountClientError &&
        ["NOT_FOUND", "FORBIDDEN"].includes(cause.code)
      ) {
        // Never leave a revoked property's private records available in this view.
        clearPrivateRecords();
      }
      setError(errorMessage(cause));
    },
    [clearPrivateRecords, onSessionExpired, onSessionRefresh],
  );

  const loadSnapshot = useCallback(
    async (
      signal: AbortSignal,
      desired?: Selection,
      discardEdits: EditorReset = false,
      requireExact = false,
    ) => {
      const credentials = { accountId: account.id, csrfToken, signal };
      const payload = await workspaceRequest(
        "workspaces",
        workspacesResponseSchema,
        credentials,
      );
      if (signal.aborted) return;
      const previous = selectionRef.current;
      const requested = desired ?? previous;
      if (
        requireExact &&
        !payload.workspaces.some(
          (item) =>
            item.id === requested.workspaceId &&
            item.properties.some(
              (record) => record.id === requested.propertyId,
            ),
        )
      )
        throw new AccountClientError(404, "NOT_FOUND");
      const nextWorkspace =
        payload.workspaces.find((item) => item.id === requested.workspaceId) ??
        payload.workspaces[0];
      const nextProperty =
        nextWorkspace?.properties.find(
          (item) => item.id === requested.propertyId,
        ) ?? nextWorkspace?.properties[0];
      const nextSelection = {
        workspaceId: nextWorkspace?.id ?? "",
        propertyId: nextProperty?.id ?? "",
      };
      const changedProperty = previous.propertyId !== nextSelection.propertyId;
      if (changedProperty) resetPropertyData();
      setWorkspaces(payload.workspaces);
      selectionRef.current = nextSelection;
      setSelection(nextSelection);
      if (!nextProperty || !nextWorkspace) {
        resetPropertyData();
        return;
      }
      const [maintenance, propertyAccess] = await Promise.all([
        workspaceRequest(
          `properties/${nextProperty.id}/maintenance`,
          maintenanceListSchema,
          credentials,
        ),
        nextWorkspace.role === "owner"
          ? workspaceRequest(
              `properties/${nextProperty.id}/access`,
              propertyAccessSchema,
              credentials,
            )
          : Promise.resolve(emptyAccess),
      ]);
      if (signal.aborted) return;
      setRequests(maintenance.requests);
      setAccess(propertyAccess);
      setIssued((items) =>
        items.filter(
          (item) =>
            item.propertyId !== nextProperty.id ||
            propertyAccess.invitations.some(
              (invite) => invite.id === item.id && invite.status === "pending",
            ),
        ),
      );
      const previousProperty = propertyDraftRef.current;
      if (
        discardEdits === "all" ||
        discardEdits === "property" ||
        changedProperty ||
        !propertyDirty(previousProperty)
      ) {
        setPropertyEditor(editProperty(nextProperty));
        setPropertyConflict(false);
      } else if (previousProperty?.version !== nextProperty.version)
        setPropertyConflict(true);
      const previousTicket = ticketDraftRef.current;
      const latestTicket =
        maintenance.requests.find((item) => item.id === previousTicket?.id) ??
        (!previousTicket ? maintenance.requests[0] : undefined);
      if (!latestTicket) {
        setTicketEditor(null);
        setTicketConflict(false);
      } else if (
        discardEdits === "all" ||
        discardEdits === "ticket" ||
        !ticketDirty(previousTicket)
      ) {
        setTicketEditor(editTicket(latestTicket));
        setTicketConflict(false);
      } else if (previousTicket?.version !== latestTicket.version)
        setTicketConflict(true);
      return { property: nextProperty, requests: maintenance.requests };
    },
    [
      account.id,
      csrfToken,
      resetPropertyData,
      setPropertyEditor,
      setTicketEditor,
    ],
  );

  const refresh = useCallback(
    async (discardEdits: EditorReset = false, desired?: Selection) => {
      if (pendingRef.current || documentsBusyRef.current || rentBusyRef.current)
        return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestEpoch = ++epoch.current;
      pendingRef.current = true;
      setPending(true);
      setError(null);
      try {
        await loadSnapshot(controller.signal, desired, discardEdits);
        if (!controller.signal.aborted) setUncertain(false);
      } catch (cause) {
        if (!controller.signal.aborted) reportFailure(cause);
      } finally {
        if (
          controllerRef.current === controller &&
          requestEpoch === epoch.current
        ) {
          pendingRef.current = false;
          setPending(false);
          setLoading(false);
        }
      }
    },
    [loadSnapshot, reportFailure],
  );

  useEffect(() => {
    const focus = () => {
      if (activeRef.current && document.visibilityState === "visible")
        void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      controllerRef.current?.abort();
      pendingRef.current = false;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!active) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initial);
  }, [active, refresh]);

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onBusyChange?.(
      loading || pending || uncertain || documentsBusy || rentBusy,
    );
    return () => onBusyChange?.(false);
  }, [loading, pending, uncertain, documentsBusy, rentBusy, onBusyChange]);

  useEffect(() => {
    const previous = previousNotification.current;
    previousNotification.current = notificationNavigation?.requestId ?? null;
    if (!notificationNavigation) {
      confirmingNavigation.current = null;
      notificationTask.current?.abort();
      if (previous)
        window.setTimeout(() => {
          setFocusedRent((target) =>
            target?.requestId === previous ? null : target,
          );
          setFocusedDocument((target) =>
            target?.requestId === previous ? null : target,
          );
          setFocusedTicket((target) => (target === previous ? null : target));
        }, 0);
    }
    return () => {
      notificationTask.current?.abort();
    };
  }, [notificationNavigation]);

  useEffect(() => {
    const navigation = notificationNavigation;
    if (
      !navigation ||
      !onNotificationOpened ||
      handledNavigation.current === navigation.requestId
    )
      return;
    const start = window.setTimeout(() => {
      if (
        navigation.accountId !== account.id ||
        pendingRef.current ||
        documentsBusyRef.current ||
        rentBusyRef.current
      ) {
        handledNavigation.current = navigation.requestId;
        onNotificationOpened(navigation.requestId, "cancelled");
        return;
      }
      const differentProperty =
        navigation.target.propertyId !== selectionRef.current.propertyId;
      const differentTicket =
        navigation.target.kind.startsWith("maintenance_") &&
        ticketDraftRef.current?.id !== navigation.target.resourceId;
      const needsDiscard =
        (differentProperty && navigationDirty) ||
        (differentTicket && ticketDirty(ticketDraftRef.current)) ||
        (navigation.target.kind.startsWith("rent_") &&
          rentDirty &&
          rentEditingId.current !== navigation.target.resourceId);
      if (needsDiscard && approvedNavigation !== navigation.requestId) {
        if (confirmingNavigation.current === navigation.requestId) return;
        confirmingNavigation.current = navigation.requestId;
        void (onConfirmDiscard?.() ?? Promise.resolve(false)).then(
          (confirmed) => {
            if (confirmingNavigation.current !== navigation.requestId) return;
            confirmingNavigation.current = null;
            if (confirmed) setApprovedNavigation(navigation.requestId);
            else {
              handledNavigation.current = navigation.requestId;
              onNotificationOpened(navigation.requestId, "cancelled");
            }
          },
        );
        return;
      }
      handledNavigation.current = navigation.requestId;
      controllerRef.current?.abort();
      const task = new AbortController();
      controllerRef.current = task;
      notificationTask.current = task;
      pendingRef.current = true;
      setPending(true);
      setError(null);
      void (async () => {
        let outcome: NotificationOpenOutcome = "failed";
        try {
          const credentials = {
            accountId: account.id,
            csrfToken,
            signal: task.signal,
          };
          const current = await workspaceRequest(
            "workspaces",
            workspacesResponseSchema,
            credentials,
          );
          if (task.signal.aborted) return;
          const parent = current.workspaces.find((item) =>
            item.properties.some(
              (record) => record.id === navigation.target.propertyId,
            ),
          );
          if (!parent) throw new AccountClientError(404, "NOT_FOUND");
          if (navigation.target.kind === "document_shared") {
            const docs = await workspaceRequest(
              `properties/${navigation.target.propertyId}/documents`,
              privateDocumentListSchema,
              credentials,
            );
            if (task.signal.aborted) return;
            if (
              !docs.documents.some(
                (item) =>
                  item.id === navigation.target.resourceId && !item.archived,
              )
            ) {
              outcome = "unavailable";
              return;
            }
          } else if (navigation.target.kind.startsWith("rent_")) {
            const rent = await workspaceRequest(
              `rent-records/${navigation.target.resourceId}`,
              persistedRentDetailSchema,
              credentials,
            );
            if (task.signal.aborted) return;
            if (rent.record.propertyId !== navigation.target.propertyId) {
              outcome = "unavailable";
              return;
            }
          } else {
            const tickets = await workspaceRequest(
              `properties/${navigation.target.propertyId}/maintenance`,
              maintenanceListSchema,
              credentials,
            );
            if (task.signal.aborted) return;
            if (
              !tickets.requests.some(
                (item) => item.id === navigation.target.resourceId,
              )
            ) {
              outcome = "unavailable";
              return;
            }
          }
          const snapshot = await loadSnapshot(
            task.signal,
            {
              workspaceId: parent.id,
              propertyId: navigation.target.propertyId,
            },
            differentProperty ? "all" : false,
            true,
          );
          if (task.signal.aborted || !snapshot) return;
          if (navigation.target.kind === "document_shared")
            setFocusedDocument({
              id: navigation.target.resourceId,
              requestId: navigation.requestId,
            });
          else if (navigation.target.kind.startsWith("rent_"))
            setFocusedRent({
              id: navigation.target.resourceId,
              requestId: navigation.requestId,
            });
          else {
            const ticket = snapshot.requests.find(
              (item) => item.id === navigation.target.resourceId,
            );
            if (!ticket) {
              outcome = "unavailable";
              return;
            }
            if (differentTicket || !ticketDirty(ticketDraftRef.current)) {
              setTicketEditor(editTicket(ticket));
              setTicketConflict(false);
            }
            setFocusedTicket(navigation.requestId);
          }
          outcome = "opened";
          onNotificationPrepared?.(navigation.requestId);
        } catch (cause) {
          if (!task.signal.aborted) {
            reportFailure(cause);
            if (
              cause instanceof AccountClientError &&
              (cause.status === 404 || cause.code === "FORBIDDEN")
            )
              outcome = "unavailable";
          }
        } finally {
          if (controllerRef.current === task) {
            pendingRef.current = false;
            setPending(false);
            setLoading(false);
          }
          if (notificationTask.current === task)
            notificationTask.current = null;
          if (
            task.signal.aborted ||
            outcome !== "opened" ||
            !onNotificationPrepared
          )
            onNotificationOpened(
              navigation.requestId,
              task.signal.aborted ? "cancelled" : outcome,
            );
        }
      })();
    }, 0);
    return () => window.clearTimeout(start);
  }, [
    notificationNavigation,
    onNotificationOpened,
    onNotificationPrepared,
    account.id,
    csrfToken,
    navigationDirty,
    rentDirty,
    approvedNavigation,
    onConfirmDiscard,
    loadSnapshot,
    reportFailure,
    setTicketEditor,
  ]);
  useEffect(() => {
    if (!active || !showMaintenance || !focusedTicket) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`${id}-request`);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "instant" });
        onNotificationOpened?.(focusedTicket, "opened");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, showMaintenance, focusedTicket, id, onNotificationOpened]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  async function mutate<T>(
    path: string,
    schema: z.ZodType<T>,
    method: "POST" | "PATCH" | "DELETE",
    body: unknown,
    message: Message,
    onSaved?: (payload: T) => Selection | void,
    conflictTarget?: "property" | "ticket" | "invitation",
  ) {
    if (
      pendingRef.current ||
      documentsBusyRef.current ||
      rentBusyRef.current ||
      uncertain
    )
      return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestEpoch = ++epoch.current;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    let committed = false;
    try {
      const payload = await workspaceRequest(path, schema, {
        ...auth,
        signal: controller.signal,
        method,
        body,
      });
      if (controller.signal.aborted) return;
      committed = true;
      const desired = onSaved?.(payload);
      setSuccess(message);
      await loadSnapshot(controller.signal, desired || undefined);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (
        cause instanceof AccountClientError &&
        cause.code === "VERSION_CONFLICT"
      ) {
        if (conflictTarget === "property") setPropertyConflict(true);
        else setTicketConflict(true);
      } else if (
        cause instanceof AccountClientError &&
        conflictTarget === "invitation" &&
        cause.code === "ACCOUNT_NOT_FOUND"
      ) {
        setError("accountMissing");
      } else reportFailure(cause);
      if (
        !committed &&
        cause instanceof AccountClientError &&
        (cause.status === 0 || cause.status >= 500)
      )
        setUncertain(true);
    } finally {
      if (!controller.signal.aborted && requestEpoch === epoch.current) {
        pendingRef.current = false;
        setPending(false);
        setLoading(false);
      }
    }
  }

  function choose(next: Selection) {
    if (
      pending ||
      documentsBusyRef.current ||
      rentBusyRef.current ||
      (navigationDirty && !window.confirm(copy.discardConfirm))
    )
      return;
    resetPropertyData();
    setNewName("");
    setNewAddress("");
    setError(null);
    setSuccess(null);
    void refresh("all", next);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setClipboardMessage("copied");
    } catch {
      setClipboardMessage("copyFailed");
    }
  }

  const date = (value: string) =>
    new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  const invalid = (event: FormEvent) => {
    event.preventDefault();
    setError("validation");
  };
  const blocked = pending || documentsBusy || rentBusy || uncertain;
  const setupVisible =
    setupOpen ??
    (portfolioName.length > 0 ||
      joinCode.length > 0 ||
      (!loading && workspaces.length === 0));

  return (
    <section className="property-workspace" aria-labelledby={`${id}-title`}>
      <header className="pw-heading">
        <div>
          <span className="pw-eyebrow">KASA · {copy.properties}</span>
          <h1 id={`${id}-title`}>
            {focusedSection && section === "rent"
              ? rentCopy.title
              : focusedSection && section === "documents"
                ? privateCopy.documents
                : focusedSection && section === "maintenance"
                  ? copy.maintenance
                  : copy.title}
          </h1>
          <p>{copy.intro}</p>
        </div>
        <button
          className="pw-secondary"
          disabled={pending || documentsBusy || rentBusy}
          type="button"
          onClick={() => void refresh()}
        >
          <RefreshCw size={17} aria-hidden="true" />
          {pending ? copy.loading : copy.refresh}
        </button>
      </header>
      <p className="pw-local-note">
        <ShieldCheck size={19} aria-hidden="true" />
        <span>{copy.localNote}</span>
      </p>
      {clipboardMessage && (
        <p className="pw-feedback" role="status">
          {copy[clipboardMessage]}
        </p>
      )}
      {error && (
        <p className="pw-feedback is-error" role="alert">
          {copy[error]}
        </p>
      )}
      {success && (
        <p className="pw-feedback is-success" role="status">
          <Check size={17} aria-hidden="true" />
          {copy[success]}
        </p>
      )}
      {uncertain && (
        <p className="pw-feedback is-warning" role="alert">
          {copy.uncertain}
        </p>
      )}
      <details className="pw-setup" open={setupVisible}>
        <summary
          onClick={(event) => {
            event.preventDefault();
            setSetupOpen(!setupVisible);
          }}
        >
          <UsersRound size={18} aria-hidden="true" />
          {copy.setup}
        </summary>
        <details className="pw-identity">
          <summary>
            <KeyRound size={18} aria-hidden="true" />
            {copy.identity}
          </summary>
          <p>{copy.identityNote}</p>
          <div className="pw-copy-row">
            <input
              aria-label={copy.identity}
              value={account.id}
              readOnly
              dir="ltr"
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              className="pw-secondary"
              onClick={() => void copyText(account.id)}
            >
              <Clipboard size={16} aria-hidden="true" />
              {copy.copy}
            </button>
          </div>
        </details>

        <div className="pw-entry-grid">
          <details className="pw-card pw-entry">
            <summary>
              <Building2 size={21} aria-hidden="true" />
              {copy.createPortfolio}
              <Plus size={18} aria-hidden="true" />
            </summary>
            <form
              className="pw-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!validText(portfolioName, 100)) return invalid(event);
                if (navigationDirty && !window.confirm(copy.discardConfirm))
                  return;
                void mutate(
                  "workspaces",
                  createdWorkspaceSchema,
                  "POST",
                  { name: portfolioName.trim() },
                  "portfolioCreated",
                  (payload) => {
                    setPortfolioName("");
                    return {
                      workspaceId: payload.workspace.id,
                      propertyId: "",
                    };
                  },
                );
              }}
            >
              <label>
                {copy.portfolioName}
                <input
                  name="portfolioName"
                  value={portfolioName}
                  maxLength={100}
                  disabled={pending}
                  onChange={(event) => setPortfolioName(event.target.value)}
                  required
                />
              </label>
              <button className="pw-primary" disabled={blocked} type="submit">
                {pending ? copy.working : copy.createPortfolio}
              </button>
            </form>
          </details>
          <details className="pw-card pw-entry">
            <summary>
              <KeyRound size={21} aria-hidden="true" />
              {copy.join}
              <Plus size={18} aria-hidden="true" />
            </summary>
            <p>{copy.joinNote}</p>
            <form
              className="pw-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!/^[A-Za-z0-9_-]{43}$/.test(joinCode.trim()))
                  return invalid(event);
                if (navigationDirty && !window.confirm(copy.discardConfirm))
                  return;
                void mutate(
                  "invitations/accept",
                  acceptedInvitationSchema,
                  "POST",
                  { code: joinCode.trim() },
                  "joined",
                  (payload) => {
                    setJoinCode("");
                    return payload;
                  },
                );
              }}
            >
              <label>
                {copy.invitationCode}
                <input
                  name="invitationCode"
                  value={joinCode}
                  maxLength={100}
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={pending}
                  onChange={(event) => setJoinCode(event.target.value)}
                  required
                />
              </label>
              <button className="pw-primary" disabled={blocked} type="submit">
                {pending ? copy.working : copy.accept}
              </button>
            </form>
          </details>
        </div>
      </details>

      {loading ? (
        <div className="pw-empty" role="status">
          <LoaderCircle
            className="account-spinner"
            size={24}
            aria-hidden="true"
          />
          {copy.loading}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="pw-empty">
          <Building2 size={35} aria-hidden="true" />
          <h2>{copy.empty}</h2>
          <p>{copy.emptyNote}</p>
        </div>
      ) : (
        <>
          <div className="pw-workspace-select">
            <label htmlFor={`${id}-workspace`}>{copy.selectWorkspace}</label>
            <select
              id={`${id}-workspace`}
              value={selection.workspaceId}
              disabled={pending}
              onChange={(event) =>
                choose({ workspaceId: event.target.value, propertyId: "" })
              }
            >
              {workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {copy[item.role]}
                </option>
              ))}
            </select>
            <span className="pw-role">{owner ? copy.owner : copy.tenant}</span>
          </div>
          <div className="pw-main-grid">
            <aside className="pw-property-list">
              <h2>{copy.properties}</h2>
              {workspace?.properties.length === 0 && (
                <p className="pw-muted">{copy.noProperties}</p>
              )}
              {workspace?.properties.map((item) => (
                <button
                  key={item.id}
                  className={`pw-property-button${property?.id === item.id ? " is-selected" : ""}`}
                  type="button"
                  aria-pressed={property?.id === item.id}
                  disabled={pending}
                  onClick={() =>
                    choose({ workspaceId: workspace.id, propertyId: item.id })
                  }
                >
                  <span className="pw-property-icon">
                    <Building2 size={21} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.address}</small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              ))}
              {owner && workspace && (
                <details className="pw-card pw-add-property">
                  <summary>
                    <Plus size={17} aria-hidden="true" />
                    {copy.addProperty}
                  </summary>
                  <form
                    className="pw-form"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (
                        !validText(newName, 100) ||
                        !validText(newAddress, 300)
                      )
                        return invalid(event);
                      if (localEdits && !window.confirm(copy.discardConfirm))
                        return;
                      void mutate(
                        `workspaces/${workspace.id}/properties`,
                        propertyResponseSchema,
                        "POST",
                        { name: newName.trim(), address: newAddress.trim() },
                        "propertyCreated",
                        (payload) => {
                          setNewName("");
                          setNewAddress("");
                          return {
                            workspaceId: payload.property.workspaceId,
                            propertyId: payload.property.id,
                          };
                        },
                      );
                    }}
                  >
                    <label>
                      {copy.propertyName}
                      <input
                        name="propertyName"
                        value={newName}
                        maxLength={100}
                        disabled={pending}
                        onChange={(event) => setNewName(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      {copy.address}
                      <textarea
                        name="propertyAddress"
                        value={newAddress}
                        maxLength={300}
                        rows={3}
                        disabled={pending}
                        onChange={(event) => setNewAddress(event.target.value)}
                        required
                      />
                    </label>
                    <button
                      className="pw-primary"
                      type="submit"
                      disabled={blocked}
                    >
                      {pending ? copy.working : copy.addProperty}
                    </button>
                  </form>
                </details>
              )}
            </aside>

            {property && (
              <div className="pw-property-content">
                <section className="pw-card pw-property-heading">
                  <span className="pw-property-icon">
                    <Building2 size={25} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>{property.name}</h2>
                    <p>
                      <MapPin size={15} aria-hidden="true" />
                      {property.address}
                    </p>
                  </div>
                </section>
                {onSectionChange && (
                  <nav
                    className="pw-section-navigation"
                    aria-label={copy.properties}
                  >
                    {(
                      [
                        ["properties", copy.properties, Building2],
                        ["rent", rentCopy.title, WalletCards],
                        ["documents", privateCopy.documents, FileText],
                        ["maintenance", copy.maintenance, Wrench],
                      ] as const
                    ).map(([destination, label, Icon]) => (
                      <button
                        key={destination}
                        type="button"
                        className="pw-secondary"
                        aria-current={
                          section === destination ? "page" : undefined
                        }
                        onClick={() => onSectionChange(destination)}
                      >
                        <Icon size={17} aria-hidden="true" />
                        {label}
                      </button>
                    ))}
                  </nav>
                )}
                {owner && propertyDraft && (
                  <details className="pw-card" hidden={!showManagement}>
                    <summary>{copy.editProperty}</summary>
                    <form
                      className="pw-form"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (
                          propertyConflict ||
                          !propertyDraft ||
                          !validText(propertyDraft.name, 100) ||
                          !validText(propertyDraft.address, 300)
                        )
                          return invalid(event);
                        void mutate(
                          `properties/${property.id}`,
                          propertyResponseSchema,
                          "PATCH",
                          {
                            name: propertyDraft.name.trim(),
                            address: propertyDraft.address.trim(),
                            version: propertyDraft.version,
                          },
                          "propertySaved",
                          (payload) => {
                            setPropertyEditor(editProperty(payload.property));
                            setPropertyConflict(false);
                          },
                          "property",
                        );
                      }}
                    >
                      <label>
                        {copy.propertyName}
                        <input
                          value={propertyDraft.name}
                          maxLength={100}
                          disabled={pending}
                          onChange={(event) =>
                            setPropertyEditor({
                              ...propertyDraft,
                              name: event.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      <label>
                        {copy.address}
                        <textarea
                          value={propertyDraft.address}
                          rows={3}
                          maxLength={300}
                          disabled={pending}
                          onChange={(event) =>
                            setPropertyEditor({
                              ...propertyDraft,
                              address: event.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      {propertyConflict && (
                        <div className="pw-feedback is-warning" role="alert">
                          <p>{copy.propertyConflict}</p>
                          <button
                            className="pw-secondary"
                            type="button"
                            disabled={pending}
                            onClick={() => void refresh("property")}
                          >
                            {copy.reload}
                          </button>
                        </div>
                      )}
                      <div className="pw-action-row">
                        <button
                          className="pw-primary"
                          type="submit"
                          disabled={
                            blocked ||
                            propertyConflict ||
                            !propertyDirty(propertyDraft)
                          }
                        >
                          {pending ? copy.working : copy.save}
                        </button>
                        <button
                          className="pw-secondary"
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setPropertyEditor(editProperty(property));
                            setPropertyConflict(false);
                          }}
                        >
                          {copy.cancel}
                        </button>
                      </div>
                    </form>
                  </details>
                )}

                {owner && (
                  <details
                    className="pw-card pw-access"
                    hidden={!showManagement}
                  >
                    <summary>
                      <UsersRound size={19} aria-hidden="true" />
                      {copy.access}
                    </summary>
                    <h3>{copy.invite}</h3>
                    <p className="pw-muted">{copy.inviteNote}</p>
                    <form
                      className="pw-form"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!z.uuid().safeParse(inviteAccount.trim()).success)
                          return invalid(event);
                        void mutate(
                          `properties/${property.id}/invitations`,
                          issuedInvitationSchema,
                          "POST",
                          { accountId: inviteAccount.trim() },
                          "inviteCreated",
                          (payload) => {
                            setIssued((items) => [
                              payload.invitation,
                              ...items,
                            ]);
                            setInviteAccount("");
                          },
                          "invitation",
                        );
                      }}
                    >
                      <label>
                        {copy.targetAccount}
                        <input
                          value={inviteAccount}
                          maxLength={100}
                          dir="ltr"
                          autoComplete="off"
                          spellCheck={false}
                          disabled={pending}
                          onChange={(event) =>
                            setInviteAccount(event.target.value)
                          }
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        className="pw-primary"
                        disabled={blocked}
                      >
                        {pending ? copy.working : copy.sendInvitation}
                      </button>
                    </form>
                    {issued
                      .filter((item) => item.propertyId === property.id)
                      .map((item) => (
                        <div className="pw-issued-code" key={item.id}>
                          <strong>{copy.invitationCode}</strong>
                          <p>{copy.codeOnce}</p>
                          <div className="pw-copy-row">
                            <input
                              aria-label={copy.invitationCode}
                              readOnly
                              dir="ltr"
                              value={item.code}
                              onFocus={(event) => event.target.select()}
                            />
                            <button
                              className="pw-secondary"
                              type="button"
                              onClick={() => void copyText(item.code)}
                            >
                              {copy.copy}
                            </button>
                          </div>
                          <small>
                            {copy.expires}: {date(item.expiresAt)}
                          </small>
                        </div>
                      ))}
                    <h3>{copy.tenants}</h3>
                    {access.tenants.length === 0 ? (
                      <p className="pw-muted">{copy.noTenants}</p>
                    ) : (
                      <ul className="pw-access-list">
                        {access.tenants.map((item) => (
                          <li key={item.accountId}>
                            <UserRound size={19} aria-hidden="true" />
                            <span>
                              <strong>{item.displayName}</strong>
                              <small dir="ltr">{item.accountId}</small>
                            </span>
                            <button
                              className="pw-danger"
                              type="button"
                              disabled={blocked}
                              onClick={() => {
                                if (window.confirm(copy.removeConfirm))
                                  void mutate(
                                    `properties/${property.id}/tenants/${item.accountId}`,
                                    removedTenantSchema,
                                    "DELETE",
                                    {},
                                    "removedSuccess",
                                    () => {
                                      setAccess((current) => ({
                                        ...current,
                                        tenants: current.tenants.filter(
                                          (tenant) =>
                                            tenant.accountId !== item.accountId,
                                        ),
                                      }));
                                    },
                                  );
                              }}
                            >
                              {copy.remove}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <h3>{copy.invitations}</h3>
                    {access.invitations.length === 0 ? (
                      <p className="pw-muted">{copy.noInvitations}</p>
                    ) : (
                      <ul className="pw-access-list">
                        {access.invitations.map((item) => (
                          <li key={item.id}>
                            <KeyRound size={17} aria-hidden="true" />
                            <span>
                              <small dir="ltr">{item.accountId}</small>
                              <span className="pw-badge">
                                {copy[item.status]}
                              </span>
                              <small>
                                {copy.expires}: {date(item.expiresAt)}
                              </small>
                            </span>
                            {item.status === "pending" && (
                              <button
                                className="pw-danger"
                                type="button"
                                disabled={blocked}
                                onClick={() => {
                                  if (window.confirm(copy.revokeConfirm))
                                    void mutate(
                                      `invitations/${item.id}`,
                                      revokedInvitationSchema,
                                      "DELETE",
                                      {},
                                      "revokedSuccess",
                                      () => {
                                        setIssued((items) =>
                                          items.filter(
                                            (invite) => invite.id !== item.id,
                                          ),
                                        );
                                        setAccess((current) => ({
                                          ...current,
                                          invitations: current.invitations.map(
                                            (invite) =>
                                              invite.id === item.id
                                                ? {
                                                    ...invite,
                                                    status: "revoked",
                                                  }
                                                : invite,
                                          ),
                                        }));
                                      },
                                    );
                                }}
                              >
                                {copy.revoke}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}

                {(rentActivated || (active && showRent)) && (
                  <div hidden={!showRent}>
                    <PropertyRentRecords
                      key={`rent:${account.id}:${property.id}`}
                      account={account}
                      csrfToken={csrfToken}
                      propertyId={property.id}
                      owner={owner}
                      access={access}
                      focusRecordId={focusedRent?.id}
                      focusRequestId={focusedRent?.requestId}
                      onSessionExpired={onSessionExpired}
                      onSessionRefresh={onSessionRefresh}
                      onAccessLost={handleDocumentAccessLost}
                      onDirtyChange={setRentDirty}
                      onBusyChange={handleRentBusy}
                      onOpenDocument={handleRentDocument}
                      propertyBusy={pending || documentsBusy}
                      active={active && showRent}
                      openSection={focusedSection && section === "rent"}
                      onFocusResolved={onNotificationOpened}
                      onSelectedRecordChange={handleRentSelection}
                    />
                  </div>
                )}

                {(documentsActivated || (active && showDocuments)) && (
                  <div hidden={!showDocuments}>
                    <PropertyDocuments
                      key={`${account.id}:${property.id}`}
                      account={account}
                      csrfToken={csrfToken}
                      propertyId={property.id}
                      owner={owner}
                      access={access}
                      focusDocumentId={focusedDocument?.id}
                      focusRequestId={focusedDocument?.requestId}
                      onSessionExpired={onSessionExpired}
                      onSessionRefresh={onSessionRefresh}
                      onAccessLost={handleDocumentAccessLost}
                      onDirtyChange={setDocumentsDirty}
                      onBusyChange={handleDocumentsBusy}
                      active={active && showDocuments}
                      openSection={focusedSection && section === "documents"}
                      onFocusResolved={onNotificationOpened}
                    />
                  </div>
                )}

                <section
                  className="pw-card pw-maintenance"
                  hidden={!showMaintenance}
                  aria-labelledby={`${id}-maintenance`}
                >
                  <header className="pw-section-heading">
                    <div>
                      <h2 id={`${id}-maintenance`}>
                        <Wrench size={22} aria-hidden="true" />
                        {copy.maintenance}
                      </h2>
                      <p className="pw-muted">
                        {owner
                          ? copy.ownerRequestsNote
                          : copy.tenantRequestsNote}
                      </p>
                    </div>
                    <button
                      className="pw-secondary"
                      type="button"
                      disabled={pending}
                      aria-expanded={requestFormOpen}
                      onClick={() => setRequestFormOpen((value) => !value)}
                    >
                      <Plus size={17} aria-hidden="true" />
                      {copy.newRequest}
                    </button>
                  </header>
                  {requestFormOpen && (
                    <form
                      className="pw-form pw-new-request"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (
                          !validText(requestTitle, 140) ||
                          !validText(description, 4000)
                        )
                          return invalid(event);
                        if (
                          ticketDirty(ticketDraft) &&
                          !window.confirm(copy.discardConfirm)
                        )
                          return;
                        void mutate(
                          `properties/${property.id}/maintenance`,
                          maintenanceResponseSchema,
                          "POST",
                          {
                            title: requestTitle.trim(),
                            description: description.trim(),
                            priority,
                          },
                          "requestCreated",
                          (payload) => {
                            setRequests((items) => [payload.request, ...items]);
                            setTicketEditor(editTicket(payload.request));
                            setRequestTitle("");
                            setDescription("");
                            setPriority("normal");
                            setRequestFormOpen(false);
                          },
                        );
                      }}
                    >
                      <label>
                        {copy.requestTitle}
                        <input
                          value={requestTitle}
                          maxLength={140}
                          disabled={pending}
                          onChange={(event) =>
                            setRequestTitle(event.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        {copy.description}
                        <textarea
                          value={description}
                          maxLength={4000}
                          rows={4}
                          disabled={pending}
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        {copy.priority}
                        <select
                          value={priority}
                          disabled={pending}
                          onChange={(event) =>
                            setPriority(
                              event.target.value as "normal" | "urgent",
                            )
                          }
                        >
                          <option value="normal">{copy.normal}</option>
                          <option value="urgent">{copy.urgent}</option>
                        </select>
                      </label>
                      <p className="pw-muted">{copy.emergency}</p>
                      <button
                        className="pw-primary"
                        disabled={blocked}
                        type="submit"
                      >
                        {pending ? copy.working : copy.createRequest}
                      </button>
                    </form>
                  )}
                  {requests.length === 0 ? (
                    <p className="pw-empty-inline">{copy.noRequests}</p>
                  ) : (
                    <div className="pw-request-list">
                      {requests.map((item) => (
                        <button
                          className={`pw-request-button${ticketDraft?.id === item.id ? " is-selected" : ""}`}
                          type="button"
                          key={item.id}
                          disabled={pending}
                          aria-pressed={ticketDraft?.id === item.id}
                          onClick={() => {
                            if (
                              ticketDirty(ticketDraft) &&
                              !window.confirm(copy.discardConfirm)
                            )
                              return;
                            setTicketEditor(editTicket(item));
                            setTicketConflict(false);
                          }}
                        >
                          <span>
                            <strong>{item.title}</strong>
                            <small>{date(item.updatedAt)}</small>
                          </span>
                          <span className={`pw-badge is-${item.status}`}>
                            {copy[item.status]}
                          </span>
                          {item.priority === "urgent" && (
                            <span className="pw-badge is-urgent">
                              {copy.urgent}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {selectedRequest && ticketDraft && (
                  <section
                    className="pw-card pw-request-detail"
                    hidden={!showMaintenance}
                    aria-labelledby={`${id}-request`}
                  >
                    <div className="pw-section-heading">
                      <h2 id={`${id}-request`}>{selectedRequest.title}</h2>
                      <span className={`pw-badge is-${selectedRequest.status}`}>
                        {copy[selectedRequest.status]}
                      </span>
                    </div>
                    <p className="pw-description">
                      {selectedRequest.description}
                    </p>
                    <h3>{copy.history}</h3>
                    <ol className="pw-timeline">
                      {selectedRequest.history.map((item) => (
                        <li key={item.id}>
                          <span className="pw-timeline-dot">
                            <Clock3 size={13} aria-hidden="true" />
                          </span>
                          <div>
                            <strong>{copy[item.kind]}</strong>
                            <span className="pw-actor">{item.actorName}</span>
                            {item.kind === "status_changed" && (
                              <span className="pw-badge">
                                {copy[item.status]}
                              </span>
                            )}
                            {item.message && <p>{item.message}</p>}
                            <time dateTime={item.createdAt}>
                              {date(item.createdAt)}
                            </time>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <form
                      className="pw-form"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (
                          ticketConflict ||
                          ticketDraft.message.length > 2000 ||
                          (!ticketDraft.message.trim() &&
                            (!owner ||
                              ticketDraft.status ===
                                ticketDraft.originalStatus))
                        )
                          return invalid(event);
                        void mutate(
                          `maintenance/${selectedRequest.id}`,
                          maintenanceResponseSchema,
                          "PATCH",
                          {
                            version: ticketDraft.version,
                            ...(owner &&
                            ticketDraft.status !== ticketDraft.originalStatus
                              ? { status: ticketDraft.status }
                              : {}),
                            ...(ticketDraft.message.trim()
                              ? { message: ticketDraft.message.trim() }
                              : {}),
                          },
                          "updated",
                          (payload) => {
                            setTicketEditor(editTicket(payload.request));
                            setTicketConflict(false);
                          },
                          "ticket",
                        );
                      }}
                    >
                      {owner && (
                        <label>
                          {copy.status}
                          <select
                            value={ticketDraft.status}
                            disabled={pending}
                            onChange={(event) =>
                              setTicketEditor({
                                ...ticketDraft,
                                status: event.target.value as MaintenanceStatus,
                              })
                            }
                          >
                            <option value="open">{copy.open}</option>
                            <option value="in_progress">
                              {copy.in_progress}
                            </option>
                            <option value="resolved">{copy.resolved}</option>
                          </select>
                        </label>
                      )}
                      <label>
                        {copy.message}
                        <textarea
                          value={ticketDraft.message}
                          maxLength={2000}
                          rows={3}
                          disabled={pending}
                          onChange={(event) =>
                            setTicketEditor({
                              ...ticketDraft,
                              message: event.target.value,
                            })
                          }
                        />
                      </label>
                      {ticketConflict && (
                        <div className="pw-feedback is-warning" role="alert">
                          <p>{copy.updateConflict}</p>
                          <button
                            className="pw-secondary"
                            type="button"
                            disabled={pending}
                            onClick={() => void refresh("ticket")}
                          >
                            {copy.reload}
                          </button>
                        </div>
                      )}
                      <button
                        className="pw-primary"
                        type="submit"
                        disabled={
                          blocked || ticketConflict || !ticketDirty(ticketDraft)
                        }
                      >
                        {pending ? copy.working : copy.sendUpdate}
                      </button>
                    </form>
                  </section>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
