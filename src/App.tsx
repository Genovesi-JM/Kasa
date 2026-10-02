import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bath,
  BedDouble,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  Globe2,
  Heart,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  MapPin,
  Map,
  Menu,
  MessageCircle,
  Plus,
  Repeat2,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  SlidersHorizontal,
  Smartphone,
  Users,
  WalletCards,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { properties, providers, spaceVenues } from "./data";
import { marketplaceMatches, matchesSearch, type SearchScope } from "./search";
import {
  appRouteUrl,
  readAppRoute,
  canonicalRoleView,
  type AppRoute,
} from "./navigation";
import {
  displayTranslation,
  languages,
  setLanguage,
  type LanguageCode,
} from "./i18n";
import { DeviceSimulator } from "./components/DeviceSimulator";
import {
  createInitialRentRecordState,
  createRentRecordFilters,
  type RentRecordFilters,
} from "./components/rentRecordState";
import {
  createInitialMaintenanceState,
  visibleMaintenanceRecords,
} from "./components/maintenanceState";
import { createInitialDocumentState } from "./components/documentState";
import { readPreference, writePreference } from "./platform/preferences";
import { isWorkspaceListingOwner, ownsProperty } from "./propertyScope";
import { propertyOperationStatus } from "./components/propertyOperationStatus";
import type { PortfolioFilters } from "./components/PropertyPortfolio";
import { createInitialPropertyListingState } from "./components/propertyListingState";
import { createInitialSpaceListingState } from "./components/spaceListingState";
import { SpaceVenueShareButton } from "./components/SpaceVenueShareButton";
import {
  createInitialSpacesDiscoveryState,
  spacesDiscoveryFilters,
  updateSpacesDiscovery,
  resetSpacesDiscoveryFilters,
  startSpacesDiscoverySearch,
  spacesDiscoveryActivityOptions,
  spacesDiscoveryAmenityOptions,
  spacesDiscoveryPriceOptions,
  type SpacesDiscoveryFilters,
} from "./components/spacesDiscoveryState";
import {
  createInitialServiceRequestState,
  visibleServiceRequests,
  type ServiceRequestState,
} from "./components/serviceRequestState";
import {
  buildPropertyOperationsSummary,
  type PropertyOperationsSummary,
} from "./components/propertyOperationsSummary";
import { Messages } from "./components/Messages";
import {
  NotificationsPopover,
  NotificationsView,
} from "./components/Notifications";
import {
  createInitialNotificationState,
  type KasaNotification,
} from "./components/notificationState";
import {
  createInitialApplicationState,
  submitRentalApplication,
  tenantApplicationForProperty,
  visibleApplicationRecords,
} from "./components/applicationState";
import {
  createInitialPropertyRequestState,
  selectViewingRequest,
  setViewingFilter,
  viewingCounts,
} from "./components/propertyRequestState";
import {
  createInitialWorkState,
  openWorkOpportunities,
  type WorkState,
} from "./components/workState";
import { SaveSearchButton, SavedSearches } from "./components/SavedSearches";
import {
  copySavedSearchFilters,
  type SavedSearchState,
} from "./components/savedSearchState";
import {
  createInitialWorkspaceSavedState,
  updateWorkspaceFavourites,
  toggleWorkspaceSpaceFavourite,
  updateWorkspaceSavedSearches,
  type FavouriteUpdate,
  type SavedSearchStateUpdate,
} from "./components/workspaceSavedState";
import {
  applyDiscoverSearch,
  createInitialDiscoverState,
  discoverSearch,
  resetDiscoverFilters,
  startDiscoverSearch,
  updateDiscoverQuery,
  updateDiscoverState,
  type DiscoverFilters,
  type DiscoverFilterUpdate,
} from "./components/discoverState";
import {
  createDiscoverHistory,
  readDiscoverHistory,
} from "./components/discoverHistory";
import {
  createInitialSavedHomesViewState,
  resetSavedHomesView,
  savedHomesView,
  updateSavedHomesView,
  type SavedHomesView,
} from "./components/savedHomesViewState";
import {
  createInitialWorkspaceMessageState,
  openPropertyConversation,
  unreadMessageCount,
  updateWorkspaceMessageState,
  type MessageStateUpdate,
} from "./components/messageState";
import {
  createInitialSpaceBookingsState,
  type SpaceBookingsState,
} from "./components/spaceBookingsState";

import { useDialogFocus } from "./components/useDialogFocus";
import { useMediaQuery } from "./components/useMediaQuery";
import {
  PropertyGallery,
  PropertyShareButton,
} from "./components/PropertyGallery";
import {
  MortgageCardEstimate,
  MortgageEstimator,
} from "./components/MortgageEstimator";
import { isPointInsideZone, type ZonePoint } from "./components/mapGeometry";
import type { Property, Role, SpaceVenue, View } from "./types";
import { appConfig } from "./platform/config";
import type { DemoTarget } from "./presentation/journeys";
import {
  getApiHealth,
  getCountryConfig,
  listProperties,
  listSpaces,
} from "./platform/catalog";

const formatEuro = (value: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

type ServiceLaunchMode = AppRoute["service"];

const SpaceBookingsView = lazy(() =>
  import("./components/SpaceBookings").then((module) => ({
    default: module.SpaceBookingsView,
  })),
);
const SpaceBookingRequest = lazy(() =>
  import("./components/SpaceBookingRequest").then((module) => ({
    default: module.SpaceBookingRequest,
  })),
);
const SpaceOperatorInbox = lazy(() =>
  import("./components/SpaceOperatorInbox").then((module) => ({
    default: module.SpaceOperatorInbox,
  })),
);
const ServiceRequestComposer = lazy(() =>
  import("./components/ServiceRequests").then((module) => ({
    default: module.ServiceRequestComposer,
  })),
);
const ServiceRequests = lazy(() =>
  import("./components/ServiceRequests").then((module) => ({
    default: module.ServiceRequests,
  })),
);
const ServiceProviderInbox = lazy(() =>
  import("./components/ServiceRequests").then((module) => ({
    default: module.ServiceProviderInbox,
  })),
);
const PropertyPortfolio = lazy(() =>
  import("./components/PropertyPortfolio").then((module) => ({
    default: module.PropertyPortfolio,
  })),
);
const PropertyListingWorkspace = lazy(() =>
  import("./components/PropertyListingWorkspace").then((module) => ({
    default: module.PropertyListingWorkspace,
  })),
);
const SpaceListingWorkspace = lazy(() =>
  import("./components/SpaceListingWorkspace").then((module) => ({
    default: module.SpaceListingWorkspace,
  })),
);
const PropertyInsights = lazy(() =>
  import("./components/PropertyInsightsView").then((module) => ({
    default: module.PropertyInsights,
  })),
);
const WorkMarketplace = lazy(() =>
  import("./components/WorkMarketplace").then((module) => ({
    default: module.WorkMarketplace,
  })),
);
const WorkHiringWorkspace = lazy(() =>
  import("./components/WorkHiringWorkspace").then((module) => ({
    default: module.WorkHiringWorkspace,
  })),
);
const Applications = lazy(() =>
  import("./components/Applications").then((module) => ({
    default: module.Applications,
  })),
);
const PropertyRequestActions = lazy(() =>
  import("./components/PropertyRequestDialog").then((module) => ({
    default: module.PropertyRequestActions,
  })),
);
const ViewingRequests = lazy(() =>
  import("./components/ViewingRequests").then((module) => ({
    default: module.ViewingRequests,
  })),
);
const PropertyViewingsSummary = lazy(() =>
  import("./components/PropertyViewingsSummary").then((module) => ({
    default: module.PropertyViewingsSummary,
  })),
);
const PropertyOverview = lazy(() =>
  import("./components/PropertyOverview").then((module) => ({
    default: module.PropertyOverview,
  })),
);
const RentRecords = lazy(() =>
  import("./components/RentRecords").then((module) => ({
    default: module.RentRecords,
  })),
);
const WorkspaceTools = lazy(() =>
  import("./components/WorkspaceTools").then((module) => ({
    default: module.WorkspaceTools,
  })),
);
const Maintenance = lazy(() =>
  import("./components/Maintenance").then((module) => ({
    default: module.Maintenance,
  })),
);
const Documents = lazy(() =>
  import("./components/Documents").then((module) => ({
    default: module.Documents,
  })),
);

const KasaMap = lazy(() =>
  import("./components/KasaMap").then((module) => ({
    default: module.KasaMap,
  })),
);

const shownApiFallbackWarnings = new Set<string>();

function warnApiFallbackOnce(catalogue: "property" | "space", error: unknown) {
  if (shownApiFallbackWarnings.has(catalogue)) return;
  shownApiFallbackWarnings.add(catalogue);
  console.warn(
    `Kasa API ${catalogue} catalogue unavailable; using demo data.`,
    error,
  );
}

function useKasaI18n() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ||
    i18n.language ||
    "pt") as LanguageCode;
  const english = i18n.getFixedT("en");
  return {
    language,
    tr: (key: string, options?: { count: number }) =>
      displayTranslation(t(key, options), english(key, options), language),
  };
}

