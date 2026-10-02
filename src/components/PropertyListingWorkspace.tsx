import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  Home,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { Role } from "../types";
import { workspaceLandlordName } from "../propertyScope";
import { useDialogFocus } from "./useDialogFocus";
import {
  addPropertyListingPhotos,
  createPropertyListingDraft,
  listingDateValue,
  listingFurnishing,
  listingPriceCents,
  listingPropertyTypes,
  LISTING_PHOTO_ACCEPT,
  markPropertyListingReady,
  movePropertyListingStep,
  propertyListingRestoreIssue,
  removePropertyListingDraft,
  removePropertyListingPhoto,
  restorePropertyListingDraft,
  setPropertyListingCover,
  updatePropertyListingDraft,
  validatePropertyListingDraft,
  visiblePropertyListingDrafts,
  type ListingIssue,
  type ListingPhotoError,
  type ListingPhotoIssue,
  type PropertyListingDraft,
  type PropertyListingErrors,
  type PropertyListingFields,
  type PropertyListingIntent,
  type PropertyListingPhoto,
  type PropertyListingState,
  type PropertyListingStep,
} from "./propertyListingState";
import "./propertyListingWorkspace.css";

type Copy = (en: string, pt: string) => string;
interface PropertyListingWorkspaceProps {
  role: Role;
  state: PropertyListingState;
  setState: Dispatch<SetStateAction<PropertyListingState>>;
  onStartSpaceListing: () => void;
}

const labels = (copy: Copy): Record<keyof PropertyListingFields, string> => ({
  listingType: copy("Listing use", "Finalidade do anúncio"),
  title: copy("Property title", "Título do imóvel"),
  propertyType: copy("Property type", "Tipo de imóvel"),
  country: copy("Country", "País"),
  city: copy("City", "Cidade"),
  neighbourhood: copy("Neighbourhood (optional)", "Bairro (opcional)"),
  address: copy("Address", "Morada"),
  relationship: copy(
    "Your relationship to the property",
    "A sua relação com o imóvel",
  ),
  bedrooms: copy("Bedrooms", "Quartos"),
  bathrooms: copy("Bathrooms", "Casas de banho"),
  area: copy("Floor area (m²)", "Área (m²)"),
  rentPrice: copy("Monthly rent (€)", "Renda mensal (€)"),
  salePrice: copy("Asking price (€)", "Preço de venda (€)"),
  availability: copy(
    "Rental availability",
    "Disponibilidade para arrendamento",
  ),
  availableFrom: copy("Available from", "Disponível a partir de"),
  furnishing: copy("Furnishing", "Mobília"),
  description: copy("Description", "Descrição"),
});

function issueText(issue: ListingIssue, copy: Copy): string {
  return {
    listingType: copy(
      "Choose long-term rent or sale.",
      "Escolha arrendamento de longa duração ou venda.",
    ),
    title: copy(
      "Use a title between 3 and 120 characters.",
      "Use um título entre 3 e 120 caracteres.",
    ),
    propertyType: copy(
      "Choose a supported property type.",
      "Escolha um tipo de imóvel disponível.",
    ),
    country: copy(
      "Enter a country between 2 and 80 characters.",
      "Indique um país entre 2 e 80 caracteres.",
    ),
    city: copy(
      "Enter a city between 2 and 100 characters.",
      "Indique uma cidade entre 2 e 100 caracteres.",
    ),
    neighbourhood: copy(
      "Keep the neighbourhood under 100 characters.",
      "Use até 100 caracteres para o bairro.",
    ),
    address: copy(
      "Enter an address between 5 and 240 characters.",
      "Indique uma morada entre 5 e 240 caracteres.",
    ),
    relationship: copy(
      "Choose owner or authorised representative.",
      "Escolha proprietário ou representante autorizado.",
    ),
    bedrooms: copy(
      "Enter a whole number of bedrooms from 0 to 30.",
      "Indique um número inteiro de quartos entre 0 e 30.",
    ),
    bathrooms: copy(
      "Enter 0.5 to 30 bathrooms, in steps of 0.5.",
      "Indique entre 0,5 e 30 casas de banho, em incrementos de 0,5.",
    ),
    area: copy(
      "Enter an area greater than 0 and no more than 100,000 m².",
      "Indique uma área superior a 0 e até 100 000 m².",
    ),
    price: copy(
      "Enter a positive price up to €1 billion with up to two decimals, without thousands separators.",
      "Indique um preço positivo até mil milhões de euros, com até duas casas decimais e sem separadores de milhares.",
    ),
    availability: copy(
      "Choose available now or a future date.",
      "Escolha disponível agora ou uma data futura.",
    ),
    availableFrom: copy(
      "Choose a valid date that is today or later.",
      "Escolha uma data válida, a partir de hoje.",
    ),
    furnishing: copy(
      "Choose a furnishing option.",
      "Escolha uma opção de mobília.",
    ),
    description: copy(
      "Describe the property in 20 to 4,000 characters.",
      "Descreva o imóvel entre 20 e 4 000 caracteres.",
    ),
    photos: copy(
      "Check the selected photos and cover photo.",
      "Verifique as fotografias selecionadas e a fotografia de capa.",
    ),
  }[issue];
}

