import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, FileCheck2, X } from "lucide-react";
import type { Property, Role } from "../types";
import type { ApplicationRecord } from "./applicationState";
import {
  futureLocalDate,
  localDateValue,
  validateRentalApplication,
  validateViewingRequest,
  type RentalApplicationDraft,
  type RequestErrors,
  type ViewingRequest,
  type ViewingRequestDraft,
} from "./propertyRequestState";
import { useDialogFocus } from "./useDialogFocus";
import "./propertyRequests.css";

const displayRequestDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

interface PropertyRequestDialogProps {
  mode: "viewing" | "application";
  property: Property;
  viewing?: ViewingRequest;
  onClose: () => void;
  onSaveViewing: (draft: ViewingRequestDraft) => void;
  onSaveApplication: (draft: RentalApplicationDraft) => void;
}

function PropertyRequestDialog({
  mode,
  property,
  viewing,
  onClose,
  onSaveViewing,
  onSaveApplication,
}: PropertyRequestDialogProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const id = useId();
  const isViewing = mode === "viewing";
  const [date, setDate] = useState(() =>
    isViewing ? (viewing?.date ?? futureLocalDate(1)) : futureLocalDate(14),
  );
  const [time, setTime] = useState(viewing?.time ?? "18:00");
  const [householdSize, setHouseholdSize] = useState("1");
  const [text, setText] = useState(isViewing ? (viewing?.note ?? "") : "");
  const [errors, setErrors] = useState<RequestErrors>({});
  const errorSummary = useRef<HTMLDivElement>(null);
  const textField = isViewing ? "note" : "introduction";

  useEffect(() => {
    if (Object.keys(errors).length) errorSummary.current?.focus();
  }, [errors]);

  const fieldError = (field: keyof RequestErrors) =>
    errors[field] ? (
      <small className="property-request-error" id={`${id}-${field}-error`}>
        {errors[field]}
      </small>
    ) : null;

  return createPortal(
    <div
      className="modal-layer property-request-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-scope`}
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
      <section className="modal-card property-request-card">
        <header>
          <div>
            <span className="eyebrow">LOCAL REQUEST</span>
            <h2 id={`${id}-title`}>
              {isViewing
                ? viewing
                  ? "Edit viewing request"
                  : "Request a viewing"
                : "Rental application"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close request"
            data-dialog-initial-focus
          >
            <X size={20} />
          </button>
        </header>
        <form
          className="modal-body property-request-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            // Native date pickers and autofill may commit without React's change event.
            const fields = new FormData(event.currentTarget);
            const submittedDate = String(fields.get("date") ?? "");
            const submittedTime = String(fields.get("time") ?? "");
            const submittedHousehold = String(
              fields.get("householdSize") ?? "",
            );
            const submittedText = String(fields.get(textField) ?? "");
            setDate(submittedDate);
            setTime(submittedTime);
            setHouseholdSize(submittedHousehold);
            setText(submittedText);
            const viewingDraft: ViewingRequestDraft = {
              date: submittedDate,
              time: submittedTime,
              note: submittedText,
            };
            const applicationDraft: RentalApplicationDraft = {
              moveInDate: submittedDate,
              householdSize: Number(submittedHousehold),
              introduction: submittedText,
            };
            const nextErrors = isViewing
              ? validateViewingRequest(viewingDraft)
              : validateRentalApplication(applicationDraft);
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length) return;
            if (isViewing) onSaveViewing(viewingDraft);
            else onSaveApplication(applicationDraft);
            onClose();
          }}
        >
          <strong className="property-request-property">
            {property.title}
          </strong>
          <p id={`${id}-scope`} className="property-request-scope">
            Saved in this tab only. Nothing is sent to the listing party, and no
            viewing or tenancy is confirmed.
          </p>
          {Object.keys(errors).length > 0 && (
            <div
              className="property-request-errors"
              ref={errorSummary}
              role="alert"
              tabIndex={-1}
            >
              <strong>Check these details</strong>
              <ul>
                {Object.entries(errors).map(([field, message]) => (
                  <li key={field}>
                    <a href={`#${id}-${field}`}>{message}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="property-request-fields">
            <label htmlFor={`${id}-date`}>
              {isViewing ? "Preferred date" : "Preferred move-in date"}
              <input
                id={`${id}-date`}
                name="date"
                type="date"
                aria-label={
                  isViewing ? "Preferred date" : "Preferred move-in date"
                }
                value={date}
                min={localDateValue()}
                required
                onInput={(event) => setDate(event.currentTarget.value)}
                onChange={(event) => setDate(event.target.value)}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? `${id}-date-error` : undefined}
              />
              {fieldError("date")}
            </label>
            {isViewing ? (
              <label htmlFor={`${id}-time`}>
                Preferred time
                <input
                  id={`${id}-time`}
                  name="time"
                  type="time"
                  aria-label="Preferred time"
                  required
                  value={time}
                  onInput={(event) => setTime(event.currentTarget.value)}
                  onChange={(event) => setTime(event.target.value)}
                  aria-invalid={Boolean(errors.time)}
                  aria-describedby={
                    errors.time ? `${id}-time-error` : undefined
                  }
                />
                {fieldError("time")}
              </label>
            ) : (
              <label htmlFor={`${id}-householdSize`}>
                Number of people
                <input
                  id={`${id}-householdSize`}
                  name="householdSize"
                  type="number"
                  aria-label="Number of people"
                  min="1"
                  step="1"
                  required
                  value={householdSize}
                  onInput={(event) =>
                    setHouseholdSize(event.currentTarget.value)
                  }
                  onChange={(event) => setHouseholdSize(event.target.value)}
                  aria-invalid={Boolean(errors.householdSize)}
                  aria-describedby={
                    errors.householdSize
                      ? `${id}-householdSize-error`
                      : undefined
                  }
                />
                {fieldError("householdSize")}
              </label>
            )}
            <label
              htmlFor={`${id}-${textField}`}
              className="property-request-wide"
            >
              {isViewing ? "Note (optional)" : "Introduction (optional)"}
              <textarea
                aria-label={
                  isViewing ? "Note (optional)" : "Introduction (optional)"
                }
                id={`${id}-${textField}`}
                name={textField}
                rows={3}
                maxLength={1000}
                value={text}
                onInput={(event) => setText(event.currentTarget.value)}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  isViewing
                    ? "For example, I can also visit on Saturday morning."
                    : "For example, my preferred move-in date is flexible."
                }
                aria-invalid={Boolean(errors[textField])}
                aria-describedby={
                  errors[textField] ? `${id}-${textField}-error` : undefined
                }
              />
              {fieldError(textField)}
            </label>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button">
              {isViewing ? "Save request" : "Save application"}
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
  viewing,
  application,
  onSaveViewing,
  onCancelViewing,
  onSaveApplication,
  onViewApplications,
  viewingLabel,
  applicationLabel,
}: Omit<PropertyRequestDialogProps, "mode" | "onClose"> & {
  role: Role;
  application?: ApplicationRecord;
  onCancelViewing: () => void;
  onViewApplications: () => void;
  viewingLabel: string;
  applicationLabel: string;
}) {
  const [flow, setFlow] = useState<"viewing" | "application" | null>(null);
  if (role !== "tenant")
    return (
      <p className="property-request-scope">
        Viewing and rental requests are available in the tenant workspace.
      </p>
    );

  return (
    <div className="property-request-actions">
      <button
        type="button"
        className="button button-secondary"
        onClick={() => setFlow("viewing")}
      >
        <CalendarDays size={16} />
        {viewing?.status === "Pending" ? "Edit viewing request" : viewingLabel}
      </button>
      {viewing && (
        <section
          className="property-request-summary"
          aria-label="Your local viewing request"
        >
          <strong>
            {viewing.status === "Pending"
              ? "Viewing request · pending locally"
              : "Viewing request · cancelled locally"}
          </strong>
          <time dateTime={`${viewing.date}T${viewing.time}`}>
            {displayRequestDate(viewing.date)} · {viewing.time}
          </time>
          {viewing.note && <p>{viewing.note}</p>}
          <small>Saved in this tab. Nothing has been sent or confirmed.</small>
          {viewing.status === "Pending" && (
            <button
              type="button"
              className="text-button"
              onClick={onCancelViewing}
            >
              Cancel local viewing request
            </button>
          )}
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
            {application ? "Open Applications" : applicationLabel}
          </button>
          {application && (
            <p className="property-request-scope">
              A local application for this home already exists (
              {application.status === "Review"
                ? "awaiting review"
                : application.status.toLowerCase()}
              ). You can inspect it in Applications.
            </p>
          )}
        </>
      )}
      {flow && (
        <PropertyRequestDialog
          mode={flow}
          property={property}
          viewing={viewing?.status === "Pending" ? viewing : undefined}
          onClose={() => setFlow(null)}
          onSaveViewing={onSaveViewing}
          onSaveApplication={onSaveApplication}
        />
      )}
    </div>
  );
}
