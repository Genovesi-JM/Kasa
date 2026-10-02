import type { PropertyOperationsSummary } from "./propertyOperationsSummary";
import type { RentRecord } from "./rentRecordState";
import { applicationEvidenceSummary } from "./applicationState";

function rentTotals(records: RentRecord[]) {
  const dueCents = records.reduce(
    (sum, record) => sum + record.amountDueCents,
    0,
  );
  const confirmed = records.filter((record) => record.status === "Confirmed");
  const confirmedCents = confirmed.reduce(
    (sum, record) => sum + record.amountDueCents,
    0,
  );
  return {
    count: records.length,
    dueCents,
    confirmedCount: confirmed.length,
    confirmedCents,
    unconfirmedCents: dueCents - confirmedCents,
    needsDetails: records.filter(
      (record) => record.status === "Awaiting transfer details",
    ).length,
    needsReview: records.filter(
      (record) => record.status === "Awaiting owner confirmation",
    ).length,
    needsCorrection: records.filter(
      (record) => record.status === "Needs correction",
    ).length,
  };
}

/** Summarize recorded amounts only; listing prices never imply income or occupancy. */
export function buildPropertyInsights(
  summary: PropertyOperationsSummary,
  selectedPeriod?: string,
) {
  const ids = new Set(summary.properties.map((property) => property.id));
  const rent = summary.rentRecords.filter((record) =>
    ids.has(record.propertyId),
  );
  const periods = [
    ...new Set([summary.currentPeriod, ...rent.map((record) => record.period)]),
  ]
    .sort()
    .reverse();
  const period =
    selectedPeriod && periods.includes(selectedPeriod)
      ? selectedPeriod
      : summary.currentPeriod;
  const records = rent.filter((record) => record.period === period);
  return {
    periods,
    period,
    totals: rentTotals(records),
    evidenceAwaitingReview: summary.applicationRecords
      .filter(
        (record) =>
          record.propertyId !== undefined && ids.has(record.propertyId),
      )
      .reduce(
        (count, record) =>
          count +
          applicationEvidenceSummary(record).unreviewedResponseIds.length,
        0,
      ),
    history: periods
      .slice()
      .reverse()
      .map((value) => ({
        period: value,
        ...rentTotals(rent.filter((record) => record.period === value)),
      })),
    properties: summary.properties.map((property) => ({
      property,
      ...rentTotals(
        records.filter((record) => record.propertyId === property.id),
      ),
      openApplications: summary.pendingApplications.filter(
        (record) => record.propertyId === property.id,
      ).length,
      openMaintenance: summary.openMaintenance.filter(
        (record) => record.propertyId === property.id,
      ).length,
    })),
  };
}
