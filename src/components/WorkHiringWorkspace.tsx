import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type Ref,
  type RefObject,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { BriefcaseBusiness, ChevronRight, Plus, Search, X } from "lucide-react";
import type { Role } from "../types";
import { matchesSearch } from "../search";
import { useDialogFocus } from "./useDialogFocus";
import { useWorkCopy } from "./workCopy";
import {
  applyWorkReviewCommand,
  closeWorkOpportunity,
  copyWorkOpportunityToDraft,
  createWorkPostDraft,
  discardWorkPostDraft,
  editWorkPostDraft,
  ownedWorkOpportunities,
  publishWorkPost,
  removedWorkPostDraft,
  restoreWorkPostDraft,
  reviewWorkPostDraft,
  updateWorkHiringView,
  updateWorkPostDraft,
  visibleWorkApplications,
  workHiringView,
  workPostDrafts,
  type WorkApplication,
  type WorkIssueCode,
  type WorkPostDraft,
  type WorkPostErrors,
  type WorkPostFields,
  type WorkReviewCommand,
  type WorkState,
} from "./workState";
import "./workHiringWorkspace.css";

interface WorkHiringWorkspaceProps {
  role: Role;
  state: WorkState;
  setState: Dispatch<SetStateAction<WorkState>>;
  onBrowseOpportunities?: () => void;
}

type Copy = (en: string, pt: string) => string;
type WorkCopy = ReturnType<typeof useWorkCopy>;
type HiringView = ReturnType<typeof workHiringView>;
type PostDetails = Pick<
  WorkPostFields,
  "title" | "type" | "location" | "pay" | "description"
> & { skills: string | string[] };

function fieldLabels(copy: Copy): Record<keyof WorkPostFields, string> {
  return {
    title: copy("Opportunity title", "Título da oportunidade"),
    type: copy("Work arrangement", "Regime de trabalho"),
    location: copy("Location", "Localização"),
    pay: copy("Pay or budget", "Remuneração ou orçamento"),
    description: copy(
      "Responsibilities and requirements",
      "Responsabilidades e requisitos",
    ),
    skills: copy("Skills (optional)", "Competências (opcional)"),
  };
}

function issueText(issue: { code: string } | null | undefined, copy: Copy) {
  const labels: Record<string, string> = {
    required: copy("Complete this field.", "Preencha este campo."),
    tooShort: copy("Add more detail.", "Acrescente mais detalhes."),
    tooLong: copy(
      "Shorten this value to the stated limit.",
      "Reduza este valor ao limite indicado.",
    ),
    invalidType: copy(
      "Choose a supported work arrangement.",
      "Escolha um regime de trabalho disponível.",
    ),
    unavailable: copy(
      "This record is not available in this workspace.",
      "Este registo não está disponível nesta área de trabalho.",
    ),
    closed: copy(
      "This opportunity is closed.",
      "Esta oportunidade está encerrada.",
    ),
    staleDraft: copy(
      "The draft changed. Review its latest content before publishing.",
      "O rascunho foi alterado. Reveja o conteúdo atual antes de publicar.",
    ),
    notReviewed: copy(
      "Review the current draft before publishing.",
      "Reveja o rascunho atual antes de publicar.",
    ),
    nothingToRestore: copy(
      "There is no draft to restore.",
      "Não existe um rascunho para recuperar.",
    ),
  };
  return issue
    ? (labels[issue.code] ??
        copy(
          "This action could not be saved. Review the current record.",
          "Não foi possível guardar esta ação. Reveja o registo atual.",
        ))
    : "";
}

function fieldIssue(
  field: keyof WorkPostFields,
  issue: WorkIssueCode,
  copy: Copy,
) {
  const limits: Record<keyof WorkPostFields, string> = {
    title: copy(
      "Use 3–100 characters for the title.",
      "Use entre 3 e 100 caracteres para o título.",
    ),
    type: copy(
      "Choose freelance, project, part time or full time.",
      "Escolha trabalho independente, projeto, tempo parcial ou tempo inteiro.",
    ),
    location: copy(
      "Use 2–140 characters for the location.",
      "Use entre 2 e 140 caracteres para a localização.",
    ),
    pay: copy(
      "Describe the pay or budget in 3–160 characters.",
      "Descreva a remuneração ou o orçamento em 3 a 160 caracteres.",
    ),
    description: copy(
      "Describe the work in 20–4,000 characters.",
      "Descreva o trabalho em 20 a 4.000 caracteres.",
    ),
    skills: copy(
      "Use up to 10 comma-separated skills, at most 40 characters each.",
      "Indique até 10 competências separadas por vírgulas, com até 40 caracteres cada.",
    ),
  };
  return ["required", "tooShort", "tooLong", "invalidType"].includes(issue)
    ? limits[field]
    : issueText({ code: issue }, copy);
}

