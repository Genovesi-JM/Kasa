import { lazy, Suspense, useEffect, useMemo, useState } from "react";
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
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
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
  MoreHorizontal,
  Paperclip,
  Plus,
  Repeat2,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  SlidersHorizontal,
  Smartphone,
  Upload,
  Users,
  WalletCards,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  applications,
  conversations,
  maintenance,
  properties,
  providers,
  spaceBookings,
  spaceVenues,
} from "./data";
import {
  displayTranslation,
  languages,
  setLanguage,
  type LanguageCode,
} from "./i18n";
import { DeviceSimulator } from "./components/DeviceSimulator";
import {
  MortgageCardEstimate,
  MortgageEstimator,
} from "./components/MortgageEstimator";
import { isPointInsideZone, type ZonePoint } from "./components/mapGeometry";
import type {
  Application,
  MaintenanceRequest,
  Property,
  Role,
  SpaceUnit,
  SpaceVenue,
  View,
} from "./types";
import { appConfig } from "./platform/config";
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

const KasaMap = lazy(() =>
  import("./components/KasaMap").then((module) => ({
    default: module.KasaMap,
  })),
);

const roleValues: Role[] = [
  "landlord",
  "tenant",
  "provider",
  "spaceOperator",
  "admin",
];

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
    tr: (key: string) => displayTranslation(t(key), english(key), language),
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

const viewTitles: Record<View, { title: string; eyebrow: string }> = {
  overview: { title: "Good morning, Olivia", eyebrow: "Tuesday, 21 August" },
  discover: { title: "Find a place that feels right", eyebrow: "DISCOVER" },
  saved: { title: "Saved for later", eyebrow: "SHORTLIST" },
  property: { title: "Property details", eyebrow: "DISCOVER" },
  portfolio: { title: "Your homes, in one place", eyebrow: "PORTFOLIO" },
  applications: { title: "Applications", eyebrow: "WORKFLOW" },
  messages: { title: "Messages", eyebrow: "INBOX" },
  rent: { title: "Rent records", eyebrow: "RECONCILIATION" },
  maintenance: { title: "Maintenance", eyebrow: "COORDINATION" },
  documents: { title: "Documents", eyebrow: "RECORDS" },
  services: { title: "Trusted local help", eyebrow: "SERVICE DIRECTORY" },
  spaces: {
    title: "Find a space that fits the moment",
    eyebrow: "KASA SPACES · PHASE 2",
  },
  spaceVenue: { title: "Venue details", eyebrow: "KASA SPACES" },
  spaceBookings: { title: "My space bookings", eyebrow: "RESERVATIONS" },
  spaceOperator: {
    title: "Poblenou MultiSport Club",
    eyebrow: "VENUE OPERATIONS",
  },
  spaceOnboarding: { title: "Publish your venue", eyebrow: "VENUE ONBOARDING" },
  spacesPlan: { title: "Kasa Spaces plans", eyebrow: "BUSINESS MODEL" },
  provider: { title: "Service business", eyebrow: "PROVIDER WORKSPACE" },
  admin: { title: "Trust & platform controls", eyebrow: "ADMIN" },
  diagnostics: { title: "System status", eyebrow: "FUNCTION CHECK" },
  insights: { title: "Portfolio insights", eyebrow: "ANALYTICS" },
  plan: { title: "Commercial model", eyebrow: "AGREED DIRECTION" },
};
const viewValues = Object.keys(viewTitles) as View[];

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
    roles: ["landlord", "tenant"],
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