function LanguageSwitcher({
  compact = false,
  short = false,
}: {
  compact?: boolean;
  short?: boolean;
}) {
  const { language, tr } = useKasaI18n();
  return (
    <label
      className={`language-switcher ${compact ? "compact" : ""} ${short ? "short" : ""}`}
    >
      <Globe2 size={16} />
      <span>{tr("language.label")}</span>
      <select
        aria-label={tr("language.label")}
        value={language}
        onChange={(event) =>
          void setLanguage(event.target.value as LanguageCode)
        }
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {compact || short ? item.short : item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface NavItem {
  id: View;
  label: string;
  icon: LucideIcon;
  badge?: string;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  {
    id: "discover",
    label: "Discover homes",
    icon: Search,
    roles: ["landlord", "tenant"],
  },
  {
    id: "saved",
    label: "Saved homes",
    icon: Heart,
    roles: ["landlord", "tenant"],
  },
  {
    id: "portfolio",
    label: "My properties",
    icon: Building2,
    roles: ["landlord", "tenant"],
  },
  {
    id: "applications",
    label: "Applications",
    icon: FileCheck2,
    badge: "3",
    roles: ["landlord", "tenant"],
  },
  {
    id: "viewings",
    label: "Viewings",
    icon: CalendarDays,
    roles: ["landlord", "tenant"],
  },
  {
    id: "messages",
    label: "Messages",
    icon: MessageCircle,
    badge: "2",
    roles: ["landlord", "tenant", "provider"],
  },
  {
    id: "rent",
    label: "Rent records",
    icon: WalletCards,
    roles: ["landlord", "tenant"],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    badge: "1",
    roles: ["landlord", "tenant"],
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileText,
    roles: ["landlord", "tenant"],
  },
  {
    id: "services",
    label: "Kasa Services",
    icon: Store,
    roles: ["landlord", "tenant", "provider"],
  },
  {
    id: "spaces",
    label: "Kasa Spaces",
    icon: CalendarDays,
    roles: ["landlord", "tenant"],
  },
  {
    id: "spaceBookings",
    label: "My space bookings",
    icon: CalendarDays,
    roles: ["landlord", "tenant"],
  },
  {
    id: "spaceOperator",
    label: "Venue dashboard",
    icon: LayoutDashboard,
    roles: ["spaceOperator"],
  },
  {
    id: "spaceOnboarding",
    label: "Venue setup",
    icon: Building2,
    roles: ["spaceOperator"],
  },
  {
    id: "spacesPlan",
    label: "Plans & growth",
    icon: Sparkles,
    roles: ["spaceOperator"],
  },
  {
    id: "messages",
    label: "Customer messages",
    icon: MessageCircle,
    badge: "3",
    roles: ["spaceOperator"],
  },
  {
    id: "provider",
    label: "Jobs & business",
    icon: BriefcaseBusiness,
    roles: ["provider"],
  },
  {
    id: "admin",
    label: "Moderation & flags",
    icon: ShieldCheck,
    roles: ["admin"],
  },
  {
    id: "diagnostics",
    label: "System status",
    icon: CheckCircle2,
    roles: ["admin"],
  },
  { id: "insights", label: "Insights", icon: BarChart3, roles: ["landlord"] },
  {
    id: "plan",
    label: "Commercial model",
    icon: Sparkles,
    roles: ["landlord"],
  },
];

function navigationSection(role: Role, view: View): string {
  if (view === "notifications" || view === "profile")
    return "shell.sectionHome";
  if (view === "overview" || view === "spaceOperator")
    return "shell.sectionHome";
  if (view === "discover" || view === "saved") return "shell.sectionFind";
  if (view === "insights" || view === "plan" || view === "spacesPlan")
    return "shell.sectionBusiness";
  if (role === "provider" || role === "spaceOperator")
    return "shell.sectionOperate";
  if (role === "admin") return "shell.adminWorkspace";
  if (view === "services" || view === "spaces" || view === "spaceBookings")
    return "shell.sectionExplore";
  return "shell.sectionManage";
}

function Avatar({
  initials,
  small = false,
}: {
  initials: string;
  small?: boolean;
}) {
  return (
    <span className={`avatar ${small ? "avatar-small" : ""}`}>{initials}</span>
  );
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function ActionButton({
  children,
  icon: Icon,
  secondary = false,
  onClick,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  secondary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`button ${secondary ? "button-secondary" : ""}`}
      onClick={onClick}
    >
      {Icon && <Icon size={17} />}
      {children}
    </button>
  );
}

function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action} <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function FilterToolbar({
  children,
  activeCount = 0,
  onReset,
}: {
  children: React.ReactNode;
  activeCount?: number;
  onReset?: () => void;
}) {
  const { tr } = useKasaI18n();
  return (
    <section className="filter-toolbar">
      <div className="filter-toolbar-icon">
        <SlidersHorizontal size={17} />
      </div>
      <div className="filter-toolbar-fields">{children}</div>
      {activeCount > 0 && (
        <span className="filter-count">
          {activeCount} {tr("common.active")}
        </span>
      )}
      {onReset && (
        <button
          className="filter-reset"
          onClick={onReset}
          disabled={activeCount === 0}
        >
          {tr("common.reset")}
        </button>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon tone-${tone}`}>
        <Icon size={20} />
      </div>
      <div className="metric-label">{label}</div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

function OnboardingExperience({
  onEnter,
  onOpenSimulator,
}: {
  onEnter: (role: Role, view?: View, discoveryIntent?: "Rent" | "Buy") => void;
  onOpenSimulator: () => void;
}) {
  const { tr } = useKasaI18n();
  type EntryStage =
    "welcome" | "location" | "listingType" | "create" | "verify";
  type Intent = "find" | "buy" | "list" | "service" | "space" | "provide";
  const [stage, setStage] = useState<EntryStage>("welcome");
  const [intent, setIntent] = useState<Intent>("find");
  const intentOptions: Array<{
    id: Intent;
    label: string;
    note: string;
    icon: LucideIcon;
    tone: string;
  }> = [
    {
      id: "find",
      label: tr("landing.findHome"),
      note: tr("landing.findHomeNote"),
      icon: Home,
      tone: "mint",
    },
    {
      id: "buy",
      label: tr("landing.buyProperty"),
      note: tr("landing.buyPropertyNote"),
      icon: Search,
      tone: "blue",
    },
    {
      id: "list",
      label: tr("landing.listProperty"),
      note: tr("landing.listPropertyNote"),
      icon: Building2,
      tone: "gold",
    },
    {
      id: "service",
      label: tr("landing.bookService"),
      note: tr("landing.bookServiceNote"),
      icon: Wrench,
      tone: "lilac",
    },
    {
      id: "space",
      label: tr("landing.bookSpace"),
      note: tr("landing.bookSpaceNote"),
      icon: CalendarDays,
      tone: "blue",
    },
    {
      id: "provide",
      label: tr("landing.offerServices"),
      note: tr("landing.offerServicesNote"),
      icon: BriefcaseBusiness,
      tone: "coral",
    },
  ];
  const accountRole: "tenant" | "landlord" | "provider" =
    intent === "list"
      ? "landlord"
      : intent === "provide"
        ? "provider"
        : "tenant";
  const targetView: View =
    intent === "service"
      ? "services"
      : intent === "space"
        ? "spaces"
        : intent === "list"
          ? "portfolio"
          : intent === "provide"
            ? "provider"
            : "discover";
  const startIntent = (nextIntent: Intent) => {
    setIntent(nextIntent);
    if (nextIntent === "find" || nextIntent === "buy" || nextIntent === "space")
      setStage("location");
    else if (nextIntent === "list") setStage("listingType");
    else
      onEnter(
        nextIntent === "provide" ? "provider" : "tenant",
        nextIntent === "provide" ? "provider" : "services",
      );
  };
  const enterLocationResult = () =>
    onEnter(
      "tenant",
      intent === "space" ? "spaces" : "discover",
      intent === "buy" ? "Buy" : "Rent",
    );
  const profileName =
    accountRole === "tenant"
      ? "Inês Duarte"
      : accountRole === "landlord"
        ? "Olivia Martín"
        : "Adrián Ruiz";

  return (
    <main className="onboarding-shell">
      <section className="onboarding-story">
        <div className="onboarding-brand-row">
          <div className="onboarding-brand">
            <span>
              <Home size={27} />
            </span>
            <strong>Kasa</strong>
          </div>
          <div className="onboarding-preview-actions">
            <button
              className="onboarding-simulator-button"
              onClick={onOpenSimulator}
            >
              <Smartphone size={16} /> {tr("common.simulator")}
            </button>
            <LanguageSwitcher compact />
          </div>
        </div>
        <div className="landing-copy-live">
          <span className="eyebrow light">{tr("landing.promise")}</span>
          <h1>{tr("landing.title")}</h1>
          <p>{tr("landing.subtitle")}</p>
          <div className="landing-pulse">
            <i />
            <span>{tr("common.properties")}</span>
            <i />
            <span>{tr("landing.operations")}</span>
            <i />
            <span>{tr("common.services")}</span>
            <i />
            <span>{tr("landing.sportsEvents")}</span>
          </div>
        </div>
        <div className="onboarding-values">
          <span>
            <ShieldCheck />
            <b>{tr("landing.nonBrokerage")}</b>
            <small>{tr("landing.nonBrokerageNote")}</small>
          </span>
          <span>
            <MapPin />
            <b>{tr("landing.locationFirst")}</b>
            <small>{tr("landing.locationNote")}</small>
          </span>
          <span>
            <LockKeyhole />
            <b>{tr("landing.data")}</b>
            <small>{tr("landing.dataNote")}</small>
          </span>
        </div>
        <small className="reference-note">
          {tr("common.properties")} + {tr("landing.operations")} +{" "}
          {tr("common.services")} + {tr("common.spaces")} · Phase 2
        </small>
      </section>
      <section className="phone-stage">
        <div className="phone-frame">
          <div className="phone-status">
            <span>9:41</span>
            <i />
            <i />
            <i />
          </div>
          {stage === "welcome" && (
            <div className="phone-welcome intent-welcome">
              <div className="phone-welcome-header">
                <div className="phone-logo">
                  <Home size={28} />
                  <strong>Kasa</strong>
                </div>
                <LanguageSwitcher short />
              </div>
              <div className="intent-heading">
                <span className="eyebrow">KASA</span>
                <h2>{tr("landing.question")}</h2>
                <p>{tr("landing.exploreFirst")}</p>
              </div>
              <div className="intent-list">
                {intentOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => startIntent(option.id)}
                    >
                      <span className={`intent-icon ${option.tone}`}>
                        <Icon />
                      </span>
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.note}</small>
                      </span>
                      <ChevronRight />
                    </button>
                  );
                })}
              </div>
              <small className="intent-login">
                {tr("landing.alreadyAccount")}{" "}
                <button onClick={() => setStage("create")}>
                  {tr("landing.signIn")}
                </button>
              </small>
            </div>
          )}
          {stage === "location" && (
            <div className="phone-form location-form">
              <button
                className="phone-back"
                onClick={() => setStage("welcome")}
                aria-label={tr("common.back")}
              >
                <ArrowLeft />
              </button>
              <span className="eyebrow">{tr("landing.locationFirst")}</span>
              <h2>{tr("landing.where")}</h2>
              <p>
                {tr(
                  intent === "space"
                    ? "landing.locationSpaces"
                    : intent === "buy"
                      ? "landing.locationBuy"
                      : "landing.locationHomes",
                )}
              </p>
              <label className="location-search">
                <Search size={17} />
                <input placeholder={tr("landing.cityPlaceholder")} />
              </label>
              <button
                className="current-location"
                onClick={enterLocationResult}
              >
                <MapPin size={17} /> {tr("landing.currentLocation")}
              </button>
              <div className="location-group">
                <strong>{tr("landing.recent")}</strong>
                {[
                  "Barcelona · Eixample",
                  "Barcelona · Gràcia",
                  "Barcelona · Poblenou",
                ].map((area) => (
                  <button key={area} onClick={enterLocationResult}>
                    <Clock3 size={15} />
                    <span>{area}</span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <div className="area-chips">
                <span>{tr("landing.popular")}</span>
                <div>
                  {["Eixample", "Gràcia", "Poblenou", "Sant Antoni"].map(
                    (area) => (
                      <button key={area} onClick={enterLocationResult}>
                        {area}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <button className="phone-primary" onClick={enterLocationResult}>
                {tr("landing.explore")}{" "}
                {intent === "space"
                  ? tr("common.spaces")
                  : intent === "buy"
                    ? tr("common.properties")
                    : tr("discover.rent")}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {stage === "listingType" && (
            <div className="phone-form listing-type-form">
              <button
                className="phone-back"
                onClick={() => setStage("welcome")}
                aria-label={tr("common.back")}
              >
                <ArrowLeft />
              </button>
              <span className="eyebrow">{tr("landing.listProperty")}</span>
              <h2>{tr("landing.chooseListing")}</h2>
              <p>{tr("landing.listPropertyNote")}</p>
              <div className="listing-type-choices">
                <button onClick={() => onEnter("landlord", "portfolio")}>
                  <span className="intent-icon mint">
                    <Home />
                  </span>
                  <span>
                    <strong>{tr("landing.listRent")}</strong>
                    <small>{tr("landing.listRentNote")}</small>
                  </span>
                  <ChevronRight />
                </button>
                <button onClick={() => onEnter("landlord", "portfolio")}>
                  <span className="intent-icon blue">
                    <Building2 />
                  </span>
                  <span>
                    <strong>{tr("landing.listSale")}</strong>
                    <small>{tr("landing.listSaleNote")}</small>
                  </span>
                  <ChevronRight />
                </button>
                <button
                  onClick={() => onEnter("spaceOperator", "spaceOnboarding")}
                >
                  <span className="intent-icon gold">
                    <CalendarDays />
                  </span>
                  <span>
                    <strong>{tr("landing.listSpace")}</strong>
                    <small>{tr("landing.listSpaceNote")}</small>
                  </span>
                  <ChevronRight />
                </button>
              </div>
              <div className="onboarding-scope">
                <ShieldCheck />
                <span>{tr("landing.listingScope")}</span>
              </div>
            </div>
          )}
          {stage === "create" && (
            <div className="phone-form">
              <button
                className="phone-back"
                onClick={() => setStage("welcome")}
                aria-label={tr("common.back")}
              >
                <ArrowLeft />
              </button>
              <span className="eyebrow">{tr("landing.loginNeeded")}</span>
              <h2>{tr("landing.welcomeBack")}</h2>
              <p>{tr("landing.signInNote")}</p>
              <label>
                {tr("landing.fullName")}
                <input defaultValue={profileName} />
              </label>
              <label>
                {tr("landing.email")}
                <input
                  type="email"
                  defaultValue={`${profileName.split(" ")[0].toLowerCase()}@example.com`}
                />
              </label>
              <label>
                {tr("landing.phone")}
                <div className="phone-input">
                  <span>+34</span>
                  <input defaultValue="612 345 678" />
                </div>
              </label>
              <label>
                {tr("landing.password")}
                <div className="password-input">
                  <LockKeyhole size={16} />
                  <input type="password" defaultValue="kasademo" />
                </div>
              </label>
              <label className="terms-check">
                <input type="checkbox" defaultChecked />
                {tr("landing.agreeTerms")}
              </label>
              <button
                className="phone-primary"
                onClick={() => setStage("verify")}
              >
                {tr("landing.createAccount")}
              </button>
              <small>
                {tr("landing.alreadyRegistered")}{" "}
                <button
                  onClick={() =>
                    onEnter(
                      accountRole,
                      targetView,
                      intent === "buy" ? "Buy" : "Rent",
                    )
                  }
                >
                  {tr("landing.signIn")}
                </button>
              </small>
            </div>
          )}
          {stage === "verify" && (
            <div className="phone-form verify-form">
              <button
                className="phone-back"
                onClick={() => setStage("create")}
                aria-label={tr("common.back")}
              >
                <ArrowLeft />
              </button>
              <div className="verify-icon">
                <Smartphone />
              </div>
              <span className="eyebrow">{tr("landing.oneLastStep")}</span>
              <h2>{tr("landing.verifyPhone")}</h2>
              <p>{tr("landing.codeSent")} +34 612 345 678.</p>
              <div className="code-boxes">
                {["3", "8", "4", "2", "1", "6"].map((digit, index) => (
                  <input
                    key={index}
                    aria-label={`${tr("landing.codeSent")} ${index + 1}`}
                    defaultValue={digit}
                    maxLength={1}
                  />
                ))}
              </div>
              <span className="resend">{tr("landing.resendCode")}</span>
              <button
                className="phone-primary"
                onClick={() =>
                  onEnter(
                    accountRole,
                    targetView,
                    intent === "buy" ? "Buy" : "Rent",
                  )
                }
              >
                {tr("landing.verifyContinue")}
              </button>
              <div className="onboarding-scope">
                <ShieldCheck />
                <span>{tr("landing.noKasaRent")}</span>
              </div>
            </div>
          )}
        </div>
        <div className="stage-dots">
          {(
            [
              "welcome",
              "location",
              "listingType",
              "create",
              "verify",
            ] as EntryStage[]
          ).map((item) => (
            <button
              key={item}
              className={stage === item ? "active" : ""}
              onClick={() => setStage(item)}
              aria-label={
                item === "welcome"
                  ? tr("landing.chooseIntent")
                  : item === "location"
                    ? tr("landing.chooseLocation")
                    : item === "listingType"
                      ? tr("landing.chooseListing")
                      : item === "create"
                        ? tr("landing.createAccount")
                        : tr("landing.verifyPhone")
              }
            />
          ))}
        </div>
      </section>
      <section className="onboarding-sidecopy">
        <span className="eyebrow">KASA</span>
        <h2>{tr("landing.browseFreely")}</h2>
        <div className="flow-list">
          <span className={stage === "welcome" ? "active" : ""}>
            <i>01</i>
            <div>
              <strong>{tr("landing.chooseIntent")}</strong>
              <small>{tr("landing.chooseIntentNote")}</small>
            </div>
          </span>
          <span className={stage === "location" ? "active" : ""}>
            <i>02</i>
            <div>
              <strong>{tr("landing.chooseLocation")}</strong>
              <small>{tr("landing.chooseLocationNote")}</small>
            </div>
          </span>
          <span
            className={
              stage === "listingType" || stage === "create" ? "active" : ""
            }
          >
            <i>03</i>
            <div>
              <strong>{tr("landing.takeAction")}</strong>
              <small>{tr("landing.takeActionNote")}</small>
            </div>
          </span>
          <span className={stage === "verify" ? "active" : ""}>
            <i>04</i>
            <div>
              <strong>{tr("landing.manageOperate")}</strong>
              <small>{tr("landing.manageOperateNote")}</small>
            </div>
          </span>
        </div>
        <div className="onboarding-guardrail">
          <ShieldCheck />
          <div>
            <strong>{tr("landing.directTitle")}</strong>
            <p>{tr("landing.directNote")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function PropertyCard({
  property,
  favourite,
  onFavourite,
  onOpen,
}: {
  property: Property;
  favourite: boolean;
  onFavourite: () => void;
  onOpen: () => void;
}) {
  const { tr } = useKasaI18n();
  const tag =
    property.tag === "Great match"
      ? tr("discover.greatMatch")
      : property.tag === "Promoted"
        ? tr("discover.promoted")
        : property.tag === "New"
          ? tr("discover.newListing")
          : property.tag;
  const availability =
    property.available === "Available now"
      ? tr("discover.availableNow")
      : property.available === "Available 1 Sep"
        ? tr("discover.availableFirstSeptember")
        : property.available === "Available 15 Sep"
          ? tr("discover.availableFifteenthSeptember")
          : property.available === "Available 1 Oct"
            ? tr("discover.availableFirstOctober")
            : property.available === "For sale"
              ? tr("discover.forSale")
              : property.available;
  return (
    <article className="property-card">
      <div className="property-image-wrap">
        <img
          src={property.image}
          alt={property.title}
          className="property-image"
        />
        {property.tag && (
          <StatusPill tone={property.tag === "Promoted" ? "amber" : "mint"}>
            {tag}
          </StatusPill>
        )}
        <button
          className={`heart-button ${favourite ? "is-active" : ""}`}
          onClick={onFavourite}
          aria-label={
            favourite ? tr("discover.removeSaved") : tr("discover.saveProperty")
          }
        >
          <Heart size={19} fill={favourite ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="property-body" onClick={onOpen}>
        <div className="property-price">
          {formatEuro(property.price)}{" "}
          <span>
            {property.listingType === "Rent"
              ? tr("discover.perMonth")
              : tr("discover.askingPrice")}
          </span>
        </div>
        <h3>{property.title}</h3>
        <div className="muted property-address">
          <MapPin size={14} /> {property.address}
        </div>
        <div className="property-facts">
          <span>
            <BedDouble size={16} /> {property.beds}{" "}
            {tr("discover.bedroomCount")}
          </span>
          <span>
            <Bath size={16} /> {property.baths} {tr("discover.bathroomCount")}
          </span>
          <span>{property.sqm} m²</span>
        </div>
        {property.listingType === "Buy" && (
          <MortgageCardEstimate price={property.price} />
        )}
        <div className="property-footer">
          <span>{availability}</span>
          <strong>
            {property.match}% {tr("discover.match")}
          </strong>
        </div>
      </button>
    </article>
  );
}

function UniversalHome({
  go,
  openServices,
  setDiscoveryIntent,
  onSearch,
  initialQuery = "",
  onAllSearch,
  summary,
  viewingPanel,
  workCatalogue,
}: {
  go: (view: View) => void;
  openServices: (mode: ServiceLaunchMode) => void;
  setDiscoveryIntent: (intent: "Rent" | "Buy") => void;
  onSearch: (
    scope: Exclude<SearchScope, "all">,
    query: string,
    intent?: "Rent" | "Buy",
  ) => void;
  initialQuery?: string;
  onAllSearch: (query: string) => void;
  summary: PropertyOperationsSummary;
  viewingPanel?: React.ReactNode;
  workCatalogue: ReturnType<typeof openWorkOpportunities>;
}) {
  const { tr, language } = useKasaI18n();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [scope, setScope] = useState<
    "all" | "homes" | "work" | "services" | "spaces"
  >("all");
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(
    initialQuery || null,
  );
  const results =
    submittedQuery === null
      ? null
      : marketplaceMatches(submittedQuery, workCatalogue);

  const launchSearch = () => {
    if (scope === "all") {
      setSubmittedQuery(query.trim());
      onAllSearch(query.trim());
    } else onSearch(scope, query.trim());
  };

  const choose = (action: () => void) => {
    setChooserOpen(false);
    action();
  };

  return (
    <div className="universal-home">
      <section className="universal-welcome">
        <button
          className="home-intent-trigger"
          onClick={() => setChooserOpen(true)}
          aria-haspopup="dialog"
        >
          <span>
            <small>{tr("universalHome.welcomeLabel")}</small>
            <strong>{tr("universalHome.question")}</strong>
          </span>
          <ChevronDown size={22} />
        </button>
        <form
          className="universal-search"
          onSubmit={(event) => {
            event.preventDefault();
            launchSearch();
          }}
        >
          <label>
            <Search size={21} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr("universalHome.searchPlaceholder")}
              aria-label={tr("universalHome.searchPlaceholder")}
            />
          </label>
          <button className="button" type="submit">
            {tr("common.search")}
          </button>
        </form>
        <div
          className="universal-scopes"
          aria-label={tr("universalHome.searchIn")}
        >
          {(
            [
              ["all", tr("universalHome.everything")],
              ["homes", tr("common.properties")],
              ["work", tr("universalHome.work")],
              ["services", tr("common.services")],
              ["spaces", tr("common.spaces")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={scope === id ? "active" : ""}
              aria-pressed={scope === id}
              onClick={() => setScope(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {results && (
        <section
          className="card padded home-search-results"
          aria-label={tr("universalHome.searchResults")}
        >
          <SectionHeading
            title={
              submittedQuery
                ? `${tr("universalHome.resultsFor")} “${submittedQuery}”`
                : tr("universalHome.searchResults")
            }
          />
          <div className="home-search-result-groups">
            {(
              [
                ["rent", tr("universalHome.findHome"), "homes", "Rent"],
                ["buy", tr("universalHome.buyProperty"), "homes", "Buy"],
                ["services", tr("common.services"), "services"],
                ["work", tr("universalHome.work"), "work"],
                ["spaces", tr("common.spaces"), "spaces"],
              ] as const
            ).map(([id, title, resultScope, intent]) => (
              <button
                key={id}
                disabled={results[id].length === 0}
                onClick={() =>
                  onSearch(resultScope, submittedQuery ?? "", intent)
                }
              >
                <span>
                  <strong>{title}</strong>
                  <small>
                    {tr("universalHome.matchCount", {
                      count: results[id].length,
                    })}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
          {Object.values(results).every((items) => items.length === 0) && (
            <p role="status">{tr("universalHome.noSearchResults")}</p>
          )}
        </section>
      )}

      <section className="universal-area-grid">
        <button
          className="universal-area-card properties"
          onClick={() => go("discover")}
        >
          <span className="universal-area-icon">
            <Home />
          </span>
          <span>
            <small>{tr("universalHome.live")}</small>
            <strong>{tr("common.properties")}</strong>
            <b>{tr("universalHome.propertiesNote")}</b>
          </span>
          <ChevronRight />
        </button>
        <button
          className="universal-area-card work"
          onClick={() => openServices("jobs")}
        >
          <span className="universal-area-icon">
            <BriefcaseBusiness />
          </span>
          <span>
            <small>{tr("universalHome.earn")}</small>
            <strong>{tr("universalHome.work")}</strong>
            <b>{tr("universalHome.workNote")}</b>
          </span>
          <ChevronRight />
        </button>
        <button
          className="universal-area-card services"
          onClick={() => openServices("discover")}
        >
          <span className="universal-area-icon">
            <Wrench />
          </span>
          <span>
            <small>{tr("universalHome.getHelp")}</small>
            <strong>{tr("common.services")}</strong>
            <b>{tr("universalHome.servicesNote")}</b>
          </span>
          <ChevronRight />
        </button>
        <button
          className="universal-area-card spaces"
          onClick={() => go("spaces")}
        >
          <span className="universal-area-icon">
            <CalendarDays />
          </span>
          <span>
            <small>{tr("universalHome.reserve")}</small>
            <strong>{tr("common.spaces")}</strong>
            <b>{tr("universalHome.spacesNote")}</b>
          </span>
          <ChevronRight />
        </button>
      </section>

      <section className="home-continue">
        <header>
          <div>
            <span className="eyebrow">{tr("universalHome.forYou")}</span>
            <h2>{tr("universalHome.continue")}</h2>
          </div>
        </header>
        <div>
          <button onClick={() => go("rent")}>
            <span className="continue-icon mint">
              <WalletCards />
            </span>
            <span>
              <strong>
                {tr("nav.rentRecords")} ·{" "}
                {new Date(
                  `${summary.currentPeriod}-01T12:00:00`,
                ).toLocaleDateString(language, {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              <small>
                {propertyOperationStatus(
                  summary.currentRent[0]?.status ?? "",
                  language,
                ) || `${summary.currentRent.length} ${tr("nav.rentRecords")}`}
              </small>
            </span>
            <ChevronRight />
          </button>
          <button onClick={() => go("maintenance")}>
            <span className="continue-icon gold">
              <Wrench />
            </span>
            <span>
              <strong>
                {summary.recentMaintenance?.title ?? tr("common.maintenance")}
              </strong>
              <small>
                {summary.recentMaintenance
                  ? `${propertyOperationStatus(summary.recentMaintenance.status, language)} · ${new Date(summary.recentMaintenance.updatedAt).toLocaleDateString(language)}`
                  : tr("common.maintenance")}
              </small>
            </span>
            <ChevronRight />
          </button>
        </div>
      </section>

      {viewingPanel}

      {chooserOpen && (
        <Modal
          title={tr("universalHome.question")}
          onClose={() => setChooserOpen(false)}
        >
          <div className="modal-body universal-action-grid">
            <button
              onClick={() =>
                choose(() => {
                  setDiscoveryIntent("Rent");
                  go("discover");
                })
              }
            >
              <span className="service-action-icon pro">
                <Home />
              </span>
              <span>
                <small>{tr("universalHome.forYourLife")}</small>
                <strong>{tr("universalHome.findHome")}</strong>
              </span>
              <ChevronRight />
            </button>
            <button
              onClick={() =>
                choose(() => {
                  setDiscoveryIntent("Buy");
                  go("discover");
                })
              }
            >
              <span className="service-action-icon hire">
                <Building2 />
              </span>
              <span>
                <small>{tr("universalHome.forYourFuture")}</small>
                <strong>{tr("universalHome.buyProperty")}</strong>
              </span>
              <ChevronRight />
            </button>
            <button onClick={() => choose(() => openServices("jobs"))}>
              <span className="service-action-icon work">
                <BriefcaseBusiness />
              </span>
              <span>
                <small>{tr("universalHome.earn")}</small>
                <strong>{tr("universalHome.getJob")}</strong>
              </span>
              <ChevronRight />
            </button>
            <button onClick={() => choose(() => openServices("hire"))}>
              <span className="service-action-icon hire">
                <Users />
              </span>
              <span>
                <small>{tr("universalHome.forBusiness")}</small>
                <strong>{tr("universalHome.hireStaff")}</strong>
              </span>
              <ChevronRight />
            </button>
            <button onClick={() => choose(() => openServices("discover"))}>
              <span className="service-action-icon pro">
                <Wrench />
              </span>
              <span>
                <small>{tr("universalHome.getHelp")}</small>
                <strong>{tr("universalHome.findPro")}</strong>
              </span>
              <ChevronRight />
            </button>
            <button onClick={() => choose(() => go("spaces"))}>
              <span className="service-action-icon offer">
                <CalendarDays />
              </span>
              <span>
                <small>{tr("universalHome.sportsEvents")}</small>
                <strong>{tr("universalHome.reserveSpace")}</strong>
              </span>
              <ChevronRight />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProfileView({
  onSwitch,
  go,
  onSettings,
  workspace,
}: {
  onSwitch: () => void;
  go: (view: View) => void;
  onSettings: () => void;
  workspace: { initials: string; name: string; label: string };
}) {
  const { tr } = useKasaI18n();
  return (
    <div className="simple-mobile-page profile-page">
      <section className="profile-identity-card">
        <Avatar initials={workspace.initials} />
        <span>
          <strong>{workspace.name}</strong>
          <small>{workspace.label}</small>
        </span>
        <ChevronRight />
      </section>
      <section className="profile-menu-card">
        <button onClick={() => go("saved")}>
          <Heart />
          <span>{tr("nav.savedHomes")}</span>
          <ChevronRight />
        </button>
        <button onClick={() => go("documents")}>
          <FileText />
          <span>{tr("common.documents")}</span>
          <ChevronRight />
        </button>
        <button onClick={() => go("notifications")}>
          <Bell />
          <span>{tr("common.notifications")}</span>
          <ChevronRight />
        </button>
        <button onClick={onSettings}>
          <Settings />
          <span>{tr("common.settings")}</span>
          <ChevronRight />
        </button>
      </section>
      <section className="profile-menu-card">
        <header>
          <small>{tr("universalHome.oneAccount")}</small>
          <strong>{tr("universalHome.chooseWorkspace")}</strong>
        </header>
        <button onClick={onSwitch}>
          <Repeat2 />
          <span>{tr("nav.switchWorkspace")}</span>
          <ChevronRight />
        </button>
      </section>
      <div className="scope-note">
        <LockKeyhole size={17} />
        <span>{tr("universalHome.privacyNote")}</span>
      </div>
    </div>
  );
}

function Discover({
  favourites,
  toggleFavourite,
  onOpen,
  initialIntent,
  query,
  onIntentChange,
  onQueryChange,
  filters,
  onFiltersChange,
  savedSearchState,
  setSavedSearchState,
  onManageSavedSearches,
}: {
  favourites: number[];
  toggleFavourite: (id: number) => void;
  onOpen: (property: Property) => void;
  initialIntent: "Rent" | "Buy";
  query: string;
  onIntentChange: (intent: "Rent" | "Buy") => void;
  onQueryChange: (query: string) => void;
  filters: DiscoverFilters;
  onFiltersChange: (update: DiscoverFilterUpdate) => void;
  savedSearchState: SavedSearchState;
  setSavedSearchState: React.Dispatch<React.SetStateAction<SavedSearchState>>;
  onManageSavedSearches: () => void;
}) {
  const { tr } = useKasaI18n();
  const [catalogProperties, setCatalogProperties] = useState(properties);
  const setQuery = onQueryChange;
  const intent = initialIntent;
  const {
    maxPrice,
    minPrice,
    viewMode,
    verifiedOnly,
    propertyType,
    bedrooms,
    bathrooms,
    furnishing,
    petPolicy,
    minSize,
    availability,
    features,
    showMoreFilters,
    sort,
    drawnZone,
  } = filters;
  const updateFilter = <Key extends keyof DiscoverFilters>(
    key: Key,
    update:
      | DiscoverFilters[Key]
      | ((current: DiscoverFilters[Key]) => DiscoverFilters[Key]),
  ) =>
    onFiltersChange((current) => ({
      ...current,
      [key]: typeof update === "function" ? update(current[key]) : update,
    }));
  const featureOptions = [
    ["Outdoor space", tr("discover.terrace")],
    ["Parking", tr("discover.parking")],
    ["Lift", tr("discover.lift")],
    ["Air conditioning", tr("discover.air")],
    ["Accessible entry", tr("discover.accessible")],
    ["Bills included", tr("discover.bills")],
  ];
  const toggleFeature = (feature: string) =>
    updateFilter("features", (current) =>
      current.includes(feature)
        ? current.filter((item) => item !== feature)
        : [...current, feature],
    );
  useEffect(() => {
    if (!appConfig.apiUrl) return;
    let active = true;
    void listProperties()
      .then((items) => {
        if (active) setCatalogProperties(items);
      })
      .catch((error: unknown) => {
        warnApiFallbackOnce("property", error);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = catalogProperties
    .filter((property) => {
      const matchQuery = matchesSearch(
        query,
        property.title,
        property.address,
        property.city,
        property.neighbourhood,
        property.propertyType,
        ...property.amenities,
      );
      const limit = maxPrice === "Any price" ? Infinity : Number(maxPrice);
      const matchType =
        propertyType === "All types" || property.propertyType === propertyType;
      const matchBeds =
        bedrooms === "Any bedrooms" || property.beds >= Number(bedrooms);
      const matchBaths =
        bathrooms === "Any bathrooms" || property.baths >= Number(bathrooms);
      const matchFurnishing =
        furnishing === "Any furnishing" ||
        (furnishing === "Furnished" ? property.furnished : !property.furnished);
      const allowsPets = property.amenities.includes("Pet friendly");
      const matchPets =
        petPolicy === "Any pet policy" ||
        (petPolicy === "Pets allowed" ? allowsPets : !allowsPets);
      const matchAvailability =
        availability === "Any availability" ||
        property.available.toLowerCase().includes("now");
      const featureAliases: Record<string, string[]> = {
        "Outdoor space": ["Balcony", "Terrace", "Private terrace"],
        Parking: ["Parking", "Parking nearby"],
        Lift: ["Lift"],
        "Air conditioning": ["Air conditioning"],
        "Accessible entry": ["Accessible entry"],
        "Bills included": ["Bills included"],
      };
      const matchFeatures = features.every((feature) =>
        property.amenities.some((amenity) =>
          featureAliases[feature].some((alias) => amenity.includes(alias)),
        ),
      );
      const matchDrawnZone = isPointInsideZone(
        [property.lat, property.lng],
        drawnZone,
      );
      return (
        property.listingType === intent &&
        matchQuery &&
        property.price >= Number(minPrice) &&
        property.price <= limit &&
        property.sqm >= Number(minSize) &&
        matchType &&
        matchBeds &&
        matchBaths &&
        matchFurnishing &&
        matchPets &&
        matchAvailability &&
        matchFeatures &&
        matchDrawnZone &&
        (!verifiedOnly || property.verified)
      );
    })
    .sort((a, b) =>
      sort === "Newest"
        ? b.id - a.id
        : sort === "Price: low to high"
          ? a.price - b.price
          : sort === "Price: high to low"
            ? b.price - a.price
            : sort === "Largest"
              ? b.sqm - a.sqm
              : b.match - a.match,
    );
  const activeFilters =
    Number(maxPrice !== "Any price") +
    Number(minPrice !== "0") +
    Number(propertyType !== "All types") +
    Number(bedrooms !== "Any bedrooms") +
    Number(bathrooms !== "Any bathrooms") +
    Number(furnishing !== "Any furnishing") +
    Number(petPolicy !== "Any pet policy") +
    Number(minSize !== "0") +
    Number(availability !== "Any availability") +
    Number(verifiedOnly) +
    Number(drawnZone.length >= 3) +
    features.length;
  const resetFilters = () => {
    onFiltersChange(resetDiscoverFilters);
  };
  const chooseIntent = (next: "Rent" | "Buy") => {
    onIntentChange(next);
  };
  return (
    <div className="page-stack">
      <section className="discovery-intro">
        <div>
          <span className="eyebrow light">{tr("discover.eyebrow")}</span>
          <h2>{tr("discover.title")}</h2>
          <p>{tr("discover.subtitle")}</p>
        </div>
        <div className="intent-switch">
          <button
            className={intent === "Rent" ? "active" : ""}
            onClick={() => chooseIntent("Rent")}
          >
            {tr("discover.rent")}
          </button>
          <button
            className={intent === "Buy" ? "active" : ""}
            onClick={() => chooseIntent("Buy")}
          >
            {tr("discover.buy")}
          </button>
        </div>
      </section>
      <section className="search-panel">
        <div className="search-main">
          <Search size={20} />
          <input
            aria-label={tr("discover.placeholder")}
            placeholder={tr("discover.placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          aria-label={
            intent === "Rent"
              ? tr("discover.maximumMonthlyRent")
              : tr("discover.maximumSalePrice")
          }
          value={maxPrice}
          onChange={(event) => updateFilter("maxPrice", event.target.value)}
        >
          {intent === "Rent" ? (
            <>
              <option value="Any price">{tr("discover.anyPrice")}</option>
              <option value="1500">€1,500</option>
              <option value="2000">€2,000</option>
              <option value="2500">€2,500</option>
            </>
          ) : (
            <>
              <option value="Any price">{tr("discover.anyPrice")}</option>
              <option value="500000">€500,000</option>
              <option value="650000">€650,000</option>
              <option value="800000">€800,000</option>
            </>
          )}
        </select>
        <button
          className={`filter-button ${verifiedOnly ? "selected" : ""}`}
          onClick={() => updateFilter("verifiedOnly", (value) => !value)}
          aria-pressed={verifiedOnly}
        >
          <BadgeCheck size={18} /> {tr("discover.checkedOnly")}
        </button>
      </section>
      <FilterToolbar activeCount={activeFilters} onReset={resetFilters}>
        <select
          aria-label={tr("discover.propertyType")}
          value={propertyType}
          onChange={(event) => updateFilter("propertyType", event.target.value)}
        >
          <option value="All types">{tr("discover.allTypes")}</option>
          <option value="Apartment">{tr("common.apartment")}</option>
          <option value="House">{tr("common.house")}</option>
          <option value="Studio">{tr("common.studio")}</option>
          <option value="Loft">{tr("common.loft")}</option>
        </select>
        <select
          aria-label={tr("discover.minimumBedrooms")}
          value={bedrooms}
          onChange={(event) => updateFilter("bedrooms", event.target.value)}
        >
          <option value="Any bedrooms">{tr("discover.anyBeds")}</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
        </select>
        <select
          aria-label={tr("discover.petPolicyLabel")}
          value={petPolicy}
          onChange={(event) => updateFilter("petPolicy", event.target.value)}
        >
          <option value="Any pet policy">{tr("discover.anyPets")}</option>
          <option value="Pets allowed">{tr("discover.petsAllowed")}</option>
          <option value="No pets">{tr("discover.noPets")}</option>
        </select>
        <button
          className={`more-filter-button ${showMoreFilters ? "active" : ""}`}
          onClick={() => updateFilter("showMoreFilters", (value) => !value)}
        >
          <SlidersHorizontal size={15} />{" "}
          {showMoreFilters
            ? tr("discover.hideFilters")
            : tr("discover.moreFilters")}
          <span>{activeFilters || ""}</span>
        </button>
      </FilterToolbar>
      {showMoreFilters && (
        <section className="advanced-filter-panel card">
          <div className="advanced-filter-grid">
            <label>
              <span>{tr("common.minimumPrice")}</span>
              <select
                value={minPrice}
                onChange={(event) =>
                  updateFilter("minPrice", event.target.value)
                }
              >
                <option value="0">{tr("common.any")}</option>
                {intent === "Rent" ? (
                  <>
                    <option value="1000">€1,000</option>
                    <option value="1500">€1,500</option>
                  </>
                ) : (
                  <>
                    <option value="300000">€300,000</option>
                    <option value="500000">€500,000</option>
                  </>
                )}
              </select>
            </label>
            <label>
              <span>{tr("discover.anyBaths")}</span>
              <select
                value={bathrooms}
                onChange={(event) =>
                  updateFilter("bathrooms", event.target.value)
                }
              >
                <option value="Any bathrooms">{tr("common.any")}</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
              </select>
            </label>
            <label>
              <span>{tr("discover.minSize")}</span>
              <select
                value={minSize}
                onChange={(event) =>
                  updateFilter("minSize", event.target.value)
                }
              >
                <option value="0">{tr("common.any")}</option>
                <option value="50">50 m²</option>
                <option value="75">75 m²</option>
                <option value="100">100 m²</option>
              </select>
            </label>
            <label>
              <span>{tr("discover.anyFurnishing")}</span>
              <select
                value={furnishing}
                onChange={(event) =>
                  updateFilter("furnishing", event.target.value)
                }
              >
                <option value="Any furnishing">{tr("common.any")}</option>
                <option value="Furnished">{tr("discover.furnished")}</option>
                <option value="Unfurnished">
                  {tr("discover.unfurnished")}
                </option>
              </select>
            </label>
            <label>
              <span>{tr("discover.availability")}</span>
              <select
                value={availability}
                onChange={(event) =>
                  updateFilter("availability", event.target.value)
                }
              >
                <option value="Any availability">{tr("common.any")}</option>
                <option value="Available now">
                  {tr("space.availableToday")}
                </option>
              </select>
            </label>
            <label>
              <span>{tr("common.sort")}</span>
              <select
                value={sort}
                onChange={(event) => updateFilter("sort", event.target.value)}
              >
                <option value="Recommended">{tr("common.recommended")}</option>
                <option value="Newest">{tr("common.newest")}</option>
                <option value="Price: low to high">
                  {tr("common.priceLow")}
                </option>
                <option value="Price: high to low">
                  {tr("common.priceHigh")}
                </option>
                <option value="Largest">{tr("common.largest")}</option>
              </select>
            </label>
          </div>
          <div className="feature-filter">
            <strong>{tr("discover.amenities")}</strong>
            <div>
              {featureOptions.map(([value, label]) => (
                <button
                  key={value}
                  className={features.includes(value) ? "active" : ""}
                  onClick={() => toggleFeature(value)}
                  aria-pressed={features.includes(value)}
                >
                  {features.includes(value) && <Check size={14} />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      <div className="results-line">
        <div>
          <strong>{filtered.length}</strong>
          <span>
            {" "}
            {tr("discover.resultsIn")} Barcelona ·{" "}
            {intent === "Rent" ? tr("discover.rent") : tr("discover.buy")}
          </span>
        </div>
        <div className="results-actions">
          <SaveSearchButton
            state={savedSearchState}
            setState={setSavedSearchState}
            search={{ query, intent, filters }}
            label={tr("discover.saveSearch")}
            onManage={onManageSavedSearches}
          />
          <div className="view-toggle">
            <button
              className={viewMode === "list" ? "active" : ""}
              onClick={() => updateFilter("viewMode", "list")}
            >
              <LayoutDashboard size={15} /> {tr("common.list")}
            </button>
            <button
              className={viewMode === "map" ? "active" : ""}
              onClick={() => updateFilter("viewMode", "map")}
            >
              <Map size={15} /> {tr("common.map")}
            </button>
          </div>
        </div>
      </div>
      {viewMode === "list" ? (
        <section className="property-grid">
          {filtered.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              favourite={favourites.includes(property.id)}
              onFavourite={() => toggleFavourite(property.id)}
              onOpen={() => onOpen(property)}
            />
          ))}
        </section>
      ) : (
        <section className="map-results">
          <Suspense
            fallback={
              <div className="map-loading">{tr("common.loadingMap")}</div>
            }
          >
            <KasaMap
              className="property-live-map"
              items={filtered.map((property) => ({
                id: property.id,
                position: [property.lat, property.lng],
                title: property.title,
                subtitle: `${property.neighbourhood} · ${property.beds} ${tr("discover.bedroomCount")}`,
                price: formatEuro(property.price).replace(",000", "k"),
                image: property.image,
              }))}
              zone={drawnZone}
              onZoneChange={(zone) => updateFilter("drawnZone", zone)}
              onOpen={(id) => {
                const property = catalogProperties.find(
                  (item) => item.id === id,
                );
                if (property) onOpen(property);
              }}
              labels={{
                draw: tr("common.drawArea"),
                finish: tr("common.finishArea"),
                undo: tr("common.undo"),
                clear: tr("common.clearArea"),
                hint: tr("common.mapHint"),
                points: tr("common.points"),
                results: tr("common.resultsInside"),
                view: tr("common.viewResult"),
              }}
            />
          </Suspense>
          <aside className="map-list">
            {filtered.map((property) => (
              <button key={property.id} onClick={() => onOpen(property)}>
                <img src={property.image} alt="" />
                <span>
                  <strong>{property.title}</strong>
                  <small>
                    {property.neighbourhood} · {property.beds}{" "}
                    {tr("discover.bedroomCount")}
                  </small>
                  <b>
                    {formatEuro(property.price)}{" "}
                    {property.listingType === "Rent"
                      ? tr("discover.perMonth")
                      : ""}
                  </b>
                </span>
              </button>
            ))}
          </aside>
        </section>
      )}
      {filtered.length === 0 && (
        <div className="empty-state">
          <Search size={28} />
          <h3>{tr("discover.noResults")}</h3>
          <p>{tr("discover.noResultsNote")}</p>
          <ActionButton secondary onClick={resetFilters}>
            {tr("common.reset")}
          </ActionButton>
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { tr } = useKasaI18n();
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);

  return (
    <div
      className="modal-layer"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
      <button
        className="modal-scrim"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />
      <section className="modal-card">
        <header>
          <div>
            <span className="eyebrow">KASA WORKFLOW</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={tr("common.close")}
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function PropertyDetail({
  property,
  favourite,
  onFavourite,
  onBack,
  backLabel,
  ownListing = false,
  onMessage,
  requestControls,
}: {
  property: Property;
  favourite: boolean;
  onFavourite: () => void;
  onBack: () => void;
  backLabel?: string;
  ownListing?: boolean;
  onMessage: () => void;
  requestControls: React.ReactNode;
}) {
  const { tr } = useKasaI18n();
  return (
    <div className="page-stack property-detail-page">
      <div className="detail-toolbar">
        <button className="text-button" onClick={onBack}>
          ← {backLabel ?? tr("discover.backResults")}
        </button>
        <div>
          <button className="soft-button" onClick={onFavourite}>
            <Heart size={16} fill={favourite ? "currentColor" : "none"} />{" "}
            {favourite ? tr("common.saved") : tr("common.save")}
          </button>
          <PropertyShareButton
            property={property}
            label={tr("discover.share")}
          />
        </div>
      </div>
      <PropertyGallery
        property={property}
        viewPhotosLabel={tr("discover.viewPhotos")}
      />
      <div className="detail-layout">
        <main>
          <section className="detail-heading">
            <div>
              <div className="trust-line">
                {property.verified && (
                  <StatusPill tone="mint">
                    <BadgeCheck size={13} /> {tr("discover.listingChecked")}
                  </StatusPill>
                )}
                <span>{tr("discover.addedDays")}</span>
              </div>
              <h2>{property.title}</h2>
              <p>
                <MapPin size={16} /> {property.neighbourhood}, {property.city}
              </p>
            </div>
            <div className="detail-price">
              <strong>{formatEuro(property.price)}</strong>
              <span>
                {property.listingType === "Rent"
                  ? tr("discover.perMonth")
                  : tr("discover.askingPrice")}
              </span>
            </div>
          </section>
          <section className="fact-ribbon">
            <span>
              <BedDouble />
              <strong>{property.beds}</strong>
              <small>{tr("discover.bedrooms")}</small>
            </span>
            <span>
              <Bath />
              <strong>{property.baths}</strong>
              <small>{tr("discover.bathrooms")}</small>
            </span>
            <span>
              <Home />
              <strong>{property.sqm}</strong>
              <small>m²</small>
            </span>
            <span>
              <WalletCards />
              <strong>
                {property.listingType === "Rent"
                  ? formatEuro(property.deposit)
                  : tr("discover.forSale")}
              </strong>
              <small>
                {property.listingType === "Rent"
                  ? tr("discover.depositRequested")
                  : property.propertyType}
              </small>
            </span>
          </section>
          {property.listingType === "Buy" && (
            <MortgageEstimator propertyPrice={property.price} />
          )}
          <section className="card padded detail-section">
            <SectionHeading title={tr("discover.aboutHome")} />
            <p>{property.description}</p>
            <div className="scope-note">
              <ShieldCheck size={17} />
              <span>{tr("discover.suppliedInformation")}</span>
            </div>
          </section>
          <section className="card padded detail-section">
            <SectionHeading title={tr("discover.amenitiesTitle")} />
            <div className="amenity-grid">
              {property.amenities.map((amenity) => (
                <span key={amenity}>
                  <Check size={16} /> {amenity}
                </span>
              ))}
            </div>
          </section>
          <section className="card padded location-preview">
            <div>
              <span className="eyebrow">
                {tr("discover.approximateLocation")}
              </span>
              <h2>{property.neighbourhood}, Barcelona</h2>
              <p>{tr("discover.exactAddressNote")}</p>
            </div>
            <MapPin size={31} />
          </section>
        </main>
        <aside className="contact-card card">
          <StatusPill tone="mint">
            <ShieldCheck size={13} /> {tr("discover.identityVerified")}
          </StatusPill>
          <div className="listing-person">
            <Avatar
              initials={property.landlord
                .split(" ")
                .map((part) => part[0])
                .join("")}
            />
            <span>
              <small>{tr("discover.listingParty")}</small>
              <strong>{property.landlord}</strong>
              <em>{tr("discover.respondsWithin")}</em>
            </span>
          </div>
          <div className="profile-privacy">
            <LockKeyhole size={17} />
            <span>
              <strong>{tr("discover.contactPrivate")}</strong>
              <small>{tr("discover.noPublicContact")}</small>
            </span>
          </div>
          <button className="button contact-message" onClick={onMessage}>
            <MessageCircle size={16} />{" "}
            {tr(ownListing ? "common.messages" : "discover.startPrivateChat")}
          </button>
          {requestControls}
          <div className="direct-note">
            <ShieldCheck size={16} />
            <p>{tr("discover.directContract")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Saved({
  favourites,
  toggleFavourite,
  onOpen,
  savedSearches,
  onDiscover,
  view,
  onViewChange,
  onResetView,
}: {
  favourites: number[];
  toggleFavourite: (id: number) => void;
  onOpen: (property: Property) => void;
  savedSearches: React.ReactNode;
  onDiscover: () => void;
  view: SavedHomesView;
  onViewChange: (update: { intent?: string; sort?: string }) => void;
  onResetView: () => void;
}) {
  const { intent, sort } = view;
  const { i18n } = useTranslation();
  const portuguese = (i18n.resolvedLanguage || i18n.language || "pt")
    .toLowerCase()
    .startsWith("pt");
  const copy = (en: string, pt: string) => (portuguese ? pt : en);
  const saved = properties
    .filter(
      (property) =>
        favourites.includes(property.id) &&
        (intent === "All" || property.listingType === intent),
    )
    .sort((a, b) =>
      sort === "Price: low to high"
        ? a.price - b.price
        : sort === "Price: high to low"
          ? b.price - a.price
          : sort === "Newest listing"
            ? b.id - a.id
            : favourites.indexOf(b.id) - favourites.indexOf(a.id),
    );
  return (
    <div className="page-stack">
      {savedSearches}
      <FilterToolbar
        activeCount={
          Number(intent !== "All") + Number(sort !== "Recently saved")
        }
        onReset={onResetView}
      >
        <select
          aria-label={copy("Saved listing type", "Tipo de imóvel guardado")}
          value={intent}
          onChange={(event) => onViewChange({ intent: event.target.value })}
        >
          <option value="All">{copy("All", "Todos")}</option>
          <option value="Rent">{copy("Rent", "Arrendar")}</option>
          <option value="Buy">{copy("Buy", "Comprar")}</option>
        </select>
        <select
          aria-label={copy("Sort saved homes", "Ordenar imóveis guardados")}
          value={sort}
          onChange={(event) => onViewChange({ sort: event.target.value })}
        >
          <option value="Recently saved">
            {copy("Recently saved", "Guardados recentemente")}
          </option>
          <option value="Newest listing">
            {copy("Newest listing", "Anúncio mais recente")}
          </option>
          <option value="Price: low to high">
            {copy("Price: low to high", "Preço: menor primeiro")}
          </option>
          <option value="Price: high to low">
            {copy("Price: high to low", "Preço: maior primeiro")}
          </option>
        </select>
      </FilterToolbar>
      <SectionHeading
        title={copy(
          `${saved.length} saved ${saved.length === 1 ? "home" : "homes"}`,
          `${saved.length} ${saved.length === 1 ? "imóvel guardado" : "imóveis guardados"}`,
        )}
        action={copy("Discover more", "Descobrir mais")}
        onAction={onDiscover}
      />
      {saved.length ? (
        <section className="property-grid">
          {saved.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              favourite
              onFavourite={() => toggleFavourite(property.id)}
              onOpen={() => onOpen(property)}
            />
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <Heart size={30} />
          <h3>
            {copy("No saved homes match", "Nenhum imóvel guardado corresponde")}
          </h3>
          <p>
            {copy(
              "Reset the filter or save more properties from discovery.",
              "Limpe o filtro ou guarde mais imóveis na pesquisa.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Services({
  role,
  serviceState,
  setServiceState,
  workState,
  setWorkState,
  notify,
  onOfferServices,
  launchMode = "discover",
  onAreaChange,
  initialQuery = "",
  onQueryChange,
}: {
  role: Role;
  serviceState: ServiceRequestState;
  setServiceState: React.Dispatch<React.SetStateAction<ServiceRequestState>>;
  workState: WorkState;
  setWorkState: React.Dispatch<React.SetStateAction<WorkState>>;
  notify: (message: string) => void;
  onOfferServices: () => void;
  launchMode?: ServiceLaunchMode;
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
  onAreaChange?: (
    area: "discover" | "tasks" | "work",
    workMode: "jobs" | "hire",
  ) => void;
}) {
  const { i18n } = useTranslation();
  const portuguese = (i18n.resolvedLanguage || i18n.language || "pt")
    .toLowerCase()
    .startsWith("pt");
  const copy = (en: string, pt: string) => (portuguese ? pt : en);
  const canRequestService = role === "tenant" || role === "landlord";
  const locale = portuguese ? "pt-PT" : "en-GB";
  const number = new Intl.NumberFormat(locale);
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const labels: Record<string, string> = {
    Cleaning: copy("Cleaning", "Limpeza"),
    Plumbing: copy("Plumbing", "Canalização"),
    Electrical: copy("Electrical", "Eletricidade"),
    "AC & climate": copy("AC & climate", "Ar condicionado e climatização"),
    Handyman: copy("Handyman", "Pequenas reparações"),
    "Regular clean": copy("Regular clean", "Limpeza regular"),
    "Deep clean": copy("Deep clean", "Limpeza profunda"),
    "Move-in clean": copy("Move-in clean", "Limpeza antes da mudança"),
    Recurring: copy("Recurring", "Serviço recorrente"),
    Leak: copy("Leak", "Fuga de água"),
    Blockage: copy("Blockage", "Entupimento"),
    Installation: copy("Installation", "Instalação"),
    "Water heater": copy("Water heater", "Esquentador"),
    Repair: copy("Repair", "Reparação"),
    Inspection: copy("Inspection", "Inspeção"),
    Outlets: copy("Outlets", "Tomadas"),
    Maintenance: copy("Maintenance", "Manutenção"),
    "Multiple units": copy("Multiple units", "Várias unidades"),
    "General repair": copy("General repair", "Reparação geral"),
    Assembly: copy("Assembly", "Montagem"),
    Indoor: copy("Indoor", "Interior"),
    Outdoor: copy("Outdoor", "Exterior"),
    "Any pricing": copy("Any pricing", "Qualquer preço"),
    "Fixed price": copy("Listed price", "Preço indicado"),
    "Quote available": copy("Quote available", "Mediante orçamento"),
    "Any provider": copy("Any provider type", "Qualquer tipo de prestador"),
    Independent: copy("Independent", "Independente"),
    Company: copy("Company", "Empresa"),
    "Any availability": copy("Any availability", "Qualquer disponibilidade"),
    Today: copy("Today", "Hoje"),
    Tomorrow: copy("Tomorrow", "Amanhã"),
    "This week": copy("This week", "Esta semana"),
    "Any rating": copy("Any rating", "Qualquer avaliação"),
    Recommended: copy("Recommended", "Recomendados"),
    "Highest rated": copy("Highest rated", "Maior avaliação"),
    "Most completed jobs": copy("Most jobs", "Mais trabalhos"),
    "Price: low to high": copy("Price: low to high", "Preço: crescente"),
    "Price: high to low": copy("Price: high to low", "Preço: decrescente"),
  };
  const label = (value: string) =>
    Object.hasOwn(labels, value) ? labels[value] : value;
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [serviceSection, setServiceSection] = useState<
    "discover" | "tasks" | "work"
  >(launchMode === "jobs" || launchMode === "hire" ? "work" : launchMode);
  const [requestingService, setRequestingService] = useState(false);
  const [actionChooserOpen, setActionChooserOpen] = useState(false);
  const [workMode, setWorkMode] = useState<"jobs" | "hire">(
    launchMode === "hire" ? "hire" : "jobs",
  );
  const [jobQuery, setJobQuery] = useState(initialQuery);
  const [booking, setBooking] = useState<(typeof providers)[number] | null>(
    null,
  );
  const [serviceQuery, setServiceQuery] = useState(initialQuery);
  const [pricingFilter, setPricingFilter] = useState("Any pricing");
  const [providerKind, setProviderKind] = useState("Any provider");
  const [serviceAvailability, setServiceAvailability] =
    useState("Any availability");
  const [minimumRating, setMinimumRating] = useState("Any rating");
  const [serviceSort, setServiceSort] = useState("Recommended");
  const [serviceNeed, setServiceNeed] = useState("");
  useEffect(() => {
    onAreaChange?.(serviceSection, workMode);
  }, [onAreaChange, serviceSection, workMode]);
  useEffect(() => {
    onQueryChange?.(serviceSection === "work" ? jobQuery : serviceQuery);
  }, [onQueryChange, serviceSection, jobQuery, serviceQuery]);
  const categories: [string, LucideIcon][] = [
    ["Cleaning", Sparkles],
    ["Plumbing", Wrench],
    ["Electrical", Zap],
    ["AC & climate", Settings],
    ["Handyman", Home],
  ];
  const serviceNeeds: Record<string, string[]> = {
    Cleaning: ["Regular clean", "Deep clean", "Move-in clean", "Recurring"],
    Plumbing: ["Leak", "Blockage", "Installation", "Water heater"],
    Electrical: ["Repair", "Installation", "Inspection", "Outlets"],
    "AC & climate": ["Repair", "Maintenance", "Installation", "Multiple units"],
    Handyman: ["General repair", "Assembly", "Indoor", "Outdoor"],
  };
  const visible = providers
    .filter(
      (provider) =>
        (selectedCategory === "All" || provider.type === selectedCategory) &&
        matchesSearch(
          serviceQuery,
          provider.name,
          provider.type,
          provider.mode,
          label(provider.type),
          label(provider.providerKind),
          label(provider.pricing),
        ) &&
        (pricingFilter === "Any pricing" ||
          provider.pricing === pricingFilter) &&
        (providerKind === "Any provider" ||
          provider.providerKind === providerKind) &&
        (serviceAvailability === "Any availability" ||
          provider.availability === serviceAvailability) &&
        (minimumRating === "Any rating" ||
          provider.rating >= Number(minimumRating)),
    )
    .sort((a, b) =>
      serviceSort === "Highest rated"
        ? b.rating - a.rating
        : serviceSort === "Most completed jobs"
          ? b.jobs - a.jobs
          : serviceSort === "Price: low to high"
            ? a.priceValue - b.priceValue
            : serviceSort === "Price: high to low"
              ? b.priceValue - a.priceValue
              : b.rating * 20 + b.jobs / 20 - (a.rating * 20 + a.jobs / 20),
    );
  const activeServiceFilters =
    Number(selectedCategory !== "All") +
    Number(Boolean(serviceQuery)) +
    Number(pricingFilter !== "Any pricing") +
    Number(providerKind !== "Any provider") +
    Number(serviceAvailability !== "Any availability") +
    Number(minimumRating !== "Any rating");
  return (
    <div className="page-stack services-page">
      {serviceSection !== "work" && (
        <section className="services-hero">
          <div>
            <span className="eyebrow light">
              {copy(
                "HOME & PROPERTY SERVICES",
                "SERVIÇOS PARA O LAR E IMÓVEIS",
              )}
            </span>
            <h2>
              {copy(
                "Keep service requests and quotes together.",
                "Pedidos de serviço e orçamentos no mesmo lugar.",
              )}
            </h2>
            <p>
              {copy(
                "Explore sample profiles, choose a provider and record your request. Review the proposed work, date and price before explicitly accepting a quote.",
                "Explore perfis de exemplo, escolha um prestador e registe o seu pedido. Reveja o trabalho proposto, a data e o preço antes de aceitar explicitamente um orçamento.",
              )}
            </p>
          </div>
          <div className="service-proof">
            <Store size={22} aria-hidden="true" />
            <strong>
              {copy(
                "Sample provider catalogue",
                "Catálogo de prestadores de exemplo",
              )}
            </strong>
            <span>
              {copy(
                "Illustrative profiles; verification has not been performed.",
                "Perfis ilustrativos; não foi efetuada verificação.",
              )}
            </span>
          </div>
        </section>
      )}
      <section
        className="service-section-switch"
        aria-label={copy("Services view", "Área de serviços")}
      >
        <button
          className={serviceSection === "discover" ? "active" : ""}
          aria-pressed={serviceSection === "discover"}
          onClick={() => setServiceSection("discover")}
        >
          <Search size={17} aria-hidden="true" />{" "}
          {copy("Find help", "Encontrar ajuda")}
        </button>
        <button
          className={serviceSection === "tasks" ? "active" : ""}
          aria-pressed={serviceSection === "tasks"}
          onClick={() => setServiceSection("tasks")}
        >
          <BriefcaseBusiness size={17} aria-hidden="true" />{" "}
          {copy("My requests", "Os meus pedidos")}{" "}
          <i>{visibleServiceRequests(serviceState, role).length}</i>
        </button>
        <button
          className={serviceSection === "work" ? "active" : ""}
          aria-pressed={serviceSection === "work"}
          onClick={() => setServiceSection("work")}
        >
          <Users size={17} aria-hidden="true" /> {copy("Work", "Trabalho")}
        </button>
      </section>
      <button
        className="service-action-menu-button"
        onClick={() => setActionChooserOpen(true)}
      >
        <span>
          <Sparkles size={18} />
          <span>
            <small>{copy("WORK & SERVICES", "TRABALHO E SERVIÇOS")}</small>
            <strong>
              {copy(
                "What would you like to do today?",
                "O que gostaria de fazer hoje?",
              )}
            </strong>
          </span>
        </span>
        <ChevronRight size={20} />
      </button>
      {serviceSection === "tasks" ? (
        <ServiceRequests
          role={role}
          state={serviceState}
          setState={setServiceState}
        />
      ) : serviceSection === "work" ? (
        <section className="kasa-work-page">
          <div
            className="service-section-switch work-section-switch"
            role="group"
            aria-label={copy("Work area", "Área de trabalho")}
          >
            <button
              type="button"
              className={workMode === "jobs" ? "active" : ""}
              aria-pressed={workMode === "jobs"}
              onClick={() => setWorkMode("jobs")}
            >
              {copy(
                "Opportunities & applications",
                "Oportunidades e candidaturas",
              )}
            </button>
            <button
              type="button"
              className={workMode === "hire" ? "active" : ""}
              aria-pressed={workMode === "hire"}
              onClick={() => setWorkMode("hire")}
            >
              {copy("Hiring workspace", "Área da empresa")}
            </button>
          </div>
          {workMode === "jobs" ? (
            <WorkMarketplace
              role={role}
              state={workState}
              setState={setWorkState}
              query={jobQuery || undefined}
              onQueryChange={setJobQuery}
              onOpenHiring={() => setWorkMode("hire")}
            />
          ) : (
            <WorkHiringWorkspace
              role={role}
              state={workState}
              setState={setWorkState}
              onBrowseOpportunities={() => setWorkMode("jobs")}
            />
          )}
        </section>
      ) : (
        <>
          {!canRequestService && (
            <p className="scope-note" id="service-request-workspace-hint">
              {copy(
                "You can browse service profiles here. To record a request, use the workspace selector to switch to Tenant or Property owner.",
                "Pode explorar os perfis de serviços nesta área. Para registar um pedido, utilize o seletor de espaço para mudar para Inquilino ou Proprietário.",
              )}
            </p>
          )}
          <section className="service-search">
            <div>
              <Search size={20} />
              <input
                placeholder={copy(
                  "What do you need help with?",
                  "De que ajuda precisa?",
                )}
                aria-label={copy(
                  "Search service providers",
                  "Pesquisar prestadores de serviços",
                )}
                value={serviceQuery}
                onChange={(event) => setServiceQuery(event.target.value)}
              />
            </div>
            <select aria-label={copy("Service location", "Local dos serviços")}>
              <option>Barcelona</option>
            </select>
            <ActionButton
              onClick={() =>
                notify(
                  copy(
                    `${visible.length} matching sample profiles shown.`,
                    `${visible.length} perfis de exemplo encontrados.`,
                  ),
                )
              }
            >
              {copy("Search", "Pesquisar")}
            </ActionButton>
          </section>
          <section className="service-category-block">
            <div className="service-mobile-section-title">
              <div>
                <span className="eyebrow">{copy("BROWSE", "EXPLORAR")}</span>
                <h2>{copy("Home services", "Serviços para o lar")}</h2>
              </div>
              <ChevronRight size={20} />
            </div>
            <div className="category-row five">
              {categories.map(([label, Icon]) => (
                <button
                  className={selectedCategory === label ? "active" : ""}
                  aria-pressed={selectedCategory === label}
                  key={label}
                  onClick={() => {
                    setSelectedCategory(
                      selectedCategory === label ? "All" : label,
                    );
                    setServiceNeed("");
                  }}
                >
                  <Icon size={19} aria-hidden="true" /> {labels[label]}
                </button>
              ))}
            </div>
          </section>
          {selectedCategory !== "All" && (
            <div className="service-subfilters">
              <span>{copy("Request ideas", "Ideias para o pedido")}</span>
              {serviceNeeds[selectedCategory].map((need) => (
                <button
                  key={need}
                  className={serviceNeed === need ? "active" : ""}
                  aria-pressed={serviceNeed === need}
                  onClick={() =>
                    setServiceNeed(serviceNeed === need ? "" : need)
                  }
                >
                  {label(need)}
                </button>
              ))}
            </div>
          )}
          <FilterToolbar
            activeCount={activeServiceFilters}
            onReset={() => {
              setSelectedCategory("All");
              setServiceQuery("");
              setPricingFilter("Any pricing");
              setProviderKind("Any provider");
              setServiceAvailability("Any availability");
              setMinimumRating("Any rating");
              setServiceSort("Recommended");
              setServiceNeed("");
            }}
          >
            <select
              aria-label={copy("Pricing", "Preço")}
              value={pricingFilter}
              onChange={(event) => setPricingFilter(event.target.value)}
            >
              <option value="Any pricing">{label("Any pricing")}</option>
              <option value="Fixed price">{label("Fixed price")}</option>
              <option value="Quote available">
                {label("Quote available")}
              </option>
            </select>
            <select
              aria-label={copy("Provider type", "Tipo de prestador")}
              value={providerKind}
              onChange={(event) => setProviderKind(event.target.value)}
            >
              <option value="Any provider">{label("Any provider")}</option>
              <option value="Independent">{label("Independent")}</option>
              <option value="Company">{label("Company")}</option>
            </select>
            <select
              aria-label={copy("Availability", "Disponibilidade")}
              value={serviceAvailability}
              onChange={(event) => setServiceAvailability(event.target.value)}
            >
              <option value="Any availability">
                {label("Any availability")}
              </option>
              <option value="Today">{label("Today")}</option>
              <option value="Tomorrow">{label("Tomorrow")}</option>
              <option value="This week">{label("This week")}</option>
            </select>
            <select
              aria-label={copy("Rating", "Avaliação")}
              value={minimumRating}
              onChange={(event) => setMinimumRating(event.target.value)}
            >
              <option value="Any rating">{label("Any rating")}</option>
              <option value="4.8">
                {copy("4.8+ rating", "Avaliação 4,8+")}
              </option>
              <option value="4.9">
                {copy("4.9+ rating", "Avaliação 4,9+")}
              </option>
            </select>
            <select
              aria-label={copy("Sort providers", "Ordenar prestadores")}
              value={serviceSort}
              onChange={(event) => setServiceSort(event.target.value)}
            >
              <option value="Recommended">{label("Recommended")}</option>
              <option value="Highest rated">{label("Highest rated")}</option>
              <option value="Most completed jobs">
                {label("Most completed jobs")}
              </option>
              <option value="Price: low to high">
                {label("Price: low to high")}
              </option>
              <option value="Price: high to low">
                {label("Price: high to low")}
              </option>
            </select>
          </FilterToolbar>
          <section className="service-request-cta">
            <div className="service-request-illustration">
              <Wrench size={28} />
            </div>
            <div>
              <span className="eyebrow">
                {copy("START A REQUEST", "INICIAR UM PEDIDO")}
              </span>
              <h2>
                {copy(
                  "Describe the work and choose a provider.",
                  "Descreva o trabalho e escolha um prestador.",
                )}
              </h2>
              <p>
                {copy(
                  "Select one provider and save the request in this tab. No request is sent and no response is generated automatically.",
                  "Selecione um prestador e guarde o pedido neste separador. O pedido não é enviado e não é gerada qualquer resposta automática.",
                )}
              </p>
            </div>
            <button
              type="button"
              className="button"
              disabled={!canRequestService}
              aria-describedby={
                !canRequestService
                  ? "service-request-workspace-hint"
                  : undefined
              }
              onClick={() => setRequestingService(true)}
            >
              {copy("Record a request", "Registar um pedido")}
            </button>
          </section>
          <SectionHeading
            title={
              selectedCategory === "All"
                ? copy(
                    "Sample provider profiles",
                    "Perfis de prestadores de exemplo",
                  )
                : `${label(selectedCategory)}${serviceNeed ? ` · ${label(serviceNeed)}` : ""}`
            }
          />
          <section className="provider-grid">
            {visible.map((provider) => (
              <article className="provider-card" key={provider.name}>
                <div className="provider-card-top">
                  <div className={`provider-logo ${provider.tone}`}>
                    {provider.initials}
                  </div>
                  <StatusPill tone="neutral">
                    {copy("Sample profile", "Perfil de exemplo")}
                  </StatusPill>
                </div>
                <div>
                  <h3>{provider.name}</h3>
                  <p>
                    {label(provider.type)} · {label(provider.providerKind)} ·{" "}
                    {label(provider.pricing)}
                  </p>
                </div>
                <div className="provider-rating">
                  <Star size={16} fill="currentColor" aria-hidden="true" />{" "}
                  <strong>{number.format(provider.rating)}</strong>
                  <span>
                    {copy(
                      `${number.format(provider.jobs)} jobs`,
                      `${number.format(provider.jobs)} trabalhos`,
                    )}
                  </span>
                </div>
                <div className="provider-price">
                  <strong>
                    {copy(
                      `From ${money.format(provider.priceValue)}`,
                      `Desde ${money.format(provider.priceValue)}`,
                    )}
                  </strong>
                  <span>
                    <Clock3 size={14} aria-hidden="true" />{" "}
                    {label(provider.availability)}
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!canRequestService}
                  aria-describedby={
                    !canRequestService
                      ? "service-request-workspace-hint"
                      : undefined
                  }
                  onClick={() => setBooking(provider)}
                >
                  {copy("Record a request", "Registar um pedido")}
                </button>
              </article>
            ))}
          </section>
          {visible.length === 0 && (
            <div className="empty-state">
              <Store size={28} />
              <h3>
                {copy(
                  "No sample profiles match",
                  "Nenhum perfil de exemplo encontrado",
                )}
              </h3>
              <p>
                {copy(
                  "Reset a filter or choose another service category.",
                  "Limpe um filtro ou escolha outra categoria de serviço.",
                )}
              </p>
            </div>
          )}
          <div className="scope-note">
            <Store size={17} />
            <span>
              {copy(
                "Names, ratings, job counts, prices and availability are illustrative. Requests and quotes remain in this tab and reset on reload. Nothing is sent to a provider and no payment is processed.",
                "Os nomes, avaliações, números de trabalhos, preços e disponibilidades são ilustrativos. Os pedidos e orçamentos ficam neste separador e são repostos ao recarregar. Nada é enviado a um prestador e nenhum pagamento é processado.",
              )}
            </span>
          </div>
        </>
      )}
      {canRequestService && (booking || requestingService) && (
        <ServiceRequestComposer
          role={role}
          state={serviceState}
          setState={setServiceState}
          providerName={booking?.name}
          onClose={() => {
            setBooking(null);
            setRequestingService(false);
          }}
          onSaved={() => {
            setBooking(null);
            setRequestingService(false);
            setServiceSection("tasks");
          }}
        />
      )}
      {actionChooserOpen && (
        <Modal
          title={copy(
            "What would you like to do today?",
            "O que gostaria de fazer hoje?",
          )}
          onClose={() => setActionChooserOpen(false)}
        >
          <div className="modal-body service-action-grid">
            <button
              onClick={() => {
                setServiceSection("work");
                setWorkMode("jobs");
                setActionChooserOpen(false);
              }}
            >
              <span className="service-action-icon work">
                <BriefcaseBusiness />
              </span>
              <span>
                <small>
                  {copy("Find opportunities", "Encontrar oportunidades")}
                </small>
                <strong>{copy("Get a job", "Procurar trabalho")}</strong>
              </span>
              <ChevronRight />
            </button>
            <button
              onClick={() => {
                setServiceSection("work");
                setWorkMode("hire");
                setActionChooserOpen(false);
              }}
            >
              <span className="service-action-icon hire">
                <Users />
              </span>
              <span>
                <small>{copy("For your business", "Para a sua empresa")}</small>
                <strong>{copy("Hire staff", "Contratar pessoal")}</strong>
              </span>
              <ChevronRight />
            </button>
            <button
              onClick={() => {
                setServiceSection("discover");
                setActionChooserOpen(false);
              }}
            >
              <span className="service-action-icon pro">
                <Wrench />
              </span>
              <span>
                <small>
                  {copy(
                    "For your home or property",
                    "Para a sua casa ou imóvel",
                  )}
                </small>
                <strong>
                  {copy("Find a Pro", "Encontrar um profissional")}
                </strong>
              </span>
              <ChevronRight />
            </button>
            <button
              onClick={() => {
                setActionChooserOpen(false);
                onOfferServices();
              }}
            >
              <span className="service-action-icon offer">
                <CircleDollarSign />
              </span>
              <span>
                <small>
                  {copy(
                    "Build your service business",
                    "Desenvolver a sua atividade",
                  )}
                </small>
                <strong>{copy("Offer services", "Oferecer serviços")}</strong>
              </span>
              <ChevronRight />
            </button>
            <div className="scope-note">
              <ShieldCheck size={16} />
              <span>
                {copy(
                  "One Kasa identity can use several areas, while provider and business records remain separated by role and permission.",
                  "Uma identidade Kasa pode utilizar várias áreas, mantendo os registos de prestadores e empresas separados por função e permissão.",
                )}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SpaceVenueCard({
  venue,
  onOpen,
  saved,
  onSave,
}: {
  venue: SpaceVenue;
  onOpen: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  const { tr, language } = useKasaI18n();
  return (
    <article className="space-venue-card">
      <div className="space-venue-image">
        <img src={venue.image} alt={venue.name} />
        {venue.availableToday && (
          <StatusPill tone="mint">{tr("space.availableToday")}</StatusPill>
        )}
        <button
          className={`heart-button ${saved ? "is-active" : ""}`}
          aria-label={`${saved ? (language.startsWith("pt") ? "Remover dos guardados" : "Remove from saved") : tr("common.save")} ${venue.name}`}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="space-venue-copy">
        <div className="space-card-heading">
          <span>
            <strong>{venue.name}</strong>
            <small>
              <MapPin size={13} /> {venue.neighbourhood} · {venue.distance}
            </small>
          </span>
          {venue.verified && (
            <StatusPill tone="mint">
              {language.startsWith("pt") ? "Exemplo" : "Sample"}
            </StatusPill>
          )}
        </div>
        <div className="space-rating">
          <Star size={14} fill="currentColor" /> {venue.rating}{" "}
          <span>({venue.reviews})</span>
        </div>
        <div className="space-card-footer">
          <span>
            {tr("space.from")} <strong>{formatEuro(venue.priceFrom)}</strong>{" "}
            {venue.category === "Events"
              ? tr("space.eventUnit")
              : venue.priceUnit}
          </span>
          <button className="soft-button" onClick={onOpen}>
            {tr("space.viewVenue")} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function SpacesMarketplace({
  role,
  bookingsState,
  savedVenueIds,
  onToggleSavedVenue,
  setBookingsState,
  onGoBookings,
  onListSpace,
  filters,
  onFiltersChange,
  onResetFilters,
  venueId,
  spaceId,
  onOpenVenue,
  onBrowse,
  onSelectSpace,
}: {
  role: Role;
  bookingsState: SpaceBookingsState;
  savedVenueIds: number[];
  onToggleSavedVenue: (venueId: number) => void;
  setBookingsState: React.Dispatch<React.SetStateAction<SpaceBookingsState>>;
  onGoBookings: () => void;
  onListSpace: () => void;
  filters: SpacesDiscoveryFilters;
  onFiltersChange: (
    update: Parameters<typeof updateSpacesDiscovery>[2],
  ) => void;
  onResetFilters: () => void;
  venueId: number | null;
  spaceId: number | null;
  onOpenVenue: (venue: SpaceVenue) => void;
  onBrowse: () => void;
  onSelectSpace: (spaceId: number) => void;
}) {
  const { tr, language } = useKasaI18n();
  const copy = (en: string, pt: string) =>
    language.startsWith("pt") ? pt : en;
  const canRequest = role === "tenant" || role === "landlord";
  const [requestOpen, setRequestOpen] = useState(false);
  const [catalogVenues, setCatalogVenues] = useState(spaceVenues);
  const {
    category,
    query,
    sort,
    savedOnly,
    mapView,
    activity,
    availableToday,
    bookingMode,
    capacity,
    spaceMaxPrice,
    spaceAmenities,
    drawnZone,
  } = filters;
  function updateFilter<K extends keyof SpacesDiscoveryFilters>(
    key: K,
    update: React.SetStateAction<SpacesDiscoveryFilters[K]>,
  ) {
    onFiltersChange((current) => ({
      [key]:
        typeof update === "function"
          ? (
              update as (
                value: SpacesDiscoveryFilters[K],
              ) => SpacesDiscoveryFilters[K]
            )(current[key])
          : update,
    }));
  }
  const setCategory = (value: string) =>
    updateFilter("category", value as SpacesDiscoveryFilters["category"]);
  const setQuery = (value: string) => updateFilter("query", value);
  const setSort = (value: string) =>
    updateFilter("sort", value as SpacesDiscoveryFilters["sort"]);
  const setSavedOnly = (value: React.SetStateAction<boolean>) =>
    updateFilter("savedOnly", value);
  const setMapView = (value: boolean) => updateFilter("mapView", value);
  const setActivity = (value: string) =>
    updateFilter("activity", value as SpacesDiscoveryFilters["activity"]);
  const setAvailableToday = (value: React.SetStateAction<boolean>) =>
    updateFilter("availableToday", value);
  const setBookingMode = (value: string) =>
    updateFilter("bookingMode", value as SpacesDiscoveryFilters["bookingMode"]);
  const setCapacity = (value: string) =>
    updateFilter("capacity", value as SpacesDiscoveryFilters["capacity"]);
  const setSpaceMaxPrice = (value: string) =>
    updateFilter(
      "spaceMaxPrice",
      value as SpacesDiscoveryFilters["spaceMaxPrice"],
    );
  const setSpaceAmenities = (value: React.SetStateAction<string[]>) =>
    updateFilter("spaceAmenities", value);
  const setDrawnZone = (value: ZonePoint[]) => updateFilter("drawnZone", value);
  const venue =
    catalogVenues.find((item) => item.id === venueId) ??
    spaceVenues.find((item) => item.id === venueId) ??
    spaceVenues[0];
  const space =
    venue.spaces.find((item) => item.id === spaceId) ?? venue.spaces[0];
  const slot =
    space.slots.find((item) => item.status !== "Booked") ?? space.slots[0];
  useEffect(() => {
    if (!appConfig.apiUrl) return;
    let active = true;
    void listSpaces()
      .then((items) => {
        if (!active || items.length === 0) return;
        setCatalogVenues(items);
        // Catalogue refreshes must not replace a venue or request already selected.
      })
      .catch((error: unknown) => {
        warnApiFallbackOnce("space", error);
      });
    return () => {
      active = false;
    };
  }, []);
  const categories: Array<[string, LucideIcon, string]> = [
    ["All", Search, tr("space.eyebrow")],
    ["Sports", Zap, tr("space.sportsNote")],
    ["Events", Sparkles, tr("space.eventsNote")],
  ];
  const activityOptions = spacesDiscoveryActivityOptions(category);
  const spaceAmenityOptions = spacesDiscoveryAmenityOptions(category);
  const activityLabel = (item: string) => {
    const key =
      item === "Football"
        ? "football"
        : item === "Tennis"
          ? "tennis"
          : item === "Basketball"
            ? "basketball"
            : item === "Padel"
              ? "padel"
              : item === "Celebration"
                ? "celebration"
                : item === "Workshop"
                  ? "workshop"
                  : item === "Community event"
                    ? "communityEvent"
                    : item === "Reception"
                      ? "reception"
                      : null;
    return key ? tr(`space.${key}`) : item;
  };
  const amenityLabel = (item: string) => {
    const keyByAmenity: Record<string, string> = {
      Lighting: "lighting",
      "Changing rooms": "changingRooms",
      Parking: "parking",
      "Equipment rental": "equipment",
      Kitchen: "eventKitchen",
      "Catering allowed": "catering",
      "Sound system": "sound",
      "Accessible entry": "accessible",
    };
    return tr(`space.${keyByAmenity[item]}`);
  };
  const toggleSpaceAmenity = (value: string) =>
    setSpaceAmenities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  const visibleVenues = catalogVenues
    .filter((item) => {
      const matchQuery = matchesSearch(
        query,
        item.name,
        item.neighbourhood,
        item.category,
        item.description,
        ...item.amenities,
        ...item.spaces.map((unit) => unit.activity),
      );
      const matchActivity =
        activity === "Any activity" ||
        item.spaces.some((unit) =>
          unit.activity.toLowerCase().includes(activity.toLowerCase()),
        ) ||
        item.description.toLowerCase().includes(activity.toLowerCase());
      const matchCapacity =
        capacity === "Any capacity" ||
        Math.max(
          ...item.spaces.map((unit) => unit.capacity),
          item.capacity ?? 0,
        ) >= Number(capacity);
      const matchAmenities = spaceAmenities.every((amenity) =>
        item.amenities.some((itemAmenity) =>
          itemAmenity.toLowerCase().includes(amenity.toLowerCase()),
        ),
      );
      const matchDrawnZone = isPointInsideZone([item.lat, item.lng], drawnZone);
      return (
        (!savedOnly || savedVenueIds.includes(item.id)) &&
        (category === "All" || item.category === category) &&
        matchQuery &&
        matchActivity &&
        matchCapacity &&
        (!availableToday || item.availableToday) &&
        (bookingMode === "Any booking mode" ||
          item.bookingMode === bookingMode) &&
        (spaceMaxPrice === "Any price" ||
          item.priceFrom <= Number(spaceMaxPrice)) &&
        matchAmenities &&
        matchDrawnZone
      );
    })
    .sort((a, b) =>
      sort === "Nearest"
        ? Number.parseFloat(a.distance) - Number.parseFloat(b.distance)
        : sort === "Price: low to high"
          ? a.priceFrom - b.priceFrom
          : sort === "Highest rated"
            ? b.rating - a.rating
            : Number(b.availableToday) - Number(a.availableToday),
    );
  const activeSpaceFilters =
    Number(savedOnly) +
    Number(activity !== "Any activity") +
    Number(availableToday) +
    Number(bookingMode !== "Any booking mode") +
    Number(capacity !== "Any capacity") +
    Number(spaceMaxPrice !== "Any price") +
    Number(drawnZone.length >= 3) +
    spaceAmenities.length;
  const resetSpaceFilters = onResetFilters;
  const openVenue = onOpenVenue;
  const requestComposer =
    requestOpen && canRequest ? (
      <SpaceBookingRequest
        role={role}
        state={bookingsState}
        setState={setBookingsState}
        venueId={venue.id}
        spaceId={space.id}
        initialStart={slot?.time.split("–")[0] ?? ""}
        initialEnd={slot?.time.split("–")[1] ?? ""}
        onClose={() => setRequestOpen(false)}
        onSaved={() => {
          setRequestOpen(false);
          onGoBookings();
        }}
      />
    ) : null;
  if (venueId !== null)
    return (
      <div className="page-stack">
        <button className="back-link" onClick={onBrowse}>
          <ArrowLeft size={16} /> {copy("Back to spaces", "Voltar aos espaços")}
        </button>
        <SpaceVenueShareButton venue={venue} spaceId={space.id} />
        <div className="space-gallery">
          <img src={venue.gallery[0]} alt={venue.name} />
          <img src={venue.gallery[1]} alt="" />
          <img src={venue.gallery[2]} alt="" />
        </div>
        <div className="space-venue-layout">
          <section className="space-venue-main">
            <section className="card padded">
              <div className="detail-heading">
                <div>
                  <span className="trust-line">
                    {copy("Sample venue", "Espaço de exemplo")} ·{" "}
                    {copy("Time requests", "Pedidos de horário")}
                  </span>
                  <h2>{venue.name}</h2>
                  <p>
                    <MapPin size={15} /> {venue.address} · {venue.distance}
                  </p>
                </div>
                <div className="detail-price">
                  <strong>
                    {copy("From", "Desde")} {formatEuro(venue.priceFrom)}
                  </strong>
                  <span>{venue.priceUnit}</span>
                </div>
              </div>
              <div className="space-rating">
                <Star size={16} fill="currentColor" />{" "}
                <strong>{venue.rating}</strong> ({venue.reviews}{" "}
                {copy("reviews", "avaliações")})
              </div>
              <p className="venue-description">{venue.description}</p>
            </section>
            <section className="card padded">
              <SectionHeading
                title={
                  venue.category === "Events"
                    ? copy("Venue details", "Detalhes do espaço")
                    : copy("Courts and pitches", "Campos e recintos")
                }
              />
              {venue.category === "Events" ? (
                <div className="amenity-grid">
                  {venue.amenities.map((amenity) => (
                    <span key={amenity}>
                      <CheckCircle2 size={17} />
                      {amenity}
                    </span>
                  ))}
                  <span>
                    <Clock3 size={17} />
                    {copy("Opening hours", "Horário de funcionamento")}:{" "}
                    {venue.openingHours}
                  </span>
                  <span>
                    <Sparkles size={17} />
                    {copy("Cleaning fee", "Taxa de limpeza")}{" "}
                    {formatEuro(venue.cleaningFee ?? 0)}
                  </span>
                </div>
              ) : (
                <div className="space-unit-list">
                  {venue.spaces.map((item) => (
                    <article key={item.id}>
                      <img src={item.image} alt="" />
                      <span>
                        <small>{item.activity}</small>
                        <strong>{item.name}</strong>
                        <p>
                          {copy("Up to", "Até")} {item.capacity} ·{" "}
                          {copy("from", "desde")} {formatEuro(item.price)}
                        </p>
                      </span>
                      <button
                        className="soft-button"
                        aria-label={`${copy("Request a time", "Pedir horário")} · ${item.name}`}
                        disabled={!canRequest}
                        aria-describedby={
                          !canRequest
                            ? "spaces-request-workspace-hint"
                            : undefined
                        }
                        onClick={() => {
                          onSelectSpace(item.id);
                          setRequestOpen(true);
                        }}
                      >
                        {copy("Request a time", "Pedir horário")}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className="card padded">
              <SectionHeading
                title={copy(
                  "Amenities & venue rules",
                  "Comodidades e regras do espaço",
                )}
              />
              <div className="amenity-grid">
                {venue.amenities.map((amenity) => (
                  <span key={amenity}>
                    <CheckCircle2 size={17} /> {amenity}
                  </span>
                ))}
              </div>
              <div className="scope-note">
                <ShieldCheck size={17} />
                <span>
                  {copy(
                    "Requests, proposed terms and decisions remain in this tab. No venue is contacted and no payment is processed.",
                    "Os pedidos, propostas e decisões ficam neste separador. Nenhum espaço é contactado e nenhum pagamento é processado.",
                  )}
                </span>
              </div>
            </section>
          </section>
          <aside className="card padded venue-cta">
            <StatusPill tone="amber">
              {copy(
                "Operator response required",
                "Resposta do operador necessária",
              )}
            </StatusPill>
            <h3>
              {venue.category === "Events"
                ? copy("Plan your event", "Planeie o seu evento")
                : copy(
                    "Choose a space and time",
                    "Escolha um espaço e horário",
                  )}
            </h3>
            <p>
              {copy(
                "Record your date, time and group size. Review any proposed change before accepting it.",
                "Registe a data, o horário e o tamanho do grupo. Reveja qualquer alteração proposta antes de a aceitar.",
              )}
            </p>
            <p>
              <strong>{space.name}</strong> · {space.activity}
            </p>
            <button
              className="button"
              type="button"
              disabled={!canRequest}
              aria-describedby={
                !canRequest ? "spaces-request-workspace-hint" : undefined
              }
              onClick={() => setRequestOpen(true)}
            >
              {copy("Request a time", "Pedir horário")}
            </button>
            {!canRequest && (
              <p className="muted" id="spaces-request-workspace-hint">
                {copy(
                  "Switch to Tenant or Property owner to record a request.",
                  "Mude para Inquilino ou Proprietário para registar um pedido.",
                )}
              </p>
            )}
          </aside>
        </div>
        {requestComposer}
      </div>
    );

  return (
    <div className="page-stack">
      <section className="spaces-hero">
        <div>
          <span className="eyebrow light">{tr("space.eyebrow")}</span>
          <h2>{tr("space.title")}</h2>
          <p>{tr("space.subtitle")}</p>
          <div className="space-trust-row">
            <span>
              <Building2 size={15} />{" "}
              {copy("Sample venues", "Espaços de exemplo")}
            </span>
            <span>
              <Clock3 size={15} /> {tr("space.flexible")}
            </span>
            <span>
              <FileText size={15} />{" "}
              {copy("Requests and decisions", "Pedidos e decisões")}
            </span>
          </div>
          <div className="spaces-hero-actions">
            <ActionButton onClick={onListSpace} icon={Plus}>
              {tr("space.advertiseSpace")}
            </ActionButton>
            <small>{tr("space.usageScope")}</small>
          </div>
        </div>
        <div className="spaces-hero-visual">
          <div className="space-live-stack">
            <span>
              <Zap /> {tr("space.sports")}
            </span>
            <span>
              <Sparkles /> {tr("space.events")}
            </span>
            <small>{tr("space.focusedCategories")}</small>
          </div>
        </div>
      </section>
      <div className="scope-note">
        {copy(
          "The venue catalogue, prices, reviews and suggested slots are sample data. Requests are retained in this tab; they do not make a real reservation or process payment.",
          "O catálogo de espaços, preços, avaliações e horários sugeridos são dados de exemplo. Os pedidos ficam neste separador; não efetuam uma reserva real nem processam pagamentos.",
        )}
      </div>
      <section className="space-search card">
        <div>
          <MapPin size={19} />
          <span>
            <small>{tr("space.location")}</small>
            <strong>Barcelona · {tr("space.nearby")}</strong>
          </span>
        </div>
        <label>
          <Search size={18} />
          <input
            placeholder={tr("space.searchPlaceholder")}
            aria-label={tr("space.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label={tr("space.sortSpaces")}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="Recommended">{tr("common.recommended")}</option>
          <option value="Nearest">{tr("common.nearest")}</option>
          <option value="Highest rated">{tr("common.highestRated")}</option>
          <option value="Price: low to high">{tr("common.priceLow")}</option>
        </select>
      </section>
      <section className="space-category-grid focused with-all">
        {categories.map(([label, Icon, note]) => (
          <button
            className={category === label ? "active" : ""}
            aria-pressed={category === label}
            key={label}
            onClick={() => setCategory(label)}
          >
            <span>
              <Icon size={20} />
            </span>
            <strong>
              {label === "All"
                ? tr("universalHome.everything")
                : label === "Sports"
                  ? tr("space.sports")
                  : tr("space.events")}
            </strong>
            <small>{note}</small>
          </button>
        ))}
      </section>
      <FilterToolbar
        activeCount={activeSpaceFilters}
        onReset={resetSpaceFilters}
      >
        <button
          type="button"
          className={`filter-chip-toggle ${savedOnly ? "active" : ""}`}
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly((value) => !value)}
        >
          <Heart size={14} fill={savedOnly ? "currentColor" : "none"} />
          {copy("Saved spaces", "Espaços guardados")} · {savedVenueIds.length}
        </button>
        <select
          aria-label={tr("space.activity")}
          value={activity}
          onChange={(event) => setActivity(event.target.value)}
        >
          <option value="Any activity">
            {tr("common.any")} · {tr("space.activity")}
          </option>
          {activityOptions.map((item) => (
            <option key={item} value={item}>
              {activityLabel(item)}
            </option>
          ))}
        </select>
        <select
          aria-label={tr("space.bookingMode")}
          value={bookingMode}
          onChange={(event) => setBookingMode(event.target.value)}
        >
          <option value="Any booking mode">
            {tr("common.any")} · {tr("space.bookingMode")}
          </option>
          <option value="Instant Book">{tr("space.instant")}</option>
          <option value="Request to Book">{tr("space.request")}</option>
        </select>
        <select
          aria-label={tr("space.capacity")}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
        >
          <option value="Any capacity">
            {tr("common.any")} · {tr("space.capacity")}
          </option>
          <option value="4">4+</option>
          <option value="10">10+</option>
          <option value="50">50+</option>
          <option value="100">100+</option>
        </select>
        <select
          aria-label={tr("space.priceRange")}
          value={spaceMaxPrice}
          onChange={(event) => setSpaceMaxPrice(event.target.value)}
        >
          <option value="Any price">{tr("space.priceRange")}</option>
          {spacesDiscoveryPriceOptions(category).map((price) => (
            <option key={price} value={price}>
              ≤ {formatEuro(Number(price))}
            </option>
          ))}
        </select>
        <button
          className={`filter-chip-toggle ${availableToday ? "active" : ""}`}
          onClick={() => setAvailableToday((value) => !value)}
          aria-pressed={availableToday}
        >
          <CalendarDays size={14} /> {tr("space.availableToday")}
        </button>
      </FilterToolbar>
      <section className="space-amenity-filters card">
        <strong>{tr("space.amenities")}</strong>
        <div>
          {spaceAmenityOptions.map((item) => (
            <button
              key={item}
              className={spaceAmenities.includes(item) ? "active" : ""}
              onClick={() => toggleSpaceAmenity(item)}
              aria-pressed={spaceAmenities.includes(item)}
            >
              {spaceAmenities.includes(item) && <Check size={13} />}
              {amenityLabel(item)}
            </button>
          ))}
        </div>
      </section>
      <div className="results-line">
        <span>
          <strong>{visibleVenues.length}</strong> {tr("space.results")}{" "}
          Barcelona ·{" "}
          {category === "All"
            ? tr("universalHome.everything")
            : category === "Sports"
              ? tr("space.sports")
              : tr("space.events")}
        </span>
        <div className="view-toggle">
          <button
            className={!mapView ? "active" : ""}
            onClick={() => setMapView(false)}
          >
            <LayoutDashboard size={14} /> {tr("common.list")}
          </button>
          <button
            className={mapView ? "active" : ""}
            onClick={() => setMapView(true)}
          >
            <Map size={14} /> {tr("common.map")}
          </button>
        </div>
      </div>
      {mapView ? (
        <section className="space-map-layout card">
          <Suspense
            fallback={
              <div className="map-loading">{tr("common.loadingMap")}</div>
            }
          >
            <KasaMap
              className="spaces-live-map"
              items={visibleVenues.map((item) => ({
                id: item.id,
                position: [item.lat, item.lng],
                title: item.name,
                subtitle: `${item.neighbourhood} · ${item.distance}`,
                price: formatEuro(item.priceFrom),
                image: item.image,
              }))}
              zone={drawnZone}
              onZoneChange={setDrawnZone}
              onOpen={(id) => {
                const nextVenue = catalogVenues.find((item) => item.id === id);
                if (nextVenue) openVenue(nextVenue);
              }}
              labels={{
                draw: tr("common.drawArea"),
                finish: tr("common.finishArea"),
                undo: tr("common.undo"),
                clear: tr("common.clearArea"),
                hint: tr("common.mapHint"),
                points: tr("common.points"),
                results: tr("common.resultsInside"),
                view: tr("common.viewResult"),
              }}
            />
          </Suspense>
          <div className="space-map-list">
            {visibleVenues.map((item) => (
              <SpaceVenueCard
                key={item.id}
                venue={item}
                saved={savedVenueIds.includes(item.id)}
                onSave={() => onToggleSavedVenue(item.id)}
                onOpen={() => openVenue(item)}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="space-venue-grid">
          {visibleVenues.map((item) => (
            <SpaceVenueCard
              key={item.id}
              venue={item}
              saved={savedVenueIds.includes(item.id)}
              onSave={() => onToggleSavedVenue(item.id)}
              onOpen={() => openVenue(item)}
            />
          ))}
        </section>
      )}
      {visibleVenues.length === 0 && (
        <div className="empty-state">
          <Search size={28} />
          <h3>{tr("space.noResults")}</h3>
          <p>{tr("space.noResultsNote")}</p>
          <ActionButton
            secondary
            onClick={() => {
              resetSpaceFilters();
              setQuery("");
              setCategory("All");
            }}
          >
            {tr("common.reset")}
          </ActionButton>
        </div>
      )}
      <section className="ecosystem-strip card">
        <span>
          <CalendarDays size={19} />
          <strong>{tr("space.flywheelBooking")}</strong>
        </span>
        <ArrowRight />
        <span>
          <Wrench size={19} />
          <strong>{tr("space.flywheelServices")}</strong>
        </span>
        <ArrowRight />
        <span>
          <Star size={19} />
          <strong>{tr("space.flywheelReview")}</strong>
        </span>
        <ArrowRight />
        <span>
          <Clock3 size={19} />
          <strong>{tr("space.flywheelRepeat")}</strong>
        </span>
        <ArrowRight />
        <span>
          <BarChart3 size={19} />
          <strong>{tr("space.flywheelSaas")}</strong>
        </span>
      </section>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>{tr("space.scope")}</span>
      </div>
    </div>
  );
}

function SpacesPlan({ notify }: { notify: (message: string) => void }) {
  const plans = [
    [
      "Free",
      "For one schedulable space",
      [
        "1 space",
        "Basic availability calendar",
        "Unlimited booking records",
        "Verified operator profile",
      ],
    ],
    [
      "Spaces Pro",
      "For growing venues",
      [
        "Multiple spaces",
        "Pricing rules",
        "Analytics",
        "Recurring bookings",
        "Waitlists",
        "Customer tools",
      ],
    ],
    [
      "Spaces Business",
      "For multi-facility operators",
      [
        "Multiple facilities",
        "Staff and team access",
        "Branch management",
        "Advanced analytics",
        "API and integrations",
        "Enterprise support",
      ],
    ],
  ];
  return (
    <div className="page-stack">
      <section className="spaces-plan-hero">
        <span className="eyebrow light">OPERATOR SOFTWARE + MARKETPLACE</span>
        <h2>Start simple. Add tools as the venue grows.</h2>
        <p>
          No exact subscription prices or commission percentages are presented
          in the simulator.
        </p>
      </section>
      <section className="spaces-plan-grid">
        {plans.map(([name, note, features], index) => (
          <article
            className={`card padded ${index === 1 ? "featured" : ""}`}
            key={name as string}
          >
            {index === 1 && <StatusPill tone="amber">Recommended</StatusPill>}
            <h2>{name}</h2>
            <p>{note}</p>
            <strong className="plan-status">Pricing to be defined</strong>
            {(features as string[]).map((feature) => (
              <span key={feature}>
                <Check size={16} /> {feature}
              </span>
            ))}
            <ActionButton
              secondary={index !== 1}
              onClick={() =>
                notify(`${name} interest recorded. No checkout is active.`)
              }
            >
              Choose {name}
            </ActionButton>
          </article>
        ))}
      </section>
      <section className="card padded spaces-revenue">
        <SectionHeading title="Kasa Spaces revenue" />
        <div>
          {[
            [
              "Optional invoiced commission",
              "Calculated from completed reservations and invoiced after venue settlement",
            ],
            ["Spaces Pro", "Monthly operator-software subscription"],
            ["Spaces Business", "Multi-facility business subscription"],
            ["Promoted venues", "Fixed-fee visibility in discovery"],
          ].map(([title, note]) => (
            <span key={title}>
              <Sparkles />
              <strong>{title}</strong>
              <small>{note}</small>
            </span>
          ))}
        </div>
      </section>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          Customers pay each venue through the venue’s own regulated provider.
          Kasa never receives the gross reservation amount or deducts its fee
          before settlement.
        </span>
      </div>
    </div>
  );
}

type DiagnosticState =
  "checking" | "operational" | "demo" | "pending" | "failed";

interface DiagnosticCheck {
  id: string;
  state: DiagnosticState;
  detail?: string;
}

async function performLiveDiagnostics(): Promise<DiagnosticCheck[]> {
  const results = await Promise.allSettled([
    getApiHealth(),
    listProperties(),
    listSpaces(),
    getCountryConfig(),
  ]);
  const health = results[0];
  const propertyCatalogue = results[1];
  const spacesCatalogue = results[2];
  const countryRules = results[3];

  const safeCountryRules =
    countryRules.status === "fulfilled" &&
    !countryRules.value.features.rentCustody &&
    !countryRules.value.features.overnightSpaces &&
    !countryRules.value.features.mortgageIntermediation;

  return [
    {
      id: "apiHealth",
      state: health.status === "fulfilled" ? "operational" : "failed",
      detail:
        health.status === "fulfilled"
          ? `API v${health.value.version}`
          : undefined,
    },
    {
      id: "propertyCatalogue",
      state:
        propertyCatalogue.status === "fulfilled" ? "operational" : "failed",
      detail:
        propertyCatalogue.status === "fulfilled"
          ? String(propertyCatalogue.value.length)
          : undefined,
    },
    {
      id: "spacesCatalogue",
      state: spacesCatalogue.status === "fulfilled" ? "operational" : "failed",
      detail:
        spacesCatalogue.status === "fulfilled"
          ? String(spacesCatalogue.value.length)
          : undefined,
    },
    {
      id: "countryRules",
      state: safeCountryRules ? "operational" : "failed",
      detail: safeCountryRules ? "safe" : "unsafe",
    },
  ];
}

function Diagnostics() {
  const { tr, language } = useKasaI18n();
  const [runId, setRunId] = useState(0);
  const [running, setRunning] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [liveChecks, setLiveChecks] = useState<DiagnosticCheck[]>([
    { id: "apiHealth", state: "checking" },
    { id: "propertyCatalogue", state: "checking" },
    { id: "spacesCatalogue", state: "checking" },
    { id: "countryRules", state: "checking" },
  ]);

  useEffect(() => {
    let active = true;
    void performLiveDiagnostics().then((checks) => {
      if (!active) return;
      setLiveChecks(checks);
      setLastChecked(new Date());
      setRunning(false);
    });
    return () => {
      active = false;
    };
  }, [runId]);

  const staticChecks: DiagnosticCheck[] = [
    { id: "webRuntime", state: "operational" },
    { id: "map", state: appConfig.mapTileUrl ? "operational" : "failed" },
    { id: "localization", state: "operational" },
    { id: "mortgage", state: "operational" },
    { id: "propertyOps", state: "demo" },
    { id: "rentRecords", state: "demo" },
    { id: "privateChat", state: "demo" },
    { id: "workMarketplace", state: "demo" },
    { id: "documents", state: "pending" },
    { id: "database", state: "pending" },
    { id: "auth", state: "pending" },
    { id: "notifications", state: "pending" },
    { id: "externalPayments", state: "pending" },
  ];
  const checks = [...liveChecks, ...staticChecks];
  const count = (state: DiagnosticState) =>
    checks.filter((check) => check.state === state).length;
  const stateLabels: Record<DiagnosticState, string> = {
    checking: tr("diagnostics.checking"),
    operational: tr("diagnostics.operational"),
    demo: tr("diagnostics.demo"),
    pending: tr("diagnostics.pending"),
    failed: tr("diagnostics.failed"),
  };
  const stateIcons: Record<string, LucideIcon> = {
    apiHealth: Zap,
    propertyCatalogue: Building2,
    spacesCatalogue: CalendarDays,
    countryRules: ShieldCheck,
    webRuntime: Smartphone,
    map: Map,
    localization: Globe2,
    mortgage: CircleDollarSign,
    propertyOps: Settings,
    rentRecords: WalletCards,
    privateChat: MessageCircle,
    workMarketplace: Users,
    documents: FileText,
    database: BarChart3,
    auth: LockKeyhole,
    notifications: Bell,
    externalPayments: WalletCards,
  };

  const checkDetail = (check: DiagnosticCheck) => {
    if (check.state === "failed") return tr("diagnostics.unavailable");
    if (check.id === "countryRules")
      return tr(
        check.detail === "safe"
          ? "diagnostics.safeRules"
          : "diagnostics.unsafeRules",
      );
    if (
      (check.id === "propertyCatalogue" || check.id === "spacesCatalogue") &&
      check.detail
    )
      return `${check.detail} ${tr("diagnostics.resourcesLoaded")}`;
    if (check.id === "apiHealth" && check.detail) return check.detail;
    return tr(`diagnostics.${check.id}Note`);
  };

  return (
    <div className="page-stack diagnostics-page">
      <section className="diagnostics-hero">
        <div>
          <span className="eyebrow light">{tr("diagnostics.eyebrow")}</span>
          <h2>{tr("diagnostics.title")}</h2>
          <p>{tr("diagnostics.subtitle")}</p>
          <small>
            {tr("diagnostics.lastChecked")}:{" "}
            {lastChecked
              ? new Intl.DateTimeFormat(language, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(lastChecked)
              : tr("diagnostics.checking")}
          </small>
        </div>
        <button
          className="button light-button"
          disabled={running}
          onClick={() => {
            setRunning(true);
            setLiveChecks((checks) =>
              checks.map((check) => ({ ...check, state: "checking" })),
            );
            setRunId((current) => current + 1);
          }}
        >
          <Repeat2 size={16} />
          {running ? tr("diagnostics.checking") : tr("diagnostics.runAgain")}
        </button>
      </section>

      <section className="diagnostics-summary" aria-label="Status summary">
        <article>
          <CheckCircle2 size={20} />
          <strong>{count("operational")}</strong>
          <span>{tr("diagnostics.operational")}</span>
        </article>
        <article>
          <Sparkles size={20} />
          <strong>{count("demo")}</strong>
          <span>{tr("diagnostics.demo")}</span>
        </article>
        <article>
          <Clock3 size={20} />
          <strong>{count("pending")}</strong>
          <span>{tr("diagnostics.pending")}</span>
        </article>
        <article className={count("failed") ? "has-failure" : ""}>
          <Zap size={20} />
          <strong>{count("failed")}</strong>
          <span>{tr("diagnostics.failed")}</span>
        </article>
      </section>

      <section className="card diagnostics-board">
        <div className="diagnostics-board-heading">
          <h2>{tr("diagnostics.currentFunctions")}</h2>
          <p>{tr("diagnostics.currentFunctionsNote")}</p>
        </div>
        <div className="diagnostics-grid">
          {checks.map((check) => {
            const Icon = stateIcons[check.id] || CheckCircle2;
            return (
              <article
                className={`diagnostic-card diagnostic-${check.state}`}
                key={check.id}
              >
                <span className="diagnostic-icon">
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{tr(`diagnostics.${check.id}`)}</strong>
                  <small>{checkDetail(check)}</small>
                </div>
                <StatusPill
                  tone={
                    check.state === "operational"
                      ? "mint"
                      : check.state === "demo"
                        ? "blue"
                        : check.state === "failed"
                          ? "coral"
                          : "amber"
                  }
                >
                  {stateLabels[check.state]}
                </StatusPill>
              </article>
            );
          })}
        </div>
      </section>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>{tr("diagnostics.guardrail")}</span>
      </div>
    </div>
  );
}

function AdminConsole({ notify }: { notify: (message: string) => void }) {
  const [flags, setFlags] = useState({
    buy: false,
    services: true,
    spaces: true,
    applications: true,
    autoReconcile: false,
  });
  const [queueType, setQueueType] = useState("All queues");
  const [riskFilter, setRiskFilter] = useState("All risk levels");
  const [moderationSort, setModerationSort] = useState("Highest risk");
  const toggle = (key: keyof typeof flags) =>
    setFlags((current) => ({ ...current, [key]: !current[key] }));
  const moderationItems = [
    [
      "Listing",
      "Poblenou terrace studio",
      "Address document requires review",
      "Medium",
    ],
    [
      "Provider",
      "Casa Clara Cleaning",
      "Company registration submitted",
      "Routine",
    ],
    [
      "Listing",
      "Gothic Quarter penthouse",
      "Duplicate-image risk signal",
      "High",
    ],
    ["Provider", "RapidFix BCN", "Insurance expires in 14 days", "Medium"],
    [
      "Venue",
      "Poblenou MultiSport Club",
      "Operator insurance and capacity check",
      "Routine",
    ],
  ];
  const riskOrder: Record<string, number> = { High: 0, Medium: 1, Routine: 2 };
  const visibleModeration = moderationItems
    .filter(
      (item) =>
        (queueType === "All queues" || item[0] === queueType) &&
        (riskFilter === "All risk levels" || item[3] === riskFilter),
    )
    .sort((a, b) =>
      moderationSort === "Recently submitted"
        ? moderationItems.indexOf(b) - moderationItems.indexOf(a)
        : moderationSort === "Queue name"
          ? a[1].localeCompare(b[1])
          : riskOrder[a[3]] - riskOrder[b[3]],
    );
  const activeModerationFilters =
    Number(queueType !== "All queues") +
    Number(riskFilter !== "All risk levels");
  return (
    <div className="page-stack">
      <section className="admin-banner">
        <div>
          <ShieldCheck size={25} />
          <span>
            <strong>Trust operations</strong>
            <small>
              Illustrative Barcelona configuration · 4 demo items need review
            </small>
          </span>
        </div>
        <div className="admin-health">
          <i />
          <span>Demo systems operational</span>
        </div>
      </section>
      <section className="metrics-grid">
        <Metric
          label="Listing review"
          value="3"
          note="1 potentially high risk"
          icon={Building2}
        />
        <Metric
          label="Provider & venue checks"
          value="6"
          note="2 documents expiring"
          icon={BadgeCheck}
          tone="blue"
        />
        <Metric
          label="User reports"
          value="1"
          note="Median response 42 min"
          icon={LifeBuoy}
          tone="lilac"
        />
        <Metric
          label="Fraud signals"
          value="2"
          note="No custody exposure"
          icon={ShieldCheck}
          tone="sun"
        />
      </section>
      <div className="admin-grid">
        <section className="card moderation-card">
          <div className="table-card-title">
            <div>
              <h2>Moderation queue</h2>
              <p>Listings, providers and reported content</p>
            </div>
            <StatusPill tone="neutral">
              {visibleModeration.length} shown
            </StatusPill>
          </div>
          <FilterToolbar
            activeCount={activeModerationFilters}
            onReset={() => {
              setQueueType("All queues");
              setRiskFilter("All risk levels");
              setModerationSort("Highest risk");
            }}
          >
            <select
              aria-label="Moderation queue type"
              value={queueType}
              onChange={(event) => setQueueType(event.target.value)}
            >
              <option>All queues</option>
              <option>Listing</option>
              <option>Provider</option>
            </select>
            <select
              aria-label="Moderation risk"
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value)}
            >
              <option>All risk levels</option>
              <option>High</option>
              <option>Medium</option>
              <option>Routine</option>
            </select>
            <select
              aria-label="Sort moderation queue"
              value={moderationSort}
              onChange={(event) => setModerationSort(event.target.value)}
            >
              <option>Highest risk</option>
              <option>Recently submitted</option>
              <option>Queue name</option>
            </select>
          </FilterToolbar>
          {visibleModeration.map((item) => (
            <button
              key={item[1]}
              onClick={() => notify(`${item[0]} review workspace opened.`)}
            >
              <span className={`moderation-icon ${item[0].toLowerCase()}`}>
                {item[0] === "Listing" ? (
                  <Building2 size={18} />
                ) : (
                  <Wrench size={18} />
                )}
              </span>
              <span>
                <strong>{item[1]}</strong>
                <small>{item[2]}</small>
              </span>
              <StatusPill
                tone={
                  item[3] === "High"
                    ? "red"
                    : item[3] === "Medium"
                      ? "amber"
                      : "neutral"
                }
              >
                {item[3]}
              </StatusPill>
              <ChevronRight size={17} />
            </button>
          ))}
          {visibleModeration.length === 0 && (
            <div className="table-empty">
              <Filter size={22} />
              <span>No moderation items match these filters.</span>
            </div>
          )}
        </section>
        <aside className="card padded flag-card">
          <div className="flag-heading">
            <div className="flag-globe">
              <Globe2 size={20} />
            </div>
            <div>
              <span className="eyebrow">EXAMPLE COUNTRY CONFIG</span>
              <h2>Spain · Barcelona</h2>
            </div>
            <button className="icon-button">
              <ChevronDown />
            </button>
          </div>
          <p>
            Release capabilities by market without changing the global product
            model. This location is demo data, not a launch-market decision.
          </p>
          {[
            ["buy", "Property sales", "Discovery and direct contact"],
            ["services", "Kasa Services", "Bookings, quotes and tracking"],
            ["spaces", "Kasa Spaces", "Flexible requests and reservations"],
            [
              "applications",
              "Tenant applications",
              "Reusable verified profile",
            ],
            [
              "autoReconcile",
              "Bank auto-reconciliation",
              "Off until compliant integration",
            ],
          ].map(([key, label, note]) => (
            <button
              className="flag-row"
              key={key}
              onClick={() => toggle(key as keyof typeof flags)}
            >
              <span>
                <strong>{label}</strong>
                <small>{note}</small>
              </span>
              <i className={flags[key as keyof typeof flags] ? "on" : ""}>
                <b />
              </i>
            </button>
          ))}
          <div className="scope-note">
            <ShieldCheck size={16} />
            <span>
              Rent custody and brokerage are platform-level hard constraints,
              not configurable features.
            </span>
          </div>
        </aside>
      </div>
      <section className="card padded compliance-readiness">
        <div className="compliance-readiness-heading">
          <span className="eyebrow">ANGOLA · PRE-LAUNCH READINESS</span>
          <h2>Compliance gates before live operation</h2>
          <p>
            Readiness controls only—the definitive launch market remains
            undecided.
          </p>
        </div>
        <div className="compliance-gate-grid">
          {[
            [
              "Information-society classification",
              "Formal confirmation required",
              "amber",
            ],
            [
              "Personal data and cloud transfers",
              "Authority steps required",
              "amber",
            ],
            [
              "Property-mediation boundary",
              "Written legal opinion pending",
              "amber",
            ],
            ["Rent and deposit custody", "Disabled by design", "mint"],
            [
              "Reports, moderation and appeals",
              "Required before launch",
              "blue",
            ],
          ].map(([title, note, tone]) => (
            <article key={title}>
              <StatusPill tone={tone}>{note}</StatusPill>
              <strong>{title}</strong>
            </article>
          ))}
        </div>
        <div className="scope-note">
          <ShieldCheck size={16} />
          <span>
            Market release remains behind country configuration until legal,
            privacy, payment and operating checks are complete.
          </span>
        </div>
      </section>
      <section className="card padded trust-table">
        <SectionHeading title="Verification coverage" />
        <div>
          <span>Listings with identity checks</span>
          <strong>96%</strong>
          <i>
            <b style={{ width: "96%" }} />
          </i>
        </div>
        <div>
          <span>Providers fully verified</span>
          <strong>91%</strong>
          <i>
            <b style={{ width: "91%" }} />
          </i>
        </div>
        <div>
          <span>Moderation within SLA</span>
          <strong>99%</strong>
          <i>
            <b style={{ width: "99%" }} />
          </i>
        </div>
      </section>
    </div>
  );
}

function Plan({ notify }: { notify: (message: string) => void }) {
  return (
    <div className="page-stack">
      <section className="plan-hero">
        <div>
          <span className="eyebrow light">AGREED COMMERCIAL DIRECTION</span>
          <h2>Software, visibility, services and spaces.</h2>
          <p>
            Kasa monetises software and marketplaces—not the residential rental
            or sale transaction itself.
          </p>
          <div className="plan-price">
            <strong>Open</strong>
            <span>
              Exact prices, limits and fee percentages
              <br />
              have not been approved.
            </span>
          </div>
          <ActionButton
            onClick={() =>
              notify(
                "This screen records the agreed revenue structure; it does not offer a live plan or checkout.",
              )
            }
          >
            View decision status
          </ActionButton>
        </div>
        <div className="plan-list">
          <h3>Agreed revenue sources</h3>
          {[
            "Landlord and portfolio software subscriptions",
            "Fixed-fee promoted property listings",
            "Provider Pro and business subscriptions",
            "Marketplace fees on completed home-service jobs",
            "Kasa Spaces subscriptions, promoted venues and optional post-settlement commission invoices",
            "Enterprise and API products later",
          ].map((item) => (
            <span key={item}>
              <Check size={16} /> {item}
            </span>
          ))}
        </div>
      </section>
      <div className="two-column">
        <section className="card padded">
          <SectionHeading title="Still to decide" />
          <div className="decision-items">
            {[
              "Launch-country prices and currencies",
              "Free-tier property limits",
              "Subscription names and entitlements",
              "Home-service marketplace fee percentage",
              "Service-payment and verification partners",
            ].map((item) => (
              <span key={item}>
                <Clock3 size={15} />
                {item}
              </span>
            ))}
          </div>
        </section>
        <section className="card padded visibility-card">
          <div className="visibility-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <h3>Promoted visibility</h3>
            <p>
              Flat-fee placement that increases listing discovery. It never
              depends on a lease closing.
            </p>
          </div>
          <button
            className="soft-button"
            onClick={() =>
              notify("Promotion pricing and packaging remain to be defined.")
            }
          >
            Promotion structure <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          Locked rule: no rental brokerage commission, sale commission,
          one-month-rent fee, rent spread or success-based property fee. Service
          marketplace fees are separate from property transactions.
        </span>
      </div>
    </div>
  );
}

function App({ demoTarget }: { demoTarget?: DemoTarget }) {
  const { tr } = useKasaI18n();
  const previewParams = new URLSearchParams(window.location.search);
  const previewDevice = previewParams.get("device");
  const [initialRoute] = useState(() =>
    readAppRoute(demoTarget ? "" : window.location.search, {
      role: demoTarget?.role,
      view: demoTarget?.view,
      intent: demoTarget?.intent,
      service: demoTarget?.service,
      propertyId:
        demoTarget?.view === "property"
          ? properties.find(
              (property) =>
                property.listingType === (demoTarget.intent ?? "Rent"),
            )?.id
          : undefined,
    }),
  );
  const isDevicePreview =
    previewDevice === "ios" || previewDevice === "android";
  const [role, setRole] = useState<Role>(initialRoute.role);
  const [view, setView] = useState<View>(initialRoute.view);
  const [showOnboarding, setShowOnboarding] = useState(() =>
    demoTarget
      ? Boolean(demoTarget.welcome)
      : previewParams.get("welcome") === "1",
  );
  const [selectedProperty, setSelectedProperty] = useState<Property>(
    properties.find((property) => property.id === initialRoute.propertyId) ??
      properties[0],
  );
  const [selectedVenueId, setSelectedVenueId] = useState(initialRoute.venueId);
  const [selectedSpaceId, setSelectedSpaceId] = useState(initialRoute.spaceId);
  const [spacesDiscovery, setSpacesDiscovery] = useState(() => {
    let state = createInitialSpacesDiscoveryState();
    if (initialRoute.view === "spaces" || initialRoute.view === "spaceVenue") {
      if (initialRoute.query)
        state = startSpacesDiscoverySearch(
          state,
          initialRoute.role,
          initialRoute.query,
        );
      else if (initialRoute.venueId !== null) {
        const venue = spaceVenues.find(
          (item) => item.id === initialRoute.venueId,
        );
        if (venue)
          state = updateSpacesDiscovery(state, initialRoute.role, {
            category: venue.category,
          });
      }
    }
    return state;
  });
  const currentSpacesFilters = spacesDiscoveryFilters(spacesDiscovery, role);
  const [workspaceSaved, setWorkspaceSaved] = useState(
    createInitialWorkspaceSavedState,
  );
  const [savedHomesViews, setSavedHomesViews] = useState(
    createInitialSavedHomesViewState,
  );
  const favourites = workspaceSaved[role].favourites;
  const setFavourites = useCallback(
    (update: FavouriteUpdate) => {
      setWorkspaceSaved((current) =>
        updateWorkspaceFavourites(current, role, update),
      );
    },
    [role],
  );
  const [workspaceMessages, setWorkspaceMessages] = useState(
    createInitialWorkspaceMessageState,
  );
  const messageState = workspaceMessages[role];
  const setMessageState = useCallback(
    (update: MessageStateUpdate) => {
      setWorkspaceMessages((current) =>
        updateWorkspaceMessageState(current, role, update),
      );
    },
    [role],
  );
  const messageUnread = unreadMessageCount(messageState);
  const [bookingsState, setBookingsState] = useState(
    createInitialSpaceBookingsState,
  );
  const [rentRecordState, setRentRecordState] = useState(
    createInitialRentRecordState,
  );
  const [rentFiltersByRole, setRentFiltersByRole] = useState<
    Record<Role, RentRecordFilters>
  >(() => ({
    tenant: createRentRecordFilters(),
    landlord: createRentRecordFilters(),
    provider: createRentRecordFilters(),
    spaceOperator: createRentRecordFilters(),
    admin: createRentRecordFilters(),
  }));
  const [serviceRequestState, setServiceRequestState] = useState(
    createInitialServiceRequestState,
  );
  const [propertyListingState, setPropertyListingState] = useState(
    createInitialPropertyListingState,
  );
  const [spaceListingState, setSpaceListingState] = useState(
    createInitialSpaceListingState,
  );
  const [portfolioFilters, setPortfolioFilters] = useState<PortfolioFilters>({
    status: "All properties",
    query: "",
    sort: "Property name",
  });
  const [maintenanceState, setMaintenanceState] = useState(
    createInitialMaintenanceState,
  );
  const [documentState, setDocumentState] = useState(
    createInitialDocumentState,
  );
  const maintenanceCount = visibleMaintenanceRecords(
    maintenanceState,
    role,
  ).filter((record) => record.status !== "Resolved").length;
  const [applicationState, setApplicationState] = useState(
    createInitialApplicationState,
  );
  const [operationsNow, setOperationsNow] = useState(() => new Date());
  const [insightsPeriod, setInsightsPeriod] = useState<string>();
  useEffect(() => {
    const refresh = () => setOperationsNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const operationsSummary =
    role === "landlord" || role === "tenant"
      ? buildPropertyOperationsSummary({
          role,
          rentState: rentRecordState,
          applicationState,
          maintenanceState,
          now: operationsNow,
        })
      : null;
  const applicationCount = visibleApplicationRecords(
    applicationState,
    role,
  ).length;
  const [workState, setWorkState] = useState(createInitialWorkState);
  const workCatalogue = openWorkOpportunities(workState);
  const [propertyRequestState, setPropertyRequestState] = useState(
    createInitialPropertyRequestState,
  );
  const viewingSummaryCounts = viewingCounts(
    propertyRequestState,
    role,
    operationsNow,
  );
  const viewingDecisionCount =
    role === "landlord"
      ? viewingSummaryCounts.pending
      : role === "tenant"
        ? viewingSummaryCounts.proposed
        : 0;
  const [notificationState, setNotificationState] = useState(
    createInitialNotificationState,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceTool, setWorkspaceTool] = useState<
    "settings" | "help" | null
  >(null);
  const [reduceMotion, setReduceMotion] = useState(
    () => readPreference("kasa-reduce-motion") === "true",
  );
  const systemReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  useEffect(() => {
    const previous = document.documentElement.dataset.reduceMotion;
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    return () => {
      if (previous === undefined)
        delete document.documentElement.dataset.reduceMotion;
      else document.documentElement.dataset.reduceMotion = previous;
    };
  }, [reduceMotion]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const mobileNavigationQuery = "(max-width: 980px)";
  const isMobileNavigation = useMediaQuery(mobileNavigationQuery);
  const closeMobileNavigation = () => {
    setMobileOpen(false);
    setWorkspaceMenuOpen(false);
  };
  const sidebarRef = useDialogFocus<HTMLElement>(closeMobileNavigation, {
    active: isMobileNavigation && mobileOpen && !showOnboarding,
    restoreFocus: () => window.matchMedia(mobileNavigationQuery).matches,
  });
  const [deviceSimulatorOpen, setDeviceSimulatorOpen] = useState(
    () => !isDevicePreview && previewParams.get("simulator") === "1",
  );
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );
  const [discoveryIntent, setDiscoveryIntent] = useState<"Rent" | "Buy">(
    initialRoute.intent,
  );
  const [discoverState, setDiscoverState] = useState(() => {
    const state = createInitialDiscoverState();
    return initialRoute.view === "discover" || initialRoute.view === "property"
      ? startDiscoverSearch(
          state,
          initialRoute.role,
          initialRoute.intent,
          initialRoute.query,
        )
      : state;
  });
  const currentDiscoverSearch = useMemo(
    () => discoverSearch(discoverState, role, discoveryIntent),
    [discoverState, role, discoveryIntent],
  );
  const savedSearchState = workspaceSaved[role].searches;
  const setSavedSearchState = useCallback(
    (update: SavedSearchStateUpdate) => {
      setWorkspaceSaved((current) =>
        updateWorkspaceSavedSearches(current, role, update),
      );
    },
    [role],
  );
  const [serviceLaunch, setServiceLaunch] = useState<ServiceLaunchMode>(
    initialRoute.service,
  );
  const [serviceArea, setServiceArea] = useState<"discover" | "tasks" | "work">(
    initialRoute.service === "jobs" || initialRoute.service === "hire"
      ? "work"
      : initialRoute.service,
  );
  const [searchQuery, setSearchQuery] = useState(initialRoute.query);
  const [serviceEntryRevision, setServiceEntryRevision] = useState(0);
  const [propertyReturnTo, setPropertyReturnTo] = useState<
    AppRoute["returnTo"]
  >(initialRoute.returnTo);
  const [routeRevision, setRouteRevision] = useState(0);
  const previousRoute = useRef<AppRoute | null>(null);
  const restoringHistory = useRef(false);

  useEffect(() => {
    if (demoTarget) return;
    const route: AppRoute = {
      role,
      view,
      intent: discoveryIntent,
      propertyId: selectedProperty.id,
      venueId: view === "spaceVenue" ? selectedVenueId : null,
      spaceId: view === "spaceVenue" ? selectedSpaceId : null,
      service: serviceLaunch,
      query:
        view === "spaces" || view === "spaceVenue"
          ? currentSpacesFilters.query
          : view === "discover" || view === "property"
            ? currentDiscoverSearch.query
            : searchQuery,
      returnTo: propertyReturnTo,
    };
    if (restoringHistory.current) {
      restoringHistory.current = false;
      previousRoute.current = route;
      return;
    }
    const url = appRouteUrl(route, window.location.search);
    const previous = previousRoute.current;
    const screenChanged =
      previous &&
      (previous.role !== role ||
        previous.view !== view ||
        (view === "property" && previous.propertyId !== selectedProperty.id) ||
        (view === "spaceVenue" && previous.venueId !== selectedVenueId) ||
        (view === "services" && previous.service !== serviceLaunch));
    const historySnapshot = createDiscoverHistory(route, currentDiscoverSearch);
    if (url !== window.location.search) {
      if (screenChanged) window.history.pushState(historySnapshot, "", url);
      else window.history.replaceState(historySnapshot, "", url);
    } else if (historySnapshot) {
      window.history.replaceState(historySnapshot, "", url);
    }
    previousRoute.current = route;
  }, [
    demoTarget,
    role,
    view,
    discoveryIntent,
    selectedProperty.id,
    selectedVenueId,
    selectedSpaceId,
    currentSpacesFilters.query,
    currentDiscoverSearch,
    serviceLaunch,
    searchQuery,
    propertyReturnTo,
    routeRevision,
  ]);

  useEffect(() => {
    if (demoTarget) return;
    const restore = () => {
      const route = readAppRoute(window.location.search);
      restoringHistory.current = true;
      setRole(route.role);
      setView(route.view);
      setSelectedVenueId(route.venueId);
      setSelectedSpaceId(route.spaceId);
      if (route.view === "spaces" || route.view === "spaceVenue") {
        setSpacesDiscovery((current) =>
          updateSpacesDiscovery(current, route.role, { query: route.query }),
        );
      }
      if (route.view === "discover" || route.view === "property") {
        const snapshot = readDiscoverHistory(window.history.state, route);
        setDiscoverState((current) =>
          snapshot
            ? applyDiscoverSearch(current, route.role, route.intent, snapshot)
            : updateDiscoverQuery(
                current,
                route.role,
                route.intent,
                route.query,
              ),
        );
      }
      setDiscoveryIntent(route.intent);
      setSelectedProperty(
        properties.find((property) => property.id === route.propertyId) ??
          properties[0],
      );
      setServiceLaunch(route.service);
      setServiceArea(
        route.service === "jobs" || route.service === "hire"
          ? "work"
          : route.service,
      );
      setSearchQuery(route.query);
      setPropertyReturnTo(route.returnTo);
      setShowOnboarding(false);
      setMobileOpen(false);
      setNotificationsOpen(false);
      setWorkspaceMenuOpen(false);
      setRouteRevision((value) => value + 1);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [demoTarget]);

  const updateServiceArea = useCallback(
    (area: "discover" | "tasks" | "work", mode: "jobs" | "hire") => {
      setServiceArea(area);
      setServiceLaunch(area === "work" ? mode : area);
    },
    [],
  );

  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.roles || item.roles.includes(role)),
    [role],
  );
  const inViewingContext =
    view === "viewings" ||
    (view === "property" && propertyReturnTo === "viewings");
  const tenantContextItem: {
    id: View;
    label: string;
    icon: LucideIcon;
    activeViews: View[];
  } = inViewingContext
    ? {
        id: "viewings",
        label: tr("nav.viewings"),
        icon: CalendarDays,
        activeViews: ["viewings", "property"],
      }
    : view === "spaces" || view === "spaceVenue" || view === "spaceBookings"
      ? {
          id: "spaceBookings",
          label: tr("nav.myBookings"),
          icon: CalendarDays,
          activeViews: ["spaces", "spaceVenue", "spaceBookings"],
        }
      : view === "services" && serviceArea === "work"
        ? {
            id: "services",
            label: tr("universalHome.work"),
            icon: BriefcaseBusiness,
            activeViews: ["services"],
          }
        : view === "services"
          ? {
              id: "services",
              label: tr("universalHome.requests"),
              icon: Wrench,
              activeViews: ["services"],
            }
          : {
              id: "portfolio",
              label: tr("nav.myHome"),
              icon: Building2,
              activeViews: [
                "discover",
                "saved",
                "property",
                "portfolio",
                "applications",
                "viewings",
                "rent",
                "maintenance",
                "documents",
              ],
            };
  const mobileDockItems: Array<{
    id: View;
    label: string;
    icon: LucideIcon;
    activeViews?: View[];
  }> =
    role === "tenant"
      ? [
          {
            id: "overview",
            label: tr("common.search"),
            icon: Search,
            activeViews: ["overview"],
          },
          {
            id: "messages",
            label: tr("common.messages"),
            icon: MessageCircle,
          },
          tenantContextItem,
          {
            id: "notifications",
            label: tr("common.notifications"),
            icon: Bell,
          },
          {
            id: "profile",
            label: tr("universalHome.profile"),
            icon: CircleUserRound,
          },
        ]
      : role === "landlord"
        ? [
            {
              id: "overview",
              label: tr("common.overview"),
              icon: LayoutDashboard,
            },
            {
              id: "portfolio",
              label: tr("common.properties"),
              icon: Building2,
            },
            {
              id: inViewingContext ? "viewings" : "applications",
              label: tr(
                inViewingContext ? "nav.viewings" : "common.applications",
              ),
              icon: inViewingContext ? CalendarDays : FileCheck2,
              activeViews: inViewingContext
                ? ["viewings", "property"]
                : ["applications"],
            },
            {
              id: "maintenance",
              label: tr("common.maintenance"),
              icon: Wrench,
            },
            {
              id: "messages",
              label: tr("common.messages"),
              icon: MessageCircle,
            },
          ]
        : role === "spaceOperator"
          ? [
              {
                id: "spaceOperator",
                label: tr("common.overview"),
                icon: LayoutDashboard,
              },
              {
                id: "messages",
                label: tr("common.messages"),
                icon: MessageCircle,
              },
              {
                id: "spaceOnboarding",
                label: tr("nav.venueSetup"),
                icon: Building2,
              },
              {
                id: "spacesPlan",
                label: tr("nav.plans"),
                icon: Sparkles,
              },
            ]
          : role === "provider"
            ? [
                {
                  id: "overview",
                  label: tr("common.overview"),
                  icon: LayoutDashboard,
                },
                {
                  id: "provider",
                  label: tr("nav.jobs"),
                  icon: BriefcaseBusiness,
                },
                {
                  id: "services",
                  label: tr("universalHome.work"),
                  icon: Users,
                },
                {
                  id: "messages",
                  label: tr("common.messages"),
                  icon: MessageCircle,
                },
              ]
            : [
                {
                  id: "overview",
                  label: tr("common.overview"),
                  icon: LayoutDashboard,
                },
                {
                  id: "admin",
                  label: tr("nav.moderation"),
                  icon: ShieldCheck,
                },
                {
                  id: "diagnostics",
                  label: tr("diagnostics.title"),
                  icon: CheckCircle2,
                },
              ];
  const navKeyByView: Partial<Record<View, string>> = {
    overview: "common.overview",
    discover: "nav.discover",
    saved: "nav.savedHomes",
    portfolio: role === "tenant" ? "nav.myHome" : "nav.myProperties",
    applications: "common.applications",
    viewings: "nav.viewings",
    messages: "common.messages",
    notifications: "common.notifications",
    profile: "universalHome.profile",
    rent: "nav.rentRecords",
    maintenance: "common.maintenance",
    documents: "common.documents",
    services: role === "provider" ? "universalHome.work" : "nav.kasaServices",
    spaces: "nav.kasaSpaces",
    spaceBookings: "nav.myBookings",
    spaceOperator: "nav.venueDashboard",
    spaceOnboarding: "nav.venueSetup",
    spacesPlan: "nav.plans",
    provider: "nav.jobs",
    admin: "nav.moderation",
    diagnostics: "diagnostics.title",
    insights: "nav.insights",
    plan: "nav.commercial",
  };
  const localizedTitle =
    view === "overview"
      ? role === "tenant"
        ? tr("shell.goodMorningTenant")
        : role === "provider"
          ? tr("shell.serviceBusiness")
          : role === "spaceOperator"
            ? "Poblenou MultiSport Club"
            : role === "admin"
              ? tr("shell.trustControls")
              : tr("shell.goodMorningOwner")
      : view === "services" && serviceArea === "work"
        ? tr("universalHome.work")
        : view === "discover"
          ? tr("discover.title")
          : view === "spaces"
            ? tr("space.title")
            : view === "property"
              ? tr("common.properties")
              : view === "spaceVenue"
                ? tr("common.spaces")
                : navKeyByView[view]
                  ? tr(navKeyByView[view]!)
                  : tr("common.overview");
  const localizedEyebrow =
    view === "discover"
      ? tr("discover.eyebrow")
      : view === "spaces"
        ? tr("space.eyebrow")
        : view === "overview"
          ? role === "tenant"
            ? tr("shell.yourKasa")
            : role === "provider"
              ? tr("shell.providerWorkspace")
              : role === "spaceOperator"
                ? tr("shell.venueOperations")
                : role === "admin"
                  ? tr("shell.adminWorkspace")
                  : tr("common.overview")
          : tr(navigationSection(role, view));
  const workspace = {
    landlord: {
      initials: "OM",
      short: `Olivia · ${tr("shell.propertyOwner")}`,
      name: "Olivia Martín",
      label: tr("shell.propertyOwner"),
    },
    tenant: {
      initials: "ID",
      short: `Inês · ${tr("shell.tenant")}`,
      name: "Inês Duarte",
      label: tr("shell.tenant"),
    },
    provider: {
      initials: "AR",
      short: `Volt & Co. · ${tr("shell.serviceProvider")}`,
      name: "Adrián Ruiz",
      label: tr("shell.providerWorkspace"),
    },
    spaceOperator: {
      initials: "OM",
      short: `Olivia · ${tr("shell.spaceOperator")}`,
      name: "Olivia Martín",
      label: `${tr("shell.spaceOperator")} · Poblenou MultiSport Club`,
    },
    admin: {
      initials: "KA",
      short: `Kasa · ${tr("shell.administrator")}`,
      name: "Kasa Trust",
      label: tr("shell.adminWorkspace"),
    },
  }[role];

  const go = useCallback(
    (next: View, query?: string) => {
      setView(canonicalRoleView(role, next));
      if (next === "spaces" && query !== undefined) {
        setSpacesDiscovery((current) =>
          startSpacesDiscoverySearch(current, role, query),
        );
      }
      if (next === "discover" && query !== undefined) {
        setDiscoverState((current) =>
          startDiscoverSearch(current, role, discoveryIntent, query),
        );
      }
      if (query !== undefined) setSearchQuery(query);
      else if (
        next !== view &&
        next !== "property" &&
        !(view === "property" && (next === "discover" || next === "saved"))
      )
        setSearchQuery("");
      setMobileOpen(false);
      setWorkspaceMenuOpen(false);
      window.scrollTo({
        top: 0,
        behavior: reduceMotion || systemReduceMotion ? "instant" : "smooth",
      });
    },
    [role, view, discoveryIntent, reduceMotion, systemReduceMotion],
  );
  const openSpaceVenue = (venue: SpaceVenue) => {
    const canonical = spaceVenues.find((item) => item.id === venue.id);
    if (!canonical) return;
    setSelectedVenueId(canonical.id);
    setSelectedSpaceId(canonical.spaces[0]?.id ?? null);
    go("spaceVenue");
  };
  const openViewings = (id?: string) => {
    if (id)
      setPropertyRequestState((current) =>
        selectViewingRequest(current, role, id),
      );
    go("viewings");
  };
  const openProperty = (
    property: Property,
    returnTo: AppRoute["returnTo"] = "discover",
  ) => {
    setSelectedProperty(property);
    setPropertyReturnTo(returnTo);
    setDiscoveryIntent(property.listingType);
    go("property");
  };
  const openServices = (mode: ServiceLaunchMode, query = "") => {
    setServiceLaunch(mode);
    setServiceEntryRevision((value) => value + 1);
    setServiceArea(mode === "jobs" || mode === "hire" ? "work" : mode);
    go("services", query);
  };
  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        go(
          role === "provider"
            ? "provider"
            : role === "spaceOperator"
              ? "spaceOperator"
              : role === "admin"
                ? "admin"
                : "discover",
        );
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        setWorkspaceMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyboardNavigation);
    return () =>
      window.removeEventListener("keydown", handleKeyboardNavigation);
  }, [role, go]);
  const notify = (message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 3200);
  };
  const openNotification = (notification: KasaNotification) => {
    setNotificationsOpen(false);
    if (notification.serviceMode) openServices(notification.serviceMode);
    else go(notification.destination);
  };
  const selectWorkspace = (next: Role) => {
    const labels: Record<Role, string> = {
      landlord: tr("shell.propertyOwner"),
      tenant: `Inês Duarte · ${tr("shell.tenant")}`,
      provider: `Volt & Co. · ${tr("shell.serviceProvider")}`,
      spaceOperator: tr("shell.spaceOperator"),
      admin: `Kasa Trust · ${tr("shell.administrator")}`,
    };
    setRole(next);
    setView("overview");
    setSearchQuery("");
    setWorkspaceMenuOpen(false);
    setMobileOpen(false);
    setNotificationsOpen(false);
    notify(`${tr("shell.switchedTo")} ${labels[next]}.`);
  };
  const toggleFavourite = (id: number) => {
    setFavourites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };
  const enterDemo = (
    nextRole: Role,
    nextView: View = "overview",
    nextDiscoveryIntent?: "Rent" | "Buy",
  ) => {
    setRole(nextRole);
    setView(canonicalRoleView(nextRole, nextView));
    setSearchQuery("");
    if (nextDiscoveryIntent) setDiscoveryIntent(nextDiscoveryIntent);
    setShowOnboarding(false);
  };

  const openSpaceListing = () => {
    enterDemo("spaceOperator", "spaceOnboarding");
    setMobileOpen(false);
    setWorkspaceMenuOpen(false);
    setNotificationsOpen(false);
    window.scrollTo({
      top: 0,
      behavior: reduceMotion || systemReduceMotion ? "instant" : "smooth",
    });
  };

  const viewingPanel = (
    <PropertyViewingsSummary
      role={role}
      state={propertyRequestState}
      onOpenRequest={openViewings}
      onOpenViewings={() => openViewings()}
      onOpenDecisions={() => {
        setPropertyRequestState((current) =>
          setViewingFilter(
            current,
            role,
            role === "landlord" ? "Pending" : "Proposed",
          ),
        );
        go("viewings");
      }}
    />
  );

  const renderView = () => {
    switch (view) {
      case "overview":
        return role === "landlord" ? (
          <PropertyOverview
            role="landlord"
            rentState={rentRecordState}
            applicationState={applicationState}
            maintenanceState={maintenanceState}
            viewingPanel={viewingPanel}
            go={go}
            onOpenProperty={(property) => openProperty(property, "overview")}
          />
        ) : role === "tenant" ? (
          <UniversalHome
            summary={operationsSummary!}
            workCatalogue={workCatalogue}
            viewingPanel={viewingPanel}
            go={go}
            openServices={openServices}
            setDiscoveryIntent={setDiscoveryIntent}
            initialQuery={searchQuery}
            onAllSearch={setSearchQuery}
            onSearch={(scope, query, intent) => {
              if (scope === "homes") {
                const nextIntent = intent ?? "Rent";
                setDiscoveryIntent(nextIntent);
                setDiscoverState((current) =>
                  startDiscoverSearch(current, role, nextIntent, query),
                );
                go("discover");
              } else if (scope === "spaces") go("spaces", query);
              else openServices(scope === "work" ? "jobs" : "discover", query);
            }}
          />
        ) : role === "provider" ? (
          <ServiceProviderInbox
            role={role}
            state={serviceRequestState}
            setState={setServiceRequestState}
          />
        ) : role === "spaceOperator" ? (
          <SpaceOperatorInbox
            role={role}
            state={bookingsState}
            setState={setBookingsState}
            onBrowseSpaces={() => go("spaces")}
          />
        ) : (
          <AdminConsole notify={notify} />
        );
      case "discover":
        return (
          <Discover
            key={role}
            favourites={favourites}
            toggleFavourite={toggleFavourite}
            savedSearchState={savedSearchState}
            setSavedSearchState={setSavedSearchState}
            onManageSavedSearches={() => go("saved")}
            initialIntent={discoveryIntent}
            query={currentDiscoverSearch.query}
            onQueryChange={(query) =>
              setDiscoverState((current) =>
                updateDiscoverQuery(current, role, discoveryIntent, query),
              )
            }
            onIntentChange={setDiscoveryIntent}
            filters={currentDiscoverSearch.filters}
            onFiltersChange={(update) =>
              setDiscoverState((current) =>
                updateDiscoverState(current, role, discoveryIntent, update),
              )
            }
            onOpen={(property) => openProperty(property, "discover")}
          />
        );
      case "saved":
        return (
          <Saved
            view={savedHomesView(savedHomesViews, role)}
            onViewChange={(update) =>
              setSavedHomesViews((current) =>
                updateSavedHomesView(current, role, update),
              )
            }
            onResetView={() =>
              setSavedHomesViews((current) =>
                resetSavedHomesView(current, role),
              )
            }
            favourites={favourites}
            toggleFavourite={toggleFavourite}
            onDiscover={() => go("discover")}
            savedSearches={
              <SavedSearches
                key={role}
                state={savedSearchState}
                setState={setSavedSearchState}
                onDiscover={() => go("discover")}
                onOpen={(search) => {
                  setDiscoveryIntent(search.intent);
                  setDiscoverState((current) =>
                    applyDiscoverSearch(current, role, search.intent, {
                      query: search.query,
                      filters: copySavedSearchFilters(search.filters),
                    }),
                  );
                  go("discover");
                }}
              />
            }
            onOpen={(property) => openProperty(property, "saved")}
          />
        );
      case "property":
        return (
          <PropertyDetail
            property={selectedProperty}
            ownListing={isWorkspaceListingOwner(role, selectedProperty.id)}
            favourite={favourites.includes(selectedProperty.id)}
            onFavourite={() => toggleFavourite(selectedProperty.id)}
            onBack={() => go(propertyReturnTo)}
            backLabel={
              propertyReturnTo === "portfolio"
                ? `${tr("common.back")} · ${tr(role === "tenant" ? "nav.myHome" : "nav.myProperties")}`
                : propertyReturnTo === "overview"
                  ? `${tr("common.back")} · ${tr("common.overview")}`
                  : propertyReturnTo === "saved"
                    ? `${tr("common.back")} · ${tr("nav.savedHomes")}`
                    : propertyReturnTo === "insights"
                      ? `${tr("common.back")} · ${tr("nav.insights")}`
                      : propertyReturnTo === "viewings"
                        ? `${tr("common.back")} · ${tr("nav.viewings")}`
                        : undefined
            }
            onMessage={() => {
              if (!isWorkspaceListingOwner(role, selectedProperty.id)) {
                setMessageState((current) =>
                  openPropertyConversation(current, selectedProperty),
                );
              }
              go("messages");
            }}
            requestControls={
              ownsProperty(role, selectedProperty.id) ? (
                <div className="property-request-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => openViewings()}
                  >
                    <CalendarDays size={16} />
                    {tr("nav.viewings")}
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => go("applications")}
                  >
                    <FileCheck2 size={16} />
                    {tr("common.applications")}
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => go("maintenance")}
                  >
                    <Wrench size={16} />
                    {tr("common.maintenance")}
                  </button>
                </div>
              ) : (
                <PropertyRequestActions
                  property={selectedProperty}
                  role={role}
                  viewingState={propertyRequestState}
                  setViewingState={setPropertyRequestState}
                  onViewViewings={openViewings}
                  application={tenantApplicationForProperty(
                    applicationState,
                    selectedProperty,
                  )}
                  viewingLabel={tr("discover.requestViewing")}
                  applicationLabel={tr("discover.applyHome")}
                  onSaveApplication={(draft) => {
                    setApplicationState((current) =>
                      submitRentalApplication(
                        current,
                        role,
                        selectedProperty,
                        draft,
                      ),
                    );
                    notify(
                      "Application saved in this tab. Open Applications to inspect it; nothing was sent.",
                    );
                  }}
                  onViewApplications={() => go("applications")}
                />
              )
            }
          />
        );
      case "portfolio":
        return role === "tenant" ? (
          <PropertyOverview
            role="tenant"
            rentState={rentRecordState}
            applicationState={applicationState}
            maintenanceState={maintenanceState}
            viewingPanel={viewingPanel}
            go={go}
            onOpenProperty={(property) => openProperty(property, "portfolio")}
          />
        ) : (
          <PropertyPortfolio
            filters={portfolioFilters}
            setFilters={setPortfolioFilters}
            summary={operationsSummary}
            onOpenProperty={(property) => openProperty(property, "portfolio")}
            role={role}
            go={go}
          >
            <PropertyListingWorkspace
              role={role}
              state={propertyListingState}
              setState={setPropertyListingState}
              onStartSpaceListing={openSpaceListing}
            />
          </PropertyPortfolio>
        );
      case "viewings":
        return role === "tenant" || role === "landlord" ? (
          <ViewingRequests
            role={role}
            state={propertyRequestState}
            setState={setPropertyRequestState}
            onOpenProperty={(id) => {
              const property = properties.find((item) => item.id === id);
              if (property) openProperty(property, "viewings");
            }}
            onBrowseHomes={() => go("discover")}
          />
        ) : null;
      case "applications":
        return (
          <Applications
            role={role}
            state={applicationState}
            setState={setApplicationState}
            onNewApplication={() => {
              setDiscoveryIntent("Rent");
              go("discover");
            }}
          />
        );
      case "messages":
        return (
          <Messages
            state={messageState}
            setState={setMessageState}
            notify={notify}
          />
        );
      case "notifications":
        return (
          <NotificationsView
            state={notificationState}
            setState={setNotificationState}
            role={role}
            onNavigate={openNotification}
            notify={notify}
          />
        );
      case "profile":
        return (
          <ProfileView
            go={go}
            workspace={workspace}
            onSettings={() => setWorkspaceTool("settings")}
            onSwitch={() => {
              setWorkspaceMenuOpen(true);
              setMobileOpen(true);
            }}
          />
        );
      case "rent":
        return (
          <RentRecords
            key={role}
            role={role}
            state={rentRecordState}
            setState={setRentRecordState}
            filters={rentFiltersByRole[role]}
            setFilters={(next) =>
              setRentFiltersByRole((current) => ({
                ...current,
                [role]: typeof next === "function" ? next(current[role]) : next,
              }))
            }
          />
        );
      case "maintenance":
        return (
          <Maintenance
            key={role}
            role={role}
            state={maintenanceState}
            setState={setMaintenanceState}
          />
        );
      case "documents":
        return (
          <Documents
            role={role}
            state={documentState}
            setState={setDocumentState}
          />
        );
      case "services":
        return (
          <Services
            key={serviceEntryRevision}
            role={role}
            serviceState={serviceRequestState}
            setServiceState={setServiceRequestState}
            workState={workState}
            setWorkState={setWorkState}
            notify={notify}
            launchMode={serviceLaunch}
            initialQuery={searchQuery}
            onQueryChange={setSearchQuery}
            onAreaChange={updateServiceArea}
            onOfferServices={() => {
              setRole("provider");
              go("provider");
            }}
          />
        );
      case "spaces":
      case "spaceVenue":
        return (
          <SpacesMarketplace
            key={`${role}:${view === "spaceVenue" ? selectedVenueId : "browse"}`}
            role={role}
            bookingsState={bookingsState}
            setBookingsState={setBookingsState}
            savedVenueIds={workspaceSaved[role].spaceFavourites}
            onToggleSavedVenue={(id) =>
              setWorkspaceSaved((current) =>
                toggleWorkspaceSpaceFavourite(current, role, id),
              )
            }
            filters={currentSpacesFilters}
            onFiltersChange={(update) =>
              setSpacesDiscovery((current) =>
                updateSpacesDiscovery(current, role, update),
              )
            }
            onResetFilters={() =>
              setSpacesDiscovery((current) =>
                resetSpacesDiscoveryFilters(current, role),
              )
            }
            venueId={view === "spaceVenue" ? selectedVenueId : null}
            spaceId={view === "spaceVenue" ? selectedSpaceId : null}
            onOpenVenue={openSpaceVenue}
            onSelectSpace={setSelectedSpaceId}
            onBrowse={() => go("spaces")}
            onGoBookings={() => go("spaceBookings")}
            onListSpace={openSpaceListing}
          />
        );
      case "spaceBookings":
        return (
          <SpaceBookingsView
            role={role}
            state={bookingsState}
            setState={setBookingsState}
            onBrowseSpaces={() => go("spaces")}
          />
        );
      case "spaceOperator":
        return (
          <SpaceOperatorInbox
            role={role}
            state={bookingsState}
            setState={setBookingsState}
            onBrowseSpaces={() => go("spaces")}
          />
        );
      case "spaceOnboarding":
        return (
          <SpaceListingWorkspace
            role={role}
            state={spaceListingState}
            setState={setSpaceListingState}
            onBrowseSpaces={() => go("spaces")}
          />
        );
      case "spacesPlan":
        return <SpacesPlan notify={notify} />;
      case "provider":
        return (
          <ServiceProviderInbox
            role={role}
            state={serviceRequestState}
            setState={setServiceRequestState}
          />
        );
      case "admin":
        return <AdminConsole notify={notify} />;
      case "diagnostics":
        return <Diagnostics />;
      case "insights":
        return operationsSummary ? (
          <PropertyInsights
            summary={operationsSummary}
            go={go}
            onOpenProperty={(property) => openProperty(property, "insights")}
            selectedPeriod={insightsPeriod}
            onPeriodChange={setInsightsPeriod}
            onOpenRentPeriod={(period) => {
              setRentFiltersByRole((current) => ({
                ...current,
                [role]: { ...createRentRecordFilters(), period },
              }));
              go("rent");
            }}
          />
        ) : null;
      case "plan":
        return <Plan notify={notify} />;
    }
  };

  if (showOnboarding)
    return (
      <>
        <OnboardingExperience
          onEnter={enterDemo}
          onOpenSimulator={() => setDeviceSimulatorOpen(true)}
        />
        {deviceSimulatorOpen && (
          <DeviceSimulator
            role="tenant"
            view="discover"
            onClose={() => setDeviceSimulatorOpen(false)}
            labels={{
              title: tr("common.deviceTitle"),
              subtitle: tr("common.deviceSubtitle"),
              compare: tr("common.compare"),
              ios: tr("common.ios"),
              android: tr("common.android"),
              close: tr("common.closeSimulator"),
            }}
          />
        )}
      </>
    );

  return (
    <div
      className={`app-shell ${isDevicePreview ? `device-preview-${previewDevice}` : ""}`}
    >
      <a className="skip-link" href="#main-content">
        {tr("shell.skipToContent")}
      </a>
      <aside
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        id="workspace-navigation"
        ref={sidebarRef}
        inert={isMobileNavigation && !mobileOpen}
        aria-hidden={isMobileNavigation && !mobileOpen ? true : undefined}
        role={isMobileNavigation && mobileOpen ? "dialog" : undefined}
        aria-modal={isMobileNavigation && mobileOpen ? true : undefined}
        aria-label={isMobileNavigation ? tr("shell.mainNavigation") : undefined}
        tabIndex={isMobileNavigation ? -1 : undefined}
      >
        <button
          type="button"
          className="brand"
          onClick={() => go("overview")}
          aria-label="Kasa"
        >
          <span className="brand-mark">
            <Home size={20} />
          </span>
          <strong>Kasa</strong>
        </button>
        <button
          className="mobile-close"
          onClick={closeMobileNavigation}
          aria-label={tr("shell.closeNavigation")}
          data-dialog-initial-focus
        >
          <X />
        </button>
        <button
          className="workspace-switcher"
          onClick={() => setWorkspaceMenuOpen((open) => !open)}
          aria-expanded={workspaceMenuOpen}
        >
          <Avatar initials={workspace.initials} />
          <span>
            <small>
              {role === "landlord" || role === "spaceOperator"
                ? tr("nav.switchWorkspace")
                : tr("shell.demoSwitch")}
            </small>
            <strong>{workspace.short}</strong>
          </span>
          <ChevronDown
            className={workspaceMenuOpen ? "chevron-open" : ""}
            size={16}
          />
        </button>
        {workspaceMenuOpen && (
          <section
            className="workspace-menu"
            aria-label={tr("shell.accountsWorkspaces")}
          >
            <header>
              <Avatar initials="OM" />
              <span>
                <strong>Olivia Martín</strong>
                <small>{tr("nav.oneIdentity")}</small>
              </span>
            </header>
            <span className="workspace-menu-label">
              {tr("nav.myWorkspaces")}
            </span>
            <button
              className={role === "landlord" ? "active" : ""}
              onClick={() => selectWorkspace("landlord")}
            >
              <Building2 size={18} />
              <span>
                <strong>{tr("shell.propertyOwner")}</strong>
                <small>{tr("shell.propertyOwnerNote")}</small>
              </span>
              {role === "landlord" && <Check size={16} />}
            </button>
            <button
              className={role === "spaceOperator" ? "active" : ""}
              onClick={() => selectWorkspace("spaceOperator")}
            >
              <CalendarDays size={18} />
              <span>
                <strong>{tr("shell.spaceOperator")}</strong>
                <small>{tr("shell.spaceOperatorNote")}</small>
              </span>
              {role === "spaceOperator" && <Check size={16} />}
            </button>
            <div className="workspace-shared-note">
              <ShieldCheck size={16} />
              <span>{tr("shell.separateRoles")}</span>
            </div>
            <span className="workspace-menu-label">{tr("nav.otherDemos")}</span>
            <button
              className={role === "tenant" ? "active" : ""}
              onClick={() => selectWorkspace("tenant")}
            >
              <Home size={18} />
              <span>
                <strong>Inês Duarte</strong>
                <small>{tr("shell.tenant")}</small>
              </span>
              {role === "tenant" && <Check size={16} />}
            </button>
            <button
              className={role === "provider" ? "active" : ""}
              onClick={() => selectWorkspace("provider")}
            >
              <Wrench size={18} />
              <span>
                <strong>Volt & Co.</strong>
                <small>{tr("shell.serviceProvider")}</small>
              </span>
              {role === "provider" && <Check size={16} />}
            </button>
            <button
              className={role === "admin" ? "active" : ""}
              onClick={() => selectWorkspace("admin")}
            >
              <ShieldCheck size={18} />
              <span>
                <strong>Kasa Trust</strong>
                <small>{tr("shell.administrator")}</small>
              </span>
              {role === "admin" && <Check size={16} />}
            </button>
          </section>
        )}
        <nav aria-label={tr("shell.mainNavigation")}>
          {visibleNav.map((item, index) => {
            const Icon = item.icon;
            const label = navKeyByView[item.id]
              ? tr(navKeyByView[item.id]!)
              : item.label;
            const section = navigationSection(role, item.id);
            const previousSection =
              index > 0
                ? navigationSection(role, visibleNav[index - 1].id)
                : null;
            const badge =
              item.id === "messages"
                ? messageUnread > 0
                  ? String(messageUnread)
                  : undefined
                : item.id === "applications"
                  ? applicationCount > 0
                    ? String(applicationCount)
                    : undefined
                  : item.id === "viewings"
                    ? viewingDecisionCount > 0
                      ? String(viewingDecisionCount)
                      : undefined
                    : item.id === "maintenance"
                      ? maintenanceCount > 0
                        ? String(maintenanceCount)
                        : undefined
                      : item.badge;
            const active =
              view === item.id ||
              (view === "property" && item.id === propertyReturnTo);
            return (
              <span className="nav-wrap" key={item.id}>
                {section !== previousSection && (
                  <span
                    className={`nav-label ${index > 0 ? "nav-label-spaced" : ""}`}
                  >
                    {tr(section)}
                  </span>
                )}
                <button
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                  onClick={() =>
                    role === "provider" && item.id === "services"
                      ? openServices("hire")
                      : go(item.id)
                  }
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {badge && <i>{badge}</i>}
                </button>
              </span>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={() => {
              closeMobileNavigation();
              setShowOnboarding(true);
            }}
          >
            <Smartphone size={18} /> {tr("nav.appWelcome")}
          </button>
          <button
            onClick={() => {
              closeMobileNavigation();
              setWorkspaceTool("help");
            }}
          >
            <LifeBuoy size={18} /> {tr("nav.help")}
          </button>
          <button
            onClick={() => {
              closeMobileNavigation();
              setWorkspaceTool("settings");
            }}
          >
            <Settings size={18} /> {tr("common.settings")}
          </button>
          <div className="scope-chip">
            <ShieldCheck size={15} /> {tr("nav.nonBrokerage")}
          </div>
        </div>
      </aside>
      {isMobileNavigation && mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-hidden="true"
          tabIndex={-1}
          onClick={closeMobileNavigation}
        />
      )}
      <main className="main-area" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label={tr("shell.openNavigation")}
            aria-expanded={isMobileNavigation && mobileOpen}
            aria-controls="workspace-navigation"
          >
            <Menu />
          </button>
          <div className="page-title">
            <span className="eyebrow">{localizedEyebrow}</span>
            <h1>{localizedTitle}</h1>
          </div>
          <div className="topbar-actions">
            {!isDevicePreview && (
              <button
                className="device-lab-button"
                onClick={() => setDeviceSimulatorOpen(true)}
                aria-label={tr("common.simulator")}
              >
                <Smartphone size={17} />
                <span>{tr("common.simulator")}</span>
              </button>
            )}
            <LanguageSwitcher short={isDevicePreview || isMobileNavigation} />
            <button
              className="top-search"
              onClick={() =>
                role === "provider"
                  ? go("provider")
                  : role === "spaceOperator"
                    ? go("spaceOperator")
                    : role === "admin"
                      ? go("admin")
                      : go("discover")
              }
            >
              <Search size={17} />
              <span>{tr("shell.keyboardSearch")}</span>
              <kbd>⌘ K</kbd>
            </button>
            <NotificationsPopover
              state={notificationState}
              setState={setNotificationState}
              role={role}
              onNavigate={openNotification}
              notify={notify}
              open={notificationsOpen}
              setOpen={setNotificationsOpen}
              onViewAll={() => go("notifications")}
            />
            <button
              className="profile-button"
              onClick={() => {
                setWorkspaceMenuOpen((open) => !open);
                setMobileOpen(true);
              }}
              aria-expanded={workspaceMenuOpen}
            >
              <Avatar initials={workspace.initials} />
              <span>
                <strong>{workspace.name}</strong>
                <small>{workspace.label}</small>
              </span>
              <ChevronDown size={16} />
            </button>
          </div>
        </header>
        <div className="content" key={routeRevision}>
          <Suspense
            fallback={
              <div className="workspace-loading" role="status">
                {tr("common.loadingWorkspace")}
              </div>
            }
          >
            {renderView()}
          </Suspense>
        </div>
      </main>
      {mobileDockItems.length > 0 && (
        <nav
          className="mobile-dock"
          aria-label={tr("shell.mobileNavigation")}
          style={
            { "--dock-items": mobileDockItems.length } as React.CSSProperties
          }
        >
          {mobileDockItems.map((item) => {
            const Icon = item.icon;
            const active = (item.activeViews ?? [item.id]).includes(view);
            return (
              <button
                key={item.id}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                onClick={() =>
                  role === "provider" && item.id === "services"
                    ? openServices("hire")
                    : go(item.id)
                }
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
      {deviceSimulatorOpen && !isDevicePreview && (
        <DeviceSimulator
          role={role}
          view={view}
          onClose={() => setDeviceSimulatorOpen(false)}
          labels={{
            title: tr("common.deviceTitle"),
            subtitle: tr("common.deviceSubtitle"),
            compare: tr("common.compare"),
            ios: tr("common.ios"),
            android: tr("common.android"),
            close: tr("common.closeSimulator"),
          }}
        />
      )}
      {workspaceTool && (
        <Suspense
          fallback={
            <div className="toast" role="status">
              {tr("common.loadingWorkspace")}
            </div>
          }
        >
          <WorkspaceTools
            mode={workspaceTool}
            role={role}
            workspace={workspace}
            reduceMotion={reduceMotion}
            onReduceMotion={(value) => {
              setReduceMotion(value);
              return writePreference("kasa-reduce-motion", String(value));
            }}
            onClose={() => setWorkspaceTool(null)}
            onNavigate={go}
          />
        </Suspense>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
