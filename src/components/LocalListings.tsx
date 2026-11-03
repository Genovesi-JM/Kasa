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
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { languages, type LanguageCode } from "../i18n";
import {
  AccountClientError,
  type PrivateAccount,
} from "../platform/accountClient";
import {
  workspaceRequest,
  workspacesResponseSchema,
} from "../platform/workspaceClient";
import {
  localListingInputSchema,
  localListingPageSchema,
  localListingDetailSchema,
  localListingMutationSchema,
  privateMessageMutationSchema,
  localListingTypeSchema,
  localListingIntentSchema,
  localListingPetsSchema,
  localListingStatusSchema,
  parseListingAmount,
  listingAmountInput,
  type LocalListing,
  type LocalListingInput,
} from "../platform/localMarketplaceContracts";
import { localMarketplaceCopy } from "./localMarketplaceCopy";
import "./localMarketplace.css";

type Tab = "browse" | "mine";
type FocusTarget =
  | "detail"
  | "editor"
  | "error"
  | "discard"
  | "publication"
  | "uncertain"
  | "conflict"
  | "save";
type CopyKey = keyof ReturnType<typeof localMarketplaceCopy>;
type Fields = Omit<
  LocalListingInput,
  "bedrooms" | "bathrooms" | "areaSqm" | "priceMinor" | "currency"
> & {
  propertyId: string;
  bedrooms: string;
  bathrooms: string;
  areaSqm: string;
  price: string;
  status: LocalListing["status"];
};
type Editor = { base: LocalListing | null; fields: Fields; original: string };
type Page = {
  listings: LocalListing[];
  total: number;
  nextOffset: number | null;
};
type Filters = {
  q: string;
  city: string;
  intent: string;
  type: string;
  pets: string;
  min: string;
  max: string;
  sort: "recent" | "price_asc" | "price_desc";
};
type Mutation = {
  kind: "listing" | "enquiry";
  path: string;
  method: "POST" | "PATCH";
  body: Record<string, unknown>;
  listingId: string | null;
};
type DiscardAction =
  | { kind: "create" }
  | { kind: "reload" }
  | { kind: "editor" | "catalogue"; id: string };
const emptyPage: Page = { listings: [], total: 0, nextOffset: null };
const blankFilters: Filters = {
  q: "",
  city: "",
  intent: "",
  type: "",
  pets: "",
  min: "",
  max: "",
  sort: "recent",
};
const newFields = (): Fields => ({
  propertyId: "",
  title: "",
  description: "",
  city: "",
  area: "",
  intent: "Rent",
  propertyType: "apartment",
  bedrooms: "0",
  bathrooms: "0",
  areaSqm: "",
  price: "",
  furnished: false,
  pets: "ask",
  status: "draft",
});
const createEditor = (listing: LocalListing | null): Editor => {
  const fields: Fields = listing
    ? {
        propertyId: listing.propertyId ?? "",
        title: listing.title,
        description: listing.description,
        city: listing.city,
        area: listing.area,
        intent: listing.intent,
        propertyType: listing.propertyType,
        bedrooms: String(listing.bedrooms),
        bathrooms: String(listing.bathrooms),
        areaSqm: String(listing.areaSqm),
        price: listingAmountInput(listing.priceMinor),
        furnished: listing.furnished,
        pets: listing.pets,
        status: listing.status,
      }
    : newFields();
  return { base: listing, fields, original: JSON.stringify(fields) };
};
const changed = (editor: Editor | null) =>
  !!editor && JSON.stringify(editor.fields) !== editor.original;
const integer = (value: string) =>
  /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
function failure(cause: unknown): CopyKey {
  if (!(cause instanceof AccountClientError)) return "error";
  if (cause.status === 401 || cause.code === "CSRF_DENIED") return "session";
  if (cause.code === "VERSION_CONFLICT") return "conflict";
  if (cause.code === "LIMIT_REACHED") return "limit";
  if (["LISTING_EXISTS", "DUPLICATE_LISTING"].includes(cause.code))
    return "duplicate";
  if (["CONVERSATION_BLOCKED", "BLOCKED"].includes(cause.code))
    return "blocked";
  if (cause.status === 404 || cause.code === "FORBIDDEN") return "removed";
  if (cause.status === 422) return "validation";
  if (cause.status === 429) return "rate";
  if (cause.status === 0 || cause.status >= 500) return "unavailable";
  return "error";
}

