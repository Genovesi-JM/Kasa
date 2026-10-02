import { useTranslation } from "react-i18next";

export function useViewingCopy() {
  const { i18n } = useTranslation();
  const portuguese = (
    i18n.resolvedLanguage ??
    i18n.language ??
    "pt"
  ).startsWith("pt");
  const locale = portuguese ? "pt-PT" : "en-GB";
  const text = (english: string, pt: string) => (portuguese ? pt : english);
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
  const status = (value: string) =>
    (
      ({
        All: text("All", "Todos"),
        Pending: text("Awaiting owner", "Aguarda proprietário"),
        Proposed: text("Time change proposed", "Alteração de horário proposta"),
        Agreed: text("Accepted in this tab", "Aceite neste separador"),
        Declined: text("Declined", "Recusado"),
        Cancelled: text("Cancelled", "Cancelado"),
        History: text("History", "Histórico"),
      }) as Record<string, string>
    )[value] ?? value;
  const proposalStatus = (value: string) =>
    (
      ({
        Pending: text("Awaiting tenant", "Aguarda inquilino"),
        Accepted: text("Accepted locally", "Aceite localmente"),
        Declined: text("Declined locally", "Recusada localmente"),
        Superseded: text(
          "Replaced by a newer proposal",
          "Substituída por uma proposta mais recente",
        ),
        Withdrawn: text("Withdrawn", "Retirada"),
      }) as Record<string, string>
    )[value] ?? value;
  const issueText = (issue: string) =>
    (
      ({
        unavailable: text(
          "This request is no longer available in this workspace.",
          "Este pedido já não está disponível nesta área de trabalho.",
        ),
        role: text(
          "Only the tenant workspace can create a viewing request.",
          "Só a área do inquilino pode criar um pedido de visita.",
        ),
        invalidProperty: text(
          "Choose a home available in the property catalogue.",
          "Escolha um imóvel disponível no catálogo.",
        ),
        invalidDate: text(
          "Choose today or a valid future date.",
          "Escolha uma data válida, de hoje ou futura.",
        ),
        invalidTime: text("Choose a valid time.", "Escolha uma hora válida."),
        noteTooLong: text(
          "Keep the note within 1,000 characters.",
          "Escreva uma nota com até 1.000 caracteres.",
        ),
        noteRequired: text(
          "Add a reason of 3 to 1,000 characters.",
          "Adicione um motivo com 3 a 1.000 caracteres.",
        ),
        duplicate: text(
          "An active request already exists for this home. Open it in Viewings.",
          "Já existe um pedido ativo para este imóvel. Abra-o em Visitas.",
        ),
        status: text(
          "The request changed. Review its current status before trying again.",
          "O pedido mudou. Reveja o estado atual antes de tentar novamente.",
        ),
        staleProposal: text(
          "This proposal is no longer current. Review the latest proposal before choosing.",
          "Esta proposta já não é a atual. Reveja a proposta mais recente antes de decidir.",
        ),
        noChanges: text(
          "Choose a different date or time before proposing a change.",
          "Escolha outra data ou hora antes de propor uma alteração.",
        ),
        pastTime: text(
          "This time is no longer in the future. A new proposal is needed.",
          "Este horário já passou. É necessária uma nova proposta.",
        ),
      }) as Record<string, string>
    )[issue] ??
    text(
      "This action could not be saved. Review the current request and try again.",
      "Não foi possível guardar esta ação. Reveja o pedido atual e tente novamente.",
    );
  const history = (action: string) =>
    (
      ({
        requested: text(
          "Viewing request saved locally",
          "Pedido de visita guardado localmente",
        ),
        accepted: text(
          "Owner accepted the requested time",
          "Proprietário aceitou o horário pedido",
        ),
        declined: text(
          "Owner declined the request",
          "Proprietário recusou o pedido",
        ),
        proposed: text(
          "Owner proposed another time",
          "Proprietário propôs outro horário",
        ),
        "proposal-accepted": text(
          "Tenant accepted the proposed time",
          "Inquilino aceitou o horário proposto",
        ),
        "proposal-declined": text(
          "Tenant declined the proposed change",
          "Inquilino recusou a alteração proposta",
        ),
        cancelled: text(
          "Viewing request cancelled locally",
          "Pedido de visita cancelado localmente",
        ),
      }) as Record<string, string>
    )[action] ?? action;
  const scope = text(
    "Viewing requests and responses stay in this tab until reload. No one is contacted and no real visit or tenancy is confirmed. Times use this device’s local time.",
    "Os pedidos de visita e as respostas ficam neste separador até recarregar. Ninguém é contactado e nenhuma visita real ou arrendamento é confirmado. Os horários usam a hora local deste dispositivo.",
  );
  return {
    text,
    date,
    status,
    proposalStatus,
    issueText,
    history,
    scope,
    locale,
  };
}
