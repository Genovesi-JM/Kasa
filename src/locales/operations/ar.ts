import { viewingAr } from "./viewing-ar";
import { expenseAr } from "./expense-ar";
import type { OperationsDictionary } from "./types";
import { rentAr } from "./rent-ar";
import { maintenanceAr } from "./maintenance-ar";
import { messagesAr } from "./messages-ar";

export const ar = {
  ...viewingAr,
  ...expenseAr,
  ...rentAr,
  ...maintenanceAr,
  ...messagesAr,
  documents_samplePreview: "معاينة نموذج",
  documents_localFile: "ملف محلي",
  documents_closePreview: "إغلاق معاينة المستند",
  documents_sampleScope: "نموذج توضيحي، وليس مستندًا موقّعًا أو متحققًا منه.",
  documents_localScope:
    "معاينة الملف المحدد في علامة التبويب هذه. لم يُرفع أو يُتحقق من أي ملف.",
  documents_downloadSample: "تنزيل نص النموذج",
  documents_downloadFile: "تنزيل الملف",
  documents_textReadError:
    "تعذّرت معاينة هذا الملف النصي. يمكنك تنزيل الملف الأصلي.",
  documents_imageReadError:
    "تعذّرت معاينة هذه الصورة. يمكنك تنزيل الملف الأصلي.",
  documents_readingText: "جارٍ قراءة النص المحلي…",
  documents_documentText: "نص المستند",
  documents_truncatedText:
    "تعرض المعاينة أول 100 كيلوبايت. نزّل الملف لقراءة المستند كاملًا.",
  documents_previewName: "معاينة {{name}}",
  documents_pdfPreview: "معاينة PDF: {{name}}",
  documents_pdfFallback:
    "إذا تعذّر عرض ملف PDF في المتصفح، استخدم تنزيل الملف لفتحه في قارئ PDF.",
  documents_totalsLabel: "إجمالي المستندات",
  documents_documentCount_zero: "{{count}} مستندات",
  documents_documentCount_one: "مستند واحد ({{count}})",
  documents_documentCount_two: "مستندان ({{count}})",
  documents_documentCount_few: "{{count}} مستندات",
  documents_documentCount_many: "{{count}} مستندًا",
  documents_documentCount_other: "{{count}} مستند",
  documents_sampleCount_zero: "{{count}} معاينات نماذج",
  documents_sampleCount_one: "معاينة نموذج واحدة ({{count}})",
  documents_sampleCount_two: "معاينتا نموذج ({{count}})",
  documents_sampleCount_few: "{{count}} معاينات نماذج",
  documents_sampleCount_many: "{{count}} معاينة نموذج",
  documents_sampleCount_other: "{{count}} معاينة نموذج",
  documents_localCount_zero: "{{count}} ملفات محلية",
  documents_localCount_one: "ملف محلي واحد ({{count}})",
  documents_localCount_two: "ملفان محليان ({{count}})",
  documents_localCount_few: "{{count}} ملفات محلية",
  documents_localCount_many: "{{count}} ملفًا محليًا",
  documents_localCount_other: "{{count}} ملف محلي",
  documents_storageUse: "{{used}} من 50 ميغابايت",
  documents_newCategory: "فئة الملفات الجديدة",
  documents_addFiles: "إضافة ملفات محلية",
  documents_chooseFiles: "اختيار مستندات محلية",
  documents_filesAdded_zero:
    "لم تُضف ملفات ({{count}}) في علامة التبويب هذه. لم يُرفع أي ملف.",
  documents_filesAdded_one:
    "أُضيف ملف واحد ({{count}}) في علامة التبويب هذه. لم يُرفع أي ملف.",
  documents_filesAdded_two:
    "أُضيف ملفان ({{count}}) في علامة التبويب هذه. لم يُرفع أي ملف.",
  documents_filesAdded_few:
    "أُضيفت {{count}} ملفات في علامة التبويب هذه. لم يُرفع أي ملف.",
  documents_filesAdded_many:
    "أُضيف {{count}} ملفًا في علامة التبويب هذه. لم يُرفع أي ملف.",
  documents_filesAdded_other:
    "أُضيف {{count}} ملف في علامة التبويب هذه. لم يُرفع أي ملف.",
  documents_noFilesAdded: "لم تُضف أي ملفات.",
  documents_libraryScope:
    "اختر ملفات PDF أو PNG أو JPEG أو GIF أو WebP أو ملفات نصية (TXT وMD وCSV)، بحد أقصى 10 ميغابايت لكل ملف. تبقى الملفات المحلية في ذاكرة علامة التبويب هذه؛ وتُمسح عند إعادة التحميل. لا يُرفع أي ملف ولا يُوقّع ولا يُتحقق منه.",
  documents_addErrors: "تعذّرت إضافة بعض الملفات",
  documents_removedFromTab: "أُزيل من علامة التبويب هذه:",
  documents_restored: "استُعيد {{name}} في علامة التبويب هذه.",
  documents_undoRemove: "التراجع عن الإزالة",
  documents_search: "البحث في المستندات",
  documents_searchPlaceholder: "البحث بالاسم أو الفئة",
  documents_filterCategory: "تصفية فئة المستندات",
  documents_filterSource: "تصفية مصدر المستندات",
  documents_sort: "ترتيب المستندات",
  documents_allCategories: "جميع الفئات",
  documents_allDocuments: "جميع المستندات",
  documents_localFiles: "الملفات المحلية",
  documents_samplePreviews: "معاينات النماذج",
  documents_recentlyAdded: "المضافة حديثًا",
  documents_documentName: "اسم المستند",
  documents_largestFirst: "الأكبر أولًا",
  documents_resetFilters: "إعادة ضبط عوامل التصفية",
  documents_resultCount: "المستندات المعروضة: {{visible}} من {{total}}",
  documents_workspaceDocuments: "مستندات مساحة العمل",
  documents_removeName: "إزالة {{name}} من علامة التبويب هذه",
  documents_removeTitle: "إزالة من علامة التبويب هذه",
  documents_removedFeedback:
    "أُزيل {{name}} من علامة التبويب هذه. لم يتغير الملف الأصلي على جهازك.",
  documents_noMatches: "لا توجد مستندات مطابقة",
  documents_emptyLibrary: "لا توجد مستندات في مساحة العمل هذه",
  documents_noMatchesHint: "غيّر عوامل التصفية أو جرّب اسمًا آخر.",
  documents_emptyLibraryHint: "أضف ملفًا محليًا لبدء مكتبتك.",
  documents_showAll: "عرض جميع المستندات",
  documents_categoryLeaseProperty: "الإيجار والعقار",
  documents_categoryRentMaintenance: "دفعات الإيجار والصيانة",
  documents_categoryPersonal: "السجلات الشخصية",
  documents_categoryService: "سجلات الخدمات",
  documents_categoryVenue: "سجلات المرافق",
  documents_categoryPlatform: "سجلات المنصة",
  documents_categoryOther: "أخرى",
  documents_errorEmpty: "الملف فارغ.",
  documents_errorFileTooLarge: "يتجاوز الملف حد 10 ميغابايت.",
  documents_errorUnsupportedFormat:
    "اختر ملف PDF أو PNG أو JPEG أو GIF أو WebP أو TXT أو MD أو CSV.",
  documents_errorUnavailableCategory: "اختر فئة متاحة في مساحة العمل هذه.",
  documents_errorAlreadyAdded: "هذا الملف موجود بالفعل في مساحة العمل هذه.",
  documents_errorWorkspaceFull:
    "بلغت مساحة العمل هذه حد 50 ميغابايت للملفات المحلية.",
  documents_errorNothingToRestore: "لا يوجد مستند لاستعادته.",
  documents_errorRestoreDuplicate: "ذلك الملف موجود بالفعل في مساحة العمل هذه.",
  documents_errorRestoreFull:
    "أزل ملفًا محليًا آخر لتوفير مساحة قبل استعادة هذا الملف.",
  documents_fileError: "{{fileName}}: {{message}}",
} satisfies OperationsDictionary;
