import { expenseFr } from "./expense-fr";
import type { OperationsDictionary } from "./types";
import { rentFr } from "./rent-fr";
import { maintenanceFr } from "./maintenance-fr";
import { messagesFr } from "./messages-fr";

export const fr = {
  ...expenseFr,
  ...rentFr,
  ...maintenanceFr,
  ...messagesFr,
  documents_samplePreview: "Aperçu d’exemple",
  documents_localFile: "Fichier local",
  documents_closePreview: "Fermer l’aperçu du document",
  documents_sampleScope:
    "Un exemple explicatif, sans signature ni vérification.",
  documents_localScope:
    "Aperçu du fichier sélectionné dans cet onglet. Aucun fichier n’a été téléversé ni vérifié.",
  documents_downloadSample: "Télécharger le texte d’exemple",
  documents_downloadFile: "Télécharger le fichier",
  documents_textReadError:
    "Impossible d’afficher ce fichier texte. Vous pouvez télécharger le fichier original.",
  documents_imageReadError:
    "Impossible d’afficher cette image. Vous pouvez télécharger le fichier original.",
  documents_readingText: "Lecture du texte local…",
  documents_documentText: "Texte du document",
  documents_truncatedText:
    "L’aperçu affiche les 100 premiers Ko. Téléchargez le fichier pour lire le document complet.",
  documents_previewName: "Afficher {{name}}",
  documents_pdfPreview: "Aperçu PDF : {{name}}",
  documents_pdfFallback:
    "Si votre navigateur ne peut pas afficher ce PDF, utilisez Télécharger le fichier pour l’ouvrir dans votre lecteur PDF.",
  documents_totalsLabel: "Totaux des documents",
  documents_documentCount_one: "{{count}} document",
  documents_documentCount_other: "{{count}} documents",
  documents_documentCount_many: "{{count}} documents",
  documents_sampleCount_one: "{{count}} aperçu d’exemple",
  documents_sampleCount_other: "{{count}} aperçus d’exemple",
  documents_sampleCount_many: "{{count}} aperçus d’exemple",
  documents_localCount_one: "{{count}} fichier local",
  documents_localCount_other: "{{count}} fichiers locaux",
  documents_localCount_many: "{{count}} fichiers locaux",
  documents_storageUse: "{{used}} sur 50 Mo",
  documents_newCategory: "Catégorie des nouveaux fichiers",
  documents_addFiles: "Ajouter des fichiers locaux",
  documents_chooseFiles: "Choisir des documents locaux",
  documents_filesAdded_one:
    "{{count}} fichier ajouté dans cet onglet. Aucun fichier n’a été téléversé.",
  documents_filesAdded_other:
    "{{count}} fichiers ajoutés dans cet onglet. Aucun fichier n’a été téléversé.",
  documents_filesAdded_many:
    "{{count}} fichiers ajoutés dans cet onglet. Aucun fichier n’a été téléversé.",
  documents_noFilesAdded: "Aucun fichier n’a été ajouté.",
  documents_libraryScope:
    "Choisissez des fichiers PDF, PNG, JPEG, GIF, WebP ou texte (TXT, MD, CSV), de 10 Mo maximum chacun. Les fichiers locaux restent en mémoire dans cet onglet ; recharger la page les efface. Aucun téléversement, aucune signature ni vérification n’a lieu.",
  documents_addErrors: "Certains fichiers n’ont pas pu être ajoutés",
  documents_removedFromTab: "Retiré de cet onglet :",
  documents_restored: "{{name}} restauré dans cet onglet.",
  documents_undoRemove: "Annuler le retrait",
  documents_search: "Rechercher des documents",
  documents_searchPlaceholder: "Rechercher un nom ou une catégorie",
  documents_filterCategory: "Filtrer la catégorie des documents",
  documents_filterSource: "Filtrer la source des documents",
  documents_sort: "Trier les documents",
  documents_allCategories: "Toutes les catégories",
  documents_allDocuments: "Tous les documents",
  documents_localFiles: "Fichiers locaux",
  documents_samplePreviews: "Aperçus d’exemple",
  documents_recentlyAdded: "Ajoutés récemment",
  documents_documentName: "Nom du document",
  documents_largestFirst: "Plus volumineux d’abord",
  documents_resetFilters: "Réinitialiser les filtres",
  documents_resultCount: "Documents affichés : {{visible}} sur {{total}}",
  documents_workspaceDocuments: "Documents de l’espace de travail",
  documents_removeName: "Retirer {{name}} de cet onglet",
  documents_removeTitle: "Retirer de cet onglet",
  documents_removedFeedback:
    "{{name}} retiré de cet onglet. Le fichier original sur votre appareil reste inchangé.",
  documents_noMatches: "Aucun document ne correspond",
  documents_emptyLibrary: "Aucun document dans cet espace de travail",
  documents_noMatchesHint: "Modifiez les filtres ou essayez un autre nom.",
  documents_emptyLibraryHint:
    "Ajoutez un fichier local pour commencer votre bibliothèque.",
  documents_showAll: "Afficher tous les documents",
  documents_categoryLeaseProperty: "Bail et bien immobilier",
  documents_categoryRentMaintenance: "Loyer et entretien",
  documents_categoryPersonal: "Documents personnels",
  documents_categoryService: "Documents de services",
  documents_categoryVenue: "Documents des espaces",
  documents_categoryPlatform: "Documents de la plateforme",
  documents_categoryOther: "Autres",
  documents_errorEmpty: "Le fichier est vide.",
  documents_errorFileTooLarge: "Le fichier dépasse la limite de 10 Mo.",
  documents_errorUnsupportedFormat:
    "Choisissez un fichier PDF, PNG, JPEG, GIF, WebP, TXT, MD ou CSV.",
  documents_errorUnavailableCategory:
    "Choisissez une catégorie disponible dans cet espace de travail.",
  documents_errorAlreadyAdded:
    "Ce fichier est déjà dans cet espace de travail.",
  documents_errorWorkspaceFull:
    "Cet espace de travail a atteint la limite de 50 Mo de fichiers locaux.",
  documents_errorNothingToRestore: "Aucun document à restaurer.",
  documents_errorRestoreDuplicate:
    "Ce fichier se trouve déjà dans cet espace de travail.",
  documents_errorRestoreFull:
    "Retirez un autre fichier local pour libérer de l’espace avant de restaurer celui-ci.",
  documents_fileError: "{{fileName}} : {{message}}",
} satisfies OperationsDictionary;
