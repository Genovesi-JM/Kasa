import { viewingPt } from "./viewing-pt";
import { expensePt } from "./expense-pt";
import type { OperationsDictionary } from "./types";
import { rentPt } from "./rent-pt";
import { maintenancePt } from "./maintenance-pt";
import { messagesPt } from "./messages-pt";

export const pt = {
  ...viewingPt,
  ...expensePt,
  ...rentPt,
  ...maintenancePt,
  ...messagesPt,
  documents_samplePreview: "Pré-visualização de exemplo",
  documents_localFile: "Ficheiro local",
  documents_closePreview: "Fechar pré-visualização do documento",
  documents_sampleScope:
    "Um exemplo explicativo, sem assinatura nem verificação.",
  documents_localScope:
    "A pré-visualizar o ficheiro selecionado neste separador. Nada foi enviado nem verificado.",
  documents_downloadSample: "Descarregar texto de exemplo",
  documents_downloadFile: "Descarregar ficheiro",
  documents_textReadError:
    "Não foi possível pré-visualizar este ficheiro de texto. Pode descarregar o ficheiro original.",
  documents_imageReadError:
    "Não foi possível pré-visualizar esta imagem. Pode descarregar o ficheiro original.",
  documents_readingText: "A ler o texto local…",
  documents_documentText: "Texto do documento",
  documents_truncatedText:
    "A pré-visualização mostra os primeiros 100 KB. Descarregue o ficheiro para ler o documento completo.",
  documents_previewName: "Pré-visualizar {{name}}",
  documents_pdfPreview: "Pré-visualização de PDF: {{name}}",
  documents_pdfFallback:
    "Se o navegador não apresentar este PDF, use Descarregar ficheiro para o abrir no seu leitor de PDF.",
  documents_totalsLabel: "Totais de documentos",
  documents_documentCount_one: "{{count}} documento",
  documents_documentCount_other: "{{count}} documentos",
  documents_documentCount_many: "{{count}} documentos",
  documents_sampleCount_one: "{{count}} pré-visualização de exemplo",
  documents_sampleCount_other: "{{count}} pré-visualizações de exemplo",
  documents_sampleCount_many: "{{count}} pré-visualizações de exemplo",
  documents_localCount_one: "{{count}} ficheiro local",
  documents_localCount_other: "{{count}} ficheiros locais",
  documents_localCount_many: "{{count}} ficheiros locais",
  documents_storageUse: "{{used}} de 50 MB",
  documents_newCategory: "Categoria dos novos ficheiros",
  documents_addFiles: "Adicionar ficheiros locais",
  documents_chooseFiles: "Escolher documentos locais",
  documents_filesAdded_one:
    "{{count}} ficheiro adicionado neste separador. Nada foi enviado.",
  documents_filesAdded_other:
    "{{count}} ficheiros adicionados neste separador. Nada foi enviado.",
  documents_filesAdded_many:
    "{{count}} ficheiros adicionados neste separador. Nada foi enviado.",
  documents_noFilesAdded: "Não foram adicionados ficheiros.",
  documents_libraryScope:
    "Escolha ficheiros PDF, PNG, JPEG, GIF, WebP ou de texto (TXT, MD, CSV), até 10 MB cada. Os ficheiros locais ficam na memória deste separador; recarregar a página apaga-os. Não há envio, assinatura nem verificação.",
  documents_addErrors: "Não foi possível adicionar alguns ficheiros",
  documents_removedFromTab: "Removido deste separador:",
  documents_restored: "{{name}} restaurado neste separador.",
  documents_undoRemove: "Anular remoção",
  documents_search: "Pesquisar documentos",
  documents_searchPlaceholder: "Pesquisar nome ou categoria",
  documents_filterCategory: "Filtrar categoria de documentos",
  documents_filterSource: "Filtrar origem de documentos",
  documents_sort: "Ordenar documentos",
  documents_allCategories: "Todas as categorias",
  documents_allDocuments: "Todos os documentos",
  documents_localFiles: "Ficheiros locais",
  documents_samplePreviews: "Pré-visualizações de exemplo",
  documents_recentlyAdded: "Adicionados recentemente",
  documents_documentName: "Nome do documento",
  documents_largestFirst: "Maiores primeiro",
  documents_resetFilters: "Limpar filtros",
  documents_resultCount: "Documentos apresentados: {{visible}} de {{total}}",
  documents_workspaceDocuments: "Documentos da área de trabalho",
  documents_removeName: "Remover {{name}} deste separador",
  documents_removeTitle: "Remover deste separador",
  documents_removedFeedback:
    "{{name}} removido deste separador. O ficheiro original no seu dispositivo não foi alterado.",
  documents_noMatches: "Nenhum documento corresponde à pesquisa",
  documents_emptyLibrary: "Não há documentos nesta área de trabalho",
  documents_noMatchesHint: "Altere os filtros ou experimente outro nome.",
  documents_emptyLibraryHint:
    "Adicione um ficheiro local para iniciar a sua biblioteca.",
  documents_showAll: "Mostrar todos os documentos",
  documents_categoryLeaseProperty: "Contrato e imóvel",
  documents_categoryRentMaintenance: "Renda e manutenção",
  documents_categoryPersonal: "Registos pessoais",
  documents_categoryService: "Registos de serviços",
  documents_categoryVenue: "Registos de espaços",
  documents_categoryPlatform: "Registos da plataforma",
  documents_categoryOther: "Outros",
  documents_errorEmpty: "O ficheiro está vazio.",
  documents_errorFileTooLarge: "O ficheiro excede o limite de 10 MB.",
  documents_errorUnsupportedFormat:
    "Escolha um ficheiro PDF, PNG, JPEG, GIF, WebP, TXT, MD ou CSV.",
  documents_errorUnavailableCategory:
    "Escolha uma categoria disponível nesta área de trabalho.",
  documents_errorAlreadyAdded: "Este ficheiro já está nesta área de trabalho.",
  documents_errorWorkspaceFull:
    "Esta área de trabalho atingiu o limite de 50 MB de ficheiros locais.",
  documents_errorNothingToRestore: "Não há nenhum documento para restaurar.",
  documents_errorRestoreDuplicate:
    "Esse ficheiro já está nesta área de trabalho.",
  documents_errorRestoreFull:
    "Remova outro ficheiro local para libertar espaço antes de restaurar este.",
  documents_fileError: "{{fileName}}: {{message}}",
} satisfies OperationsDictionary;