function ProgressRing({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress-ring"
      style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}
    >
      <div>
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function LandlordOverview({
  go,
  notify,
}: {
  go: (view: View) => void;
  notify: (message: string) => void;
}) {
  const { tr } = useKasaI18n();
  return (
    <div className="page-stack">
      <section className="hero-panel landlord-hero">
        <div>
          <span className="eyebrow light">
            {tr("dashboard.portfolioGlance")}
          </span>
          <h2>{tr("dashboard.smoothTitle")}</h2>
          <p>{tr("dashboard.smoothNote")}</p>
          <button
            className="button button-cream"
            onClick={() => go("portfolio")}
          >
            {tr("dashboard.viewProperties")} <ArrowRight size={17} />
          </button>
        </div>
        <div className="hero-orbit">
          <ProgressRing value={96} label={tr("dashboard.occupancy")} />
          <span className="orbit-tag orbit-one">
            <Check size={14} /> {tr("dashboard.rentChecked")}
          </span>
          <span className="orbit-tag orbit-two">
            <Users size={14} /> {tr("dashboard.fourHomes")}
          </span>
        </div>
      </section>

      <section className="metrics-grid">
        <Metric
          label={tr("dashboard.monthlyRent")}
          value="€6,730"
          note={tr("dashboard.recordedMonth")}
          icon={CircleDollarSign}
        />
        <Metric
          label={tr("dashboard.occupancy")}
          value="96%"
          note={tr("dashboard.upFromJuly")}
          icon={Home}
          tone="blue"
        />
        <Metric
          label={tr("dashboard.openApplications")}
          value="3"
          note={tr("dashboard.readyReview")}
          icon={Users}
          tone="lilac"
        />
        <Metric
          label={tr("common.maintenance")}
          value="1"
          note={tr("dashboard.newRequestToday")}
          icon={Wrench}
          tone="sun"
        />
      </section>

      <div className="two-column wide-left">
        <section className="card padded">
          <SectionHeading
            title={tr("dashboard.applicationsReview")}
            action={tr("common.viewAll")}
            onAction={() => go("applications")}
          />
          <div className="list-stack">
            {applications.slice(0, 3).map((application) => (
              <button
                className="application-row"
                key={application.id}
                onClick={() => go("applications")}
              >
                <Avatar initials={application.avatar} />
                <span className="row-copy">
                  <strong>{application.applicant}</strong>
                  <small>{application.property}</small>
                </span>
                <span className="match-score">{application.score}%</span>
                <StatusPill
                  tone={
                    application.status === "Approved"
                      ? "mint"
                      : application.status === "Documents"
                        ? "amber"
                        : "blue"
                  }
                >
                  {application.status === "Approved"
                    ? tr("dashboard.approved")
                    : application.status === "Documents"
                      ? tr("common.documents")
                      : tr("dashboard.review")}
                </StatusPill>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>

        <section className="card padded schedule-card">
          <SectionHeading title={tr("dashboard.comingUp")} />
          <div className="timeline">
            <div className="timeline-item active">
              <span>22</span>
              <div>
                <strong>{tr("dashboard.acVisit")}</strong>
                <small>Quiet Gràcia loft · 14:30</small>
              </div>
            </div>
            <div className="timeline-item">
              <span>25</span>
              <div>
                <strong>{tr("dashboard.leaseDocumentsDue")}</strong>
                <small>Sunlit Eixample home</small>
              </div>
            </div>
            <div className="timeline-item">
              <span>01</span>
              <div>
                <strong>{tr("dashboard.septemberReminders")}</strong>
                <small>{tr("dashboard.scheduledAutomatically")}</small>
              </div>
            </div>
          </div>
          <button
            className="soft-button"
            onClick={() =>
              notify("Calendar view is ready for the connected-calendar phase.")
            }
          >
            <CalendarDays size={16} /> {tr("dashboard.openCalendar")}
          </button>
        </section>
      </div>

      <section className="card padded">
        <SectionHeading
          title={tr("dashboard.rentReconciliation")}
          action={tr("dashboard.openRecords")}
          onAction={() => go("rent")}
        />
        <div className="rent-summary">
          <div className="rent-progress-copy">
            <strong>{tr("dashboard.august")}</strong>
            <span>{tr("dashboard.fourTransfers")}</span>
          </div>
          <div className="long-progress">
            <i style={{ width: "100%" }} />
          </div>
          <strong className="rent-total">
            €6,730 <CheckCircle2 size={18} />
          </strong>
        </div>
        <div className="scope-note">
          <ShieldCheck size={17} />
          <span>{tr("dashboard.rentScope")}</span>
        </div>
      </section>
    </div>
  );
}

function TenantOverview({
  go,
  notify,
}: {
  go: (view: View) => void;
  notify: (message: string) => void;
}) {
  const { tr } = useKasaI18n();
  return (
    <div className="page-stack">
      <section className="hero-panel tenant-hero">
        <div>
          <span className="eyebrow light">{tr("dashboard.tenantEyebrow")}</span>
          <h2>{tr("dashboard.tenantMorning")}</h2>
          <p>{tr("dashboard.tenantNote")}</p>
          <button className="button button-cream" onClick={() => go("rent")}>
            {tr("dashboard.viewRentRecord")} <ArrowRight size={17} />
          </button>
        </div>
        <img
          src={properties[0].image}
          alt="Sunlit Eixample home"
          className="tenant-home-image"
        />
      </section>
      <section className="metrics-grid tenant-metrics">
        <Metric
          label={tr("dashboard.nextRent")}
          value="€1,850"
          note={tr("dashboard.dueSeptember")}
          icon={CalendarDays}
        />
        <Metric
          label={tr("dashboard.application")}
          value={tr("dashboard.approved")}
          note={tr("dashboard.leaseDocumentsReady")}
          icon={FileCheck2}
          tone="blue"
        />
        <Metric
          label={tr("common.maintenance")}
          value={tr("dashboard.received")}
          note={tr("dashboard.kitchenTapToday")}
          icon={Wrench}
          tone="sun"
        />
      </section>
      <section className="kasa-entry-grid">
        <button onClick={() => go("discover")}>
          <span className="hub-icon mint">
            <Home />
          </span>
          <span>
            <strong>{tr("common.properties")}</strong>
            <small>{tr("dashboard.findNextHome")}</small>
          </span>
          <ChevronRight />
        </button>
        <button onClick={() => go("services")}>
          <span className="hub-icon lilac">
            <Wrench />
          </span>
          <span>
            <strong>{tr("common.services")}</strong>
            <small>{tr("dashboard.trustedHomeHelp")}</small>
          </span>
          <ChevronRight />
        </button>
        <button onClick={() => go("spaces")}>
          <span className="hub-icon gold">
            <CalendarDays />
          </span>
          <span>
            <strong>Kasa Spaces</strong>
            <small>{tr("dashboard.sportsEventsNote")}</small>
          </span>
          <StatusPill tone="amber">Phase 2</StatusPill>
        </button>
      </section>
      <div className="two-column">
        <section className="card padded home-card">
          <SectionHeading
            title={tr("dashboard.tenantEyebrow")}
            action={tr("dashboard.propertyDetails")}
            onAction={() => notify("Property record opened.")}
          />
          <img src={properties[0].image} alt="Sunlit Eixample home" />
          <div className="home-card-copy">
            <div>
              <h3>{properties[0].title}</h3>
              <p>{properties[0].address}</p>
            </div>
            <StatusPill tone="mint">{tr("dashboard.activeLease")}</StatusPill>
          </div>
          <div className="lease-facts">
            <span>
              <small>{tr("dashboard.leaseStarted")}</small>
              <strong>1 July 2026</strong>
            </span>
            <span>
              <small>{tr("dashboard.renews")}</small>
              <strong>30 June 2027</strong>
            </span>
            <span>
              <small>{tr("dashboard.landlord")}</small>
              <strong>Olivia Martín</strong>
            </span>
          </div>
        </section>
        <section className="card padded next-steps">
          <SectionHeading title={tr("dashboard.nextSteps")} />
          <button onClick={() => go("documents")}>
            <span className="check-circle done">
              <Check size={16} />
            </span>
            <span>
              <strong>{tr("dashboard.identityDocuments")}</strong>
              <small>{tr("dashboard.verifiedJune")}</small>
            </span>
            <ChevronRight size={17} />
          </button>
          <button onClick={() => go("documents")}>
            <span className="check-circle done">
              <Check size={16} />
            </span>
            <span>
              <strong>{tr("dashboard.leaseSigned")}</strong>
              <small>{tr("dashboard.completedJune")}</small>
            </span>
            <ChevronRight size={17} />
          </button>
          <button onClick={() => go("maintenance")}>
            <span className="check-circle">
              <Wrench size={16} />
            </span>
            <span>
              <strong>{tr("dashboard.followRepair")}</strong>
              <small>{tr("dashboard.awaitingProvider")}</small>
            </span>
            <ChevronRight size={17} />
          </button>
          <button onClick={() => go("rent")}>
            <span className="check-circle">
              <CalendarDays size={16} />
            </span>
            <span>
              <strong>{tr("dashboard.septemberRent")}</strong>
              <small>{tr("dashboard.dueElevenDays")}</small>
            </span>
            <ChevronRight size={17} />
          </button>
        </section>
      </div>
      <section className="card padded recommendation-strip">
        <div className="recommendation-icon">
          <Sparkles size={23} />
        </div>
        <div>
          <strong>{tr("dashboard.nextHomeQuestion")}</strong>
          <p>{tr("dashboard.foundMatches")}</p>
        </div>
        <ActionButton secondary onClick={() => go("discover")}>
          {tr("dashboard.browseMatches")}
        </ActionButton>
      </section>
    </div>
  );
}

function Discover({
  favourites,
  toggleFavourite,
  notify,
  onOpen,
  initialIntent,
}: {
  favourites: number[];
  toggleFavourite: (id: number) => void;
  notify: (message: string) => void;
  onOpen: (property: Property) => void;
  initialIntent: "Rent" | "Buy";
}) {
  const { tr } = useKasaI18n();
  const [catalogProperties, setCatalogProperties] = useState(properties);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("Any price");
  const [minPrice, setMinPrice] = useState("0");
  const [intent, setIntent] = useState<"Rent" | "Buy">(initialIntent);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [propertyType, setPropertyType] = useState("All types");
  const [bedrooms, setBedrooms] = useState("Any bedrooms");
  const [bathrooms, setBathrooms] = useState("Any bathrooms");
  const [furnishing, setFurnishing] = useState("Any furnishing");
  const [petPolicy, setPetPolicy] = useState("Any pet policy");
  const [minSize, setMinSize] = useState("0");
  const [availability, setAvailability] = useState("Any availability");
  const [features, setFeatures] = useState<string[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sort, setSort] = useState("Recommended");
  const [drawnZone, setDrawnZone] = useState<ZonePoint[]>([]);
  const featureOptions = [
    ["Outdoor space", tr("discover.terrace")],
    ["Parking", tr("discover.parking")],
    ["Lift", tr("discover.lift")],
    ["Air conditioning", tr("discover.air")],
    ["Accessible entry", tr("discover.accessible")],
    ["Bills included", tr("discover.bills")],
  ];
  const toggleFeature = (feature: string) =>
    setFeatures((current) =>
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
      const matchQuery =
        `${property.title} ${property.address} ${property.city} ${property.neighbourhood} ${property.amenities.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase());
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
    setMaxPrice("Any price");
    setMinPrice("0");
    setPropertyType("All types");
    setBedrooms("Any bedrooms");
    setBathrooms("Any bathrooms");
    setFurnishing("Any furnishing");
    setPetPolicy("Any pet policy");
    setMinSize("0");
    setAvailability("Any availability");
    setFeatures([]);
    setVerifiedOnly(false);
    setSort("Recommended");
    setDrawnZone([]);
  };
  const chooseIntent = (next: "Rent" | "Buy") => {
    setIntent(next);
    setMaxPrice("Any price");
    setMinPrice("0");
    setSort("Recommended");
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
          onChange={(event) => setMaxPrice(event.target.value)}
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
          onClick={() => setVerifiedOnly((value) => !value)}
          aria-pressed={verifiedOnly}
        >
          <BadgeCheck size={18} /> {tr("discover.checkedOnly")}
        </button>
      </section>
      <FilterToolbar activeCount={activeFilters} onReset={resetFilters}>
        <select
          aria-label={tr("discover.propertyType")}
          value={propertyType}
          onChange={(event) => setPropertyType(event.target.value)}
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
          onChange={(event) => setBedrooms(event.target.value)}
        >
          <option value="Any bedrooms">{tr("discover.anyBeds")}</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
        </select>
        <select
          aria-label={tr("discover.petPolicyLabel")}
          value={petPolicy}
          onChange={(event) => setPetPolicy(event.target.value)}
        >
          <option value="Any pet policy">{tr("discover.anyPets")}</option>
          <option value="Pets allowed">{tr("discover.petsAllowed")}</option>
          <option value="No pets">{tr("discover.noPets")}</option>
        </select>
        <button
          className={`more-filter-button ${showMoreFilters ? "active" : ""}`}
          onClick={() => setShowMoreFilters((value) => !value)}
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
                onChange={(event) => setMinPrice(event.target.value)}
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
                onChange={(event) => setBathrooms(event.target.value)}
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
                onChange={(event) => setMinSize(event.target.value)}
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
                onChange={(event) => setFurnishing(event.target.value)}
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
                onChange={(event) => setAvailability(event.target.value)}
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
                onChange={(event) => setSort(event.target.value)}
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
          <button
            className="soft-button"
            onClick={() => notify(tr("discover.searchSaved"))}
          >
            <Bell size={15} /> {tr("discover.saveSearch")}
          </button>
          <div className="view-toggle">
            <button
              className={viewMode === "list" ? "active" : ""}
              onClick={() => setViewMode("list")}
            >
              <LayoutDashboard size={15} /> {tr("common.list")}
            </button>
            <button
              className={viewMode === "map" ? "active" : ""}
              onClick={() => setViewMode("map")}
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
              onZoneChange={setDrawnZone}
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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="modal-scrim"
        onClick={onClose}
        aria-label={tr("common.close")}
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
            autoFocus
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
  onMessage,
  notify,
}: {
  property: Property;
  favourite: boolean;
  onFavourite: () => void;
  onBack: () => void;
  onMessage: () => void;
  notify: (message: string) => void;
}) {
  const { tr } = useKasaI18n();
  const [flow, setFlow] = useState<"viewing" | "application" | null>(null);
  const finish = () => {
    notify(
      flow === "viewing"
        ? "Viewing request sent directly to the listing party."
        : "Application submitted to the listing party for review.",
    );
    setFlow(null);
  };
  return (
    <div className="page-stack property-detail-page">
      <div className="detail-toolbar">
        <button className="text-button" onClick={onBack}>
          ← {tr("discover.backResults")}
        </button>
        <div>
          <button className="soft-button" onClick={onFavourite}>
            <Heart size={16} fill={favourite ? "currentColor" : "none"} />{" "}
            {favourite ? tr("common.saved") : tr("common.save")}
          </button>
          <button
            className="soft-button"
            onClick={() => notify("Share link copied.")}
          >
            {tr("discover.share")}
          </button>
        </div>
      </div>
      <section className="property-gallery">
        <img src={property.gallery[0]} alt={property.title} />
        <img src={property.gallery[1]} alt={`${property.title} interior`} />
        <div className="gallery-last">
          <img src={property.gallery[2]} alt={`${property.title} detail`} />
          <button onClick={() => notify("Full photo gallery opened.")}>
            {tr("discover.viewPhotos")}
          </button>
        </div>
      </section>
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
            <MessageCircle size={16} /> {tr("discover.startPrivateChat")}
          </button>
          <ActionButton
            secondary
            onClick={() => setFlow("viewing")}
            icon={CalendarDays}
          >
            {tr("discover.requestViewing")}
          </ActionButton>
          {property.listingType === "Rent" && (
            <ActionButton
              secondary
              onClick={() => setFlow("application")}
              icon={FileCheck2}
            >
              {tr("discover.applyHome")}
            </ActionButton>
          )}
          <div className="direct-note">
            <ShieldCheck size={16} />
            <p>{tr("discover.directContract")}</p>
          </div>
        </aside>
      </div>
      {flow && (
        <Modal
          title={
            flow === "viewing"
              ? tr("discover.requestViewing")
              : "Reusable tenant application"
          }
          onClose={() => setFlow(null)}
        >
          <div className="modal-body">
            {flow === "viewing" ? (
              <>
                <p>
                  Choose a preferred time. The listing party can approve or
                  suggest another time directly.
                </p>
                <div className="form-grid">
                  <label>
                    Preferred date
                    <input type="date" defaultValue="2026-08-25" />
                  </label>
                  <label>
                    Preferred time
                    <select defaultValue="18:00">
                      <option>10:00</option>
                      <option>14:00</option>
                      <option>18:00</option>
                    </select>
                  </label>
                  <label className="full">
                    Message
                    <textarea defaultValue="Hi, I would like to view this property. Please confirm whether this time works for you." />
                  </label>
                </div>
              </>
            ) : (
              <>
                <p>
                  Your verified profile saves time. You choose exactly which
                  information is shared with this listing party.
                </p>
                <div className="application-progress">
                  <i style={{ width: "84%" }} />
                  <span>Profile 84% complete</span>
                </div>
                <div className="form-grid">
                  <label>
                    Move-in date
                    <input type="date" defaultValue="2026-09-01" />
                  </label>
                  <label>
                    Household
                    <select>
                      <option>1 person</option>
                      <option>2 people</option>
                      <option>Family</option>
                    </select>
                  </label>
                  <label className="check-label full">
                    <input type="checkbox" defaultChecked /> Share identity and
                    income verification records
                  </label>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setFlow(null)}
              >
                Cancel
              </button>
              <button className="button" onClick={finish}>
                {flow === "viewing" ? "Send request" : "Submit application"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Saved({
  favourites,
  toggleFavourite,
  onOpen,
  notify,
}: {
  favourites: number[];
  toggleFavourite: (id: number) => void;
  onOpen: (property: Property) => void;
  notify: (message: string) => void;
}) {
  const [intent, setIntent] = useState("All");
  const [sort, setSort] = useState("Recently saved");
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
      <section className="saved-search card padded">
        <div className="saved-search-icon">
          <Bell size={22} />
        </div>
        <div>
          <span className="eyebrow">SAVED SEARCH</span>
          <h2>Barcelona · up to €2,000 · 1+ bedroom</h2>
          <p>Instant alerts are on · 3 new matches this week</p>
        </div>
        <button
          className="soft-button"
          onClick={() => notify("Saved-search settings opened.")}
        >
          <Settings size={16} /> Edit alert
        </button>
      </section>
      <FilterToolbar
        activeCount={intent === "All" ? 0 : 1}
        onReset={() => {
          setIntent("All");
          setSort("Recently saved");
        }}
      >
        <select
          aria-label="Saved listing type"
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
        >
          <option>All</option>
          <option>Rent</option>
          <option>Buy</option>
        </select>
        <select
          aria-label="Sort saved homes"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option>Recently saved</option>
          <option>Newest listing</option>
          <option>Price: low to high</option>
          <option>Price: high to low</option>
        </select>
      </FilterToolbar>
      <SectionHeading
        title={`${saved.length} saved homes`}
        action="Discover more"
        onAction={() =>
          notify("Open Discover from the navigation to see every match.")
        }
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
          <h3>No saved homes match</h3>
          <p>Reset the filter or save more properties from discovery.</p>
        </div>
      )}
    </div>
  );
}

function Portfolio({
  role,
  notify,
  go,
  onStartSpaceListing,
}: {
  role: Role;
  notify: (message: string) => void;
  go: (view: View) => void;
  onStartSpaceListing: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [choosingListing, setChoosingListing] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [listingUse, setListingUse] = useState<"Long-term rent" | "Sale">(
    "Long-term rent",
  );
  const [portfolioStatus, setPortfolioStatus] = useState("All homes");
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [portfolioSort, setPortfolioSort] = useState("Recently updated");
  const closeAdd = () => {
    setAdding(false);
    setAddStep(1);
  };
  const startPropertyListing = (use: "Long-term rent" | "Sale") => {
    setListingUse(use);
    setChoosingListing(false);
    setAdding(true);
  };

  if (role === "tenant")
    return (
      <div className="page-stack tenant-home-page">
        <section className="my-home-hero card">
          <img src={properties[0].image} alt={properties[0].title} />
          <div>
            <span className="eyebrow light">YOUR CURRENT HOME</span>
            <StatusPill tone="mint">
              <BadgeCheck size={13} /> Active tenancy
            </StatusPill>
            <h2>{properties[0].title}</h2>
            <p>
              <MapPin size={15} /> {properties[0].address}
            </p>
            <div className="my-home-actions">
              <ActionButton icon={WalletCards} onClick={() => go("rent")}>
                Bank transfer details
              </ActionButton>
              <ActionButton
                secondary
                icon={Wrench}
                onClick={() => go("maintenance")}
              >
                Report maintenance
              </ActionButton>
            </div>
          </div>
        </section>
        <section className="my-home-grid">
          <article className="card padded home-record">
            <SectionHeading title="Tenancy details" />
            <div className="home-record-list">
              <span>
                <small>Monthly rent</small>
                <strong>{formatEuro(properties[0].price)}</strong>
              </span>
              <span>
                <small>Lease started</small>
                <strong>1 July 2026</strong>
              </span>
              <span>
                <small>Renews</small>
                <strong>30 June 2027</strong>
              </span>
              <span>
                <small>Listing party</small>
                <strong>Olivia Martín</strong>
              </span>
            </div>
            <div className="scope-note">
              <ShieldCheck size={17} />
              <span>
                Your rent goes directly to your landlord. Kasa only records
                proof and confirmation.
              </span>
            </div>
          </article>
          <article className="card padded home-hub">
            <SectionHeading title="Everything for this home" />
            <button onClick={() => go("rent")}>
              <span className="hub-icon mint">
                <WalletCards />
              </span>
              <div>
                <strong>Rent & payments</strong>
                <small>Instructions, proof and history</small>
              </div>
              <ChevronRight />
            </button>
            <button onClick={() => go("documents")}>
              <span className="hub-icon blue">
                <FileText />
              </span>
              <div>
                <strong>Documents</strong>
                <small>Lease, receipts and notices</small>
              </div>
              <ChevronRight />
            </button>
            <button onClick={() => go("maintenance")}>
              <span className="hub-icon gold">
                <Wrench />
              </span>
              <div>
                <strong>Maintenance</strong>
                <small>Track the kitchen tap request</small>
              </div>
              <ChevronRight />
            </button>
            <button onClick={() => go("messages")}>
              <span className="hub-icon lilac">
                <MessageCircle />
              </span>
              <div>
                <strong>Messages</strong>
                <small>Talk directly with your landlord</small>
              </div>
              <ChevronRight />
            </button>
          </article>
        </section>
        <section className="card padded recommendation-strip">
          <div className="recommendation-icon">
            <Store size={23} />
          </div>
          <div>
            <strong>Services linked to your home</strong>
            <p>
              Book verified local cleaning, plumbing, electrical, AC and
              handyman help.
            </p>
          </div>
          <ActionButton secondary onClick={() => go("services")}>
            Browse services
          </ActionButton>
        </section>
      </div>
    );

  const operationalProperties = properties.filter(
    (property) => property.listingType === "Rent",
  );
  const visiblePortfolio = operationalProperties
    .filter((property) => {
      const status = property.id === 4 ? "Available" : "Occupied";
      return (
        (portfolioStatus === "All homes" || status === portfolioStatus) &&
        `${property.title} ${property.address}`
          .toLowerCase()
          .includes(portfolioQuery.toLowerCase())
      );
    })
    .sort((a, b) =>
      portfolioSort === "Property name"
        ? a.title.localeCompare(b.title)
        : portfolioSort === "Rent: high to low"
          ? b.price - a.price
          : portfolioSort === "Open issues first"
            ? Number(a.id !== 1) - Number(b.id !== 1)
            : b.id - a.id,
    );
  return (
    <div className="page-stack">
      <div className="page-actions">
        <div className="segment">
          {["All homes", "Occupied", "Available"].map((status) => (
            <button
              key={status}
              className={portfolioStatus === status ? "active" : ""}
              onClick={() => setPortfolioStatus(status)}
            >
              {status}{" "}
              <span>
                {status === "All homes"
                  ? operationalProperties.length
                  : status === "Occupied"
                    ? operationalProperties.filter(
                        (property) => property.id !== 4,
                      ).length
                    : operationalProperties.filter(
                        (property) => property.id === 4,
                      ).length}
              </span>
            </button>
          ))}
        </div>
        <ActionButton icon={Plus} onClick={() => setChoosingListing(true)}>
          Advertise property or space
        </ActionButton>
      </div>
      <FilterToolbar
        activeCount={
          Number(portfolioStatus !== "All homes") +
          Number(Boolean(portfolioQuery))
        }
        onReset={() => {
          setPortfolioStatus("All homes");
          setPortfolioQuery("");
          setPortfolioSort("Recently updated");
        }}
      >
        <label className="filter-search">
          <Search size={15} />
          <input
            aria-label="Search portfolio"
            placeholder="Search property"
            value={portfolioQuery}
            onChange={(event) => setPortfolioQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Sort portfolio"
          value={portfolioSort}
          onChange={(event) => setPortfolioSort(event.target.value)}
        >
          <option>Recently updated</option>
          <option>Open issues first</option>
          <option>Rent: high to low</option>
          <option>Property name</option>
        </select>
      </FilterToolbar>
      <section className="portfolio-list">
        {visiblePortfolio.map((property) => (
          <article className="portfolio-row" key={property.id}>
            <img src={property.image} alt={property.title} />
            <div className="portfolio-main">
              <div>
                <h3>{property.title}</h3>
                <p>{property.address}</p>
              </div>
              <div className="occupancy-line">
                <span>{property.id === 4 ? "Available" : "Occupied"}</span>
                <small>
                  {property.id === 4
                    ? "Accepting applications"
                    : `Tenant · ${{ 1: "Inês Duarte", 2: "Leo Bernard", 3: "Maya Chen" }[property.id as 1 | 2 | 3]}`}
                </small>
              </div>
            </div>
            <div className="portfolio-stat">
              <small>Monthly rent</small>
              <strong>{formatEuro(property.price)}</strong>
            </div>
            <div className="portfolio-stat">
              <small>Next action</small>
              <strong>
                {property.id === 4
                  ? "Review listing"
                  : property.id === 1
                    ? "Repair request"
                    : "All clear"}
              </strong>
            </div>
            <StatusPill tone={property.id === 4 ? "amber" : "mint"}>
              {property.id === 4 ? "Published" : "Rent checked"}
            </StatusPill>
            <button
              className="icon-button"
              onClick={() => go(property.id === 4 ? "applications" : "rent")}
              aria-label={`Open ${property.title}`}
            >
              <ChevronRight size={19} />
            </button>
          </article>
        ))}
      </section>
      {choosingListing && (
        <Modal
          title="What would you like to advertise?"
          onClose={() => setChoosingListing(false)}
        >
          <div className="modal-body unified-listing-chooser">
            <p>
              Properties and spaces share one publishing entry. Kasa opens the
              right workflow after you choose how the asset will be used.
            </p>
            <div>
              <button onClick={() => startPropertyListing("Long-term rent")}>
                <span className="hub-icon mint">
                  <Home />
                </span>
                <span>
                  <strong>Long-term rental property</strong>
                  <small>Residential use measured in months or years</small>
                </span>
                <ChevronRight />
              </button>
              <button onClick={() => startPropertyListing("Sale")}>
                <span className="hub-icon blue">
                  <Building2 />
                </span>
                <span>
                  <strong>Property for sale</strong>
                  <small>Publish an owner-controlled sale listing</small>
                </span>
                <ChevronRight />
              </button>
              <button
                onClick={() => {
                  setChoosingListing(false);
                  onStartSpaceListing();
                }}
              >
                <span className="hub-icon gold">
                  <CalendarDays />
                </span>
                <span>
                  <strong>Reservable space</strong>
                  <small>
                    Sports or event use by hour, session or day—no overnight
                    accommodation
                  </small>
                </span>
                <ChevronRight />
              </button>
            </div>
            <div className="scope-note">
              <ShieldCheck size={16} />
              <span>
                One asset account and publishing entry; different operational
                tools after publication.
              </span>
            </div>
          </div>
        </Modal>
      )}
      {adding && (
        <Modal
          title={
            listingUse === "Sale"
              ? "Advertise a property for sale"
              : "Advertise a long-term rental"
          }
          onClose={closeAdd}
        >
          <div className="modal-body property-wizard">
            <div className="wizard-progress">
              <span className={addStep >= 1 ? "active" : ""}>
                <i>1</i>Basics
              </span>
              <b />
              <span className={addStep >= 2 ? "active" : ""}>
                <i>2</i>Details
              </span>
              <b />
              <span className={addStep >= 3 ? "active" : ""}>
                <i>3</i>Review
              </span>
            </div>
            {addStep === 1 && (
              <>
                <button
                  className="photo-drop"
                  onClick={() =>
                    notify("Photo picker opened for the property record.")
                  }
                >
                  <Camera size={27} />
                  <strong>Add property photos</strong>
                  <small>Upload up to 20 images · JPG or PNG</small>
                </button>
                <div className="form-grid">
                  <label className="full">
                    Property name
                    <input defaultValue="Marina light apartment" />
                  </label>
                  <label>
                    Property type
                    <select defaultValue="Apartment">
                      <option>Apartment</option>
                      <option>House</option>
                      <option>Studio</option>
                      <option>Room</option>
                    </select>
                  </label>
                  <label>
                    Listing use
                    <select
                      value={listingUse}
                      onChange={(event) =>
                        setListingUse(
                          event.target.value as "Long-term rent" | "Sale",
                        )
                      }
                    >
                      <option>Long-term rent</option>
                      <option>Sale</option>
                    </select>
                  </label>
                  <label className="full">
                    Address
                    <input defaultValue="Carrer de la Marina, Barcelona" />
                  </label>
                </div>
              </>
            )}
            {addStep === 2 && (
              <div className="form-grid">
                <label>
                  Bedrooms
                  <input type="number" defaultValue="2" />
                </label>
                <label>
                  Bathrooms
                  <input type="number" defaultValue="2" />
                </label>
                <label>
                  Size (m²)
                  <input type="number" defaultValue="88" />
                </label>
                <label>
                  {listingUse === "Sale" ? "Asking price" : "Monthly rent"}
                  <input
                    type="number"
                    defaultValue={listingUse === "Sale" ? "450000" : "1750"}
                  />
                </label>
                <label>
                  Available from
                  <input type="date" defaultValue="2026-09-01" />
                </label>
                <label>
                  Furnishing
                  <select>
                    <option>Furnished</option>
                    <option>Unfurnished</option>
                    <option>Part furnished</option>
                  </select>
                </label>
                <label className="full">
                  Description
                  <textarea defaultValue="Bright two-bedroom home with balcony, lift and excellent transport connections." />
                </label>
              </div>
            )}
            {addStep === 3 && (
              <div className="wizard-review">
                <div className="review-image">
                  <img src={properties[0].image} alt="Property preview" />
                  <StatusPill tone="amber">Draft</StatusPill>
                </div>
                <div>
                  <span className="eyebrow">READY FOR REVIEW</span>
                  <h3>Marina light apartment</h3>
                  <p>Carrer de la Marina, Barcelona</p>
                  <div className="review-facts">
                    <span>
                      <strong>2</strong> bedrooms
                    </span>
                    <span>
                      <strong>88</strong> m²
                    </span>
                    <span>
                      <strong>
                        {listingUse === "Sale" ? "€450,000" : "€1,750"}
                      </strong>{" "}
                      {listingUse === "Sale" ? "asking price" : "/ month"}
                    </span>
                  </div>
                </div>
                <div className="scope-note">
                  <ShieldCheck size={16} />
                  <span>
                    You publish and manage the listing directly. Kasa may
                    moderate information for safety, but does not become your
                    agent or negotiate on your behalf.
                  </span>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={
                  addStep === 1
                    ? closeAdd
                    : () => setAddStep((step) => step - 1)
                }
              >
                {addStep === 1 ? "Cancel" : "Back"}
              </button>
              <button
                className="button"
                onClick={
                  addStep === 3
                    ? () => {
                        notify(
                          "Property submitted to the listing moderation queue.",
                        );
                        closeAdd();
                      }
                    : () => setAddStep((step) => step + 1)
                }
              >
                {addStep === 3 ? "Submit for review" : "Continue"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Applications({
  role,
  notify,
}: {
  role: Role;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState("All");
  const [propertyFilter, setPropertyFilter] = useState("All properties");
  const [completeness, setCompleteness] = useState("Any completeness");
  const [applicationSort, setApplicationSort] = useState("Newest submitted");
  const baseApplications =
    role === "tenant"
      ? applications.filter((item) => item.applicant === "Inês Duarte")
      : applications;
  const visible = baseApplications
    .filter(
      (item) =>
        (tab === "All" || item.status === tab) &&
        (propertyFilter === "All properties" ||
          item.property === propertyFilter) &&
        (completeness === "Any completeness" ||
          item.score >= Number(completeness)),
    )
    .sort((a, b) =>
      applicationSort === "Oldest submitted"
        ? b.id - a.id
        : applicationSort === "Most complete"
          ? b.score - a.score
          : applicationSort === "Action required first"
            ? Number(!["Review", "Documents"].includes(a.status)) -
              Number(!["Review", "Documents"].includes(b.status))
            : a.id - b.id,
    );
  const statuses = ["All", "Review", "Documents", "Approved", "Draft"];
  const displayStatus = (status: Application["status"]) =>
    status === "Review"
      ? "Under review"
      : status === "Documents"
        ? "Documents requested"
        : status;
  const activeFilters =
    Number(tab !== "All") +
    Number(propertyFilter !== "All properties") +
    Number(completeness !== "Any completeness");
  return (
    <div className="page-stack">
      <div className="page-actions">
        <div className="segment compact">
          {statuses.map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              {item === "Review"
                ? "Review"
                : item === "Documents"
                  ? "Documents"
                  : item}
            </button>
          ))}
        </div>
        {role === "tenant" && (
          <ActionButton
            icon={Plus}
            onClick={() =>
              notify("Select a rental property first to start an application.")
            }
          >
            New rental application
          </ActionButton>
        )}
      </div>
      <FilterToolbar
        activeCount={activeFilters}
        onReset={() => {
          setTab("All");
          setPropertyFilter("All properties");
          setCompleteness("Any completeness");
          setApplicationSort("Newest submitted");
        }}
      >
        <select
          aria-label="Filter applications by property"
          value={propertyFilter}
          onChange={(event) => setPropertyFilter(event.target.value)}
        >
          <option>All properties</option>
          {[...new Set(baseApplications.map((item) => item.property))].map(
            (property) => (
              <option key={property}>{property}</option>
            ),
          )}
        </select>
        <select
          aria-label="Filter by profile completeness"
          value={completeness}
          onChange={(event) => setCompleteness(event.target.value)}
        >
          <option>Any completeness</option>
          <option value="80">80%+ complete</option>
          <option value="90">90%+ complete</option>
        </select>
        <select
          aria-label="Sort applications"
          value={applicationSort}
          onChange={(event) => setApplicationSort(event.target.value)}
        >
          <option>Newest submitted</option>
          <option>Oldest submitted</option>
          <option>Most complete</option>
          <option>Action required first</option>
        </select>
      </FilterToolbar>
      <section className="card applications-table">
        <div className="table-head">
          <span>{role === "landlord" ? "Applicant" : "Application"}</span>
          <span>Property</span>
          <span>Submitted</span>
          <span>Profile</span>
          <span>Status</span>
          <span />
        </div>
        {visible.map((application: Application) => (
          <button
            className="table-row"
            key={application.id}
            onClick={() =>
              notify(`${application.applicant}'s application record opened.`)
            }
          >
            <span className="applicant-cell">
              <Avatar initials={application.avatar} />
              <strong>
                {role === "landlord"
                  ? application.applicant
                  : `Application #10${application.id}`}
              </strong>
            </span>
            <span>{application.property}</span>
            <span>{application.submitted}</span>
            <span>
              <b className="score-inline">{application.score}%</b> complete
            </span>
            <span>
              <StatusPill
                tone={
                  application.status === "Approved"
                    ? "mint"
                    : application.status === "Documents"
                      ? "amber"
                      : application.status === "Draft"
                        ? "neutral"
                        : "blue"
                }
              >
                {displayStatus(application.status)}
              </StatusPill>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
        {visible.length === 0 && (
          <div className="table-empty">
            <Search size={22} />
            <span>No rental applications match these filters.</span>
          </div>
        )}
      </section>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          Kasa organizes rental applications and documents. Profile completeness
          only shows whether requested fields are present—it is not a “best
          tenant” score. Listing parties decide directly.
        </span>
      </div>
    </div>
  );
}

function Messages({ notify }: { notify: (message: string) => void }) {
  const [selectedName, setSelectedName] = useState(conversations[0].name);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversationContext, setConversationContext] =
    useState("All conversations");
  const [conversationSort, setConversationSort] = useState("Most recent");
  const visibleConversations = conversations
    .filter((conversation) => {
      const matchesQuery =
        `${conversation.name} ${conversation.property} ${conversation.preview}`
          .toLowerCase()
          .includes(conversationQuery.toLowerCase());
      const matchesContext =
        conversationContext === "All conversations" ||
        (conversationContext === "Unread"
          ? conversation.unread > 0
          : conversationContext === "Maintenance"
            ? conversation.property.startsWith("Maintenance")
            : !conversation.property.startsWith("Maintenance"));
      return matchesQuery && matchesContext;
    })
    .sort((a, b) =>
      conversationSort === "Unread first"
        ? b.unread - a.unread
        : conversations.indexOf(a) - conversations.indexOf(b),
    );
  const selectedConversation =
    visibleConversations.find(
      (conversation) => conversation.name === selectedName,
    ) ?? visibleConversations[0];
  const send = () => {
    if (!draft.trim()) return;
    notify("Message added to the demo conversation.");
    setDraft("");
  };
  return (
    <section
      className={`messages-layout card ${mobileChatOpen ? "chat-open" : ""}`}
    >
      <aside className="conversation-list">
        <div className="conversation-search">
          <Search size={17} />
          <input
            placeholder="Search messages"
            aria-label="Search messages"
            value={conversationQuery}
            onChange={(event) => setConversationQuery(event.target.value)}
          />
        </div>
        <div className="conversation-filters">
          <select
            aria-label="Conversation type"
            value={conversationContext}
            onChange={(event) => setConversationContext(event.target.value)}
          >
            <option>All conversations</option>
            <option>Unread</option>
            <option>Property</option>
            <option>Maintenance</option>
          </select>
          <select
            aria-label="Sort messages"
            value={conversationSort}
            onChange={(event) => setConversationSort(event.target.value)}
          >
            <option>Most recent</option>
            <option>Unread first</option>
          </select>
        </div>
        {visibleConversations.map((conversation) => (
          <button
            key={conversation.name}
            className={
              selectedConversation?.name === conversation.name ? "active" : ""
            }
            onClick={() => {
              setSelectedName(conversation.name);
              setMobileChatOpen(true);
            }}
          >
            <Avatar initials={conversation.initials} />
            <span>
              <strong>{conversation.name}</strong>
              <small>{conversation.property}</small>
              <p>{conversation.preview}</p>
            </span>
            <time>{conversation.time}</time>
            {conversation.unread > 0 && <i>{conversation.unread}</i>}
          </button>
        ))}
        {visibleConversations.length === 0 && (
          <div className="conversation-empty">No conversations match.</div>
        )}
      </aside>
      {selectedConversation ? (
        <div className="chat-panel">
          <header>
            <button
              className="mobile-chat-back"
              onClick={() => setMobileChatOpen(false)}
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>
            <Avatar initials={selectedConversation.initials} />
            <div>
              <strong>{selectedConversation.name}</strong>
              <small>Private Kasa Chat · {selectedConversation.property}</small>
            </div>
            <div className="chat-safety-actions">
              <button
                onClick={() =>
                  notify("Conversation reported to Kasa Trust for review.")
                }
              >
                Report
              </button>
              <button
                onClick={() =>
                  notify(
                    "Block controls opened. No action was taken in this demo.",
                  )
                }
              >
                Block
              </button>
            </div>
          </header>
          <div className="chat-body">
            <div className="chat-privacy-banner">
              <LockKeyhole size={16} />
              <span>
                <strong>Contact details are not public</strong>
                <small>
                  Messages stay in Kasa. Share a phone number or email only if
                  you choose.
                </small>
              </span>
            </div>
            <span className="date-divider">Today</span>
            <div className="message received">
              <p>
                Hi Olivia, I made the rent transfer directly to your account
                this morning.
              </p>
              <time>09:36</time>
            </div>
            <div className="message received attachment">
              <FileText size={19} />
              <div>
                <strong>August-transfer.pdf</strong>
                <small>184 KB · PDF</small>
              </div>
              <Download size={17} />
            </div>
            <div className="message sent">
              <p>
                Thanks Inês — I can see the receipt. I’ve marked the August
                record as confirmed.
              </p>
              <time>
                09:41 <CheckCheck />
              </time>
            </div>
          </div>
          <div className="message-compose">
            <button
              className="icon-button"
              onClick={() => notify("Document picker opened.")}
              aria-label="Attach a document"
            >
              <Paperclip size={20} />
            </button>
            <input
              placeholder="Write a message…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && send()}
            />
            <button
              className="send-button"
              onClick={send}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-empty">
          <MessageCircle size={27} />
          <strong>No conversation selected</strong>
          <span>Adjust the filters to see messages.</span>
        </div>
      )}
    </section>
  );
}

function CheckCheck() {
  return <span className="double-check">✓✓</span>;
}

function Rent({
  role,
  notify,
}: {
  role: Role;
  notify: (message: string) => void;
}) {
  const { tr } = useKasaI18n();
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [rentStatus, setRentStatus] = useState("All statuses");
  const [rentProperty, setRentProperty] = useState("All properties");
  const [rentSort, setRentSort] = useState("Most recently updated");
  const records = [
    {
      month: "August 2026",
      tenant: "Inês Duarte",
      property: "Sunlit Eixample home",
      amount: 1850,
      date: "1 Aug",
      status: "Confirmed",
    },
    {
      month: "August 2026",
      tenant: "Leo Bernard",
      property: "Quiet Gràcia loft",
      amount: 1420,
      date: "2 Aug",
      status: "Confirmed",
    },
    {
      month: "August 2026",
      tenant: "Maya Chen",
      property: "Poblenou terrace studio",
      amount: 1280,
      date: "1 Aug",
      status: "Confirmed",
    },
    {
      month: "August 2026",
      tenant: "Noah Vidal",
      property: "Sant Antoni family flat",
      amount: 2180,
      date: "3 Aug",
      status: "Confirmed",
    },
  ];
  const baseRecords =
    role === "tenant"
      ? records.filter((record) => record.tenant === "Inês Duarte")
      : records;
  const visibleRecords = baseRecords
    .filter(
      (record) =>
        (rentStatus === "All statuses" || record.status === rentStatus) &&
        (rentProperty === "All properties" || record.property === rentProperty),
    )
    .sort((a, b) =>
      rentSort === "Amount: high to low"
        ? b.amount - a.amount
        : rentSort === "Property name"
          ? a.property.localeCompare(b.property)
          : records.indexOf(b) - records.indexOf(a),
    );
  const activeRentFilters =
    Number(rentStatus !== "All statuses") +
    Number(rentProperty !== "All properties");
  return (
    <div className="page-stack">
      <section className="rent-banner">
        <div className="rent-banner-icon">
          <ShieldCheck />
        </div>
        <div>
          <strong>{tr("rentPage.title")}</strong>
          <p>{tr("rentPage.directNote")}</p>
        </div>
        {role === "tenant" && (
          <ActionButton
            icon={Upload}
            onClick={() => {
              setProofSubmitted(true);
              notify(
                "Transfer details and proof recorded. Awaiting landlord confirmation.",
              );
            }}
          >
            {proofSubmitted
              ? tr("rentPage.proofSubmitted")
              : tr("rentPage.uploadProof")}
          </ActionButton>
        )}
      </section>
      {role === "tenant" && (
        <section className="bank-instructions">
          <div className="bank-copy">
            <span className="eyebrow light">{tr("rentPage.payLandlord")}</span>
            <h2>
              {tr("rentPage.septemberRent")} · {formatEuro(1850)}
            </h2>
            <p>{tr("rentPage.useBank")}</p>
          </div>
          <div className="bank-details">
            <span>
              <small>{tr("rentPage.accountHolder")}</small>
              <strong>Olivia Martín</strong>
            </span>
            <span>
              <small>IBAN</small>
              <strong>ES12 ···· ···· ···· 4821</strong>
            </span>
            <span>
              <small>{tr("rentPage.paymentReference")}</small>
              <strong>KASA-ES-1042-SEP</strong>
            </span>
            <button
              className="soft-button"
              onClick={() => notify("Payment instructions copied.")}
            >
              {tr("rentPage.copyDetails")}
            </button>
          </div>
          <div className="transfer-flow">
            <span className="done">
              <Check /> {tr("rentPage.transferDirectly")}
            </span>
            <i />
            <span className={proofSubmitted ? "done" : ""}>
              {proofSubmitted && <Check />} {tr("rentPage.submitProof")}
            </span>
            <i />
            <span>{tr("rentPage.landlordConfirms")}</span>
          </div>
        </section>
      )}
      <section className="metrics-grid tenant-metrics">
        <Metric
          label={
            role === "landlord"
              ? tr("rentPage.recordedAugust")
              : tr("rentPage.augustRent")
          }
          value={role === "landlord" ? "€6,730" : "€1,850"}
          note={tr("rentPage.allChecked")}
          icon={CheckCircle2}
        />
        <Metric
          label={tr("rentPage.nextReminder")}
          value={tr("rentPage.augustDate")}
          note={tr("rentPage.forSeptember")}
          icon={Bell}
          tone="blue"
        />
        <Metric
          label={tr("rentPage.missingProof")}
          value="0"
          note={tr("rentPage.nothingAttention")}
          icon={FileCheck2}
          tone="lilac"
        />
      </section>
      <FilterToolbar
        activeCount={activeRentFilters}
        onReset={() => {
          setRentStatus("All statuses");
          setRentProperty("All properties");
          setRentSort("Most recently updated");
        }}
      >
        <select aria-label={tr("rentPage.periodLabel")}>
          <option>{tr("dashboard.august")} 2026</option>
        </select>
        <select
          aria-label={tr("rentPage.statusLabel")}
          value={rentStatus}
          onChange={(event) => setRentStatus(event.target.value)}
        >
          <option value="All statuses">{tr("rentPage.allStatuses")}</option>
          <option value="Confirmed">{tr("rentPage.confirmed")}</option>
          <option value="Awaiting proof">{tr("rentPage.awaitingProof")}</option>
          <option value="Awaiting landlord confirmation">
            {tr("rentPage.awaitingLandlord")}
          </option>
          <option value="Overdue">{tr("rentPage.overdue")}</option>
          <option value="Discrepancy">{tr("rentPage.discrepancy")}</option>
        </select>
        <select
          aria-label={tr("rentPage.propertyLabel")}
          value={rentProperty}
          onChange={(event) => setRentProperty(event.target.value)}
        >
          <option value="All properties">{tr("rentPage.allProperties")}</option>
          {[...new Set(baseRecords.map((record) => record.property))].map(
            (property) => (
              <option key={property}>{property}</option>
            ),
          )}
        </select>
        <select
          aria-label={tr("rentPage.sortLabel")}
          value={rentSort}
          onChange={(event) => setRentSort(event.target.value)}
        >
          <option value="Most recently updated">{tr("rentPage.recent")}</option>
          <option value="Amount: high to low">
            {tr("rentPage.amountHigh")}
          </option>
          <option value="Property name">{tr("rentPage.propertyName")}</option>
        </select>
      </FilterToolbar>
      <section className="card rent-table-card">
        <div className="table-card-title">
          <div>
            <h2>{tr("rentPage.paymentRecords")}</h2>
            <p>{tr("rentPage.proofMatched")}</p>
          </div>
          <button
            className="soft-button"
            onClick={() =>
              notify("Rent records exported as a reconciliation report.")
            }
          >
            <Download size={16} /> {tr("rentPage.export")}
          </button>
        </div>
        <div className="rent-record-head">
          <span>{tr("rentPage.period")}</span>
          {role === "landlord" && <span>{tr("rentPage.tenant")}</span>}
          <span>{tr("rentPage.property")}</span>
          <span>{tr("rentPage.amount")}</span>
          <span>{tr("rentPage.transferred")}</span>
          <span>{tr("rentPage.status")}</span>
        </div>
        {visibleRecords.map((record, index) => (
          <div className="rent-record" key={record.tenant}>
            <span>
              <strong>{tr("dashboard.august")} 2026</strong>
              <small>
                {tr("rentPage.receipt")} #AUG-{1024 + index}
              </small>
            </span>
            {role === "landlord" && <span>{record.tenant}</span>}
            <span>{record.property}</span>
            <strong>{formatEuro(record.amount)}</strong>
            <span>{record.date}</span>
            <StatusPill tone="mint">
              <Check size={13} /> {tr("rentPage.confirmed")}
            </StatusPill>
          </div>
        ))}
        {visibleRecords.length === 0 && (
          <div className="table-empty">
            <Search size={22} />
            <span>{tr("rentPage.noMatches")}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function Maintenance({
  role,
  notify,
}: {
  role: Role;
  notify: (message: string) => void;
}) {
  const columns: MaintenanceRequest["status"][] = [
    "New",
    "Scheduled",
    "In progress",
    "Resolved",
  ];
  const [maintenanceView, setMaintenanceView] = useState<"Board" | "List">(
    "Board",
  );
  const [maintenanceStatus, setMaintenanceStatus] = useState("All statuses");
  const [maintenancePriority, setMaintenancePriority] =
    useState("All priorities");
  const [maintenanceCategoryFilter, setMaintenanceCategoryFilter] =
    useState("All categories");
  const [maintenanceProperty, setMaintenanceProperty] =
    useState("All properties");
  const [maintenanceSort, setMaintenanceSort] = useState("Urgent first");
  const categoryOf = (request: MaintenanceRequest) =>
    request.title.toLowerCase().includes("tap")
      ? "Plumbing"
      : request.title.toLowerCase().includes("conditioning")
        ? "AC"
        : request.title.toLowerCase().includes("power")
          ? "Electrical"
          : "General repair";
  const baseRequests =
    role === "tenant"
      ? maintenance.filter((request) => request.tenant === "Inês Duarte")
      : maintenance;
  const visibleRequests = baseRequests
    .filter(
      (request) =>
        (maintenanceStatus === "All statuses" ||
          request.status === maintenanceStatus) &&
        (maintenancePriority === "All priorities" ||
          request.priority === maintenancePriority) &&
        (maintenanceCategoryFilter === "All categories" ||
          categoryOf(request) === maintenanceCategoryFilter) &&
        (maintenanceProperty === "All properties" ||
          request.property === maintenanceProperty),
    )
    .sort((a, b) =>
      maintenanceSort === "Newest reported"
        ? a.id - b.id
        : maintenanceSort === "Oldest unresolved"
          ? b.id - a.id
          : maintenanceSort === "Scheduled visit"
            ? Number(!a.provider) - Number(!b.provider)
            : { Urgent: 0, Medium: 1, Low: 2 }[a.priority] -
              { Urgent: 0, Medium: 1, Low: 2 }[b.priority],
    );
  const activeMaintenanceFilters =
    Number(maintenanceStatus !== "All statuses") +
    Number(maintenancePriority !== "All priorities") +
    Number(maintenanceCategoryFilter !== "All categories") +
    Number(maintenanceProperty !== "All properties");
  const renderTicket = (request: MaintenanceRequest) => (
    <article
      className="maintenance-ticket"
      key={request.id}
      onClick={() => notify(`${request.title} opened.`)}
    >
      <div className="ticket-top">
        <StatusPill
          tone={
            request.priority === "Urgent"
              ? "red"
              : request.priority === "Medium"
                ? "amber"
                : "neutral"
          }
        >
          {request.priority}
        </StatusPill>
        <span className="ticket-category">{categoryOf(request)}</span>
        <button className="icon-button">
          <MoreHorizontal size={17} />
        </button>
      </div>
      <h3>{request.title}</h3>
      <p>{request.property}</p>
      <div className="ticket-meta">
        <span>
          <CalendarDays size={14} /> {request.date}
        </span>
        <span>
          <Avatar
            initials={request.tenant
              .split(" ")
              .map((part) => part[0])
              .join("")}
            small
          />{" "}
          {request.tenant}
        </span>
      </div>
      {request.provider && (
        <div className="provider-assigned">
          <Wrench size={14} /> {request.provider}
        </div>
      )}
    </article>
  );
  return (
    <div className="page-stack">
      <div className="page-actions">
        <div className="segment compact">
          {(["Board", "List"] as const).map((item) => (
            <button
              key={item}
              className={maintenanceView === item ? "active" : ""}
              onClick={() => setMaintenanceView(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <ActionButton
          icon={Plus}
          onClick={() =>
            notify(
              role === "tenant"
                ? "New maintenance request opened."
                : "Maintenance record opened.",
            )
          }
        >
          {role === "tenant" ? "Report an issue" : "Add request"}
        </ActionButton>
      </div>
      <FilterToolbar
        activeCount={activeMaintenanceFilters}
        onReset={() => {
          setMaintenanceStatus("All statuses");
          setMaintenancePriority("All priorities");
          setMaintenanceCategoryFilter("All categories");
          setMaintenanceProperty("All properties");
          setMaintenanceSort("Urgent first");
        }}
      >
        <select
          aria-label="Maintenance status"
          value={maintenanceStatus}
          onChange={(event) => setMaintenanceStatus(event.target.value)}
        >
          <option>All statuses</option>
          {columns.map((column) => (
            <option key={column}>{column}</option>
          ))}
        </select>
        <select
          aria-label="Maintenance priority"
          value={maintenancePriority}
          onChange={(event) => setMaintenancePriority(event.target.value)}
        >
          <option>All priorities</option>
          <option>Urgent</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <select
          aria-label="Maintenance category"
          value={maintenanceCategoryFilter}
          onChange={(event) => setMaintenanceCategoryFilter(event.target.value)}
        >
          <option>All categories</option>
          <option>Plumbing</option>
          <option>AC</option>
          <option>Electrical</option>
          <option>General repair</option>
        </select>
        {role === "landlord" && (
          <select
            aria-label="Maintenance property"
            value={maintenanceProperty}
            onChange={(event) => setMaintenanceProperty(event.target.value)}
          >
            <option>All properties</option>
            {[...new Set(baseRequests.map((request) => request.property))].map(
              (property) => (
                <option key={property}>{property}</option>
              ),
            )}
          </select>
        )}
        <select
          aria-label="Sort maintenance"
          value={maintenanceSort}
          onChange={(event) => setMaintenanceSort(event.target.value)}
        >
          <option>Urgent first</option>
          <option>Newest reported</option>
          <option>Oldest unresolved</option>
          <option>Scheduled visit</option>
        </select>
      </FilterToolbar>
      {maintenanceView === "Board" ? (
        <section className="maintenance-board">
          {columns
            .filter(
              (column) =>
                maintenanceStatus === "All statuses" ||
                column === maintenanceStatus,
            )
            .map((column) => (
              <div className="maintenance-column" key={column}>
                <header>
                  <span>{column}</span>
                  <i>
                    {
                      visibleRequests.filter((item) => item.status === column)
                        .length
                    }
                  </i>
                </header>
                {visibleRequests
                  .filter((item) => item.status === column)
                  .map(renderTicket)}
              </div>
            ))}
        </section>
      ) : (
        <section className="maintenance-list card">
          {visibleRequests.map((request) => (
            <button
              key={request.id}
              onClick={() => notify(`${request.title} opened.`)}
            >
              <span className="maintenance-list-icon">
                <Wrench size={18} />
              </span>
              <span>
                <strong>{request.title}</strong>
                <small>
                  {request.property} · {categoryOf(request)}
                </small>
              </span>
              <StatusPill
                tone={
                  request.priority === "Urgent"
                    ? "red"
                    : request.priority === "Medium"
                      ? "amber"
                      : "neutral"
                }
              >
                {request.priority}
              </StatusPill>
              <StatusPill
                tone={request.status === "Resolved" ? "mint" : "blue"}
              >
                {request.status}
              </StatusPill>
              <span className="maintenance-list-date">{request.date}</span>
              <ChevronRight size={16} />
            </button>
          ))}
          {visibleRequests.length === 0 && (
            <div className="table-empty">
              <Search size={22} />
              <span>No maintenance requests match these filters.</span>
            </div>
          )}
        </section>
      )}
      <div className="scope-note">
        <LifeBuoy size={17} />
        <span>
          Kasa helps people log, communicate and coordinate repairs. Service
          providers are selected and engaged directly by users.
        </span>
      </div>
    </div>
  );
}

function Documents({
  role,
  notify,
}: {
  role: Role;
  notify: (message: string) => void;
}) {
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentCategory, setDocumentCategory] = useState("All categories");
  const [documentStatus, setDocumentStatus] = useState("All statuses");
  const [documentSort, setDocumentSort] = useState("Recently added");
  const groups = [
    {
      title: "Lease & property",
      files: [
        {
          name: "Residential lease agreement",
          type: "PDF · 2.4 MB",
          date: "Signed 24 Jun",
          status: "Signed",
        },
        {
          name: "Move-in condition report",
          type: "PDF · 8.1 MB",
          date: "Added 1 Jul",
          status: "Complete",
        },
      ],
    },
    {
      title: role === "landlord" ? "Tenant records" : "My records",
      files: [
        {
          name: "Identity verification",
          type: "Verified record",
          date: "Checked 18 Jun",
          status: "Verified",
        },
        {
          name: "Income documentation",
          type: "PDF · 920 KB",
          date: "Added 18 Jun",
          status: "Private",
        },
      ],
    },
    {
      title: "Rent & maintenance",
      files: [
        {
          name: "August transfer receipt",
          type: "PDF · 184 KB",
          date: "Added 1 Aug",
          status: "Confirmed",
        },
        {
          name: "AC service report",
          type: "PDF · 612 KB",
          date: "Due 22 Aug",
          status: "Pending",
        },
      ],
    },
  ];
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      files: group.files
        .filter(
          (file) =>
            `${file.name} ${file.type}`
              .toLowerCase()
              .includes(documentQuery.toLowerCase()) &&
            (documentCategory === "All categories" ||
              group.title === documentCategory) &&
            (documentStatus === "All statuses" ||
              file.status === documentStatus),
        )
        .sort((a, b) =>
          documentSort === "Document name"
            ? a.name.localeCompare(b.name)
            : documentSort === "Action required first"
              ? Number(a.status !== "Pending") - Number(b.status !== "Pending")
              : group.files.indexOf(b) - group.files.indexOf(a),
        ),
    }))
    .filter((group) => group.files.length > 0);
  const activeDocumentFilters =
    Number(Boolean(documentQuery)) +
    Number(documentCategory !== "All categories") +
    Number(documentStatus !== "All statuses");
  return (
    <div className="page-stack">
      <div className="page-actions">
        <div className="document-summary">
          <div>
            <FileCheck2 size={18} />
            <span>
              <strong>8 verified</strong>
              <small>Up to date</small>
            </span>
          </div>
          <div>
            <Clock3 size={18} />
            <span>
              <strong>1 pending</strong>
              <small>Service report</small>
            </span>
          </div>
        </div>
        <ActionButton
          icon={Upload}
          onClick={() => notify("Secure document upload opened.")}
        >
          Upload document
        </ActionButton>
      </div>
      <FilterToolbar
        activeCount={activeDocumentFilters}
        onReset={() => {
          setDocumentQuery("");
          setDocumentCategory("All categories");
          setDocumentStatus("All statuses");
          setDocumentSort("Recently added");
        }}
      >
        <label className="filter-search">
          <Search size={15} />
          <input
            aria-label="Search documents"
            placeholder="Search documents"
            value={documentQuery}
            onChange={(event) => setDocumentQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Document category"
          value={documentCategory}
          onChange={(event) => setDocumentCategory(event.target.value)}
        >
          <option>All categories</option>
          {groups.map((group) => (
            <option key={group.title}>{group.title}</option>
          ))}
        </select>
        <select
          aria-label="Document status"
          value={documentStatus}
          onChange={(event) => setDocumentStatus(event.target.value)}
        >
          <option>All statuses</option>
          {[
            ...new Set(
              groups.flatMap((group) => group.files.map((file) => file.status)),
            ),
          ].map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <select
          aria-label="Sort documents"
          value={documentSort}
          onChange={(event) => setDocumentSort(event.target.value)}
        >
          <option>Recently added</option>
          <option>Action required first</option>
          <option>Document name</option>
        </select>
      </FilterToolbar>
      {visibleGroups.map((group) => (
        <section className="card document-group" key={group.title}>
          <SectionHeading title={group.title} />
          {group.files.map((file) => (
            <button
              className="document-row"
              key={file.name}
              onClick={() => notify(`${file.name} opened.`)}
            >
              <span className="document-icon">
                <FileText size={20} />
              </span>
              <span className="row-copy">
                <strong>{file.name}</strong>
                <small>{file.type}</small>
              </span>
              <span className="document-date">{file.date}</span>
              <StatusPill
                tone={
                  file.status === "Pending"
                    ? "amber"
                    : file.status === "Private"
                      ? "neutral"
                      : "mint"
                }
              >
                {file.status}
              </StatusPill>
              <Download size={17} />
            </button>
          ))}
        </section>
      ))}
      {visibleGroups.length === 0 && (
        <div className="empty-state">
          <FileText size={28} />
          <h3>No documents match</h3>
          <p>Reset a filter or search for another document.</p>
        </div>
      )}
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          Demo assumption: files will use encrypted object storage and
          role-based access. Identity and income documents remain private to
          authorized participants.
        </span>
      </div>
    </div>
  );
}

function Services({ notify }: { notify: (message: string) => void }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [booking, setBooking] = useState<(typeof providers)[number] | null>(
    null,
  );
  const [serviceQuery, setServiceQuery] = useState("");
  const [pricingFilter, setPricingFilter] = useState("Any pricing");
  const [providerKind, setProviderKind] = useState("Any provider");
  const [serviceAvailability, setServiceAvailability] =
    useState("Any availability");
  const [minimumRating, setMinimumRating] = useState("Any rating");
  const [serviceSort, setServiceSort] = useState("Recommended");
  const [serviceNeed, setServiceNeed] = useState("");
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
        `${provider.name} ${provider.type} ${provider.mode}`
          .toLowerCase()
          .includes(serviceQuery.toLowerCase()) &&
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
    Number(Boolean(serviceNeed)) +
    Number(Boolean(serviceQuery)) +
    Number(pricingFilter !== "Any pricing") +
    Number(providerKind !== "Any provider") +
    Number(serviceAvailability !== "Any availability") +
    Number(minimumRating !== "Any rating");
  return (
    <div className="page-stack">
      <section className="services-hero">
        <div>
          <span className="eyebrow light">VERIFIED HOME & PROPERTY HELP</span>
          <h2>From issue to done, in one place.</h2>
          <p>
            Compare independent providers, choose a fixed-price service or
            request a quote, then keep chat, tracking and the completion record
            together.
          </p>
        </div>
        <div className="service-proof">
          <ShieldCheck size={22} />
          <strong>Provider profiles checked</strong>
          <span>Independent professionals & companies</span>
        </div>
      </section>
      <section className="service-search">
        <div>
          <Search size={20} />
          <input
            placeholder="What do you need help with?"
            aria-label="Search service providers"
            value={serviceQuery}
            onChange={(event) => setServiceQuery(event.target.value)}
          />
        </div>
        <select aria-label="Service location">
          <option>Barcelona</option>
        </select>
        <ActionButton
          onClick={() =>
            notify(`${visible.length} matching provider profiles shown.`)
          }
        >
          Search
        </ActionButton>
      </section>
      <div className="category-row five">
        {categories.map(([label, Icon]) => (
          <button
            className={selectedCategory === label ? "active" : ""}
            key={label}
            onClick={() => {
              setSelectedCategory(selectedCategory === label ? "All" : label);
              setServiceNeed("");
            }}
          >
            <Icon size={19} /> {label}
          </button>
        ))}
      </div>
      {selectedCategory !== "All" && (
        <div className="service-subfilters">
          <span>What kind?</span>
          {serviceNeeds[selectedCategory].map((need) => (
            <button
              key={need}
              className={serviceNeed === need ? "active" : ""}
              onClick={() => setServiceNeed(serviceNeed === need ? "" : need)}
            >
              {need}
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
          aria-label="Service pricing type"
          value={pricingFilter}
          onChange={(event) => setPricingFilter(event.target.value)}
        >
          <option>Any pricing</option>
          <option>Fixed price</option>
          <option>Quote available</option>
        </select>
        <select
          aria-label="Provider type"
          value={providerKind}
          onChange={(event) => setProviderKind(event.target.value)}
        >
          <option>Any provider</option>
          <option>Independent</option>
          <option>Company</option>
        </select>
        <select
          aria-label="Provider availability"
          value={serviceAvailability}
          onChange={(event) => setServiceAvailability(event.target.value)}
        >
          <option>Any availability</option>
          <option>Today</option>
          <option>Tomorrow</option>
          <option>This week</option>
        </select>
        <select
          aria-label="Minimum provider rating"
          value={minimumRating}
          onChange={(event) => setMinimumRating(event.target.value)}
        >
          <option>Any rating</option>
          <option value="4.8">4.8+ rating</option>
          <option value="4.9">4.9+ rating</option>
        </select>
        <select
          aria-label="Sort service providers"
          value={serviceSort}
          onChange={(event) => setServiceSort(event.target.value)}
        >
          <option>Recommended</option>
          <option>Highest rated</option>
          <option>Most completed jobs</option>
          <option>Price: low to high</option>
          <option>Price: high to low</option>
        </select>
      </FilterToolbar>
      <SectionHeading
        title={
          selectedCategory === "All"
            ? "Recommended near your properties"
            : `${selectedCategory}${serviceNeed ? ` · ${serviceNeed}` : ""}`
        }
      />
      <section className="provider-grid">
        {visible.map((provider) => (
          <article className="provider-card" key={provider.name}>
            <div className="provider-card-top">
              <div className={`provider-logo ${provider.tone}`}>
                {provider.initials}
              </div>
              <StatusPill tone="mint">
                <BadgeCheck size={12} /> Verified
              </StatusPill>
            </div>
            <div>
              <h3>{provider.name}</h3>
              <p>
                {provider.type} · {provider.providerKind} · {provider.mode}
              </p>
            </div>
            <div className="provider-rating">
              <Star size={16} fill="currentColor" />{" "}
              <strong>{provider.rating}</strong>
              <span>({provider.jobs} completed)</span>
            </div>
            <div className="provider-price">
              <strong>{provider.price}</strong>
              <span>
                <Clock3 size={14} /> {provider.availability} · replies{" "}
                {provider.response}
              </span>
            </div>
            <ActionButton secondary onClick={() => setBooking(provider)}>
              View & book
            </ActionButton>
          </article>
        ))}
      </section>
      {visible.length === 0 && (
        <div className="empty-state">
          <Store size={28} />
          <h3>No provider profiles match</h3>
          <p>Reset a filter or choose another service category.</p>
        </div>
      )}
      <div className="scope-note">
        <Store size={17} />
        <span>
          Providers publish their own service details and quotes.
          Service-payment processing is separate from rent and will depend on
          the supported payment providers in each country.
        </span>
      </div>
      {booking && (
        <Modal title={`Book ${booking.name}`} onClose={() => setBooking(null)}>
          <div className="modal-body">
            <div className="booking-provider">
              <div className={`provider-logo ${booking.tone}`}>
                {booking.initials}
              </div>
              <div>
                <StatusPill tone="mint">Verified provider</StatusPill>
                <h3>{booking.type} visit</h3>
                <p>{booking.price} · final price confirmed before booking</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Property
                <select>
                  <option>Sunlit Eixample home</option>
                  <option>Quiet Gràcia loft</option>
                </select>
              </label>
              <label>
                Preferred date
                <input type="date" defaultValue="2026-08-24" />
              </label>
              <label className="full">
                Describe what you need
                <textarea placeholder="Add details or request a quote…" />
              </label>
            </div>
            <div className="journey-row">
              <span className="done">
                <Check /> Request
              </span>
              <i />
              <span>Quote</span>
              <i />
              <span>Booking</span>
              <i />
              <span>Track & review</span>
            </div>
            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setBooking(null)}
              >
                Cancel
              </button>
              <button
                className="button"
                onClick={() => {
                  notify(`Request sent directly to ${booking.name}.`);
                  setBooking(null);
                }}
              >
                Send request
              </button>
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
}: {
  venue: SpaceVenue;
  onOpen: () => void;
}) {
  const { tr } = useKasaI18n();
  return (
    <article className="space-venue-card">
      <div className="space-venue-image">
        <img src={venue.image} alt={venue.name} />
        {venue.availableToday && (
          <StatusPill tone="mint">{tr("space.availableToday")}</StatusPill>
        )}
        <button
          className="heart-button"
          aria-label={`${tr("common.save")} ${venue.name}`}
        >
          <Heart size={18} />
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
              <BadgeCheck size={11} /> {tr("common.verified")}
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
  notify,
  onGoBookings,
  onListSpace,
}: {
  notify: (message: string) => void;
  onGoBookings: () => void;
  onListSpace: () => void;
}) {
  const { tr } = useKasaI18n();
  const [catalogVenues, setCatalogVenues] = useState(spaceVenues);
  type SpaceStage =
    | "browse"
    | "venue"
    | "availability"
    | "summary"
    | "confirmed"
    | "request"
    | "requestSent";
  const [stage, setStage] = useState<SpaceStage>("browse");
  const [category, setCategory] = useState("Sports");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Recommended");
  const [mapView, setMapView] = useState(false);
  const [activity, setActivity] = useState("Any activity");
  const [availableToday, setAvailableToday] = useState(false);
  const [bookingMode, setBookingMode] = useState("Any booking mode");
  const [capacity, setCapacity] = useState("Any capacity");
  const [spaceMaxPrice, setSpaceMaxPrice] = useState("Any price");
  const [spaceAmenities, setSpaceAmenities] = useState<string[]>([]);
  const [drawnZone, setDrawnZone] = useState<ZonePoint[]>([]);
  const [venue, setVenue] = useState<SpaceVenue>(spaceVenues[0]);
  const [space, setSpace] = useState<SpaceUnit>(spaceVenues[0].spaces[0]);
  const [slot, setSlot] = useState(spaceVenues[0].spaces[0].slots[0]);
  const [customStart, setCustomStart] = useState("18:00");
  const [customEnd, setCustomEnd] = useState("19:30");
  const [customRequest, setCustomRequest] = useState(false);
  useEffect(() => {
    if (!appConfig.apiUrl) return;
    let active = true;
    void listSpaces()
      .then((items) => {
        if (!active || items.length === 0) return;
        setCatalogVenues(items);
        setVenue(items[0]);
        setSpace(items[0].spaces[0]);
        setSlot(items[0].spaces[0].slots[0]);
      })
      .catch((error: unknown) => {
        warnApiFallbackOnce("space", error);
      });
    return () => {
      active = false;
    };
  }, []);
  const categories: Array<[string, LucideIcon, string]> = [
    ["Sports", Zap, tr("space.sportsNote")],
    ["Events", Sparkles, tr("space.eventsNote")],
  ];
  const activityOptions =
    category === "Sports"
      ? ["Padel", "Football", "Tennis", "Basketball"]
      : ["Celebration", "Workshop", "Community event", "Reception"];
  const spaceAmenityOptions =
    category === "Sports"
      ? [
          "Lighting",
          "Changing rooms",
          "Parking",
          "Equipment rental",
          "Accessible entry",
        ]
      : [
          "Kitchen",
          "Catering allowed",
          "Parking",
          "Sound system",
          "Accessible entry",
        ];
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
      const matchQuery =
        `${item.name} ${item.neighbourhood} ${item.category} ${item.description} ${item.amenities.join(" ")} ${item.spaces.map((unit) => unit.activity).join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase());
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
        item.category === category &&
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
    Number(activity !== "Any activity") +
    Number(availableToday) +
    Number(bookingMode !== "Any booking mode") +
    Number(capacity !== "Any capacity") +
    Number(spaceMaxPrice !== "Any price") +
    Number(drawnZone.length >= 3) +
    spaceAmenities.length;
  const resetSpaceFilters = () => {
    setActivity("Any activity");
    setAvailableToday(false);
    setBookingMode("Any booking mode");
    setCapacity("Any capacity");
    setSpaceMaxPrice("Any price");
    setSpaceAmenities([]);
    setSort("Recommended");
    setDrawnZone([]);
  };
  const openVenue = (nextVenue: SpaceVenue) => {
    setVenue(nextVenue);
    setSpace(nextVenue.spaces[0]);
    setSlot(
      nextVenue.spaces[0].slots.find((item) => item.status !== "Booked") ??
        nextVenue.spaces[0].slots[0],
    );
    setCustomRequest(false);
    setStage("venue");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const requestCustomTime = () => {
    setSlot({
      time: `${customStart}–${customEnd}`,
      status: "Available",
      price: space.price,
    });
    setCustomRequest(true);
    setStage("summary");
  };

  if (stage === "requestSent")
    return (
      <div className="page-stack">
        <section className="space-confirmed card">
          <span className="confirmation-orbit">
            <Check size={38} />
          </span>
          <span className="eyebrow">RESERVATION REQUEST</span>
          <h2>Request sent to {venue.name}</h2>
          <p>
            The operator can accept your time, decline it or propose another
            one. A changed time is confirmed only after you accept it. No
            payment has been taken.
          </p>
          <div className="request-steps">
            <span className="done">
              <Check size={14} />
              <strong>Requested</strong>
            </span>
            <i />
            <span>
              <Clock3 size={14} />
              <strong>Operator response</strong>
            </span>
            <i />
            <span>
              <CheckCircle2 size={14} />
              <strong>Your acceptance</strong>
            </span>
          </div>
          <div className="confirmation-code">
            <small>Request code</small>
            <strong>KSR-9H31C</strong>
          </div>
          <div className="confirmation-actions">
            <ActionButton onClick={onGoBookings}>View request</ActionButton>
            <ActionButton secondary onClick={() => setStage("venue")}>
              Back to venue
            </ActionButton>
          </div>
        </section>
        <div className="scope-note">
          <ShieldCheck size={17} />
          <span>
            The venue controls availability and any proposed modification. Kasa
            records the request and acceptance; it does not own, operate or
            represent the venue.
          </span>
        </div>
      </div>
    );
  if (stage === "confirmed")
    return (
      <div className="page-stack">
        <section className="space-confirmed card">
          <span className="confirmation-orbit">
            <Check size={38} />
          </span>
          <span className="eyebrow">INSTANT BOOK</span>
          <h2>Your session is confirmed.</h2>
          <p>
            {venue.name} · {space.name} — {space.activity}
            <br />
            24 Aug · {slot.time}
          </p>
          <div className="confirmation-code">
            <small>Confirmation code</small>
            <strong>KSA7-M52X</strong>
          </div>
          <div className="confirmation-actions">
            <ActionButton onClick={onGoBookings}>
              View booking & QR
            </ActionButton>
            <ActionButton
              secondary
              onClick={() => {
                setStage("browse");
                notify("Calendar reminder added.");
              }}
            >
              Add to calendar
            </ActionButton>
          </div>
        </section>
        <div className="scope-note">
          <ShieldCheck size={17} />
          <span>
            Payment settles directly to the venue through its own supported
            provider. Kasa never receives the gross reservation amount.
          </span>
        </div>
      </div>
    );
  if (stage === "request")
    return (
      <div className="page-stack">
        <button className="back-link" onClick={() => setStage("venue")}>
          <ArrowLeft size={16} /> Back to venue
        </button>
        <div className="space-checkout-layout">
          <section className="card padded">
            <span className="eyebrow">REQUEST AVAILABILITY</span>
            <h2>Tell the operator about your event</h2>
            <p className="muted">
              The operator will check the date, capacity and event details
              before confirming.
            </p>
            <div className="form-grid">
              <label>
                Event type
                <select>
                  <option>Birthday celebration</option>
                  <option>Community event</option>
                  <option>Workshop</option>
                  <option>Private reception</option>
                </select>
              </label>
              <label>
                Guest count
                <input type="number" defaultValue="80" />
              </label>
              <label>
                Date
                <input type="date" defaultValue="2026-09-12" />
              </label>
              <label>
                Time
                <select>
                  <option>18:00–23:00</option>
                  <option>10:00–14:00</option>
                </select>
              </label>
              <label className="full">
                Notes
                <textarea defaultValue="We would like space for a DJ area and simple table decoration." />
              </label>
            </div>
            <div className="modal-actions">
              <ActionButton secondary onClick={() => setStage("venue")}>
                Cancel
              </ActionButton>
              <ActionButton onClick={() => setStage("requestSent")}>
                Send request
              </ActionButton>
            </div>
          </section>
          <aside className="card padded booking-side">
            <img src={venue.image} alt="" />
            <h3>{venue.name}</h3>
            <p>{venue.address}</p>
            <div className="booking-line">
              <span>Venue price from</span>
              <strong>{formatEuro(venue.priceFrom)}</strong>
            </div>
            <div className="booking-line">
              <span>Cleaning fee</span>
              <strong>{formatEuro(venue.cleaningFee ?? 0)}</strong>
            </div>
            <div className="booking-line">
              <span>Refundable operator deposit</span>
              <strong>{formatEuro(venue.deposit ?? 0)}</strong>
            </div>
            <div className="scope-note">
              <Clock3 size={16} />
              <span>This is a request, not an instant confirmation.</span>
            </div>
            <div className="scope-note">
              <ShieldCheck size={16} />
              <span>
                Any venue price, cleaning fee or operator deposit is paid
                directly to the venue through its approved external provider
                after confirmation. Kasa does not hold these funds.
              </span>
            </div>
          </aside>
        </div>
      </div>
    );
  if (stage === "summary") {
    const needsOperatorReply =
      customRequest || venue.bookingMode === "Request to Book";
    return (
      <div className="page-stack">
        <button className="back-link" onClick={() => setStage("availability")}>
          <ArrowLeft size={16} /> Change time
        </button>
        <div className="space-checkout-layout">
          <section className="card padded">
            <span className="eyebrow">
              {needsOperatorReply ? "RESERVATION REQUEST" : "BOOKING SUMMARY"}
            </span>
            <h2>
              {needsOperatorReply
                ? "Review your requested time"
                : "Review your session"}
            </h2>
            <div className="booking-main">
              <img src={space.image} alt="" />
              <div>
                <StatusPill tone={needsOperatorReply ? "amber" : "mint"}>
                  {needsOperatorReply
                    ? "Operator confirmation needed"
                    : "Instant Reserve"}
                </StatusPill>
                <h3>{venue.name}</h3>
                <p>
                  {space.name} — {space.activity}
                </p>
              </div>
            </div>
            <div className="booking-facts">
              <span>
                <small>Date</small>
                <strong>24 Aug</strong>
              </span>
              <span>
                <small>Time</small>
                <strong>{slot.time}</strong>
              </span>
              <span>
                <small>Duration</small>
                <strong>
                  {customRequest ? "Your requested range" : "Venue suggestion"}
                </strong>
              </span>
              <span>
                <small>Players</small>
                <strong>Up to {space.capacity}</strong>
              </span>
            </div>
            <SectionHeading title="Optional extras" />
            <label className="booking-extra">
              <span>
                <Wrench size={17} />
                <span>
                  <strong>Equipment rental</strong>
                  <small>Rackets and balls</small>
                </span>
              </span>
              <strong>+ €8</strong>
              <input type="checkbox" />
            </label>
            <div className="scope-note">
              <ShieldCheck size={17} />
              <span>
                {needsOperatorReply
                  ? "The operator confirms availability, price and cancellation terms. If it proposes another time, you must accept before the booking is confirmed."
                  : "Cancellation terms are shown before payment. The venue’s own supported provider handles payment directly into the venue’s account; Kasa does not receive the gross amount."}
              </span>
            </div>
          </section>
          <aside className="card padded booking-total">
            <h3>{needsOperatorReply ? "Estimated price" : "Price details"}</h3>
            <div className="booking-line">
              <span>Space</span>
              <strong>{formatEuro(slot.price)}</strong>
            </div>
            <div className="booking-line">
              <span>Optional extras</span>
              <strong>€0</strong>
            </div>
            <div className="booking-line total">
              <span>{needsOperatorReply ? "Estimate" : "Total"}</span>
              <strong>{formatEuro(slot.price)}</strong>
            </div>
            <ActionButton
              onClick={() =>
                setStage(needsOperatorReply ? "requestSent" : "confirmed")
              }
            >
              {needsOperatorReply
                ? "Send reservation request"
                : "Continue to venue payment"}
            </ActionButton>
            <small>
              <LockKeyhole size={13} /> Payment settles directly to the venue.
              Any approved Kasa commission is invoiced to the operator
              separately afterward.
            </small>
          </aside>
        </div>
      </div>
    );
  }
  if (stage === "availability")
    return (
      <div className="page-stack">
        <button className="back-link" onClick={() => setStage("venue")}>
          <ArrowLeft size={16} /> Back to venue
        </button>
        <section className="space-detail-hero card">
          <img src={space.image} alt={space.name} />
          <div>
            <StatusPill tone="mint">{space.activity}</StatusPill>
            <h2>{space.name}</h2>
            <p>
              {venue.name} · up to {space.capacity} people · operator-managed
              schedule
            </p>
            <strong>From {formatEuro(space.price)} · duration can vary</strong>
          </div>
        </section>
        <div className="space-availability-layout">
          <section className="card padded">
            <div className="availability-heading">
              <div>
                <span className="eyebrow">OPERATOR-MANAGED TIMES</span>
                <h2>Choose or request a time</h2>
                <p>The venue—not Kasa—sets and updates availability.</p>
              </div>
              <div className="date-strip">
                {["22 Thu", "23 Fri", "24 Sat", "25 Sun", "26 Mon"].map(
                  (date) => (
                    <button
                      className={date === "24 Sat" ? "active" : ""}
                      key={date}
                    >
                      {date}
                    </button>
                  ),
                )}
              </div>
            </div>
            <span className="slot-section-label">SUGGESTED BY THE VENUE</span>
            <div className="slot-list">
              {space.slots.map((item) => (
                <button
                  key={item.time}
                  disabled={item.status === "Booked"}
                  className={`${!customRequest && slot.time === item.time ? "selected" : ""} ${item.status.toLowerCase()}`}
                  onClick={() => {
                    setSlot(item);
                    setCustomRequest(false);
                  }}
                >
                  <Clock3 size={16} />
                  <span>
                    <strong>{item.time}</strong>
                    <small>
                      {item.status === "Peak"
                        ? "Higher-demand time"
                        : item.status}
                    </small>
                  </span>
                  <b>
                    {item.status === "Booked"
                      ? "Unavailable"
                      : formatEuro(item.price)}
                  </b>
                </button>
              ))}
            </div>
            <div className="custom-time-request">
              <div>
                <Clock3 size={18} />
                <span>
                  <strong>Need another time?</strong>
                  <small>
                    Request any start and end time. The operator can accept it
                    or propose an alternative.
                  </small>
                </span>
              </div>
              <div>
                <label>
                  Start
                  <input
                    type="time"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                  />
                </label>
                <label>
                  End
                  <input
                    type="time"
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                  />
                </label>
                <ActionButton secondary onClick={requestCustomTime}>
                  Request this time
                </ActionButton>
              </div>
            </div>
          </section>
          <aside className="card padded selected-slot">
            <span className="eyebrow">
              {customRequest ? "REQUESTED TIME" : "SELECTED SUGGESTION"}
            </span>
            <h3>{slot.time}</h3>
            <p>
              24 Aug
              <br />
              {space.name} — {space.activity}
            </p>
            <div className="booking-line total">
              <span>{customRequest ? "Estimated from" : "Price"}</span>
              <strong>{formatEuro(slot.price)}</strong>
            </div>
            <ActionButton onClick={() => setStage("summary")}>
              {customRequest || venue.bookingMode === "Request to Book"
                ? "Review request"
                : "Reserve this time"}
            </ActionButton>
          </aside>
        </div>
      </div>
    );
  if (stage === "venue")
    return (
      <div className="page-stack">
        <button className="back-link" onClick={() => setStage("browse")}>
          <ArrowLeft size={16} /> Back to spaces
        </button>
        <div className="space-gallery">
          <img src={venue.gallery[0]} alt={venue.name} />
          <img src={venue.gallery[1]} alt="" />
          <img src={venue.gallery[2]} alt="" />
        </div>
        <div className="space-venue-layout">
          <main>
            <section className="card padded">
              <div className="detail-heading">
                <div>
                  <span className="trust-line">
                    {venue.verified && (
                      <>
                        <BadgeCheck size={16} /> Verified operator
                      </>
                    )}{" "}
                    · {venue.bookingMode}
                  </span>
                  <h2>{venue.name}</h2>
                  <p>
                    <MapPin size={15} /> {venue.address} · {venue.distance}
                  </p>
                </div>
                <div className="detail-price">
                  <strong>From {formatEuro(venue.priceFrom)}</strong>
                  <span>{venue.priceUnit}</span>
                </div>
              </div>
              <div className="space-rating">
                <Star size={16} fill="currentColor" />{" "}
                <strong>{venue.rating}</strong> ({venue.reviews} reviews)
              </div>
              <p className="venue-description">{venue.description}</p>
            </section>
            <section className="card padded">
              <SectionHeading
                title={
                  venue.category === "Events"
                    ? "Venue details"
                    : "Bookable courts and pitches"
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
                    Operator hours: {venue.openingHours}
                  </span>
                  <span>
                    <Sparkles size={17} />
                    Cleaning fee {formatEuro(venue.cleaningFee ?? 0)}
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
                          Up to {item.capacity} · from {formatEuro(item.price)}
                        </p>
                      </span>
                      <button
                        className="soft-button"
                        onClick={() => {
                          setSpace(item);
                          setSlot(
                            item.slots.find(
                              (entry) => entry.status !== "Booked",
                            ) ?? item.slots[0],
                          );
                          setStage("availability");
                        }}
                      >
                        Choose time
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className="card padded">
              <SectionHeading title="Amenities & operator rules" />
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
                  The operator is responsible for licences, safety, insurance,
                  capacity and local compliance.
                </span>
              </div>
            </section>
          </main>
          <aside className="card padded venue-cta">
            <StatusPill
              tone={venue.bookingMode === "Instant Book" ? "mint" : "amber"}
            >
              {venue.bookingMode}
            </StatusPill>
            <h3>
              {venue.category === "Events"
                ? "Plan your event"
                : "Choose a space and time"}
            </h3>
            <p>
              {venue.category === "Events"
                ? "Share your event details and the operator will confirm availability."
                : "Choose an operator suggestion or request another time. The operator controls availability."}
            </p>
            <ActionButton
              onClick={() =>
                venue.category === "Events"
                  ? setStage("request")
                  : setStage("availability")
              }
            >
              {venue.category === "Events"
                ? "Request availability"
                : "Choose or request a time"}
            </ActionButton>
            <button
              className="soft-button"
              onClick={() => notify("Private venue chat opened.")}
            >
              <MessageCircle size={15} /> Message venue
            </button>
          </aside>
        </div>
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
              <ShieldCheck size={15} /> {tr("space.operatorVerified")}
            </span>
            <span>
              <Clock3 size={15} /> {tr("space.flexible")}
            </span>
            <span>
              <LockKeyhole size={15} /> {tr("space.externalPay")}
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
      <section className="space-category-grid focused">
        {categories.map(([label, Icon, note]) => (
          <button
            className={category === label ? "active" : ""}
            key={label}
            onClick={() => {
              setCategory(label);
              setActivity("Any activity");
              setSpaceAmenities([]);
            }}
          >
            <span>
              <Icon size={20} />
            </span>
            <strong>
              {label === "Sports" ? tr("space.sports") : tr("space.events")}
            </strong>
            <small>{note}</small>
          </button>
        ))}
      </section>
      <FilterToolbar
        activeCount={activeSpaceFilters}
        onReset={resetSpaceFilters}
      >
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
          {category === "Sports" ? (
            <>
              <option value="30">≤ €30</option>
              <option value="60">≤ €60</option>
              <option value="100">≤ €100</option>
            </>
          ) : (
            <>
              <option value="500">≤ €500</option>
              <option value="800">≤ €800</option>
              <option value="1200">≤ €1,200</option>
            </>
          )}
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
          {category === "Sports" ? tr("space.sports") : tr("space.events")}
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
          <ActionButton secondary onClick={resetSpaceFilters}>
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

function SpaceBookingsView({ notify }: { notify: (message: string) => void }) {
  const [tab, setTab] = useState("Upcoming");
  const [selected, setSelected] = useState(spaceBookings[0]);
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const filtered = spaceBookings.filter(
    (booking) => tab === "All" || booking.status === tab,
  );
  return (
    <div className="page-stack">
      <div className="page-actions">
        <div className="segment">
          {["All", "Upcoming", "Requested", "Completed", "Cancelled"].map(
            (item) => (
              <button
                key={item}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <ActionButton
          secondary
          onClick={() => notify("Calendar export created.")}
        >
          Export calendar
        </ActionButton>
      </div>
      <div className="space-bookings-layout">
        <section className="card space-booking-list">
          {filtered.map((booking) => (
            <button
              className={selected.id === booking.id ? "active" : ""}
              key={booking.id}
              onClick={() => {
                setSelected(booking);
                setProposalAccepted(false);
              }}
            >
              <img src={booking.image} alt="" />
              <span>
                <StatusPill
                  tone={
                    booking.status === "Upcoming"
                      ? "mint"
                      : booking.status === "Requested"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {booking.status}
                </StatusPill>
                <strong>{booking.venue}</strong>
                <small>
                  {booking.space} · {booking.date} · {booking.time}
                </small>
              </span>
              <ChevronRight />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <CalendarDays />
              <h3>No {tab.toLowerCase()} bookings</h3>
            </div>
          )}
        </section>
        <aside className="card padded booking-detail-panel">
          <img src={selected.image} alt="" />
          <div>
            <StatusPill
              tone={
                selected.status === "Upcoming"
                  ? "mint"
                  : selected.status === "Requested"
                    ? "amber"
                    : "neutral"
              }
            >
              {proposalAccepted ? "New time accepted" : selected.status}
            </StatusPill>
            <h2>{selected.venue}</h2>
            <p>{selected.space}</p>
          </div>
          <div className="booking-facts">
            <span>
              <small>Date</small>
              <strong>{selected.date}</strong>
            </span>
            <span>
              <small>Time</small>
              <strong>
                {proposalAccepted ? "18:30–20:00" : selected.time}
              </strong>
            </span>
            <span>
              <small>Price</small>
              <strong>{formatEuro(selected.price)}</strong>
            </span>
          </div>
          {selected.status === "Requested" && !proposalAccepted && (
            <div className="time-proposal-card">
              <span className="eyebrow">OPERATOR PROPOSED A CHANGE</span>
              <h3>18:30–20:00</h3>
              <p>
                Your original request was {selected.time}. The venue suggested a
                different time; nothing changes until you accept.
              </p>
              <div>
                <ActionButton
                  onClick={() => {
                    setProposalAccepted(true);
                    notify(
                      "Alternative time accepted. The booking record is now confirmed in this demo.",
                    );
                  }}
                >
                  Accept new time
                </ActionButton>
                <ActionButton
                  secondary
                  onClick={() =>
                    notify(
                      "Original time kept as requested. The venue has been notified.",
                    )
                  }
                >
                  Keep original request
                </ActionButton>
              </div>
            </div>
          )}
          {selected.status === "Upcoming" && (
            <div className="qr-card">
              <div className="qr-pattern">▦</div>
              <span>
                <small>Show at the venue</small>
                <strong>{selected.code}</strong>
              </span>
            </div>
          )}
          <button
            className="soft-button"
            onClick={() => notify("Private venue conversation opened.")}
          >
            <MessageCircle size={15} /> Message venue
          </button>
          {selected.status === "Completed" && (
            <ActionButton
              onClick={() => notify("Review submitted. Thank you.")}
            >
              Leave a review
            </ActionButton>
          )}
        </aside>
      </div>
      <section className="card padded related-services">
        <SectionHeading title="Useful for your next booking" />
        <div>
          {["Trainer", "Referee", "Sports photography", "Equipment rental"].map(
            (item) => (
              <button
                key={item}
                onClick={() =>
                  notify(`${item} providers opened in Kasa Services.`)
                }
              >
                <Wrench size={18} />
                <span>
                  <strong>{item}</strong>
                  <small>Optional · separately supplied</small>
                </span>
                <ChevronRight />
              </button>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function SpaceOperatorDashboard({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const units = spaceVenues[0].spaces;
  const days = [
    "Mon 12",
    "Tue 13",
    "Wed 14",
    "Thu 15",
    "Fri 16",
    "Sat 17",
    "Sun 18",
  ];
  const blocks = [
    "Team Alpha",
    "League match",
    "Open play",
    "Coaching",
    "Maintenance",
    "Training",
    "Customer request",
  ];
  return (
    <div className="page-stack">
      <section className="operator-hero">
        <div>
          <span className="eyebrow light">
            VERIFIED OPERATOR · POBLENOU MULTISPORT CLUB
          </span>
          <h2>List spaces. Confirm times. Keep bookings clear.</h2>
          <p>
            A focused workspace for pitches, courts and event venues—without
            forcing Kasa-defined opening hours or fixed session lengths.
          </p>
        </div>
        <button
          className="button button-cream"
          onClick={() => notify("New reservation request opened.")}
        >
          <Plus size={16} /> Add reservation
        </button>
      </section>
      <section className="metrics-grid">
        <Metric
          label="Listed spaces"
          value="4"
          note="Each has its own calendar"
          icon={Building2}
        />
        <Metric
          label="Today’s bookings"
          value="18"
          note="16 confirmed"
          icon={CalendarDays}
          tone="blue"
        />
        <Metric
          label="Time requests"
          value="3"
          note="Need an operator response"
          icon={Clock3}
          tone="lilac"
        />
        <Metric
          label="Proposed changes"
          value="1"
          note="Waiting for customer"
          icon={Repeat2}
          tone="sun"
        />
      </section>
      <div className="operator-layout">
        <section className="card operator-calendar">
          <div className="table-card-title">
            <div>
              <span className="eyebrow">UNIFIED CALENDAR</span>
              <h2>12–18 August</h2>
              <p>Every space keeps its own flexible schedule.</p>
            </div>
            <div className="segment compact">
              <button className="active">Week</button>
              <button>Day</button>
              <button>List</button>
            </div>
          </div>
          <div className="calendar-grid">
            <div className="calendar-corner">Space</div>
            {days.map((day) => (
              <div className="calendar-day" key={day}>
                {day}
              </div>
            ))}
            {units.map((unit, row) => (
              <div className="calendar-row" key={unit.id}>
                <div className="calendar-unit">
                  <strong>{unit.name}</strong>
                  <small>{unit.activity}</small>
                </div>
                {days.map((day, column) => {
                  const hasBlock = (row + column) % 3 !== 1;
                  const kind = (row + column) % 5;
                  return (
                    <button
                      className={`calendar-cell tone-${kind}`}
                      key={day}
                      onClick={() =>
                        notify(
                          `${unit.name} · ${day} flexible schedule opened.`,
                        )
                      }
                    >
                      {hasBlock && (
                        <span>
                          <small>
                            {column % 2 ? "18:00–19:30" : "09:00–10:30"}
                          </small>
                          <strong>
                            {blocks[(row + column) % blocks.length]}
                          </strong>
                          {kind === 3 && <i>Proposed</i>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="legend-open" />
              Available
            </span>
            <span>
              <i className="legend-booked" />
              Confirmed
            </span>
            <span>
              <i className="legend-blocked" />
              Blocked
            </span>
            <span>
              <Repeat2 />
              Proposed change
            </span>
          </div>
        </section>
        <aside className="page-stack">
          <section className="card padded flexible-availability">
            <SectionHeading
              title="Flexible availability"
              action="Edit"
              onAction={() => notify("Flexible availability settings opened.")}
            />
            <p>
              Kasa does not preset operating hours. Add only what helps
              customers request the right time.
            </p>
            {[
              ["Opening range", "Optional"],
              ["Suggested times", "Operator controlled"],
              ["Custom time requests", "Enabled"],
              ["Blocked time", "1 maintenance block"],
            ].map(([title, note]) => (
              <div key={title}>
                <span>{title}</span>
                <StatusPill tone={note === "Enabled" ? "mint" : "neutral"}>
                  {note}
                </StatusPill>
              </div>
            ))}
          </section>
          <section className="card padded operator-tools">
            {[
              ["Reservation requests", "3 need a response"],
              ["Proposed times", "1 waiting for customer"],
              ["Customer messages", "3 unread"],
              ["Venue settings", "Identity, rules and policies"],
              ["Reviews", "4.7 average"],
            ].map(([title, note]) => (
              <button key={title} onClick={() => notify(`${title} opened.`)}>
                <span>
                  <strong>{title}</strong>
                  <small>{note}</small>
                </span>
                <ChevronRight />
              </button>
            ))}
          </section>
        </aside>
      </div>
      <section className="card padded upcoming-reservations">
        <SectionHeading title="Reservations and requests" action="View all" />
        <div className="performance-table">
          <div>
            <span>Customer / space</span>
            <span>Time</span>
            <span>Status</span>
            <span>Price</span>
          </div>
          {[
            ["Team Alpha · Court 1", "Today · 18:00", "Confirmed", "€36"],
            ["Poblenou League · Pitch A", "Today · 20:00", "Confirmed", "€62"],
            ["Rita Alves · Court 2", "Requested 09:30", "Propose time", "€28"],
          ].map((item) => (
            <div key={item[0]}>
              <span>
                <Avatar initials={item[0].slice(0, 2).toUpperCase()} small />
                <strong>{item[0]}</strong>
              </span>
              <span>{item[1]}</span>
              <span>
                <StatusPill tone={item[2] === "Confirmed" ? "mint" : "amber"}>
                  {item[2]}
                </StatusPill>
              </span>
              <strong>{item[3]}</strong>
            </div>
          ))}
        </div>
      </section>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          The operator controls the space, schedule, licences, safety, insurance
          and customer service. Kasa records requests, proposals and
          acceptances; it does not operate the facility.
        </span>
      </div>
    </div>
  );
}

function SpaceOnboarding({ notify }: { notify: (message: string) => void }) {
  const [step, setStep] = useState(1);
  const [operatorType, setOperatorType] = useState("Sports facility");
  const [venueRelationship, setVenueRelationship] = useState("Operator");
  const steps = [
    "Operator type",
    "Business profile",
    "Verification",
    "Venue",
    "Spaces",
    "Media & amenities",
    "Availability & pricing",
    "Policies & publish",
  ];
  return (
    <div className="page-stack">
      <section className="onboarding-progress card">
        <div>
          {steps.map((item, index) => (
            <button
              className={
                step === index + 1 ? "active" : step > index + 1 ? "done" : ""
              }
              key={item}
              onClick={() => setStep(index + 1)}
            >
              <i>{step > index + 1 ? "✓" : index + 1}</i>
              <span>{item}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="card padded venue-onboarding-card">
        <div className="onboarding-copy">
          <span className="eyebrow">
            STEP {step} OF {steps.length}
          </span>
          <h2>{steps[step - 1]}</h2>
          <p>
            {step === 1
              ? "Choose the operator profile that best describes the venue."
              : step === 3
                ? "Verification badges correspond to real identity and business checks."
                : step === 5
                  ? "Add every court, pitch or event hall as a separately schedulable space."
                  : step === 7
                    ? "Choose optional suggested hours or accept flexible time requests."
                    : "Complete this section before moving to the next step."}
          </p>
          <div className="onboarding-illustration">
            <Building2 size={52} />
            <strong>Poblenou MultiSport Club</strong>
            <small>Space Operator · {venueRelationship} · Draft venue</small>
          </div>
        </div>
        <div className="onboarding-form">
          {step === 1 && (
            <div className="operator-identity-step">
              <div className="operator-type-grid">
                {[
                  "Individual venue operator",
                  "Sports facility",
                  "Event venue",
                ].map((type) => (
                  <button
                    className={operatorType === type ? "active" : ""}
                    key={type}
                    onClick={() => setOperatorType(type)}
                  >
                    <Building2 />
                    <span>
                      <strong>{type}</strong>
                      <small>Choose this operator type</small>
                    </span>
                    <CheckCircle2 />
                  </button>
                ))}
              </div>
              <section className="venue-relationship-block">
                <div>
                  <span className="eyebrow">AUTHORITY TO LIST</span>
                  <h3>What is your relationship to this venue?</h3>
                  <p>
                    This records your authority to publish. Your Kasa role
                    remains Space Operator—not Landlord.
                  </p>
                </div>
                <div className="venue-relationship-options">
                  {[
                    "Owner",
                    "Operator",
                    "Facility manager",
                    "Authorised representative",
                  ].map((relationship) => (
                    <button
                      key={relationship}
                      className={
                        venueRelationship === relationship ? "active" : ""
                      }
                      onClick={() => setVenueRelationship(relationship)}
                    >
                      {venueRelationship === relationship && (
                        <Check size={14} />
                      )}
                      {relationship}
                    </button>
                  ))}
                </div>
                <div className="scope-note">
                  <ShieldCheck size={16} />
                  <span>
                    An owner can also activate the separate Property Owner
                    workspace under the same Kasa identity. The two roles,
                    records and public profiles remain separate.
                  </span>
                </div>
              </section>
            </div>
          )}
          {step === 2 && (
            <div className="form-grid">
              <label>
                Business name
                <input defaultValue="Poblenou MultiSport Club" />
              </label>
              <label>
                Operator type
                <select
                  value={operatorType}
                  onChange={(event) => setOperatorType(event.target.value)}
                >
                  <option>Individual venue operator</option>
                  <option>Sports facility</option>
                  <option>Event venue</option>
                </select>
              </label>
              <label>
                Relationship to venue
                <select
                  value={venueRelationship}
                  onChange={(event) => setVenueRelationship(event.target.value)}
                >
                  <option>Owner</option>
                  <option>Operator</option>
                  <option>Facility manager</option>
                  <option>Authorised representative</option>
                </select>
              </label>
              <label className="full">
                Business address
                <input defaultValue="Carrer de la Marina, 88, Barcelona" />
              </label>
              <label>
                Contact email
                <input defaultValue="operations@example.com" />
              </label>
              <label>
                Contact phone
                <input defaultValue="+34 612 555 310" />
              </label>
            </div>
          )}
          {step === 3 && (
            <div className="verification-checks">
              {[
                "Identity verification",
                "Business registration",
                "Authority to publish this venue",
                "Address evidence",
                "Insurance record",
              ].map((item, index) => (
                <div key={item}>
                  <span>
                    <ShieldCheck />
                    <strong>{item}</strong>
                  </span>
                  <StatusPill tone={index < 4 ? "mint" : "amber"}>
                    {index < 4 ? "Checked" : "Required"}
                  </StatusPill>
                </div>
              ))}
            </div>
          )}
          {step === 4 && (
            <div className="form-grid">
              <label>
                Venue name
                <input defaultValue="Poblenou MultiSport Club" />
              </label>
              <label>
                Primary category
                <select>
                  <option>Sports</option>
                </select>
              </label>
              <label className="full">
                Venue description
                <textarea defaultValue="A multi-sport neighbourhood facility with padel courts and football pitches." />
              </label>
              <label>
                Area / neighbourhood
                <input defaultValue="Poblenou" />
              </label>
              <label>
                Contact preference
                <select>
                  <option>Private Kasa Chat</option>
                </select>
              </label>
            </div>
          )}
          {step === 5 && (
            <div className="onboarding-space-list">
              {spaceVenues[0].spaces.map((item) => (
                <div key={item.id}>
                  <img src={item.image} alt="" />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.activity} · capacity {item.capacity}
                    </small>
                  </span>
                  <button className="icon-button">
                    <MoreHorizontal />
                  </button>
                </div>
              ))}
              <button className="soft-button">
                <Plus /> Add another space
              </button>
            </div>
          )}
          {step === 6 && (
            <div>
              <div className="photo-drop">
                <Camera />
                <strong>Add venue photos or video</strong>
                <small>Warm, accurate media helps customers choose.</small>
              </div>
              <div className="amenity-grid">
                {spaceVenues[0].amenities.map((item) => (
                  <label key={item}>
                    <input type="checkbox" defaultChecked /> {item}
                  </label>
                ))}
              </div>
            </div>
          )}
          {step === 7 && (
            <div className="form-grid">
              <label>
                Availability style
                <select>
                  <option>Flexible time requests</option>
                  <option>Operator suggestions + custom requests</option>
                  <option>Accurate instant calendar</option>
                </select>
              </label>
              <label>
                Default duration (optional)
                <select>
                  <option>No fixed duration</option>
                  <option>60 minutes</option>
                  <option>90 minutes</option>
                </select>
              </label>
              <label>
                Base price (optional)
                <input defaultValue="€28" />
              </label>
              <label>
                Suggested opening range (optional)
                <input defaultValue="06:00–23:00" />
              </label>
              <label className="full">
                Availability note
                <textarea defaultValue="Customers may request any start and end time. We can accept it or propose another time." />
              </label>
              <div className="scope-note full">
                <Clock3 size={16} />
                <span>
                  Kasa does not preset the venue’s hours or session length. The
                  operator controls every suggestion and change.
                </span>
              </div>
            </div>
          )}
          {step === 8 && (
            <div className="form-grid">
              <label>
                Cancellation policy
                <select>
                  <option>Free until 4 hours before</option>
                </select>
              </label>
              <label>
                Booking mode
                <select>
                  <option>Request to Reserve</option>
                  <option>Instant Reserve (accurate calendar only)</option>
                </select>
              </label>
              <label className="full check-label">
                <input type="checkbox" defaultChecked /> I confirm the operator
                is authorised to publish this venue and is responsible for
                licences, safety, insurance, capacity and local compliance.
              </label>
              <div className="scope-note">
                <ShieldCheck />
                <span>
                  Publishing sends the venue to moderation. It does not make
                  Kasa the facility operator.
                </span>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <ActionButton
              secondary
              onClick={() => setStep(Math.max(1, step - 1))}
            >
              Back
            </ActionButton>
            <ActionButton
              onClick={() =>
                step === steps.length
                  ? notify("Venue submitted for verification and moderation.")
                  : setStep(step + 1)
              }
            >
              {step === steps.length ? "Publish venue" : "Save & continue"}
            </ActionButton>
          </div>
        </div>
      </section>
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

function ProviderDashboard({ notify }: { notify: (message: string) => void }) {
  const [jobTab, setJobTab] = useState("All");
  const [available, setAvailable] = useState(true);
  const [jobQuery, setJobQuery] = useState("");
  const [jobArea, setJobArea] = useState("All areas");
  const [jobSort, setJobSort] = useState("Newest request");
  const jobs = [
    {
      id: "#K-2048",
      title: "Kitchen tap leaking",
      client: "Inês Duarte",
      area: "Eixample",
      when: "Today · 16:30",
      value: "Quote needed",
      status: "New",
    },
    {
      id: "#K-2042",
      title: "AC annual service",
      client: "Leo Bernard",
      area: "Gràcia",
      when: "22 Aug · 14:30",
      value: "€79 fixed",
      status: "Booked",
    },
    {
      id: "#K-2038",
      title: "Replace two outlets",
      client: "Maya Chen",
      area: "Poblenou",
      when: "In progress",
      value: "€118 approved",
      status: "Active",
    },
  ];
  const visibleJobs = jobs
    .filter(
      (job) =>
        (jobTab === "All" || job.status === jobTab) &&
        (jobArea === "All areas" || job.area === jobArea) &&
        `${job.title} ${job.client} ${job.area}`
          .toLowerCase()
          .includes(jobQuery.toLowerCase()),
    )
    .sort((a, b) =>
      jobSort === "Appointment time"
        ? Number(a.when === "In progress") - Number(b.when === "In progress")
        : jobSort === "Job value"
          ? Number.parseInt(b.value.replace(/\D/g, "")) -
            Number.parseInt(a.value.replace(/\D/g, ""))
          : jobs.indexOf(a) - jobs.indexOf(b),
    );
  const activeJobFilters =
    Number(jobTab !== "All") +
    Number(jobArea !== "All areas") +
    Number(Boolean(jobQuery));
  return (
    <div className="page-stack">
      <section className="provider-hero">
        <div>
          <span className="eyebrow light">VOLT & CO. · VERIFIED BUSINESS</span>
          <h2>Good morning, Adrián.</h2>
          <p>
            You have one new job request and two visits scheduled this week.
          </p>
        </div>
        <button
          className={`availability-toggle ${available ? "on" : ""}`}
          onClick={() => setAvailable((value) => !value)}
        >
          <i />
          {available ? "Available for jobs" : "Not accepting jobs"}
        </button>
      </section>
      <section className="metrics-grid">
        <Metric
          label="August earnings"
          value="€3,840"
          note="23 completed jobs"
          icon={CircleDollarSign}
        />
        <Metric
          label="New requests"
          value="1"
          note="Reply within 54 min"
          icon={BriefcaseBusiness}
          tone="blue"
        />
        <Metric
          label="Completion rate"
          value="98%"
          note="Last 90 days"
          icon={CheckCircle2}
          tone="lilac"
        />
        <Metric
          label="Rating"
          value="4.9"
          note="128 verified reviews"
          icon={Star}
          tone="sun"
        />
      </section>
      <FilterToolbar
        activeCount={activeJobFilters}
        onReset={() => {
          setJobTab("All");
          setJobArea("All areas");
          setJobQuery("");
          setJobSort("Newest request");
        }}
      >
        <label className="filter-search">
          <Search size={15} />
          <input
            aria-label="Search provider jobs"
            placeholder="Search jobs or customers"
            value={jobQuery}
            onChange={(event) => setJobQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Provider job area"
          value={jobArea}
          onChange={(event) => setJobArea(event.target.value)}
        >
          <option>All areas</option>
          {[...new Set(jobs.map((job) => job.area))].map((area) => (
            <option key={area}>{area}</option>
          ))}
        </select>
        <select
          aria-label="Sort provider jobs"
          value={jobSort}
          onChange={(event) => setJobSort(event.target.value)}
        >
          <option>Newest request</option>
          <option>Appointment time</option>
          <option>Job value</option>
        </select>
      </FilterToolbar>
      <div className="provider-workgrid">
        <section className="card job-inbox">
          <div className="table-card-title">
            <div>
              <h2>Job inbox</h2>
              <p>Requests, quotes and active work</p>
            </div>
            <div className="segment compact">
              {["All", "New", "Booked", "Active"].map((tab) => (
                <button
                  key={tab}
                  className={jobTab === tab ? "active" : ""}
                  onClick={() => setJobTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          {visibleJobs.map((job) => (
            <article key={job.id}>
              <div className="job-status">
                <StatusPill
                  tone={
                    job.status === "New"
                      ? "amber"
                      : job.status === "Active"
                        ? "blue"
                        : "mint"
                  }
                >
                  {job.status}
                </StatusPill>
                <small>{job.id}</small>
              </div>
              <h3>{job.title}</h3>
              <p>
                {job.client} · {job.area}
              </p>
              <div>
                <span>
                  <CalendarDays size={14} /> {job.when}
                </span>
                <strong>{job.value}</strong>
              </div>
              <button
                className="soft-button"
                onClick={() =>
                  notify(
                    job.status === "New"
                      ? "Quote builder opened with labour, materials and terms."
                      : "Job tracking and service chat opened.",
                  )
                }
              >
                {job.status === "New" ? "Build quote" : "Open job"}{" "}
                <ChevronRight size={14} />
              </button>
            </article>
          ))}
          {visibleJobs.length === 0 && (
            <div className="table-empty">
              <Search size={22} />
              <span>No jobs match these filters.</span>
            </div>
          )}
        </section>
        <aside className="page-stack provider-side">
          <section className="card padded">
            <SectionHeading
              title="This week"
              action="Edit availability"
              onAction={() => notify("Availability calendar opened.")}
            />
            <div className="availability-week">
              {["M", "T", "W", "T", "F", "S"].map((day, index) => (
                <button
                  key={`${day}-${index}`}
                  className={index < 5 ? "open" : ""}
                >
                  <span>{day}</span>
                  <strong>{22 + index}</strong>
                  <small>{index < 5 ? "Open" : "Off"}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="card padded team-card">
            <SectionHeading title="Team & business" />
            <div>
              <Avatar initials="AR" />
              <span>
                <strong>Adrián Ruiz</strong>
                <small>Owner · Electrician</small>
              </span>
              <StatusPill tone="mint">Online</StatusPill>
            </div>
            <div>
              <Avatar initials="LM" />
              <span>
                <strong>Lucía Mora</strong>
                <small>Technician</small>
              </span>
              <StatusPill tone="neutral">On job</StatusPill>
            </div>
            <button
              className="soft-button"
              onClick={() => notify("Team member invitation opened.")}
            >
              <Plus size={15} /> Invite team member
            </button>
          </section>
        </aside>
      </div>
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          Providers control their profiles, availability and quotes. Kasa
          supplies discovery, booking, records and communication tools; the
          final service-payment setup remains country-configurable.
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

function Insights() {
  const bars = [72, 84, 78, 90, 92, 96, 96, 96];
  return (
    <div className="page-stack">
      <section className="metrics-grid">
        <Metric
          label="Portfolio value tracked"
          value="€1.42m"
          note="4 property records"
          icon={Building2}
        />
        <Metric
          label="Gross monthly rent"
          value="€6,730"
          note="Across occupied homes"
          icon={CircleDollarSign}
          tone="blue"
        />
        <Metric
          label="Average occupancy"
          value="96%"
          note="Last 12 months"
          icon={Users}
          tone="lilac"
        />
        <Metric
          label="Response time"
          value="2.1h"
          note="Maintenance average"
          icon={Clock3}
          tone="sun"
        />
      </section>
      <div className="two-column wide-left">
        <section className="card padded chart-card">
          <div className="chart-title">
            <div>
              <h2>Occupancy trend</h2>
              <p>Across all property records</p>
            </div>
            <select>
              <option>Last 8 months</option>
            </select>
          </div>
          <div className="bar-chart">
            <div className="axis">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div className="bars">
              {bars.map((bar, index) => (
                <div className="bar-column" key={index}>
                  <i style={{ height: `${bar}%` }}>
                    <b>{bar}%</b>
                  </i>
                  <span>
                    {
                      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"][
                        index
                      ]
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card padded health-card">
          <SectionHeading title="Portfolio health" />
          <div className="health-score">
            <ProgressRing value={92} label="healthy" />
          </div>
          <div className="health-item">
            <CheckCircle2 size={17} />
            <span>
              <strong>Rent records</strong>
              <small>100% reconciled</small>
            </span>
          </div>
          <div className="health-item">
            <CheckCircle2 size={17} />
            <span>
              <strong>Documents</strong>
              <small>All required files present</small>
            </span>
          </div>
          <div className="health-item warning">
            <Clock3 size={17} />
            <span>
              <strong>Maintenance</strong>
              <small>1 new request</small>
            </span>
          </div>
        </section>
      </div>
      <section className="card padded">
        <SectionHeading title="Property performance" />
        <div className="performance-table">
          <div>
            <span>Property</span>
            <span>Occupancy</span>
            <span>Monthly rent</span>
            <span>Open items</span>
          </div>
          {properties.map((property, index) => (
            <div key={property.id}>
              <span>
                <img src={property.image} alt="" />
                <strong>{property.title}</strong>
              </span>
              <span>{index === 3 ? "87%" : "100%"}</span>
              <span>{formatEuro(property.price)}</span>
              <span>
                {index === 0
                  ? "1 maintenance"
                  : index === 3
                    ? "3 applications"
                    : "All clear"}
              </span>
            </div>
          ))}
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

function App() {
  const { tr } = useKasaI18n();
  const previewParams = new URLSearchParams(window.location.search);
  const previewDevice = previewParams.get("device");
  const requestedRole = previewParams.get("role") as Role;
  const requestedView = previewParams.get("view") as View;
  const isDevicePreview =
    previewDevice === "ios" || previewDevice === "android";
  const [role, setRole] = useState<Role>(
    roleValues.includes(requestedRole) ? requestedRole : "landlord",
  );
  const [view, setView] = useState<View>(
    viewValues.includes(requestedView) ? requestedView : "overview",
  );
  const [showOnboarding, setShowOnboarding] = useState(
    () =>
      !isDevicePreview &&
      window.sessionStorage.getItem("kasa-demo-entered") !== "1",
  );
  const [selectedProperty, setSelectedProperty] = useState<Property>(
    properties[0],
  );
  const [favourites, setFavourites] = useState<number[]>([2]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [deviceSimulatorOpen, setDeviceSimulatorOpen] = useState(
    () => !isDevicePreview && previewParams.get("simulator") === "1",
  );
  const [toast, setToast] = useState("");
  const [discoveryIntent, setDiscoveryIntent] = useState<"Rent" | "Buy">(
    "Rent",
  );

  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.roles || item.roles.includes(role)),
    [role],
  );
  const mobileDockItems: Array<{
    id: View;
    label: string;
    icon: LucideIcon;
    activeViews?: View[];
  }> =
    role === "tenant"
      ? [
          { id: "overview", label: tr("common.home"), icon: Home },
          {
            id: "discover",
            label: tr("common.search"),
            icon: Search,
            activeViews: ["discover", "property"],
          },
          { id: "portfolio", label: tr("nav.myHome"), icon: Building2 },
          { id: "services", label: tr("common.services"), icon: Wrench },
          {
            id: "spaces",
            label: tr("common.spaces"),
            icon: CalendarDays,
            activeViews: ["spaces", "spaceVenue", "spaceBookings"],
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
              id: "applications",
              label: tr("common.applications"),
              icon: FileCheck2,
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
    messages: "common.messages",
    rent: "nav.rentRecords",
    maintenance: "common.maintenance",
    documents: "common.documents",
    services: "nav.kasaServices",
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

  const go = (next: View) => {
    setView(next);
    setMobileOpen(false);
    setWorkspaceMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView(
          role === "provider"
            ? "provider"
            : role === "spaceOperator"
              ? "spaceOperator"
              : role === "admin"
                ? "admin"
                : "discover",
        );
        setMobileOpen(false);
        setWorkspaceMenuOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
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
  }, [role]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
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
    setView(nextView);
    if (nextDiscoveryIntent) setDiscoveryIntent(nextDiscoveryIntent);
    setShowOnboarding(false);
    window.sessionStorage.setItem("kasa-demo-entered", "1");
  };

  const renderView = () => {
    switch (view) {
      case "overview":
        return role === "landlord" ? (
          <LandlordOverview go={go} notify={notify} />
        ) : role === "tenant" ? (
          <TenantOverview go={go} notify={notify} />
        ) : role === "provider" ? (
          <ProviderDashboard notify={notify} />
        ) : role === "spaceOperator" ? (
          <SpaceOperatorDashboard notify={notify} />
        ) : (
          <AdminConsole notify={notify} />
        );
      case "discover":
        return (
          <Discover
            favourites={favourites}
            toggleFavourite={toggleFavourite}
            notify={notify}
            initialIntent={discoveryIntent}
            onOpen={(property) => {
              setSelectedProperty(property);
              go("property");
            }}
          />
        );
      case "saved":
        return (
          <Saved
            favourites={favourites}
            toggleFavourite={toggleFavourite}
            notify={notify}
            onOpen={(property) => {
              setSelectedProperty(property);
              go("property");
            }}
          />
        );
      case "property":
        return (
          <PropertyDetail
            property={selectedProperty}
            favourite={favourites.includes(selectedProperty.id)}
            onFavourite={() => toggleFavourite(selectedProperty.id)}
            onBack={() => go("discover")}
            onMessage={() => go("messages")}
            notify={notify}
          />
        );
      case "portfolio":
        return (
          <Portfolio
            role={role}
            notify={notify}
            go={go}
            onStartSpaceListing={() => {
              setRole("spaceOperator");
              go("spaceOnboarding");
            }}
          />
        );
      case "applications":
        return <Applications role={role} notify={notify} />;
      case "messages":
        return <Messages notify={notify} />;
      case "rent":
        return <Rent role={role} notify={notify} />;
      case "maintenance":
        return <Maintenance role={role} notify={notify} />;
      case "documents":
        return <Documents role={role} notify={notify} />;
      case "services":
        return <Services notify={notify} />;
      case "spaces":
        return (
          <SpacesMarketplace
            notify={notify}
            onGoBookings={() => go("spaceBookings")}
            onListSpace={() => {
              setRole("spaceOperator");
              go("spaceOnboarding");
            }}
          />
        );
      case "spaceVenue":
        return (
          <SpacesMarketplace
            notify={notify}
            onGoBookings={() => go("spaceBookings")}
            onListSpace={() => {
              setRole("spaceOperator");
              go("spaceOnboarding");
            }}
          />
        );
      case "spaceBookings":
        return <SpaceBookingsView notify={notify} />;
      case "spaceOperator":
        return <SpaceOperatorDashboard notify={notify} />;
      case "spaceOnboarding":
        return <SpaceOnboarding notify={notify} />;
      case "spacesPlan":
        return <SpacesPlan notify={notify} />;
      case "provider":
        return <ProviderDashboard notify={notify} />;
      case "admin":
        return <AdminConsole notify={notify} />;
      case "diagnostics":
        return <Diagnostics />;
      case "insights":
        return <Insights />;
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
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
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
          onClick={() => {
            setMobileOpen(false);
            setWorkspaceMenuOpen(false);
          }}
          aria-label={tr("shell.closeNavigation")}
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
              role === "tenant" && item.id === "applications"
                ? "1"
                : item.badge;
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
                  className={
                    view === item.id ||
                    (view === "property" && item.id === "discover")
                      ? "active"
                      : ""
                  }
                  onClick={() => go(item.id)}
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
          <button onClick={() => setShowOnboarding(true)}>
            <Smartphone size={18} /> {tr("nav.appWelcome")}
          </button>
          <button onClick={() => notify(tr("shell.helpOpened"))}>
            <LifeBuoy size={18} /> {tr("nav.help")}
          </button>
          <button onClick={() => notify(tr("shell.settingsOpened"))}>
            <Settings size={18} /> {tr("common.settings")}
          </button>
          <div className="scope-chip">
            <ShieldCheck size={15} /> {tr("nav.nonBrokerage")}
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label={tr("shell.closeNavigation")}
          onClick={() => {
            setMobileOpen(false);
            setWorkspaceMenuOpen(false);
          }}
        />
      )}
      <main className="main-area" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label={tr("shell.openNavigation")}
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
            <LanguageSwitcher short={isDevicePreview} />
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
            <div className="notification-wrap">
              <button
                className="notification-button"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label={tr("common.notifications")}
                aria-expanded={notificationsOpen}
              >
                <Bell size={20} />
                <i />
              </button>
              {notificationsOpen && (
                <section className="notification-panel">
                  <header>
                    <strong>{tr("common.notifications")}</strong>
                    <button
                      className="text-button"
                      onClick={() => notify(tr("shell.notificationsRead"))}
                    >
                      {tr("shell.markAllRead")}
                    </button>
                  </header>
                  <button>
                    <span className="notification-dot" />
                    <div>
                      <strong>
                        {role === "provider"
                          ? tr("shell.newServiceRequest")
                          : role === "spaceOperator"
                            ? tr("shell.newCourtBooking")
                            : role === "admin"
                              ? tr("shell.listingFlagged")
                              : tr("shell.transferConfirmed")}
                      </strong>
                      <p>
                        {role === "provider"
                          ? "Kitchen tap · Eixample"
                          : role === "spaceOperator"
                            ? "Court 1 · Today at 18:00"
                            : role === "admin"
                              ? "Duplicate-image signal · High priority"
                              : "August rent · Sunlit Eixample home"}
                      </p>
                      <small>{tr("shell.minutesAgo")}</small>
                    </div>
                  </button>
                  <button>
                    <span className="notification-dot muted-dot" />
                    <div>
                      <strong>
                        {role === "tenant"
                          ? tr("shell.viewingAccepted")
                          : role === "spaceOperator"
                            ? tr("shell.waitlistJoined")
                            : tr("shell.documentUpdated")}
                      </strong>
                      <p>{tr("shell.workspaceReady")}</p>
                      <small>{tr("shell.yesterday")}</small>
                    </div>
                  </button>
                </section>
              )}
            </div>
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
        <div className="content">{renderView()}</div>
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
                onClick={() => go(item.id)}
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
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
