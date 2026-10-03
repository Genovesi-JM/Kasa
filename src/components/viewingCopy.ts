import { useTranslation } from "react-i18next";
import { displayTranslation, type LanguageCode } from "../i18n";

const calendarCopy = {
  en: {
    download: "Download appointment (.ics)",
    hint: "Uses local time. Check that your calendar’s time zone matches this device. After changes, download again and update your calendar manually.",
    summary: "Property viewing",
    description:
      "Viewing time agreed locally in Kasa. This file is a snapshot, not a calendar connection. Check your calendar’s local time zone. After changes, download again and update your calendar manually.",
    started: "Appointment download started.",
    failed: "The appointment could not be downloaded. Try again.",
    unavailable:
      "A future agreed viewing time is no longer available for download.",
  },
  pt: {
    download: "Descarregar visita (.ics)",
    hint: "Usa a hora local. Verifique se o fuso horário do calendário corresponde ao deste dispositivo. Após alterações, descarregue novamente e atualize o calendário manualmente.",
    summary: "Visita ao imóvel",
    description:
      "Horário de visita acordado localmente no Kasa. Este ficheiro é uma cópia do registo, não uma ligação ao calendário. Verifique o fuso horário local do calendário. Após alterações, descarregue novamente e atualize o calendário manualmente.",
    started: "Transferência do ficheiro da visita iniciada.",
    failed: "Não foi possível descarregar a visita. Tente novamente.",
    unavailable: "Já não existe um horário futuro acordado para descarregar.",
  },
  es: {
    download: "Descargar visita (.ics)",
    hint: "Usa la hora local. Compruebe que la zona horaria de su calendario coincide con la de este dispositivo. Tras cualquier cambio, descargue de nuevo y actualice el calendario manualmente.",
    summary: "Visita al inmueble",
    description:
      "Horario de visita acordado localmente en Kasa. Este archivo es una copia del registro, no una conexión al calendario. Compruebe la zona horaria local del calendario. Tras cualquier cambio, descargue de nuevo y actualice el calendario manualmente.",
    started: "Descarga de la visita iniciada.",
    failed: "No se ha podido descargar la visita. Inténtelo de nuevo.",
    unavailable: "Ya no hay un horario futuro acordado para descargar.",
  },
  fr: {
    download: "Télécharger la visite (.ics)",
    hint: "Utilise l’heure locale. Vérifiez que le fuseau horaire du calendrier correspond à celui de cet appareil. Après une modification, téléchargez à nouveau et mettez le calendrier à jour manuellement.",
    summary: "Visite du logement",
    description:
      "Horaire de visite convenu localement dans Kasa. Ce fichier est une copie du dossier, pas une connexion au calendrier. Vérifiez le fuseau horaire local du calendrier. Après une modification, téléchargez à nouveau et mettez le calendrier à jour manuellement.",
    started: "Téléchargement de la visite lancé.",
    failed: "Impossible de télécharger la visite. Réessayez.",
    unavailable:
      "Plus aucun horaire de visite futur convenu n’est disponible au téléchargement.",
  },
  ar: {
    download: "تنزيل موعد الزيارة (.ics)",
    hint: "يستخدم التوقيت المحلي. تأكد من أن المنطقة الزمنية لتقويمك تطابق هذا الجهاز. بعد أي تغيير، نزّل الملف مجددًا وحدّث التقويم يدويًا.",
    summary: "زيارة العقار",
    description:
      "موعد زيارة متفق عليه محليًا في Kasa. هذا الملف نسخة من السجل وليس اتصالًا بالتقويم. تحقق من المنطقة الزمنية المحلية لتقويمك. بعد أي تغيير، نزّل الملف مجددًا وحدّث التقويم يدويًا.",
    started: "بدأ تنزيل موعد الزيارة.",
    failed: "تعذّر تنزيل موعد الزيارة. حاول مرة أخرى.",
    unavailable: "لم يعد هناك موعد زيارة مستقبلي متفق عليه متاح للتنزيل.",
  },
  zh: {
    download: "下载看房预约 (.ics)",
    hint: "使用本地时间。请确认日历时区与此设备一致。预约变更后，请重新下载并手动更新日历。",
    summary: "看房预约",
    description:
      "在 Kasa 中本地确认的看房时间。此文件是记录副本，并未连接日历。请检查日历的本地时区。预约变更后，请重新下载并手动更新日历。",
    started: "已开始下载看房预约。",
    failed: "无法下载看房预约。请重试。",
    unavailable: "已无可下载的未来已确认看房时间。",
  },
} satisfies Record<LanguageCode, Record<string, string>>;

export function useViewingCopy() {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "pt").split(
    "-",
  )[0];
  const calendarLanguage: LanguageCode = Object.hasOwn(calendarCopy, language)
    ? (language as LanguageCode)
    : "en";
  const calendar = Object.fromEntries(
    Object.entries(calendarCopy[calendarLanguage]).map(([key, value]) => [
      key,
      displayTranslation(
        value,
        calendarCopy.en[key as keyof typeof calendarCopy.en],
        calendarLanguage,
      ),
    ]),
  ) as Record<keyof typeof calendarCopy.en, string>;
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
    calendar,
    date,
    status,
    proposalStatus,
    issueText,
    history,
    scope,
    locale,
  };
}
