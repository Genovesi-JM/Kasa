import {
  useEffect,
  useRef,
  useState,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ImageOff,
  X,
} from "lucide-react";
import type { Property } from "../types";
import { lockDialogScroll } from "./useDialogFocus";
import "./PropertyGallery.css";

const galleryCopy = {
  en: {
    close: "Close",
    photo: "Photo",
    gallery: "Property photos",
    previous: "Previous photo",
    next: "Next photo",
    unavailable: "This photo could not be loaded. Try another photo.",
    link: "Property link",
    copy: "Copy link",
    copied: "Link copied. Ready to share.",
    hint: "Anyone with this link can open this property.",
    manual: "Automatic copying is unavailable. Select and copy the link below.",
  },
  pt: {
    close: "Fechar",
    photo: "Foto",
    gallery: "Fotos do imóvel",
    previous: "Foto anterior",
    next: "Próxima foto",
    unavailable: "Não foi possível carregar esta foto. Veja outra foto.",
    link: "Link do imóvel",
    copy: "Copiar link",
    copied: "Link copiado. Pronto para partilhar.",
    hint: "Qualquer pessoa com este link pode abrir este imóvel.",
    manual:
      "A cópia automática não está disponível. Selecione e copie o link abaixo.",
  },
  es: {
    close: "Cerrar",
    photo: "Foto",
    gallery: "Fotos del inmueble",
    previous: "Foto anterior",
    next: "Foto siguiente",
    unavailable: "No se pudo cargar esta foto. Prueba con otra foto.",
    link: "Enlace del inmueble",
    copy: "Copiar enlace",
    copied: "Enlace copiado. Listo para compartir.",
    hint: "Cualquier persona con este enlace puede abrir este inmueble.",
    manual:
      "No se puede copiar automáticamente. Selecciona y copia el enlace de abajo.",
  },
  fr: {
    close: "Fermer",
    photo: "Photo",
    gallery: "Photos du logement",
    previous: "Photo précédente",
    next: "Photo suivante",
    unavailable:
      "Cette photo n’a pas pu être chargée. Essayez une autre photo.",
    link: "Lien du logement",
    copy: "Copier le lien",
    copied: "Lien copié. Prêt à partager.",
    hint: "Toute personne disposant de ce lien peut ouvrir ce logement.",
    manual:
      "La copie automatique n’est pas disponible. Sélectionnez et copiez le lien ci-dessous.",
  },
  ar: {
    close: "إغلاق",
    photo: "صورة",
    gallery: "صور العقار",
    previous: "الصورة السابقة",
    next: "الصورة التالية",
    unavailable: "تعذر تحميل هذه الصورة. جرّب صورة أخرى.",
    link: "رابط العقار",
    copy: "نسخ الرابط",
    copied: "تم نسخ الرابط. جاهز للمشاركة.",
    hint: "يمكن لأي شخص لديه هذا الرابط فتح صفحة العقار.",
    manual: "النسخ التلقائي غير متاح. حدد الرابط أدناه وانسخه.",
  },
  zh: {
    close: "关闭",
    photo: "照片",
    gallery: "房源照片",
    previous: "上一张照片",
    next: "下一张照片",
    unavailable: "无法加载此照片。请查看其他照片。",
    link: "房源链接",
    copy: "复制链接",
    copied: "链接已复制，可以分享。",
    hint: "任何拥有此链接的人都可以打开此房源。",
    manual: "无法自动复制。请选中并复制下方链接。",
  },
};

function useGalleryCopy() {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language).split("-")[0];
  return galleryCopy[language as keyof typeof galleryCopy] || galleryCopy.en;
}

