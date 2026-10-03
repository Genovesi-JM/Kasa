import type { ViewingDictionary } from "./viewing-types";

export const viewingPt = {
  viewings_actionPending: "A guardar a resposta…",
  viewings_requestUnavailable: "Pedido indisponível",
  viewings_close: "Fechar",
  viewings_noticeProposalSaved:
    "Horário proposto guardado. O inquilino pode agora aceitá-lo ou recusá-lo neste separador.",
  viewings_noticeDeclineSaved: "Recusa guardada no histórico do pedido.",
  viewings_noticeCancellationSaved:
    "Cancelamento guardado no histórico do pedido.",
  viewings_title: "Visitas",
  viewings_workspaceScope:
    "Os pedidos de visita estão disponíveis nas áreas do inquilino e do proprietário.",
  viewings_eyebrow: "VISITAS A IMÓVEIS",
  viewings_ownerIntro:
    "Responda aos pedidos dos seus imóveis e acorde um horário diretamente.",
  viewings_tenantIntro:
    "Mantenha os seus pedidos de visita, rascunhos e respostas juntos.",
  viewings_findHome: "Procurar imóvel",
  viewings_noticeResponseDiscarded:
    "Rascunho privado da resposta descartado. O pedido de visita permanece inalterado.",
  viewings_unsentDrafts: "Rascunhos por enviar",
  viewings_dateNotChosen: "Data por escolher",
  viewings_timeNotChosen: "Hora por escolher",
  viewings_continueDraft: "Continuar rascunho",
  viewings_continue: "Continuar",
  viewings_discardDraft: "Eliminar rascunho",
  viewings_noticeDraftDiscarded: "Rascunho por enviar eliminado.",
  viewings_discard: "Eliminar",
  viewings_unsentDraftsHint:
    "Os formulários por enviar aparecem aqui ao fechá-los. Só a área do inquilino os pode ver.",
  viewings_filterRequests: "Filtrar pedidos de visita",
  viewings_upcomingAccepted: "Aceites futuras",
  viewings_requestShownLegacy: "pedido apresentado",
  viewings_requestsShownLegacy: "pedidos apresentados",
  viewings_noFilteredRequests: "Sem pedidos neste filtro",
  viewings_noRequests: "Ainda não há pedidos de visita",
  viewings_changeFilterHint:
    "Escolha outro filtro para consultar os pedidos guardados.",
  viewings_startRequestHint:
    "Abra um imóvel e escolha Pedir visita para iniciar um pedido local.",
  viewings_ownerRequestsHint:
    "Os pedidos dos inquilinos para os seus imóveis aparecem aqui depois de guardados neste separador.",
  viewings_showAllRequests: "Ver todos os pedidos",
  viewings_requestsLabel: "Pedidos de visita",
  viewings_tenant: "Inquilino",
  viewings_listingParty: "Anunciante",
  viewings_acceptedTime: "Horário aceite neste separador",
  viewings_requestedTimePending: "Horário pedido · por acordar",
  viewings_pastAgreementHint:
    "Este horário aceite já passou. Este registo não confirma que a visita tenha ocorrido.",
  viewings_closedHistoryHint:
    "Este pedido está encerrado. Os horários anteriormente pedidos ou aceites mantêm-se no histórico.",
  viewings_originalNote: "Nota original do inquilino",
  viewings_proposedChange: "Alteração proposta",
  viewings_versionLower: "versão",
  viewings_awaitingTenantDecision: "Aguarda decisão do inquilino",
  viewings_currentAgreementHint:
    "O horário já aceite mantém-se até esta proposta ser aceite.",
  viewings_originalPendingHint:
    "O pedido original ainda não foi aceite. Recusar esta alteração mantém esse pedido pendente.",
  viewings_noticeProposalAccepted: "Horário proposto aceite neste separador.",
  viewings_acceptProposal: "Aceitar horário proposto",
  viewings_noticeProposalDeclinedKept:
    "Alteração recusada. O horário anteriormente aceite mantém-se.",
  viewings_noticeProposalDeclinedPending:
    "Alteração recusada. O pedido original continua por acordar.",
  viewings_keepAcceptedTime: "Manter horário aceite",
  viewings_declineProposal: "Recusar alteração proposta",
  viewings_privateResponseDraft: "Rascunho privado da resposta",
  viewings_closedDraftHint:
    "Este pedido está encerrado. Pode consultar, copiar ou descartar os valores por concluir; não podem alterar o pedido.",
  viewings_privateDraftHint:
    "A resposta por concluir fica privada nesta área de trabalho. Use uma das ações de resposta abaixo para continuar. Recarregar apaga o rascunho.",
  viewings_viewUnfinishedResponse: "Ver resposta por concluir",
  viewings_date: "Data",
  viewings_time: "Hora",
  viewings_note: "Nota",
  viewings_notEntered: "Por preencher",
  viewings_discardResponseDraft: "Descartar rascunho da resposta",
  viewings_noticeRequestAccepted: "Horário pedido aceite neste separador.",
  viewings_acceptRequest: "Aceitar horário pedido",
  viewings_replaceProposal: "Substituir horário proposto",
  viewings_proposeTime: "Propor outro horário",
  viewings_declineRequest: "Recusar pedido",
  viewings_cancelRequest: "Cancelar pedido",
  viewings_openProperty: "Abrir imóvel",
  viewings_originalRequestedTime: "Horário originalmente pedido",
  viewings_timeProposals: "Propostas de horário",
  viewings_version: "Versão",
  viewings_requestHistory: "Histórico do pedido",
  viewings_propertyOwner: "Proprietário",
  viewings_noticeRequestSaved: "Pedido de visita guardado neste separador.",
  viewings_declineDialogTitle: "Recusar pedido de visita",
  viewings_cancelDialogTitle: "Cancelar pedido de visita",
  viewings_responseEyebrow: "RESPOSTA LOCAL À VISITA",
  viewings_closeResponse: "Fechar resposta",
  viewings_closedDialogDraftHint:
    "Este pedido está encerrado. A resposta por concluir é privada e pode ser copiada ou descartada; não pode alterar o pedido encerrado.",
  viewings_proposalExistingAgreementHint:
    "O horário aceite mantém-se até o inquilino aceitar esta proposta.",
  viewings_proposalOriginalTimeHint:
    "O horário pedido mantém-se. Só o inquilino pode aceitar esta alteração proposta.",
  viewings_checkDetails: "Reveja estes dados",
  viewings_proposedDate: "Data proposta",
  viewings_proposedTime: "Hora proposta",
  viewings_optionalReason: "Motivo (opcional)",
  viewings_reason: "Motivo",
  viewings_responseDraftScope:
    "A resposta por guardar fica privada nesta área de trabalho até ser guardada. Fechar mantém o rascunho.",
  viewings_saveProposal: "Guardar horário proposto",
  viewings_saveDecline: "Guardar recusa",
  viewings_saveCancellation: "Guardar cancelamento",
  viewings_requestEyebrow: "PEDIDO LOCAL DE VISITA",
  viewings_requestViewing: "Pedir uma visita",
  viewings_closeRequest: "Fechar pedido de visita",
  viewings_tenantCreateScope:
    "Os pedidos de visita podem ser criados na área do inquilino.",
  viewings_preferredDate: "Data preferida",
  viewings_preferredTime: "Hora preferida",
  viewings_optionalNote: "Nota (opcional)",
  viewings_requestDraftScope:
    "O rascunho por enviar mantém-se neste separador ao fechar o formulário ou mudar de página. Guarde o pedido para o adicionar à caixa partilhada de visitas.",
  viewings_saveRequest: "Guardar pedido de visita",
  viewings_tenantPropertyRequestsScope:
    "Os pedidos de visita e as candidaturas estão disponíveis na área do inquilino.",
  viewings_openRequest: "Abrir pedido de visita",
  viewings_continueViewingDraft: "Continuar rascunho de visita",
  viewings_localRequestLabel: "O seu pedido local de visita",
  viewings_proposedTimePending: "Horário proposto · aguarda a sua decisão",
  viewings_localRecordScope:
    "Apenas um registo local. Ninguém é contactado e nenhuma visita real é confirmada.",
  viewings_viewHistory: "Ver pedido e histórico",
  viewings_summaryTitle: "Visitas aos imóveis",
  viewings_openRequests: "Ver pedidos",
  viewings_noDecisions: "Nenhum pedido aguarda a sua decisão.",
  viewings_upcomingAgreedTimes: "Próximos horários aceites",
  viewings_localTime: "Hora local",
  viewings_summaryProposalHint: "Alteração proposta; horário atual mantido",
  viewings_noUpcomingAgreement: "Nenhuma visita futura tem um horário aceite.",
  viewings_summaryNoRequests: "Ainda não há pedidos de visita.",
  viewings_summaryHistoryHint:
    "Abra os pedidos para consultar propostas de horário e o histórico.",
  viewings_summaryTenantHint:
    "Pode pedir uma visita a partir de um anúncio de imóvel.",
  viewings_summaryOwnerHint:
    "Os pedidos relativos aos seus imóveis aparecem aqui.",
  viewings_filterAll: "Todos",
  viewings_statusPending: "Aguarda proprietário",
  viewings_statusProposed: "Alteração de horário proposta",
  viewings_statusAgreed: "Aceite neste separador",
  viewings_statusDeclined: "Recusado",
  viewings_statusCancelled: "Cancelado",
  viewings_filterHistory: "Histórico",
  viewings_proposalPending: "Aguarda inquilino",
  viewings_proposalAccepted: "Aceite localmente",
  viewings_proposalDeclined: "Recusada localmente",
  viewings_proposalSuperseded: "Substituída por uma proposta mais recente",
  viewings_proposalWithdrawn: "Retirada",
  viewings_errorUnavailable:
    "Este pedido já não está disponível nesta área de trabalho.",
  viewings_errorRole: "Só a área do inquilino pode criar um pedido de visita.",
  viewings_errorProperty: "Escolha um imóvel disponível no catálogo.",
  viewings_errorDate: "Escolha uma data válida, de hoje ou futura.",
  viewings_errorTime: "Escolha uma hora válida.",
  viewings_errorNoteLong: "Escreva uma nota com até 1.000 caracteres.",
  viewings_errorNoteRequired: "Adicione um motivo com 3 a 1.000 caracteres.",
  viewings_errorDuplicate:
    "Já existe um pedido ativo para este imóvel. Abra-o em Visitas.",
  viewings_errorStatus:
    "O pedido mudou. Reveja o estado atual antes de tentar novamente.",
  viewings_errorStaleProposal:
    "Esta proposta já não é a atual. Reveja a proposta mais recente antes de decidir.",
  viewings_errorNoChanges:
    "Escolha outra data ou hora antes de propor uma alteração.",
  viewings_errorPastTime:
    "Este horário já passou. É necessária uma nova proposta.",
  viewings_errorFallback:
    "Não foi possível guardar esta ação. Reveja o pedido atual e tente novamente.",
  viewings_historyRequested: "Pedido de visita guardado localmente",
  viewings_historyAccepted: "Proprietário aceitou o horário pedido",
  viewings_historyDeclined: "Proprietário recusou o pedido",
  viewings_historyProposed: "Proprietário propôs outro horário",
  viewings_historyProposalAccepted: "Inquilino aceitou o horário proposto",
  viewings_historyProposalDeclined: "Inquilino recusou a alteração proposta",
  viewings_historyCancelled: "Pedido de visita cancelado localmente",
  viewings_scope:
    "Os pedidos de visita e as respostas ficam neste separador até recarregar. Ninguém é contactado e nenhuma visita real ou arrendamento é confirmado. Os horários usam a hora local deste dispositivo.",
  viewings_requestsShown_one: "{{shownCount}} pedido apresentado",
  viewings_requestsShown_other: "{{shownCount}} pedidos apresentados",
  viewings_ownerDecision_one: "{{shownCount}} pedido aguarda a sua decisão",
  viewings_ownerDecision_other: "{{shownCount}} pedidos aguardam a sua decisão",
  viewings_tenantDecision_one: "{{shownCount}} proposta aguarda a sua decisão",
  viewings_tenantDecision_other:
    "{{shownCount}} propostas aguardam a sua decisão",
  viewings_requestsShown_many: "{{shownCount}} pedidos apresentados",
  viewings_ownerDecision_many: "{{shownCount}} pedidos aguardam a sua decisão",
  viewings_tenantDecision_many:
    "{{shownCount}} propostas aguardam a sua decisão",
  viewings_upcomingSubset: "Próximas {{shown}} de {{total}}",
  viewings_calendarDownload: "Descarregar visita (.ics)",
  viewings_calendarHint:
    "Usa a hora local. Verifique se o fuso horário do calendário corresponde ao deste dispositivo. Após alterações, descarregue novamente e atualize o calendário manualmente.",
  viewings_calendarSummary: "Visita ao imóvel",
  viewings_calendarDescription:
    "Horário de visita acordado localmente no Kasa. Este ficheiro é uma cópia do registo, não uma ligação ao calendário. Verifique o fuso horário local do calendário. Após alterações, descarregue novamente e atualize o calendário manualmente.",
  viewings_calendarStarted: "Transferência do ficheiro da visita iniciada.",
  viewings_calendarFailed:
    "Não foi possível descarregar a visita. Tente novamente.",
  viewings_calendarUnavailable:
    "Já não existe um horário futuro acordado para descarregar.",
} satisfies ViewingDictionary;
