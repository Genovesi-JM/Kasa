import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Search } from "lucide-react";
import type { Property, Role, View } from "../types";
import { matchesSearch } from "../search";
import type { PropertyOperationsSummary } from "./propertyOperationsSummary";
import { propertyOperationStatus } from "./propertyOperationStatus";
import { propertyPortfolioCopy } from "./propertyPortfolioCopy";
import "./propertyPortfolio.css";

export interface PortfolioFilters {
  status: string;
  query: string;
  sort: string;
}

export function PropertyPortfolio({
  role,
  go,
  summary,
  onOpenProperty,
  filters,
  setFilters,
  children,
}: {
  role: Role;
  go: (view: View) => void;
  summary: PropertyOperationsSummary | null;
  onOpenProperty: (property: Property) => void;
  filters: PortfolioFilters;
  setFilters: Dispatch<SetStateAction<PortfolioFilters>>;
  children?: ReactNode;
}) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || "pt";
  const copy = propertyPortfolioCopy(language);
  const locale = language === "pt" ? "pt-PT" : language;
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  if (role !== "landlord" || !summary)
    return (
      <section className="card padded">
        <h2>{copy.ownerTitle}</h2>
        <p>{copy.ownerNote}</p>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => go("overview")}
        >
          {copy.overview}
        </button>
      </section>
    );
  const hasRent = (property: Property) =>
    summary.rentRecords.some((record) => record.propertyId === property.id);
  const issues = (property: Property) =>
    summary.openMaintenance.filter(
      (record) => record.propertyId === property.id,
    ).length;
  const properties = summary.properties
    .filter(
      (property) =>
        (filters.status === "All properties" ||
          (hasRent(property) ? "With rent records" : "Without rent records") ===
            filters.status) &&
        matchesSearch(filters.query, property.title, property.address),
    )
    .sort((a, b) =>
      filters.sort === "Rent: high to low"
        ? b.price - a.price
        : filters.sort === "Open issues first"
          ? issues(b) - issues(a) || a.title.localeCompare(b.title, locale)
          : a.title.localeCompare(b.title, locale),
    );
  const changed =
    filters.status !== "All properties" ||
    Boolean(filters.query) ||
    filters.sort !== "Property name";
  const reset = () =>
    setFilters({ status: "All properties", query: "", sort: "Property name" });
  const statuses = [
    {
      value: "All properties",
      label: copy.all,
      count: summary.properties.length,
    },
    {
      value: "With rent records",
      label: copy.withRent,
      count: summary.properties.filter(hasRent).length,
    },
    {
      value: "Without rent records",
      label: copy.withoutRent,
      count: summary.properties.filter((property) => !hasRent(property)).length,
    },
  ];
  return (
    <div className="page-stack property-portfolio">
      {children}
      <section className="property-portfolio-records" aria-label={copy.heading}>
        <div>
          <h2>{copy.heading}</h2>
          <p className="property-portfolio-scope">{copy.scope}</p>
        </div>
        <div
          className="property-portfolio-segments"
          role="group"
          aria-label={copy.heading}
        >
          {statuses.map((status) => (
            <button
              type="button"
              key={status.value}
              aria-pressed={filters.status === status.value}
              onClick={() =>
                setFilters((current) => ({ ...current, status: status.value }))
              }
            >
              {status.label}
              <span>{number(status.count)}</span>
            </button>
          ))}
        </div>
        <div className="property-portfolio-filters">
          <label>
            <span>{copy.search}</span>
            <input
              type="search"
              placeholder={copy.searchPlaceholder}
              value={filters.query}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>{copy.sort}</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  sort: event.target.value,
                }))
              }
            >
              <option value="Property name">{copy.name}</option>
              <option value="Open issues first">{copy.issuesFirst}</option>
              <option value="Rent: high to low">{copy.rentHigh}</option>
            </select>
          </label>
          <button
            type="button"
            className="button button-secondary"
            disabled={!changed}
            onClick={reset}
          >
            {copy.reset}
          </button>
        </div>
        <p className="property-portfolio-count" role="status">
          {copy.result}: {number(properties.length)} /{" "}
          {number(summary.properties.length)}
        </p>
        <div className="property-portfolio-list">
          {properties.map((property) => {
            const currentRent = summary.currentRent.find(
              (record) => record.propertyId === property.id,
            );
            const repairCount = issues(property);
            const reviewRent = summary.rentAwaitingOwner.some(
              (record) => record.propertyId === property.id,
            );
            return (
              <article key={property.id} className="property-portfolio-card">
                <img src={property.image} alt="" loading="lazy" />
                <div className="property-portfolio-identity">
                  <span className="eyebrow">
                    {property.listingType === "Rent" ? copy.rental : copy.sale}
                  </span>
                  <h3>{property.title}</h3>
                  <p>{property.address}</p>
                </div>
                <dl className="property-portfolio-facts">
                  <div>
                    <dt>
                      {property.listingType === "Rent"
                        ? copy.monthlyRent
                        : copy.askingPrice}
                    </dt>
                    <dd>{money(property.price)}</dd>
                  </div>
                  <div>
                    <dt>{copy.rentRecords}</dt>
                    <dd>
                      {number(
                        summary.rentRecords.filter(
                          (record) => record.propertyId === property.id,
                        ).length,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.openRepairs}</dt>
                    <dd>{number(repairCount)}</dd>
                  </div>
                </dl>
                <div className="property-portfolio-status">
                  <small>{copy.period}</small>
                  <span
                    className={`pill pill-${currentRent?.status === "Confirmed" ? "mint" : "neutral"}`}
                  >
                    {propertyOperationStatus(
                      currentRent?.status ?? "No rent record this month",
                      language,
                    )}
                  </span>
                </div>
                <div className="property-portfolio-actions">
                  {(repairCount > 0 || reviewRent) && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() =>
                        go(repairCount > 0 ? "maintenance" : "rent")
                      }
                    >
                      {repairCount > 0 ? copy.reviewRepairs : copy.reviewRent}
                    </button>
                  )}
                  <button
                    type="button"
                    className="button"
                    aria-label={`${copy.open}: ${property.title}`}
                    onClick={() => onOpenProperty(property)}
                  >
                    {copy.open}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {properties.length === 0 && (
          <div className="property-portfolio-empty">
            <Search size={24} aria-hidden="true" />
            <h3>{copy.noMatches}</h3>
            <p>{copy.noMatchesHint}</p>
            {changed && (
              <button
                type="button"
                className="button button-secondary"
                onClick={reset}
              >
                {copy.reset}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
