import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Role, WorkOpportunity } from "../types";
import {
  activeWorkApplication,
  submitWorkApplication,
  updateWorkApplicationDraft,
  workApplicationDraft,
  type WorkApplicationDraft,
  type WorkApplicationErrors,
  type WorkState,
} from "./workState";
import { localDateValue } from "./propertyRequestState";
import { useDialogFocus } from "./useDialogFocus";
import { useWorkCopy } from "./workCopy";
import "./workFlow.css";

export function WorkApplicationDialog({
  role,
  state,
  setState,
  opportunity,
  onClose,
  onSaved,
}: {
  role: Role;
  state: WorkState;
  setState: Dispatch<SetStateAction<WorkState>>;
  opportunity: WorkOpportunity;
  onClose: () => void;
  onSaved: (applicationId: string) => void;
}) {
  const { copy, availability, issueText, scope } = useWorkCopy();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const saved = useRef(false);
  const [draft, setDraft] = useState<WorkApplicationDraft>(
    () =>
      workApplicationDraft(state, role, opportunity.id) ?? {
        introduction: "",
        availability: "",
        customDate: "",
      },
  );
  const [errors, setErrors] = useState<WorkApplicationErrors>({});
  const [issue, setIssue] = useState<string | null>(null);
  const canSubmit =
    role === "tenant" &&
    opportunity.status === "Open" &&
    !activeWorkApplication(state, role, opportunity.id);
  const fieldLabels = {
    introduction: copy("Introduction", "Apresentação"),
    availability: copy("Availability", "Disponibilidade"),
    customDate: copy("Available from", "Disponível a partir de"),
  };
  function read(element: HTMLFormElement): WorkApplicationDraft {
    const data = new FormData(element);
    return {
      introduction: String(data.get("introduction") ?? draft.introduction),
      availability: String(
        data.get("availability") ?? draft.availability,
      ) as WorkApplicationDraft["availability"],
      customDate: String(data.get("customDate") ?? draft.customDate),
    };
  }
  function retain(next: WorkApplicationDraft) {
    setDraft(next);
    setState((current) =>
      updateWorkApplicationDraft(current, role, opportunity.id, next),
    );
  }
  function close() {
    if (form.current && !saved.current) retain(read(form.current));
    onClose();
  }
  const dialog = useDialogFocus<HTMLDivElement>(close);
  function capture(
    field: keyof WorkApplicationDraft,
    currentForm: HTMLFormElement | null,
  ) {
    if (!currentForm) return;
    retain(read(currentForm));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIssue(null);
  }
  const fieldProps = (field: keyof WorkApplicationDraft) => ({
    id: `${id}-${field}`,
    name: field,
    value: draft[field],
    disabled: !canSubmit,
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
    onInput: (
      event: React.FormEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => capture(field, event.currentTarget.form),
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => capture(field, event.currentTarget.form),
  });
  const fieldError = (field: keyof WorkApplicationDraft) =>
    errors[field] && (
      <small className="work-ui-field-error" id={`${id}-${field}-error`}>
        {issueText(errors[field]!)}
      </small>
    );
  return createPortal(
    <div
      className="modal-layer work-ui-layer"
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
        onClick={close}
      />
      <section className="modal-card work-ui-card">
        <header>
          <div>
            <span className="eyebrow">
              {copy("LOCAL WORK APPLICATION", "CANDIDATURA LOCAL DE TRABALHO")}
            </span>
            <h2 id={`${id}-title`}>
              {copy(
                "Apply for this opportunity",
                "Candidatar-me a esta oportunidade",
              )}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={copy(
              "Close work application",
              "Fechar candidatura de trabalho",
            )}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <form
          className="modal-body work-ui-form"
          ref={form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (saved.current) return;
            const submitted = read(event.currentTarget);
            setDraft(submitted);
            const prepared = updateWorkApplicationDraft(
              state,
              role,
              opportunity.id,
              submitted,
            );
            const result = submitWorkApplication(
              prepared,
              role,
              opportunity.id,
            );
            setState(result.state);
            setErrors(result.errors);
            setIssue(result.issue?.code ?? null);
            if (result.applicationId) {
              saved.current = true;
              onSaved(result.applicationId);
              return;
            }
            requestAnimationFrame(() => summary.current?.focus());
          }}
        >
          <div>
            <strong>{opportunity.title}</strong>
            <p className="work-ui-scope">{opportunity.business}</p>
          </div>
          <p className="work-ui-scope" id={`${id}-scope`}>
            {scope}
          </p>
          {!canSubmit && (
            <p className="work-ui-error" role="status">
              {issueText(
                opportunity.status === "Closed"
                  ? "closed"
                  : role === "tenant"
                    ? "duplicate"
                    : "unavailable",
              )}
            </p>
          )}
          {(issue || Object.values(errors).some(Boolean)) && (
            <div
              className="work-ui-error"
              role="alert"
              tabIndex={-1}
              ref={summary}
            >
              <strong>
                {copy("Check these details", "Reveja estes dados")}
              </strong>
              {issue && <p>{issueText(issue)}</p>}
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
                        {fieldLabels[field as keyof WorkApplicationDraft]}:{" "}
                        {issueText(code!)}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="work-ui-fields">
            <label className="work-ui-wide" htmlFor={`${id}-introduction`}>
              {fieldLabels.introduction}
              <textarea
                {...fieldProps("introduction")}
                rows={5}
                minLength={10}
                maxLength={2000}
                required
                data-dialog-initial-focus
              />
              <small className="work-ui-scope">
                {copy(
                  "Describe the experience and interests you want to share (10–2,000 characters).",
                  "Descreva a experiência e os interesses que quer partilhar (10–2.000 caracteres).",
                )}
              </small>
              {fieldError("introduction")}
            </label>
            <label htmlFor={`${id}-availability`}>
              {fieldLabels.availability}
              <select {...fieldProps("availability")} required>
                <option value="">
                  {copy("Choose availability", "Escolher disponibilidade")}
                </option>
                {["Immediately", "Within 2 weeks", "Choose a date"].map(
                  (option) => (
                    <option key={option} value={option}>
                      {availability(option)}
                    </option>
                  ),
                )}
              </select>
              {fieldError("availability")}
            </label>
            {draft.availability === "Choose a date" && (
              <label htmlFor={`${id}-customDate`}>
                {fieldLabels.customDate}
                <input
                  {...fieldProps("customDate")}
                  type="date"
                  min={localDateValue()}
                  required
                />
                {fieldError("customDate")}
              </label>
            )}
          </div>
          <p className="work-ui-scope">
            {copy(
              "Closing keeps your draft private to the tenant workspace. Submit to share these entered details with the listing business inside this tab.",
              "Fechar mantém o rascunho privado na área do inquilino. Submeta para partilhar estes dados com a empresa anunciante dentro deste separador.",
            )}
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={close}
            >
              {copy("Close", "Fechar")}
            </button>
            {canSubmit && (
              <button className="button" type="submit">
                {copy("Submit local application", "Submeter candidatura local")}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
