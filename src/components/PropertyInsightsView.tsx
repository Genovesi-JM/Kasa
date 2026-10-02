import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
} from "lucide-react";
import type { Property, View } from "../types";
import type { PropertyOperationsSummary } from "./propertyOperationsSummary";
import { buildPropertyInsights } from "./propertyInsightsSummary";
import "./propertyInsights.css";

export function PropertyInsights({
  summary,
  go,
  onOpenProperty,
  selectedPeriod,
  onPeriodChange,
  onOpenRentPeriod,
}: {
  summary: PropertyOperationsSummary;
  go: (view: View) => void;
  onOpenProperty: (property: Property) => void;
  selectedPeriod?: string;
  onPeriodChange: (period: string) => void;
  onOpenRentPeriod: (period: string) => void;
}) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const pt = language.startsWith("pt");
  const copy = (en: string, portuguese: string) => (pt ? portuguese : en);
  const locale =
    (
      {
        pt: "pt-PT",
        en: "en-GB",
        es: "es-ES",
        fr: "fr-FR",
        ar: "ar",
        zh: "zh-CN",
      } as Record<string, string>
    )[language] ?? "en-GB";
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const month = (period: string) =>
    new Date(`${period}-01T12:00:00`).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
  const data = buildPropertyInsights(summary, selectedPeriod);
  const open = (view: View) =>
    view === "rent" ? onOpenRentPeriod(data.period) : go(view);
  const highestAmount = Math.max(1, ...data.history.map((row) => row.dueCents));
  const recordsLabel = (count: number) =>
    `${number(count)} ${copy(count === 1 ? "rent record" : "rent records", count === 1 ? "registo de renda" : "registos de renda")}`;
  const metrics = [
    {
      label: copy("Properties in your workspace", "Imóveis nesta área"),
      value: number(data.properties.length),
      note: copy("Your property records", "Os seus registos de imóveis"),
      icon: Building2,
      view: "portfolio" as const,
    },
    {
      label: copy("Rent amount recorded", "Valor da renda registado"),
      value: data.totals.count ? money(data.totals.dueCents) : "—",
      note: recordsLabel(data.totals.count),
      icon: CircleDollarSign,
      view: "rent" as const,
    },
    {
      label: copy("Confirmed in records", "Confirmado nos registos"),
      value: data.totals.count ? money(data.totals.confirmedCents) : "—",
      note: recordsLabel(data.totals.confirmedCount),
      icon: CheckCircle2,
      view: "rent" as const,
    },
    {
      label: copy("Not yet confirmed", "Ainda por confirmar"),
      value: data.totals.count ? money(data.totals.unconfirmedCents) : "—",
      note: recordsLabel(data.totals.count - data.totals.confirmedCount),
      icon: Clock3,
      view: "rent" as const,
    },
  ];
  return (
    <div className="page-stack property-insights">
      <section className="card padded insights-heading">
        <div>
          <span className="eyebrow">
            {copy("YOUR PROPERTY RECORDS", "OS SEUS REGISTOS DE IMÓVEIS")}
          </span>
          <h2>
            {copy(
              "Know what is recorded. See what needs attention.",
              "Veja os registos e o que precisa de atenção.",
            )}
          </h2>
          <p>
            {copy(
              "Amounts come from your rent records. They are not bank-verified income, property valuations or occupancy estimates.",
              "Os valores vêm dos seus registos de renda. Não representam rendimentos verificados pelo banco, avaliações de imóveis ou estimativas de ocupação.",
            )}
          </p>
        </div>
        <label>
          {copy("Rent period", "Período da renda")}
          <select
            value={data.period}
            onChange={(event) => onPeriodChange(event.target.value)}
          >
            {data.periods.map((period) => (
              <option key={period} value={period}>
                {month(period)}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section
        className="insights-metrics"
        aria-label={copy(
          "Selected period summary",
          "Resumo do período selecionado",
        )}
      >
        {metrics.map(({ label, value, note, icon: Icon, view }) => (
          <button
            className="card insights-metric"
            key={label}
            onClick={() => open(view)}
          >
            <span className="insights-metric-label">
              <Icon size={18} aria-hidden="true" />
              {label}
            </span>
            <strong>{value}</strong>
            <span>
              {note}
              <ArrowRight size={16} aria-hidden="true" />
            </span>
          </button>
        ))}
      </section>
      {!data.totals.count && (
        <p className="scope-note" role="status">
          {copy(
            "No rent records exist for this period. An empty period does not establish unpaid rent or a vacant property.",
            "Não existem registos de renda para este período. Um período vazio não indica rendas em falta ou um imóvel desocupado.",
          )}
        </p>
      )}
      <div className="insights-columns">
        <section
          className="card padded insights-history"
          aria-labelledby="insights-history-title"
        >
          <div className="insights-section-heading">
            <div>
              <h2 id="insights-history-title">
                {copy("Recorded periods", "Períodos registados")}
              </h2>
              <p>
                {copy(
                  "Compare amounts and explicit owner confirmations.",
                  "Compare os valores e as confirmações explícitas do proprietário.",
                )}
              </p>
            </div>
          </div>
          <div className="insights-legend">
            <span>
              <i className="is-confirmed" />
              {copy("Confirmed", "Confirmado")}
            </span>
            <span>
              <i />
              {copy("Not confirmed", "Por confirmar")}
            </span>
          </div>
          <ol className="insights-periods">
            {data.history.map((row) => (
              <li key={row.period}>
                <button
                  className={row.period === data.period ? "is-selected" : ""}
                  aria-pressed={row.period === data.period}
                  onClick={() => onPeriodChange(row.period)}
                >
                  <span className="insights-period-label">
                    <strong>{month(row.period)}</strong>
                    <span>
                      {row.count
                        ? money(row.dueCents)
                        : copy("No records", "Sem registos")}
                    </span>
                  </span>
                  <span className="insights-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${(row.dueCents / highestAmount) * 100}%`,
                      }}
                    >
                      <i
                        style={{
                          width: `${row.dueCents ? (row.confirmedCents / row.dueCents) * 100 : 0}%`,
                        }}
                      />
                    </span>
                  </span>
                  <span className="insights-period-note">
                    {recordsLabel(row.count)} ·{" "}
                    {copy("confirmed", "confirmado")}:{" "}
                    {money(row.confirmedCents)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="card padded insights-attention"
          aria-labelledby="insights-attention-title"
        >
          <h2 id="insights-attention-title">
            {copy("Next steps", "Próximos passos")}
          </h2>
          <p>
            {copy(
              "Rent checks use the selected period. Applications and maintenance include all open records.",
              "As rendas correspondem ao período selecionado. As candidaturas e a manutenção incluem todos os registos em aberto.",
            )}
          </p>
          <ul>
            {[
              {
                label: copy(
                  "Transfer details to add",
                  "Dados de transferência por adicionar",
                ),
                count: data.totals.needsDetails,
                view: "rent" as const,
              },
              {
                label: copy(
                  "Transfers awaiting your review",
                  "Transferências a aguardar a sua análise",
                ),
                count: data.totals.needsReview,
                view: "rent" as const,
              },
              {
                label: copy(
                  "Transfer corrections requested",
                  "Correções de transferência solicitadas",
                ),
                count: data.totals.needsCorrection,
                view: "rent" as const,
              },
              {
                label: copy("Open applications", "Candidaturas em aberto"),
                count: summary.pendingApplications.length,
                view: "applications" as const,
              },
              {
                label: copy(
                  "Application responses to review",
                  "Respostas de candidaturas por analisar",
                ),
                count: data.evidenceAwaitingReview,
                view: "applications" as const,
              },
              {
                label: copy(
                  "Open maintenance requests",
                  "Pedidos de manutenção em aberto",
                ),
                count: summary.openMaintenanceCount,
                view: "maintenance" as const,
              },
            ].map((item) => (
              <li key={item.label}>
                <button onClick={() => open(item.view)}>
                  <span>{item.label}</span>
                  <strong>{number(item.count)}</strong>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section
        className="card padded insights-properties"
        aria-labelledby="insights-properties-title"
      >
        <div className="insights-section-heading">
          <div>
            <h2 id="insights-properties-title">
              {copy("By property", "Por imóvel")}
            </h2>
            <p>{month(data.period)}</p>
          </div>
          <button className="text-button" onClick={() => open("rent")}>
            {copy("Open rent records", "Abrir registos de renda")}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {!data.properties.length && (
          <p>
            {copy(
              "No property records are available in this workspace.",
              "Não existem registos de imóveis nesta área.",
            )}
          </p>
        )}
        {data.properties.map((row) => (
          <article key={row.property.id}>
            <button
              className="insights-property-link"
              onClick={() => onOpenProperty(row.property)}
            >
              <img src={row.property.image} alt="" />
              <span>
                <strong>{row.property.title}</strong>
                <small>{row.property.address}</small>
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <dl>
              <div>
                <dt>{copy("Rent recorded", "Renda registada")}</dt>
                <dd>
                  {row.count
                    ? money(row.dueCents)
                    : copy("No records", "Sem registos")}
                </dd>
              </div>
              <div>
                <dt>{copy("Confirmed", "Confirmado")}</dt>
                <dd>{row.count ? money(row.confirmedCents) : "—"}</dd>
              </div>
              <div>
                <dt>{copy("Open applications", "Candidaturas em aberto")}</dt>
                <dd>{number(row.openApplications)}</dd>
              </div>
              <div>
                <dt>{copy("Open repairs", "Reparações em aberto")}</dt>
                <dd>{number(row.openMaintenance)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
      <p className="insights-session-note">
        {copy(
          "Sample workspace · These summaries update with this tab’s records. Reloading starts a new session.",
          "Área de exemplo · Os resumos acompanham os registos deste separador. Recarregar inicia uma nova sessão.",
        )}
      </p>
    </div>
  );
}
