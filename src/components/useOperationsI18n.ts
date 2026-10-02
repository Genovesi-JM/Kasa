import { useTranslation } from "react-i18next";
import applicationI18n from "../i18n";
import {
  documentIssueText,
  operationsLanguage,
  operationsLocales,
  operationsResources,
  operationText,
} from "../locales/operations";
import type {
  OperationsKey,
  OperationsValues,
} from "../locales/operations/types";
import type { DocumentIssue } from "./documentState";

// This module is loaded with the operational screens, so their dictionaries
// stay out of the initial app bundle. Register before the first hook renders.
for (const [language, messages] of Object.entries(operationsResources)) {
  applicationI18n.addResourceBundle(
    language,
    "operations",
    messages,
    true,
    true,
  );
}

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