function photoIssueText(issue: ListingPhotoIssue, copy: Copy): string {
  return {
    empty: copy("The file is empty.", "O ficheiro está vazio."),
    large: copy(
      "Each photo must be 10 MB or smaller.",
      "Cada fotografia deve ter até 10 MB.",
    ),
    format: copy(
      "Choose a JPEG, PNG or WebP image.",
      "Escolha uma imagem JPEG, PNG ou WebP.",
    ),
    count: copy(
      "Each draft can have up to 20 photos.",
      "Cada rascunho pode ter até 20 fotografias.",
    ),
    draftLimit: copy(
      "Photos in one draft can total up to 50 MB.",
      "As fotografias de um rascunho podem ocupar até 50 MB.",
    ),
    workspaceLimit: copy(
      "Active drafts can hold up to 100 MB of photos. Remove photos to free space.",
      "Os rascunhos ativos podem conter até 100 MB de fotografias. Remova fotografias para libertar espaço.",
    ),
    duplicate: copy(
      "This selected file is already in the draft.",
      "Este ficheiro selecionado já está no rascunho.",
    ),
    unavailable: copy(
      "This draft is not available in this workspace.",
      "Este rascunho não está disponível neste espaço.",
    ),
  }[issue];
}

function optionText(value: string, copy: Copy): string {
  const translated: Record<string, string> = {
    Apartment: copy("Apartment", "Apartamento"),
    House: copy("House", "Moradia"),
    Studio: copy("Studio", "Estúdio"),
    Loft: "Loft",
    Furnished: copy("Furnished", "Mobilado"),
    Unfurnished: copy("Unfurnished", "Sem mobília"),
    "Part furnished": copy("Part furnished", "Parcialmente mobilado"),
    Owner: copy("Owner", "Proprietário"),
    "Authorised representative": copy(
      "Authorised representative",
      "Representante autorizado",
    ),
  };
  return translated[value] ?? value;
}