function PropertyDialog({
  label,
  onClose,
  children,
  className = "",
  onKeyDown,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copy = useGalleryCopy();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>(".property-dialog-close")?.focus();
    const unlockScroll = lockDialogScroll();
    return () => {
      dialog?.close();
      unlockScroll();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`property-dialog ${className}`}
      aria-label={label}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="property-dialog-content">
        <header className="property-dialog-header">
          <h2>{label}</h2>
          <button
            type="button"
            className="property-dialog-close"
            onClick={onClose}
            aria-label={copy.close}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

function GalleryPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const copy = useGalleryCopy();
  return failed ? (
    <div
      className="property-photo-unavailable"
      role="img"
      aria-label={`${alt}. ${copy.unavailable}`}
    >
      <ImageOff size={28} aria-hidden="true" />
      <span>{copy.unavailable}</span>
    </div>
  ) : (
    <img src={src} alt={alt} onError={() => setFailed(true)} />
  );
}

function GalleryViewer({
  property,
  photos,
  startIndex,
  onClose,
}: {
  property: Property;
  photos: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const copy = useGalleryCopy();
  const move = (direction: number) =>
    setIndex(
      (current) => (current + direction + photos.length) % photos.length,
    );

  return (
    <PropertyDialog
      label={property.title}
      onClose={onClose}
      className="property-photo-dialog"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      <div className="property-photo-viewer">
        <div className="property-photo-stage">
          <GalleryPhoto
            key={photos[index]}
            src={photos[index]}
            alt={`${property.title} · ${copy.photo} ${index + 1}`}
          />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="property-photo-arrow previous"
                onClick={() => move(-1)}
                aria-label={copy.previous}
              >
                <ChevronLeft size={26} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="property-photo-arrow next"
                onClick={() => move(1)}
                aria-label={copy.next}
              >
                <ChevronRight size={26} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        <p
          className="property-photo-count"
          aria-live="polite"
          aria-atomic="true"
        >
          {copy.photo} {index + 1} / {photos.length}
        </p>
        {photos.length > 1 && (
          <div
            className="property-photo-thumbnails"
            role="group"
            aria-label={copy.gallery}
          >
            {photos.map((photo, photoIndex) => (
              <button
                key={`${photo}-${photoIndex}`}
                type="button"
                onClick={() => setIndex(photoIndex)}
                aria-label={`${copy.photo} ${photoIndex + 1}`}
                aria-pressed={index === photoIndex}
              >
                <img src={photo} alt="" loading="lazy" />
                <span>{photoIndex + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </PropertyDialog>
  );
}

export function PropertyGallery({
  property,
  viewPhotosLabel,
}: {
  property: Property;
  viewPhotosLabel: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const copy = useGalleryCopy();
  const photos = property.gallery.length ? property.gallery : [property.image];
  return (
    <>
      <section
        className="property-media"
        data-photo-count={Math.min(photos.length, 3)}
        aria-label={copy.gallery}
      >
        {photos.slice(0, 3).map((photo, index) => (
          <button
            type="button"
            className="property-media-tile"
            key={`${photo}-${index}`}
            onClick={() => setOpenIndex(index)}
            aria-label={`${viewPhotosLabel} · ${copy.photo} ${index + 1}`}
          >
            <GalleryPhoto
              key={photo}
              src={photo}
              alt={`${property.title} · ${copy.photo} ${index + 1}`}
            />
          </button>
        ))}
        <button
          type="button"
          className="property-media-open"
          onClick={() => setOpenIndex(0)}
        >
          <Camera size={17} aria-hidden="true" /> {viewPhotosLabel}{" "}
          <span>({photos.length})</span>
        </button>
      </section>
      {openIndex !== null && (
        <GalleryViewer
          property={property}
          photos={photos}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

export function PropertyShareButton({
  property,
  label,
}: {
  property: Property;
  label: string;
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = useGalleryCopy();

  const openShare = () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("app", "1");
    url.searchParams.set("role", "tenant");
    url.searchParams.set("view", "property");
    url.searchParams.set("property", String(property.id));
    setStatus("idle");
    setShareUrl(url.href);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
    } catch {
      setStatus("manual");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <>
      <button type="button" className="soft-button" onClick={openShare}>
        {label}
      </button>
      {shareUrl && (
        <PropertyDialog
          label={`${label} · ${property.title}`}
          onClose={() => setShareUrl(null)}
          className="property-share-dialog"
        >
          <div className="property-share-body">
            <p>{copy.hint}</p>
            <label htmlFor={`property-share-${property.id}`}>{copy.link}</label>
            <input
              id={`property-share-${property.id}`}
              ref={inputRef}
              type="url"
              value={shareUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="button property-share-copy"
              onClick={() => void copyLink()}
            >
              {status === "copied" ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <Copy size={17} aria-hidden="true" />
              )}
              {copy.copy}
            </button>
            <p className="property-share-status" role="status">
              {status === "copied"
                ? copy.copied
                : status === "manual"
                  ? copy.manual
                  : ""}
            </p>
          </div>
        </PropertyDialog>
      )}
    </>
  );
}
