import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Check, FileText, Plus, Trash2 } from "lucide-react";
import type { Role } from "../types";
import { DOCUMENT_ACCEPT } from "./documentState";
import { DocumentPreview } from "./DocumentPreview";
import {
  addApplicationEvidenceFiles,
  applicationEvidenceDraft,
  applicationEvidenceSummary,
  canRequestApplicationEvidence,
  canRespondApplicationEvidence,
  discardApplicationEvidenceDraft,
  MAX_APPLICATION_EVIDENCE_NOTE,
  removeApplicationEvidenceFile,
  submitApplicationEvidence,
  updateApplication,
  updateApplicationEvidenceNote,
  visibleApplicationRecords,
  type ApplicationAction,
  type ApplicationEvidenceFile,
  type ApplicationEvidenceIssue,
  type ApplicationRecord,
  type ApplicationState,
} from "./applicationState";
import { useApplicationCopy } from "./applicationEvidenceCopy";

interface ApplicationEvidenceProps {
  role: Role;
  record: ApplicationRecord;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
}

export function ApplicationEvidence({
  role,
  record,
  state,
  setState,
}: ApplicationEvidenceProps) {
  const { text, date, documentName, phase, issueText, locale } =
    useApplicationCopy();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const targetDocument = useRef("");
  const addButtons = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const focusAfterUpdate = useRef(false);
  const requestButton = useRef<HTMLButtonElement>(null);
  const [requesting, setRequesting] = useState(false);
  const [issues, setIssues] = useState<ApplicationEvidenceIssue[]>([]);
  const [feedback, setFeedback] = useState<
    | "added"
    | "removed"
    | "discarded"
    | "submitted"
    | "requested"
    | "acknowledged"
    | "closed"
    | null
  >(null);
  const [preview, setPreview] = useState<{
    fileId: string;
    responseId?: string;
  } | null>(null);
  const summary = applicationEvidenceSummary(record);
  const draft = applicationEvidenceDraft(state, role, record.id);
  const mayRespond = canRespondApplicationEvidence(record, role);
  const mayRequest = canRequestApplicationEvidence(record, role);
  const currentRequestId = summary.requestOpen
    ? (summary.latestRequest?.id ?? null)
    : null;
  const retainedDraft =
    role === "tenant" && Boolean(state.evidenceDrafts?.[record.id]);
  const staleDraft = Boolean(
    retainedDraft && draft && draft.requestId !== currentRequestId,
  );
  const editable = mayRespond && !staleDraft;
  const documentIds =
    summary.requestOpen && summary.latestRequest
      ? summary.latestRequest.documentIds
      : record.documents
          .filter((document) => document.status !== "Supplied")
          .map((document) => document.id);
  const responses = record.evidenceResponses ?? [];
  const selectedFile = preview?.responseId
    ? responses
        .find((response) => response.id === preview.responseId)
        ?.files.find((file) => file.id === preview.fileId)
    : draft?.files.find((file) => file.id === preview?.fileId);
  const visible = visibleApplicationRecords(state, role).some(
    (item) => item.id === record.id,
  );
  const labels = {
    added: text(
      "Files added to your draft. Submit the response when it is ready.",
      "Ficheiros adicionados ao rascunho. Guarde a resposta quando estiver pronta.",
    ),
    removed: text(
      "File removed from the draft.",
      "Ficheiro removido do rascunho.",
    ),
    discarded: text(
      "Draft discarded. Submitted responses are unchanged.",
      "Rascunho descartado. As respostas já guardadas mantêm-se.",
    ),
    submitted: text(
      "Response saved locally for owner inspection. The application decision is unchanged.",
      "Resposta guardada localmente para consulta do proprietário. A decisão da candidatura mantém-se.",
    ),
    requested: text(
      "Document request recorded locally. The application decision is unchanged.",
      "Pedido de documentos registado localmente. A decisão da candidatura mantém-se.",
    ),
    acknowledged: text(
      "Response acknowledged locally. This does not verify the files or approve the application.",
      "Consulta da resposta registada localmente. Os ficheiros não foram verificados e a candidatura não foi aprovada por esta ação.",
    ),
    closed: text(
      "Document request closed locally. The files and application decision are unchanged.",
      "Pedido de documentos encerrado localmente. Os ficheiros e a decisão da candidatura mantêm-se.",
    ),
  };

  useLayoutEffect(() => {
    if (!focusAfterUpdate.current) return;
    focusAfterUpdate.current = false;
    heading.current?.focus();
  });

  function showIssues(next: ApplicationEvidenceIssue[]) {
    setIssues(next);
    if (next.length) requestAnimationFrame(() => errorSummary.current?.focus());
  }

  function ownerAction(
    action: ApplicationAction,
    message: "requested" | "acknowledged" | "closed",
  ) {
    const next = updateApplication(state, record.id, role, action);
    if (next === state) {
      showIssues([{ code: "unavailable" }]);
      return false;
    }
    setState(next);
    setIssues([]);
    setFeedback(message);
    focusAfterUpdate.current = true;
    return true;
  }

  function filesList(
    files: readonly ApplicationEvidenceFile[],
    responseId?: string,
  ) {
    return (
      <ul className="application-evidence-files">
        {files.map((attachment) => {
          const document = record.documents.find(
            (item) => item.id === attachment.documentId,
          );
          return (
            <li key={attachment.id}>
              <button
                type="button"
                className="application-evidence-preview"
                onClick={() =>
                  setPreview({ fileId: attachment.id, responseId })
                }
                aria-label={`${text("Preview", "Pré-visualizar")} ${attachment.file.name}`}
              >
                <FileText size={19} aria-hidden="true" />
                <span>
                  <strong>{attachment.file.name}</strong>
                  <small>
                    {documentName(
                      attachment.documentId,
                      document?.name ?? attachment.documentId,
                    )}{" "}
                    ·{" "}
                    {new Intl.NumberFormat(locale).format(
                      Math.ceil(attachment.file.size / 1024),
                    )}{" "}
                    KB
                  </small>
                </span>
              </button>
              {!responseId && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setState((current) =>
                      removeApplicationEvidenceFile(
                        current,
                        role,
                        record.id,
                        attachment.id,
                      ),
                    );
                    setFeedback("removed");
                    setIssues([]);
                    requestAnimationFrame(() =>
                      (
                        addButtons.current.get(attachment.documentId) ??
                        heading.current
                      )?.focus(),
                    );
                  }}
                  aria-label={`${text("Remove from draft", "Remover do rascunho")}: ${attachment.file.name}`}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (!visible) return null;

  return (
    <section
      className="application-detail-section application-evidence"
      aria-labelledby={`${id}-title`}
    >
      <div className="application-section-heading">
        <h3 id={`${id}-title`} ref={heading} tabIndex={-1}>
          {text(
            "Files and document responses",
            "Ficheiros e respostas documentais",
          )}
        </h3>
        <span className="pill pill-neutral">{phase(summary.phase)}</span>
      </div>
      <p className="application-explanation">
        {text(
          "Selected files stay in this tab until reload. Drafts are visible only in the applicant workspace. Submitted responses can be inspected in the corresponding owner workspace; nothing is uploaded or delivered.",
          "Os ficheiros selecionados ficam neste separador até recarregar. Os rascunhos só aparecem na área do candidato. As respostas guardadas podem ser consultadas na área do proprietário correspondente; nada é carregado para um servidor ou enviado.",
        )}
      </p>
      {summary.latestRequest && (
        <div className="application-request-note">
          <strong>
            {text("Latest document request", "Último pedido de documentos")} ·{" "}
            {summary.latestRequest.version}
          </strong>
          <small>
            {date(summary.latestRequest.createdAt, true)} ·{" "}
            {summary.requestOpen
              ? text("Open", "Aberto")
              : text("Closed", "Encerrado")}
          </small>
          <ul>
            {summary.latestRequest.documentIds.map((documentId) => (
              <li key={documentId}>
                {documentName(
                  documentId,
                  record.documents.find(
                    (document) => document.id === documentId,
                  )?.name ?? documentId,
                )}
              </li>
            ))}
          </ul>
          {summary.latestRequest.note && <p>{summary.latestRequest.note}</p>}
          {summary.requestOpen && (
            <p>
              {summary.outstandingDocumentIds.length
                ? `${text("Still without submitted files", "Ainda sem ficheiros numa resposta guardada")}: ${summary.outstandingDocumentIds.map((documentId) => documentName(documentId, documentId)).join(", ")}.`
                : text(
                    "Files have been supplied for the requested documents. The owner still decides whether to close the request.",
                    "Foram fornecidos ficheiros para os documentos pedidos. Cabe ao proprietário decidir se encerra o pedido.",
                  )}
            </p>
          )}
        </div>
      )}
      <p className="application-action-feedback" role="status">
        {feedback && labels[feedback]}
      </p>
      {issues.length > 0 && (
        <div
          className="application-evidence-errors"
          role="alert"
          ref={errorSummary}
          tabIndex={-1}
        >
          <strong>
            {text("Review this response", "Reveja esta resposta")}
          </strong>
          <ul>
            {issues.map((issue, index) => (
              <li key={`${index}-${issue.code}`}>{issueText(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {role === "tenant" && (mayRespond || retainedDraft) && (
        <form
          className="application-evidence-draft"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const note = String(
              new FormData(event.currentTarget).get("note") ?? "",
            );
            const prepared = updateApplicationEvidenceNote(
              state,
              role,
              record.id,
              note,
            );
            const preparedDraft = applicationEvidenceDraft(
              prepared,
              role,
              record.id,
            );
            if (!preparedDraft || !editable) {
              showIssues([{ code: "staleRequest" }]);
              return;
            }
            const result = submitApplicationEvidence(
              prepared,
              role,
              record.id,
              preparedDraft.revision,
              currentRequestId,
            );
            setState(result.state);
            if (result.issue) {
              showIssues([result.issue]);
              return;
            }
            if (result.responseId) {
              setFeedback("submitted");
              setIssues([]);
              focusAfterUpdate.current = true;
            }
          }}
        >
          <h4>{text("Your response draft", "Rascunho da sua resposta")}</h4>
          <p className="application-explanation">
            {text(
              "Attach files to the relevant document, or explain what you can provide. Partial and note-only responses are allowed; an explanation does not count as a supplied file.",
              "Anexe ficheiros ao documento correspondente ou explique o que pode fornecer. Pode guardar uma resposta parcial ou apenas uma nota; uma explicação não conta como ficheiro fornecido.",
            )}
          </p>
          {!editable && (
            <p className="application-evidence-errors">
              {text(
                "This draft belongs to an earlier or closed request. You can inspect or remove its files, or discard it to start from the current request.",
                "Este rascunho pertence a um pedido anterior ou encerrado. Pode consultar ou remover os ficheiros, ou descartá-lo para começar com o pedido atual.",
              )}
            </p>
          )}
          <div className="application-evidence-add">
            {documentIds.map((documentId) => (
              <div key={documentId}>
                <strong>
                  {documentName(
                    documentId,
                    record.documents.find(
                      (document) => document.id === documentId,
                    )?.name ?? documentId,
                  )}
                </strong>
                <button
                  type="button"
                  className="soft-button"
                  disabled={!editable}
                  aria-label={`${text("Add files", "Adicionar ficheiros")} · ${documentName(documentId, record.documents.find((document) => document.id === documentId)?.name ?? documentId)}`}
                  ref={(element) => {
                    if (element) addButtons.current.set(documentId, element);
                    else addButtons.current.delete(documentId);
                  }}
                  onClick={() => {
                    targetDocument.current = documentId;
                    input.current?.click();
                  }}
                >
                  <Plus size={16} />
                  {text("Add files", "Adicionar ficheiros")}
                </button>
              </div>
            ))}
          </div>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept={DOCUMENT_ACCEPT}
            aria-label={text(
              "Choose response files",
              "Escolher ficheiros da resposta",
            )}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              if (files.length) {
                const result = addApplicationEvidenceFiles(
                  state,
                  role,
                  record.id,
                  targetDocument.current,
                  files,
                );
                setState(result.state);
                showIssues(result.issues);
                if (result.added) setFeedback("added");
              }
              event.currentTarget.value = "";
              addButtons.current.get(targetDocument.current)?.focus();
            }}
          />
          <p className="application-explanation">
            {text(
              "PDF, PNG, JPEG, GIF, WebP, TXT, MD or CSV · 10 MB per file · up to 10 files per response · 50 MB retained evidence limit.",
              "PDF, PNG, JPEG, GIF, WebP, TXT, MD ou CSV · 10 MB por ficheiro · até 10 ficheiros por resposta · limite de 50 MB de documentos retidos.",
            )}
          </p>
          {draft?.files.length ? (
            filesList(draft.files)
          ) : (
            <p className="application-explanation">
              {text("No files selected.", "Nenhum ficheiro selecionado.")}
            </p>
          )}
          <label htmlFor={`${id}-note`}>
            {text(
              "Response note (optional with files)",
              "Nota da resposta (opcional com ficheiros)",
            )}
            <textarea
              id={`${id}-note`}
              name="note"
              rows={4}
              maxLength={MAX_APPLICATION_EVIDENCE_NOTE}
              value={draft?.note ?? ""}
              disabled={!editable}
              onInput={(event) => {
                const note = event.currentTarget.value;
                setState((current) =>
                  updateApplicationEvidenceNote(current, role, record.id, note),
                );
              }}
              onChange={(event) => {
                const note = event.currentTarget.value;
                setState((current) =>
                  updateApplicationEvidenceNote(current, role, record.id, note),
                );
              }}
            />
          </label>
          <p className="application-explanation">
            {text(
              "The draft is retained when you close the application or navigate away. Select Save response to make this version available for owner inspection in this tab.",
              "O rascunho mantém-se ao fechar a candidatura ou mudar de página. Escolha Guardar resposta para disponibilizar esta versão para consulta do proprietário neste separador.",
            )}
          </p>
          <div className="application-review-actions">
            <button className="button" type="submit" disabled={!editable}>
              {text("Save response", "Guardar resposta")}
            </button>
            {retainedDraft && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setState((current) =>
                    discardApplicationEvidenceDraft(current, role, record.id),
                  );
                  setIssues([]);
                  setFeedback("discarded");
                  focusAfterUpdate.current = true;
                }}
              >
                {text("Discard draft", "Descartar rascunho")}
              </button>
            )}
          </div>
        </form>
      )}

      {responses.length > 0 && (
        <div className="application-evidence-responses">
          <h4>
            {text(
              "Submitted response history",
              "Histórico de respostas guardadas",
            )}
          </h4>
          {[...responses].reverse().map((response) => {
            const review = record.evidenceReviews?.find(
              (item) => item.responseId === response.id,
            );
            return (
              <article key={response.id}>
                <div className="application-section-heading">
                  <strong>
                    {text("Response", "Resposta")} {response.version}
                  </strong>
                  <span>
                    {review
                      ? text("Acknowledged", "Consultada")
                      : text(
                          "Awaiting owner inspection",
                          "Aguarda consulta do proprietário",
                        )}
                  </span>
                </div>
                <small>
                  {date(response.submittedAt, true)} · {response.files.length}{" "}
                  {response.files.length === 1
                    ? text("local file", "ficheiro local")
                    : text("local files", "ficheiros locais")}
                </small>
                {response.note && (
                  <p className="application-evidence-note">{response.note}</p>
                )}
                {response.files.length ? (
                  filesList(response.files, response.id)
                ) : (
                  <p className="application-explanation">
                    {text(
                      "Explanation only; no files were supplied in this response.",
                      "Apenas uma explicação; esta resposta não inclui ficheiros.",
                    )}
                  </p>
                )}
                {review && (
                  <p className="application-explanation">
                    <Check size={14} />{" "}
                    {text(
                      "Acknowledged locally",
                      "Consulta registada localmente",
                    )}{" "}
                    · {date(review.at, true)}
                  </p>
                )}
                {role === "landlord" && !review && (
                  <button
                    type="button"
                    className="soft-button"
                    onClick={() =>
                      ownerAction(
                        {
                          type: "acknowledge-evidence",
                          responseId: response.id,
                        },
                        "acknowledged",
                      )
                    }
                  >
                    {text(
                      "Acknowledge this response",
                      "Registar consulta desta resposta",
                    )}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {mayRequest && (
        <div className="application-evidence-owner-actions">
          <div className="application-review-actions">
            <button
              type="button"
              className="button button-secondary"
              ref={requestButton}
              aria-expanded={requesting}
              onClick={() => setRequesting((current) => !current)}
            >
              {text("Request documents", "Pedir documentos")}
            </button>
            {summary.requestOpen && summary.latestRequest && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  ownerAction(
                    {
                      type: "close-evidence-request",
                      requestId: summary.latestRequest!.id,
                    },
                    "closed",
                  )
                }
              >
                {text(
                  "Close document request",
                  "Encerrar pedido de documentos",
                )}
              </button>
            )}
          </div>
          <p className="application-explanation">
            {text(
              "Acknowledging a response records that you inspected it. Closing a request ends that follow-up, including when you accept an explanation. Neither action verifies files or changes the application decision.",
              "Registar a consulta de uma resposta indica que a consultou. Encerrar um pedido termina esse seguimento, incluindo quando aceita uma explicação. Nenhuma destas ações verifica os ficheiros ou altera a decisão da candidatura.",
            )}
          </p>
          {requesting && (
            <form
              className="application-request-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const documentIds = data.getAll("documentIds").map(String);
                const note = String(data.get("requestNote") ?? "");
                if (!documentIds.length) {
                  showIssues([{ code: "unknownDocument" }]);
                  return;
                }
                if (note.length > MAX_APPLICATION_EVIDENCE_NOTE) {
                  showIssues([{ code: "noteTooLong" }]);
                  return;
                }
                if (
                  ownerAction(
                    { type: "request-documents", documentIds, note },
                    "requested",
                  )
                )
                  setRequesting(false);
              }}
            >
              <fieldset>
                <legend>
                  {text(
                    "Which documents do you need?",
                    "De que documentos precisa?",
                  )}
                </legend>
                {record.documents.map((document) => (
                  <label key={document.id}>
                    <input
                      type="checkbox"
                      name="documentIds"
                      value={document.id}
                    />
                    {documentName(document.id, document.name)}
                  </label>
                ))}
              </fieldset>
              <label>
                {text(
                  "Note to include in the request",
                  "Nota a incluir no pedido",
                )}
                <textarea
                  name="requestNote"
                  rows={3}
                  maxLength={MAX_APPLICATION_EVIDENCE_NOTE}
                />
              </label>
              <div className="application-review-actions">
                <button type="submit" className="button">
                  {text(
                    "Save document request",
                    "Guardar pedido de documentos",
                  )}
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setRequesting(false);
                    requestAnimationFrame(() => requestButton.current?.focus());
                  }}
                >
                  {text("Cancel", "Cancelar")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {(record.evidenceRequests?.length ?? 0) > 1 && (
        <details className="application-evidence-request-history">
          <summary>
            {text(
              "Earlier document requests",
              "Pedidos de documentos anteriores",
            )}
          </summary>
          {record
            .evidenceRequests!.slice(0, -1)
            .reverse()
            .map((request) => (
              <article key={request.id}>
                <strong>
                  {text("Request", "Pedido")} {request.version} ·{" "}
                  {date(request.createdAt, true)}
                </strong>
                <p>
                  {request.documentIds
                    .map((documentId) => documentName(documentId, documentId))
                    .join(", ")}
                </p>
                {request.note && (
                  <p className="application-evidence-note">{request.note}</p>
                )}
              </article>
            ))}
        </details>
      )}
      {selectedFile && (
        <DocumentPreview
          record={{
            id: selectedFile.id,
            name: selectedFile.file.name,
            source: "local",
            kind: selectedFile.kind,
            mimeType: selectedFile.mimeType,
            file: selectedFile.file,
          }}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