function ListingModal({
  title,
  onClose,
  children,
  closeLabel,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel: string;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const id = useId();
  return createPortal(
    <div
      className="modal-layer listing-workspace-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      ref={dialogRef}
    >
      <button
        type="button"
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="modal-card listing-workspace-dialog">
        <header>
          <h2 id={`${id}-title`}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={closeLabel}
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function ListingPhoto({
  photo,
  copy,
  className = "",
}: {
  photo: PropertyListingPhoto;
  copy: Copy;
  className?: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    const url = URL.createObjectURL(
      new Blob([photo.file], { type: photo.mimeType }),
    );
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  return (
    <div className={`listing-photo-image ${className}`}>
      <img
        ref={image}
        alt={photo.file.name}
        hidden={failed}
        onError={() => setFailed(true)}
      />
      {failed && (
        <span>
          {copy(
            "This photo cannot be previewed. Remove it or choose another image.",
            "Não é possível pré-visualizar esta fotografia. Remova-a ou escolha outra imagem.",
          )}
        </span>
      )}
    </div>
  );
}

function ListingPreview({
  draft,
  copy,
  locale,
}: {
  draft: PropertyListingDraft;
  copy: Copy;
  locale: string;
}) {
  const fields = draft.fields;
  const fieldLabels = labels(copy);
  const missing = copy("Not added", "Por adicionar");
  const price =
    fields.listingType === "Rent" ? fields.rentPrice : fields.salePrice;
  const cents = listingPriceCents(price);
  const priceLabel =
    cents === null
      ? price.trim() || missing
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(cents / 100);
  const cover = draft.photos.find((photo) => photo.id === draft.coverPhotoId);
  const displayDate = (date: string) => {
    const parsed = new Date(`${date}T12:00:00`);
    return Number.isFinite(parsed.getTime())
      ? parsed.toLocaleDateString(locale, { dateStyle: "long" })
      : date || missing;
  };
  const details = [
    [fieldLabels.propertyType, optionText(fields.propertyType, copy)],
    [fieldLabels.country, fields.country],
    [fieldLabels.city, fields.city],
    [fieldLabels.neighbourhood, fields.neighbourhood],
    [fieldLabels.address, fields.address],
    [fieldLabels.bedrooms, fields.bedrooms],
    [fieldLabels.bathrooms, fields.bathrooms],
    [fieldLabels.area, fields.area],
    [
      fieldLabels.furnishing,
      fields.furnishing ? optionText(fields.furnishing, copy) : "",
    ],
    [fieldLabels.relationship, optionText(fields.relationship, copy)],
    [copy("Draft owner", "Titular do rascunho"), draft.owner],
    ...(fields.listingType === "Rent"
      ? [
          [
            fieldLabels.availability,
            fields.availability === "now"
              ? copy("Available now", "Disponível agora")
              : displayDate(fields.availableFrom),
          ],
        ]
      : []),
  ];
  return (
    <div className="listing-draft-preview">
      {cover ? (
        <ListingPhoto
          key={cover.id}
          photo={cover}
          copy={copy}
          className="listing-preview-cover"
        />
      ) : (
        <div className="listing-preview-placeholder">
          <ImagePlus size={34} aria-hidden="true" />
          <span>
            {copy("No cover photo selected", "Sem fotografia de capa")}
          </span>
        </div>
      )}
      <div className="listing-preview-heading">
        <div>
          <span className="eyebrow">
            {fields.listingType === "Rent"
              ? copy("LONG-TERM RENTAL", "ARRENDAMENTO DE LONGA DURAÇÃO")
              : copy("PROPERTY FOR SALE", "IMÓVEL PARA VENDA")}
          </span>
          <h3>
            {fields.title.trim() ||
              copy("Untitled draft", "Rascunho sem título")}
          </h3>
        </div>
        <div className="listing-preview-price">
          <strong>{priceLabel}</strong>
          <small>
            {fields.listingType === "Rent"
              ? copy("per month", "por mês")
              : copy("asking price", "preço de venda")}
          </small>
        </div>
      </div>
      <dl className="listing-preview-details">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value.trim() || missing}</dd>
          </div>
        ))}
      </dl>
      <section className="listing-preview-description">
        <h4>{fieldLabels.description}</h4>
        <p>{fields.description.trim() || missing}</p>
      </section>
      {draft.photos.length > 1 && (
        <div className="listing-preview-gallery">
          {draft.photos
            .filter((photo) => photo.id !== draft.coverPhotoId)
            .map((photo) => (
              <ListingPhoto key={photo.id} photo={photo} copy={copy} />
            ))}
        </div>
      )}
      <p className="listing-local-note">
        {copy(
          "Preview of this local draft. It is not published, sent to moderation or verified.",
          "Pré-visualização deste rascunho local. Não foi publicado, enviado para moderação ou verificado.",
        )}
      </p>
    </div>
  );
}

function readFields(
  form: HTMLFormElement | null,
  fields: PropertyListingFields,
): Partial<PropertyListingFields> {
  if (!form) return {};
  const values = new FormData(form);
  const patch: Partial<PropertyListingFields> = {};
  for (const name of Object.keys(fields) as Array<
    keyof PropertyListingFields
  >) {
    const value = values.get(name);
    if (typeof value !== "string") continue;
    if (name === "listingType") {
      if (value === "Rent" || value === "Buy") patch.listingType = value;
    } else patch[name] = value;
  }
  return patch;
}

