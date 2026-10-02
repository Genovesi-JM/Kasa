import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { Check, ImagePlus, ImageOff, Trash2 } from "lucide-react";
import type { Role } from "../types";
import {
  addSpaceListingPhotos,
  MAX_SPACE_LISTING_DRAFT_BYTES,
  MAX_SPACE_LISTING_PHOTO_BYTES,
  MAX_SPACE_LISTING_PHOTOS,
  MAX_SPACE_LISTING_WORKSPACE_BYTES,
  removeSpaceListingPhoto,
  setSpaceListingCover,
  SPACE_LISTING_PHOTO_ACCEPT,
  spaceListingDraft,
  type SpaceListingPhoto,
  type SpaceListingPhotoIssue,
  type SpaceListingState,
} from "./spaceListingState";
import "./spaceListingPhotos.css";

interface SpaceListingPhotosProps {
  role: Role;
  state: SpaceListingState;
  setState: Dispatch<SetStateAction<SpaceListingState>>;
  draftId: string;
  readOnly?: boolean;
}

type Copy = (en: string, pt: string) => string;
type PhotoError = { name: string; issue: SpaceListingPhotoIssue };
const megabyte = 1024 * 1024;

function photoIssueText(issue: SpaceListingPhotoIssue, copy: Copy): string {
  const messages: Record<SpaceListingPhotoIssue, string> = {
    empty: copy(
      "Choose a non-empty file.",
      "Escolha um ficheiro com conteúdo.",
    ),
    large: copy(
      `Each photo can use up to ${MAX_SPACE_LISTING_PHOTO_BYTES / megabyte} MB.`,
      `Cada fotografia pode ter até ${MAX_SPACE_LISTING_PHOTO_BYTES / megabyte} MB.`,
    ),
    format: copy(
      "Choose a JPEG, PNG or WebP image with a matching file type.",
      "Escolha uma imagem JPEG, PNG ou WebP com um tipo de ficheiro correspondente.",
    ),
    count: copy(
      `This draft can hold up to ${MAX_SPACE_LISTING_PHOTOS} photos. Remove a photo before adding another.`,
      `Este rascunho pode ter até ${MAX_SPACE_LISTING_PHOTOS} fotografias. Remova uma antes de adicionar outra.`,
    ),
    draftLimit: copy(
      `Photos in this draft can use up to ${MAX_SPACE_LISTING_DRAFT_BYTES / megabyte} MB. Remove a photo or choose a smaller file.`,
      `As fotografias deste rascunho podem ocupar até ${MAX_SPACE_LISTING_DRAFT_BYTES / megabyte} MB. Remova uma fotografia ou escolha um ficheiro menor.`,
    ),
    workspaceLimit: copy(
      `Retained venue photos can use up to ${MAX_SPACE_LISTING_WORKSPACE_BYTES / megabyte} MB across this workspace, including a removed draft kept for undo. Remove photos or choose smaller files.`,
      `As fotografias de espaços guardadas nesta área podem ocupar até ${MAX_SPACE_LISTING_WORKSPACE_BYTES / megabyte} MB, incluindo um rascunho removido que possa ser recuperado. Remova fotografias ou escolha ficheiros menores.`,
    ),
    duplicate: copy(
      "This selected file is already in the draft.",
      "Este ficheiro já está no rascunho.",
    ),
    unavailable: copy(
      "This draft is not available in this workspace.",
      "Este rascunho não está disponível nesta área de trabalho.",
    ),
  };
  return messages[issue];
}

function LocalVenuePhoto({
  photo,
  cover,
  copy,
}: {
  photo: SpaceListingPhoto;
  cover: boolean;
  copy: Copy;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    const url = URL.createObjectURL(
      new Blob([photo.file], { type: photo.mimeType }),
    );
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photo.file, photo.mimeType]);
  return (
    <div className="space-listing-photo-image">
      <img
        ref={image}
        alt={`${cover ? copy("Cover photo", "Fotografia de capa") : copy("Venue photo", "Fotografia do espaço")}: ${photo.file.name}`}
        hidden={failed}
        onError={() => setFailed(true)}
      />
      {failed && (
        <span>
          <ImageOff size={25} aria-hidden="true" />
          {copy(
            "This image cannot be previewed. You can remove it and choose another photo.",
            "Não é possível pré-visualizar esta imagem. Pode removê-la e escolher outra fotografia.",
          )}
        </span>
      )}
    </div>
  );
}

