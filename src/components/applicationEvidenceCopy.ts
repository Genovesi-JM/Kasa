import { useTranslation } from "react-i18next";
import type { ApplicationEvidenceIssue } from "./applicationState";

export function useApplicationCopy() {
  const { i18n } = useTranslation();
  const portuguese = (
    i18n.resolvedLanguage ??
    i18n.language ??
    "pt"
  ).startsWith("pt");
  const locale = portuguese ? "pt-PT" : "en-GB";
  const text = (english: string, pt: string) => (portuguese ? pt : english);
  const date = (value: string, withTime = false) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...(withTime
            ? ({ hour: "2-digit", minute: "2-digit" } as const)
            : {}),
        }).format(parsed)
      : value;
  };
  const documentName = (id: string, fallback: string) =>
    ({
      identity: text("Identity document", "Documento de identificação"),
      income: text("Proof of income", "Comprovativo de rendimentos"),
      reference: text("Rental reference", "Referência de arrendamento"),
    })[id] ?? fallback;
  const phase = (value: string) =>
    ({
      none: text("No evidence response", "Sem resposta documental"),
      requested: text("Response requested", "Resposta pedida"),
      submitted: text("Response saved locally", "Resposta guardada localmente"),
      reviewed: text("Response acknowledged", "Resposta consultada"),
    })[value] ?? value;
  const issueText = (issue: ApplicationEvidenceIssue) => {
    const messages: Record<ApplicationEvidenceIssue["code"], string> = {
      unavailable: text(
        "This action is no longer available for this application.",
        "Esta ação já não está disponível para esta candidatura.",
      ),
      staleRequest: text(
        "The request or draft changed. Review the current request before submitting a response.",
        "O pedido ou rascunho mudou. Reveja o pedido atual antes de guardar uma resposta.",
      ),
      emptyResponse: text(
        "Add at least one file, or write an explanation of at least 3 characters.",
        "Adicione pelo menos um ficheiro ou escreva uma explicação com pelo menos 3 caracteres.",
      ),
      noteTooLong: text(
        "Keep the note within 1,000 characters.",
        "Escreva uma nota com até 1.000 caracteres.",
      ),
      unknownDocument: text(
        "Choose a document listed in this request.",
        "Escolha um documento indicado neste pedido.",
      ),
      empty: text("The file is empty.", "O ficheiro está vazio."),
      fileTooLarge: text(
        "The file exceeds the 10 MB limit.",
        "O ficheiro excede o limite de 10 MB.",
      ),
      unsupportedFormat: text(
        "Choose a PDF, PNG, JPEG, GIF, WebP, TXT, MD or CSV file.",
        "Escolha um ficheiro PDF, PNG, JPEG, GIF, WebP, TXT, MD ou CSV.",
      ),
      alreadyAdded: text(
        "This file is already in the draft.",
        "Este ficheiro já está no rascunho.",
      ),
      evidenceFull: text(
        "Retained evidence has reached its 50 MB limit. Remove files from an unfinished draft to free space.",
        "Os documentos retidos atingiram o limite de 50 MB. Remova ficheiros de um rascunho por concluir para libertar espaço.",
      ),
      tooManyFiles: text(
        "Keep each response within 10 files.",
        "Adicione até 10 ficheiros por resposta.",
      ),
    };
    return issue.fileName
      ? `${issue.fileName}: ${messages[issue.code]}`
      : messages[issue.code];
  };
  return { text, date, documentName, phase, issueText, locale };
}
