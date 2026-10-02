import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  History,
  Home,
  Wrench,
} from "lucide-react";
import { displayTranslation, type LanguageCode } from "../i18n";
import type { Property, View } from "../types";
import type { ApplicationState } from "./applicationState";
import type { MaintenanceState } from "./maintenanceState";
import type { RentRecordState } from "./rentRecordState";
import { propertyOperationStatus } from "./propertyOperationStatus";
import {
  buildPropertyOperationsSummary,
  type PropertyOverviewRole,
} from "./propertyOperationsSummary";
import "./propertyOverview.css";

interface PropertyOverviewProps {
  role: PropertyOverviewRole;
  rentState: RentRecordState;
  applicationState: ApplicationState;
  maintenanceState: MaintenanceState;
  go: (view: View) => void;
  onOpenProperty: (property: Property) => void;
}

export function PropertyOverview({
  role,
  rentState,
  applicationState,
  maintenanceState,
  go,
  onOpenProperty,
}: PropertyOverviewProps) {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ||
    i18n.language ||
    "pt") as LanguageCode;
  const english = i18n.getFixedT("en");
  const tr = (key: string) =>
    displayTranslation(t(key), english(key), language);
  const copy = (en: string, pt: string) => (language === "pt" ? pt : en);
  const locale =
    {
      pt: "pt-PT",
      en: "en-GB",
      es: "es-ES",
      fr: "fr-FR",
      ar: "ar",
      zh: "zh-CN",
    }[language] ?? "en-GB";
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const periodLabel = (period: string) =>
    new Date(`${period}-01T12:00:00`).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
  const dayLabel = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const summary = buildPropertyOperationsSummary({
    role,
    rentState,
    applicationState,
    maintenanceState,
    now,
  });
  const isOwner = role === "landlord";
  const featuredHome = summary.properties[0];
  const currentPeriod = periodLabel(summary.currentPeriod);
  const statusTone = (status: string) =>
    ["Confirmed", "Approved", "Resolved"].includes(status)
      ? "mint"
      : ["Needs correction", "Documents"].includes(status)
        ? "amber"
        : "blue";
  const status = (value: string) => (
    <span className={`pill pill-${statusTone(value)} operations-status`}>
      {propertyOperationStatus(value, language)}
    </span>
  );
  const link = (label: string, view: View) => (
    <button type="button" className="text-button" onClick={() => go(view)}>
      {label}
      <ArrowRight size={15} aria-hidden="true" />
    </button>
  );
  const metrics = [
    isOwner
      ? {
          label: copy("Your properties", "Os seus imóveis"),
          value: number(summary.properties.length),
          note: copy("Listings in this workspace", "Anúncios deste espaço"),
          icon: Building2,
          view: "portfolio" as const,
        }
      : {
          label: copy(
            "Rent recorded for this month",
            "Renda registada para este mês",
          ),
          value: summary.currentRent.length
            ? money(summary.currentRentDueCents)
            : "—",
          note: currentPeriod,
          icon: Home,
          view: "rent" as const,
        },
    {
      label: copy("Rent awaiting owner review", "Rendas por confirmar"),
      value: number(summary.rentAwaitingOwner.length),
      note: copy("All recorded periods", "Todos os períodos registados"),
      icon: CheckCircle2,
      view: "rent" as const,
    },
    {
      label: copy("Open applications", "Candidaturas em aberto"),
      value: number(summary.pendingApplications.length),
      note: copy(
        "In review or awaiting documents",
        "Em análise ou a aguardar documentos",
      ),
      icon: FileCheck2,
      view: "applications" as const,
    },
    {
      label: copy(
        "Open maintenance requests",
        "Pedidos de manutenção em aberto",
      ),
      value: number(summary.openMaintenanceCount),
      note: copy("Not marked resolved", "Ainda não marcados como resolvidos"),
      icon: Wrench,
      view: "maintenance" as const,
    },
  ];

  return (
    <div className="page-stack property-operations-overview">
      <section className={`operations-hero ${featuredHome ? "has-home" : ""}`}>
        <div className="operations-hero-copy">
          <span className="eyebrow light">
            {isOwner
              ? copy("PROPERTY OPERATIONS", "OPERAÇÕES IMOBILIÁRIAS")
              : tr("dashboard.tenantEyebrow")}
          </span>
          <h2>
            {isOwner
              ? copy(
                  "Your properties, connected to their records.",
                  "Os seus imóveis, ligados aos respetivos registos.",
                )
              : copy("Your home, in one place.", "A sua casa, num só lugar.")}
          </h2>
          <p>
            {copy(
              "See what needs attention across rent, applications and repairs.",
              "Veja o que precisa de atenção nas rendas, candidaturas e reparações.",
            )}
          </p>
          {isOwner ? (
            <button
              type="button"
              className="button button-cream"
              onClick={() => go("portfolio")}
            >
              {tr("dashboard.viewProperties")}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          ) : featuredHome ? (
            <button
              type="button"
              className="button button-cream"
              onClick={() => onOpenProperty(featuredHome)}
            >
              {tr("dashboard.propertyDetails")}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="button button-cream"
              onClick={() => go("discover")}
            >
              {tr("common.properties")}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
        </div>
        {featuredHome && (
          <div className="operations-hero-home">
            <img src={featuredHome.image} alt={featuredHome.title} />
            <span>{featuredHome.title}</span>
          </div>
        )}
      </section>

      <section
        className="operations-metrics"
        aria-label={copy(
          "Workspace record summary",
          "Resumo dos registos deste espaço",
        )}
      >
        {metrics.map((metric) => (
          <button
            type="button"
            className="card operations-metric"
            key={metric.label}
            onClick={() => go(metric.view)}
          >
            <span className="operations-metric-icon">
              <metric.icon size={19} aria-hidden="true" />
            </span>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </section>

      <div className="operations-two-column">
        <section
          className="card operations-panel operations-rent-panel"
          aria-labelledby="operations-rent-title"
        >
          <header>
            <div>
              <span className="eyebrow">
                {copy("CURRENT PERIOD", "PERÍODO ATUAL")}
              </span>
              <h2 id="operations-rent-title">{currentPeriod}</h2>
            </div>
            {link(copy("Open rent records", "Abrir registos de renda"), "rent")}
          </header>
          {summary.currentRent.length ? (
            <>
              <div className="operations-rent-totals">
                <div>
                  <small>
                    {copy(
                      "Rent amount in records",
                      "Valor da renda nos registos",
                    )}
                  </small>
                  <strong>{money(summary.currentRentDueCents)}</strong>
                </div>
                <div>
                  <small>
                    {copy("Confirmed in records", "Confirmado nos registos")}
                  </small>
                  <strong>{money(summary.currentRentConfirmedCents)}</strong>
                </div>
              </div>
              <progress
                value={summary.currentRentConfirmedCount}
                max={summary.currentRent.length}
                aria-label={copy(
                  "Confirmed records this month",
                  "Registos confirmados este mês",
                )}
              />
              <p className="operations-muted">
                {copy(
                  `${summary.currentRentConfirmedCount} of ${summary.currentRent.length} records confirmed for this period.`,
                  `${summary.currentRentConfirmedCount} de ${summary.currentRent.length} registos confirmados neste período.`,
                )}
              </p>
              <div className="operations-rent-records">
                {summary.currentRent.map((record) => (
                  <div key={record.id}>
                    <span>
                      <strong>{record.property}</strong>
                      <small>
                        {copy("Due", "Vencimento")} {dayLabel(record.dueOn)}
                      </small>
                    </span>
                    {status(record.status)}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="operations-empty">
              <ClipboardList size={25} aria-hidden="true" />
              <p>
                {copy(
                  "There is no rent record for this month. Earlier periods remain available in rent records.",
                  "Não existe um registo de renda para este mês. Os períodos anteriores continuam disponíveis nos registos de renda.",
                )}
              </p>
            </div>
          )}
          <div className="operations-rent-followup">
            <span>
              {copy("Details to add", "Dados por adicionar")}{" "}
              <b>{number(summary.rentNeedsDetails.length)}</b>
            </span>
            <span>
              {copy("Corrections requested", "Correções solicitadas")}{" "}
              <b>{number(summary.rentNeedsCorrection.length)}</b>
            </span>
            <small>
              {copy("All recorded periods", "Todos os períodos registados")}
            </small>
          </div>
          <p className="operations-muted">
            {copy(
              "These are transfer records. Rent moves directly between tenant and landlord; Kasa does not process it.",
              "Estes são registos de transferências. A renda passa diretamente do inquilino para o senhorio; a Kasa não a processa.",
            )}
          </p>
        </section>

        <section
          className="card operations-panel"
          aria-labelledby="operations-visits-title"
        >
          <header>
            <h2 id="operations-visits-title">
              {copy("Upcoming recorded visits", "Próximas visitas registadas")}
            </h2>
            {link(tr("common.maintenance"), "maintenance")}
          </header>
          {summary.nextVisits.length ? (
            <ul className="operations-visits">
              {summary.nextVisits.slice(0, 3).map(({ record, startsAt }) => (
                <li key={record.id}>
                  <span className="operations-visit-icon">
                    <CalendarDays size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <time dateTime={new Date(startsAt).toISOString()}>
                      {new Date(startsAt).toLocaleString(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    <strong>{record.title}</strong>
                    <small>
                      {record.property} · {record.visit?.provider}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="operations-empty">
              <CalendarDays size={26} aria-hidden="true" />
              <p>
                {copy(
                  "No future maintenance visits are recorded.",
                  "Não há visitas de manutenção futuras registadas.",
                )}
              </p>
            </div>
          )}
          <p className="operations-muted">
            {copy(
              "Dates entered in this workspace. Arrange attendance directly with the provider.",
              "Datas introduzidas neste espaço. Combine a presença diretamente com o prestador.",
            )}
          </p>
        </section>
      </div>

      <div className="operations-two-column">
        <section
          className="card operations-panel"
          aria-labelledby="operations-applications-title"
        >
          <header>
            <h2 id="operations-applications-title">
              {copy("Recent applications", "Candidaturas recentes")}
            </h2>
            {link(tr("common.viewAll"), "applications")}
          </header>
          <div className="operations-record-list">
            {summary.applicationRecords.slice(0, 3).map((record) => (
              <button
                type="button"
                className="operations-record-link"
                key={record.id}
                onClick={() => go("applications")}
              >
                <span className="operations-record-icon">
                  <FileCheck2 size={19} aria-hidden="true" />
                </span>
                <span className="operations-record-copy">
                  <strong>
                    {isOwner
                      ? record.applicant
                      : `${copy("Application", "Candidatura")} #${100 + record.id}`}
                  </strong>
                  <small>{record.property}</small>
                </span>
                {status(record.status)}
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
          {!summary.applicationRecords.length && (
            <p className="operations-empty-copy">
              {copy(
                "No applications are recorded in this workspace.",
                "Não há candidaturas registadas neste espaço.",
              )}
            </p>
          )}
        </section>

        <section
          className="card operations-panel"
          aria-labelledby="operations-maintenance-title"
        >
          <header>
            <h2 id="operations-maintenance-title">
              {copy("Open repairs", "Reparações em aberto")}
            </h2>
            {link(tr("common.viewAll"), "maintenance")}
          </header>
          <div className="operations-record-list">
            {summary.openMaintenance.slice(0, 3).map((record) => (
              <button
                type="button"
                className="operations-record-link"
                key={record.id}
                onClick={() => go("maintenance")}
              >
                <span className="operations-record-icon">
                  <Wrench size={19} aria-hidden="true" />
                </span>
                <span className="operations-record-copy">
                  <strong>{record.title}</strong>
                  <small>{record.property}</small>
                </span>
                {status(record.status)}
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
          {!summary.openMaintenance.length && (
            <p className="operations-empty-copy">
              {copy(
                "No maintenance requests are currently open.",
                "Não há pedidos de manutenção em aberto.",
              )}
            </p>
          )}
        </section>
      </div>

      <section
        className="card operations-panel"
        aria-labelledby="operations-properties-title"
      >
        <header>
          <h2 id="operations-properties-title">
            {isOwner
              ? copy("Your property records", "Os seus registos de imóveis")
              : copy("Your home record", "O registo da sua casa")}
          </h2>
        </header>
        <div className="operations-property-grid">
          {summary.properties.map((property) => (
            <button
              type="button"
              className="operations-property-link"
              key={property.id}
              onClick={() => onOpenProperty(property)}
            >
              <img src={property.image} alt="" loading="lazy" />
              <span>
                <strong>{property.title}</strong>
                <small>{property.address}</small>
                <small>
                  {copy("Listing party", "Anunciante")}: {property.landlord}
                </small>
              </span>
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          ))}
        </div>
        {!summary.properties.length && (
          <p className="operations-empty-copy">
            {copy(
              "No property records are linked to this workspace.",
              "Não há registos de imóveis associados a este espaço.",
            )}
          </p>
        )}
      </section>

      <section
        className="card operations-panel"
        aria-labelledby="operations-history-title"
      >
        <header>
          <h2 id="operations-history-title">
            <History size={18} aria-hidden="true" />
            {copy("Recent record activity", "Atividade recente dos registos")}
          </h2>
        </header>
        {summary.recentActivity.length ? (
          <ol className="operations-history">
            {summary.recentActivity.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => go(entry.view)}>
                  <span>
                    <strong>{entry.label}</strong>
                    <small>{entry.property}</small>
                  </span>
                  <time dateTime={entry.at}>
                    {new Date(entry.at).toLocaleString(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="operations-empty-copy">
            {copy(
              "No record activity yet.",
              "Ainda não há atividade nos registos.",
            )}
          </p>
        )}
      </section>
      <p className="operations-session-note">
        {copy(
          "Sample workspace · Summaries update from records in this tab. Reloading starts a new session.",
          "Espaço de exemplo · Os resumos refletem os registos deste separador. Recarregar inicia uma nova sessão.",
        )}
      </p>
    </div>
  );
}
