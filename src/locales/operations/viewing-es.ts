import type { ViewingDictionary } from "./viewing-types";

export const viewingEs = {
  viewings_actionPending: "Guardando la respuesta…",
  viewings_requestUnavailable: "Solicitud no disponible",
  viewings_close: "Cerrar",
  viewings_noticeProposalSaved:
    "Horario propuesto guardado. El inquilino puede aceptarlo o rechazarlo en esta pestaña.",
  viewings_noticeDeclineSaved:
    "Rechazo guardado en el historial de la solicitud.",
  viewings_noticeCancellationSaved:
    "Cancelación guardada en el historial de la solicitud.",
  viewings_title: "Visitas",
  viewings_workspaceScope:
    "Las solicitudes de visita están disponibles en las áreas de inquilino y propietario.",
  viewings_eyebrow: "VISITAS A INMUEBLES",
  viewings_ownerIntro:
    "Responda a las solicitudes de sus inmuebles y acuerde un horario directamente.",
  viewings_tenantIntro:
    "Consulte sus solicitudes de visita, borradores y respuestas en un mismo lugar.",
  viewings_findHome: "Buscar vivienda",
  viewings_noticeResponseDiscarded:
    "Borrador privado de respuesta descartado. La solicitud de visita no ha cambiado.",
  viewings_unsentDrafts: "Borradores sin enviar",
  viewings_dateNotChosen: "Fecha sin elegir",
  viewings_timeNotChosen: "Hora sin elegir",
  viewings_continueDraft: "Continuar borrador",
  viewings_continue: "Continuar",
  viewings_discardDraft: "Descartar borrador",
  viewings_noticeDraftDiscarded: "Borrador sin enviar descartado.",
  viewings_discard: "Descartar",
  viewings_unsentDraftsHint:
    "Los formularios sin enviar aparecerán aquí cuando los cierre. Solo el área de inquilino puede verlos.",
  viewings_filterRequests: "Filtrar solicitudes de visita",
  viewings_upcomingAccepted: "Próximas aceptadas",
  viewings_requestShownLegacy: "solicitud mostrada",
  viewings_requestsShownLegacy: "solicitudes mostradas",
  viewings_noFilteredRequests: "No hay solicitudes con este filtro",
  viewings_noRequests: "Todavía no hay solicitudes de visita",
  viewings_changeFilterHint:
    "Elija otro filtro para consultar las solicitudes guardadas.",
  viewings_startRequestHint:
    "Abra una vivienda y elija Solicitar visita para iniciar una solicitud local.",
  viewings_ownerRequestsHint:
    "Las solicitudes de los inquilinos para sus inmuebles aparecen aquí al guardarse en esta pestaña.",
  viewings_showAllRequests: "Mostrar todas las solicitudes",
  viewings_requestsLabel: "Solicitudes de visita",
  viewings_tenant: "Inquilino",
  viewings_listingParty: "Anunciante",
  viewings_acceptedTime: "Horario aceptado en esta pestaña",
  viewings_requestedTimePending: "Horario solicitado · pendiente de acuerdo",
  viewings_pastAgreementHint:
    "Este horario aceptado ya ha pasado. El registro no confirma que la visita se haya realizado.",
  viewings_closedHistoryHint:
    "Esta solicitud está cerrada. Los horarios solicitados o aceptados anteriormente se conservan en el historial.",
  viewings_originalNote: "Nota original del inquilino",
  viewings_proposedChange: "Cambio propuesto",
  viewings_versionLower: "versión",
  viewings_awaitingTenantDecision: "Pendiente de la decisión del inquilino",
  viewings_currentAgreementHint:
    "El horario ya aceptado no cambia hasta que acepte esta propuesta.",
  viewings_originalPendingHint:
    "La solicitud original no se ha aceptado. Rechazar este cambio la deja pendiente.",
  viewings_noticeProposalAccepted:
    "Horario propuesto aceptado en esta pestaña.",
  viewings_acceptProposal: "Aceptar horario propuesto",
  viewings_noticeProposalDeclinedKept:
    "Cambio rechazado. Se conserva el horario aceptado anteriormente.",
  viewings_noticeProposalDeclinedPending:
    "Cambio rechazado. La solicitud original sigue pendiente de acuerdo.",
  viewings_keepAcceptedTime: "Mantener horario aceptado",
  viewings_declineProposal: "Rechazar cambio propuesto",
  viewings_privateResponseDraft: "Borrador privado de respuesta",
  viewings_closedDraftHint:
    "Esta solicitud está cerrada. Puede consultar, copiar o descartar los datos sin terminar; no pueden modificar la solicitud.",
  viewings_privateDraftHint:
    "La respuesta sin terminar es privada en esta área de trabajo. Use una acción de respuesta disponible abajo para continuar. Al recargar se borra el borrador.",
  viewings_viewUnfinishedResponse: "Ver respuesta sin terminar",
  viewings_date: "Fecha",
  viewings_time: "Hora",
  viewings_note: "Nota",
  viewings_notEntered: "Sin completar",
  viewings_discardResponseDraft: "Descartar borrador de respuesta",
  viewings_noticeRequestAccepted:
    "Horario solicitado aceptado en esta pestaña.",
  viewings_acceptRequest: "Aceptar horario solicitado",
  viewings_replaceProposal: "Sustituir horario propuesto",
  viewings_proposeTime: "Proponer otro horario",
  viewings_declineRequest: "Rechazar solicitud",
  viewings_cancelRequest: "Cancelar solicitud",
  viewings_openProperty: "Abrir inmueble",
  viewings_originalRequestedTime: "Horario solicitado originalmente",
  viewings_timeProposals: "Propuestas de horario",
  viewings_version: "Versión",
  viewings_requestHistory: "Historial de la solicitud",
  viewings_propertyOwner: "Propietario",
  viewings_noticeRequestSaved: "Solicitud de visita guardada en esta pestaña.",
  viewings_declineDialogTitle: "Rechazar solicitud de visita",
  viewings_cancelDialogTitle: "Cancelar solicitud de visita",
  viewings_responseEyebrow: "RESPUESTA LOCAL A LA VISITA",
  viewings_closeResponse: "Cerrar respuesta",
  viewings_closedDialogDraftHint:
    "Esta solicitud está cerrada. La respuesta sin terminar es privada y puede copiarse o descartarse; no puede modificar la solicitud cerrada.",
  viewings_proposalExistingAgreementHint:
    "El horario aceptado no cambia hasta que el inquilino acepte esta propuesta.",
  viewings_proposalOriginalTimeHint:
    "El horario solicitado no cambia. Solo el inquilino puede aceptar este cambio propuesto.",
  viewings_checkDetails: "Revise estos datos",
  viewings_proposedDate: "Fecha propuesta",
  viewings_proposedTime: "Hora propuesta",
  viewings_optionalReason: "Motivo (opcional)",
  viewings_reason: "Motivo",
  viewings_responseDraftScope:
    "La respuesta sin guardar es privada en esta área de trabajo hasta que la guarde. Al cerrar se conserva el borrador.",
  viewings_saveProposal: "Guardar horario propuesto",
  viewings_saveDecline: "Guardar rechazo",
  viewings_saveCancellation: "Guardar cancelación",
  viewings_requestEyebrow: "SOLICITUD LOCAL DE VISITA",
  viewings_requestViewing: "Solicitar visita",
  viewings_closeRequest: "Cerrar solicitud de visita",
  viewings_tenantCreateScope:
    "Las solicitudes de visita se pueden crear en el área de inquilino.",
  viewings_preferredDate: "Fecha preferida",
  viewings_preferredTime: "Hora preferida",
  viewings_optionalNote: "Nota (opcional)",
  viewings_requestDraftScope:
    "El borrador sin enviar se conserva en esta pestaña al cerrar el formulario o salir de la página. Guarde la solicitud para añadirla a la bandeja compartida de visitas.",
  viewings_saveRequest: "Guardar solicitud de visita",
  viewings_tenantPropertyRequestsScope:
    "Las solicitudes de visita y de alquiler están disponibles en el área de inquilino.",
  viewings_openRequest: "Abrir solicitud de visita",
  viewings_continueViewingDraft: "Continuar borrador de visita",
  viewings_localRequestLabel: "Su solicitud local de visita",
  viewings_proposedTimePending: "Horario propuesto · pendiente de su decisión",
  viewings_localRecordScope:
    "Solo es un registro local. No se contacta con nadie ni se confirma una visita real.",
  viewings_viewHistory: "Ver solicitud e historial",
  viewings_summaryTitle: "Visitas a inmuebles",
  viewings_openRequests: "Ver solicitudes",
  viewings_noDecisions: "No hay solicitudes pendientes de su decisión.",
  viewings_upcomingAgreedTimes: "Próximos horarios acordados",
  viewings_localTime: "Hora local",
  viewings_summaryProposalHint:
    "Cambio propuesto; se conserva el horario actual",
  viewings_noUpcomingAgreement:
    "Ninguna visita futura tiene un horario acordado.",
  viewings_summaryNoRequests: "Todavía no hay solicitudes de visita.",
  viewings_summaryHistoryHint:
    "Abra las solicitudes para consultar los horarios propuestos y el historial.",
  viewings_summaryTenantHint:
    "Puede solicitar una visita desde el anuncio de un inmueble.",
  viewings_summaryOwnerHint:
    "Las solicitudes para sus inmuebles aparecerán aquí.",
  viewings_filterAll: "Todas",
  viewings_statusPending: "Pendiente del propietario",
  viewings_statusProposed: "Cambio de horario propuesto",
  viewings_statusAgreed: "Aceptada en esta pestaña",
  viewings_statusDeclined: "Rechazada",
  viewings_statusCancelled: "Cancelada",
  viewings_filterHistory: "Historial",
  viewings_proposalPending: "Pendiente del inquilino",
  viewings_proposalAccepted: "Aceptada localmente",
  viewings_proposalDeclined: "Rechazada localmente",
  viewings_proposalSuperseded: "Sustituida por una propuesta más reciente",
  viewings_proposalWithdrawn: "Retirada",
  viewings_errorUnavailable:
    "Esta solicitud ya no está disponible en esta área de trabajo.",
  viewings_errorRole:
    "Solo el área de inquilino puede crear una solicitud de visita.",
  viewings_errorProperty:
    "Elija una vivienda disponible en el catálogo de inmuebles.",
  viewings_errorDate: "Elija la fecha de hoy o una fecha futura válida.",
  viewings_errorTime: "Elija una hora válida.",
  viewings_errorNoteLong: "La nota debe tener como máximo 1.000 caracteres.",
  viewings_errorNoteRequired: "Añada un motivo de entre 3 y 1.000 caracteres.",
  viewings_errorDuplicate:
    "Ya existe una solicitud activa para esta vivienda. Ábrala en Visitas.",
  viewings_errorStatus:
    "La solicitud ha cambiado. Revise su estado actual antes de intentarlo de nuevo.",
  viewings_errorStaleProposal:
    "Esta propuesta ya no es la actual. Revise la más reciente antes de decidir.",
  viewings_errorNoChanges:
    "Elija una fecha u hora diferente antes de proponer un cambio.",
  viewings_errorPastTime:
    "Este horario ya ha pasado. Se necesita una nueva propuesta.",
  viewings_errorFallback:
    "No se ha podido guardar esta acción. Revise la solicitud actual e inténtelo de nuevo.",
  viewings_historyRequested: "Solicitud de visita guardada localmente",
  viewings_historyAccepted: "El propietario aceptó el horario solicitado",
  viewings_historyDeclined: "El propietario rechazó la solicitud",
  viewings_historyProposed: "El propietario propuso otro horario",
  viewings_historyProposalAccepted: "El inquilino aceptó el horario propuesto",
  viewings_historyProposalDeclined: "El inquilino rechazó el cambio propuesto",
  viewings_historyCancelled: "Solicitud de visita cancelada localmente",
  viewings_scope:
    "Las solicitudes de visita y las respuestas se conservan en esta pestaña hasta recargarla. No se contacta con nadie ni se confirma una visita real o un alquiler. Los horarios usan la hora local de este dispositivo.",
  viewings_requestsShown_one: "{{shownCount}} solicitud mostrada",
  viewings_requestsShown_other: "{{shownCount}} solicitudes mostradas",
  viewings_requestsShown_many: "{{shownCount}} solicitudes mostradas",
  viewings_ownerDecision_one:
    "{{shownCount}} solicitud pendiente de su decisión",
  viewings_ownerDecision_other:
    "{{shownCount}} solicitudes pendientes de su decisión",
  viewings_ownerDecision_many:
    "{{shownCount}} solicitudes pendientes de su decisión",
  viewings_tenantDecision_one:
    "{{shownCount}} propuesta pendiente de su decisión",
  viewings_tenantDecision_other:
    "{{shownCount}} propuestas pendientes de su decisión",
  viewings_tenantDecision_many:
    "{{shownCount}} propuestas pendientes de su decisión",
  viewings_upcomingSubset: "Próximas {{shown}} de {{total}}",
  viewings_calendarDownload: "Descargar visita (.ics)",
  viewings_calendarHint:
    "Usa la hora local. Compruebe que la zona horaria de su calendario coincide con la de este dispositivo. Tras cualquier cambio, descargue de nuevo y actualice el calendario manualmente.",
  viewings_calendarSummary: "Visita al inmueble",
  viewings_calendarDescription:
    "Horario de visita acordado localmente en Kasa. Este archivo es una copia del registro, no una conexión al calendario. Compruebe la zona horaria local del calendario. Tras cualquier cambio, descargue de nuevo y actualice el calendario manualmente.",
  viewings_calendarStarted: "Descarga de la visita iniciada.",
  viewings_calendarFailed:
    "No se ha podido descargar la visita. Inténtelo de nuevo.",
  viewings_calendarUnavailable:
    "Ya no hay un horario futuro acordado para descargar.",
} satisfies ViewingDictionary;
