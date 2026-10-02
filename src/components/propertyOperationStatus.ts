const statusLabels: Record<string, readonly [string, string]> = {
  "Awaiting transfer details": [
    "Transfer details needed",
    "Faltam os dados da transferência",
  ],
  "Awaiting owner confirmation": [
    "Awaiting owner confirmation",
    "A aguardar confirmação do senhorio",
  ],
  "Needs correction": ["Correction requested", "Correção solicitada"],
  Confirmed: ["Confirmed in records", "Confirmado nos registos"],
  Review: ["Under review", "Em análise"],
  Documents: ["Documents requested", "Documentos solicitados"],
  Approved: ["Approved", "Aprovada"],
  Draft: ["Draft", "Rascunho"],
  New: ["New", "Novo"],
  Scheduled: ["Scheduled", "Agendado"],
  "In progress": ["In progress", "Em curso"],
  Resolved: ["Resolved", "Resolvido"],
  "No rent record this month": [
    "No rent record this month",
    "Sem registo de renda este mês",
  ],
};

export function propertyOperationStatus(
  status: string,
  language: string,
): string {
  return Object.hasOwn(statusLabels, status)
    ? statusLabels[status][language === "pt" ? 1 : 0]
    : status;
}
