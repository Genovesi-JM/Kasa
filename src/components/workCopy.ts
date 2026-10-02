import { useTranslation } from "react-i18next";

export function useWorkCopy() {
  const { i18n } = useTranslation();
  const portuguese = (
    i18n.resolvedLanguage ??
    i18n.language ??
    "pt"
  ).startsWith("pt");
  const locale = portuguese ? "pt-PT" : "en-GB";
  const copy = (en: string, pt: string) => (portuguese ? pt : en);
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
  const arrangement = (value: string) =>
    (
      ({
        All: copy("All arrangements", "Todos os regimes"),
        Freelance: copy("Freelance", "Trabalho independente"),
        Project: copy("Project", "Projeto"),
        "Part time": copy("Part time", "Tempo parcial"),
        "Full time": copy("Full time", "Tempo inteiro"),
      }) as Record<string, string>
    )[value] ?? value;
  const scope = copy(
    "Records stay in this tab until reload. No application is delivered outside this tab and no hiring decision or contract is created.",
    "Os registos ficam neste separador até recarregar. Nenhuma candidatura é entregue fora deste separador e nenhuma decisão de contratação ou contrato é criado.",
  );
  const availability = (value: string) =>
    (
      ({
        Immediately: copy("Immediately", "Imediatamente"),
        "Within 2 weeks": copy("Within 2 weeks", "Dentro de 2 semanas"),
        "Choose a date": copy("From a chosen date", "A partir de uma data"),
      }) as Record<string, string>
    )[value] ?? value;
  const applicationStatus = (value: string, reviewedAt?: string) =>
    value === "Withdrawn"
      ? copy("Withdrawn", "Retirada")
      : reviewedAt
        ? copy("Review recorded", "Análise registada")
        : copy("Submitted in this tab", "Submetida neste separador");
  const history = (action: string) =>
    (
      ({
        submitted: copy(
          "Application submitted locally",
          "Candidatura submetida localmente",
        ),
        reviewed: copy(
          "Business recorded a review",
          "Empresa registou uma análise",
        ),
        withdrawn: copy(
          "Candidate withdrew the application",
          "Candidato retirou a candidatura",
        ),
      }) as Record<string, string>
    )[action] ?? action;
  const issueText = (code: string) =>
    (
      ({
        required: copy(
          "Complete this required field.",
          "Preencha este campo obrigatório.",
        ),
        tooShort: copy(
          "Write an introduction of at least 10 characters.",
          "Escreva uma apresentação com pelo menos 10 caracteres.",
        ),
        tooLong: copy(
          "Keep the introduction within 2,000 characters.",
          "Escreva uma apresentação com até 2.000 caracteres.",
        ),
        invalidType: copy(
          "Choose a supported work arrangement.",
          "Escolha um regime de trabalho disponível.",
        ),
        invalidAvailability: copy(
          "Choose when you can start.",
          "Escolha quando pode começar.",
        ),
        invalidDate: copy(
          "Choose today or a valid future date.",
          "Escolha uma data válida, de hoje ou futura.",
        ),
        unavailable: copy(
          "This record is unavailable in this workspace.",
          "Este registo está indisponível nesta área de trabalho.",
        ),
        closed: copy(
          "This opportunity is closed to new applications. Your existing records are retained.",
          "Esta oportunidade está encerrada a novas candidaturas. Os seus registos existentes mantêm-se.",
        ),
        duplicate: copy(
          "An active application already exists for this opportunity. Open My applications to inspect it.",
          "Já existe uma candidatura ativa para esta oportunidade. Abra As minhas candidaturas para a consultar.",
        ),
        staleDraft: copy(
          "This draft is no longer current. Close the form and reopen the retained draft.",
          "Este rascunho já não é o atual. Feche o formulário e reabra o rascunho guardado.",
        ),
        notReviewed: copy(
          "A review has not been recorded for this application.",
          "Ainda não foi registada uma análise desta candidatura.",
        ),
        nothingToRestore: copy(
          "There is no draft to restore.",
          "Não há nenhum rascunho para restaurar.",
        ),
      }) as Record<string, string>
    )[code] ??
    copy(
      "This change could not be saved. Review the current record and try again.",
      "Não foi possível guardar esta alteração. Reveja o registo atual e tente novamente.",
    );
  return {
    copy,
    locale,
    date,
    arrangement,
    availability,
    applicationStatus,
    history,
    issueText,
    scope,
  };
}