function ListingCards({
  page,
  mine,
  copy,
  selectedId,
  disabled,
  formatAmount,
  onChoose,
  onMore,
}: {
  page: Page;
  mine: boolean;
  copy: ReturnType<typeof localMarketplaceCopy>;
  selectedId?: string;
  disabled: boolean;
  formatAmount: (minor: number) => string;
  onChoose: (id: string) => void;
  onMore: () => void;
}) {
  return (
    <div className="lm-list">
      <p className="lm-list-count">
        {copy.loaded}: {page.listings.length} / {page.total} {copy.total}
      </p>
      {page.listings.map((listing) => (
        <button
          key={listing.id}
          className="lm-list-card"
          type="button"
          disabled={disabled}
          aria-pressed={selectedId === listing.id}
          onClick={() => onChoose(listing.id)}
        >
          <span className={`lm-badge is-${listing.status}`}>
            {mine ? copy[listing.status] : copy.localOnly}
          </span>
          <strong>{listing.title}</strong>
          <span className="lm-card-meta">
            <MapPin size={15} aria-hidden="true" />
            {listing.area}, {listing.city}
          </span>
          <span className="lm-price">{formatAmount(listing.priceMinor)}</span>
          <small>
            {copy[listing.intent]} ·{" "}
            {listing.intent === "Rent" ? copy.perMonth : copy.totalPrice}
          </small>
          <span className="lm-card-meta">
            <Building2 size={16} aria-hidden="true" />
            {copy[listing.propertyType]} · {listing.areaSqm} m²
          </span>
        </button>
      ))}
      {page.nextOffset !== null && (
        <button
          type="button"
          className="lm-secondary"
          disabled={disabled}
          onClick={onMore}
        >
          {copy.more}
        </button>
      )}
    </div>
  );
}

