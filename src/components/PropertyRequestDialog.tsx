import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, FileCheck2, X } from "lucide-react";
import type { Property, Role } from "../types";
import {
  discardRentalApplicationDraft,
  hasRentalApplicationDraft,
  rentalApplicationDraft,
  submitRentalApplicationDraft,
  tenantApplicationForProperty,
  updateRentalApplicationDraft,
  type ApplicationState,
  type RentalApplicationComposerDraft,
} from "./applicationState";
import {
  isActiveViewing,
  localDateValue,
  pendingViewingProposal,
  viewingDrafts,
  viewingForProperty,
  type PropertyRequestState,
  type RequestErrors,
} from "./propertyRequestState";
import { useDialogFocus } from "./useDialogFocus";
import { ViewingRequestDialog } from "./ViewingRequestDialog";
import { useViewingCopy } from "./viewingCopy";
import "./propertyRequests.css";

function applicationFormValues(
  form: HTMLFormElement,
): RentalApplicationComposerDraft {
  const data = new FormData(form);
  return {
    moveInDate: String(data.get("date") ?? ""),
    householdSize: String(data.get("householdSize") ?? ""),
    introduction: String(data.get("introduction") ?? ""),
  };
}

function retainApplicationForm(
  state: ApplicationState,
  role: Role,
  propertyId: number,
  captured: RentalApplicationComposerDraft,
): ApplicationState {
  const current = rentalApplicationDraft(state, role, propertyId);
  if (
    !current ||
    (!hasRentalApplicationDraft(state, role, propertyId) &&
      current.moveInDate === captured.moveInDate &&
      current.householdSize === captured.householdSize &&
      current.introduction === captured.introduction)
  )
    return state;
  return updateRentalApplicationDraft(state, role, propertyId, captured);
}