function HiringDialog({
  title,
  onClose,
  children,
  copy,
  focusFallbackRef,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  copy: Copy;
  focusFallbackRef: RefObject<HTMLButtonElement | null>;
}) {
  const titleId = useId();
  const originalTrigger = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    originalTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);
  const ref = useDialogFocus<HTMLDivElement>(onClose, {
    restoreFocus: () => {
      const trigger = originalTrigger.current;
      if (
        trigger?.isConnected &&
        !trigger.matches(":disabled") &&
        trigger.getClientRects().length > 0 &&
        window.getComputedStyle(trigger).visibility !== "hidden"
      ) {
        return true;
      }
      const fallback = focusFallbackRef.current;
      if (fallback?.isConnected && fallback.getClientRects().length > 0) {
        fallback.focus({ preventScroll: true });
        return false;
      }
      return true;
    },
  });
  return createPortal(
    <div
      className="modal-layer work-hiring-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      ref={ref}
    >
      <button
        type="button"
        className="modal-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="modal-card work-hiring-dialog">
        <header>
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label={copy("Close", "Fechar")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function PostContent({
  post,
  text,
  headingRef,
}: {
  post: PostDetails;
  text: WorkCopy;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { copy, arrangement } = text;
  const labels = fieldLabels(copy);
  const skills = Array.isArray(post.skills)
    ? post.skills
    : post.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
  return (
    <>
      <h3 className="work-hiring-detail-title" ref={headingRef} tabIndex={-1}>
        {post.title}
      </h3>
      <dl className="work-hiring-details">
        <div>
          <dt>{copy("Business", "Empresa")}</dt>
          <dd>Volt &amp; Co.</dd>
        </div>
        <div>
          <dt>{labels.type}</dt>
          <dd>{arrangement(post.type)}</dd>
        </div>
        <div>
          <dt>{labels.location}</dt>
          <dd>{post.location}</dd>
        </div>
        <div>
          <dt>{labels.pay}</dt>
          <dd>{post.pay}</dd>
        </div>
      </dl>
      <h4>{labels.description}</h4>
      <p className="work-hiring-text">{post.description}</p>
      {skills.length > 0 && (
        <>
          <h4>{copy("Skills", "Competências")}</h4>
          <p className="work-hiring-text">{skills.join(" · ")}</p>
        </>
      )}
    </>
  );
}

function readFields(form: HTMLFormElement): WorkPostFields {
  const values = new FormData(form);
  return {
    title: String(values.get("title") ?? ""),
    type: String(values.get("type") ?? "") as WorkPostFields["type"],
    location: String(values.get("location") ?? ""),
    pay: String(values.get("pay") ?? ""),
    description: String(values.get("description") ?? ""),
    skills: String(values.get("skills") ?? ""),
  };
}

function PostEditor({
  draft,
  role,
  state,
  setState,
  onClose,
  onNotice,
  text,
  focusFallbackRef,
}: WorkHiringWorkspaceProps & {
  draft: WorkPostDraft;
  onClose: () => void;
  onNotice: (message: string) => void;
  text: WorkCopy;
  focusFallbackRef: RefObject<HTMLButtonElement | null>;
}) {
  const { copy } = text;
  const labels = fieldLabels(copy);
  const id = useId();
  const [errors, setErrors] = useState<WorkPostErrors>({});
  const [issue, setIssue] = useState("");
  const [failedSubmit, setFailedSubmit] = useState(0);
  const summary = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(draft.stage);
  useEffect(() => {
    if (failedSubmit) summary.current?.focus();
  }, [failedSubmit]);
  useEffect(() => {
    if (draft.stage !== previousStage.current) {
      previousStage.current = draft.stage;
      stepHeading.current?.focus();
    }
  }, [draft.stage]);
  const change = (field: keyof WorkPostFields, value: string) => {
    setState((current) =>
      updateWorkPostDraft(current, role, draft.id, { [field]: value }),
    );
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIssue("");
  };
  const errorEntries = (
    Object.entries(errors) as [
      keyof WorkPostFields,
      WorkIssueCode | undefined,
    ][]
  ).filter((entry) => entry[1]);
  const report = (
    nextErrors: WorkPostErrors,
    nextIssue: { code: string } | null | undefined,
  ) => {
    setErrors(nextErrors);
    setIssue(issueText(nextIssue, copy));
    setFailedSubmit((attempt) => attempt + 1);
  };
  const review = (form: HTMLFormElement) => {
    const updated = updateWorkPostDraft(
      state,
      role,
      draft.id,
      readFields(form),
    );
    const result = reviewWorkPostDraft(updated, role, draft.id);
    setState(result.state);
    if (result.issue || Object.keys(result.errors).length)
      report(result.errors, result.issue);
    else {
      setErrors({});
      setIssue("");
    }
  };
  const publish = () => {
    const result = publishWorkPost(state, role, draft.id, draft.revision);
    setState(result.state);
    if (!result.opportunityId) report(result.errors, result.issue);
    else
      onNotice(
        copy(
          "Opportunity added to this tab’s catalogue.",
          "Oportunidade adicionada ao catálogo deste separador.",
        ),
      );
  };
  const discard = () => {
    setState((current) => discardWorkPostDraft(current, role, draft.id));
    onNotice(
      copy(
        "Draft removed. You can undo this below.",
        "Rascunho removido. Pode anular esta ação abaixo.",
      ),
    );
  };
  return (
    <HiringDialog
      title={copy("Opportunity draft", "Rascunho de oportunidade")}
      onClose={onClose}
      copy={copy}
      focusFallbackRef={focusFallbackRef}
    >
      <div className="modal-body">
        <h3 ref={stepHeading} tabIndex={-1}>
          {draft.stage === "review"
            ? copy("Review before publishing", "Rever antes de publicar")
            : copy("Describe the opportunity", "Descrever a oportunidade")}
        </h3>
        <p className="work-hiring-muted">
          {draft.stage === "review"
            ? copy(
                "Publishing adds this opportunity to the catalogue in this tab. Only the details below are shown to candidates.",
                "A publicação adiciona esta oportunidade ao catálogo deste separador. Apenas os dados abaixo são apresentados aos candidatos.",
              )
            : copy(
                "Changes are kept as a private draft while you move around this tab.",
                "As alterações ficam guardadas num rascunho privado enquanto navega neste separador.",
              )}
        </p>
        {(issue || errorEntries.length > 0) && (
          <div
            className="work-hiring-errors"
            role="alert"
            tabIndex={-1}
            ref={summary}
          >
            <strong>
              {copy("Check these details", "Verifique estes dados")}
            </strong>
            {issue && <p>{issue}</p>}
            {errorEntries.length > 0 && (
              <ul>
                {errorEntries.map(
                  ([field, error]) =>
                    error && (
                      <li key={field}>{fieldIssue(field, error, copy)}</li>
                    ),
                )}
              </ul>
            )}
          </div>
        )}
        {draft.stage === "editing" ? (
          <form
            ref={formRef}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              review(event.currentTarget);
            }}
          >
            <div className="work-hiring-fields">
              {(
                [
                  "title",
                  "type",
                  "location",
                  "pay",
                  "description",
                  "skills",
                ] as const
              ).map((field) => {
                const error = errors[field];
                const fieldId = `${id}-${field}`;
                const descriptionId = `${fieldId}-description`;
                const props = {
                  id: fieldId,
                  name: field,
                  value: draft[field],
                  "aria-label": labels[field],
                  "aria-invalid": Boolean(error),
                  "aria-describedby":
                    error || field === "skills" ? descriptionId : undefined,
                  onChange: (
                    event: React.ChangeEvent<
                      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                    >,
                  ) => change(field, event.currentTarget.value),
                  onInput: (
                    event: React.FormEvent<
                      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                    >,
                  ) => change(field, event.currentTarget.value),
                };
                return (
                  <label
                    className={
                      field === "title" ||
                      field === "description" ||
                      field === "skills"
                        ? "work-hiring-full"
                        : ""
                    }
                    key={field}
                    htmlFor={fieldId}
                  >
                    {labels[field]}
                    {field === "type" ? (
                      <select {...props}>
                        <option value="">
                          {copy("Choose an arrangement", "Escolher um regime")}
                        </option>
                        {["Freelance", "Project", "Part time", "Full time"].map(
                          (type) => (
                            <option key={type} value={type}>
                              {text.arrangement(type)}
                            </option>
                          ),
                        )}
                      </select>
                    ) : field === "description" ? (
                      <textarea {...props} maxLength={4000} rows={6} />
                    ) : (
                      <input
                        {...props}
                        maxLength={
                          { title: 100, location: 140, pay: 160, skills: 500 }[
                            field
                          ]
                        }
                      />
                    )}
                    {error ? (
                      <span
                        id={descriptionId}
                        className="work-hiring-field-error"
                      >
                        {fieldIssue(field, error, copy)}
                      </span>
                    ) : (
                      field === "skills" && (
                        <small id={descriptionId} className="work-hiring-muted">
                          {copy(
                            "Separate up to 10 skills with commas.",
                            "Separe até 10 competências com vírgulas.",
                          )}
                        </small>
                      )
                    )}
                  </label>
                );
              })}
            </div>
            <div className="work-hiring-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={discard}
              >
                {copy("Discard draft", "Eliminar rascunho")}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  if (formRef.current) {
                    const fields = readFields(formRef.current);
                    setState((current) =>
                      updateWorkPostDraft(current, role, draft.id, fields),
                    );
                  }
                  onClose();
                }}
              >
                {copy("Save and close", "Guardar e fechar")}
              </button>
              <button type="submit" className="button">
                {copy("Review opportunity", "Rever oportunidade")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <PostContent post={draft} text={text} />
            <div className="work-hiring-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setState((current) =>
                    editWorkPostDraft(current, role, draft.id),
                  );
                  setErrors({});
                  setIssue("");
                }}
              >
                {copy("Edit draft", "Editar rascunho")}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={onClose}
              >
                {copy("Close preview", "Fechar pré-visualização")}
              </button>
              <button type="button" className="button" onClick={publish}>
                {copy("Publish in this tab", "Publicar neste separador")}
              </button>
            </div>
          </>
        )}
      </div>
    </HiringDialog>
  );
}

