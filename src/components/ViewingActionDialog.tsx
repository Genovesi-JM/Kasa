import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Role } from "../types";
import {
  actOnViewingRequest,
  localDateValue,
  saveViewingProposal,
  updateViewingActionDraft,
  viewingActionDraft,
  viewingActionIssue,
  type PropertyRequestState,
  type ViewingActionDraft,
  type ViewingErrors,
  type ViewingIssue,
  type ViewingRequest,
} from "./propertyRequestState";
import { useDialogFocus } from "./useDialogFocus";
import { useViewingCopy } from "./viewingCopy";
import "./propertyRequests.css";

export type ViewingActionMode = "proposal" | "decline" | "cancel";

export function ViewingActionDialog({
  role,
  state,
  setState,
  request,
  propertyTitle,
  mode,
  onClose,
  onSaved,
}: {
  role: Role;
  state: PropertyRequestState;
  setState: Dispatch<SetStateAction<PropertyRequestState>>;
  request: ViewingRequest;
  propertyTitle: string;
  mode: ViewingActionMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { text, issueText, scope } = useViewingCopy();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const saved = useRef(false);
  const [draft, setDraft] = useState<ViewingActionDraft>(
    () =>
      viewingActionDraft(state, role, request.id) ?? {
        date: "",
        time: "",
        note: "",
      },
  );
  const [errors, setErrors] = useState<ViewingErrors>({});
  const [issue, setIssue] = useState<ViewingIssue | null>(null);
  const title =
    mode === "proposal"
      ? text("Propose another time", "Propor outro horário")
      : mode === "decline"
        ? text("Decline viewing request", "Recusar pedido de visita")
        : text("Cancel viewing request", "Cancelar pedido de visita");
  function read(formElement: HTMLFormElement): ViewingActionDraft {
    const data = new FormData(formElement);
    return {
      date: String(data.get("date") ?? draft.date),
      time: String(data.get("time") ?? draft.time),
      note: String(data.get("note") ?? ""),
    };
  }
  function retain(next: ViewingActionDraft) {
    setDraft(next);
    setState((current) =>
      updateViewingActionDraft(current, role, request.id, next),
    );
  }
  function close() {
    if (form.current && !saved.current) retain(read(form.current));
    onClose();
  }
  const dialog = useDialogFocus<HTMLDivElement>(close);
  function capture(
    field: keyof ViewingActionDraft,
    value: string,
    currentForm: HTMLFormElement | null,
  ) {
    retain({ ...(currentForm ? read(currentForm) : draft), [field]: value });
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIssue(null);
  }
  const fieldProps = (field: keyof ViewingActionDraft) => ({
    id: `${id}-${field}`,
    name: field,
    value: draft[field],
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
    onInput: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      capture(field, event.currentTarget.value, event.currentTarget.form),
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => capture(field, event.currentTarget.value, event.currentTarget.form),
  });
  const error = (field: keyof ViewingActionDraft) =>
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
      tabIndex={-1}
      ref={dialog}
    >
      <button
        className="modal-scrim"
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={close}
      />
      <section className="modal-card property-request-card">
        <header>
          <div>
            <span className="eyebrow">
              {text("LOCAL VIEWING RESPONSE", "RESPOSTA LOCAL À VISITA")}
            </span>
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={text("Close response", "Fechar resposta")}
            onClick={close}
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
            if (saved.current) return;
            const submitted = read(event.currentTarget);
            setDraft(submitted);
            const prepared = updateViewingActionDraft(
              state,
              role,
              request.id,
              submitted,
            );
            if (mode === "proposal") {
              const result = saveViewingProposal(prepared, role, request.id);
              setState(result.state);
              setErrors(result.errors);
              setIssue(result.issue);
              if (result.proposalId) {
                saved.current = true;
                onSaved();
                return;
              }
            } else {
              const action = {
                type: mode === "decline" ? "decline-request" : "cancel",
              } as const;
              const nextIssue = viewingActionIssue(
                prepared,
                role,
                request.id,
                action,
              );
              setIssue(nextIssue);
              setErrors(
                nextIssue?.code === "noteRequired" ||
                  nextIssue?.code === "noteTooLong"
                  ? { note: nextIssue.code }
                  : {},
              );
              if (!nextIssue) {
                setState(
                  actOnViewingRequest(prepared, role, request.id, action),
                );
                saved.current = true;
                onSaved();
                return;
              }
              setState(prepared);
            }
            requestAnimationFrame(() => summary.current?.focus());
          }}
        >
          <strong className="property-request-property">{propertyTitle}</strong>
          <p id={`${id}-scope`} className="property-request-scope">
            {scope}
          </p>
          {mode === "proposal" && (
            <p className="viewing-explanation">
              {request.agreedTerms
                ? text(
                    "The accepted time stays unchanged until the tenant accepts this proposal.",
                    "O horário aceite mantém-se até o inquilino aceitar esta proposta.",
                  )
                : text(
                    "The requested time stays unchanged. Only the tenant can accept this proposed change.",
                    "O horário pedido mantém-se. Só o inquilino pode aceitar esta alteração proposta.",
                  )}
            </p>
          )}
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
              {issue && !Object.values(errors).includes(issue.code) && (
                <p>{issueText(issue.code)}</p>
              )}
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
            {mode === "proposal" && (
              <>
                <label htmlFor={`${id}-date`}>
                  {text("Proposed date", "Data proposta")}
                  <input
                    {...fieldProps("date")}
                    type="date"
                    min={localDateValue()}
                    required
                    data-dialog-initial-focus
                  />
                  {error("date")}
                </label>
                <label htmlFor={`${id}-time`}>
                  {text("Proposed time", "Hora proposta")}
                  <input {...fieldProps("time")} type="time" required />
                  {error("time")}
                </label>
              </>
            )}
            <label className="property-request-wide" htmlFor={`${id}-note`}>
              {mode === "cancel" && role === "tenant"
                ? text("Reason (optional)", "Motivo (opcional)")
                : text("Reason", "Motivo")}
              <textarea
                {...fieldProps("note")}
                rows={4}
                maxLength={1000}
                required={role === "landlord"}
                data-dialog-initial-focus={mode !== "proposal" || undefined}
              />
              {error("note")}
            </label>
          </div>
          <p className="property-request-scope">
            {text(
              "Your unsaved response stays private to this workspace until saved. Closing retains your draft.",
              "A resposta por guardar fica privada nesta área de trabalho até ser guardada. Fechar mantém o rascunho.",
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
              {mode === "proposal"
                ? text("Save proposed time", "Guardar horário proposto")
                : mode === "decline"
                  ? text("Save decline", "Guardar recusa")
                  : text("Save cancellation", "Guardar cancelamento")}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
