import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";
import type { Property, Role } from "../types";
import {
  createViewingRequest,
  futureLocalDate,
  localDateValue,
  updateViewingDraft,
  viewingDraft,
  viewingDrafts,
  type PropertyRequestState,
  type ViewingErrors,
  type ViewingIssue,
  type ViewingRequestDraft,
} from "./propertyRequestState";
import { useDialogFocus } from "./useDialogFocus";
import { useViewingCopy } from "./viewingCopy";
import "./propertyRequests.css";

interface ViewingRequestDialogProps {
  role: Role;
  state: PropertyRequestState;
  setState: Dispatch<SetStateAction<PropertyRequestState>>;
  property: Property;
  onClose: () => void;
  onSaved: (requestId: string) => void;
}

function readDraft(form: HTMLFormElement): ViewingRequestDraft {
  const data = new FormData(form);
  return {
    date: String(data.get("date") ?? ""),
    time: String(data.get("time") ?? ""),
    note: String(data.get("note") ?? ""),
  };
}

function ViewingRequestForm({
  role,
  state,
  setState,
  property,
  onClose,
  onSaved,
}: ViewingRequestDialogProps) {
  const { text, scope, issueText } = useViewingCopy();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const saved = useRef(false);
  const [draft, setDraft] = useState<ViewingRequestDraft>(() => {
    const retained = viewingDrafts(state, role).some(
      (item) => item.propertyId === property.id,
    );
    return retained
      ? viewingDraft(state, role, property.id)!
      : { date: futureLocalDate(1), time: "18:00", note: "" };
  });
  const [errors, setErrors] = useState<ViewingErrors>({});
  const [issue, setIssue] = useState<ViewingIssue | null>(null);
  function retain(next: ViewingRequestDraft) {
    setDraft(next);
    setState((current) => updateViewingDraft(current, role, property.id, next));
  }
  function close() {
    if (form.current && role === "tenant" && !saved.current)
      retain(readDraft(form.current));
    onClose();
  }
  const dialog = useDialogFocus<HTMLDivElement>(close);
  function update(
    field: keyof ViewingRequestDraft,
    value: string,
    currentForm: HTMLFormElement | null,
  ) {
    retain({
      ...(currentForm ? readDraft(currentForm) : draft),
      [field]: value,
    });
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIssue(null);
  }
  const props = (field: keyof ViewingRequestDraft) => ({
    id: `${id}-${field}`,
    name: field,
    value: draft[field],
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
    onInput: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(field, event.currentTarget.value, event.currentTarget.form),
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => update(field, event.currentTarget.value, event.currentTarget.form),
  });
  const fieldError = (field: keyof ViewingRequestDraft) =>
    errors[field] && (
      <small className="property-request-error" id={`${id}-${field}-error`}>
        {issueText(errors[field]!)}
      </small>
    );

  return createPortal(
    <div
      className="modal-layer property-request-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-scope`}
      ref={dialog}
      tabIndex={-1}
    >
      <button
        type="button"
        className="modal-scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
      />
      <section className="modal-card property-request-card">
        <header>
          <div>
            <span className="eyebrow">
              {text("LOCAL VIEWING REQUEST", "PEDIDO LOCAL DE VISITA")}
            </span>
            <h2 id={`${id}-title`}>
              {text("Request a viewing", "Pedir uma visita")}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={text(
              "Close viewing request",
              "Fechar pedido de visita",
            )}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {role !== "tenant" ? (
          <div className="modal-body">
            <p id={`${id}-scope`}>
              {text(
                "Viewing requests can be created in the tenant workspace.",
                "Os pedidos de visita podem ser criados na área do inquilino.",
              )}
            </p>
            <button className="button" onClick={close}>
              {text("Close", "Fechar")}
            </button>
          </div>
        ) : (
          <form
            ref={form}
            className="modal-body property-request-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (saved.current) return;
              const submitted = readDraft(event.currentTarget);
              setDraft(submitted);
              const prepared = updateViewingDraft(
                state,
                role,
                property.id,
                submitted,
              );
              const result = createViewingRequest(prepared, role, property.id);
              setState(result.state);
              setErrors(result.errors);
              setIssue(result.issue);
              if (result.requestId) {
                saved.current = true;
                onSaved(result.requestId);
              } else requestAnimationFrame(() => summary.current?.focus());
            }}
          >
            <strong className="property-request-property">
              {property.title}
            </strong>
            <p id={`${id}-scope`} className="property-request-scope">
              {scope}
            </p>
            {(issue || Object.values(errors).some(Boolean)) && (
              <div
                className="property-request-errors"
                role="alert"
                tabIndex={-1}
                ref={summary}
              >
                <strong>
                  {text("Check these details", "Reveja estes dados")}
                </strong>
                {issue && <p>{issueText(issue.code)}</p>}
                <ul>
                  {Object.entries(errors)
                    .filter(([, value]) => value)
                    .map(([field, code]) => (
                      <li key={field}>
                        <a
                          href={`#${id}-${field}`}
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById(`${id}-${field}`)?.focus();
                          }}
                        >
                          {issueText(code!)}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <div className="property-request-fields">
              <label htmlFor={`${id}-date`}>
                {text("Preferred date", "Data preferida")}
                <input
                  {...props("date")}
                  type="date"
                  min={localDateValue()}
                  required
                  data-dialog-initial-focus
                />
                {fieldError("date")}
              </label>
              <label htmlFor={`${id}-time`}>
                {text("Preferred time", "Hora preferida")}
                <input {...props("time")} type="time" required />
                {fieldError("time")}
              </label>
              <label htmlFor={`${id}-note`} className="property-request-wide">
                {text("Note (optional)", "Nota (opcional)")}
                <textarea {...props("note")} rows={4} maxLength={1000} />
                {fieldError("note")}
              </label>
            </div>
            <p className="property-request-scope">
              {text(
                "Your unsent draft is retained in this tab when you close the form or navigate away. Save request to add it to the shared viewing inbox.",
                "O rascunho por enviar mantém-se neste separador ao fechar o formulário ou mudar de página. Guarde o pedido para o adicionar à caixa partilhada de visitas.",
              )}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={close}
              >
                {text("Close", "Fechar")}
              </button>
              <button className="button" type="submit">
                <CalendarDays size={16} />
                {text("Save viewing request", "Guardar pedido de visita")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}

export function ViewingRequestDialog(props: ViewingRequestDialogProps) {
  return (
    <ViewingRequestForm key={`${props.role}-${props.property.id}`} {...props} />
  );
}
