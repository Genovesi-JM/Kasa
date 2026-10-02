import type {
  RentCsvLabels,
  RentRecordFilters,
  RentStatus,
  RentSummaryLabels,
  RentTransferDraft,
} from "../../components/rentRecordState";
import type { OperationsKey, OperationsValues } from "./types";

type Translate = (key: OperationsKey, values?: OperationsValues) => string;

export const rentStatusKeys = {
  "Awaiting transfer details": "rent_statusAwaitingDetails",
  "Awaiting owner confirmation": "rent_statusAwaitingOwner",
  "Needs correction": "rent_statusCorrection",
  Confirmed: "rent_statusConfirmed",
} as const satisfies Record<RentStatus, OperationsKey>;

export const rentIssueKeys = {
  amount: "rent_errorAmount",
  transferredOn: "rent_errorDate",
  reference: "rent_errorReference",
  note: "rent_errorNote",
} as const satisfies Record<keyof RentTransferDraft, OperationsKey>;

export const rentSortKeys = {
  "Most recently updated": "rent_recentlyUpdated",
  "Amount: high to low": "rent_amountHighLow",
  "Property name": "rent_propertyName",
} as const satisfies Record<RentRecordFilters["sort"], OperationsKey>;

export function rentFormatters(locale: string) {
  return {
    money: (cents: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
      }).format(cents / 100),
    dateLabel: (value: string) =>
      new Date(`${value}T12:00:00`).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    periodLabel: (value: string) =>
      new Date(`${value}-01T12:00:00`).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      }),
  };
}

export function localizedRentSummaryLabels(
  tr: Translate,
  locale: string,
): RentSummaryLabels {
  const { money, dateLabel, periodLabel } = rentFormatters(locale);
  return {
    scope: tr("rent_summaryScope"),
    bankNotice: tr("rent_summaryBankNotice"),
    record: tr("rent_recordId"),
    period: tr("rent_period"),
    property: tr("rent_property"),
    tenant: tr("rent_tenant"),
    owner: tr("rent_owner"),
    amountDue: tr("rent_amountDue"),
    status: tr("rent_status"),
    reference: tr("rent_reference"),
    transfer: (amount, date) => tr("rent_summaryTransfer", { amount, date }),
    formatMoney: money,
    formatDate: dateLabel,
    formatPeriod: periodLabel,
    formatStatus: (status) => tr(rentStatusKeys[status]),
  };
}

export function localizedRentCsvLabels(tr: Translate): RentCsvLabels {
  return {
    headers: [
      tr("rent_csvScope"),
      tr("rent_recordId"),
      tr("rent_period"),
      tr("rent_tenant"),
      tr("rent_property"),
      tr("rent_csvAmountDue"),
      tr("rent_csvRecordedAmount"),
      tr("rent_transferDate"),
      tr("rent_reference"),
      tr("rent_status"),
      tr("rent_correctionNote"),
      tr("rent_note"),
    ],
    scope: tr("rent_csvScopeValue"),
  };
}