export default function LocalListings({
  account,
  csrfToken,
  active,
  onSessionExpired,
  onSessionRefresh,
  onWorkflowStateChange,
  onOpenConversation,
}: {
  account: PrivateAccount;
  csrfToken: string;
  active: boolean;
  onSessionExpired: () => void;
  onSessionRefresh?: () => void;
  onWorkflowStateChange?: (busy: boolean, dirty: boolean) => void;
  onOpenConversation: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const language = (
    languages.some((item) => item.code === i18n.language) ? i18n.language : "pt"
  ) as LanguageCode;
  const copy = localMarketplaceCopy(language);
  const id = useId();
  const [tab, setTab] = useState<Tab>("browse");
  const [catalogue, setCatalogue] = useState<Page>(emptyPage);
  const [mine, setMine] = useState<Page>(emptyPage);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selected, setSelected] = useState<LocalListing | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [inquiry, setInquiry] = useState({ listingId: "", body: "" });
  const [conversation, setConversation] = useState<{
    listingId: string;
    id: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<CopyKey | null>(null);
  const [success, setSuccess] = useState<CopyKey | null>(null);
  const [discardAction, setDiscardAction] = useState<DiscardAction | null>(
    null,
  );
  const [publication, setPublication] = useState<Mutation | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    target: FocusTarget;
    tab: Tab;
    sequence: number;
  } | null>(null);
  const handledFocus = useRef(0);
  const detailElement = useRef<HTMLElement>(null);
  const editorElement = useRef<HTMLFormElement>(null);
  const errorElement = useRef<HTMLParagraphElement>(null);
  const discardElement = useRef<HTMLDivElement>(null);
  const publicationElement = useRef<HTMLDivElement>(null);
  const uncertainElement = useRef<HTMLDivElement>(null);
  const conflictElement = useRef<HTMLDivElement>(null);
  const saveElement = useRef<HTMLButtonElement>(null);
  const auth = useRef({ accountId: account.id, csrfToken });
  const activeRef = useRef(active);
  const tabRef = useRef(tab);
  const selectedRef = useRef(selected);
  const editorRef = useRef(editor);
  const applied = useRef<Filters>(blankFilters);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const retryAction = useRef<Mutation | null>(null);
  const epoch = useRef(0);
  const dirty = changed(editor) || !!inquiry.body || uncertain;
  const blocked = pending || uncertain || !!discardAction || !!publication;
  const amount = (minor: number) =>
    new Intl.NumberFormat(language, {
      style: "currency",
      currency: "AOA",
      maximumFractionDigits: 2,
    }).format(minor / 100);
  const updateEditor = useCallback((next: Editor | null) => {
    editorRef.current = next;
    setEditor(next);
  }, []);
  const updateSelected = useCallback((next: LocalListing | null) => {
    selectedRef.current = next;
    setSelected(next);
  }, []);
  const requestFocus = useCallback((target: FocusTarget, destination: Tab) => {
    setFocusRequest((previous) => ({
      target,
      tab: destination,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
  }, []);
  useEffect(() => {
    if (!focusRequest || focusRequest.sequence === handledFocus.current) return;
    handledFocus.current = focusRequest.sequence;
    // Consume hidden requests as well: returning to a section must not steal focus.
    if (!active || tab !== focusRequest.tab) return;
    const targets = {
      detail: detailElement,
      editor: editorElement,
      error: errorElement,
      discard: discardElement,
      publication: publicationElement,
      uncertain: uncertainElement,
      conflict: conflictElement,
      save: saveElement,
    };
    const element = targets[focusRequest.target].current;
    if (!element || element.closest("[hidden]")) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [active, focusRequest, tab]);
  useEffect(() => {
    auth.current = { accountId: account.id, csrfToken };
  }, [account.id, csrfToken]);
  useEffect(() => {
    activeRef.current = active;
    tabRef.current = tab;
  }, [active, tab]);
  useEffect(() => {
    onWorkflowStateChange?.(blocked, dirty);
    return () => onWorkflowStateChange?.(false, false);
  }, [blocked, dirty, onWorkflowStateChange]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  const clearPrivate = useCallback(() => {
    setCatalogue(emptyPage);
    setMine(emptyPage);
    setProperties([]);
    updateEditor(null);
    updateSelected(null);
    setInquiry({ listingId: "", body: "" });
    setConversation(null);
    setPublication(null);
    setDiscardAction(null);
    setConflict(false);
    retryAction.current = null;
    setUncertain(false);
  }, [updateEditor, updateSelected]);
  const report = useCallback(
    (cause: unknown, targetId?: string | null, attentionTab?: Tab) => {
      if (cause instanceof AccountClientError && cause.status === 401) {
        clearPrivate();
        onSessionExpired();
        return;
      }
      if (cause instanceof AccountClientError && cause.code === "CSRF_DENIED")
        onSessionRefresh?.();
      if (
        cause instanceof AccountClientError &&
        (cause.status === 404 || cause.code === "FORBIDDEN") &&
        targetId
      ) {
        setCatalogue((page) => ({
          ...page,
          listings: page.listings.filter((item) => item.id !== targetId),
        }));
        setMine((page) => ({
          ...page,
          listings: page.listings.filter((item) => item.id !== targetId),
        }));
        if (selectedRef.current?.id === targetId) updateSelected(null);
        if (editorRef.current?.base?.id === targetId) updateEditor(null);
        setInquiry((draft) =>
          draft.listingId === targetId ? { listingId: "", body: "" } : draft,
        );
      }
      setError(failure(cause));
      if (attentionTab) requestFocus("error", attentionTab);
    },
    [
      clearPrivate,
      onSessionExpired,
      onSessionRefresh,
      requestFocus,
      updateEditor,
      updateSelected,
    ],
  );

  const read = useCallback(
    async (destination: Tab, offset = 0) => {
      if (busy.current || retryAction.current) return;
      const task = new AbortController();
      controller.current?.abort();
      controller.current = task;
      const operation = ++epoch.current;
      busy.current = true;
      setPending(true);
      setError(null);
      const credentials = { ...auth.current, signal: task.signal };
      try {
        const query = new URLSearchParams({
          offset: String(offset),
          limit: "24",
        });
        if (destination === "browse") {
          const filter = applied.current;
          for (const key of [
            "q",
            "city",
            "intent",
            "type",
            "pets",
            "sort",
          ] as const)
            if (filter[key]) query.set(key, filter[key].trim());
          if (filter.min)
            query.set("minPriceMinor", String(parseListingAmount(filter.min)));
          if (filter.max)
            query.set("maxPriceMinor", String(parseListingAmount(filter.max)));
        }
        const page = await workspaceRequest(
          `market/${destination === "mine" ? "my-listings" : "listings"}?${query}`,
          localListingPageSchema,
          credentials,
        );
        if (task.signal.aborted || operation !== epoch.current) return;
        const merge = (previous: Page): Page => ({
          ...page,
          listings: offset
            ? [
                ...new Map(
                  [...previous.listings, ...page.listings].map((item) => [
                    item.id,
                    item,
                  ]),
                ).values(),
              ]
            : page.listings,
        });
        if (destination === "browse") setCatalogue(merge);
        else setMine(merge);
        if (destination === "mine" && offset === 0) {
          const workspaces = await workspaceRequest(
            "workspaces",
            workspacesResponseSchema,
            credentials,
          );
          if (task.signal.aborted) return;
          setProperties(
            workspaces.workspaces
              .filter((workspace) => workspace.role === "owner")
              .flatMap((workspace) =>
                workspace.properties.map((property) => ({
                  id: property.id,
                  name: property.name,
                })),
              ),
          );
        }
        const focusedId =
          destination === "mine"
            ? editorRef.current?.base?.id
            : selectedRef.current?.id;
        if (offset === 0 && focusedId) {
          try {
            const latest = await workspaceRequest(
              `market/listings/${focusedId}`,
              localListingDetailSchema,
              credentials,
            );
            if (task.signal.aborted) return;
            if (destination === "browse") updateSelected(latest.listing);
            else if (!latest.listing.isOwner)
              throw new AccountClientError(403, "FORBIDDEN");
            else if (changed(editorRef.current)) {
              if (latest.listing.version !== editorRef.current?.base?.version)
                setConflict(true);
            } else {
              updateEditor(createEditor(latest.listing));
              setConflict(false);
            }
          } catch (cause) {
            if (!task.signal.aborted) report(cause, focusedId);
          }
        }
      } catch (cause) {
        if (!task.signal.aborted) report(cause);
      } finally {
        if (controller.current === task) {
          busy.current = false;
          setPending(false);
          setLoading(false);
        }
      }
    },
    [report, updateEditor, updateSelected],
  );
  useEffect(() => {
    if (!active) return;
    const start = window.setTimeout(() => void read(tab), 0);
    return () => window.clearTimeout(start);
  }, [active, tab, read]);
  useEffect(() => {
    const focus = () => {
      if (activeRef.current && document.visibilityState === "visible")
        void read(tabRef.current);
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      controller.current?.abort();
      busy.current = false;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [read]);

  const selectListing = async (listingId: string, destination: Tab) => {
    if (busy.current || retryAction.current) return;
    const task = new AbortController();
    controller.current?.abort();
    controller.current = task;
    const operation = ++epoch.current;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await workspaceRequest(
        `market/listings/${listingId}`,
        localListingDetailSchema,
        { ...auth.current, signal: task.signal },
      );
      if (task.signal.aborted || operation !== epoch.current) return;
      if (destination === "mine") {
        if (!result.listing.isOwner)
          throw new AccountClientError(403, "FORBIDDEN");
        updateEditor(createEditor(result.listing));
        setConflict(false);
        if (properties.length === 0) {
          const workspaces = await workspaceRequest(
            "workspaces",
            workspacesResponseSchema,
            { ...auth.current, signal: task.signal },
          );
          if (task.signal.aborted || operation !== epoch.current) return;
          setProperties(
            workspaces.workspaces
              .filter((workspace) => workspace.role === "owner")
              .flatMap((workspace) =>
                workspace.properties.map((property) => ({
                  id: property.id,
                  name: property.name,
                })),
              ),
          );
        }
        if (mine.listings.length === 0) {
          const page = await workspaceRequest(
            "market/my-listings?offset=0&limit=24",
            localListingPageSchema,
            { ...auth.current, signal: task.signal },
          );
          if (task.signal.aborted || operation !== epoch.current) return;
          setMine(page);
        }
      } else {
        updateSelected(result.listing);
        setInquiry({ listingId, body: "" });
        setConversation(null);
      }
      requestFocus(destination === "mine" ? "editor" : "detail", destination);
    } catch (cause) {
      if (!task.signal.aborted) report(cause, listingId, destination);
    } finally {
      if (controller.current === task) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const choose = (action: DiscardAction) => {
    if (blocked) return;
    if (action.kind === "catalogue" && selected?.id === action.id) {
      requestFocus("detail", "browse");
      return;
    }
    if (action.kind === "editor" && editor?.base?.id === action.id) {
      requestFocus("editor", "mine");
      return;
    }
    if (
      (action.kind === "catalogue" &&
        !!inquiry.body &&
        inquiry.listingId !== action.id) ||
      (action.kind !== "catalogue" && changed(editor))
    ) {
      setDiscardAction(action);
      requestFocus("discard", action.kind === "catalogue" ? "browse" : "mine");
      return;
    }
    performSelection(action);
  };
  function performSelection(action: DiscardAction) {
    setDiscardAction(null);
    setError(null);
    setSuccess(null);
    if (action.kind === "create") {
      updateEditor(createEditor(null));
      setConflict(false);
      requestFocus("editor", "mine");
    } else if (action.kind === "reload") {
      if (editorRef.current?.base)
        void selectListing(editorRef.current.base.id, "mine");
    } else
      void selectListing(
        action.id,
        action.kind === "editor" ? "mine" : "browse",
      );
  }

  async function mutate(action: Mutation) {
    if (busy.current) return;
    const task = new AbortController();
    controller.current?.abort();
    controller.current = task;
    const operation = ++epoch.current;
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    setPublication(null);
    retryAction.current = action;
    try {
      const options = {
        ...auth.current,
        signal: task.signal,
        method: action.method,
        body: action.body,
      };
      if (action.kind === "listing") {
        const result = await workspaceRequest(
          action.path,
          localListingMutationSchema,
          options,
        );
        if (task.signal.aborted || operation !== epoch.current) return;
        if (!result.listing.isOwner)
          throw new AccountClientError(502, "invalid_response");
        updateEditor(createEditor(result.listing));
        setConflict(false);
        setMine((page) => {
          const listings = [
            result.listing,
            ...page.listings.filter((item) => item.id !== result.listing.id),
          ];
          const created =
            action.method === "POST" &&
            !page.listings.some((item) => item.id === result.listing.id);
          return {
            ...page,
            listings,
            total: Math.max(listings.length, page.total + (created ? 1 : 0)),
            nextOffset:
              page.nextOffset === null
                ? null
                : page.nextOffset + (created ? 1 : 0),
          };
        });
        if (selectedRef.current?.id === result.listing.id)
          updateSelected(result.listing);
        setSuccess("saved");
      } else {
        const result = await workspaceRequest(
          action.path,
          privateMessageMutationSchema,
          options,
        );
        if (task.signal.aborted || operation !== epoch.current) return;
        setInquiry((previous) =>
          previous.listingId === action.listingId
            ? { listingId: previous.listingId, body: "" }
            : previous,
        );
        setConversation({
          listingId: action.listingId!,
          id: result.conversation.id,
        });
        setSuccess("inquirySaved");
        if (activeRef.current && tabRef.current === "browse")
          onOpenConversation(result.conversation.id);
      }
      retryAction.current = null;
      setUncertain(false);
    } catch (cause) {
      if (task.signal.aborted || operation !== epoch.current) return;
      if (
        cause instanceof AccountClientError &&
        (cause.status === 0 || cause.status >= 500) &&
        cause.status !== 503
      ) {
        setUncertain(true);
        requestFocus(
          "uncertain",
          action.kind === "listing" ? "mine" : "browse",
        );
      } else {
        retryAction.current = null;
        setUncertain(false);
        if (
          cause instanceof AccountClientError &&
          cause.code === "VERSION_CONFLICT"
        ) {
          setConflict(true);
          setError(null);
          requestFocus("conflict", "mine");
        } else
          report(
            cause,
            action.listingId,
            action.kind === "listing" ? "mine" : "browse",
          );
      }
    } finally {
      if (controller.current === task) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || blocked || conflict) return;
    const fields = editor.fields;
    const input = localListingInputSchema.safeParse({
      title: fields.title,
      description: fields.description,
      city: fields.city,
      area: fields.area,
      intent: fields.intent,
      propertyType: fields.propertyType,
      bedrooms: integer(fields.bedrooms),
      bathrooms: integer(fields.bathrooms),
      areaSqm: integer(fields.areaSqm),
      priceMinor: parseListingAmount(fields.price),
      currency: "AOA",
      furnished: fields.furnished,
      pets: fields.pets,
    });
    if (
      !input.success ||
      (!editor.base &&
        !properties.some((property) => property.id === fields.propertyId))
    ) {
      setError("validation");
      requestFocus("error", "mine");
      return;
    }
    const action: Mutation = {
      kind: "listing",
      path: editor.base
        ? `market/listings/${editor.base.id}`
        : "market/listings",
      method: editor.base ? "PATCH" : "POST",
      body: {
        mutationId: crypto.randomUUID(),
        ...input.data,
        ...(editor.base
          ? { version: editor.base.version, status: fields.status }
          : { propertyId: fields.propertyId }),
      },
      listingId: editor.base?.id ?? null,
    };
    if (editor.base && fields.status === "visible") {
      setPublication(action);
      requestFocus("publication", "mine");
    } else void mutate(action);
  }
  function sendInquiry(event: FormEvent) {
    event.preventDefault();
    if (!selected || selected.isOwner || blocked) return;
    const body = inquiry.listingId === selected.id ? inquiry.body.trim() : "";
    if (!body || body.length > 2000) {
      setError("messageValidation");
      requestFocus("error", "browse");
      return;
    }
    void mutate({
      kind: "enquiry",
      path: `market/listings/${selected.id}/enquiries`,
      method: "POST",
      body: { mutationId: crypto.randomUUID(), body },
      listingId: selected.id,
    });
  }
  function applyFilters(event?: FormEvent, reset = false) {
    event?.preventDefault();
    if (blocked) return;
    const next = reset ? blankFilters : filters;
    const min = next.min.trim() ? parseListingAmount(next.min) : null;
    const max = next.max.trim() ? parseListingAmount(next.max) : null;
    if (
      (next.min.trim() && min === null) ||
      (next.max.trim() && max === null) ||
      (min !== null && max !== null && min > max)
    ) {
      setError("filterValidation");
      requestFocus("error", "browse");
      return;
    }
    applied.current = { ...next, min: next.min.trim(), max: next.max.trim() };
    if (reset) setFilters(blankFilters);
    void read("browse");
  }
  const editFields = (update: Partial<Fields>) => {
    if (editor && !blocked) {
      updateEditor({ ...editor, fields: { ...editor.fields, ...update } });
      setSuccess(null);
    }
  };

  return (
    <section
      className="local-marketplace"
      dir={language === "ar" ? "rtl" : "ltr"}
      hidden={!active}
      aria-labelledby={`${id}-title`}
    >
      <header className="lm-heading">
        <div>
          <span className="lm-eyebrow">{copy.eyebrow}</span>
          <h1 id={`${id}-title`}>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <div className="lm-heading-actions">
          <button
            className="lm-secondary"
            type="button"
            disabled={blocked}
            onClick={() => void read(tab)}
          >
            <RefreshCw size={17} aria-hidden="true" />
            {pending ? copy.loading : copy.refresh}
          </button>
        </div>
      </header>
      <p className="lm-notice">
        <ShieldCheck size={20} aria-hidden="true" />
        <span>{copy.notice}</span>
      </p>
      <nav className="lm-tabs" aria-label={copy.title}>
        <button
          type="button"
          aria-pressed={tab === "browse"}
          disabled={blocked}
          onClick={() => setTab("browse")}
        >
          {copy.browse}
        </button>
        <button
          type="button"
          aria-pressed={tab === "mine"}
          disabled={blocked}
          onClick={() => setTab("mine")}
        >
          {copy.mine}
        </button>
      </nav>
      {error && (
        <p
          ref={errorElement}
          tabIndex={-1}
          className="lm-feedback is-error"
          role="alert"
        >
          {copy[error]}
        </p>
      )}
      {success && (
        <p className="lm-feedback" role="status">
          {copy[success]}
        </p>
      )}
      {uncertain && (
        <div
          ref={uncertainElement}
          tabIndex={-1}
          className="lm-feedback is-warning"
          role="alert"
        >
          <p>{copy.uncertain}</p>
          <button
            className="lm-secondary"
            type="button"
            disabled={pending}
            onClick={() => {
              if (retryAction.current) void mutate(retryAction.current);
            }}
          >
            {copy.retry}
          </button>
        </div>
      )}
      {discardAction && (
        <div
          ref={discardElement}
          tabIndex={-1}
          className="lm-confirmation"
          role="alert"
        >
          <p>
            {discardAction.kind === "catalogue"
              ? copy.discardInquiry
              : copy.discardConfirm}
          </p>
          <div className="lm-actions">
            <button
              type="button"
              className="lm-secondary"
              onClick={() => {
                setDiscardAction(null);
                requestFocus(tab === "mine" ? "editor" : "detail", tab);
              }}
            >
              {copy.keep}
            </button>
            <button
              type="button"
              className="lm-danger"
              disabled={pending}
              onClick={() => performSelection(discardAction)}
            >
              {copy.discard}
            </button>
          </div>
        </div>
      )}
      {publication && (
        <div
          ref={publicationElement}
          tabIndex={-1}
          className="lm-confirmation"
          role="alert"
        >
          <p>{copy.publishConfirm}</p>
          <div className="lm-actions">
            <button
              type="button"
              className="lm-secondary"
              onClick={() => {
                setPublication(null);
                requestFocus("save", "mine");
              }}
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              className="lm-primary"
              disabled={pending}
              onClick={() => void mutate(publication)}
            >
              {copy.confirm}
            </button>
          </div>
        </div>
      )}
      <div hidden={tab !== "browse"}>
        <form className="lm-filter-form" onSubmit={applyFilters}>
          <label>
            {copy.search}
            <input
              value={filters.q}
              maxLength={120}
              disabled={blocked}
              onChange={(event) =>
                setFilters({ ...filters, q: event.target.value })
              }
            />
          </label>
          <label>
            {copy.city}
            <input
              value={filters.city}
              maxLength={80}
              disabled={blocked}
              onChange={(event) =>
                setFilters({ ...filters, city: event.target.value })
              }
            />
          </label>
          {(
            [
              ["intent", localListingIntentSchema.options],
              ["type", localListingTypeSchema.options],
              ["pets", localListingPetsSchema.options],
            ] as const
          ).map(([field, options]) => (
            <label key={field}>
              {copy[field]}
              <select
                value={filters[field]}
                disabled={blocked}
                onChange={(event) =>
                  setFilters({ ...filters, [field]: event.target.value })
                }
              >
                <option value="">{copy.all}</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {copy[option]}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            {copy.sort}
            <select
              value={filters.sort}
              disabled={blocked}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  sort: event.target.value as Filters["sort"],
                })
              }
            >
              {(["recent", "price_asc", "price_desc"] as const).map(
                (option) => (
                  <option key={option} value={option}>
                    {copy[option]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            {copy.minPrice}
            <input
              inputMode="decimal"
              dir="ltr"
              value={filters.min}
              maxLength={20}
              disabled={blocked}
              onChange={(event) =>
                setFilters({ ...filters, min: event.target.value })
              }
            />
          </label>
          <label>
            {copy.maxPrice}
            <input
              inputMode="decimal"
              dir="ltr"
              value={filters.max}
              maxLength={20}
              disabled={blocked}
              onChange={(event) =>
                setFilters({ ...filters, max: event.target.value })
              }
            />
          </label>
          <div className="lm-actions">
            <button type="submit" className="lm-primary" disabled={blocked}>
              {copy.apply}
            </button>
            <button
              type="button"
              className="lm-secondary"
              disabled={blocked}
              onClick={() => applyFilters(undefined, true)}
            >
              {copy.clear}
            </button>
          </div>
        </form>
        {loading ? (
          <p className="lm-empty" role="status">
            {copy.loading}
          </p>
        ) : (
          <div className="lm-layout">
            <div>
              {catalogue.listings.length ? (
                <ListingCards
                  page={catalogue}
                  mine={false}
                  copy={copy}
                  selectedId={selected?.id}
                  disabled={blocked}
                  formatAmount={amount}
                  onChoose={(id) => choose({ kind: "catalogue", id })}
                  onMore={() => {
                    if (catalogue.nextOffset !== null)
                      void read("browse", catalogue.nextOffset);
                  }}
                />
              ) : (
                <div className="lm-empty">
                  <Building2 size={30} aria-hidden="true" />
                  <h2>{copy.emptyBrowse}</h2>
                  <p>{copy.emptyBrowseNote}</p>
                </div>
              )}
            </div>
            {selected ? (
              <article
                ref={detailElement}
                tabIndex={-1}
                className="lm-panel"
                aria-labelledby={`${id}-detail-title`}
              >
                <div className="lm-detail-title">
                  <h2 id={`${id}-detail-title`}>{selected.title}</h2>
                  <span className="lm-badge">{copy.localOnly}</span>
                </div>
                <p className="lm-card-meta">
                  <MapPin size={16} aria-hidden="true" />
                  {selected.area}, {selected.city}
                </p>
                <p className="lm-price">
                  {amount(selected.priceMinor)}{" "}
                  <small className="lm-muted">
                    {selected.intent === "Rent"
                      ? copy.perMonth
                      : copy.totalPrice}
                  </small>
                </p>
                <p className="lm-description">{selected.description}</p>
                <dl className="lm-facts">
                  {[
                    [copy.type, copy[selected.propertyType]],
                    [copy.bedrooms, String(selected.bedrooms)],
                    [copy.bathrooms, String(selected.bathrooms)],
                    [copy.areaSqm, String(selected.areaSqm)],
                    [copy.furnished, selected.furnished ? copy.yes : copy.no],
                    [copy.pets, copy[selected.pets]],
                    [copy.owner, selected.ownerName],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                {selected.isOwner ? (
                  <div className="lm-contact">
                    <p className="lm-muted">{copy.ownListing}</p>
                    <button
                      type="button"
                      className="lm-secondary"
                      disabled={blocked}
                      onClick={() => {
                        setTab("mine");
                        choose({ kind: "editor", id: selected.id });
                      }}
                    >
                      {copy.edit}
                    </button>
                  </div>
                ) : (
                  <form className="lm-form lm-contact" onSubmit={sendInquiry}>
                    <h3>{copy.contact}</h3>
                    <label>
                      {copy.message}
                      <textarea
                        rows={4}
                        maxLength={2000}
                        disabled={blocked}
                        value={
                          inquiry.listingId === selected.id ? inquiry.body : ""
                        }
                        onChange={(event) =>
                          setInquiry({
                            listingId: selected.id,
                            body: event.target.value,
                          })
                        }
                        required
                      />
                      <small>{copy.messageHint}</small>
                    </label>
                    <p className="lm-muted">{copy.contactNote}</p>
                    <button
                      type="submit"
                      className="lm-primary"
                      disabled={blocked || !inquiry.body.trim()}
                    >
                      <MessageCircle size={18} aria-hidden="true" />
                      {pending ? copy.working : copy.send}
                    </button>
                    {conversation?.listingId === selected.id && (
                      <button
                        type="button"
                        className="lm-secondary"
                        onClick={() => onOpenConversation(conversation.id)}
                      >
                        {copy.openChat}
                      </button>
                    )}
                  </form>
                )}
              </article>
            ) : (
              <div className="lm-empty">
                <Building2 size={30} aria-hidden="true" />
                <p>{copy.chooseListing}</p>
              </div>
            )}
          </div>
        )}
      </div>
      <div hidden={tab !== "mine"}>
        <div className="lm-actions" style={{ marginBottom: 18 }}>
          <button
            type="button"
            className="lm-primary"
            disabled={blocked || properties.length === 0}
            onClick={() => choose({ kind: "create" })}
          >
            <Plus size={18} aria-hidden="true" />
            {copy.newListing}
          </button>
        </div>
        {!pending && properties.length === 0 && (
          <p className="lm-feedback is-warning">{copy.noProperties}</p>
        )}
        <div className="lm-layout">
          <div>
            {mine.listings.length ? (
              <ListingCards
                page={mine}
                mine
                copy={copy}
                selectedId={editor?.base?.id}
                disabled={blocked}
                formatAmount={amount}
                onChoose={(id) => choose({ kind: "editor", id })}
                onMore={() => {
                  if (mine.nextOffset !== null)
                    void read("mine", mine.nextOffset);
                }}
              />
            ) : (
              <div className="lm-empty">
                <h2>{copy.emptyMine}</h2>
                <p>{copy.emptyMineNote}</p>
              </div>
            )}
          </div>
          {editor ? (
            <form
              ref={editorElement}
              tabIndex={-1}
              className="lm-panel lm-form"
              onSubmit={save}
              noValidate
              aria-labelledby={`${id}-editor-title`}
            >
              <h2 id={`${id}-editor-title`}>
                {editor.base ? copy.edit : copy.newListing}
              </h2>
              <p className="lm-muted">{copy.privacy}</p>
              <label>
                {copy.property}
                <select
                  value={editor.fields.propertyId}
                  disabled={blocked || !!editor.base}
                  onChange={(event) =>
                    editFields({ propertyId: event.target.value })
                  }
                  required
                >
                  <option value="">{copy.chooseProperty}</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                {editor.base && <small>{copy.fixedProperty}</small>}
              </label>
              <label>
                {copy.titleLabel}
                <input
                  value={editor.fields.title}
                  minLength={5}
                  maxLength={120}
                  disabled={blocked}
                  onChange={(event) =>
                    editFields({ title: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                {copy.description}
                <textarea
                  value={editor.fields.description}
                  rows={5}
                  minLength={20}
                  maxLength={3000}
                  disabled={blocked}
                  onChange={(event) =>
                    editFields({ description: event.target.value })
                  }
                  required
                />
              </label>
              <div className="lm-fields">
                {(
                  [
                    ["city", 80],
                    ["area", 100],
                  ] as const
                ).map(([field, maximum]) => (
                  <label key={field}>
                    {copy[field]}
                    <input
                      value={editor.fields[field]}
                      maxLength={maximum}
                      disabled={blocked}
                      onChange={(event) =>
                        editFields({ [field]: event.target.value })
                      }
                      required
                    />
                  </label>
                ))}
                <label>
                  {copy.intent}
                  <select
                    value={editor.fields.intent}
                    disabled={blocked}
                    onChange={(event) =>
                      editFields({
                        intent: event.target.value as LocalListing["intent"],
                      })
                    }
                  >
                    {localListingIntentSchema.options.map((option) => (
                      <option key={option} value={option}>
                        {copy[option]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {copy.type}
                  <select
                    value={editor.fields.propertyType}
                    disabled={blocked}
                    onChange={(event) =>
                      editFields({
                        propertyType: event.target
                          .value as LocalListing["propertyType"],
                      })
                    }
                  >
                    {localListingTypeSchema.options.map((option) => (
                      <option key={option} value={option}>
                        {copy[option]}
                      </option>
                    ))}
                  </select>
                </label>
                {(["bedrooms", "bathrooms", "areaSqm"] as const).map(
                  (field) => (
                    <label key={field}>
                      {copy[field]}
                      <input
                        value={editor.fields[field]}
                        inputMode="numeric"
                        dir="ltr"
                        maxLength={7}
                        disabled={blocked}
                        onChange={(event) =>
                          editFields({ [field]: event.target.value })
                        }
                        required
                      />
                    </label>
                  ),
                )}
                <label>
                  {copy.price}
                  <input
                    value={editor.fields.price}
                    inputMode="decimal"
                    dir="ltr"
                    maxLength={20}
                    disabled={blocked}
                    onChange={(event) =>
                      editFields({ price: event.target.value })
                    }
                    required
                  />
                  <small>
                    {editor.fields.intent === "Rent"
                      ? copy.perMonth
                      : copy.totalPrice}
                  </small>
                </label>
                <label>
                  {copy.furnished}
                  <select
                    value={String(editor.fields.furnished)}
                    disabled={blocked}
                    onChange={(event) =>
                      editFields({ furnished: event.target.value === "true" })
                    }
                  >
                    <option value="false">{copy.no}</option>
                    <option value="true">{copy.yes}</option>
                  </select>
                </label>
                <label>
                  {copy.pets}
                  <select
                    value={editor.fields.pets}
                    disabled={blocked}
                    onChange={(event) =>
                      editFields({
                        pets: event.target.value as LocalListing["pets"],
                      })
                    }
                  >
                    {localListingPetsSchema.options.map((option) => (
                      <option key={option} value={option}>
                        {copy[option]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {editor.base && (
                <label>
                  {copy.status}
                  <select
                    value={editor.fields.status}
                    disabled={blocked}
                    onChange={(event) =>
                      editFields({
                        status: event.target.value as LocalListing["status"],
                      })
                    }
                  >
                    {localListingStatusSchema.options.map((option) => (
                      <option key={option} value={option}>
                        {copy[option]}
                      </option>
                    ))}
                  </select>
                  <small>{copy.visibilityNote}</small>
                </label>
              )}
              {changed(editor) && <p className="lm-muted">{copy.unsaved}</p>}
              {conflict && (
                <div
                  ref={conflictElement}
                  tabIndex={-1}
                  className="lm-feedback is-warning"
                  role="alert"
                >
                  <p>{copy.conflict}</p>
                  <button
                    type="button"
                    className="lm-secondary"
                    disabled={blocked}
                    onClick={() => choose({ kind: "reload" })}
                  >
                    {copy.reload}
                  </button>
                </div>
              )}
              <button
                ref={saveElement}
                type="submit"
                className="lm-primary"
                disabled={blocked || conflict || !changed(editor)}
              >
                {pending
                  ? copy.working
                  : editor.base
                    ? copy.save
                    : copy.saveDraft}
              </button>
            </form>
          ) : (
            <div className="lm-empty">
              <Building2 size={30} aria-hidden="true" />
              <p>{copy.chooseMine}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
