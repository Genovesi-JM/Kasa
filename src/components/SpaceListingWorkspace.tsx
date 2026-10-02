import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { Role } from "../types";
import { matchesSearch } from "../search";
import { useDialogFocus } from "./useDialogFocus";
import { SpaceListingPhotos } from "./SpaceListingPhotos";
import { useSpaceListingCopy } from "./spaceListingCopy";
import {
  addSpaceListingUnit,
  createSpaceListingDraft,
  markSpaceListingReady,
  moveSpaceListingStep,
  removedSpaceListingDraft,
  removeSpaceListingDraft,
  removeSpaceListingUnit,
  restoreSpaceListingDraft,
  setSpaceListingAmenities,
  spaceListingAmenities,
  spaceListingDraft,
  spaceListingHasErrors,
  spaceListingView,
  updateSpaceListingDraft,
  updateSpaceListingUnit,
  updateSpaceListingView,
  validateSpaceListingDraft,
  visibleSpaceListingDrafts,
  type SpaceListingDraft,
  type SpaceListingErrors,
  type SpaceListingFields,
  type SpaceListingState,
  type SpaceListingStep,
  type SpaceListingUnitFields,
} from "./spaceListingState";
import "./spaceListingWorkspace.css";

interface SpaceListingWorkspaceProps {
  role: Role;
  state: SpaceListingState;
  setState: Dispatch<SetStateAction<SpaceListingState>>;
  onBrowseSpaces?: () => void;
}
type Copy = ReturnType<typeof useSpaceListingCopy>;
const emptyErrors = (): SpaceListingErrors => ({
  fields: {},
  units: {},
  form: {},
});
const basicFields = [
  "category",
  "name",
  "country",
  "city",
  "neighbourhood",
  "address",
  "relationship",
  "description",
] as const;
const unitFields = [
  "name",
  "activity",
  "capacity",
  "price",
  "billingUnit",
] as const;

function ListingReview({
  role,
  state,
  setState,
  draft,
  text,
  onEdit,
}: SpaceListingWorkspaceProps & {
  draft: SpaceListingDraft;
  text: Copy;
  onEdit: (step: SpaceListingStep) => void;
}) {
  const { copy, fieldLabel, unitLabel, option } = text;
  const value = (value: string) =>
    value.trim() || copy("Not specified", "Não indicado");
  return (
    <div className="space-listing-review">
      <section>
        <h3>{value(draft.fields.name)}</h3>
        <dl>
          {(
            [
              "category",
              "relationship",
              "country",
              "city",
              "neighbourhood",
              "address",
            ] as const
          ).map((field) => (
            <div key={field}>
              <dt>{fieldLabel(field)}</dt>
              <dd>{value(option(draft.fields[field]))}</dd>
            </div>
          ))}
        </dl>
        <h4>{fieldLabel("description")}</h4>
        <p>{value(draft.fields.description)}</p>
        <button type="button" className="text-button" onClick={() => onEdit(1)}>
          {copy("Edit venue details", "Editar dados do recinto")}
        </button>
      </section>
      <section>
        <h4>
          {fieldLabel("units")} ({draft.units.length})
        </h4>
        {draft.units.map((unit, index) => (
          <section className="space-listing-review-unit" key={unit.id}>
            <h4>
              {value(unit.name) || `${copy("Space", "Espaço")} ${index + 1}`}
            </h4>
            <dl>
              <div>
                <dt>{unitLabel("activity")}</dt>
                <dd>{value(unit.activity)}</dd>
              </div>
              <div>
                <dt>{unitLabel("capacity")}</dt>
                <dd>{value(unit.capacity)}</dd>
              </div>
              <div>
                <dt>{unitLabel("price")}</dt>
                <dd>
                  {unit.price.trim()
                    ? `${unit.price} € · ${value(option(unit.billingUnit))}`
                    : copy("Price to be agreed", "Preço por acordar")}
                </dd>
              </div>
            </dl>
          </section>
        ))}
        <dl>
          <div>
            <dt>{copy("Suggested hours", "Horário sugerido")}</dt>
            <dd>
              {draft.fields.openingStart && draft.fields.openingEnd
                ? `${draft.fields.openingStart}–${draft.fields.openingEnd}`
                : copy("No fixed hours entered", "Sem horário fixo indicado")}
            </dd>
          </div>
        </dl>
        <h4>{fieldLabel("hoursNote")}</h4>
        <p>{value(draft.fields.hoursNote)}</p>
        <h4>{fieldLabel("cancellationPolicy")}</h4>
        <p>{value(draft.fields.cancellationPolicy)}</p>
        <p className="space-listing-note">
          {copy(
            "These are proposed listing terms, not a live availability calendar or a confirmed reservation.",
            "Estas são condições propostas para o anúncio, não um calendário de disponibilidade em tempo real nem uma reserva confirmada.",
          )}
        </p>
        <button type="button" className="text-button" onClick={() => onEdit(2)}>
          {copy("Edit spaces and terms", "Editar espaços e condições")}
        </button>
      </section>
      <section>
        <h4>{fieldLabel("amenities")}</h4>
        {draft.amenities.length ? (
          <ul>
            {draft.amenities.map((amenity, index) => (
              <li key={`${index}-${amenity}`}>{option(amenity)}</li>
            ))}
          </ul>
        ) : (
          <p>{copy("No amenities entered", "Sem comodidades indicadas")}</p>
        )}
        <SpaceListingPhotos
          role={role}
          state={state}
          setState={setState}
          draftId={draft.id}
          readOnly
        />
        <button type="button" className="text-button" onClick={() => onEdit(3)}>
          {copy(
            "Edit photos and amenities",
            "Editar fotografias e comodidades",
          )}
        </button>
      </section>
    </div>
  );
}

