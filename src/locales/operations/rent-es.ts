import type { RentDictionary } from "./rent-types";

export const rentEs = {
  rent_title: "Registros de alquiler",
  rent_record: "Registro de alquiler",
  rent_privateDraft: "Borrador privado",
  rent_transferDraftScope:
    "Los datos de transferencia sin terminar permanecen privados en su área de inquilino en esta pestaña. Al cerrar, el borrador se conserva; al recargar, se elimina.",
  rent_correctionDraftScope:
    "Esta nota de corrección sin terminar permanece privada en su área de propietario en esta pestaña hasta que guarde la solicitud. Al cerrar, se conserva; al recargar, se elimina.",
  rent_resumeTransferDraft: "Retomar borrador de transferencia",
  rent_resumeCorrectionDraft: "Retomar borrador de corrección",
  rent_inspectDraft: "Ver borrador sin terminar",
  rent_discardDraft: "Descartar borrador",
  rent_draftDiscarded:
    "Borrador privado descartado. El registro de alquiler no ha cambiado.",
  rent_backToRecord: "Volver al registro",
  rent_staleDraft: "El registro de alquiler ha cambiado",
  rent_staleDraftNote:
    "Sus datos sin terminar siguen disponibles para copiarlos. No pueden sustituir el registro más reciente. Descarte este borrador antes de empezar de nuevo.",
  rent_draftUnavailable:
    "Este borrador no se puede guardar en el registro actual. Revise el registro más reciente antes de continuar.",
  rent_statusAwaitingDetails: "Pendiente de datos de transferencia",
  rent_statusAwaitingOwner: "Pendiente de confirmación del propietario",
  rent_statusCorrection: "Necesita corrección",
  rent_statusConfirmed: "Confirmado",
  rent_editTransfer: "Editar datos de transferencia",
  rent_recordTransfer: "Registrar datos de transferencia",
  rent_formScope:
    "Use datos de ejemplo. Este formulario registra la descripción de una transferencia; no mueve dinero ni sube justificantes.",
  rent_checkDetails: "Revise estos datos",
  rent_transferredAmount: "Importe transferido (€)",
  rent_decimalHint:
    "Use un punto o una coma decimal, sin separadores de miles.",
  rent_transferDate: "Fecha de transferencia",
  rent_transferReference: "Referencia de transferencia",
  rent_referencePlaceholder: "Por ejemplo, EJEMPLO-ALQUILER-SEPTIEMBRE",
  rent_optionalNote: "Nota (opcional)",
  rent_transferNote: "Nota de transferencia",
  rent_cancelEdit: "Cancelar edición",
  rent_saveTransfer: "Guardar datos de transferencia",
  rent_errorAmount:
    "Introduzca un importe entre 0,01 € y 1 000 000 €, con hasta dos decimales.",
  rent_errorDate: "Elija una fecha de transferencia válida, de hoy o anterior.",
  rent_errorReference:
    "Introduzca una referencia de transferencia de 1 a 100 caracteres en una sola línea.",
  rent_errorNote: "Use un máximo de 1 000 caracteres.",
  rent_errorCorrection: "Describa qué hay que corregir en 1 a 500 caracteres.",
  rent_summaryCopied: "Resumen del registro de ejemplo copiado.",
  rent_clipboardUnavailable:
    "No se puede acceder al portapapeles. Seleccione y copie el resumen de abajo.",
  rent_closeRecord: "Cerrar registro de alquiler",
  rent_amountDue: "Importe adeudado",
  rent_dueDate: "Fecha de vencimiento",
  rent_owner: "Propietario del anuncio",
  rent_recordId: "ID del registro",
  rent_correctionRequested: "Corrección solicitada",
  rent_transferSaved:
    "Datos de transferencia guardados. Pendientes de revisión en el espacio del propietario.",
  rent_recordedTransfer: "Transferencia registrada",
  rent_recordedAmount: "Importe registrado",
  rent_reference: "Referencia",
  rent_note: "Nota",
  rent_amountMismatch:
    "El importe registrado difiere del alquiler. Corrija los datos antes de la confirmación del propietario.",
  rent_noTransfer:
    "No se han registrado datos de transferencia para este período.",
  rent_ownerReview: "Revisión del propietario",
  rent_reviewScope:
    "La confirmación modifica este registro de ejemplo; no verifica una transacción bancaria.",
  rent_requestCorrection: "Solicitar corrección",
  rent_ownerConfirmed:
    "Confirmación del propietario registrada en esta pestaña.",
  rent_confirmTransfer: "Confirmar transferencia registrada",
  rent_correctionSaved:
    "Solicitud de corrección guardada en esta pestaña. El inquilino puede editar el registro.",
  rent_correctionQuestion: "¿Qué hay que corregir?",
  rent_saveCorrection: "Guardar solicitud de corrección",
  rent_history: "Historial del registro",
  rent_historyScope: "Valores registrados que se conservan en esta pestaña.",
  rent_historyAfter: "Después de este cambio",
  rent_historyBefore: "Antes de este cambio",
  rent_historyEmpty: "No registrado",
  rent_copying: "Copiando…",
  rent_copySummary: "Copiar resumen de ejemplo",
  rent_sampleSummary: "Resumen de ejemplo",
  rent_csvStarted: "Descarga del CSV iniciada. Registros incluidos: {{count}}.",
  rent_csvFailed:
    "No se ha podido descargar el CSV. Inténtelo de nuevo en un navegador que permita descargar archivos.",
  rent_workspaceScope:
    "Los registros de alquiler están disponibles en los espacios del inquilino y del propietario.",
  rent_tenantTitle: "Reúna los datos de sus transferencias",
  rent_ownerTitle: "Revise las transferencias de alquiler registradas",
  rent_sessionScope:
    "Los registros de ejemplo permanecen en esta pestaña hasta recargarla. No se mueve dinero ni se facilita una cuenta bancaria.",
  rent_metricsLabel: "Resumen de registros de alquiler de todos los períodos",
  rent_confirmedMetric: "Confirmado en registros de ejemplo",
  rent_allPeriodsCount: "Registros de todos los períodos: {{count}}",
  rent_awaitingReview: "Pendiente de revisión del propietario",
  rent_recordedDetails: "Datos de transferencia registrados",
  rent_missingDetails: "Datos por añadir o corregir",
  rent_inspectHint: "Abra un registro para consultarlo",
  rent_period: "Período",
  rent_allPeriods: "Todos los períodos",
  rent_status: "Estado",
  rent_allStatuses: "Todos los estados",
  rent_property: "Inmueble",
  rent_allProperties: "Todos los inmuebles",
  rent_sort: "Ordenar",
  rent_recentlyUpdated: "Actualizados más recientemente",
  rent_amountHighLow: "Importe: de mayor a menor",
  rent_propertyName: "Nombre del inmueble",
  rent_resetActive: "Restablecer ({{count}})",
  rent_resetSort: "Restablecer orden",
  rent_matchingCount: "Registros que coinciden con los filtros: {{count}}",
  rent_exportCsv: "Exportar CSV de registros visibles",
  rent_openRecord:
    "Abrir registro de alquiler de {{period}} de {{tenant}}, {{property}}",
  rent_rentAmount: "Importe del alquiler",
  rent_noMatches: "Ningún registro coincide",
  rent_noMatchesHint: "Cambie el filtro de período, estado o inmueble.",
  rent_resetFilters: "Restablecer filtros",
  rent_summaryScope:
    "Registro de alquiler de ejemplo de Kasa; no son instrucciones de pago ni un recibo bancario.",
  rent_summaryBankNotice:
    "No se facilita ninguna cuenta bancaria. No use este ejemplo para realizar un pago.",
  rent_tenant: "Inquilino",
  rent_summaryTransfer: "Transferencia registrada: {{amount}} el {{date}}",
  rent_csvScope: "Ámbito",
  rent_csvAmountDue: "Importe adeudado EUR",
  rent_csvRecordedAmount: "Importe registrado EUR",
  rent_correctionNote: "Nota de corrección",
  rent_csvScopeValue:
    "Registro de sesión de ejemplo; sin confirmación bancaria",
} satisfies RentDictionary;