function RentalApplicationDialog({
  property,
  role,
  state,
  setState,
  onClose,
  onSaved,
}: {
  property: Property;
  role: Role;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const { text } = useViewingCopy();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const closedExplicitly = useRef(false);
  const draft = rentalApplicationDraft(state, role, property.id);
  const [errors, setErrors] = useState<RequestErrors>({});
  const [issue, setIssue] =
    useState<ReturnType<typeof submitRentalApplicationDraft>["issue"]>(null);
  useLayoutEffect(() => {
    const currentForm = form.current;
    return () => {
      if (closedExplicitly.current || !currentForm) return;
      const captured = applicationFormValues(currentForm);
      setState((current) =>
        retainApplicationForm(current, role, property.id, captured),
      );
    };
  }, [property.id, role, setState]);
  const keepDraftAndClose = () => {
    const captured = form.current ? applicationFormValues(form.current) : null;
    closedExplicitly.current = true;
    if (captured)
      setState((current) =>
        retainApplicationForm(current, role, property.id, captured),
      );
    onClose();
  };
  const dialog = useDialogFocus<HTMLDivElement>(keepDraftAndClose);
  const message = (field: keyof RequestErrors) =>
    field === "date"
      ? text(
          "Choose today or a future move-in date.",
          "Escolha uma data de entrada de hoje ou futura.",
        )
      : field === "householdSize"
        ? text(
            "Enter the number of people as a whole number of 1 or more.",
            "Introduza um número inteiro de pessoas, igual ou superior a 1.",
          )
        : text(
            "Use 1,000 characters or fewer.",
            "Escreva até 1.000 caracteres.",
          );
  const fieldError = (field: keyof RequestErrors) =>
    errors[field] && (
      <small className="property-request-error" id={`${id}-${field}-error`}>
        {message(field)}
      </small>
    );
  function capture(
    currentForm: HTMLFormElement | null,
    field: keyof RequestErrors,
  ) {
    if (!currentForm) return;
    const captured = applicationFormValues(currentForm);
    setState((current) =>
      updateRentalApplicationDraft(current, role, property.id, captured),
    );
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIssue(null);
  }
  const invalidFields = Object.keys(errors).filter(
    (field) => errors[field as keyof RequestErrors],
  );
  const issueMessage =
    issue === "duplicate"
      ? text(
          "An application for this home already exists. Close this draft and open Applications to inspect it.",
          "Já existe uma candidatura para este imóvel. Feche este rascunho e abra Candidaturas para a consultar.",
        )
      : issue === "unavailable"
        ? text(
            "This home is not available for a rental application in this workspace.",
            "Este imóvel não está disponível para uma candidatura nesta área de trabalho.",
          )
        : text(
            "The application could not be saved. Review your details and try again.",
            "Não foi possível guardar a candidatura. Reveja os dados e tente novamente.",
          );
  if (!draft) return null;
  return createPortal(
    <div
      className="modal-layer property-request-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-scope`}
      tabIndex={-1}
      ref={dialog}
    >
      <button
        type="button"
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={keepDraftAndClose}
      />
      <section className="modal-card property-request-card">
        <header>
          <div>
            <span className="eyebrow">
              {text("LOCAL APPLICATION", "CANDIDATURA LOCAL")}
            </span>
            <h2 id={`${id}-title`}>
              {text("Rental application", "Candidatura a arrendamento")}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={keepDraftAndClose}
            aria-label={text(
              "Close and keep draft",
              "Fechar e manter rascunho",
            )}
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        <form
          ref={form}
          className="modal-body property-request-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const prepared = updateRentalApplicationDraft(
              state,
              role,
              property.id,
              applicationFormValues(event.currentTarget),
            );
            const result = submitRentalApplicationDraft(
              prepared,
              role,
              property.id,
            );
            setState(result.state);
            setErrors(result.errors);
            setIssue(result.issue);
            if (result.applicationId === null) {
              requestAnimationFrame(() => {
                const target =
                  form.current?.querySelector<HTMLElement>(
                    '[aria-invalid="true"]',
                  ) ?? summary.current;
                target?.focus();
              });
              return;
            }
            closedExplicitly.current = true;
            onSaved(result.applicationId);
          }}
        >
          <strong className="property-request-property">
            {property.title}
          </strong>
          <p id={`${id}-scope`} className="property-request-scope">
            {text(
              "Your draft is private until you save the application. Closing keeps it in this tab; reloading clears it. Saving creates a local application, with no external message or confirmed tenancy.",
              "O rascunho é privado até guardar a candidatura. Fechar mantém-no neste separador; recarregar elimina-o. Guardar cria uma candidatura local, sem mensagem externa nem arrendamento confirmado.",
            )}
          </p>
          {(invalidFields.length > 0 || issue) && (
            <div
              className="property-request-errors"
              ref={summary}
              role="alert"
              tabIndex={-1}
            >
              <strong>
                {invalidFields.length
                  ? text("Check these details", "Reveja estes dados")
                  : issueMessage}
              </strong>
              <ul>
                {invalidFields.map((field) => (
                  <li key={field}>
                    <a
                      href={`#${id}-${field}`}
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById(`${id}-${field}`)?.focus();
                      }}
                    >
                      {message(field as keyof RequestErrors)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="property-request-fields">
            <label htmlFor={`${id}-date`}>
              {text("Preferred move-in date", "Data de entrada preferida")}
              <input
                id={`${id}-date`}
                name="date"
                type="date"
                min={localDateValue()}
                required
                aria-label={text(
                  "Preferred move-in date",
                  "Data de entrada preferida",
                )}
                value={draft.moveInDate}
                onInput={(event) => capture(event.currentTarget.form, "date")}
                onChange={(event) => capture(event.currentTarget.form, "date")}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? `${id}-date-error` : undefined}
              />
              {fieldError("date")}
            </label>
            <label htmlFor={`${id}-householdSize`}>
              {text("Number of people", "Número de pessoas")}
              <input
                id={`${id}-householdSize`}
                name="householdSize"
                type="number"
                min={1}
                step={1}
                required
                aria-label={text("Number of people", "Número de pessoas")}
                value={draft.householdSize}
                onInput={(event) =>
                  capture(event.currentTarget.form, "householdSize")
                }
                onChange={(event) =>
                  capture(event.currentTarget.form, "householdSize")
                }
                aria-invalid={Boolean(errors.householdSize)}
                aria-describedby={
                  errors.householdSize ? `${id}-householdSize-error` : undefined
                }
              />
              {fieldError("householdSize")}
            </label>
            <label
              className="property-request-wide"
              htmlFor={`${id}-introduction`}
            >
              {text("Introduction (optional)", "Apresentação (opcional)")}
              <textarea
                id={`${id}-introduction`}
                name="introduction"
                rows={3}
                maxLength={1000}
                aria-label={text(
                  "Introduction (optional)",
                  "Apresentação (opcional)",
                )}
                value={draft.introduction}
                onInput={(event) =>
                  capture(event.currentTarget.form, "introduction")
                }
                onChange={(event) =>
                  capture(event.currentTarget.form, "introduction")
                }
                aria-invalid={Boolean(errors.introduction)}
                aria-describedby={
                  errors.introduction ? `${id}-introduction-error` : undefined
                }
              />
              {fieldError("introduction")}
            </label>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={keepDraftAndClose}
            >
              {text("Close and keep draft", "Fechar e manter rascunho")}
            </button>
            <button type="submit" className="button">
              {text("Save application", "Guardar candidatura")}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

export function PropertyRequestActions({
  property,
  role,
  viewingState,
  setViewingState,
  applicationState,
  setApplicationState,
  onApplicationSaved,
  onViewApplications,
  onViewViewings,
  viewingLabel,
  applicationLabel,
}: {
  property: Property;
  role: Role;
  viewingState: PropertyRequestState;
  setViewingState: Dispatch<SetStateAction<PropertyRequestState>>;
  applicationState: ApplicationState;
  setApplicationState: Dispatch<SetStateAction<ApplicationState>>;
  onApplicationSaved: (id: number) => void;
  onViewApplications: () => void;
  onViewViewings: (requestId?: string) => void;
  viewingLabel: string;
  applicationLabel: string;
}) {
  const { text, status, date } = useViewingCopy();
  const [flow, setFlow] = useState<"viewing" | "application" | null>(null);
  const [draftDiscarded, setDraftDiscarded] = useState(false);
  const applicationAction = useRef<HTMLButtonElement>(null);
  const application =
    role === "tenant"
      ? tenantApplicationForProperty(applicationState, property)
      : undefined;
  const hasApplicationDraft = hasRentalApplicationDraft(
    applicationState,
    role,
    property.id,
  );
  const viewing = viewingForProperty(viewingState, role, property.id);
  const activeViewing = viewing && isActiveViewing(viewing);
  const proposal = viewing ? pendingViewingProposal(viewing) : null;
  const hasDraft = viewingDrafts(viewingState, role).some(
    (item) => item.propertyId === property.id,
  );
  if (role !== "tenant")
    return (
      <p className="property-request-scope">
        {text(
          "Viewing and rental requests are available in the tenant workspace.",
          "Os pedidos de visita e as candidaturas estão disponíveis na área do inquilino.",
        )}
      </p>
    );
  return (
    <div className="property-request-actions">
      <button
        type="button"
        className="button button-secondary"
        onClick={() =>
          activeViewing ? onViewViewings(viewing.id) : setFlow("viewing")
        }
      >
        <CalendarDays size={16} />
        {activeViewing
          ? text("Open viewing request", "Abrir pedido de visita")
          : hasDraft
            ? text("Continue viewing draft", "Continuar rascunho de visita")
            : viewingLabel}
      </button>
      {viewing && (
        <section
          className="property-request-summary"
          aria-label={text(
            "Your local viewing request",
            "O seu pedido local de visita",
          )}
        >
          <strong>{status(viewing.status)}</strong>
          <span>
            {viewing.agreedTerms
              ? text(
                  "Accepted time in this tab",
                  "Horário aceite neste separador",
                )
              : text("Original requested time", "Horário originalmente pedido")}
          </span>
          <time dateTime={`${viewing.date}T${viewing.time}`}>
            {date(viewing.date)} · {viewing.time}
          </time>
          {proposal && (
            <p>
              {text(
                "Proposed time · awaiting your decision",
                "Horário proposto · aguarda a sua decisão",
              )}
              : {date(proposal.terms.date)} · {proposal.terms.time}
            </p>
          )}
          {viewing.note && <p>{viewing.note}</p>}
          <small>
            {text(
              "Local record only. No one is contacted and no real visit is confirmed.",
              "Apenas um registo local. Ninguém é contactado e nenhuma visita real é confirmada.",
            )}
          </small>
          <button
            type="button"
            className="text-button"
            onClick={() => onViewViewings(viewing.id)}
          >
            {text("View request and history", "Ver pedido e histórico")}
          </button>
        </section>
      )}
      {property.listingType === "Rent" && (
        <>
          <button
            ref={applicationAction}
            type="button"
            className="button button-secondary"
            onClick={() => {
              setDraftDiscarded(false);
              if (application) onViewApplications();
              else setFlow("application");
            }}
          >
            <FileCheck2 size={16} />
            {application
              ? text("Open Applications", "Abrir candidaturas")
              : hasApplicationDraft
                ? text(
                    "Resume application draft",
                    "Retomar rascunho da candidatura",
                  )
                : applicationLabel}
          </button>
          {hasApplicationDraft && (
            <section
              className="property-request-summary"
              aria-label={text(
                "Unfinished rental application",
                "Candidatura a arrendamento por concluir",
              )}
            >
              <strong>
                {text(
                  "Private application draft",
                  "Rascunho privado da candidatura",
                )}
              </strong>
              <p>
                {text(
                  "Private until you save the application. Kept only in this tab; reloading clears it.",
                  "Privado até guardar a candidatura. Mantido apenas neste separador; recarregar elimina-o.",
                )}
              </p>
              {application && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setDraftDiscarded(false);
                    setFlow("application");
                  }}
                >
                  {text(
                    "Resume application draft",
                    "Retomar rascunho da candidatura",
                  )}
                </button>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setApplicationState((current) =>
                    discardRentalApplicationDraft(current, role, property.id),
                  );
                  setDraftDiscarded(true);
                  requestAnimationFrame(() =>
                    applicationAction.current?.focus(),
                  );
                }}
              >
                {text(
                  "Discard application draft",
                  "Descartar rascunho da candidatura",
                )}
              </button>
            </section>
          )}
          <p className="property-request-scope" role="status">
            {draftDiscarded &&
              text(
                "Application draft discarded.",
                "Rascunho da candidatura descartado.",
              )}
          </p>
          {application && (
            <p className="property-request-scope">
              {text(
                "A local application for this home already exists. Open Applications to inspect it.",
                "Já existe uma candidatura local para este imóvel. Abra Candidaturas para a consultar.",
              )}
            </p>
          )}
        </>
      )}
      {flow === "viewing" && (
        <ViewingRequestDialog
          role={role}
          state={viewingState}
          setState={setViewingState}
          property={property}
          onClose={() => setFlow(null)}
          onSaved={(id) => {
            setFlow(null);
            onViewViewings(id);
          }}
        />
      )}
      {flow === "application" && property.listingType === "Rent" && (
        <RentalApplicationDialog
          key={`${role}-${property.id}`}
          property={property}
          role={role}
          state={applicationState}
          setState={setApplicationState}
          onClose={() => setFlow(null)}
          onSaved={(id) => {
            setFlow(null);
            onApplicationSaved(id);
          }}
        />
      )}
    </div>
  );
}