function DraftEditor({
  draft,
  role,
  state,
  setState,
  onClose,
  copy,
  locale,
}: {
  draft: PropertyListingDraft;
  role: Role;
  state: PropertyListingState;
  setState: Dispatch<SetStateAction<PropertyListingState>>;
  onClose: () => void;
  copy: Copy;
  locale: string;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoButton = useRef<HTMLButtonElement>(null);
  const [errors, setErrors] = useState<PropertyListingErrors>({});
  const [photoErrors, setPhotoErrors] = useState<ListingPhotoError[]>([]);
  const [feedback, setFeedback] = useState("");
  const [failedSubmit, setFailedSubmit] = useState(0);
  useEffect(() => {
    if (failedSubmit > 0) summary.current?.focus();
  }, [failedSubmit]);
  const fieldLabels = labels(copy);
  const change = (name: keyof PropertyListingFields, value: string) => {
    setState((current) =>
      updatePropertyListingDraft(current, role, draft.id, { [name]: value }),
    );
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setFeedback("");
  };
  const close = () => {
    const patch = readFields(form.current, draft.fields);
    setState((current) =>
      updatePropertyListingDraft(current, role, draft.id, patch),
    );
    onClose();
  };
  const focusHeading = () =>
    requestAnimationFrame(() => heading.current?.focus());
  const field = (
    name: keyof PropertyListingFields,
    options: {
      type?: string;
      maxLength?: number;
      wide?: boolean;
      choices?: Array<{ value: string; label: string }>;
      optional?: boolean;
      placeholder?: string;
      hint?: string;
    } = {},
  ) => (
    <label
      className={options.wide ? "listing-field-wide" : ""}
      htmlFor={`${id}-${name}`}
      key={name}
    >
      {fieldLabels[name]}
      {options.optional && name !== "neighbourhood"
        ? ` ${copy("(optional)", "(opcional)")}`
        : ""}
      {options.choices ? (
        <select
          id={`${id}-${name}`}
          name={name}
          aria-label={fieldLabels[name]}
          value={draft.fields[name]}
          required={!options.optional}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        >
          {options.choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : name === "description" ? (
        <textarea
          id={`${id}-${name}`}
          name={name}
          aria-label={fieldLabels[name]}
          value={draft.fields[name]}
          maxLength={4000}
          rows={5}
          required
          onInput={(event) => change(name, event.currentTarget.value)}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        />
      ) : (
        <input
          id={`${id}-${name}`}
          name={name}
          aria-label={fieldLabels[name]}
          type={options.type === "date" ? "date" : "text"}
          inputMode={
            options.type === "decimal"
              ? "decimal"
              : options.type === "integer"
                ? "numeric"
                : undefined
          }
          value={draft.fields[name]}
          min={options.type === "date" ? listingDateValue() : undefined}
          maxLength={options.maxLength}
          placeholder={options.placeholder}
          required={!options.optional}
          onInput={(event) => change(name, event.currentTarget.value)}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        />
      )}
      {options.hint && (
        <small className="listing-field-hint">{options.hint}</small>
      )}
      {errors[name] && (
        <small id={`${id}-${name}-error`} className="listing-field-error">
          {issueText(errors[name]!, copy)}
        </small>
      )}
    </label>
  );
  const stepNames = [
    copy("Basics", "Informações básicas"),
    copy("Details & photos", "Detalhes e fotografias"),
    copy("Review", "Revisão"),
  ];

  return (
    <ListingModal
      title={copy("Edit listing draft", "Editar rascunho do anúncio")}
      onClose={close}
      closeLabel={copy("Close and keep draft", "Fechar e manter rascunho")}
    >
      <form
        ref={form}
        className="modal-body listing-editor-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const action =
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
              "data-action",
            ) ?? (draft.step === 3 ? "ready" : "next");
          const patch = readFields(event.currentTarget, draft.fields);
          const candidate = { ...draft, fields: { ...draft.fields, ...patch } };
          const nextErrors = validatePropertyListingDraft(
            candidate,
            action === "next" && draft.step === 1 ? "basics" : "all",
          );
          setErrors(nextErrors);
          if (Object.keys(nextErrors).length) {
            const basics = [
              "listingType",
              "title",
              "propertyType",
              "country",
              "city",
              "neighbourhood",
              "address",
              "relationship",
            ];
            const errorStep = Object.keys(nextErrors).some((name) =>
              basics.includes(name),
            )
              ? 1
              : 2;
            setErrors(
              Object.fromEntries(
                Object.entries(nextErrors).filter(([name]) =>
                  errorStep === 1
                    ? basics.includes(name)
                    : !basics.includes(name),
                ),
              ),
            );
            setState((current) =>
              movePropertyListingStep(
                updatePropertyListingDraft(current, role, draft.id, patch),
                role,
                draft.id,
                errorStep,
              ),
            );
            setFailedSubmit((current) => current + 1);
            return;
          }
          setState((current) => {
            const updated = updatePropertyListingDraft(
              current,
              role,
              draft.id,
              patch,
            );
            return action === "ready"
              ? markPropertyListingReady(updated, role, draft.id)
              : movePropertyListingStep(
                  updated,
                  role,
                  draft.id,
                  (draft.step + 1) as PropertyListingStep,
                );
          });
          setFeedback(
            action === "ready"
              ? copy(
                  "Draft marked ready in this tab. Nothing was published or submitted.",
                  "Rascunho marcado como pronto neste separador. Nada foi publicado ou enviado.",
                )
              : "",
          );
          focusHeading();
        }}
      >
        <ol
          className="listing-step-indicator"
          aria-label={copy("Listing draft steps", "Etapas do rascunho")}
        >
          {stepNames.map((name, index) => (
            <li
              key={name}
              aria-current={draft.step === index + 1 ? "step" : undefined}
              className={draft.step >= index + 1 ? "active" : ""}
            >
              <span>{index + 1}</span>
              {name}
            </li>
          ))}
        </ol>
        <div className="listing-editor-step-heading">
          <h3 ref={heading} tabIndex={-1}>
            {stepNames[draft.step - 1]}
          </h3>
          <span
            className={`pill pill-${draft.status === "Ready" ? "mint" : "neutral"}`}
          >
            {draft.status === "Ready"
              ? copy("Ready in this tab", "Pronto neste separador")
              : copy("Draft", "Rascunho")}
          </span>
        </div>
        <p className="listing-local-note">
          {copy(
            "Edits stay in this tab while you navigate. Reloading clears drafts and photos. No upload or publication takes place.",
            "As alterações ficam neste separador enquanto navega. Recarregar apaga os rascunhos e fotografias. Não há carregamento nem publicação.",
          )}
        </p>
        {Object.keys(errors).length > 0 && (
          <div
            className="listing-form-errors"
            role="alert"
            tabIndex={-1}
            ref={summary}
          >
            <strong>
              {copy("Check these details", "Verifique estes dados")}
            </strong>
            <ul>
              {Object.entries(errors).map(([name, issue]) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById(`${id}-${name}`)?.focus()
                    }
                  >
                    {issueText(issue!, copy)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {draft.step === 1 && (
          <div className="listing-form-grid">
            {field("title", { wide: true, maxLength: 120 })}
            {field("listingType", {
              choices: [
                {
                  value: "Rent",
                  label: copy(
                    "Long-term rent",
                    "Arrendamento de longa duração",
                  ),
                },
                { value: "Buy", label: copy("Sale", "Venda") },
              ],
            })}
            {field("propertyType", {
              choices: listingPropertyTypes.map((value) => ({
                value,
                label: optionText(value, copy),
              })),
            })}
            {field("country", { maxLength: 80 })}
            {field("city", { maxLength: 100 })}
            {field("neighbourhood", { maxLength: 100, optional: true })}
            {field("relationship", {
              choices: ["Owner", "Authorised representative"].map((value) => ({
                value,
                label: optionText(value, copy),
              })),
            })}
            {field("address", { wide: true, maxLength: 240 })}
          </div>
        )}
        {draft.step === 2 && (
          <>
            <div className="listing-form-grid">
              {field("bedrooms", {
                type: "integer",
                maxLength: 3,
                hint: copy(
                  "Use 0 for a studio without a separate bedroom.",
                  "Use 0 para um estúdio sem quarto separado.",
                ),
              })}
              {field("bathrooms", { type: "decimal", maxLength: 5 })}
              {field("area", { type: "decimal", maxLength: 12 })}
              {field(
                draft.fields.listingType === "Rent" ? "rentPrice" : "salePrice",
                {
                  type: "decimal",
                  maxLength: 15,
                  hint: copy(
                    "Decimal point or comma; no thousands separators.",
                    "Ponto ou vírgula decimal; sem separadores de milhares.",
                  ),
                },
              )}
              {draft.fields.listingType === "Rent" &&
                field("availability", {
                  choices: [
                    {
                      value: "now",
                      label: copy("Available now", "Disponível agora"),
                    },
                    {
                      value: "date",
                      label: copy("From a date", "A partir de uma data"),
                    },
                  ],
                })}
              {draft.fields.listingType === "Rent" &&
                draft.fields.availability === "date" &&
                field("availableFrom", { type: "date" })}
              {field("furnishing", {
                optional: draft.fields.listingType === "Buy",
                choices: [
                  {
                    value: "",
                    label: copy("Choose an option", "Escolha uma opção"),
                  },
                  ...listingFurnishing.map((value) => ({
                    value,
                    label: optionText(value, copy),
                  })),
                ],
              })}
              {field("description", { wide: true })}
            </div>
            <section
              className="listing-photo-controls"
              aria-labelledby={`${id}-photo-title`}
            >
              <header>
                <div>
                  <h4 id={`${id}-photo-title`}>
                    {copy("Photos (optional)", "Fotografias (opcional)")}
                  </h4>
                  <p>
                    {copy(
                      "JPEG, PNG or WebP · 10 MB each · up to 20 photos and 50 MB per draft",
                      "JPEG, PNG ou WebP · 10 MB cada · até 20 fotografias e 50 MB por rascunho",
                    )}
                  </p>
                </div>
                <button
                  id={`${id}-photos`}
                  type="button"
                  className="button button-secondary"
                  ref={photoButton}
                  onClick={() => fileInput.current?.click()}
                >
                  <ImagePlus size={17} aria-hidden="true" />
                  {copy("Choose photos", "Escolher fotografias")}
                </button>
              </header>
              <input
                ref={fileInput}
                type="file"
                hidden
                multiple
                accept={LISTING_PHOTO_ACCEPT}
                aria-label={copy(
                  "Choose local property photos",
                  "Escolher fotografias locais do imóvel",
                )}
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  if (files.length) {
                    const result = addPropertyListingPhotos(
                      state,
                      role,
                      draft.id,
                      files,
                    );
                    setState(result.state);
                    setPhotoErrors(result.errors);
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
                    setErrors((current) => {
                      const next = { ...current };
                      delete next.photos;
                      return next;
                    });
                  }
                  event.currentTarget.value = "";
                  photoButton.current?.focus();
                }}
              />
              {photoErrors.length > 0 && (
                <ul className="listing-photo-errors" role="alert">
                  {photoErrors.map((error, index) => (
                    <li key={`${error.name}-${index}`}>
                      {error.name}: {photoIssueText(error.issue, copy)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="listing-photo-grid">
                {draft.photos.map((photo) => (
                  <article className="listing-photo-card" key={photo.id}>
                    <ListingPhoto photo={photo} copy={copy} />
                    <strong>{photo.file.name}</strong>
                    <div>
                      <button
                        type="button"
                        className="text-button"
                        disabled={draft.coverPhotoId === photo.id}
                        onClick={() =>
                          setState((current) =>
                            setPropertyListingCover(
                              current,
                              role,
                              draft.id,
                              photo.id,
                            ),
                          )
                        }
                      >
                        {draft.coverPhotoId === photo.id ? (
                          <>
                            <Check size={14} aria-hidden="true" />
                            {copy("Cover", "Capa")}
                          </>
                        ) : (
                          copy("Use as cover", "Usar como capa")
                        )}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`${copy("Remove photo", "Remover fotografia")} ${photo.file.name}`}
                        onClick={() => {
                          setState((current) =>
                            removePropertyListingPhoto(
                              current,
                              role,
                              draft.id,
                              photo.id,
                            ),
                          );
                          setPhotoErrors([]);
                          requestAnimationFrame(() =>
                            photoButton.current?.focus(),
                          );
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        {copy("Remove", "Remover")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!draft.photos.length && (
                <p className="listing-local-note">
                  {copy(
                    "You can keep a draft without photos. A selected photo can be used as its cover.",
                    "Pode manter um rascunho sem fotografias. Uma fotografia selecionada pode ser usada como capa.",
                  )}
                </p>
              )}
            </section>
          </>
        )}
        {draft.step === 3 && (
          <ListingPreview draft={draft} copy={copy} locale={locale} />
        )}
        <p className="listing-workspace-feedback" role="status">
          {feedback}
        </p>
        <div className="listing-editor-actions">
          {draft.step > 1 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                const patch = readFields(form.current, draft.fields);
                setState((current) =>
                  movePropertyListingStep(
                    updatePropertyListingDraft(current, role, draft.id, patch),
                    role,
                    draft.id,
                    (draft.step - 1) as PropertyListingStep,
                  ),
                );
                setErrors({});
                setFeedback("");
                focusHeading();
              }}
            >
              {copy("Back", "Voltar")}
            </button>
          )}
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            {copy("Save and close", "Guardar e fechar")}
          </button>
          <button
            type="submit"
            className="button"
            data-action={draft.step === 3 ? "ready" : "next"}
            disabled={draft.step === 3 && draft.status === "Ready"}
          >
            {draft.step === 3 ? (
              draft.status === "Ready" ? (
                <>
                  <CheckCircle2 size={17} aria-hidden="true" />
                  {copy("Ready in this tab", "Pronto neste separador")}
                </>
              ) : (
                copy(
                  "Mark ready in this tab",
                  "Marcar como pronto neste separador",
                )
              )
            ) : (
              <>
                {copy("Continue", "Continuar")}
                <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </ListingModal>
  );
}

type OpenListingDialog =
  { kind: "chooser" } | { kind: "edit" | "preview"; id: string };

function OwnerListingWorkspace({
  role,
  state,
  setState,
  onStartSpaceListing,
}: PropertyListingWorkspaceProps) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "pt";
  const portuguese = language.startsWith("pt");
  const copy: Copy = (en, pt) => (portuguese ? pt : en);
  const locale = portuguese ? "pt-PT" : "en-GB";
  const [dialog, setDialog] = useState<OpenListingDialog | null>(null);
  const [feedback, setFeedback] = useState("");
  const undoButton = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const drafts = visiblePropertyListingDrafts(state, role).sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.id.localeCompare(left.id, undefined, { numeric: true }),
  );
  const selected =
    dialog && dialog.kind !== "chooser"
      ? drafts.find((draft) => draft.id === dialog.id)
      : undefined;
  const removed =
    role === "landlord" && state.removed?.owner === workspaceLandlordName
      ? state.removed
      : null;
  const restoreIssue = removed
    ? propertyListingRestoreIssue(state, role)
    : null;
  const startDraft = (intent: PropertyListingIntent) => {
    const result = createPropertyListingDraft(state, role, intent);
    if (!result.draftId) return;
    setState(result.state);
    setDialog({ kind: "edit", id: result.draftId });
    setFeedback("");
  };
  if (role !== "landlord") return null;

  return (
    <section
      className="property-listing-workspace"
      aria-labelledby="property-listing-workspace-title"
    >
      <header className="listing-workspace-heading">
        <div>
          <h2 id="property-listing-workspace-title">
            {copy("Listing drafts", "Rascunhos de anúncios")}{" "}
            <span>{drafts.length}</span>
          </h2>
          <p>
            {copy(
              "Prepare a long-term rental or sale listing in this workspace.",
              "Prepare um anúncio de arrendamento de longa duração ou venda neste espaço.",
            )}
          </p>
        </div>
        <button
          ref={addButton}
          type="button"
          className="button"
          onClick={() => setDialog({ kind: "chooser" })}
        >
          <Plus size={17} aria-hidden="true" />
          {copy("Advertise property or space", "Anunciar imóvel ou espaço")}
        </button>
      </header>
      {drafts.length ? (
        <div className="listing-draft-list">
          {drafts.map((draft) => {
            const cover = draft.photos.find(
              (photo) => photo.id === draft.coverPhotoId,
            );
            return (
              <article className="card listing-draft-row" key={draft.id}>
                {cover ? (
                  <ListingPhoto
                    key={cover.id}
                    photo={cover}
                    copy={copy}
                    className="listing-draft-thumbnail"
                  />
                ) : (
                  <span className="listing-draft-placeholder">
                    <Home size={28} aria-hidden="true" />
                  </span>
                )}
                <div className="listing-draft-copy">
                  <span className="eyebrow">
                    {draft.fields.listingType === "Rent"
                      ? copy("LONG-TERM RENT", "ARRENDAMENTO DE LONGA DURAÇÃO")
                      : copy("SALE", "VENDA")}
                  </span>
                  <h3>
                    {draft.fields.title.trim() ||
                      copy("Untitled draft", "Rascunho sem título")}
                  </h3>
                  <p>
                    {[draft.fields.city.trim(), draft.fields.country.trim()]
                      .filter(Boolean)
                      .join(" · ") ||
                      copy("Location to add", "Localização por adicionar")}
                  </p>
                  <small>
                    {copy("Updated", "Atualizado")}{" "}
                    {new Date(draft.updatedAt).toLocaleString(locale, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </small>
                  <span
                    className={`pill pill-${draft.status === "Ready" ? "mint" : "neutral"}`}
                  >
                    {draft.status === "Ready"
                      ? copy("Ready in this tab", "Pronto neste separador")
                      : copy("Draft", "Rascunho")}
                  </span>
                </div>
                <div className="listing-draft-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setDialog({ kind: "edit", id: draft.id })}
                  >
                    <Pencil size={15} aria-hidden="true" />
                    {copy("Resume", "Continuar edição")}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDialog({ kind: "preview", id: draft.id })}
                  >
                    <Eye size={15} aria-hidden="true" />
                    {copy("Preview", "Pré-visualizar")}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`${copy("Delete draft", "Eliminar rascunho")}: ${draft.fields.title || draft.id}`}
                    onClick={() => {
                      setState((current) =>
                        removePropertyListingDraft(current, role, draft.id),
                      );
                      setFeedback(
                        copy(
                          "Draft removed. You can undo the latest deletion.",
                          "Rascunho removido. Pode desfazer a última eliminação.",
                        ),
                      );
                      requestAnimationFrame(() => undoButton.current?.focus());
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {copy("Delete", "Eliminar")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card listing-drafts-empty">
          <Building2 size={28} aria-hidden="true" />
          <div>
            <h3>
              {copy(
                "No listing drafts yet",
                "Ainda não há rascunhos de anúncios",
              )}
            </h3>
            <p>
              {copy(
                "Choose an asset use to start. Your existing property records stay below.",
                "Escolha a finalidade do imóvel para começar. Os registos existentes continuam abaixo.",
              )}
            </p>
          </div>
        </div>
      )}
      <p className="listing-workspace-feedback" role="status">
        {feedback}
      </p>
      {removed && (
        <div className="listing-undo">
          <span>
            {copy("Last deleted draft", "Último rascunho eliminado")}:{" "}
            <strong>
              {removed.fields.title.trim() ||
                copy("Untitled draft", "Rascunho sem título")}
            </strong>
            {restoreIssue && (
              <small>{photoIssueText(restoreIssue, copy)}</small>
            )}
          </span>
          <button
            ref={undoButton}
            type="button"
            className="button button-secondary"
            disabled={Boolean(restoreIssue)}
            onClick={() => {
              setState((current) => restorePropertyListingDraft(current, role));
              setFeedback(
                copy(
                  "Draft restored with its fields and photos.",
                  "Rascunho restaurado com os dados e fotografias.",
                ),
              );
              requestAnimationFrame(() => addButton.current?.focus());
            }}
          >
            <Undo2 size={16} aria-hidden="true" />
            {copy("Undo delete", "Desfazer eliminação")}
          </button>
        </div>
      )}
      {dialog?.kind === "chooser" && (
        <ListingModal
          title={copy(
            "What would you like to advertise?",
            "O que pretende anunciar?",
          )}
          onClose={() => setDialog(null)}
          closeLabel={copy(
            "Close listing chooser",
            "Fechar escolha do anúncio",
          )}
        >
          <div className="modal-body listing-asset-chooser">
            <p>
              {copy(
                "Choose how the asset will be used.",
                "Escolha como o imóvel ou espaço será utilizado.",
              )}
            </p>
            <button type="button" onClick={() => startDraft("Rent")}>
              <Home size={24} aria-hidden="true" />
              <span>
                <strong>
                  {copy(
                    "Long-term rental property",
                    "Imóvel para arrendamento de longa duração",
                  )}
                </strong>
                <small>
                  {copy(
                    "Residential use in months or years.",
                    "Uso residencial em meses ou anos.",
                  )}
                </small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => startDraft("Buy")}>
              <Building2 size={24} aria-hidden="true" />
              <span>
                <strong>
                  {copy("Property for sale", "Imóvel para venda")}
                </strong>
                <small>
                  {copy(
                    "Prepare an owner-controlled sale listing.",
                    "Prepare um anúncio de venda controlado pelo proprietário.",
                  )}
                </small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDialog(null);
                onStartSpaceListing();
              }}
            >
              <CalendarDays size={24} aria-hidden="true" />
              <span>
                <strong>
                  {copy(
                    "Reservable sports or event space",
                    "Espaço desportivo ou de eventos para reserva",
                  )}
                </strong>
                <small>
                  {copy(
                    "Open the separate Space Operator setup. No overnight stays.",
                    "Abrir a configuração de Operador de Espaços. Sem estadias noturnas.",
                  )}
                </small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </ListingModal>
      )}
      {dialog?.kind === "edit" && selected && (
        <DraftEditor
          key={selected.id}
          draft={selected}
          role={role}
          state={state}
          setState={setState}
          onClose={() => setDialog(null)}
          copy={copy}
          locale={locale}
        />
      )}
      {dialog?.kind === "preview" && selected && (
        <ListingModal
          title={copy("Draft preview", "Pré-visualização do rascunho")}
          onClose={() => setDialog(null)}
          closeLabel={copy("Close draft preview", "Fechar pré-visualização")}
        >
          <div className="modal-body">
            <ListingPreview draft={selected} copy={copy} locale={locale} />
            <div className="listing-editor-actions">
              <button
                type="button"
                className="button"
                onClick={() => setDialog({ kind: "edit", id: selected.id })}
              >
                <Pencil size={16} aria-hidden="true" />
                {copy("Edit draft", "Editar rascunho")}
              </button>
            </div>
          </div>
        </ListingModal>
      )}
    </section>
  );
}

export function PropertyListingWorkspace(props: PropertyListingWorkspaceProps) {
  return <OwnerListingWorkspace key={props.role} {...props} />;
}
