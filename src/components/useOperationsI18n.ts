import { useTranslation } from "react-i18next";
import {
  documentIssueText,
  operationsLanguage,
  operationsLocales,
  operationText,
} from "../locales/operations";
import type {
  OperationsKey,
  OperationsValues,
} from "../locales/operations/types";
import type { DocumentIssue } from "./documentState";

export function useOperationsI18n() {
  const { i18n } = useTranslation("operations");
  const language = operationsLanguage(i18n.resolvedLanguage || i18n.language);
  return {
    language,
    locale: operationsLocales[language],
    tr: (key: OperationsKey, values?: OperationsValues) =>
      operationText(i18n, language, key, values),
    issueText: (issue: DocumentIssue) =>
      documentIssueText(i18n, language, issue),
  };
}
