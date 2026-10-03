import type { OperationsKey } from "../locales/operations/types";
import {
  viewingPhraseKeys,
  type ViewingPhrase,
} from "../locales/operations/viewingPhraseKeys";
import { useOperationsI18n } from "./useOperationsI18n";

export type { ViewingPhrase } from "../locales/operations/viewingPhraseKeys";

const statusKeys: Record<string, OperationsKey> = {
  All: "viewings_filterAll",
  Pending: "viewings_statusPending",
  Proposed: "viewings_statusProposed",
  Agreed: "viewings_statusAgreed",
  Declined: "viewings_statusDeclined",
  Cancelled: "viewings_statusCancelled",
  History: "viewings_filterHistory",
};
const proposalKeys: Record<string, OperationsKey> = {
  Pending: "viewings_proposalPending",
  Accepted: "viewings_proposalAccepted",
  Declined: "viewings_proposalDeclined",
  Superseded: "viewings_proposalSuperseded",
  Withdrawn: "viewings_proposalWithdrawn",
};
const issueKeys: Record<string, OperationsKey> = {
  unavailable: "viewings_errorUnavailable",
  role: "viewings_errorRole",
  invalidProperty: "viewings_errorProperty",
  invalidDate: "viewings_errorDate",
  invalidTime: "viewings_errorTime",
  noteTooLong: "viewings_errorNoteLong",
  noteRequired: "viewings_errorNoteRequired",
  duplicate: "viewings_errorDuplicate",
  status: "viewings_errorStatus",
  staleProposal: "viewings_errorStaleProposal",
  noChanges: "viewings_errorNoChanges",
  pastTime: "viewings_errorPastTime",
};
const historyKeys: Record<string, OperationsKey> = {
  requested: "viewings_historyRequested",
  accepted: "viewings_historyAccepted",
  declined: "viewings_historyDeclined",
  proposed: "viewings_historyProposed",
  "proposal-accepted": "viewings_historyProposalAccepted",
  "proposal-declined": "viewings_historyProposalDeclined",
  cancelled: "viewings_historyCancelled",
};

export function useViewingCopy() {
  const { tr, language, locale } = useOperationsI18n();
  // Keep static bilingual callsites readable while checking every phrase at compile time.
  const text = (english: ViewingPhrase, pt?: string) => {
    void pt;
    return tr(viewingPhraseKeys[english]);
  };
  // The shared property request component also hosts the separately scoped rental form.
  const legacyText = (english: string, pt: string) =>
    language === "pt" ? pt : english;
  const date = (value: string, includeTime = false) => {
    const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...(includeTime
            ? ({ hour: "2-digit", minute: "2-digit" } as const)
            : {}),
        }).format(parsed)
      : value;
  };
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const status = (value: string) =>
    statusKeys[value] ? tr(statusKeys[value]) : value;
  const proposalStatus = (value: string) =>
    proposalKeys[value] ? tr(proposalKeys[value]) : value;
  const issueText = (issue: string) =>
    tr(issueKeys[issue] ?? "viewings_errorFallback");
  const history = (action: string) =>
    historyKeys[action] ? tr(historyKeys[action]) : action;
  const calendar = {
    download: tr("viewings_calendarDownload"),
    hint: tr("viewings_calendarHint"),
    summary: tr("viewings_calendarSummary"),
    description: tr("viewings_calendarDescription"),
    started: tr("viewings_calendarStarted"),
    failed: tr("viewings_calendarFailed"),
    unavailable: tr("viewings_calendarUnavailable"),
  };
  return {
    text,
    legacyText,
    tr,
    language,
    locale,
    number,
    date,
    status,
    proposalStatus,
    issueText,
    history,
    scope: tr("viewings_scope"),
    calendar,
  };
}
