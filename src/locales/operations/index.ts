import type { i18n as I18n } from "i18next";
import type { LanguageCode } from "../../i18n";
import type {
  DocumentCategory,
  DocumentIssue,
} from "../../components/documentState";
import { en } from "./en";
import { pt } from "./pt";
import { es } from "./es";
import { fr } from "./fr";
import { ar } from "./ar";
import { zh } from "./zh";
import type {
  OperationsDictionary,
  OperationsKey,
  OperationsValues,
} from "./types";

export const operationsResources = { en, pt, es, fr, ar, zh } satisfies Record<
  LanguageCode,
  OperationsDictionary
>;
export const operationsLocales: Record<LanguageCode, string> = {
  pt: "pt-PT",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar",
  zh: "zh-CN",
};

export function operationsLanguage(language: string | undefined): LanguageCode {
  const base = language?.split("-")[0];
  return base && Object.hasOwn(operationsResources, base)
    ? (base as LanguageCode)
    : "pt";
}

// Match the existing application convention for Arabic and Chinese labels.
function bilingual(localized: string, english: string, language: LanguageCode) {
  return (language === "ar" || language === "zh") && localized !== english
    ? `${localized} (${english})`
    : localized;
}

export function operationText(
  i18n: I18n,
  language: LanguageCode,
  key: OperationsKey,
  values?: OperationsValues,
): string {
  const render = (lng: LanguageCode) => {
    let messageKey: string = key;
    if (typeof values?.count === "number") {
      // Resource language codes stay stable; plural grammar follows the display locale.
      const plural = new Intl.PluralRules(operationsLocales[lng]).select(
        values.count,
      );
      const pluralKey = `${key}_${plural}`;
      if (Object.hasOwn(operationsResources[lng], pluralKey))
        messageKey = pluralKey;
    }
    return i18n.getFixedT(lng, "operations")(messageKey, values);
  };
  return bilingual(render(language), render("en"), language);
}

export const documentCategoryKeys = {
  "Lease & property": "documents_categoryLeaseProperty",
  "Rent & maintenance": "documents_categoryRentMaintenance",
  "Personal records": "documents_categoryPersonal",
  "Service records": "documents_categoryService",
  "Venue records": "documents_categoryVenue",
  "Platform records": "documents_categoryPlatform",
  Other: "documents_categoryOther",
} as const satisfies Record<DocumentCategory, OperationsKey>;

export const documentSourceKeys = {
  "All documents": "documents_allDocuments",
  "Local files": "documents_localFiles",
  "Sample previews": "documents_samplePreviews",
} as const satisfies Record<string, OperationsKey>;

export const documentSortKeys = {
  "Recently added": "documents_recentlyAdded",
  "Document name": "documents_documentName",
  "Largest first": "documents_largestFirst",
} as const satisfies Record<string, OperationsKey>;

export const documentIssueKeys = {
  empty: "documents_errorEmpty",
  fileTooLarge: "documents_errorFileTooLarge",
  unsupportedFormat: "documents_errorUnsupportedFormat",
  unavailableCategory: "documents_errorUnavailableCategory",
  alreadyAdded: "documents_errorAlreadyAdded",
  workspaceFull: "documents_errorWorkspaceFull",
  nothingToRestore: "documents_errorNothingToRestore",
  restoreDuplicate: "documents_errorRestoreDuplicate",
  restoreFull: "documents_errorRestoreFull",
} as const satisfies Record<DocumentIssue["code"], OperationsKey>;

export function documentIssueText(
  i18n: I18n,
  language: LanguageCode,
  issue: DocumentIssue,
): string {
  const render = (lng: LanguageCode) => {
    const t = i18n.getFixedT(lng, "operations");
    const message = t(documentIssueKeys[issue.code]);
    return issue.fileName === undefined
      ? message
      : t("documents_fileError", { fileName: issue.fileName, message });
  };
  return bilingual(render(language), render("en"), language);
}
