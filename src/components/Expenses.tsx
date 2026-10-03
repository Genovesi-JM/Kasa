import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { Plus, Pencil, Trash2, RotateCcw, X } from "lucide-react";
import type { Role } from "../types";
import type { OperationsKey } from "../locales/operations/types";
import { useOperationsI18n } from "./useOperationsI18n";
import { useDialogFocus } from "./useDialogFocus";
import {
  expenseCategories,
  expenseProperties,
  expenseView,
  updateExpenseView,
  resetExpenseFilters,
  scopedExpenseRecords,
  visibleExpenseRecords,
  expenseSummary,
  expenseCreateDraft,
  expenseEditDraft,
  expenseEditDrafts,
  hasExpenseCreateDraft,
  updateExpenseCreateDraft,
  updateExpenseEditDraft,
  discardExpenseCreateDraft,
  discardExpenseEditDraft,
  submitExpenseCreateDraft,
  submitExpenseEditDraft,
  removeExpenseRecord,
  expenseUndo,
  restoreExpenseRecord,
  expenseToday,
  type ExpenseState,
  type ExpenseDraft,
  type ExpenseErrors,
  type ExpenseCategory,
  type ExpenseSort,
  type ExpenseFieldIssue,
  type ExpenseSnapshot,
} from "./expenseState";
import "./expenses.css";

type Props = {
  role: Role;
  state: ExpenseState;
  setState: Dispatch<SetStateAction<ExpenseState>>;
};
type Editor =
  { kind: "create" } | { kind: "edit"; recordId: string; revision: number };
const fieldKeys = {
  propertyId: "expenses_property",
  date: "expenses_date",
  category: "expenses_category",
  amount: "expenses_amount",
  payee: "expenses_payee",
  reference: "expenses_reference",
  note: "expenses_note",
} as const satisfies Record<keyof ExpenseDraft, OperationsKey>;
const issueKeys = {
  property: "expenses_errorProperty",
  date: "expenses_errorDate",
  dateFuture: "expenses_errorDateFuture",
  category: "expenses_errorCategory",
  amount: "expenses_errorAmount",
  payee: "expenses_errorPayee",
  reference: "expenses_errorReference",
  note: "expenses_errorNote",
} as const satisfies Record<ExpenseFieldIssue, OperationsKey>;
const categoryKeys = {
  repairs: "expenses_repairs",
  utilities: "expenses_utilities",
  insurance: "expenses_insurance",
  supplies: "expenses_supplies",
  other: "expenses_other",
} as const satisfies Record<ExpenseCategory, OperationsKey>;
const sortKeys = {
  "Newest date": "expenses_newest",
  "Oldest date": "expenses_oldest",
  "Amount: high to low": "expenses_highest",
  "Recently updated": "expenses_updated",
} as const satisfies Record<ExpenseSort, OperationsKey>;
function formValues(form: HTMLFormElement): ExpenseDraft {
  const values = new FormData(form);
  return Object.fromEntries(
    Object.keys(fieldKeys).map((key) => [key, String(values.get(key) ?? "")]),
  ) as unknown as ExpenseDraft;
}
function dateText(value: string, locale: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}
function timeText(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function SavedExpenseValues({ value }: { value: ExpenseSnapshot }) {
  const { tr, locale } = useOperationsI18n();
  return (
    <dl>
      <div>
        <dt>{tr("expenses_property")}</dt>
        <dd dir="auto">{value.propertyTitle}</dd>
      </div>
      <div>
        <dt>{tr("expenses_date")}</dt>
        <dd>{dateText(value.date, locale)}</dd>
      </div>
      <div>
        <dt>{tr("expenses_category")}</dt>
        <dd>{tr(categoryKeys[value.category])}</dd>
      </div>
      <div>
        <dt>{tr("expenses_amount")}</dt>
        <dd>
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "EUR",
          }).format(value.amountCents / 100)}
        </dd>
      </div>
      {(["payee", "reference", "note"] as const).map((field) => (
        <div key={field}>
          <dt>{tr(fieldKeys[field])}</dt>
          <dd dir="auto">{value[field] || tr("expenses_blank")}</dd>
        </div>
      ))}
      {value.removedAt && (
        <div>
          <dt>{tr("expenses_removedAt")}</dt>
          <dd>{timeText(value.removedAt, locale)}</dd>
        </div>
      )}
    </dl>
  );
}