function PhotoPanel({
  role,
  state,
  setState,
  draftId,
  readOnly = false,
}: SpaceListingPhotosProps) {
  const { i18n } = useTranslation();
  const portuguese = (
    i18n.resolvedLanguage ??
    i18n.language ??
    "pt"
  ).startsWith("pt");
  const copy: Copy = (en, pt) => (portuguese ? pt : en);
  const locale = portuguese ? "pt-PT" : "en-GB";
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const [errors, setErrors] = useState<PhotoError[]>([]);
  const [feedback, setFeedback] = useState("");
  const draft = spaceListingDraft(state, role, draftId);
  if (!draft) return null;
  const totalBytes = draft.photos.reduce(
    (sum, photo) => sum + photo.file.size,
    0,
  );
  const size = (bytes: number) => {
    const unit = bytes >= megabyte ? "MB" : "KB";
    const amount = bytes >= megabyte ? bytes / megabyte : bytes / 1024;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount)} ${unit}`;
  };
  return (
    <section
      className={`space-listing-photos${readOnly ? " space-listing-photos-readonly" : ""}`}
      aria-labelledby={`${id}-title`}
    >
      <header>
        <div>
          <h4 id={`${id}-title`}>
            {copy("Venue photos", "Fotografias do espaço")}
            {!readOnly && <span> {copy("(optional)", "(opcional)")}</span>}
          </h4>
          {readOnly ? (
            <p>
              {draft.photos.length}{" "}
              {draft.photos.length === 1
                ? copy("photo", "fotografia")
                : copy("photos", "fotografias")}
              {draft.photos.length > 0 && <> · {size(totalBytes)}</>}
            </p>
          ) : (
            <p id={`${id}-limits`}>
              {copy(
                `JPEG, PNG or WebP · up to ${MAX_SPACE_LISTING_PHOTOS} photos · ${MAX_SPACE_LISTING_PHOTO_BYTES / megabyte} MB each · ${MAX_SPACE_LISTING_DRAFT_BYTES / megabyte} MB per draft`,
                `JPEG, PNG ou WebP · até ${MAX_SPACE_LISTING_PHOTOS} fotografias · ${MAX_SPACE_LISTING_PHOTO_BYTES / megabyte} MB cada · ${MAX_SPACE_LISTING_DRAFT_BYTES / megabyte} MB por rascunho`,
              )}
            </p>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            className="button button-secondary"
            ref={chooseButton}
            aria-describedby={`${id}-limits`}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={17} aria-hidden="true" />
            {copy("Choose photos", "Escolher fotografias")}
          </button>
        )}
      </header>
      {!readOnly && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept={SPACE_LISTING_PHOTO_ACCEPT}
            multiple
            hidden
            aria-label={copy(
              "Choose local venue photos",
              "Escolher fotografias locais do espaço",
            )}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (files.length) {
                const result = addSpaceListingPhotos(
                  state,
                  role,
                  draftId,
                  files,
                );
                setState(result.state);
                setErrors(result.errors);
                setFeedback(
                  copy(
                    result.added === 1
                      ? "1 photo added to this draft."
                      : `${result.added} photos added to this draft.`,
                    result.added === 1
                      ? "1 fotografia adicionada ao rascunho."
                      : `${result.added} fotografias adicionadas ao rascunho.`,
                  ),
                );
              }
              chooseButton.current?.focus({ preventScroll: true });
            }}
          />
          <p className="space-listing-photo-feedback" role="status">
            {feedback}
          </p>
          {errors.length > 0 && (
            <div className="space-listing-photo-errors" role="alert">
              <strong>
                {copy(
                  "Some photos could not be added",
                  "Não foi possível adicionar algumas fotografias",
                )}
              </strong>
              <ul>
                {errors.slice(0, 10).map((error, index) => (
                  <li key={`${error.name}-${index}`}>
                    {error.name && <strong>{error.name}: </strong>}
                    {photoIssueText(error.issue, copy)}
                  </li>
                ))}
              </ul>
              {errors.length > 10 && (
                <p>
                  {copy(
                    `${errors.length - 10} additional files were not added. Choose fewer files and try again.`,
                    `Não foram adicionados mais ${errors.length - 10} ficheiros. Escolha menos ficheiros e tente novamente.`,
                  )}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {draft.photos.length > 0 ? (
        <div className="space-listing-photo-grid">
          {draft.photos.map((photo) => {
            const isCover = photo.id === draft.coverPhotoId;
            return (
              <figure className="space-listing-photo-card" key={photo.id}>
                <LocalVenuePhoto photo={photo} cover={isCover} copy={copy} />
                <figcaption>
                  <strong>{photo.file.name}</strong>
                  <small>{size(photo.file.size)}</small>
                </figcaption>
                {readOnly ? (
                  isCover && (
                    <span className="space-listing-photo-cover">
                      <Check size={15} aria-hidden="true" />
                      {copy("Cover photo", "Fotografia de capa")}
                    </span>
                  )
                ) : (
                  <div className="space-listing-photo-actions">
                    <button
                      type="button"
                      className="text-button"
                      aria-pressed={isCover}
                      aria-label={`${copy("Use as cover", "Usar como capa")}: ${photo.file.name}`}
                      onClick={() => {
                        if (!isCover) {
                          setState((current) =>
                            setSpaceListingCover(
                              current,
                              role,
                              draftId,
                              photo.id,
                            ),
                          );
                          setFeedback(
                            copy(
                              `Cover photo selected: ${photo.file.name}.`,
                              `Fotografia de capa selecionada: ${photo.file.name}.`,
                            ),
                          );
                        }
                      }}
                    >
                      {isCover && <Check size={15} aria-hidden="true" />}
                      {isCover
                        ? copy("Cover photo", "Fotografia de capa")
                        : copy("Use as cover", "Usar como capa")}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`${copy("Remove photo", "Remover fotografia")}: ${photo.file.name}`}
                      onClick={() => {
                        chooseButton.current?.focus({ preventScroll: true });
                        setState((current) =>
                          removeSpaceListingPhoto(
                            current,
                            role,
                            draftId,
                            photo.id,
                          ),
                        );
                        setErrors([]);
                        setFeedback(
                          copy(
                            `Photo removed: ${photo.file.name}.`,
                            `Fotografia removida: ${photo.file.name}.`,
                          ),
                        );
                      }}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      {copy("Remove", "Remover")}
                    </button>
                  </div>
                )}
              </figure>
            );
          })}
        </div>
      ) : (
        <p className="space-listing-photo-empty">
          {readOnly
            ? copy(
                "No photos selected for this draft.",
                "Não foram selecionadas fotografias para este rascunho.",
              )
            : copy(
                "You can prepare this draft without photos. Add local images when you are ready.",
                "Pode preparar este rascunho sem fotografias. Adicione imagens locais quando quiser.",
              )}
        </p>
      )}
      {!readOnly && (
        <p className="space-listing-photo-scope">
          {draft.photos.length > 0 && (
            <>
              {draft.photos.length}/{MAX_SPACE_LISTING_PHOTOS}{" "}
              {copy("photos", "fotografias")} · {size(totalBytes)} ·{" "}
            </>
          )}
          {copy(
            "Selected files remain in this tab until reload; they are not uploaded.",
            "Os ficheiros selecionados ficam neste separador até recarregar; não são enviados.",
          )}
        </p>
      )}
    </section>
  );
}

export function SpaceListingPhotos(props: SpaceListingPhotosProps) {
  return <PhotoPanel key={`${props.role}:${props.draftId}`} {...props} />;
}
