import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, FileCheck2, X } from "lucide-react";
import type { Property, Role } from "../types";
import type { ApplicationRecord } from "./applicationState";
import {
  futureLocalDate,
  isActiveViewing,
  localDateValue,
  pendingViewingProposal,
  validateRentalApplication,
  viewingDrafts,
  viewingForProperty,
  type PropertyRequestState,
  type RentalApplicationDraft,
  type RequestErrors,
} from "./propertyRequestState";
import { useDialogFocus } from "./useDialogFocus";
import { ViewingRequestDialog } from "./ViewingRequestDialog";
import { useViewingCopy } from "./viewingCopy";
import "./propertyRequests.css";

function RentalApplicationDialog({
  property,
  onClose,
  onSave,
}: {
  property: Property;
  onClose: () => void;
  onSave: (draft: RentalApplicationDraft) => void;
}) {
  const { text } = useViewingCopy();
  const dialog = useDialogFocus<HTMLDivElement>(onClose);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(() => futureLocalDate(14));
  const [household, setHousehold] = useState("1");
  const [introduction, setIntroduction] = useState("");
  const [errors, setErrors] = useState<RequestErrors>({});
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
  function capture(currentForm: HTMLFormElement | null) {
    if (!currentForm) return;
    const data = new FormData(currentForm);
    setDate(String(data.get("date") ?? ""));
    setHousehold(String(data.get("householdSize") ?? ""));
    setIntroduction(String(data.get("introduction") ?? ""));
  }
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
        onClick={onClose}
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
            onClick={onClose}
            aria-label={text("Close application", "Fechar candidatura")}
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
            const data = new FormData(event.currentTarget);
            const draft: RentalApplicationDraft = {
              moveInDate: String(data.get("date") ?? ""),
              householdSize: Number(data.get("householdSize") ?? ""),
              introduction: String(data.get("introduction") ?? ""),
            };
            capture(event.currentTarget);
            const nextErrors = validateRentalApplication(draft);
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length) {
              requestAnimationFrame(() => summary.current?.focus());
              return;
            }
            onSave(draft);
            onClose();
          }}
        >
          <strong className="property-request-property">
            {property.title}
          </strong>
          <p id={`${id}-scope`} className="property-request-scope">
            {text(
              "Saved in this tab only. Nothing is sent to the listing party, and no tenancy is confirmed.",
              "Guardada apenas neste separador. Nada é enviado ao anunciante e nenhum arrendamento é confirmado.",
            )}
          </p>
          {Object.keys(errors).length > 0 && (
            <div
              className="property-request-errors"
              ref={summary}
              role="alert"
              tabIndex={-1}
            >
              <strong>
                {text("Check these details", "Reveja estes dados")}
              </strong>
              <ul>
                {Object.keys(errors).map((field) => (
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
                value={date}
                onInput={(event) => capture(event.currentTarget.form)}
                onChange={(event) => capture(event.currentTarget.form)}
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
                value={household}
                onInput={(event) => capture(event.currentTarget.form)}
                onChange={(event) => capture(event.currentTarget.form)}
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
                value={introduction}
                onInput={(event) => capture(event.currentTarget.form)}
                onChange={(event) => capture(event.currentTarget.form)}
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
              onClick={onClose}
            >
              {text("Cancel", "Cancelar")}
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
  application,
  onSaveApplication,
  onViewApplications,
  onViewViewings,
  viewingLabel,
  applicationLabel,
}: {
  property: Property;
  role: Role;
  viewingState: PropertyRequestState;
  setViewingState: Dispatch<SetStateAction<PropertyRequestState>>;
  application?: ApplicationRecord;
  onSaveApplication: (draft: RentalApplicationDraft) => void;
  onViewApplications: () => void;
  onViewViewings: (requestId?: string) => void;
  viewingLabel: string;
  applicationLabel: string;
}) {
  const { text, status, date } = useViewingCopy();
  const [flow, setFlow] = useState<"viewing" | "application" | null>(null);
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
            type="button"
            className="button button-secondary"
            onClick={() =>
              application ? onViewApplications() : setFlow("application")
            }
          >
            <FileCheck2 size={16} />
            {application
              ? text("Open Applications", "Abrir candidaturas")
              : applicationLabel}
          </button>
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
      {flow === "application" && (
        <RentalApplicationDialog
          property={property}
          onClose={() => setFlow(null)}
          onSave={onSaveApplication}
        />
      )}
    </div>
  );
}