function SpaceListingEditor({
  role,
  state,
  setState,
  draft,
  onClose,
  onMissingFocus,
}: SpaceListingWorkspaceProps & {
  draft: SpaceListingDraft;
  onClose: () => void;
  onMissingFocus: () => void;
}) {
  const text = useSpaceListingCopy();
  const { copy, fieldLabel, unitLabel, option, stepNames, scope, issueText } =
    text;
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const addUnitButton = useRef<HTMLButtonElement>(null);
  const [errors, setErrors] = useState<SpaceListingErrors>(emptyErrors);
  const [feedback, setFeedback] = useState("");
  const [issue, setIssue] = useState("");
  function capture(
    currentForm: HTMLFormElement | null,
    currentState: SpaceListingState,
  ): SpaceListingState {
    if (!currentForm) return currentState;
    const data = new FormData(currentForm);
    const fields: Partial<SpaceListingFields> = {};
    for (const field of Object.keys(
      draft.fields,
    ) as (keyof SpaceListingFields)[]) {
      if (data.has(field)) fields[field] = String(data.get(field)) as never;
    }
    let next = updateSpaceListingDraft(currentState, role, draft.id, fields);
    for (const unit of draft.units) {
      const patch: Partial<SpaceListingUnitFields> = {};
      for (const field of unitFields) {
        const key = `unit:${unit.id}:${field}`;
        if (data.has(key)) patch[field] = String(data.get(key));
      }
      if (Object.keys(patch).length)
        next = updateSpaceListingUnit(next, role, draft.id, unit.id, patch);
    }
    if (data.has("amenities-present"))
      next = setSpaceListingAmenities(
        next,
        role,
        draft.id,
        data.getAll("amenities").map(String),
      );
    return next;
  }
  function close() {
    const currentForm = form.current;
    if (currentForm) {
      const prepared = capture(currentForm, state);
      setState(prepared);
    }
    onClose();
  }
  const dialog = useDialogFocus<HTMLDivElement>(close, {
    restoreFocus: () => {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) onMissingFocus();
      });
      return true;
    },
  });
  function update(currentForm: HTMLFormElement | null) {
    if (!currentForm) return;
    const prepared = capture(currentForm, state);
    setState(prepared);
    setErrors(emptyErrors());
    setFeedback("");
    setIssue("");
  }
  const fieldId = (name: string, unitId?: string) =>
    `${id}-${unitId ? `${unitId}-` : ""}${name}`;
  function navigate(
    step: SpaceListingStep,
    preserveErrors = false,
    targetId?: string,
  ) {
    const prepared = capture(form.current, state);
    setState(moveSpaceListingStep(prepared, role, draft.id, step));
    if (!preserveErrors) {
      setErrors(emptyErrors());
      setIssue("");
    }
    setFeedback("");
    requestAnimationFrame(() =>
      targetId
        ? document.getElementById(targetId)?.focus()
        : heading.current?.focus(),
    );
  }
  const errorsList = [
    ...Object.entries(errors.fields).map(([name, code]) => ({
      name: fieldLabel(name),
      code: code!,
      id: fieldId(name),
      field: name,
      step: (basicFields.includes(name as (typeof basicFields)[number])
        ? 1
        : 2) as SpaceListingStep,
    })),
    ...Object.entries(errors.units).flatMap(([unitId, fields]) =>
      Object.entries(fields).map(([name, code]) => ({
        name: `${copy("Space", "Espaço")} ${draft.units.findIndex((unit) => unit.id === unitId) + 1} · ${unitLabel(name)}`,
        code: code!,
        id: fieldId(name, unitId),
        field: `unit.${name}`,
        step: 2 as const,
      })),
    ),
    ...Object.entries(errors.form).map(([name, code]) => ({
      name: fieldLabel(name),
      code: code!,
      id: fieldId(name),
      field: name,
      step: (name === "units" ? 2 : 3) as SpaceListingStep,
    })),
  ].filter((entry) => entry.code);
  function field(
    name: keyof SpaceListingFields,
    {
      wide = false,
      choices,
      textarea = false,
      optional = false,
      maxLength,
      type = "text",
    }: {
      wide?: boolean;
      choices?: readonly string[];
      textarea?: boolean;
      optional?: boolean;
      maxLength?: number;
      type?: "text" | "time";
    } = {},
  ) {
    const error = errors.fields[name];
    const props = {
      id: fieldId(name),
      name,
      value: draft.fields[name],
      required: !optional,
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? `${fieldId(name)}-error` : undefined,
      onInput: (
        event: React.FormEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => update(event.currentTarget.form),
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => update(event.currentTarget.form),
    };
    return (
      <label
        className={wide ? "space-listing-wide" : ""}
        htmlFor={fieldId(name)}
      >
        {fieldLabel(name)}
        {choices ? (
          <select {...props}>
            <option value="">
              {copy("Choose an option", "Escolha uma opção")}
            </option>
            {choices.map((value) => (
              <option key={value} value={value}>
                {option(value)}
              </option>
            ))}
          </select>
        ) : textarea ? (
          <textarea {...props} rows={4} maxLength={maxLength} />
        ) : (
          <input {...props} type={type} maxLength={maxLength} />
        )}
        {error && (
          <small className="space-listing-error" id={`${fieldId(name)}-error`}>
            {issueText(error, name)}
          </small>
        )}
      </label>
    );
  }
  return createPortal(
    <div
      className="modal-layer space-listing-layer"
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
      <section className="modal-card space-listing-card">
        <header>
          <div>
            <span className="eyebrow">
              {copy("LOCAL VENUE DRAFT", "RASCUNHO LOCAL DE RECINTO")}
            </span>
            <h2 id={`${id}-title`}>
              {copy("Prepare a space listing", "Preparar um anúncio de espaço")}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label={copy(
              "Close and keep venue draft",
              "Fechar e manter rascunho do recinto",
            )}
          >
            <X size={20} />
          </button>
        </header>
        <form
          ref={form}
          className="modal-body space-listing-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const prepared = capture(event.currentTarget, state);
            const currentDraft = spaceListingDraft(prepared, role, draft.id);
            if (!currentDraft) {
              setIssue(issueText("unavailable"));
              requestAnimationFrame(() => summary.current?.focus());
              return;
            }
            const nextErrors = validateSpaceListingDraft(
              currentDraft,
              draft.step === 1
                ? "basics"
                : draft.step === 2
                  ? "details"
                  : draft.step === 3
                    ? "media"
                    : "all",
            );
            setErrors(nextErrors);
            setIssue("");
            setFeedback("");
            if (spaceListingHasErrors(nextErrors)) {
              setState(prepared);
              requestAnimationFrame(() => summary.current?.focus());
              return;
            }
            if (draft.step === 4) {
              const result = markSpaceListingReady(
                prepared,
                role,
                draft.id,
                currentDraft.revision,
              );
              setState(result.state);
              setErrors(result.errors);
              setIssue(result.issue ? issueText(result.issue) : "");
              if (result.issue || spaceListingHasErrors(result.errors)) {
                requestAnimationFrame(() => summary.current?.focus());
                return;
              }
              setFeedback(
                copy(
                  "Draft marked ready in this tab. No venue was published and no checks were performed.",
                  "Rascunho marcado como pronto neste separador. Nenhum recinto foi publicado e não foram efetuadas verificações.",
                ),
              );
            } else
              setState(
                moveSpaceListingStep(
                  prepared,
                  role,
                  draft.id,
                  (draft.step + 1) as SpaceListingStep,
                ),
              );
            requestAnimationFrame(() => heading.current?.focus());
          }}
        >
          <ol
            className="space-listing-steps"
            aria-label={copy(
              "Venue draft steps",
              "Etapas do rascunho do recinto",
            )}
          >
            {stepNames.map((name, index) => (
              <li
                key={name}
                aria-current={draft.step === index + 1 ? "step" : undefined}
              >
                <span>{index + 1}</span>
                {name}
              </li>
            ))}
          </ol>
          <div className="space-listing-step-title">
            <h3 tabIndex={-1} ref={heading}>
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
          <p id={`${id}-scope`} className="space-listing-note">
            {scope}
          </p>
          {(issue || errorsList.length > 0) && (
            <div
              className="space-listing-errors"
              role="alert"
              tabIndex={-1}
              ref={summary}
            >
              <strong>
                {copy("Check these details", "Reveja estes dados")}
              </strong>
              {issue && <p>{issue}</p>}
              {errorsList.length > 0 && (
                <ul>
                  {errorsList.map((entry) => (
                    <li key={entry.id}>
                      <a
                        href={`#${entry.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(entry.step, true, entry.id);
                        }}
                      >
                        {entry.name}: {issueText(entry.code, entry.field)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {draft.step === 1 && (
            <div className="space-listing-fields">
              {field("name", { wide: true, maxLength: 120 })}
              {field("category", { choices: ["Sports", "Events"] })}
              {field("relationship", {
                choices: [
                  "Owner",
                  "Operator",
                  "Facility manager",
                  "Authorised representative",
                ],
              })}
              {field("country", { maxLength: 80 })}
              {field("city", { maxLength: 100 })}
              {field("neighbourhood", { optional: true, maxLength: 100 })}
              {field("address", { wide: true, maxLength: 240 })}
              {field("description", {
                wide: true,
                textarea: true,
                maxLength: 4000,
              })}
            </div>
          )}
          {draft.step === 2 && (
            <>
              <section
                className="space-listing-units"
                aria-labelledby={fieldId("units")}
              >
                <h4 id={fieldId("units")} tabIndex={-1}>
                  {fieldLabel("units")}
                </h4>
                {draft.units.map((unit, index) => (
                  <fieldset className="space-listing-unit" key={unit.id}>
                    <legend>
                      {copy("Space", "Espaço")} {index + 1}
                      {unit.name.trim() ? ` · ${unit.name}` : ""}
                    </legend>
                    <div className="space-listing-fields">
                      {unitFields.map((name) => {
                        const error = errors.units[unit.id]?.[name];
                        const props = {
                          id: fieldId(name, unit.id),
                          name: `unit:${unit.id}:${name}`,
                          value: unit[name],
                          "aria-label": `${unitLabel(name)} · ${copy("Space", "Espaço")} ${index + 1}`,
                          "aria-invalid": Boolean(error),
                          "aria-describedby": error
                            ? `${fieldId(name, unit.id)}-error`
                            : undefined,
                          onInput: (
                            event: React.FormEvent<
                              HTMLInputElement | HTMLSelectElement
                            >,
                          ) => update(event.currentTarget.form),
                          onChange: (
                            event: React.ChangeEvent<
                              HTMLInputElement | HTMLSelectElement
                            >,
                          ) => update(event.currentTarget.form),
                        };
                        return (
                          <label key={name} htmlFor={fieldId(name, unit.id)}>
                            {unitLabel(name)}
                            {name === "billingUnit" ? (
                              <select {...props}>
                                <option value="">
                                  {copy(
                                    "No price specified",
                                    "Sem preço indicado",
                                  )}
                                </option>
                                {["hour", "session", "half-day", "event"].map(
                                  (value) => (
                                    <option key={value} value={value}>
                                      {option(value)}
                                    </option>
                                  ),
                                )}
                              </select>
                            ) : (
                              <input
                                {...props}
                                required={[
                                  "name",
                                  "activity",
                                  "capacity",
                                ].includes(name)}
                                inputMode={
                                  name === "capacity"
                                    ? "numeric"
                                    : name === "price"
                                      ? "decimal"
                                      : undefined
                                }
                                maxLength={
                                  name === "name"
                                    ? 100
                                    : name === "activity"
                                      ? 100
                                      : 16
                                }
                              />
                            )}
                            {error && (
                              <small
                                className="space-listing-error"
                                id={`${fieldId(name, unit.id)}-error`}
                              >
                                {issueText(error, `unit.${name}`)}
                              </small>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <div className="space-listing-actions">
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`${copy("Remove space", "Remover espaço")} ${index + 1}`}
                        onClick={() => {
                          const prepared = capture(form.current, state);
                          setState(
                            removeSpaceListingUnit(
                              prepared,
                              role,
                              draft.id,
                              unit.id,
                            ),
                          );
                          setErrors(emptyErrors());
                          setFeedback(
                            copy(
                              "Space removed from the draft.",
                              "Espaço removido do rascunho.",
                            ),
                          );
                          requestAnimationFrame(() =>
                            addUnitButton.current?.focus(),
                          );
                        }}
                      >
                        <Trash2 size={15} />
                        {copy("Remove space", "Remover espaço")}
                      </button>
                    </div>
                  </fieldset>
                ))}
              </section>
              <div className="space-listing-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  ref={addUnitButton}
                  disabled={draft.units.length >= 20}
                  onClick={() => {
                    const prepared = capture(form.current, state);
                    const result = addSpaceListingUnit(
                      prepared,
                      role,
                      draft.id,
                    );
                    setState(result.state);
                    setIssue(result.issue ? issueText(result.issue) : "");
                    setErrors(emptyErrors());
                    if (result.unitId) {
                      const focusId = fieldId("name", result.unitId);
                      requestAnimationFrame(() =>
                        document.getElementById(focusId)?.focus(),
                      );
                    }
                  }}
                >
                  <Plus size={16} />
                  {copy("Add reservable space", "Adicionar espaço reservável")}
                </button>
                <small className="space-listing-note">
                  {copy(
                    "At least one space · up to 20 per venue",
                    "Pelo menos um espaço · até 20 por recinto",
                  )}
                </small>
              </div>
              <p className="space-listing-note">
                {copy(
                  "Price is optional. If entered, choose the unit it applies to. Use a decimal point or comma without thousands separators.",
                  "O preço é opcional. Se o indicar, escolha a unidade a que se aplica. Use ponto ou vírgula decimal, sem separadores de milhares.",
                )}
              </p>
              <div className="space-listing-fields">
                {field("openingStart", { optional: true, type: "time" })}
                {field("openingEnd", { optional: true, type: "time" })}
                {field("hoursNote", {
                  wide: true,
                  optional: true,
                  textarea: true,
                  maxLength: 1000,
                })}
                {field("cancellationPolicy", {
                  wide: true,
                  optional: true,
                  textarea: true,
                  maxLength: 2000,
                })}
              </div>
              <p className="space-listing-note">
                {copy(
                  "Leave both times empty for flexible requests. If used, the suggested opening and closing times describe the same day; add exceptions in the notes.",
                  "Deixe ambas as horas vazias para pedidos flexíveis. Se forem usadas, a abertura e o fecho sugeridos referem-se ao mesmo dia; indique exceções nas notas.",
                )}
              </p>
            </>
          )}
          {draft.step === 3 && (
            <>
              <fieldset
                className="space-listing-amenities"
                id={fieldId("amenities")}
                tabIndex={-1}
              >
                <legend>{fieldLabel("amenities")}</legend>
                <input type="hidden" name="amenities-present" value="1" />
                <p className="space-listing-note">
                  {copy(
                    "Select only the amenities offered by this venue.",
                    "Selecione apenas as comodidades disponíveis neste recinto.",
                  )}
                </p>
                <div>
                  {spaceListingAmenities.map((amenity) => (
                    <label key={amenity}>
                      <input
                        type="checkbox"
                        name="amenities"
                        value={amenity}
                        checked={draft.amenities.includes(amenity)}
                        onChange={(event) => update(event.currentTarget.form)}
                      />
                      {option(amenity)}
                    </label>
                  ))}
                </div>
                {errors.form.amenities && (
                  <small className="space-listing-error">
                    {issueText(errors.form.amenities)}
                  </small>
                )}
              </fieldset>
              <div id={fieldId("photos")} tabIndex={-1}>
                <SpaceListingPhotos
                  role={role}
                  state={state}
                  setState={setState}
                  draftId={draft.id}
                />
              </div>
            </>
          )}

          {draft.step === 4 && (
            <ListingReview
              role={role}
              state={state}
              setState={setState}
              draft={draft}
              text={text}
              onEdit={(step) => navigate(step)}
            />
          )}
          <p className="space-listing-feedback" role="status">
            {feedback}
          </p>
          <div className="space-listing-actions">
            {draft.step > 1 && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => navigate((draft.step - 1) as SpaceListingStep)}
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
              disabled={draft.step === 4 && draft.status === "Ready"}
            >
              {draft.step === 4 ? (
                <>
                  <CheckCircle2 size={17} />
                  {draft.status === "Ready"
                    ? copy("Ready in this tab", "Pronto neste separador")
                    : copy(
                        "Mark ready in this tab",
                        "Marcar como pronto neste separador",
                      )}
                </>
              ) : (
                <>
                  {copy("Continue", "Continuar")}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function OperatorSpaceListings({
  role,
  state,
  setState,
  onBrowseSpaces,
}: SpaceListingWorkspaceProps) {
  const text = useSpaceListingCopy();
  const { copy, date, option, scope, issueText } = text;
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [feedback, setFeedback] = useState("");
  const [issue, setIssue] = useState("");
  const [category, setCategory] = useState<"Sports" | "Events">("Sports");
  const view = spaceListingView(state, role);
  const drafts = visibleSpaceListingDrafts(state, role);
  const selected = view.selectedDraftId
    ? spaceListingDraft(state, role, view.selectedDraftId)
    : undefined;
  const removed = removedSpaceListingDraft(state, role);
  const filtered = drafts
    .filter(
      (draft) =>
        (view.filter === "All" || draft.status === view.filter) &&
        matchesSearch(
          view.query,
          draft.fields.name,
          draft.fields.city,
          draft.fields.country,
          option(draft.fields.category),
        ),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  function close() {
    setState((current) =>
      updateSpaceListingView(current, role, { selectedDraftId: null }),
    );
  }
  if (role !== "spaceOperator")
    return (
      <section className="panel space-listing-empty">
        <Building2 size={28} aria-hidden="true" />
        <h3>
          {copy("Space listing drafts", "Rascunhos de anúncios de espaços")}
        </h3>
        <p>
          {copy(
            "Venue drafts are available in the Space Operator workspace. You can browse spaces from this workspace.",
            "Os rascunhos de recintos estão disponíveis na área do Operador de espaços. Pode explorar espaços nesta área.",
          )}
        </p>
        {onBrowseSpaces && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onBrowseSpaces}
          >
            {copy("Browse spaces", "Explorar espaços")}
          </button>
        )}
      </section>
    );
  return (
    <section
      className="space-listing-workspace"
      aria-labelledby={`${id}-title`}
    >
      <header className="space-listing-header">
        <div>
          <span className="eyebrow">KASA SPACES</span>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>
            {copy("Venue listing drafts", "Rascunhos de anúncios de recintos")}
          </h2>
          <p>
            {copy(
              "Prepare sports or event venues, their reservable spaces and proposed terms.",
              "Prepare recintos desportivos ou de eventos, os espaços reserváveis e as condições propostas.",
            )}
          </p>
        </div>
        {onBrowseSpaces && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onBrowseSpaces}
          >
            {copy("Browse spaces", "Explorar espaços")}
          </button>
        )}
      </header>
      <p className="space-listing-note">{scope}</p>
      <div className="space-listing-fields">
        <label htmlFor={`${id}-new-category`}>
          {copy("Category for a new draft", "Categoria do novo rascunho")}
          <select
            id={`${id}-new-category`}
            value={category}
            onChange={(event) =>
              setCategory(event.currentTarget.value as "Sports" | "Events")
            }
          >
            <option value="Sports">{option("Sports")}</option>
            <option value="Events">{option("Events")}</option>
          </select>
        </label>
        <div className="space-listing-actions">
          <button
            type="button"
            className="button"
            ref={addButton}
            onClick={() => {
              const result = createSpaceListingDraft(state, role, category);
              setState(result.state);
              setIssue(result.issue ? issueText(result.issue) : "");
              setFeedback("");
              if (result.draftId)
                setState((current) =>
                  updateSpaceListingView(current, role, {
                    selectedDraftId: result.draftId,
                  }),
                );
            }}
          >
            <Plus size={17} />
            {copy("New venue draft", "Novo rascunho de recinto")}
          </button>
        </div>
      </div>
      <div className="space-listing-fields">
        <label htmlFor={`${id}-query`}>
          {copy("Search your drafts", "Pesquisar os seus rascunhos")}
          <input
            id={`${id}-query`}
            type="search"
            maxLength={200}
            value={view.query}
            onChange={(event) => {
              const query = event.currentTarget.value;
              setState((current) =>
                updateSpaceListingView(current, role, { query }),
              );
            }}
          />
        </label>
        <label htmlFor={`${id}-filter`}>
          {copy("Draft status", "Estado do rascunho")}
          <select
            id={`${id}-filter`}
            value={view.filter}
            onChange={(event) => {
              const filter = event.currentTarget.value as
                "All" | "Draft" | "Ready";
              setState((current) =>
                updateSpaceListingView(current, role, { filter }),
              );
            }}
          >
            <option value="All">
              {copy("All drafts", "Todos os rascunhos")}
            </option>
            <option value="Draft">
              {copy("In progress", "Em preparação")}
            </option>
            <option value="Ready">
              {copy("Ready in this tab", "Prontos neste separador")}
            </option>
          </select>
        </label>
      </div>
      <p className="space-listing-feedback" role="status">
        {feedback ||
          `${filtered.length} ${filtered.length === 1 ? copy("draft shown", "rascunho apresentado") : copy("drafts shown", "rascunhos apresentados")}`}
      </p>
      {issue && (
        <p className="space-listing-errors" role="alert">
          {issue}
        </p>
      )}
      {filtered.length ? (
        <div className="space-listing-list">
          {filtered.map((draft) => (
            <article className="panel space-listing-row" key={draft.id}>
              <div>
                <span className="eyebrow">{option(draft.fields.category)}</span>
                <h3>
                  {draft.fields.name.trim() ||
                    copy("Untitled venue", "Recinto sem título")}
                </h3>
                <p>
                  {[draft.fields.city, draft.fields.country]
                    .filter(Boolean)
                    .join(" · ") ||
                    copy("Location not entered", "Localização por indicar")}
                </p>
                <small>
                  {draft.units.length}{" "}
                  {draft.units.length === 1
                    ? copy("space", "espaço")
                    : copy("spaces", "espaços")}{" "}
                  · {copy("Updated", "Atualizado")}{" "}
                  {date(draft.updatedAt, true)}
                </small>
                <span
                  className={`pill pill-${draft.status === "Ready" ? "mint" : "neutral"}`}
                >
                  {draft.status === "Ready"
                    ? copy("Ready in this tab", "Pronto neste separador")
                    : copy("Draft", "Rascunho")}
                </span>
              </div>
              <div className="space-listing-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  aria-label={`${copy("Open venue draft", "Abrir rascunho do recinto")} · ${draft.fields.name || draft.id}`}
                  onClick={() =>
                    setState((current) =>
                      updateSpaceListingView(current, role, {
                        selectedDraftId: draft.id,
                      }),
                    )
                  }
                >
                  {draft.status === "Ready"
                    ? copy("Inspect or edit", "Consultar ou editar")
                    : copy("Continue draft", "Continuar rascunho")}
                </button>
                <button
                  className="text-button"
                  type="button"
                  aria-label={`${copy("Remove venue draft", "Eliminar rascunho do recinto")} · ${draft.fields.name || draft.id}`}
                  onClick={() => {
                    setState((current) =>
                      removeSpaceListingDraft(current, role, draft.id),
                    );
                    setIssue("");
                    setFeedback(
                      copy(
                        "Draft removed. You can undo the latest removal.",
                        "Rascunho eliminado. Pode anular a última eliminação.",
                      ),
                    );
                    requestAnimationFrame(() => undoButton.current?.focus());
                  }}
                >
                  <Trash2 size={16} />
                  {copy("Remove", "Eliminar")}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel space-listing-empty">
          <Building2 size={28} aria-hidden="true" />
          <h3>
            {drafts.length
              ? copy("No matching drafts", "Sem rascunhos correspondentes")
              : copy(
                  "No venue drafts yet",
                  "Ainda não há rascunhos de recintos",
                )}
          </h3>
          <p>
            {drafts.length
              ? copy(
                  "Change your search or status filter to inspect a retained draft.",
                  "Altere a pesquisa ou o filtro de estado para consultar um rascunho guardado.",
                )
              : copy(
                  "Choose Sports or Events and start a draft. Your operator records remain separate from property listings.",
                  "Escolha Desporto ou Eventos e inicie um rascunho. Os registos do operador mantêm-se separados dos anúncios de imóveis.",
                )}
          </p>
        </section>
      )}
      {removed && (
        <div className="space-listing-undo">
          <div>
            {copy("Last removed draft", "Último rascunho eliminado")}:{" "}
            <strong>
              {removed.fields.name.trim() ||
                copy("Untitled venue", "Recinto sem título")}
            </strong>
          </div>
          <button
            type="button"
            className="button button-secondary"
            ref={undoButton}
            onClick={() => {
              const result = restoreSpaceListingDraft(state, role);
              setState(result.state);
              setIssue(result.issue ? issueText(result.issue) : "");
              setFeedback(
                result.issue
                  ? ""
                  : copy(
                      "Draft restored with its fields, spaces and photos.",
                      "Rascunho recuperado com os dados, espaços e fotografias.",
                    ),
              );
              requestAnimationFrame(() => addButton.current?.focus());
            }}
          >
            <Undo2 size={16} />
            {copy("Undo removal", "Anular eliminação")}
          </button>
        </div>
      )}
      {selected && (
        <SpaceListingEditor
          key={`${role}-${selected.id}`}
          role={role}
          state={state}
          setState={setState}
          draft={selected}
          onClose={close}
          onMissingFocus={() => heading.current?.focus()}
        />
      )}
    </section>
  );
}

export function SpaceListingWorkspace(props: SpaceListingWorkspaceProps) {
  return <OperatorSpaceListings key={props.role} {...props} />;
}
