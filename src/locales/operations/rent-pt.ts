import type { RentDictionary } from "./rent-types";

export const rentPt = {
  rent_title: "Registos de renda",
  rent_record: "Registo de renda",
  rent_privateDraft: "Rascunho privado",
  rent_transferDraftScope:
    "Os dados da transferência por concluir permanecem privados na sua área de inquilino neste separador. Ao fechar, o rascunho é mantido; ao recarregar a página, é eliminado.",
  rent_correctionDraftScope:
    "Esta nota de correção por concluir permanece privada na sua área de senhorio neste separador até guardar o pedido. Ao fechar, é mantida; ao recarregar a página, é eliminada.",
  rent_resumeTransferDraft: "Retomar rascunho da transferência",
  rent_resumeCorrectionDraft: "Retomar rascunho de correção",
  rent_inspectDraft: "Ver rascunho por concluir",
  rent_discardDraft: "Descartar rascunho",
  rent_draftDiscarded:
    "Rascunho privado descartado. O registo de renda permanece inalterado.",
  rent_backToRecord: "Voltar ao registo",
  rent_staleDraft: "O registo de renda foi alterado",
  rent_staleDraftNote:
    "Os valores por concluir continuam disponíveis para copiar. Não podem substituir o registo mais recente. Descarte este rascunho antes de recomeçar.",
  rent_draftUnavailable:
    "Este rascunho não pode ser guardado no registo atual. Reveja o registo mais recente antes de continuar.",
  rent_statusAwaitingDetails: "A aguardar dados da transferência",
  rent_statusAwaitingOwner: "A aguardar confirmação do senhorio",
  rent_statusCorrection: "Precisa de correção",
  rent_statusConfirmed: "Confirmado",
  rent_editTransfer: "Editar dados da transferência",
  rent_recordTransfer: "Registar dados da transferência",
  rent_formScope:
    "Use dados de exemplo. Este formulário regista a descrição de uma transferência; não movimenta dinheiro nem envia comprovativos.",
  rent_checkDetails: "Verifique estes dados",
  rent_transferredAmount: "Montante transferido (€)",
  rent_decimalHint:
    "Use um ponto ou uma vírgula decimal, sem separadores de milhares.",
  rent_transferDate: "Data da transferência",
  rent_transferReference: "Referência da transferência",
  rent_referencePlaceholder: "Por exemplo, EXEMPLO-RENDA-SETEMBRO",
  rent_optionalNote: "Nota (opcional)",
  rent_transferNote: "Nota da transferência",
  rent_cancelEdit: "Cancelar edição",
  rent_saveTransfer: "Guardar dados da transferência",
  rent_errorAmount:
    "Introduza um montante entre 0,01 € e 1 000 000 €, com até duas casas decimais.",
  rent_errorDate:
    "Escolha uma data de transferência válida, de hoje ou anterior.",
  rent_errorReference:
    "Introduza uma referência de transferência de 1 a 100 caracteres numa só linha.",
  rent_errorNote: "Use até 1 000 caracteres.",
  rent_errorCorrection:
    "Descreva o que precisa de correção em 1 a 500 caracteres.",
  rent_summaryCopied: "Resumo do registo de exemplo copiado.",
  rent_clipboardUnavailable:
    "Não foi possível aceder à área de transferência. Selecione e copie o resumo abaixo.",
  rent_closeRecord: "Fechar registo de renda",
  rent_amountDue: "Montante devido",
  rent_dueDate: "Data de vencimento",
  rent_owner: "Proprietário do anúncio",
  rent_recordId: "ID do registo",
  rent_correctionRequested: "Correção pedida",
  rent_transferSaved:
    "Dados da transferência guardados. A aguardar revisão na área do senhorio.",
  rent_recordedTransfer: "Transferência registada",
  rent_recordedAmount: "Montante registado",
  rent_reference: "Referência",
  rent_note: "Nota",
  rent_amountMismatch:
    "O montante registado difere do valor da renda. Corrija os dados antes da confirmação do senhorio.",
  rent_noTransfer:
    "Ainda não foram registados dados de transferência para este período.",
  rent_ownerReview: "Revisão do senhorio",
  rent_reviewScope:
    "A confirmação altera este registo de exemplo; não verifica uma transação bancária.",
  rent_requestCorrection: "Pedir correção",
  rent_ownerConfirmed: "Confirmação do senhorio registada neste separador.",
  rent_confirmTransfer: "Confirmar transferência registada",
  rent_correctionSaved:
    "Pedido de correção guardado neste separador. O inquilino pode editar o registo.",
  rent_correctionQuestion: "O que precisa de correção?",
  rent_saveCorrection: "Guardar pedido de correção",
  rent_history: "Histórico do registo",
  rent_historyScope: "Valores registados e mantidos neste separador.",
  rent_historyAfter: "Após esta alteração",
  rent_historyBefore: "Antes desta alteração",
  rent_historyEmpty: "Não registado",
  rent_copying: "A copiar…",
  rent_copySummary: "Copiar resumo de exemplo",
  rent_sampleSummary: "Resumo de exemplo",
  rent_csvStarted: "Descarga do CSV iniciada. Registos incluídos: {{count}}.",
  rent_csvFailed:
    "Não foi possível descarregar o CSV. Tente novamente num navegador que permita descarregar ficheiros.",
  rent_workspaceScope:
    "Os registos de renda estão disponíveis nas áreas do inquilino e do senhorio.",
  rent_tenantTitle: "Mantenha os dados das transferências juntos",
  rent_ownerTitle: "Reveja as transferências de renda registadas",
  rent_sessionScope:
    "Os registos de exemplo ficam neste separador até recarregar a página. Não há movimentação de dinheiro nem indicação de conta bancária.",
  rent_metricsLabel: "Resumo dos registos de renda de todos os períodos",
  rent_confirmedMetric: "Confirmado nos registos de exemplo",
  rent_allPeriodsCount: "Registos de todos os períodos: {{count}}",
  rent_awaitingReview: "A aguardar revisão do senhorio",
  rent_recordedDetails: "Dados de transferência registados",
  rent_missingDetails: "Dados por adicionar ou corrigir",
  rent_inspectHint: "Abra um registo para o consultar",
  rent_period: "Período",
  rent_allPeriods: "Todos os períodos",
  rent_status: "Estado",
  rent_allStatuses: "Todos os estados",
  rent_property: "Imóvel",
  rent_allProperties: "Todos os imóveis",
  rent_sort: "Ordenar",
  rent_recentlyUpdated: "Atualizados mais recentemente",
  rent_amountHighLow: "Montante: maior para menor",
  rent_propertyName: "Nome do imóvel",
  rent_resetActive: "Limpar ({{count}})",
  rent_resetSort: "Repor ordenação",
  rent_matchingCount: "Registos que correspondem aos filtros: {{count}}",
  rent_exportCsv: "Exportar CSV dos registos visíveis",
  rent_openRecord:
    "Abrir registo de renda de {{period}} de {{tenant}}, {{property}}",
  rent_rentAmount: "Valor da renda",
  rent_noMatches: "Nenhum registo corresponde aos filtros",
  rent_noMatchesHint: "Altere o filtro de período, estado ou imóvel.",
  rent_resetFilters: "Limpar filtros",
  rent_summaryScope:
    "Registo de renda de exemplo do Kasa — não é uma instrução de pagamento nem um recibo bancário.",
  rent_summaryBankNotice:
    "Não é indicada nenhuma conta bancária. Não use este exemplo para fazer um pagamento.",
  rent_tenant: "Inquilino",
  rent_summaryTransfer: "Transferência registada: {{amount}} em {{date}}",
  rent_csvScope: "Âmbito",
  rent_csvAmountDue: "Montante devido EUR",
  rent_csvRecordedAmount: "Montante registado EUR",
  rent_correctionNote: "Nota de correção",
  rent_csvScopeValue: "Registo de sessão de exemplo; sem confirmação bancária",
} satisfies RentDictionary;
