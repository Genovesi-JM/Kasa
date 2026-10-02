const statusLabels: Record<
  string,
  readonly [string, string, string, string, string, string]
> = {
  "Awaiting transfer details": [
    "Transfer details needed",
    "Faltam os dados da transferência",
    "Faltan los datos de la transferencia",
    "Détails du virement requis",
    "بيانات التحويل مطلوبة",
    "需要转账信息",
  ],
  "Awaiting owner confirmation": [
    "Awaiting owner confirmation",
    "A aguardar confirmação do senhorio",
    "Pendiente de confirmación del propietario",
    "En attente de confirmation du propriétaire",
    "بانتظار تأكيد المالك",
    "等待业主确认",
  ],
  "Needs correction": [
    "Correction requested",
    "Correção solicitada",
    "Corrección solicitada",
    "Correction demandée",
    "تصحيح مطلوب",
    "需要更正",
  ],
  Confirmed: [
    "Confirmed in records",
    "Confirmado nos registos",
    "Confirmado en los registros",
    "Confirmé dans les relevés",
    "مؤكد في السجلات",
    "已在记录中确认",
  ],
  Review: [
    "Under review",
    "Em análise",
    "En revisión",
    "En cours d’examen",
    "قيد المراجعة",
    "审核中",
  ],
  Documents: [
    "Documents requested",
    "Documentos solicitados",
    "Documentos solicitados",
    "Documents demandés",
    "مستندات مطلوبة",
    "已请求文件",
  ],
  Approved: [
    "Approved",
    "Aprovada",
    "Aprobada",
    "Approuvée",
    "مقبول",
    "已批准",
  ],
  Draft: ["Draft", "Rascunho", "Borrador", "Brouillon", "مسودة", "草稿"],
  New: ["New", "Novo", "Nuevo", "Nouveau", "جديد", "新建"],
  Scheduled: [
    "Scheduled",
    "Agendado",
    "Programado",
    "Planifié",
    "مجدول",
    "已安排",
  ],
  "In progress": [
    "In progress",
    "Em curso",
    "En curso",
    "En cours",
    "قيد التنفيذ",
    "进行中",
  ],
  Resolved: [
    "Resolved",
    "Resolvido",
    "Resuelto",
    "Résolu",
    "تم الحل",
    "已解决",
  ],
  "No rent record this month": [
    "No rent record this month",
    "Sem registo de renda este mês",
    "Sin registro de alquiler este mes",
    "Aucun relevé de loyer ce mois-ci",
    "لا يوجد سجل إيجار لهذا الشهر",
    "本月无租金记录",
  ],
};

export function propertyOperationStatus(
  status: string,
  language: string,
): string {
  if (!Object.hasOwn(statusLabels, status)) return status;
  const base = language.split("-")[0];
  const index = ["en", "pt", "es", "fr", "ar", "zh"].indexOf(base);
  const labels = statusLabels[status];
  const localized = labels[index < 0 ? 1 : index];
  return base === "ar" || base === "zh"
    ? `${localized} (${labels[0]})`
    : localized;
}
