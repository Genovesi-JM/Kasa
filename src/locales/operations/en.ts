import { expenseEn } from "./expense-en";
import { rentEn } from "./rent-en";
import { maintenanceEn } from "./maintenance-en";
import { messagesEn } from "./messages-en";

export const en = {
  ...expenseEn,
  ...rentEn,
  ...maintenanceEn,
  ...messagesEn,
  documents_samplePreview: "Sample preview",
  documents_localFile: "Local file",
  documents_closePreview: "Close document preview",
  documents_sampleScope:
    "An explanatory example, not a signed or verified document.",
  documents_localScope:
    "Previewing your selected file in this tab. Nothing has been uploaded or verified.",
  documents_downloadSample: "Download sample text",
  documents_downloadFile: "Download file",
  documents_textReadError:
    "This text file could not be previewed. You can still download your original file.",
  documents_imageReadError:
    "This image could not be previewed. You can still download your original file.",
  documents_readingText: "Reading local text…",
  documents_documentText: "Document text",
  documents_truncatedText:
    "Preview shows the first 100 KB. Download the file to read the full document.",
  documents_previewName: "Preview {{name}}",
  documents_pdfPreview: "PDF preview: {{name}}",
  documents_pdfFallback:
    "If your browser cannot display this PDF, use Download file to open it in your PDF reader.",
  documents_totalsLabel: "Document totals",
  documents_documentCount_one: "{{count}} document",
  documents_documentCount_other: "{{count}} documents",
  documents_sampleCount_one: "{{count}} sample preview",
  documents_sampleCount_other: "{{count}} sample previews",
  documents_localCount_one: "{{count}} local file",
  documents_localCount_other: "{{count}} local files",
  documents_storageUse: "{{used}} of 50 MB",
  documents_newCategory: "Category for new files",
  documents_addFiles: "Add local files",
  documents_chooseFiles: "Choose local documents",
  documents_filesAdded_one:
    "{{count}} file added in this tab. Nothing was uploaded.",
  documents_filesAdded_other:
    "{{count}} files added in this tab. Nothing was uploaded.",
  documents_noFilesAdded: "No files were added.",
  documents_libraryScope:
    "Choose PDF, PNG, JPEG, GIF, WebP or text files (TXT, MD, CSV), up to 10 MB each. Local files stay in memory in this tab; reloading clears them. No upload, signing or verification takes place.",
  documents_addErrors: "Some files could not be added",
  documents_removedFromTab: "Removed from this tab:",
  documents_restored: "{{name}} restored in this tab.",
  documents_undoRemove: "Undo remove",
  documents_search: "Search documents",
  documents_searchPlaceholder: "Search name or category",
  documents_filterCategory: "Filter document category",
  documents_filterSource: "Filter document source",
  documents_sort: "Sort documents",
  documents_allCategories: "All categories",
  documents_allDocuments: "All documents",
  documents_localFiles: "Local files",
  documents_samplePreviews: "Sample previews",
  documents_recentlyAdded: "Recently added",
  documents_documentName: "Document name",
  documents_largestFirst: "Largest first",
  documents_resetFilters: "Reset filters",
  documents_resultCount: "Documents shown: {{visible}} of {{total}}",
  documents_workspaceDocuments: "Workspace documents",
  documents_removeName: "Remove {{name}} from this tab",
  documents_removeTitle: "Remove from this tab",
  documents_removedFeedback:
    "{{name}} removed from this tab. The original file on your device is unchanged.",
  documents_noMatches: "No documents match",
  documents_emptyLibrary: "No documents in this workspace",
  documents_noMatchesHint: "Change the filters or try another name.",
  documents_emptyLibraryHint: "Add a local file to start your library.",
  documents_showAll: "Show all documents",
  documents_categoryLeaseProperty: "Lease & property",
  documents_categoryRentMaintenance: "Rent & maintenance",
  documents_categoryPersonal: "Personal records",
  documents_categoryService: "Service records",
  documents_categoryVenue: "Venue records",
  documents_categoryPlatform: "Platform records",
  documents_categoryOther: "Other",
  documents_errorEmpty: "The file is empty.",
  documents_errorFileTooLarge: "The file exceeds the 10 MB limit.",
  documents_errorUnsupportedFormat:
    "Choose a PDF, PNG, JPEG, GIF, WebP, TXT, MD or CSV file.",
  documents_errorUnavailableCategory:
    "Choose a category available in this workspace.",
  documents_errorAlreadyAdded: "This file is already in this workspace.",
  documents_errorWorkspaceFull:
    "This workspace has reached its 50 MB local-file limit.",
  documents_errorNothingToRestore: "There is no document to restore.",
  documents_errorRestoreDuplicate: "That file is already in this workspace.",
  documents_errorRestoreFull:
    "Remove another local file to make space before restoring this one.",
  documents_fileError: "{{fileName}}: {{message}}",
};