export function ExpensesView(props: Props) {
  return <ExpenseWorkspace key={props.role} {...props} />;
}
function ExpenseWorkspace({ role, state, setState }: Props) {
  const { tr, locale } = useOperationsI18n();
  const id = useId();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [feedback, setFeedback] = useState<OperationsKey | null>(null);
  const focusFrame = useRef<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(
    () => () => {
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    },
    [],
  );
  const properties = expenseProperties(role);
  const view = expenseView(state, role);
  const categoryText = (category: ExpenseCategory) =>
    tr(categoryKeys[category]);
  const records = visibleExpenseRecords(state, role, categoryText);
  const allRecords = scopedExpenseRecords(state, role);
  const summary = expenseSummary(state, role, categoryText);
  const createDraft = hasExpenseCreateDraft(state, role)
    ? expenseCreateDraft(state, role)
    : null;
  const editDrafts = expenseEditDrafts(state, role);
  const undo = expenseUndo(state, role);
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const focusHeading = (
    trigger: HTMLElement | null,
    recordId?: string,
    restoredTrigger?: HTMLElement | null,
  ) => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      if (document.querySelector('[role="dialog"], dialog[open]')) return;
      const active = document.activeElement;
      if (
        active !== document.body &&
        active !== document.documentElement &&
        active !== trigger &&
        active !== restoredTrigger
      )
        return;
      const target = recordId
        ? document.getElementById(`${id}-${recordId}`)
        : heading.current;
      if (
        target?.isConnected &&
        target.getClientRects().length &&
        !target.closest('[hidden], [inert], [aria-hidden="true"]') &&
        getComputedStyle(target).visibility !== "hidden"
      )
        target.focus({ preventScroll: true });
    });
  };
  const open = (next: Editor, trigger: HTMLElement) => {
    opener.current = trigger;
    setFeedback(null);
    setEditor(next);
  };
  const discard = (recordId: string | null, trigger: HTMLElement) => {
    setState((current) =>
      recordId
        ? discardExpenseEditDraft(current, role, recordId)
        : discardExpenseCreateDraft(current, role),
    );
    setFeedback("expenses_discarded");
    focusHeading(trigger);
  };
  if (role !== "landlord") return <p>{tr("expenses_ownerOnly")}</p>;
  return (
    <section className="expense-workspace" aria-labelledby={`${id}-title`}>
      <header className="expense-heading">
        <div>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>
            {tr("expenses_title")}
          </h2>
          <p>{tr("expenses_scope")}</p>
        </div>
        <button
          type="button"
          className="button"
          onClick={(event) => open({ kind: "create" }, event.currentTarget)}
        >
          <Plus size={17} aria-hidden="true" />
          {tr(createDraft ? "expenses_resume" : "expenses_add")}
        </button>
      </header>
      <div className="expense-totals">
        <div>
          <span>{tr("expenses_visibleCount")}</span>
          <strong>{number(summary.count)}</strong>
        </div>
        <div>
          <span>{tr("expenses_total")}</span>
          <strong>{money(summary.totalCents)}</strong>
        </div>
      </div>
      <p className="expense-scope">{tr("expenses_totalsScope")}</p>
      <p className="expense-feedback" role="status">
        {feedback && tr(feedback)}
      </p>
      {undo && (
        <div className="expense-undo">
          <span>{tr("expenses_removed")}</span>
          <button
            type="button"
            className="text-button"
            onClick={(event) => {
              const result = restoreExpenseRecord(
                state,
                role,
                undo.recordId,
                undo.recordRevision,
              );
              setState(result);
              setFeedback(
                result === state
                  ? "expenses_undoUnavailable"
                  : "expenses_restored",
              );
              if (result !== state)
                focusHeading(event.currentTarget, undo.recordId);
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            {tr("expenses_undo")}
          </button>
        </div>
      )}
      {(createDraft || editDrafts.length > 0) && (
        <section className="expense-drafts" aria-labelledby={`${id}-drafts`}>
          <h3 id={`${id}-drafts`}>{tr("expenses_drafts")}</h3>
          <p>{tr("expenses_draftScope")}</p>
          {createDraft && (
            <article>
              <div>
                <strong>{tr("expenses_newDraft")}</strong>
                <span dir="auto">
                  {properties.find(
                    (property) =>
                      String(property.id) === createDraft.propertyId,
                  )?.title || tr("expenses_blank")}
                </span>
              </div>
              <div className="expense-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={(event) =>
                    open({ kind: "create" }, event.currentTarget)
                  }
                >
                  {tr("expenses_resume")}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={(event) => discard(null, event.currentTarget)}
                >
                  {tr("expenses_discard")}
                </button>
              </div>
            </article>
          )}
          {editDrafts.map((draft) => (
            <article key={draft.recordId}>
              <div>
                <strong>{tr("expenses_editDraft")}</strong>
                <span dir="auto">
                  {properties.find(
                    (property) =>
                      String(property.id) === draft.values.propertyId,
                  )?.title || tr("expenses_blank")}
                </span>
                {draft.stale && <small>{tr("expenses_stale")}</small>}
              </div>
              <div className="expense-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={(event) =>
                    open(
                      {
                        kind: "edit",
                        recordId: draft.recordId,
                        revision: draft.recordRevision,
                      },
                      event.currentTarget,
                    )
                  }
                >
                  {tr(draft.stale ? "expenses_inspect" : "expenses_resume")}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={(event) =>
                    discard(draft.recordId, event.currentTarget)
                  }
                >
                  {tr("expenses_discard")}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      <div className="expense-filters">
        <label>
          {tr("expenses_search")}
          <input
            type="search"
            value={view.query}
            maxLength={200}
            placeholder={tr("expenses_searchHint")}
            onChange={(event) => {
              const query = event.currentTarget.value;
              setState((current) =>
                updateExpenseView(current, role, { query }),
              );
            }}
          />
        </label>
        <label>
          {tr("expenses_propertyFilter")}
          <select
            value={view.property}
            onChange={(event) => {
              const property = event.currentTarget.value;
              setState((current) =>
                updateExpenseView(current, role, { property }),
              );
            }}
          >
            <option value="All properties">
              {tr("expenses_allProperties")}
            </option>
            {properties.map((property) => (
              <option key={property.id} value={String(property.id)}>
                {property.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("expenses_categoryFilter")}
          <select
            value={view.category}
            onChange={(event) => {
              const category = event.currentTarget
                .value as typeof view.category;
              setState((current) =>
                updateExpenseView(current, role, { category }),
              );
            }}
          >
            <option value="All categories">
              {tr("expenses_allCategories")}
            </option>
            {expenseCategories.map((category) => (
              <option key={category} value={category}>
                {categoryText(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("expenses_sort")}
          <select
            value={view.sort}
            onChange={(event) => {
              const sort = event.currentTarget.value as ExpenseSort;
              setState((current) => updateExpenseView(current, role, { sort }));
            }}
          >
            {Object.entries(sortKeys).map(([value, key]) => (
              <option key={value} value={value}>
                {tr(key)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setState((current) => resetExpenseFilters(current, role))
          }
        >
          {tr("expenses_reset")}
        </button>
      </div>
      <div className="expense-records">
        {!records.length && (
          <div className="expense-empty">
            <h3>
              {tr(allRecords.length ? "expenses_noMatches" : "expenses_empty")}
            </h3>
            {!allRecords.length && <p>{tr("expenses_emptyHint")}</p>}
          </div>
        )}
        {records.map((record) => (
          <article key={record.id} className="expense-record">
            <div className="expense-record-head">
              <div>
                <h3 id={`${id}-${record.id}`} tabIndex={-1} dir="auto">
                  {record.propertyTitle}
                </h3>
                <p>
                  <time dateTime={record.date}>
                    {dateText(record.date, locale)}
                  </time>
                  <span> · {categoryText(record.category)}</span>
                </p>
              </div>
              <strong>{money(record.amountCents)}</strong>
            </div>
            <details>
              <summary>{tr("expenses_details")}</summary>
              <dl>
                {(["payee", "reference", "note"] as const).map((field) => (
                  <div key={field}>
                    <dt>{tr(fieldKeys[field])}</dt>
                    <dd dir="auto">{record[field] || tr("expenses_blank")}</dd>
                  </div>
                ))}
                <div>
                  <dt>{tr("expenses_recordedAt")}</dt>
                  <dd>{dateText(record.createdAt, locale)}</dd>
                </div>
                <div>
                  <dt>{tr("expenses_updatedAt")}</dt>
                  <dd>{dateText(record.updatedAt, locale)}</dd>
                </div>
              </dl>
            </details>
            <details className="expense-history">
              <summary>{tr("expenses_history")}</summary>
              <ol>
                {[...record.history].reverse().map((event) => (
                  <li key={event.id}>
                    <strong>
                      {tr(
                        (
                          {
                            created: "expenses_createdEvent",
                            updated: "expenses_updatedEvent",
                            removed: "expenses_removedEvent",
                            restored: "expenses_restoredEvent",
                          } as const
                        )[event.action],
                      )}
                    </strong>
                    <time dateTime={event.at}>
                      {timeText(event.at, locale)}
                    </time>
                    {event.before && (
                      <details>
                        <summary>{tr("expenses_before")}</summary>
                        <SavedExpenseValues value={event.before} />
                      </details>
                    )}
                    <details>
                      <summary>{tr("expenses_after")}</summary>
                      <SavedExpenseValues value={event.after} />
                    </details>
                  </li>
                ))}
              </ol>
            </details>
            <div className="expense-actions">
              <button
                type="button"
                className="button button-secondary"
                aria-describedby={`${id}-${record.id}`}
                onClick={(event) => {
                  const draft = expenseEditDraft(state, role, record.id);
                  if (draft)
                    open(
                      {
                        kind: "edit",
                        recordId: record.id,
                        revision: draft.recordRevision,
                      },
                      event.currentTarget,
                    );
                }}
              >
                <Pencil size={16} aria-hidden="true" />
                {tr("expenses_edit")}
              </button>
              <button
                type="button"
                className="text-button"
                aria-describedby={`${id}-${record.id}`}
                onClick={(event) => {
                  const next = removeExpenseRecord(
                    state,
                    role,
                    record.id,
                    record.revision,
                  );
                  setState(next);
                  if (next !== state) {
                    setFeedback("expenses_removed");
                    focusHeading(event.currentTarget);
                  }
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                {tr("expenses_remove")}
              </button>
            </div>
          </article>
        ))}
      </div>
      {editor && (
        <ExpenseEditor
          key={
            editor.kind === "create"
              ? "create"
              : `${editor.recordId}-${editor.revision}`
          }
          role={role}
          state={state}
          setState={setState}
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={(recordId) => {
            setEditor(null);
            setFeedback("expenses_saved");
            focusHeading(
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null,
              recordId,
              opener.current,
            );
          }}
          onDiscarded={() => {
            setEditor(null);
            setFeedback("expenses_discarded");
            focusHeading(
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null,
              undefined,
              opener.current,
            );
          }}
        />
      )}
    </section>
  );
}

function ExpenseEditor({
  role,
  state,
  setState,
  editor,
  onClose,
  onSaved,
  onDiscarded,
}: Props & {
  editor: Editor;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDiscarded: () => void;
}) {
  const { tr } = useOperationsI18n();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const dirty = useRef(false);
  const finished = useRef(false);
  const [errors, setErrors] = useState<ExpenseErrors>({});
  const [issue, setIssue] = useState<OperationsKey | null>(null);
  const fresh =
    editor.kind === "create" ? expenseCreateDraft(state, role) : null;
  const edit =
    editor.kind === "edit"
      ? expenseEditDraft(state, role, editor.recordId)
      : null;
  const values = fresh ?? edit?.values;
  const stale =
    editor.kind === "edit" &&
    (!edit || edit.stale || edit.recordRevision !== editor.revision);
  const properties = expenseProperties(role);
  const retain = (values: ExpenseDraft) =>
    setState((current) =>
      editor.kind === "create"
        ? updateExpenseCreateDraft(current, role, values)
        : updateExpenseEditDraft(
            current,
            role,
            editor.recordId,
            values,
            editor.revision,
          ),
    );
  const close = () => {
    if (dirty.current && !stale && form.current)
      retain(formValues(form.current));
    finished.current = true;
    onClose();
  };
  const dialog = useDialogFocus<HTMLDivElement>(close);
  useEffect(() => {
    const node = form.current;
    return () => {
      if (node && dirty.current && !finished.current) {
        const values = formValues(node);
        setState((current) =>
          editor.kind === "create"
            ? updateExpenseCreateDraft(current, role, values)
            : updateExpenseEditDraft(
                current,
                role,
                editor.recordId,
                values,
                editor.revision,
              ),
        );
      }
    };
  }, [editor, role, setState]);
  const discard = () => {
    finished.current = true;
    setState((current) =>
      editor.kind === "create"
        ? discardExpenseCreateDraft(current, role)
        : discardExpenseEditDraft(current, role, editor.recordId),
    );
    onDiscarded();
  };
  const error = (field: keyof ExpenseDraft) =>
    errors[field] && (
      <span id={`${id}-${field}-error`} className="expense-error">
        {tr(issueKeys[errors[field]])}
      </span>
    );
  return createPortal(
    <div
      className="expense-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="expense-dialog"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-scope`}
        tabIndex={-1}
      >
        <header>
          <h2 id={`${id}-title`}>
            {tr(
              stale
                ? "expenses_inspect"
                : editor.kind === "create"
                  ? "expenses_add"
                  : "expenses_edit",
            )}
          </h2>
          <button
            className="icon-button"
            type="button"
            aria-label={tr("expenses_close")}
            onClick={close}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <p id={`${id}-scope`}>
          {tr(stale ? "expenses_staleHint" : "expenses_draftScope")}
        </p>
        {!values ? (
          <p role="alert">{tr("expenses_unavailable")}</p>
        ) : stale ? (
          <>
            <p className="expense-error">{tr("expenses_stale")}</p>
            <dl className="expense-raw">
              {Object.keys(fieldKeys).map((key) => {
                const field = key as keyof ExpenseDraft;
                const raw = values[field];
                const display =
                  field === "propertyId"
                    ? (properties.find(
                        (property) => String(property.id) === raw,
                      )?.title ?? raw)
                    : field === "category" && Object.hasOwn(categoryKeys, raw)
                      ? tr(categoryKeys[raw as ExpenseCategory])
                      : raw;
                return (
                  <div key={field}>
                    <dt>{tr(fieldKeys[field])}</dt>
                    <dd dir="auto">{display || tr("expenses_blank")}</dd>
                  </div>
                );
              })}
            </dl>
            <div className="expense-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={close}
              >
                {tr("expenses_close")}
              </button>
              <button type="button" className="text-button" onClick={discard}>
                {tr("expenses_discard")}
              </button>
            </div>
          </>
        ) : (
          <form
            ref={form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const now = new Date();
              const raw = formValues(event.currentTarget);
              const updated =
                editor.kind === "create"
                  ? updateExpenseCreateDraft(state, role, raw, now)
                  : updateExpenseEditDraft(
                      state,
                      role,
                      editor.recordId,
                      raw,
                      editor.revision,
                    );
              const result =
                editor.kind === "create"
                  ? submitExpenseCreateDraft(updated, role, now)
                  : submitExpenseEditDraft(
                      updated,
                      role,
                      editor.recordId,
                      editor.revision,
                      now,
                    );
              setState(result.state);
              setErrors(result.errors);
              setIssue(
                result.issue
                  ? result.issue === "stale"
                    ? "expenses_stale"
                    : result.issue === "noDraft"
                      ? "expenses_noDraft"
                      : "expenses_unavailable"
                  : null,
              );
              if (result.recordId) {
                finished.current = true;
                onSaved(result.recordId);
              } else {
                dirty.current = true;
                const field = Object.keys(result.errors)[0];
                if (field)
                  form.current
                    ?.querySelector<HTMLElement>(`[name="${field}"]`)
                    ?.focus();
              }
            }}
            onInput={(event) => {
              dirty.current = true;
              retain(formValues(event.currentTarget));
              setIssue(null);
            }}
          >
            <div className="expense-form-grid">
              <label htmlFor={`${id}-propertyId`}>
                {tr("expenses_property")}
                <select
                  id={`${id}-propertyId`}
                  name="propertyId"
                  value={values.propertyId}
                  required
                  aria-invalid={Boolean(errors.propertyId)}
                  aria-describedby={
                    errors.propertyId ? `${id}-propertyId-error` : undefined
                  }
                  data-dialog-initial-focus
                  onChange={(event) => {
                    dirty.current = true;
                    retain(formValues(event.currentTarget.form!));
                  }}
                >
                  <option value="">{tr("expenses_chooseProperty")}</option>
                  {properties.map((property) => (
                    <option key={property.id} value={String(property.id)}>
                      {property.title}
                    </option>
                  ))}
                </select>
                {error("propertyId")}
              </label>
              <label htmlFor={`${id}-date`}>
                {tr("expenses_date")}
                <input
                  id={`${id}-date`}
                  name="date"
                  type="date"
                  max={expenseToday()}
                  required
                  value={values.date}
                  onChange={(event) => {
                    dirty.current = true;
                    retain(formValues(event.currentTarget.form!));
                  }}
                  aria-invalid={Boolean(errors.date)}
                  aria-describedby={
                    errors.date ? `${id}-date-error` : undefined
                  }
                />
                {error("date")}
              </label>
              <label htmlFor={`${id}-category`}>
                {tr("expenses_category")}
                <select
                  id={`${id}-category`}
                  name="category"
                  value={values.category}
                  required
                  onChange={(event) => {
                    dirty.current = true;
                    retain(formValues(event.currentTarget.form!));
                  }}
                  aria-invalid={Boolean(errors.category)}
                  aria-describedby={
                    errors.category ? `${id}-category-error` : undefined
                  }
                >
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {tr(categoryKeys[category])}
                    </option>
                  ))}
                </select>
                {error("category")}
              </label>
              <label htmlFor={`${id}-amount`}>
                {tr("expenses_amount")}
                <input
                  id={`${id}-amount`}
                  name="amount"
                  inputMode="decimal"
                  type="text"
                  value={values.amount}
                  required
                  onChange={(event) => {
                    dirty.current = true;
                    retain(formValues(event.currentTarget.form!));
                  }}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={`${id}-amount-hint${errors.amount ? ` ${id}-amount-error` : ""}`}
                />
                <small id={`${id}-amount-hint`}>
                  {tr("expenses_amountHint")}
                </small>
                {error("amount")}
              </label>
              {(["payee", "reference"] as const).map((field) => (
                <label key={field} htmlFor={`${id}-${field}`}>
                  {tr(fieldKeys[field])}
                  <input
                    id={`${id}-${field}`}
                    name={field}
                    type="text"
                    dir="auto"
                    maxLength={field === "payee" ? 120 : 160}
                    value={values[field]}
                    onChange={(event) => {
                      dirty.current = true;
                      retain(formValues(event.currentTarget.form!));
                    }}
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={
                      errors[field] ? `${id}-${field}-error` : undefined
                    }
                  />
                  {error(field)}
                </label>
              ))}
              <label className="expense-wide" htmlFor={`${id}-note`}>
                {tr("expenses_note")}
                <textarea
                  id={`${id}-note`}
                  name="note"
                  dir="auto"
                  maxLength={2000}
                  rows={4}
                  value={values.note}
                  onChange={(event) => {
                    dirty.current = true;
                    retain(formValues(event.currentTarget.form!));
                  }}
                  aria-invalid={Boolean(errors.note)}
                  aria-describedby={
                    errors.note ? `${id}-note-error` : undefined
                  }
                />
                {error("note")}
              </label>
            </div>
            {issue && (
              <p role="alert" className="expense-error">
                {tr(issue)}
              </p>
            )}
            <div className="expense-actions">
              <button type="submit" className="button">
                {tr("expenses_save")}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={close}
              >
                {tr("expenses_keepDraft")}
              </button>
              {(editor.kind === "create"
                ? hasExpenseCreateDraft(state, role)
                : editDraftsPresent(state, role, editor.recordId)) && (
                <button type="button" className="text-button" onClick={discard}>
                  {tr("expenses_discard")}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
function editDraftsPresent(state: ExpenseState, role: Role, id: string) {
  return expenseEditDrafts(state, role).some((draft) => draft.recordId === id);
}
