import { useEffect, useId, useState } from "react";
import { useViewingCopy } from "./viewingCopy";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { properties } from "../data";
import type { Role } from "../types";
import {
  scopedViewingRequests,
  upcomingAgreedViewings,
  viewingCounts,
  type PropertyRequestState,
} from "./propertyRequestState";
import "./propertyViewingsSummary.css";

interface PropertyViewingsSummaryProps {
  role: Role;
  state: PropertyRequestState;
  onOpenRequest: (id: string) => void;
  onOpenViewings: () => void;
  onOpenDecisions?: () => void;
}

export function PropertyViewingsSummary({
  role,
  state,
  onOpenRequest,
  onOpenViewings,
  onOpenDecisions,
}: PropertyViewingsSummaryProps) {
  const { text, tr, locale, number } = useViewingCopy();
  const id = useId();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const records = scopedViewingRequests(state, role);
  const counts = viewingCounts(state, role, now);
  const upcoming = upcomingAgreedViewings(state, role, now);
  const shown = upcoming.slice(0, 3);
  const awaitingDecision =
    role === "landlord" ? counts.pending : counts.proposed;
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const decisionLabel = tr(
    role === "landlord" ? "viewings_ownerDecision" : "viewings_tenantDecision",
    { count: awaitingDecision, shownCount: number(awaitingDecision) },
  );

  if (role !== "tenant" && role !== "landlord") return null;

  return (
    <section
      className="card property-viewings-summary"
      aria-labelledby={`${id}-title`}
    >
      <header>
        <div>
          <CalendarDays size={21} aria-hidden="true" />
          <h2 id={`${id}-title`}>
            {text("Property viewings", "Visitas aos imóveis")}
          </h2>
        </div>
        <button type="button" className="text-button" onClick={onOpenViewings}>
          {text("Open requests", "Ver pedidos")}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </header>

      {awaitingDecision > 0 ? (
        <button
          type="button"
          className="property-viewings-summary-decision"
          onClick={onOpenDecisions ?? onOpenViewings}
        >
          <Clock3 size={17} aria-hidden="true" />
          <span>{decisionLabel}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      ) : (
        <p className="property-viewings-summary-clear">
          {text(
            "No requests await your decision.",
            "Nenhum pedido aguarda a sua decisão.",
          )}
        </p>
      )}

      {shown.length > 0 ? (
        <>
          <div className="property-viewings-summary-subheading">
            <h3>
              {text("Upcoming agreed times", "Próximos horários aceites")}
            </h3>
            <span>
              {upcoming.length > shown.length
                ? tr("viewings_upcomingSubset", {
                    shown: number(shown.length),
                    total: number(upcoming.length),
                  })
                : text("Local time", "Hora local")}
            </span>
          </div>
          <ol className="property-viewings-summary-list">
            {shown.map((request) => {
              const property = properties.find(
                (item) => item.id === request.propertyId,
              )!;
              const terms = request.agreedTerms!;
              const startsAt = `${terms.date}T${terms.time}:00`;
              return (
                <li key={request.id}>
                  <button
                    type="button"
                    onClick={() => onOpenRequest(request.id)}
                  >
                    <span className="property-viewings-summary-details">
                      <time dateTime={startsAt}>{date(startsAt)}</time>
                      <strong>{property.title}</strong>
                      <span>
                        {role === "landlord"
                          ? request.tenantName
                          : property.landlord}
                      </span>
                      {request.status === "Proposed" && (
                        <small>
                          {text(
                            "Change proposed; current time retained",
                            "Alteração proposta; horário atual mantido",
                          )}
                        </small>
                      )}
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <div className="property-viewings-summary-empty">
          <p>
            {records.length
              ? text(
                  "No upcoming viewing has an agreed time.",
                  "Nenhuma visita futura tem um horário aceite.",
                )
              : text(
                  "No viewing requests yet.",
                  "Ainda não há pedidos de visita.",
                )}
          </p>
          <span>
            {records.length
              ? text(
                  "Open requests to review proposed times and history.",
                  "Abra os pedidos para consultar propostas de horário e o histórico.",
                )
              : role === "tenant"
                ? text(
                    "You can request a viewing from a property listing.",
                    "Pode pedir uma visita a partir de um anúncio de imóvel.",
                  )
                : text(
                    "Requests for your properties will appear here.",
                    "Os pedidos relativos aos seus imóveis aparecem aqui.",
                  )}
          </span>
        </div>
      )}
    </section>
  );
}
