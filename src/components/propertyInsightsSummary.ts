import type { PropertyOperationsSummary } from "./propertyOperationsSummary";
import type { RentRecord } from "./rentRecordState";
import { applicationEvidenceSummary } from "./applicationState";
import {
  expenseCategories,
  expenseProperties,
  scopedExpenseRecords,
  type ExpenseRecord,
  type ExpenseState,
} from "./expenseState";

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

function expenseTotals(records: readonly ExpenseRecord[]) {
  return {
    count: records.length,
    totalCents: records.reduce((sum, record) => sum + record.amountCents, 0),
  };
}

function canonicalPeriod(period: string): boolean {
  return (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && Number(period.slice(0, 4)) > 0
  );
}

/** Summarize recorded amounts only; listing prices never imply income or occupancy. */
export function buildPropertyInsights(
  summary: PropertyOperationsSummary,
  selectedPeriod?: string,
  expenseState?: ExpenseState,
) {
  const ids = new Set(summary.properties.map((property) => property.id));
  const rent = summary.rentRecords.filter((record) =>
    ids.has(record.propertyId),
  );
  const ownerProperties =
    summary.role === "landlord"
      ? expenseProperties(summary.role).filter((property) =>
          ids.has(property.id),
        )
      : [];
  const expensePropertyIds = new Set(
    ownerProperties.map((property) => property.id),
  );
  const expenses =
    summary.role === "landlord" && expenseState
      ? scopedExpenseRecords(expenseState, summary.role).filter((record) =>
          expensePropertyIds.has(record.propertyId),
        )
      : [];
  const expensePeriods = expenses
    .map((record) => record.date.slice(0, 7))
    .filter(canonicalPeriod);
  // Keep an explicitly selected month after its last expense is moved or removed.
  const retainedPeriod =
    summary.role === "landlord" &&
    expenseState &&
    selectedPeriod &&
    canonicalPeriod(selectedPeriod) &&
    selectedPeriod <= summary.currentPeriod
      ? [selectedPeriod]
      : [];
  const periods = [
    ...new Set([
      summary.currentPeriod,
      ...rent.map((record) => record.period),
      ...expensePeriods,
      ...retainedPeriod,
    ]),
  ]
    .sort()
    .reverse();
  const period =
    selectedPeriod && periods.includes(selectedPeriod)
      ? selectedPeriod
      : summary.currentPeriod;
  const records = rent.filter((record) => record.period === period);
  const periodExpenses = expenses.filter(
    (record) => record.date.slice(0, 7) === period,
  );
  return {
    periods,
    period,
    totals: rentTotals(records),
    expenses: {
      ...expenseTotals(periodExpenses),
      byCategory: expenseCategories.map((category) => ({
        category,
        ...expenseTotals(
          periodExpenses.filter((record) => record.category === category),
        ),
      })),
      byProperty: ownerProperties.map((property) => ({
        propertyId: property.id,
        ...expenseTotals(
          periodExpenses.filter((record) => record.propertyId === property.id),
        ),
      })),
    },
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