function applicationStatus(application: WorkApplication, copy: Copy) {
  return application.status === "Withdrawn"
    ? copy("Withdrawn", "Retirada")
    : application.reviewedAt
      ? copy("Reviewed", "Revista")
      : copy("Awaiting review", "Por rever");
}

function ApplicationContent({
  application,
  text,
  onMarkReviewed,
  reviewPending = false,
}: {
  application: WorkApplication;
  text: WorkCopy;
  onMarkReviewed: () => void;
  reviewPending?: boolean;
}) {
  const { copy, date } = text;
  const heading = useRef<HTMLHeadingElement>(null);
  const availability = text.availability(application.submission.availability);
  const historyLabels: Record<string, string> = {
    submitted: copy(
      "Candidate saved the application",
      "Candidato guardou a candidatura",
    ),
    reviewed: copy(
      "Business marked the application reviewed",
      "Empresa marcou a candidatura como revista",
    ),
    withdrawn: copy(
      "Candidate withdrew the application",
      "Candidato retirou a candidatura",
    ),
  };
  return (
    <>
      <span className="work-hiring-badge">
        {applicationStatus(application, copy)}
      </span>
      <h3 className="work-hiring-detail-title" ref={heading} tabIndex={-1}>
        {application.applicantName}
      </h3>
      <p className="work-hiring-muted">{application.opportunity.title}</p>
      <dl className="work-hiring-details">
        <div>
          <dt>{copy("Application recorded", "Candidatura registada")}</dt>
          <dd>{date(application.submittedAt, true)}</dd>
        </div>
        <div>
          <dt>{copy("Availability", "Disponibilidade")}</dt>
          <dd>
            {availability} ·{" "}
            <time dateTime={application.submission.availableFrom}>
              {date(application.submission.availableFrom)}
            </time>
          </dd>
        </div>
        <div>
          <dt>
            {copy(
              "Opportunity at submission",
              "Oportunidade à data da candidatura",
            )}
          </dt>
          <dd>
            {text.arrangement(application.opportunity.type)} ·{" "}
            {application.opportunity.location}
          </dd>
        </div>
        <div>
          <dt>
            {copy(
              "Pay or budget at submission",
              "Remuneração ou orçamento à data da candidatura",
            )}
          </dt>
          <dd>{application.opportunity.pay}</dd>
        </div>
      </dl>
      <h4>{copy("Candidate introduction", "Apresentação do candidato")}</h4>
      <p className="work-hiring-text">{application.submission.introduction}</p>
      <h4>{copy("History", "Histórico")}</h4>
      <ol className="work-hiring-history">
        {application.history.map((entry) => (
          <li key={entry.id}>
            {historyLabels[entry.action] ?? entry.action}
            <time dateTime={entry.at}>{date(entry.at, true)}</time>
          </li>
        ))}
      </ol>
      {application.status === "Submitted" && !application.reviewedAt && (
        <>
          <p className="work-hiring-muted">
            {copy(
              "Marking reviewed records that you inspected this application. It does not create a hiring decision.",
              "Marcar como revista regista que analisou esta candidatura. Não cria uma decisão de contratação.",
            )}
          </p>
          <div className="work-hiring-actions">
            <button
              type="button"
              className="button"
              disabled={reviewPending}
              onClick={() => {
                heading.current?.focus();
                onMarkReviewed();
              }}
            >
              {copy("Mark reviewed", "Marcar como revista")}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function captureWorkReviewCommand(
  role: Role,
  applicationId: string,
): WorkReviewCommand {
  return Object.freeze({
    token: crypto.randomUUID(),
    role,
    applicationId,
    at: Date.now(),
  });
}

export function WorkHiringWorkspace({
  role,
  state,
  setState,
  onBrowseOpportunities,
}: WorkHiringWorkspaceProps) {
  const text = useWorkCopy();
  const { copy, date } = text;
  const [notice, setNotice] = useState("");
  const [pendingReview, setPendingReview] = useState<WorkReviewCommand | null>(
    null,
  );
  const postHeading = useRef<HTMLHeadingElement>(null);
  const newOpportunityButton = useRef<HTMLButtonElement>(null);
  const view = workHiringView(state, role);
  const drafts = workPostDrafts(state, role);
  const posts = ownedWorkOpportunities(state, role);
  const applications = visibleWorkApplications(state, role);
  const removed = removedWorkPostDraft(state, role);
  const draft = drafts.find((record) => record.id === view.selectedDraftId);
  const post = posts.find((record) => record.id === view.selectedPostId);
  const application = applications.find(
    (record) => record.id === view.selectedApplicationId,
  );
  const reviewCommand =
    !draft &&
    !post &&
    pendingReview?.role === role &&
    pendingReview.applicationId === application?.id
      ? pendingReview
      : null;
  const reviewReceipt =
    reviewCommand &&
    state.reviewReceipt?.token === reviewCommand.token &&
    state.reviewReceipt.role === reviewCommand.role &&
    state.reviewReceipt.applicationId === reviewCommand.applicationId
      ? state.reviewReceipt
      : null;
  const reviewRecorded =
    reviewCommand &&
    reviewReceipt?.issue === null &&
    application?.history.some(
      (event) =>
        event.id === reviewReceipt.eventId &&
        event.action === "reviewed" &&
        event.actor === role &&
        Date.parse(event.at) === reviewCommand.at &&
        application.reviewedAt === event.at,
    );
  const reviewFeedback = !reviewCommand
    ? null
    : !reviewReceipt
      ? copy("Recording review…", "A registar a revisão…")
      : reviewRecorded
        ? copy(
            "Application marked reviewed.",
            "Candidatura marcada como revista.",
          )
        : copy(
            "This application can no longer be marked as reviewed.",
            "Esta candidatura já não pode ser marcada como revista.",
          );
  const updateView = (patch: Partial<HiringView>) =>
    setState((current) => updateWorkHiringView(current, role, patch));
  const close = () => {
    setPendingReview(null);
    updateView({
      selectedPostId: null,
      selectedDraftId: null,
      selectedApplicationId: null,
    });
  };
  const select = (kind: "draft" | "post" | "application", id: string) => {
    setPendingReview(null);
    updateView({
      selectedDraftId: kind === "draft" ? id : null,
      selectedPostId: kind === "post" ? id : null,
      selectedApplicationId: kind === "application" ? id : null,
    });
  };
  const filteredPosts = posts.filter(
    (record) =>
      (view.filter === "All" || record.status === view.filter) &&
      matchesSearch(
        view.query,
        record.title,
        record.location,
        record.pay,
        record.description,
        ...record.skills,
      ),
  );
  const filteredDrafts = drafts.filter((record) =>
    matchesSearch(
      view.query,
      record.title,
      record.location,
      record.pay,
      record.description,
      record.skills,
    ),
  );
  const filteredApplications = applications.filter(
    (record) =>
      (view.applicationFilter === "All" ||
        (view.applicationFilter === "Unreviewed"
          ? record.status === "Submitted" && !record.reviewedAt
          : record.status === view.applicationFilter)) &&
      matchesSearch(
        view.query,
        record.applicantName,
        record.opportunity.title,
        record.submission.introduction,
      ),
  );
  const unreviewed = applications.filter(
    (record) => record.status === "Submitted" && !record.reviewedAt,
  ).length;
  const createDraft = () => {
    const result = createWorkPostDraft(state, role);
    setState(result.state);
    setNotice(result.issue ? issueText(result.issue, copy) : "");
  };
  if (role !== "provider")
    return (
      <section className="work-hiring-workspace work-hiring-empty">
        <BriefcaseBusiness size={28} aria-hidden="true" />
        <h2>{copy("Hiring workspace", "Área de contratação")}</h2>
        <p>
          {copy(
            "Opportunity drafts and applicant review are available in the Volt & Co. service provider workspace. You can browse opportunities from this workspace.",
            "Os rascunhos de oportunidades e a análise de candidaturas estão disponíveis na área de prestador de serviços Volt & Co. Pode consultar oportunidades nesta área.",
          )}
        </p>
        {onBrowseOpportunities && (
          <button
            className="button button-secondary"
            onClick={onBrowseOpportunities}
          >
            {copy("Browse opportunities", "Consultar oportunidades")}
          </button>
        )}
      </section>
    );
  const sectionLabels: Record<HiringView["section"], string> = {
    posts: copy("Opportunities", "Oportunidades"),
    drafts: copy("Drafts", "Rascunhos"),
    applications: copy("Applications", "Candidaturas"),
  };
  const empty =
    view.section === "posts"
      ? filteredPosts.length === 0
      : view.section === "drafts"
        ? filteredDrafts.length === 0
        : filteredApplications.length === 0;
  return (
    <section className="work-hiring-workspace">
      <header className="work-hiring-heading">
        <div>
          <span className="eyebrow">Volt &amp; Co.</span>
          <h2>
            {copy(
              "Opportunities and applications",
              "Oportunidades e candidaturas",
            )}
          </h2>
          <p>
            {copy(
              "Manage your business’s posts and review the applications candidates choose to share.",
              "Gira as oportunidades da sua empresa e analise as candidaturas que os candidatos escolhem partilhar.",
            )}
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={createDraft}
          ref={newOpportunityButton}
        >
          <Plus size={17} aria-hidden="true" />
          {copy("New opportunity", "Nova oportunidade")}
        </button>
      </header>
      <dl className="work-hiring-metrics">
        <div>
          <dt>{copy("Open opportunities", "Oportunidades abertas")}</dt>
          <dd>{posts.filter((record) => record.status === "Open").length}</dd>
        </div>
        <div>
          <dt>{copy("Private drafts", "Rascunhos privados")}</dt>
          <dd>{drafts.length}</dd>
        </div>
        <div>
          <dt>{copy("Applications to review", "Candidaturas por rever")}</dt>
          <dd>{unreviewed}</dd>
        </div>
      </dl>
      <div className="work-hiring-toolbar">
        <div
          className="work-hiring-filters"
          role="group"
          aria-label={copy("Hiring records", "Registos de contratação")}
        >
          {(["posts", "drafts", "applications"] as const).map((section) => (
            <button
              key={section}
              type="button"
              aria-pressed={view.section === section}
              onClick={() => updateView({ section })}
            >
              {sectionLabels[section]}
            </button>
          ))}
        </div>
        <label className="work-hiring-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={view.query}
            aria-label={copy(
              "Search your hiring records",
              "Pesquisar os seus registos de contratação",
            )}
            placeholder={copy("Search records", "Pesquisar registos")}
            onChange={(event) =>
              updateView({ query: event.currentTarget.value })
            }
          />
        </label>
      </div>
      {view.section === "posts" && (
        <div
          className="work-hiring-toolbar work-hiring-filters"
          role="group"
          aria-label={copy("Opportunity status", "Estado da oportunidade")}
        >
          {(["All", "Open", "Closed"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={view.filter === filter}
              onClick={() => updateView({ filter })}
            >
              {filter === "All"
                ? copy("All", "Todas")
                : filter === "Open"
                  ? copy("Open", "Abertas")
                  : copy("Closed", "Encerradas")}
            </button>
          ))}
        </div>
      )}
      {view.section === "applications" && (
        <div
          className="work-hiring-toolbar work-hiring-filters"
          role="group"
          aria-label={copy("Application status", "Estado da candidatura")}
        >
          {(["All", "Unreviewed", "Submitted", "Withdrawn"] as const).map(
            (applicationFilter) => (
              <button
                key={applicationFilter}
                type="button"
                aria-pressed={view.applicationFilter === applicationFilter}
                onClick={() => updateView({ applicationFilter })}
              >
                {
                  {
                    All: copy("All", "Todas"),
                    Unreviewed: copy("To review", "Por rever"),
                    Submitted: copy("Submitted", "Registadas"),
                    Withdrawn: copy("Withdrawn", "Retiradas"),
                  }[applicationFilter]
                }
              </button>
            ),
          )}
        </div>
      )}
      <p className="work-hiring-notice" role="status">
        {notice}
      </p>
      {removed && (
        <div className="work-hiring-toolbar work-hiring-scope">
          <span>
            {copy("Removed draft:", "Rascunho removido:")}{" "}
            {removed.title ||
              copy("Untitled opportunity", "Oportunidade sem título")}
          </span>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              const result = restoreWorkPostDraft(state, role);
              setState(result.state);
              setNotice(
                result.issue
                  ? issueText(result.issue, copy)
                  : copy("Draft restored.", "Rascunho recuperado."),
              );
            }}
          >
            {copy("Undo removal", "Anular eliminação")}
          </button>
        </div>
      )}
      <div className="work-hiring-list">
        {view.section === "posts" &&
          filteredPosts.map((record) => (
            <button
              key={record.id}
              type="button"
              className="work-hiring-row"
              onClick={() => select("post", record.id)}
            >
              <span className="work-hiring-row-main">
                <span className="work-hiring-badge">
                  {record.status === "Open"
                    ? copy("Open", "Aberta")
                    : copy("Closed", "Encerrada")}
                </span>
                <strong>{record.title}</strong>
                <small>
                  {text.arrangement(record.type)} · {record.location}
                </small>
                <small>
                  {record.pay} ·{" "}
                  {
                    applications.filter(
                      (candidate) => candidate.opportunityId === record.id,
                    ).length
                  }{" "}
                  {copy("applications", "candidaturas")}
                </small>
              </span>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          ))}
        {view.section === "drafts" &&
          filteredDrafts.map((record) => (
            <button
              key={record.id}
              type="button"
              className="work-hiring-row"
              onClick={() => select("draft", record.id)}
            >
              <span className="work-hiring-row-main">
                <span className="work-hiring-badge">
                  {record.stage === "review"
                    ? copy("Ready for your review", "Pronto para a sua revisão")
                    : copy("Private draft", "Rascunho privado")}
                </span>
                <strong>
                  {record.title ||
                    copy("Untitled opportunity", "Oportunidade sem título")}
                </strong>
                <small>
                  {copy("Updated", "Atualizado")} {date(record.updatedAt, true)}
                </small>
              </span>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          ))}
        {view.section === "applications" &&
          filteredApplications.map((record) => (
            <button
              key={record.id}
              type="button"
              className="work-hiring-row"
              onClick={() => select("application", record.id)}
            >
              <span className="work-hiring-row-main">
                <span className="work-hiring-badge">
                  {applicationStatus(record, copy)}
                </span>
                <strong>{record.applicantName}</strong>
                <small>{record.opportunity.title}</small>
                <small>{date(record.submittedAt, true)}</small>
              </span>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          ))}
      </div>
      {empty && (
        <div className="work-hiring-empty">
          <BriefcaseBusiness size={27} aria-hidden="true" />
          <h3>
            {view.query
              ? copy("No matching records", "Nenhum registo correspondente")
              : view.section === "applications"
                ? copy(
                    "No applications in this view",
                    "Sem candidaturas nesta vista",
                  )
                : view.section === "drafts"
                  ? copy("No private drafts", "Sem rascunhos privados")
                  : copy(
                      "No opportunities in this view",
                      "Sem oportunidades nesta vista",
                    )}
          </h3>
          <p>
            {view.query
              ? copy(
                  "Try another search or clear the filters.",
                  "Experimente outra pesquisa ou limpe os filtros.",
                )
              : view.section === "applications"
                ? copy(
                    "Applications appear here only after a candidate explicitly submits one for your business.",
                    "As candidaturas surgem aqui apenas depois de um candidato as registar para a sua empresa.",
                  )
                : copy(
                    "Create an opportunity draft or change the selected filter.",
                    "Crie um rascunho de oportunidade ou altere o filtro selecionado.",
                  )}
          </p>
          {(view.query ||
            view.filter !== "All" ||
            view.applicationFilter !== "All") && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() =>
                updateView({
                  query: "",
                  filter: "All",
                  applicationFilter: "All",
                })
              }
            >
              {copy("Clear filters", "Limpar filtros")}
            </button>
          )}
        </div>
      )}
      <p className="work-hiring-muted work-hiring-notice">{text.scope}</p>
      {draft && (
        <PostEditor
          key={draft.id}
          draft={draft}
          role={role}
          state={state}
          setState={setState}
          onClose={close}
          onNotice={setNotice}
          text={text}
          focusFallbackRef={newOpportunityButton}
        />
      )}
      {!draft && application && (
        <HiringDialog
          title={copy("Application details", "Detalhes da candidatura")}
          onClose={close}
          copy={copy}
          focusFallbackRef={newOpportunityButton}
        >
          <div className="modal-body">
            {reviewFeedback && (
              <p className="work-hiring-notice" role="status">
                {reviewFeedback}
              </p>
            )}
            <ApplicationContent
              application={application}
              text={text}
              reviewPending={Boolean(reviewCommand && !reviewReceipt)}
              onMarkReviewed={() => {
                const command = captureWorkReviewCommand(role, application.id);
                setNotice("");
                setPendingReview(command);
                setState((current) => applyWorkReviewCommand(current, command));
              }}
            />
          </div>
        </HiringDialog>
      )}
      {!draft && !application && post && (
        <HiringDialog
          title={copy("Opportunity details", "Detalhes da oportunidade")}
          onClose={close}
          copy={copy}
          focusFallbackRef={newOpportunityButton}
        >
          <div className="modal-body">
            <span className="work-hiring-badge">
              {post.status === "Open"
                ? copy("Open", "Aberta")
                : copy("Closed", "Encerrada")}
            </span>
            <PostContent post={post} text={text} headingRef={postHeading} />
            <p className="work-hiring-muted">
              {copy("Added", "Adicionada")} {date(post.createdAt, true)}
              {post.closedAt && (
                <>
                  {" "}
                  · {copy("Closed", "Encerrada")} {date(post.closedAt, true)}
                </>
              )}
            </p>
            <h4>
              {copy(
                "Applications for this opportunity",
                "Candidaturas para esta oportunidade",
              )}
            </h4>
            <div className="work-hiring-list">
              {applications
                .filter((candidate) => candidate.opportunityId === post.id)
                .map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="work-hiring-row"
                    onClick={() => select("application", candidate.id)}
                  >
                    <span className="work-hiring-row-main">
                      <strong>{candidate.applicantName}</strong>
                      <small>
                        {applicationStatus(candidate, copy)} ·{" "}
                        {date(candidate.submittedAt)}
                      </small>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                ))}
            </div>
            {!applications.some(
              (candidate) => candidate.opportunityId === post.id,
            ) && (
              <p className="work-hiring-muted">
                {copy(
                  "No applications have been recorded for this opportunity.",
                  "Ainda não existem candidaturas registadas para esta oportunidade.",
                )}
              </p>
            )}
            {post.status === "Open" && (
              <p className="work-hiring-muted work-hiring-notice">
                {copy(
                  "Closing stops new applications. Existing applications and their history remain available.",
                  "Encerrar impede novas candidaturas. As candidaturas existentes e o seu histórico continuam disponíveis.",
                )}
              </p>
            )}
            <div className="work-hiring-actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  const result = copyWorkOpportunityToDraft(
                    state,
                    role,
                    post.id,
                  );
                  setState(result.state);
                  setNotice(
                    result.issue
                      ? issueText(result.issue, copy)
                      : copy(
                          "New private draft created from this opportunity.",
                          "Novo rascunho privado criado a partir desta oportunidade.",
                        ),
                  );
                }}
              >
                {copy("Copy to new draft", "Copiar para novo rascunho")}
              </button>
              {post.status === "Open" && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    postHeading.current?.focus();
                    setState((current) =>
                      closeWorkOpportunity(current, role, post.id),
                    );
                    setNotice(
                      copy(
                        "Opportunity closed; application history retained.",
                        "Oportunidade encerrada; histórico de candidaturas mantido.",
                      ),
                    );
                  }}
                >
                  {copy("Close opportunity", "Encerrar oportunidade")}
                </button>
              )}
            </div>
          </div>
        </HiringDialog>
      )}
    </section>
  );
}
