import type { RentDictionary } from "./rent-types";

export const rentFr = {
  rent_title: "Registres de loyer",
  rent_record: "Registre de loyer",
  rent_privateDraft: "Brouillon privé",
  rent_transferDraftScope:
    "Les détails du virement inachevés restent privés dans votre espace locataire, dans cet onglet. Fermer conserve le brouillon ; recharger la page le supprime.",
  rent_correctionDraftScope:
    "Cette note de correction inachevée reste privée dans votre espace propriétaire, dans cet onglet, jusqu’à l’enregistrement de la demande. Fermer la conserve ; recharger la page la supprime.",
  rent_resumeTransferDraft: "Reprendre le brouillon de virement",
  rent_resumeCorrectionDraft: "Reprendre le brouillon de correction",
  rent_inspectDraft: "Voir le brouillon inachevé",
  rent_discardDraft: "Supprimer le brouillon",
  rent_draftDiscarded:
    "Brouillon privé supprimé. Le registre de loyer reste inchangé.",
  rent_backToRecord: "Revenir au registre",
  rent_staleDraft: "Le registre de loyer a changé",
  rent_staleDraftNote:
    "Vos valeurs inachevées restent disponibles pour être copiées. Elles ne peuvent pas remplacer le registre plus récent. Supprimez ce brouillon avant de recommencer.",
  rent_draftUnavailable:
    "Ce brouillon ne peut pas être enregistré dans le registre actuel. Consultez le registre le plus récent avant de continuer.",
  rent_statusAwaitingDetails: "En attente des détails du virement",
  rent_statusAwaitingOwner: "En attente de confirmation du propriétaire",
  rent_statusCorrection: "Correction nécessaire",
  rent_statusConfirmed: "Confirmé",
  rent_editTransfer: "Modifier les détails du virement",
  rent_recordTransfer: "Saisir les détails du virement",
  rent_formScope:
    "Utilisez des exemples. Ce formulaire décrit un virement ; il ne transfère pas d’argent et ne téléverse aucun justificatif.",
  rent_checkDetails: "Vérifiez ces informations",
  rent_transferredAmount: "Montant viré (€)",
  rent_decimalHint:
    "Utilisez un point ou une virgule décimale, sans séparateur de milliers.",
  rent_transferDate: "Date du virement",
  rent_transferReference: "Référence du virement",
  rent_referencePlaceholder: "Par exemple, EXEMPLE-LOYER-SEPTEMBRE",
  rent_optionalNote: "Note (facultative)",
  rent_transferNote: "Note du virement",
  rent_cancelEdit: "Annuler la modification",
  rent_saveTransfer: "Enregistrer les détails du virement",
  rent_errorAmount:
    "Saisissez un montant compris entre 0,01 € et 1 000 000 €, avec deux décimales maximum.",
  rent_errorDate:
    "Choisissez une date de virement valide, aujourd’hui ou avant.",
  rent_errorReference:
    "Saisissez une référence de virement de 1 à 100 caractères sur une seule ligne.",
  rent_errorNote: "Utilisez 1 000 caractères maximum.",
  rent_errorCorrection:
    "Décrivez la correction nécessaire en 1 à 500 caractères.",
  rent_summaryCopied: "Résumé du registre d’exemple copié.",
  rent_clipboardUnavailable:
    "Le presse-papiers est inaccessible. Sélectionnez et copiez le résumé ci-dessous.",
  rent_closeRecord: "Fermer le registre de loyer",
  rent_amountDue: "Montant dû",
  rent_dueDate: "Date d’échéance",
  rent_owner: "Propriétaire de l’annonce",
  rent_recordId: "ID du registre",
  rent_correctionRequested: "Correction demandée",
  rent_transferSaved:
    "Détails du virement enregistrés. En attente de vérification dans l’espace du propriétaire.",
  rent_recordedTransfer: "Virement enregistré",
  rent_recordedAmount: "Montant enregistré",
  rent_reference: "Référence",
  rent_note: "Note",
  rent_amountMismatch:
    "Le montant enregistré diffère du loyer. Corrigez les détails avant la confirmation du propriétaire.",
  rent_noTransfer:
    "Aucun détail de virement n’a été enregistré pour cette période.",
  rent_ownerReview: "Examen par le propriétaire",
  rent_reviewScope:
    "La confirmation modifie ce registre d’exemple ; elle ne vérifie pas une transaction bancaire.",
  rent_requestCorrection: "Demander une correction",
  rent_ownerConfirmed:
    "Confirmation du propriétaire enregistrée dans cet onglet.",
  rent_confirmTransfer: "Confirmer le virement enregistré",
  rent_correctionSaved:
    "Demande de correction enregistrée dans cet onglet. Le locataire peut modifier le registre.",
  rent_correctionQuestion: "Que faut-il corriger ?",
  rent_saveCorrection: "Enregistrer la demande de correction",
  rent_history: "Historique du registre",
  rent_historyScope: "Valeurs enregistrées et conservées dans cet onglet.",
  rent_historyAfter: "Après cette modification",
  rent_historyBefore: "Avant cette modification",
  rent_historyEmpty: "Non renseigné",
  rent_copying: "Copie en cours…",
  rent_copySummary: "Copier le résumé d’exemple",
  rent_sampleSummary: "Résumé d’exemple",
  rent_csvStarted: "Téléchargement du CSV lancé. Registres inclus : {{count}}.",
  rent_csvFailed:
    "Impossible de télécharger le CSV. Réessayez dans un navigateur permettant le téléchargement de fichiers.",
  rent_workspaceScope:
    "Les registres de loyer sont disponibles dans les espaces du locataire et du propriétaire.",
  rent_tenantTitle: "Regroupez les détails de vos virements",
  rent_ownerTitle: "Examinez les virements de loyer enregistrés",
  rent_sessionScope:
    "Les registres d’exemple restent dans cet onglet jusqu’au rechargement. Aucun argent n’est transféré et aucun compte bancaire n’est fourni.",
  rent_metricsLabel: "Résumé des registres de loyer, toutes périodes",
  rent_confirmedMetric: "Confirmé dans les registres d’exemple",
  rent_allPeriodsCount: "Registres de toutes les périodes : {{count}}",
  rent_awaitingReview: "En attente de l’examen du propriétaire",
  rent_recordedDetails: "Détails de virement enregistrés",
  rent_missingDetails: "Détails à ajouter ou à corriger",
  rent_inspectHint: "Ouvrez un registre pour le consulter",
  rent_period: "Période",
  rent_allPeriods: "Toutes les périodes",
  rent_status: "Statut",
  rent_allStatuses: "Tous les statuts",
  rent_property: "Bien immobilier",
  rent_allProperties: "Tous les biens",
  rent_sort: "Trier",
  rent_recentlyUpdated: "Mis à jour récemment",
  rent_amountHighLow: "Montant décroissant",
  rent_propertyName: "Nom du bien",
  rent_resetActive: "Réinitialiser ({{count}})",
  rent_resetSort: "Réinitialiser le tri",
  rent_matchingCount: "Registres correspondant aux filtres : {{count}}",
  rent_exportCsv: "Exporter les registres visibles en CSV",
  rent_openRecord:
    "Ouvrir le registre de loyer de {{period}} pour {{tenant}}, {{property}}",
  rent_rentAmount: "Montant du loyer",
  rent_noMatches: "Aucun registre ne correspond",
  rent_noMatchesHint: "Modifiez le filtre de période, de statut ou de bien.",
  rent_resetFilters: "Réinitialiser les filtres",
  rent_summaryScope:
    "Registre de loyer d’exemple Kasa — ce n’est ni une instruction de paiement ni un reçu bancaire.",
  rent_summaryBankNotice:
    "Aucun compte bancaire n’est fourni. N’utilisez pas cet exemple pour effectuer un paiement.",
  rent_tenant: "Locataire",
  rent_summaryTransfer: "Virement enregistré : {{amount}} le {{date}}",
  rent_csvScope: "Portée",
  rent_csvAmountDue: "Montant dû EUR",
  rent_csvRecordedAmount: "Montant enregistré EUR",
  rent_correctionNote: "Note de correction",
  rent_csvScopeValue:
    "Registre de session d’exemple ; sans confirmation bancaire",
} satisfies RentDictionary;
