import { viewingEs } from "./viewing-es";
import { expenseEs } from "./expense-es";
import type { OperationsDictionary } from "./types";
import { rentEs } from "./rent-es";
import { maintenanceEs } from "./maintenance-es";
import { messagesEs } from "./messages-es";

export const es = {
  ...viewingEs,
  ...expenseEs,
  ...rentEs,
  ...maintenanceEs,
  ...messagesEs,
  documents_samplePreview: "Vista previa de ejemplo",
  documents_localFile: "Archivo local",
  documents_closePreview: "Cerrar vista previa del documento",
  documents_sampleScope: "Un ejemplo explicativo, sin firma ni verificación.",
  documents_localScope:
    "Vista previa del archivo seleccionado en esta pestaña. No se ha subido ni verificado nada.",
  documents_downloadSample: "Descargar texto de ejemplo",
  documents_downloadFile: "Descargar archivo",
  documents_textReadError:
    "No se ha podido mostrar este archivo de texto. Puede descargar el archivo original.",
  documents_imageReadError:
    "No se ha podido mostrar esta imagen. Puede descargar el archivo original.",
  documents_readingText: "Leyendo texto local…",
  documents_documentText: "Texto del documento",
  documents_truncatedText:
    "La vista previa muestra los primeros 100 KB. Descargue el archivo para leer el documento completo.",
  documents_previewName: "Vista previa de {{name}}",
  documents_pdfPreview: "Vista previa de PDF: {{name}}",
  documents_pdfFallback:
    "Si el navegador no muestra este PDF, use Descargar archivo para abrirlo en su lector de PDF.",
  documents_totalsLabel: "Totales de documentos",
  documents_documentCount_one: "{{count}} documento",
  documents_documentCount_other: "{{count}} documentos",
  documents_documentCount_many: "{{count}} documentos",
  documents_sampleCount_one: "{{count}} vista previa de ejemplo",
  documents_sampleCount_other: "{{count}} vistas previas de ejemplo",
  documents_sampleCount_many: "{{count}} vistas previas de ejemplo",
  documents_localCount_one: "{{count}} archivo local",
  documents_localCount_other: "{{count}} archivos locales",
  documents_localCount_many: "{{count}} archivos locales",
  documents_storageUse: "{{used}} de 50 MB",
  documents_newCategory: "Categoría de los nuevos archivos",
  documents_addFiles: "Añadir archivos locales",
  documents_chooseFiles: "Elegir documentos locales",
  documents_filesAdded_one:
    "{{count}} archivo añadido en esta pestaña. No se ha subido nada.",
  documents_filesAdded_other:
    "{{count}} archivos añadidos en esta pestaña. No se ha subido nada.",
  documents_filesAdded_many:
    "{{count}} archivos añadidos en esta pestaña. No se ha subido nada.",
  documents_noFilesAdded: "No se han añadido archivos.",
  documents_libraryScope:
    "Elija archivos PDF, PNG, JPEG, GIF, WebP o de texto (TXT, MD, CSV), de hasta 10 MB cada uno. Los archivos locales se guardan en la memoria de esta pestaña; al recargar se borran. No se sube, firma ni verifica ningún archivo.",
  documents_addErrors: "No se han podido añadir algunos archivos",
  documents_removedFromTab: "Eliminado de esta pestaña:",
  documents_restored: "{{name}} restaurado en esta pestaña.",
  documents_undoRemove: "Deshacer eliminación",
  documents_search: "Buscar documentos",
  documents_searchPlaceholder: "Buscar por nombre o categoría",
  documents_filterCategory: "Filtrar categoría de documentos",
  documents_filterSource: "Filtrar origen de documentos",
  documents_sort: "Ordenar documentos",
  documents_allCategories: "Todas las categorías",
  documents_allDocuments: "Todos los documentos",
  documents_localFiles: "Archivos locales",
  documents_samplePreviews: "Vistas previas de ejemplo",
  documents_recentlyAdded: "Añadidos recientemente",
  documents_documentName: "Nombre del documento",
  documents_largestFirst: "Más grandes primero",
  documents_resetFilters: "Restablecer filtros",
  documents_resultCount: "Documentos mostrados: {{visible}} de {{total}}",
  documents_workspaceDocuments: "Documentos del espacio de trabajo",
  documents_removeName: "Eliminar {{name}} de esta pestaña",
  documents_removeTitle: "Eliminar de esta pestaña",
  documents_removedFeedback:
    "{{name}} eliminado de esta pestaña. El archivo original de su dispositivo no se ha modificado.",
  documents_noMatches: "Ningún documento coincide",
  documents_emptyLibrary: "No hay documentos en este espacio de trabajo",
  documents_noMatchesHint: "Cambie los filtros o pruebe otro nombre.",
  documents_emptyLibraryHint:
    "Añada un archivo local para iniciar su biblioteca.",
  documents_showAll: "Mostrar todos los documentos",
  documents_categoryLeaseProperty: "Contrato e inmueble",
  documents_categoryRentMaintenance: "Alquiler y mantenimiento",
  documents_categoryPersonal: "Registros personales",
  documents_categoryService: "Registros de servicios",
  documents_categoryVenue: "Registros de espacios",
  documents_categoryPlatform: "Registros de la plataforma",
  documents_categoryOther: "Otros",
  documents_errorEmpty: "El archivo está vacío.",
  documents_errorFileTooLarge: "El archivo supera el límite de 10 MB.",
  documents_errorUnsupportedFormat:
    "Elija un archivo PDF, PNG, JPEG, GIF, WebP, TXT, MD o CSV.",
  documents_errorUnavailableCategory:
    "Elija una categoría disponible en este espacio de trabajo.",
  documents_errorAlreadyAdded:
    "Este archivo ya está en este espacio de trabajo.",
  documents_errorWorkspaceFull:
    "Este espacio de trabajo ha alcanzado el límite de 50 MB de archivos locales.",
  documents_errorNothingToRestore: "No hay ningún documento para restaurar.",
  documents_errorRestoreDuplicate:
    "Ese archivo ya está en este espacio de trabajo.",
  documents_errorRestoreFull:
    "Elimine otro archivo local para liberar espacio antes de restaurar este.",
  documents_fileError: "{{fileName}}: {{message}}",
} satisfies OperationsDictionary;
